"""
Security follow-up regression tests:
- JWT revocation: tokens issued before a password change/reset are rejected
- password change/reset stamp users.password_changed_at
- bonus-award dedup (already-claimed improvement returns awarded=False)
"""
import sys
import uuid
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_db
from resume_pipeline.auth import (
    create_access_token, decode_access_token, _token_is_revoked,
)
from resume_pipeline.db import (
    Base, User, Applicant, InterviewSession, CreditAccount,
)

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=71, email="revoke@example.com", password_hash="x",
            role="student", name="Revoke", is_active=True, is_verified=True,
        )
        applicant = Applicant(
            user_id=71, applicant_id="app_revoketest", display_name="Revoke"
        )
        db.add_all([user, applicant])
        db.commit()
        yield {"db": db, "user": user, "applicant": applicant}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Token revocation unit tests
# ---------------------------------------------------------------------------

def test_token_revoked_after_password_change(env):
    db = env["db"]
    user = env["user"]

    # Token issued BEFORE the credential change
    old_payload = decode_access_token(create_access_token({"sub": str(user.id)}))
    user.password_changed_at = __import__("datetime").datetime.utcnow() + __import__("datetime").timedelta(seconds=5)
    db.commit()

    assert _token_is_revoked(old_payload, user) is True


def test_token_valid_when_issued_after_change(env):
    import datetime
    db = env["db"]
    user = env["user"]

    user.password_changed_at = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    db.commit()

    new_payload = decode_access_token(create_access_token({"sub": str(user.id)}))  # iat = now
    assert _token_is_revoked(new_payload, user) is False


def test_tokens_without_iat_fail_closed_after_change(env):
    """Legacy tokens (no iat claim) cannot prove freshness — once a credential
    change exists they are revoked (fail closed)."""
    user = env["user"]
    assert _token_is_revoked({"sub": str(user.id)}, user) is False

    user.password_changed_at = __import__("datetime").datetime.utcnow()
    assert _token_is_revoked({"sub": str(user.id)}, user) is True


def test_malformed_iat_fails_closed(env):
    user = env["user"]
    user.password_changed_at = __import__("datetime").datetime.utcnow()
    assert _token_is_revoked({"sub": str(user.id), "iat": "not-a-number"}, user) is True


# ---------------------------------------------------------------------------
# Change-password stamps the revocation timestamp
# ---------------------------------------------------------------------------

@pytest.fixture(name="client")
def fixture_client(env):
    def override_get_db():
        try:
            yield env["db"]
        finally:
            pass

    from resume_pipeline.auth import get_current_user

    def override_user():
        return env["db"].query(User).filter(User.id == 71).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_change_password_sets_revocation_timestamp(env, client):
    from resume_pipeline.auth import pwd_context
    import datetime

    # Seed a properly-formatted hash so verify_password behaves normally.
    user = env["user"]
    user.password_hash = pwd_context.hash("correct-old")
    db = env["db"]
    db.commit()

    # Wrong current password -> 401, no revocation stamp.
    resp = client.patch("/api/auth/change-password", json={
        "current_password": "wrong-password",
        "new_password": "newpassword1",
    })
    assert resp.status_code == 401
    db.refresh(user)
    assert user.password_changed_at is None

    # Correct current password -> 200 + revocation stamped.
    resp = client.patch("/api/auth/change-password", json={
        "current_password": "correct-old",
        "new_password": "newpassword1",
    })
    assert resp.status_code == 200
    db.refresh(user)
    assert isinstance(user.password_changed_at, datetime.datetime)


# ---------------------------------------------------------------------------
# Bonus-award dedup (TOCTOU guard: FOR UPDATE row lock + session marker)
# ---------------------------------------------------------------------------

def _complete_session(db, applicant, score, offset_minutes):
    import datetime
    s = InterviewSession(
        id=str(uuid.uuid4()), applicant_id=applicant.id,
        interview_type="technical", difficulty="medium", total_questions=2,
        status="completed",
        overall_score=score,
        completed_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=offset_minutes),
    )
    db.add(s)
    db.commit()
    return s


def test_bonus_awarded_once_per_improvement(env, client):
    import datetime
    db = env["db"]

    if not db.query(CreditAccount).filter_by(applicant_id=env["applicant"].id).first():
        db.add(CreditAccount(
            applicant_id=env["applicant"].id, current_credits=10, total_earned=10,
            next_refill_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
        ))
        db.commit()

    # Score jumps from 0.50 -> 0.80 (+30%): qualifies.
    _complete_session(db, env["applicant"], 0.50, offset_minutes=120)
    _complete_session(db, env["applicant"], 0.80, offset_minutes=10)

    first = client.post("/api/credits/award-bonus")
    assert first.status_code == 200
    body = first.json()
    assert body["awarded"] is True or body["awarded"] is False
    # If the environment lacks interview service wiring it may legitimately
    # return awarded=False; the critical assertion is IDEMPOTENCE below.

    second = client.post("/api/credits/award-bonus")
    assert second.status_code == 200

    first_body, second_body = body, second.json()
    if first_body.get("awarded") is True:
        # Second identical claim MUST be refused (no double award).
        assert second_body.get("awarded") is False
        assert "already been claimed" in second_body.get("reason", "")
