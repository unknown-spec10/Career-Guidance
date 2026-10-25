"""Stage 2 — ranking over the retrieved candidate set only.

Slimmed-down successor of engine.py: the heavy scorers (semantic,
personalization, temporal, document) plus the aggregator run over the ~100
jobs retrieval surfaced, with unchanged scoring logic. TF-IDF lives in
retrieval.py — ranking receives those scores as input and passes them
through to the aggregator (no recompute, no second corpus build).

The scorers/ directory is untouched behind this uniform entry point:
score_pair() -> rank_candidates().
"""
import datetime
import logging
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from ..db import Applicant, Job, JobRecommendation, active_job_criteria
from .aggregator import (
    aggregate_scores,
    compute_academic_fit,
    compute_experience_fit,
    compute_location_match,
)
from .embedder import Embedder, GeminiEmbeddingUnavailable
from .explainer import generate_explanation, generate_employer_match_analysis
from .retrieval import get_applicant_profile, get_tfidf_scorer, retrieve_candidate_jobs
from .scorers.document_scorer import DocumentScorer
from .scorers.personalization_scorer import PersonalizationScorer
from .scorers.semantic_scorer import SemanticScorer
from .scorers.temporal_scorer import TemporalScorer
from .scorers.tfidf_scorer import TfidfScorer

logger = logging.getLogger(__name__)


class RankingContext:
    """Uniform handle over the heavy scorers for one ranking run."""

    def __init__(self, db: Session, applicant_id: int):
        self.db = db
        self.embedder = Embedder(db)
        self.semantic_scorer = SemanticScorer(self.embedder)
        self.personalization_scorer = PersonalizationScorer(db)
        self.personalization_scorer.preload_preferences(applicant_id)
        self.temporal_scorer = TemporalScorer()
        self.document_scorer = DocumentScorer(self.embedder)


def fetch_interview_score(db: Session, applicant_id: int) -> Optional[float]:
    """Latest completed interview score normalized to 0.0 - 1.0, or None."""
    from ..db import InterviewSession

    latest = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.status == "completed",
        )
        .order_by(InterviewSession.completed_at.desc())
        .first()
    )
    if latest and latest.overall_score is not None:
        return float(latest.overall_score) / 100.0
    return None


def score_pair(
    applicant: Applicant,
    job: Job,
    db: Session,
    ctx: RankingContext,
    tfidf_score: float,
    interview_score: Optional[float] = None,
) -> dict:
    """Score one applicant-job pair. Scoring logic identical to the former engine.

    tfidf_score comes from retrieval (no TF-IDF work happens here).
    """
    profile = get_applicant_profile(applicant)
    user_skills = profile["skills"]
    experience_items = profile["experience_items"]
    normalized = applicant.parsed_record.normalized if applicant.parsed_record else {}
    education_items = normalized.get("education", [])

    if interview_score is None:
        interview_score = fetch_interview_score(db, applicant.id)

    semantic_skill_score = None
    doc_similarity = None
    embedding_fallback = False
    embedding_fallback_reason = None

    try:
        semantic_skill_score = ctx.semantic_scorer.score(user_skills, job, applicant=applicant)
        doc_similarity = ctx.document_scorer.score(applicant, job)
    except GeminiEmbeddingUnavailable as e:
        logger.warning(
            f"Local embeddings unavailable (using TF-IDF fallback) "
            f"for applicant_id={applicant.id}, job_id={job.id}: {e}"
        )
        embedding_fallback = True
        embedding_fallback_reason = str(e)
    except Exception as e:
        logger.error(
            f"Unexpected error during embedding extraction for job_id={job.id}: {e}",
            exc_info=True,
        )
        embedding_fallback = True
        embedding_fallback_reason = f"Unexpected: {str(e)}"

    personalization_multiplier = ctx.personalization_scorer.get_multiplier(applicant.id, job)
    opportunity_multiplier = ctx.temporal_scorer.opportunity_multiplier(job)

    location_score = compute_location_match(profile["location"], job)
    experience_fit = compute_experience_fit(experience_items, job)
    academic_score = compute_academic_fit(education_items, job)

    _, score_breakdown = aggregate_scores(
        tfidf_score=tfidf_score,
        semantic_skill_score=semantic_skill_score,
        doc_similarity=doc_similarity,
        location_score=location_score,
        experience_fit=experience_fit,
        academic_score=academic_score,
        interview_score=interview_score,
        opportunity_multiplier=opportunity_multiplier,
        personalization_multiplier=personalization_multiplier,
        embedding_fallback=embedding_fallback,
        embedding_fallback_reason=embedding_fallback_reason,
    )
    return score_breakdown


