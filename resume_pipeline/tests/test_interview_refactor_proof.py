"""
Refactor proof: interview/router.py split + learning/ promotion.

Uses RECORDED (canned) Groq responses plus the hardcoded fallback bank.
Asserts state-machine transitions, scoring math, and abandon flows —
never exact LLM wording.
"""
import json
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resume_pipeline.app import app
from resume_pipeline.auth import get_current_user
from resume_pipeline.db import (
    Base, User, Applicant, InterviewSession, InterviewQuestion, InterviewAnswer,
)
from resume_pipeline.interview.common import (
    MAX_EVAL_RETRIES,
    _abandon_token_is_valid,
    _make_abandon_token,
    get_db as interview_get_db,
)
from resume_pipeline.interview import sessions as sessions_module
from resume_pipeline.interview import streaming as streaming_module
import importlib as _importlib
interview_router_module = _importlib.import_module("resume_pipeline.interview.router")
from resume_pipeline.interview.service import (
    build_full_results,
    create_session,
    get_next_question,
    mark_session_abandoned,
)
from resume_pipeline.interview.generator import generate_questions
from resume_pipeline.interview.evaluator import run_evaluation

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

STUDENT_ID = 77


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=STUDENT_ID, email="splitproof@example.com", password_hash="x",
            role="student", name="Split Proof", is_active=True, is_verified=True,
        )
        applicant = Applicant(
            user_id=STUDENT_ID, applicant_id="app_splitproof", display_name="Split Proof"
        )
        db.add_all([user, applicant])
        db.commit()
        yield {"db": db, "user": user, "applicant": applicant}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def _make_session(db, applicant_id, n_main=2, skill="Python"):
    questions_data = [
        {
            "question_text": f"Recorded question {i} about {skill}",
            "skill_tag": skill,
            "difficulty_level": "medium",
            "expected_keywords": ["concept"],
            "question_type": "conceptual",
            "is_reserve": i >= n_main,
        }
        for i in range(n_main + 1)
    ]
    session, _first = create_session(
        applicant_id=applicant_id,
        interview_type="technical",
        difficulty="medium",
        num_questions=n_main,
        voice_mode=False,
        topic_focus=None,
        questions_data=questions_data,
        db=db,
    )
    return session


# ---------------------------------------------------------------------------
# 1. Route contract: identical paths/methods after the split
# ---------------------------------------------------------------------------

GOLDEN_ROUTES = {
    ("POST", "/api/interview/start"),
    ("POST", "/api/interview/answer"),
    ("GET", "/api/interview/session/{session_id}"),
    ("GET", "/api/interview/results/{session_id}"),
    ("GET", "/api/interview/hint/{answer_id}"),
    ("GET", "/api/interview/feedback/{question_id}"),
    ("POST", "/api/interview/abandon/{session_id}"),
    ("POST", "/api/interview/abandon-beacon/{session_id}"),
    ("GET", "/api/interview/active-session"),
    ("GET", "/api/interview/history"),
    ("POST", "/api/interview/transcribe"),
    ("GET", "/api/interview/session/{session_id}/questions"),
    ("POST", "/api/interview/finish/{session_id}"),
    ("GET", "/api/interview/skill-gap-analysis/{session_id}"),
    ("POST", "/api/interview/generate-learning-path/{session_id}"),
    ("GET", "/api/interview/candidate-intelligence"),
    ("GET", "/api/learning-paths/{path_id}"),
    ("GET", "/api/learning-paths/applicant/{applicant_id}"),
    ("POST", "/api/learning-paths/{path_id}/complete"),
    ("POST", "/api/learning-paths/{path_id}/delete"),
    ("POST", "/api/learning-paths/{path_id}/restore"),
}


def _flatten_routes(router):
    """Flatten APIRoute objects, including FastAPI's lazy included-router wrappers.

    FastAPI >= 0.13x (first seen with 0.162) keeps ``include_router`` lazy: the
    parent holds ``_IncludedRouter`` wrappers whose routes live on
    ``original_router``. Older versions copy plain ``APIRoute`` objects. This
    helper yields the concrete routes in both layouts.
    """
    flat = []
    for route in getattr(router, "routes", []):
        inner = getattr(route, "original_router", None)
        if inner is not None:
            flat.extend(_flatten_routes(inner))
        else:
            flat.append(route)
    return flat


def test_route_contract_unchanged():
    # OpenAPI is the version-agnostic flattened contract (app.routes may hold
    # lazy include wrappers instead of concrete APIRoute objects).
    paths = app.openapi().get("paths", {})
    found = {
        (method.upper(), path)
        for path, operations in paths.items()
        for method in operations
    }
    found = {
        (method, path) for method, path in found
        if path.startswith("/api/interview") or path.startswith("/api/learning-paths")
    }
    assert GOLDEN_ROUTES <= found, f"missing routes: {GOLDEN_ROUTES - found}"


