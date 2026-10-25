# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""Session + profile auth routes (paths/methods/guards unchanged).

Part of the former ``routers/auth.py`` monolith, split for separation of
concerns. Aggregated with the sibling routers by :mod:`resume_pipeline.routers.auth`.
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Body, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pathlib import Path
import datetime as dt
import logging
import secrets
from typing import Optional

from ...utils import sanitize_text, sanitize_filename, validate_email
from ...config import settings
from ...schemas import UserRegister, Token, UserResponse
from ...auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user,
)
from ..deps import get_db, get_user_or_404

logger = logging.getLogger(__name__)


def _looks_like_image(content: bytes, file_ext: str) -> bool:
    """Magic-bytes check for avatar uploads (dependency-free).

    Rejects mislabeled executables/polyglots that pass the extension check.
    """
    head = bytes(content[:12])
    if file_ext in (".jpg", ".jpeg"):
        return head[:2] == b"\xff\xd8"
    if file_ext == ".png":
        return head[:8] == b"\x89PNG\r\n\x1a\n"
    if file_ext == ".gif":
        return head[:6] in (b"GIF87a", b"GIF89a")
    if file_ext == ".webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    return False


router = APIRouter()


# ============================================================
# AUTHENTICATION ENDPOINTS
# ============================================================

@router.post("/api/auth/register", response_model=UserResponse)
async def register(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """Register a new user and send verification email"""

    from ...db import User
    from ...email_verification import (
        generate_verification_code,
        send_verification_code_email,
    )

    # Validate and sanitize email
    if not validate_email(user_data.email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    # Sanitize text inputs
    name = sanitize_text(user_data.name, max_length=200)
    email = user_data.email.strip().lower()

    # Public password registration is student-only. Any non-student role is
    # rejected here; OAuth role assignment stays on its HMAC-signed path.
    if user_data.role.value != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Public registration is limited to student accounts",
        )

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

    db.commit()

    logger.info(f"New user registered: {new_user.email} as {new_user.role}")
    return new_user


@router.post("/api/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and receive access token"""
    from ...db import User

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


@router.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_current_user)):
    """Get current user information"""
    logger.info(f"get_current_user_info called for user: {current_user.email} (id: {current_user.id})")
    logger.info(f"current_user.profile_picture_url in DB: {current_user.profile_picture_url}")
    user_response = UserResponse.model_validate(current_user)
    if settings.STORAGE_BACKEND == "gcs" and user_response.profile_picture_url:
        url = user_response.profile_picture_url
        if "avatars/" in url:
            key = "avatars/" + url.split("avatars/")[-1]
            from ...core.storage import get_storage_client
            try:
                storage_client = get_storage_client()
                user_response.profile_picture_url = storage_client.get_file_url(key, expires_in=3600)
            except Exception as e:
                logger.warning(f"Failed to generate presigned URL for avatar: {e}")
    logger.info(f"user_response.profile_picture_url returned: {user_response.profile_picture_url}")
    return user_response


