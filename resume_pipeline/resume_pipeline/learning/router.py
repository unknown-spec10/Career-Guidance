"""Learning paths — HTTP routes.

Promoted out of ``interview/`` into this top-level module. Owns the
``/api/learning-paths`` CRUD router plus the
``POST /api/interview/generate-learning-path/{session_id}`` trigger, which
keeps its original interview-prefixed path so the frontend API contract
(``SkillGapModal``) is unchanged.
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.orm.attributes import flag_modified

from ..auth import require_role
from ..db import InterviewSession, LearningPath
from ..interview.common import _get_applicant, get_db
from ..schemas import LearningPathResponse
from .generator import generate_learning_path

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/learning-paths", tags=["Learning Paths"])

# Trigger stays on the /api/interview prefix (frontend contract), but the
# implementation lives here alongside the rest of the learning-path code.
interview_learning_router = APIRouter(prefix="/api/interview", tags=["Interview v2"])


# ---------------------------------------------------------------------------
# POST /api/interview/generate-learning-path/{session_id}
# ---------------------------------------------------------------------------

@interview_learning_router.post("/generate-learning-path/{session_id}")
def trigger_generate_learning_path(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """
    Generate a personalized learning path based on the completed mock interview session.
    Charges 10 credits, enforces daily cap of 2 per user.
    """
    applicant = _get_applicant(current_user, db)
    session = db.query(InterviewSession).filter_by(id=session_id, applicant_id=applicant.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found.")

    try:
        path = generate_learning_path(session_id, db)
        return {
            "path_id": path.get("path_id"),
            "already_exists": path.get("already_exists", False)
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error generating learning path: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error generating learning path.")


@router.get("/{path_id}", response_model=LearningPathResponse)
def get_learning_path_by_id(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """
    Retrieve a learning path by ID. Verified against logged-in user.
    """
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")
    return path

@router.get("/applicant/{applicant_id}", response_model=List[LearningPathResponse])
def get_learning_paths_by_applicant(
    applicant_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """
    Retrieve all learning paths for a given applicant.
    """
    applicant = _get_applicant(current_user, db)
    if applicant.id != applicant_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to applicant learning paths.")

    # Lazy garbage collection of soft-deleted paths > 30 days old
    import datetime
    all_paths = db.query(LearningPath).filter_by(applicant_id=applicant_id).all()
    active_paths = []

    deleted_any = False
    for p in all_paths:
        if p.skill_gaps and isinstance(p.skill_gaps, dict) and p.skill_gaps.get("is_deleted"):
            deleted_at_str = p.skill_gaps.get("deleted_at")
            if deleted_at_str:
                try:
                    deleted_at = datetime.datetime.fromisoformat(deleted_at_str)
                    age = datetime.datetime.utcnow() - deleted_at
                    if age.days >= 30:
                        db.delete(p)
                        deleted_any = True
                        continue
                except Exception:
                    pass
        active_paths.append(p)

    if deleted_any:
        db.commit()
        # Re-fetch remaining paths after hard deletes
        active_paths = db.query(LearningPath).filter_by(applicant_id=applicant_id).order_by(LearningPath.created_at.desc()).all()
    else:
        # Just sort active paths
        active_paths.sort(key=lambda x: x.created_at, reverse=True)

    return active_paths


@router.post("/{path_id}/complete", response_model=LearningPathResponse)
def mark_learning_path_completed(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Mark a learning path as completed."""
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")

    path.status = "completed"
    path.progress_percentage = 100.0
    db.commit()
    db.refresh(path)
    return path


@router.post("/{path_id}/delete", response_model=LearningPathResponse)
def soft_delete_learning_path(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Soft delete a learning path (deletes permanently after 30 days)."""
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")

    import datetime
    skill_gaps = dict(path.skill_gaps) if path.skill_gaps else {}
    skill_gaps["is_deleted"] = True
    skill_gaps["deleted_at"] = datetime.datetime.utcnow().isoformat()

    path.skill_gaps = skill_gaps
    flag_modified(path, "skill_gaps")

    db.commit()
    db.refresh(path)
    return path


@router.post("/{path_id}/restore", response_model=LearningPathResponse)
def restore_learning_path(
    path_id: int,
    db: DBSession = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Restore a soft-deleted learning path."""
    applicant = _get_applicant(current_user, db)
    path = db.query(LearningPath).filter_by(id=path_id, applicant_id=applicant.id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found.")

    skill_gaps = dict(path.skill_gaps) if path.skill_gaps else {}
    if "is_deleted" in skill_gaps:
        del skill_gaps["is_deleted"]
    if "deleted_at" in skill_gaps:
        del skill_gaps["deleted_at"]

    path.skill_gaps = skill_gaps
    flag_modified(path, "skill_gaps")

    db.commit()
    db.refresh(path)
    return path
