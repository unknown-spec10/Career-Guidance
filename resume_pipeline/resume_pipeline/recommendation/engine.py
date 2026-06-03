import logging
import datetime
import time
from sqlalchemy.orm import Session, joinedload
from ..db import Applicant, Job, JobRecommendation, LLMParsedRecord
from .embedder import Embedder, GeminiEmbeddingUnavailable
from .explainer import generate_explanation, generate_employer_match_analysis
from .aggregator import (
    aggregate_scores,
    compute_location_match,
    compute_experience_fit,
    compute_academic_fit
)
from .scorers.tfidf_scorer import TfidfScorer
from .scorers.semantic_scorer import SemanticScorer
from .scorers.personalization_scorer import PersonalizationScorer
from .scorers.temporal_scorer import TemporalScorer
from .scorers.document_scorer import DocumentScorer

logger = logging.getLogger(__name__)

# Global cache for the TF-IDF scorer to avoid rebuilding on every call if the job corpus is identical
_tfidf_scorer_cache = None
_tfidf_scorer_jobs_hash = None


def get_tfidf_scorer(db: Session, active_jobs: list) -> TfidfScorer:
    """Lazy-initialize and cache the TF-IDF scorer module."""
    global _tfidf_scorer_cache, _tfidf_scorer_jobs_hash

    # Construct a simple hash to detect changes in the job corpus
    jobs_hash = hash(tuple((j.id, getattr(j, "updated_at", None)) for j in active_jobs))

    if _tfidf_scorer_cache is None or _tfidf_scorer_jobs_hash != jobs_hash:
        logger.info("Initializing/Rebuilding TF-IDF Scorer corpus cache...")
        scorer = TfidfScorer()
        scorer.build_corpus(active_jobs)
        _tfidf_scorer_cache = scorer
        _tfidf_scorer_jobs_hash = jobs_hash

    return _tfidf_scorer_cache


def run_pipeline_for_applicant_job(
    applicant: Applicant,
    job: Job,
    db: Session,
    tfidf_scorer: TfidfScorer,
    embedder: Embedder,
    semantic_scorer: SemanticScorer,
    personalization_scorer: PersonalizationScorer,
    temporal_scorer: TemporalScorer,
    document_scorer: DocumentScorer
) -> dict:
    """Execute all recommendation scoring tiers for a single candidate-job pair."""
    # 1. Gather Normalized Profile Data
    normalized = applicant.parsed_record.normalized if applicant.parsed_record else {}
    user_skills = normalized.get("skills", [])
    experience_items = normalized.get("experience", [])
    education_items = normalized.get("education", [])
    personal = normalized.get("personal", {}) or normalized.get("personal_info", {})
    applicant_loc = personal.get("location") or f"{applicant.location_city or ''}, {applicant.location_state or ''}".strip(", ")

    # 2. Fetch Interview Score (Normalized 0.0 - 1.0)
    from ..db import InterviewSession
    latest_session = db.query(InterviewSession).filter(
        InterviewSession.applicant_id == applicant.id,
        InterviewSession.status == "completed"
    ).order_by(InterviewSession.completed_at.desc()).first()

    interview_score = None
    if latest_session and latest_session.overall_score is not None:
        interview_score = float(latest_session.overall_score) / 100.0

    # 3. Scoring Tier 1: TF-IDF Skill Match
    tfidf_score = tfidf_scorer.score(user_skills, job.id)

    # 4. Scoring Tier 2 & Tier 5: Semantic Matches via Embeddings
    semantic_skill_score = None
    doc_similarity = None
    embedding_fallback = False
    embedding_fallback_reason = None

    try:
        semantic_skill_score = semantic_scorer.score(user_skills, job)
        doc_similarity = document_scorer.score(applicant, job)
    except GeminiEmbeddingUnavailable as e:
        logger.warning(f"Gemini Embeddings unavailable (using TF-IDF fallback) for applicant_id={applicant.id}, job_id={job.id}: {e}")
        embedding_fallback = True
        embedding_fallback_reason = str(e)
    except Exception as e:
        logger.error(f"Unexpected error during embedding extraction for job_id={job.id}: {e}", exc_info=True)
        embedding_fallback = True
        embedding_fallback_reason = f"Unexpected: {str(e)}"

    # 5. Scoring Tier 3: Personalization boost
    personalization_multiplier = personalization_scorer.get_multiplier(applicant.id, job)

    # 6. Scoring Tier 4: Temporal freshness decay
    opportunity_multiplier = temporal_scorer.opportunity_multiplier(job)

    # 7. Baseline Structured Matches
    location_score = compute_location_match(applicant_loc, job)
    experience_fit = compute_experience_fit(experience_items, job)
    academic_score = compute_academic_fit(education_items, job)

    # 8. Aggregate final scores
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
        embedding_fallback_reason=embedding_fallback_reason
    )

    return score_breakdown


