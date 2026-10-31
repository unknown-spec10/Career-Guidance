"""Authentication and authorization utilities."""
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Stored in password_hash for accounts whose only credential is a third-party
# provider. bcrypt can never produce this string, so no password can match it;
# a password reset replaces it with a real hash and flips login_method back to
# "password".
OAUTH_PASSWORD_SENTINEL = "!oauth-no-password"

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
# HTTP Bearer scheme with auto_error=False to allow optional tokens
_optional_bearer = HTTPBearer(auto_error=False)


async def get_current_user_optional(creds: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer)):
    """Optional current user dependency. Returns user object if a valid Bearer token is provided, else None."""
    from .db import User, SessionLocal
    if creds is None:
        return None
    token = creds.credentials
    db = SessionLocal()
    try:
        payload = decode_access_token(token)
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            return None
        user_id = int(user_id_raw)
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return None
        if not getattr(user, "is_active", True):
            return None
        if user is not None and _token_is_revoked(payload, user):
            return None
        return user
    except Exception:
        return None
    finally:
        try:
            db.close()
        except Exception:
            pass

# JWT settings from config/env.
# NOTE: SECRET_KEY is resolved lazily via _active_secret_key() (never the
# import-time value below) so tests may override settings.SECRET_KEY and so a
# missing/weak key can never silently sign with "".
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# Ephemeral per-boot JWT key for non-production when no strong SECRET_KEY is
# configured. Held only in memory; invalidated on restart (fail-safe default).
_EPHEMERAL_SECRET_KEY: Optional[str] = None
_EPHEMERAL_WARNED = False


def _is_production() -> bool:
    """True when running on a production platform (Render) or APP_ENV=production."""
    return (
        os.environ.get("RENDER") is not None
        or str(getattr(settings, "APP_ENV", "development")).lower() == "production"
    )


def _active_secret_key() -> str:
    """Resolve the JWT signing key in effect right now.

    - Strong configured key (>= 32 chars) → used as-is (tests override via env).
    - Production + missing/weak key → raise (refuse to start/serve).
    - Non-prod + missing/weak key → one ephemeral random key per boot with a
      loud warning (tokens die on restart; never silently sign with "").
    """
    global _EPHEMERAL_SECRET_KEY, _EPHEMERAL_WARNED
    configured = settings.SECRET_KEY or ""
    if len(configured) >= 32:
        return configured
    if _is_production():
        raise RuntimeError(
            "SECRET_KEY is missing or shorter than 32 characters "
            "(required because APP_ENV=production or a production platform "
            "was detected). Refusing to sign tokens."
        )
    if _EPHEMERAL_SECRET_KEY is None:
        _EPHEMERAL_SECRET_KEY = secrets.token_urlsafe(48)
    if not _EPHEMERAL_WARNED:
        _EPHEMERAL_WARNED = True
        logger.warning(
            "SECURITY: SECRET_KEY is missing or weaker than 32 chars — using an "
            "EPHEMERAL per-boot JWT key. All sessions will be invalidated on "
            "restart. Set a strong SECRET_KEY (>= 32 chars) for stable logins."
        )
    return _EPHEMERAL_SECRET_KEY


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash.

    Provider-created accounts carry OAUTH_PASSWORD_SENTINEL instead of a hash,
    so no password can match until the user sets one via reset. A malformed
    hash is treated as "no password", never as a valid login.
    """
    if not hashed_password or hashed_password == OAUTH_PASSWORD_SENTINEL:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token (embeds issued-at for revocation checks)."""
    to_encode = data.copy()
    now = datetime.utcnow()
    to_encode.setdefault("iat", now)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, _active_secret_key(), algorithm=ALGORITHM)
    return encoded_jwt


def _token_is_revoked(payload: dict, user) -> bool:
    """True when the token predates the user's most recent password change.

    - Tokens carrying an `iat` are revoked iff issued before the change.
    - Legacy tokens WITHOUT an `iat` cannot prove they postdate the change,
      so they fail closed (revoked) once any credential change exists.
    - A malformed `iat` also fails closed.
    """
    changed_at = getattr(user, "password_changed_at", None)
    if changed_at is None:
        return False
    iat = payload.get("iat")
    if iat is None:
        return True  # legacy token predates revocation support
    try:
        # iat is a Unix epoch — compare in UTC against the naive-UTC column.
        # Truncating changed_at to whole seconds + `<=` closes the sub-second
        # window (a token issued in the same wall-second as the change is
        # revoked; the client simply logs in again).
        issued = datetime.utcfromtimestamp(int(iat))
    except (TypeError, ValueError, OSError):
        return True  # malformed iat on a password-changed account → fail closed
    return issued <= changed_at.replace(microsecond=0)


def decode_access_token(token: str) -> dict:
    """Decode a JWT access token"""
    try:
        payload = jwt.decode(token, _active_secret_key(), algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get the current authenticated user.

    Revocation: tokens issued before the account's most recent password
    change/reset are rejected, so a stolen token dies with the credential.
    """
    from .db import User, SessionLocal
    db = SessionLocal()
    close_db = True

    try:
        payload = decode_access_token(token)
        user_id_raw = payload.get("sub")
        if user_id_raw is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        user_id = int(user_id_raw)
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        if not getattr(user, "is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )
        if _token_is_revoked(payload, user):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired due to a password change. Please log in again.",
            )
        return user
    finally:
        if close_db:
            db.close()


def require_role(*allowed_roles: str):
    """Decorator to require specific roles"""
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return role_checker
