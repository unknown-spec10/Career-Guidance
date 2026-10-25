"""Email-verification auth routes (paths/methods/guards unchanged).

Part of the former ``routers/auth.py`` monolith, split for separation of
concerns. Aggregated with the sibling routers by :mod:`resume_pipeline.routers.auth`.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import datetime as dt
import logging
import secrets

from ...config import settings
from ...schemas import VerifyCodeRequest
from ..deps import (
    get_db,
    rate_limit,
    _record_failed_code_attempt,
    _clear_code_attempts,
    _code_attempts_exceeded,
    _email_throttle_count,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/auth/verify-email")
async def verify_email_disabled(token: str = Body(..., embed=True)):
    """Link-based verification disabled in this deployment."""
    raise HTTPException(status_code=410, detail="Link-based verification is disabled; use /api/auth/verify-code")


@router.post("/api/auth/verify-code")
async def verify_code(request: Request, payload: VerifyCodeRequest, db: Session = Depends(get_db)):
    """Verify user email using a short code sent via email.

    Brute-force protection: max 5 failed attempts per email per 15-minute
    window; exceeding the limit invalidates the stored code (a resend is
    required). Responses are uniform to avoid account enumeration.
    """
    from ...db import User
    from ...email_verification import is_code_expired

    try:
        rate_limit(request, max_requests=10, window=60)
    except HTTPException:
        raise

    generic_error = HTTPException(status_code=400, detail="Invalid or expired verification code")

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise generic_error

    if user.is_verified:  # type: ignore
        return {"status": "success", "message": "Email already verified"}

    if _code_attempts_exceeded(db, f"verify:{payload.email.lower()}"):
        # Lockout window reached — invalidate the code so a fresh resend is required.
        user.verification_token = None  # type: ignore
        user.verification_token_created_at = None  # type: ignore
        db.commit()
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Request a new verification code."
        )

    # Compare against stored verification_token (repurposed to store code)
    stored = getattr(user, 'verification_token', None)
    created_at = getattr(user, 'verification_token_created_at', None)
    if not stored or not created_at:
        raise generic_error

    # Stored token is in format CODE-randomsuffix; compare only the CODE part
    # with a constant-time comparison (no early-exit oracle).
    from hmac import compare_digest
    stored_code = str(stored).split('-', 1)[0]
    if not compare_digest(stored_code.strip(), str(payload.code).strip()):
        _record_failed_code_attempt(db, f"verify:{payload.email.lower()}")
        raise generic_error

    if is_code_expired(created_at, settings.VERIFICATION_CODE_TTL_MINUTES or 30):
        raise generic_error

    _clear_code_attempts(db, f"verify:{payload.email.lower()}")
    user.is_verified = True  # type: ignore
    user.verification_token = None  # type: ignore
    user.verification_token_created_at = None  # type: ignore
    db.commit()

    logger.info(f"Email verified via code for user: {user.email}")
    return {"status": "success", "message": "Email verified successfully"}


@router.post("/api/auth/resend-verification")
async def resend_verification_email(request: Request, email: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """Resend verification email.

    Rate-limited (per IP and per email) to prevent SMTP abuse. Responses are
    uniform for unknown emails and already-verified accounts so this endpoint
    cannot be used to enumerate registered users.
    """
    from ...db import User
    from ...email_verification import (
        generate_verification_code,
        send_verification_code_email,
    )

    try:
        rate_limit(request, max_requests=5, window=300)
    except HTTPException:
        raise

    generic_response = {"status": "success", "message": "If the email exists and is unverified, a new code has been sent"}

    # Per-email throttle: max 3 resends per hour.
    email_key = f"resend:{email.lower()}"
    if _email_throttle_count(db, email_key) >= 3:
        return generic_response
    _record_failed_code_attempt(db, email_key)

    user = db.query(User).filter(User.email == email).first()
    if not user or getattr(user, 'is_verified', False):
        # Uniform response — no account-existence oracle.
        return generic_response

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
        logger.warning(f"Verification email send failed for {email}")
        # Uniform response even on failure (do not leak account state)
        return generic_response

    # NOTE: the per-email counter is deliberately NOT cleared on success so
    # the 3-resends-per-hour cap cannot be looped.
    return generic_response
