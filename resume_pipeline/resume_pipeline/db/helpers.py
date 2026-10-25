from sqlalchemy import create_engine
from sqlalchemy.engine import URL as SA_URL
from sqlalchemy.orm import sessionmaker
from ..config import settings, IS_SUPABASE
from .base import Base
from .jobs import Job
import os


# ============================================================
# DATABASE SETUP
# ============================================================

# CI_SKIP_DB_VALIDATION: allow import without a real database for unit tests.
# Any test that actually tries to execute a query will fail at that point.
_ci_skip_db = os.environ.get("CI_SKIP_DB_VALIDATION", "").lower() in ("1", "true", "yes")

if settings.PG_DSN is None and not _ci_skip_db:
    raise RuntimeError("PG_DSN is not set in settings; cannot create engine")

if _ci_skip_db:
    # CI/test stub: a single shared in-memory SQLite database so that suites
    # which exercise real service logic through SessionLocal can run without
    # PostgreSQL. StaticPool keeps every session on the same connection-backed
    # database, and the full schema is created up front from the models.
    import sqlalchemy
    from sqlalchemy.pool import StaticPool
    engine = sqlalchemy.create_engine(
        "sqlite:///:memory:",
        echo=False,
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
else:
    if IS_SUPABASE:
        # If a full PG_DSN or DATABASE_URL is set directly (e.g., in Render), use it.
        # Ensure it's prefixed with postgresql+psycopg2:// and has query options.
        _env_db_url = os.environ.get("DATABASE_URL") or settings.DATABASE_URL or settings.PG_DSN
        # Check if we should use this full DSN instead of building from parts.
        # We use this DSN if we don't have individual credentials (like PG_HOST).
        if _env_db_url and not os.environ.get("PG_HOST") and not settings.PG_HOST:
            dsn = _env_db_url
            if dsn.startswith("postgres://"):
                dsn = dsn.replace("postgres://", "postgresql+psycopg2://", 1)
            elif dsn.startswith("postgresql://"):
                dsn = dsn.replace("postgresql://", "postgresql+psycopg2://", 1)

            # Add query parameters if not present
            if "?" not in dsn:
                dsn += "?sslmode=require&gssencmode=disable"
            else:
                if "sslmode=" not in dsn:
                    dsn += "&sslmode=require"
                if "gssencmode=" not in dsn:
                    dsn += "&gssencmode=disable"
            engine = create_engine(dsn, echo=False, future=True)
        else:
            # Use URL.create() to avoid any string-parsing issues with special chars in username/password.
            # Read directly from OS env vars as the ultimate source of truth.
            _pg_user = os.environ.get("PG_USER") or settings.PG_USER or "postgres"
            _pg_pass = os.environ.get("PG_PASSWORD") or settings.PG_PASSWORD or ""
            _pg_host = os.environ.get("PG_HOST") or settings.PG_HOST or "localhost"
            _pg_port = int(os.environ.get("PG_PORT") or settings.PG_PORT or 5432)
            _pg_db   = os.environ.get("PG_DB")   or settings.PG_DB   or "postgres"
            _url = SA_URL.create(
                drivername="postgresql+psycopg2",
                username=_pg_user,
                password=_pg_pass,
                host=_pg_host,
                port=_pg_port,
                database=_pg_db,
                query={"sslmode": "require", "gssencmode": "disable"},
            )
            engine = create_engine(_url, echo=False, future=True)
    else:
        engine = create_engine(settings.PG_DSN, echo=False, future=True)

SessionLocal = sessionmaker(bind=engine)


def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def active_job_criteria(now):
    """Return SQLAlchemy filter clauses for publicly visible jobs.

    Dedupe of five identical ``status == 'approved'`` + ``expires_at`` blocks
    previously repeated in ``routers/jobs.py``, ``recommendation/engine.py``
    (x3) and ``resume/ats_scorer.py``. Zero behavior change — same predicates.
    """
    return [
        Job.status == 'approved',
        ((Job.expires_at.is_(None)) | (Job.expires_at > now)),
    ]
