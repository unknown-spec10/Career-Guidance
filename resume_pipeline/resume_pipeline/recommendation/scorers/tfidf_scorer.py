import logging
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

logger = logging.getLogger(__name__)


class TfidfScorer:
    """Tier 1: TF-IDF Weighted Skill Matching.
    
    Scores how important matched skills are in the job text compared to the general corpus of jobs.
    Always runs locally without external API dependencies.
    """

    def __init__(self):
        self.vectorizer = None
        self.tfidf_matrix = None
        self.job_id_to_index = {}
        self.feature_names = []

    def build_corpus(self, jobs: list) -> None:
        """Construct the corpus TF-IDF representation across all approved jobs."""
        if not jobs:
            logger.warning("No jobs available to build TF-IDF corpus.")
            return

        documents = []
        self.job_id_to_index = {}

        for idx, job in enumerate(jobs):
            self.job_id_to_index[job.id] = idx

            # Collect required and optional skills
            req_skills = []
            for s in job.required_skills or []:
                name = s.get("name", "") if isinstance(s, dict) else str(s)
                if name:
                    req_skills.append(name)

            opt_skills = []
            for s in getattr(job, "optional_skills", None) or []:
                name = s.get("name", "") if isinstance(s, dict) else str(s)
                if name:
                    opt_skills.append(name)

            skills_text = " ".join(req_skills + opt_skills)
            doc_content = f"{job.title or ''} {job.description or ''} {skills_text}"
            documents.append(doc_content.lower())

        try:
            self.vectorizer = TfidfVectorizer(stop_words="english")
            self.tfidf_matrix = self.vectorizer.fit_transform(documents).toarray()
            self.feature_names = self.vectorizer.get_feature_names_out()
            logger.info(f"Built TF-IDF corpus: {len(jobs)} jobs, {len(self.feature_names)} features.")
        except Exception as e:
            logger.error(f"Failed to build TF-IDF corpus: {e}", exc_info=True)
            self.vectorizer = None
            self.tfidf_matrix = None

    def score(self, user_skills: list, job_id: int) -> float:
        """Calculate the TF-IDF matching score between user skills and a specific job."""
        if not self.vectorizer or self.tfidf_matrix is None or job_id not in self.job_id_to_index:
            return 0.0

        job_idx = self.job_id_to_index[job_id]
        job_vector = self.tfidf_matrix[job_idx]

        # Extract words from user skills list
        user_tokens = set()
        for skill in user_skills:
            name = skill.get("name", "") if isinstance(skill, dict) else str(skill)
            if name:
                tokens = re.findall(r"\b\w+\b", name.lower())
                user_tokens.update(tokens)

        if not user_tokens:
            return 0.0

        matched_weight = 0.0
        vocab = self.vectorizer.vocabulary_
        for token in user_tokens:
            if token in vocab:
                token_idx = vocab[token]
                matched_weight += job_vector[token_idx]

        # Normalize relative to total TF-IDF weight of the job document
        total_job_weight = float(np.sum(job_vector))
        if total_job_weight == 0.0:
            return 0.0

        score = matched_weight / total_job_weight
        return min(1.0, max(0.0, float(score)))