@router.patch("/api/auth/profile")
async def update_profile(
    name: Optional[str] = Body(None, embed=True),
    phone: Optional[str] = Body(None, embed=True),
    location: Optional[str] = Body(None, embed=True),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile (name, phone, location).

    Phone is stored on the user row. Location is stored on the linked
    applicant row (``location_city``); fields left out of the request body
    are left unchanged so older ``{"name": ...}`` clients keep working.
    """

    user = get_user_or_404(db, current_user.id)

    if name is not None:
        setattr(user, 'name', sanitize_text(name, max_length=200))
    if phone is not None:
        setattr(user, 'phone', sanitize_text(phone, max_length=20) or None)

    if location is not None:
        from ...db import Applicant
        applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
        if applicant is not None:
            setattr(applicant, 'location_city', sanitize_text(location, max_length=100))

    db.commit()

    return {"status": "success", "message": "Profile updated successfully"}


@router.patch("/api/auth/deactivate")
async def deactivate_account(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deactivate currently authenticated user account."""

    user = get_user_or_404(db, current_user.id)

    if not getattr(user, 'is_active', True):
        return {"status": "success", "message": "Account already deactivated"}

    setattr(user, 'is_active', False)
    db.commit()

    return {"status": "success", "message": "Account deactivated successfully"}


@router.post("/api/auth/profile/picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a profile picture for the current user (GCS or Local)"""
    from ...core.storage import get_storage_client

    # 1. Validate file extension
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""
    if file_ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Supported formats: JPG, JPEG, PNG, WEBP, GIF"
        )

    # 2. Validate file size (max 2MB)
    max_size_bytes = 2 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds maximum limit of 2MB"
        )
    # 2b. Magic-bytes sniffing: extension alone is not trustworthy.
    if not _looks_like_image(content, file_ext):
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Supported formats: JPG, JPEG, PNG, WEBP, GIF"
        )
    await file.seek(0)

    # 3. Create path/key
    res_name = sanitize_filename(file.filename or "avatar.png")
    avatar_key = f"avatars/{current_user.id}/{res_name}"

    # 4. Upload file
    storage_client = get_storage_client()
    try:
        user = get_user_or_404(db, current_user.id)

        old_avatar = getattr(user, "profile_picture_url", None)
        if old_avatar:
            old_key = None
            if settings.STORAGE_BACKEND == "gcs":
                if f"avatars/{current_user.id}/" in old_avatar:
                    parts = old_avatar.split(f"avatars/{current_user.id}/")
                    if len(parts) > 1:
                        old_key = f"avatars/{current_user.id}/{parts[-1]}"
            else:
                if f"avatars/{current_user.id}/" in old_avatar:
                    parts = old_avatar.split("static/")
                    if len(parts) > 1:
                        old_key = parts[-1]

            if old_key and old_key != avatar_key:
                try:
                    storage_client.delete_file(old_key)
                except Exception as del_err:
                    logger.warning(f"Failed to delete old avatar file {old_key}: {del_err}")

        storage_client.upload_fileobj(file.file, avatar_key, is_public=True)
    except Exception as e:
        logger.error(f"Failed to upload profile picture: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to save profile picture"
        )

    # 5. Save URL to database
    # 5. Save URL to database
    if settings.STORAGE_BACKEND == "gcs":
        try:
            avatar_display_url = storage_client.get_file_url(avatar_key, expires_in=3600)
            avatar_url = avatar_display_url
        except Exception:
            avatar_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET_NAME}/{avatar_key}"
            avatar_display_url = avatar_url
    else:
        avatar_url = f"/static/{avatar_key}"
        avatar_display_url = avatar_url

    setattr(user, "profile_picture_url", avatar_url)
    db.commit()

    return {
        "status": "success",
        "profile_picture_url": avatar_display_url,
        "message": "Profile picture updated successfully"
    }


@router.delete("/api/auth/profile/picture")
async def delete_profile_picture(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete the profile picture for the current user"""
    from ...core.storage import get_storage_client

    user = get_user_or_404(db, current_user.id)

    old_avatar = getattr(user, "profile_picture_url", None)
    if not old_avatar:
        return {"status": "success", "message": "No profile picture to delete"}

    storage_client = get_storage_client()
    old_key = None
    if settings.STORAGE_BACKEND == "gcs":
        if f"avatars/{current_user.id}/" in old_avatar:
            parts = old_avatar.split(f"avatars/{current_user.id}/")
            if len(parts) > 1:
                old_key = f"avatars/{current_user.id}/{parts[-1]}"
    else:
        if f"avatars/{current_user.id}/" in old_avatar:
            parts = old_avatar.split("static/")
            if len(parts) > 1:
                old_key = parts[-1]

    if old_key:
        try:
            storage_client.delete_file(old_key)
        except Exception as e:
            logger.warning(f"Failed to delete avatar file {old_key} from storage: {e}")

    setattr(user, "profile_picture_url", None)
    db.commit()

    return {"status": "success", "message": "Profile picture deleted successfully"}
