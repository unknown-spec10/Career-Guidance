"""Background task processing using FastAPI BackgroundTasks.

This module provides utilities for running long-running tasks asynchronously
without blocking the API response.
"""

import logging
import threading
from typing import Optional, Dict, Any, List
from datetime import datetime
from .config import settings
from .db import SessionLocal, AuditLog

logger = logging.getLogger(__name__)


class BackgroundTaskRunner:
    """Handles background task execution with error handling and logging."""
    
    @staticmethod
    def log_task_start(task_name: str, details: Optional[Dict[str, Any]] = None):
        """Log the start of a background task."""
        logger.info(f"Background task started: {task_name}", extra={"details": details or {}})
    
    @staticmethod
    def log_task_complete(task_name: str, details: Optional[Dict[str, Any]] = None):
        """Log successful completion of a background task."""
        logger.info(f"Background task completed: {task_name}", extra={"details": details or {}})
    
    @staticmethod
    def log_task_error(task_name: str, error: Exception, details: Optional[Dict[str, Any]] = None):
        """Log background task error."""
        logger.error(f"Background task failed: {task_name} - {error}", extra={"details": details or {}})
    
    @staticmethod
    def audit_log(action: str, target_type: str, target_id: int, user_id: Optional[int], details: Dict[str, Any]):
        """Create an audit log entry in the background."""
        db = SessionLocal()
        try:
            audit = AuditLog(
                action=action,
                target_type=target_type,
                target_id=target_id,
                user_id=user_id,
                details=details,
                created_at=datetime.utcnow()
            )
            db.add(audit)
            db.commit()
            logger.info(f"Audit log created: {action} on {target_type}#{target_id}")
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            db.rollback()
        finally:
            db.close()


def process_resume_async(applicant_id: str, db_applicant_id: int):
    """
    Background task to process resume parsing and recommendations.
    This is called after upload to avoid blocking the upload response.
    
    Note: This is a placeholder for future async processing.
    Currently, parsing is done synchronously via the /parse endpoint.
    """
    BackgroundTaskRunner.log_task_start("process_resume", {"applicant_id": applicant_id})
    
    db = SessionLocal()
    try:
        # TODO: Implement async parsing
        # For now, just log that the task would run
        logger.info(f"Would process resume for applicant {applicant_id} in background")
        
        BackgroundTaskRunner.log_task_complete("process_resume", {"applicant_id": applicant_id})
        
    except Exception as e:
        BackgroundTaskRunner.log_task_error("process_resume", e, {"applicant_id": applicant_id})
        db.rollback()
    finally:
        db.close()


def sync_skills_to_db_async():
    """
    Background task to sync skill taxonomy from JSON files to database.
    Reads from settings.SKILL_TAXONOMY_PATH and settings.SKILL_TAXONOMY_METADATA_PATH.
    Can be called periodically or after taxonomy updates.
    """
    from .db import CanonicalSkill
    from pathlib import Path
    import json

    BackgroundTaskRunner.log_task_start("sync_skills_to_db")

    db = SessionLocal()
    try:
        taxonomy_path = Path(settings.SKILL_TAXONOMY_PATH)
        metadata_path = Path(settings.SKILL_TAXONOMY_METADATA_PATH)

        if not taxonomy_path.exists() or not metadata_path.exists():
            logger.warning(
                "Skill taxonomy files not found at %s / %s",
                taxonomy_path, metadata_path,
            )
            return

        with open(taxonomy_path, "r", encoding="utf-8") as f:
            taxonomy = json.load(f)

        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        synced_count = 0
        demand_to_score = {
            "very_high": 1.0,
            "high": 0.8,
            "medium": 0.6,
            "low": 0.3,
            "very_low": 0.1,
            "unknown": 0.0,
        }
        for skill_key, skill_id in taxonomy.items():
            meta = metadata.get(skill_key, {})
            display_name = meta.get("display_name", skill_key)
            demand_level = str(meta.get("market_demand", "unknown")).lower()

            existing = db.query(CanonicalSkill).filter(
                CanonicalSkill.name == display_name
            ).first()

            if not existing:
                canonical_skill = CanonicalSkill(
                    name=display_name,
                    category=meta.get("category", "other"),
                    aliases=[skill_key] if skill_key.lower() != str(display_name).lower() else [],
                    demand_level=demand_level,
                    market_score=demand_to_score.get(demand_level, 0.0),
                )
                db.add(canonical_skill)
                synced_count += 1

        db.commit()
        BackgroundTaskRunner.log_task_complete("sync_skills_to_db", {"synced_count": synced_count})

    except Exception as e:
        BackgroundTaskRunner.log_task_error("sync_skills_to_db", e)
        db.rollback()
    finally:
        db.close()


