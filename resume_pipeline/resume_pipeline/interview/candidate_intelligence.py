"""
Interview System v2 — Longitudinal Candidate Intelligence Service
Synthesizes candidate resumes, mock session history, and latest performance
into a living, cumulative AI model (JSON profile).
"""
import datetime
import json
import logging
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session as DBSession

from ..config import settings
from ..db import Applicant, LLMParsedRecord, InterviewSession, InterviewQuestion, InterviewAnswer
from ..core.llm_router import llm_router
from .prompts import CANDIDATE_INTELLIGENCE_PROMPT, GROQ_MODEL

logger = logging.getLogger(__name__)


def generate_longitudinal_profile(applicant_id: int, db: DBSession) -> Optional[dict]:
    """
    Computes/updates the cumulative candidate intelligence profile for an applicant.
    Retrieves candidate's resume parsed record, past mock sessions, and the latest session logs,
    invokes Groq to generate/update the cumulative JSON profile, and persists it.
    
    Runs safely with automatic fallbacks for mock mode and api errors.
    """
    try:
        # 1. Resolve applicant and parsed resume
        applicant = db.query(Applicant).filter_by(id=applicant_id).first()
        if not applicant:
            logger.error("Candidate Intelligence: Applicant %d not found", applicant_id)
            return None

        parsed_record = db.query(LLMParsedRecord).filter_by(applicant_id=applicant_id).first()
        resume_data = parsed_record.normalized if parsed_record else {}

        # Format resume context
        resume_context = {
            "name": applicant.display_name or "Candidate",
            "location": f"{applicant.location_city or ''}, {applicant.location_state or ''}",
            "target_role": resume_data.get("target_role") or resume_data.get("objective", {}).get("target_role") or "Software Developer",
            "experience_years": resume_data.get("total_experience") or resume_data.get("work_experience_years") or 0.0,
            "skills": [s.get("name") for s in resume_data.get("skills", []) if s.get("name")] if isinstance(resume_data.get("skills"), list) else [],
            "projects": [p.get("name") for p in resume_data.get("projects", []) if p.get("name")] if isinstance(resume_data.get("projects"), list) else []
        }

        # 2. Resolve interview sessions
        # Get all completed sessions in chronological order
        completed_sessions = (
            db.query(InterviewSession)
            .filter(
                InterviewSession.applicant_id == applicant_id,
                InterviewSession.status == "completed"
            )
            .order_by(InterviewSession.created_at.asc())
            .all()
        )

        if not completed_sessions:
            logger.warning("Candidate Intelligence: No completed sessions for applicant %d", applicant_id)
            return None

        # Latest session is the last one in chronological order
        latest_session = completed_sessions[-1]
        past_sessions = completed_sessions[:-1]

        # 3. Build latest session logs
        latest_answers = (
            db.query(InterviewAnswer)
            .join(InterviewQuestion, InterviewAnswer.question_id == InterviewQuestion.id)
            .filter(InterviewAnswer.session_id == latest_session.id)
            .order_by(InterviewQuestion.order_index)
            .all()
        )

        latest_qas = []
        latest_strengths = []
        latest_weaknesses = []
        latest_missing = []

        for ans in latest_answers:
            q_text = ans.question.question_text
            from ..utils import truncate_for_llm
            a_text = truncate_for_llm(ans.answer_text or "", "interview_answer_max_chars") or "(No response)"
            score = ans.score or 0.0
            latest_qas.append({
                "question": q_text,
                "answer": a_text,
                "score": score,
                "skill": ans.question.skill_tag
            })
            if ans.strength:
                latest_strengths.append(ans.strength)
            if ans.feedback:
                latest_weaknesses.append(ans.feedback)
            if ans.missing_concepts:
                latest_missing.extend(ans.missing_concepts)

        latest_session_data = {
            "session_id": latest_session.id,
            "type": latest_session.interview_type,
            "difficulty": latest_session.difficulty,
            "overall_score": latest_session.overall_score or 0.0,
            "qas": latest_qas,
            "aggregated_strengths": latest_strengths[:5],
            "aggregated_weaknesses": latest_weaknesses[:5],
            "missing_concepts": list(set(latest_missing))[:8]
        }

        # 4. Build past sessions summary
        past_summary = []
        for s in past_sessions:
            past_summary.append({
                "session_id": s.id,
                "date": s.completed_at.isoformat() if s.completed_at else s.created_at.isoformat(),
                "type": s.interview_type,
                "overall_score": s.overall_score or 0.0
            })

        # 5. Fetch previous profile JSON
        previous_profile = applicant.candidate_profile or {}

        # 6. Execute Groq call.
        # NOTE: fabricated mock profiles are no longer generated, persisted, or
        # served. If the LLM call is unavailable (mock mode, missing key, or
        # transient failure) the function returns None and the API surfaces an
        # honest "unavailable" state instead of fake insights.
        if settings.GEMINI_MOCK_MODE or not settings.GROQ_API_KEY:
            logger.info("Candidate Intelligence: LLM unavailable (mock mode / missing key). Skipping profile generation.")
            return None
        try:
            profile_json = _evaluate_with_groq(
                resume_context=json.dumps(resume_context),
                current_profile_json=json.dumps(previous_profile),
                latest_session_data=json.dumps(latest_session_data),
                past_sessions_summary=json.dumps(past_summary)
            )
        except Exception as err:
            logger.warning("Candidate Intelligence: Groq call raised exception (%s).", err)
            profile_json = None

        if not profile_json:
            logger.warning("Candidate Intelligence: Groq call failed or returned None. No profile persisted.")

        if profile_json:
            applicant.candidate_profile = profile_json
            db.commit()
            logger.info("Candidate Intelligence: Successfully updated profile for applicant %d (Sessions Analyzed: %d)", 
                        applicant_id, profile_json.get("sessions_count", 1))
            return profile_json

    except Exception as e:
        logger.error("Candidate Intelligence: Failed to generate profile: %s", e)
        db.rollback()
        
    return None


def _evaluate_with_groq(
    resume_context: str,
    current_profile_json: str,
    latest_session_data: str,
    past_sessions_summary: str
) -> Optional[dict]:
    """Call LLMRouter to synthesize logs into the cumulative JSON profile."""
    prompt = CANDIDATE_INTELLIGENCE_PROMPT.format(
        resume_context=resume_context,
        current_profile_json=current_profile_json,
        latest_session_data=latest_session_data,
        past_sessions_summary=past_sessions_summary
    )

    try:
        res = llm_router.generate_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            provider="groq",
            model_name=GROQ_MODEL,
            temperature=0.3,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
        raw = res["content"].strip()
        profile_json = json.loads(raw)
        return profile_json
    except Exception as err:
        logger.error("Candidate Intelligence: Failed to generate profile via LLMRouter: %s", err)
        return None
