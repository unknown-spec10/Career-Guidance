from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Body, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from uuid import uuid4
from typing import Optional, List
from collections import defaultdict
from time import time
import os
from .utils import save_upload, sha256_file, sanitize_text, sanitize_dict, validate_email, sanitize_filename
from .config import settings
from .constants import (
    ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_MB,
    API_MESSAGES, RECOMMENDATION_WEIGHTS, DEFAULT_PAGE_SIZE,
    INTERVIEW_CONFIG, INTERVIEW_SCORE_MULTIPLIERS
)
from .schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    JobCreate, JobUpdate, JobResponse,
    JobApplicationCreate, JobApplicationResponse,
    CollegeProgramCreate, CollegeProgramResponse,
    CollegeApplicationCreate, CollegeApplicationResponse,
    ApprovalAction, MarksheetUpload, VerifyCodeRequest, ResendCodeRequest,
    InterviewSessionCreate, InterviewSessionResponse, QuestionResponse,
    AnswerSubmit, AnswerEvaluation, SessionCompleteRequest, SessionCompleteResponse,
    SkillAssessmentCreate, SkillAssessmentResponse, LearningPathResponse,
    InterviewHistoryResponse, CreditAccountResponse, CreditTransactionResponse,
    AdminCreditAdjustment, ProfileResponse, ProfileUpdate
)
from .auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_user_optional, require_role
)
from pathlib import Path
import json
from .resume.parse_service import ResumeParserService
from .interview.interview_service import InterviewService
import pymysql
import logging
from datetime import timedelta
import secrets
import datetime as dt
from sqlalchemy import desc

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiting storage (in-memory, consider Redis for production)
rate_limiting_storage = defaultdict(list)

