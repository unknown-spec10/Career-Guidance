# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""Admin backend (v1): user/job/credit/config/audit management.

Every endpoint requires the ``admin`` role via :func:`auth.require_role`.
Read endpoints aggregate existing models; write endpoints record an
:class:`db.AuditLog` row describing actor, action, and target.
"""
import datetime as dt
import logging
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from ..auth import require_role
from ..db import (
    Applicant,
    AuditLog,
    CreditAccount,
    CreditTransaction,
    Employer,
    Job,
    SecurityAttempt,
    SystemConfiguration,
    Upload,
    User,
)
from ..schemas import AdminCreditAdjustment
from .deps import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_JOB_STATUSES = ("pending", "approved", "rejected", "expired")


class AdminUserUpdate(BaseModel):
    """Only ``is_active`` may change here; anything else is rejected."""

    model_config = ConfigDict(extra="forbid")

    is_active: bool


class JobRejectBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Optional[str] = Field(default=None, max_length=500)


def _clamp_pagination(skip: int, limit: int) -> tuple[int, int]:
    return max(0, skip), min(max(1, limit), 100)


def _write_audit(
    db: Session,
    action: str,
    target_type: str,
    target_id: Optional[int],
    user_id: Optional[int],
    details: Optional[dict] = None,
) -> None:
    """Insert an AuditLog row; never fails the admin write it describes."""
    try:
        db.add(
            AuditLog(
                action=action,
                target_type=target_type,
                target_id=target_id,
                user_id=user_id,
                details=details or {},
            )
        )
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create admin audit log ({action}): {e}")
        try:
            db.rollback()
        except Exception:
            pass


def _user_dict(user: User) -> dict:
    created = getattr(user, "created_at", None)
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "is_active": getattr(user, "is_active", True),
        "is_verified": getattr(user, "is_verified", False),
        "created_at": created.isoformat() if created else None,
    }


# ============================================================
# OVERVIEW
# ============================================================

@router.get("/api/admin/overview")
async def admin_overview(
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Counts of users/applicants/uploads, jobs grouped by status, credit
    totals, plus the latest audit rows and recent security attempts."""
    users_total = db.query(func.count(User.id)).scalar() or 0
    applicants_total = db.query(func.count(Applicant.id)).scalar() or 0
    uploads_total = db.query(func.count(Upload.id)).scalar() or 0

    jobs_by_status: dict[str, int] = {}
    for job_status, count in db.query(Job.status, func.count(Job.id)).group_by(Job.status).all():
        jobs_by_status[str(job_status)] = int(count)

    credit_totals = (
        db.query(
            func.count(CreditAccount.id),
            func.coalesce(func.sum(CreditAccount.current_credits), 0),
            func.coalesce(func.sum(CreditAccount.total_earned), 0),
            func.coalesce(func.sum(CreditAccount.total_spent), 0),
        ).first()
        or (0, 0, 0, 0)
    )

    latest_audits = (
        db.query(AuditLog).order_by(desc(AuditLog.id)).limit(10).all()
    )
    recent_attempts = (
        db.query(SecurityAttempt).order_by(desc(SecurityAttempt.id)).limit(10).all()
    )

    return {
        "users_total": int(users_total),
        "applicants_total": int(applicants_total),
        "uploads_total": int(uploads_total),
        "jobs_by_status": jobs_by_status,
        "credit_totals": {
            "accounts": int(credit_totals[0] or 0),
            "current_credits": int(credit_totals[1] or 0),
            "total_earned": int(credit_totals[2] or 0),
            "total_spent": int(credit_totals[3] or 0),
        },
        "latest_audits": [
            {
                "id": a.id,
                "action": a.action,
                "target_type": a.target_type,
                "target_id": a.target_id,
                "user_id": a.user_id,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in latest_audits
        ],
        "recent_security_attempts": [
            {
                "id": s.id,
                "attempt_key": s.attempt_key,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in recent_attempts
        ],
    }


# ============================================================
# USERS
# ============================================================

@router.get("/api/admin/users")
async def admin_list_users(
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = Query(default=None),
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Paginated user list with optional email/name search."""
    skip, limit = _clamp_pagination(skip, limit)
    query = db.query(User)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(or_(User.email.ilike(pattern), User.name.ilike(pattern)))
    total = query.count()
    users = query.order_by(desc(User.id)).offset(skip).limit(limit).all()
    return {"users": [_user_dict(u) for u in users], "total": total}


@router.patch("/api/admin/users/{user_id}")
async def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Set ``is_active`` only. Self-deactivation is rejected; role changes
    are rejected by the request schema (extra fields → 422)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )
    old_value = bool(getattr(user, "is_active", True))
    setattr(user, "is_active", payload.is_active)
    db.commit()
    db.refresh(user)
    logger.info(f"Admin {current_user.email} set user {user.id} is_active={payload.is_active}")
    _write_audit(
        db,
        action="admin_user_active_update",
        target_type="User",
        target_id=user.id,
        user_id=current_user.id,
        details={"old_is_active": old_value, "new_is_active": bool(payload.is_active)},
    )
    return _user_dict(user)


# ============================================================
# JOBS
# ============================================================

@router.get("/api/admin/jobs")
async def admin_list_jobs(
    status_filter: str = Query(default="pending", alias="status"),
    skip: int = 0,
    limit: int = 20,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Paginated jobs filtered by status (default pending), including the
    employer's company name."""
    if status_filter not in VALID_JOB_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_JOB_STATUSES)}",
        )
    skip, limit = _clamp_pagination(skip, limit)
    base = db.query(Job).filter(Job.status == status_filter)
    total = base.count()
    jobs = base.order_by(desc(Job.created_at)).offset(skip).limit(limit).all()
    out = []
    for job in jobs:
        company = job.employer.company_name if getattr(job, "employer", None) else None
        created = getattr(job, "created_at", None)
        expires = getattr(job, "expires_at", None)
        out.append(
            {
                "id": job.id,
                "title": job.title,
                "status": job.status,
                "employer_id": job.employer_id,
                "company_name": company,
                "location_city": job.location_city,
                "created_at": created.isoformat() if created else None,
                "expires_at": expires.isoformat() if expires else None,
            }
        )
    return {"jobs": out, "total": total}


