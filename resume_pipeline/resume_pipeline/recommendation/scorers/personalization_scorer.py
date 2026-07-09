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
        self.precomputed = False
        self.tag_preferences = {}  # {applicant_id: {tag: weight}}
        self.title_word_preferences = {}  # {applicant_id: {word: weight}}

    def preload_preferences(self, applicant_id: int) -> None:
        """Precompute personalization preferences for a single applicant to avoid N+1 queries."""
        self.preload_preferences_batch([applicant_id])

    def preload_preferences_batch(self, applicant_ids: list) -> None:
        """Precompute personalization preferences for multiple applicants in one query."""
        applicant_ids = [aid for aid in applicant_ids if aid is not None]
        if not applicant_ids:
            return

        feedbacks = self.db.query(UserFeedback).filter(UserFeedback.applicant_id.in_(applicant_ids)).all()
        
        action_weights = {
            "click": 0.05,
            "save": 0.10,
            "apply": 0.15,
            "dismiss": -0.10
        }

        # Initialize empty dicts for all requested applicant IDs
        for aid in applicant_ids:
            if aid not in self.tag_preferences:
                self.tag_preferences[aid] = {}
            if aid not in self.title_word_preferences:
                self.title_word_preferences[aid] = {}

        if not feedbacks:
            return

        # Fetch all unique jobs the users have interacted with
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

            aid = f.applicant_id
            
            # Accumulate tag preferences
            tags = []
            if job.meta and job.meta.tags:
                tags = job.meta.tags if isinstance(job.meta.tags, list) else []

            for tag in tags:
                tag_lower = str(tag).lower().strip()
                if tag_lower:
                    self.tag_preferences[aid][tag_lower] = self.tag_preferences[aid].get(tag_lower, 0.0) + weight

            # Accumulate title word preferences (ignoring short stopwords)
            title = job.title or ""
            words = re.findall(r"\b\w{4,}\b", title.lower())  # words with at least 4 chars
            for w in words:
                self.title_word_preferences[aid][w] = self.title_word_preferences[aid].get(w, 0.0) + weight

    def get_multiplier(self, applicant_id: int, candidate_job: Job) -> float:
        """Calculate the personalization score multiplier for a candidate job based on history."""
        if applicant_id not in self.tag_preferences or applicant_id not in self.title_word_preferences:
            self.preload_preferences(applicant_id)

        app_tag_prefs = self.tag_preferences.get(applicant_id, {})
        app_title_prefs = self.title_word_preferences.get(applicant_id, {})

        if not app_tag_prefs and not app_title_prefs:
            return 1.0

        # Match candidate job against the profile
        tag_match_sum = 0.0
        candidate_tags = []
        if candidate_job.meta and candidate_job.meta.tags:
            candidate_tags = candidate_job.meta.tags if isinstance(candidate_job.meta.tags, list) else []

        for tag in candidate_tags:
            tag_lower = str(tag).lower().strip()
            tag_match_sum += app_tag_prefs.get(tag_lower, 0.0)

        title_match_sum = 0.0
        candidate_title = candidate_job.title or ""
        candidate_title_words = re.findall(r"\b\w{4,}\b", candidate_title.lower())
        for w in candidate_title_words:
            title_match_sum += app_title_prefs.get(w, 0.0)

        # Apply multiplier logic
        boost = tag_match_sum + title_match_sum
        multiplier = 1.0 + boost

        # Clamp between 0.7 (max penalty) and 1.3 (max boost)
        return min(1.3, max(0.7, multiplier))
