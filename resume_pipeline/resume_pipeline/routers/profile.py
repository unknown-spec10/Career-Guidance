# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, HTTPException, Depends, Body, status, Query
from fastapi.responses import RedirectResponse, FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from ..db import (
    Applicant,
    AuditLog,
    Employer,
    Job,
    JobApplication,
    LLMParsedRecord,
    Upload,
    User,
)
from typing import Optional
from ..config import settings
from ..auth import (
    get_current_user,
    get_current_user_optional,
    require_role,
    decode_access_token,
)
from pathlib import Path
import logging
import datetime as dt
from .deps import (
    get_db,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/student/profile")
async def get_student_profile(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get student resume profile with parsed data"""
    from ..db import Applicant, LLMParsedRecord
    
    # Always use the latest applicant record linked to this user.
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .options(joinedload(Applicant.parsed_record))
        .order_by(desc(Applicant.id))
        .first()
    )
    
    if not applicant:
        # Return empty profile structure if no applicant found
        return {
            "applicant_id": None,
            "skills": [],
            "education": [],
            "experience": [],
            "projects": [],
            "certifications": [],
            "jee_rank": None
        }
    
    # Get parsed resume data
    parsed = applicant.parsed_record
    
    from ..db import Upload
    upload = db.query(Upload).filter(Upload.applicant_id == applicant.id, Upload.file_type == 'resume').first()
    resume_filename = upload.file_name if upload else None
    
    if not parsed:
        return {
            "applicant_id": applicant.id,
            "skills": [],
            "education": [],
            "experience": [],
            "projects": [],
            "certifications": [],
            "jee_rank": None,
            "resume_filename": resume_filename
        }
    
    # Extract normalized data
    normalized = parsed.normalized or {}
    
    # Helper to ensure lists
    def get_list(key, default=[]):
        val = normalized.get(key, default)
        return val if isinstance(val, list) else default

    skills = get_list("skills", [])
    parsed_personal = normalized.get("personal_info") or normalized.get("personal", {})
    if not isinstance(parsed_personal, dict):
        parsed_personal = {}

    auth_name = (getattr(current_user, 'name', None) or '').strip()
    auth_phone = (getattr(current_user, 'phone', None) or '').strip()
    auth_location = ''
    if getattr(applicant, 'location_city', None):
        auth_location = str(getattr(applicant, 'location_city')).strip()
    if getattr(applicant, 'location_state', None):
        state = str(getattr(applicant, 'location_state')).strip()
        auth_location = f"{auth_location}, {state}" if auth_location else state

    personal_info = {
        "name": auth_name or (parsed_personal.get("name") or ""),
        "email": (getattr(current_user, 'email', None) or '').strip() or (parsed_personal.get("email") or ""),
        "phone": auth_phone or (parsed_personal.get("phone") or ""),
        "location": auth_location or (parsed_personal.get("location") or ""),
    }
    summary = normalized.get("summary")

    if not summary:
        top_skills = []
        for skill in skills[:5]:
            if isinstance(skill, dict) and skill.get("name"):
                top_skills.append(str(skill.get("name")))
            elif isinstance(skill, str):
                top_skills.append(skill)

        person_name = personal_info.get("name") if isinstance(personal_info, dict) else None
        if person_name and top_skills:
            summary = f"{person_name} with skills in {', '.join(top_skills)}."
        elif person_name:
            summary = f"{person_name}'s resume has been parsed successfully."
        elif top_skills:
            summary = f"Parsed skills include {', '.join(top_skills)}."
        else:
            summary = "Resume parsed successfully."
    
    # Generate a presigned URL for the profile picture if stored in GCS
    profile_pic = getattr(current_user, "profile_picture_url", None)
    if settings.STORAGE_BACKEND == "gcs" and profile_pic:
        if "avatars/" in profile_pic:
            key = "avatars/" + profile_pic.split("avatars/")[-1]
            from ..core.storage import get_storage_client
            try:
                storage_client = get_storage_client()
                profile_pic = storage_client.get_file_url(key, expires_in=3600)
            except Exception as e:
                logger.warning(f"Failed to generate presigned URL for avatar: {e}")

    return {
        "applicant_id": applicant.id,
        "display_name": applicant.display_name or current_user.name,
        "skills": skills,
        "education": get_list("education", []),
        "experience": get_list("experience", []),
        "projects": get_list("projects", []),
        "certifications": get_list("certifications", []),
        "jee_rank": normalized.get("jee_rank"),
        "summary": summary,
        "personal_info": personal_info,
        "resume_filename": resume_filename,
        "profile_picture_url": profile_pic
    }


@router.get("/api/student/resume/scorecard")
async def get_student_resume_scorecard(
    job_id: Optional[int] = None,
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Calculate and return the student's ATS Resume Score Card"""
    from ..db import Applicant, LLMParsedRecord, Job
    from ..resume.ats_scorer import score_resume
    
    # Fetch current student's applicant record
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found. Please upload a resume first.")

    parsed = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()
    if not parsed:
        raise HTTPException(status_code=404, detail="No parsed resume data found. Please parse your resume first.")

    normalized = parsed.normalized or {}
    
    job_skills = None
    target_job_title = "General Market Demand"
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job_skills = job.required_skills or []
            target_job_title = job.title

    result = score_resume(parsed_data=normalized, job_skills=job_skills, db=db)
    result["target_job_title"] = target_job_title
    result["job_id"] = job_id
    
    return result


@router.post("/api/student/resume/preview-token")
async def mint_resume_preview_token(
    current_user = Depends(get_current_user),
):
    """Mint a short-lived (5-min) single-purpose token for resume preview embeds.

    ``<img>``/``<iframe>`` tags cannot send an Authorization header, so the SPA
    fetches this token with its normal Bearer auth and appends it as
    ``/api/student/resume/preview?token=<preview-token>``. Long-lived session
    JWTs are NOT accepted in the URL.
    """
    from ..auth import create_access_token as _create_token
    preview_token = _create_token(
        data={"sub": str(current_user.id), "purpose": "resume_preview"},
        expires_delta=dt.timedelta(minutes=5),
    )
    return {"preview_token": preview_token, "expires_in_seconds": 300}


@router.get("/api/student/resume/preview")
async def preview_resume(
    token: Optional[str] = Query(None),
    current_user = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Get a preview of the student's uploaded resume (GCS redirect or local file response)

    Authentication: Authorization Bearer header (preferred), or a short-lived
    purpose-bound preview token from POST /api/student/resume/preview-token
    via ``?token=``. Session JWTs in the query string are rejected — tokens in
    URLs leak into history, logs, and Referer headers.
    """
    from fastapi.responses import RedirectResponse, FileResponse
    from ..db import Applicant, Upload, User
    from ..core.storage import get_storage_client
    from ..auth import decode_access_token

    # Authenticate: either via Bearer header or via a preview-scoped ?token=.
    user = current_user
    if not user and token:
        try:
            from ..auth import _token_is_revoked
            payload = decode_access_token(token)
            if payload.get("purpose") != "resume_preview":
                raise HTTPException(
                    status_code=401,
                    detail="Session tokens are not accepted in the URL. "
                           "Use the Authorization header, or mint a preview token "
                           "via POST /api/student/resume/preview-token.",
                )
            user_id_raw = payload.get("sub")
            if user_id_raw:
                user_id = int(user_id_raw)
                candidate = db.query(User).filter(User.id == user_id).first()
                if candidate is not None and getattr(candidate, "is_active", True) \
                        and not _token_is_revoked(payload, candidate):
                    user = candidate
        except HTTPException:
            raise
        except Exception:
            pass
            
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    applicant = db.query(Applicant).filter(Applicant.user_id == user.id).order_by(desc(Applicant.id)).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
        
    upload = db.query(Upload).filter(Upload.applicant_id == applicant.id, Upload.file_type == 'resume').first()
    if not upload:
        raise HTTPException(status_code=404, detail="No resume uploaded yet")
        
    # Check if the storage path is a local file path (from legacy database entries)
    is_local_path = (
        upload.storage_path.startswith("/") or 
        "data/raw_files" in upload.storage_path or 
        "data\\raw_files" in upload.storage_path or
        ":" in upload.storage_path
    )
    
    if settings.STORAGE_BACKEND == "gcs" and not is_local_path:
        storage_client = get_storage_client()
        signed_url = storage_client.get_file_url(upload.storage_path, expires_in=900)
        return RedirectResponse(url=signed_url)
    else:
        # Local path
        local_path = Path(upload.storage_path)
        if not local_path.exists():
            # Fallback to check if it's relative to base path
            local_path = Path(settings.FILE_STORAGE_PATH) / upload.storage_path
            
        if not local_path.exists():
            if settings.STORAGE_BACKEND == "gcs":
                try:
                    storage_client = get_storage_client()
                    signed_url = storage_client.get_file_url(upload.storage_path, expires_in=900)
                    return RedirectResponse(url=signed_url)
                except Exception:
                    pass
            raise HTTPException(status_code=404, detail="Resume file not found on server")
            
        # Determine media type/content type (PDF, docx, etc.)
        suffix = local_path.suffix.lower()
        media_type = "application/pdf"
        if suffix == ".docx":
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif suffix == ".doc":
            media_type = "application/msword"
        elif suffix in [".png", ".jpg", ".jpeg"]:
            media_type = f"image/{suffix[1:]}"
        elif suffix == ".txt":
            media_type = "text/plain"
            
        return FileResponse(path=str(local_path), media_type=media_type, headers={"Content-Disposition": "inline"})


# ============================================================
# STUDENT PROFILE ENDPOINT
# ============================================================

@router.get("/api/student/applicant")
async def get_current_student_applicant(current_user = Depends(require_role("student")), db: Session = Depends(get_db)):
    """Get the current student's applicant profile (DB id, applicant_id, etc)"""
    # Always resolve to the latest applicant row for this user so dashboard
    # recommendations use the most recent parsed resume/profile data.
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found. Please upload your resume.")
    return {
        "id": getattr(applicant, 'id'),
        "applicant_id": getattr(applicant, 'applicant_id'),
        "display_name": getattr(applicant, 'display_name'),
        "location_city": getattr(applicant, 'location_city'),
        "location_state": getattr(applicant, 'location_state'),
        "country": getattr(applicant, 'country'),
        "created_at": (getattr(applicant, 'created_at').isoformat() if getattr(applicant, 'created_at', None) is not None else None)
    }


@router.get("/api/student/applications/jobs")
async def get_student_job_applications(
    current_user = Depends(require_role("student")),
    db: Session = Depends(get_db)
):
    """Get all job applications by current student"""
    from ..db import JobApplication, Job, Applicant, Employer
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        return {"applications": [], "total": 0}
    
    applications = db.query(JobApplication, Job, Employer).join(
        Job, JobApplication.job_id == Job.id
    ).join(
        Employer, Job.employer_id == Employer.id
    ).filter(JobApplication.applicant_id == applicant.id).all()
    
    result = []
    for app, job, employer in applications:
        result.append({
            "application_id": app.id,
            "job_id": job.id,
            "job_title": job.title,
            "company": employer.company_name,
            "status": app.status,
            "applied_at": app.applied_at.isoformat() if app.applied_at else None
        })
    
    return {"applications": result, "total": len(result)}


@router.patch("/api/student/applications/{application_id}/status")
async def update_student_job_application_status(
    application_id: int,
    status: str = Body(...),
    db: Session = Depends(get_db),
    current_user = Depends(require_role("student"))
):
    """Allows students to accept/decline offers or withdraw their applications"""
    from ..db import JobApplication, Applicant, AuditLog
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=403, detail="Applicant profile not found")
        
    application = db.query(JobApplication).filter(
        JobApplication.id == application_id,
        JobApplication.applicant_id == applicant.id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
        
    valid_statuses = ['accepted', 'rejected', 'withdrawn']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status. Students can only update status to: accepted, rejected, or withdrawn")
        
    old_status = getattr(application, 'status', 'applied')
    
    # Simple validation: can only accept/decline if status was 'offered'
    # or withdraw at any non-terminal state
    if status in ['accepted', 'rejected'] and old_status != 'offered':
         raise HTTPException(status_code=400, detail="Can only accept or decline when an offer is active")
         
    application.status = status  # type: ignore
    application.updated_at = dt.datetime.utcnow()  # type: ignore
    db.commit()
    
    # Audit log
    try:
        audit = AuditLog(
            action="student_application_status_update",
            target_type="JobApplication",
            target_id=application_id,
            user_id=current_user.id,
            details={
                "old_status": old_status,
                "new_status": status,
                "applicant_id": applicant.id
            }
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to create audit log: {e}")
        
    return {"status": "success", "message": f"Application status updated to {status}"}
