# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..db import (
    Employer,
    Job,
    JobMetadata,
)
from ..db import active_job_criteria
from typing import Optional, cast
from ..config import (
    API_MESSAGES,
)
import logging
from .deps import (
    get_db,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# EMPLOYER JOB POSTING ENDPOINTS
# ============================================================

# ============================================================
# ADMIN APPROVAL ENDPOINTS
# ============================================================

@router.get("/api/jobs")
async def get_jobs(
    skip: int = 0,
    limit: int = 20,
    location: Optional[str] = None,
    q: Optional[str] = None,
    work_type: Optional[str] = None,
    skills: Optional[str] = None,
    sort: Optional[str] = 'popular',
    db: Session = Depends(get_db)
):
    """Get all active jobs with advanced search, filtering, and sorting support"""
    import datetime
    from sqlalchemy import or_, desc, cast, String
    from ..db import Job, Employer
    
    now = datetime.datetime.utcnow()
    base_query = db.query(Job).filter(*active_job_criteria(now))
    
    # 1. Full-text search. The merged frontend keyword covers the former
    # `q` field (title/description/company) AND the former `skills` field
    # (required_skills) with UNION semantics: a keyword matches when EITHER
    # the old title/desc/company check OR the old skills check would have
    # matched, so required_skills is part of this OR clause and the frontend
    # sends only `q` (no separate `skills` param).
    if q:
        search_pattern = f"%{q}%"
        base_query = base_query.filter(
            or_(
                Job.title.ilike(search_pattern),
                Job.description.ilike(search_pattern),
                Job.employer.has(Employer.company_name.ilike(search_pattern)),
                cast(Job.required_skills, String).ilike(search_pattern)
            )
        )
        
    # 2. Location filter
    if location:
        loc_pattern = f"%{location}%"
        base_query = base_query.filter(
            or_(
                Job.location_city.ilike(loc_pattern),
                Job.location_state.ilike(loc_pattern)
            )
        )
        
    # 3. Work Type filter
    if work_type:
        base_query = base_query.filter(Job.work_type == work_type)
        
    # 4. Skills filter
    if skills:
        skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
        for s in skill_list:
            base_query = base_query.filter(cast(Job.required_skills, String).ilike(f"%{s}%"))
            
    # 5. Sorting
    if sort == 'recent':
        base_query = base_query.order_by(desc(Job.created_at))
    elif sort == 'title':
        base_query = base_query.order_by(Job.title.asc())
    else:  # 'popular' or default
        base_query = base_query.order_by(desc(Job.created_at))
        
    total_count = base_query.count()
    results = base_query.offset(skip).limit(limit).all()
    
    jobs_list = []
    for job in results:
        jobs_list.append({
            "id": job.id,
            "title": job.title,
            "company": job.employer.company_name if job.employer else "Unknown",
            "location_city": job.location_city,
            "location_state": job.location_state,
            "work_type": job.work_type,
            "min_experience_years": job.min_experience_years,
            "min_cgpa": job.min_cgpa,
            "min_salary": None,
            "max_salary": None,
            "description": job.description,
            "required_skills": job.required_skills,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "expires_at": job.expires_at.isoformat() if job.expires_at else None
        })
        
    return {
        "jobs": jobs_list,
        "total": total_count,
        "next_cursor": None
    }


@router.get("/api/job/{job_id}")
async def get_job_details(job_id: int, db: Session = Depends(get_db)):
    """Get detailed job information.

    Public: returns details for approved jobs.
    Employers: may view their own jobs (including pending/rejected) via the employer dashboard endpoints.
    Admins: can view any job.
    """
    from ..db import JobMetadata

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=API_MESSAGES['JOB_NOT_FOUND'])

    # Only approved jobs are visible publicly. Employer-specific views (pending/rejected) should be done through
    # the employer endpoints which already enforce ownership. To keep the public job details endpoint simple and safe,
    # we return details only for approved jobs here.
    if getattr(job, 'status', None) != 'approved':
        raise HTTPException(status_code=404, detail=API_MESSAGES['JOB_NOT_FOUND'])

    employer = db.query(Employer).filter(Employer.id == job.employer_id).first()
    metadata = db.query(JobMetadata).filter(JobMetadata.job_id == job_id).first()

    return {
        "job": {
            "id": job.id,
            "title": job.title,
            "description": job.description,
            "location_city": job.location_city,
            "location_state": job.location_state,
            "work_type": job.work_type,
            "min_experience_years": float(job.min_experience_years) if job.min_experience_years is not None else 0.0,  # type: ignore
            "min_cgpa": float(job.min_cgpa) if job.min_cgpa is not None else None,  # type: ignore
            "required_skills": job.required_skills,
            "optional_skills": job.optional_skills,
            "expires_at": job.expires_at.isoformat() if job.expires_at is not None else None
        },
        "employer": {
            "company_name": employer.company_name if employer else "Unknown",
            "website": employer.website if employer else None,
            "location_city": employer.location_city if employer else None
        } if employer else None,
        "metadata": {
            "tags": metadata.tags if metadata else [],
            "popularity": float(metadata.popularity) if metadata and metadata.popularity is not None else 0.0  # type: ignore
        } if metadata else None
    }
