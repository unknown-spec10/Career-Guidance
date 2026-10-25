"""
Scale-resilience proofs for the interview §4.1–4.3 proposals.

1. Bounded eval concurrency: the semaphore caps concurrent run_evaluation
   bodies; overflow sheds load (answer stays pending for retry-on-poll).
   Backoff with jitter applies inside the existing MAX_EVAL_RETRIES budget.
2. SSE hygiene: heartbeat comments on idle streams, hard stream timeout,
   cached-replay-first for hint/feedback.
3. YouTube: single-key lookup; cached queries avoid
   repeat HTTP calls; quota exhaustion keeps the labelled template fallback.
"""
import asyncio
import sys
import threading
import time
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from resume_pipeline.app import app
from resume_pipeline.auth import get_current_user
from resume_pipeline.db import (
    Applicant,
    Base,
    CreditAccount,
    CreditUsageStats,
    InterviewAnswer,
    InterviewQuestion,
    InterviewSession,
    SystemConfiguration,
    User,
)
from resume_pipeline.interview import evaluator as eval_mod
from resume_pipeline.interview.common import (
    MAX_EVAL_RETRIES,
    get_db as interview_get_db,
    wrap_sse_with_heartbeat,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _file_db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path}/scale_test.db",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _seed_user_applicant(db, tag):
    user = User(
        email=f"{tag}@example.com", password_hash="x",
        role="student", name=tag, is_active=True, is_verified=True,
    )
    db.add(user)
    db.flush()
    applicant = Applicant(
        user_id=user.id, applicant_id=f"app_{tag}", display_name=tag
    )
    db.add(applicant)
    db.commit()
    db.refresh(user)
    db.refresh(applicant)
    return user, applicant


def _seed_qa(db, applicant_id, n=1, session_status="active"):
    session = InterviewSession(
        id=str(uuid.uuid4()), applicant_id=applicant_id,
        interview_type="technical", difficulty="medium",
        total_questions=n, status=session_status,
    )
    db.add(session)
    db.flush()
    pairs = []
    for i in range(n):
        q = InterviewQuestion(
            id=str(uuid.uuid4()), session_id=session.id,
            question_text=f"Scale Q{i}", skill_tag="Python",
            order_index=i, is_reserve=False, difficulty_level="medium",
        )
        db.add(q)
        db.flush()
        a = InterviewAnswer(
            id=str(uuid.uuid4()), session_id=session.id, question_id=q.id,
            answer_text="A scale answer.", status="pending_evaluation",
            evaluation_attempts=0,
        )
        db.add(a)
        db.flush()
        pairs.append((q, a))
    db.commit()
    return session, pairs


@pytest.fixture()
def scale_env(tmp_path, monkeypatch):
    """Isolated file-backed sqlite + no-op longitudinal profile."""
    SessionLocal = _file_db(tmp_path)
    db = SessionLocal()
    import resume_pipeline.interview.candidate_intelligence as ci_mod
    monkeypatch.setattr(ci_mod, "generate_longitudinal_profile", lambda *a, **k: None)
    # Isolate the in-memory YouTube cache between tests.
    import resume_pipeline.learning.generator as gen_mod
    monkeypatch.setattr(gen_mod, "_YOUTUBE_MEMORY_CACHE", {})
    try:
        yield {"SessionLocal": SessionLocal, "db": db}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 1. Bounded eval concurrency + backoff
# ---------------------------------------------------------------------------

