"""
Interview System v2 — Background Evaluator
Runs answer evaluation asynchronously via FastAPI BackgroundTasks.
Also provides streaming generators for hints and per-question feedback.
"""
import datetime
import json
import logging
from typing import AsyncGenerator, Optional, List

from ..config import settings
from ..db import InterviewAnswer, InterviewQuestion
from ..constants import INTERVIEW_CONFIG_V2
from ..core.llm_router import llm_router
from .prompts import GROQ_MODEL, EVALUATION_PROMPT, HINT_PROMPT, PERSONA_PROMPTS
from .service import build_conversation_history, get_running_score

logger = logging.getLogger(__name__)





# ---------------------------------------------------------------------------
# Core evaluation — called as a BackgroundTask
# ---------------------------------------------------------------------------

def run_evaluation(
    session_id: str,
    question_id: str,
    answer_id: str,
    db,
) -> None:
    """
    Evaluates a single answer via Groq and persists the result.
    Designed to run as a FastAPI BackgroundTask (runs after HTTP response is sent).
    Uses a separate DB session to avoid conflicts with the request session.
    """
    try:
        question: Optional[InterviewQuestion] = db.query(InterviewQuestion).filter_by(id=question_id).first()
        answer: Optional[InterviewAnswer] = db.query(InterviewAnswer).filter_by(id=answer_id).first()

        if not question or not answer:
            logger.error("Evaluation aborted: question or answer not found (answer_id=%s)", answer_id)
            return

        from ..db import InterviewSession
        session_obj = db.query(InterviewSession).filter_by(id=session_id).first()
        interviewer_persona = session_obj.interviewer_persona if session_obj else "Friendly Senior Engineer"

        history = build_conversation_history(session_id, db)
        evaluation = _evaluate_with_groq(
            question_text=question.question_text,
            answer_text=answer.answer_text or "",
            skill_tag=question.skill_tag,
            expected_keywords=question.expected_keywords or [],
            conversation_history=history,
            interviewer_persona=interviewer_persona,
        )

        answer.score = evaluation.get("score", 0.0)
        answer.feedback = evaluation.get("feedback", "")
        answer.strength = evaluation.get("strength", "")
        answer.missing_concepts = evaluation.get("missing_concepts", [])
        answer.status = "evaluated"
        answer.evaluated_at = datetime.datetime.utcnow()

        # Populate hint only for weak answers (score < LOW_THRESHOLD)
        low_thresh = INTERVIEW_CONFIG_V2["ADAPTIVE_LOW_THRESHOLD"] / 100
        hint_raw = evaluation.get("hint_for_next")
        answer.hint_for_next = hint_raw if (answer.score < low_thresh and hint_raw) else None

        db.commit()
        logger.info("Evaluated answer %s: score=%.2f", answer_id, answer.score)

        # Check if all answers for the session are evaluated
        pending_count = (
            db.query(InterviewAnswer)
            .filter(
                InterviewAnswer.session_id == session_id,
                InterviewAnswer.status == "pending_evaluation"
            )
            .count()
        )
        if pending_count == 0:
            logger.info("All answers evaluated for session %s. Completing session and triggering Longitudinal Candidate Intelligence update...", session_id)
            try:
                from ..db import InterviewSession
                session_obj = db.query(InterviewSession).filter_by(id=session_id).first()
                if session_obj:
                    # Calculate overall score across all answers of this session
                    answers = db.query(InterviewAnswer).filter_by(session_id=session_id).all()
                    evaluated = [a for a in answers if a.status == "evaluated" and a.score is not None]
                    overall = sum(a.score for a in evaluated) / len(evaluated) if evaluated else 0.0
                    
                    session_obj.overall_score = overall
                    session_obj.status = "completed"
                    session_obj.completed_at = datetime.datetime.utcnow()
                    db.commit()
                    
                    from .candidate_intelligence import generate_longitudinal_profile
                    generate_longitudinal_profile(session_obj.applicant_id, db)
            except Exception as e:
                logger.error("Failed to finalize session and generate Longitudinal Candidate Intelligence: %s", e)

    except Exception as e:
        logger.error("Evaluation failed for answer %s: %s", answer_id, e)
        try:
            answer = db.query(InterviewAnswer).filter_by(id=answer_id).first()
            if answer:
                answer.status = "evaluation_failed"
                db.commit()
        except Exception as inner:
            logger.error("Could not mark answer as failed: %s", inner)


def _evaluate_with_groq(
    question_text: str,
    answer_text: str,
    skill_tag: str,
    expected_keywords: List[str],
    conversation_history: List[dict],
    interviewer_persona: str = "Friendly Senior Engineer",
) -> dict:
    """
    Send question + answer + conversation history to LLMRouter for evaluation.
    Returns a dict: {score, feedback, strength, missing_concepts, hint_for_next}
    """
    from ..utils import truncate_for_llm
    safe_answer = truncate_for_llm(answer_text or "", "interview_answer_max_chars")

    persona_info = PERSONA_PROMPTS.get(interviewer_persona, PERSONA_PROMPTS["Friendly Senior Engineer"])
    persona_instruction = persona_info["evaluation_instruction"]

    eval_prompt = EVALUATION_PROMPT.format(
        question_text=question_text,
        skill_tag=skill_tag,
        expected_keywords=", ".join(expected_keywords) if expected_keywords else "Not specified",
        answer_text=safe_answer,
        persona_instruction=persona_instruction,
    )

    messages = conversation_history + [{"role": "user", "content": eval_prompt}]

    try:
        res = llm_router.generate_chat_completion(
            messages=messages,
            provider="groq",
            model_name=GROQ_MODEL,
            temperature=0.3,
            max_tokens=1024,
            response_format={"type": "json_object"}
        )
        raw = res["content"].strip()
        result = json.loads(raw)
        result["score"] = max(0.0, min(1.0, float(result.get("score", 0.0))))
        return result
    except Exception as e:
        logger.error(f"LLMRouter evaluation failed: {e}")
        raise


