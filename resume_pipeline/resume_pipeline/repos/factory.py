"""
Environment-aware database factory.
Selects MySQL (local) or Firestore (cloud) at runtime based on APP_ENV.
"""

import os
import logging
from typing import Union

logger = logging.getLogger(__name__)


class DatabaseFactory:
    """Factory to instantiate the correct repository set based on APP_ENV"""
    
    _backend_cache = None
    
    @classmethod
    def get_backend(cls) -> str:
        """
        Determine database backend from APP_ENV.
        
        Returns:
            'local' (MySQL) or 'cloud' (Firestore)
            
        Raises:
            ValueError: If APP_ENV is invalid
        """
        if cls._backend_cache:
            return cls._backend_cache
        
        env = os.getenv("APP_ENV", "local").lower()
        
        if env not in ["local", "cloud"]:
            raise ValueError(
                f"Invalid APP_ENV='{env}'. Must be 'local' or 'cloud'."
            )
        
        cls._backend_cache = env
        logger.info(f"✅ Database backend selected: {env.upper()}")
        
        return env
    
    @classmethod
    def get_user_repository(cls):
        """Get user repository (MySQL or Firestore)"""
        backend = cls.get_backend()
        
        if backend == "local":
            from .mysql_impl import MySQLUserRepository
            return MySQLUserRepository
        else:
            from .firestore_impl import FirestoreUserRepository
            return FirestoreUserRepository
    
    @classmethod
    def get_applicant_repository(cls):
        """Get applicant repository"""
        backend = cls.get_backend()
        
        if backend == "local":
            from .mysql_impl import MySQLApplicantRepository
            return MySQLApplicantRepository
        else:
            from .firestore_impl import FirestoreApplicantRepository
            return FirestoreApplicantRepository
    
    @classmethod
    def get_college_repository(cls):
        """Get college repository"""
        backend = cls.get_backend()
        
        if backend == "local":
            from .mysql_impl import MySQLCollegeRepository
            return MySQLCollegeRepository
        else:
            from .firestore_impl import FirestoreCollegeRepository
            return FirestoreCollegeRepository
    
    @classmethod
    def get_job_repository(cls):
        """Get job repository"""
        backend = cls.get_backend()
        
        if backend == "local":
            from .mysql_impl import MySQLJobRepository
            return MySQLJobRepository
        else:
            from .firestore_impl import FirestoreJobRepository
            return FirestoreJobRepository
    
    @classmethod
    def get_recommendation_repository(cls):
        """Get recommendation repository"""
        backend = cls.get_backend()
        
        if backend == "local":
            from .mysql_impl import MySQLRecommendationRepository
            return MySQLRecommendationRepository
        else:
            from .firestore_impl import FirestoreRecommendationRepository
            return FirestoreRecommendationRepository
