"""
Interview System v2 — Background Evaluator
Runs answer evaluation asynchronously via FastAPI BackgroundTasks.
Also provides streaming generators for hints and per-question feedback.
"""
import datetime
import json
import logging
import random
import threading
import time
from typing import AsyncGenerator, Optional, List

from ..config import INTERVIEW_CONFIG_V2
from ..db import InterviewAnswer, InterviewQuestion
from ..core.llm_router import llm_router
from .common import MAX_EVAL_RETRIES
from .prompts import EVALUATION_PROMPT, HINT_PROMPT, PERSONA_PROMPTS
from .service import build_conversation_history

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Bounded eval concurrency + backoff (audit §4.1)
#
# BackgroundTasks are in-process and unbounded: under a cohort burst every
# answer spawns a worker that immediately hits the chat provider, tripping
# free-tier TPM/rate limits. The semaphore below caps concurrent run_evaluation bodies;
# overflow sheds load by returning early and leaving the answer
# pending_evaluation, which the existing retry-on-poll in
# GET /results/{id} re-queues within the unchanged 3-attempt budget.
# ---------------------------------------------------------------------------

_EVAL_SEMAPHORE = threading.BoundedSemaphore(
    INTERVIEW_CONFIG_V2.get("MAX_CONCURRENT_EVALS", 8)
)
# Back-compat alias for tests/monkeypatching.
EVAL_SEMAPHORE = _EVAL_SEMAPHORE


def _is_rate_limit_error(exc: BaseException) -> bool:
    """True for chat-provider 429 / TPM / timeout errors worth backing off on."""
    name = type(exc).__name__
    text = f"{name}: {exc}".lower()
    markers = (
        "ratelimit",
        "rate_limit",
        "rate limit",
        "429",
        "too many requests",
        "tpm",
        "tokens per minute",
        "quota",
        "timeout",
        "timed out",
        "temporarily unavailable",
        "503",
        "overloaded",
    )
    return any(m in text for m in markers)


def eval_backoff_delay(attempt: int) -> float:
    """Exponential backoff + jitter for one retry sleep (seconds).

    ``attempt`` is the 0-based retry index within the existing
    MAX_EVAL_RETRIES budget — no extra attempts are created.
    """
    base = float(INTERVIEW_CONFIG_V2.get("EVAL_BACKOFF_BASE_SECONDS", 1.0))
    cap = float(INTERVIEW_CONFIG_V2.get("EVAL_BACKOFF_MAX_SECONDS", 8.0))
    return min(cap, base * (2 ** max(0, attempt))) + random.uniform(0, base)





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
    Evaluates a single answer via the chat provider and persists the result.
    Designed to run as a FastAPI BackgroundTask (runs after HTTP response is sent).
    Uses a separate DB session to avoid conflicts with the request session.

    Bounded concurrency: at most MAX_CONCURRENT_EVALS bodies run at once.
    When the cap is hit the evaluation is shed (answer stays
    pending_evaluation for retry-on-poll) instead of piling up workers.
    Chat-provider 429/timeout errors back off with jitter inside the existing
    MAX_EVAL_RETRIES budget — no extra attempts, honest evaluation_failed
    when the budget is exhausted.
    """
    if not _EVAL_SEMAPHORE.acquire(blocking=False):
        logger.warning(
            "Eval shed for answer %s: %d concurrent evaluations already running",
            answer_id, INTERVIEW_CONFIG_V2.get("MAX_CONCURRENT_EVALS", 8),
        )
        return
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
        # Remaining attempts within the shared 3-retry budget (results-poll
        # recovery consumes the same budget via evaluation_attempts).
        attempts_done = answer.evaluation_attempts or 0
        remaining = max(1, MAX_EVAL_RETRIES - attempts_done)
        evaluation = None
        for trial in range(remaining):
            try:
                evaluation = _evaluate_with_llm(
                    question_text=question.question_text,
                    answer_text=answer.answer_text or "",
                    skill_tag=question.skill_tag,
                    expected_keywords=question.expected_keywords or [],
                    conversation_history=history,
                    interviewer_persona=interviewer_persona,
                )
                break
            except Exception as e:
                if _is_rate_limit_error(e) and trial < remaining - 1:
                    delay = eval_backoff_delay(attempts_done + trial)
                    logger.warning(
                        "Eval rate-limited for answer %s (trial %d/%d), backing off %.1fs: %s",
                        answer_id, trial + 1, remaining, delay, e,
                    )
                    time.sleep(delay)
                    continue
                raise

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
    finally:
        _EVAL_SEMAPHORE.release()


def _evaluate_with_llm(
    question_text: str,
    answer_text: str,
    skill_tag: str,
    expected_keywords: List[str],
    conversation_history: List[dict],
    interviewer_persona: str = "Friendly Senior Engineer",
) -> dict:
    """
    Send question + answer + conversation history to the chat provider for evaluation.
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
            provider=None,
            capability="chat",
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

async def run_generator_in_thread(sync_gen) -> AsyncGenerator[str, None]:
    """Utility to run a synchronous generator in a background thread and yield asynchronously."""
    import queue
    import asyncio
    q = queue.Queue(maxsize=10)
    loop = asyncio.get_running_loop()

    def producer():
        try:
            for item in sync_gen:
                q.put(item)
        except Exception as e:
            q.put(e)
        finally:
            q.put(None)

    # Offload the synchronous iteration to the thread pool executor (without awaiting)
    loop.run_in_executor(None, producer)

    while True:
        item = await asyncio.to_thread(q.get)
        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        yield item


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
        sync_gen = llm_router.generate_chat_completion_stream(
            messages=messages,
            provider=None,
            capability="chat",
            temperature=0.6,
            max_tokens=150
        )
        async for chunk in run_generator_in_thread(sync_gen):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    except Exception as e:
        logger.error(f"stream_hint fallback stream error: {e}")
        yield f"data: {json.dumps({'error': 'Hint generation failed. Please try again.'})}\n\n"

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
        sync_gen = llm_router.generate_chat_completion_stream(
            messages=messages,
            provider=None,
            capability="chat",
            temperature=0.5,
            max_tokens=400
        )
        async for chunk in run_generator_in_thread(sync_gen):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    except Exception as e:
        logger.error(f"stream_feedback stream error: {e}")
        yield f"data: {json.dumps({'error': 'Feedback generation failed. Please try again.'})}\n\n"

    yield "data: [DONE]\n\n"
