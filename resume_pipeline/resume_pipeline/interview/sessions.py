"""Interview System v2 — session lifecycle routes.

Owns the state-machine endpoints under ``/api/interview``: start, answer,
session state, results, abandon (button + sendBeacon), active-session,
history, finish, and candidate intelligence. Streaming/voice endpoints live
in :mod:`streaming`. Paths, methods, schemas, and role guards are unchanged
from the former monolithic ``router.py``.
"""
import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from ..auth import require_role
from ..core.credit_service import CreditService
from ..db import (
    InterviewAnswer,
    InterviewQuestion,
    InterviewSession,
    LLMParsedRecord,
    SessionLocal,
)
from .common import (
    MAX_EVAL_RETRIES,
    _abandon_token_is_valid,
    _get_applicant,
    _make_abandon_token,
    _question_to_out,
    get_db,
)
from .evaluator import run_evaluation
from .generator import build_session_context, generate_questions
from .limiter import check_answer_submit_limits, check_session_start_limits
from .schemas import (
    ActiveSessionResponse,
    AnswerRequest,
    AnswerResponse,
    InterviewHistoryItem,
    SessionStateResponse,
    StartInterviewRequest,
    StartInterviewResponse,
)
from .service import (
    build_full_results,
    create_session,
    get_active_session,
    get_current_question,
    get_next_question,
    mark_session_abandoned,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interview", tags=["Interview v2"])


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
    3. Generate questions via the chat provider (one call)
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
        abandon_token=_make_abandon_token(session.id, applicant_id),
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

        # Resubmission: no sequencing change — stay on the current question.
        # answer_id is returned so the client can request a hint for this answer.
        return AnswerResponse(status="ok", next_question=None, answer_id=existing.id)

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
        return AnswerResponse(status="interview_complete", next_question=None, answer_id=answer_id)

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
        answer_id=answer_id,
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
        abandon_token=_make_abandon_token(session.id, applicant.id) if session.status == "active" else None,
    )


# ---------------------------------------------------------------------------
# GET /api/interview/results/{session_id}
# ---------------------------------------------------------------------------



@router.get("/results/{session_id}")
def get_results(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """
    Poll for results. Returns {"status": "processing"} until all evaluations complete,
    then returns the full results payload.

    Recovery: answers stuck in pending/failed states are re-scheduled for
    evaluation on poll, up to MAX_EVAL_RETRIES attempts. Once retries are
    exhausted, partial results are delivered instead of polling forever
    (failed questions appear with status 'evaluation_failed' in the review).
    """
    applicant = _get_applicant(current_user, db)

    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.applicant_id != applicant.id:
        raise HTTPException(status_code=403, detail="Not your session.")

    answers = db.query(InterviewAnswer).filter_by(session_id=session_id).all()

    # Retry-on-poll recovery for lost/failed background evaluations.
    retried = False
    for a in answers:
        needs_retry = (
            a.status in ("pending_evaluation", "evaluation_failed")
            and (a.evaluation_attempts or 0) < MAX_EVAL_RETRIES
        )
        if needs_retry:
            a.evaluation_attempts = (a.evaluation_attempts or 0) + 1
            answer_id, question_id = a.id, a.question_id
            retried = True

            def _eval_with_new_db(answer_id=answer_id, question_id=question_id, session_id=session_id):
                bg_db = SessionLocal()
                try:
                    run_evaluation(session_id, question_id, answer_id, bg_db)
                finally:
                    bg_db.close()

            background_tasks.add_task(_eval_with_new_db)

    if retried:
        db.commit()

    # Return "processing" whenever a retry is in flight (scheduled this poll)
    # or any answer can still be retried on a future poll. Only once every
    # unevaluated answer has exhausted its attempts do we deliver honest
    # partial results instead of polling forever.
    retryable = [
        a for a in answers
        if a.status != "evaluated"
        and (a.evaluation_attempts or 0) < MAX_EVAL_RETRIES
    ]

    if retried or retryable:
        return {
            "status": "processing",
            "completed": len([a for a in answers if a.status == "evaluated"]),
            "total": len(answers),
        }

    return build_full_results(session, db)


# ---------------------------------------------------------------------------
# POST /api/interview/abandon/{session_id}  — beacon on tab close
# ---------------------------------------------------------------------------

@router.post("/abandon/{session_id}", status_code=204)
def abandon_session(
    session_id: str,
    abandon_token: Optional[str] = None,
    db: DBSession = Depends(get_db),
    current_user=Depends(require_role("student")),
):
    """Mark a session as abandoned.

    Two authentication paths:
      1. Normal Bearer auth (explicit "Quit" button via axios).
      2. `abandon_token` query param (HMAC issued at session start) — used by
         navigator.sendBeacon on tab close, which cannot send headers.

    Note: FastAPI resolves header-auth BEFORE this body runs; when only the
    beacon token is available the frontend must call the public alias below.
    """
    applicant = _get_applicant(current_user, db)
    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if session and session.applicant_id == applicant.id:
        mark_session_abandoned(session_id, db)


@router.post("/abandon-beacon/{session_id}", status_code=204)
def abandon_session_beacon(
    session_id: str,
    abandon_token: Optional[str] = None,
    db: DBSession = Depends(get_db),
):
    """sendBeacon-only abandon path: authenticated by the per-session HMAC token.

    sendBeacon cannot set HTTP headers, so normal Bearer auth is impossible from
    an unload handler. The HMAC token is single-purpose (this session only) and
    server-verified against SECRET_KEY.
    """
    if not abandon_token:
        raise HTTPException(status_code=401, detail="Missing abandon token.")
    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if not _abandon_token_is_valid(session, abandon_token):
        raise HTTPException(status_code=403, detail="Invalid abandon token.")
    # HMAC bypasses Bearer auth, so enforce account state here: a deactivated
    # account's tokens must stop working even on this sendBeacon path.
    from ..db import Applicant, User
    applicant = db.query(Applicant).filter_by(id=session.applicant_id).first()
    owner = db.query(User).filter_by(id=applicant.user_id).first() if applicant else None
    if owner is not None and not getattr(owner, "is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
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