def compute_recommendations(applicant_id: int, db: Session) -> dict:
    """Compute and store matching recommendation scores for an applicant."""
    # 1. Fetch applicant and active jobs
    applicant = db.query(Applicant).options(
        joinedload(Applicant.parsed_record)
    ).filter(Applicant.id == applicant_id).first()

    if not applicant or not applicant.parsed_record:
        logger.warning(f"Cannot generate recommendations: Applicant {applicant_id} missing parsed profile data.")
        return {"job_recommendations": []}

    now = datetime.datetime.utcnow()
    active_jobs = db.query(Job).options(
        joinedload(Job.meta),
        joinedload(Job.applications)
    ).filter(
        Job.status == "approved",
        ((Job.expires_at.is_(None)) | (Job.expires_at > now))
    ).all()

    if not active_jobs:
        logger.warning("No active jobs to recommend.")
        return {"job_recommendations": []}

    # 2. Setup Scorer Engines
    embedder = Embedder(db)
    tfidf_scorer = get_tfidf_scorer(db, active_jobs)
    semantic_scorer = SemanticScorer(embedder)
    personalization_scorer = PersonalizationScorer(db)
    temporal_scorer = TemporalScorer()
    document_scorer = DocumentScorer(embedder)

    scored_jobs = []

    # 3. Pass 1: Fast scoring pass (no LLM calls)
    for job in active_jobs:
        try:
            breakdown = run_pipeline_for_applicant_job(
                applicant=applicant,
                job=job,
                db=db,
                tfidf_scorer=tfidf_scorer,
                embedder=embedder,
                semantic_scorer=semantic_scorer,
                personalization_scorer=personalization_scorer,
                temporal_scorer=temporal_scorer,
                document_scorer=document_scorer
            )
            score_percent = breakdown["final_score"] * 100
            scored_jobs.append((job, breakdown, score_percent))
        except Exception as e:
            logger.error(f"Failed to calculate score for applicant_id={applicant_id}, job_id={job.id}: {e}", exc_info=True)

    # Sort computed recommendations by score descending
    scored_jobs.sort(key=lambda x: x[2], reverse=True)

    # 4. Pass 2: Generate slow LLM explanations only for the top 5 matching jobs
    recommendations_list = []
    top_n_limit = 5

    for i, (job, breakdown, score_percent) in enumerate(scored_jobs):
        try:
            # Retrieve existing record if present to inspect cached explanations
            existing_rec = db.query(JobRecommendation).filter(
                JobRecommendation.applicant_id == applicant_id,
                JobRecommendation.job_id == job.id
            ).first()

            explanation = None
            explanation_source = None
            employer_reasons = None
            employer_gaps = None

            # Optimization: check if v2 explanation is already cached in DB
            if existing_rec and existing_rec.explanation and getattr(existing_rec, "engine_version", "v1") == "v2":
                explanation = existing_rec.explanation
                if existing_rec.score_breakdown:
                    explanation_source = existing_rec.score_breakdown.get("explanation_source")
                if existing_rec.explain:
                    employer_reasons = existing_rec.explain.get("employer_reasons")
                    employer_gaps = existing_rec.explain.get("employer_gaps")

            # Only call LLM explanations if it's in the top N scoring list
            is_top_rec = i < top_n_limit
            if is_top_rec:
                if not explanation:
                    # Generate new natural language explanation
                    explanation, explanation_source = generate_explanation(applicant, job, breakdown)

                if not employer_reasons or not employer_gaps:
                    analysis = generate_employer_match_analysis(applicant, job, breakdown)
                    employer_reasons = analysis.get("reasons")
                    employer_gaps = analysis.get("gaps")

            breakdown["explanation_source"] = explanation_source

            # Backward-compatible explain dict for existing frontend logic
            explain_compat = {
                "reasons": [explanation] if explanation else ["Matched based on your profile strength and skill overlap."],
                "summary": explanation or "Your profile aligns well with this role.",
                "key_strengths": [],
                "improvement_areas": [],
                "employer_reasons": employer_reasons,
                "employer_gaps": employer_gaps
            }

            # Upsert into database
            if existing_rec:
                existing_rec.score = score_percent
                existing_rec.score_breakdown = breakdown
                existing_rec.explanation = explanation
                existing_rec.explain = explain_compat
                existing_rec.computed_at = now
                existing_rec.engine_version = "v2"
            else:
                new_rec = JobRecommendation(
                    applicant_id=applicant_id,
                    job_id=job.id,
                    score=score_percent,
                    score_breakdown=breakdown,
                    explanation=explanation,
                    explain=explain_compat,
                    computed_at=now,
                    engine_version="v2"
                )
                db.add(new_rec)

            recommendations_list.append({
                "job_id": job.id,
                "score": score_percent,
                "explanation": explanation
            })

        except Exception as e:
            logger.error(f"Failed to calculate match for applicant_id={applicant_id}, job_id={job.id}: {e}", exc_info=True)

    try:
        db.commit()
        logger.info(f"Generated {len(recommendations_list)} recommendations for applicant_id={applicant_id}")
    except Exception as e:
        logger.error(f"Failed to save recommendations for applicant_id={applicant_id}: {e}")
        db.rollback()

    # Proactively retry generating missing explanations (only for top 10 candidates)
    retry_null_explanations(applicant_id, db, limit=top_n_limit)

    return {"job_recommendations": recommendations_list}


