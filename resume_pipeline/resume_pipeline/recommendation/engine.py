"""Backward-compatible shim over the staged pipeline (retrieval -> ranking -> rerank).

New code should import from recommendation.ranking,
recommendation.service, or recommendation.retrieval directly.
This module re-exports the former engine API so existing callers
(seed scripts, routers, tests) keep working unchanged.
"""
from .explainer import generate_employer_match_analysis, generate_explanation  # noqa: F401
from .ranking import (  # noqa: F401
    RankingContext,
    compute_ranked_for_applicant,
    compute_recommendations,
    ensure_applicant_job_recommendation,
    fetch_interview_score,
    load_active_jobs,
    load_applicant_with_profile,
    rank_candidates,
    run_pipeline_for_applicant_job,
    score_pair,
)
from .retrieval import get_tfidf_scorer  # noqa: F401
