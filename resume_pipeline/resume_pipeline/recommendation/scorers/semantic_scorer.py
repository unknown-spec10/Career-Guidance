import logging
from ..embedder import Embedder

logger = logging.getLogger(__name__)


class SemanticScorer:
    """Tier 2: Semantic Skill Matching via Embeddings.
    
    Exposes cosine similarity matching between a user's skills and a job's required skills.
    Raises GeminiEmbeddingUnavailable if API fails, allowing engine.py to fallback to TF-IDF.
    """

    def __init__(self, embedder: Embedder):
        self.embedder = embedder

    def score(self, user_skills: list, job) -> float:
        """Score semantic overlap between user skills and job required skills."""
        user_skill_names = []
        for s in user_skills:
            name = s.get("name", "") if isinstance(s, dict) else str(s)
            if name:
                user_skill_names.append(name)

        if not user_skill_names:
            return 0.0

        # Build user skills payload with task instruction prefix
        user_skills_text = ", ".join(user_skill_names)
        instruction = "Represent this skill set for semantic similarity matching:"
        user_vector = self.embedder.embed(user_skills_text, instruction=instruction)

        # Helper payload builder for caching job skills
        def _build_job_skills_payload(j) -> str:
            job_skill_names = []
            for s in j.required_skills or []:
                name = s.get("name", "") if isinstance(s, dict) else str(s)
                if name:
                    job_skill_names.append(name)
            return ", ".join(job_skill_names)

        # Get or compute cached job embedding vector
        job_vector = self.embedder.get_job_embedding(job.id, _build_job_skills_payload, job)

        # Cosine similarity
        similarity = self.embedder.cosine_similarity(user_vector, job_vector)
        return min(1.0, max(0.0, float(similarity)))