def _transition_job_from_pending(
    db: Session, job_id: int, new_status: str, admin_user, reason: Optional[str] = None
) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if getattr(job, "status", None) != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is not pending (current status: {getattr(job, 'status', None)})",
        )
    job.status = new_status  # type: ignore[assignment]
    if reason is not None:
        job.rejection_reason = reason  # type: ignore[assignment]
    job.reviewed_by = admin_user.id  # type: ignore[assignment]
    job.reviewed_at = dt.datetime.utcnow()  # type: ignore[assignment]
    db.commit()
    db.refresh(job)
    logger.info(f"Admin {admin_user.email} set job {job_id} status={new_status}")
    _write_audit(
        db,
        action=f"admin_job_{new_status}",
        target_type="Job",
        target_id=job_id,
        user_id=admin_user.id,
        details={"new_status": new_status, "reason": reason},
    )
    return job


@router.post("/api/admin/jobs/{job_id}/approve")
async def admin_approve_job(
    job_id: int,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Approve a pending job."""
    job = _transition_job_from_pending(db, job_id, "approved", current_user)
    return {"id": job.id, "status": job.status}


@router.post("/api/admin/jobs/{job_id}/reject")
async def admin_reject_job(
    job_id: int,
    payload: Optional[JobRejectBody] = Body(default=None),
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Reject a pending job (optional ``{"reason": ...}`` body)."""
    reason = payload.reason if payload and payload.reason else None
    job = _transition_job_from_pending(db, job_id, "rejected", current_user, reason=reason)
    return {"id": job.id, "status": job.status}


# ============================================================
# CREDITS
# ============================================================

@router.get("/api/admin/credits/transactions")
async def admin_list_credit_transactions(
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = Query(default=None, description="Filter by user email"),
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Paginated credit transactions, newest first, with optional user-email
    search filter."""
    skip, limit = _clamp_pagination(skip, limit)
    query = (
        db.query(CreditTransaction, User.email.label("user_email"), Applicant.id.label("applicant_id"))
        .join(CreditAccount, CreditTransaction.account_id == CreditAccount.id)
        .join(Applicant, CreditAccount.applicant_id == Applicant.id)
        .join(User, Applicant.user_id == User.id)
    )
    if search:
        query = query.filter(User.email.ilike(f"%{search.strip()}%"))
    total = query.count()
    rows = query.order_by(desc(CreditTransaction.id)).offset(skip).limit(limit).all()
    transactions = []
    for tx, user_email, applicant_id in rows:
        created = getattr(tx, "created_at", None)
        transactions.append(
            {
                "id": tx.id,
                "transaction_type": getattr(tx, "transaction_type", None),
                "amount": getattr(tx, "amount", None),
                "balance_after": getattr(tx, "balance_after", None),
                "activity_type": getattr(tx, "activity_type", None),
                "description": getattr(tx, "description", None),
                "account_id": getattr(tx, "account_id", None),
                "applicant_id": applicant_id,
                "user_email": user_email,
                "created_at": created.isoformat() if created else None,
            }
        )
    return {"transactions": transactions, "total": total}


@router.post("/api/admin/credits/adjust")
async def admin_adjust_credits(
    payload: AdminCreditAdjustment,
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Manual credit adjustment for a user.

    Uses :meth:`CreditService.add_bonus_credits` — the same bonus-transaction
    path the student ``/api/credits/upgrade`` flow writes — so the balance
    update and the transaction row stay consistent.
    """
    from ..core.credit_service import CreditService

    applicant = db.query(Applicant).filter(Applicant.id == payload.applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    service = CreditService(db)
    account = service.get_or_create_account(applicant.id)
    if (getattr(account, "current_credits", 0) or 0) + payload.amount < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Adjustment would make the balance negative",
        )
    transaction = service.add_bonus_credits(
        applicant.id,
        payload.amount,
        admin_email=getattr(current_user, "email", "admin"),
        reason=payload.reason,
    )
    db.refresh(account)
    logger.info(
        f"Admin {current_user.email} adjusted credits for applicant {applicant.id} by {payload.amount}"
    )
    _write_audit(
        db,
        action="admin_credit_adjust",
        target_type="CreditAccount",
        target_id=account.id,
        user_id=current_user.id,
        details={
            "applicant_id": applicant.id,
            "amount": payload.amount,
            "reason": payload.reason,
            "balance_after": getattr(account, "current_credits", None),
        },
    )
    created = getattr(transaction, "created_at", None)
    return {
        "applicant_id": applicant.id,
        "current_credits": getattr(account, "current_credits", None),
        "transaction": {
            "id": transaction.id,
            "transaction_type": getattr(transaction, "transaction_type", None),
            "amount": getattr(transaction, "amount", None),
            "balance_after": getattr(transaction, "balance_after", None),
            "activity_type": getattr(transaction, "activity_type", None),
            "description": getattr(transaction, "description", None),
            "created_at": created.isoformat() if created else None,
        },
    }


# ============================================================
# CONFIG + AUDIT LOGS
# ============================================================

@router.get("/api/admin/config")
async def admin_list_config(
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Read-only list of SystemConfiguration key/value entries."""
    entries = db.query(SystemConfiguration).order_by(SystemConfiguration.key.asc()).all()
    return {
        "config": [
            {
                "key": e.key,
                "value": e.value,
                "description": e.description,
                "category": e.category,
                "updated_by": e.updated_by,
            }
            for e in entries
        ]
    }


@router.get("/api/admin/audit-logs")
async def admin_list_audit_logs(
    skip: int = 0,
    limit: int = 20,
    actor: Optional[int] = Query(default=None, description="Filter by user id"),
    action: Optional[str] = Query(default=None, description="Filter by action name"),
    current_user=Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Paginated audit logs, newest first, filterable by actor or action."""
    skip, limit = _clamp_pagination(skip, limit)
    query = db.query(AuditLog)
    if actor is not None:
        query = query.filter(AuditLog.user_id == actor)
    if action:
        query = query.filter(AuditLog.action == action)
    total = query.count()
    rows = query.order_by(desc(AuditLog.id)).offset(skip).limit(limit).all()
    return {
        "logs": [
            {
                "id": r.id,
                "action": r.action,
                "target_type": r.target_type,
                "target_id": r.target_id,
                "user_id": r.user_id,
                "details": r.details,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": total,
    }
