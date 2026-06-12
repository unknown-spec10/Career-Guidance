import sys
import os
import datetime
import pytest
from unittest.mock import MagicMock, patch

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import Job, Applicant, UserFeedback, JobEmbeddingsCache, LLMParsedRecord, JobRecommendation
from resume_pipeline.recommendation.scorers.tfidf_scorer import TfidfScorer
from resume_pipeline.recommendation.scorers.semantic_scorer import SemanticScorer
from resume_pipeline.recommendation.scorers.personalization_scorer import PersonalizationScorer
from resume_pipeline.recommendation.scorers.temporal_scorer import TemporalScorer
from resume_pipeline.recommendation.scorers.document_scorer import DocumentScorer
from resume_pipeline.recommendation.aggregator import (
    aggregate_scores,
    compute_location_match,
    compute_experience_fit,
    compute_academic_fit
)
from resume_pipeline.recommendation.embedder import Embedder, GeminiEmbeddingUnavailable
from resume_pipeline.recommendation.engine import run_pipeline_for_applicant_job, compute_recommendations


class MockJob:
    def __init__(self, id, title, description, required_skills, location_city=None, location_state=None, work_type=None, min_experience_years=0.0, min_cgpa=None, created_at=None, applications=None, optional_skills=None):
        self.id = id
        self.title = title
        self.description = description
        self.required_skills = required_skills
        self.location_city = location_city
        self.location_state = location_state
        self.work_type = work_type
        self.min_experience_years = min_experience_years
        self.min_cgpa = min_cgpa
        self.created_at = created_at or datetime.datetime.utcnow()
        self.applications = applications or []
        self.optional_skills = optional_skills or []
        self.status = "approved"
        self.expires_at = None


def test_tfidf_scorer():
    """Test TF-IDF calculations local scoring."""
    jobs = [
        MockJob(1, "Python Backend Developer", "Looking for Python django programmer", [{"name": "Python"}, {"name": "Django"}]),
        MockJob(2, "Frontend React Engineer", "React javascript css roles", [{"name": "React"}, {"name": "Javascript"}])
    ]
    scorer = TfidfScorer()
    scorer.build_corpus(jobs)
    
    # Python programmer match against Job 1
    score1 = scorer.score(["Python"], 1)
    # Python match against Job 2
    score2 = scorer.score(["Python"], 2)
    
    assert score1 > 0.0
    assert score2 == 0.0
    assert score1 <= 1.0


def test_semantic_scorer():
    """Test SemanticScorer with mocked Embedder."""
    mock_embedder = MagicMock(spec=Embedder)
    mock_embedder.embed.return_value = [0.1, 0.2, 0.3]
    mock_embedder.get_job_embedding.return_value = [0.15, 0.25, 0.35]
    mock_embedder.cosine_similarity.return_value = 0.95
    
    scorer = SemanticScorer(mock_embedder)
    job = MockJob(1, "Python Developer", "Needs python", [{"name": "Python"}])
    
    score = scorer.score([{"name": "Python"}], job)
    assert score == 0.95
    mock_embedder.embed.assert_called_once()
    mock_embedder.get_job_embedding.assert_called_once()


def test_document_scorer():
    """Test DocumentScorer with parsed applicant summary."""
    mock_embedder = MagicMock(spec=Embedder)
    mock_embedder.embed.return_value = [0.1] * 768
    mock_embedder.get_job_embedding.return_value = [0.1] * 768
    mock_embedder.cosine_similarity.return_value = 0.88
    
    applicant = MagicMock(spec=Applicant)
    applicant.display_name = "Jane Doe"
    applicant.location_city = "Mumbai"
    applicant.location_state = "MH"
    
    parsed_record = MagicMock(spec=LLMParsedRecord)
    parsed_record.normalized = {
        "personal": {"name": "Jane Doe", "location": "Mumbai, MH"},
        "skills": [{"name": "Python"}, {"name": "Machine Learning"}],
        "education": [{"degree": "B.Tech", "institution": "IIT", "cgpa": "9.2"}],
        "experience": [{"role": "Intern", "company": "Google", "description": "Worked on ML"}]
    }
    applicant.parsed_record = parsed_record
    
    scorer = DocumentScorer(mock_embedder)
    summary_text = scorer.build_resume_text(applicant)
    assert "Jane Doe" in summary_text
    assert "Mumbai" in summary_text
    assert "Python" in summary_text
    assert "IIT" in summary_text
    assert "Google" in summary_text
    
    job = MockJob(1, "Python Intern", "Looking for machine learning intern", [{"name": "Python"}])
    score = scorer.score(applicant, job)
    assert score == 0.88


