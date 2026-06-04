"""
Explanation generator for job recommendations.

LLM chain (each tried EXACTLY ONCE with a tight timeout — no internal retries):
  1. Gemini   (direct REST call, 6s timeout)
  2. Groq     (direct SDK call, 6s timeout)
  3. Offline  (pgvector cosine similarity on pre-computed applicant_embeddings vector)

The offline fallback fires IMMEDIATELY after the second failure — not after cascading
through the LLMRouter's internal OpenRouter path. Each provider is attempted at most once.
"""
import json
import logging
import time
from typing import Optional, Tuple

import numpy as np
import requests
from groq import Groq, BadRequestError, AuthenticationError, PermissionDeniedError

from ..config import settings
from ..core.rate_limiter import gemini_limiter, groq_limiter

logger = logging.getLogger(__name__)

# Tight per-LLM timeout: fail fast, move to offline immediately
_LLM_TIMEOUT_S = 6

# Cosine similarity thresholds for semantic skill classification
_STRONG_MATCH_THRESHOLD = 0.72
_PARTIAL_MATCH_THRESHOLD = 0.50


# ---------------------------------------------------------------------------
# Prompt builder (shared by both LLM paths)
# ---------------------------------------------------------------------------

def build_explanation_prompt(applicant, job, breakdown) -> str:
    """Build the prompt for explanation generation."""
    candidate_skills = []
    if applicant.parsed_record and applicant.parsed_record.normalized:
        skills = applicant.parsed_record.normalized.get("skills", [])
        for s in skills:
            name = s.get("name", "") if isinstance(s, dict) else str(s)
            if name:
                candidate_skills.append(name)
    candidate_skills_str = ", ".join(list(dict.fromkeys(candidate_skills))[:20])

    job_skills = []
    for s in job.required_skills or []:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            job_skills.append(name)
    job_skills_str = ", ".join(list(dict.fromkeys(job_skills))[:20])

    exp_years = job.min_experience_years if job.min_experience_years is not None else 0

    return f"""You are a career advisor. Given a score breakdown of how well a candidate matches a job, write a 2-sentence explanation in plain English.
Be specific about strengths and one gap if any. Do not mention specific scores, weights, or percentages.

Candidate profile:
- Skills: {candidate_skills_str or 'None listed'}

Job posting:
- Title: {job.title}
- Required Skills: {job_skills_str or 'None listed'}
- Min Experience Required: {exp_years} years

Score breakdown:
- Technical Skills Fit: {breakdown.get('skills_score', 0.0)}
- Experience Fit: {breakdown.get('experience_score', 0.0)}
- Location Fit: {breakdown.get('location_score', 0.0)}

Speak directly to the candidate using "your" and "you". Write exactly 1 or 2 concise, encouraging sentences.
"""


# ---------------------------------------------------------------------------
# Direct LLM callers (bypass LLMRouter to guarantee exactly-once semantics)
# ---------------------------------------------------------------------------

def _try_gemini_once(prompt: str) -> Optional[str]:
    """Call Gemini REST API exactly once with a tight timeout. Returns text or None."""
    if not settings.GEMINI_API_KEY or settings.GEMINI_MOCK_MODE:
        return None
    if not gemini_limiter.allow_call():
        logger.warning("Gemini explanation call skipped: circuit breaker is OPEN")
        return None
    model = settings.GEMINI_INTERVIEW_MODEL or "gemini-2.5-flash"
    url = (
        f"{settings.GEMINI_API_URL}/models/{model}"
        f":generateContent?key={settings.GEMINI_API_KEY}"
    )
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 150},
    }
    try:
        r = requests.post(url, json=body, timeout=_LLM_TIMEOUT_S)
        if r.status_code != 200:
            if r.status_code not in (400, 401, 403):
                gemini_limiter.report_failure()
            logger.warning(f"Gemini explanation call returned HTTP {r.status_code}")
            return None
        gemini_limiter.report_success()
        candidates = r.json().get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "").strip().strip('"')
    except Exception as e:
        gemini_limiter.report_failure()
        logger.warning(f"Gemini explanation failed (timeout or error): {e}")
    return None


def _try_groq_once(prompt: str) -> Optional[str]:
    """Call Groq SDK exactly once with a tight timeout. Returns text or None."""
    if not settings.GROQ_API_KEY:
        return None
    if not groq_limiter.allow_call():
        logger.warning("Groq explanation call skipped: circuit breaker is OPEN")
        return None
    model = settings.GROQ_CHAT_MODEL or "llama-3.3-70b-versatile"
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=150,
            timeout=_LLM_TIMEOUT_S,
        )
        groq_limiter.report_success()
        content = resp.choices[0].message.content
        return content.strip().strip('"') if content else None
    except (BadRequestError, AuthenticationError, PermissionDeniedError) as e:
        # Client errors - do NOT trip the breaker
        logger.warning(f"Groq explanation failed (client error): {e}")
    except Exception as e:
        groq_limiter.report_failure()
        logger.warning(f"Groq explanation failed (timeout or error): {e}")
    return None


