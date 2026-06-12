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

    # Force both LLM attempts to return None (simulating API failure/rate-limit)
    with patch("resume_pipeline.recommendation.explainer._try_gemini_once", return_value=None), \
         patch("resume_pipeline.recommendation.explainer._try_groq_once", return_value=None):
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

    # Force both LLM attempts to return None
    with patch("resume_pipeline.recommendation.explainer._try_gemini_once", return_value=None), \
         patch("resume_pipeline.recommendation.explainer._try_groq_once", return_value=None):
        analysis = generate_employer_match_analysis(applicant, job, breakdown)

        assert analysis["source"] == "offline_fallback"
        assert "React" in analysis["gaps"]
        assert "reasons" in analysis


@patch("resume_pipeline.recommendation.engine.Embedder")
@patch("resume_pipeline.recommendation.engine.get_tfidf_scorer")
@patch("resume_pipeline.recommendation.engine.SemanticScorer")
@patch("resume_pipeline.recommendation.engine.PersonalizationScorer")
@patch("resume_pipeline.recommendation.engine.TemporalScorer")
@patch("resume_pipeline.recommendation.engine.DocumentScorer")
@patch("resume_pipeline.recommendation.engine.run_pipeline_for_applicant_job")
def test_ensure_recommendation_saves_fallback_flags(
    mock_run_pipeline, mock_doc_scorer, mock_temp_scorer, mock_pers_scorer, mock_sem_scorer, mock_tfidf, mock_embedder
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
    mock_run_pipeline.return_value = {"final_score": 0.8}

    # Inject LLM mock failure for generate_explanation & generate_employer_match_analysis
    with patch("resume_pipeline.recommendation.engine.generate_explanation", return_value=("mock fallback explanation", "offline_fallback")), \
         patch("resume_pipeline.recommendation.engine.generate_employer_match_analysis", return_value={"reasons": "r", "gaps": "g", "source": "offline_fallback"}):
             
        rec = ensure_applicant_job_recommendation(12, 15, mock_db)
        
        assert rec is not None
        assert rec.is_fallback is True
        assert "explainer" in rec.fallback_source
        assert "employer_analysis" in rec.fallback_source
        mock_db.add.assert_called_once_with(rec)
        mock_db.commit.assert_called_once()


def test_embedding_circuit_breaker_and_fallback():
    """Verify that a single embedding API failure trips the circuit breaker,
    subsequent calls fail-fast immediately without invoking the API,
    and the recommendation engine successfully falls back to TF-IDF."""
    from resume_pipeline.recommendation.embedder import gemini_embedding_limiter, Embedder, GeminiEmbeddingUnavailable

    from resume_pipeline.recommendation.engine import run_pipeline_for_applicant_job
    from resume_pipeline.recommendation.scorers.tfidf_scorer import TfidfScorer
    from resume_pipeline.recommendation.scorers.semantic_scorer import SemanticScorer
    from resume_pipeline.recommendation.scorers.personalization_scorer import PersonalizationScorer
    from resume_pipeline.recommendation.scorers.temporal_scorer import TemporalScorer
    from resume_pipeline.recommendation.scorers.document_scorer import DocumentScorer
    from resume_pipeline.core.rate_limiter import STATE_CLOSED, STATE_OPEN

    # 1. Reset rate limiter / circuit breaker to CLOSED state
    gemini_embedding_limiter.state = STATE_CLOSED
    gemini_embedding_limiter.trial_in_progress = False
    gemini_embedding_limiter.trial_start_time = 0.0
    gemini_embedding_limiter._last_call_time = 0.0

    mock_db = MagicMock()
    # Configure mock_db to return None for cache queries to force cache misses
    mock_query = mock_db.query.return_value
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = None

    
    # 2. Instantiate Embedder and Mock client/settings
    with patch("resume_pipeline.recommendation.embedder.settings") as mock_settings:
        mock_settings.GEMINI_API_KEY = "dummy_key"
        mock_settings.EMBEDDING_MODEL = "gemini-embedding-2-preview"
        
        embedder = Embedder(mock_db)
        # Mock API client to fail
        embedder.client = MagicMock()
        embedder.client.models.embed_content.side_effect = Exception("Google GenAI 429 Rate Limit Exceeded")

        # First call should try the API, fail, and trip the circuit breaker
        with pytest.raises(GeminiEmbeddingUnavailable) as exc_info:
            embedder.embed("test text")
        
        assert "Google GenAI 429 Rate Limit Exceeded" in str(exc_info.value)
        assert gemini_embedding_limiter.state == STATE_OPEN

        # Second call should fail-fast instantly without calling the client.models.embed_content API
        embedder.client.models.embed_content.reset_mock()
        with pytest.raises(GeminiEmbeddingUnavailable) as exc_info2:
            embedder.embed("another text")

        assert "on cooldown" in str(exc_info2.value)
        embedder.client.models.embed_content.assert_not_called()

        # Test engine fallback behavior while circuit breaker is open
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

        # Run pipeline. Since circuit breaker is open, it should immediately fall back to TF-IDF
        # and not call mock client at all.
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
        assert "on cooldown" in breakdown["embedding_fallback_reason"]
        
        # Double check that we didn't call the API client during engine run
        embedder.client.models.embed_content.assert_not_called()

        # Reset rate limiter after test to CLOSED state
        gemini_embedding_limiter.state = STATE_CLOSED

