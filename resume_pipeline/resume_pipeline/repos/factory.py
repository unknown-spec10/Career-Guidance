"""
PostgreSQL-backed database factory.
Always uses the PostgreSQL (psycopg2) implementation.
"""

import logging

logger = logging.getLogger(__name__)


class DatabaseFactory:
    """Factory to instantiate the correct repository set (always PostgreSQL)"""

    @classmethod
    def get_user_repository(cls):
        """Get user repository"""
        from .pg_impl import PGUserRepository
        return PGUserRepository

    @classmethod
    def get_applicant_repository(cls):
        """Get applicant repository"""
        from .pg_impl import PGApplicantRepository
        return PGApplicantRepository

    @classmethod
    def get_college_repository(cls):
        """Get college repository"""
        from .pg_impl import PGCollegeRepository
        return PGCollegeRepository

    @classmethod
    def get_job_repository(cls):
        """Get job repository"""
        from .pg_impl import PGJobRepository
        return PGJobRepository

    @classmethod
    def get_recommendation_repository(cls):
        """Get recommendation repository"""
        from .pg_impl import PGRecommendationRepository
        return PGRecommendationRepository