# ---------------------------------------------------------------------------
# pgvector-powered offline fallback
# ---------------------------------------------------------------------------

def _cosine(v1: list, v2: list) -> float:
    """Fast numpy cosine similarity."""
    a = np.array(v1, dtype=float)
    b = np.array(v2, dtype=float)
    n1, n2 = np.linalg.norm(a), np.linalg.norm(b)
    if n1 == 0.0 or n2 == 0.0:
        return 0.0
    return float(np.dot(a, b) / (n1 * n2))


def _offline_explanation_with_embeddings(applicant, job, db=None) -> str:
    """Build a semantic explanation using the pre-computed applicant embedding.

    Compares the applicant's cached embedding_vector (from applicant_embeddings table)
    against each job skill's text embedding — no Gemini API calls.
    Falls through to string-match if no DB embedding exists.
    """
    # Step 1: try to load pre-computed applicant embedding from DB
    applicant_vector = None
    if db is not None:
        try:
            from ..db import ApplicantEmbedding
            row = (
                db.query(ApplicantEmbedding)
                .filter(ApplicantEmbedding.applicant_id == applicant.id)
                .order_by(ApplicantEmbedding.updated_at.desc())
                .first()
            )
            if row and row.embedding_vector is not None:
                emb = row.embedding_vector
                applicant_vector = list(emb) if not isinstance(emb, list) else emb
                logger.info(
                    f"Offline fallback using pgvector applicant embedding "
                    f"(applicant_id={applicant.id}, dim={len(applicant_vector)})"
                )
        except Exception as e:
            logger.warning(f"Could not load applicant embedding from DB: {e}")

    # Step 2: collect job skills
    job_skills = []
    for s in job.required_skills or []:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            job_skills.append(name)

    # Step 3a: SEMANTIC path — use embedding cosine similarity per skill
    if applicant_vector and job_skills and settings.GEMINI_API_KEY:
        try:
            from ..embedder import Embedder
            # Re-use Embedder just for the static cosine_similarity helper + embed()
            # We do NOT pass a DB session here to avoid re-persisting in the fallback path
            from google import genai
            client = genai.Client(api_key=settings.GEMINI_API_KEY)

            strong_matches, partial_matches, missing = [], [], []

            for skill_name in job_skills[:10]:  # cap at 10 to avoid timeout
                try:
                    result = client.models.embed_content(
                        model=settings.EMBEDDING_MODEL or "gemini-embedding-2-preview",
                        contents=skill_name,
                        config={"output_dimensionality": len(applicant_vector)},
                    )
                    skill_vec = list(result.embeddings[0].values)
                    sim = _cosine(applicant_vector, skill_vec)
                    if sim >= _STRONG_MATCH_THRESHOLD:
                        strong_matches.append(skill_name)
                    elif sim >= _PARTIAL_MATCH_THRESHOLD:
                        partial_matches.append(skill_name)
                    else:
                        missing.append(skill_name)
                except Exception:
                    # Per-skill embed failure → fall through to string match for this skill
                    pass

            if strong_matches or partial_matches:
                matched = strong_matches[:2] + partial_matches[:1]
                sentences = [
                    f"Your skills show a strong semantic match for this role, "
                    f"particularly around {', '.join(matched)}."
                ]
                if missing:
                    sentences.append(
                        f"Consider building experience with {', '.join(missing[:2])} "
                        "to further strengthen your candidacy."
                    )
                else:
                    sentences.append(
                        "Your overall skill profile aligns well with the full requirements of this position."
                    )
                return " ".join(sentences)

        except Exception as e:
            logger.warning(f"Semantic offline skill comparison failed: {e} — falling back to string match")

    # Step 3b: STRING MATCH path (last resort — no embeddings available)
    candidate_skills_lower: set = set()
    if applicant.parsed_record and applicant.parsed_record.normalized:
        for s in applicant.parsed_record.normalized.get("skills", []):
            name = s.get("name", "") if isinstance(s, dict) else str(s)
            if name:
                candidate_skills_lower.add(name.lower().strip())

    matched_skills = [s for s in job_skills if s.lower().strip() in candidate_skills_lower]
    missing_skills = [s for s in job_skills if s.lower().strip() not in candidate_skills_lower]

    if matched_skills:
        sentence1 = (
            f"You have strong skill overlap for this role, matching critical requirements "
            f"like {', '.join(matched_skills[:2])}."
        )
    else:
        sentence1 = "Your general profile matches the background requirements for this role."

    sentence2 = (
        f"To further improve your match, consider developing experience with {', '.join(missing_skills[:2])}."
        if missing_skills
        else "Your skills show an excellent match for this position."
    )
    return f"{sentence1} {sentence2}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_explanation(applicant, job, breakdown, db=None) -> Tuple[Optional[str], Optional[str]]:
    """Generate a recommendation explanation. Each LLM is tried EXACTLY ONCE.

    Execution order (fail-fast, no retries):
      1. Gemini  — direct REST, 6s timeout
      2. Groq    — direct SDK, 6s timeout
      3. Offline — pgvector applicant embedding cosine match (no API calls)

    Args:
        applicant: SQLAlchemy Applicant ORM object.
        job:       SQLAlchemy Job ORM object.
        breakdown: Score breakdown dict from aggregator.
        db:        SQLAlchemy Session — passed to offline fallback for embedding lookup.

    Returns:
        (explanation_string, source_flag)
        source_flag: 'gemini' | 'groq_fallback' | 'offline_fallback'
    """
    prompt = build_explanation_prompt(applicant, job, breakdown)

    # 1. Gemini — exactly once
    result = _try_gemini_once(prompt)
    if result:
        logger.info("Explanation generated via Gemini (direct, 1 attempt)")
        return result, "gemini"
    logger.warning("Gemini explanation failed once — moving to Groq immediately")

    # 2. Groq — exactly once
    result = _try_groq_once(prompt)
    if result:
        logger.info("Explanation generated via Groq (direct, 1 attempt)")
        return result, "groq_fallback"
    logger.warning("Groq explanation failed once — activating offline pgvector fallback immediately")

    # 3. Offline fallback — fires immediately, no further LLM attempts
    try:
        explanation = _offline_explanation_with_embeddings(applicant, job, db=db)
        return explanation, "offline_fallback"
    except Exception as e:
        logger.error(f"Offline fallback explainer crashed: {e}")
        return "Your profile matches the required skills and experience for this role.", "offline_fallback"


