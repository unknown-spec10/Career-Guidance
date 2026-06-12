"""
Interview System v2 — API Router
All interview endpoints. Registered in app.py via include_router.
"""
import logging
import uuid
import json
from typing import Optional, List, AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.orm.attributes import flag_modified

from ..config import settings
from ..auth import require_role
from ..core.credit_service import CreditService
from ..constants import CREDIT_CONFIG, INTERVIEW_CONFIG_V2
from ..db import (
    Applicant, InterviewAnswer, InterviewQuestion, InterviewSession,
    LLMParsedRecord, SessionLocal, LearningPath
)
from ..schemas import LearningPathResponse
from .learning_path_generator import generate_learning_path
from .evaluator import run_evaluation, stream_feedback, stream_hint, stream_study_plan
from .generator import build_session_context, generate_questions
from .schemas import (
    ActiveSessionResponse,
    AnswerRequest,
    AnswerResponse,
    QuestionOut,
    ResultsResponse,
    SessionStateResponse,
    StartInterviewRequest,
    StartInterviewResponse,
    InterviewHistoryItem,
    SessionQuestionItem,
)
from .service import (
    build_full_results,
    create_session,
    get_active_session,
    get_current_question,
    get_missing_concepts_summary,
    get_next_question,
    get_weak_skills,
    mark_session_abandoned,
)
from .limiter import check_session_start_limits, check_answer_submit_limits

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interview", tags=["Interview v2"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_applicant(current_user, db: DBSession) -> Applicant:
    """Resolve the Applicant record from the authenticated user."""
    applicant = db.query(Applicant).filter_by(user_id=current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found.")
    return applicant


def _question_to_out(q: InterviewQuestion, number: int, total: int, hint: Optional[str] = None) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        text=q.question_text,
        question_number=number,
        total_questions=total,
        skill_tag=q.skill_tag,
        hint=hint,
    )


# ---------------------------------------------------------------------------
# POST /api/interview/start
# ---------------------------------------------------------------------------

