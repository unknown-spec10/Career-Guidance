"""Stage 3 — reranking: business rules live here, not scattered in scorers.

Applies, in order: purpose-weighted scoring, freshness boost, interview-score
blend check, diversity cap, explanation attach, persistence.

Purposes share one pipeline with different rerank weights (no forks):
  jobs       — default weights (StudentDashboard, JobsPage).
  skill_gaps — emphasizes missing-skill signals (LearningPathPage, SkillGapModal).
  digest     — lightweight top 5, cached/offline explanations only.
"""
import datetime
import logging
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from ..db import Applicant, Job, JobRecommendation
from .explainer import generate_employer_match_analysis, generate_explanation
from .ranking import fetch_interview_score, retry_null_explanations

logger = logging.getLogger(__name__)

TOP_N_EXPLANATIONS = 5
DIGEST_TOP_N = 5
DIVERSITY_MAX_PER_EMPLOYER = 3

# Freshness boost added to the rerank score (ranking final_score is untouched).
_FRESHNESS_BOOST_7D = 0.02
_FRESHNESS_BOOST_30D = 0.01

VALID_PURPOSES = ("jobs", "skill_gaps", "digest")

# Purpose-specific rerank weights. Same pipeline, different emphasis.
PURPOSE_WEIGHTS = {
    # Default: trust the ranking score as-is.
    "jobs": {"rank_weight": 1.0, "gap_weight": 0.0, "freshness_boost": 1.0},
    # Skill gaps: blend in the missing-skill signal so stretch roles that
    # expose learnable gaps surface higher for LearningPath/SkillGap views.
    "skill_gaps": {"rank_weight": 0.7, "gap_weight": 0.3, "freshness_boost": 1.0},
    # Digest: ranking order only, no gap blending, minimal boosts.
    "digest": {"rank_weight": 1.0, "gap_weight": 0.0, "freshness_boost": 0.0},
}


def _skill_names(skills) -> List[str]:
    names = []
    for s in skills or []:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            names.append(name)
    return names


def missing_skills_for(applicant: Applicant, job: Job) -> List[str]:
    """Job-required skills absent from the applicant profile (case-insensitive)."""
    normalized = applicant.parsed_record.normalized if applicant.parsed_record else {}
    have = {n.lower().strip() for n in _skill_names(normalized.get("skills", []))}
    return [s for s in _skill_names(job.required_skills) if s.lower().strip() not in have]


def gap_signal(applicant: Applicant, job: Job, breakdown: dict) -> float:
    """Missing-skill emphasis signal in 0.0 - 1.0.

    Combines the unmet-skill fraction with headroom in the combined skill
    score: roles with several learnable gaps and semantic potential score
    higher. Deterministic, no network calls.
    """
    required = _skill_names(job.required_skills)
    if not required:
        return 0.0
    missing_frac = len(missing_skills_for(applicant, job)) / len(required)
    combined = breakdown.get("combined_skill_score")
    headroom = (1.0 - float(combined)) if combined is not None else 0.5
    return round(0.6 * missing_frac + 0.4 * max(0.0, min(1.0, headroom)), 3)


def freshness_boost(job: Job, purpose: str) -> float:
    """Small deterministic boost for recently posted jobs (0 unless fresh)."""
    if PURPOSE_WEIGHTS[purpose]["freshness_boost"] == 0.0:
        return 0.0
    created_at = getattr(job, "created_at", None)
    if not created_at:
        return 0.0
    days = max(0, (datetime.datetime.utcnow() - created_at).days)
    if days <= 7:
        return _FRESHNESS_BOOST_7D
    if days <= 30:
        return _FRESHNESS_BOOST_30D
    return 0.0


def apply_diversity_cap(
    ranked: List[Tuple[Job, dict, float]],
    max_per_employer: int = DIVERSITY_MAX_PER_EMPLOYER,
) -> List[Tuple[Job, dict, float]]:
    """Cap jobs from a single employer, preserving ranking order otherwise."""
    counts: Dict = {}
    kept: List[Tuple[Job, dict, float]] = []
    deferred: List[Tuple[Job, dict, float]] = []
    for item in ranked:
        employer_id = getattr(item[0], "employer_id", None)
        used = counts.get(employer_id, 0)
        if used < max_per_employer:
            counts[employer_id] = used + 1
            kept.append(item)
        else:
            deferred.append(item)
    # Capped-out jobs stay visible below the diverse set (stable, no data loss).
    return kept + deferred


