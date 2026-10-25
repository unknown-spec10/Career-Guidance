"""Google OAuth auth routes (paths/methods/guards unchanged).

Part of the former ``routers/auth.py`` monolith, split for separation of
concerns. Aggregated with the sibling routers by :mod:`resume_pipeline.routers.auth`.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from typing import Dict, Optional, Tuple
import datetime as dt
import hashlib
import hmac
import logging
import secrets
import time

from ...config import settings
from ...auth import get_password_hash, create_access_token
from ..deps import get_db, rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()

# OAuth state + exchange-code TTLs (10 minutes each).
OAUTH_STATE_TTL_SECONDS = 600
OAUTH_EXCHANGE_TTL_SECONDS = 600

# Single-use OAuth exchange codes: {code: (user_id, expires_at_epoch)}.
# In-memory like the existing per-process rate limiter; entries are short-lived
# (10 min) and single-use (popped on redeem), bounding replay exposure.
_OAUTH_EXCHANGE_CODES: Dict[str, Tuple[int, float]] = {}


def _oauth_hmac_key() -> bytes:
    """HMAC key for OAuth state/exchange signing (fails closed, never "")."""
    from ...auth import _active_secret_key
    return _active_secret_key().encode("utf-8")


def sign_oauth_state(role: str) -> str:
    """Mint a timestamped HMAC-signed OAuth state token for `role`.

    Format: ``role:unix_ts:nonce:hex_hmac``. The role is server-derived on
    verify — a client cannot assert or escalate it.
    """
    if role not in ("student", "employer"):
        role = "student"
    body = f"{role}:{int(time.time())}:{secrets.token_hex(8)}"
    sig = hmac.new(_oauth_hmac_key(), body.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{body}:{sig}"


def verify_oauth_state(state: str) -> str:
    """Verify a signed OAuth state token; returns the role or raises ValueError."""
    parts = (state or "").split(":")
    if len(parts) != 4:
        raise ValueError("malformed state")
    role, ts_raw, _nonce, sig = parts
    if role not in ("student", "employer"):
        raise ValueError("invalid role")
    try:
        ts = int(ts_raw)
    except ValueError:
        raise ValueError("invalid timestamp")
    body = f"{role}:{ts_raw}:{parts[2]}"
    expected = hmac.new(_oauth_hmac_key(), body.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        raise ValueError("bad signature")
    if abs(time.time() - ts) > OAUTH_STATE_TTL_SECONDS:
        raise ValueError("expired state")
    return role


def _mint_oauth_exchange(user_id: int) -> str:
    """Mint a single-use opaque exchange code (10-min TTL) for `user_id`."""
    now = time.time()
    # Opportunistic prune of expired entries so the dict cannot grow unbounded.
    for code, (_uid, exp) in list(_OAUTH_EXCHANGE_CODES.items()):
        if exp < now:
            _OAUTH_EXCHANGE_CODES.pop(code, None)
    code = secrets.token_urlsafe(32)
    _OAUTH_EXCHANGE_CODES[code] = (user_id, now + OAUTH_EXCHANGE_TTL_SECONDS)
    return code


def _redeem_oauth_exchange(code: str) -> int:
    """Consume a single-use exchange code; returns user_id or raises ValueError."""
    entry = _OAUTH_EXCHANGE_CODES.pop(code or "", None)
    if entry is None:
        raise ValueError("invalid exchange code")
    user_id, exp = entry
    if time.time() > exp:
        raise ValueError("expired exchange code")
    return user_id


@router.get("/api/auth/google/login")
async def google_login(
    role: str = Query("student", regex="^(student|employer)$"),
):
    """
    Redirects the user to Google's OAuth2 authorization URL.
    """
    import urllib.parse

    # Check if Google Client ID is configured
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured on this server."
        )

    # State parameter preserves the user's role choice with HMAC-signed,
    # timestamped CSRF protection (10-min expiry). The role is derived
    # server-side on callback — never client-asserted.
    state_payload = sign_oauth_state(role)

    # Construct google redirect callback URL
    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/callback"

    # Google OAuth2 Authorization URL
    google_auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state_payload,
        "access_type": "online",
        "prompt": "consent"
    }

    auth_uri = f"{google_auth_url}?{urllib.parse.urlencode(params)}"

    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=auth_uri)


@router.get("/api/auth/google/callback")
async def google_callback(
    code: str = Query(...),
    state: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Callback URI where Google redirects the user.
    """
    import urllib.parse
    import httpx
    from ...db import User, Employer

    # Parse role from the HMAC-signed state (server-derived, never
    # client-asserted). A missing state keeps the legacy default; a present
    # but tampered/expired state is rejected outright.
    role = "student"
    if state:
        try:
            role = verify_oauth_state(state)
        except ValueError as exc:
            logger.warning("Rejecting Google OAuth callback with invalid state: %s", exc)
            error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote(
                "Invalid or expired login request. Please try signing in again."
            )
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=error_url)

    # Check if Google Client ID is configured
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        # Redirect to frontend with error
        error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Google OAuth is not configured on this server.")
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=error_url)

    # Redirect URI must match the one sent in login request exactly
    redirect_uri = f"{settings.BACKEND_URL}/api/auth/google/callback"

    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }

    try:
        async with httpx.AsyncClient() as client:
            # Exchange authorization code for tokens
            token_response = await client.post(token_url, data=token_data, timeout=10.0)
            if token_response.status_code != 200:
                logger.error(f"Google OAuth token exchange failed: {token_response.text}")
                error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Failed to retrieve access token from Google.")
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=error_url)

            tokens = token_response.json()
            access_token = tokens.get("access_token")

            # Fetch user details from Google userinfo API
            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            userinfo_response = await client.get(userinfo_url, headers=headers, timeout=10.0)
            if userinfo_response.status_code != 200:
                logger.error(f"Google Userinfo API failed: {userinfo_response.text}")
                error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Failed to fetch user details from Google.")
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=error_url)

            user_info = userinfo_response.json()
            email = user_info.get("email")
            name = user_info.get("name") or user_info.get("given_name") or email.split("@")[0]

            if not email:
                error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote("Google account email is required.")
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=error_url)

            email = email.lower().strip()

            # Check if user exists
            user = db.query(User).filter(User.email == email).first()
            if not user:
                # User does not exist, perform silent registration
                # Assign a random password hash since login is via OAuth
                random_pass = secrets.token_hex(16)
                hashed_password = get_password_hash(random_pass)

                # Create user, default is_verified to True because Google verified their email
                user = User(
                    email=email,
                    password_hash=hashed_password,
                    name=name,
                    role=role,
                    is_active=True,
                    is_verified=True,
                    verification_token=None,
                    verification_token_created_at=dt.datetime.utcnow()
                )
                db.add(user)
                db.commit()
                db.refresh(user)

                # Create profile record if user is an employer
                if role == "employer":
                    employer = Employer(
                        user_id=user.id,
                        company_name=name,
                        is_verified=False
                    )
                    db.add(employer)
                    db.commit()

                logger.info(f"Registered new Google OAuth user: {email} with role: {role}")
            else:
                # User exists. Ensure their email is marked as verified since they logged in via Google
                if not user.is_verified:
                    user.is_verified = True
                    db.add(user)
                    db.commit()
                logger.info(f"Logged in existing Google OAuth user: {email}")

            # No long-lived JWT is ever placed in the URL. Instead, mint a
            # short-lived (10-min) single-use exchange code; the SPA redeems it
            # via POST /api/auth/google/exchange (token returned in the body).
            exchange_code = _mint_oauth_exchange(user.id)
            redirect_url = f"{settings.FRONTEND_URL}/login?exchange={exchange_code}"
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=redirect_url)

    except Exception as e:
        logger.error(f"Error during Google OAuth callback processing: {e}")
        error_url = f"{settings.FRONTEND_URL}/login?error=" + urllib.parse.quote(f"Authentication error: {str(e)}")
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=error_url)


@router.post("/api/auth/google/exchange")
async def google_exchange(
    request: Request,
    code: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    """Redeem a single-use OAuth exchange code for a session JWT (POST body).

    The JWT is returned in the response body — never in a URL — closing the
    token-in-query leak. Codes expire after 10 minutes and are consumed on
    first use (replay returns 400).
    """
    from ...db import User

    try:
        rate_limit(request, max_requests=10, window=60)
    except HTTPException:
        raise

    try:
        user_id = _redeem_oauth_exchange(code)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired exchange code. Please sign in again.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is no longer available. Please sign in again.",
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    }