@router.post("/start", response_model=StartInterviewResponse)
def start_interview(
    data: StartInterviewRequest,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """
    Start a new mock interview session.
    1. Check credits
    2. Load parsed resume
    3. Generate questions via Groq (one call)
    4. Persist session + questions
    5. Deduct credits
    6. Return session_id + first question
    """
    applicant = _get_applicant(current_user, db)
    applicant_id = applicant.id

    # --- Enforce Cost Rate Limiting and Daily Caps ---
    check_session_start_limits(applicant_id, db)

    # --- Check Exit/Abandon Suspension (Exit > 2 times per day) ---
    import datetime
    exit_cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    abandoned_count = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.status == "abandoned",
            InterviewSession.created_at >= exit_cutoff,
        )
        .count()
    )
    if abandoned_count >= 3:
        raise HTTPException(
            status_code=403,
            detail="Your mock practice privilege is temporarily suspended because you have exited/abandoned ongoing sessions more than twice in the last 24 hours."
        )

    # --- Credit check ---
    credit_service = CreditService(db)
    cost = data.num_questions
    eligible, msg, ctx = credit_service.check_eligibility(
        applicant_id=applicant_id,
        activity_type="full_interview",
        custom_cost=cost
    )
    if not eligible:
        raise HTTPException(status_code=402, detail=msg)

    # --- Load parsed resume ---
    parsed_record = db.query(LLMParsedRecord).filter_by(applicant_id=applicant_id).first()
    if not parsed_record:
        raise HTTPException(
            status_code=400,
            detail="Resume not parsed yet. Please upload and parse your resume before starting an interview."
        )

    context = build_session_context(parsed_record.normalized or {})

    # --- Load past evaluations to focus on weak areas (Growth-oriented) ---
    past_sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.status == "completed"
        )
        .all()
    )
    
    past_weak_skills = []
    past_missing_concepts = []
    
    if past_sessions:
        past_session_ids = [s.id for s in past_sessions]
        past_answers = (
            db.query(InterviewAnswer)
            .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
            .filter(
                InterviewAnswer.session_id.in_(past_session_ids),
                InterviewAnswer.status == "evaluated",
                InterviewAnswer.score.isnot(None),
            )
            .all()
        )
        
        # Aggregate scores
        skill_scores = {}
        for a in past_answers:
            tag = a.question.skill_tag
            skill_scores.setdefault(tag, []).append(a.score)
            if a.missing_concepts:
                past_missing_concepts.extend(a.missing_concepts)
                
        # Find weak skills (< 60% average)
        for skill, scores in skill_scores.items():
            avg = sum(scores) / len(scores)
            if avg < 0.60:
                past_weak_skills.append(skill)
                
        past_weak_skills = list(set(past_weak_skills))[:5]
        past_missing_concepts = list(set(past_missing_concepts))[:10]

    # --- Load previously asked questions to avoid duplication ---
    past_questions_list = (
        db.query(InterviewQuestion)
        .join(InterviewSession, InterviewQuestion.session_id == InterviewSession.id)
        .filter(InterviewSession.applicant_id == applicant_id)
        .order_by(InterviewQuestion.created_at.desc())
        .limit(20)
        .all()
    )
    past_question_texts = [q.question_text for q in past_questions_list]

    # --- Generate questions ---
    questions_data = generate_questions(
        context=context,
        num_questions=data.num_questions,
        interview_type=data.interview_type,
        difficulty=data.difficulty,
        topic_focus=data.topic_focus,
        past_weak_skills=past_weak_skills,
        past_missing_concepts=past_missing_concepts,
        past_question_texts=past_question_texts,
        interviewer_persona=data.interviewer_persona,
        db=db,
        applicant_id=applicant_id,
    )

    # --- Persist session ---
    session, first_q = create_session(
        applicant_id=applicant_id,
        interview_type=data.interview_type,
        difficulty=data.difficulty,
        num_questions=data.num_questions,
        voice_mode=data.voice_mode,
        topic_focus=data.topic_focus,
        questions_data=questions_data,
        db=db,
        interviewer_persona=data.interviewer_persona,
    )

    # --- Deduct credits (after successful session creation) ---
    try:
        credit_service.spend_credits(
            applicant_id=applicant_id,
            activity_type="full_interview",
            cost=cost,
            reference_id=None,
            reference_type="interview_session",
            description=f"Started {data.interview_type} interview ({data.num_questions} questions, {data.difficulty})",
        )
    except Exception as e:
        logger.warning("Credit deduction failed for session %s: %s", session.id, e)
        # Don't abort — session is already created; log and continue

    # Count non-reserve questions for question numbering
    non_reserve_total = sum(1 for q in questions_data if not q.get("is_reserve", False))

    return StartInterviewResponse(
        session_id=session.id,
        first_question=_question_to_out(first_q, 1, non_reserve_total),
    )


# ---------------------------------------------------------------------------
# POST /api/interview/answer
# ---------------------------------------------------------------------------

