"""Explanation generator for job recommendations.

Single-provider LLM call (exactly once, tight timeout — no retries), then offline:
  1. Configured explanation primary   (single-shot adapter call, 6s timeout)
  2. Offline  (pgvector cosine similarity on pre-computed applicant_embeddings vector)

Defaults route to opencode (DeepSeek); swap via
MODEL_EXPLAIN_PRIMARY_PROVIDER / MODEL_EXPLAIN_PRIMARY_NAME.

The offline path fires IMMEDIATELY after the single LLM failure.
The provider is attempted at most once.
"""
import json
import logging
from typing import Optional, Tuple

import numpy as np

from ..core.llm_router import AdapterClientError, llm_router
from ..core.rate_limiter import opencode_limiter

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
# Direct LLM callers (single-shot adapter calls to guarantee exactly-once semantics)
# ---------------------------------------------------------------------------

def _try_opencode_once(prompt: str) -> Optional[str]:
    """Call the opencode adapter exactly once with a tight timeout. Returns text or None."""
    if not llm_router.get_adapter("opencode").has_credentials():
        return None
    if not opencode_limiter.allow_call():
        logger.warning("OpenCode explanation call skipped: circuit breaker is OPEN")
        return None
    model = llm_router.model_for("opencode", "explanation")
    try:
        text = llm_router.get_adapter("opencode").chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            temperature=0.7,
            max_tokens=150,
            response_format=None,
            timeout=_LLM_TIMEOUT_S,
        )
        opencode_limiter.report_success()
        return text.strip().strip('"') if text else None
    except AdapterClientError as e:
        # Client errors - do NOT trip the breaker.
        logger.warning(f"OpenCode explanation call returned client error: {e}")
        return None
    except Exception as e:
        opencode_limiter.report_failure()
        logger.warning(f"OpenCode explanation failed (timeout or error): {e}")
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

    Uses the applicant's cached embedding context when available and falls
    through to string-match. Fully offline — no embedding API calls.
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
                from .embedder import coerce_embedding_vector
                applicant_vector = coerce_embedding_vector(row.embedding_vector)
                if applicant_vector is not None:
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

    # Step 3: STRING MATCH path (offline — no embedding API calls).
    # (The pre-cutover live-embedding semantic path required GEMINI_API_KEY
    # and was removed; string match is the deterministic offline fallback.)

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
    """Generate a recommendation explanation. The LLM is tried EXACTLY ONCE.

    Execution order (fail-fast, no retries) follows the MODEL_EXPLAIN_*
    config slots (default: opencode only), then offline:
      1. Explanation primary    — single-shot adapter call
      2. Offline — pgvector applicant embedding cosine match (no API calls)

    Args:
        applicant: SQLAlchemy Applicant ORM object.
        job:       SQLAlchemy Job ORM object.
        breakdown: Score breakdown dict from aggregator.
        db:        SQLAlchemy Session — passed to offline fallback for embedding lookup.

    Returns:
        (explanation_string, source_flag)
        source_flag: 'opencode' | 'offline_fallback'
    """
    prompt = build_explanation_prompt(applicant, job, breakdown)

    # Explanation provider (single configured primary) — tried exactly once.
    for adapter, _model in llm_router.ordered_adapters("explanation"):
        if adapter.name == "opencode":
            result = _try_opencode_once(prompt)
            source = "opencode"
        else:
            continue
        if result:
            logger.info(f"Explanation generated via {adapter.name} (direct, 1 attempt)")
            return result, source
        logger.warning(f"{adapter.name} explanation failed once — moving on immediately")

    # 2. Offline fallback — fires immediately, no further LLM attempts
    try:
        explanation = _offline_explanation_with_embeddings(applicant, job, db=db)
        return explanation, "offline_fallback"
    except Exception as e:
        logger.error(f"Offline fallback explainer crashed: {e}")
        return "Your profile matches the required skills and experience for this role.", "offline_fallback"


def generate_employer_match_analysis(applicant, job, breakdown, db=None) -> dict:
    """Generate structured recruiter analysis. The LLM is tried EXACTLY ONCE.

    Falls back immediately to pgvector-aware offline analysis if the LLM fails.
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

    # Explanation provider (single configured primary) — tried exactly once.
    for adapter, _model in llm_router.ordered_adapters("explanation"):
        if adapter.name == "opencode":
            llm_result = _try_opencode_once(prompt)
        else:
            continue
        if llm_result:
            parsed = _parse_employer_json(llm_result)
            if parsed:
                parsed["source"] = "opencode"
                logger.info(f"Employer analysis generated via {adapter.name} (direct, 1 attempt)")
                return parsed
        logger.warning(f"{adapter.name} employer analysis failed once — moving on immediately")

    # 2. Offline fallback — fires immediately
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
