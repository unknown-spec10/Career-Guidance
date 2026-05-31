import datetime
import math
from ...db import Job


class TemporalScorer:
    """Tier 4: Temporal Decay & Job Market Awareness.
    
    Determines opportunity multipliers based on posting freshness and applicant interest.
    Applies exponential decay for age and adjusts for high/low applicant volumes.
    """

    def freshness_score(self, created_at: datetime.datetime | None) -> float:
        """Calculate exponential decay of freshness over time."""
        if not created_at:
            return 1.0
        # Calculate days since posting
        delta = datetime.datetime.utcnow() - created_at
        days = max(0, delta.days)
        # e^(-days / 30)
        return math.exp(-days / 30.0)

    def demand_modifier(self, job: Job) -> float:
        """Compute the demand modifier based on application count and age."""
        app_count = len(job.applications) if job.applications else 0

        created_at = job.created_at or datetime.datetime.utcnow()
        delta = datetime.datetime.utcnow() - created_at
        days_since_posted = max(0, delta.days)

        if app_count > 20:
            return 0.05
        elif app_count == 0 and days_since_posted > 45:
            return -0.10
        return 0.0

    def opportunity_multiplier(self, job: Job) -> float:
        """Calculate opportunity multiplier, scaling from 0.5 (worst case) to 1.0 (best case)."""
        freshness = self.freshness_score(job.created_at)
        demand = self.demand_modifier(job)

        temporal_score = freshness + demand
        temporal_score = min(1.0, max(0.0, temporal_score))

        return 0.5 + (0.5 * temporal_score)
