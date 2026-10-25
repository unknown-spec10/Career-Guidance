# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false


"""Shared FastAPI dependencies and helpers (split out of the former monolithic app module)."""


from fastapi import UploadFile, HTTPException, Request, status


from sqlalchemy.orm import Session




from typing import Optional


from collections import defaultdict


from time import time


import os








from ..config import settings, IS_SUPABASE, MAX_FILE_SIZE_MB


from ..db import Applicant


from pathlib import Path




import logging




import datetime as dt







logger = logging.getLogger(__name__)





# Background tasks are run natively using FastAPI BackgroundTasks.





# Runtime circuit breaker for async embedding queueing.


# If broker/backend is unavailable, disable enqueue attempts for this process.


_EMBEDDING_QUEUE_DISABLED = False


_EMBEDDING_BROKER_UNAVAILABLE_LOGGED = False





rate_limiting_storage = defaultdict(list)

# Failed verification/reset-code attempt tracking.
# BACKED BY THE security_attempts TABLE (migration 0007) so lockouts hold
# across multiple workers/processes — unlike rate_limiting_storage above,
# which remains per-process and is only a soft DoS guard.
MAX_CODE_ATTEMPTS = 5            # failed tries before the code is invalidated
CODE_ATTEMPT_WINDOW_SECONDS = 900  # 15 minutes


def _prune_attempts(db: Session, key: str) -> None:
    """Delete expired attempt rows for this key."""
    from ..db import SecurityAttempt
    cutoff = dt.datetime.utcnow() - dt.timedelta(seconds=CODE_ATTEMPT_WINDOW_SECONDS)
    db.query(SecurityAttempt).filter(
        SecurityAttempt.attempt_key == key,
        SecurityAttempt.created_at < cutoff,
    ).delete(synchronize_session=False)


def _count_attempts(db: Session, key: str) -> int:
    from ..db import SecurityAttempt
    cutoff = dt.datetime.utcnow() - dt.timedelta(seconds=CODE_ATTEMPT_WINDOW_SECONDS)
    return db.query(SecurityAttempt).filter(
        SecurityAttempt.attempt_key == key,
        SecurityAttempt.created_at >= cutoff,
    ).count()


def _record_failed_code_attempt(db: Session, key: str) -> int:
    """Record a failed code attempt; returns the number of recent failures."""
    from ..db import SecurityAttempt
    _prune_attempts(db, key)
    db.add(SecurityAttempt(attempt_key=key))
    db.commit()
    return _count_attempts(db, key)


def _clear_code_attempts(db: Session, key: str) -> None:
    from ..db import SecurityAttempt
    db.query(SecurityAttempt).filter(
        SecurityAttempt.attempt_key == key
    ).delete(synchronize_session=False)
    db.commit()


def _code_attempts_exceeded(db: Session, key: str) -> bool:
    return _count_attempts(db, key) >= MAX_CODE_ATTEMPTS


def _email_throttle_count(db: Session, key: str) -> int:
    """Recent throttle-counter value for email-send caps (forgot/resend)."""
    return _count_attempts(db, key)


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
    # A strong secret is mandatory in ANY production environment (APP_ENV=production
    # or a managed PaaS such as Render/AWS). Local development may run with a weak
    # key but receives a loud warning.
    secret = settings.SECRET_KEY or ""
    is_production = (
        os.environ.get("RENDER") is not None
        or getattr(settings, "APP_ENV", "development").lower() == "production"
    )
    if len(secret) < 32:
        if is_production:
            errors.append(
                "SECRET_KEY is missing or shorter than 32 characters "
                "(required because APP_ENV=production or a production platform was detected)"
            )
        else:
            warnings.append("SECRET_KEY should be at least 32 characters long")

    # Chat provider (opencode/DeepSeek serves all chat/explanation workloads).
    # Warn if no chat credentials are configured, since LLM features will
    # raise a configuration error at call time instead of serving.
    if not settings.OPENCODE_API_KEY:
        warnings.append("OPENCODE_API_KEY not set - chat features will raise (no credentials)")

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
        f"OPENCODE_API_KEY:  {'<set>' if env.get('OPENCODE_API_KEY') else '<unset>'}",
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


def get_db():
    """FastAPI dependency for database sessions"""
    from ..db import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def resolve_applicant(db: Session, applicant_id) -> Optional["Applicant"]:
    """Resolve an applicant identifier (integer DB id or external ``app_<uuid>`` string)."""
    try:
        if str(applicant_id).isdigit():
            found = db.query(Applicant).filter(Applicant.id == int(applicant_id)).first()
            if found:
                return found
    except (TypeError, ValueError):
        pass
    return db.query(Applicant).filter(Applicant.applicant_id == str(applicant_id)).first()


def authorize_applicant_access(db: Session, current_user, applicant, employer_scoped: bool = True):
    """Raise HTTPException unless current_user may access this applicant.

    Policy:
      - admin: any applicant.
      - student: only their own applicant profile.
      - employer: only applicants with at least one application to one of the
        employer's jobs (when employer_scoped=True).
    """
    role = getattr(current_user, "role", None)
    if role == "admin":
        return
    if role == "student":
        if getattr(applicant, "user_id", None) != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this profile."
            )
        return
    if employer_scoped and role == "employer":
        from ..db import Employer, JobApplication, Job
        employer = db.query(Employer).filter(Employer.user_id == current_user.id).first()
        if employer:
            linked = (
                db.query(JobApplication.id)
                .join(Job, JobApplication.job_id == Job.id)
                .filter(
                    JobApplication.applicant_id == applicant.id,
                    Job.employer_id == employer.id,
                )
                .first()
            )
            if linked:
                return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. You do not have permission to view this applicant."
    )


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


def _get_repo_root() -> Path:
    """Get the repository root directory (project root)."""
    return Path(__file__).resolve().parents[2]


def _resolve_storage_path_root() -> Path:
    p = Path(settings.FILE_STORAGE_PATH)
    if p.is_absolute():
        return p.resolve()
    return (_get_repo_root() / p).resolve()


DATA_ROOT = _resolve_storage_path_root()


VALID_JOB_STATUS_TRANSITIONS = {
    'recommended': ['applied', 'withdrawn'],
    'applied': ['interviewing', 'rejected', 'withdrawn'],
    'interviewing': ['offered', 'rejected', 'withdrawn'],
    'offered': ['accepted', 'rejected', 'withdrawn'],
    'accepted': [],  # terminal
    'rejected': [],  # terminal
    'withdrawn': []  # terminal
}


def get_user_or_404(db: Session, user_id: int):
    """Fetch a User by id or raise 404.

    Dedupe of five identical ``db.query(User).filter(User.id == ...)`` blocks
    previously repeated across ``routers/auth.py``.
    """
    from ..db import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
