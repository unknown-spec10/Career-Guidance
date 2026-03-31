from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Body, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from uuid import uuid4
from typing import Optional, List, Dict, Any
from collections import defaultdict
from time import time
import os
from .utils import save_upload, sha256_file, sanitize_text, sanitize_dict, validate_email, sanitize_filename
from .config import settings, IS_SUPABASE
from .constants import (
    ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB,
    API_MESSAGES, DEFAULT_PAGE_SIZE,
    INTERVIEW_CONFIG, INTERVIEW_SCORE_MULTIPLIERS
)
from .schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    JobCreate, JobUpdate, JobResponse,
    JobApplicationCreate, JobApplicationResponse,
    ApprovalAction, MarksheetUpload, VerifyCodeRequest, ResendCodeRequest,
    InterviewSessionCreate, InterviewSessionResponse, QuestionResponse,
    AnswerSubmit, AnswerEvaluation, SessionCompleteRequest, SessionCompleteResponse,
    SkillAssessmentCreate, SkillAssessmentResponse, LearningPathResponse,
    InterviewHistoryResponse, CreditAccountResponse, CreditTransactionResponse,
    AdminCreditAdjustment
)
from .auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_user_optional, require_role
)
from pathlib import Path
import json
from .resume.parse_service import ResumeParserService
from .interview.interview_service import InterviewService
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


def enqueue_embedding_task(task_fn, *args) -> Optional[str]:
    """Queue embedding work without blocking API requests."""
    global _EMBEDDING_QUEUE_DISABLED
    if _EMBEDDING_QUEUE_DISABLED:
        return None

    try:
        async_result = task_fn.delay(*args)
        return async_result.id
    except Exception as exc:
        message = str(exc)
        logger.warning("Failed to enqueue embedding task: %s", message)

        # Avoid retry-storm logs when Redis/Celery backend is down.
        lowered = message.lower()
        if (
            "redis" in lowered
            or "retry limit exceeded" in lowered
            or "connection refused" in lowered
            or "connection to redis lost" in lowered
        ):
            _EMBEDDING_QUEUE_DISABLED = True
            logger.warning(
                "Disabling async embedding queue for this process because broker/backend is unavailable. "
                "Restart the API service after Redis/Celery is healthy to re-enable queueing."
            )
        return None

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
    name: str = Body(...),
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


