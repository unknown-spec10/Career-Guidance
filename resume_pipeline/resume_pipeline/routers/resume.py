# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends, Request, status, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from ..db import (
    Applicant,
    CreditAccount,
    LLMParsedRecord,
    Upload,
)
from uuid import uuid4
from typing import Optional, List
from ..utils import sanitize_filename
from ..config import (
    settings,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_MB,
    API_MESSAGES,
)
from ..auth import (
    get_current_user,
)
from pathlib import Path
import json
from ..resume.parse_service import ResumeParserService
import logging
from .deps import (
    get_db,
    resolve_applicant,
    authorize_applicant_access,
    validate_file_size,
    rate_limit,
    DATA_ROOT,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload")
@router.post("/api/upload/resume")
async def upload_resume(
    request: Request,
    background_tasks: BackgroundTasks,
    resume: UploadFile = File(...),
    jee_rank: Optional[int] = Form(None),
    location: Optional[str] = Form(None),
    preferences: Optional[str] = Form(None),
    marksheets: Optional[List[UploadFile]] = File(None),
    upload_type: str = Form("resume"),  # "resume" or "marksheet"
    twelfth_percentage: Optional[float] = Form(None),
    twelfth_board: Optional[str] = Form(None),
    twelfth_subjects: Optional[str] = Form(None),  # JSON string
    current_user = Depends(get_current_user),  # Authentication required (no anonymous uploads)
    db: Session = Depends(get_db)
):
    logger.info(f"Upload request received - resume: {resume.filename if resume else None}, jee_rank: {jee_rank}, location: {location}")

    # Apply rate limiting (5 uploads per 5 min)
    try:
        rate_limit(request, max_requests=5, window=300)
    except HTTPException:
        raise
    
    from ..db import Applicant, Upload
    
    # Validate file type using config constants
    if not resume.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_ext = Path(resume.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=API_MESSAGES['INVALID_FILE_TYPE']
        )
    
    # Validate file size
    await validate_file_size(resume, MAX_FILE_SIZE_MB)
    
    # Validate marksheets if provided
    if marksheets:
        for marksheet in marksheets:
            await validate_file_size(marksheet, MAX_FILE_SIZE_MB)
    
    # save files
    # Check if logged in user already has an applicant profile to prevent duplicate applicant IDs
    existing_applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()

    if existing_applicant:
        applicant_id = existing_applicant.applicant_id
    else:
        applicant_id = f"app_{uuid4().hex}"
    
    from ..core.storage import get_storage_client
    import hashlib
    import io
    storage_client = get_storage_client()

    res_name = sanitize_filename(resume.filename or "resume_upload")
    resume_key = f"resumes/{applicant_id}/{res_name}"
    
    if settings.STORAGE_BACKEND == "gcs":
        resume_storage_path = resume_key
    else:
        resume_storage_path = str(DATA_ROOT / "resumes" / applicant_id / res_name)

    try:
        resume_content = await resume.read()
        await resume.seek(0)
        resume_hash = hashlib.sha256(resume_content).hexdigest()
        
        # Upload resume using unified storage client
        storage_client.upload_fileobj(resume.file, resume_key)
    except Exception as e:
        logger.error(f"Failed to save resume file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save uploaded file"
        )

    # Check for duplicate resume by hash
    existing_upload = db.query(Upload).filter(Upload.file_hash == resume_hash).first()
    if existing_upload:
        existing_applicant = db.query(Applicant).filter(Applicant.id == existing_upload.applicant_id).first()
        if existing_applicant:
            from ..db import LLMParsedRecord
            parsed_rec = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == existing_applicant.id).first()
            
            # If the previous parse exists and was accepted, treat as duplicate.
            # Otherwise, allow re-upload/re-parse (e.g. if the previous parse failed due to transient rate limits).
            if parsed_rec and getattr(parsed_rec, 'parse_status', None) == 'accepted':
                logger.info(f"Duplicate resume detected with accepted status. Returning existing applicant {existing_applicant.applicant_id}")
                created_str = None
                if hasattr(existing_applicant, 'created_at'):
                    try:
                        val = getattr(existing_applicant, 'created_at', None)
                        if val is not None:
                            created_str = val.isoformat()
                    except:
                        pass
                return JSONResponse({
                    "status": "duplicate",
                    "message": "This resume has already been uploaded",
                    "applicant_id": existing_applicant.applicant_id,
                    "db_id": existing_applicant.id,
                    "resume_hash": resume_hash,
                    "existing_created_at": created_str
                })
            else:
                logger.info(f"Duplicate resume detected for applicant {existing_applicant.applicant_id}, but parse was not accepted (status={getattr(parsed_rec, 'parse_status', None) if parsed_rec else 'None'}). Proceeding to re-parse.")

    marks_paths = []
    if marksheets:
        for ms in marksheets:
            ms_name = sanitize_filename(ms.filename or "marksheet_upload")
            ms_key = f"resumes/{applicant_id}/{ms_name}"
            await ms.seek(0)
            storage_client.upload_fileobj(ms.file, ms_key)
            if settings.STORAGE_BACKEND == "gcs":
                marks_paths.append(ms_key)
            else:
                marks_paths.append(str(DATA_ROOT / "resumes" / applicant_id / ms_name))

    # store a minimal metadata JSON next to files
    meta = {
        "applicant_id": applicant_id,
        "resume_file": resume_storage_path,
        "resume_hash": resume_hash,
        "marksheets": marks_paths,
        "jee_rank": jee_rank,
        "jee_rank_user_provided": jee_rank is not None,  # Flag to prioritize user input
        "location": location,
        "preferences": preferences,
    }
    
    meta_json = json.dumps(meta, indent=2)
    meta_key = f"resumes/{applicant_id}/metadata.json"
    storage_client.upload_fileobj(io.BytesIO(meta_json.encode("utf-8")), meta_key)
    
    # Save to database
    try:
        # Extract location parts
        location_parts = (location or "").split(",")
        city = location_parts[0].strip() if location_parts else None
        state = location_parts[1].strip() if len(location_parts) > 1 else None
        
        # Create applicant record
        # Parse preferences - handle both JSON array and comma-separated string
        preferred_locs = None
        if preferences:
            try:
                preferred_locs = json.loads(preferences)
            except (json.JSONDecodeError, TypeError):
                # If not JSON, treat as comma-separated string
                preferred_locs = [loc.strip() for loc in preferences.split(',') if loc.strip()]

        if existing_applicant:
            applicant = existing_applicant
            applicant.location_city = city
            applicant.location_state = state
            applicant.preferred_locations = preferred_locs
            db.add(applicant)
        else:
            applicant = Applicant(
                user_id=current_user.id,
                applicant_id=applicant_id,
                display_name=f"Applicant {applicant_id[:8]}",
                location_city=city,
                location_state=state,
                preferred_locations=preferred_locs
            )
            db.add(applicant)
        db.flush()  # Get the ID
        
        # Create upload record (cleanup older resume upload if updating existing profile)
        if existing_applicant:
            db.query(Upload).filter(
                Upload.applicant_id == applicant.id,
                Upload.file_type == 'resume'
            ).delete()

        upload = Upload(
            applicant_id=applicant.id,
            file_name=res_name,
            file_type='resume',
            storage_path=str(resume_storage_path),
            file_hash=resume_hash
        )
        db.add(upload)

        logger.info(f"✓ Saved applicant {applicant_id} to database (ID: {applicant.id})")

        # Create credit account with default 60 credits if it does not exist.
        # Uploads are authenticated, so every applicant has a registered owner;
        # the account is created lazily here on first upload.
        from ..db import CreditAccount
        import datetime
        existing_credits = db.query(CreditAccount).filter(CreditAccount.applicant_id == applicant.id).first()
        if not existing_credits:
            credit_account = CreditAccount(
                applicant_id=applicant.id,
                current_credits=60,
                total_earned=60,
                total_spent=0,
                last_refill_at=datetime.datetime.utcnow(),
                next_refill_at=datetime.datetime.utcnow() + datetime.timedelta(days=7),
                is_premium=False
            )
            db.add(credit_account)
            logger.info(f"✓ Created credit account with 60 initial credits")
        db.commit()

        parse_task_id = None
        if settings.ASYNC_PARSE_ENABLED:
            try:
                from ..embedding_tasks import parse_resume_task

                applicant_dir_str = f"resumes/{applicant_id}" if settings.STORAGE_BACKEND == "gcs" else str(DATA_ROOT / "resumes" / applicant_id)
                background_tasks.add_task(parse_resume_task, applicant_id, applicant_dir_str)
                parse_task_id = applicant_id
                logger.info("Queued parse task via BackgroundTasks for applicant %s", applicant_id)
            except Exception as exc:
                logger.warning("Could not auto-queue parse task for %s: %s", applicant_id, exc)
        
        return JSONResponse({
            "status": "ok",
            "applicant_id": applicant_id,
            "db_id": applicant.id,
            "resume_hash": resume_hash,
            "parse_task_id": parse_task_id,
        })
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save to database: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error details: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Still return success for file upload even if DB fails
        return JSONResponse({
            "status": "ok",
            "applicant_id": applicant_id,
            "resume_hash": resume_hash,
            "warning": f"File saved but database record failed: {str(e)}"
        })


