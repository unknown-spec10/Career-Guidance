"""
Interview UX audit follow-ups (H1/H2/M2/M3 contract proofs).

Covers:
- POST /api/interview/answer returns answer_id and drives sequencing from
  next_question (new answer -> next_question + answer_id; resubmit ->
  next_question null + answer_id; last answer -> interview_complete).
- stream_hint / stream_feedback yield an SSE {"error": ...} event (M2)
  instead of a bare [DONE] when the provider fails.
- POST /api/interview/transcribe raises 503 without STT credentials and
  serves the transcript with "mock": false when explicitly mocked (M3).
"""
import datetime
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app
from resume_pipeline.auth import get_current_user
from resume_pipeline.db import (
    Base,
    User,
    Applicant,
    InterviewSession,
    InterviewQuestion,
    InterviewAnswer,
)
from resume_pipeline.interview.router import get_db as interview_get_db

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

STUDENT_ID = 21


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=STUDENT_ID, email="uxfix_test@example.com", password_hash="x",
            role="student", name="UX Fix Test", is_active=True, is_verified=True,
        )
        applicant = Applicant(
            user_id=STUDENT_ID, applicant_id="app_uxfixtest", display_name="UX Fix Test"
        )
        db.add_all([user, applicant])
        db.flush()

        session = InterviewSession(
            id=str(uuid.uuid4()), applicant_id=applicant.id,
            interview_type="technical", difficulty="medium", total_questions=2,
            status="active",
        )
        db.add(session)
        db.flush()

        q1 = InterviewQuestion(
            id=str(uuid.uuid4()), session_id=session.id, order_index=0,
            question_text="What is REST?", skill_tag="API",
            difficulty_level="medium", expected_keywords=[],
        )
        q2 = InterviewQuestion(
            id=str(uuid.uuid4()), session_id=session.id, order_index=1,
            question_text="Explain indexing.", skill_tag="DB",
            difficulty_level="medium", expected_keywords=[],
        )
        db.add_all([q1, q2])
        db.commit()

        yield {"db": db, "session": session, "applicant": applicant, "q1": q1, "q2": q2}
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


@pytest.fixture(name="authed_client")
def fixture_authed_client(env):
    def override_user():
        return env["db"].query(User).filter(User.id == STUDENT_ID).first()

    app.dependency_overrides[interview_get_db] = _override_db(env)
    app.dependency_overrides[get_current_user] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def _backdate_answers(env):
    """Push existing answers outside the 10s submit rate-limit window."""
    old = datetime.datetime.utcnow() - datetime.timedelta(seconds=30)
    for a in env["db"].query(InterviewAnswer).filter_by(session_id=env["session"].id).all():
        a.created_at = old
    env["db"].commit()


