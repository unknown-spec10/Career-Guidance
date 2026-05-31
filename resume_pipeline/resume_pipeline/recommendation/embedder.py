import logging
import numpy as np
from google import genai
from sqlalchemy.orm import Session
from ..config import settings
from ..db import JobEmbeddingsCache

logger = logging.getLogger(__name__)


class GeminiEmbeddingUnavailable(Exception):
    """Exception raised when the Gemini embedding API fails."""
    pass


class Embedder:
    """Helper to generate and cache text embeddings using Google Gemini API."""

    def __init__(self, db: Session):
        self.db = db
        # Use settings.GEMINI_API_KEY
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            logger.warning("GEMINI_API_KEY is empty in settings.")
        self.client = genai.Client(api_key=api_key) if api_key else None

    def embed(self, text: str, instruction: str | None = None) -> list[float]:
        """Generate embedding vector for text using gemini-embedding-2-preview.
        
        Since gemini-embedding-2-preview does not support task_type parameter directly,
        asymmetric retrieval is handled by prefixing the instruction prompt.
        """
        if not self.client:
            raise GeminiEmbeddingUnavailable("GenAI client is not initialized (missing API key)")

        prompt = text
        if instruction:
            prompt = f"{instruction.strip()} {text}"

        try:
            # gemini-embedding-2-preview maps text to a 768, 1536, or 3072 dimensional space.
            # google-genai default is standard output dimensions (768).
            result = self.client.models.embed_content(
                model=settings.EMBEDDING_MODEL or "gemini-embedding-2-preview",
                contents=prompt
            )
            if not result.embeddings or not result.embeddings[0].values:
                raise GeminiEmbeddingUnavailable("Empty embeddings returned from GenAI SDK")
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"Gemini embedding API call failed: {e}", exc_info=True)
            raise GeminiEmbeddingUnavailable(f"Gemini API failure: {str(e)}") from e

    def get_job_embedding(self, job_id: int, payload_builder_fn, job) -> list[float]:
        """Fetch job embedding from database cache, or compute and cache it if missing."""
        # 1. Check DB Cache
        cached = self.db.query(JobEmbeddingsCache).filter(JobEmbeddingsCache.job_id == job_id).first()
        if cached and cached.embedding:
            return cached.embedding

        # 2. Cache Miss: Compute payload
        payload = payload_builder_fn(job)
        # Asymmetric instruction prefix for job descriptions
        instruction = "Represent this job posting for candidate matching:"
        vector = self.embed(payload, instruction=instruction)

        # 3. Store in DB Cache
        try:
            cache_entry = JobEmbeddingsCache(job_id=job_id, embedding=vector)
            self.db.merge(cache_entry)
            self.db.commit()
            logger.info(f"Cached job embedding in DB for job_id={job_id}")
        except Exception as e:
            logger.error(f"Failed to cache job embedding in DB for job_id={job_id}: {e}")
            self.db.rollback()

        return vector

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