def test_eval_concurrency_cap_respected_under_burst(scale_env):
    SessionLocal = scale_env["SessionLocal"]
    db = scale_env["db"]
    _, applicant = _seed_user_applicant(db, f"burst_{uuid.uuid4().hex[:6]}")

    n_threads = 12
    sessions_answers = [_seed_qa(db, applicant.id) for _ in range(n_threads)]
    cap = eval_mod.INTERVIEW_CONFIG_V2["MAX_CONCURRENT_EVALS"] if hasattr(eval_mod, "INTERVIEW_CONFIG_V2") else 8

    from resume_pipeline.config import INTERVIEW_CONFIG_V2
    cap = INTERVIEW_CONFIG_V2["MAX_CONCURRENT_EVALS"]

    current = 0
    observed_max = 0
    lock = threading.Lock()

    def slow_eval(**kwargs):
        nonlocal current, observed_max
        with lock:
            current += 1
            observed_max = max(observed_max, current)
        try:
            time.sleep(0.2)
        finally:
            with lock:
                current -= 1
        return {
            "score": 0.7, "feedback": "ok", "strength": "ok",
            "missing_concepts": [], "hint_for_next": None,
        }

    errors = []

    def worker(sess_id, q_id, a_id):
        wdb = SessionLocal()
        try:
            eval_mod.run_evaluation(sess_id, q_id, a_id, wdb)
        except Exception as e:  # noqa: BLE001 — collected, asserted below
            errors.append(e)
        finally:
            wdb.close()

    with patch.object(eval_mod, "_evaluate_with_llm", side_effect=slow_eval):
        threads = [
            threading.Thread(target=worker, args=(s.id, q.id, a.id))
            for s, pairs in sessions_answers
            for (q, a) in pairs
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)

    assert not errors
    assert observed_max <= cap, f"cap {cap} violated: {observed_max} concurrent"
    assert observed_max > 1, "burst never overlapped — test proves nothing"


def test_eval_sheds_load_when_cap_reached(scale_env):
    db = scale_env["db"]
    _, applicant = _seed_user_applicant(db, f"shed_{uuid.uuid4().hex[:6]}")
    session, pairs = _seed_qa(db, applicant.id)
    q, a = pairs[0]

    # Hold every permit: the evaluation must shed, leaving the answer pending
    # for the existing retry-on-poll recovery instead of piling up workers.
    from resume_pipeline.config import INTERVIEW_CONFIG_V2
    cap = INTERVIEW_CONFIG_V2["MAX_CONCURRENT_EVALS"]
    for _ in range(cap):
        assert eval_mod.EVAL_SEMAPHORE.acquire(blocking=False)
    try:
        with patch.object(
            eval_mod, "_evaluate_with_llm",
            side_effect=AssertionError("must not run while shed"),
        ):
            eval_mod.run_evaluation(session.id, q.id, a.id, db)
    finally:
        for _ in range(cap):
            eval_mod.EVAL_SEMAPHORE.release()

    db.refresh(a)
    assert a.status == "pending_evaluation"

    # Permits free again: the same answer now evaluates normally.
    with patch.object(
        eval_mod, "_evaluate_with_llm",
        return_value={
            "score": 0.8, "feedback": "good", "strength": "clear",
            "missing_concepts": [], "hint_for_next": None,
        },
    ):
        eval_mod.run_evaluation(session.id, q.id, a.id, db)
    db.refresh(a)
    assert a.status == "evaluated"
    assert a.score == pytest.approx(0.8)


def test_eval_backoff_stays_inside_retry_budget(scale_env):
    db = scale_env["db"]
    _, applicant = _seed_user_applicant(db, f"bo_{uuid.uuid4().hex[:6]}")
    session, pairs = _seed_qa(db, applicant.id)
    q, a = pairs[0]

    calls = {"n": 0}

    def flaky(**kwargs):
        calls["n"] += 1
        if calls["n"] <= 2:
            raise RuntimeError("429 Too Many Requests: TPM exceeded")
        return {
            "score": 0.6, "feedback": "ok", "strength": "ok",
            "missing_concepts": [], "hint_for_next": None,
        }

    with (
        patch.object(eval_mod, "_evaluate_with_llm", side_effect=flaky),
        patch.object(eval_mod.time, "sleep", return_value=None),
    ):
        eval_mod.run_evaluation(session.id, q.id, a.id, db)

    db.refresh(a)
    assert a.status == "evaluated"
    # 2 rate-limited trials + 1 success = within the 3-attempt budget.
    assert calls["n"] == 3


