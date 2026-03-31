"""Celery tasks for asynchronous embedding generation and indexing."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, cast

from celery import chain

from .celery_app import celery_app
from .config import settings
from .core.semantic_matching import SemanticMatcher
from .db import Applicant, Job, LLMParsedRecord, SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.EMBEDDING_TASK_MAX_RETRIES,
    name="pipeline.parse_resume",
    queue=settings.CELERY_DEFAULT_QUEUE,
)
def parse_resume_task(self, applicant_id: str, applicant_dir: str) -> Dict[str, Any]:
    """Parse resume, persist normalized output, and chain embedding->recommendation tasks."""
    from .resume.parse_service import ResumeParserService

    db = SessionLocal()
    try:
        p = Path(applicant_dir)
        if not p.exists():
            return {"ok": False, "reason": "applicant_dir_not_found", "applicant_id": applicant_id}

        applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()
        if not applicant:
            return {"ok": False, "reason": "applicant_not_found", "applicant_id": applicant_id}

        parser = ResumeParserService()
        parsed_result = parser.run_parse(str(p), applicant_id)
        normalized = parsed_result.get("normalized", {})

        personal_info = normalized.get("personal_info") or normalized.get("personal", {})
        if personal_info.get("name"):
            applicant.display_name = personal_info["name"]
        if personal_info.get("location"):
            location_parts = str(personal_info["location"]).split(",")
            applicant.location_city = location_parts[0].strip() if location_parts else None  # type: ignore
            applicant.location_state = location_parts[1].strip() if len(location_parts) > 1 else None  # type: ignore

        llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()
        if llm_record:
            llm_record.raw_llm_output = parsed_result  # type: ignore
            llm_record.normalized = normalized  # type: ignore
            llm_record.llm_provenance = parsed_result.get("llm_provenance", {})  # type: ignore
            llm_record.needs_review = parsed_result.get("needs_review", False)
        else:
            db.add(
                LLMParsedRecord(
                    applicant_id=applicant.id,
                    raw_llm_output=parsed_result,
                    normalized=normalized,
                    llm_provenance=parsed_result.get("llm_provenance", {}),
                    needs_review=parsed_result.get("needs_review", False),
                )
            )

        db.commit()

        workflow = chain(
            generate_resume_embedding_task.s(applicant.id),
            generate_recommendations_task.s(applicant.id),
        ).apply_async()

        workflow_id = getattr(workflow, "id", None)
        workflow_parent = getattr(workflow, "parent", None)
        embedding_task_id = getattr(workflow_parent, "id", None)
        logger.info(
            "Parsed applicant %s (db_id=%s) and queued embedding/recommendation workflow %s",
            applicant_id,
            applicant.id,
            workflow_id,
        )

        return {
            "ok": True,
            "applicant_id": applicant_id,
            "db_applicant_id": applicant.id,
            "status": "parsed",
            "embedding_task_id": embedding_task_id,
            "recommendation_task_id": workflow_id,
        }
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.EMBEDDING_TASK_MAX_RETRIES,
    name="pipeline.generate_recommendations",
    queue=settings.CELERY_DEFAULT_QUEUE,
)
def generate_recommendations_task(
    self,
    embedding_result: Optional[Dict[str, Any]],
    applicant_db_id: int,
) -> Dict[str, Any]:
    """Generate and persist recommendations after embedding step."""
    from .recommendation.recommendation_service import RecommendationService

    db = SessionLocal()
    try:
        service = RecommendationService(db)
        rec_result = service.get_recommendations(applicant_db_id)
        job_recs = rec_result.get("job_recommendations", [])
        return {
            "ok": True,
            "applicant_id": applicant_db_id,
            "status": "recommendations_generated",
            "job_recommendations": len(job_recs),
            "embedding_result": embedding_result,
        }
    finally:
        db.close()


def _hash_payload(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _normalize_skill_names(skills: List[Any]) -> List[str]:
    names: List[str] = []
    for item in skills or []:
        if isinstance(item, dict):
            raw = str(item.get("name", "")).strip()
        else:
            raw = str(item).strip()
        if raw:
            names.append(raw)
    # Keep order deterministic while deduplicating.
    return list(dict.fromkeys(names))


def _build_job_payload(job: Job) -> str:
    raw_required = cast(List[Any], job.required_skills or [])
    required = _normalize_skill_names(raw_required)
    city = (job.location_city or "").strip()
    state = (job.location_state or "").strip()
    location = f"{city}, {state}".strip(", ")
    return " | ".join(
        [
            f"title: {job.title or 'unknown'}",
            f"required_skills: {', '.join(required)}",
            f"min_experience_years: {job.min_experience_years if job.min_experience_years is not None else 0}",
            f"work_type: {job.work_type or 'unknown'}",
            f"location: {location if location else 'unknown'}",
        ]
    )


def _build_applicant_payload(applicant: Applicant, normalized: Dict[str, Any]) -> str:
    skills = _normalize_skill_names(normalized.get("skills", []))[:30]

    roles: List[str] = []
    for item in (normalized.get("experience") or [])[:3]:
        if isinstance(item, dict) and item.get("title"):
            roles.append(str(item.get("title")))

    degrees: List[str] = []
    for item in (normalized.get("education") or [])[:2]:
        if isinstance(item, dict):
            degree = item.get("degree")
            field = item.get("field")
            if degree and field:
                degrees.append(f"{degree} in {field}")
            elif degree:
                degrees.append(str(degree))

    return " | ".join(
        [
            f"skills: {', '.join(skills)}",
            f"experience: {', '.join(roles) if roles else 'not_provided'}",
            f"education: {', '.join(degrees) if degrees else 'not_provided'}",
            f"location: {getattr(applicant, 'location_city', None) or 'unknown'}",
        ]
    )


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.EMBEDDING_TASK_MAX_RETRIES,
    name="embedding.generate_job_embedding",
    queue=settings.CELERY_EMBEDDINGS_QUEUE,
)
def generate_job_embedding_task(self, job_id: int) -> Dict[str, Any]:
    """Generate and persist a job embedding asynchronously."""
    from .db import JobEmbedding

    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"ok": False, "reason": "job_not_found", "job_id": job_id}

        payload = _build_job_payload(job)
        payload_hash = _hash_payload(payload)

        existing: Optional[JobEmbedding] = db.query(JobEmbedding).filter(JobEmbedding.job_id == job_id).first()
        if existing is not None and cast(str, existing.source_hash) == payload_hash:
            return {"ok": True, "status": "skipped", "job_id": job_id}

        matcher = SemanticMatcher()
        vector, provider = matcher.embed_text(payload)
        if vector is None:
            raise RuntimeError("embedding_unavailable")

        values = vector.tolist()
        if existing is not None:
            setattr(existing, "embedding_vector", values)
            setattr(existing, "embedding_provider", provider)
            setattr(existing, "embedding_model", settings.EMBEDDING_MODEL)
            setattr(existing, "source_hash", payload_hash)
        else:
            db.add(
                JobEmbedding(
                    job_id=job_id,
                    embedding_vector=values,
                    embedding_provider=provider,
                    embedding_model=settings.EMBEDDING_MODEL,
                    source_hash=payload_hash,
                )
            )

        db.commit()
        return {"ok": True, "status": "updated", "job_id": job_id, "provider": provider}
    finally:
        db.close()


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=settings.EMBEDDING_TASK_MAX_RETRIES,
    name="embedding.generate_resume_embedding",
    queue=settings.CELERY_EMBEDDINGS_QUEUE,
)
def generate_resume_embedding_task(self, applicant_db_id: int) -> Dict[str, Any]:
    """Generate and persist an applicant resume embedding asynchronously."""
    from .db import ApplicantEmbedding

    db = SessionLocal()
    try:
        applicant = db.query(Applicant).filter(Applicant.id == applicant_db_id).first()
        if not applicant:
            return {"ok": False, "reason": "applicant_not_found", "applicant_id": applicant_db_id}

        parsed = applicant.parsed_record
        if not parsed or not parsed.normalized:
            return {"ok": False, "reason": "parsed_record_not_found", "applicant_id": applicant_db_id}

        payload = _build_applicant_payload(applicant, parsed.normalized)
        payload_hash = _hash_payload(payload)

        existing: Optional[ApplicantEmbedding] = db.query(ApplicantEmbedding).filter(ApplicantEmbedding.applicant_id == applicant_db_id).first()
        if existing is not None and cast(str, existing.source_hash) == payload_hash:
            return {"ok": True, "status": "skipped", "applicant_id": applicant_db_id}

        matcher = SemanticMatcher()
        vector, provider = matcher.embed_text(payload)
        if vector is None:
            raise RuntimeError("embedding_unavailable")

        values = vector.tolist()
        if existing is not None:
            setattr(existing, "embedding_vector", values)
            setattr(existing, "embedding_provider", provider)
            setattr(existing, "embedding_model", settings.EMBEDDING_MODEL)
            setattr(existing, "source_hash", payload_hash)
        else:
            db.add(
                ApplicantEmbedding(
                    applicant_id=applicant_db_id,
                    embedding_vector=values,
                    embedding_provider=provider,
                    embedding_model=settings.EMBEDDING_MODEL,
                    source_hash=payload_hash,
                )
            )

        db.commit()
        return {
            "ok": True,
            "status": "updated",
            "applicant_id": applicant_db_id,
            "provider": provider,
        }
    finally:
        db.close()