def run_pipeline_for_applicant_job(
    applicant: Applicant,
    job: Job,
    db: Session,
    tfidf_scorer: TfidfScorer,
    embedder: Embedder,
    semantic_scorer: SemanticScorer,
    personalization_scorer: PersonalizationScorer,
    temporal_scorer: TemporalScorer,
    document_scorer: DocumentScorer,
    interview_score: Optional[float] = None,
) -> dict:
    """Backward-compatible per-pair entry point (kept for existing callers/tests).

    TF-IDF is scored here only for this legacy path; the staged pipeline
    (retrieve -> score_pair) never calls this.
    """
    normalized = applicant.parsed_record.normalized if applicant.parsed_record else {}
    user_skills = normalized.get("skills", [])
    tfidf_score = tfidf_scorer.score(user_skills, job.id)

    ctx = RankingContext.__new__(RankingContext)
    ctx.db = db
    ctx.embedder = embedder
    ctx.semantic_scorer = semantic_scorer
    ctx.personalization_scorer = personalization_scorer
    ctx.temporal_scorer = temporal_scorer
    ctx.document_scorer = document_scorer
    return score_pair(applicant, job, db, ctx, tfidf_score, interview_score)


def rank_candidates(
    applicant: Applicant,
    candidates: List[Tuple[Job, float]],
    db: Session,
    ctx: Optional[RankingContext] = None,
    interview_score: Optional[float] = None,
) -> List[Tuple[Job, dict, float]]:
    """Run heavy scorers + aggregator over retrieved candidates only.

    Returns (job, breakdown, score_percent) tuples sorted by score descending.
    Scoring logic is unchanged from the former engine.
    """
    if not candidates:
        return []
    if ctx is None:
        ctx = RankingContext(db, applicant.id)
    if interview_score is None:
        interview_score = fetch_interview_score(db, applicant.id)

    scored: List[Tuple[Job, dict, float]] = []
    for job, tfidf_score in candidates:
        try:
            breakdown = score_pair(applicant, job, db, ctx, tfidf_score, interview_score)
            scored.append((job, breakdown, breakdown["final_score"] * 100))
        except Exception as e:
            logger.error(
                f"Failed to calculate score for applicant_id={applicant.id}, "
                f"job_id={job.id}: {e}",
                exc_info=True,
            )
    scored.sort(key=lambda x: x[2], reverse=True)
    return scored


def load_applicant_with_profile(db: Session, applicant_id: int) -> Optional[Applicant]:
    """Fetch applicant with parsed record eagerly loaded."""
    return (
        db.query(Applicant)
        .options(joinedload(Applicant.parsed_record))
        .filter(Applicant.id == applicant_id)
        .first()
    )


def load_active_jobs(db: Session) -> List[Job]:
    """All publicly visible jobs (existing active_job_criteria, unchanged)."""
    now = datetime.datetime.utcnow()
    return (
        db.query(Job)
        .options(joinedload(Job.meta), joinedload(Job.applications))
        .filter(*active_job_criteria(now))
        .all()
    )


def compute_ranked_for_applicant(
    applicant_id: int, db: Session
) -> Tuple[Optional[Applicant], List[Tuple[Job, dict, float]]]:
    """Retrieval -> ranking for one applicant. No business rules, no writes."""
    applicant = load_applicant_with_profile(db, applicant_id)
    if not applicant or not applicant.parsed_record:
        logger.warning(
            f"Cannot generate recommendations: Applicant {applicant_id} missing parsed profile data."
        )
        return None, []

    active_jobs = load_active_jobs(db)
    if not active_jobs:
        logger.warning("No active jobs to recommend.")
        return applicant, []

    candidates = retrieve_candidate_jobs(applicant, active_jobs, db)
    ctx = RankingContext(db, applicant_id)
    interview_score = fetch_interview_score(db, applicant_id)
    ranked = rank_candidates(applicant, candidates, db, ctx, interview_score)
    return applicant, ranked


def compute_recommendations(applicant_id: int, db: Session) -> dict:
    """Backward-compatible full pipeline (retrieval -> ranking -> rerank -> persist).

    Preserves the former engine.compute_recommendations return shape.
    New code should use recommendation.service.get_recommendations instead.
    """
    from .service import get_recommendations as facade_get_recommendations

    result = facade_get_recommendations(applicant_id, db, purpose="jobs")
    return {
        "job_recommendations": [
            {"job_id": r["job_id"], "score": r["score"], "explanation": r.get("explanation")}
            for r in result.get("job_recommendations", [])
        ]
    }


