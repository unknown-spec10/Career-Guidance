"""Admin seeding from environment settings.

Creates a verified, active admin user on startup when ADMIN_EMAIL and
ADMIN_PASSWORD are both set and no user with that email exists. Idempotent:
an existing user with the same email is left untouched. Never logs
credential values.
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def ensure_admin_user(db: Session, email: str, password: str):
    """Create a verified active admin for ``email`` if none exists.

    Args:
        db: Open SQLAlchemy session (caller owns commit/rollback lifecycle,
            but this function commits on successful insert).
        email: Admin email (normalized to lowercase + stripped).
        password: Plaintext password, hashed with bcrypt before storage.

    Returns:
        The existing or newly created ``User``, or ``None`` when inputs
        are empty.
    """
    from .db import User
    from .auth import get_password_hash

    normalized = (email or "").strip().lower()
    if not normalized or not password:
        return None

    existing = db.query(User).filter(User.email == normalized).first()
    if existing is not None:
        return existing

    new_admin = User(
        email=normalized,
        password_hash=get_password_hash(password),
        name="Administrator",
        role="admin",
        is_active=True,
        is_verified=True,
        verification_token=None,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    logger.info("Admin user seeded for email domain check passed")
    return new_admin


def seed_admin_from_env(db: Optional[Session] = None):
    """Seed the admin user from ``settings.ADMIN_EMAIL``/``ADMIN_PASSWORD``.

    No-op when either value is empty. When ``db`` is omitted, a session is
    opened from ``SessionLocal`` and closed afterwards. Credential values
    are never logged.
    """
    from .config import settings

    admin_email = (getattr(settings, "ADMIN_EMAIL", "") or "").strip()
    admin_password = getattr(settings, "ADMIN_PASSWORD", "") or ""
    if not admin_email or not admin_password:
        return None

    owns_session = db is None
    if owns_session:
        from .db import SessionLocal

        db = SessionLocal()
    assert db is not None
    try:
        return ensure_admin_user(db, admin_email, admin_password)
    except Exception as e:
        logger.warning("Admin seeding failed: %s", type(e).__name__)
        try:
            db.rollback()
        except Exception:
            pass
        return None
    finally:
        if owns_session:
            try:
                db.close()
            except Exception:
                pass