def test_backoff_delay_shape_and_rate_limit_detection():
    assert eval_mod._is_rate_limit_error(RuntimeError("429 too many requests"))
    assert eval_mod._is_rate_limit_error(RuntimeError("Groq TPM rate_limit exceeded"))
    assert eval_mod._is_rate_limit_error(TimeoutError("request timed out"))
    assert not eval_mod._is_rate_limit_error(ValueError("bad request"))
    d0 = eval_mod.eval_backoff_delay(0)
    d1 = eval_mod.eval_backoff_delay(1)
    d2 = eval_mod.eval_backoff_delay(2)
    assert 1.0 <= d0 <= 2.0
    assert 2.0 <= d1 <= 3.0
    assert 4.0 <= d2 <= 5.0
    assert eval_mod.eval_backoff_delay(99) <= 8.0 + 1.0 + 0.001


# ---------------------------------------------------------------------------
# 2. SSE timeouts + heartbeats + cached-replay-first
# ---------------------------------------------------------------------------

def _collect(coro_gen):
    async def _run():
        return [item async for item in coro_gen]
    return asyncio.run(_run())


def test_sse_heartbeat_emitted_on_idle_stream():
    async def slow():
        await asyncio.sleep(0.05)
        yield "data: hello\n\n"

    out = _collect(wrap_sse_with_heartbeat(slow(), timeout=5, heartbeat_interval=0.01))
    assert any(chunk == ": ping\n\n" for chunk in out), f"no heartbeat in {out}"
    assert "data: hello\n\n" in out


def test_sse_timeout_cuts_stalled_stream():
    async def stalled():
        await asyncio.sleep(30)
        yield "data: never\n\n"

    started = time.monotonic()
    out = _collect(wrap_sse_with_heartbeat(stalled(), timeout=0.05, heartbeat_interval=0.01))
    elapsed = time.monotonic() - started
    assert elapsed < 5, f"stream not cut promptly ({elapsed:.1f}s)"
    assert "data: never\n\n" not in out


def _sse_client(scale_env, monkeypatch, user, db):
    def override_db():
        try:
            yield db
        finally:
            pass

    def override_user():
        return user

    app.dependency_overrides[interview_get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    monkeypatch.setattr(
        "resume_pipeline.interview.streaming.SessionLocal",
        scale_env["SessionLocal"],
    )
    client = TestClient(app)
    return client


def test_hint_serves_cached_replay_without_llm(scale_env, monkeypatch):
    db = scale_env["db"]
    user, applicant = _seed_user_applicant(db, f"hint_{uuid.uuid4().hex[:6]}")
    session, pairs = _seed_qa(db, applicant.id)
    _q, a = pairs[0]
    a.hint_for_next = "Remember the GIL."
    a.status = "evaluated"
    db.commit()

    with patch(
        "resume_pipeline.core.llm_router.LLMRouter.generate_chat_completion_stream",
        side_effect=AssertionError("LLM must not be called on cache hit"),
    ):
        client = _sse_client(scale_env, monkeypatch, user, db)
        try:
            resp = client.get(f"/api/interview/hint/{a.id}")
        finally:
            app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert "Remember the GIL." in resp.text
    assert "[DONE]" in resp.text


def test_feedback_serves_cached_replay_without_llm(scale_env, monkeypatch):
    db = scale_env["db"]
    user, applicant = _seed_user_applicant(db, f"fb_{uuid.uuid4().hex[:6]}")
    session, pairs = _seed_qa(db, applicant.id)
    q, a = pairs[0]
    a.feedback = "Cached narrative feedback."
    a.status = "evaluated"
    db.commit()

    with patch(
        "resume_pipeline.core.llm_router.LLMRouter.generate_chat_completion_stream",
        side_effect=AssertionError("LLM must not be called on cache hit"),
    ):
        client = _sse_client(scale_env, monkeypatch, user, db)
        try:
            resp = client.get(f"/api/interview/feedback/{q.id}")
        finally:
            app.dependency_overrides.clear()
    assert resp.status_code == 200
    assert "Cached narrative feedback." in resp.text
    assert "[DONE]" in resp.text


# ---------------------------------------------------------------------------
# 3. YouTube single key + result caching
# ---------------------------------------------------------------------------

class _FakeYTResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self):
        return self._payload