def test_answer_returns_answer_id_and_next_question(authed_client, env):
    s = env["session"]
    resp = authed_client.post("/api/interview/answer", json={
        "session_id": s.id,
        "question_id": env["q1"].id,
        "answer_text": "REST is an architectural style.",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok"
    assert body["answer_id"], "answer_id is required for the hint endpoint (H2)"
    assert body["next_question"]["id"] == env["q2"].id


def test_resubmit_returns_answer_id_with_null_next_question(authed_client, env):
    s = env["session"]
    first = authed_client.post("/api/interview/answer", json={
        "session_id": s.id,
        "question_id": env["q1"].id,
        "answer_text": "First attempt.",
    })
    assert first.status_code == 200, first.text
    _backdate_answers(env)

    second = authed_client.post("/api/interview/answer", json={
        "session_id": s.id,
        "question_id": env["q1"].id,
        "answer_text": "Edited attempt.",
    })
    assert second.status_code == 200, second.text
    body = second.json()
    # Resubmission: no sequencing change — client must stay on the question.
    assert body["status"] == "ok"
    assert body["next_question"] is None
    assert body["answer_id"] == first.json()["answer_id"]


def test_final_answer_returns_answer_id_with_complete(authed_client, env):
    s = env["session"]
    r1 = authed_client.post("/api/interview/answer", json={
        "session_id": s.id,
        "question_id": env["q1"].id,
        "answer_text": "First answer.",
    })
    assert r1.status_code == 200, r1.text
    _backdate_answers(env)

    r2 = authed_client.post("/api/interview/answer", json={
        "session_id": s.id,
        "question_id": env["q2"].id,
        "answer_text": "Second answer.",
    })
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["status"] == "interview_complete"
    assert body["answer_id"], "complete responses also carry answer_id"


def test_transcribe_raises_without_key(authed_client, env, monkeypatch):
    from resume_pipeline.config import settings
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    resp = authed_client.post(
        "/api/interview/transcribe",
        files={"audio": ("answer.webm", b"fake-audio-bytes", "audio/webm")},
    )
    # No silent mock transcript: missing STT credentials raise loudly.
    assert resp.status_code == 503, resp.text
    assert "not configured" in resp.json()["detail"]


def test_transcribe_serves_with_explicit_mock(authed_client, env, monkeypatch):
    from unittest.mock import patch as _patch
    from resume_pipeline.config import settings
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_test_key")
    with _patch(
        "resume_pipeline.core.llm_router.llm_router.transcribe_audio",
        return_value="hello world",
    ):
        resp = authed_client.post(
            "/api/interview/transcribe",
            files={"audio": ("answer.webm", b"fake-audio-bytes", "audio/webm")},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["transcript"] == "hello world"
    assert body.get("mock") is False


@pytest.mark.asyncio
async def test_stream_hint_yields_error_event_on_failure(monkeypatch):
    from resume_pipeline.interview import evaluator

    def _boom(*args, **kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(evaluator.llm_router, "generate_chat_completion_stream", _boom)
    chunks = [c async for c in evaluator.stream_hint(skill_tag="API", missing_concepts=["verbs"])]
    assert any('"error"' in c for c in chunks), "hint failures must surface an error event (M2)"
    assert chunks[-1].strip() == "data: [DONE]"


@pytest.mark.asyncio
async def test_stream_feedback_yields_error_event_on_failure(monkeypatch):
    from resume_pipeline.interview import evaluator

    def _boom(*args, **kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(evaluator.llm_router, "generate_chat_completion_stream", _boom)
    chunks = [c async for c in evaluator.stream_feedback(
        question_text="Q?", answer_text="A.", skill_tag="API", expected_keywords=[]
    )]
    assert any('"error"' in c for c in chunks), "feedback failures must surface an error event (M2)"
    assert chunks[-1].strip() == "data: [DONE]"


def test_zero_answer_finish_returns_complete_empty(authed_client, env):
    """Finishing with zero answers must return an honest empty "complete"
    payload — never "processing" forever (would poll until the timeout)."""
    s = env["session"]
    fin = authed_client.post(f"/api/interview/finish/{s.id}")
    assert fin.status_code == 200, fin.text
    resp = authed_client.get(f"/api/interview/results/{s.id}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "complete"
    assert body["questions_review"] == []
    assert body["overall_score"] == 0.0


def test_double_submit_same_answer_is_single_row_resubmit(authed_client, env):
    """A rapid double-submit of the same answer must collapse into one row:
    the second POST is a resubmit (next_question null, same answer_id)."""
    s = env["session"]
    payload = {
        "session_id": s.id,
        "question_id": env["q1"].id,
        "answer_text": "Same answer twice.",
    }
    first = authed_client.post("/api/interview/answer", json=payload)
    assert first.status_code == 200, first.text
    _backdate_answers(env)
    second = authed_client.post("/api/interview/answer", json=payload)
    assert second.status_code == 200, second.text
    assert second.json()["next_question"] is None
    assert second.json()["answer_id"] == first.json()["answer_id"]
    rows = (
        env["db"]
        .query(InterviewAnswer)
        .filter_by(session_id=s.id, question_id=env["q1"].id)
        .all()
    )
    assert len(rows) == 1
    assert rows[0].answer_text == "Same answer twice."


def test_hint_disabled_for_tough_faang_persona(authed_client, env):
    """The Tough FAANG persona honors its 'No hints' copy: the endpoint
    returns an SSE error event (not a generated hint, not bare [DONE])."""
    s = env["session"]
    s.interviewer_persona = "Tough FAANG Interviewer"
    env["db"].commit()
    r = authed_client.post("/api/interview/answer", json={
        "session_id": s.id,
        "question_id": env["q1"].id,
        "answer_text": "An answer.",
    })
    assert r.status_code == 200, r.text
    hint = authed_client.get(f"/api/interview/hint/{r.json()['answer_id']}")
    assert hint.status_code == 200, hint.text
    assert '"error"' in hint.text
    assert "[DONE]" in hint.text


def test_hint_cached_replay_serves_tokens(authed_client, env):
    """Hint success path: a persisted hint_for_next replays as SSE tokens."""
    s = env["session"]
    r = authed_client.post("/api/interview/answer", json={
        "session_id": s.id,
        "question_id": env["q1"].id,
        "answer_text": "An answer.",
    })
    assert r.status_code == 200, r.text
    answer_id = r.json()["answer_id"]
    ans = env["db"].query(InterviewAnswer).filter_by(id=answer_id).first()
    ans.hint_for_next = "Remember HTTP verbs."
    env["db"].commit()
    hint = authed_client.get(f"/api/interview/hint/{answer_id}")
    assert hint.status_code == 200, hint.text
    assert "HTTP verbs" in hint.text
