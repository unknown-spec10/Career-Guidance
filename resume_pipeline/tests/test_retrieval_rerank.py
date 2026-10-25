"""Staged pipeline tests: retrieval, reranking, and the purpose parameter."""
import datetime
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import Applicant, LLMParsedRecord
from resume_pipeline.recommendation import (
    RecommendationService,
    get_recommendations as facade_get_recommendations,
)
from resume_pipeline.recommendation import service as service_module
from resume_pipeline.recommendation.reranking import (
    PURPOSE_WEIGHTS,
    VALID_PURPOSES,
    apply_diversity_cap,
    gap_signal,
    missing_skills_for,
    rerank_scored,
)
from resume_pipeline.recommendation.retrieval import (
    RETRIEVAL_TOP_K,
    passes_hard_filters,
    retrieve_candidate_jobs,
)
from resume_pipeline.recommendation.scorers.tfidf_scorer import TfidfScorer


class MockJob:
    def __init__(self, id, title, description, required_skills, location_city=None,
                 location_state=None, work_type="on-site", min_experience_years=0.0,
                 created_at=None, employer_id=1):
        self.id = id
        self.title = title
        self.description = description
        self.required_skills = required_skills
        self.location_city = location_city
        self.location_state = location_state
        self.work_type = work_type
        self.min_experience_years = min_experience_years
        self.created_at = created_at or datetime.datetime.utcnow()
        self.applications = []
        self.optional_skills = []
        self.status = "approved"
        self.expires_at = None
        self.employer_id = employer_id
        self.meta = MagicMock()
        self.meta.tags = []


def make_applicant(skills, location="Bengaluru, Karnataka", n_exp=2):
    app = MagicMock(spec=Applicant)
    app.id = 999
    app.display_name = "Test Candidate"
    app.location_city = location.split(",")[0].strip()
    app.location_state = location.split(",")[1].strip()
    rec = MagicMock(spec=LLMParsedRecord)
    rec.normalized = {
        "personal": {"name": "Test", "location": location},
        "skills": [{"name": s} for s in skills],
        "experience": [{"title": f"Role {i}"} for i in range(n_exp)],
        "education": [{"degree": "B.Tech", "cgpa": 8.0}],
    }
    app.parsed_record = rec
    return app


def make_jobs():
    return [
        MockJob(1, "Python Backend Developer", "Python Django APIs",
                [{"name": "Python"}, {"name": "Django"}], "Bengaluru", "Karnataka",
                "on-site", 2.0, employer_id=10),
        MockJob(2, "Frontend React Engineer", "React javascript css",
                [{"name": "React"}], "Mumbai", "Maharashtra", "on-site", 5.0,
                employer_id=20),
        MockJob(3, "Remote Python Scribe", "Python writing docs",
                [{"name": "Python"}], None, None, "remote", 0.0, employer_id=30),
    ]


def test_retrieval_returns_ranked_tfidf_candidates_no_network():
    applicant = make_applicant(["Python", "Django"])
    jobs = make_jobs()
    # db=None forces the uncached local scorer path — still no network.
    with patch(
        "resume_pipeline.recommendation.retrieval.TfidfScorer.score",
        wraps=TfidfScorer().score,
    ):
        candidates = retrieve_candidate_jobs(applicant, jobs, db=None, top_k=10)
    assert candidates
    ids = [j.id for j, _ in candidates]
    # Best skill overlap first; remote Python job outranks unrelated React job.
    assert ids[0] == 1
    assert 3 in ids
    scores = [s for _, s in candidates]
    assert scores == sorted(scores, reverse=True)
    assert all(0.0 <= s <= 1.0 for s in scores)


def test_retrieval_hard_filters_drop_obvious_mismatch_but_top_up():
    applicant = make_applicant(["Python"], n_exp=0)
    jobs = make_jobs()
    from resume_pipeline.recommendation.retrieval import get_applicant_profile

    profile = get_applicant_profile(applicant)
    # On-site Mumbai job requiring 5yrs does not pass for a fresher in Bengaluru.
    assert passes_hard_filters(profile, jobs[1]) is False
    # Remote Python job always passes.
    assert passes_hard_filters(profile, jobs[2]) is True
    # Retrieval still returns candidates (top-up protects recall).
    candidates = retrieve_candidate_jobs(applicant, jobs, db=None, top_k=10)
    assert len(candidates) == 3


def test_retrieval_top_k_bounded():
    applicant = make_applicant(["Python"])
    jobs = [MockJob(i, f"Python Job {i}", "Python code",
                    [{"name": "Python"}], work_type="remote") for i in range(1, 150)]
    candidates = retrieve_candidate_jobs(applicant, jobs, db=None)
    assert len(candidates) == RETRIEVAL_TOP_K


