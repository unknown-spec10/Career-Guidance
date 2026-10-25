"""Backward-compatible wrapper: delegates to the shared staged facade."""
from .service import RecommendationFacade, RecommendationService, get_recommendations  # noqa: F401

__all__ = ["RecommendationFacade", "RecommendationService", "get_recommendations"]
