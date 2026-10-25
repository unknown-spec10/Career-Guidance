import sys
import os
import pytest
from unittest.mock import MagicMock, patch

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import Job, Applicant, LLMParsedRecord, JobRecommendation
from resume_pipeline.recommendation.explainer import generate_explanation, generate_employer_match_analysis
from resume_pipeline.recommendation.engine import ensure_applicant_job_recommendation


class MockJob:
    def __init__(self, id, title, required_skills, min_experience_years=2, location_city="Kolkata"):
        self.id = id
        self.title = title
        self.required_skills = required_skills
        self.min_experience_years = min_experience_years
        self.location_city = location_city
        self.work_type = "remote"
        self.status = "approved"
        self.expires_at = None
        self.meta = MagicMock()
        self.meta.tags = []


def test_offline_explanation_fallback_on_llm_failure():
    """Verify generate_explanation successfully falls back to offline rule-based logic when LLMs fail."""
    applicant = MagicMock(spec=Applicant)
    parsed_record = MagicMock(spec=LLMParsedRecord)
    parsed_record.normalized = {
        "skills": [{"name": "Python"}, {"name": "Django"}]
    }
    applicant.parsed_record = parsed_record

    job = MockJob(
        id=1,
        title="Django Developer",
        required_skills=[{"name": "Python"}, {"name": "React"}]
    )

    breakdown = {"skills_score": 0.5}

    # Force the single LLM attempt to return None (simulating API failure/rate-limit)
    with patch("resume_pipeline.recommendation.explainer._try_opencode_once", return_value=None):
        explanation, source = generate_explanation(applicant, job, breakdown)

        assert source == "offline_fallback"
        assert "Python" in explanation  # Matched skill
        assert "React" in explanation   # Missing skill
        assert "Django" not in explanation  # Not a job skill


def test_offline_employer_match_analysis_fallback_on_llm_failure():
    """Verify generate_employer_match_analysis successfully falls back to rule-based logic when LLMs fail."""
    applicant = MagicMock(spec=Applicant)
    parsed_record = MagicMock(spec=LLMParsedRecord)
    parsed_record.normalized = {
        "skills": [{"name": "Python"}]
    }
    applicant.parsed_record = parsed_record

    job = MockJob(
        id=1,
        title="Django Developer",
        required_skills=[{"name": "Python"}, {"name": "React"}]
    )

    breakdown = {"skills_score": 0.5}

    # Force the single LLM attempt to return None
    with patch("resume_pipeline.recommendation.explainer._try_opencode_once", return_value=None):
        analysis = generate_employer_match_analysis(applicant, job, breakdown)

        assert analysis["source"] == "offline_fallback"
        assert "React" in analysis["gaps"]
        assert "reasons" in analysis


@patch("resume_pipeline.recommendation.ranking.Embedder")
@patch("resume_pipeline.recommendation.ranking.get_tfidf_scorer")
@patch("resume_pipeline.recommendation.ranking.RankingContext")
@patch("resume_pipeline.recommendation.ranking.score_pair")
def test_ensure_recommendation_saves_fallback_flags(
    mock_score_pair, mock_ranking_ctx, mock_tfidf, mock_embedder
):
    """Verify ensure_applicant_job_recommendation saves is_fallback and fallback_source in DB on failures."""
    mock_db = MagicMock()
    
    applicant = MagicMock(spec=Applicant)
    applicant.id = 12
    parsed_record = MagicMock(spec=LLMParsedRecord)
    parsed_record.normalized = {"skills": [{"name": "Python"}]}
    applicant.parsed_record = parsed_record
    
    job = MockJob(id=15, title="Django Developer", required_skills=[{"name": "Python"}])

    # Setup query mocks
    mock_db.query.return_value.filter.return_value.first.side_effect = [
        None,  # First query for existing rec
        applicant,  # Second query for applicant
        job  # Third query for job
    ]
    mock_db.query.return_value.filter.return_value.all.return_value = [job]

    # Setup pipeline output
    mock_score_pair.return_value = {"final_score": 0.8}

    # Inject LLM mock failure for generate_explanation & generate_employer_match_analysis
    with patch("resume_pipeline.recommendation.ranking.generate_explanation", return_value=("mock fallback explanation", "offline_fallback")), \
         patch("resume_pipeline.recommendation.ranking.generate_employer_match_analysis", return_value={"reasons": "r", "gaps": "g", "source": "offline_fallback"}):
             
        rec = ensure_applicant_job_recommendation(12, 15, mock_db)
        
        assert rec is not None
        assert rec.is_fallback is True
        assert "explainer" in rec.fallback_source
        assert "employer_analysis" in rec.fallback_source
        mock_db.add.assert_called_once_with(rec)
        mock_db.commit.assert_called_once()


def test_embedding_failure_falls_back_to_tfidf():
    """Verify that a local embedding failure degrades gracefully to TF-IDF.

    The offline Embedder raises GeminiEmbeddingUnavailable (legacy name, kept
    for the ranking.py fallback branch) only when the local model itself
    fails. The engine must still rank via TF-IDF with the fallback flag set.
    """
    from resume_pipeline.recommendation.embedder import Embedder, GeminiEmbeddingUnavailable

    from resume_pipeline.recommendation.engine import run_pipeline_for_applicant_job
    from resume_pipeline.recommendation.scorers.tfidf_scorer import TfidfScorer
    from resume_pipeline.recommendation.scorers.semantic_scorer import SemanticScorer
    from resume_pipeline.recommendation.scorers.personalization_scorer import PersonalizationScorer
    from resume_pipeline.recommendation.scorers.temporal_scorer import TemporalScorer
    from resume_pipeline.recommendation.scorers.document_scorer import DocumentScorer

    mock_db = MagicMock()
    # Configure mock_db for cache misses (no stored vectors anywhere).
    mock_query = mock_db.query.return_value
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.first.return_value = None

    embedder = Embedder(mock_db)
    assert embedder.db is mock_db
    # Fully offline: no API client, no key, no limiter attributes.
    assert not hasattr(embedder, "client")

    applicant = MagicMock(spec=Applicant)
    applicant.id = 12
    parsed_record = MagicMock(spec=LLMParsedRecord)
    parsed_record.normalized = {
        "skills": [{"name": "Python"}],
        "experience": [],
        "education": []
    }
    applicant.parsed_record = parsed_record

    job = MockJob(id=15, title="Django Developer", required_skills=[{"name": "Python"}], location_city="Kolkata")

    # Mocks for scorers
    tfidf_scorer = MagicMock(spec=TfidfScorer)
    tfidf_scorer.score.return_value = 0.8

    semantic_scorer = SemanticScorer(embedder)
    document_scorer = DocumentScorer(embedder)

    personalization_scorer = MagicMock(spec=PersonalizationScorer)
    personalization_scorer.get_multiplier.return_value = 1.0

    temporal_scorer = MagicMock(spec=TemporalScorer)
    temporal_scorer.opportunity_multiplier.return_value = 1.0

    # Simulate a broken local model: every embed raises.
    with patch.object(Embedder, "embed", side_effect=GeminiEmbeddingUnavailable("model broken")):
        breakdown = run_pipeline_for_applicant_job(
            applicant=applicant,
            job=job,
            db=mock_db,
            tfidf_scorer=tfidf_scorer,
            embedder=embedder,
            semantic_scorer=semantic_scorer,
            personalization_scorer=personalization_scorer,
            temporal_scorer=temporal_scorer,
            document_scorer=document_scorer
        )

    assert breakdown["embedding_fallback"] is True
    assert "model broken" in breakdown["embedding_fallback_reason"]

