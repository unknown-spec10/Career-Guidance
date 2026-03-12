"""
College data collection and verification service.
Handles submission, approval workflow, and source attribution tracking.
Admin-triggered process for updating college database.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from resume_pipeline.db import (
    College, CollegeEligibility, CollegeProgram, CollegeMetadata, 
    User, CollegeApplicabilityLog
)
from resume_pipeline.schemas_college_collection import (
    CollegeDataSubmit, CollegeDataApprove, VerificationAuditLog
)

logger = logging.getLogger(__name__)


class CollegeCollectionService:
    """Service for admin-triggered college data collection and verification"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def submit_college_data(
        self,
        college_data: CollegeDataSubmit,
        admin_user_id: int,
        is_update: bool = False,
        existing_college_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Submit new college or update existing college data for approval.
        Only admin can trigger this.
        
        Args:
            college_data: CollegeDataSubmit with all fields and sources
            admin_user_id: ID of admin submitting
            is_update: Whether this is updating existing college
            existing_college_id: ID of college being updated
        
        Returns:
            {
                "status": "success",
                "college_id": int,
                "collection_status": "submitted",
                "message": "College data submitted for approval"
            }
        """
        try:
            # Create or fetch existing college
            if is_update and existing_college_id:
                college = self.db.query(College).filter(College.id == existing_college_id).first()
                if not college:
                    return {"status": "error", "message": "College not found"}
            else:
                # Check for duplicates by name + location
                existing = self.db.query(College).filter(
                    and_(
                        College.name.ilike(college_data.name),
                        College.location_city.ilike(college_data.location_city),
                        College.location_state.ilike(college_data.location_state)
                    )
                ).first()
                
                if existing:
                    return {
                        "status": "error",
                        "message": f"College already exists with ID {existing.id}"
                    }
                
                college = College(
                    name=college_data.name,
                    slug=self._generate_slug(college_data.name),
                    location_city=college_data.location_city,
                    location_state=college_data.location_state,
                    country=college_data.country,
                )
            
            # Update basic info
            college.description = college_data.description  # type: ignore
            college.website = college_data.website  # type: ignore
            college.logo_url = college_data.logo_url  # type: ignore
            
            # Set submission metadata
            college.collection_status = 'submitted'  # type: ignore
            college.submitted_by = admin_user_id  # type: ignore
            college.submitted_date = datetime.utcnow()  # type: ignore
            college.data_sources = self._format_data_sources(college_data.data_sources)  # type: ignore
            college.data_freshness_flag = 'needs_verification'  # type: ignore
            
            self.db.add(college)
            self.db.flush()
            
            # Create/update eligibility
            if not is_update:
                eligibility = CollegeEligibility(college_id=college.id)
            else:
                eligibility = self.db.query(CollegeEligibility).filter(
                    CollegeEligibility.college_id == college.id
                ).first() or CollegeEligibility(college_id=college.id)
            
            # Set eligibility data with source attribution
            if college_data.eligibility.min_jee_rank is not None:
                eligibility.min_jee_rank = college_data.eligibility.min_jee_rank  # type: ignore
                eligibility.min_jee_rank_source = college_data.eligibility.min_jee_rank_source  # type: ignore
                eligibility.min_jee_rank_verified = False  # type: ignore
            
            if college_data.eligibility.min_cgpa is not None:
                eligibility.min_cgpa = college_data.eligibility.min_cgpa  # type: ignore
                eligibility.min_cgpa_source = college_data.eligibility.min_cgpa_source  # type: ignore
                eligibility.min_cgpa_verified = False  # type: ignore
            
            if college_data.eligibility.seats is not None:
                eligibility.seats = college_data.eligibility.seats  # type: ignore
                eligibility.seats_source = college_data.eligibility.seats_source  # type: ignore
                eligibility.seats_verified = False  # type: ignore
            
            if college_data.eligibility.eligible_degrees:
                eligibility.eligible_degrees = college_data.eligibility.eligible_degrees  # type: ignore
                eligibility.eligible_degrees_source = college_data.eligibility.eligible_degrees_source  # type: ignore
                eligibility.eligible_degrees_verified = False  # type: ignore
            
            eligibility.reserved_category_cutoffs = college_data.eligibility.reserved_category_cutoffs  # type: ignore
            
            self.db.add(eligibility)
            
            # Create/update programs
            if not is_update:
                # Delete old programs if updating
                self.db.query(CollegeProgram).filter(
                    CollegeProgram.college_id == college.id
                ).delete()
            
            for prog_data in college_data.programs:
                program = CollegeProgram(
                    college_id=college.id,
                    program_name=prog_data.program_name,
                    duration_months=prog_data.duration_months,
                    program_description=prog_data.program_description,
                    required_skills=prog_data.required_skills,
                    status='pending',
                )
                
                # Set source attribution
                program.program_description_source = prog_data.program_description_source  # type: ignore
                program.duration_months_source = prog_data.duration_months_source  # type: ignore
                program.required_skills_source = prog_data.required_skills_source  # type: ignore
                
                self.db.add(program)
            
            # Create metadata if doesn't exist
            metadata = self.db.query(CollegeMetadata).filter(
                CollegeMetadata.college_id == college.id
            ).first()
            
            if not metadata:
                metadata = CollegeMetadata(college_id=college.id)
                self.db.add(metadata)
            
            self.db.commit()
            
            logger.info(f"✓ College data submitted for approval: {college.id} by admin {admin_user_id}")
            
            return {
                "status": "success",
                "college_id": college.id,
                "collection_status": college.collection_status,
                "message": "College data submitted for approval",
                "submitted_date": college.submitted_date.isoformat()
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Failed to submit college data: {e}")
            return {"status": "error", "message": str(e)}
    
    def approve_college_data(
        self,
        college_id: int,
        admin_user_id: int,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Admin approves college data submission.
        Sets is_verified=true and marks all submitted data as verified.
        """
        try:
            college = self.db.query(College).filter(College.id == college_id).first()
            if not college:
                return {"status": "error", "message": "College not found"}
            
            # Mark eligibility as verified
            eligibility = self.db.query(CollegeEligibility).filter(
                CollegeEligibility.college_id == college_id
            ).first()
            
            if eligibility:
                if eligibility.min_jee_rank is not None:
                    eligibility.min_jee_rank_verified = True  # type: ignore
                if eligibility.min_cgpa is not None:
                    eligibility.min_cgpa_verified = True  # type: ignore
                if eligibility.seats is not None and eligibility.seats > 0:  # type: ignore
                    eligibility.seats_verified = True  # type: ignore
                if eligibility.eligible_degrees is not None:
                    eligibility.eligible_degrees_verified = True  # type: ignore
            
            # Mark programs as approved
            programs = self.db.query(CollegeProgram).filter(
                CollegeProgram.college_id == college_id
            ).all()
            
            for program in programs:
                program.status = 'approved'  # type: ignore
                program.reviewed_by = admin_user_id  # type: ignore
                program.reviewed_at = datetime.utcnow()  # type: ignore
                if program.program_description is not None:
                    program.program_description_verified = True  # type: ignore
                if program.duration_months is not None:
                    program.duration_months_verified = True  # type: ignore
                if program.required_skills is not None:
                    program.required_skills_verified = True  # type: ignore
            
            # Update college status
            college.collection_status = 'approved'  # type: ignore
            college.approved_by = admin_user_id  # type: ignore
            college.approved_date = datetime.utcnow()  # type: ignore
            college.is_verified = True  # type: ignore
            college.last_verification_date = datetime.utcnow()  # type: ignore
            college.data_freshness_flag = 'current'  # type: ignore
            
            self.db.commit()
            
            logger.info(f"✓ College {college_id} approved by admin {admin_user_id}")
            
            return {
                "status": "success",
                "college_id": college_id,
                "collection_status": college.collection_status,
                "message": "College data approved and verified",
                "approved_date": college.approved_date.isoformat()
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Failed to approve college: {e}")
            return {"status": "error", "message": str(e)}
    
    def reject_college_data(
        self,
        college_id: int,
        admin_user_id: int,
        rejection_reason: str
    ) -> Dict[str, Any]:
        """Admin rejects college data submission"""
        try:
            college = self.db.query(College).filter(College.id == college_id).first()
            if not college:
                return {"status": "error", "message": "College not found"}
            
            college.collection_status = 'rejected'  # type: ignore
            college.rejection_reason = rejection_reason  # type: ignore
            college.approved_by = admin_user_id  # type: ignore  # Record who rejected
            college.approved_date = datetime.utcnow()  # type: ignore
            
            self.db.commit()
            
            logger.info(f"✓ College {college_id} rejected by admin {admin_user_id}")
            
            return {
                "status": "success",
                "college_id": college_id,
                "collection_status": college.collection_status,
                "message": "College data rejected",
                "rejection_reason": rejection_reason
            }
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Failed to reject college: {e}")
            return {"status": "error", "message": str(e)}
    
    def get_pending_colleges(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """Fetch colleges awaiting admin approval"""
        colleges = self.db.query(College).filter(
            College.collection_status == 'submitted'
        ).offset(offset).limit(limit).all()
        
        return [
            {
                "id": c.id,
                "name": c.name,
                "location": f"{c.location_city}, {c.location_state}",
                "submitted_by": c.submitted_by,
                "submitted_date": c.submitted_date.isoformat() if c.submitted_date is not None else None,  # type: ignore
                "programs_count": len(c.programs),
                "data_freshness": c.data_freshness_flag,
            }
            for c in colleges
        ]
    
    def get_collection_status(self) -> Dict[str, int]:
        """Get summary of collection status"""
        statuses = {
            'draft': 0,
            'submitted': 0,
            'approved': 0,
            'rejected': 0,
        }
        
        for status in statuses.keys():
            count = self.db.query(College).filter(
                College.collection_status == status
            ).count()
            statuses[status] = count
        
        return {
            "total_colleges": sum(statuses.values()),
            **statuses,
            "awaiting_approval": statuses['submitted']
        }
    
    def flag_outdated_colleges(self, days_threshold: int = 365) -> int:
        """
        Flag colleges whose data hasn't been verified in X days as outdated.
        Triggered by admin or scheduled task.
        """
        threshold_date = datetime.utcnow() - timedelta(days=days_threshold)
        
        outdated = self.db.query(College).filter(
            or_(
                College.last_verification_date < threshold_date,
                College.last_verification_date == None
            ),
            College.collection_status == 'approved'
        ).all()
        
        for college in outdated:
            college.data_freshness_flag = 'outdated'  # type: ignore
            logger.info(f"⚠️ Flagged outdated college: {college.id} ({college.name})")
        
        self.db.commit()
        
        return len(outdated)
    
    @staticmethod
    def _generate_slug(name: str) -> str:
        """Generate URL-safe slug from college name"""
        return name.lower().replace(' ', '-').replace('&', 'and')
    
    @staticmethod
    def _format_data_sources(sources) -> List[Dict[str, Any]]:
        """Format source attribution for storage"""
        return [
            {
                "field": s.field_name,
                "source_url": s.source_url,
                "source_type": s.source_type,
                "verified_date": s.verified_date.isoformat(),
                "notes": s.notes
            }
            for s in sources
        ]