def compute_recommendations_for_new_job(job_id: int, db: Session) -> None:
    """Backfill recommendation scores for a new job posting across all candidates."""
    job = db.query(Job).options(
        joinedload(Job.meta),
        joinedload(Job.applications)
    ).filter(Job.id == job_id).first()

    if not job or job.status != "approved":
        logger.warning(f"Skipping backfill: job_id={job_id} not approved or missing.")
        return

    # Find candidates with parsed records
    applicants = db.query(Applicant).join(LLMParsedRecord).all()
    if not applicants:
        return

    now = datetime.datetime.utcnow()
    active_jobs = db.query(Job).filter(
        Job.status == "approved",
        ((Job.expires_at.is_(None)) | (Job.expires_at > now))
    ).all()

    # Load scoring context
    embedder = Embedder(db)
    tfidf_scorer = get_tfidf_scorer(db, active_jobs)
    semantic_scorer = SemanticScorer(embedder)
    personalization_scorer = PersonalizationScorer(db)
    temporal_scorer = TemporalScorer()
    document_scorer = DocumentScorer(embedder)

    scored_applicants = []

    for applicant in applicants:
        try:
            breakdown = run_pipeline_for_applicant_job(
                applicant=applicant,
                job=job,
                db=db,
                tfidf_scorer=tfidf_scorer,
                embedder=embedder,
                semantic_scorer=semantic_scorer,
                personalization_scorer=personalization_scorer,
                temporal_scorer=temporal_scorer,
                document_scorer=document_scorer
            )
            score_percent = breakdown["final_score"] * 100
            scored_applicants.append((applicant, breakdown, score_percent))
        except Exception as e:
            logger.error(f"Error calculating score in backfill matching for applicant_id={applicant.id}, job_id={job_id}: {e}")

    # Sort scored applicants by score descending
    scored_applicants.sort(key=lambda x: x[2], reverse=True)

    batch_size = 5
    top_n_limit = 5
    batch_pause_secs = 2.0

    for batch_start in range(0, len(scored_applicants), batch_size):
        batch = scored_applicants[batch_start : batch_start + batch_size]

        for idx, (applicant, breakdown, score_percent) in enumerate(batch):
            i = batch_start + idx
            try:
                existing_rec = db.query(JobRecommendation).filter(
                    JobRecommendation.applicant_id == applicant.id,
                    JobRecommendation.job_id == job.id
                ).first()

                explanation = None
                explanation_source = None
                employer_reasons = None
                employer_gaps = None

                # Optimization: check if v2 explanation is already cached in DB
                if existing_rec and existing_rec.explanation and getattr(existing_rec, "engine_version", "v1") == "v2":
                    explanation = existing_rec.explanation
                    if existing_rec.score_breakdown:
                        explanation_source = existing_rec.score_breakdown.get("explanation_source")
                    if existing_rec.explain:
                        employer_reasons = existing_rec.explain.get("employer_reasons")
                        employer_gaps = existing_rec.explain.get("employer_gaps")

                is_top_rec = i < top_n_limit
                if is_top_rec:
                    if not explanation:
                        explanation, explanation_source = generate_explanation(applicant, job, breakdown)

                    if not employer_reasons or not employer_gaps:
                        analysis = generate_employer_match_analysis(applicant, job, breakdown)
                        employer_reasons = analysis.get("reasons")
                        employer_gaps = analysis.get("gaps")

                breakdown["explanation_source"] = explanation_source

                explain_compat = {
                    "reasons": [explanation] if explanation else ["Matched based on your profile strength and skill overlap."],
                    "summary": explanation or "Your profile aligns well with this role.",
                    "key_strengths": [],
                    "improvement_areas": [],
                    "employer_reasons": employer_reasons,
                    "employer_gaps": employer_gaps
                }

                if existing_rec:
                    existing_rec.score = score_percent
                    existing_rec.score_breakdown = breakdown
                    existing_rec.explanation = explanation
                    existing_rec.explain = explain_compat
                    existing_rec.computed_at = now
                    existing_rec.engine_version = "v2"
                else:
                    new_rec = JobRecommendation(
                        applicant_id=applicant.id,
                        job_id=job.id,
                        score=score_percent,
                        score_breakdown=breakdown,
                        explanation=explanation,
                        explain=explain_compat,
                        computed_at=now,
                        engine_version="v2"
                    )
                    db.add(new_rec)

            except Exception as e:
                logger.error(f"Error executing backfill matching for applicant_id={applicant.id}, job_id={job_id}: {e}")

        # Pause between batches
        if batch_start + batch_size < len(scored_applicants):
            time.sleep(batch_pause_secs)

    try:
        db.commit()
        logger.info(f"Backfill complete for job_id={job_id} across {len(scored_applicants)} applicants")
    except Exception as e:
        logger.error(f"Failed to save backfilled recommendations for job_id={job_id}: {e}")
        db.rollback()


