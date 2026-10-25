# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..db import (
    Applicant,
    Job,
    JobApplication,
    UserFeedback,
)
from ..schemas import (
    JobApplicationCreate,
    JobApplicationResponse,
)
from ..auth import (
    require_role,
)
import logging
from .deps import (
    get_db,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# STUDENT APPLICATION ENDPOINTS
# ============================================================

@router.post("/api/jobs/{job_id}/apply", response_model=JobApplicationResponse)
async def apply_to_job(
    job_id: int,
    application_data: JobApplicationCreate,
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Student applies to a job"""
    from ..db import Job, JobApplication, Applicant
    
    # Verify job exists and is approved
    job = db.query(Job).filter(Job.id == job_id, Job.status == 'approved').first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not available")
    
    # Get student's applicant profile
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=400, detail="Please upload your resume first")
    
    # Check if already applied
    existing = db.query(JobApplication).filter(
        JobApplication.applicant_id == applicant.id,
        JobApplication.job_id == job_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied to this job")
    
    # Create application
    application = JobApplication(
        applicant_id=applicant.id,
        job_id=job_id,
        cover_letter=application_data.cover_letter,
        status='applied'
    )
    db.add(application)
    
    # Personalization implicit feedback logging
    from ..db import UserFeedback
    feedback = UserFeedback(
        applicant_id=applicant.id,
        job_id=job_id,
        action_type='apply'
    )
    db.add(feedback)
    
    db.commit()
    db.refresh(application)

    # Pre-compute recommendation for immediate employer dashboard visibility
    try:
        from ..recommendation.ranking import ensure_applicant_job_recommendation
        ensure_applicant_job_recommendation(applicant.id, job_id, db)
    except Exception as e:
        logger.warning(f"Could not pre-compute recommendation on application: {e}")
    
    logger.info(f"Student {applicant.display_name} applied to job {job.title}")
    return application

