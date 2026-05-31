import logging

logger = logging.getLogger(__name__)


def compute_location_match(applicant_loc: str | None, job) -> float:
    """Calculate location match score (0.0 to 1.0)."""
    job_work_type = str(getattr(job, "work_type", "") or "").lower()
    job_city = str(getattr(job, "location_city", "") or "").lower()
    job_state = str(getattr(job, "location_state", "") or "").lower()

    if job_work_type == "remote":
        return 1.0

    if not applicant_loc:
        return 0.6  # Neutral if no location preference

    loc_lower = applicant_loc.lower()
    if job_city and job_city in loc_lower:
        return 1.0
    if job_state and job_state in loc_lower:
        return 0.8
    if job_work_type == "hybrid":
        return 0.7
    return 0.4


def compute_experience_fit(experience_items: list, job) -> float:
    """Calculate experience match score (0.0 to 1.0)."""
    min_exp = float(getattr(job, "min_experience_years", 0.0) or 0.0)
    if not experience_items:
        return 1.0 if min_exp == 0.0 else 0.3

    # Simple heuristic: treat each listed experience item as roughly 1 year
    years = float(len(experience_items))
    if years >= min_exp:
        return 1.0
    elif min_exp > 0.0:
        return years / min_exp
    return 0.8


def compute_academic_fit(education_items: list, job) -> float:
    """Calculate academic/education fit score (0.0 to 1.0)."""
    if not education_items:
        return 0.3

    min_cgpa = getattr(job, "min_cgpa", None)
    if min_cgpa is not None:
        try:
            min_cgpa = float(min_cgpa)
            for edu in education_items:
                # Support both grade and cgpa keys
                grade = edu.get("grade") or edu.get("cgpa")
                if grade is not None:
                    if float(grade) >= min_cgpa:
                        return 1.0
            return 0.5  # Has education, but doesn't meet minimum CGPA
        except Exception:
            pass
    return 0.8


def aggregate_scores(
    tfidf_score: float,
    semantic_skill_score: float | None,
    doc_similarity: float | None,
    location_score: float,
    experience_fit: float,
    academic_score: float,
    interview_score: float | None,
    opportunity_multiplier: float,
    personalization_multiplier: float,
    embedding_fallback: bool = False,
    embedding_fallback_reason: str | None = None
) -> tuple[float, dict]:
    """Pure function to aggregate individual scoring tiers into a final matched score."""
    
    # 1. Base semantic understanding (Tiers 1 + 2 + 5)
    if embedding_fallback:
        combined_skill_score = tfidf_score
        semantic_understanding = tfidf_score
    else:
        # Fallback to TF-IDF if either score is None (unexpected)
        s_score = semantic_skill_score if semantic_skill_score is not None else tfidf_score
        d_score = doc_similarity if doc_similarity is not None else tfidf_score
        
        combined_skill_score = (0.4 * tfidf_score) + (0.6 * s_score)
        semantic_understanding = (0.5 * combined_skill_score) + (0.5 * d_score)

    # 2. Base weighted scoring (Weights sum to 1.0)
    interview_taken = interview_score is not None
    interview_val = float(interview_score) if interview_taken and interview_score is not None else 0.0
    interview_boost = interview_val * 0.15  # Interview overall_score is normalized to 0.0-1.0

    if interview_taken:
        base_score = (
            0.45 * semantic_understanding +
            0.20 * location_score +
            0.15 * experience_fit +
            0.10 * academic_score +
            0.10 * interview_boost
        )
    else:
        # Redistribute interview weight when interview is missing
        base_score = (
            0.50 * semantic_understanding +
            0.25 * location_score +
            0.15 * experience_fit +
            0.10 * academic_score
        )

    # 3. Apply multipliers (opportunity_multiplier: 0.5-1.0, personalization_multiplier: 0.7-1.3)
    adjusted_score = base_score * opportunity_multiplier
    final_score = adjusted_score * personalization_multiplier

    # Clamp final score strictly between 0.0 and 1.0
    final_score = min(1.0, max(0.0, final_score))

    # 4. Construct score breakdown dictionary for caching/debugging
    score_breakdown = {
        "tfidf_score": round(tfidf_score, 3),
        "semantic_skill_score": round(semantic_skill_score, 3) if semantic_skill_score is not None else None,
        "combined_skill_score": round(combined_skill_score, 3),
        "doc_similarity": round(doc_similarity, 3) if doc_similarity is not None else None,
        "semantic_understanding": round(semantic_understanding, 3),
        "location_score": round(location_score, 3),
        "experience_fit": round(experience_fit, 3),
        "academic_score": round(academic_score, 3),
        "interview_score": round(interview_score, 3) if interview_taken else None,
        "interview_boost": round(interview_boost, 3) if interview_taken else 0.0,
        "base_score": round(base_score, 3),
        "opportunity_multiplier": round(opportunity_multiplier, 3),
        "personalization_multiplier": round(personalization_multiplier, 3),
        "final_score": round(final_score, 3),
        "embedding_fallback": embedding_fallback,
        "embedding_fallback_reason": embedding_fallback_reason
    }

    return final_score, score_breakdown
