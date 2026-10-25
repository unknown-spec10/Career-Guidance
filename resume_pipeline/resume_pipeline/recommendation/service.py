"""Shared facade for student recommendations: one pipeline, three purposes.

Pipeline: retrieval (TF-IDF candidates) -> ranking (heavy scorers over the
retrieved ~100) -> reranking (business rules, explanations, persistence).

Purposes (same pipeline, different rerank weights — no forks):
  jobs       — default weights for StudentDashboard and JobsPage.
  skill_gaps — emphasizes missing-skill signals for LearningPathPage and
               SkillGapModal; each entry carries missing_skills + gap_signal.
  digest     — lightweight top 5 (cached/offline explanations only).

Every backend consumer (routers/recommendations.py, embedding_tasks.py,
routers/resume.py, routers/applications.py, seed scripts) goes through
get_recommendations(). The 24-hour cooldown stays enforced in the router.
"""
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..db import Employer, Job, SessionLocal
from .precompute import ensure_applicant_embeddings
from .ranking import compute_ranked_for_applicant, fetch_interview_score
from .reranking import (
    TOP_N_EXPLANATIONS,
    attach_explanations,
    persist_recommendations,
    rerank_scored,
)

logger = logging.getLogger(__name__)

# Presentation-cut contract (response shape only — ranking and persistence are
# untouched). The ranked list is split into `recommended` (top slice by
# purpose) and `more_matches` (the rest, paged). Persisted rows always stay
# complete; only the response shape changes.
PRESENT_PURPOSES = ("jobs", "skill_gaps", "digest", "browse")
# JobsPage browsing reuses the purpose param for a wider top slice.
PRESENT_TOP_N_BY_PURPOSE = {"browse": 20}
MORE_MATCHES_DEFAULT_LIMIT = 50
MORE_MATCHES_MAX_LIMIT = 100


def present_top_n(purpose: str) -> int:
    """Top-slice size for `recommended` (counts come from the API, not the UI)."""
    if purpose in PRESENT_TOP_N_BY_PURPOSE:
        return PRESENT_TOP_N_BY_PURPOSE[purpose]
    return settings.MAX_RECOMMENDATIONS or 10


def split_present(
    items: List[Dict[str, Any]],
    purpose: str = "jobs",
    more_offset: int = 0,
    more_limit: int = MORE_MATCHES_DEFAULT_LIMIT,
) -> Dict[str, Any]:
    """Split shaped entries into `recommended` + paged `more_matches`."""
    top_n = present_top_n(purpose)
    try:
        offset = max(0, int(more_offset or 0))
    except (TypeError, ValueError):
        offset = 0
    try:
        limit = int(more_limit if more_limit is not None else MORE_MATCHES_DEFAULT_LIMIT)
    except (TypeError, ValueError):
        limit = MORE_MATCHES_DEFAULT_LIMIT
    limit = max(0, min(limit, MORE_MATCHES_MAX_LIMIT))
    recommended = list(items[:top_n])
    rest = list(items[top_n:])
    return {
        "recommended": recommended,
        "more_matches": rest[offset:offset + limit],
        "total": len(items),
        "recommended_count": len(recommended),
        "more_total": len(rest),
        "more_offset": offset,
        "more_limit": limit,
    }


def get_recommendations(
    applicant_id: int,
    db: Session,
    purpose: str = "jobs",
    more_offset: int = 0,
    more_limit: int = MORE_MATCHES_DEFAULT_LIMIT,
) -> Dict[str, Any]:
    """Compute/refresh, persist, and return recommendations for one applicant."""
    if purpose not in PRESENT_PURPOSES:
        raise ValueError(f"Unknown recommendation purpose: {purpose!r}")
    # `browse` is a present-size-only purpose: same rerank weights as `jobs`
    # (ranking logic untouched), wider top slice for JobsPage browsing.
    rerank_purpose = "jobs" if purpose == "browse" else purpose

    # Embed-once: best-effort refresh of stored applicant vectors at request
    # time only fills gaps from parses that predated precompute; the steady
    # state is parse-time writes + cache-hit reads (no per-request embeds).
    applicant, ranked = compute_ranked_for_applicant(applicant_id, db)
    if applicant is None:
        return {"job_recommendations": []}
    if not ranked:
        return {"job_recommendations": []}

    try:
        ensure_applicant_embeddings(applicant, db)
    except Exception as e:
        logger.warning(f"Applicant embedding refresh failed (db_id={applicant_id}): {e}")

    interview_score = fetch_interview_score(db, applicant_id)
    reranked = rerank_scored(applicant, ranked, db, purpose=rerank_purpose,
                             interview_score=interview_score)
    lightweight = purpose == "digest"
    reranked = attach_explanations(
        applicant, reranked, db,
        top_n=TOP_N_EXPLANATIONS, lightweight=lightweight,
    )
    persist_recommendations(applicant, reranked, db)

    return _present(applicant_id, db, reranked, purpose, more_offset, more_limit)


