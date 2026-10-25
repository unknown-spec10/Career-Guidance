"""Tests for the offline local embedder (all-MiniLM-L6-v2).

Covers: vector shape/provider, determinism, empty-input error, semantic
signal vs unrelated text, legacy 1536-dim cache invalidation, in-memory
cache reuse, dim-mismatch cosine guard, precompute wiring, and end-to-end
ranking without the TF-IDF fallback flag.
"""
import sys
import os
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import Applicant, JobEmbedding  # noqa: E402
from resume_pipeline.db import ApplicantEmbedding, LLMParsedRecord  # noqa: E402
from resume_pipeline.recommendation.embedder import (  # noqa: E402
    EMBEDDING_DIM,
    Embedder,
    GeminiEmbeddingUnavailable,
    coerce_embedding_vector,
)


def make_mock_db():
    """Mock DB whose cache/interview lookups all miss."""
    mock_db = MagicMock()
    q = mock_db.query.return_value
    q.filter.return_value = q
    q.order_by.return_value = q
    q.first.return_value = None
    q.all.return_value = []
    return mock_db


def test_embed_returns_384_dim_local_vectors():
    embedder = Embedder(make_mock_db())
    # Fully offline: no API client attribute at all.
    assert not hasattr(embedder, "client")
    vec = embedder.embed("Python, Django, PostgreSQL")
    assert len(vec) == EMBEDDING_DIM == 384
    assert all(isinstance(x, float) for x in vec)


def test_embed_is_deterministic():
    embedder = Embedder(make_mock_db())
    assert embedder.embed("hello world") == embedder.embed("hello world")


def test_embed_empty_raises():
    embedder = Embedder(make_mock_db())
    with pytest.raises(GeminiEmbeddingUnavailable):
        embedder.embed("   ")


def test_embed_semantic_signal_beats_unrelated():
    embedder = Embedder(make_mock_db())
    match = Embedder.cosine_similarity(
        embedder.embed("Python, Django, PostgreSQL"),
        embedder.embed("Python Backend Developer with Django and PostgreSQL"),
    )
    unrelated = Embedder.cosine_similarity(
        embedder.embed("Python, Django, PostgreSQL"),
        embedder.embed("AWS Docker Kubernetes pipelines"),
    )
    assert match > 0.7
    assert unrelated < 0.3
    assert match - unrelated > 0.5


def test_cosine_similarity_dim_mismatch_is_zero():
    assert Embedder.cosine_similarity([1.0] * 384, [1.0] * 1536) == 0.0
    assert Embedder.cosine_similarity([0.0] * 384, [0.0] * 384) == 0.0


def test_legacy_1536_dim_cache_treated_as_miss():
    """A stale Gemini-era 1536-dim row must be ignored and replaced locally."""
    legacy_row = ApplicantEmbedding(
        applicant_id=7,
        embedding_vector=[0.1] * 1536,
        embedding_provider="gemini",
        embedding_model="_skills",
        source_hash="placeholder",  # replaced below with the real hash
    )
    mock_db = make_mock_db()
    q = mock_db.query.return_value
    applicant = MagicMock(spec=Applicant)
    applicant.id = 7

    text = "Python, Django"
    source_hash = Embedder._source_hash(text, "_skills")
    legacy_row.source_hash = source_hash
    # First .first() call (source_hash lookup) hits the legacy row;
    # second .first() call (stale model lookup) misses.
    q.first.side_effect = [legacy_row, None]

    embedder = Embedder(mock_db)
    vector = embedder.get_applicant_embedding(
        applicant=applicant, text=text, suffix="_skills"
    )
    assert len(vector) == 384
    persisted = mock_db.add.call_args[0][0]
    assert isinstance(persisted, ApplicantEmbedding)
    assert persisted.embedding_provider == "local"
    # Row key stays the applicant suffix (unique-constraint compatible).
    assert persisted.embedding_model == "_skills"
    assert len(persisted.embedding_vector) == 384


def test_coerce_embedding_vector_tolerates_stored_shapes():
    """Regression: stored embeddings come back in several shapes per backend.

    Pre-pgvector production rows are JSON lists; pgvector reads yield
    ndarrays. The loader must accept list / tuple / ndarray / vector-text /
    pgvector Vector without raising (production crashed with
    "'list' object has no attribute 'split'"), and reject garbage/NaN.
    """
    import numpy as np

    assert coerce_embedding_vector([0.1, 0.2]) == [0.1, 0.2]
    assert coerce_embedding_vector((0.1, 0.2)) == [0.1, 0.2]
    assert coerce_embedding_vector(np.array([0.1, 0.2])) == pytest.approx([0.1, 0.2])
    assert coerce_embedding_vector("[0.1, 0.2]") == pytest.approx([0.1, 0.2])
    assert coerce_embedding_vector(None) is None
    assert coerce_embedding_vector("") is None
    assert coerce_embedding_vector("not a vector") is None
    assert coerce_embedding_vector([float("nan"), 0.1]) is None


