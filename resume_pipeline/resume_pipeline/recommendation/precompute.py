"""Embed-once precompute: warm stored vectors at write time, read at request time.

Job vectors are embedded at posting time, applicant vectors at parse time,
using the existing Embedder + pgvector path (JobEmbeddingsCache /
ApplicantEmbedding). Retrieval needs no vectors (TF-IDF only); ranking reads
the stored vectors through the same Embedder cache, so steady-state requests
are cache hits with zero network calls. Every helper is best-effort and
never raises — the pipeline degrades to TF-IDF fallback on any failure.
"""
import logging
from typing import Dict

from sqlalchemy.orm import Session

from ..db import Applicant, Job

logger = logging.getLogger(__name__)


def ensure_applicant_embeddings(applicant: Applicant, db: Session) -> Dict[str, str]:
    """Embed the applicant once (skills + document variants) at parse time."""
    from .embedder import Embedder
    from .scorers.document_scorer import DocumentScorer

    status: Dict[str, str] = {"skills": "skipped", "document": "skipped"}
    try:
        normalized = applicant.parsed_record.normalized if applicant.parsed_record else {}
        skill_names = []
        for s in normalized.get("skills", []):
            name = s.get("name", "") if isinstance(s, dict) else str(s)
            if name:
                skill_names.append(name)
        if not skill_names:
            return status

        embedder = Embedder(db)
        skills_text = ", ".join(skill_names)
        try:
            embedder.get_applicant_embedding(
                applicant=applicant,
                text=skills_text,
                suffix="_skills",
                instruction="Represent this skill set for semantic similarity matching:",
            )
            status["skills"] = "updated"
        except Exception as e:
            logger.warning(f"Applicant skills precompute failed (db_id={applicant.id}): {e}")
            status["skills"] = "failed"

        try:
            resume_text = DocumentScorer(embedder).build_resume_text(applicant)
            if resume_text:
                embedder.get_applicant_embedding(
                    applicant=applicant,
                    text=resume_text,
                    suffix="",
                    instruction="Represent this candidate profile for job matching:",
                )
                status["document"] = "updated"
        except Exception as e:
            logger.warning(f"Applicant document precompute failed (db_id={applicant.id}): {e}")
            status["document"] = "failed"
    except Exception as e:
        logger.warning(f"Applicant precompute skipped (db_id={getattr(applicant, 'id', '?')}): {e}")
    return status


def _job_skills_payload(job: Job) -> str:
    """Mirrors SemanticScorer's job-skills payload (same cache key)."""
    names = []
    for s in job.required_skills or []:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            names.append(name)
    return ", ".join(names)


def _job_document_payload(job: Job) -> str:
    """Mirrors DocumentScorer's job-document payload (same cache key)."""
    from ..utils import truncate_for_llm

    names = []
    for s in job.required_skills or []:
        name = s.get("name", "") if isinstance(s, dict) else str(s)
        if name:
            names.append(name)
    skills_str = ", ".join(names)
    desc_safe = truncate_for_llm(job.description or "", "recommendation_max_chars")
    payload = f"Title: {job.title or ''}. Description: {desc_safe}."
    if skills_str:
        payload += f" Required Skills: {skills_str}."
    return payload


def ensure_job_embeddings(job: Job, db: Session) -> Dict[str, str]:
    """Embed the job once (skills + document payloads) at posting time."""
    from .embedder import Embedder

    status: Dict[str, str] = {"skills": "skipped", "document": "skipped"}
    try:
        embedder = Embedder(db)
        try:
            embedder.get_job_embedding(job.id, lambda j: _job_skills_payload(j), job)
            status["skills"] = "updated"
        except Exception as e:
            logger.warning(f"Job skills precompute failed (job_id={job.id}): {e}")
            status["skills"] = "failed"
        try:
            embedder.get_job_embedding(job.id, lambda j: _job_document_payload(j), job)
            status["document"] = "updated"
        except Exception as e:
            logger.warning(f"Job document precompute failed (job_id={job.id}): {e}")
            status["document"] = "failed"
    except Exception as e:
        logger.warning(f"Job precompute skipped (job_id={getattr(job, 'id', '?')}): {e}")
    return status