@app.get("/api/student/profile")
async def get_student_profile(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get student resume profile with parsed data"""
    from .db import Applicant, LLMParsedRecord
    
    # Find applicant linked to this user
    applicant = db.query(Applicant).filter(
        Applicant.user_id == current_user.id
    ).options(joinedload(Applicant.parsed_record)).first()
    
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
    
    return {
        "applicant_id": applicant.id,
        "display_name": applicant.display_name or current_user.name,
        "skills": get_list("skills", []),
        "education": get_list("education", []),
        "experience": get_list("experience", []),
        "projects": get_list("projects", []),
        "certifications": get_list("certifications", []),
        "jee_rank": normalized.get("jee_rank"),
        "personal_info": normalized.get("personal_info", {})
    }


@app.put("/api/student/profile")
async def update_student_profile(
    profile_data: dict = Body(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update student resume profile"""
    from .db import Applicant, LLMParsedRecord
    
    # Find applicant linked to this user
    applicant = db.query(Applicant).filter(
        Applicant.user_id == current_user.id
    ).options(joinedload(Applicant.parsed_record)).first()
    
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
async def upload_resume(
    request: Request,
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
            logger.info(f"Duplicate resume detected. Returning existing applicant {existing_applicant.applicant_id}")
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
        
        # Create upload record
        upload = Upload(
            applicant_id=applicant.id,
            file_name=res_name,
            file_type='resume',
            storage_path=str(resume_path),
            file_hash=resume_hash
        )
        db.add(upload)
        
        # Create credit account with default 60 credits
        from .db import CreditAccount
        import datetime
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

                parse_task_id = enqueue_embedding_task(parse_resume_task, applicant_id, str(applicant_dir))
                if parse_task_id:
                    logger.info("Queued parse task %s for applicant %s", parse_task_id, applicant_id)
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
async def parse_applicant(applicant_id: str, sync: bool = False, db: Session = Depends(get_db)):
    from .db import Applicant, LLMParsedRecord
    
    applicant_dir = DATA_ROOT / applicant_id
    if not applicant_dir.exists():
        raise HTTPException(status_code=404, detail="applicant_id not found")

    # Async-first parsing: queue worker task and return immediately.
    # Use ?sync=true to force in-process parsing for debugging/rollback.
    if settings.ASYNC_PARSE_ENABLED and not sync:
        try:
            from .embedding_tasks import parse_resume_task

            task_id = enqueue_embedding_task(parse_resume_task, applicant_id, str(applicant_dir))
            if task_id:
                return JSONResponse({
                    "status": "queued",
                    "applicant_id": applicant_id,
                    "parse_task_id": task_id,
                    "message": "Parse job queued. Poll /api/embeddings/task/{task_id} (admin) for progress.",
                })
            logger.warning(
                "Async parse queue unavailable for applicant %s; falling back to sync parse",
                applicant_id,
            )
        except Exception as e:
            logger.warning("Failed to queue parse task for %s: %s", applicant_id, e)
            logger.warning("Falling back to sync parse for %s", applicant_id)
    
    # Run parsing
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
        # Try both 'personal_info' and 'personal' for backwards compatibility
        personal_info = normalized.get('personal_info') or normalized.get('personal', {})
        if personal_info.get('name'):
            applicant.display_name = personal_info['name']
        if personal_info.get('location'):
            location_parts = personal_info['location'].split(',')
            applicant.location_city = location_parts[0].strip() if location_parts else None  # type: ignore
            applicant.location_state = location_parts[1].strip() if len(location_parts) > 1 else None  # type: ignore
        
        # Save or update LLM parsed record
        llm_record = db.query(LLMParsedRecord).filter(
            LLMParsedRecord.applicant_id == applicant.id
        ).first()
        
        if llm_record:
            # Update existing
            llm_record.raw_llm_output = result  # type: ignore
            llm_record.normalized = normalized  # type: ignore
            llm_record.llm_provenance = result.get('llm_provenance', {})  # type: ignore
            llm_record.needs_review = result.get('needs_review', False)
        else:
            # Create new
            llm_record = LLMParsedRecord(
                applicant_id=applicant.id,
                raw_llm_output=result,
                normalized=normalized,
                llm_provenance=result.get('llm_provenance', {}),
                needs_review=result.get('needs_review', False)
            )
            db.add(llm_record)
        
        db.commit()
        logger.info(f"✓ Saved parsed data for applicant {applicant_id} (ID: {applicant.id})")

        # Queue async embedding -> recommendation workflow.
        try:
            from celery import chain
            from .embedding_tasks import generate_recommendations_task, generate_resume_embedding_task

            workflow = chain(
                generate_resume_embedding_task.s(applicant.id),
                generate_recommendations_task.s(applicant.id),
            ).apply_async()

            workflow_id = getattr(workflow, "id", None)
            workflow_parent = getattr(workflow, "parent", None)
            embedding_task_id = getattr(workflow_parent, "id", None)

            result['resume_embedding_task_id'] = embedding_task_id
            result['recommendation_task_id'] = workflow_id
            logger.info(
                "Queued embedding->recommendation workflow %s for applicant %s",
                workflow_id,
                applicant.id,
            )
        except Exception as e:
            logger.warning(f"Could not enqueue embedding/recommendation workflow for applicant {applicant.id}: {e}")
        
        # Add database ID to result
        result['db_applicant_id'] = applicant.id
        
        result['auto_recommendations_generated'] = "queued"
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save parsed data to database: {e}")
        result['database_error'] = str(e)
    
    return JSONResponse(result)


# New endpoints for comprehensive features
from .db import SessionLocal, Applicant, LLMParsedRecord, Job, JobRecommendation, Employer

# ============================================================
# STUDENT PROFILE ENDPOINT
# ============================================================

@app.get("/api/student/applicant")
async def get_current_student_applicant(current_user = Depends(require_role("student")), db: Session = Depends(get_db)):
    """Get the current student's applicant profile (DB id, applicant_id, etc)"""
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
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
            "created_at": applicant.created_at.isoformat() if applicant.created_at is not None else None
        },
        "parsed_data": llm_record.normalized if llm_record else None,
        "needs_review": llm_record.needs_review if llm_record else False,
        "field_confidences": llm_record.field_confidences if llm_record else None
    }


# ============================================================
# EMPLOYER JOB POSTING ENDPOINTS
# ============================================================