def _sync_new_skills_to_db(added: Dict[str, Dict]) -> int:
    """
    Persist newly discovered skills (from append_new_skills) directly to canonical_skills.
    Skips skills already present (by display_name) and returns the count inserted.
    """
    from .db import CanonicalSkill

    if not added:
        return 0

    demand_to_score = {
        "very_high": 1.0,
        "high": 0.8,
        "medium": 0.6,
        "low": 0.3,
        "very_low": 0.1,
        "unknown": 0.0,
    }

    db = SessionLocal()
    inserted = 0
    try:
        for skill_key, meta in added.items():
            display_name = meta.get("display_name", skill_key)
            demand_level = str(meta.get("market_demand", "unknown")).lower()

            existing = db.query(CanonicalSkill).filter(
                CanonicalSkill.name == display_name
            ).first()

            if not existing:
                db.add(CanonicalSkill(
                    name=display_name,
                    category=meta.get("category", "other"),
                    aliases=[skill_key] if skill_key.lower() != display_name.lower() else [],
                    demand_level=demand_level,
                    market_score=demand_to_score.get(demand_level, 0.0),
                ))
                inserted += 1

        db.commit()
        logger.info("_sync_new_skills_to_db: inserted %d new canonical skills", inserted)
    except Exception as e:
        logger.error("_sync_new_skills_to_db failed: %s", e)
        db.rollback()
    finally:
        db.close()

    return inserted


def expand_unrecognized_skills(unrecognized: List[str]) -> None:
    """
    For skills that failed both fuzzy (Pass 1) and semantic (Pass 2) normalization,
    this function:
      1. Calls SkillTaxonomyBuilder.append_new_skills() to search Google for market
         relevance and classify each new skill.
      2. Writes the results to the taxonomy JSON files (for persistence).
      3. Syncs the newly discovered skills into the canonical_skills DB table so
         future resumes can match against them immediately.

    Designed to be called in a daemon thread after parse_resume_task() completes.
    Safe to skip if Google API keys are not configured — skills are still persisted
    to the JSON taxonomy with zero relevance score (better than nothing).
    """
    if not unrecognized:
        return

    BackgroundTaskRunner.log_task_start(
        "expand_unrecognized_skills",
        {"count": len(unrecognized), "skills": unrecognized[:10]},
    )

    try:
        from .resume.skill_taxonomy_builder import SkillTaxonomyBuilder

        builder = SkillTaxonomyBuilder()

        if not builder.api_key or not builder.search_engine_id:
            logger.warning(
                "expand_unrecognized_skills: GOOGLE_API_KEY or GOOGLE_SEARCH_ENGINE_ID "
                "not configured — skills will be added to taxonomy with zero relevance score."
            )

        added = builder.append_new_skills(
            new_skills=unrecognized,
            mapping_path=settings.SKILL_TAXONOMY_PATH,
            metadata_path=settings.SKILL_TAXONOMY_METADATA_PATH,
        )

        if added:
            inserted = _sync_new_skills_to_db(added)
            BackgroundTaskRunner.log_task_complete(
                "expand_unrecognized_skills",
                {"taxonomy_added": len(added), "db_inserted": inserted},
            )
        else:
            logger.info(
                "expand_unrecognized_skills: all %d skills already in taxonomy",
                len(unrecognized),
            )

    except Exception as e:
        BackgroundTaskRunner.log_task_error("expand_unrecognized_skills", e)


def expand_unrecognized_skills_background(unrecognized: List[str]) -> None:
    """
    Fire expand_unrecognized_skills() in a daemon thread so the parse pipeline
    is not blocked waiting for Google Search API responses.
    """
    if not unrecognized:
        return
    t = threading.Thread(
        target=expand_unrecognized_skills,
        args=(unrecognized,),
        daemon=True,
        name="taxonomy-expander",
    )
    t.start()
    logger.info(
        "expand_unrecognized_skills_background: spawned thread for %d skills",
        len(unrecognized),
    )


def cleanup_expired_jobs_async():
    """
    Background task to mark expired jobs as inactive.
    Can be run on a schedule (e.g., daily via cron or scheduler).
    """
    from .db import Job
    
    BackgroundTaskRunner.log_task_start("cleanup_expired_jobs")
    
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        expired_jobs = db.query(Job).filter(
            Job.status == 'approved',
            Job.expires_at.isnot(None),
            Job.expires_at <= now
        ).all()
        
        for job in expired_jobs:
            # Could add an 'expired' status or just leave as approved with past expires_at
            # For now, just log them
            pass
        
        BackgroundTaskRunner.log_task_complete("cleanup_expired_jobs", {"expired_count": len(expired_jobs)})
        
    except Exception as e:
        BackgroundTaskRunner.log_task_error("cleanup_expired_jobs", e)
        db.rollback()
    finally:
        db.close()