parser_service = ResumeParserService()

@router.post("/parse/{applicant_id}")
async def parse_applicant(
    applicant_id: str,
    background_tasks: BackgroundTasks,
    sync: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from ..db import Applicant, LLMParsedRecord
    from ..core.storage import get_storage_client, get_local_directory

    # Authorization: only the owning student (or an admin) may trigger paid
    # LLM parsing for an applicant. Employers/anonymous callers are rejected.
    if current_user.role == "student":
        owner = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()
        if owner is None or getattr(owner, "user_id", None) != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You can only parse your own resume."
            )
    elif current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only the owning student or an admin can trigger parsing."
        )

    if settings.STORAGE_BACKEND == "gcs":
        storage_client = get_storage_client()
        files = storage_client.list_files(f"resumes/{applicant_id}/")
        if not files:
            raise HTTPException(status_code=404, detail="applicant_id not found")
        applicant_dir_str = f"resumes/{applicant_id}"
    else:
        new_path = DATA_ROOT / "resumes" / applicant_id
        legacy_path = DATA_ROOT / applicant_id
        if new_path.exists():
            applicant_dir_str = str(new_path)
        elif legacy_path.exists():
            applicant_dir_str = str(legacy_path)
        else:
            raise HTTPException(status_code=404, detail="applicant_id not found")

    # Async-first parsing: queue worker task and return immediately.
    # Use ?sync=true to force in-process parsing for debugging/rollback.
    if settings.ASYNC_PARSE_ENABLED and not sync:
        try:
            from ..embedding_tasks import parse_resume_task

            background_tasks.add_task(parse_resume_task, applicant_id, applicant_dir_str)
            return JSONResponse({
                "status": "queued",
                "applicant_id": applicant_id,
                "parse_task_id": applicant_id,
                "message": "Parse job queued.",
            })
        except Exception as e:
            logger.warning("Failed to queue parse task for %s: %s", applicant_id, e)
            logger.warning("Falling back to sync parse for %s", applicant_id)
    
    # Run parsing (sync fallback — only used when ASYNC_PARSE_ENABLED=False or ?sync=true)
    with get_local_directory(applicant_id) as local_dir:
        result = parser_service.run_parse(local_dir, applicant_id)
    
    # Save to database
    try:
        # Find applicant by applicant_id string
        applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()
        if not applicant:
            logger.warning(f"Applicant {applicant_id} not found in database, skipping save")
            return JSONResponse(result)
        
        # Update display name from parsed data if available
        normalized = result.get('normalized', {})
        # Try both 'personal' (v2) and 'personal_info' (legacy) key
        personal_info = normalized.get('personal') or normalized.get('personal_info') or {}
        if isinstance(personal_info, dict):
            if personal_info.get('name'):
                applicant.display_name = personal_info['name']
            if personal_info.get('location'):
                location_parts = personal_info['location'].split(',')
                applicant.location_city = location_parts[0].strip() if location_parts else None  # type: ignore
                applicant.location_state = location_parts[1].strip() if len(location_parts) > 1 else None  # type: ignore
        
        # Save or update LLM parsed record (with all v2 fields)
        llm_record = db.query(LLMParsedRecord).filter(
            LLMParsedRecord.applicant_id == applicant.id
        ).first()

        parse_status_val = result.get('parse_status', 'accepted')
        
        if llm_record:
            # Update existing
            llm_record.raw_llm_output = result  # type: ignore
            llm_record.normalized = normalized  # type: ignore
            llm_record.llm_provenance = result.get('llm_provenance', {})  # type: ignore
            llm_record.needs_review = result.get('needs_review', False)  # type: ignore
            llm_record.parse_status = parse_status_val  # type: ignore
            llm_record.unrecognized_skills = result.get('unrecognized_skills', [])  # type: ignore
            llm_record.per_section_confidence = result.get('per_section_confidence', {})  # type: ignore
        else:
            # Create new
            llm_record = LLMParsedRecord(
                applicant_id=applicant.id,
                raw_llm_output=result,
                normalized=normalized,
                llm_provenance=result.get('llm_provenance', {}),
                needs_review=result.get('needs_review', False),
                parse_status=parse_status_val,
                unrecognized_skills=result.get('unrecognized_skills', []),
                per_section_confidence=result.get('per_section_confidence', {}),
            )
            db.add(llm_record)
        
        db.commit()
        logger.info(
            f"✓ Saved parsed data for applicant {applicant_id} (ID: {applicant.id}, "
            f"status={parse_status_val})"
        )

        # Queue background recommendation calculation (only for accepted parses)
        # via the shared facade with its own session (never the request db).
        if parse_status_val == 'accepted':
            try:
                from ..recommendation.service import request_recommendations_async
                background_tasks.add_task(request_recommendations_async, applicant.id)
                result['auto_recommendations_generated'] = "queued"
            except Exception as e:
                logger.warning(f"Could not enqueue background recommendations: {e}")
        
        # Add database ID to result
        result['db_applicant_id'] = applicant.id
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save parsed data to database: {e}")
        result['database_error'] = str(e)
    
    return JSONResponse(result)


