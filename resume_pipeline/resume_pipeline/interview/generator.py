"""
Interview System v2 — Question Generator
Calls Groq once at session start to generate all questions + adaptive reserve pool.
Falls back to the hardcoded question bank on any Groq error.
"""
import json
import logging
from typing import List, Optional

from groq import Groq

from ..config import settings
from ..constants import INTERVIEW_CONFIG_V2
from .prompts import GROQ_MODEL, QUESTION_GENERATION_PROMPT
from .fallback_questions import get_fallback_questions

logger = logging.getLogger(__name__)


def build_session_context(parsed_record: dict) -> dict:
    """
    Extract interview-relevant fields from the LLMParsedRecord.normalized JSON.
    Returns a safe dict with defaults for all fields.
    """
    normalized = parsed_record.get("normalized", parsed_record) if parsed_record else {}
    return {
        "skills": normalized.get("skills", []),
        "experience_years": normalized.get("experience_years", 0),
        "target_role": normalized.get("target_role") or normalized.get("desired_role") or "Software Engineer",
        "education": normalized.get("education", {}),
        "projects": [p.get("title", "") for p in normalized.get("projects", []) if isinstance(p, dict)][:5],
        "work_experience": [
            w.get("company", "") + " — " + w.get("title", "")
            for w in normalized.get("work_experience", []) if isinstance(w, dict)
        ][:4],
    }


def generate_questions(
    context: dict,
    num_questions: int,
    interview_type: str,
    difficulty: str,
    topic_focus: Optional[str] = None,
    past_weak_skills: Optional[List[str]] = None,
    past_missing_concepts: Optional[List[str]] = None,
) -> List[dict]:
    """
    Generate all questions for a session in a single Groq API call.
    Includes RESERVE_POOL_SIZE extra questions for adaptive difficulty.

    Returns a list of dicts:
    [{question_text, skill_tag, difficulty, expected_keywords, question_type, is_reserve}]
    """
    reserve_count = INTERVIEW_CONFIG_V2["RESERVE_POOL_SIZE"]
    total_count = num_questions + reserve_count

    try:
        groq_client = Groq(api_key=settings.GROQ_API_KEY)

        skills_str = ", ".join(context["skills"][:15]) if context["skills"] else "General programming"
        projects_str = ", ".join(context["projects"]) if context["projects"] else "None listed"

        if past_weak_skills or past_missing_concepts:
            growth_desc = "GROWTH ORIENTED FOCUS:\nCandidate has historical weaknesses. Focus at least 40-50% of the questions on testing these areas to verify if they have improved, but ask fresh and different questions:"
            if past_weak_skills:
                growth_desc += f"\n- Historical Weak Skills to retest: {', '.join(past_weak_skills)}"
            if past_missing_concepts:
                growth_desc += f"\n- Historical Gaps/Missing Concepts: {', '.join(past_missing_concepts)}"
            growth_desc += "\nEnsure these priority items are tested, but maintain appropriate difficulty."
        else:
            growth_desc = "GROWTH ORIENTED FOCUS:\nNone. Auto-select topics normally matching candidate resume."

        prompt = QUESTION_GENERATION_PROMPT.format(
            total_count=total_count,
            num_questions=num_questions,
            reserve_count=reserve_count,
            skills=skills_str,
            target_role=context["target_role"],
            experience_years=context["experience_years"],
            interview_type=interview_type,
            difficulty=difficulty,
            topic_focus=topic_focus or "None — auto-select from candidate skills",
            growth_context=growth_desc,
        )

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4096,
        )

        raw = response.choices[0].message.content.strip()

        # Strip any accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        questions = json.loads(raw)

        if not isinstance(questions, list) or len(questions) == 0:
            raise ValueError(f"Groq returned unexpected format: {type(questions)}")

        # Ensure all required fields are present; fill defaults
        validated = []
        for i, q in enumerate(questions):
            validated.append({
                "question_text": str(q.get("question_text", "")).strip(),
                "skill_tag": str(q.get("skill_tag", "General")).strip(),
                "difficulty_level": str(q.get("difficulty", difficulty)).strip(),
                "expected_keywords": q.get("expected_keywords", []),
                "question_type": str(q.get("question_type", "open_ended")).strip(),
                "is_reserve": bool(q.get("is_reserve", i >= num_questions)),
            })

        # If Groq returned fewer questions than requested, pad with fallback
        if len(validated) < total_count:
            logger.warning(
                "Groq returned %d questions, expected %d. Padding with fallback.",
                len(validated), total_count
            )
            fallback = get_fallback_questions(
                context["target_role"], difficulty,
                total_count - len(validated), reserve_count=0
            )
            validated.extend(fallback[:total_count - len(validated)])

        logger.info("Generated %d questions via Groq (including %d reserve).", len(validated), reserve_count)
        return validated

    except Exception as e:
        logger.warning("Groq question generation failed (%s). Using fallback questions.", e)
        return get_fallback_questions(
            target_role=context.get("target_role", "Software Engineer"),
            difficulty=difficulty,
            num_questions=num_questions,
            reserve_count=reserve_count,
        )
