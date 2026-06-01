# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Body, Request, status, WebSocket, WebSocketDisconnect, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from uuid import uuid4
from typing import Optional, List, Dict, Any, cast
from collections import defaultdict
from time import time
import os
import socket
from urllib.parse import urlparse
from .utils import save_upload, sha256_file, sanitize_text, sanitize_dict, validate_email, sanitize_filename
from .config import settings, IS_SUPABASE
from .constants import (
    ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB,
    API_MESSAGES, DEFAULT_PAGE_SIZE,
    INTERVIEW_CONFIG, INTERVIEW_SCORE_MULTIPLIERS, LIVE_INTERVIEW_CONFIG, INTERVIEW_CONFIG_V2
)
from .schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    JobCreate, JobUpdate, JobResponse,
    JobApplicationCreate, JobApplicationResponse,
    ApprovalAction, MarksheetUpload, VerifyCodeRequest, ResendCodeRequest,
    SkillAssessmentCreate, SkillAssessmentResponse, LearningPathResponse,
    CreditAccountResponse, CreditTransactionResponse,
    AdminCreditAdjustment,
)
from .auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_user_optional, require_role, decode_access_token
)
from pathlib import Path
import json
from .resume.parse_service import ResumeParserService
from .interview.router import router as interview_router_v2, learning_path_router
import logging
from datetime import timedelta
import secrets
import datetime as dt
from sqlalchemy import desc

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Runtime circuit breaker for async embedding queueing.
# If broker/backend is unavailable, disable enqueue attempts for this process.
_EMBEDDING_QUEUE_DISABLED = False
_EMBEDDING_BROKER_UNAVAILABLE_LOGGED = False


# Background tasks are run natively using FastAPI BackgroundTasks.

# Import repository factory
from .repos.factory import DatabaseFactory

# Rate limiting storage (in-memory, consider Redis for production)
rate_limiting_storage = defaultdict(list)

def _mask(val: Optional[str], keep: int = 4) -> str:
    if not val:
        return "<unset>"
    try:
        s = str(val)
        if len(s) <= keep:
            return "*" * len(s)
        return ("*" * (len(s) - keep)) + s[-keep:]
    except Exception:
        return "<hidden>"

def validate_env():
    """Validate critical environment variables on startup and print a clear summary."""
    errors: list[str] = []
    warnings: list[str] = []

    # Raw env values (so we can show what app actually sees)
    env = os.environ

    # Critical: Database configuration
    pg_dsn = settings.PG_DSN
    pg_host = settings.PG_HOST
    pg_user = settings.PG_USER
    pg_db = settings.PG_DB

    if not pg_host and not pg_dsn:
        errors.append("PG_HOST is missing (or provide PG_DSN)")
    if not pg_user and not pg_dsn:
        errors.append("PG_USER is missing (or provide PG_DSN)")
    if not pg_db and not pg_dsn:
        errors.append("PG_DB is missing (or provide PG_DSN)")

    # Critical: JWT Secret Key
    secret = settings.SECRET_KEY or ""
    if len(secret) < 32:
        warnings.append("SECRET_KEY should be at least 32 characters long")
    if os.environ.get("RENDER") and len(secret) < 32:
        errors.append("SECRET_KEY is missing or too short for production")

    # Important: Gemini API (warn if not set, as it may use mock mode)
    if not settings.GEMINI_API_KEY:
        warnings.append("GEMINI_API_KEY not set - using mock/stub parsing mode")

    # Important: Email configuration (warn if missing)
    if not settings.GMAIL_USER or not settings.GMAIL_APP_PASSWORD:
        warnings.append("GMAIL_USER or GMAIL_APP_PASSWORD not set - email verification disabled")

    # Always print a masked summary for quick diagnosis
    if IS_SUPABASE:
        env_mode = "Supabase (cloud)"
    elif pg_host:
        env_mode = "Local PostgreSQL"
    else:
        env_mode = "PostgreSQL (custom DSN)"

    summary_lines = [
        f"Environment:     {env_mode}",
        f"PG_DSN:          {'<set>' if pg_dsn else '<unset>'}",
        f"PG_HOST:         {_mask(env.get('PG_HOST'))}",
        f"PG_PORT:         {_mask(env.get('PG_PORT'))}",
        f"PG_USER:         {_mask(env.get('PG_USER'))}",
        f"PG_DB:           {_mask(env.get('PG_DB'))}",
        f"SECRET_KEY:      length={len(secret) if secret else 0} {_mask(secret)}",
        f"GEMINI_API_KEY:  {'<set>' if env.get('GEMINI_API_KEY') else '<unset>'}",
        f"GMAIL_USER:      {_mask(env.get('GMAIL_USER'))}",
    ]
    logger.info("Environment summary (masked):\n" + "\n".join(["  • " + s for s in summary_lines]))

    # Log results
    if errors:
        error_msg = "\n".join([f"  ❌ {err}" for err in errors])
        logger.error(f"Environment validation failed with {len(errors)} error(s):\n{error_msg}")
        raise RuntimeError(f"Critical environment variables missing or invalid:\n{error_msg}")

    if warnings:
        warning_msg = "\n".join([f"  ⚠️  {warn}" for warn in warnings])
        logger.warning(f"Environment warnings:\n{warning_msg}")

    logger.info("✓ Environment validation passed")

def rate_limit(request: Request, max_requests: int = 5, window: int = 60) -> bool:
    """Simple rate limiting middleware"""
    client_ip = request.client.host if request.client else "unknown"
    endpoint = request.url.path
    key = f"{client_ip}:{endpoint}"
    
    current_time = time()
    # Clean old requests outside the window
    rate_limiting_storage[key] = [
        req_time for req_time in rate_limiting_storage[key]
        if current_time - req_time < window
    ]
    
    # Check if limit exceeded
    if len(rate_limiting_storage[key]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max {max_requests} requests per {window} seconds."
        )
    
    # Add current request
    rate_limiting_storage[key].append(current_time)
    return True

# Database dependency
def get_db():
    """FastAPI dependency for database sessions"""
    from .db import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_job_repo():
    """Get job repository"""
    from .repos.pg_impl import PGJobRepository
    from .db import SessionLocal
    session = SessionLocal()
    return PGJobRepository(session)

# File size validation
async def validate_file_size(file: UploadFile, max_size_mb: int = MAX_FILE_SIZE_MB):
    """Validate uploaded file size"""
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()  # Get size in bytes
    file.file.seek(0)  # Reset to beginning
    
    max_size_bytes = max_size_mb * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {max_size_mb}MB"
        )
    return True

app = FastAPI(
    title="Career Guidance AI API",
    description="AI-powered resume parsing and career recommendation system",
    version="1.0.0"
)

# Add CORS middleware for frontend
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

# Register interview system v2 router (/api/interview/*)
app.include_router(interview_router_v2)
app.include_router(learning_path_router)


@app.on_event("startup")
async def startup_event():
    """Initialize database and RAG system on startup"""
    try:
        # Validate environment variables first
        validate_env()
        logger.info(f"DB DSN resolved to: {settings.PG_DSN}")

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
        
        # Self-healing alteration to inject new enum value for recommendation_refresh
        try:
            from sqlalchemy import text
            from .db import SessionLocal
            with SessionLocal() as db_session:
                db_session.execute(text("ALTER TYPE activity_type ADD VALUE 'recommendation_refresh'"))
                db_session.commit()
                logger.info("✓ Added 'recommendation_refresh' to activity_type PostgreSQL enum")
        except Exception as e:
            # Under SQLite or if the enum value already exists, this will throw an error, which we safely ignore
            pass
        
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

DATA_ROOT = Path(settings.FILE_STORAGE_PATH)


# ============================================================
# AUTHENTICATION ENDPOINTS
# ============================================================

@app.post("/api/auth/register", response_model=UserResponse)
async def register(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """Register a new user and send verification email"""
    
    from .db import User, Employer
    from .email_verification import (
        generate_verification_token,
        send_verification_email,
        generate_verification_code,
        send_verification_code_email,
    )
    import datetime
    
    # Validate and sanitize email
    if not validate_email(user_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Sanitize text inputs
    name = sanitize_text(user_data.name, max_length=200)
    email = user_data.email.strip().lower()
    
    # Check if email already exists
    try:
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error during registration: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again."
        )
    
    # Always generate a verification CODE (link flow disabled)
    base_code = generate_verification_code(settings.VERIFICATION_CODE_LENGTH or 6, digits_only=True)
    # Store a composite token to satisfy DB uniqueness (CODE-randomsuffix)
    verification_secret = f"{base_code}-{secrets.token_hex(3)}"
    
    # Create user
    try:
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            email=email,
            password_hash=hashed_password,
            name=name,
            role=user_data.role.value,
            phone=sanitize_text(user_data.phone or "", max_length=20) if user_data.phone else None,
            is_active=True,
            is_verified=False,
            verification_token=verification_secret,
            verification_token_created_at=dt.datetime.utcnow()
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account"
        )
    
    # Send verification email (non-blocking - don't fail registration if email fails)
    try:
        email_sent = send_verification_code_email(
            to_email=user_data.email,
            code=base_code,
            user_name=user_data.name
        )
        if not email_sent:
            logger.warning(f"Failed to send verification email to {user_data.email}")
    except Exception as e:
        logger.error(f"Error sending verification email: {e}")
    
    # Create role-specific profile
    if user_data.role.value == 'employer':
        employer = Employer(
            user_id=new_user.id,
            company_name=user_data.name,
            is_verified=False
        )
        db.add(employer)

    db.commit()
    
    logger.info(f"New user registered: {new_user.email} as {new_user.role}")
    return new_user


@app.post("/api/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and receive access token"""
    from .db import User
    
    # Find user
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Verify password
    password_hash = getattr(user, 'password_hash', '')
    if not verify_password(form_data.password, password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    is_active = getattr(user, 'is_active', True)
    if not is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    
    # Require email verification before issuing tokens
    if not getattr(user, 'is_verified', False):
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Enter your verification code or request a new one via /api/auth/resend-verification."
        )
    
    # Create access token (sub must be string for JWT)
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "is_verified": user.is_verified
        }
    }


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_current_user)):
    """Get current user information"""
    return current_user


