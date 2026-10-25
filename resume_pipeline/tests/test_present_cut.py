"""Presentation cut: `recommended` / `more_matches` split (response shape only).

Ranking and persistence are untouched — these tests pin the present-layer
contract: split sizes per purpose, backward-compatible default shape, and
`more_matches` pagination.
"""
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.recommendation import service as service_module
from resume_pipeline.recommendation.service import (
    MORE_MATCHES_DEFAULT_LIMIT,
    MORE_MATCHES_MAX_LIMIT,
    present_top_n,
    split_present,
)


class MockJob:
    def __init__(self, id):
        self.id = id
        self.title = f"Job {id}"
        self.description = f"Description {id}"
        self.required_skills = [{"name": "Python"}]
        self.location_city = "Bengaluru"
        self.location_state = "Karnataka"
        self.work_type = "on-site"
        self.min_experience_years = 2.0


def make_reranked(n):
    return [
        {
            "job": MockJob(i),
            "breakdown": {"final_score": 0.8, "combined_skill_score": 0.7},
            "score": 90.0 - i,
            "missing_skills": [],
            "gap_signal": 0.0,
            "explanation": f"Explanation {i}",
        }
        for i in range(1, n + 1)
    ]


def mock_db_empty_employers():
    mock_db = MagicMock()
    mock_db.query.return_value.options.return_value.filter.return_value.all.return_value = []
    return mock_db


LEGACY_ENTRY_KEYS = {
    "id", "job_id", "title", "company", "location", "work_type",
    "description", "min_experience_years", "required_skills",
    "match_score", "score", "match_breakdown", "score_breakdown",
    "explanation", "recommendation_reason",
}


def test_present_top_n_defaults():
    assert present_top_n("jobs") == 10
    assert present_top_n("skill_gaps") == 10
    assert present_top_n("digest") == 10
    assert present_top_n("browse") == 20


def test_split_sizes_per_purpose():
    shaped = [{"id": i} for i in range(30)]

    jobs = split_present(shaped, "jobs")
    assert len(jobs["recommended"]) == 10
    assert len(jobs["more_matches"]) == 20
    assert jobs["total"] == 30
    assert jobs["more_total"] == 20

    browse = split_present(shaped, "browse")
    assert len(browse["recommended"]) == 20
    assert len(browse["more_matches"]) == 10
    assert browse["total"] == 30

    digest = split_present(shaped, "digest")
    assert len(digest["recommended"]) == 10
    assert len(digest["more_matches"]) == 20

    gaps = split_present(shaped, "skill_gaps")
    assert len(gaps["recommended"]) == 10
    assert len(gaps["more_matches"]) == 20

    # Ranking order is preserved across the split boundary.
    assert [e["id"] for e in jobs["recommended"]] == list(range(10))
    assert [e["id"] for e in jobs["more_matches"]] == list(range(10, 30))


def test_present_backward_compatible_default_shape():
    out = service_module._present(1, mock_db_empty_employers(), make_reranked(12), "jobs")

    # Callers that ignore the new keys see exactly the old top-10 list.
    assert len(out["job_recommendations"]) == 10
    assert out["job_recommendations"] == out["recommended"]
    assert len(out["more_matches"]) == 2
    assert out["total"] == 12
    assert out["recommended_count"] == 10
    assert out["more_total"] == 2

    for entry in out["recommended"] + out["more_matches"]:
        assert LEGACY_ENTRY_KEYS <= set(entry.keys())
    # Order preserved: scores descend through the split.
    scores = [e["score"] for e in out["recommended"] + out["more_matches"]]
    assert scores == sorted(scores, reverse=True)
    assert [e["job_id"] for e in out["recommended"]] == list(range(1, 11))
    assert [e["job_id"] for e in out["more_matches"]] == [11, 12]


def test_present_more_matches_pagination():
    db = mock_db_empty_employers()

    page = service_module._present(1, db, make_reranked(30), "jobs",
                                  more_offset=5, more_limit=5)
    assert [e["job_id"] for e in page["more_matches"]] == [16, 17, 18, 19, 20]
    assert page["more_offset"] == 5
    assert page["more_limit"] == 5
    assert page["more_total"] == 20

    past_end = service_module._present(1, db, make_reranked(30), "jobs",
                                      more_offset=99, more_limit=10)
    assert past_end["more_matches"] == []
    assert past_end["more_total"] == 20

    clamped = service_module._present(1, db, make_reranked(30), "jobs",
                                     more_offset=-3, more_limit=10**9)
    assert clamped["more_offset"] == 0
    assert clamped["more_limit"] == MORE_MATCHES_MAX_LIMIT
    assert len(clamped["more_matches"]) == 20  # rest is smaller than the cap


def test_split_present_pagination_helpers():
    shaped = [{"id": i} for i in range(15)]
    out = split_present(shaped, "jobs", more_offset=2, more_limit=3)
    assert [e["id"] for e in out["more_matches"]] == [12, 13, 14][:3]
    assert out["more_offset"] == 2
    assert out["more_limit"] == 3


def _run_facade(n, purpose="jobs", **kwargs):
    mock_db = mock_db_empty_employers()
    applicant = MagicMock()
    applicant.id = 1
    ranked = [
        (MockJob(i), {"final_score": 0.8, "combined_skill_score": 0.7}, 80.0 - i)
        for i in range(1, n + 1)
    ]
    captured = {}

    def fake_rerank(app, scored, db, purpose="jobs", interview_score=None):
        captured["purpose"] = purpose
        return [
            {"job": job, "breakdown": dict(bd), "score": sc,
             "missing_skills": [], "gap_signal": 0.0, "explanation": "exp"}
            for job, bd, sc in scored
        ]

    with patch.object(service_module, "compute_ranked_for_applicant",
                      return_value=(applicant, ranked)), \
         patch.object(service_module, "ensure_applicant_embeddings", return_value={}), \
         patch.object(service_module, "fetch_interview_score", return_value=None), \
         patch.object(service_module, "rerank_scored", side_effect=fake_rerank), \
         patch.object(service_module, "attach_explanations",
                      side_effect=lambda a, r, db, top_n, lightweight: r), \
         patch.object(service_module, "persist_recommendations",
                      return_value=[]) as persist_mock:
        result = service_module.get_recommendations(1, mock_db, purpose=purpose, **kwargs)
    return result, captured, persist_mock


def test_facade_persists_full_list_but_presents_split():
    result, captured, persist_mock = _run_facade(25, purpose="jobs")

    # Persistence stays full (all reranked rows).
    assert len(persist_mock.call_args[0][1]) == 25
    # Presentation is split: top 10 crowned, rest paged.
    assert captured["purpose"] == "jobs"
    assert result["total"] == 25
    assert len(result["job_recommendations"]) == 10
    assert result["job_recommendations"] == result["recommended"]
    assert len(result["more_matches"]) == min(15, MORE_MATCHES_DEFAULT_LIMIT)
    assert result["more_total"] == 15


def test_facade_browse_purpose_widens_top_slice_without_rerank_change():
    result, captured, _ = _run_facade(25, purpose="browse")

    # Same rerank weights as jobs (ranking logic untouched).
    assert captured["purpose"] == "jobs"
    assert len(result["recommended"]) == 20
    assert result["more_total"] == 5
    assert result["purpose"] == "browse"


def test_facade_rejects_unknown_purpose():
    mock_db = MagicMock()
    try:
        service_module.get_recommendations(1, mock_db, purpose="nope")
    except ValueError:
        return
    raise AssertionError("expected ValueError for unknown purpose")