# ---------------------------------------------------------------------------
# Streaming hint — sent before showing next question on weak answer
# ---------------------------------------------------------------------------

async def stream_hint(
    skill_tag: str,
    missing_concepts: List[str],
    interviewer_persona: str = "Friendly Senior Engineer",
) -> AsyncGenerator[str, None]:
    """
    Yields Server-Sent Event tokens for a mid-interview nudge.
    Used when the candidate gave a weak answer (score < LOW_THRESHOLD).
    """
    persona_info = PERSONA_PROMPTS.get(interviewer_persona, PERSONA_PROMPTS["Friendly Senior Engineer"])
    persona_instruction = persona_info["hint_instruction"]

    prompt = HINT_PROMPT.format(
        skill_tag=skill_tag,
        missing_concepts=", ".join(missing_concepts) if missing_concepts else skill_tag,
        persona_instruction=persona_instruction,
    )

    messages = [{"role": "user", "content": prompt}]
    
    try:
        for chunk in llm_router.generate_chat_completion_stream(
            messages=messages,
            provider="groq",
            model_name=GROQ_MODEL,
            temperature=0.6,
            max_tokens=150
        ):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    except Exception as e:
        logger.error(f"stream_hint fallback stream error: {e}")

    yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# Streaming per-question feedback — on results page accordion expand
# ---------------------------------------------------------------------------

async def stream_feedback(
    question_text: str,
    answer_text: str,
    skill_tag: str,
    expected_keywords: List[str],
) -> AsyncGenerator[str, None]:
    """
    Yields SSE tokens for per-question feedback on the results page.
    Generates a longer, more narrative feedback than the evaluation JSON.
    """
    from ..utils import truncate_for_llm
    safe_answer = truncate_for_llm(answer_text or "", "interview_answer_max_chars")

    prompt = f"""You are giving post-interview feedback to a candidate.

Question asked: {question_text}
Skill tested: {skill_tag}
Key concepts expected: {', '.join(expected_keywords) if expected_keywords else 'See question context'}
Candidate's answer: {safe_answer}

Write detailed, constructive feedback (3-5 sentences) explaining:
1. What they got right
2. What was missing or could be improved
3. One concrete tip for next time

Be encouraging and specific. Address the candidate directly ("Your answer...").
"""

    messages = [{"role": "user", "content": prompt}]
    
    try:
        for chunk in llm_router.generate_chat_completion_stream(
            messages=messages,
            provider="groq",
            model_name=GROQ_MODEL,
            temperature=0.5,
            max_tokens=400
        ):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    except Exception as e:
        logger.error(f"stream_feedback stream error: {e}")

    yield "data: [DONE]\n\n"


# ---------------------------------------------------------------------------
# Streaming study plan — called on results page after all evaluations complete
# ---------------------------------------------------------------------------

async def stream_study_plan(
    weak_skills: List[str],
    missing_concepts_summary: str,
    target_role: str,
    experience_level: str,
    past_weak_skills: Optional[List[str]] = None,
    interviewer_persona: str = "Friendly Senior Engineer",
) -> AsyncGenerator[str, None]:
    """
    Yields SSE tokens for a personalized 30-day study plan.
    """
    from .prompts import STUDY_PLAN_PROMPT, PERSONA_PROMPTS

    if not weak_skills:
        yield f"data: {json.dumps({'token': 'Great news — no significant weak areas identified! Keep practicing consistently to maintain your strengths.'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    persona_info = PERSONA_PROMPTS.get(interviewer_persona, PERSONA_PROMPTS["Friendly Senior Engineer"])
    persona_instruction = persona_info["study_plan_instruction"]

    if past_weak_skills:
        history_desc = f"Historical Growth Context:\n- Past weak areas (from previous mock sessions): {', '.join(past_weak_skills)}\nCompare these past weak areas with current weaknesses. If the candidate has improved in certain areas (e.g. is no longer weak in a skill they previously struggled with), briefly acknowledge and celebrate that progress at the very beginning of the plan to motivate them! If areas remain weak, highlight them as persistent gaps that need extra focus."
    else:
        history_desc = "Historical Growth Context:\nNone. (First mock session recorded or no prior weak skills)."

    prompt = STUDY_PLAN_PROMPT.format(
        experience_level=experience_level,
        weak_skills=", ".join(weak_skills),
        target_role=target_role,
        missing_concepts_summary=missing_concepts_summary,
        persona_instruction=persona_instruction,
        history_context=history_desc,
    )

    messages = [{"role": "user", "content": prompt}]

    try:
        for chunk in llm_router.generate_chat_completion_stream(
            messages=messages,
            provider="groq",
            model_name=GROQ_MODEL,
            temperature=0.7,
            max_tokens=2048
        ):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
        
    except Exception as e:
        logger.error(f"stream_study_plan stream error: {e}")

    yield "data: [DONE]\n\n"