def rerank_scored(
    applicant: Applicant,
    scored: List[Tuple[Job, dict, float]],
    db: Session,
    purpose: str = "jobs",
    interview_score: Optional[float] = None,
) -> List[Dict]:
    """Apply business rules to ranked pairs. Returns presentation-ready dicts.

    Each dict carries job, breakdown, score (0-100 rerank score), base_score,
    gap_signal, missing_skills and (after attach_explanations) explanation
    fields. Ranking breakdowns are never mutated.
    """
    if purpose not in VALID_PURPOSES:
        raise ValueError(f"Unknown recommendation purpose: {purpose!r}")
    weights = PURPOSE_WEIGHTS[purpose]

    if interview_score is None:
        interview_score = fetch_interview_score(db, applicant.id)

    reranked: List[Dict] = []
    for job, breakdown, score_percent in scored:
        base_score = float(score_percent)
        gap = gap_signal(applicant, job, breakdown) if weights["gap_weight"] else 0.0
        blended = weights["rank_weight"] * base_score + weights["gap_weight"] * gap * 100.0
        final = blended + freshness_boost(job, purpose) * 100.0
        entry = {
            "job": job,
            "breakdown": dict(breakdown),
            "score": round(min(100.0, max(0.0, final)), 2),
            "base_score": round(base_score, 2),
            "gap_signal": gap,
            "missing_skills": missing_skills_for(applicant, job),
            "interview_score": interview_score,
        }
        # Interview blend is already inside the ranking base score via the
        # aggregator; record here whether it contributed (transparency).
        entry["breakdown"]["interview_blended"] = interview_score is not None
        reranked.append(entry)

    reranked.sort(key=lambda e: e["score"], reverse=True)
    ordered = [(e["job"], e["breakdown"], e["score"]) for e in reranked]
    capped = apply_diversity_cap(ordered)

    by_job_id = {(e["job"].id): e for e in reranked}
    result = []
    for job, _, score in capped:
        entry = by_job_id[job.id]
        entry["score"] = score  # diversity cap never changes scores, only order
        result.append(entry)

    if purpose == "digest":
        result = result[:DIGEST_TOP_N]
    return result


