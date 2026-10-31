# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""Career Guidance AI API - thin composition root.

All route handlers live in :mod:`resume_pipeline.routers.*`; this module only
creates the FastAPI application, wires middleware/CORS, runs startup/shutdown
events and registers routers. Shared helpers are re-exported from
:mod:`resume_pipeline.routers.deps` for backward compatibility.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

from .config import settings, IS_SUPABASE
from .auth import (
    get_current_user, get_current_user_optional,
)
from .routers.deps import (
    get_db,
    _mask,
    validate_env,
    _record_failed_code_attempt,
    _clear_code_attempts,
)
from .interview.router import router as interview_router_v2
from .learning.router import interview_learning_router, router as learning_path_router
from .routers.auth import router as auth_router
from .routers.profile import router as profile_router
from .routers.resume import router as resume_router
from .routers.jobs import router as jobs_router
from .routers.applications import router as applications_router
from .routers.recommendations import router as recommendations_router
from .routers.credits import router as credits_router
from .routers.rag import router as rag_router
from .routers.misc import router as misc_router
from .routers.admin import router as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="Career Guidance AI API",
    description="AI-powered resume parsing and career recommendation system",
    version="1.0.0"
)

# Parse allowed origins from config (comma-separated string)
allow_origins_str = settings.CORS_ORIGINS
allow_origins = [origin.strip() for origin in allow_origins_str.split(",") if origin.strip()]