@router.get("/api/applicant/{applicant_id}")
async def get_applicant_details(
    applicant_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed applicant information.

    Access policy:
      - admin: any applicant
      - student: only their own profile
      - employer: only applicants who applied to one of the employer's jobs

    This endpoint accepts either the numeric DB id (e.g. `1`) or the external applicant id
    string (e.g. `app_7488d09...`). It resolves the DB id and returns parsed records.
    """
    # Resolve applicant identifier to DB id
    applicant = resolve_applicant(db, applicant_id)

    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    # Authorization: prevent IDOR / BOLA on applicant résumé data
    authorize_applicant_access(db, current_user, applicant)

    # Fetch parsed record using the resolved DB id
    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant.id).first()

    return {
        "applicant": {
            "id": applicant.id,
            "applicant_id": applicant.applicant_id,
            "display_name": applicant.display_name,
            "location_city": applicant.location_city,
            "location_state": applicant.location_state,
            "country": applicant.country,
            "preferred_locations": applicant.preferred_locations,
            "created_at": applicant.created_at.isoformat() if applicant.created_at is not None else None,
            "user_id": applicant.user_id,
            "is_active": applicant.user.is_active if applicant.user else True
        },
        "parsed_data": llm_record.normalized if llm_record else None,
        "needs_review": llm_record.needs_review if llm_record else False,
        "field_confidences": llm_record.field_confidences if llm_record else None
    }


# ============================================================
# HUMAN REVIEW SYSTEM
# ============================================================