def test_aggregator_reuses_split_handlers():
    """The thin aggregator must reference the same function objects (no copies)."""
    by_path = {}
    for r in _flatten_routes(interview_router_module.router):
        methods = getattr(r, "methods", None)
        if methods:
            by_path[(tuple(sorted(methods)), r.path)] = r.endpoint
    assert by_path[("POST",), "/api/interview/start"] is sessions_module.start_interview
    assert by_path[("POST",), "/api/interview/answer"] is sessions_module.submit_answer
    assert by_path[("POST",), "/api/interview/finish/{session_id}"] is sessions_module.finish_interview
    assert by_path[("GET",), "/api/interview/hint/{answer_id}"] is streaming_module.stream_hint_endpoint
    assert by_path[("GET",), "/api/interview/skill-gap-analysis/{session_id}"] is streaming_module.skill_gap_analysis_endpoint
    # Backward-compat names still importable from the old location.
    assert interview_router_module.get_session_questions is streaming_module.get_session_questions
    assert interview_router_module.finish_interview is sessions_module.finish_interview
    assert interview_router_module.MAX_EVAL_RETRIES == MAX_EVAL_RETRIES == 3


# ---------------------------------------------------------------------------
# 2. Recorded Groq generation drives the session state machine
# ---------------------------------------------------------------------------

RECORDED_QUESTIONS = [
    {
        "question_text": f"Recorded mock question {i}",
        "skill_tag": "Python",
        "sub_topic": "Python - fundamentals",
        "depth_level": "applied",
        "context_type": "conceptual",
        "expected_keywords": ["GIL", "decorator"],
    }
    for i in range(4)
]


def test_recorded_groq_generation_state_machine(env, monkeypatch):
    db = env["db"]
    applicant = env["applicant"]

    import resume_pipeline.interview.generator as gen_mod
    monkeypatch.setattr(
        gen_mod.llm_router, "generate_chat_completion",
        lambda **kw: {"content": json.dumps(RECORDED_QUESTIONS)},
    )
    context = {"target_role": "Software Engineer", "skills": ["Python"]}
    questions = generate_questions(
        context=context, num_questions=2, interview_type="technical",
        difficulty="medium", db=db, applicant_id=applicant.id,
    )
    # 2 main + reserve pool; structure only, never wording.
    assert len(questions) >= 2
    assert all(q["question_text"] and q["skill_tag"] for q in questions)

    session, first_q = create_session(
        applicant_id=applicant.id, interview_type="technical", difficulty="medium",
        num_questions=2, voice_mode=False, topic_focus=None,
        questions_data=questions, db=db,
    )
    assert session.status == "active"

    # Walk the state machine: answer each main question in order.
    mains = (
        db.query(InterviewQuestion)
        .filter_by(session_id=session.id, is_reserve=False)
        .order_by(InterviewQuestion.order_index).all()
    )
    prev_id = None
    for q in mains:
        nxt = get_next_question(session.id, prev_id, db) if prev_id else first_q
        assert nxt.id == q.id
        ans = InterviewAnswer(
            id=str(uuid.uuid4()), session_id=session.id, question_id=q.id,
            answer_text="A recorded mock answer.", status="pending_evaluation",
        )
        db.add(ans)
        db.commit()
        prev_id = q.id
    assert get_next_question(session.id, prev_id, db) is None  # interview_complete


# ---------------------------------------------------------------------------
# 3. Recorded Groq evaluation: scoring math, not wording
# ---------------------------------------------------------------------------