def _shape_entry(entry: Dict, employers: Dict[int, Optional[Employer]], purpose: str) -> Dict[str, Any]:
    """Shape one reranked entry into the API response contract (fields unchanged)."""
    job = entry["job"]
    employer = employers.get(job.id)
    rec: Dict[str, Any] = {
        "id": job.id,
        "job_id": job.id,
        "title": job.title,
        "company": employer.company_name if employer else "Unknown",
        "location": f"{job.location_city or ''}, {job.location_state or ''}".strip(", "),
        "work_type": job.work_type,
        "description": job.description,
        "min_experience_years": job.min_experience_years,
        "required_skills": job.required_skills,
        "match_score": float(entry["score"]),
        "score": float(entry["score"]),
        "match_breakdown": entry["breakdown"],
        "score_breakdown": entry["breakdown"],
        "explanation": entry.get("explanation"),
        "recommendation_reason": entry.get("explanation") or "Good overall profile fit",
    }
    if purpose == "skill_gaps":
        rec["missing_skills"] = entry.get("missing_skills", [])
        rec["gap_signal"] = entry.get("gap_signal", 0.0)
    return rec


def _present(
    applicant_id: int, db: Session, reranked: List[Dict], purpose: str,
    more_offset: int = 0,
    more_limit: int = MORE_MATCHES_DEFAULT_LIMIT,
) -> Dict[str, Any]:
    """Shape reranked entries into the API response contract.

    Persistence already holds every reranked row; here the full shaped list
    is split into `recommended` (top slice) + paged `more_matches`.
    `job_recommendations` stays equal to `recommended` so callers that ignore
    the new keys keep working unchanged.
    """
    job_ids = [e["job"].id for e in reranked]
    employers: Dict[int, Optional[Employer]] = {}
    if job_ids:
        jobs = db.query(Job).options(joinedload(Job.employer)).filter(Job.id.in_(job_ids)).all()
        employers = {j.id: getattr(j, "employer", None) for j in jobs}

    shaped = [_shape_entry(entry, employers, purpose) for entry in reranked]
    split = split_present(shaped, purpose, more_offset, more_limit)

    return {
        "job_recommendations": split["recommended"],
        "recommended": split["recommended"],
        "more_matches": split["more_matches"],
        "total": split["total"],
        "recommended_count": split["recommended_count"],
        "more_total": split["more_total"],
        "more_offset": split["more_offset"],
        "more_limit": split["more_limit"],
        "purpose": purpose,
    }


def request_recommendations_async(
    applicant_id: int,
    purpose: str = "jobs",
    more_offset: int = 0,
    more_limit: int = MORE_MATCHES_DEFAULT_LIMIT,
) -> Dict[str, Any]:
    """Background-task entry point: opens its own session (never a request db)."""
    db = SessionLocal()
    try:
        return get_recommendations(applicant_id, db, purpose=purpose,
                                   more_offset=more_offset, more_limit=more_limit)
    finally:
        db.close()


class RecommendationFacade:
    """Object-style wrapper around the shared facade (drop-in replacement)."""

    def __init__(self, db: Session):
        self.db = db

    def get_recommendations(
        self, applicant_id: int, purpose: str = "jobs",
        more_offset: int = 0,
        more_limit: int = MORE_MATCHES_DEFAULT_LIMIT,
    ) -> Dict[str, Any]:
        return get_recommendations(applicant_id, self.db, purpose=purpose,
                                   more_offset=more_offset, more_limit=more_limit)


# Backwards-compatible alias: RecommendationService(db).get_recommendations(id)
# now runs the staged pipeline through this facade.
class RecommendationService(RecommendationFacade):
    """Legacy name kept so existing imports keep working unchanged."""
