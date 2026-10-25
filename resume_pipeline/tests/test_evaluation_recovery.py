"""
P1.6 interview evaluation retry/recovery regression tests.

Covers GET /api/interview/results/{session_id}:
- pending answers with attempts remaining -> "processing" + attempt incremented
- exhausted retries on failed answers -> partial results delivered (no infinite poll)
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
from resume_pipeline.interview.router import get_db as interview_get_db, MAX_EVAL_RETRIES
from resume_pipeline.db import (
    Base, User, Applicant, InterviewSession, InterviewQuestion, InterviewAnswer,
)

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

STUDENT_ID = 51


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=STUDENT_ID, email="retry@example.com", password_hash="x",
            role="student", name="Retry Test", is_active=True, is_verified=True,
        )
        applicant = Applicant(
            user_id=STUDENT_ID, applicant_id="app_retrytest", display_name="Retry Test"
        )
        db.add_all([user, applicant])
        db.flush()

        session = InterviewSession(
            id=str(uuid.uuid4()), applicant_id=applicant.id,
            interview_type="technical", difficulty="medium", total_questions=1,
            status="active",
        )
        question = InterviewQuestion(
            id=str(uuid.uuid4()), session_id=session.id,
            question_text="What is a race condition?", skill_tag="Concurrency",
            order_index=0, is_reserve=False, difficulty_level="medium",
        )
        answer = InterviewAnswer(
            id=str(uuid.uuid4()), session_id=session.id, question_id=question.id,
            answer_text="Two threads access shared state unsafely.",
            status="pending_evaluation", evaluation_attempts=0,
        )
        db.add_all([session, question, answer])
        db.commit()

        yield {"db": db, "session": session, "answer": answer}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def fixture_client(env, monkeypatch):
    def override_interview_db():
        try:
            yield env["db"]
        finally:
            pass

    def override_user():
        return env["db"].query(User).filter(User.id == STUDENT_ID).first()

    # Background retries must use the throwaway DB, not the real one.
    # (importlib needed: the package's `router` attribute shadows the submodule.)
    # Post-split the endpoints live in interview.sessions/streaming; patch those
    # plus the aggregator shim (kept for backward compatibility).
    import importlib
    interview_router_module = importlib.import_module("resume_pipeline.interview.router")
    monkeypatch.setattr(interview_router_module, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr("resume_pipeline.interview.sessions.SessionLocal", TestingSessionLocal)
    monkeypatch.setattr("resume_pipeline.interview.streaming.SessionLocal", TestingSessionLocal)

    app.dependency_overrides[interview_get_db] = override_interview_db
    app.dependency_overrides[get_current_user] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_pending_answer_poll_increments_attempts_and_returns_processing(env, client):
    resp = client.get(f"/api/interview/results/{env['session'].id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "processing"

    env["db"].refresh(env["answer"])
    assert env["answer"].evaluation_attempts == 1


def test_exhausted_retries_deliver_partial_results(env, client):
    # Simulate an answer whose evaluation kept failing.
    env["answer"].status = "evaluation_failed"
    env["answer"].evaluation_attempts = MAX_EVAL_RETRIES
    env["db"].commit()

    resp = client.get(f"/api/interview/results/{env['session'].id}")
    assert resp.status_code == 200
    data = resp.json()

    # Partial results delivered instead of endless processing.
    assert data["status"] == "complete"
    review = {q["question_id"]: q for q in data["questions_review"]}
    item = review[env["answer"].question_id]
    assert item["status"] == "evaluation_failed"
    assert item["score"] is None

    # Attempts must NOT be incremented further once exhausted.
    env["db"].refresh(env["answer"])
    assert env["answer"].evaluation_attempts == MAX_EVAL_RETRIES


def test_failed_answer_with_attempts_remaining_is_retried_then_processing(env, client):
    env["answer"].status = "evaluation_failed"
    env["answer"].evaluation_attempts = MAX_EVAL_RETRIES - 1
    env["db"].commit()

    resp = client.get(f"/api/interview/results/{env['session'].id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"

    env["db"].refresh(env["answer"])
    assert env["answer"].evaluation_attempts == MAX_EVAL_RETRIES


def test_results_ownership_enforced(env, client):
    other_session = str(uuid.uuid4())
    resp = client.get(f"/api/interview/results/{other_session}")
    assert resp.status_code == 404
