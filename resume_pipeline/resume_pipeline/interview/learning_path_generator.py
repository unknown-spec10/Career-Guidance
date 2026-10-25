"""Backward-compatibility shim.

Canonical implementation moved to :mod:`resume_pipeline.learning.generator`.
Re-exported here so existing imports keep working unchanged.
"""
from ..core.llm_router import llm_router  # noqa: F401  (patch target compat)
from ..learning.generator import (  # noqa: F401
    RobustLearningPathResponse,
    YouTubeQuotaExhausted,
    build_learning_path_json,
    fetch_leetcode_problems_for_skills,
    fetch_video_stats,
    fetch_video_stats_with_rotation,
    filter_and_rank_videos,
    generate_learning_path,
    generate_search_queries,
    get_fallback_leetcode_problems,
    get_youtube_keys,
    load_youtube_cache,
    parse_iso8601_duration,
    save_youtube_cache,
    search_youtube,
    search_youtube_with_rotation,
)

__all__ = [
    "RobustLearningPathResponse",
    "YouTubeQuotaExhausted",
    "build_learning_path_json",
    "fetch_leetcode_problems_for_skills",
    "fetch_video_stats",
    "fetch_video_stats_with_rotation",
    "filter_and_rank_videos",
    "generate_learning_path",
    "generate_search_queries",
    "get_fallback_leetcode_problems",
    "get_youtube_keys",
    "llm_router",
    "load_youtube_cache",
    "parse_iso8601_duration",
    "save_youtube_cache",
    "search_youtube",
    "search_youtube_with_rotation",
]
