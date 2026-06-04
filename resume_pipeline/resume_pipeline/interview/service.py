"""
Interview System v2 — Session Service
Core business logic: session creation, question sequencing, results computation,
conversation history, and adaptive difficulty.
"""
import datetime
import logging
import uuid
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy.orm import Session as DBSession, joinedload

from ..db import InterviewSession, InterviewQuestion, InterviewAnswer, Applicant, LLMParsedRecord, LearningPath
from ..constants import INTERVIEW_CONFIG_V2
from .schemas import SkillBreakdownItem, QuestionReviewItem

logger = logging.getLogger(__name__)

# Score thresholds for skill labels
_SCORE_LABELS = [
    (0.80, "Strong"),
    (0.60, "Good"),
    (0.40, "Moderate"),
    (0.00, "Needs Work"),
]


def _score_label(score: float) -> str:
    for threshold, label in _SCORE_LABELS:
        if score >= threshold:
            return label
    return "Needs Work"


# ---------------------------------------------------------------------------
# Session creation
# ---------------------------------------------------------------------------

def create_session(
    applicant_id: int,
    interview_type: str,
    difficulty: str,
    num_questions: int,
    voice_mode: bool,
    topic_focus: Optional[str],
    questions_data: List[dict],
    db: DBSession,
    interviewer_persona: Optional[str] = "Friendly Senior Engineer",
) -> Tuple[InterviewSession, InterviewQuestion]:
    """
    Persist a new session and all its pre-generated questions.
    Returns the session and the first (non-reserve) question.
    """
    session_id = str(uuid.uuid4())
    total_questions = len(questions_data)

    session = InterviewSession(
        id=session_id,
        applicant_id=applicant_id,
        interview_type=interview_type,
        difficulty=difficulty,
        total_questions=total_questions,
        voice_mode=voice_mode,
        topic_focus=topic_focus,
        interviewer_persona=interviewer_persona,
        status="active",
    )
    db.add(session)
    db.flush()  # Get session.id without committing

    # Persist all questions (main + reserve)
    for i, q_data in enumerate(questions_data):
        q = InterviewQuestion(
            id=str(uuid.uuid4()),
            session_id=session_id,
            order_index=i,
            is_reserve=q_data.get("is_reserve", False),
            question_text=q_data["question_text"],
            skill_tag=q_data["skill_tag"],
            difficulty_level=q_data.get("difficulty_level", difficulty),
            expected_keywords=q_data.get("expected_keywords", []),
            question_type=q_data.get("question_type", "open_ended"),
        )
        db.add(q)

    db.commit()
    db.refresh(session)

    # Return first non-reserve question
    first_q = (
        db.query(InterviewQuestion)
        .filter(
            InterviewQuestion.session_id == session_id,
            InterviewQuestion.is_reserve == False,  # noqa: E712
        )
        .order_by(InterviewQuestion.order_index)
        .first()
    )
    return session, first_q


# ---------------------------------------------------------------------------
# Question sequencing (adaptive-aware)
# ---------------------------------------------------------------------------