def retry_null_explanations(applicant_id: int, db: Session, limit: int = 10) -> None:
    """Fetch and retry explanation generation for cached recommendations that failed both LLM backends."""
    # Only retry for the top-scoring recommendations that are missing explanations
    null_recs = db.query(JobRecommendation).join(Job).filter(
        JobRecommendation.applicant_id == applicant_id,
        JobRecommendation.explanation.is_(None),
        JobRecommendation.engine_version == "v2"
    ).order_by(
        JobRecommendation.score.desc()
    ).limit(limit).all()

    if not null_recs:
        return

    logger.info(f"Retrying {len(null_recs)} null explanations for applicant_id={applicant_id}...")
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        return

    now = datetime.datetime.utcnow()
    for rec in null_recs:
        try:
            explanation, explanation_source = generate_explanation(applicant, rec.job, rec.score_breakdown or {})
            if explanation:
                rec.explanation = explanation
                rec.computed_at = now
                if rec.score_breakdown:
                    rec.score_breakdown["explanation_source"] = explanation_source
                rec.explain = {
                    "reasons": [explanation],
                    "summary": explanation,
                    "key_strengths": [],
                    "improvement_areas": []
                }
        except Exception as e:
            logger.error(f"Failed to compute retry explanation for job_id={rec.job_id}: {e}")

    try:
        db.commit()
    except Exception as e:
        logger.error(f"Failed to commit retried explanations: {e}")
        db.rollback()


