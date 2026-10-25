import hashlib
import json
import logging
import math
import threading
from typing import Optional

import numpy as np

from sqlalchemy.orm import Session
from ..core.minilm_onnx import EMBEDDING_DIM, MODEL_NAME, get_encoder
from ..db import JobEmbeddingsCache, ApplicantEmbedding

logger = logging.getLogger(__name__)

# Shared local ONNX MiniLM encoder (core/minilm_onnx.py). Emits 384-dim vectors.
# Previously this module wrapped the Gemini embedding API (1536-dim); cached
# rows from that era are treated as stale misses (see _is_fresh) and re-embedded.
EMBEDDING_MODEL_NAME = MODEL_NAME
EMBEDDING_PROVIDER = "local"


class GeminiEmbeddingUnavailable(Exception):
    """Raised when the local embedding model fails.

    Name kept so the scorers, ranking.py's TF-IDF fallback branch, tests, and
    golden fixtures keep working unchanged. No network is involved anymore —
    this only fires on empty input or local model load/encode failures.
    """


# Canonical alias for new code; ranking.py keeps catching the legacy name.
EmbeddingUnavailable = GeminiEmbeddingUnavailable


# ---------------------------------------------------------------------------
# Lazy singleton encoder — import + weights load once, on first embed() call.
# Keeps startup and non-ranking paths fast.
# ---------------------------------------------------------------------------
_model = None
_model_lock = threading.Lock()


def _get_model():
    """Load (once) and return the shared ONNX MiniLM encoder."""
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        try:
            _model = get_encoder()
        except Exception as e:
            raise GeminiEmbeddingUnavailable(
                f"Failed to load local embedding model '{EMBEDDING_MODEL_NAME}': {e}"
            ) from e
        logger.info("Loaded local embedding model: %s (ONNX Runtime)", EMBEDDING_MODEL_NAME)
        return _model


def _is_fresh(vector) -> bool:
    """A cached vector is usable only if it matches the local model dim.

    Legacy Gemini rows are 1536-dim; they are ignored (re-embedded) rather
    than compared, since cross-model cosine similarity is meaningless.
    """
    return vector is not None and len(vector) == EMBEDDING_DIM


def coerce_embedding_vector(value) -> Optional[list[float]]:
    """Coerce a stored embedding to ``list[float]``; ``None`` when unusable.

    Tolerates every shape the embedding columns have held across backends:
      - ``list`` / ``tuple`` of numbers (JSON columns, legacy rows)
      - ``numpy.ndarray`` (pgvector read path)
      - pgvector ``Vector`` objects (``to_list()`` protocol)
      - ``str`` / ``bytes`` — vector text ``'[0.1,0.2]'`` or JSON text
      - ``None`` → ``None``

    Non-finite entries (NaN/inf) are dropped-column-safe: the whole value is
    rejected, since a single NaN poisons every cosine comparison.
    """
    if value is None:
        return None
    if isinstance(value, np.ndarray):
        value = value.ravel().tolist()
    elif hasattr(value, "to_list") and not isinstance(value, (list, tuple, str, bytes)):
        try:
            value = value.to_list()
        except Exception:
            return None
    elif isinstance(value, (bytes, bytearray, memoryview)):
        try:
            value = bytes(value).decode("utf-8")
        except Exception:
            return None
    if isinstance(value, str):
        text = value.strip().strip("'\"")
        if not text:
            return None
        try:
            parsed = json.loads(text)
            value = parsed
        except Exception:
            stripped = text.strip("[]()")
            if not stripped.strip():
                return None
            try:
                value = [float(part) for part in stripped.split(",") if part.strip()]
            except (TypeError, ValueError):
                return None
    if isinstance(value, (list, tuple)):
        try:
            floats = [float(x) for x in value]
        except (TypeError, ValueError):
            return None
        if not floats or any(not math.isfinite(x) for x in floats):
            return None
        return floats
    return None


