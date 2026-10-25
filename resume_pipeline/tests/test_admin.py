"""Admin backend v1 tests.

Covers: registration lockdown (student-only), admin seeding idempotency,
admin-guard matrix (student 403 / admin 200), deactivate/reactivate flow,
job approve/reject from pending, credit adjust + transaction list, audit rows.
"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_db
from resume_pipeline.auth import get_current_user
from resume_pipeline.db import (
    Base,
    Applicant,
    AuditLog,
    CreditAccount,
    CreditTransaction,
    Employer,
    Job,
    SystemConfiguration,
    User,
)

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

STUDENT_ID = 501
ADMIN_ID = 502


def _seed_base(db):
    db.add_all(
        [
            User(
                id=STUDENT_ID,
                email="student@example.com",
                password_hash="fakehash",
                role="student",
                name="Student User",
                is_active=True,
                is_verified=True,
            ),
            User(
                id=ADMIN_ID,
                email="admin@example.com",
                password_hash="fakehash",
                role="admin",
                name="Admin User",
                is_active=True,
                is_verified=True,
            ),
        ]
    )
    db.flush()
    applicant = Applicant(
        user_id=STUDENT_ID, applicant_id="app_admintest", display_name="Student User"
    )
    db.add(applicant)
    db.flush()
    import datetime as _dt

    db.add(
        CreditAccount(
            applicant_id=applicant.id,
            current_credits=60,
            total_earned=60,
            total_spent=0,
            next_refill_at=_dt.datetime.utcnow() + _dt.timedelta(days=7),
        )
    )
    employer = Employer(user_id=None, company_name="Acme Corp")
    db.add(employer)
    db.flush()
    job_approve = Job(employer_id=employer.id, title="Approve Me", status="pending")
    job_reject = Job(employer_id=employer.id, title="Reject Me", status="pending")
    db.add_all([job_approve, job_reject])
    db.flush()
    db.add(
        SystemConfiguration(
            key="test_key", value={"v": 1}, description="test", category="general"
        )
    )
    db.commit()
    return {
        "applicant_id": applicant.id,
        "employer_id": employer.id,
        "job_approve_id": job_approve.id,
        "job_reject_id": job_reject.id,
    }


@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        ids = _seed_base(db)
        yield {"db": db, **ids}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def _override_get_db(db_session):
    def override():
        try:
            yield db_session["db"]
        finally:
            pass

    return override


@pytest.fixture(name="anon_client")
def fixture_anon_client(db_session):
    app.dependency_overrides[get_db] = _override_get_db(db_session)
    try:
        from resume_pipeline.interview.router import get_db as interview_get_db

        app.dependency_overrides[interview_get_db] = _override_get_db(db_session)
    except Exception:
        pass
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_client")
def fixture_auth_client(db_session):
    state = {"user_id": STUDENT_ID}

    def override_user():
        return db_session["db"].query(User).filter(User.id == state["user_id"]).first()

    app.dependency_overrides[get_db] = _override_get_db(db_session)
    try:
        from resume_pipeline.interview.router import get_db as interview_get_db

        app.dependency_overrides[interview_get_db] = _override_get_db(db_session)
    except Exception:
        pass
    app.dependency_overrides[get_current_user] = override_user
    client = TestClient(app)
    client.current_user_state = state  # type: ignore[attr-defined]
    yield client
    app.dependency_overrides.clear()


def login_as(client, user_id):
    client.current_user_state["user_id"] = user_id  # type: ignore[attr-defined]


# ------------------------------------------------------------------
# Registration lockdown
# ------------------------------------------------------------------


def test_register_rejects_admin_role(anon_client):
    resp = anon_client.post(
        "/api/auth/register",
        json={
            "email": "newadmin@example.com",
            "password": "password123",
            "name": "New Admin",
            "role": "admin",
        },
    )
    assert resp.status_code == 403


def test_register_rejects_employer_role(anon_client):
    resp = anon_client.post(
        "/api/auth/register",
        json={
            "email": "newemployer@example.com",
            "password": "password123",
            "name": "New Employer",
            "role": "employer",
        },
    )
    assert resp.status_code == 403


def test_register_student_succeeds_without_employer_profile(anon_client, db_session):
    resp = anon_client.post(
        "/api/auth/register",
        json={
            "email": "freshstudent@example.com",
            "password": "password123",
            "name": "Fresh Student",
            "role": "student",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "freshstudent@example.com"
    assert body["role"] == "student"
    db = db_session["db"]
    user = db.query(User).filter(User.email == "freshstudent@example.com").first()
    assert user is not None
    assert db.query(Employer).filter(Employer.user_id == user.id).first() is None


# ------------------------------------------------------------------
# Seed function
# ------------------------------------------------------------------


def test_seed_admin_creates_once_and_is_idempotent(db_session):
    from resume_pipeline.admin_seed import ensure_admin_user

    db = db_session["db"]
    created = ensure_admin_user(db, "seededonce@example.com", "fakepassword123")
    assert created is not None
    assert created.role == "admin"
    assert created.is_active is True
    assert created.is_verified is True

    again = ensure_admin_user(db, "seededonce@example.com", "fakepassword123")
    assert again.id == created.id
    assert db.query(User).filter(User.email == "seededonce@example.com").count() == 1


def test_seed_admin_from_env_uses_settings(db_session, monkeypatch):
    from resume_pipeline.admin_seed import seed_admin_from_env
    from resume_pipeline.config import settings

    monkeypatch.setattr(settings, "ADMIN_EMAIL", "envseed@example.com")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "envfakepassword123")
    first = seed_admin_from_env(db_session["db"])
    assert first is not None and first.email == "envseed@example.com"
    second = seed_admin_from_env(db_session["db"])
    assert second.id == first.id


# ------------------------------------------------------------------
# Guard matrix: student 403, admin 200
# ------------------------------------------------------------------

ADMIN_GET_ENDPOINTS = [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/jobs",
    "/api/admin/credits/transactions",
    "/api/admin/config",
    "/api/admin/audit-logs",
]


def test_student_forbidden_on_admin_gets_admin_allowed(auth_client):
    for path in ADMIN_GET_ENDPOINTS:
        login_as(auth_client, STUDENT_ID)
        assert auth_client.get(path).status_code == 403, path
        login_as(auth_client, ADMIN_ID)
        assert auth_client.get(path).status_code == 200, path


def test_student_forbidden_on_admin_writes(auth_client, db_session):
    login_as(auth_client, STUDENT_ID)
    assert (
        auth_client.patch(
            f"/api/admin/users/{STUDENT_ID}", json={"is_active": True}
        ).status_code
        == 403
    )
    assert (
        auth_client.post(
            f"/api/admin/jobs/{db_session['job_approve_id']}/approve"
        ).status_code
        == 403
    )
    assert (
        auth_client.post(
            f"/api/admin/jobs/{db_session['job_reject_id']}/reject",
            json={"reason": "not a fit"},
        ).status_code
        == 403
    )
    assert (
        auth_client.post(
            "/api/admin/credits/adjust",
            json={
                "applicant_id": db_session["applicant_id"],
                "amount": 5,
                "reason": "student must not adjust credits here",
            },
        ).status_code
        == 403
    )


# ------------------------------------------------------------------
# User activate/deactivate flows
# ------------------------------------------------------------------


def test_deactivate_then_reactivate_user(auth_client, db_session):
    login_as(auth_client, ADMIN_ID)
    resp = auth_client.patch(f"/api/admin/users/{STUDENT_ID}", json={"is_active": False})
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    resp = auth_client.patch(f"/api/admin/users/{STUDENT_ID}", json={"is_active": True})
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True

    db = db_session["db"]
    rows = (
        db.query(AuditLog)
        .filter(
            AuditLog.action == "admin_user_active_update",
            AuditLog.target_id == STUDENT_ID,
        )
        .all()
    )
    assert len(rows) >= 2


def test_self_deactivation_rejected(auth_client):
    login_as(auth_client, ADMIN_ID)
    resp = auth_client.patch(f"/api/admin/users/{ADMIN_ID}", json={"is_active": False})
    assert resp.status_code == 400


def test_role_change_rejected(auth_client):
    login_as(auth_client, ADMIN_ID)
    resp = auth_client.patch(
        f"/api/admin/users/{STUDENT_ID}", json={"is_active": True, "role": "admin"}
    )
    assert resp.status_code == 422


# ------------------------------------------------------------------
# Job approve / reject flows
# ------------------------------------------------------------------


def test_job_approve_from_pending(auth_client, db_session):
    login_as(auth_client, ADMIN_ID)
    job_id = db_session["job_approve_id"]
    resp = auth_client.post(f"/api/admin/jobs/{job_id}/approve")
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    db = db_session["db"]
    db.expire_all()
    job = db.query(Job).filter(Job.id == job_id).first()
    assert job.status == "approved"
    assert job.reviewed_by == ADMIN_ID

    # Second transition from non-pending must fail.
    assert auth_client.post(f"/api/admin/jobs/{job_id}/approve").status_code == 400

    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "admin_job_approved", AuditLog.target_id == job_id)
        .first()
    )
    assert audit is not None


def test_job_reject_from_pending(auth_client, db_session):
    login_as(auth_client, ADMIN_ID)
    job_id = db_session["job_reject_id"]
    resp = auth_client.post(f"/api/admin/jobs/{job_id}/reject", json={"reason": "no budget"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"

    db = db_session["db"]
    db.expire_all()
    job = db.query(Job).filter(Job.id == job_id).first()
    assert job.status == "rejected"

    audit = (
        db.query(AuditLog)
        .filter(AuditLog.action == "admin_job_rejected", AuditLog.target_id == job_id)
        .first()
    )
    assert audit is not None


# ------------------------------------------------------------------
# Credit adjust flow
# ------------------------------------------------------------------


def test_credit_adjust_reflected_in_balance_and_transactions(auth_client, db_session):
    login_as(auth_client, ADMIN_ID)
    db = db_session["db"]
    applicant_id = db_session["applicant_id"]
    before = (
        db.query(CreditAccount).filter(CreditAccount.applicant_id == applicant_id).first()
    )
    before_balance = before.current_credits

    resp = auth_client.post(
        "/api/admin/credits/adjust",
        json={
            "applicant_id": applicant_id,
            "amount": 15,
            "reason": "manual test adjustment reason",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["current_credits"] == before_balance + 15

    tx_list = auth_client.get(
        "/api/admin/credits/transactions?search=student@example.com"
    )
    assert tx_list.status_code == 200
    amounts = [t["amount"] for t in tx_list.json()["transactions"]]
    assert 15 in amounts

    audit = (
        db.query(AuditLog).filter(AuditLog.action == "admin_credit_adjust").first()
    )
    assert audit is not None

    # Negative adjustment that would overdraw must fail.
    resp = auth_client.post(
        "/api/admin/credits/adjust",
        json={
            "applicant_id": applicant_id,
            "amount": -1000,
            "reason": "overdraft attempt should be rejected",
        },
    )
    assert resp.status_code == 400


def test_negative_credit_adjustment_keeps_lifetime_earned(auth_client, db_session):
    """A deduction lowers the balance but must not shrink lifetime earned."""
    login_as(auth_client, ADMIN_ID)
    db = db_session["db"]
    applicant_id = db_session["applicant_id"]
    account = (
        db.query(CreditAccount).filter(CreditAccount.applicant_id == applicant_id).first()
    )
    earned_before = account.total_earned
    spent_before = account.total_spent
    balance_before = account.current_credits

    resp = auth_client.post(
        "/api/admin/credits/adjust",
        json={
            "applicant_id": applicant_id,
            "amount": -10,
            "reason": "deduction regression check",
        },
    )
    assert resp.status_code == 200
    assert resp.json()["current_credits"] == balance_before - 10

    db.expire_all()
    account = (
        db.query(CreditAccount).filter(CreditAccount.applicant_id == applicant_id).first()
    )
    assert account.current_credits == balance_before - 10
    assert account.total_earned == earned_before
    assert account.total_spent == spent_before + 10