@app.post("/api/employer/jobs", response_model=JobResponse)
async def create_job_posting(
    job_data: JobCreate,
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
        task_id = enqueue_embedding_task(generate_job_embedding_task, job.id)
        if task_id:
            logger.info(f"Queued job embedding task {task_id} for job {job.id}")
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
    from .db import Job, Employer
    
    employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")
    
    jobs = db.query(Job).filter(Job.employer_id == employer.id).all()
    return {"jobs": jobs, "total": len(jobs)}


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
        result.append({
            "application_id": app.id,
            "applicant_id": applicant.id,
            "applicant_name": applicant.display_name,
            "status": app.status,
            "applied_at": applied_at_ser,
            "cover_letter": app.cover_letter
        })
    
    return {"applicants": result, "total": len(result)}


@app.patch("/api/employer/jobs/{job_id}", response_model=JobResponse)
async def update_job_posting(
    job_id: int,
    job_data: JobUpdate,
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

            task_id = enqueue_embedding_task(generate_job_embedding_task, job.id)
            if task_id:
                logger.info("Queued job embedding task %s for updated job %s", task_id, job.id)
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
    db.commit()
    db.refresh(application)
    
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
    db: Session = Depends(get_db)
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


@app.get("/api/jobs")
async def get_jobs(
    skip: int = 0,
    limit: int = 20,
    location: Optional[str] = None
):
    """Get all active jobs - Repository pattern version"""
    job_repo = get_job_repo()
    jobs = await job_repo.list_active(location=location, limit=limit)
    
    result = []
    for j in jobs:
        result.append({
            "id": j.get('id'),
            "title": j.get('title'),
            "company": j.get('company'),
            "location": j.get('location'),
            "salary_min": j.get('salary_min'),
            "salary_max": j.get('salary_max'),
            "currency": j.get('currency', 'LPA'),
            "description": j.get('description'),
            "requirements": j.get('requirements', []),
            "posted_date": j.get('posted_date'),
            "expires_at": j.get('expires_at')
        })
    
    return {
        "jobs": result,
        "total": len(result),
        "next_cursor": None
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
                "scoring_breakdown": rec.scoring_breakdown,
                "explain": rec.explain,
                "status": rec.status
            } for rec, job, employer in job_recs
        ]
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
    
    # Average match scores
    job_avg = db.query(func.avg(JobRecommendation.score)).scalar()
    
    avg_job = float(job_avg) if job_avg is not None else 0.0
    
    return {
        **stats,
        "avg_job_match": avg_job
    }

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
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate or refresh job recommendations for an applicant.
    
    Uses the new RecommendationService with normalized 0–1 scores and semantic
    skill matching. Removes old recommendations before regenerating.
    """
    # Validate applicant and parsed data
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail=API_MESSAGES['APPLICANT_NOT_FOUND'])

    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if not llm_record:
        raise HTTPException(status_code=400, detail=API_MESSAGES['NO_PARSED_DATA'])

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
        
        # Return counts based on generated lists
        return {
            "status": "success",
            "message": "Recommendations generated successfully",
            "job_recommendations_count": job_count
        }
    except Exception as e:
        logger.error(f"Failed to generate recommendations via service: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")


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
        task_id = enqueue_embedding_task(generate_job_embedding_task, job.id)
        queued.append({"job_id": job.id, "task_id": task_id})

    return {
        "status": "queued",
        "count": len(queued),
        "offset": offset,
        "limit": safe_limit,
        "items": queued,
    }


@app.post("/api/embeddings/reindex/applicants")
async def reindex_applicant_embeddings(
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
        task_id = enqueue_embedding_task(generate_resume_embedding_task, applicant.id)
        queued.append({"applicant_id": applicant.id, "task_id": task_id})

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
            "broker": settings.CELERY_BROKER_URL,
            "result_backend": settings.CELERY_RESULT_BACKEND,
            "default_queue": settings.CELERY_DEFAULT_QUEUE,
            "embeddings_queue": settings.CELERY_EMBEDDINGS_QUEUE,
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
    """Check Celery task state for embedding jobs."""
    import importlib
    from .celery_app import celery_app

    celery_result_module = importlib.import_module("celery.result")
    AsyncResult = getattr(celery_result_module, "AsyncResult")
    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "state": result.state,
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
        "result": result.result if result.ready() else None,
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
                "confidence": getattr(record, 'field_confidences', {}).get('overall', 0),
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
# INTERVIEW & ASSESSMENT ENDPOINTS
# ============================================================

@app.post("/api/interviews/start", response_model=InterviewSessionResponse)
def start_interview_session(
    session_data: InterviewSessionCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a new mock interview session with credit-based quota.
    Supports full (10 credits) or micro (1 credit) modes.
    """
    from .core.credit_service import CreditService
    
    # Get applicant for current user
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    applicant_id_val = getattr(applicant, 'id', 0)
    interview_service = InterviewService(db)
    credit_service = CreditService(db)
    
    # Determine session mode and activity type
    session_mode = getattr(session_data, 'session_mode', 'full')
    activity_type = 'full_interview' if session_mode == 'full' else 'micro_session'
    
    # Check credit eligibility and rate limits
    can_proceed, message, context = credit_service.check_eligibility(applicant_id_val, activity_type)
    if not can_proceed:
        raise HTTPException(
            status_code=429,
            detail=message,
            headers={"X-Credit-Balance": str(context.get('credits', 0))}
        )
    
    # Check progressive difficulty (if previous score is low, suggest easier mode)
    previous_score = interview_service.get_previous_score(applicant_id_val)
    if session_mode == 'full' and previous_score is not None and previous_score < 40:
        # Suggest micro-practice first
        raise HTTPException(
            status_code=400,
            detail=f"Your last score was {previous_score:.1f}%. We recommend micro-practice sessions before attempting another full interview. This helps build confidence and saves credits!"
        )
    
    # Create session
    session = interview_service.create_session(
        applicant_id=applicant_id_val,
        session_type=session_data.session_type,
        session_mode=session_mode,
        difficulty_level=session_data.difficulty_level or "medium",
        focus_skills=session_data.focus_skills
    )
    
    # Spend credits
    cost = context.get('cost', 10 if session_mode == 'full' else 1)
    session_id_val = getattr(session, 'id', 0)
    credit_service.spend_credits(
        applicant_id=applicant_id_val,
        activity_type=activity_type,
        cost=cost,
        reference_id=session_id_val,
        reference_type='interview_session',
        description=f"Started {session_mode} {session_data.session_type} interview"
    )
    
    # Generate questions (different count for micro vs full)
    try:
        if session_mode == 'micro':
            mcq_count = 1  # Only 1 question for micro
            short_count = 0
        else:
            mcq_count = INTERVIEW_CONFIG['MCQ_COUNT_RANGE'][1]  # 7 MCQs
            short_count = INTERVIEW_CONFIG['SHORT_ANSWER_COUNT_RANGE'][1]  # 3 short answers
        
        questions = interview_service.generate_questions(
            session=session,
            mcq_count=mcq_count,
            short_answer_count=short_count
        )
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        # Refund credits on failure
        credit_service.add_bonus_credits(
            applicant_id=applicant_id_val,
            amount=cost,
            admin_email="system",
            reason=f"Refund for failed session generation: {str(e)[:100]}"
        )
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
    
    # Build response
    session_dict = {
        "id": session.id,
        "applicant_id": getattr(session, 'applicant_id', 0),
        "session_type": getattr(session, 'session_type', ''),
        "difficulty_level": getattr(session, 'difficulty_level', 'medium'),
        "focus_skills": getattr(session, 'focus_skills', None),
        "started_at": (getattr(session, 'started_at', dt.datetime.utcnow()).isoformat() + 'Z') if getattr(session, 'started_at', None) else None,
        "completed_at": (getattr(session, 'completed_at').isoformat() + 'Z') if getattr(session, 'completed_at', None) else None,
        "duration_seconds": getattr(session, 'duration_seconds', None),
        "status": getattr(session, 'status', 'in_progress'),
        "overall_score": getattr(session, 'overall_score', None),
        "technical_score": getattr(session, 'technical_score', None),
        "communication_score": getattr(session, 'communication_score', None),
        "problem_solving_score": getattr(session, 'problem_solving_score', None),
        "skill_scores": getattr(session, 'skill_scores', None),
        "ai_feedback": getattr(session, 'ai_feedback', None),
        "skill_gap_analysis": getattr(session, 'skill_gap_analysis', None),
        "recommended_resources": getattr(session, 'recommended_resources', None),
        "question_count": len(questions)
    }
    
    return session_dict


@app.get("/api/interviews/{session_id}/questions")
def get_interview_questions(
    session_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get session data and all questions for an interview session.
    Auto-generates questions if session has none.
    """
    from .db import InterviewSession, InterviewQuestion
    
    # Verify session belongs to current user
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.applicant_id == applicant.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    # Get questions
    questions = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session_id
    ).order_by(InterviewQuestion.question_order).all()
    
    # If no questions exist, generate them now
    if not questions:
        try:
            interview_service = InterviewService(db)
            session_mode = getattr(session, 'session_mode', 'full')
            if session_mode == 'micro':
                mcq_count = 1
                short_count = 0
            else:
                mcq_count = INTERVIEW_CONFIG['MCQ_COUNT_RANGE'][1]
                short_count = INTERVIEW_CONFIG['SHORT_ANSWER_COUNT_RANGE'][1]
            
            questions = interview_service.generate_questions(
                session=session,
                mcq_count=mcq_count,
                short_answer_count=short_count
            )
        except Exception as e:
            logger.error(f"Error generating questions for session {session_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")
    
    # If session time has expired but status is still in_progress, extend the timer
    now = dt.datetime.utcnow()
    ends_at = getattr(session, 'ends_at', None)
    session_status = getattr(session, 'status', 'in_progress')
    
    if session_status == 'in_progress' and ends_at and ends_at < now:
        # Reset the timer based on session mode
        session_mode = getattr(session, 'session_mode', 'full')
        if session_mode == 'micro':
            duration = INTERVIEW_CONFIG['MICRO_SESSION_DURATION_SECONDS']
        else:
            duration = INTERVIEW_CONFIG['SESSION_DURATION_SECONDS']
        
        session.started_at = now  # type: ignore
        session.ends_at = now + dt.timedelta(seconds=duration)  # type: ignore
        db.commit()
        db.refresh(session)
    
    # Check for associated learning path
    from .db import LearningPath
    learning_path = db.query(LearningPath).filter(
        LearningPath.source_session_id == session.id
    ).first()

    session_data = {
        "id": session.id,
        "session_type": getattr(session, 'session_type', ''),
        "session_mode": getattr(session, 'session_mode', 'full'),
        "difficulty_level": getattr(session, 'difficulty_level', 'medium'),
        "status": getattr(session, 'status', 'in_progress'),
        "started_at": (getattr(session, 'started_at', dt.datetime.utcnow()).isoformat() + 'Z') if getattr(session, 'started_at', None) else None,
        "ends_at": (getattr(session, 'ends_at').isoformat() + 'Z') if getattr(session, 'ends_at', None) else None,
        "focus_skills": getattr(session, 'focus_skills', None),
        # Result fields
        "overall_score": getattr(session, 'overall_score', None),
        "skill_scores": getattr(session, 'skill_scores', None),
        "ai_feedback": getattr(session, 'ai_feedback', None),
        "skill_gap_analysis": getattr(session, 'skill_gap_analysis', None),
        "learning_path_id": learning_path.id if learning_path else None
    }
    
    # Fetch existing answers
    from .db import InterviewAnswer
    existing_answers = db.query(InterviewAnswer).filter(
        InterviewAnswer.session_id == session_id
    ).all()
    answers_map = {a.question_id: a for a in existing_answers}

    questions_data = []
    for q in questions:
        answer = answers_map.get(q.id)
        q_data = {
            "id": q.id,
            "session_id": getattr(q, 'session_id', 0),
            "question_order": getattr(q, 'question_order', 0),
            "question_type": getattr(q, 'question_type', ''),
            "question_text": getattr(q, 'question_text', ''),
            "difficulty": getattr(q, 'difficulty', 'medium'),
            "category": getattr(q, 'category', 'General'),
            "options": getattr(q, 'options', None),
            "starter_code": getattr(q, 'starter_code', None),
            "max_score": getattr(q, 'max_score', 10.0),
            "skills_tested": getattr(q, 'skills_tested', None),
            "submitted_answer": {
                "answer_text": answer.answer_text,
                "selected_option": answer.selected_option,
                "code_submitted": answer.code_submitted
            } if answer else None
        }
        questions_data.append(q_data)
    
    return {
        "session": session_data,
        "questions": questions_data
    }


@app.post("/api/interviews/{session_id}/submit-answer", response_model=AnswerEvaluation)
def submit_interview_answer(
    session_id: int,
    answer_data: AnswerSubmit,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit and evaluate an answer to an interview question.
    """
    from .db import InterviewSession
    
    # Verify session belongs to current user
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.applicant_id == applicant.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    if getattr(session, 'status', '') == 'completed':
        raise HTTPException(status_code=400, detail="Session already completed")
    
    interview_service = InterviewService(db)
    
    try:
        answer = interview_service.submit_answer(
            session_id=session_id,
            question_id=answer_data.question_id,
            answer_text=answer_data.answer_text,
            code_submitted=answer_data.code_submitted,
            selected_option=answer_data.selected_option,
            time_taken_seconds=answer_data.time_taken_seconds
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting answer: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit answer: {str(e)}")
    
    from .db import InterviewQuestion
    question = db.query(InterviewQuestion).filter(InterviewQuestion.id == answer_data.question_id).first()
    
    return {
        "answer_id": answer.id,
        "question_id": getattr(answer, 'question_id', 0),
        "is_correct": getattr(answer, 'is_correct', None),
        "score": getattr(answer, 'score', 0.0),
        "max_score": getattr(question, 'max_score', 10.0) if question else 10.0,
        "ai_evaluation": getattr(answer, 'ai_evaluation', None),
        "strengths": getattr(answer, 'strengths', None),
        "weaknesses": getattr(answer, 'weaknesses', None),
        "improvement_suggestions": getattr(answer, 'improvement_suggestions', None)
    }


@app.post("/api/interviews/{session_id}/complete", response_model=SessionCompleteResponse)
def complete_interview_session(
    session_id: int,
    complete_data: SessionCompleteRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete and finalize an interview session, generate learning path if needed.
    """
    from .db import InterviewSession
    
    # Verify session belongs to current user
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.applicant_id == applicant.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    
    interview_service = InterviewService(db)
    
    try:
        completed_session, learning_path = interview_service.complete_session(
            session_id=session_id,
            generate_learning_path=complete_data.generate_learning_path
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error completing session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to complete session: {str(e)}")
    
    # Check if retake needed (score > 6 months old)
    should_retake = False
    overall_score = getattr(completed_session, 'overall_score', 0.0)
    
    # Build response
    session_response = {
        "id": completed_session.id,
        "applicant_id": getattr(completed_session, 'applicant_id', 0),
        "session_type": getattr(completed_session, 'session_type', ''),
        "difficulty_level": getattr(completed_session, 'difficulty_level', 'medium'),
        "focus_skills": getattr(completed_session, 'focus_skills', None),
        "started_at": getattr(completed_session, 'started_at', dt.datetime.utcnow()),
        "completed_at": getattr(completed_session, 'completed_at', None),
        "duration_seconds": getattr(completed_session, 'duration_seconds', None),
        "status": getattr(completed_session, 'status', 'completed'),
        "overall_score": overall_score,
        "technical_score": getattr(completed_session, 'technical_score', None),
        "communication_score": getattr(completed_session, 'communication_score', None),
        "problem_solving_score": getattr(completed_session, 'problem_solving_score', None),
        "skill_scores": getattr(completed_session, 'skill_scores', None),
        "ai_feedback": getattr(completed_session, 'ai_feedback', None),
        "skill_gap_analysis": getattr(completed_session, 'skill_gap_analysis', None),
        "recommended_resources": getattr(completed_session, 'recommended_resources', None),
        "question_count": None
    }
    
    message = "Interview completed successfully!"
    if overall_score and overall_score < INTERVIEW_CONFIG['MIN_PASSING_SCORE']:
        message += f" Your score is {overall_score:.1f}%. We recommend focusing on the suggested learning resources."
    elif overall_score and overall_score >= 80:
        message += f" Excellent performance with {overall_score:.1f}%!"
    
    return {
        "session": session_response,
        "learning_path_id": learning_path.id if learning_path else None,
        "should_retake": should_retake,
        "message": message
    }


@app.get("/api/interviews/history", response_model=InterviewHistoryResponse)
def get_interview_history(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get interview history for current user.
    """
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    interview_service = InterviewService(db)
    applicant_id_val = getattr(applicant, 'id', 0)
    history = interview_service.get_session_history(applicant_id_val)
    
    # Convert sessions to response format
    sessions_response = []
    for session in history['sessions']:
        sessions_response.append({
            "id": session.id,
            "applicant_id": getattr(session, 'applicant_id', 0),
            "session_type": getattr(session, 'session_type', ''),
            "difficulty_level": getattr(session, 'difficulty_level', 'medium'),
            "focus_skills": getattr(session, 'focus_skills', None),
            "started_at": getattr(session, 'started_at', dt.datetime.utcnow()),
            "completed_at": getattr(session, 'completed_at', None),
            "duration_seconds": getattr(session, 'duration_seconds', None),
            "status": getattr(session, 'status', ''),
            "overall_score": getattr(session, 'overall_score', None),
            "technical_score": getattr(session, 'technical_score', None),
            "communication_score": getattr(session, 'communication_score', None),
            "problem_solving_score": getattr(session, 'problem_solving_score', None),
            "skill_scores": getattr(session, 'skill_scores', None),
            "ai_feedback": getattr(session, 'ai_feedback', None),
            "skill_gap_analysis": getattr(session, 'skill_gap_analysis', None),
            "recommended_resources": getattr(session, 'recommended_resources', None),
            "question_count": None
        })
    
    return {
        "sessions": sessions_response,
        "total_sessions": history['total_sessions'],
        "latest_score": history['latest_score'],
        "average_score": history['average_score'],
        "sessions_today": history['sessions_today'],
        "can_start_new": history['can_start_new'],
        "needs_retake": history['needs_retake']
    }


@app.get("/api/learning-paths/{path_id}")
def get_learning_path_detail(
    path_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific learning path by ID.
    """
    from .db import LearningPath
    
    path = db.query(LearningPath).filter(LearningPath.id == path_id).first()
    
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
        
    # Verify ownership (optional: strict check if user owns the path's applicant)
    # For now assuming if they have ID they can view it, or implement strict ownership check:
    # applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    # if path.applicant_id != applicant.id: raise 403...
    
    return {
        "id": path.id,
        "applicant_id": path.applicant_id,
        "job_id": getattr(path, 'job_id', None),
        "source_session_id": getattr(path, 'source_session_id', None),
        "skill_gaps": getattr(path, 'skill_gaps', []),
        "recommended_courses": getattr(path, 'recommended_courses', None),
        "recommended_projects": getattr(path, 'recommended_projects', None),
        "practice_problems": getattr(path, 'practice_problems', None),
        "topics_outline": getattr(path, 'topics_outline', None),
        "priority_skills": getattr(path, 'priority_skills', None),
        "status": getattr(path, 'status', 'active'),
        "progress_percentage": getattr(path, 'progress_percentage', 0.0),
        "already_exists": False,
        "created_at": getattr(path, 'created_at', dt.datetime.utcnow()),
        "updated_at": getattr(path, 'updated_at', dt.datetime.utcnow())
    }


@app.post("/api/jobs/{job_id}/learning-path", response_model=LearningPathResponse)
def generate_learning_path_from_job(
    job_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a learning path based on a job's requirements vs applicant skills."""
    from .db import Job
    from .db import LearningPath
    from .core.credit_service import CreditService
    from .constants import CREDIT_CONFIG

    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")

    job = db.query(Job).filter(Job.id == job_id, Job.status == 'approved').first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not approved")

    service = InterviewService(db)
    credit_service = CreditService(db)

    existing_path = db.query(LearningPath).filter(
        LearningPath.applicant_id == getattr(applicant, 'id', 0),
        LearningPath.job_id == job_id
    ).order_by(desc(LearningPath.created_at)).first()

    if existing_path and getattr(existing_path, 'status', '') != 'completed':
        return {
            "id": existing_path.id,
            "applicant_id": getattr(existing_path, 'applicant_id', 0),
            "job_id": getattr(existing_path, 'job_id', None),
            "generated_from": getattr(existing_path, 'generated_from', 'job'),
            "source_session_id": getattr(existing_path, 'source_session_id', None),
            "skill_gaps": getattr(existing_path, 'skill_gaps', {}),
            "recommended_courses": getattr(existing_path, 'recommended_courses', None),
            "recommended_projects": getattr(existing_path, 'recommended_projects', None),
            "practice_problems": getattr(existing_path, 'practice_problems', None),
            "topics_outline": getattr(existing_path, 'topics_outline', None),
            "priority_skills": getattr(existing_path, 'priority_skills', None),
            "status": getattr(existing_path, 'status', 'active'),
            "progress_percentage": getattr(existing_path, 'progress_percentage', 0.0),
            "already_exists": True,
            "created_at": getattr(existing_path, 'created_at', dt.datetime.utcnow()),
            "updated_at": getattr(existing_path, 'updated_at', dt.datetime.utcnow())
        }

    # Check credit balance
    cost = CREDIT_CONFIG['LEARNING_PATH_GENERATION_COST']
    can_proceed, message = credit_service.check_and_deduct_credits(
        applicant_id=getattr(applicant, 'id', 0),
        activity_type='learning_path_generation',
        credits_required=cost
    )
    
    if not can_proceed:
        raise HTTPException(status_code=402, detail=message or "Insufficient credits")

    try:
        path = service.create_learning_path_from_job(
            applicant_id=getattr(applicant, 'id', 0),
            job=job
        )
        
        # Record credit transaction
        credit_service.record_transaction(
            applicant_id=getattr(applicant, 'id', 0),
            transaction_type='spend',
            amount=-cost,
            activity_type='learning_path_generation',
            reference_id=getattr(path, 'id', None),
            reference_type='learning_path',
            description=f"Learning path generated for job: {job.title}"
        )
        
    except Exception as e:
        # Refund credits if learning path generation fails
        credit_service.refund_credits(
            applicant_id=getattr(applicant, 'id', 0),
            credits=cost,
            reason=f"Learning path generation failed for job {job_id}"
        )
        logger.error(f"Error generating learning path from job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate learning path")

    return {
        "id": path.id,
        "applicant_id": getattr(path, 'applicant_id', 0),
        "job_id": getattr(path, 'job_id', None),
        "generated_from": getattr(path, 'generated_from', 'manual'),
        "source_session_id": getattr(path, 'source_session_id', None),
        "skill_gaps": getattr(path, 'skill_gaps', {}),
        "recommended_courses": getattr(path, 'recommended_courses', None),
        "recommended_projects": getattr(path, 'recommended_projects', None),
        "practice_problems": getattr(path, 'practice_problems', None),
        "topics_outline": getattr(path, 'topics_outline', None),
        "priority_skills": getattr(path, 'priority_skills', None),
        "status": getattr(path, 'status', 'active'),
        "progress_percentage": getattr(path, 'progress_percentage', 0.0),
        "already_exists": False,
        "created_at": getattr(path, 'created_at', dt.datetime.utcnow()),
        "updated_at": getattr(path, 'updated_at', dt.datetime.utcnow())
    }

@app.get("/api/learning-paths/{applicant_id}", response_model=List[LearningPathResponse])
def get_learning_paths(
    applicant_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get personalized learning paths for an applicant.
    """
    from .db import LearningPath
    
    # Verify access (user can only see their own paths, or admin)
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    applicant_id_val = getattr(applicant, 'id', 0) if applicant else 0
    if not applicant or applicant_id_val != applicant_id:
        if current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="Access denied")
    
    paths = db.query(LearningPath).filter(
        LearningPath.applicant_id == applicant_id
    ).order_by(desc(LearningPath.created_at)).all()
    
    return [
        {
            "id": path.id,
            "applicant_id": getattr(path, 'applicant_id', 0),
            "generated_from": getattr(path, 'generated_from', 'interview'),
            "source_session_id": getattr(path, 'source_session_id', None),
            "skill_gaps": getattr(path, 'skill_gaps', {}),
            "recommended_courses": getattr(path, 'recommended_courses', None),
            "recommended_projects": getattr(path, 'recommended_projects', None),
            "practice_problems": getattr(path, 'practice_problems', None),
            "topics_outline": getattr(path, 'topics_outline', None),
            "priority_skills": getattr(path, 'priority_skills', None),
            "status": getattr(path, 'status', 'active'),
            "progress_percentage": getattr(path, 'progress_percentage', 0.0),
            "created_at": getattr(path, 'created_at', dt.datetime.utcnow()),
            "updated_at": getattr(path, 'updated_at', dt.datetime.utcnow())
        }
        for path in paths
    ]


@app.post("/api/assessments/start", response_model=SkillAssessmentResponse)
def start_skill_assessment(
    assessment_data: SkillAssessmentCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a skill-specific assessment (MCQ quiz).
    """
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    interview_service = InterviewService(db)
    applicant_id_val = getattr(applicant, 'id', 0)
    
    try:
        assessment = interview_service.create_skill_assessment(
            applicant_id=applicant_id_val,
            skill_name=assessment_data.skill_name,
            assessment_type=assessment_data.assessment_type,
            difficulty_level=assessment_data.difficulty_level or "medium"
        )
    except Exception as e:
        logger.error(f"Error creating assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create assessment: {str(e)}")
    
    return {
        "id": assessment.id,
        "applicant_id": getattr(assessment, 'applicant_id', 0),
        "skill_name": getattr(assessment, 'skill_name', ''),
        "assessment_type": getattr(assessment, 'assessment_type', 'mcq'),
        "total_questions": getattr(assessment, 'total_questions', 0),
        "correct_answers": getattr(assessment, 'correct_answers', 0),
        "score_percentage": getattr(assessment, 'score_percentage', 0.0),
        "proficiency": getattr(assessment, 'proficiency', None),
        "time_taken_seconds": getattr(assessment, 'time_taken_seconds', None),
        "skill_breakdown": getattr(assessment, 'skill_breakdown', None),
        "completed_at": getattr(assessment, 'completed_at', dt.datetime.utcnow())
    }


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
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
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
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
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
        transaction = credit_service.add_bonus_credits(
            applicant_id=adjustment.applicant_id,
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
