"""Stage 1 — candidate generation over ALL active jobs.

Pure offline retrieval: SQL hard filters (existing active_job_criteria plus
lenient location / experience fit) then TF-IDF skill overlap only.
No embeddings, no network calls. Output is a ranked list of ~100 job IDs
with their TF-IDF scores, consumed by ranking.py.
"""
import logging
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from ..db import Applicant, Job
from .scorers.tfidf_scorer import TfidfScorer

logger = logging.getLogger(__name__)

RETRIEVAL_TOP_K = 100

# Hard-filter tolerances (deliberately lenient so recall stays high;
# ranking decides the final order, retrieval only drops obvious mismatches).
_EXPERIENCE_TOLERANCE_YEARS = 2.0

_tfidf_scorer_cache = None
_tfidf_scorer_jobs_hash = None


def get_tfidf_scorer(db: Session, active_jobs: list) -> TfidfScorer:
    """Lazy-initialize and cache the TF-IDF scorer module."""
    global _tfidf_scorer_cache, _tfidf_scorer_jobs_hash

    jobs_hash = hash(tuple((j.id, getattr(j, "updated_at", None)) for j in active_jobs))

    if _tfidf_scorer_cache is None or _tfidf_scorer_jobs_hash != jobs_hash:
        logger.info("Initializing/Rebuilding TF-IDF Scorer corpus cache...")
        scorer = TfidfScorer()
        scorer.build_corpus(active_jobs)
        _tfidf_scorer_cache = scorer
        _tfidf_scorer_jobs_hash = jobs_hash

    return _tfidf_scorer_cache


def get_applicant_profile(applicant: Applicant) -> Dict:
    """Extract the normalized fields retrieval needs from a parsed applicant."""
    normalized = applicant.parsed_record.normalized if applicant.parsed_record else {}
    personal = normalized.get("personal", {}) or normalized.get("personal_info", {})
    applicant_loc = personal.get("location") or (
        f"{applicant.location_city or ''}, {applicant.location_state or ''}".strip(", ")
    )
    return {
        "skills": normalized.get("skills", []),
        "experience_items": normalized.get("experience", []),
        "location": applicant_loc or None,
    }


def passes_hard_filters(profile: Dict, job: Job) -> bool:
    """Lenient location + experience gate.

    Remote jobs always pass. On-site/hybrid jobs pass unless the applicant has
    a known location that matches neither city nor state. Experience passes
    unless the job requires clearly more years than the applicant shows
    (beyond a tolerance band, so ranking — not retrieval — decides close calls).
    """
    # Experience gate
    min_exp = float(getattr(job, "min_experience_years", 0.0) or 0.0)
    applicant_years = float(len(profile.get("experience_items") or []))
    if min_exp > applicant_years + _EXPERIENCE_TOLERANCE_YEARS:
        return False

    # Location gate
    work_type = str(getattr(job, "work_type", "") or "").lower()
    if work_type == "remote":
        return True
    applicant_loc = profile.get("location")
    if not applicant_loc:
        return True
    loc_lower = str(applicant_loc).lower()
    job_city = str(getattr(job, "location_city", "") or "").lower()
    job_state = str(getattr(job, "location_state", "") or "").lower()
    if job_city and job_city in loc_lower:
        return True
    if job_state and job_state in loc_lower:
        return True
    if work_type == "hybrid":
        return True
    # Strict on-site mismatch only when the job names a concrete place.
    if job_city or job_state:
        return False
    return True


def retrieve_candidate_jobs(
    applicant: Applicant,
    active_jobs: list,
    db: Optional[Session] = None,
    top_k: int = RETRIEVAL_TOP_K,
) -> List[Tuple[Job, float]]:
    """Rank active jobs by TF-IDF skill overlap after hard-filter gating.

    Returns up to top_k (job, tfidf_score) pairs sorted by score descending.
    Jobs failing the hard filters are only used to top up when the filtered
    set is smaller than top_k, preserving recall.
    """
    if not active_jobs:
        return []

    profile = get_applicant_profile(applicant)
    scorer = get_tfidf_scorer(db, active_jobs) if db is not None else _build_scorer(active_jobs)

    scored_all = [(job, scorer.score(profile["skills"], job.id)) for job in active_jobs]
    scored_all.sort(key=lambda x: x[1], reverse=True)

    passing = [pair for pair in scored_all if passes_hard_filters(profile, pair[0])]
    if len(passing) >= min(top_k, len(scored_all)):
        return passing[:top_k]

    # Top up with the best of the filtered-out jobs so recall stays high.
    passing_ids = {job.id for job, _ in passing}
    topped_up = list(passing)
    for pair in scored_all:
        if len(topped_up) >= top_k:
            break
        if pair[0].id not in passing_ids:
            topped_up.append(pair)
    return topped_up


def _build_scorer(active_jobs: list) -> TfidfScorer:
    """Build an uncached TF-IDF scorer (used when no DB session is available)."""
    scorer = TfidfScorer()
    scorer.build_corpus(active_jobs)
    return scorer


# Re-exported for ranking convenience (single import site for structured fits).
__all__ = [
    "RETRIEVAL_TOP_K",
    "get_applicant_profile",
    "get_tfidf_scorer",
    "passes_hard_filters",
    "retrieve_candidate_jobs",
]