def attach_explanations(
    applicant: Applicant,
    reranked: List[Dict],
    db: Session,
    top_n: int = TOP_N_EXPLANATIONS,
    lightweight: bool = False,
) -> List[Dict]:
    """Attach cached-or-generated explanations to the top-N entries.

    Lightweight (digest) mode reuses cached v2 explanations and falls back to
    the deterministic offline sentence — no employer-analysis LLM calls.
    """
    for i, entry in enumerate(reranked):
        job = entry["job"]
        breakdown = entry["breakdown"]
        existing = (
            db.query(JobRecommendation)
            .filter(
                JobRecommendation.applicant_id == applicant.id,
                JobRecommendation.job_id == job.id,
            )
            .first()
        )
        explanation = None
        explanation_source = None
        employer_reasons = None
        employer_gaps = None
        analysis_source = None

        if existing and existing.explanation and getattr(existing, "engine_version", "v1") == "v2":
            explanation = existing.explanation
            if existing.score_breakdown:
                explanation_source = existing.score_breakdown.get("explanation_source")
            if existing.explain:
                employer_reasons = existing.explain.get("employer_reasons")
                employer_gaps = existing.explain.get("employer_gaps")

        if i < top_n and not lightweight:
            if not explanation:
                explanation, explanation_source = generate_explanation(
                    applicant, job, breakdown, db=db
                )
            # A cached analysis is derived from the same job, breakdown and
            # candidate profile, so regenerating it on every pass only re-buys
            # the same tokens. Fallback text is never treated as a cache hit.
            cached_analysis = bool(
                employer_reasons
                and employer_gaps
                and existing is not None
                and not getattr(existing, "is_fallback", False)
            )
            if cached_analysis:
                analysis_source = (existing.explain or {}).get(
                    "employer_analysis_source", "cache"
                )
                logger.debug(
                    "Reused cached employer analysis for applicant_id=%s job_id=%s",
                    applicant.id,
                    job.id,
                )
            else:
                analysis = generate_employer_match_analysis(applicant, job, breakdown, db=db)
                employer_reasons = analysis.get("reasons")
                employer_gaps = analysis.get("gaps")
                analysis_source = analysis.get("source", "offline_fallback")
            entry["is_fallback"] = explanation_source == "offline_fallback" or (
                analysis_source == "offline_fallback"
            )
            sources = []
            if explanation_source == "offline_fallback":
                sources.append("explainer")
            if analysis_source == "offline_fallback":
                sources.append("employer_analysis")
            entry["fallback_source"] = ", ".join(sources) if sources else None
        else:
            # Outside top-N (or digest mode): cached explanation or deterministic
            # offline sentence, never a network call.
            if not explanation:
                if lightweight:
                    matched = [s for s in _skill_names(job.required_skills)
                               if s not in entry["missing_skills"]][:2]
                    if matched:
                        explanation = (
                            "You have strong skill overlap for this role, matching critical "
                            f"requirements like {', '.join(matched)}."
                        )
                    else:
                        explanation = "Your general profile matches the background requirements for this role."
                    explanation_source = "offline_fallback"
                entry.setdefault("is_fallback", True if not explanation else False)
                entry.setdefault("fallback_source", None)

        entry["explanation"] = explanation
        entry["explanation_source"] = explanation_source
        entry["breakdown"]["explanation_source"] = explanation_source
        entry["explain_compat"] = {
            "reasons": [explanation]
            if explanation
            else ["Matched based on your profile strength and skill overlap."],
            "summary": explanation or "Your profile aligns well with this role.",
            "key_strengths": [],
            "improvement_areas": [],
            "employer_reasons": employer_reasons,
            "employer_gaps": employer_gaps,
            "employer_analysis_source": analysis_source,
        }
    return reranked


def normalize_display_scores(reranked: List[Dict]) -> List[Dict]:
    """Min-max scale entry scores to the 0-100 display range, in place.

    Ranked scores from different scorer mixes land on different absolute
    scales; scaling makes persisted scores comparable across runs. The rescale
    is monotonic, so ranking order never changes; the top entry lands on 100.
    """
    if not reranked:
        return reranked
    scores = [float(e["score"]) for e in reranked]
    hi, lo = max(scores), min(scores)
    if hi <= lo:
        for entry in reranked:
            entry["score"] = 100.0
        return reranked
    span = hi - lo
    for entry in reranked:
        entry["score"] = round((float(entry["score"]) - lo) / span * 100.0, 2)
    return reranked


def persist_recommendations(
    applicant: Applicant,
    reranked: List[Dict],
    db: Session,
) -> List[Dict]:
    """Replace the applicant's rows with the fresh reranked set. Returns light dicts.

    Delete-then-insert in a single transaction: the dashboard reads
    top-by-score, so stale high rows must never survive a recompute.
    """
    normalize_display_scores(reranked)
    now = datetime.datetime.utcnow()

    light = []
    try:
        db.query(JobRecommendation).filter(
            JobRecommendation.applicant_id == applicant.id
        ).delete(synchronize_session=False)
        for entry in reranked:
            job = entry["job"]
            db.add(
                JobRecommendation(
                    applicant_id=applicant.id,
                    job_id=job.id,
                    score=entry["score"],
                    score_breakdown=entry["breakdown"],
                    explanation=entry.get("explanation"),
                    explain=entry.get("explain_compat", {}),
                    computed_at=now,
                    engine_version="v2",
                    is_fallback=entry.get("is_fallback", False),
                    fallback_source=entry.get("fallback_source"),
                )
            )
            light.append(
                {"job_id": job.id, "score": entry["score"], "explanation": entry.get("explanation")}
            )
        db.commit()
        logger.info(f"Persisted {len(light)} reranked recommendations for applicant_id={applicant.id}")
    except Exception as e:
        logger.error(f"Failed to save recommendations for applicant_id={applicant.id}: {e}")
        db.rollback()
        return []

    retry_null_explanations(applicant.id, db, limit=TOP_N_EXPLANATIONS)
    return light