def test_tolerant_vector_processor_reads_json_lists():
    """ORM layer must not crash on legacy JSON-stored embedding lists."""
    from resume_pipeline.db import _vector_column

    proc = _vector_column().type.result_processor("default", None)
    assert proc([0.1, 0.2]) == [0.1, 0.2]


def test_job_embedding_in_memory_cache_reuses_vector():
    mock_db = make_mock_db()
    embedder = Embedder(mock_db)

    class FakeJob:
        id = 42
        required_skills = [{"name": "Python"}]

    job = FakeJob()
    first = embedder.get_job_embedding(job.id, lambda j: "Python", job)
    # Point the DB at a legacy row AFTER the first call: a cache hit must win
    # and the stale row must never be touched.
    q = mock_db.query.return_value
    q.first.side_effect = AssertionError("DB must not be hit on in-memory cache hit")
    second = embedder.get_job_embedding(job.id, lambda j: "Python", job)
    assert first == second
    assert mock_db.merge.call_count == 1


def test_precompute_wires_local_model():
    """ensure_*_embeddings persist 384-dim local vectors (parse/posting time)."""
    from resume_pipeline.recommendation.precompute import (
        ensure_applicant_embeddings,
        ensure_job_embeddings,
    )

    applicant = MagicMock(spec=Applicant)
    applicant.id = 11
    applicant.parsed_record = MagicMock(spec=LLMParsedRecord)
    applicant.parsed_record.normalized = {
        "personal": {"name": "Test User", "location": "Delhi, Delhi"},
        "skills": [{"name": "Python"}, {"name": "Django"}],
        "experience": [{"role": "Intern", "company": "Acme", "description": "Built APIs"}],
        "education": [{"degree": "B.Tech", "field": "CSE"}],
    }
    status = ensure_applicant_embeddings(applicant, make_mock_db())
    assert status == {"skills": "updated", "document": "updated"}

    class FakeJob:
        id = 99
        title = "Python Developer"
        description = "Build APIs"
        required_skills = [{"name": "Python"}]

    status = ensure_job_embeddings(FakeJob(), make_mock_db())
    assert status == {"skills": "updated", "document": "updated"}


def test_ranking_uses_local_model_without_fallback():
    """End-to-end score_pair with the real local Embedder: no TF-IDF fallback."""
    from resume_pipeline.recommendation.ranking import RankingContext, score_pair
    from resume_pipeline.recommendation.scorers.document_scorer import DocumentScorer
    from resume_pipeline.recommendation.scorers.personalization_scorer import (
        PersonalizationScorer,
    )
    from resume_pipeline.recommendation.scorers.semantic_scorer import SemanticScorer
    from resume_pipeline.recommendation.scorers.temporal_scorer import TemporalScorer

    mock_db = make_mock_db()
    applicant = MagicMock(spec=Applicant)
    applicant.id = 21
    applicant.display_name = "Jane"
    applicant.location_city = "Bengaluru"
    applicant.location_state = "Karnataka"
    applicant.parsed_record = MagicMock(spec=LLMParsedRecord)
    applicant.parsed_record.normalized = {
        "personal": {"name": "Jane", "location": "Bengaluru, Karnataka"},
        "skills": [{"name": "Python"}, {"name": "Django"}],
        "experience": [{"title": "Backend Intern"}],
        "education": [{"degree": "B.Tech", "field": "CSE", "cgpa": 8.5}],
    }

    class FakeJob:
        id = 5
        title = "Python Backend Developer"
        description = "Build REST APIs with Python Django PostgreSQL"
        required_skills = [{"name": "Python"}, {"name": "Django"}]
        location_city = "Bengaluru"
        location_state = "Karnataka"
        work_type = "on-site"
        min_experience_years = 0.0
        meta = MagicMock()

    ctx = RankingContext.__new__(RankingContext)
    ctx.db = mock_db
    ctx.embedder = Embedder(mock_db)
    ctx.semantic_scorer = SemanticScorer(ctx.embedder)
    ctx.personalization_scorer = PersonalizationScorer(mock_db)
    ctx.personalization_scorer.preload_preferences = MagicMock()
    ctx.temporal_scorer = TemporalScorer()
    ctx.document_scorer = DocumentScorer(ctx.embedder)

    with patch.object(
        PersonalizationScorer, "get_multiplier", return_value=1.0
    ), patch.object(TemporalScorer, "opportunity_multiplier", return_value=1.0):
        breakdown = score_pair(applicant, FakeJob(), mock_db, ctx, 0.8, None)

    assert breakdown["embedding_fallback"] is False
    assert breakdown["semantic_skill_score"] is not None
    assert breakdown["semantic_skill_score"] > 0.5
    assert breakdown["doc_similarity"] is not None
