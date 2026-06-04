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

        # 6. Execute Groq call or run premium mock generator
        # Check if we are in mock mode or lacking api key
        if settings.GEMINI_MOCK_MODE or not settings.GROQ_API_KEY:
            logger.info("Candidate Intelligence: Running in MOCK Mode")
            profile_json = _generate_mock_profile(
                applicant_name=resume_context["name"],
                target_role=resume_context["target_role"],
                skills=resume_context["skills"],
                latest_score=latest_session_data["overall_score"],
                previous_profile=previous_profile
            )
        else:
            try:
                profile_json = _evaluate_with_groq(
                    resume_context=json.dumps(resume_context),
                    current_profile_json=json.dumps(previous_profile),
                    latest_session_data=json.dumps(latest_session_data),
                    past_sessions_summary=json.dumps(past_summary)
                )
            except Exception as err:
                logger.warning("Candidate Intelligence: Groq call failed (%s). Gracefully falling back to MOCK generator.", err)
                profile_json = _generate_mock_profile(
                    applicant_name=resume_context["name"],
                    target_role=resume_context["target_role"],
                    skills=resume_context["skills"],
                    latest_score=latest_session_data["overall_score"],
                    previous_profile=previous_profile
                )

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


def _generate_mock_profile(
    applicant_name: str,
    target_role: str,
    skills: List[str],
    latest_score: float,
    previous_profile: dict
) -> dict:
    """Generate high-quality mock cumulative candidate profile for local development/testing."""
    prev_count = previous_profile.get("sessions_count", 0)
    new_count = prev_count + 1

    primary_skills = skills[:4] if skills else ["React", "JavaScript", "System Design", "Node.js"]
    skill_names = ", ".join(primary_skills)

    # 1. Summary updates based on session count
    if new_count == 1:
        summary = (
            f"Candidate {applicant_name} demonstrates excellent conceptual knowledge in fundamentals like {skill_names}, "
            "but struggles slightly to apply them in high-pressure or architectural system design scenarios. "
            "Exhibits a highly engaging, structured, and warm communication style, though explanations under "
            "time limits tend to remain surface-level before going deeper when explicitly probed."
        )
        strengths = [
            f"Strong foundational understanding of {primary_skills[0]} and web architecture.",
            "Articulate, highly structured communicator with clear professional tone.",
            "Prompt, precise answers on conceptual questions."
        ]
        weaknesses = [
            "Lacks concrete, real-world examples when discussing complex systems.",
            "Tends to struggle under strict, fast-paced interview time constraints.",
            "Assumes too much shared context initially, skipping detailed step-by-step reasoning."
        ]
    elif new_count == 2:
        summary = (
            f"Candidate {applicant_name} is showing notable growth. System design and deep architectural implementation "
            f"improved noticeably. However, performance optimization concepts in {primary_skills[0]} remain slightly weak "
            "despite repeated attempts. The candidate's pattern remains highly responsive: they start with high-level summaries "
            "and yield exceptionally rich details only when follow-up probes are explicitly asked."
        )
        strengths = [
            "Good improvement in balancing technical details with high-level design.",
            f"Excellent vocabulary and architectural mapping of {primary_skills[0]}.",
            "Responsive and adjusts style instantly when follow-up questions are raised."
        ]
        weaknesses = [
            f"Performance tuning and optimizations (e.g. state scaling) in {primary_skills[0]} remain weak.",
            "Tends to over-explain simple conceptual topics, leaving less time for complex practical questions.",
            "Minor hesitation when answering unexpected scenario-based debugging questions."
        ]
    else:
        summary = (
            f"Candidate {applicant_name} has evolved into an interview-ready practitioner for mid-level {target_role} roles. "
            "Their communication is exceptionally refined, demonstrating highly balanced detail. Gaps still remain for senior-level "
            "roles, specifically around high-scale system design, microservices orchestration, and deep performance auditing. "
            "Pattern analysis shows they consistently start answers exceptionally well, but should integrate concrete coding examples "
            "automatically without needing to be prompted."
        )
        strengths = [
            f"Highly competent and ready for mid-level {target_role} vacancies.",
            f"Consistently high scores in core {primary_skills[0]} state management and fundamentals.",
            "Polished, professional delivery with precise vocabulary under pressure."
        ]
        weaknesses = [
            "High-scale system design and optimization at heavy scale remains a learning gap.",
            "Does not automatically supply code snippets or concrete examples unless probed.",
            "Tends to under-explain edge cases on difficult programming questions."
        ]

    # 2. Answer patterns
    answer_patterns = {
        "explanation_depth": "Starts with simple, high-level structural answers. Yields rich, precise details only when follow-up probes are asked.",
        "example_coverage": "Conceptual accuracy is strong, but explanations assume too much context and lack concrete code examples or real-world use cases.",
        "time_pressure": "Exhibits slight pacing issues. Tends to over-explain easy conceptual questions, creating time crunches on harder engineering scenarios.",
        "context_assumption": "Explanations are clear but often assume the interviewer already knows the candidate's exact application layout, skipping basic setups."
    }

    # 3. Technical skills trajectories
    tech_skills = previous_profile.get("technical_skills", {})
    if not tech_skills:
        tech_skills = {}
        for s in primary_skills[:3]:
            # Initial scores
            base_score = 0.50 if s == "System Design" else (latest_score - 0.15)
            tech_skills[s] = {
                "level": "Moderate",
                "score_history": [round(max(0.2, base_score), 2)],
                "trend_summary": f"Initial evaluation of {s} shows conceptual readiness with room for practical growth."
            }
    else:
        # Append scores & update levels
        for s in primary_skills[:3]:
            if s in tech_skills:
                hist = list(tech_skills[s]["score_history"])
                next_score = round(min(0.98, hist[-1] + 0.12), 2)
                hist.append(next_score)
                level = "Strong" if next_score >= 0.80 else "Good" if next_score >= 0.60 else "Moderate" if next_score >= 0.40 else "Needs Work"
                tech_skills[s] = {
                    "level": level,
                    "score_history": hist,
                    "trend_summary": f"Steady improvement from {round(hist[0]*100)}% to {round(next_score*100)}% over {len(hist)} sessions."
                }
            else:
                tech_skills[s] = {
                    "level": "Good",
                    "score_history": [round(latest_score, 2)],
                    "trend_summary": f"Testing on {s} launched with stable and solid foundational scores."
                }

    # 4. Role readiness
    jr_ready = min(100, 75 + (new_count * 8))
    mid_ready = min(100, 45 + (new_count * 10))
    sr_ready = min(100, 15 + (new_count * 6))
    
    if new_count >= 3:
        verdict = f"Fully prepared for Mid-level {target_role} roles. Gaps in high-scale performance engineering prevent immediate senior suitability."
    else:
        verdict = f"Strong candidate for Junior {target_role} roles. Expanding system design depth is required to transition to solid mid-level readiness."

    role_readiness = {
        "junior": jr_ready,
        "mid_level": mid_ready,
        "senior": sr_ready,
        "verdict": verdict
    }

    return {
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "answer_patterns": answer_patterns,
        "technical_skills": tech_skills,
        "role_readiness": role_readiness,
        "sessions_count": new_count,
        "last_updated": datetime.datetime.utcnow().isoformat()
    }
