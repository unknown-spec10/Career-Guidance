"""Interview System v2 — API Router (thin aggregator).

Structural split only — no behavior change. Route implementations live in
:mod:`sessions` (lifecycle/state machine) and :mod:`streaming`
(hint/feedback/skill-gap SSE + transcription). Learning-path endpoints live
in the top-level :mod:`resume_pipeline.learning` package.

This module re-exports the combined ``router`` plus the historical helper
names so existing imports (``app.py``, tests) keep working unchanged.
"""
from fastapi import APIRouter

from .common import (
    MAX_EVAL_RETRIES,
    SSE_HEARTBEAT_INTERVAL_SECONDS,
    SSE_STREAM_TIMEOUT_SECONDS,
    _abandon_token_is_valid,
    _get_applicant,
    _make_abandon_token,
    _question_to_out,
    _stream_cached_plan,
    get_db,
    run_generator_in_thread,
    wrap_sse_with_heartbeat,
)
from .sessions import (
    abandon_session,
    abandon_session_beacon,
    check_active_session,
    finish_interview,
    get_interview_history,
    get_results,
    get_session_state,
    get_student_candidate_intelligence,
    submit_answer,
    start_interview,
)
from .streaming import (
    get_session_questions,
    skill_gap_analysis_endpoint,
    stream_feedback_endpoint,
    stream_hint_endpoint,
    transcribe_audio,
)

# Canonical combined router: sessions first, then streaming. Both
# sub-routers already carry the full ``/api/interview`` prefix, so every
# path, method, schema, and guard is identical to the former monolith.
from .sessions import router as sessions_router
from .streaming import router as streaming_router

router = APIRouter()
router.include_router(sessions_router)
router.include_router(streaming_router)

# Learning-path routers now live in resume_pipeline.learning; re-exported
# here so ``from .interview.router import learning_path_router`` keeps working.
from ..learning.router import interview_learning_router, router as learning_path_router  # noqa: E402

# Re-exported for tests / monkeypatching compatibility.
from ..db import SessionLocal  # noqa: E402,F401

__all__ = [
    "router",
    "sessions_router",
    "streaming_router",
    "learning_path_router",
    "interview_learning_router",
    "get_db",
    "SessionLocal",
    "MAX_EVAL_RETRIES",
    "SSE_STREAM_TIMEOUT_SECONDS",
    "SSE_HEARTBEAT_INTERVAL_SECONDS",
    "wrap_sse_with_heartbeat",
    "_make_abandon_token",
    "_abandon_token_is_valid",
    "_get_applicant",
    "_question_to_out",
    "_stream_cached_plan",
    "run_generator_in_thread",
    "start_interview",
    "submit_answer",
    "get_session_state",
    "get_results",
    "abandon_session",
    "abandon_session_beacon",
    "check_active_session",
    "get_interview_history",
    "get_session_questions",
    "finish_interview",
    "get_student_candidate_intelligence",
    "stream_hint_endpoint",
    "stream_feedback_endpoint",
    "transcribe_audio",
    "skill_gap_analysis_endpoint",
]