def generate_employer_match_analysis(applicant, job, breakdown, db=None) -> dict:
    """Generate structured recruiter analysis. Each LLM is tried EXACTLY ONCE.

    Falls back immediately to pgvector-aware offline analysis if both LLMs fail.
    """
    candidate_skills = []
    if applicant.parsed_record and applicant.parsed_record.normalized:
        for s in applicant.parsed_record.normalized.get("skills", []):
            name = s.get("name", "") if isinstance(s, dict) else str(s)
            if name:
                candidate_skills.append(name)
    candidate_skills_str = ", ".join(list(dict.fromkeys(candidate_skills))[:20])

    job_skills = []
    for s in job.required_skills or []:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            job_skills.append(name)
    job_skills_str = ", ".join(list(dict.fromkeys(job_skills))[:20])

    prompt = f"""You are an expert recruiter and talent acquisition assistant.
Analyze the candidate's profile against the job posting and provide a structured matching analysis for the employer.

Candidate profile:
- Display Name: {applicant.display_name}
- Skills: {candidate_skills_str or 'None listed'}

Job posting:
- Title: {job.title}
- Required Skills: {job_skills_str or 'None listed'}
- Min Experience: {job.min_experience_years if job.min_experience_years is not None else 0} years

Score breakdown:
- Skills Score: {breakdown.get('skills_score', 0.0)}
- Experience Fit: {breakdown.get('experience_score', 0.0) or breakdown.get('experience_fit', 0.0)}

Based on this, generate a JSON object with exactly two fields:
1. "reasons": A 2-sentence AI-generated summary of why this candidate matches the job. Use "The candidate has..." perspective. 40-50 words.
2. "gaps": A 1-2 sentence callout of missing skills or areas to probe. Constructive and professional.

Respond ONLY with a valid JSON object:
{{
  "reasons": "string",
  "gaps": "string"
}}
"""

    def _parse_employer_json(text: str) -> Optional[dict]:
        try:
            import re
            # Strip markdown fences
            clean = re.sub(r"```(?:json)?\s*|\s*```", "", text).strip()
            parsed = json.loads(clean)
            if "reasons" in parsed and "gaps" in parsed:
                return parsed
        except Exception:
            pass
        return None

    # 1. Gemini — exactly once
    gemini_result = _try_gemini_once(prompt)
    if gemini_result:
        parsed = _parse_employer_json(gemini_result)
        if parsed:
            parsed["source"] = "gemini"
            logger.info("Employer analysis generated via Gemini (direct, 1 attempt)")
            return parsed
    logger.warning("Gemini employer analysis failed once — moving to Groq immediately")

    # 2. Groq — exactly once
    groq_result = _try_groq_once(prompt)
    if groq_result:
        parsed = _parse_employer_json(groq_result)
        if parsed:
            parsed["source"] = "groq_fallback"
            logger.info("Employer analysis generated via Groq (direct, 1 attempt)")
            return parsed
    logger.warning("Groq employer analysis failed once — activating offline fallback immediately")

    # 3. Offline fallback — fires immediately
    missing_skills = [s for s in job_skills if s not in candidate_skills]
    missing_str = ", ".join(missing_skills[:3]) if missing_skills else "None critical"
    return {
        "reasons": "Strong skill alignment with required keywords. Matches job profile with listed experience.",
        "gaps": (
            f"Missing direct mention of: {missing_str} in resume."
            if missing_skills
            else "No major skill gaps identified."
        ),
        "source": "offline_fallback",
    }