@router.post("/answer", response_model=AnswerResponse)
def submit_answer(
    data: AnswerRequest,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """
    Submit an answer to the current question.
    - Saves answer immediately
    - Queues evaluation as a background task (user never waits for this)
    - Returns next question in ~20ms (from DB, no Groq call)
    """
    applicant = _get_applicant(current_user, db)

    # --- Enforce Cost Rate Limiting and Daily Caps ---
    check_answer_submit_limits(applicant.id, db)

    # Validate session ownership
    session = db.query(InterviewSession).filter_by(id=data.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is {session.status}, not active.")

    # Validate question belongs to this session
    question = db.query(InterviewQuestion).filter_by(
        id=data.question_id, session_id=data.session_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found in this session.")

    # Check if already answered (idempotency guard)
    existing = db.query(InterviewAnswer).filter_by(
        session_id=data.session_id, question_id=data.question_id
    ).first()

    if existing:
        # Update existing answer and reset evaluation attributes for re-grading
        existing.answer_text = data.answer_text
        existing.status = "pending_evaluation"
        existing.score = None
        existing.feedback = None
        existing.strength = None
        existing.missing_concepts = None
        db.commit()

        # Re-queue background evaluation
        def _eval_with_new_db():
            bg_db = SessionLocal()
            try:
                run_evaluation(
                    session_id=data.session_id,
                    question_id=data.question_id,
                    answer_id=existing.id,
                    db=bg_db,
                )
            finally:
                bg_db.close()
        background_tasks.add_task(_eval_with_new_db)
        
        return AnswerResponse(status="ok", next_question=None)

    # --- Save answer immediately ---
    answer_id = str(uuid.uuid4())
    answer = InterviewAnswer(
        id=answer_id,
        session_id=data.session_id,
        question_id=data.question_id,
        answer_text=data.answer_text,
        status="pending_evaluation",
    )
    db.add(answer)
    db.commit()

    # --- Queue background evaluation ---
    # Pass a new DB session to the background task to avoid session conflicts
    def _eval_with_new_db():
        bg_db = SessionLocal()
        try:
            run_evaluation(
                session_id=data.session_id,
                question_id=data.question_id,
                answer_id=answer_id,
                db=bg_db,
            )
        finally:
            bg_db.close()

    background_tasks.add_task(_eval_with_new_db)

    # --- Get next question ---
    next_q = get_next_question(data.session_id, data.question_id, db)

    if next_q is None:
        # Interview complete
        return AnswerResponse(status="interview_complete", next_question=None)

    # Count answered non-reserve questions for display numbering
    answered_count = (
        db.query(InterviewAnswer)
        .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
        .filter(
            InterviewAnswer.session_id == data.session_id,
            InterviewQuestion.is_reserve == False,  # noqa: E712
        )
        .count()
    )
    non_reserve_total = (
        db.query(InterviewQuestion)
        .filter_by(session_id=data.session_id, is_reserve=False)
        .count()
    )

    return AnswerResponse(
        status="ok",
        next_question=_question_to_out(next_q, answered_count + 1, non_reserve_total),
    )


# ---------------------------------------------------------------------------
# GET /api/interview/session/{session_id}  — crash recovery
# ---------------------------------------------------------------------------

@router.get("/session/{session_id}", response_model=SessionStateResponse)
def get_session_state(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Return current session state for page-refresh recovery."""
    applicant = _get_applicant(current_user, db)

    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    answers_submitted = db.query(InterviewAnswer).filter_by(session_id=session_id).count()
    current_q = get_current_question(session_id, db)
    non_reserve_total = (
        db.query(InterviewQuestion)
        .filter_by(session_id=session_id, is_reserve=False)
        .count()
    )

    return SessionStateResponse(
        session_id=session_id,
        status=session.status,
        current_question_index=answers_submitted,
        total_questions=non_reserve_total,
        current_question=_question_to_out(current_q, answers_submitted + 1, non_reserve_total) if current_q else None,
        answers_submitted=answers_submitted,
        interview_type=session.interview_type,
        difficulty=session.difficulty,
        voice_mode=session.voice_mode or False,
        interviewer_persona=session.interviewer_persona or "Friendly Senior Engineer",
    )


# ---------------------------------------------------------------------------
# GET /api/interview/results/{session_id}
# ---------------------------------------------------------------------------

@router.get("/results/{session_id}")
def get_results(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """
    Poll for results. Returns {"status": "processing"} until all evaluations complete,
    then returns the full results payload.
    """
    applicant = _get_applicant(current_user, db)

    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    answers = db.query(InterviewAnswer).filter_by(session_id=session_id).all()
    pending = [a for a in answers if a.status == "pending_evaluation"]

    if pending:
        return {
            "status": "processing",
            "completed": len(answers) - len(pending),
            "total": len(answers),
        }

    # All done — build full results
    return build_full_results(session, db)


# ---------------------------------------------------------------------------
# GET /api/interview/study-plan/{session_id}  — SSE stream
# ---------------------------------------------------------------------------

async def _stream_cached_plan(plan_text: str) -> AsyncGenerator[str, None]:
    """Yield cached study plan in small chunks to simulate streaming animation quickly."""
    chunk_size = 120
    for i in range(0, len(plan_text), chunk_size):
        chunk = plan_text[i:i+chunk_size]
        yield f"data: {json.dumps({'token': chunk})}\n\n"
    yield "data: [DONE]\n\n"


async def _stream_and_cache_study_plan(
    session_id: str,
    db: DBSession,
    weak_skills: List[str],
    missing_concepts_summary: str,
    target_role: str,
    experience_level: str,
    past_weak_skills: Optional[List[str]] = None,
    interviewer_persona: str = "Friendly Senior Engineer",
) -> AsyncGenerator[str, None]:
    """Yield generated plan tokens while accumulating and caching them to the database."""
    accumulated_tokens = []
    
    async for item in stream_study_plan(
        weak_skills=weak_skills,
        missing_concepts_summary=missing_concepts_summary,
        target_role=target_role,
        experience_level=experience_level,
        past_weak_skills=past_weak_skills,
        interviewer_persona=interviewer_persona,
    ):
        yield item
        
        if item.startswith("data: ") and "[DONE]" not in item:
            try:
                raw_json = item[6:].strip()
                data = json.loads(raw_json)
                token = data.get("token", "")
                if token:
                    accumulated_tokens.append(token)
            except Exception:
                pass
                
    full_plan = "".join(accumulated_tokens).strip()
    if full_plan:
        save_db = SessionLocal()
        try:
            session = save_db.query(InterviewSession).filter_by(id=session_id).first()
            if session:
                session.study_plan = full_plan
                save_db.commit()
                logger.info("Saved generated study plan to DB for session %s", session_id)
        except Exception as e:
            logger.error("Failed to save study plan to DB for session %s: %s", session_id, e)
        finally:
            save_db.close()


@router.get("/study-plan/{session_id}")
async def stream_study_plan_endpoint(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Stream the personalized 30-day study plan as SSE tokens (cached if generated)."""
    applicant = _get_applicant(current_user, db)

    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    # Return cached plan if it exists
    if session.study_plan:
        return StreamingResponse(
            _stream_cached_plan(session.study_plan),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Fetch past completed sessions BEFORE this one to find past weak skills
    past_sessions = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant.id,
            InterviewSession.status == "completed",
            InterviewSession.id != session_id,
            InterviewSession.created_at < session.created_at
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
        skill_scores = {}
        for a in past_answers:
            tag = a.question.skill_tag
            skill_scores.setdefault(tag, []).append(a.score)
        for skill, scores in skill_scores.items():
            if (sum(scores) / len(scores)) < 0.60:
                past_weak_skills.append(skill)
        past_weak_skills = list(set(past_weak_skills))

    parsed_record = db.query(LLMParsedRecord).filter_by(applicant_id=applicant.id).first()
    context = build_session_context(parsed_record.normalized or {}) if parsed_record else {}

    weak_skills = get_weak_skills(session_id, db)
    missing_summary = get_missing_concepts_summary(session_id, db)
    experience_level = (
        "junior" if context.get("experience_years", 0) < 2
        else "mid-level" if context.get("experience_years", 0) < 5
        else "senior"
    )

    return StreamingResponse(
        _stream_and_cache_study_plan(
            session_id=session_id,
            db=db,
            weak_skills=weak_skills,
            missing_concepts_summary=missing_summary,
            target_role=context.get("target_role", "Software Engineer"),
            experience_level=experience_level,
            past_weak_skills=past_weak_skills,
            interviewer_persona=session.interviewer_persona or "Friendly Senior Engineer",
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
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

    return StreamingResponse(
        stream_hint(
            skill_tag=question.skill_tag if question else "the topic",
            missing_concepts=missing,
            interviewer_persona=session.interviewer_persona or "Friendly Senior Engineer",
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
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

    return StreamingResponse(
        stream_feedback(
            question_text=question.question_text if question else "",
            answer_text=answer.answer_text or "",
            skill_tag=question.skill_tag if question else "General",
            expected_keywords=question.expected_keywords or [] if question else [],
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# POST /api/interview/abandon/{session_id}  — beacon on tab close
# ---------------------------------------------------------------------------

@router.post("/abandon/{session_id}", status_code=204)
def abandon_session(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Mark a session as abandoned (called via navigator.sendBeacon on page unload)."""
    applicant = _get_applicant(current_user, db)
    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if session and session.applicant_id == applicant.id:
        mark_session_abandoned(session_id, db)


# ---------------------------------------------------------------------------
# GET /api/interview/active-session  — resume banner on setup page
# ---------------------------------------------------------------------------

@router.get("/active-session", response_model=ActiveSessionResponse)
def check_active_session(
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Check if the user has an unfinished interview session in the last 24 hours."""
    applicant = _get_applicant(current_user, db)
    session = get_active_session(applicant.id, db)

    if not session:
        return ActiveSessionResponse(has_active_session=False)

    answers_submitted = db.query(InterviewAnswer).filter_by(session_id=session.id).count()
    non_reserve_total = (
        db.query(InterviewQuestion)
        .filter_by(session_id=session.id, is_reserve=False)
        .count()
    )

    return ActiveSessionResponse(
        has_active_session=True,
        session_id=session.id,
        created_at=session.created_at.isoformat(),
        answers_submitted=answers_submitted,
        total_questions=non_reserve_total,
        interview_type=session.interview_type,
    )


# ---------------------------------------------------------------------------
# GET /api/interview/history
# ---------------------------------------------------------------------------

@router.get("/history", response_model=List[InterviewHistoryItem])
def get_interview_history(
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Get the interview history for the current student user."""
    applicant = _get_applicant(current_user, db)
    sessions = (
        db.query(InterviewSession)
        .filter_by(applicant_id=applicant.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )

    history = []
    for s in sessions:
        num_q = (
            db.query(InterviewQuestion)
            .filter_by(session_id=s.id, is_reserve=False)
            .count()
        )
        history.append(InterviewHistoryItem(
            session_id=s.id,
            interview_type=s.interview_type,
            difficulty=s.difficulty,
            num_questions=num_q,
            overall_score=s.overall_score,
            status=s.status,
            topic_focus=s.topic_focus,
            created_at=s.created_at.isoformat(),
            completed_at=s.completed_at.isoformat() if s.completed_at else None,
            interviewer_persona=s.interviewer_persona or "Friendly Senior Engineer",
        ))
    return history


# ---------------------------------------------------------------------------
# POST /api/interview/transcribe  — Voice STT via Groq Whisper
# ---------------------------------------------------------------------------

@router.post("/transcribe")
def transcribe_audio(
    audio: UploadFile = File(...),
    current_user=Depends(require_role("student")),
):
    """
    Transcribe raw microphone audio chunks into text using Groq Whisper.
    Supports a mock developer fallback mode for local testing without key configuration.
    """
    from ..config import settings
    from groq import Groq

    # Check if Groq key is configured or mock mode is active
    if settings.GEMINI_MOCK_MODE or not settings.GROQ_API_KEY:
        logger.info("STT Mock Mode activated (GEMINI_MOCK_MODE=True or GROQ_API_KEY missing)")
        return {"transcript": "This is a mock transcription of your speech response for testing."}

    audio_bytes = audio.file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file uploaded.")

    try:
        groq_client = Groq(api_key=settings.GROQ_API_KEY)
        
        # Clean up extension to satisfy Groq strict type checking
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
        
        # Call Groq Whisper STT API
        transcription = groq_client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model=settings.GROQ_STT_MODEL or "whisper-large-v3",
            response_format="json",
        )
        return {"transcript": transcription.text}
    except Exception as e:
        logger.error(f"Groq Whisper transcription failed: {e}")
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
# POST /api/interview/finish/{session_id}  — early session finish
# ---------------------------------------------------------------------------

@router.post("/finish/{session_id}")
def finish_interview(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Finish an ongoing mock interview session early/mid-way."""
    applicant = _get_applicant(current_user, db)
    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    if session.status == "active":
        import datetime
        session.status = "completed"
        session.completed_at = datetime.datetime.utcnow()
        db.commit()

    return {"status": "ok"}


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
    """Streams the skill gap analysis JSON character-by-character from Groq, and caches it to db."""
    from .prompts import SKILL_GAP_ANALYSIS_PROMPT, GROQ_MODEL
    from groq import Groq
    
    groq_client = Groq(api_key=settings.GROQ_API_KEY)
    
    prompt = SKILL_GAP_ANALYSIS_PROMPT.format(
        experience_level=experience_level,
        target_role=target_role,
        skill_scores_json=skill_scores_json,
        missing_concepts=missing_concepts,
        history_context=history_context
    )
    
    accumulated_tokens = []
    try:
        stream = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1500,
            stream=True
        )
        
        for chunk in stream:
            delta = chunk.choices[0].delta.content
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
    Streams structured skill gap analysis JSON character-by-character using Groq (or serves cached JSON).
    """
    applicant = _get_applicant(current_user, db)
    
    session = db.query(InterviewSession).filter_by(id=session_id, applicant_id=applicant.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
        
    # Serve cached skill gap analysis if it exists inside session.study_plan
    if session.study_plan and session.study_plan.strip().startswith("{"):
        logger.info("Serving cached skill gap analysis from session.study_plan for session %s", session_id)
        return StreamingResponse(
            _stream_cached_plan(session.study_plan),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
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

    return StreamingResponse(
        _stream_skill_gap_analysis(
            session_id=session_id,
            experience_level=experience_level,
            target_role=target_role,
            skill_scores_json=skill_scores_json,
            missing_concepts=missing_concepts,
            history_context=history_context
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


# ---------------------------------------------------------------------------
# POST /api/interview/generate-learning-path/{session_id}
# ---------------------------------------------------------------------------

@router.post("/generate-learning-path/{session_id}")
def trigger_generate_learning_path(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """
    Generate a personalized learning path based on the completed mock interview session.
    Charges 10 credits, enforces daily cap of 2 per user.
    """
    applicant = _get_applicant(current_user, db)
    session = db.query(InterviewSession).filter_by(id=session_id, applicant_id=applicant.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")
    
    try:
        path = generate_learning_path(session_id, db)
        return {
            "path_id": path.get("path_id"),
            "already_exists": path.get("already_exists", False)
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error generating learning path: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error generating learning path.")


# ===========================================================================
# APIRouter for Learning Paths (/api/learning-paths/*)
# ===========================================================================

learning_path_router = APIRouter(prefix="/api/learning-paths", tags=["Learning Paths"])

@learning_path_router.get("/{path_id}", response_model=LearningPathResponse)
def get_learning_path_by_id(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """
    Retrieve a learning path by ID. Verified against logged-in user.
    """
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")
    return path

@learning_path_router.get("/applicant/{applicant_id}", response_model=List[LearningPathResponse])
def get_learning_paths_by_applicant(
    applicant_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """
    Retrieve all learning paths for a given applicant.
    """
    applicant = _get_applicant(current_user, db)
    if applicant.id != applicant_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to applicant learning paths.")
        
    # Lazy garbage collection of soft-deleted paths > 30 days old
    import datetime
    all_paths = db.query(LearningPath).filter_by(applicant_id=applicant_id).all()
    active_paths = []
    
    deleted_any = False
    for p in all_paths:
        if p.skill_gaps and isinstance(p.skill_gaps, dict) and p.skill_gaps.get("is_deleted"):
            deleted_at_str = p.skill_gaps.get("deleted_at")
            if deleted_at_str:
                try:
                    deleted_at = datetime.datetime.fromisoformat(deleted_at_str)
                    age = datetime.datetime.utcnow() - deleted_at
                    if age.days >= 30:
                        db.delete(p)
                        deleted_any = True
                        continue
                except Exception:
                    pass
        active_paths.append(p)
        
    if deleted_any:
        db.commit()
        # Re-fetch remaining paths after hard deletes
        active_paths = db.query(LearningPath).filter_by(applicant_id=applicant_id).order_by(LearningPath.created_at.desc()).all()
    else:
        # Just sort active paths
        active_paths.sort(key=lambda x: x.created_at, reverse=True)
        
    return active_paths


@learning_path_router.post("/{path_id}/complete", response_model=LearningPathResponse)
def mark_learning_path_completed(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Mark a learning path as completed."""
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")
        
    path.status = "completed"
    path.progress_percentage = 100.0
    db.commit()
    db.refresh(path)
    return path


@learning_path_router.post("/{path_id}/delete", response_model=LearningPathResponse)
def soft_delete_learning_path(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Soft delete a learning path (deletes permanently after 30 days)."""
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")
        
    import datetime
    skill_gaps = dict(path.skill_gaps) if path.skill_gaps else {}
    skill_gaps["is_deleted"] = True
    skill_gaps["deleted_at"] = datetime.datetime.utcnow().isoformat()
    
    path.skill_gaps = skill_gaps
    flag_modified(path, "skill_gaps")
    
    db.commit()
    db.refresh(path)
    return path


@learning_path_router.post("/{path_id}/restore", response_model=LearningPathResponse)
def restore_learning_path(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Restore a soft-deleted learning path."""
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")
        
    skill_gaps = dict(path.skill_gaps) if path.skill_gaps else {}
    if "is_deleted" in skill_gaps:
        del skill_gaps["is_deleted"]
    if "deleted_at" in skill_gaps:
        del skill_gaps["deleted_at"]
        
    path.skill_gaps = skill_gaps
    flag_modified(path, "skill_gaps")
    
    db.commit()
    db.refresh(path)
    return path


# ---------------------------------------------------------------------------
# GET /api/interview/candidate-intelligence
# ---------------------------------------------------------------------------

@router.get("/candidate-intelligence")
def get_student_candidate_intelligence(
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Fetch the authenticated student's cumulative intelligence profile."""
    applicant = _get_applicant(current_user, db)
    if not applicant.candidate_profile:
        return {
            "status": "no_sessions",
            "message": "Complete at least one mock interview session to unlock Longitudinal AI Candidate Intelligence insights."
        }
    return applicant.candidate_profile


# ---------------------------------------------------------------------------
# GET /api/interview/candidate-intelligence/{applicant_id}
# ---------------------------------------------------------------------------

@router.get("/candidate-intelligence/{applicant_id}")
def get_employer_candidate_intelligence(
    applicant_id: str,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("employer", "admin"))
):
    """Fetch an applicant's cumulative intelligence profile for employers or admins."""
    # Resolve the applicant
    applicant = db.query(Applicant).filter_by(applicant_id=applicant_id).first()
    if not applicant:
        # Check if they passed an integer DB id
        try:
            db_id = int(applicant_id)
            applicant = db.query(Applicant).filter_by(id=db_id).first()
        except ValueError:
            pass

    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found.")

    if not applicant.candidate_profile:
        return {
            "status": "no_sessions",
            "message": "Candidate has not completed any mock sessions yet. No AI insights available."
        }
    return applicant.candidate_profile