class _FakeYTClient:
    """Single-key fake: KEY1 quota-errors, any other key succeeds."""

    seen_keys = []

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get(self, url, params=None, timeout=None):
        key = (params or {}).get("key")
        type(self).seen_keys.append(key)
        if key == "KEY1":
            return _FakeYTResponse(403, {"error": {"errors": [{"reason": "quotaExceeded"}]}})
        item = {
            "id": {"videoId": "vid9"},
            "snippet": {
                "title": "T", "channelTitle": "freeCodeCamp.org",
                "thumbnails": {"high": {"url": "http://t"}},
                "publishedAt": "2024-01-01T00:00:00Z",
            },
        }
        if "videos" in url:
            return _FakeYTResponse(200, {"items": [{
                "id": "vid9",
                "statistics": {"viewCount": "200000", "likeCount": "5"},
                "contentDetails": {"duration": "PT25M"},
            }]})
        return _FakeYTResponse(200, {"items": [item]})


def test_youtube_single_key_success_and_exhaustion(monkeypatch):
    import resume_pipeline.learning.generator as gen_mod
    monkeypatch.setattr(gen_mod.httpx, "Client", _FakeYTClient)
    _FakeYTClient.seen_keys = []

    with pytest.raises(gen_mod.YouTubeQuotaExhausted):
        gen_mod.search_youtube("q", "KEY1")
    videos = gen_mod.search_youtube_with_rotation("q", keys=["KEY2"])
    assert [v["video_id"] for v in videos] == ["vid9"]
    assert _FakeYTClient.seen_keys[0] == "KEY1"
    assert "KEY2" in _FakeYTClient.seen_keys

    with pytest.raises(gen_mod.YouTubeQuotaExhausted):
        gen_mod.search_youtube_with_rotation("q", keys=["KEY1"])

    # No configured key: empty result, no raise.
    assert gen_mod.search_youtube_with_rotation("q", keys=[]) == []

    # get_youtube_keys reflects the single canonical key.
    monkeypatch.setattr(gen_mod.settings, "YOUTUBE_DATA_API_KEY", "K1")
    assert gen_mod.get_youtube_keys() == ["K1"]
    monkeypatch.setattr(gen_mod.settings, "YOUTUBE_DATA_API_KEY", "")
    assert gen_mod.get_youtube_keys() == []


