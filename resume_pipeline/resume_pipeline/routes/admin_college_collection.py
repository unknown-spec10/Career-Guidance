"""
Admin API endpoints for college data collection and verification.
Only accessible to admin role.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from resume_pipeline.db import SessionLocal, User
from resume_pipeline.auth import require_role
from resume_pipeline.schemas_college_collection import (
    CollegeDataSubmit, CollegeDataApprove, CollectionStatusResponse
)
from resume_pipeline.services.college_collection_service import CollegeCollectionService

router = APIRouter(prefix="/api/admin/colleges", tags=["admin-college-collection"])


def get_db():
    """Database dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/submit", response_model=dict)
async def submit_college_data(
    college_data: CollegeDataSubmit,
    current_user: User = Depends(require_role('admin')),
    db: Session = Depends(get_db)
):
    """
    Admin submits new college data for approval.
    Includes all basic info, eligibility, programs, and source attribution.
    
    Workflow:
    1. Admin collects data from official sources
    2. Submits via this endpoint with source URLs
    3. Goes to 'submitted' status
    4. Another admin reviews and approves/rejects
    """
    service = CollegeCollectionService(db)
    result = service.submit_college_data(
        college_data=college_data,
        admin_user_id=current_user.id,
        is_update=False
    )
    
    if result['status'] == 'error':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result['message'])
    
    return result


@router.post("/update/{college_id}", response_model=dict)
async def update_college_data(
    college_id: int,
    college_data: CollegeDataSubmit,
    current_user: User = Depends(require_role('admin')),
    db: Session = Depends(get_db)
):
    """
    Admin updates existing college data.
    Changes go to 'submitted' status and require re-approval.
    """
    service = CollegeCollectionService(db)
    result = service.submit_college_data(
        college_data=college_data,
        admin_user_id=current_user.id,
        is_update=True,
        existing_college_id=college_id
    )
    
    if result['status'] == 'error':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result['message'])
    
    return result


@router.post("/approve/{college_id}", response_model=dict)
async def approve_college(
    college_id: int,
    notes: str = None,
    current_user: User = Depends(require_role('admin')),
    db: Session = Depends(get_db)
):
    """
    Admin approves college data submission.
    Sets is_verified=true and marks as 'approved'.
    Data becomes live and visible to students.
    """
    service = CollegeCollectionService(db)
    result = service.approve_college_data(
        college_id=college_id,
        admin_user_id=current_user.id,
        notes=notes
    )
    
    if result['status'] == 'error':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result['message'])
    
    return result


@router.post("/reject/{college_id}", response_model=dict)
async def reject_college(
    college_id: int,
    rejection_reason: str,
    current_user: User = Depends(require_role('admin')),
    db: Session = Depends(get_db)
):
    """
    Admin rejects college data submission.
    Sends back to draft status with rejection reason.
    """
    service = CollegeCollectionService(db)
    result = service.reject_college_data(
        college_id=college_id,
        admin_user_id=current_user.id,
        rejection_reason=rejection_reason
    )
    
    if result['status'] == 'error':
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result['message'])
    
    return result


@router.get("/pending", response_model=dict)
async def get_pending_colleges(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role('admin')),
    db: Session = Depends(get_db)
):
    """
    Get all colleges awaiting admin approval.
    Admins use this to review submitted data.
    """
    service = CollegeCollectionService(db)
    pending = service.get_pending_colleges(limit=limit, offset=offset)
    
    return {
        "status": "success",
        "count": len(pending),
        "colleges": pending
    }


@router.get("/status", response_model=CollectionStatusResponse)
async def get_collection_status(
    current_user: User = Depends(require_role('admin')),
    db: Session = Depends(get_db)
):
    """
    Get overview of college data collection progress.
    Shows counts by collection_status.
    """
    service = CollegeCollectionService(db)
    status = service.get_collection_status()
    
    return CollectionStatusResponse(**status)


@router.post("/flag-outdated", response_model=dict)
async def flag_outdated_data(
    days_threshold: int = 365,
    current_user: User = Depends(require_role('admin')),
    db: Session = Depends(get_db)
):
    """
    Admin triggers check to flag colleges with outdated data.
    Colleges not verified in X days are marked as 'outdated'.
    Can be run as scheduled task or manually.
    """
    service = CollegeCollectionService(db)
    flagged_count = service.flag_outdated_colleges(days_threshold=days_threshold)
    
    return {
        "status": "success",
        "message": f"Flagged {flagged_count} colleges as outdated",
        "flagged_count": flagged_count,
        "threshold_days": days_threshold
    }
