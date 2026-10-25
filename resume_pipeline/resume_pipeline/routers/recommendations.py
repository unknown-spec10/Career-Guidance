# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..db import (
    Applicant,
    Employer,
    Job,
    JobRecommendation,
    LLMParsedRecord,
)

from ..config import API_MESSAGES
from ..auth import get_current_user
from ..recommendation.service import (
    MORE_MATCHES_DEFAULT_LIMIT,
    PRESENT_PURPOSES,
    split_present,
)
from .deps import get_db, authorize_applicant_access
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/recommendations/{applicant_id}")
async def get_applicant_recommendations(
    applicant_id: str,
    purpose: str = "jobs",
    more_offset: int = 0,
    more_limit: int = MORE_MATCHES_DEFAULT_LIMIT,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get job recommendations for an applicant.

    Accepts either DB numeric id or external applicant_id string and resolves to DB id.
    `purpose` selects the `recommended` top-slice size (`browse` = 20 for
    JobsPage, otherwise the default top 10); `more_offset`/`more_limit` page
    the `more_matches` remainder. `job_recommendations` keeps the full list
    so existing callers keep working.
    """
    if purpose not in PRESENT_PURPOSES:
        raise HTTPException(status_code=400, detail=f"Unknown recommendation purpose: {purpose!r}")
    # Resolve applicant identifier
    applicant = None
    try:
        if str(applicant_id).isdigit():
            applicant = db.query(Applicant).filter(Applicant.id == int(applicant_id)).first()
    except Exception:
        applicant = None

    if not applicant:
        applicant = db.query(Applicant).filter(Applicant.applicant_id == applicant_id).first()

    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    # Ownership/scope validation (BOLA/IDOR):
    # - student: only their own profile;
    # - employer: only applicants who applied to one of their jobs;
    # - admin: any applicant.
    authorize_applicant_access(db, current_user, applicant)

    resolved_id = applicant.id

    # Job recommendations
    job_recs = db.query(JobRecommendation, Job, Employer).join(
        Job, JobRecommendation.job_id == Job.id
    ).join(
        Employer, Job.employer_id == Employer.id
    ).filter(JobRecommendation.applicant_id == resolved_id).order_by(
        desc(JobRecommendation.score)
    ).all()
    
    # Cooldown Check
    from sqlalchemy import func
    import datetime
    from ..config import CREDIT_CONFIG
    
    last_computed = db.query(func.max(JobRecommendation.computed_at)).filter(
        JobRecommendation.applicant_id == resolved_id
    ).scalar()
    
    cooldown_hours = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COOLDOWN_HOURS', 24)
    cost = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COST', 5)
    
    in_cooldown = False
    cooldown_expires_at = None
    
    if last_computed:
        now_time = datetime.datetime.utcnow()
        time_passed = now_time - last_computed
        cooldown_seconds = cooldown_hours * 3600
        
        if time_passed.total_seconds() < cooldown_seconds:
            in_cooldown = True
            cooldown_expires_at = last_computed + datetime.timedelta(hours=cooldown_hours)
            
    # Fetch job applications to determine status tracker
    from ..db import JobApplication
    job_apps = db.query(JobApplication).filter(JobApplication.applicant_id == resolved_id).all()
    app_status_map = {app.job_id: app.status for app in job_apps}

    full_recommendations = [
            {
                "id": rec.id,
                "job": {
                    "id": job.id,
                    "title": job.title,
                    "description": job.description,
                    "company": employer.company_name,
                    "location_city": job.location_city,
                    "location_state": job.location_state,
                    "work_type": job.work_type,
                    "required_skills": job.required_skills,
                    "min_experience_years": job.min_experience_years,
                    "min_cgpa": job.min_cgpa if hasattr(job, 'min_cgpa') else None,
                    "min_salary": job.min_salary if hasattr(job, 'min_salary') else None,
                    "max_salary": job.max_salary if hasattr(job, 'max_salary') else None,
                },
                "match_score": float(rec.score) if rec.score else 0,
                "score": float(rec.score) if rec.score else 0,
                "scoring_breakdown": rec.score_breakdown if rec.score_breakdown is not None else rec.scoring_breakdown,
                "explanation": rec.explanation,
                "explain": rec.explain,
                "status": rec.status,
                "is_saved": rec.is_saved if rec.is_saved is not None else False,
                "application_status": app_status_map.get(job.id),
                "is_fallback": rec.is_fallback if rec.is_fallback is not None else False,
                "fallback_source": rec.fallback_source,
            } for rec, job, employer in job_recs
        ]

    # Presentation cut: top slice as `recommended`, the rest paged as
    # `more_matches`. `job_recommendations` keeps the full list unchanged.
    split = split_present(full_recommendations, purpose, more_offset, more_limit)

    return {
        "job_recommendations": full_recommendations,
        "recommended": split["recommended"],
        "more_matches": split["more_matches"],
        "total": split["total"],
        "recommended_count": split["recommended_count"],
        "more_total": split["more_total"],
        "more_offset": split["more_offset"],
        "more_limit": split["more_limit"],
        "purpose": purpose,
        "last_computed_at": last_computed.isoformat() if last_computed else None,
        "cooldown_active": in_cooldown,
        "cooldown_expires_at": cooldown_expires_at.isoformat() if cooldown_expires_at else None,
        "cooldown_hours": cooldown_hours,
        "bypass_cost": cost
    }


@router.post("/api/applicant/{applicant_id}/generate-recommendations")
async def generate_recommendations_for_applicant(
    applicant_id: int,
    bypass_cooldown: bool = False,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate or refresh job recommendations for an applicant with a 24-hour hybrid cooldown.
    
    If recommendations were computed recently, the user must set bypass_cooldown=True
    and spend 5 credits to force recalculation. Otherwise, refreshes are free.
    """
    from sqlalchemy import func
    import datetime
    from ..config import CREDIT_CONFIG
    from ..core.credit_service import CreditService, InsufficientCreditsError

    # Validate applicant and parsed data
    applicant = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail=API_MESSAGES['APPLICANT_NOT_FOUND'])

    # BOLA / IDOR ownership validation (same scope policy as the GET route:
    # students own, employers only see applicants tied to their jobs, admins any).
    authorize_applicant_access(db, current_user, applicant)

    llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == applicant_id).first()
    if not llm_record:
        raise HTTPException(status_code=400, detail=API_MESSAGES['NO_PARSED_DATA'])

    # Cooldown Check
    last_computed = db.query(func.max(JobRecommendation.computed_at)).filter(
        JobRecommendation.applicant_id == applicant_id
    ).scalar()

    cooldown_hours = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COOLDOWN_HOURS', 24)
    cost = CREDIT_CONFIG.get('RECOMMENDATION_REFRESH_COST', 5)
    
    credits_spent = 0
    in_cooldown = False
    cooldown_expires_at = None

    if last_computed:
        now_time = datetime.datetime.utcnow()
        time_passed = now_time - last_computed
        cooldown_seconds = cooldown_hours * 3600
        
        if time_passed.total_seconds() < cooldown_seconds:
            in_cooldown = True
            cooldown_expires_at = last_computed + datetime.timedelta(hours=cooldown_hours)
            
            if not bypass_cooldown:
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "cooldown",
                        "last_computed_at": last_computed.isoformat(),
                        "cooldown_expires_at": cooldown_expires_at.isoformat(),
                        "bypass_cost": cost,
                        "detail": f"Recommendations were refreshed recently. You can wait or spend {cost} credits to bypass."
                    }
                )
            else:
                # Deduct 5 credits
                credit_service = CreditService(db)
                eligible, msg, context = credit_service.check_eligibility(
                    applicant_id,
                    'recommendation_refresh',
                    custom_cost=cost
                )
                if not eligible:
                    raise HTTPException(status_code=402, detail=msg)

                try:
                    credit_service.spend_credits(
                        applicant_id,
                        activity_type='recommendation_refresh',
                        cost=cost,
                        description=f"Bypassed recommendations cooldown (charged {cost} credits)"
                    )
                except InsufficientCreditsError:
                    # Race: balance dropped between eligibility check and the
                    # atomic spend — respond with the proper 402, not a 500.
                    raise HTTPException(
                        status_code=402,
                        detail=f"Insufficient credits. Need {cost} credits to bypass the cooldown."
                    )
                credits_spent = cost

    # Clear existing recommendations
    db.query(JobRecommendation).filter(JobRecommendation.applicant_id == applicant_id).delete()
    db.commit()

    # Generate via shared staged facade (persists records internally).
    # Imported from recommendation_service (re-export of the facade) so the
    # class remains patchable at that module path in tests.
    try:
        import asyncio
        from ..recommendation.recommendation_service import RecommendationService
        service = RecommendationService(db)
        result = await asyncio.to_thread(service.get_recommendations, applicant_id)
    except Exception as e:
        logger.error(f"Failed to generate recommendations via service: {e}", exc_info=True)
        # Compensating refund: credits were deducted before regeneration started.
        if credits_spent > 0:
            try:
                CreditService(db).refund_credits(
                    applicant_id,
                    credits_spent,
                    reason="Recommendation generation failed after cooldown bypass",
                )
                logger.info(f"Refunded {credits_spent} bypass credits to applicant {applicant_id}")
            except Exception as refund_err:
                logger.error(f"CRITICAL: refund failed for applicant {applicant_id}: {refund_err}")
        raise HTTPException(status_code=500, detail="Failed to generate recommendations")

    job_count = len(result.get('job_recommendations', []))

    logger.info(f"✓ Generated {job_count} job recommendations for applicant {applicant_id}")

    # Get updated credits summary
    credit_service = CreditService(db)
    summary = credit_service.get_account_summary(applicant_id)
    credits_left = summary.get('current_credits', 0)

    # Return success with metadata and updated balance
    return {
        "status": "success",
        "message": "Recommendations generated successfully",
        "job_recommendations_count": job_count,
        "credits_spent": credits_spent,
        "credits_left": credits_left,
        "cooldown_active": in_cooldown,
        "cooldown_expires_at": cooldown_expires_at.isoformat() if cooldown_expires_at else None
    }
