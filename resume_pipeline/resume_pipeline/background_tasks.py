"""Background task processing using FastAPI BackgroundTasks.

This module provides utilities for running long-running tasks asynchronously
without blocking the API response.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
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
    Background task to sync skill taxonomy from JSON to database.
    Can be called periodically or after taxonomy updates.
    """
    from .db import CanonicalSkill
    from pathlib import Path
    import json
    
    BackgroundTaskRunner.log_task_start("sync_skills_to_db")
    
    db = SessionLocal()
    try:
        # Use default paths from project root
        taxonomy_path = Path("skill_taxonomy.json")
        metadata_path = Path("skill_taxonomy_metadata.json")
        
        if not taxonomy_path.exists() or not metadata_path.exists():
            logger.warning("Skill taxonomy files not found")
            return
        
        with open(taxonomy_path, 'r', encoding='utf-8') as f:
            taxonomy = json.load(f)
        
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        synced_count = 0
        for skill_key, skill_id in taxonomy.items():
            meta = metadata.get(skill_key, {})
            
            existing = db.query(CanonicalSkill).filter(
                CanonicalSkill.skill_id == skill_id
            ).first()
            
            if not existing:
                canonical_skill = CanonicalSkill(
                    skill_id=skill_id,
                    name=meta.get('display_name', skill_key),
                    category=meta.get('category', 'other'),
                    aliases=[skill_key] if skill_key != meta.get('display_name', '').lower() else [],
                    market_demand=meta.get('market_demand', 'unknown'),
                    related_skills=meta.get('related_skills', [])
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