DEFAULT_SECRET = "change-this-secret-key-in-production-use-openssl-rand-hex-32"

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
    mysql_dsn = settings.MYSQL_DSN
    mysql_host = settings.MYSQL_HOST
    mysql_user = settings.MYSQL_USER
    mysql_db = settings.MYSQL_DB

    if not mysql_host and not mysql_dsn:
        errors.append("MYSQL_HOST is missing (or provide MYSQL_DSN)")
    if not mysql_user and not mysql_dsn:
        errors.append("MYSQL_USER is missing (or provide MYSQL_DSN)")
    if not mysql_db and not mysql_dsn:
        errors.append("MYSQL_DB is missing (or provide MYSQL_DSN)")

    # Critical: JWT Secret Key
    secret = settings.SECRET_KEY or ""
    if secret == DEFAULT_SECRET:
        errors.append("SECRET_KEY equals the sample default; generate a new 64-hex value")
    if len(secret) < 32:
        errors.append("SECRET_KEY must be at least 32 characters long")

    # Important: Gemini API (warn if not set, as it may use mock mode)
    if not settings.GEMINI_API_KEY:
        warnings.append("GEMINI_API_KEY not set - using mock/stub parsing mode")

    # Important: Email configuration (warn if missing)
    if not settings.GMAIL_USER or not settings.GMAIL_APP_PASSWORD:
        warnings.append("GMAIL_USER or GMAIL_APP_PASSWORD not set - email verification disabled")

    # Always print a masked summary for quick diagnosis
    summary_lines = [
        f"MYSQL_DSN:       {'<set>' if mysql_dsn else '<unset>'}",
        f"MYSQL_HOST:      {_mask(env.get('MYSQL_HOST'))}",
        f"MYSQL_PORT:      {_mask(env.get('MYSQL_PORT'))}",
        f"MYSQL_USER:      {_mask(env.get('MYSQL_USER'))}",
        f"MYSQL_DB:        {_mask(env.get('MYSQL_DB'))}",
        f"SECRET_KEY:      length={len(secret) if secret else 0} {_mask(secret)}",
        f"GEMINI_API_KEY:  {'<set>' if env.get('GEMINI_API_KEY') else '<unset>'}",
        f"GMAIL_USER:      {_mask(env.get('GMAIL_USER'))}",
        f"APP_ENV:         {env.get('APP_ENV', 'production')}",
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Frontend dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        # Validate environment variables first
        validate_env()
        
        # Create database if not exists
        conn = pymysql.connect(
            host=settings.MYSQL_HOST or 'localhost',
            port=settings.MYSQL_PORT or 3306,
            user=settings.MYSQL_USER or 'root',
            password=settings.MYSQL_PASSWORD or ''
        )
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {settings.MYSQL_DB or 'resumes'}")
        conn.commit()
        conn.close()
        logger.info(f"✓ Database '{settings.MYSQL_DB}' ready")
        
        # Create tables
        from .db import init_db
        init_db()
        logger.info("✓ Database tables initialized")
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

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
    
    from .db import User, Employer, College
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
    elif user_data.role.value == 'college':
        # Generate slug from name
        slug = user_data.name.lower().replace(' ', '-').replace("'", '')
        college = College(
            user_id=new_user.id,
            name=user_data.name,
            slug=slug,
            is_verified=False
        )
        db.add(college)
    
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
        
        return JSONResponse({
            "status": "ok",
            "applicant_id": applicant_id,
            "db_id": applicant.id,
            "resume_hash": resume_hash
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
async def parse_applicant(applicant_id: str, db: Session = Depends(get_db)):
    from .db import Applicant, LLMParsedRecord
    
    applicant_dir = DATA_ROOT / applicant_id
    if not applicant_dir.exists():
        raise HTTPException(status_code=404, detail="applicant_id not found")
    
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
        
        # Add database ID to result
        result['db_applicant_id'] = applicant.id
        
        # Auto-generate recommendations after successful parse
        try:
            logger.info(f"Auto-generating recommendations for applicant {applicant.id}")
            from .db import CollegeEligibility, CollegeApplicabilityLog, JobRecommendation, Job, Employer, SkillAssessment, InterviewSession, CollegeProgram
            import re
            import datetime as dt
            
            # Get parsed data
            normalized = result.get('normalized', {})
            education = normalized.get('education', [])
            skills = normalized.get('skills', [])
            jee_rank = normalized.get('jee_rank')
            
            # Calculate applicant CGPA (use first education entry)
            applicant_cgpa = None
            if education and len(education) > 0:
                first_edu = education[0]
                if isinstance(first_edu, dict) and 'grade' in first_edu:
                    applicant_cgpa = first_edu.get('grade')
            
            # Use user-provided JEE rank if available
            metadata_path = applicant_dir / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    meta = json.load(f)
                    if meta.get('jee_rank_user_provided') and meta.get('jee_rank'):
                        jee_rank = meta['jee_rank']
                        logger.info(f"Using user-provided JEE rank: {jee_rank}")
            
            # Clear existing recommendations
            db.query(CollegeApplicabilityLog).filter(CollegeApplicabilityLog.applicant_id == applicant.id).delete()
            db.query(JobRecommendation).filter(JobRecommendation.applicant_id == applicant.id).delete()
            
            # Get interview bonus if available
            interview_bonus = 0.0
            latest_interview = db.query(InterviewSession).filter(
                InterviewSession.applicant_id == applicant.id,
                InterviewSession.status == 'completed',
                InterviewSession.overall_score.isnot(None)
            ).order_by(desc(InterviewSession.completed_at)).first()
            
            if latest_interview:
                completed_at = getattr(latest_interview, 'completed_at', None)
                if completed_at:
                    months_old = (dt.datetime.utcnow() - completed_at).days / 30
                    if months_old < INTERVIEW_CONFIG['SCORE_FRESHNESS_MONTHS']:
                        overall_score = getattr(latest_interview, 'overall_score', 0.0) or 0.0
                        if overall_score >= 80:
                            interview_bonus = RECOMMENDATION_WEIGHTS['INTERVIEW_SCORE'] * 1.5
                        elif overall_score >= 60:
                            interview_bonus = RECOMMENDATION_WEIGHTS['INTERVIEW_SCORE']
                        elif overall_score >= 40:
                            interview_bonus = RECOMMENDATION_WEIGHTS['INTERVIEW_SCORE'] * 0.5
            
            # Get assessment bonus if available
            assessment_bonus = 0.0
            skill_assessments = db.query(SkillAssessment).filter(
                SkillAssessment.applicant_id == applicant.id,
                SkillAssessment.score_percentage >= 70
            ).all()
            if skill_assessments:
                verified_skills_count = len(skill_assessments)
                assessment_bonus = min(RECOMMENDATION_WEIGHTS['ASSESSMENT_SCORE'], verified_skills_count * 2)
            
            # Generate college recommendations
            colleges = db.query(College, CollegeEligibility).outerjoin(
                CollegeEligibility, College.id == CollegeEligibility.college_id
            ).filter(
                (CollegeEligibility.min_cgpa.is_(None)) | (CollegeEligibility.min_cgpa <= applicant_cgpa if applicant_cgpa else True),
                (CollegeEligibility.min_jee_rank.is_(None)) | (CollegeEligibility.min_jee_rank >= jee_rank if jee_rank else True)
            ).all()
            
            college_count = 0
            for college, eligibility in colleges:
                if not eligibility:
                    continue
                
                score = 0.0
                explain_parts = []
                
                # JEE rank scoring
                if eligibility.min_jee_rank and jee_rank:
                    if jee_rank <= eligibility.min_jee_rank:
                        score += RECOMMENDATION_WEIGHTS['JEE_RANK_SCORE']
                        explain_parts.append(f"JEE rank {jee_rank} meets cutoff {eligibility.min_jee_rank}")
                    else:
                        continue
                
                # CGPA scoring
                if eligibility.min_cgpa and applicant_cgpa:
                    if applicant_cgpa >= eligibility.min_cgpa:
                        score += RECOMMENDATION_WEIGHTS['CGPA_SCORE']
                        explain_parts.append(f"CGPA {applicant_cgpa} meets minimum {eligibility.min_cgpa}")
                    else:
                        continue
                
                # Skills matching
                programs = db.query(CollegeProgram).filter(
                    CollegeProgram.college_id == college.id,
                    CollegeProgram.status == 'approved'
                ).all()
                
                if programs and skills:
                    skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills]
                    matched_skills = set()
                    
                    for program in programs:
                        prog_skills = getattr(program, 'required_skills', None)
                        if prog_skills is not None:
                            for req_skill in prog_skills:
                                req_name = req_skill if isinstance(req_skill, str) else req_skill.get('name', '') if isinstance(req_skill, dict) else ''
                                if len(req_name) == 0:
                                    continue
                                
                                if len(req_name) >= 3:
                                    pattern = r'\b' + re.escape(req_name.lower()) + r'\b'
                                    for sn in skill_names:
                                        if re.search(pattern, sn.lower()):
                                            matched_skills.add(req_name)
                                            break
                                else:
                                    if any(req_name.lower() == sn.lower() for sn in skill_names):
                                        matched_skills.add(req_name)
                    
                    if matched_skills:
                        skill_score = min(RECOMMENDATION_WEIGHTS['SKILLS_SCORE'], len(matched_skills) * 5)
                        score += skill_score
                        explain_parts.append(f"{len(matched_skills)} skill(s) matched")
                
                # Add bonuses
                if interview_bonus > 0:
                    college_interview_bonus = interview_bonus * 0.5
                    score += college_interview_bonus
                    explain_parts.append(f"Interview bonus: +{college_interview_bonus:.1f}")
                
                if assessment_bonus > 0:
                    score += assessment_bonus
                    explain_parts.append(f"Verified skills bonus: +{assessment_bonus:.1f}")
                
                if score > 0:
                    rec = CollegeApplicabilityLog(
                        applicant_id=applicant.id,
                        college_id=college.id,
                        recommend_score=score,
                        explain={"reasons": explain_parts, "auto_generated": True},
                        status='recommended'
                    )
                    db.add(rec)
                    college_count += 1
            
            # Generate job recommendations
            jobs = db.query(Job).filter(Job.status == 'approved').all()
            job_count = 0
            
            for job in jobs:
                score = 0.0
                explain_parts = []
                
                # CGPA requirement
                job_min_cgpa = getattr(job, 'min_cgpa', None)
                if job_min_cgpa is not None and applicant_cgpa is not None:
                    if applicant_cgpa >= job_min_cgpa:
                        score += RECOMMENDATION_WEIGHTS['ACADEMIC_SCORE']
                        explain_parts.append(f"CGPA {applicant_cgpa} meets requirement {job_min_cgpa}")
                    else:
                        continue
                else:
                    score += RECOMMENDATION_WEIGHTS['ACADEMIC_SCORE'] * 0.5
                
                # Skills matching
                job_req_skills = getattr(job, 'required_skills', None)
                if job_req_skills is not None and skills:
                    skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills]
                    required = job_req_skills if isinstance(job_req_skills, list) else []
                    matched_skills = set()
                    
                    for req_skill in required:
                        req_name = req_skill.get('name', '') if isinstance(req_skill, dict) else str(req_skill)
                        if len(str(req_name)) == 0:
                            continue
                        
                        if len(req_name) >= 3:
                            pattern = r'\b' + re.escape(req_name.lower()) + r'\b'
                            for sn in skill_names:
                                if re.search(pattern, sn.lower()):
                                    matched_skills.add(req_name)
                                    break
                        else:
                            if any(req_name.lower() == sn.lower() for sn in skill_names):
                                matched_skills.add(req_name)
                    
                    if matched_skills:
                        skill_score = (len(matched_skills) / max(len(required), 1)) * 50
                        score += skill_score
                        explain_parts.append(f"{len(matched_skills)} skill(s) matched: {', '.join(list(matched_skills)[:2])}")
                
                # Experience requirement (basic check)
                min_exp = getattr(job, 'min_experience_years', None)
                if min_exp is not None and min_exp > 0:
                    score += 5  # Small bonus if no specific requirement
                
                # Add bonuses
                if interview_bonus > 0:
                    score += interview_bonus
                    explain_parts.append(f"Interview bonus: +{interview_bonus:.1f}")
                
                if assessment_bonus > 0:
                    score += assessment_bonus
                    explain_parts.append(f"Verified skills bonus: +{assessment_bonus:.1f}")
                
                if score > 0:
                    rec = JobRecommendation(
                        applicant_id=applicant.id,
                        job_id=job.id,
                        score=score,
                        scoring_breakdown={"interview_bonus": interview_bonus, "assessment_bonus": assessment_bonus},
                        explain={"reasons": explain_parts, "auto_generated": True},
                        status='recommended'
                    )
                    db.add(rec)
                    job_count += 1
            
            db.commit()
            result['auto_recommendations_generated'] = f"{college_count} colleges, {job_count} jobs"
            logger.info(f"✓ Auto-generated {college_count} college and {job_count} job recommendations")
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to auto-generate recommendations: {e}")
            import traceback
            logger.warning(traceback.format_exc())
            result['auto_recommendations_error'] = str(e)
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save parsed data to database: {e}")
        result['database_error'] = str(e)
    
    return JSONResponse(result)


# New endpoints for comprehensive features
from .db import SessionLocal, Applicant, LLMParsedRecord, College, CollegeApplicabilityLog, Job, JobRecommendation, CollegeProgram, Employer

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

VALID_COLLEGE_STATUS_TRANSITIONS = {
    'recommended': ['applied', 'withdrawn'],
    'applied': ['accepted', 'rejected', 'withdrawn'],
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


# ============================================================
# COLLEGE PROGRAM POSTING ENDPOINTS
# ============================================================

@app.post("/api/college/programs", response_model=CollegeProgramResponse)
async def create_college_program(
    program_data: CollegeProgramCreate,
    current_user = Depends(require_role("college")),
    db: Session = Depends(get_db)
):
    """College creates a program (pending approval)"""
    from .db import College, CollegeProgram
    
    # Get college profile
    college = db.query(College).filter(College.user_id == current_user.id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College profile not found")
    
    # Sanitize text inputs
    program_name = sanitize_text(program_data.program_name, max_length=200)
    program_description = sanitize_text(program_data.program_description or "", max_length=5000)
    
    # Create program
    program = CollegeProgram(
        college_id=college.id,
        program_name=program_name,
        duration_months=program_data.duration_months,
        required_skills=program_data.required_skills,
        program_description=program_description,
        status='pending'
    )
    db.add(program)
    db.commit()
    db.refresh(program)
    
    logger.info(f"Program created by college {college.name}: {program.program_name} (ID: {program.id})")
    return program


@app.get("/api/college/profile")
async def get_college_profile(
    current_user = Depends(require_role("college")),
    db: Session = Depends(get_db)
):
    """Get college profile information"""
    from .db import College
    
    college = db.query(College).filter(College.user_id == current_user.id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College profile not found")
    
    return college


@app.patch("/api/college/profile")
async def update_college_profile(
    name: str = Body(...),
    description: str = Body(None),
    website: str = Body(None),
    location_city: str = Body(None),
    location_state: str = Body(None),
    contact_phone: str = Body(None),
    contact_email: str = Body(None),
    current_user = Depends(require_role("college")),
    db: Session = Depends(get_db)
):
    """Update college profile information"""
    from .db import College
    
    college = db.query(College).filter(College.user_id == current_user.id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College profile not found")
    
    setattr(college, 'name', name)
    if description is not None:
        setattr(college, 'description', description)
    if website is not None:
        setattr(college, 'website', website)
    if location_city is not None:
        setattr(college, 'location_city', location_city)
    if location_state is not None:
        setattr(college, 'location_state', location_state)
    if contact_phone is not None:
        setattr(college, 'contact_phone', contact_phone)
    if contact_email is not None:
        setattr(college, 'contact_email', contact_email)
    
    db.commit()
    db.refresh(college)
    
    return {"status": "success", "message": "Profile updated successfully"}


@app.get("/api/college/programs")
async def get_college_programs(
    current_user = Depends(require_role("college")),
    db: Session = Depends(get_db)
):
    """Get all programs posted by current college"""
    from .db import College, CollegeProgram
    
    college = db.query(College).filter(College.user_id == current_user.id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College profile not found")
    
    programs = db.query(CollegeProgram).filter(CollegeProgram.college_id == college.id).all()
    return {"programs": programs, "total": len(programs)}


@app.get("/api/college/applications")
async def get_college_applications(
    current_user = Depends(require_role("college")),
    db: Session = Depends(get_db)
):
    """Get all applications to current college"""
    from .db import College, CollegeApplication, Applicant
    
    college = db.query(College).filter(College.user_id == current_user.id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College profile not found")
    
    # Get applications
    applications = db.query(CollegeApplication, Applicant).join(
        Applicant, CollegeApplication.applicant_id == Applicant.id
    ).filter(CollegeApplication.college_id == college.id).all()
    
    result = []
    for app, applicant in applications:
        result.append({
            "application_id": app.id,
            "applicant_id": applicant.id,
            "applicant_name": applicant.display_name,
            "program_id": app.program_id,
            "status": app.status,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None,
            "twelfth_percentage": float(app.twelfth_percentage) if app.twelfth_percentage else None,  # type: ignore
            "twelfth_board": app.twelfth_board,
            "statement_of_purpose": app.statement_of_purpose
        })
    
    return {"applications": result, "total": len(result)}


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


@app.post("/api/colleges/{college_id}/apply", response_model=CollegeApplicationResponse)
async def apply_to_college(
    college_id: int,
    application_data: CollegeApplicationCreate,
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Student applies to a college"""
    from .db import College, CollegeApplication, Applicant
    
    # Verify college exists
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    
    # Get student's applicant profile
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=400, detail="Please upload your documents first")
    
    # Check if already applied to this program
    existing = db.query(CollegeApplication).filter(
        CollegeApplication.applicant_id == applicant.id,
        CollegeApplication.college_id == college_id,
        CollegeApplication.program_id == application_data.program_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied to this program")
    
    # Create application
    application = CollegeApplication(
        applicant_id=applicant.id,
        college_id=college_id,
        program_id=application_data.program_id,
        statement_of_purpose=application_data.statement_of_purpose,
        twelfth_percentage=application_data.twelfth_percentage,
        twelfth_board=application_data.twelfth_board,
        twelfth_subjects=application_data.twelfth_subjects,
        status='applied'
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    
    logger.info(f"Student {applicant.display_name} applied to college {college.name}")
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


@app.get("/api/student/applications/colleges")
async def get_student_college_applications(
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Get all college applications by current student"""
    from .db import CollegeApplication, College, Applicant
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        return {"applications": [], "total": 0}
    
    applications = db.query(CollegeApplication, College).join(
        College, CollegeApplication.college_id == College.id
    ).filter(CollegeApplication.applicant_id == applicant.id).all()
    
    result = []
    for app, college in applications:
        applied_at_val = app.applied_at if hasattr(app, 'applied_at') else None
        if isinstance(applied_at_val, (dt.datetime, dt.date)):
            applied_at_ser = applied_at_val.isoformat()
        elif applied_at_val is not None:
            applied_at_ser = str(applied_at_val)
        else:
            applied_at_ser = None
        result.append({
            "application_id": app.id,
            "college_id": college.id,
            "college_name": college.name,
            "program_id": app.program_id,
            "status": app.status,
            "applied_at": applied_at_ser
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


@app.patch("/api/admin/programs/{program_id}/review")
async def review_college_program(
    program_id: int,
    action: ApprovalAction,
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Admin approves or rejects a college program"""
    from .db import CollegeProgram, AuditLog
    
    program = db.query(CollegeProgram).filter(CollegeProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    old_status = program.status
    if action.action == "approve":
        program.status = 'approved'  # type: ignore
        program.reviewed_by = current_user.id  # type: ignore
        program.reviewed_at = dt.datetime.utcnow()  # type: ignore
    elif action.action == "reject":
        program.status = 'rejected'  # type: ignore
        program.rejection_reason = action.reason  # type: ignore
        program.reviewed_by = current_user.id  # type: ignore
        program.reviewed_at = dt.datetime.utcnow()  # type: ignore
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    # Commit and ensure SQLAlchemy session state is refreshed so subsequent reads reflect the update
    db.commit()
    try:
        db.refresh(program)
    except Exception:
        # If refresh fails for any reason, continue — the transaction is committed
        pass
    try:
        # expire_all forces SQLAlchemy to reload state on next access
        db.expire_all()
    except Exception:
        pass
    
    # Audit log
    try:
        audit = AuditLog(
            action=f"program_{action.action}",
            target_type="CollegeProgram",
            target_id=program_id,
            user_id=current_user.id,
            details={"old_status": old_status, "new_status": program.status, "reason": action.reason}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")

    logger.info(
        f"Program {getattr(program, 'program_name', None)} (id={getattr(program,'id',None)}) "
        f"{action.action}ed by admin {getattr(current_user, 'name', None)}; new status={getattr(program,'status',None)}"
    )

    return {"status": "success", "program_status": program.status}


@app.get("/api/admin/pending-reviews")
async def get_pending_reviews(
    current_user = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    """Get all pending jobs and programs for review"""
    from .db import Job, CollegeProgram, Employer, College
    
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
    
    # Get pending programs
    pending_programs = db.query(CollegeProgram, College).join(
        College, CollegeProgram.college_id == College.id
    ).filter(CollegeProgram.status == 'pending').all()
    
    programs_list = []
    for program, college in pending_programs:
        programs_list.append({
            "id": program.id,
            "program_name": program.program_name,
            "college": college.name,
            "created_at": program.created_at.isoformat() if program.created_at else None,
            "status": getattr(program, 'status', None),
            "rejection_reason": getattr(program, 'rejection_reason', None),
            "reviewed_by": getattr(program, 'reviewed_by', None)
        })
    
    return {
        "pending_jobs": jobs_list,
        "pending_programs": programs_list,
        "total_pending": len(jobs_list) + len(programs_list)
    }


@app.get("/api/colleges")
async def get_colleges(
    skip: int = 0,
    limit: int = 20,
    cursor: Optional[int] = None,
    q: Optional[str] = None,
    location: Optional[str] = None,
    min_jee_rank: Optional[str] = None,
    min_cgpa: Optional[str] = None,
    programs_min: Optional[str] = None,
    sort: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all colleges with eligibility info. Supports cursor-based pagination."""
    from .db import CollegeEligibility, CollegeMetadata
    
    # Fetch all data in batch queries to avoid N+1
    base_query = db.query(College)
    if q:
        like = f"%{q}%"
        base_query = base_query.filter(College.name.ilike(like))
    if location:
        like_loc = f"%{location}%"
        base_query = base_query.filter(
            (College.location_city.ilike(like_loc)) | (College.location_state.ilike(like_loc))
        )
    
    # Apply cursor for pagination
    if cursor is not None:
        base_query = base_query.filter(College.id > cursor)

    # Pre-calc program counts for filtering by programs_min later
    colleges_all = base_query.all()
    college_ids_all = [c.id for c in colleges_all]
    program_counts_all = {getattr(row[0], 'value', row[0]): int(row[1]) for row in db.query(CollegeProgram.college_id, func.count(CollegeProgram.id)).filter(CollegeProgram.college_id.in_(college_ids_all)).group_by(CollegeProgram.college_id).all()}  # type: ignore

    # Eligibility filters (min_jee_rank, min_cgpa) need CollegeEligibility
    from .db import CollegeEligibility, CollegeMetadata
    elig_map = {getattr(e, 'college_id'): e for e in db.query(CollegeEligibility).filter(CollegeEligibility.college_id.in_(college_ids_all)).all()}
    meta_map = {getattr(m, 'college_id'): m for m in db.query(CollegeMetadata).filter(CollegeMetadata.college_id.in_(college_ids_all)).all()}

    # Normalize numeric query params (treat empty string as None)
    try:
        min_jee_rank_val = int(min_jee_rank) if (min_jee_rank is not None and str(min_jee_rank).strip() != "") else None
    except ValueError:
        min_jee_rank_val = None
    try:
        min_cgpa_val = float(min_cgpa) if (min_cgpa is not None and str(min_cgpa).strip() != "") else None
    except ValueError:
        min_cgpa_val = None
    try:
        programs_min_val = int(programs_min) if (programs_min is not None and str(programs_min).strip() != "") else None
    except ValueError:
        programs_min_val = None

    # Apply server-side filtering using computed maps
    filtered_ids: List[int] = []
    for c in colleges_all:
        cid = getattr(c, 'id')
        e = elig_map.get(cid)
        if min_jee_rank_val is not None:
            # include if college cutoff is None or >= provided rank
            if (e is not None) and (getattr(e, 'min_jee_rank', None) is not None) and (int(getattr(e, 'min_jee_rank')) < int(min_jee_rank_val)):
                continue
        if min_cgpa_val is not None:
            ecg = getattr(e, 'min_cgpa', None) if e is not None else None
            if (ecg is not None) and (float(ecg) > float(min_cgpa_val)):
                continue
        if programs_min_val is not None:
            if program_counts_all.get(cid, 0) < int(programs_min_val):
                continue
        filtered_ids.append(cid)

    # Sorting
    sort_key = (sort or "popular").lower()
    name_map = {getattr(x, 'id'): (getattr(x, 'name') or '') for x in colleges_all}
    def sort_value(cid: int):
        if sort_key == "name":
            name = name_map.get(cid, "")
            return (name or "").lower()
        # default popularity
        m = meta_map.get(cid)
        pop = getattr(m, 'popularity_score', None) if m is not None else None
        return float(pop) if pop is not None else 0.0

    sorted_ids = sorted(filtered_ids, key=sort_value, reverse=(sort_key == "popular"))
    total = len(sorted_ids)
    ids_page = sorted_ids[skip:skip+limit]
    colleges = [c for c in colleges_all if c.id in ids_page]
    
    college_ids = [c.id for c in colleges]
    eligibilities = {cid: elig_map.get(cid) for cid in college_ids}
    metadatas = {cid: meta_map.get(cid) for cid in college_ids}
    program_counts = {cid: program_counts_all.get(cid, 0) for cid in college_ids}
    
    result = []
    for college in colleges:
        eligibility = eligibilities.get(college.id)
        metadata = metadatas.get(college.id)
        
        result.append({
            "id": college.id,
            "name": college.name,
            "slug": college.slug,
            "location_city": college.location_city,
            "location_state": college.location_state,
            "country": college.country,
            "description": college.description,
            "website": college.website,
            "min_jee_rank": eligibility.min_jee_rank if eligibility else None,
            "min_cgpa": float(eligibility.min_cgpa) if eligibility and eligibility.min_cgpa is not None else None,  # type: ignore
            "seats": eligibility.seats if eligibility else None,
            "programs_count": program_counts.get(college.id, 0) if hasattr(college, 'id') else 0,  # type: ignore
            "popularity_score": float(metadata.popularity_score) if metadata and metadata.popularity_score is not None else 0.0  # type: ignore
        })
    
    next_cursor = result[-1]["id"] if result and cursor is not None else None
    return {
        "colleges": result,
        "total": total if cursor is None else None,
        "next_cursor": next_cursor
    }


@app.get("/api/college/{college_id}")
async def get_college_details(college_id: int, db: Session = Depends(get_db)):
    """Get detailed college information"""
    from .db import CollegeEligibility, CollegeMetadata
    
    college = db.query(College).filter(College.id == college_id).first()
    if not college:
        raise HTTPException(status_code=404, detail=API_MESSAGES['COLLEGE_NOT_FOUND'])
    
    eligibility = db.query(CollegeEligibility).filter(CollegeEligibility.college_id == college_id).first()
    metadata = db.query(CollegeMetadata).filter(CollegeMetadata.college_id == college_id).first()
    programs = db.query(CollegeProgram).filter(CollegeProgram.college_id == college_id).all()
    
    return {
        "college": {
            "id": college.id,
            "name": college.name,
            "slug": college.slug,
            "location_city": college.location_city,
            "location_state": college.location_state,
            "country": college.country,
            "description": college.description,
            "website": college.website
        },
        "eligibility": {
            "min_jee_rank": eligibility.min_jee_rank if eligibility else None,
            "min_cgpa": float(eligibility.min_cgpa) if eligibility and eligibility.min_cgpa is not None else None,  # type: ignore
            "eligible_degrees": eligibility.eligible_degrees if eligibility else [],
            "seats": eligibility.seats if eligibility else None
        } if eligibility else None,
        "programs": [
            {
                "id": p.id,
                "program_name": p.program_name,
                "duration_months": p.duration_months,
                "required_skills": p.required_skills,
                "description": p.program_description
            } for p in programs
        ],
        "metadata": {
            "canonical_skills": metadata.canonical_skills if metadata else [],
            "popularity_score": float(metadata.popularity_score) if metadata and metadata.popularity_score is not None else 0.0  # type: ignore
        } if metadata else None
    }


@app.get("/api/jobs")
async def get_jobs(
    skip: int = 0,
    limit: int = 20,
    cursor: Optional[int] = None,
    location: Optional[str] = None,
    work_type: Optional[str] = None,
    q: Optional[str] = None,
    skills: Optional[str] = None,
    min_popularity: Optional[str] = None,
    sort: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all APPROVED jobs with filters, excluding expired jobs. Supports cursor-based pagination."""
    from datetime import datetime
    from .db import JobMetadata
    
    # Only show approved jobs to public
    now = datetime.utcnow()
    query = db.query(Job).filter(
        Job.status == 'approved',
        (Job.expires_at.is_(None)) | (Job.expires_at > now)
    )
    
    if location:
        query = query.filter(Job.location_city.ilike(f"%{location}%"))
    if work_type:
        query = query.filter(Job.work_type == work_type)
    if q:
        like = f"%{q}%"
        query = query.filter((Job.title.ilike(like)) | (Job.description.ilike(like)))
    
    # Apply cursor or offset
    if cursor is not None:
        query = query.filter(Job.id < cursor)
    else:
        query = query.offset(skip)
    
    jobs = query.limit(limit + 1).all()  # Fetch one extra to check if there's more
    has_more = len(jobs) > limit
    if has_more:
        jobs = jobs[:limit]
    
    total = None if cursor is not None else query.count()
    
    # Batch fetch employers and metadata
    job_ids = [j.id for j in jobs]
    employer_ids = list(set([j.employer_id for j in jobs]))
    employers = {e.id: e for e in db.query(Employer).filter(Employer.id.in_(employer_ids)).all()}
    metadatas = {m.job_id: m for m in db.query(JobMetadata).filter(JobMetadata.job_id.in_(job_ids)).all()}

    # Filter by skills and min_popularity using loaded metadata and job fields
    skills_list = []
    if skills:
        skills_list = [s.strip().lower() for s in skills.split(',') if s.strip()]
    try:
        min_popularity_val = float(min_popularity) if (min_popularity is not None and str(min_popularity).strip() != "") else None
    except ValueError:
        min_popularity_val = None
    def job_matches(j):
        if min_popularity_val is not None:
            md = metadatas.get(j.id)
            pop_val = getattr(md, 'popularity', None) if md is not None else None
            pop = float(pop_val) if pop_val is not None else 0.0
            if pop < float(min_popularity_val):
                return False
        if skills_list:
            req = j.required_skills if isinstance(j.required_skills, list) else []
            req_names = [(x.get('name', '') if isinstance(x, dict) else str(x)).lower() for x in req]
            # require that each provided skill has a match in required
            for s in skills_list:
                if not any(s in rn for rn in req_names):
                    return False
        return True

    jobs = [j for j in jobs if job_matches(j)]
    total = len(jobs)

    # Sorting
    sort_key = (sort or "popular").lower()
    def sort_val(j):
        if sort_key == "recent":
            ca = getattr(j, 'created_at', None)
            return ca or dt.datetime.min
        if sort_key == "title":
            return (j.title or "").lower()
        md = metadatas.get(j.id)
        pop_val = getattr(md, 'popularity', None) if md is not None else None
        return float(pop_val) if pop_val is not None else 0.0
    reverse = sort_key in ("popular", "recent")
    jobs = sorted(jobs, key=sort_val, reverse=reverse)
    jobs = jobs[0:limit] if skip == 0 else jobs[skip:skip+limit]
    
    result = []
    for job in jobs:
        employer = employers.get(job.employer_id)
        metadata = metadatas.get(job.id)
        
        result.append({
            "id": job.id,
            "title": job.title,
            "company": employer.company_name if employer else "Unknown",
            "location_city": job.location_city,
            "work_type": job.work_type,
            "min_experience_years": float(job.min_experience_years) if job.min_experience_years is not None else 0.0,  # type: ignore
            "min_cgpa": float(job.min_cgpa) if job.min_cgpa is not None else None,  # type: ignore
            "required_skills": job.required_skills,
            "optional_skills": job.optional_skills,
            "expires_at": job.expires_at.isoformat() if job.expires_at is not None else None,
            "tags": metadata.tags if metadata else [],
            "popularity": float(metadata.popularity) if metadata and metadata.popularity is not None else 0.0  # type: ignore
        })
    
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
    """Get college and job recommendations for an applicant.

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

    # College recommendations
    college_recs = db.query(CollegeApplicabilityLog, College).join(
        College, CollegeApplicabilityLog.college_id == College.id
    ).filter(CollegeApplicabilityLog.applicant_id == resolved_id).order_by(
        desc(CollegeApplicabilityLog.recommend_score)
    ).all()
    
    # Job recommendations
    job_recs = db.query(JobRecommendation, Job, Employer).join(
        Job, JobRecommendation.job_id == Job.id
    ).join(
        Employer, Job.employer_id == Employer.id
    ).filter(JobRecommendation.applicant_id == resolved_id).order_by(
        desc(JobRecommendation.score)
    ).all()
    
    return {
        "college_recommendations": [
            {
                "id": log.id,
                "college": {
                    "id": college.id,
                    "name": college.name,
                    "location_city": college.location_city,
                    "location_state": college.location_state,
                    "website": college.website
                },
                "recommend_score": float(log.recommend_score) if log.recommend_score else 0,
                "explain": log.explain,
                "status": log.status
            } for log, college in college_recs
        ],
        "job_recommendations": [
            {
                "id": rec.id,
                "job": {
                    "id": job.id,
                    "title": job.title,
                    "company": employer.company_name,
                    "location_city": job.location_city,
                    "work_type": job.work_type
                },
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
        "total_colleges": db.query(College).count(),
        "total_jobs": db.query(Job).count(),
        "total_college_recommendations": db.query(CollegeApplicabilityLog).count(),
        "total_job_recommendations": db.query(JobRecommendation).count(),
        "applicants_needing_review": db.query(LLMParsedRecord).filter(
            LLMParsedRecord.needs_review == True
        ).count()
    }
    
    # Average match scores
    college_avg = db.query(func.avg(CollegeApplicabilityLog.recommend_score)).scalar()
    job_avg = db.query(func.avg(JobRecommendation.score)).scalar()
    
    avg_college = float(college_avg) if college_avg is not None else 0.0
    avg_job = float(job_avg) if job_avg is not None else 0.0
    
    return {
        **stats,
        "avg_college_match": avg_college,
        "avg_job_match": avg_job
    }


@app.patch("/api/college-recommendation/{rec_id}/status")
def update_college_recommendation_status(
    rec_id: int,
    status: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update the status of a college recommendation"""
    from .db import CollegeApplicabilityLog, AuditLog
    from .constants import API_MESSAGES
    
    valid_statuses = ['recommended', 'applied', 'accepted', 'rejected', 'withdrawn']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    rec = db.query(CollegeApplicabilityLog).filter(CollegeApplicabilityLog.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail=API_MESSAGES["applicant_not_found"])
    
    # Validate status transition
    current_status = str(rec.status) if rec.status is not None else 'recommended'
    allowed_transitions = VALID_COLLEGE_STATUS_TRANSITIONS.get(current_status, [])
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
            action="college_recommendation_status_update",
            target_type="CollegeRecommendation",
            target_id=rec_id,
            user_id=current_user.id,
            details={"old_status": old_status, "new_status": status}
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")
    
    return {"id": rec.id, "status": rec.status, "message": "Status updated successfully"}


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
    """Generate or refresh college and job recommendations for an applicant.
    
    This endpoint analyzes the applicant's parsed resume data and generates recommendations
    based on their skills, CGPA, JEE rank, and other qualifications.
    
    - Removes old recommendations and generates fresh ones
    - Uses RECOMMENDATION_WEIGHTS from constants for scoring
    - Applies word-boundary skill matching
    - Filters by eligibility criteria
    """
    from .db import CollegeEligibility, CollegeProgram
    import re
    
    # Check if applicant exists
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail=API_MESSAGES['APPLICANT_NOT_FOUND'])
    
    # Get parsed data
    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if not llm_record:
        raise HTTPException(status_code=400, detail=API_MESSAGES['NO_PARSED_DATA'])
    
    parsed_data = llm_record.normalized
    education = parsed_data.get('education', [])
    skills = parsed_data.get('skills', [])
    jee_rank = parsed_data.get('jee_rank')
    
    # Calculate applicant CGPA (use first education entry)
    applicant_cgpa = None
    if education and len(education) > 0:
        first_edu = education[0]
        if isinstance(first_edu, dict) and 'grade' in first_edu:
            applicant_cgpa = first_edu.get('grade')
    
    logger.info(f"Generating recommendations for applicant {applicant_id} (CGPA: {applicant_cgpa}, JEE: {jee_rank}, Skills: {len(skills)})")
    
    # Get latest interview score for bonus/penalty
    from .db import InterviewSession, SkillAssessment
    
    interview_bonus = 0.0
    interview_multiplier_key = None
    latest_interview = db.query(InterviewSession).filter(
        InterviewSession.applicant_id == applicant_id,
        InterviewSession.status == 'completed',
        InterviewSession.overall_score.isnot(None)
    ).order_by(desc(InterviewSession.completed_at)).first()
    
    if latest_interview:
        completed_at = getattr(latest_interview, 'completed_at', None)
        if completed_at:
            months_old = (dt.datetime.utcnow() - completed_at).days / 30
            
            # Only use score if < 6 months old
            if months_old < INTERVIEW_CONFIG['SCORE_FRESHNESS_MONTHS']:
                overall_score = getattr(latest_interview, 'overall_score', 0.0) or 0.0
                
                if overall_score >= 80:
                    interview_multiplier_key = 'excellent'
                    interview_bonus = RECOMMENDATION_WEIGHTS['INTERVIEW_SCORE'] * INTERVIEW_SCORE_MULTIPLIERS['excellent']
                elif overall_score >= 60:
                    interview_multiplier_key = 'good'
                    interview_bonus = RECOMMENDATION_WEIGHTS['INTERVIEW_SCORE'] * INTERVIEW_SCORE_MULTIPLIERS['good']
                elif overall_score >= 40:
                    interview_multiplier_key = 'average'
                    interview_bonus = RECOMMENDATION_WEIGHTS['INTERVIEW_SCORE'] * INTERVIEW_SCORE_MULTIPLIERS['average']
                else:
                    interview_multiplier_key = 'poor'
                    interview_bonus = RECOMMENDATION_WEIGHTS['INTERVIEW_SCORE'] * INTERVIEW_SCORE_MULTIPLIERS['poor']
                
                logger.info(f"Interview bonus for applicant {applicant_id}: {interview_bonus} ({interview_multiplier_key}, score: {overall_score})")
    
    # Get skill assessment bonus
    assessment_bonus = 0.0
    skill_assessments = db.query(SkillAssessment).filter(
        SkillAssessment.applicant_id == applicant_id,
        SkillAssessment.score_percentage >= 70  # Only count assessments with >= 70%
    ).all()
    
    if skill_assessments:
        # Award bonus based on number of verified skills
        verified_skills_count = len(skill_assessments)
        assessment_bonus = min(RECOMMENDATION_WEIGHTS['ASSESSMENT_SCORE'], verified_skills_count * 2)  # 2 points per verified skill, max 10
        logger.info(f"Assessment bonus for applicant {applicant_id}: {assessment_bonus} ({verified_skills_count} verified skills)")
    
    # Remove old recommendations
    db.query(CollegeApplicabilityLog).filter(CollegeApplicabilityLog.applicant_id == applicant_id).delete()
    db.query(JobRecommendation).filter(JobRecommendation.applicant_id == applicant_id).delete()
    db.commit()
    
    # Pre-filter colleges by eligibility
    colleges = db.query(College, CollegeEligibility).outerjoin(
        CollegeEligibility, College.id == CollegeEligibility.college_id
    ).filter(
        (CollegeEligibility.min_cgpa.is_(None)) | (CollegeEligibility.min_cgpa <= applicant_cgpa if applicant_cgpa else True),
        (CollegeEligibility.min_jee_rank.is_(None)) | (CollegeEligibility.min_jee_rank >= jee_rank if jee_rank else True)
    ).all()
    
    college_recommendations = []
    for college, eligibility in colleges:
        if not eligibility:
            continue
        
        score = 0.0
        explain_parts = []
        
        # JEE rank scoring
        if eligibility.min_jee_rank and jee_rank:
            if jee_rank <= eligibility.min_jee_rank:
                score += RECOMMENDATION_WEIGHTS['JEE_RANK_SCORE']
                explain_parts.append(f"JEE rank {jee_rank} meets cutoff {eligibility.min_jee_rank}")
            else:
                continue  # Skip if doesn't meet requirement
        
        # CGPA scoring
        if eligibility.min_cgpa and applicant_cgpa:
            if applicant_cgpa >= eligibility.min_cgpa:
                score += RECOMMENDATION_WEIGHTS['CGPA_SCORE']
                explain_parts.append(f"CGPA {applicant_cgpa} meets minimum {eligibility.min_cgpa}")
            else:
                continue  # Skip if doesn't meet requirement
        
        # Skills matching with word-boundary regex
        programs = db.query(CollegeProgram).filter(
            CollegeProgram.college_id == college.id,
            CollegeProgram.status == 'approved'
        ).all()
        
        if programs and skills:
            skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills]
            matched_skills = set()
            
            for program in programs:
                prog_skills = getattr(program, 'required_skills', None)
                if prog_skills is not None:
                    for req_skill in prog_skills:
                        req_name = req_skill if isinstance(req_skill, str) else req_skill.get('name', '') if isinstance(req_skill, dict) else ''
                        if len(req_name) == 0:
                            continue
                        
                        # Word-boundary matching for skills >= 3 chars
                        if len(req_name) >= 3:
                            pattern = r'\b' + re.escape(req_name.lower()) + r'\b'
                            for sn in skill_names:
                                if re.search(pattern, sn.lower()):
                                    matched_skills.add(req_name)
                                    break
                        else:
                            # Exact match for short names
                            if any(req_name.lower() == sn.lower() for sn in skill_names):
                                matched_skills.add(req_name)
            
            if matched_skills:
                skill_score = min(RECOMMENDATION_WEIGHTS['SKILLS_SCORE'], len(matched_skills) * 5)
                score += skill_score
                explain_parts.append(f"{len(matched_skills)} skill(s) matched: {', '.join(list(matched_skills)[:3])}")
        
        # Add interview bonus (less weight for colleges)
        if interview_bonus > 0:
            college_interview_bonus = interview_bonus * 0.5  # 50% weight for colleges
            score += college_interview_bonus
            explain_parts.append(f"Interview performance bonus: +{college_interview_bonus:.1f} ({interview_multiplier_key})")
        
        # Add assessment bonus
        if assessment_bonus > 0:
            score += assessment_bonus
            explain_parts.append(f"Verified skills bonus: +{assessment_bonus:.1f}")
        
        if score > 0:
            rec = CollegeApplicabilityLog(
                applicant_id=applicant_id,
                college_id=college.id,
                recommend_score=score,
                explain={"reasons": explain_parts, "match_details": "Generated via recommendation API"},
                status='recommended'
            )
            db.add(rec)
            college_recommendations.append({
                "college_name": college.name,
                "score": round(score, 2),
                "reasons": explain_parts
            })
    
    # Job recommendations
    jobs = db.query(Job).filter(Job.status == 'approved').all()
    job_recommendations = []
    
    for job in jobs:
        score = 0.0
        breakdown = {"skill_score": 0.0, "academic_score": 0.0, "experience_score": 0.0}
        explain_parts = []
        
        # CGPA requirement
        job_min_cgpa = getattr(job, 'min_cgpa', None)
        if job_min_cgpa is not None and applicant_cgpa is not None:
            if applicant_cgpa >= job_min_cgpa:
                academic_score = RECOMMENDATION_WEIGHTS['ACADEMIC_SCORE']
                breakdown["academic_score"] = academic_score
                score += academic_score
                explain_parts.append(f"CGPA {applicant_cgpa} meets requirement {job_min_cgpa}")
            else:
                continue
        else:
            # No CGPA requirement - give partial credit
            breakdown["academic_score"] = RECOMMENDATION_WEIGHTS['ACADEMIC_SCORE'] * 0.5
            score += breakdown["academic_score"]
        
        # Skills matching
        job_req_skills = getattr(job, 'required_skills', None)
        if job_req_skills is not None and skills:
            skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills]
            required = job_req_skills if isinstance(job_req_skills, list) else []
            matched_skills = set()
            
            for req_skill in required:
                req_name = req_skill.get('name', '') if isinstance(req_skill, dict) else str(req_skill)
                if len(str(req_name)) == 0:
                    continue
                
                # Word-boundary matching
                if len(req_name) >= 3:
                    pattern = r'\b' + re.escape(req_name.lower()) + r'\b'
                    for sn in skill_names:
                        if re.search(pattern, sn.lower()):
                            matched_skills.add(req_name)
                            break
                else:
                    if any(req_name.lower() == sn.lower() for sn in skill_names):
                        matched_skills.add(req_name)
            
            if matched_skills:
                skill_score = (len(matched_skills) / max(len(required), 1)) * 50
                breakdown["skill_score"] = round(skill_score, 2)
                score += skill_score
                explain_parts.append(f"{len(matched_skills)}/{len(required)} required skills matched")
        
        # Experience (students typically have 0)
        min_exp = getattr(job, 'min_experience_years', None)
        if min_exp is None or min_exp == 0:
            breakdown["experience_score"] = RECOMMENDATION_WEIGHTS['EXPERIENCE_SCORE']
            score += breakdown["experience_score"]
        
        # Add interview bonus (full weight for jobs)
        if interview_bonus > 0:
            breakdown["interview_score"] = interview_bonus
            score += interview_bonus
            explain_parts.append(f"Interview performance: +{interview_bonus:.1f} ({interview_multiplier_key})")
        
        # Add assessment bonus
        if assessment_bonus > 0:
            breakdown["assessment_score"] = assessment_bonus
            score += assessment_bonus
            explain_parts.append(f"Verified skills: +{assessment_bonus:.1f}")
        
        if score >= RECOMMENDATION_WEIGHTS['MIN_JOB_RECOMMENDATION_SCORE']:
            rec = JobRecommendation(
                applicant_id=applicant_id,
                job_id=job.id,
                score=round(score, 2),
                scoring_breakdown=breakdown,
                explain={"reasons": explain_parts, "breakdown": breakdown},
                status='recommended'
            )
            db.add(rec)
            employer = db.query(Employer).filter(Employer.id == job.employer_id).first()
            job_recommendations.append({
                "job_title": job.title,
                "company": employer.company_name if employer else "Unknown",
                "score": round(score, 2),
                "breakdown": breakdown
            })
    
    db.commit()
    logger.info(f"Generated {len(college_recommendations)} college and {len(job_recommendations)} job recommendations")
    
    return {
        "status": "success",
        "message": "Recommendations generated successfully",
        "college_recommendations_count": len(college_recommendations),
        "job_recommendations_count": len(job_recommendations),
        "top_college_recommendations": sorted(college_recommendations, key=lambda x: x['score'], reverse=True)[:10],
        "top_job_recommendations": sorted(job_recommendations, key=lambda x: x['score'], reverse=True)[:10]
    }


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


@app.patch("/api/college/applications/{application_id}/status")
async def update_college_application_status(
    application_id: int,
    status: str = Body(...),
    college_notes: Optional[str] = Body(None),
    db: Session = Depends(get_db),
    current_user = Depends(require_role("college"))
):
    """Update college application status (college only).
    
    Allows colleges to move applications through their workflow:
    applied → under_review → shortlisted → accepted/rejected/waitlisted
    """
    from .db import CollegeApplication, AuditLog
    
    valid_statuses = ['applied', 'under_review', 'shortlisted', 'accepted', 'rejected', 'waitlisted', 'withdrawn']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Get application and verify college owns it
    application = db.query(CollegeApplication).filter(CollegeApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Get the college and verify ownership
    college_record = db.query(College).filter(College.id == application.college_id).first()
    if not college_record:
        raise HTTPException(status_code=404, detail="College not found")
    
    college_user_id = getattr(college_record, 'user_id', None)
    if college_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update applications for your own college")
    
    # Validate status transitions
    valid_transitions = {
        'applied': ['under_review', 'rejected', 'withdrawn'],
        'under_review': ['shortlisted', 'rejected', 'withdrawn'],
        'shortlisted': ['accepted', 'rejected', 'waitlisted', 'withdrawn'],
        'accepted': [],  # terminal
        'rejected': [],  # terminal
        'waitlisted': ['accepted', 'rejected', 'withdrawn'],
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
    if college_notes:
        application.college_notes = college_notes  # type: ignore
    application.updated_at = dt.datetime.utcnow()  # type: ignore
    
    db.commit()
    db.refresh(application)
    
    # Audit log
    try:
        audit = AuditLog(
            action="college_application_status_update",
            target_type="CollegeApplication",
            target_id=application_id,
            user_id=current_user.id,
            details={
                "old_status": old_status,
                "new_status": status,
                "notes": college_notes,
                "college_id": college_record.id,
                "applicant_id": application.applicant_id
            }
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")
    
    logger.info(f"College {college_record.id} updated application {application_id}: {old_status} → {status}")
    
    app_updated = getattr(application, 'updated_at', None)
    return {
        "id": application.id,
        "status": getattr(application, 'status'),
        "college_notes": getattr(application, 'college_notes', None),
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
    
    if entity_type not in ['job', 'college', 'applicant']:
        raise HTTPException(status_code=400, detail="entity_type must be 'job', 'college', or 'applicant'")
    
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
    elif entity_type == 'college':
        results = db.query(College).filter(
            (College.name.ilike(f"%{query}%")) | (College.description.ilike(f"%{query}%"))
        ).limit(limit).all()
        
        return {
            "status": "success",
            "method": "text_fallback",
            "message": "Using text search (vector store not configured)",
            "results": [
                {
                    "id": college.id,
                    "name": getattr(college, 'name'),
                    "description": getattr(college, 'description', '')[:200] + "...",
                    "score": 0.82
                } for college in results
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
    
    elif entity_type == 'college':
        base_query = db.query(College)
        
        # Text search
        if query:
            search_pattern = f"%{query}%"
            base_query = base_query.filter(
                (College.name.ilike(search_pattern)) |
                (College.description.ilike(search_pattern)) |
                (College.location_city.ilike(search_pattern))
            )
        
        # Apply filters
        if filters:
            if 'location' in filters:
                base_query = base_query.filter(College.location_city.ilike(f"%{filters['location']}%"))
            if 'state' in filters:
                base_query = base_query.filter(College.location_state.ilike(f"%{filters['state']}%"))
        
        # Sorting
        if sort_by == 'name':
            base_query = base_query.order_by(College.name)
        else:
            base_query = base_query.order_by(desc(College.created_at))
        
        results = base_query.limit(limit).all()
        
        return {
            "status": "success",
            "count": len(results),
            "results": [
                {
                    "id": college.id,
                    "name": getattr(college, 'name'),
                    "location_city": getattr(college, 'location_city'),
                    "location_state": getattr(college, 'location_state'),
                    "description": getattr(college, 'description', '')[:200] + "...",
                    "website": getattr(college, 'website')
                } for college in results
            ]
        }
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported entity_type")


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


@app.post("/api/applicant/{applicant_id}/generate-recommendations-old")
def generate_recommendations(applicant_id: int, db: Session = Depends(get_db)):
    """Generate college and job recommendations for an applicant"""
    from .db import CollegeEligibility
    import random
    
    # Check if applicant exists
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail=API_MESSAGES['APPLICANT_NOT_FOUND'])
    
    # Get parsed data
    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if not llm_record:
        raise HTTPException(status_code=400, detail=API_MESSAGES['NO_PARSED_DATA'])
    
    parsed_data = llm_record.normalized
    education = parsed_data.get('education', [])
    skills = parsed_data.get('skills', [])
    jee_rank = parsed_data.get('jee_rank')
    
    # Calculate applicant CGPA (use first education entry)
    applicant_cgpa = None
    if education and len(education) > 0:
        first_edu = education[0]
        if isinstance(first_edu, dict) and 'grade' in first_edu:
            applicant_cgpa = first_edu.get('grade')
    
    # Pre-filter colleges by eligibility to improve performance
    colleges = db.query(College, CollegeEligibility).outerjoin(
        CollegeEligibility, College.id == CollegeEligibility.college_id
    ).filter(
        # Only include colleges where applicant meets basic requirements
        (CollegeEligibility.min_cgpa.is_(None)) | (CollegeEligibility.min_cgpa <= applicant_cgpa if applicant_cgpa else True),
        (CollegeEligibility.min_jee_rank.is_(None)) | (CollegeEligibility.min_jee_rank >= jee_rank if jee_rank else True)
    ).all()
    
    college_recommendations = []
    for college, eligibility in colleges:
        if not eligibility:
            continue
        
        score = 0.0
        explain_parts = []
        
        # Check JEE rank eligibility
        if eligibility.min_jee_rank and jee_rank:
            if jee_rank <= eligibility.min_jee_rank:
                score += RECOMMENDATION_WEIGHTS['JEE_RANK_SCORE']
                explain_parts.append(f"JEE rank {jee_rank} meets cutoff")
            else:
                continue  # Skip if doesn't meet JEE requirement
        
        # Check CGPA eligibility
        if eligibility.min_cgpa and applicant_cgpa:
            if applicant_cgpa >= eligibility.min_cgpa:
                score += RECOMMENDATION_WEIGHTS['CGPA_SCORE']
                explain_parts.append(f"CGPA {applicant_cgpa} meets minimum")
            else:
                continue  # Skip if doesn't meet CGPA requirement
        
        # Skills match (simplified)
        programs = db.query(CollegeProgram).filter(CollegeProgram.college_id == college.id).all()
        if programs and skills:
            skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills]
            matched = 0
            for program in programs:
                if program.required_skills is not None:  # type: ignore
                    for req_skill in program.required_skills:
                        req_name = req_skill if isinstance(req_skill, str) else req_skill.get('name', '')
                        # Improved skill matching: require word boundaries and minimum 3-char length
                        if len(req_name) >= 3:
                            import re
                            pattern = r'\b' + re.escape(req_name.lower()) + r'\b'
                            if any(re.search(pattern, sn.lower()) for sn in skill_names):
                                matched += 1
                        else:
                            # For short names, require exact match
                            if any(req_name.lower() == sn.lower() for sn in skill_names):
                                matched += 1
            if matched > 0:
                score += min(30.0, matched * 5)
                explain_parts.append(f"{matched} skill(s) matched")
        
        if score > 0:
            # Create recommendation
            rec = CollegeApplicabilityLog(
                applicant_id=applicant_id,
                college_id=college.id,
                recommend_score=score,
                explain={"reasons": explain_parts, "match_details": "Auto-generated recommendation"},
                status='recommended'
            )
            db.add(rec)
            college_recommendations.append({
                "college_name": college.name,
                "score": score,
                "reasons": explain_parts
            })
    
    # Get all jobs
    jobs = db.query(Job).all()
    job_recommendations = []
    
    for job in jobs:
        score = 0.0
        breakdown: dict[str, float] = {"skill_score": 0.0, "academic_score": 0.0, "experience_score": 0.0}
        explain_parts = []
        
        # Check CGPA requirement
        if job.min_cgpa is not None and applicant_cgpa:  # type: ignore
            if applicant_cgpa >= job.min_cgpa:
                academic_score = RECOMMENDATION_WEIGHTS['ACADEMIC_SCORE']
                breakdown["academic_score"] = academic_score
                score += academic_score
                explain_parts.append(f"CGPA {applicant_cgpa} meets requirement")
            else:
                continue  # Skip if doesn't meet requirement
        
        # Skills matching
        if job.required_skills is not None and skills:  # type: ignore
            skill_names = [s.get('name', '') if isinstance(s, dict) else str(s) for s in skills]
            required = job.required_skills if isinstance(job.required_skills, list) else []
            matched = 0
            for req_skill in required:
                req_name = req_skill.get('name', '') if isinstance(req_skill, dict) else str(req_skill)
                # Improved skill matching for jobs
                if len(req_name) >= 3:
                    import re
                    pattern = r'\b' + re.escape(req_name.lower()) + r'\b'
                    if any(re.search(pattern, sn.lower()) for sn in skill_names):
                        matched += 1
                else:
                    if any(req_name.lower() == sn.lower() for sn in skill_names):
                        matched += 1

            if matched > 0:
                skill_score = min(50.0, (matched / max(len(required), 1)) * 50)
                breakdown["skill_score"] = skill_score
                score += skill_score
                explain_parts.append(f"{matched}/{len(required)} required skills matched")
        
        # Experience (simplified - assume 0 years for students)
        min_exp = float(job.min_experience_years) if job.min_experience_years is not None else 0.0  # type: ignore
        experience_score = RECOMMENDATION_WEIGHTS['EXPERIENCE_SCORE'] if min_exp == 0 else 0.0
        breakdown["experience_score"] = experience_score
        score += experience_score
        
        if score >= RECOMMENDATION_WEIGHTS['MIN_JOB_RECOMMENDATION_SCORE']:  # Only recommend if score is decent
            # Standardize explain format to match college recommendations (JSON)
            rec = JobRecommendation(
                applicant_id=applicant_id,
                job_id=job.id,
                score=score,
                scoring_breakdown=breakdown,
                explain={"reasons": explain_parts, "match_details": "Auto-generated recommendation", "breakdown": breakdown},
                status='recommended'
            )
            db.add(rec)
            employer = db.query(Employer).filter(Employer.id == job.employer_id).first()
            job_recommendations.append({
                "job_title": job.title,
                "company": employer.company_name if employer else "Unknown",
                "score": score,
                "breakdown": breakdown
            })
    
    db.commit()
    
    return {
        "status": "success",
        "college_recommendations_generated": len(college_recommendations),
        "job_recommendations_generated": len(job_recommendations),
        "college_recommendations": college_recommendations[:10],  # Top 10
        "job_recommendations": job_recommendations[:10]  # Top 10
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
        "started_at": getattr(session, 'started_at', dt.datetime.utcnow()),
        "completed_at": getattr(session, 'completed_at', None),
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
        
        session.started_at = now
        session.ends_at = now + dt.timedelta(seconds=duration)
        db.commit()
        db.refresh(session)
    
    # Format datetimes with Z suffix to indicate UTC
    started_at = getattr(session, 'started_at', dt.datetime.utcnow())
    ends_at = getattr(session, 'ends_at', None)
    
    session_data = {
        "id": session.id,
        "session_type": getattr(session, 'session_type', ''),
        "session_mode": getattr(session, 'session_mode', 'full'),
        "difficulty_level": getattr(session, 'difficulty_level', 'medium'),
        "status": getattr(session, 'status', 'in_progress'),
        "started_at": started_at.isoformat() + 'Z' if started_at else None,
        "ends_at": ends_at.isoformat() + 'Z' if ends_at else None,
        "focus_skills": getattr(session, 'focus_skills', None)
    }
    
    questions_data = [
        {
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
            "skills_tested": getattr(q, 'skills_tested', None)
        }
        for q in questions
    ]
    
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
# STUDENT PROFILE MANAGEMENT
# ============================================================

@app.get("/api/student/profile", response_model=ProfileResponse)
def get_student_profile(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the current student's profile with all parsed resume details.
    """
    from .schemas import ProfileResponse
    from .db import LLMParsedRecord
    
    # Get applicant for current user
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    # Get parsed resume data
    parsed_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()
    
    # Debug logging
    if parsed_record:
        logger.info(f"Found parsed_record for applicant {applicant.id}")
        logger.info(f"Normalized data keys: {list(parsed_record.normalized.keys()) if parsed_record.normalized else 'None'}")
        logger.info(f"Normalized data: {parsed_record.normalized}")
    else:
        logger.warning(f"No parsed_record found for applicant {applicant.id}")
    
    # Extract data from normalized JSON
    normalized_data = parsed_record.normalized if parsed_record else {}
    
    # Convert applicant to dict for response
    profile_data = {
        "id": applicant.id,
        "user_id": applicant.user_id,
        "display_name": applicant.display_name or normalized_data.get('name'),
        "email": normalized_data.get('email'),
        "phone": normalized_data.get('phone'),
        "location_city": applicant.location_city or normalized_data.get('location', {}).get('city'),
        "location_state": applicant.location_state or normalized_data.get('location', {}).get('state'),
        "linkedin_url": normalized_data.get('linkedin'),
        "github_url": normalized_data.get('github'),
        "portfolio_url": normalized_data.get('portfolio'),
        "skills": normalized_data.get('skills', []),
        "education": normalized_data.get('education', []),
        "experience": normalized_data.get('experience', []),
        "projects": normalized_data.get('projects', []),
        "certifications": normalized_data.get('certifications', []),
        "bio": normalized_data.get('summary'),
        "created_at": applicant.created_at,
        "updated_at": applicant.updated_at
    }
    
    return profile_data


@app.put("/api/student/profile", response_model=ProfileResponse)
def update_student_profile(
    profile_update: ProfileUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the current student's profile.
    """
    from .schemas import ProfileUpdate
    from .db import LLMParsedRecord
    import datetime
    
    # Get applicant for current user
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    # Get or create parsed record
    parsed_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()
    if not parsed_record:
        # Create new parsed record if it doesn't exist
        parsed_record = LLMParsedRecord(
            applicant_id=applicant.id,
            raw_llm_output={},
            normalized={}
        )
        db.add(parsed_record)
    
    # Update fields that are provided
    update_data = profile_update.dict(exclude_unset=True)
    
    # Convert Pydantic models to dicts
    if 'skills' in update_data and update_data['skills']:
        update_data['skills'] = [skill.dict() if hasattr(skill, 'dict') else skill for skill in update_data['skills']]
    
    if 'education' in update_data and update_data['education']:
        update_data['education'] = [edu.dict() if hasattr(edu, 'dict') else edu for edu in update_data['education']]
    
    if 'experience' in update_data and update_data['experience']:
        update_data['experience'] = [exp.dict() if hasattr(exp, 'dict') else exp for exp in update_data['experience']]
    
    if 'projects' in update_data and update_data['projects']:
        update_data['projects'] = [proj.dict() if hasattr(proj, 'dict') else proj for proj in update_data['projects']]
    
    if 'certifications' in update_data and update_data['certifications']:
        update_data['certifications'] = [cert.dict() if hasattr(cert, 'dict') else cert for cert in update_data['certifications']]
    
    # Update normalized JSON
    normalized_data = parsed_record.normalized or {}
    
    # Map profile fields to normalized structure
    if 'skills' in update_data:
        normalized_data['skills'] = update_data['skills']
    if 'education' in update_data:
        normalized_data['education'] = update_data['education']
    if 'experience' in update_data:
        normalized_data['experience'] = update_data['experience']
    if 'projects' in update_data:
        normalized_data['projects'] = update_data['projects']
    if 'certifications' in update_data:
        normalized_data['certifications'] = update_data['certifications']
    if 'bio' in update_data:
        normalized_data['summary'] = update_data['bio']
    if 'email' in update_data:
        normalized_data['email'] = update_data['email']
    if 'phone' in update_data:
        normalized_data['phone'] = update_data['phone']
    if 'linkedin_url' in update_data:
        normalized_data['linkedin'] = update_data['linkedin_url']
    if 'github_url' in update_data:
        normalized_data['github'] = update_data['github_url']
    if 'portfolio_url' in update_data:
        normalized_data['portfolio'] = update_data['portfolio_url']
    
    # Update location in normalized data
    if 'location_city' in update_data or 'location_state' in update_data:
        if 'location' not in normalized_data:
            normalized_data['location'] = {}
        if 'location_city' in update_data:
            normalized_data['location']['city'] = update_data['location_city']
        if 'location_state' in update_data:
            normalized_data['location']['state'] = update_data['location_state']
    
    # Update display name in applicant table
    if 'display_name' in update_data:
        applicant.display_name = update_data['display_name']
        normalized_data['name'] = update_data['display_name']
    
    # Save updated normalized data
    parsed_record.normalized = normalized_data
    parsed_record.updated_at = datetime.datetime.utcnow()
    applicant.updated_at = datetime.datetime.utcnow()
    
    db.commit()
    db.refresh(applicant)
    db.refresh(parsed_record)
    
    # Return updated profile
    profile_data = {
        "id": applicant.id,
        "user_id": applicant.user_id,
        "display_name": applicant.display_name or normalized_data.get('name'),
        "email": normalized_data.get('email'),
        "phone": normalized_data.get('phone'),
        "location_city": applicant.location_city or normalized_data.get('location', {}).get('city'),
        "location_state": applicant.location_state or normalized_data.get('location', {}).get('state'),
        "linkedin_url": normalized_data.get('linkedin'),
        "github_url": normalized_data.get('github'),
        "portfolio_url": normalized_data.get('portfolio'),
        "skills": normalized_data.get('skills', []),
        "education": normalized_data.get('education', []),
        "experience": normalized_data.get('experience', []),
        "projects": normalized_data.get('projects', []),
        "certifications": normalized_data.get('certifications', []),
        "bio": normalized_data.get('summary'),
        "created_at": applicant.created_at,
        "updated_at": applicant.updated_at
    }
    
    return profile_data


@app.post("/api/upload/resume")
async def upload_resume(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload and parse a resume for the current student.
    Creates Upload record and LLMParsedRecord.
    """
    from .db import Upload, LLMParsedRecord
    from .resume.parse_service import ResumeParserService
    import shutil
    from pathlib import Path
    
    try:
        # Get or create applicant
        applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
        if not applicant:
            # Create applicant if doesn't exist
            applicant = Applicant(
                user_id=current_user.id,
                applicant_id=str(uuid4()),
                display_name=current_user.name
            )
            db.add(applicant)
            db.commit()
            db.refresh(applicant)
        
        # Validate file type
        allowed_extensions = ['.pdf', '.doc', '.docx']
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        # Validate file size (10MB max)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be less than 10MB")
        
        # Create upload directory (use applicant_id not id)
        upload_dir = Path(settings.FILE_STORAGE_PATH) / applicant.applicant_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Save file
        file_path = upload_dir / f"resume{file_ext}"
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Calculate file hash
        file_hash = sha256_file(str(file_path))
        
        # Check if this exact file was already uploaded
        existing_upload = db.query(Upload).filter(Upload.file_hash == file_hash).first()
        if existing_upload:
            logger.info(f"File already uploaded: {file_hash}, skipping Upload record creation")
            # Don't delete the file - we still need it for parsing!
        else:
            # Create Upload record
            upload_record = Upload(
                applicant_id=applicant.id,
                file_name=sanitize_filename(file.filename),
                file_type='resume',
                storage_path=str(file_path),
                file_hash=file_hash,
                ocr_used=False
            )
            db.add(upload_record)
            db.commit()
            logger.info(f"Created Upload record for applicant {applicant.id}")
        
        # Parse resume
        try:
            parser = ResumeParserService()
            
            # Add logging to see what text is being extracted
            logger.info(f"Starting resume parsing for applicant {applicant.id}")
            logger.info(f"Upload directory: {upload_dir}")
            
            parse_result = parser.run_parse(str(upload_dir), applicant.applicant_id)
            
            # Delete existing parsed record if any
            existing_parsed = db.query(LLMParsedRecord).filter(
                LLMParsedRecord.applicant_id == applicant.id
            ).first()
            if existing_parsed:
                db.delete(existing_parsed)
                db.commit()
            
            # Create new LLMParsedRecord
            parsed_record = LLMParsedRecord(
                applicant_id=applicant.id,
                raw_llm_output=parse_result.get('llm_provenance', {}),
                normalized=parse_result.get('normalized', {}),
                field_confidences={},
                llm_provenance=parse_result.get('llm_provenance', {}),
                needs_review=parse_result.get('needs_review', False)
            )
            db.add(parsed_record)
            db.commit()
            
            logger.info(f"Successfully parsed resume for applicant {applicant.id}")
            logger.info(f"Normalized data keys: {list(parse_result.get('normalized', {}).keys())}")
            
            return {
                "success": True,
                "message": "Resume uploaded and parsed successfully",
                "applicant_id": applicant.id,
                "parsed": True,
                "needs_review": parse_result.get('needs_review', False),
                "skills_count": len(parse_result.get('normalized', {}).get('skills', [])),
                "education_count": len(parse_result.get('normalized', {}).get('education', [])),
                "experience_count": len(parse_result.get('normalized', {}).get('experience', []))
            }
            
        except Exception as parse_error:
            logger.error(f"Resume parsing failed: {str(parse_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Resume parsing failed: {str(parse_error)}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resume upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


# ============================================================
# Local development entrypoint (reads host/port from .env via settings)
# ============================================================

# ============================================================
# STUDENT APPLICANT ENDPOINT
# ============================================================

@app.get("/api/student/applicant")
async def get_student_applicant(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's applicant profile"""
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    return {
        "id": applicant.id,
        "applicant_id": applicant.applicant_id,
        "display_name": applicant.display_name,
        "location_city": applicant.location_city,
        "location_state": applicant.location_state
    }


# ============================================================
# RECOMMENDATIONS ENDPOINT
# ============================================================

@app.get("/api/recommendations/{applicant_id}")
async def get_recommendations(
    applicant_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get personalized college and job recommendations for an applicant
    
    Recommendations are generated based on:
    - Skills (40% weight)
    - Education (25% weight)
    - Experience (20% weight)
    - Interview scores (15% weight, when available)
    
    Weights are configurable in config.py
    """
    try:
        from .recommendation.recommendation_service import RecommendationService
        
        # Verify applicant exists and belongs to current user
        applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
        if not applicant:
            raise HTTPException(status_code=404, detail="Applicant not found")
        
        # Check authorization (user can only get their own recommendations)
        if applicant.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view these recommendations")
        
        # Generate recommendations
        rec_service = RecommendationService(db)
        recommendations = rec_service.get_recommendations(applicant_id)
        
        logger.info(f"Generated {len(recommendations['college_recommendations'])} college and {len(recommendations['job_recommendations'])} job recommendations for applicant {applicant_id}")
        
        return recommendations
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    # Use configured API host/port from settings; default values are set in config.py
    uvicorn.run(
        "resume_pipeline.app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