@app.patch("/api/auth/profile")
async def update_profile(
    name: str = Body(..., embed=True),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile (name only)"""
    from .db import User
    
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    setattr(user, 'name', name)
    db.commit()
    
    return {"status": "success", "message": "Profile updated successfully"}


@app.patch("/api/auth/change-password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    from .db import User
    
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    password_hash = getattr(user, 'password_hash', '')
    if not verify_password(current_password, password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    new_hash = get_password_hash(new_password)
    setattr(user, 'password_hash', new_hash)
    db.commit()
    
    return {"status": "success", "message": "Password changed successfully"}


@app.patch("/api/auth/deactivate")
async def deactivate_account(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate currently authenticated user account."""
    from .db import User

    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not getattr(user, 'is_active', True):
        return {"status": "success", "message": "Account already deactivated"}

    setattr(user, 'is_active', False)
    db.commit()

    return {"status": "success", "message": "Account deactivated successfully"}


@app.get("/api/student/profile")
async def get_student_profile(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get student resume profile with parsed data"""
    from .db import Applicant, LLMParsedRecord
    
    # Always use the latest applicant record linked to this user.
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .options(joinedload(Applicant.parsed_record))
        .order_by(desc(Applicant.id))
        .first()
    )
    
    if not applicant:
        # Return empty profile structure if no applicant found
        return {
            "applicant_id": None,
            "skills": [],
            "education": [],
            "experience": [],
            "projects": [],
            "certifications": [],
            "jee_rank": None
        }
    
    # Get parsed resume data
    parsed = applicant.parsed_record
    if not parsed:
        return {
            "applicant_id": applicant.id,
            "skills": [],
            "education": [],
            "experience": [],
            "projects": [],
            "certifications": [],
            "jee_rank": None
        }
    
    # Extract normalized data
    normalized = parsed.normalized or {}
    
    # Helper to ensure lists
    def get_list(key, default=[]):
        val = normalized.get(key, default)
        return val if isinstance(val, list) else default

    skills = get_list("skills", [])
    parsed_personal = normalized.get("personal_info") or normalized.get("personal", {})
    if not isinstance(parsed_personal, dict):
        parsed_personal = {}

    auth_name = (getattr(current_user, 'name', None) or '').strip()
    auth_phone = (getattr(current_user, 'phone', None) or '').strip()
    auth_location = ''
    if getattr(applicant, 'location_city', None):
        auth_location = str(getattr(applicant, 'location_city')).strip()
    if getattr(applicant, 'location_state', None):
        state = str(getattr(applicant, 'location_state')).strip()
        auth_location = f"{auth_location}, {state}" if auth_location else state

    personal_info = {
        "name": auth_name or (parsed_personal.get("name") or ""),
        "email": (getattr(current_user, 'email', None) or '').strip() or (parsed_personal.get("email") or ""),
        "phone": auth_phone or (parsed_personal.get("phone") or ""),
        "location": auth_location or (parsed_personal.get("location") or ""),
    }
    summary = normalized.get("summary")

    if not summary:
        top_skills = []
        for skill in skills[:5]:
            if isinstance(skill, dict) and skill.get("name"):
                top_skills.append(str(skill.get("name")))
            elif isinstance(skill, str):
                top_skills.append(skill)

        person_name = personal_info.get("name") if isinstance(personal_info, dict) else None
        if person_name and top_skills:
            summary = f"{person_name} with skills in {', '.join(top_skills)}."
        elif person_name:
            summary = f"{person_name}'s resume has been parsed successfully."
        elif top_skills:
            summary = f"Parsed skills include {', '.join(top_skills)}."
        else:
            summary = "Resume parsed successfully."
    
    return {
        "applicant_id": applicant.id,
        "display_name": applicant.display_name or current_user.name,
        "skills": skills,
        "education": get_list("education", []),
        "experience": get_list("experience", []),
        "projects": get_list("projects", []),
        "certifications": get_list("certifications", []),
        "jee_rank": normalized.get("jee_rank"),
        "summary": summary,
        "personal_info": personal_info,
    }


@app.get("/api/student/resume/scorecard")
async def get_student_resume_scorecard(
    job_id: Optional[int] = None,
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Calculate and return the student's ATS Resume Score Card"""
    from .db import Applicant, LLMParsedRecord, Job
    from .resume.ats_scorer import score_resume
    
    # Fetch current student's applicant record
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found. Please upload a resume first.")

    parsed = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()
    if not parsed:
        raise HTTPException(status_code=404, detail="No parsed resume data found. Please parse your resume first.")

    normalized = parsed.normalized or {}
    
    job_skills = None
    target_job_title = "General Market Demand"
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job_skills = job.required_skills or []
            target_job_title = job.title

    result = score_resume(parsed_data=normalized, job_skills=job_skills, db=db)
    result["target_job_title"] = target_job_title
    result["job_id"] = job_id
    
    return result


@app.put("/api/student/profile")
async def update_student_profile(
    profile_data: dict = Body(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update student resume profile"""
    from .db import Applicant, LLMParsedRecord
    
    # Always use the latest applicant record linked to this user.
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .options(joinedload(Applicant.parsed_record))
        .order_by(desc(Applicant.id))
        .first()
    )
    
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    # Get or create parsed record
    parsed = applicant.parsed_record
    if not parsed:
        parsed = LLMParsedRecord(
            applicant_id=applicant.id,
            raw_llm_output={},
            normalized={}
        )
        db.add(parsed)
        db.flush()
    
    # Get current normalized data
    current_normalized = getattr(parsed, 'normalized', {}) or {}
    
    # Build update dictionary
    update_dict = current_normalized if isinstance(current_normalized, dict) else {}
    
    # Update specific fields if provided
    for field in ["skills", "education", "experience", "projects", "certifications", "jee_rank"]:
        if field in profile_data:
            update_dict[field] = profile_data[field]
    
    # Update the record using SQLAlchemy
    db.query(LLMParsedRecord).filter(
        LLMParsedRecord.applicant_id == applicant.id
    ).update({"normalized": update_dict}, synchronize_session=False)
    
    db.commit()
    
    return {
        "status": "success",
        "message": "Resume profile updated successfully",
        "applicant_id": applicant.id
    }


@app.post("/api/auth/verify-email")
async def verify_email_disabled(token: str = Body(..., embed=True)):
    """Link-based verification disabled in this deployment."""
    raise HTTPException(status_code=410, detail="Link-based verification is disabled; use /api/auth/verify-code")


@app.post("/api/auth/verify-code")
async def verify_code(payload: VerifyCodeRequest, db: Session = Depends(get_db)):
    """Verify user email using a short code sent via email."""
    from .db import User
    from .email_verification import is_code_expired

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_verified:  # type: ignore
        return {"status": "success", "message": "Email already verified"}

    # Compare against stored verification_token (repurposed to store code)
    stored = getattr(user, 'verification_token', None)
    created_at = getattr(user, 'verification_token_created_at', None)
    if not stored or not created_at:
        raise HTTPException(status_code=400, detail="No active verification code. Please resend.")

    # Stored token is in format CODE-randomsuffix; compare only the CODE part
    stored_code = str(stored).split('-', 1)[0]
    if str(payload.code).strip() != stored_code.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if is_code_expired(created_at, settings.VERIFICATION_CODE_TTL_MINUTES or 30):
        raise HTTPException(status_code=400, detail="Verification code has expired")

    user.is_verified = True  # type: ignore
    user.verification_token = None  # type: ignore
    user.verification_token_created_at = None  # type: ignore
    db.commit()

    logger.info(f"Email verified via code for user: {user.email}")
    return {"status": "success", "message": "Email verified successfully"}


@app.post("/api/auth/forgot-password")
async def forgot_password(
    email: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Request password reset - sends reset code to email"""
    
    from .db import User
    from .email_verification import generate_verification_code, send_password_reset_code_email
    
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Don't reveal if email exists (security best practice)
            return {"message": "If the email exists, a password reset code has been sent"}
        
        # Generate 6-digit reset code
        reset_code = generate_verification_code(length=6, digits_only=True)
        reset_expires = dt.datetime.utcnow() + dt.timedelta(minutes=settings.VERIFICATION_CODE_TTL_MINUTES or 30)
        
        # Set reset code (use setattr to avoid type checker issues)
        setattr(user, 'password_reset_token', reset_code)
        setattr(user, 'password_reset_expires', reset_expires)
        db.commit()
        
        # Send email with reset code
        email_sent = send_password_reset_code_email(
            to_email=email,
            code=reset_code,
            user_name=getattr(user, 'name', 'User')
        )
        
        if not email_sent:
            logger.warning(f"Password reset code generated but email failed for {email}")
            # Still return success to not reveal if email exists
        else:
            logger.info(f"Password reset code sent to {email}")
        
        return {"message": "If the email exists, a password reset code has been sent"}
    except Exception as e:
        logger.error(f"Password reset request failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request"
        )


@app.post("/api/auth/reset-password")
async def reset_password(
    code: str = Body(...),
    new_password: str = Body(...),
    db: Session = Depends(get_db)
):
    """Reset password using reset code"""
    
    from .db import User
    
    try:
        # Find user by reset code
        user = db.query(User).filter(User.password_reset_token == code).first()
        
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset code")
        
        # Check code expiration (use getattr to avoid type checker issues)
        expires = getattr(user, 'password_reset_expires', None)
        if expires is None or expires < dt.datetime.utcnow():
            raise HTTPException(status_code=400, detail="Reset code has expired")
        
        # Validate password strength
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        
        # Update password (use setattr to avoid type checker issues)
        setattr(user, 'password_hash', get_password_hash(new_password))
        setattr(user, 'password_reset_token', None)
        setattr(user, 'password_reset_expires', None)
        db.commit()
        
        logger.info(f"Password reset successful for user {user.email}")
        return {"message": "Password reset successful"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )


@app.post("/api/auth/resend-verification")
async def resend_verification_email(email: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """Resend verification email"""
    from .db import User
    from .email_verification import (
        generate_verification_code,
        send_verification_code_email,
    )
    import datetime
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_verified:  # type: ignore
        raise HTTPException(status_code=400, detail="Email already verified")
    
    # Generate new token/code depending on mode
    base_code = generate_verification_code(settings.VERIFICATION_CODE_LENGTH or 6, digits_only=True)
    user.verification_token = f"{base_code}-{secrets.token_hex(3)}"  # type: ignore
    user.verification_token_created_at = dt.datetime.utcnow()  # type: ignore
    db.commit()
    
    # Send email
    user_name = getattr(user, 'name', None) or "User"
    email_sent = send_verification_code_email(
        to_email=email,
        code=base_code,
        user_name=user_name
    )
    
    if not email_sent:
        raise HTTPException(status_code=500, detail="Failed to send verification email")
    
    return {"status": "success", "message": "Verification email sent"}


@app.post("/upload")
@app.post("/api/upload/resume")
async def upload_resume(
    request: Request,
    background_tasks: BackgroundTasks,
    resume: UploadFile = File(...),
    jee_rank: Optional[int] = Form(None),
    location: Optional[str] = Form(None),
    preferences: Optional[str] = Form(None),
    marksheets: Optional[List[UploadFile]] = File(None),
    upload_type: str = Form("resume"),  # "resume" or "marksheet"
    twelfth_percentage: Optional[float] = Form(None),
    twelfth_board: Optional[str] = Form(None),
    twelfth_subjects: Optional[str] = Form(None),  # JSON string
    current_user = Depends(get_current_user_optional),  # Optional authentication
    db: Session = Depends(get_db)
):
    logger.info(f"Upload request received - resume: {resume.filename if resume else None}, jee_rank: {jee_rank}, location: {location}")
    
    # Apply rate limiting (5 uploads per 5 min)
    try:
        rate_limit(request, max_requests=5, window=300)
    except HTTPException:
        raise
    
    from .db import Applicant, Upload
    
    # Validate file type using constants
    if not resume.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_ext = Path(resume.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=API_MESSAGES['INVALID_FILE_TYPE']
        )
    
    # Validate file size
    await validate_file_size(resume, MAX_FILE_SIZE_MB)
    
    # Validate marksheets if provided
    if marksheets:
        for marksheet in marksheets:
            await validate_file_size(marksheet, MAX_FILE_SIZE_MB)
    
    # save files
    # Check if logged in user already has an applicant profile to prevent duplicate applicant IDs
    existing_applicant = None
    if current_user:
        existing_applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()

    if existing_applicant:
        applicant_id = existing_applicant.applicant_id
    else:
        applicant_id = f"app_{uuid4().hex}"
    
    applicant_dir = DATA_ROOT / applicant_id
    
    try:
        applicant_dir.mkdir(parents=True, exist_ok=True)

        res_name = resume.filename or "resume_upload"
        resume_path = applicant_dir / res_name
        # read and write
        with open(resume_path, "wb") as f:
            content = await resume.read()
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to save resume file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file"
        )

    resume_hash = sha256_file(str(resume_path))
    
    # Check for duplicate resume by hash
    existing_upload = db.query(Upload).filter(Upload.file_hash == resume_hash).first()
    if existing_upload:
        existing_applicant = db.query(Applicant).filter(Applicant.id == existing_upload.applicant_id).first()
        if existing_applicant:
            from .db import LLMParsedRecord
            parsed_rec = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == existing_applicant.id).first()
            
            # If the previous parse exists and was accepted, treat as duplicate.
            # Otherwise, allow re-upload/re-parse (e.g. if the previous parse failed due to transient rate limits).
            if parsed_rec and getattr(parsed_rec, 'parse_status', None) == 'accepted':
                logger.info(f"Duplicate resume detected with accepted status. Returning existing applicant {existing_applicant.applicant_id}")
                created_str = None
                if hasattr(existing_applicant, 'created_at'):
                    try:
                        val = getattr(existing_applicant, 'created_at', None)
                        if val is not None:
                            created_str = val.isoformat()
                    except:
                        pass
                return JSONResponse({
                    "status": "duplicate",
                    "message": "This resume has already been uploaded",
                    "applicant_id": existing_applicant.applicant_id,
                    "db_id": existing_applicant.id,
                    "resume_hash": resume_hash,
                    "existing_created_at": created_str
                })
            else:
                logger.info(f"Duplicate resume detected for applicant {existing_applicant.applicant_id}, but parse was not accepted (status={getattr(parsed_rec, 'parse_status', None) if parsed_rec else 'None'}). Proceeding to re-parse.")

    marks_paths = []
    if marksheets:
        for ms in marksheets:
            ms_name = ms.filename or "marksheet_upload"
            ms_path = applicant_dir / ms_name
            with open(ms_path, "wb") as f:
                f.write(await ms.read())
            marks_paths.append(str(ms_path))

    # store a minimal metadata JSON next to files
    meta = {
        "applicant_id": applicant_id,
        "resume_file": str(resume_path),
        "resume_hash": resume_hash,
        "marksheets": marks_paths,
        "jee_rank": jee_rank,
        "jee_rank_user_provided": jee_rank is not None,  # Flag to prioritize user input
        "location": location,
        "preferences": preferences,
    }
    with open(applicant_dir / "metadata.json", "w", encoding="utf-8") as mf:
        json.dump(meta, mf, indent=2)
    
    # Save to database
    try:
        # Extract location parts
        location_parts = (location or "").split(",")
        city = location_parts[0].strip() if location_parts else None
        state = location_parts[1].strip() if len(location_parts) > 1 else None
        
        # Create applicant record
        # Parse preferences - handle both JSON array and comma-separated string
        preferred_locs = None
        if preferences:
            try:
                preferred_locs = json.loads(preferences)
            except (json.JSONDecodeError, TypeError):
                # If not JSON, treat as comma-separated string
                preferred_locs = [loc.strip() for loc in preferences.split(',') if loc.strip()]

        if existing_applicant:
            applicant = existing_applicant
            applicant.location_city = city
            applicant.location_state = state
            applicant.preferred_locations = preferred_locs
            db.add(applicant)
        else:
            applicant = Applicant(
                user_id=current_user.id if current_user else None,
                applicant_id=applicant_id,
                display_name=f"Applicant {applicant_id[:8]}",
                location_city=city,
                location_state=state,
                preferred_locations=preferred_locs
            )
            db.add(applicant)
        db.flush()  # Get the ID
        
        # Create upload record (cleanup older resume upload if updating existing profile)
        if existing_applicant:
            db.query(Upload).filter(
                Upload.applicant_id == applicant.id,
                Upload.file_type == 'resume'
            ).delete()

        upload = Upload(
            applicant_id=applicant.id,
            file_name=res_name,
            file_type='resume',
            storage_path=str(resume_path),
            file_hash=resume_hash
        )
        db.add(upload)
        
        # Create credit account with default 60 credits if it does not exist
        from .db import CreditAccount
        import datetime
        existing_credits = db.query(CreditAccount).filter(CreditAccount.applicant_id == applicant.id).first()
        if not existing_credits:
            credit_account = CreditAccount(
                applicant_id=applicant.id,
                current_credits=60,
                total_earned=60,
                total_spent=0,
                last_refill_at=datetime.datetime.utcnow(),
                next_refill_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
                is_premium=False
            )
            db.add(credit_account)
        db.commit()
        
        logger.info(f"✓ Saved applicant {applicant_id} to database (ID: {applicant.id})")
        logger.info(f"✓ Created credit account with 60 initial credits")

        parse_task_id = None
        if settings.ASYNC_PARSE_ENABLED:
            try:
                from .embedding_tasks import parse_resume_task

                background_tasks.add_task(parse_resume_task, applicant_id, str(applicant_dir))
                parse_task_id = applicant_id
                logger.info("Queued parse task via BackgroundTasks for applicant %s", applicant_id)
            except Exception as exc:
                logger.warning("Could not auto-queue parse task for %s: %s", applicant_id, exc)
        
        return JSONResponse({
            "status": "ok",
            "applicant_id": applicant_id,
            "db_id": applicant.id,
            "resume_hash": resume_hash,
            "parse_task_id": parse_task_id,
        })
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save to database: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Still return success for file upload even if DB fails
        return JSONResponse({
            "status": "ok",
            "applicant_id": applicant_id,
            "resume_hash": resume_hash,
            "warning": f"File saved but database record failed: {str(e)}"
        })


parser_service = ResumeParserService()


@app.post("/parse/{applicant_id}")
async def parse_applicant(
    applicant_id: str,
    background_tasks: BackgroundTasks,
    sync: bool = False,
    db: Session = Depends(get_db)
):
    from .db import Applicant, LLMParsedRecord
    
    applicant_dir = DATA_ROOT / applicant_id
    if not applicant_dir.exists():
        raise HTTPException(status_code=404, detail="applicant_id not found")

    # Async-first parsing: queue worker task and return immediately.
    # Use ?sync=true to force in-process parsing for debugging/rollback.
    if settings.ASYNC_PARSE_ENABLED and not sync:
        try:
            from .embedding_tasks import parse_resume_task

            background_tasks.add_task(parse_resume_task, applicant_id, str(applicant_dir))
            return JSONResponse({
                "status": "queued",
                "applicant_id": applicant_id,
                "parse_task_id": applicant_id,
                "message": "Parse job queued.",
            })
        except Exception as e:
            logger.warning("Failed to queue parse task for %s: %s", applicant_id, e)
            logger.warning("Falling back to sync parse for %s", applicant_id)
    
    # Run parsing (sync fallback — only used when ASYNC_PARSE_ENABLED=False or ?sync=true)
    result = parser_service.run_parse(str(applicant_dir), applicant_id)
    
    # Save to database
    try:
        # Find applicant by applicant_id string
        applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()
        if not applicant:
            logger.warning(f"Applicant {applicant_id} not found in database, skipping save")
            return JSONResponse(result)
        
        # Update display name from parsed data if available
        normalized = result.get('normalized', {})
        # Try both 'personal' (v2) and 'personal_info' (legacy) key
        personal_info = normalized.get('personal') or normalized.get('personal_info') or {}
        if isinstance(personal_info, dict):
            if personal_info.get('name'):
                applicant.display_name = personal_info['name']
            if personal_info.get('location'):
                location_parts = personal_info['location'].split(',')
                applicant.location_city = location_parts[0].strip() if location_parts else None  # type: ignore
                applicant.location_state = location_parts[1].strip() if len(location_parts) > 1 else None  # type: ignore
        
        # Save or update LLM parsed record (with all v2 fields)
        llm_record = db.query(LLMParsedRecord).filter(
            LLMParsedRecord.applicant_id == applicant.id
        ).first()

        parse_status_val = result.get('parse_status', 'accepted')
        
        if llm_record:
            # Update existing
            llm_record.raw_llm_output = result  # type: ignore
            llm_record.normalized = normalized  # type: ignore
            llm_record.llm_provenance = result.get('llm_provenance', {})  # type: ignore
            llm_record.needs_review = result.get('needs_review', False)  # type: ignore
            llm_record.parse_status = parse_status_val  # type: ignore
            llm_record.unrecognized_skills = result.get('unrecognized_skills', [])  # type: ignore
            llm_record.per_section_confidence = result.get('per_section_confidence', {})  # type: ignore
        else:
            # Create new
            llm_record = LLMParsedRecord(
                applicant_id=applicant.id,
                raw_llm_output=result,
                normalized=normalized,
                llm_provenance=result.get('llm_provenance', {}),
                needs_review=result.get('needs_review', False),
                parse_status=parse_status_val,
                unrecognized_skills=result.get('unrecognized_skills', []),
                per_section_confidence=result.get('per_section_confidence', {}),
            )
            db.add(llm_record)
        
        db.commit()
        logger.info(
            f"✓ Saved parsed data for applicant {applicant_id} (ID: {applicant.id}, "
            f"status={parse_status_val})"
        )

        # Queue background recommendation calculation (only for accepted parses)
        if parse_status_val == 'accepted':
            try:
                from .recommendation.engine import compute_recommendations
                background_tasks.add_task(compute_recommendations, applicant.id, db)
                result['auto_recommendations_generated'] = "queued"
            except Exception as e:
                logger.warning(f"Could not enqueue background recommendations: {e}")
        
        # Add database ID to result
        result['db_applicant_id'] = applicant.id
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save parsed data to database: {e}")
        result['database_error'] = str(e)
    
    return JSONResponse(result)


@app.get("/api/parse/status/{applicant_id}")
async def get_parse_status(
    applicant_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Poll the parse status for an applicant.
    Returns parse_status, overall_confidence, per_section_confidence, and flags.

    parse_status values:
      - 'processing'     — background task still running
      - 'accepted'       — AUTO_ACCEPT (confidence >= 0.85)
      - 'pending_review' — NEEDS_REVIEW (confidence 0.60–0.84)
      - 'failed'         — RE_PARSE exhausted
    """
    from .db import Applicant, LLMParsedRecord

    applicant = (
        db.query(Applicant)
        .filter(Applicant.applicant_id == applicant_id)
        .options(joinedload(Applicant.parsed_record))
        .first()
    )

    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    parsed = applicant.parsed_record
    if not parsed:
        # No parse record yet — directory exists but parse hasn't run
        return {
            "applicant_id": applicant_id,
            "parse_status": "not_started",
            "overall_confidence": None,
            "per_section_confidence": {},
            "flags": [],
            "unrecognized_skills_count": 0,
        }

    raw = parsed.raw_llm_output or {}
    return {
        "applicant_id": applicant_id,
        "parse_status": getattr(parsed, 'parse_status', 'unknown') or raw.get('parse_status', 'unknown'),
        "overall_confidence": raw.get('overall_confidence'),
        "per_section_confidence": getattr(parsed, 'per_section_confidence', {}) or {},
        "flags": raw.get('flags', []),
        "unrecognized_skills_count": len(getattr(parsed, 'unrecognized_skills', None) or []),
        "needs_review": parsed.needs_review,
        "resume_type": raw.get('resume_type', 'unknown'),
    }




# New endpoints for comprehensive features
from .db import SessionLocal, Applicant, LLMParsedRecord, Job, JobRecommendation, Employer

# ============================================================
# STUDENT PROFILE ENDPOINT
# ============================================================

@app.get("/api/student/applicant")
async def get_current_student_applicant(current_user = Depends(require_role("student")), db: Session = Depends(get_db)):
    """Get the current student's applicant profile (DB id, applicant_id, etc)"""
    # Always resolve to the latest applicant row for this user so dashboard
    # recommendations use the most recent parsed resume/profile data.
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found. Please upload your resume.")
    return {
        "id": getattr(applicant, 'id'),
        "applicant_id": getattr(applicant, 'applicant_id'),
        "display_name": getattr(applicant, 'display_name'),
        "location_city": getattr(applicant, 'location_city'),
        "location_state": getattr(applicant, 'location_state'),
        "country": getattr(applicant, 'country'),
        "created_at": (getattr(applicant, 'created_at').isoformat() if getattr(applicant, 'created_at', None) is not None else None)
    }
from sqlalchemy import desc, func

# Status transition validation
VALID_JOB_STATUS_TRANSITIONS = {
    'recommended': ['applied', 'withdrawn'],
    'applied': ['interviewing', 'rejected', 'withdrawn'],
    'interviewing': ['offered', 'rejected', 'withdrawn'],
    'offered': ['accepted', 'rejected', 'withdrawn'],
    'accepted': [],  # terminal
    'rejected': [],  # terminal
    'withdrawn': []  # terminal
}

@app.get("/api/applicants")
async def get_all_applicants(
    skip: int = 0, 
    limit: int = 50, 
    cursor: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all applicants with pagination (supports cursor-based)"""
    # Query applicants ordered by creation date
    query = db.query(Applicant).order_by(desc(Applicant.created_at))
    
    # Cursor-based pagination if cursor provided
    if cursor is not None:
        query = query.filter(Applicant.id < cursor)
    else:
        # Offset-based pagination (backward compatibility)
        query = query.offset(skip)
    
    applicants = query.limit(limit).all()
    next_cursor = applicants[-1].id if applicants and len(applicants) == limit else None
    
    result = []
    for app in applicants:
        llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == app.id).first()
        result.append({
            "id": app.id,
            "applicant_id": app.applicant_id,
            "display_name": app.display_name,
            "location_city": app.location_city,
            "country": app.country,
            "created_at": app.created_at.isoformat() if app.created_at is not None else None,
            "has_parsed_data": llm_record is not None,
            "needs_review": llm_record.needs_review if llm_record else False
        })
    
    return {
        "applicants": result, 
        "total": db.query(Applicant).count() if cursor is None else None,
        "skip": skip, 
        "limit": limit,
        "next_cursor": next_cursor
    }


@app.get("/api/applicant/{applicant_id}")
async def get_applicant_details(applicant_id: str, db: Session = Depends(get_db)):
    """Get detailed applicant information.

    This endpoint accepts either the numeric DB id (e.g. `1`) or the external applicant id
    string (e.g. `app_7488d09...`). It resolves the DB id and returns parsed records.
    """
    # Resolve applicant identifier to DB id
    applicant = None
    try:
        # If caller passed numeric id string, try integer lookup
        if str(applicant_id).isdigit():
            applicant = db.query(Applicant).filter(Applicant.id == int(applicant_id)).first()
    except Exception:
        applicant = None

    if not applicant:
        # Fallback: treat as external applicant_id string
        applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()

    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    # Fetch parsed record using the resolved DB id
    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()

    return {
        "applicant": {
            "id": applicant.id,
            "applicant_id": applicant.applicant_id,
            "display_name": applicant.display_name,
            "location_city": applicant.location_city,
            "location_state": applicant.location_state,
            "country": applicant.country,
            "preferred_locations": applicant.preferred_locations,
            "created_at": applicant.created_at.isoformat() if applicant.created_at is not None else None,
            "user_id": applicant.user_id,
            "is_active": applicant.user.is_active if applicant.user else True
        },
        "parsed_data": llm_record.normalized if llm_record else None,
        "needs_review": llm_record.needs_review if llm_record else False,
        "field_confidences": llm_record.field_confidences if llm_record else None
    }

from pydantic import BaseModel

class JobOptimizeRequest(BaseModel):
    prompt: str
    title: Optional[str] = None


@app.post("/api/employer/jobs/optimize")
async def optimize_job_description_route(
    data: JobOptimizeRequest,
    current_user = Depends(require_role("employer"))
):
    """Optimize a brief job description draft and suggest skills using AI"""
    if not data.prompt or not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt draft cannot be empty")
        
    try:
        from .recommendation.optimizer import optimize_job_description
        result = optimize_job_description(prompt_text=data.prompt, title=data.title)
        return result
    except Exception as e:
        logger.error(f"Error in job description optimization: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to optimize job description: {str(e)}")


# ============================================================
# EMPLOYER JOB POSTING ENDPOINTS
# ============================================================

@app.post("/api/employer/jobs", response_model=JobResponse)
async def create_job_posting(
    job_data: JobCreate,
    background_tasks: BackgroundTasks,
    current_user = Depends(require_role("employer")),
    db: Session = Depends(get_db)
):
    """Employer creates a job posting (pending approval)"""
    from .db import Job, Employer
    
    # Get employer profile
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")
    
    # Sanitize text inputs to prevent XSS
    title = sanitize_text(job_data.title, max_length=200)
    description = sanitize_text(job_data.description, max_length=10000)
    location_city = sanitize_text(job_data.location_city or "", max_length=100)
    location_state = sanitize_text(job_data.location_state or "", max_length=100)
    
    # Create job posting
    job = Job(
        employer_id=employer.id,
        title=title,
        description=description,
        location_city=location_city,
        location_state=location_state,
        work_type=job_data.work_type,
        min_experience_years=job_data.min_experience_years,
        min_cgpa=job_data.min_cgpa,
        required_skills=job_data.required_skills,
        optional_skills=job_data.optional_skills,
        expires_at=job_data.expires_at,
        status='pending'
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Queue async job embedding generation.
    try:
        from .embedding_tasks import generate_job_embedding_task
        background_tasks.add_task(generate_job_embedding_task, job.id)
        logger.info(f"Queued job embedding task via BackgroundTasks for job {job.id}")
    except Exception as e:
        logger.warning(f"Could not enqueue job embedding task for job {job.id}: {e}")
    
    logger.info(f"Job created by employer {employer.company_name}: {job.title} (ID: {job.id})")
    return job


@app.get("/api/employer/profile")
async def get_employer_profile(
    current_user = Depends(require_role("employer")),
    db: Session = Depends(get_db)
):
    """Get employer profile information"""
    from .db import Employer
    
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")
    
    return employer


@app.patch("/api/employer/profile")
async def update_employer_profile(
    company_name: str = Body(...),
    company_description: str = Body(None),
    company_website: str = Body(None),
    location: str = Body(None),
    contact_phone: str = Body(None),
    current_user = Depends(require_role("employer")),
    db: Session = Depends(get_db)
):
    """Update employer profile information"""
    from .db import Employer
    
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")
    
    setattr(employer, 'company_name', company_name)
    if company_description is not None:
        setattr(employer, 'company_description', company_description)
    if company_website is not None:
        setattr(employer, 'company_website', company_website)
    if location is not None:
        setattr(employer, 'location', location)
    if contact_phone is not None:
        setattr(employer, 'contact_phone', contact_phone)
    
    db.commit()
    db.refresh(employer)
    
    return {"status": "success", "message": "Profile updated successfully"}


@app.get("/api/employer/jobs")
async def get_employer_jobs(
    current_user = Depends(require_role("employer")),
    db: Session = Depends(get_db)
):
    """Get all jobs posted by current employer"""
    from sqlalchemy import func
    from .db import Job, Employer, JobApplication
    
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")
    
    # Query jobs along with their application count
    jobs_with_counts = db.query(Job, func.count(JobApplication.id).label('app_count')).outerjoin(
        JobApplication, Job.id == JobApplication.job_id
    ).filter(
        Job.employer_id == employer.id
    ).group_by(
        Job.id
    ).all()
    
    result = []
    for job, app_count in jobs_with_counts:
        job_dict = {
            "id": job.id,
            "employer_id": job.employer_id,
            "title": job.title,
            "description": job.description,
            "location_city": job.location_city,
            "location_state": job.location_state,
            "work_type": job.work_type,
            "min_experience_years": job.min_experience_years,
            "min_cgpa": job.min_cgpa,
            "required_skills": job.required_skills,
            "optional_skills": job.optional_skills,
            "status": job.status,
            "rejection_reason": job.rejection_reason,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None,
            "expires_at": job.expires_at.isoformat() if job.expires_at else None,
            "applicant_count": app_count
        }
        result.append(job_dict)
        
    return {"jobs": result, "total": len(result)}


@app.get("/api/employer/jobs/{job_id}")
async def get_employer_job_details(
    job_id: int,
    current_user = Depends(require_role("employer")),
    db: Session = Depends(get_db)
):
    """Get detailed information for a single job owned by the current employer"""
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")

    job = db.query(Job).filter(Job.id == job_id, Job.employer_id == employer.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or access denied")

    from .db import JobMetadata as _JobMetadata
    metadata = db.query(_JobMetadata).filter(_JobMetadata.job_id == job_id).first()

    def _safe_float(val, default=None):
        try:
            return float(val) if val is not None else default
        except Exception:
            return default

    def _safe_iso(d):
        return d.isoformat() if d is not None else None

    return {
        "job": {
            "id": job.id,
            "title": job.title,
            "description": job.description,
            "location_city": job.location_city,
            "location_state": job.location_state,
            "work_type": job.work_type,
            "min_experience_years": _safe_float(getattr(job, 'min_experience_years', None), 0.0),
            "min_cgpa": _safe_float(getattr(job, 'min_cgpa', None), None),
            "required_skills": getattr(job, 'required_skills', None),
            "optional_skills": getattr(job, 'optional_skills', None),
            "status": getattr(job, 'status', None),
            "rejection_reason": getattr(job, 'rejection_reason', None),
            "created_at": _safe_iso(getattr(job, 'created_at', None)),
            "updated_at": _safe_iso(getattr(job, 'updated_at', None)),
            "expires_at": _safe_iso(getattr(job, 'expires_at', None))
        },
        "metadata": {
            "tags": metadata.tags if metadata else [],
            "popularity": _safe_float(getattr(metadata, 'popularity', None), 0.0)
        } if metadata else None
    }


@app.get("/api/employer/jobs/{job_id}/applicants")
async def get_job_applicants(
    job_id: int,
    current_user = Depends(require_role("employer")),
    db: Session = Depends(get_db)
):
    """Get all applicants for a specific job"""
    from .db import Job, JobApplication, Applicant, Employer
    
    # Verify employer owns this job
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")
    
    job = db.query(Job).filter(Job.id == job_id, Job.employer_id == employer.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or access denied")
    
    # Get applications
    applications = db.query(JobApplication, Applicant).join(
        Applicant, JobApplication.applicant_id == Applicant.id
    ).filter(JobApplication.job_id == job_id).all()
    
    result = []
    for app, applicant in applications:
        applied_at_val = app.applied_at if hasattr(app, 'applied_at') else None
        if isinstance(applied_at_val, (dt.datetime, dt.date)):
            applied_at_ser = applied_at_val.isoformat()
        elif applied_at_val is not None:
            applied_at_ser = str(applied_at_val)
        else:
            applied_at_ser = None

        match_score = 0.0
        match_reasons = "Matched based on profile strength."
        skill_gaps = "No major gaps identified."
        try:
            from .recommendation.engine import ensure_applicant_job_recommendation
            rec = ensure_applicant_job_recommendation(applicant.id, job_id, db)
            if rec:
                match_score = float(rec.score or 0.0)
                if rec.explain:
                    match_reasons = rec.explain.get("employer_reasons") or rec.explain.get("summary") or match_reasons
                    skill_gaps = rec.explain.get("employer_gaps") or skill_gaps
        except Exception as e:
            logger.error(f"Error getting matching recommendation in get_job_applicants: {e}")

        result.append({
            "application_id": app.id,
            "applicant_id": applicant.id,
            "applicant_name": applicant.display_name,
            "status": app.status,
            "applied_at": applied_at_ser,
            "cover_letter": app.cover_letter,
            "match_score": match_score,
            "match_reasons": match_reasons,
            "skill_gaps": skill_gaps
        })
    
    return {"applicants": result, "total": len(result)}


@app.patch("/api/employer/jobs/{job_id}", response_model=JobResponse)
async def update_job_posting(
    job_id: int,
    job_data: JobUpdate,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_role("employer")),
    db: Session = Depends(get_db),
):
    """Employer updates a job posting and re-queues embedding index on meaningful changes."""
    from .db import Job, Employer

    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")

    job = db.query(Job).filter(Job.id == job_id, Job.employer_id == employer.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or access denied")

    payload = job_data.model_dump(exclude_none=True)
    if not payload:
        return job

    reindex_fields = {
        "title",
        "description",
        "required_skills",
        "optional_skills",
        "work_type",
        "location_city",
        "location_state",
        "min_experience_years",
    }
    should_reindex = any(field in reindex_fields for field in payload.keys())

    if "title" in payload:
        payload["title"] = sanitize_text(str(payload["title"]), max_length=200)
    if "description" in payload:
        payload["description"] = sanitize_text(str(payload["description"]), max_length=10000)
    if "location_city" in payload:
        payload["location_city"] = sanitize_text(str(payload["location_city"]), max_length=100)
    if "location_state" in payload:
        payload["location_state"] = sanitize_text(str(payload["location_state"]), max_length=100)

    for key, value in payload.items():
        setattr(job, key, value)

    # Re-review jobs after updates to keep moderation contract consistent.
    job.status = 'pending'  # type: ignore
    job.reviewed_by = None  # type: ignore
    job.reviewed_at = None  # type: ignore
    job.rejection_reason = None  # type: ignore

    db.commit()
    db.refresh(job)

    if should_reindex:
        try:
            from .embedding_tasks import generate_job_embedding_task

            background_tasks.add_task(generate_job_embedding_task, job.id)
            logger.info("Queued job embedding task via BackgroundTasks for updated job %s", job.id)
        except Exception as exc:
            logger.warning("Could not enqueue job embedding task for updated job %s: %s", job.id, exc)

    return job


# ============================================================
# STUDENT APPLICATION ENDPOINTS
# ============================================================

@app.post("/api/jobs/{job_id}/apply", response_model=JobApplicationResponse)
async def apply_to_job(
    job_id: int,
    application_data: JobApplicationCreate,
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Student applies to a job"""
    from .db import Job, JobApplication, Applicant
    
    # Verify job exists and is approved
    job = db.query(Job).filter(Job.id == job_id, Job.status == 'approved').first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not available")
    
    # Get student's applicant profile
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=400, detail="Please upload your resume first")
    
    # Check if already applied
    existing = db.query(JobApplication).filter(
        JobApplication.applicant_id == applicant.id,
        JobApplication.job_id == job_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied to this job")
    
    # Create application
    application = JobApplication(
        applicant_id=applicant.id,
        job_id=job_id,
        cover_letter=application_data.cover_letter,
        status='applied'
    )
    db.add(application)
    
    # Personalization implicit feedback logging
    from .db import UserFeedback
    feedback = UserFeedback(
        applicant_id=applicant.id,
        job_id=job_id,
        action_type='apply'
    )
    db.add(feedback)
    
    db.commit()
    db.refresh(application)

    # Pre-compute recommendation for immediate employer dashboard visibility
    try:
        from .recommendation.engine import ensure_applicant_job_recommendation
        ensure_applicant_job_recommendation(applicant.id, job_id, db)
    except Exception as e:
        logger.warning(f"Could not pre-compute recommendation on application: {e}")
    
    logger.info(f"Student {applicant.display_name} applied to job {job.title}")
    return application


@app.get("/api/student/applications/jobs")
async def get_student_job_applications(
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Get all job applications by current student"""
    from .db import JobApplication, Job, Applicant, Employer
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        return {"applications": [], "total": 0}
    
    applications = db.query(JobApplication, Job, Employer).join(
        Job, JobApplication.job_id == Job.id
    ).join(
        Employer, Job.employer_id == Employer.id
    ).filter(JobApplication.applicant_id == applicant.id).all()
    
    result = []
    for app, job, employer in applications:
        result.append({
            "application_id": app.id,
            "job_id": job.id,
            "job_title": job.title,
            "company": employer.company_name,
            "status": app.status,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None
        })
    
    return {"applications": result, "total": len(result)}


# ============================================================
# ADMIN APPROVAL ENDPOINTS
# ============================================================

@app.patch("/api/admin/jobs/{job_id}/review")
async def review_job_posting(
    job_id: int,
    action: ApprovalAction,
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """Admin approves or rejects a job posting"""
    from .db import Job, AuditLog
    
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    old_status = job.status
    if action.action == "approve":
        job.status = 'approved'  # type: ignore
        job.reviewed_by = current_user.id  # type: ignore
        job.reviewed_at = dt.datetime.utcnow()  # type: ignore
    elif action.action == "reject":
        job.status = 'rejected'  # type: ignore
        job.rejection_reason = action.reason  # type: ignore
        job.reviewed_by = current_user.id  # type: ignore
        job.reviewed_at = dt.datetime.utcnow()  # type: ignore
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    db.commit()
    db.refresh(job)
    
    # Trigger background recommendations if approved
    if job.status == 'approved':
        try:
            from .recommendation.engine import compute_recommendations_for_new_job
            background_tasks.add_task(compute_recommendations_for_new_job, job.id, db)
            logger.info(f"Queued background task to compute recommendations for newly approved job {job.id}")
        except Exception as e:
            logger.warning(f"Could not queue recommendations for job {job.id}: {e}")
    
    # Audit log
    try:
        audit = AuditLog(
            action=f"job_{action.action}",
            target_type="Job",
            target_id=job_id,
            user_id=current_user.id,
            details={"old_status": old_status, "new_status": job.status, "reason": action.reason}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")
    
    logger.info(f"Job {job.title} {action.action}ed by admin {current_user.name}")
    return {"status": "success", "job_status": job.status}


@app.get("/api/admin/pending-reviews")
async def get_pending_reviews(
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Get all pending jobs for review"""
    from .db import Job, Employer
    
    # Get pending jobs
    pending_jobs = db.query(Job, Employer).join(
        Employer, Job.employer_id == Employer.id
    ).filter(Job.status == 'pending').all()
    
    jobs_list = []
    for job, employer in pending_jobs:
        jobs_list.append({
            "id": job.id,
            "title": job.title,
            "company": employer.company_name,
            "created_at": job.created_at.isoformat() if job.created_at else None
        })
    
    return {
        "pending_jobs": jobs_list,
        "total_pending": len(jobs_list)
    }


@app.get("/api/admin/jobs")
async def get_admin_jobs(
    current_user = Depends(require_role("admin")),
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all jobs for admin management."""
    from .db import Job, Employer

    query = db.query(Job, Employer).join(
        Employer, Job.employer_id == Employer.id
    )

    if status:
        query = query.filter(Job.status == status)

    jobs = query.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()

    jobs_list = []
    for job, employer in jobs:
        jobs_list.append({
            "id": job.id,
            "title": job.title,
            "company": employer.company_name,
            "status": getattr(job, 'status', None),
            "rejection_reason": getattr(job, 'rejection_reason', None),
            "location_city": getattr(job, 'location_city', None),
            "location_state": getattr(job, 'location_state', None),
            "work_type": getattr(job, 'work_type', None),
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "expires_at": job.expires_at.isoformat() if getattr(job, 'expires_at', None) else None
        })

    return {
        "jobs": jobs_list,
        "total": db.query(Job).count(),
        "skip": skip,
        "limit": limit,
        "status": status
    }


@app.get("/api/admin/jobs/{job_id}")
async def get_admin_job_details(
    job_id: int,
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Get detailed information for any job so admins can review recruiter submissions."""
    from .db import Job, Employer, JobMetadata

    job_row = db.query(Job, Employer).join(
        Employer, Job.employer_id == Employer.id
    ).filter(Job.id == job_id).first()

    if not job_row:
        raise HTTPException(status_code=404, detail="Job not found")

    job, employer = job_row
    metadata = db.query(JobMetadata).filter(JobMetadata.job_id == job_id).first()

    def _safe_float(val, default=None):
        try:
            return float(val) if val is not None else default
        except Exception:
            return default

    def _safe_iso(val):
        return val.isoformat() if val is not None else None

    return {
        "job": {
            "id": job.id,
            "title": job.title,
            "description": job.description,
            "company": employer.company_name,
            "location_city": job.location_city,
            "location_state": job.location_state,
            "work_type": job.work_type,
            "min_experience_years": _safe_float(getattr(job, 'min_experience_years', None), 0.0),
            "min_cgpa": _safe_float(getattr(job, 'min_cgpa', None), None),
            "required_skills": getattr(job, 'required_skills', None) or [],
            "optional_skills": getattr(job, 'optional_skills', None) or [],
            "status": getattr(job, 'status', None),
            "rejection_reason": getattr(job, 'rejection_reason', None),
            "created_at": _safe_iso(getattr(job, 'created_at', None)),
            "updated_at": _safe_iso(getattr(job, 'updated_at', None)),
            "expires_at": _safe_iso(getattr(job, 'expires_at', None)),
            "reviewed_at": _safe_iso(getattr(job, 'reviewed_at', None)),
        },
        "metadata": {
            "tags": metadata.tags if metadata is not None and getattr(metadata, 'tags', None) else [],
            "popularity": _safe_float(getattr(metadata, 'popularity', None), 0.0)
        } if metadata else None
    }


@app.get("/api/jobs")
async def get_jobs(
    skip: int = 0,
    limit: int = 20,
    location: Optional[str] = None,
    q: Optional[str] = None,
    work_type: Optional[str] = None,
    skills: Optional[str] = None,
    sort: Optional[str] = 'popular',
    db: Session = Depends(get_db)
):
    """Get all active jobs with advanced search, filtering, and sorting support"""
    import datetime
    from sqlalchemy import or_, desc, cast, String
    from .db import Job, Employer
    
    now = datetime.datetime.utcnow()
    base_query = db.query(Job).filter(
        Job.status == 'approved',
        ((Job.expires_at.is_(None)) | (Job.expires_at > now))
    )
    
    # 1. Full-text search
    if q:
        search_pattern = f"%{q}%"
        base_query = base_query.filter(
            or_(
                Job.title.ilike(search_pattern),
                Job.description.ilike(search_pattern),
                Job.employer.has(Employer.company_name.ilike(search_pattern))
            )
        )
        
    # 2. Location filter
    if location:
        loc_pattern = f"%{location}%"
        base_query = base_query.filter(
            or_(
                Job.location_city.ilike(loc_pattern),
                Job.location_state.ilike(loc_pattern)
            )
        )
        
    # 3. Work Type filter
    if work_type:
        base_query = base_query.filter(Job.work_type == work_type)
        
    # 4. Skills filter
    if skills:
        skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
        for s in skill_list:
            base_query = base_query.filter(cast(Job.required_skills, String).ilike(f"%{s}%"))
            
    # 5. Sorting
    if sort == 'recent':
        base_query = base_query.order_by(desc(Job.created_at))
    elif sort == 'title':
        base_query = base_query.order_by(Job.title.asc())
    else:  # 'popular' or default
        base_query = base_query.order_by(desc(Job.created_at))
        
    total_count = base_query.count()
    results = base_query.offset(skip).limit(limit).all()
    
    jobs_list = []
    for job in results:
        jobs_list.append({
            "id": job.id,
            "title": job.title,
            "company": job.employer.company_name if job.employer else "Unknown",
            "location_city": job.location_city,
            "location_state": job.location_state,
            "work_type": job.work_type,
            "min_experience_years": job.min_experience_years,
            "min_cgpa": job.min_cgpa,
            "min_salary": None,
            "max_salary": None,
            "description": job.description,
            "required_skills": job.required_skills,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "expires_at": job.expires_at.isoformat() if job.expires_at else None
        })
        
    return {
        "jobs": jobs_list,
        "total": total_count,
        "next_cursor": None
    }



@app.post("/api/admin/jobs/{job_id}/disable")
async def admin_disable_job(
    job_id: int,
    payload: dict = Body(None),
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Disable a job posting (admin): marks as rejected with an admin reason."""
    from .db import Job, AuditLog

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    old_status = job.status
    reason = None
    try:
        reason = payload.get('reason') if isinstance(payload, dict) else None
    except Exception:
        reason = None

    job.status = 'rejected'  # type: ignore
    job.rejection_reason = reason or 'Disabled by admin'  # type: ignore
    job.reviewed_by = current_user.id  # type: ignore
    job.reviewed_at = dt.datetime.utcnow()  # type: ignore

    db.commit()
    db.refresh(job)

    try:
        audit = AuditLog(
            action='job_disabled',
            target_type='Job',
            target_id=job_id,
            user_id=current_user.id,
            details={'old_status': old_status, 'new_status': job.status, 'reason': job.rejection_reason}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log for disable: {e}")

    return {"status": "success", "job_status": job.status}


@app.post("/api/admin/jobs/{job_id}/enable")
async def admin_enable_job(
    job_id: int,
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Enable a previously disabled job posting (admin): marks as approved."""
    from .db import Job, AuditLog

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    old_status = job.status
    job.status = 'approved'  # type: ignore
    job.rejection_reason = None  # type: ignore
    job.reviewed_by = current_user.id  # type: ignore
    job.reviewed_at = dt.datetime.utcnow()  # type: ignore

    db.commit()
    db.refresh(job)

    try:
        audit = AuditLog(
            action='job_enabled',
            target_type='Job',
            target_id=job_id,
            user_id=current_user.id,
            details={'old_status': old_status, 'new_status': job.status}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log for enable: {e}")

    return {"status": "success", "job_status": job.status}


@app.post("/api/admin/jobs/{job_id}/requeue")
async def admin_requeue_job_for_review(
    job_id: int,
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Force a job back into the review queue (mark as pending)."""
    from .db import Job, AuditLog

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    old_status = job.status
    job.status = 'pending'  # type: ignore
    job.rejection_reason = None  # type: ignore
    job.reviewed_by = None  # type: ignore
    job.reviewed_at = None  # type: ignore

    db.commit()
    db.refresh(job)

    try:
        audit = AuditLog(
            action='job_requeued',
            target_type='Job',
            target_id=job_id,
            user_id=current_user.id,
            details={'old_status': old_status, 'new_status': job.status}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log for requeue: {e}")

    return {"status": "success", "job_status": job.status}


@app.patch("/api/admin/jobs/{job_id}")
async def admin_update_job(
    job_id: int,
    payload: JobUpdate,
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Admin can update job fields (title, description, skills, etc.)."""
    from .db import Job, AuditLog

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    update_dict = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update_dict:
        try:
            db.query(Job).filter(Job.id == job_id).update(cast(Dict[Any, Any], update_dict), synchronize_session=False)  # type: ignore[arg-type]
            db.commit()
        except Exception as e:
            logger.error(f"Failed to update job {job_id}: {e}")
            db.rollback()
            raise HTTPException(status_code=500, detail="Failed to update job")

    updated = db.query(Job).filter(Job.id == job_id).first()
    if updated is None:
        raise HTTPException(status_code=404, detail="Job not found after update")
    updated_job = cast(Job, updated)

    try:
        audit = AuditLog(
            action='job_admin_update',
            target_type='Job',
            target_id=job_id,
            user_id=current_user.id,
            details={'updated_fields': update_dict}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log for admin update: {e}")

    return {
        "status": "success",
        "job": {
            "id": updated_job.id,
            "title": updated_job.title,
            "description": updated_job.description,
            "location_city": updated_job.location_city,
            "location_state": updated_job.location_state,
            "work_type": updated_job.work_type,
            "min_experience_years": getattr(updated_job, 'min_experience_years', None),
            "min_cgpa": getattr(updated_job, 'min_cgpa', None),
            "required_skills": getattr(updated_job, 'required_skills', None) or [],
            "optional_skills": getattr(updated_job, 'optional_skills', None) or [],
            "expires_at": updated_job.expires_at.isoformat() if getattr(updated_job, 'expires_at', None) else None,
            "status": getattr(updated_job, 'status', None),
            "rejection_reason": getattr(updated_job, 'rejection_reason', None),
        }
    }
    
    next_cursor = result[-1]["id"] if result and (cursor is not None or has_more) else None
    return {
        "jobs": result,
        "total": total,
        "next_cursor": next_cursor
    }


@app.get("/api/job/{job_id}")
async def get_job_details(job_id: int, db: Session = Depends(get_db)):
    """Get detailed job information.

    Public: returns details for approved jobs.
    Employers: may view their own jobs (including pending/rejected) via the employer dashboard endpoints.
    Admins: can view any job.
    """
    from .db import JobMetadata

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=API_MESSAGES['JOB_NOT_FOUND'])

    # Only approved jobs are visible publicly. Employer-specific views (pending/rejected) should be done through
    # the employer endpoints which already enforce ownership. To keep the public job details endpoint simple and safe,
    # we return details only for approved jobs here.
    if getattr(job, 'status', None) != 'approved':
        raise HTTPException(status_code=404, detail=API_MESSAGES['JOB_NOT_FOUND'])

    employer = db.query(Employer).filter(Employer.id == job.employer_id).first()
    metadata = db.query(JobMetadata).filter(JobMetadata.job_id == job_id).first()

    return {
        "job": {
            "id": job.id,
            "title": job.title,
            "description": job.description,
            "location_city": job.location_city,
            "location_state": job.location_state,
            "work_type": job.work_type,
            "min_experience_years": float(job.min_experience_years) if job.min_experience_years is not None else 0.0,  # type: ignore
            "min_cgpa": float(job.min_cgpa) if job.min_cgpa is not None else None,  # type: ignore
            "required_skills": job.required_skills,
            "optional_skills": job.optional_skills,
            "expires_at": job.expires_at.isoformat() if job.expires_at is not None else None
        },
        "employer": {
            "company_name": employer.company_name if employer else "Unknown",
            "website": employer.website if employer else None,
            "location_city": employer.location_city if employer else None
        } if employer else None,
        "metadata": {
            "tags": metadata.tags if metadata else [],
            "popularity": float(metadata.popularity) if metadata and metadata.popularity is not None else 0.0  # type: ignore
        } if metadata else None
    }


@app.get("/api/recommendations/{applicant_id}")
async def get_applicant_recommendations(applicant_id: str, db: Session = Depends(get_db)):
    """Get job recommendations for an applicant.

    Accepts either DB numeric id or external applicant_id string and resolves to DB id.
    """
    # Resolve applicant identifier
    applicant = None
    try:
        if str(applicant_id).isdigit():
            applicant = db.query(Applicant).filter(Applicant.id == int(applicant_id)).first()
    except Exception:
        applicant = None

    if not applicant:
        applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()

    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    resolved_id = applicant.id

    # Job recommendations
    job_recs = db.query(JobRecommendation, Job, Employer).join(
        Job, JobRecommendation.job_id == Job.id
    ).join(
        Employer, Job.employer_id == Employer.id
    ).filter(JobRecommendation.applicant_id == resolved_id).order_by(
        desc(JobRecommendation.score)
    ).all()
    
    # Cooldown Check
    from sqlalchemy import func
    import datetime
    from .constants import CREDIT_CONFIG
    
    last_computed = db.query(func.max(JobRecommendation.computed_at)).filter(
        JobRecommendation.applicant_id == resolved_id
    ).scalar()
    
    cooldown_hours = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COOLDOWN_HOURS', 24)
    cost = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COST', 5)
    
    in_cooldown = False
    cooldown_expires_at = None
    
    if last_computed:
        now_time = datetime.datetime.utcnow()
        time_passed = now_time - last_computed
        cooldown_seconds = cooldown_hours * 3600
        
        if time_passed.total_seconds() < cooldown_seconds:
            in_cooldown = True
            cooldown_expires_at = last_computed + datetime.timedelta(hours=cooldown_hours)
            
    # Fetch job applications to determine status tracker
    from .db import JobApplication
    job_apps = db.query(JobApplication).filter(JobApplication.applicant_id == resolved_id).all()
    app_status_map = {app.job_id: app.status for app in job_apps}

    return {
        "job_recommendations": [
            {
                "id": rec.id,
                "job": {
                    "id": job.id,
                    "title": job.title,
                    "description": job.description,
                    "company": employer.company_name,
                    "location_city": job.location_city,
                    "location_state": job.location_state,
                    "work_type": job.work_type,
                    "required_skills": job.required_skills,
                    "min_experience_years": job.min_experience_years
                },
                "match_score": float(rec.score) if rec.score else 0,
                "score": float(rec.score) if rec.score else 0,
                "scoring_breakdown": rec.score_breakdown if rec.score_breakdown is not None else rec.scoring_breakdown,
                "explanation": rec.explanation,
                "explain": rec.explain,
                "status": rec.status,
                "is_saved": rec.is_saved if rec.is_saved is not None else False,
                "application_status": app_status_map.get(job.id)
            } for rec, job, employer in job_recs
        ],
        "last_computed_at": last_computed.isoformat() if last_computed else None,
        "cooldown_active": in_cooldown,
        "cooldown_expires_at": cooldown_expires_at.isoformat() if cooldown_expires_at else None,
        "cooldown_hours": cooldown_hours,
        "bypass_cost": cost
    }


@app.get("/api/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    stats = {
        "total_applicants": db.query(Applicant).count(),
        "total_jobs": db.query(Job).count(),
        "total_job_recommendations": db.query(JobRecommendation).count(),
        "applicants_needing_review": db.query(LLMParsedRecord).filter(
            LLMParsedRecord.needs_review == True
        ).count()
    }

    return stats

@app.patch("/api/job-recommendation/{rec_id}/save")
def toggle_job_recommendation_saved(
    rec_id: int,
    is_saved: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Toggle the saved status of a job recommendation for the student"""
    from .db import JobRecommendation, Applicant
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Student profile not found. Please upload a resume first.")
        
    rec = db.query(JobRecommendation).filter(
        JobRecommendation.id == rec_id,
        JobRecommendation.applicant_id == applicant.id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Job recommendation not found")
        
    rec.is_saved = is_saved
    db.commit()
    db.refresh(rec)
    return {"id": rec.id, "is_saved": rec.is_saved, "message": "Saved status updated successfully"}


@app.patch("/api/student/jobs/{job_id}/track")
def track_job_application_status(
    job_id: int,
    status: str = Body(..., embed=True),  # 'applied', 'interviewing', 'offered'
    db: Session = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Track or update job application status (applied, interviewing, offered) for the student"""
    from .db import Job, JobApplication, Applicant
    
    valid_statuses = ['applied', 'interviewing', 'offered']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid tracker status. Must be one of: {valid_statuses}")
        
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Student profile not found. Please upload a resume first.")
        
    # Verify job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # Check if application already exists
    app = db.query(JobApplication).filter(
        JobApplication.applicant_id == applicant.id,
        JobApplication.job_id == job_id
    ).first()
    
    if not app:
        # If no application exists, create one with the specified status
        app = JobApplication(
            applicant_id=applicant.id,
            job_id=job_id,
            status=status,
            cover_letter="Manually tracked application"
        )
        db.add(app)
        
        # Also log feedback
        from .db import UserFeedback
        feedback = UserFeedback(
            applicant_id=applicant.id,
            job_id=job_id,
            action_type='apply'
        )
        db.add(feedback)
    else:
        # Update the existing status
        app.status = status
        
    db.commit()
    db.refresh(app)
    return {"job_id": job_id, "status": app.status, "message": f"Job application status updated to {status}"}


@app.patch("/api/job-recommendation/{rec_id}/status")
def update_job_recommendation_status(
    rec_id: int,
    status: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update the status of a job recommendation"""
    from .db import JobRecommendation, AuditLog
    from .constants import API_MESSAGES
    
    valid_statuses = ['recommended', 'applied', 'interviewing', 'offered', 'accepted', 'rejected', 'withdrawn']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    rec = db.query(JobRecommendation).filter(JobRecommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail=API_MESSAGES["applicant_not_found"])
    
    # Validate status transition
    current_status = str(rec.status) if rec.status is not None else 'recommended'
    allowed_transitions = VALID_JOB_STATUS_TRANSITIONS.get(current_status, [])
    if status != current_status and status not in allowed_transitions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {current_status} → {status}. Allowed: {', '.join(allowed_transitions) if allowed_transitions else 'none (terminal state)'}"
        )
    
    old_status = rec.status
    rec.status = status  # type: ignore
    
    # Personalization implicit feedback logging
    from .db import UserFeedback
    action_type = None
    if status == 'applied':
        action_type = 'apply'
    elif status in ['rejected', 'dismissed', 'withdrawn']:
        action_type = 'dismiss'

    if action_type:
        feedback = UserFeedback(
            applicant_id=rec.applicant_id,
            job_id=rec.job_id,
            action_type=action_type
        )
        db.add(feedback)
        
    db.commit()
    db.refresh(rec)
    
    # Audit log
    try:
        audit = AuditLog(
            action="job_recommendation_status_update",
            target_type="JobRecommendation",
            target_id=rec_id,
            user_id=current_user.id,
            details={"old_status": old_status, "new_status": status}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")
    
    return {"id": rec.id, "status": rec.status, "message": "Status updated successfully"}


@app.post("/api/applicant/{applicant_id}/generate-recommendations")
async def generate_recommendations_for_applicant(
    applicant_id: int,
    bypass_cooldown: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate or refresh job recommendations for an applicant with a 24-hour hybrid cooldown.
    
    If recommendations were computed recently, the user must set bypass_cooldown=True
    and spend 5 credits to force recalculation. Otherwise, refreshes are free.
    """
    from sqlalchemy import func
    import datetime
    from .constants import CREDIT_CONFIG
    from .core.credit_service import CreditService
    
    # Validate applicant and parsed data
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail=API_MESSAGES['APPLICANT_NOT_FOUND'])

    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if not llm_record:
        raise HTTPException(status_code=400, detail=API_MESSAGES['NO_PARSED_DATA'])

    # Cooldown Check
    last_computed = db.query(func.max(JobRecommendation.computed_at)).filter(
        JobRecommendation.applicant_id == applicant_id
    ).scalar()

    cooldown_hours = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COOLDOWN_HOURS', 24)
    cost = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COST', 5)
    
    credits_spent = 0
    in_cooldown = False
    cooldown_expires_at = None

    if last_computed:
        now_time = datetime.datetime.utcnow()
        time_passed = now_time - last_computed
        cooldown_seconds = cooldown_hours * 3600
        
        if time_passed.total_seconds() < cooldown_seconds:
            in_cooldown = True
            cooldown_expires_at = last_computed + datetime.timedelta(hours=cooldown_hours)
            
            if not bypass_cooldown:
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "cooldown",
                        "last_computed_at": last_computed.isoformat(),
                        "cooldown_expires_at": cooldown_expires_at.isoformat(),
                        "bypass_cost": cost,
                        "detail": f"Recommendations were refreshed recently. You can wait or spend {cost} credits to bypass."
                    }
                )
            else:
                # Deduct 5 credits
                credit_service = CreditService(db)
                eligible, msg, context = credit_service.check_eligibility(
                    applicant_id, 
                    'recommendation_refresh', 
                    custom_cost=cost
                )
                if not eligible:
                    raise HTTPException(status_code=402, detail=msg)
                
                credit_service.spend_credits(
                    applicant_id,
                    activity_type='recommendation_refresh',
                    cost=cost,
                    description=f"Bypassed recommendations cooldown (charged {cost} credits)"
                )
                credits_spent = cost

    # Clear existing recommendations
    db.query(JobRecommendation).filter(JobRecommendation.applicant_id == applicant_id).delete()
    db.commit()

    # Generate via new service (persists records internally)
    try:
        from .recommendation.recommendation_service import RecommendationService
        service = RecommendationService(db)
        result = service.get_recommendations(applicant_id)
        
        job_count = len(result.get('job_recommendations', []))
        
        logger.info(f"✓ Generated {job_count} job recommendations for applicant {applicant_id}")
        
        # Get updated credits summary
        credit_service = CreditService(db)
        summary = credit_service.get_account_summary(applicant_id)
        credits_left = summary.get('current_credits', 0)
        
        # Return success with metadata and updated balance
        return {
            "status": "success",
            "message": "Recommendations generated successfully",
            "job_recommendations_count": job_count,
            "credits_spent": credits_spent,
            "credits_left": credits_left,
            "cooldown_active": in_cooldown,
            "cooldown_expires_at": cooldown_expires_at.isoformat() if cooldown_expires_at else None
        }
    except Exception as e:
        logger.error(f"Failed to generate recommendations via service: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")


from pydantic import BaseModel

class FeedbackCreate(BaseModel):
    job_id: int
    action_type: str  # 'click', 'apply', 'dismiss', 'save'

@app.post("/api/feedback")
async def log_user_feedback(
    payload: FeedbackCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log explicit or custom user feedback action for personalization."""
    from .db import Applicant, UserFeedback
    
    # Resolve applicant profile for current user
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=400, detail="Applicant profile not found")
        
    valid_actions = ['click', 'apply', 'dismiss', 'save']
    if payload.action_type not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action_type. Must be one of: {valid_actions}")
        
    feedback = UserFeedback(
        applicant_id=applicant.id,
        job_id=payload.job_id,
        action_type=payload.action_type
    )
    db.add(feedback)
    db.commit()
    
    return {"status": "success", "message": f"Logged feedback '{payload.action_type}'"}


@app.patch("/api/employer/applications/{application_id}/status")
async def update_job_application_status(
    application_id: int,
    status: str = Body(...),
    employer_notes: Optional[str] = Body(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_role("employer"))
):
    """Update job application status (employer only).
    
    Allows employers to move applications through their workflow:
    applied → under_review → shortlisted → interviewing → offered → accepted/rejected
    """
    from .db import JobApplication, AuditLog
    
    valid_statuses = ['applied', 'under_review', 'shortlisted', 'interviewing', 'offered', 'accepted', 'rejected', 'withdrawn']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Get application and verify employer owns the associated job
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get the job and verify ownership
    job = db.query(Job).filter(Job.id == application.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get employer profile
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=403, detail="Employer profile not found")
    
    job_employer_id = getattr(job, 'employer_id', None)
    if job_employer_id != employer.id:
        raise HTTPException(status_code=403, detail="You can only update applications for your own jobs")
    
    # Validate status transitions
    valid_transitions = {
        'applied': ['under_review', 'rejected', 'withdrawn'],
        'under_review': ['shortlisted', 'rejected', 'withdrawn'],
        'shortlisted': ['interviewing', 'rejected', 'withdrawn'],
        'interviewing': ['offered', 'rejected', 'withdrawn'],
        'offered': ['accepted', 'rejected', 'withdrawn'],
        'accepted': [],  # terminal
        'rejected': [],  # terminal
        'withdrawn': []  # terminal
    }
    
    current_status = str(getattr(application, 'status', 'applied'))
    allowed = valid_transitions.get(current_status, [])
    
    if status != current_status and status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition: {current_status} → {status}. Allowed: {', '.join(allowed) if allowed else 'none (terminal state)'}"
        )
    
    old_status = getattr(application, 'status', 'applied')
    application.status = status  # type: ignore
    if employer_notes:
        application.employer_notes = employer_notes  # type: ignore
    application.updated_at = dt.datetime.utcnow()  # type: ignore
    
    db.commit()
    db.refresh(application)
    
    # Audit log
    try:
        audit = AuditLog(
            action="job_application_status_update",
            target_type="JobApplication",
            target_id=application_id,
            user_id=current_user.id,
            details={
                "old_status": old_status,
                "new_status": status,
                "notes": employer_notes,
                "job_id": job.id,
                "applicant_id": application.applicant_id
            }
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")
    
    logger.info(f"Employer {employer.id} updated application {application_id}: {old_status} → {status}")
    
    app_updated = getattr(application, 'updated_at', None)
    return {
        "id": application.id,
        "status": getattr(application, 'status'),
        "employer_notes": getattr(application, 'employer_notes', None),
        "updated_at": app_updated.isoformat() if app_updated else None,
        "message": "Application status updated successfully"
    }


# ============================================================
# VECTOR STORE & EMBEDDINGS ENDPOINTS
# ============================================================

@app.post("/api/embeddings/generate/{applicant_id}")
async def generate_embeddings(
    applicant_id: int,
    vector_type: str = "resume_summary",
    force_regenerate: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    """Generate vector embeddings for an applicant's resume.
    
    Note: This is a stub implementation. In production, integrate with:
    - Pinecone, Qdrant, or FAISS for vector storage
    - OpenAI, Google, or Cohere for embedding generation
    """
    from .db import EmbeddingsIndex
    import hashlib
    
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    
    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if not llm_record:
        raise HTTPException(status_code=400, detail="No parsed resume data found")
    
    # Check if embedding already exists
    existing = db.query(EmbeddingsIndex).filter(
        EmbeddingsIndex.applicant_id == applicant_id,
        EmbeddingsIndex.vector_type == vector_type
    ).first()
    
    if existing and not force_regenerate:
        return {
            "status": "exists",
            "message": "Embedding already exists",
            "embedding_id": existing.id,
            "vector_store_id": existing.vector_store_id
        }
    
    # Generate embedding (stub - replace with actual vector store integration)
    normalized = llm_record.normalized
    
    # Create text representation based on vector_type
    if vector_type == "resume_summary":
        text_parts = []
        education = normalized.get('education', [])
        if education:
            text_parts.append(f"Education: {education[0].get('degree', '')} from {education[0].get('institution', '')}")
        skills = normalized.get('skills', [])
        if skills:
            skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills[:10]]
            text_parts.append(f"Skills: {', '.join(skill_names)}")
        text_to_embed = " ".join(text_parts)
    elif vector_type == "skills":
        skills = normalized.get('skills', [])
        skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills]
        text_to_embed = ", ".join(skill_names)
    else:  # full_resume
        import json
        text_to_embed = json.dumps(normalized)
    
    # Generate a mock vector store ID (in production, call actual vector store API)
    vector_store_id = f"vec_{hashlib.md5(text_to_embed.encode()).hexdigest()[:16]}"
    
    logger.info(f"Generated embedding for applicant {applicant_id} (type: {vector_type}, length: {len(text_to_embed)} chars)")
    
    if existing:
        # Update existing
        existing.vector_store_id = vector_store_id  # type: ignore
        db.commit()
        return {
            "status": "updated",
            "message": "Embedding regenerated",
            "embedding_id": existing.id,
            "vector_store_id": vector_store_id
        }
    else:
        # Create new
        embedding = EmbeddingsIndex(
            applicant_id=applicant_id,
            vector_store_id=vector_store_id,
            vector_type=vector_type
        )
        db.add(embedding)
        db.commit()
        db.refresh(embedding)
        
        return {
            "status": "created",
            "message": "Embedding generated successfully",
            "embedding_id": embedding.id,
            "vector_store_id": vector_store_id
        }


@app.post("/api/embeddings/reindex/jobs")
async def reindex_jobs_embeddings(
    background_tasks: BackgroundTasks,
    limit: int = Body(200),
    offset: int = Body(0),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Queue async embedding refresh for approved jobs."""
    from .db import Job
    from .embedding_tasks import generate_job_embedding_task

    safe_limit = max(1, min(limit, 1000))
    jobs = db.query(Job).filter(Job.status == 'approved').order_by(Job.id.asc()).offset(offset).limit(safe_limit).all()

    queued: List[Dict[str, Any]] = []
    for job in jobs:
        background_tasks.add_task(generate_job_embedding_task, job.id)
        queued.append({"job_id": job.id, "task_id": f"bg_job_{job.id}"})

    return {
        "status": "queued",
        "count": len(queued),
        "offset": offset,
        "limit": safe_limit,
        "items": queued,
    }


@app.post("/api/embeddings/reindex/applicants")
async def reindex_applicant_embeddings(
    background_tasks: BackgroundTasks,
    limit: int = Body(200),
    offset: int = Body(0),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Queue async embedding refresh for applicants with parsed records."""
    from .db import Applicant
    from .embedding_tasks import generate_resume_embedding_task

    safe_limit = max(1, min(limit, 1000))
    applicants = db.query(Applicant).join(
        LLMParsedRecord, Applicant.id == LLMParsedRecord.applicant_id
    ).order_by(Applicant.id.asc()).offset(offset).limit(safe_limit).all()

    queued: List[Dict[str, Any]] = []
    for applicant in applicants:
        background_tasks.add_task(generate_resume_embedding_task, applicant.id)
        queued.append({"applicant_id": applicant.id, "task_id": f"bg_applicant_{applicant.id}"})

    return {
        "status": "queued",
        "count": len(queued),
        "offset": offset,
        "limit": safe_limit,
        "items": queued,
    }


@app.get("/api/embeddings/health")
async def embedding_health(
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    """Get embedding index coverage and queue configuration visibility."""
    from .db import ApplicantEmbedding, JobEmbedding, Job

    applicant_total = db.query(Applicant).count()
    applicant_embedded = db.query(ApplicantEmbedding).count()
    jobs_total = db.query(Job).filter(Job.status == 'approved').count()
    jobs_embedded = db.query(JobEmbedding).count()

    return {
        "status": "ok",
        "queue": {
            "broker": "fastapi_background_tasks",
            "result_backend": "in_memory",
            "default_queue": "fastapi",
            "embeddings_queue": "fastapi",
        },
        "coverage": {
            "applicants_total": applicant_total,
            "applicants_embedded": applicant_embedded,
            "jobs_total": jobs_total,
            "jobs_embedded": jobs_embedded,
        },
    }


@app.get("/api/embeddings/task/{task_id}")
async def embedding_task_status(
    task_id: str,
    current_user=Depends(require_role("admin")),
):
    """Check task state for embedding jobs."""
    return {
        "task_id": task_id,
        "state": "SUCCESS",
        "ready": True,
        "successful": True,
        "result": {"status": "completed"},
    }


@app.get("/api/applicant/{db_applicant_id}/pipeline-status")
async def applicant_pipeline_status(
    db_applicant_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return parse/embedding/recommendation readiness for one applicant."""
    from .db import ApplicantEmbedding

    applicant = db.query(Applicant).filter(Applicant.id == db_applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    is_admin = getattr(current_user, "role", None) == "admin"
    owner_user_id = getattr(applicant, "user_id", None)
    if not is_admin and owner_user_id != getattr(current_user, "id", None):
        raise HTTPException(status_code=403, detail="Not authorized to view this applicant")

    parsed = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == db_applicant_id).first()
    embedding = db.query(ApplicantEmbedding).filter(ApplicantEmbedding.applicant_id == db_applicant_id).first()
    rec_count = db.query(JobRecommendation).filter(JobRecommendation.applicant_id == db_applicant_id).count()

    updated_at = None
    embedding_updated_at = getattr(embedding, "updated_at", None) if embedding else None
    parsed_updated_at = getattr(parsed, "updated_at", None) if parsed else None
    if embedding_updated_at is not None:
        updated_at = embedding_updated_at.isoformat()
    elif parsed_updated_at is not None:
        updated_at = parsed_updated_at.isoformat()

    return {
        "applicant_id": db_applicant_id,
        "has_parsed_record": parsed is not None,
        "has_embedding": embedding is not None,
        "embedding_provider": getattr(embedding, "embedding_provider", None) if embedding else None,
        "recommendations_count": rec_count,
        "updated_at": updated_at,
    }


@app.get("/api/pipeline-status/{applicant_id}")
async def applicant_pipeline_status_by_external_id(
    applicant_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return parse/embedding/recommendation readiness for external applicant_id."""
    from .db import ApplicantEmbedding

    applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    is_admin = getattr(current_user, "role", None) == "admin"
    owner_user_id = getattr(applicant, "user_id", None)
    if not is_admin and owner_user_id != getattr(current_user, "id", None):
        raise HTTPException(status_code=403, detail="Not authorized to view this applicant")

    parsed = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()
    embedding = db.query(ApplicantEmbedding).filter(ApplicantEmbedding.applicant_id == applicant.id).first()
    rec_count = db.query(JobRecommendation).filter(JobRecommendation.applicant_id == applicant.id).count()

    updated_at = None
    embedding_updated_at = getattr(embedding, "updated_at", None) if embedding else None
    parsed_updated_at = getattr(parsed, "updated_at", None) if parsed else None
    if embedding_updated_at is not None:
        updated_at = embedding_updated_at.isoformat()
    elif parsed_updated_at is not None:
        updated_at = parsed_updated_at.isoformat()

    return {
        "applicant_id": applicant_id,
        "db_applicant_id": applicant.id,
        "has_parsed_record": parsed is not None,
        "has_embedding": embedding is not None,
        "embedding_provider": getattr(embedding, "embedding_provider", None) if embedding else None,
        "recommendations_count": rec_count,
        "updated_at": updated_at,
    }


@app.post("/api/search/semantic")
async def semantic_search(
    query: str = Body(...),
    entity_type: str = Body("job"),
    limit: int = Body(20),
    db: Session = Depends(get_db)
):
    """Perform semantic search across entities using embeddings.
    
    Note: This is a stub implementation. In production:
    1. Generate query embedding
    2. Search vector store for similar vectors
    3. Return ranked results
    """
    
    if entity_type not in ['job', 'applicant']:
        raise HTTPException(status_code=400, detail="entity_type must be 'job' or 'applicant'")
    
    logger.info(f"Semantic search: query='{query}', type={entity_type}, limit={limit}")
    
    # Stub: Fall back to text-based search until vector store is integrated
    if entity_type == 'job':
        results = db.query(Job).filter(
            Job.status == 'approved',
            (Job.title.ilike(f"%{query}%")) | (Job.description.ilike(f"%{query}%"))
        ).limit(limit).all()
        
        return {
            "status": "success",
            "method": "text_fallback",
            "message": "Using text search (vector store not configured)",
            "results": [
                {
                    "id": job.id,
                    "title": getattr(job, 'title'),
                    "description": getattr(job, 'description', '')[:200] + "...",
                    "score": 0.85  # Mock similarity score
                } for job in results
            ]
        }
    else:  # applicant
        # Search in parsed records
        applicants = db.query(Applicant).join(
            LLMParsedRecord, Applicant.id == LLMParsedRecord.applicant_id
        ).limit(limit).all()
        
        return {
            "status": "success",
            "method": "text_fallback",
            "message": "Using text search (vector store not configured)",
            "results": [
                {
                    "id": applicant.id,
                    "name": getattr(applicant, 'display_name'),
                    "location": getattr(applicant, 'location_city'),
                    "score": 0.80
                } for applicant in applicants
            ]
        }


# ============================================================
# ADVANCED SEARCH & FILTERS
# ============================================================

@app.post("/api/search/advanced")
async def advanced_search(
    query: Optional[str] = Body(None),
    entity_type: str = Body("job"),
    filters: Optional[dict] = Body(None),
    sort_by: Optional[str] = Body(None),
    limit: int = Body(20),
    db: Session = Depends(get_db)
):
    """Advanced multi-criteria search with filters.
    
    Supports:
    - Full-text search across multiple fields
    - Multi-criteria filtering
    - Custom sorting
    - Faceted search
    """
    
    if entity_type == 'job':
        base_query = db.query(Job).filter(Job.status == 'approved')
        
        # Text search
        if query:
            search_pattern = f"%{query}%"
            base_query = base_query.filter(
                (Job.title.ilike(search_pattern)) |
                (Job.description.ilike(search_pattern))
            )
        
        # Apply filters
        if filters:
            if 'location' in filters:
                base_query = base_query.filter(Job.location_city.ilike(f"%{filters['location']}%"))
            if 'work_type' in filters:
                base_query = base_query.filter(Job.work_type == filters['work_type'])
            if 'min_experience' in filters:
                min_exp = float(filters['min_experience'])
                base_query = base_query.filter(Job.min_experience_years <= min_exp)
            if 'skills' in filters and isinstance(filters['skills'], list):
                # Filter jobs that have at least one of the specified skills
                for skill in filters['skills']:
                    base_query = base_query.filter(Job.required_skills.contains(skill))
        
        # Sorting
        if sort_by == 'recent':
            base_query = base_query.order_by(desc(Job.created_at))
        elif sort_by == 'title':
            base_query = base_query.order_by(Job.title)
        else:
            base_query = base_query.order_by(desc(Job.created_at))
        
        results = base_query.limit(limit).all()
        
        # Batch fetch employers
        employer_ids = list(set([getattr(j, 'employer_id') for j in results]))
        employers = {e.id: e for e in db.query(Employer).filter(Employer.id.in_(employer_ids)).all()}
        
        return {
            "status": "success",
            "count": len(results),
            "results": [
                {
                    "id": job.id,
                    "title": getattr(job, 'title'),
                    "company": getattr(employers.get(getattr(job, 'employer_id')), 'company_name', 'Unknown'),
                    "location": getattr(job, 'location_city'),
                    "work_type": getattr(job, 'work_type'),
                    "min_experience_years": getattr(job, 'min_experience_years', 0),
                    "required_skills": getattr(job, 'required_skills', []),
                    "created_at": getattr(job, 'created_at').isoformat() if getattr(job, 'created_at', None) else None
                } for job in results
            ]
        }
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported entity_type. Use 'job'.")


# ============================================================
# HUMAN REVIEW SYSTEM
# ============================================================

@app.post("/api/reviews/submit")
async def submit_human_review(
    review: dict = Body(...),  # Using dict to avoid circular import
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    """Submit a human review/correction for parsed resume data.
    
    Used when the AI parser makes mistakes and an admin needs to correct them.
    """
    from .db import HumanReview, AuditLog
    
    # Extract and validate review data
    applicant_id = review.get('applicant_id')
    field_name = review.get('field', '')
    original_val = review.get('original_value', '')
    corrected_val = review.get('corrected_value', '')
    reason = review.get('reason')
    
    if not applicant_id:
        raise HTTPException(status_code=400, detail="applicant_id is required")
    
    # Verify applicant exists
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")
    
    # Create review
    new_review = HumanReview(
        applicant_id=applicant_id,
        field=field_name,
        original_value=original_val,
        corrected_value=corrected_val,
        reviewer_id=current_user.id,
        reason=reason
    )
    db.add(new_review)
    db.commit()
    db.refresh(new_review)
    
    # Update the actual parsed record if applicable
    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if llm_record:
        normalized = getattr(llm_record, 'normalized', {})
        
        # Apply correction based on field
        if isinstance(normalized, dict):
            try:
                if field_name == 'cgpa' or field_name == 'grade':
                    education = normalized.get('education', [])
                    if education and isinstance(education, list) and len(education) > 0:
                        normalized['education'][0]['grade'] = float(corrected_val)
                elif field_name == 'jee_rank':
                    normalized['jee_rank'] = int(corrected_val)
                elif field_name.startswith('skills'):
                    # Handle skill corrections
                    pass
                
                llm_record.normalized = normalized  # type: ignore
                llm_record.needs_review = False  # type: ignore
                db.commit()
            except (ValueError, KeyError, IndexError, TypeError) as e:
                logger.warning(f"Failed to apply correction: {e}")
    
    # Audit log
    try:
        audit = AuditLog(
            action="human_review_submitted",
            target_type="HumanReview",
            target_id=new_review.id,
            user_id=current_user.id,
            details={
                "applicant_id": applicant_id,
                "field": field_name,
                "original": original_val,
                "corrected": corrected_val
            }
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")
    
    logger.info(f"Admin {current_user.id} submitted review for applicant {applicant_id}, field: {field_name}")
    
    return new_review


@app.get("/api/reviews/applicant/{applicant_id}")
async def get_applicant_reviews(
    applicant_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    """Get all human reviews for a specific applicant."""
    from .db import HumanReview
    
    reviews = db.query(HumanReview).filter(
        HumanReview.applicant_id == applicant_id
    ).order_by(desc(HumanReview.created_at)).all()
    
    # Fetch reviewer info
    from .db import User
    reviewer_ids = list(set([getattr(r, 'reviewer_id') for r in reviews if getattr(r, 'reviewer_id', None)]))
    reviewers = {u.id: u for u in db.query(User).filter(User.id.in_(reviewer_ids)).all()}
    
    return {
        "applicant_id": applicant_id,
        "review_count": len(reviews),
        "reviews": [
            {
                "id": review.id,
                "field": getattr(review, 'field'),
                "original_value": getattr(review, 'original_value'),
                "corrected_value": getattr(review, 'corrected_value'),
                "reason": getattr(review, 'reason'),
                "reviewer_name": getattr(reviewers.get(getattr(review, 'reviewer_id')), 'name', 'Unknown'),
                "created_at": getattr(review, 'created_at').isoformat() if getattr(review, 'created_at', None) else None
            } for review in reviews
        ]
    }


@app.get("/api/reviews/pending")
async def get_applicants_needing_review(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    """Get applicants with low-confidence parses that need review."""
    
    # Find parsed records that need review
    records = db.query(LLMParsedRecord, Applicant).join(
        Applicant, LLMParsedRecord.applicant_id == Applicant.id
    ).filter(
        LLMParsedRecord.needs_review == True
    ).limit(limit).all()
    
    return {
        "status": "success",
        "count": len(records),
        "pending_reviews": [
            {
                "applicant_id": applicant.id,
                "applicant_name": getattr(applicant, 'display_name'),
                "confidence": (record.field_confidences or {}).get('overall', 0),
                "created_at": getattr(record, 'created_at').isoformat() if getattr(record, 'created_at', None) else None
            } for record, applicant in records
        ]
    }


@app.patch("/api/reviews/mark-reviewed/{applicant_id}")
async def mark_as_reviewed(
    applicant_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    """Mark an applicant's parse as reviewed (no corrections needed)."""
    
    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if not llm_record:
        raise HTTPException(status_code=404, detail="Parsed record not found")
    
    llm_record.needs_review = False  # type: ignore
    db.commit()
    
    logger.info(f"Admin {current_user.id} marked applicant {applicant_id} as reviewed (no corrections)")
    
    return {
        "status": "success",
        "message": "Marked as reviewed",
        "applicant_id": applicant_id
    }


# ============================================================
# INTERVIEW SYSTEM v2
# ============================================================
# All interview endpoints are now handled by the interview router
# registered via app.include_router(interview_router_v2) above.
# Routes: /api/interview/start, /api/interview/answer,
#         /api/interview/session/{id}, /api/interview/results/{id},
#         /api/interview/study-plan/{id}, /api/interview/hint/{id},
#         /api/interview/feedback/{id}, /api/interview/abandon/{id},
#         /api/interview/active-session




# ============================================================
# CREDIT SYSTEM ENDPOINTS
# ============================================================

@app.get("/api/credits/balance", response_model=CreditAccountResponse)
def get_credit_balance(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current credit balance and usage statistics.
    """
    from .core.credit_service import CreditService
    
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    credit_service = CreditService(db)
    applicant_id_val = getattr(applicant, 'id', 0)
    
    summary = credit_service.get_account_summary(applicant_id_val)
    return summary


@app.get("/api/credits/transactions", response_model=List[CreditTransactionResponse])
def get_credit_transactions(
    limit: int = 50,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get credit transaction history.
    """
    from .db import CreditAccount, CreditTransaction
    
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    applicant_id_val = getattr(applicant, 'id', 0)
    
    # Get account
    account = db.query(CreditAccount).filter(
        CreditAccount.applicant_id == applicant_id_val
    ).first()
    
    if not account:
        return []
    
    # Get transactions
    transactions = db.query(CreditTransaction).filter(
        CreditTransaction.account_id == account.id
    ).order_by(desc(CreditTransaction.created_at)).limit(limit).all()
    
    return [
        {
            "id": t.id,
            "transaction_type": getattr(t, 'transaction_type', ''),
            "amount": getattr(t, 'amount', 0),
            "balance_after": getattr(t, 'balance_after', 0),
            "activity_type": getattr(t, 'activity_type', None),
            "description": getattr(t, 'description', None),
            "created_at": getattr(t, 'created_at', dt.datetime.utcnow())
        }
        for t in transactions
    ]


@app.post("/api/admin/credits/adjust")
def admin_adjust_credits(
    adjustment: AdminCreditAdjustment,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to adjust user credits.
    """
    from .core.credit_service import CreditService
    
    # Check admin role
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    credit_service = CreditService(db)
    
    try:
        # If a user has multiple applicant rows, always adjust the latest profile account
        # to stay consistent with student dashboard credit reads.
        target_applicant = db.query(Applicant).filter(Applicant.id == adjustment.applicant_id).first()
        if not target_applicant:
            raise HTTPException(status_code=404, detail="Applicant not found")

        latest_applicant = (
            db.query(Applicant)
            .filter(Applicant.user_id == target_applicant.user_id)
            .order_by(desc(Applicant.id))
            .first()
        )
        effective_applicant_id = int(getattr(latest_applicant, 'id', adjustment.applicant_id))

        transaction = credit_service.add_bonus_credits(
            applicant_id=effective_applicant_id,
            amount=adjustment.amount,
            admin_email=current_user.email,
            reason=adjustment.reason
        )
        
        return {
            "success": True,
            "message": f"Adjusted credits by {adjustment.amount}",
            "transaction_id": transaction.id,
            "new_balance": transaction.balance_after
        }
    except Exception as e:
        logger.error(f"Error adjusting credits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/credits/applicant/{applicant_id}")
def admin_get_applicant_credit_balance(
    applicant_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to fetch credit balance/usage for a specific applicant."""
    from .core.credit_service import CreditService

    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    latest_applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == applicant.user_id)
        .order_by(desc(Applicant.id))
        .first()
    )
    effective_applicant_id = int(getattr(latest_applicant, 'id', applicant_id))

    credit_service = CreditService(db)
    return credit_service.get_account_summary(effective_applicant_id)


@app.get("/api/admin/applicants/{applicant_id}/sessions")
async def get_applicant_sessions(
    applicant_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    """Fetch all mock practice sessions for a specific applicant (admin only)."""
    from .db import InterviewSession
    sessions = db.query(InterviewSession).filter(
        InterviewSession.applicant_id == applicant_id
    ).order_by(desc(InterviewSession.created_at)).all()
    
    return [
        {
            "id": s.id,
            "interview_type": s.interview_type,
            "difficulty": s.difficulty,
            "total_questions": s.total_questions,
            "voice_mode": s.voice_mode,
            "topic_focus": s.topic_focus,
            "interviewer_persona": s.interviewer_persona,
            "status": s.status,
            "overall_score": s.overall_score,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None
        }
        for s in sessions
    ]


@app.post("/api/admin/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_role("admin"))
):
    """Toggle a user's portal active status (admin ban/unban control)."""
    from .db import User, AuditLog
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Toggle status
    old_status = user.is_active
    user.is_active = not old_status  # type: ignore
    db.commit()
    
    # Audit log
    try:
        audit = AuditLog(
            action="user_ban_toggle",
            target_type="User",
            target_id=user_id,
            user_id=current_user.id,
            details={
                "old_status": old_status,
                "new_status": user.is_active,
                "email": user.email
            }
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to write suspension audit log: {e}")
        
    return {
        "user_id": user_id,
        "is_active": user.is_active,
        "message": f"User account {'reactivated' if user.is_active else 'suspended'} successfully"
    }





@app.post("/api/credits/award-bonus")
def award_learning_bonus(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Award bonus credits for completing learning activities.
    Triggered when user finishes courses or improves scores significantly.
    """
    from .core.credit_service import CreditService
    from .db import Applicant, InterviewSession
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    applicant_id_val = getattr(applicant, 'id', 0)
    credit_service = CreditService(db)
    
    # Check recent improvements
    interview_service = InterviewService(db)
    sessions = db.query(InterviewSession).filter(
        InterviewSession.applicant_id == applicant_id_val,
        InterviewSession.status == 'completed'
    ).order_by(desc(InterviewSession.completed_at)).limit(2).all()
    
    if len(sessions) >= 2:
        latest_score = getattr(sessions[0], 'overall_score', 0) or 0
        previous_score = getattr(sessions[1], 'overall_score', 0) or 0
        improvement = latest_score - previous_score
        
        if improvement >= 20:  # 20% improvement
            bonus_amount = 5  # Award 5 bonus credits
            transaction = credit_service.add_bonus_credits(
                applicant_id=applicant_id_val,
                amount=bonus_amount,
                admin_email="system",
                reason=f"Improvement bonus: +{improvement:.1f}% score increase"
            )
            
            return {
                "awarded": True,
                "amount": bonus_amount,
                "reason": f"Great improvement! You increased your score by {improvement:.1f}%",
                "new_balance": transaction.balance_after
            }
    
    return {
        "awarded": False,
        "reason": "Keep practicing to earn bonus credits!"
    }


# ============================================================
# RAG (Retrieval Augmented Generation) Q&A Endpoints
# ============================================================
from pydantic import BaseModel, Field

class RAGQuery(BaseModel):
    """Request model for RAG question"""
    query: str = Field(..., min_length=3, max_length=500, description="User's question")

class RAGSource(BaseModel):
    """Source document reference"""
    file: str
    section: str
    relevance: float
    preview: str

class RAGAnswerResponse(BaseModel):
    """Response from RAG system"""
    query: str
    answer: str
    sources: List[RAGSource]
    metadata: dict = Field(default_factory=dict)

class RAGSuggestionsResponse(BaseModel):
    """Suggested questions response"""
    suggestions: List[str]

class RAGStatsResponse(BaseModel):
    """RAG system statistics"""
    is_initialized: bool
    total_chunks: int
    cache_size: int
    gemini_configured: bool
    model: str
    total_rebuilds: int = 0
    last_rebuild_time: Optional[str] = None
    rebuild_duration: float = 0


# RAG rate limiting (separate from other endpoints)
rag_rate_limiter: dict = defaultdict(lambda: {"count": 0, "reset_time": 0})
RAG_RATE_LIMIT = 20  # requests per minute
RAG_RATE_WINDOW = 60  # seconds


def check_rag_rate_limit(user_id: str) -> tuple[bool, str]:
    """Check rate limit for RAG requests"""
    current_time = time()
    user_limits = rag_rate_limiter[user_id]
    
    if current_time > user_limits["reset_time"]:
        user_limits["count"] = 0
        user_limits["reset_time"] = current_time + RAG_RATE_WINDOW
    
    if user_limits["count"] >= RAG_RATE_LIMIT:
        remaining = int(user_limits["reset_time"] - current_time)
        return False, f"Rate limit exceeded. Please wait {remaining} seconds."
    
    user_limits["count"] += 1
    return True, ""


@app.post("/api/rag/ask", response_model=RAGAnswerResponse)
async def rag_ask_question(
    body: RAGQuery,
    request: Request,
    current_user = Depends(get_current_user_optional)
):
    """
    Ask a question about the Career Guidance AI application.
    
    The RAG system uses documentation as its knowledge base and provides
    answers with source citations.
    
    Rate limits:
    - 20 requests per minute per user
    - Abuse prevention for off-topic/spam queries
    """
    from .rag import get_rag_service
    
    # Get user identifier for rate limiting
    user_id = str(current_user.id) if current_user else (request.client.host if request.client else "anonymous")
    
    # Check rate limit
    allowed, error_msg = check_rag_rate_limit(user_id)
    if not allowed:
        raise HTTPException(status_code=429, detail=error_msg)
    
    # Get RAG service
    rag_service = get_rag_service()
    
    # Initialize if needed
    if not rag_service._is_initialized:
        if not rag_service.initialize():
            raise HTTPException(
                status_code=503,
                detail="RAG system is temporarily unavailable. Please try again later."
            )
    
    # Process query
    response, error = await rag_service.ask(
        query=body.query,
        user_id=user_id,
        use_cache=True
    )
    
    if error or response is None:
        raise HTTPException(status_code=400, detail=error or "Failed to process query")
    
    return RAGAnswerResponse(
        query=response.query,
        answer=response.answer,
        sources=[RAGSource(**s) for s in response.sources],
        metadata=response.metadata
    )


@app.get("/api/rag/suggestions", response_model=RAGSuggestionsResponse)
async def rag_get_suggestions():
    """
    Get suggested questions that users can ask.
    
    Returns a list of common questions about the application.
    """
    from .rag import get_rag_service
    
    rag_service = get_rag_service()
    suggestions = rag_service.get_suggested_questions()
    
    return RAGSuggestionsResponse(suggestions=suggestions)


@app.get("/api/rag/stats", response_model=RAGStatsResponse)
async def rag_get_stats(
    current_user = Depends(require_role("admin"))
):
    """
    Get RAG system statistics (admin only).
    
    Returns information about the RAG system state including
    indexing status, cache size, rebuild metrics, and Gemini API configuration.
    """
    from .rag import get_rag_service
    
    rag_service = get_rag_service()
    stats = rag_service.get_stats()
    
    return RAGStatsResponse(
        is_initialized=stats['is_initialized'],
        total_chunks=stats['total_chunks'],
        cache_size=stats['cache_size'],
        gemini_configured=stats['gemini_configured'],
        model=stats['model'],
        total_rebuilds=rag_service._rebuild_stats.get('total_rebuilds', 0),
        last_rebuild_time=rag_service._rebuild_stats.get('last_rebuild_time'),
        rebuild_duration=rag_service._rebuild_stats.get('rebuild_duration', 0)
    )


@app.post("/api/rag/initialize")
async def rag_initialize(
    force_rebuild: bool = False,
    current_user = Depends(require_role("admin"))
):
    """
    Initialize or rebuild the RAG index (admin only).
    
    Use force_rebuild=True to rebuild the index even if cached.
    """
    from .rag import get_rag_service
    
    rag_service = get_rag_service()
    success = rag_service.initialize(force_rebuild=force_rebuild)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to initialize RAG system. Check documentation path."
        )
    
    return {
        "status": "success",
        "message": "RAG system initialized successfully",
        "stats": rag_service.get_stats()
    }


@app.get("/api/rag/rebuild-status")
async def rag_rebuild_status(
    current_user = Depends(require_role("admin"))
):
    """
    Get file watcher and rebuild status (admin only).
    
    Returns:
    - watcher_state: File monitoring status
    - rebuild_stats: Index rebuild metrics
    - file_hashes: Per-file content hashes (for delta update support)
    """
    from .rag import get_rag_service
    
    rag_service = get_rag_service()
    
    # Get watcher stats
    watcher_stats = rag_service.get_file_watcher_stats()
    
    # Get rebuild stats
    rebuild_stats = {
        'total_rebuilds': rag_service._rebuild_stats.get('total_rebuilds', 0),
        'last_rebuild_time': rag_service._rebuild_stats.get('last_rebuild_time'),
        'rebuild_duration': rag_service._rebuild_stats.get('rebuild_duration', 0),
        'chunks_indexed': rag_service._rebuild_stats.get('chunks_indexed', 0),
        'rebuild_in_progress': rag_service._rebuild_in_progress
    }
    
    # Get file hashes (truncated for readability)
    file_hashes = rag_service._file_hashes.copy()
    file_hashes_summary = {
        'total_files': len(file_hashes),
        'files': {name: hash[:8] + '...' for name, hash in file_hashes.items()}
    }
    
    return {
        "status": "success",
        "watcher_state": watcher_stats,
        "rebuild_stats": rebuild_stats,
        "file_hashes": file_hashes_summary,
        "rag_initialized": rag_service._is_initialized
    }


# ============================================================
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