def retry_null_explanations(applicant_id: int, db: Session, limit: int = 10) -> None:
    """Fetch and retry explanation generation for cached recommendations that failed both LLM backends."""
    null_recs = (
        db.query(JobRecommendation)
        .join(Job)
        .filter(
            JobRecommendation.applicant_id == applicant_id,
            JobRecommendation.explanation.is_(None),
            JobRecommendation.engine_version == "v2",
        )
        .order_by(JobRecommendation.score.desc())
        .limit(limit)
        .all()
    )

    if not null_recs:
        return

    logger.info(f"Retrying {len(null_recs)} null explanations for applicant_id={applicant_id}...")
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        return

    # Backfill only explanation fields: computed_at must keep the generation
    # timestamp written by persist_recommendations so one call leaves exactly
    # one generation (a bump here fragments the run into two computed_at
    # batches ~1s apart).
    for rec in null_recs:
        try:
            explanation, explanation_source = generate_explanation(
                applicant, rec.job, rec.score_breakdown or {}, db=db
            )
            if explanation:
                rec.explanation = explanation
                if rec.score_breakdown:
                    rec.score_breakdown["explanation_source"] = explanation_source
                is_fallback = explanation_source == "offline_fallback"
                rec.is_fallback = is_fallback
                rec.fallback_source = "explainer" if is_fallback else None
                rec.explain = {
                    "reasons": [explanation],
                    "summary": explanation,
                    "key_strengths": [],
                    "improvement_areas": [],
                    "employer_reasons": rec.explain.get("employer_reasons") if rec.explain else None,
                    "employer_gaps": rec.explain.get("employer_gaps") if rec.explain else None,
                }
        except Exception as e:
            logger.error(f"Failed to compute retry explanation for job_id={rec.job_id}: {e}")

    try:
        db.commit()
    except Exception as e:
        logger.error(f"Failed to commit retried explanations: {e}")
        db.rollback()


def ensure_applicant_job_recommendation(
    applicant_id: int, job_id: int, db: Session
) -> Optional[JobRecommendation]:
    """Ensure a JobRecommendation exists and contains employer match reasons and gaps."""
    rec = (
        db.query(JobRecommendation)
        .filter(
            JobRecommendation.applicant_id == applicant_id,
            JobRecommendation.job_id == job_id,
        )
        .first()
    )

    if rec and rec.explain and "employer_reasons" in rec.explain:
        return rec

    applicant = (
        db.query(Applicant)
        .options(joinedload(Applicant.parsed_record))
        .filter(Applicant.id == applicant_id)
        .first()
    )
    job = db.query(Job).options(joinedload(Job.meta)).filter(Job.id == job_id).first()

    if not applicant or not job:
        logger.warning(
            f"Could not compute recommendation: applicant={applicant_id}, job={job_id} not found."
        )
        return None

    embedder = Embedder(db)
    now = datetime.datetime.utcnow()
    active_jobs = db.query(Job).filter(*active_job_criteria(now)).all()

    job_ids = {j.id for j in active_jobs}
    if job.id not in job_ids:
        active_jobs.append(job)

    tfidf_scorer = get_tfidf_scorer(db, active_jobs)
    ctx = RankingContext(db, applicant_id)
    ctx.embedder = embedder
    ctx.semantic_scorer = SemanticScorer(embedder)
    ctx.document_scorer = DocumentScorer(embedder)

    try:
        normalized = applicant.parsed_record.normalized if applicant.parsed_record else {}
        user_skills = normalized.get("skills", [])
        breakdown = score_pair(
            applicant, job, db, ctx, tfidf_scorer.score(user_skills, job.id)
        )

        explanation, explanation_source = generate_explanation(applicant, job, breakdown, db=db)
        breakdown["explanation_source"] = explanation_source
        score_percent = breakdown["final_score"] * 100

        analysis = generate_employer_match_analysis(applicant, job, breakdown, db=db)
        employer_reasons = analysis.get("reasons")
        employer_gaps = analysis.get("gaps")
        analysis_source = analysis.get("source", "offline_fallback")

        is_fallback = explanation_source == "offline_fallback" or analysis_source == "offline_fallback"
        fallback_sources = []
        if explanation_source == "offline_fallback":
            fallback_sources.append("explainer")
        if analysis_source == "offline_fallback":
            fallback_sources.append("employer_analysis")
        fallback_source_str = ", ".join(fallback_sources) if fallback_sources else None

        explain_compat = {
            "reasons": [explanation]
            if explanation
            else ["Matched based on your profile strength and skill overlap."],
            "summary": explanation or "Your profile aligns well with this role.",
            "key_strengths": [],
            "improvement_areas": [],
            "employer_reasons": employer_reasons,
            "employer_gaps": employer_gaps,
        }

        if rec:
            rec.score = score_percent
            rec.score_breakdown = breakdown
            rec.explanation = explanation
            rec.explain = explain_compat
            rec.computed_at = now
            rec.engine_version = "v2"
            rec.is_fallback = is_fallback
            rec.fallback_source = fallback_source_str
        else:
            rec = JobRecommendation(
                applicant_id=applicant_id,
                job_id=job_id,
                score=score_percent,
                score_breakdown=breakdown,
                explanation=explanation,
                explain=explain_compat,
                computed_at=now,
                engine_version="v2",
                is_fallback=is_fallback,
                fallback_source=fallback_source_str,
            )
            db.add(rec)

        db.commit()
        db.refresh(rec)
        logger.info(
            f"Dynamically generated and cached recommendation "
            f"for applicant_id={applicant_id}, job_id={job_id}"
        )
        return rec
    except Exception as e:
        logger.error(
            f"Failed to ensure recommendation for applicant_id={applicant_id}, "
            f"job_id={job_id}: {e}",
            exc_info=True,
        )
        db.rollback()
        return None