def get_next_question(
    session_id: str,
    current_question_id: str,
    db: DBSession,
) -> Optional[InterviewQuestion]:
    """
    Return the next question in sequence.
    Adaptive: after every ADAPTIVE_CHECK_EVERY evaluated answers, may swap in a reserve.
    """
    current = db.query(InterviewQuestion).filter_by(id=current_question_id).first()
    if not current:
        return None

    # Count answered (non-reserve) questions
    answered_count = (
        db.query(InterviewAnswer)
        .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
        .filter(
            InterviewAnswer.session_id == session_id,
            InterviewQuestion.is_reserve == False,  # noqa: E712
        )
        .count()
    )

    check_every = INTERVIEW_CONFIG_V2["ADAPTIVE_CHECK_EVERY"]
    should_check = answered_count > 0 and answered_count % check_every == 0

    if should_check:
        running_score = get_running_score(session_id, db)
        high_thresh = INTERVIEW_CONFIG_V2["ADAPTIVE_HIGH_THRESHOLD"] / 100
        # If candidate is excelling, try to swap in a reserve (harder) question
        if running_score >= high_thresh:
            reserve = (
                db.query(InterviewQuestion)
                .filter(
                    InterviewQuestion.session_id == session_id,
                    InterviewQuestion.is_reserve == True,  # noqa: E712
                    ~InterviewQuestion.id.in_(
                        db.query(InterviewAnswer.question_id).filter_by(session_id=session_id)
                    ),
                )
                .order_by(InterviewQuestion.order_index)
                .first()
            )
            if reserve:
                logger.info(
                    "Adaptive: swapping in reserve question %s (running_score=%.2f)",
                    reserve.id, running_score
                )
                return reserve

    # Normal: next non-reserve question by order_index after current
    next_q = (
        db.query(InterviewQuestion)
        .filter(
            InterviewQuestion.session_id == session_id,
            InterviewQuestion.order_index > current.order_index,
            InterviewQuestion.is_reserve == False,  # noqa: E712
            # Not already answered
            ~InterviewQuestion.id.in_(
                db.query(InterviewAnswer.question_id).filter_by(session_id=session_id)
            ),
        )
        .order_by(InterviewQuestion.order_index)
        .first()
    )
    return next_q


def get_current_question(session_id: str, db: DBSession) -> Optional[InterviewQuestion]:
    """Return the most recent unanswered question (for crash recovery)."""
    answered_ids = (
        db.query(InterviewAnswer.question_id).filter_by(session_id=session_id).all()
    )
    answered_ids = {row[0] for row in answered_ids}

    questions = (
        db.query(InterviewQuestion)
        .filter(
            InterviewQuestion.session_id == session_id,
            InterviewQuestion.is_reserve == False,  # noqa: E712
        )
        .order_by(InterviewQuestion.order_index)
        .all()
    )

    for q in questions:
        if q.id not in answered_ids:
            return q
    return None  # All answered


# ---------------------------------------------------------------------------
# Conversation history (for Groq evaluation context)
# ---------------------------------------------------------------------------

def build_conversation_history(session_id: str, db: DBSession) -> List[dict]:
    """
    Reconstruct full conversation history for passing to Groq.
    Returns list of {role, content} dicts.
    """
    from ..utils import truncate_for_llm
    questions = (
        db.query(InterviewQuestion)
        .filter_by(session_id=session_id)
        .order_by(InterviewQuestion.order_index)
        .all()
    )
    answers = db.query(InterviewAnswer).filter_by(session_id=session_id).all()
    answer_map = {a.question_id: a for a in answers}

    messages = []
    for q in questions:
        messages.append({"role": "assistant", "content": q.question_text})
        answer = answer_map.get(q.id)
        if answer and answer.answer_text:
            safe_ans = truncate_for_llm(answer.answer_text, "interview_answer_max_chars")
            messages.append({"role": "user", "content": safe_ans})

    return messages


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

def get_running_score(session_id: str, db: DBSession) -> float:
    """
    Average score of all evaluated answers so far (0.0–1.0).
    Returns 0.5 if no evaluations exist yet.
    """
    answers = (
        db.query(InterviewAnswer)
        .filter(
            InterviewAnswer.session_id == session_id,
            InterviewAnswer.status == "evaluated",
            InterviewAnswer.score.isnot(None),
        )
        .all()
    )
    if not answers:
        return 0.5
    return sum(a.score for a in answers) / len(answers)


def get_weak_skills(session_id: str, db: DBSession) -> List[str]:
    """Return skill tags with average score below WEAK_SKILL_THRESHOLD."""
    threshold = INTERVIEW_CONFIG_V2["WEAK_SKILL_THRESHOLD"]
    answers = (
        db.query(InterviewAnswer)
        .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
        .filter(
            InterviewAnswer.session_id == session_id,
            InterviewAnswer.status == "evaluated",
        )
        .all()
    )

    skill_scores: Dict[str, List[float]] = {}
    for a in answers:
        if a.score is not None:
            tag = a.question.skill_tag
            skill_scores.setdefault(tag, []).append(a.score)

    weak = [
        skill for skill, scores in skill_scores.items()
        if (sum(scores) / len(scores)) < threshold
    ]
    return weak