class Embedder:
    """Generate and cache text embeddings with the shared ONNX MiniLM encoder.

    Fully offline: no API keys, no rate limiter, no network calls.

    Caching strategy (unchanged interface, same pgvector path):
    - Job embeddings   → job_embeddings_cache table (keyed by job_id)
    - Applicant embed  → applicant_embeddings table (keyed by source_hash of text)
      Two variants per applicant are stored:
        suffix=''       → full resume/document embedding
        suffix='_skills'→ skills-only text embedding
    """

    def __init__(self, db: Session):
        self.db = db
        self._applicant_cache = {}
        self._job_cache = {}

    def embed(self, text: str, instruction: str | None = None) -> list[float]:
        """Generate a 384-dim embedding vector locally.

        `instruction` is accepted (callers pass asymmetric retrieval prefixes)
        and prepended to the text exactly as before, preserving cache semantics.
        """
        clean = (text or "").strip()
        if not clean:
            raise GeminiEmbeddingUnavailable("Cannot embed empty text")

        prompt = f"{instruction.strip()} {clean}" if instruction else clean

        model = _get_model()
        try:
            vector = model.encode(prompt)
        except Exception as e:
            logger.error(f"Local embedding encode failed: {e}", exc_info=True)
            raise GeminiEmbeddingUnavailable(f"Local embedding failure: {str(e)}") from e
        values = [float(x) for x in np.asarray(vector, dtype=float).ravel()]
        if len(values) != EMBEDDING_DIM:
            raise GeminiEmbeddingUnavailable(
                f"Unexpected embedding dimension: got {len(values)}, expected {EMBEDDING_DIM}"
            )
        return values

    # ------------------------------------------------------------------
    # Job embedding cache (existing, unchanged interface)
    # ------------------------------------------------------------------

    def get_job_embedding(self, job_id: int, payload_builder_fn, job) -> list[float]:
        """Fetch job embedding from DB cache, or compute and cache if missing."""
        payload = payload_builder_fn(job)
        source_hash = self._source_hash(payload)

        # 1. Check local in-memory cache
        cache_key = (job_id, source_hash)
        if cache_key in self._job_cache:
            return self._job_cache[cache_key]

        # 2. Check DB cache using composite key
        cached = (
            self.db.query(JobEmbeddingsCache)
            .filter(
                JobEmbeddingsCache.job_id == job_id,
                JobEmbeddingsCache.source_hash == source_hash
            )
            .first()
        )
        if cached is not None and cached.embedding is not None:
            vector = coerce_embedding_vector(cached.embedding)
            if vector is not None and _is_fresh(vector):
                self._job_cache[cache_key] = vector
                return vector
            logger.info(
                f"Ignoring stale job embedding (dim={len(vector) if vector else 'unreadable'}, want {EMBEDDING_DIM}) "
                f"for job_id={job_id} — re-embedding locally"
            )

        # 3. Compute and cache embedding
        instruction = "Represent this job posting for candidate matching:"
        vector = self.embed(payload, instruction=instruction)

        try:
            cache_entry = JobEmbeddingsCache(job_id=job_id, source_hash=source_hash, embedding=vector)
            self.db.merge(cache_entry)
            self.db.commit()
            logger.info(f"Cached job embedding in DB for job_id={job_id}")
        except Exception as e:
            logger.error(f"Failed to cache job embedding in DB for job_id={job_id}: {e}")
            self.db.rollback()

        self._job_cache[cache_key] = vector
        return vector

    # ------------------------------------------------------------------
    # Applicant embedding cache
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
            list[float] — 384-dimensional embedding vector.

        Raises:
            GeminiEmbeddingUnavailable if the local model fails AND no cached vector exists.
        """
        source_hash = self._source_hash(text, suffix)

        # 1. Check local in-memory cache
        cache_key = (applicant.id, source_hash)
        if cache_key in self._applicant_cache:
            return self._applicant_cache[cache_key]

        # 2. Check DB cache — match by applicant_id AND source_hash
        existing = (
            self.db.query(ApplicantEmbedding)
            .filter(
                ApplicantEmbedding.applicant_id == applicant.id,
                ApplicantEmbedding.source_hash == source_hash,
            )
            .first()
        )
        if existing is not None and existing.embedding_vector is not None:
            vector = coerce_embedding_vector(existing.embedding_vector)
            if vector is not None and _is_fresh(vector):
                logger.debug(
                    f"Applicant embedding cache HIT for applicant_id={applicant.id} suffix='{suffix}'"
                )
                self._applicant_cache[cache_key] = vector
                return vector
            logger.info(
                f"Ignoring stale applicant embedding (dim={len(vector) if vector else 'unreadable'}, want {EMBEDDING_DIM}) "
                f"for applicant_id={applicant.id} suffix='{suffix}' — re-embedding locally"
            )

        logger.info(
            f"Applicant embedding cache MISS for applicant_id={applicant.id} suffix='{suffix}' "
            "— embedding locally"
        )

        # 3. Cache miss: generate locally
        vector = self.embed(text, instruction=instruction)

        # 4. Persist — use applicant_id + suffix as composite logical key
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
                embedding_provider=EMBEDDING_PROVIDER,
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

        self._applicant_cache[cache_key] = vector
        return vector

    def get_cached_applicant_embedding_raw(self, applicant_id: int) -> list[float] | None:
        """Fetch any existing applicant embedding from DB without computing.

        Returns None if no cached embedding exists or if the cached vector is
        stale (wrong dimensionality from the legacy Gemini era).
        """
        row = (
            self.db.query(ApplicantEmbedding)
            .filter(ApplicantEmbedding.applicant_id == applicant_id)
            .order_by(ApplicantEmbedding.updated_at.desc())
            .first()
        )
        if row and row.embedding_vector is not None:
            vector = coerce_embedding_vector(row.embedding_vector)
            if vector is not None and _is_fresh(vector):
                return vector
        return None

    # ------------------------------------------------------------------
    # Similarity utilities
    # ------------------------------------------------------------------

    @staticmethod
    def cosine_similarity(v1: list[float], v2: list[float]) -> float:
        """Compute cosine similarity between two float vectors."""
        try:
            arr1 = np.array(v1, dtype=float)
            arr2 = np.array(v2, dtype=float)
            if arr1.shape != arr2.shape:
                return 0.0
            dot = np.dot(arr1, arr2)
            norm1 = np.linalg.norm(arr1)
            norm2 = np.linalg.norm(arr2)
            if norm1 == 0.0 or norm2 == 0.0:
                return 0.0
            return float(dot / (norm1 * norm2))
        except Exception:
            return 0.0
