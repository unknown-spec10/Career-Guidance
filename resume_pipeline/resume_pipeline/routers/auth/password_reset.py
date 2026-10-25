"""Password-management auth routes (paths/methods/guards unchanged).

Part of the former ``routers/auth.py`` monolith, split for separation of
concerns. Aggregated with the sibling routers by :mod:`resume_pipeline.routers.auth`.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional
import datetime as dt
import logging

from ...config import settings
from ...auth import get_password_hash, verify_password, get_current_user
from ..deps import (
    get_db,
    get_user_or_404,
    rate_limit,
    _record_failed_code_attempt,
    _clear_code_attempts,
    _code_attempts_exceeded,
    _email_throttle_count,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.patch("/api/auth/change-password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""

    user = get_user_or_404(db, current_user.id)

    # Verify current password
    password_hash = getattr(user, 'password_hash', '')
    if not verify_password(current_password, password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Update password
    new_hash = get_password_hash(new_password)
    setattr(user, 'password_hash', new_hash)
    # Revoke all existing JWTs for this account (tokens issued before now die).
    setattr(user, 'password_changed_at', dt.datetime.utcnow())
    db.commit()

    return {"status": "success", "message": "Password changed successfully"}


@router.post("/api/auth/forgot-password")
async def forgot_password(
    request: Request,
    email: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Request password reset - sends reset code to email.

    Rate-limited per IP and per email to prevent SMTP abuse and code stuffing.
    Responses are uniform regardless of account existence (anti-enumeration).
    """

    from ...db import User
    from ...email_verification import generate_verification_code, send_password_reset_code_email

    try:
        rate_limit(request, max_requests=5, window=300)
    except HTTPException:
        raise

    generic_response = {"message": "If the email exists, a password reset code has been sent"}

    # Per-email throttle: max 3 reset codes per hour.
    email_key = f"forgot:{email.lower()}"
    if _email_throttle_count(db, email_key) >= 3:
        # Uniform response — do not reveal throttling state either.
        return generic_response
    _record_failed_code_attempt(db, email_key)

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Don't reveal if email exists (security best practice)
            return generic_response

        # Generate 6-digit reset code (short validity: 10 min by default).
        reset_code = generate_verification_code(length=6, digits_only=True)
        reset_ttl = settings.PASSWORD_RESET_CODE_TTL_MINUTES or 10
        reset_expires = dt.datetime.utcnow() + dt.timedelta(minutes=reset_ttl)

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
            # NOTE: the per-email counter is deliberately NOT cleared on success
            # so the 3-codes-per-hour cap cannot be looped by mailbox owners.

        return generic_response
    except Exception as e:
        logger.error(f"Password reset request failed: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process password reset request"
        )


@router.post("/api/auth/reset-password")
async def reset_password(
    request: Request,
    code: str = Body(...),
    new_password: str = Body(...),
    email: Optional[str] = Body(None),
    db: Session = Depends(get_db)
):
    """Reset password using reset code.

    Brute-force protection (layered):
    - max 5 failed attempts per IP per 15-minute window (unknown-code guessing);
    - max 5 failed attempts per ACCOUNT per 15-minute window, after which the
      stored code is invalidated and a fresh resend is required;
    - constant-time code comparison (no early-exit oracle).
    """
    from hmac import compare_digest

    from ...db import User

    try:
        rate_limit(request, max_requests=10, window=300)
    except HTTPException:
        raise

    client_ip = request.client.host if request.client else "unknown"
    attempt_key = f"reset:{client_ip}"

    try:
        # Resolve the target account. `email` is optional for backward
        # compatibility (the SPA posts code-only); when supplied, the account
        # is bound by email so ALL guesses count against that account.
        supplied = str(code or "")
        user = None
        if email:
            user = db.query(User).filter(User.email == email).first()
        else:
            # Legacy code-only lookup (row location; the constant-time compare
            # below still runs exactly once to keep timing uniform).
            user = db.query(User).filter(User.password_reset_token == supplied).first()

        if user is not None:
            account_key: Optional[str] = f"reset:account:{user.id}"
        elif email:
            account_key = f"reset:account-email:{email.lower()}"
        else:
            account_key = None

        # Per-account brute-force gate (checked first): too many failed guesses
        # against THIS account invalidates the live code (a resend is required).
        if account_key is not None and _code_attempts_exceeded(db, account_key):
            if user is not None and getattr(user, 'password_reset_token', None):
                setattr(user, 'password_reset_token', None)
                setattr(user, 'password_reset_expires', None)
                db.commit()
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect attempts. Request a new reset code."
            )

        if _code_attempts_exceeded(db, attempt_key):
            # Per-IP lockout. (The targeted account cannot be identified from an
            # arbitrary wrong code, so no DB invalidation here; the code still
            # expires on its own TTL.)
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect attempts. Request a new reset code."
            )

        # Constant-time comparison against the stored code (dummy when no row
        # matched, keeping the no-match/mismatch paths timing-uniform and the
        # response uniform to avoid account enumeration).
        stored = str(getattr(user, 'password_reset_token', None) or "") if user else ""
        if not stored or not compare_digest(stored, supplied):
            _record_failed_code_attempt(db, attempt_key)
            if account_key is not None:
                _record_failed_code_attempt(db, account_key)
            raise HTTPException(status_code=400, detail="Invalid or expired reset code")

        # Check code expiration (use getattr to avoid type checker issues)
        expires = getattr(user, 'password_reset_expires', None)
        if expires is None or expires < dt.datetime.utcnow():
            # Expired-code guesses count toward both the per-IP and the
            # per-account lockouts.
            _record_failed_code_attempt(db, attempt_key)
            if account_key is not None:
                _record_failed_code_attempt(db, account_key)
            raise HTTPException(status_code=400, detail="Reset code has expired")

        # Validate password strength
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

        # Update password (use setattr to avoid type checker issues)
        setattr(user, 'password_hash', get_password_hash(new_password))
        setattr(user, 'password_reset_token', None)
        setattr(user, 'password_reset_expires', None)
        # Revoke all existing JWTs for this account (tokens issued before now die).
        setattr(user, 'password_changed_at', dt.datetime.utcnow())
        db.commit()
        _clear_code_attempts(db, attempt_key)
        if account_key is not None:
            _clear_code_attempts(db, account_key)

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
