"""Interview System v2 — streaming and voice routes.

Owns the streaming endpoints under ``/api/interview``: hint, feedback,
skill-gap analysis (SSE), transcription (configured STT provider), and the full
session-questions listing. Lifecycle/state-machine endpoints live in
:mod:`sessions`. Paths, methods, schemas, and role guards are unchanged
from the former monolithic ``router.py``.
"""
import json
import logging
from typing import AsyncGenerator, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session as DBSession

from ..auth import require_role
from ..db import (
    InterviewAnswer,
    InterviewQuestion,
    InterviewSession,
    SessionLocal,
)
from .common import (
    SSE_STREAM_TIMEOUT_SECONDS,
    _get_applicant,
    _stream_cached_plan,
    get_db,
    wrap_sse_with_heartbeat,
)
from .evaluator import stream_feedback, stream_hint
from .schemas import SessionQuestionItem
from .service import (
    build_full_results,
    get_missing_concepts_summary,
    sse_response,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interview", tags=["Interview v2"])


# GET /api/interview/hint/{answer_id}  — SSE stream
# ---------------------------------------------------------------------------

@router.get("/hint/{answer_id}")
async def stream_hint_endpoint(
    answer_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Stream a mid-interview hint for a weak answer."""
    applicant = _get_applicant(current_user, db)

    answer = db.query(InterviewAnswer).filter_by(id=answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found.")

    session = db.query(InterviewSession).filter_by(id=answer.session_id).first()
    if not session or session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    question = db.query(InterviewQuestion).filter_by(id=answer.question_id).first()
    missing = answer.missing_concepts or []

    # The Tough FAANG persona offers no hints by design — surface an
    # explicit SSE error instead of generating one anyway.
    if (session.interviewer_persona or "") == "Tough FAANG Interviewer":
        async def _hint_disabled():
            yield f"data: {json.dumps({'error': 'Hints are disabled for the Tough FAANG Interviewer persona.'})}\n\n"
            yield "data: [DONE]\n\n"
        return sse_response(_hint_disabled())

    # Cached-replay-first (audit §4.2): the evaluator already persists the
    # nudge in hint_for_next for weak answers — replay it instead of
    # spending a second LLM call on refresh/reconnect.
    if answer.hint_for_next:
        logger.info("Serving cached hint for answer %s", answer_id)
        return sse_response(
            wrap_sse_with_heartbeat(_stream_cached_plan(answer.hint_for_next))
        )

    return sse_response(
        wrap_sse_with_heartbeat(
            stream_hint(
                skill_tag=question.skill_tag if question else "the topic",
                missing_concepts=missing,
                interviewer_persona=session.interviewer_persona or "Friendly Senior Engineer",
            )
        )
    )


# ---------------------------------------------------------------------------
# GET /api/interview/feedback/{question_id}  — SSE stream
# ---------------------------------------------------------------------------

@router.get("/feedback/{question_id}")
async def stream_feedback_endpoint(
    question_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Stream detailed per-question feedback (for results page accordion)."""
    applicant = _get_applicant(current_user, db)

    answer = db.query(InterviewAnswer).filter_by(question_id=question_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found.")

    session = db.query(InterviewSession).filter_by(id=answer.session_id).first()
    if not session or session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    question = db.query(InterviewQuestion).filter_by(id=question_id).first()

    # Cached-replay-first (audit §4.2): the evaluation already persists the
    # narrative feedback — replay it instead of re-generating per expand.
    if answer.feedback:
        logger.info("Serving cached feedback for question %s", question_id)
        return sse_response(
            wrap_sse_with_heartbeat(_stream_cached_plan(answer.feedback))
        )

    return sse_response(
        wrap_sse_with_heartbeat(
            stream_feedback(
                question_text=question.question_text if question else "",
                answer_text=answer.answer_text or "",
                skill_tag=question.skill_tag if question else "General",
                expected_keywords=question.expected_keywords or [] if question else [],
            )
        )
    )


# ---------------------------------------------------------------------------
# POST /api/interview/transcribe  — Voice STT via configured provider
# ---------------------------------------------------------------------------

@router.post("/transcribe")
def transcribe_audio(
    audio: UploadFile = File(...),
    current_user=Depends(require_role("student")),
):
    """
    Transcribe raw microphone audio chunks into text using the configured
    STT provider (MODEL_STT_PROVIDER / MODEL_STT_NAME).
    Requires STT credentials (GROQ_API_KEY); missing keys raise a clear
    configuration error at call time (no silent mock transcripts).
    """
    from ..config import settings
    from ..core.llm_router import llm_router

    # STT requires credentials: fail loudly instead of serving a mock transcript.
    if not settings.GROQ_API_KEY:
        logger.warning("STT requested without GROQ_API_KEY configured")
        raise HTTPException(
            status_code=503,
            detail="Speech-to-text is not configured (GROQ_API_KEY missing).",
        )

    audio_bytes = audio.file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file uploaded.")

    try:
        # Clean up extension to satisfy strict type checking
        incoming_filename = audio.filename or "audio.webm"
        ext = "webm"
        if "." in incoming_filename:
            parts = incoming_filename.rsplit(".", 1)
            # Strip parameters like ';codecs=opus' from extension
            ext = parts[1].split(";")[0].strip().lower()

        allowed_exts = {"flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"}
        if ext not in allowed_exts:
            ext = "webm"

        filename = f"audio.{ext}"

        transcript = llm_router.transcribe_audio(audio_bytes, filename)
        return {"transcript": transcript, "mock": False}
    except Exception as e:
        logger.error(f"STT transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ---------------------------------------------------------------------------
# GET /api/interview/session/{session_id}/questions  — fetch full session list
# ---------------------------------------------------------------------------

@router.get("/session/{session_id}/questions", response_model=List[SessionQuestionItem])
def get_session_questions(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Retrieve all non-reserve questions in the session along with their answer state."""
    applicant = _get_applicant(current_user, db)
    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    questions = (
        db.query(InterviewQuestion)
        .filter_by(session_id=session_id, is_reserve=False)
        .order_by(InterviewQuestion.order_index)
        .all()
    )

    answers = {a.question_id: a for a in db.query(InterviewAnswer).filter_by(session_id=session_id).all()}

    output = []
    for i, q in enumerate(questions):
        answer = answers.get(q.id)
        output.append(SessionQuestionItem(
            id=q.id,
            text=q.question_text,
            question_number=i + 1,
            total_questions=len(questions),
            skill_tag=q.skill_tag,
            user_answer=answer.answer_text if answer else None,
            answer_status=answer.status if answer else None,
        ))
    return output


# ---------------------------------------------------------------------------
# GET /api/interview/skill-gap-analysis/{session_id}  — SSE stream
# ---------------------------------------------------------------------------

async def _stream_skill_gap_analysis(
    session_id: str,
    experience_level: str,
    target_role: str,
    skill_scores_json: str,
    missing_concepts: str,
    history_context: str
) -> AsyncGenerator[str, None]:
    """Streams the skill gap analysis JSON character-by-character, and caches it to db."""
    from .prompts import SKILL_GAP_ANALYSIS_PROMPT
    from ..core.llm_router import llm_router

    prompt = SKILL_GAP_ANALYSIS_PROMPT.format(
        experience_level=experience_level,
        target_role=target_role,
        skill_scores_json=skill_scores_json,
        missing_concepts=missing_concepts,
        history_context=history_context
    )
    
    accumulated_tokens = []
    import time as _time
    started = _time.monotonic()
    try:
        stream = llm_router.generate_chat_completion_stream(
            messages=[{"role": "user", "content": prompt}],
            provider=None,
            capability="chat",
            temperature=0.3,
            max_tokens=1500,
        )

        for delta in stream:
            # Idle timeout: never let a stalled LLM pin the worker past the
            # SSE budget (the endpoint wrapper adds heartbeats on top).
            if _time.monotonic() - started > SSE_STREAM_TIMEOUT_SECONDS:
                logger.warning(
                    "Skill-gap stream cut after %.0fs timeout (session %s)",
                    SSE_STREAM_TIMEOUT_SECONDS, session_id,
                )
                break
            if delta:
                accumulated_tokens.append(delta)
                yield f"data: {json.dumps({'token': delta})}\n\n"
                
    except Exception as e:
        logger.error("Error streaming skill gap analysis: %s", e)
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
        return
        
    yield "data: [DONE]\n\n"
    
    full_text = "".join(accumulated_tokens).strip()
    if full_text:
        save_db = SessionLocal()
        try:
            session = save_db.query(InterviewSession).filter_by(id=session_id).first()
            if session:
                session.study_plan = full_text
                save_db.commit()
                logger.info("Saved generated skill gap analysis to DB study_plan for session %s", session_id)
        except Exception as ex:
            logger.error("Failed to save skill gap analysis to DB for session %s: %s", session_id, ex)
        finally:
            save_db.close()


@router.get("/skill-gap-analysis/{session_id}")
async def skill_gap_analysis_endpoint(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """
    Streams structured skill gap analysis JSON character-by-character (or serves cached JSON).
    """
    applicant = _get_applicant(current_user, db)
    
    session = db.query(InterviewSession).filter_by(id=session_id, applicant_id=applicant.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
        
    # Serve cached skill gap analysis if it exists inside session.study_plan
    if session.study_plan and session.study_plan.strip().startswith("{"):
        logger.info("Serving cached skill gap analysis from session.study_plan for session %s", session_id)
        return sse_response(
            wrap_sse_with_heartbeat(_stream_cached_plan(session.study_plan))
        )

    # Build skill scores
    results_payload = build_full_results(session, db)
    skill_scores = {}
    for entry in results_payload.get("skill_breakdown", []):
        skill_scores[entry["skill"]] = entry["score"]
        
    skill_scores_json = json.dumps(skill_scores)
    missing_concepts = get_missing_concepts_summary(session_id, db) or "No specific missing concepts"
    
    # Target role + experience level
    parsed_record = applicant.parsed_record
    target_role = "Software Developer"
    experience_level = "junior"
    if parsed_record and parsed_record.normalized:
        normalized = parsed_record.normalized
        target_role = normalized.get("target_role") or normalized.get("objective", {}).get("target_role") or "Software Developer"
        exp_years = float(normalized.get("total_experience") or normalized.get("work_experience_years") or 0.0)
        experience_level = "junior" if exp_years < 2.0 else "mid-level" if exp_years < 5.0 else "senior"

    # History context
    past_sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant.id,
            InterviewSession.status == "completed",
            InterviewSession.id != session_id
        )
        .all()
    )
    past_weak_skills = []
    if past_sessions:
        past_ids = [s.id for s in past_sessions]
        past_answers = (
            db.query(InterviewAnswer)
            .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
            .filter(
                InterviewAnswer.session_id.in_(past_ids),
                InterviewAnswer.status == "evaluated",
                InterviewAnswer.score.isnot(None),
            )
            .all()
        )
        past_skill_scores = {}
        for a in past_answers:
            tag = a.question.skill_tag
            past_skill_scores.setdefault(tag, []).append(a.score)
        for skill, scores in past_skill_scores.items():
            if (sum(scores) / len(scores)) < 0.60:
                past_weak_skills.append(skill)
        past_weak_skills = list(set(past_weak_skills))
        
    if past_weak_skills:
        history_context = f"Candidate's historical weak skills from previous sessions: {', '.join(past_weak_skills)}"
    else:
        history_context = "No previous mock practice history exists."

    return sse_response(
        wrap_sse_with_heartbeat(
            _stream_skill_gap_analysis(
                session_id=session_id,
                experience_level=experience_level,
                target_role=target_role,
                skill_scores_json=skill_scores_json,
                missing_concepts=missing_concepts,
                history_context=history_context
            )
        )
    )


# ---------------------------------------------------------------------------