def get_missing_concepts_summary(session_id: str, db: DBSession) -> str:
    """Aggregate missing concepts from all evaluated answers."""
    answers = (
        db.query(InterviewAnswer)
        .filter(
            InterviewAnswer.session_id == session_id,
            InterviewAnswer.status == "evaluated",
        )
        .all()
    )
    all_concepts = []
    for a in answers:
        if a.missing_concepts:
            all_concepts.extend(a.missing_concepts)
    return ", ".join(set(all_concepts)) if all_concepts else "None identified"


# ---------------------------------------------------------------------------
# Results computation
# ---------------------------------------------------------------------------

def build_full_results(session: InterviewSession, db: DBSession) -> dict:
    """
    Compute and return the complete results payload.
    Called once all answer evaluations are complete.
    """
    answers = (
        db.query(InterviewAnswer)
        .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
        .filter(InterviewAnswer.session_id == session.id)
        .options(joinedload(InterviewAnswer.question))
        .order_by(InterviewQuestion.order_index)
        .all()
    )

    # Compute overall score
    evaluated = [a for a in answers if a.status == "evaluated" and a.score is not None]
    overall = sum(a.score for a in evaluated) / len(evaluated) if evaluated else 0.0

    # Persist overall score
    session.overall_score = overall
    session.status = "completed"
    session.completed_at = datetime.datetime.utcnow()
    db.commit()

    # Skill breakdown
    skill_scores: Dict[str, List[float]] = {}
    for a in evaluated:
        tag = a.question.skill_tag
        skill_scores.setdefault(tag, []).append(a.score)

    skill_breakdown = []
    for skill, scores in skill_scores.items():
        avg = sum(scores) / len(scores)
        skill_breakdown.append(SkillBreakdownItem(
            skill=skill,
            score=round(avg, 3),
            questions=len(scores),
            label=_score_label(avg),
        ))
    skill_breakdown.sort(key=lambda x: x.score)  # weakest first

    # Per-question review
    questions_review = []
    for a in answers:
        questions_review.append(QuestionReviewItem(
            question_id=a.question_id,
            question=a.question.question_text,
            answer=a.answer_text or "",
            score=round(a.score, 3) if a.score is not None else None,
            feedback=a.feedback,
            strength=a.strength,
            missing_concepts=a.missing_concepts or [],
            status=a.status,
        ))

    weak_skills = get_weak_skills(session.id, db)

    # Check if a learning path already exists for this session_id inside skill_gaps cache metadata
    learning_path_id = None
    existing_paths = db.query(LearningPath).filter(
        LearningPath.applicant_id == session.applicant_id,
        LearningPath.generated_from == "interview"
    ).all()
    for lp in existing_paths:
        if lp.skill_gaps and isinstance(lp.skill_gaps, dict) and lp.skill_gaps.get("session_id") == session.id:
            learning_path_id = lp.id
            break

    return {
        "status": "complete",
        "overall_score": round(overall, 3),
        "skill_breakdown": [s.model_dump() for s in skill_breakdown],
        "questions_review": [q.model_dump() for q in questions_review],
        "weak_skills": weak_skills,
        "study_plan": session.study_plan,
        "learning_path_id": learning_path_id,
    }


# ---------------------------------------------------------------------------
# Session state management
# ---------------------------------------------------------------------------

def mark_session_abandoned(session_id: str, db: DBSession) -> None:
    session = db.query(InterviewSession).filter_by(id=session_id).first()
    if session and session.status == "active":
        session.status = "abandoned"
        db.commit()


def get_active_session(applicant_id: int, db: DBSession) -> Optional[InterviewSession]:
    """Return the most recent active session within the last 24 hours, if any."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
    return (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.status == "active",
            InterviewSession.created_at >= cutoff,
        )
        .order_by(InterviewSession.created_at.desc())
        .first()
    )
