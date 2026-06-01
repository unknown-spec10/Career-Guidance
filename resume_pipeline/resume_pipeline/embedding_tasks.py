"""Celery tasks for asynchronous embedding generation and indexing."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, cast

from .config import settings
from .core.semantic_matching import SemanticMatcher
from .db import Applicant, Job, LLMParsedRecord, SessionLocal

logger = logging.getLogger(__name__)


def parse_resume_task(applicant_id: str, applicant_dir: str) -> Dict[str, Any]:
    """Parse resume, persist normalized output, and chain embedding→recommendation tasks.
    
    Uses the redesigned async pipeline (run_parse_async) with a DB session for
    two-pass skill normalization. Only triggers recommendations for AUTO_ACCEPT parses.
    """
    import asyncio
    from .resume.parse_service import ResumeParserService
    from .constants import PARSE_STATUS_ACCEPTED, PARSE_STATUS_PENDING_REVIEW

    db = SessionLocal()
    try:
        p = Path(applicant_dir)
        if not p.exists():
            return {"ok": False, "reason": "applicant_dir_not_found", "applicant_id": applicant_id}

        applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()
        if not applicant:
            return {"ok": False, "reason": "applicant_not_found", "applicant_id": applicant_id}

        # Mark parse as in-progress — ensure frontend polling returns 'processing' not 'not_started'
        llm_record_existing = db.query(LLMParsedRecord).filter(
            LLMParsedRecord.applicant_id == applicant.id
        ).first()
        if llm_record_existing:
            llm_record_existing.parse_status = "processing"  # type: ignore
            db.commit()
        else:
            # Create a minimal placeholder so polling endpoint shows 'processing'
            # rather than 'not_started' for brand-new uploads
            placeholder = LLMParsedRecord(
                applicant_id=applicant.id,
                raw_llm_output={},
                normalized={},
                parse_status="processing",
                needs_review=False,
            )
            db.add(placeholder)
            db.commit()
            llm_record_existing = placeholder

        parser = ResumeParserService()

        # Run the new async pipeline in a fresh event loop (we're in a sync background thread)
        parsed_result = asyncio.run(
            parser.run_parse_async(str(p), applicant_id, db_session=db)
        )

        normalized = parsed_result.get("normalized", {})
        parse_status = parsed_result.get("parse_status", PARSE_STATUS_ACCEPTED)
        unrecognized_skills = parsed_result.get("unrecognized_skills", [])
        per_section_confidence = parsed_result.get("per_section_confidence", {})

        # ── Taxonomy expansion: fire-and-forget in a daemon thread ──────────
        # Skills that failed both fuzzy and semantic normalization are sent to
        # SkillTaxonomyBuilder.append_new_skills() → Google Search enrichment
        # → canonical_skills DB sync, so future parses can recognise them.
        if unrecognized_skills:
            from .background_tasks import expand_unrecognized_skills_background
            expand_unrecognized_skills_background(unrecognized_skills)

        # Update applicant profile fields from contact section
        personal_info = normalized.get("personal") or normalized.get("personal_info") or {}
        if isinstance(personal_info, dict):
            if personal_info.get("name"):
                applicant.display_name = personal_info["name"]  # type: ignore
            if personal_info.get("location"):
                location_parts = str(personal_info["location"]).split(",")
                applicant.location_city = location_parts[0].strip() if location_parts else None  # type: ignore
                applicant.location_state = location_parts[1].strip() if len(location_parts) > 1 else None  # type: ignore

        # Persist parsed record with all new v2 fields
        if llm_record_existing:
            llm_record_existing.raw_llm_output = parsed_result  # type: ignore
            llm_record_existing.normalized = normalized  # type: ignore
            llm_record_existing.llm_provenance = parsed_result.get("llm_provenance", {})  # type: ignore
            llm_record_existing.needs_review = parsed_result.get("needs_review", False)  # type: ignore
            llm_record_existing.parse_status = parse_status  # type: ignore
            llm_record_existing.unrecognized_skills = unrecognized_skills  # type: ignore
            llm_record_existing.per_section_confidence = per_section_confidence  # type: ignore
        else:
            db.add(
                LLMParsedRecord(
                    applicant_id=applicant.id,
                    raw_llm_output=parsed_result,
                    normalized=normalized,
                    llm_provenance=parsed_result.get("llm_provenance", {}),
                    needs_review=parsed_result.get("needs_review", False),
                    parse_status=parse_status,
                    unrecognized_skills=unrecognized_skills,
                    per_section_confidence=per_section_confidence,
                )
            )

        db.commit()

        # Create human review entry for NEEDS_REVIEW parses
        if parse_status == PARSE_STATUS_PENDING_REVIEW:
            _create_human_review_entry(db, applicant.id, per_section_confidence)

        # Only chain embedding + recommendations for AUTO_ACCEPT quality data
        if parse_status == PARSE_STATUS_ACCEPTED:
            logger.info(
                "AUTO_ACCEPT: generating embedding+recommendations for applicant (db_id=%s)",
                applicant.id,
            )
            embedding_res = generate_resume_embedding_task(applicant.id)
            generate_recommendations_task(embedding_res, applicant.id)
        else:
            logger.info(
                "parse_status=%s for applicant (db_id=%s) — skipping recommendations",
                parse_status,
                applicant.id,
            )

        logger.info(
            "Parsed applicant %s (db_id=%s) — status=%s, confidence=%.3f",
            applicant_id,
            applicant.id,
            parse_status,
            parsed_result.get("overall_confidence", 0.0),
        )

        return {
            "ok": True,
            "applicant_id": applicant_id,
            "db_applicant_id": applicant.id,
            "status": parse_status,
            "overall_confidence": parsed_result.get("overall_confidence", 0.0),
        }
    finally:
        db.close()


def _create_human_review_entry(db, applicant_db_id: int, section_scores: dict) -> None:
    """
    Create a human_reviews entry flagging which sections had low confidence.
    Used by NEEDS_REVIEW state machine output.
    """
    from .db import HumanReview
    import json

    low_sections = {
        section: score
        for section, score in section_scores.items()
        if section != "overall" and isinstance(score, float) and score < 0.70
    }

    if not low_sections:
        return

    try:
        review = HumanReview(
            applicant_id=applicant_db_id,
            field="parse_confidence",
            original_value=json.dumps({"low_confidence_sections": low_sections}),
            corrected_value=None,
            reason=(
                f"Auto-flagged by parse pipeline v2: "
                f"low confidence sections: {', '.join(low_sections.keys())}"
            ),
        )
        db.add(review)
        db.commit()
        logger.info(
            "Created human review entry for applicant %s — low sections: %s",
            applicant_db_id,
            low_sections,
        )
    except Exception as e:
        logger.error(f"Failed to create human review entry: {e}")
        db.rollback()


def generate_recommendations_task(
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


def generate_job_embedding_task(job_id: int) -> Dict[str, Any]:
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


def generate_resume_embedding_task(applicant_db_id: int) -> Dict[str, Any]:
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
