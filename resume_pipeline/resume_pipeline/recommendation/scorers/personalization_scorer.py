import logging
import re
from sqlalchemy.orm import Session, joinedload
from ...db import UserFeedback, Job

logger = logging.getLogger(__name__)


class PersonalizationScorer:
    """Tier 3: Personalization via Implicit Feedback.
    
    Adjusts match scores based on user interactions: clicks (+0.05), saves (+0.10),
    applications (+0.15), and dismissals (-0.10) for jobs in the same tag/category cluster.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_multiplier(self, applicant_id: int, candidate_job: Job) -> float:
        """Calculate the personalization score multiplier for a candidate job based on history."""
        # 1. Fetch user feedback history
        feedbacks = self.db.query(UserFeedback).filter(UserFeedback.applicant_id == applicant_id).all()
        if not feedbacks:
            return 1.0

        # Signal weights
        action_weights = {
            "click": 0.05,
            "save": 0.10,
            "apply": 0.15,
            "dismiss": -0.10
        }

        tag_preferences = {}
        title_word_preferences = {}

        # 2. Fetch all unique jobs the user has interacted with
        job_ids = list({f.job_id for f in feedbacks})
        interacted_jobs = self.db.query(Job).options(
            joinedload(Job.meta)
        ).filter(Job.id.in_(job_ids)).all()
        interacted_jobs_dict = {j.id: j for j in interacted_jobs}

        for f in feedbacks:
            job = interacted_jobs_dict.get(f.job_id)
            if not job:
                continue

            weight = action_weights.get(f.action_type, 0.0)
            if weight == 0.0:
                continue

            # Accumulate tag preferences
            tags = []
            if job.meta and job.meta.tags:
                tags = job.meta.tags if isinstance(job.meta.tags, list) else []

            for tag in tags:
                tag_lower = str(tag).lower().strip()
                if tag_lower:
                    tag_preferences[tag_lower] = tag_preferences.get(tag_lower, 0.0) + weight

            # Accumulate title word preferences (ignoring short stopwords)
            title = job.title or ""
            words = re.findall(r"\b\w{4,}\b", title.lower())  # words with at least 4 chars
            for w in words:
                title_word_preferences[w] = title_word_preferences.get(w, 0.0) + weight

        # 3. Match candidate job against the profile
        tag_match_sum = 0.0
        candidate_tags = []
        if candidate_job.meta and candidate_job.meta.tags:
            candidate_tags = candidate_job.meta.tags if isinstance(candidate_job.meta.tags, list) else []

        for tag in candidate_tags:
            tag_lower = str(tag).lower().strip()
            tag_match_sum += tag_preferences.get(tag_lower, 0.0)

        title_match_sum = 0.0
        candidate_title = candidate_job.title or ""
        candidate_title_words = re.findall(r"\b\w{4,}\b", candidate_title.lower())
        for w in candidate_title_words:
            title_match_sum += title_word_preferences.get(w, 0.0)

        # Apply multiplier logic
        boost = tag_match_sum + title_match_sum
        multiplier = 1.0 + boost

        # Clamp between 0.7 (max penalty) and 1.3 (max boost)
        return min(1.3, max(0.7, multiplier))