def test_personalization_scorer():
    """Test personalization multiplier calculations based on UserFeedback."""
    mock_db = MagicMock()
    
    # Setting up mock feedbacks and job details
    fb1 = UserFeedback(applicant_id=10, job_id=1, action_type="apply")
    fb2 = UserFeedback(applicant_id=10, job_id=2, action_type="dismiss")
    
    job1 = MockJob(1, "Backend Developer", "python postgresql", [], created_at=datetime.datetime.utcnow())
    job1.meta = MagicMock()
    job1.meta.tags = ["python", "backend"]
    
    job2 = MockJob(2, "Frontend Developer", "react css html", [], created_at=datetime.datetime.utcnow())
    job2.meta = MagicMock()
    job2.meta.tags = ["react", "frontend"]
    
    # Create query mock for UserFeedback
    mock_query_feedback = MagicMock()
    mock_query_feedback.filter.return_value.all.return_value = [fb1, fb2]
    
    # Create query mock for Job
    mock_query_job = MagicMock()
    mock_query_job.options.return_value.filter.return_value.all.return_value = [job1, job2]
    
    def query_side_effect(model):
        if model == UserFeedback:
            return mock_query_feedback
        else:
            return mock_query_job
            
    mock_db.query.side_effect = query_side_effect
    
    scorer = PersonalizationScorer(mock_db)
    
    # Test candidate job that aligns with positive feedback
    candidate_job_positive = MockJob(
        id=3,
        title="Senior Backend Python Engineer",
        description="Write backend code in Python",
        required_skills=[],
        created_at=datetime.datetime.utcnow()
    )
    candidate_job_positive.meta = MagicMock()
    candidate_job_positive.meta.tags = ["python", "backend"]
    
    mult_pos = scorer.get_multiplier(10, candidate_job_positive)
    
    # Test candidate job that aligns with negative feedback
    candidate_job_negative = MockJob(
        id=4,
        title="Junior React Frontend Developer",
        description="Saves details in UI",
        required_skills=[],
        created_at=datetime.datetime.utcnow()
    )
    candidate_job_negative.meta = MagicMock()
    candidate_job_negative.meta.tags = ["react", "frontend"]
    
    mult_neg = scorer.get_multiplier(10, candidate_job_negative)
    
    assert mult_pos > 1.0  # Boosted because title matches backend & python tags
    assert mult_neg < 1.0  # Penalized because title matches react/frontend tags (dismissed)


def test_temporal_scorer():
    """Test temporal scorer calculations."""
    scorer = TemporalScorer()
    
    # 1. Freshness Score
    fresh_time = datetime.datetime.utcnow()
    old_time = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    
    score_fresh = scorer.freshness_score(fresh_time)
    score_old = scorer.freshness_score(old_time)
    
    assert score_fresh == 1.0
    assert abs(score_old - 0.3678) < 0.05
    
    # 2. Demand Modifier
    job_high_demand = MockJob(1, "Software Dev", "", [], applications=[1]*25)
    job_low_demand = MockJob(2, "Old Dev", "", [], created_at=datetime.datetime.utcnow() - datetime.timedelta(days=50))
    job_neutral = MockJob(3, "Neutral Dev", "", [], applications=[1]*5)
    
    assert scorer.demand_modifier(job_high_demand) == 0.05
    assert scorer.demand_modifier(job_low_demand) == -0.10
    assert scorer.demand_modifier(job_neutral) == 0.0
    
    # 3. Opportunity Multiplier
    mult_fresh = scorer.opportunity_multiplier(job_high_demand)
    assert 0.5 <= mult_fresh <= 1.0


def test_aggregator_details():
    """Test location, experience, academic match heuristics and final aggregator math."""
    # Location
    job_remote = MockJob(1, "Remote Job", "", [], work_type="remote")
    assert compute_location_match("Delhi", job_remote) == 1.0
    
    job_onsite = MockJob(2, "Onsite Delhi", "", [], work_type="on-site", location_city="Delhi")
    assert compute_location_match("Delhi, India", job_onsite) == 1.0
    assert compute_location_match("Mumbai", job_onsite) == 0.4
    
    # Experience
    job_exp = MockJob(3, "Experienced Role", "", [], min_experience_years=3.0)
    assert compute_experience_fit(["exp1", "exp2", "exp3"], job_exp) == 1.0
    assert compute_experience_fit(["exp1"], job_exp) == 1.0/3.0
    
    # Academic
    job_acad = MockJob(4, "Academic Role", "", [], min_cgpa=8.5)
    assert compute_academic_fit([{"cgpa": 9.0}], job_acad) == 1.0
    assert compute_academic_fit([{"cgpa": 7.5}], job_acad) == 0.5
    
    # Aggregate
    final_score, breakdown = aggregate_scores(
        tfidf_score=0.8,
        semantic_skill_score=0.9,
        doc_similarity=0.75,
        location_score=1.0,
        experience_fit=1.0,
        academic_score=0.8,
        interview_score=0.85,
        opportunity_multiplier=0.95,
        personalization_multiplier=1.05
    )
    
    assert 0.0 <= final_score <= 1.0
    assert "tfidf_score" in breakdown
    assert breakdown["embedding_fallback"] is False


def test_fallback_aggregator_math():
    """Test aggregator when embeddings fall back to TF-IDF."""
    final_score, breakdown = aggregate_scores(
        tfidf_score=0.8,
        semantic_skill_score=None,
        doc_similarity=None,
        location_score=1.0,
        experience_fit=1.0,
        academic_score=0.8,
        interview_score=None,
        opportunity_multiplier=1.0,
        personalization_multiplier=1.0,
        embedding_fallback=True,
        embedding_fallback_reason="API Failure"
    )
    
    assert breakdown["embedding_fallback"] is True
    assert breakdown["semantic_understanding"] == 0.8  # equal to tfidf_score
    assert final_score > 0.0
