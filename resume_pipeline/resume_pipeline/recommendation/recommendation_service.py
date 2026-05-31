"""Recommendation service wrapper delegating to the redesigned 5-tier scoring engine."""
from typing import Dict, List, cast, Any
import logging
from sqlalchemy.orm import Session, joinedload
from ..db import Applicant, JobRecommendation, Job, Employer
from ..config import settings
from .engine import compute_recommendations

logger = logging.getLogger(__name__)


class RecommendationService:
    """Wrapper service class that coordinates the pre-computed 5-tier scoring recommendation pipeline."""

    def __init__(self, db: Session):
        self.db = db

    def get_recommendations(self, applicant_id: int) -> Dict[str, Any]:
        """Compute/refresh and return recommendations for the applicant."""
        try:
            # 1. Trigger the redesigned pipeline calculation and database storage
            compute_recommendations(applicant_id, self.db)

            # 2. Fetch the newly stored recommendations to return the expected dictionary structure
            job_recs = (
                self.db.query(JobRecommendation, Job, Employer)
                .join(Job, JobRecommendation.job_id == Job.id)
                .join(Employer, Job.employer_id == Employer.id)
                .filter(JobRecommendation.applicant_id == applicant_id)
                .order_by(JobRecommendation.score.desc())
                .all()
            )

            recommendations = []
            for rec, job, employer in job_recs:
                recommendations.append({
                    "id": job.id,
                    "title": job.title,
                    "company": employer.company_name if employer else "Unknown",
                    "location": f"{job.location_city or ''}, {job.location_state or ''}".strip(", "),
                    "work_type": job.work_type,
                    "description": job.description,
                    "min_experience_years": job.min_experience_years,
                    "required_skills": job.required_skills,
                    # score matches the 0.0 - 100.0 percentage range
                    "match_score": float(rec.score) if rec.score else 0.0,
                    "match_breakdown": rec.score_breakdown,
                    "explanation": rec.explanation,
                    "recommendation_reason": rec.explanation or "Good overall profile fit"
                })

            limit = settings.MAX_RECOMMENDATIONS or 10
            return {"job_recommendations": recommendations[:limit]}

        except Exception as e:
            logger.error(f"Error in RecommendationService.get_recommendations for applicant_id={applicant_id}: {e}", exc_info=True)
            return {"job_recommendations": []}