def ensure_applicant_job_recommendation(applicant_id: int, job_id: int, db: Session) -> JobRecommendation:
    """Ensure a JobRecommendation exists and contains employer match reasons and gaps."""
    rec = db.query(JobRecommendation).filter(
        JobRecommendation.applicant_id == applicant_id,
        JobRecommendation.job_id == job_id
    ).first()

    # If it exists and already has employer_reasons, just return it
    if rec and rec.explain and "employer_reasons" in rec.explain:
        return rec

    # Otherwise, compute it
    applicant = db.query(Applicant).options(
        joinedload(Applicant.parsed_record)
    ).filter(Applicant.id == applicant_id).first()

    job = db.query(Job).options(
        joinedload(Job.meta)
    ).filter(Job.id == job_id).first()

    if not applicant or not job:
        logger.warning(f"Could not compute recommendation: applicant={applicant_id}, job={job_id} not found.")
        return None

    # Load scoring engines
    embedder = Embedder(db)
    now = datetime.datetime.utcnow()
    active_jobs = db.query(Job).filter(
        Job.status == "approved",
        ((Job.expires_at.is_(None)) | (Job.expires_at > now))
    ).all()
    
    # Ensure this specific job is in active jobs for TfidfScorer fit
    job_ids = {j.id for j in active_jobs}
    if job.id not in job_ids:
        active_jobs.append(job)

    tfidf_scorer = get_tfidf_scorer(db, active_jobs)
    semantic_scorer = SemanticScorer(embedder)
    personalization_scorer = PersonalizationScorer(db)
    temporal_scorer = TemporalScorer()
    document_scorer = DocumentScorer(embedder)

    try:
        breakdown = run_pipeline_for_applicant_job(
            applicant=applicant,
            job=job,
            db=db,
            tfidf_scorer=tfidf_scorer,
            embedder=embedder,
            semantic_scorer=semantic_scorer,
            personalization_scorer=personalization_scorer,
            temporal_scorer=temporal_scorer,
            document_scorer=document_scorer
        )

        explanation, explanation_source = generate_explanation(applicant, job, breakdown)
        breakdown["explanation_source"] = explanation_source
        score_percent = breakdown["final_score"] * 100

        # Generate employer analysis
        analysis = generate_employer_match_analysis(applicant, job, breakdown)
        employer_reasons = analysis.get("reasons")
        employer_gaps = analysis.get("gaps")

        explain_compat = {
            "reasons": [explanation] if explanation else ["Matched based on your profile strength and skill overlap."],
            "summary": explanation or "Your profile aligns well with this role.",
            "key_strengths": [],
            "improvement_areas": [],
            "employer_reasons": employer_reasons,
            "employer_gaps": employer_gaps
        }

        if rec:
            rec.score = score_percent
            rec.score_breakdown = breakdown
            rec.explanation = explanation
            rec.explain = explain_compat
            rec.computed_at = now
            rec.engine_version = "v2"
        else:
            rec = JobRecommendation(
                applicant_id=applicant_id,
                job_id=job_id,
                score=score_percent,
                score_breakdown=breakdown,
                explanation=explanation,
                explain=explain_compat,
                computed_at=now,
                engine_version="v2"
            )
            db.add(rec)

        db.commit()
        db.refresh(rec)
        logger.info(f"Dynamically generated and cached recommendation for applicant_id={applicant_id}, job_id={job_id}")
        return rec
    except Exception as e:
        logger.error(f"Failed to ensure recommendation for applicant_id={applicant_id}, job_id={job_id}: {e}", exc_info=True)
        db.rollback()
        return None