# Log CORS configuration on startup
logger.info(f"CORS Origins configured: {allow_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_cache_control_header(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/") or path.startswith("/parse/") or path.startswith("/upload"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Register interview system v2 router (/api/interview/*)
app.include_router(interview_router_v2)
app.include_router(interview_learning_router)
app.include_router(learning_path_router)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(resume_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(recommendations_router)
app.include_router(credits_router)
app.include_router(rag_router)
app.include_router(misc_router)
app.include_router(admin_router)


@app.get("/")
def root_endpoint():
    return {
        "status": "online",
        "message": "Welcome to the Career Guidance AI API",
        "docs": "/docs"
    }


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
async def startup_event():
    """Initialize database and RAG system on startup"""
    try:
        # Validate environment variables first
        validate_env()
        # Never log the full DSN — it contains the database password.
        logger.info("DB DSN resolved (credentials masked): host=%s db=%s user=%s",
                    _mask(settings.PG_HOST), _mask(settings.PG_DB), _mask(settings.PG_USER))

        if IS_SUPABASE:
            # Supabase: database is cloud-managed — skip CREATE DATABASE entirely
            logger.info("Supabase detected — skipping CREATE DATABASE (cloud-managed)")
            from .db import init_db
            init_db()
            logger.info("✓ Supabase tables initialized (CREATE TABLE IF NOT EXISTS)")
        elif settings.PG_HOST:
            # Local PostgreSQL: ensure the target database exists, then create tables
            import psycopg2
            from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
            pg_db = settings.PG_DB or 'resumes'
            conn = psycopg2.connect(
                host=settings.PG_HOST,
                port=settings.PG_PORT or 5432,
                user=settings.PG_USER or 'postgres',
                password=settings.PG_PASSWORD or '',
                dbname='postgres',  # connect to default db first
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (pg_db,))
            if not cur.fetchone():
                cur.execute(f'CREATE DATABASE "{pg_db}"')
                logger.info(f"✓ Database '{pg_db}' created")
            else:
                logger.info(f"✓ Database '{pg_db}' already exists")
            cur.close()
            conn.close()

            # Create tables
            from .db import init_db
            init_db()
            logger.info("✓ Local PostgreSQL tables initialized")
        else:
            # PG_DSN-only mode: initialize schema directly on configured PostgreSQL database
            from .db import init_db
            init_db()
            logger.info("✓ PostgreSQL tables initialized (PG_DSN mode)")
        
        # Self-healing alteration to inject new enum value for recommendation_refresh and fallback columns
        try:
            from sqlalchemy import text
            from .db import SessionLocal

            # Columns added after databases were created: create_all() never
            # adds columns to existing tables.
            from .db import engine as _schema_engine
            for statement in (
                "ALTER TABLE users ADD COLUMN login_method VARCHAR(20) DEFAULT 'password'",
                "ALTER TABLE users ADD COLUMN login_subject VARCHAR(255)",
            ):
                try:
                    with _schema_engine.begin() as _conn:
                        _conn.execute(text(statement))
                    logger.info("✓ added missing column: %s", statement.split("ADD COLUMN ")[-1])
                except Exception:
                    pass  # already present

            with SessionLocal() as db_session:
                try:
                    db_session.execute(text("ALTER TYPE activity_type ADD VALUE 'recommendation_refresh'"))
                    db_session.commit()
                    logger.info("✓ Added 'recommendation_refresh' to activity_type PostgreSQL enum")
                except Exception:
                    db_session.rollback()

                # Add fallback columns if missing
                try:
                    db_session.execute(text("ALTER TABLE job_recommendations ADD COLUMN is_fallback BOOLEAN DEFAULT FALSE"))
                    db_session.commit()
                    logger.info("✓ Added 'is_fallback' column to job_recommendations")
                except Exception:
                    db_session.rollback()

                try:
                    db_session.execute(text("ALTER TABLE job_recommendations ADD COLUMN fallback_source VARCHAR(100)"))
                    db_session.commit()
                    logger.info("✓ Added 'fallback_source' column to job_recommendations")
                except Exception:
                    db_session.rollback()

                # Clean up unique index on applicant_id in applicant_embeddings if it is unique
                try:
                    res = db_session.execute(text(
                        "SELECT indisunique FROM pg_index i "
                        "JOIN pg_class c ON c.oid = i.indexrelid "
                        "WHERE c.relname = 'ix_applicant_embeddings_applicant_id'"
                    )).fetchone()
                    if res and res[0]:
                        db_session.execute(text("DROP INDEX IF EXISTS ix_applicant_embeddings_applicant_id"))
                        db_session.commit()
                        db_session.execute(text(
                            "CREATE INDEX ix_applicant_embeddings_applicant_id ON applicant_embeddings (applicant_id)"
                        ))
                        db_session.commit()
                        logger.info("✓ Replaced unique index on applicant_embeddings.applicant_id with non-unique index")
                except Exception as e:
                    db_session.rollback()
                    logger.warning(f"Failed to migrate unique index on applicant_embeddings: {e}")

                # Create composite unique index on (applicant_id, embedding_model)
                try:
                    db_session.execute(text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_applicant_embeddings_applicant_model "
                        "ON applicant_embeddings (applicant_id, embedding_model)"
                    ))
                    db_session.commit()
                    logger.info("✓ Verified composite unique index uq_applicant_embeddings_applicant_model")
                except Exception as e:
                    db_session.rollback()
                    logger.warning(f"Failed to create composite unique index: {e}")

                # Create ivfflat index on job_embeddings_cache
                try:
                    db_session.execute(text(
                        "CREATE INDEX IF NOT EXISTS idx_job_emb_cache_ivfflat "
                        "ON job_embeddings_cache USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)"
                    ))
                    db_session.commit()
                    logger.info("✓ Verified ivfflat index idx_job_emb_cache_ivfflat")
                except Exception as e:
                    db_session.rollback()
                    logger.warning(f"Failed to create ivfflat index on job_embeddings_cache: {e}")
        except Exception as e:
            # Under SQLite or if already altered, we safely ignore
            pass

        # Admin seeding from env (idempotent; no-op unless both set; never logs values).
        try:
            from .admin_seed import seed_admin_from_env
            seed_admin_from_env()
        except Exception as e:
            logger.warning(f"Admin seeding skipped: {e}")

        # Job expiry sweep: transition approved jobs whose expires_at has
        # passed out of the active set (public listings also filter by date,
        # so this is a consistency measure, not a correctness dependency).
        try:
            from .background_tasks import cleanup_expired_jobs_async
            expired_count = cleanup_expired_jobs_async()
            if expired_count:
                logger.info(f"✓ Startup job-expiry sweep marked {expired_count} job(s) as expired")
        except Exception as e:
            logger.warning(f"Startup job-expiry sweep failed: {e}")

        # Initialize RAG system (lazy initialization on first query, but pre-initialize if possible)
        try:
            from .rag.rag_service import get_rag_service
            rag_service = get_rag_service()
            
            # Optional: Initialize on startup to avoid first-query latency
            # Comment out if you prefer lazy initialization for faster startup
            if settings.RAG_PRELOAD_ON_STARTUP:
                logger.info("Pre-initializing RAG system (docs indexing may take a few seconds)...")
                init_success = rag_service.initialize(force_rebuild=False)
                if init_success:
                    logger.info("✓ RAG system initialized successfully")
                else:
                    logger.warning("⚠ RAG system initialization failed, will retry on first query")
            else:
                logger.info("RAG system will initialize on first query (lazy mode)")
            
            # Start file watcher for automatic doc rebuild
            watcher_started = rag_service.start_file_watcher()
            if watcher_started:
                logger.info("✓ Documentation file watcher started")
            else:
                logger.warning("⚠ File watcher not available (watchdog may not be installed)")
                
        except ImportError:
            logger.warning("RAG system not available (rag module not found)")
        except Exception as e:
            logger.error(f"Error initializing RAG system: {e}")
            # Don't fail startup if RAG fails - it's optional
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Graceful shutdown - stop file watcher and cleanup"""
    try:
        from .rag.rag_service import get_rag_service
        rag_service = get_rag_service()
        
        # Stop file watcher
        rag_service.stop_file_watcher()
        logger.info("✓ Documentation file watcher stopped")
        
    except Exception as e:
        logger.warning(f"Error during RAG shutdown: {e}")
    
    logger.info("Application shutdown completed")


# Local development entrypoint (reads host/port from .env via settings)
# ============================================================
if __name__ == "__main__":
    import uvicorn
    # Cloud Run: bind to 0.0.0.0, read PORT from env; no reload for production
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "resume_pipeline.app:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
