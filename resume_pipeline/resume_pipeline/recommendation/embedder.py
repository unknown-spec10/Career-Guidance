import hashlib
import logging
import numpy as np
from google import genai
from sqlalchemy.orm import Session
from ..config import settings
from ..db import JobEmbeddingsCache, ApplicantEmbedding
from ..core.rate_limiter import gemini_embedding_limiter

logger = logging.getLogger(__name__)

# Gemini text-embedding-004 / gemini-embedding-2-preview outputs 3072-dim vectors.
EMBEDDING_DIM = 3072


class GeminiEmbeddingUnavailable(Exception):
    """Exception raised when the Gemini embedding API fails."""
    pass


class Embedder:
    """Helper to generate and cache text embeddings using Google Gemini API.

    Caching strategy:
    - Job embeddings   → job_embeddings_cache table (keyed by job_id)
    - Applicant embed  → applicant_embeddings table (keyed by source_hash of text)
      Two variants per applicant are stored:
        suffix=''       → full resume/document embedding
        suffix='_skills'→ skills-only text embedding
    """

    def __init__(self, db: Session):
        self.db = db
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("GEMINI_API_KEY is empty in settings.")
        self.client = genai.Client(api_key=api_key) if api_key else None

    def embed(self, text: str, instruction: str | None = None) -> list[float]:
        """Generate a 3072-dim embedding vector via Gemini.

        Explicitly pins output_dimensionality=3072 to guarantee consistency with
        the vector(3072) DB columns regardless of API default changes.
        """
        # 1. Circuit breaker check to fail fast and prevent hammering the API on failures
        if not gemini_embedding_limiter.allow_call():
            logger.warning(
                "Gemini Embedding API is currently on cooldown due to previous rate limits or errors. "
                "Failing fast without making network call."
            )
            raise GeminiEmbeddingUnavailable(
                "Gemini Embedding API is on cooldown due to previous rate limits or errors."
            )

        if not self.client:
            raise GeminiEmbeddingUnavailable("GenAI client is not initialized (missing API key)")

        prompt = text
        if instruction:
            prompt = f"{instruction.strip()} {text}"

        # 2. Acquire slot to respect RPM/TPM limits
        gemini_embedding_limiter.acquire_sync()

        try:
            result = self.client.models.embed_content(
                model=settings.EMBEDDING_MODEL or "gemini-embedding-2-preview",
                contents=prompt,
                config={"output_dimensionality": EMBEDDING_DIM},
            )
            if not result.embeddings or not result.embeddings[0].values:
                raise GeminiEmbeddingUnavailable("Empty embeddings returned from GenAI SDK")
            values = result.embeddings[0].values
            if len(values) != EMBEDDING_DIM:
                logger.warning(
                    f"Unexpected embedding dimension: got {len(values)}, expected {EMBEDDING_DIM}. "
                    "Check EMBEDDING_MODEL setting."
                )
            
            # Reset rate limiter/circuit breaker on successful API response
            gemini_embedding_limiter.report_success()
            return list(values)
        except Exception as e:
            # Trip circuit breaker immediately on any failure
            gemini_embedding_limiter.report_failure()
            logger.error(f"Gemini embedding API call failed: {e}", exc_info=True)
            raise GeminiEmbeddingUnavailable(f"Gemini API failure: {str(e)}") from e


    # ------------------------------------------------------------------
    # Job embedding cache (existing, unchanged interface)
    # ------------------------------------------------------------------

    def get_job_embedding(self, job_id: int, payload_builder_fn, job) -> list[float]:
        """Fetch job embedding from DB cache, or compute and cache if missing."""
        cached = self.db.query(JobEmbeddingsCache).filter(JobEmbeddingsCache.job_id == job_id).first()
        if cached and cached.embedding is not None:
            emb = cached.embedding
            # pgvector returns the vector as a list natively; handle JSON list too
            return list(emb) if not isinstance(emb, list) else emb

        payload = payload_builder_fn(job)
        instruction = "Represent this job posting for candidate matching:"
        vector = self.embed(payload, instruction=instruction)

        try:
            cache_entry = JobEmbeddingsCache(job_id=job_id, embedding=vector)
            self.db.merge(cache_entry)
            self.db.commit()
            logger.info(f"Cached job embedding in DB for job_id={job_id}")
        except Exception as e:
            logger.error(f"Failed to cache job embedding in DB for job_id={job_id}: {e}")
            self.db.rollback()

        return vector

    # ------------------------------------------------------------------
    # Applicant embedding cache (NEW)
    # ------------------------------------------------------------------

    @staticmethod
    def _source_hash(text: str, suffix: str = "") -> str:
        """SHA-256 fingerprint of the text content + optional suffix tag."""
        raw = (text + suffix).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def get_applicant_embedding(
        self,
        applicant,
        text: str,
        suffix: str = "",
        instruction: str | None = None,
    ) -> list[float]:
        """Fetch applicant embedding from DB, or compute + persist if stale/missing.

        Args:
            applicant:   SQLAlchemy Applicant ORM object (needs .id).
            text:        The text to embed (resume summary or skills string).
            suffix:      Differentiates variants per applicant ('_skills', '', etc.).
            instruction: Optional asymmetric retrieval prefix for the embedding model.

        Returns:
            list[float] — 3072-dimensional embedding vector.

        Raises:
            GeminiEmbeddingUnavailable if the API fails AND no cached vector exists.
        """
        source_hash = self._source_hash(text, suffix)

        # 1. Check DB cache — match by applicant_id AND source_hash
        existing = (
            self.db.query(ApplicantEmbedding)
            .filter(
                ApplicantEmbedding.applicant_id == applicant.id,
                ApplicantEmbedding.source_hash == source_hash,
            )
            .first()
        )
        if existing and existing.embedding_vector is not None:
            emb = existing.embedding_vector
            logger.debug(
                f"Applicant embedding cache HIT for applicant_id={applicant.id} suffix='{suffix}'"
            )
            return list(emb) if not isinstance(emb, list) else emb

        logger.info(
            f"Applicant embedding cache MISS for applicant_id={applicant.id} suffix='{suffix}' "
            "— calling Gemini API"
        )

        # 2. Cache miss: generate via Gemini
        vector = self.embed(text, instruction=instruction)

        # 3. Persist — use applicant_id + suffix as composite logical key
        #    We store one row per (applicant_id, suffix) — upsert via delete+insert
        try:
            # Delete any stale row for this applicant + suffix combo
            stale = (
                self.db.query(ApplicantEmbedding)
                .filter(ApplicantEmbedding.applicant_id == applicant.id)
                .filter(ApplicantEmbedding.embedding_model == (suffix or "document"))
                .first()
            )
            if stale:
                self.db.delete(stale)
                self.db.flush()

            row = ApplicantEmbedding(
                applicant_id=applicant.id,
                embedding_vector=vector,
                embedding_provider="gemini",
                embedding_model=suffix or "document",
                source_hash=source_hash,
            )
            self.db.add(row)
            self.db.commit()
            logger.info(
                f"Persisted applicant embedding for applicant_id={applicant.id} suffix='{suffix}'"
            )
        except Exception as e:
            logger.error(
                f"Failed to persist applicant embedding for applicant_id={applicant.id}: {e}"
            )
            self.db.rollback()

        return vector

    def get_cached_applicant_embedding_raw(self, applicant_id: int) -> list[float] | None:
        """Fetch any existing applicant embedding from DB without triggering Gemini.

        Used by the offline fallback explainer which cannot make API calls.
        Returns None if no cached embedding exists.
        """
        row = (
            self.db.query(ApplicantEmbedding)
            .filter(ApplicantEmbedding.applicant_id == applicant_id)
            .order_by(ApplicantEmbedding.updated_at.desc())
            .first()
        )
        if row and row.embedding_vector is not None:
            emb = row.embedding_vector
            return list(emb) if not isinstance(emb, list) else emb
        return None

    # ------------------------------------------------------------------
    # Similarity utilities
    # ------------------------------------------------------------------

    @staticmethod
    def cosine_similarity(v1: list[float], v2: list[float]) -> float:
        """Compute cosine similarity between two float vectors."""
        arr1 = np.array(v1, dtype=float)
        arr2 = np.array(v2, dtype=float)
        dot = np.dot(arr1, arr2)
        norm1 = np.linalg.norm(arr1)
        norm2 = np.linalg.norm(arr2)
        if norm1 == 0.0 or norm2 == 0.0:
            return 0.0
        return float(dot / (norm1 * norm2))