def test_rerank_jobs_purpose_preserves_ranking_order():
    applicant = make_applicant(["Python", "Django"])
    jobs = make_jobs()
    for j in jobs:
        j.created_at = datetime.datetime.utcnow() - datetime.timedelta(days=60)
    scored = [(jobs[0], {"final_score": 0.9, "combined_skill_score": 0.9}, 90.0),
              (jobs[2], {"final_score": 0.5, "combined_skill_score": 0.5}, 50.0)]
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    out = rerank_scored(applicant, scored, mock_db, purpose="jobs")
    assert [e["job"].id for e in out] == [1, 3]
    assert out[0]["score"] >= out[1]["score"]


def test_rerank_diversity_cap_defers_same_employer_overflow():
    applicant = make_applicant(["Python"])
    jobs = [MockJob(i, f"Python Job {i}", "Python", [{"name": "Python"}],
                    work_type="remote", employer_id=7) for i in range(1, 6)]
    other = MockJob(99, "Other Python Job", "Python", [{"name": "Python"}],
                    work_type="remote", employer_id=8)
    scored = [ (j, {"final_score": 0.9 - i * 0.01, "combined_skill_score": 0.8}, 90.0 - i)
               for i, j in enumerate(jobs) ]
    scored.append((other, {"final_score": 0.5, "combined_skill_score": 0.5}, 50.0))
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    out = rerank_scored(applicant, scored, mock_db, purpose="jobs")
    top_ids = [e["job"].id for e in out[:3]]
    assert 99 in [e["job"].id for e in out[:4]]
    assert len([e for e in out[:3] if e["job"].employer_id == 7]) <= 3


def test_rerank_skill_gaps_purpose_surfaces_missing_skills():
    applicant = make_applicant(["Python"])
    job = MockJob(1, "Python ML Role", "Python Machine Learning TensorFlow",
                  [{"name": "Python"}, {"name": "TensorFlow"}, {"name": "Kubernetes"}],
                  work_type="remote")
    scored = [(job, {"final_score": 0.6, "combined_skill_score": 0.4}, 60.0)]
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    out = rerank_scored(applicant, scored, mock_db, purpose="skill_gaps")
    assert out[0]["missing_skills"] == ["TensorFlow", "Kubernetes"]
    assert out[0]["gap_signal"] > 0.0


def test_gap_signal_zero_without_requirements():
    applicant = make_applicant(["Python"])
    job = MockJob(1, "Mystery Role", "stuff", [], work_type="remote")
    assert gap_signal(applicant, job, {"combined_skill_score": 0.5}) == 0.0
    assert missing_skills_for(applicant, job) == []


def test_rerank_rejects_unknown_purpose():
    applicant = make_applicant(["Python"])
    mock_db = MagicMock()
    try:
        rerank_scored(applicant, [], mock_db, purpose="nope")
    except ValueError:
        return
    raise AssertionError("expected ValueError for unknown purpose")


def test_facade_rejects_unknown_purpose_without_db():
    mock_db = MagicMock()
    try:
        service_module.get_recommendations(1, mock_db, purpose="nope")
    except ValueError:
        return
    raise AssertionError("expected ValueError for unknown purpose")


def test_facade_delegates_to_staged_pipeline():
    mock_db = MagicMock()
    applicant = make_applicant(["Python"])
    job = make_jobs()[0]
    ranked = [(job, {"final_score": 0.8, "combined_skill_score": 0.7,
                     "explanation_source": None}, 80.0)]
    with patch.object(service_module, "compute_ranked_for_applicant",
                      return_value=(applicant, ranked)), \
         patch.object(service_module, "ensure_applicant_embeddings",
                      return_value={"skills": "updated"}), \
         patch.object(service_module, "fetch_interview_score", return_value=None), \
         patch.object(service_module, "attach_explanations",
                      side_effect=lambda a, r, db, top_n, lightweight: r), \
         patch.object(service_module, "persist_recommendations",
                      return_value=[{"job_id": 1, "score": 80.0}]):
        result = service_module.get_recommendations(1, mock_db, purpose="digest")
    assert len(result["job_recommendations"]) == 1
    assert result["job_recommendations"][0]["job_id"] == 1


def test_legacy_service_name_still_works():
    mock_db = MagicMock()
    svc = RecommendationService(mock_db)
    assert isinstance(svc, service_module.RecommendationFacade)
    with patch.object(service_module, "compute_ranked_for_applicant",
                      return_value=(None, [])):
        assert facade_get_recommendations(1, mock_db) == {"job_recommendations": []}
        assert svc.get_recommendations(1) == {"job_recommendations": []}


def test_valid_purposes_contract():
    assert set(VALID_PURPOSES) == {"jobs", "skill_gaps", "digest"}
    assert set(PURPOSE_WEIGHTS) == set(VALID_PURPOSES)


def test_apply_diversity_cap_is_stable_noop_when_diverse():
    jobs = make_jobs()
    scored = [(j, {}, 90.0 - j.id) for j in jobs]
    assert apply_diversity_cap(scored) == scored
