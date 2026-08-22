"""
P1.1 interview abandon-flow regression tests.

Covers:
- HMAC abandon-token issuance/verification (unit)
- /api/interview/abandon-beacon/{session_id}: valid token -> 204 + session marked
  abandoned; invalid token -> 403; missing token -> 401
- Explicit quit path POST /api/interview/abandon/{session_id} with Bearer auth
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

from resume_pipeline.app import app
from resume_pipeline.auth import get_current_user
from resume_pipeline.db import Base, User, Applicant, InterviewSession, SessionLocal
from resume_pipeline.interview import router as interview_router
from resume_pipeline.interview.router import (
    _make_abandon_token,
    _abandon_token_is_valid,
    get_db as interview_get_db,
)

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

STUDENT_ID = 11


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=STUDENT_ID, email="abandon_test@example.com", password_hash="x",
            role="student", name="Abandon Test", is_active=True, is_verified=True,
        )
        applicant = Applicant(
            user_id=STUDENT_ID, applicant_id="app_abandontest", display_name="Abandon Test"
        )
        db.add_all([user, applicant])
        db.flush()

        session = InterviewSession(
            id=str(uuid.uuid4()), applicant_id=applicant.id,
            interview_type="technical", difficulty="medium", total_questions=5,
            status="active",
        )
        db.add(session)
        db.commit()

        yield {"db": db, "session": session, "applicant": applicant}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def _override_db(env):
    def override():
        try:
            yield env["db"]
        finally:
            pass
    return override


@pytest.fixture(name="beacon_client")
def fixture_beacon_client(env):
    # No auth override: beacon endpoint must work WITHOUT a Bearer token.
    app.dependency_overrides[interview_get_db] = _override_db(env)
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(name="authed_client")
def fixture_authed_client(env):
    def override_user():
        return env["db"].query(User).filter(User.id == STUDENT_ID).first()

    app.dependency_overrides[interview_get_db] = _override_db(env)
    app.dependency_overrides[get_current_user] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Token unit tests
# ---------------------------------------------------------------------------

def test_abandon_token_deterministic_and_bound_to_session(env):
    s = env["session"]
    t1 = _make_abandon_token(s.id, s.applicant_id)
    t2 = _make_abandon_token(s.id, s.applicant_id)
    assert t1 == t2 and len(t1) == 64

    assert _abandon_token_is_valid(s, t1)
    assert not _abandon_token_is_valid(s, "f" * 64)
    assert not _abandon_token_is_valid(s, None)


def test_abandon_token_rejects_other_sessions(env):
    s = env["session"]
    other = InterviewSession(
        id=str(uuid.uuid4()), applicant_id=s.applicant_id,
        interview_type="hr", difficulty="easy", total_questions=5, status="active",
    )
    token = _make_abandon_token(other.id, other.applicant_id)
    assert not _abandon_token_is_valid(s, token)


# ---------------------------------------------------------------------------
# Beacon endpoint
# ---------------------------------------------------------------------------

def test_beacon_abandon_with_valid_token_marks_session_abandoned(beacon_client, env):
    s = env["session"]
    token = _make_abandon_token(s.id, s.applicant_id)
    resp = beacon_client.post(f"/api/interview/abandon-beacon/{s.id}?abandon_token={token}")
    assert resp.status_code == 204
    env["db"].refresh(s)
    assert s.status == "abandoned"


def test_beacon_abandon_missing_token_unauthorized(beacon_client, env):
    s = env["session"]
    resp = beacon_client.post(f"/api/interview/abandon-beacon/{s.id}")
    assert resp.status_code == 401


def test_beacon_abandon_invalid_token_forbidden(beacon_client, env):
    s = env["session"]
    resp = beacon_client.post(f"/api/interview/abandon-beacon/{s.id}?abandon_token={'a' * 64}")
    assert resp.status_code == 403
    env["db"].refresh(s)
    assert s.status == "active"


def test_beacon_abandon_unknown_session_404(beacon_client):
    token = _make_abandon_token(str(uuid.uuid4()), 999)
    resp = beacon_client.post(
        f"/api/interview/abandon-beacon/{uuid.uuid4()}?abandon_token={token}"
    )
    assert resp.status_code in (403, 404)


# ---------------------------------------------------------------------------
# Explicit quit endpoint (Bearer auth)
# ---------------------------------------------------------------------------

def test_explicit_quit_abandons_active_session(authed_client, env):
    s = env["session"]
    resp = authed_client.post(f"/api/interview/abandon/{s.id}")
    assert resp.status_code == 204
    env["db"].refresh(s)
    assert s.status == "abandoned"

