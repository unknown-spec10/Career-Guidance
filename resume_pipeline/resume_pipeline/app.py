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
    API_MESSAGES, RECOMMENDATION_WEIGHTS, DEFAULT_PAGE_SIZE
)
from .schemas import (
    UserRegister, UserLogin, Token, UserResponse,
    JobCreate, JobUpdate, JobResponse,
    JobApplicationCreate, JobApplicationResponse,
    CollegeProgramCreate, CollegeProgramResponse,
    CollegeApplicationCreate, CollegeApplicationResponse,
    ApprovalAction, MarksheetUpload, VerifyCodeRequest, ResendCodeRequest
)
from .auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_role
)
from pathlib import Path
import json
from .resume.parse_service import ResumeParserService
import pymysql
import logging
from datetime import timedelta
import secrets
import datetime as dt

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
    marksheets: list[UploadFile] | None = None,
    jee_rank: int | None = Form(None),
    location: str | None = Form(None),
    preferences: str | None = Form(None),
    upload_type: str = Form("resume"),  # "resume" or "marksheet"
    twelfth_percentage: float | None = Form(None),
    twelfth_board: str | None = Form(None),
    twelfth_subjects: str | None = Form(None),  # JSON string
    current_user = Depends(get_current_user),  # Authentication required
    db: Session = Depends(get_db)
):
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
        
        # If the request included an Authorization: Bearer <token> header, resolve the user
        current_user = None
        try:
            auth_header = None
            if request is not None:
                auth_header = request.headers.get('authorization') or request.headers.get('Authorization')
            if auth_header and auth_header.lower().startswith('bearer '):
                token = auth_header.split(' ', 1)[1].strip()
                from .auth import decode_access_token
                from .db import User
                try:
                    payload = decode_access_token(token)
                    user_id_raw = payload.get('sub')
                    if user_id_raw is not None:
                        user_id = int(user_id_raw)
                        current_user = db.query(User).filter(User.id == user_id).first()
                except Exception:
                    current_user = None
        except Exception:
            current_user = None

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
        db.commit()
        
        logger.info(f"✓ Saved applicant {applicant_id} to database (ID: {applicant.id})")
        
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
            from .db import CollegeEligibility, CollegeApplicabilityLog, JobRecommendation, Job, Employer
            
            # Quick recommendation generation (simplified)
            normalized = result.get('normalized', {})
            education = normalized.get('education', [])
            applicant_cgpa = education[0].get('grade') if education and len(education) > 0 and isinstance(education[0], dict) else None
            jee_rank = normalized.get('jee_rank')
            
            # Store metadata for recommendations
            metadata_path = applicant_dir / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    meta = json.load(f)
                    # Prioritize user-provided JEE rank over parsed
                    if meta.get('jee_rank_user_provided') and meta.get('jee_rank'):
                        jee_rank = meta['jee_rank']
                        logger.info(f"Using user-provided JEE rank: {jee_rank}")
            
            # Generate a few recommendations (full generation happens via dedicated endpoint)
            colleges = db.query(College, CollegeEligibility).outerjoin(
                CollegeEligibility, College.id == CollegeEligibility.college_id
            ).filter(
                # Pre-filter by eligibility
                (CollegeEligibility.min_cgpa.is_(None)) | (CollegeEligibility.min_cgpa <= applicant_cgpa if applicant_cgpa else True),
                (CollegeEligibility.min_jee_rank.is_(None)) | (CollegeEligibility.min_jee_rank >= jee_rank if jee_rank else True)
            ).limit(5).all()
            
            rec_count = 0
            for college, eligibility in colleges:
                if eligibility:
                    score = 50.0  # Simplified scoring
                    rec = CollegeApplicabilityLog(
                        applicant_id=applicant.id,
                        college_id=college.id,
                        recommend_score=score,
                        explain={"reasons": ["Auto-generated after parse"], "auto_generated": True},
                        status='recommended'
                    )
                    db.add(rec)
                    rec_count += 1
            
            db.commit()
            result['auto_recommendations_generated'] = rec_count
            logger.info(f"✓ Auto-generated {rec_count} recommendations")
        except Exception as e:
            logger.warning(f"Failed to auto-generate recommendations: {e}")
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
# Local development entrypoint (reads host/port from .env via settings)
# ============================================================
if __name__ == "__main__":
    import uvicorn
    # Use configured API host/port from settings; default values are set in config.py
    uvicorn.run(
        "resume_pipeline.app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
