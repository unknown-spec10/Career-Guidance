"""Recommendation module for student job matching (staged pipeline)."""
from .service import RecommendationFacade, RecommendationService, get_recommendations

__all__ = ['RecommendationService', 'RecommendationFacade', 'get_recommendations']