def test_recorded_groq_evaluation_scoring_math(env, monkeypatch):
    db = env["db"]
    applicant = env["applicant"]
    session = _make_session(db, applicant.id, n_main=2, skill="Python")
    questions = (
        db.query(InterviewQuestion)
        .filter_by(session_id=session.id, is_reserve=False)
        .order_by(InterviewQuestion.order_index).all()
    )

    import resume_pipeline.interview.evaluator as eval_mod
    scores = iter([0.8, 0.4])
    monkeypatch.setattr(
        eval_mod.llm_router, "generate_chat_completion",
        lambda **kw: {"content": json.dumps({
            "score": next(scores),
            "feedback": "recorded feedback",
            "strength": "recorded strength",
            "missing_concepts": ["recorded gap"],
            "hint_for_next": None,
        })},
    )
    # Keep the longitudinal profile out of this unit (own module, own test).
    monkeypatch.setattr(
        "resume_pipeline.interview.evaluator.generate_longitudinal_profile",
        lambda *a, **k: None,
        raising=False,
    )
    # generate_longitudinal_profile is imported lazily inside run_evaluation;
    # patch the source module attribute instead.
    import resume_pipeline.interview.candidate_intelligence as ci_mod
    monkeypatch.setattr(ci_mod, "generate_longitudinal_profile", lambda *a, **k: None)

    answers = []
    for q in questions:
        a = InterviewAnswer(
            id=str(uuid.uuid4()), session_id=session.id, question_id=q.id,
            answer_text="recorded answer", status="pending_evaluation",
        )
        db.add(a)
        db.commit()
        answers.append(a)

    for a in answers:
        run_evaluation(session.id, a.question_id, a.id, db)

    db.refresh(answers[0])
    db.refresh(answers[1])
    assert answers[0].status == "evaluated" and answers[0].score == pytest.approx(0.8)
    assert answers[1].status == "evaluated" and answers[1].score == pytest.approx(0.4)

    results = build_full_results(session, db)
    assert results["overall_score"] == pytest.approx(0.6)
    skills = {b["skill"]: b for b in results["skill_breakdown"]}
    assert skills["Python"]["score"] == pytest.approx(0.6)
    assert skills["Python"]["questions"] == 2
    assert {r["status"] for r in results["questions_review"]} == {"evaluated"}


# ---------------------------------------------------------------------------
# 4. Fallback bank on Groq outage
# ---------------------------------------------------------------------------

def test_fallback_bank_on_groq_outage(env, monkeypatch):
    db = env["db"]
    applicant = env["applicant"]
    import resume_pipeline.interview.generator as gen_mod

    def _boom(**kw):
        raise RuntimeError("recorded outage")

    monkeypatch.setattr(gen_mod.llm_router, "generate_chat_completion", _boom)
    questions = generate_questions(
        context={"target_role": "Software Engineer", "skills": ["Python"]},
        num_questions=3, interview_type="technical", difficulty="medium",
        db=db, applicant_id=applicant.id,
    )
    assert len(questions) >= 3
    assert all(q["question_text"] and q["skill_tag"] for q in questions)


# ---------------------------------------------------------------------------
# 5. Abandon state machine + sendBeacon HMAC token
# ---------------------------------------------------------------------------

def test_abandon_flow_and_beacon_token(env):
    db = env["db"]
    applicant = env["applicant"]
    session = _make_session(db, applicant.id)
    assert session.status == "active"

    token = _make_abandon_token(session.id, applicant.id)
    assert _abandon_token_is_valid(session, token) is True
    assert _abandon_token_is_valid(session, token + "tampered") is False
    assert _abandon_token_is_valid(session, None) is False
    assert _abandon_token_is_valid(session, _make_abandon_token(session.id, applicant.id + 999)) is False

    mark_session_abandoned(session.id, db)
    db.refresh(session)
    assert session.status == "abandoned"
    # Idempotent: second abandon is a no-op, never an error.
    mark_session_abandoned(session.id, db)
    db.refresh(session)
    assert session.status == "abandoned"


# ---------------------------------------------------------------------------
# 6. Learning module serves the same contract (HTTP level)
# ---------------------------------------------------------------------------

def _learning_client(env, monkeypatch):
    from resume_pipeline.learning.router import get_db as learning_get_db

    def override_db():
        try:
            yield env["db"]
        finally:
            pass

    def override_user():
        return env["db"].query(User).filter(User.id == STUDENT_ID).first()

    app.dependency_overrides[learning_get_db] = override_db
    app.dependency_overrides[interview_get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    client = TestClient(app)
    return client


def test_learning_http_contract(env, monkeypatch):
    db = env["db"]
    applicant = env["applicant"]
    client = _learning_client(env, monkeypatch)
    try:
        # Unknown session -> 404, same as before the move.
        resp = client.post("/api/interview/generate-learning-path/does-not-exist")
        assert resp.status_code == 404

        session = _make_session(db, applicant.id)
        import importlib
        lr = importlib.import_module("resume_pipeline.learning.router")
        monkeypatch.setattr(
            lr, "generate_learning_path",
            lambda session_id, db: {"path_id": 4242, "already_exists": False},
        )
        resp = client.post(f"/api/interview/generate-learning-path/{session.id}")
        assert resp.status_code == 200
        assert resp.json() == {"path_id": 4242, "already_exists": False}

        # CRUD router is mounted under the same contract.
        assert client.get("/api/learning-paths/999999").status_code == 404
    finally:
        app.dependency_overrides.clear()