def test_youtube_cache_hit_avoids_repeat_calls(scale_env, monkeypatch):
    import resume_pipeline.learning.generator as gen_mod
    db = scale_env["db"]
    _, applicant = _seed_user_applicant(db, f"yt_{uuid.uuid4().hex[:6]}")

    import datetime as dt
    acct = CreditAccount(
        applicant_id=applicant.id, current_credits=50, total_earned=50,
        next_refill_at=dt.datetime.utcnow() + dt.timedelta(days=7),
        weekly_credit_limit=60,
    )
    db.add(acct)
    db.commit()
    stats = CreditUsageStats(account_id=acct.id)
    db.add(stats)
    db.commit()

    sessions = []
    for _ in range(2):
        s = InterviewSession(
            applicant_id=applicant.id, interview_type="technical",
            difficulty="medium", total_questions=1, status="completed",
        )
        db.add(s)
        db.commit()
        q = InterviewQuestion(
            session_id=s.id, order_index=0, question_text="What is an index?",
            skill_tag="DBMS", difficulty_level="medium",
        )
        db.add(q)
        db.commit()
        db.add(InterviewAnswer(
            session_id=s.id, question_id=q.id, answer_text="Faster reads.",
            score=0.3, feedback="Shallow.", missing_concepts=["B-Tree"],
            status="evaluated",
        ))
        db.commit()
        sessions.append(s)

    search_calls = {"n": 0}

    def fake_search(query, api_key=None, max_results=5):
        search_calls["n"] += 1
        return [{
            "video_id": "dbms_vid1", "title": "DBMS Indexing Full Tutorial",
            "channel_title": "freeCodeCamp.org", "thumbnail_url": "http://img.com",
            "published_at": "2024-01-01T00:00:00Z",
        }]

    monkeypatch.setattr(gen_mod.settings, "YOUTUBE_DATA_API_KEY", "K1")
    monkeypatch.setattr(
        gen_mod, "generate_search_queries",
        lambda **kw: [{"skill": "DBMS", "query": "dbms indexing tutorial", "priority": "high"}],
    )
    monkeypatch.setattr(gen_mod, "search_youtube", fake_search)
    monkeypatch.setattr(gen_mod, "fetch_video_stats", lambda ids, key=None: {
        "dbms_vid1": {"view_count": 80000, "duration_seconds": 1500, "like_count": 5},
    })
    monkeypatch.setattr(gen_mod, "fetch_leetcode_problems_for_skills", lambda *a, **k: [])
    monkeypatch.setattr(
        gen_mod.llm_router, "generate_chat_completion",
        lambda **kw: {"content": (
            '{"skill_gaps": {"DBMS": "weak"},'
            ' "roadmap_stages": [{"week": "Week 1", "skill_focus": "DBMS",'
            ' "action": "Learn indexing", "why_recommended": "weak",'
            ' "what_it_achieves": "knowledge",'
            ' "video": {"video_id": "dbms_vid1", "title": "DBMS Indexing Full Tutorial",'
            ' "channel_title": "freeCodeCamp.org", "thumbnail_url": "http://img.com",'
            ' "duration_minutes": 25,'
            ' "url": "https://www.youtube.com/watch?v=dbms_vid1"}}],'
            ' "recommended_projects": [], "practice_problems": [],'
            ' "priority_skills": ["DBMS"]}'
        )},
    )

    path1 = gen_mod.generate_learning_path(sessions[0].id, db)
    assert search_calls["n"] == 1
    assert path1["already_exists"] is False

    # Second session, same query: cache hit, no repeat HTTP search.
    path2 = gen_mod.generate_learning_path(sessions[1].id, db)
    assert search_calls["n"] == 1, "cache miss caused a repeat YouTube call"
    assert path2["already_exists"] is False
    assert path2["recommended_courses"][0]["video_id"] == "dbms_vid1"


def test_youtube_quota_exhaustion_keeps_labelled_template_fallback(scale_env, monkeypatch):
    import resume_pipeline.learning.generator as gen_mod
    db = scale_env["db"]
    _, applicant = _seed_user_applicant(db, f"ytf_{uuid.uuid4().hex[:6]}")
    session, _pairs = _seed_qa(
        db, applicant.id, n=1, session_status="completed",
    )

    monkeypatch.setattr(gen_mod.settings, "YOUTUBE_DATA_API_KEY", "K1")
    monkeypatch.setattr(
        gen_mod, "generate_search_queries",
        lambda **kw: [{"skill": "Python", "query": "python tutorial", "priority": "high"}],
    )
    def _boom(*args, **kwargs):
        raise gen_mod.YouTubeQuotaExhausted("all keys exhausted")

    monkeypatch.setattr(gen_mod, "search_youtube_with_rotation", _boom)
    monkeypatch.setattr(gen_mod, "fetch_leetcode_problems_for_skills", lambda *a, **k: [])
    def _llm_down(**kwargs):
        raise RuntimeError("LLM down")

    monkeypatch.setattr(gen_mod.llm_router, "generate_chat_completion", _llm_down)

    # No credits needed to reach the fallback: eligibility passes with a
    # fresh account? generate_learning_path checks credits first — seed them.
    import datetime as dt
    acct = CreditAccount(
        applicant_id=applicant.id, current_credits=50, total_earned=50,
        next_refill_at=dt.datetime.utcnow() + dt.timedelta(days=7),
        weekly_credit_limit=60,
    )
    db.add(acct)
    db.commit()
    db.add(CreditUsageStats(account_id=acct.id))
    db.commit()

    path = gen_mod.generate_learning_path(session.id, db)
    assert path["source"] == "llm_generated"
    assert path["skill_gaps"]["Software Engineering Core"] == "weak"
