"""
Interview System v2 — API Router
All interview endpoints. Registered in app.py via include_router.
"""
import logging
import uuid
import json
from typing import Optional, List, AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession

from ..auth import require_role
from ..core.credit_service import CreditService
from ..constants import CREDIT_CONFIG, INTERVIEW_CONFIG_V2
from ..db import (
    Applicant, InterviewAnswer, InterviewQuestion, InterviewSession,
    LLMParsedRecord, SessionLocal
)
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

    # --- Generate questions ---
    questions_data = generate_questions(
        context=context,
        num_questions=data.num_questions,
        interview_type=data.interview_type,
        difficulty=data.difficulty,
        topic_focus=data.topic_focus,
        past_weak_skills=past_weak_skills,
        past_missing_concepts=past_missing_concepts,
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
        raise HTTPException(status_code=409, detail="Question already answered.")

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
) -> AsyncGenerator[str, None]:
    """Yield generated plan tokens while accumulating and caching them to the database."""
    accumulated_tokens = []
    
    async for item in stream_study_plan(
        weak_skills=weak_skills,
        missing_concepts_summary=missing_concepts_summary,
        target_role=target_role,
        experience_level=experience_level,
        past_weak_skills=past_weak_skills,
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
            completed_at=s.completed_at.isoformat() if s.completed_at else None
        ))
    return history
