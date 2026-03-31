"""
PostgreSQL implementation using SQLAlchemy.
Used for all environments. Persists data across restarts.
"""

from typing import List, Optional, Dict, Any
from sqlalchemy import or_
from sqlalchemy.orm import Session
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Models will be imported when this module is used (to avoid circular imports)


class PGUserRepository:
    """PostgreSQL User repository"""

    def __init__(self, session: Session):
        self.session = session

    async def create(self, email: str, password_hash: str, role: str, name: str) -> Dict[str, Any]:
        """Create user"""
        from resume_pipeline.db import User

        user = User(email=email, password_hash=password_hash, role=role, name=name)
        self.session.add(user)
        self.session.commit()

        logger.info(f"✅ User created: {email} (role: {role})")

        return {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'name': user.name,
            'is_verified': user.is_verified,
        }

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Fetch user by email"""
        from resume_pipeline.db import User

        user = self.session.query(User).filter(User.email == email).first()
        if not user:
            return None

        return {
            'id': user.id,
            'email': user.email,
            'password_hash': user.password_hash,
            'role': user.role,
            'is_verified': user.is_verified,
            'is_active': user.is_active,
        }

    async def get_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Fetch user by ID"""
        from resume_pipeline.db import User

        user = self.session.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        return {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'name': user.name,
            'is_verified': user.is_verified,
            'is_active': user.is_active,
        }

    async def update_verified(self, user_id: int, is_verified: bool) -> bool:
        """Mark user as verified"""
        from resume_pipeline.db import User

        user = self.session.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        user.is_verified = is_verified
        user.updated_at = datetime.utcnow()
        self.session.commit()

        logger.info(f"✅ User verified: {user.email}")

        return True


class PGApplicantRepository:
    """PostgreSQL Applicant repository"""

    def __init__(self, session: Session):
        self.session = session

    async def create(self, user_id: int, display_name: str, location: str) -> Dict[str, Any]:
        """Create applicant profile"""
        from resume_pipeline.db import Applicant

        applicant = Applicant(
            user_id=user_id,
            display_name=display_name,
            location_city=location
        )
        self.session.add(applicant)
        self.session.commit()

        logger.info(f"✅ Applicant created: {display_name}")

        return {
            'id': applicant.id,
            'user_id': applicant.user_id,
            'display_name': applicant.display_name,
            'location_city': applicant.location_city,
        }

    async def get_by_user_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Fetch applicant by user ID"""
        from resume_pipeline.db import Applicant

        applicant = self.session.query(Applicant).filter(Applicant.user_id == user_id).first()
        if not applicant:
            return None

        return self._to_dict(applicant)

    async def get_by_id(self, applicant_id: int) -> Optional[Dict[str, Any]]:
        """Fetch applicant by ID"""
        from resume_pipeline.db import Applicant

        applicant = self.session.query(Applicant).filter(Applicant.id == applicant_id).first()
        if not applicant:
            return None

        return self._to_dict(applicant)

    async def update_jee_cgpa(self, applicant_id: int, jee_rank: int, cgpa: float) -> bool:
        """Update JEE rank and CGPA stored in the applicant's LLM parsed record normalized JSON."""
        from resume_pipeline.db import LLMParsedRecord

        record = self.session.query(LLMParsedRecord).filter(
            LLMParsedRecord.applicant_id == applicant_id
        ).first()
        if not record:
            return False

        existing = record.normalized  # SQLAlchemy JSON → plain dict at runtime
        normalized: dict = dict(existing) if isinstance(existing, dict) else {}  # type: ignore[arg-type]
        normalized['jee_rank'] = jee_rank
        normalized['cgpa'] = cgpa
        record.normalized = normalized  # type: ignore[assignment]
        record.updated_at = datetime.utcnow()
        self.session.commit()

        logger.info(f"✅ JEE/CGPA updated for applicant {applicant_id}: rank={jee_rank}, cgpa={cgpa}")

        return True

    @staticmethod
    def _to_dict(applicant):
        return {
            'id': applicant.id,
            'user_id': applicant.user_id,
            'display_name': applicant.display_name,
            'location_city': applicant.location_city,
        }

class PGJobRepository:
    """PostgreSQL Job repository"""

    def __init__(self, session: Session):
        self.session = session

    async def list_active(self, location: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """List active jobs"""
        from resume_pipeline.db import Job

        query = self.session.query(Job).filter(Job.status == 'approved')
        if location:
            query = query.filter(
                or_(
                    Job.location_city.ilike(f"%{location}%"),
                    Job.location_state.ilike(f"%{location}%")
                )
            )

        jobs = query.limit(limit).all()
        return [self._to_dict(j) for j in jobs]

    async def get_by_id(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Get job by ID"""
        from resume_pipeline.db import Job

        job = self.session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return None

        return self._to_dict(job)

    async def create(self, title: str, company: str, location: str, skills: List[str], salary_min: float, salary_max: float) -> Dict[str, Any]:
        """Create job.

        This repository helper is currently not used by active routes.
        """
        from resume_pipeline.db import Job

        location_parts = [part.strip() for part in location.split(',', 1)] if location else []
        location_city = location_parts[0] if location_parts else ''
        location_state = location_parts[1] if len(location_parts) > 1 else ''
        job = Job(
            employer_id=1,
            title=title,
            description='',
            location_city=location_city,
            location_state=location_state,
            required_skills=skills,
        )
        self.session.add(job)
        self.session.commit()

        return self._to_dict(job)

    @staticmethod
    def _to_dict(job):
        return {
            'id': job.id,
            'title': job.title,
            'company': job.employer.company_name if getattr(job, 'employer', None) else None,
            'location': ', '.join(part for part in [job.location_city, job.location_state] if part),
        }


class PGRecommendationRepository:
    """PostgreSQL job recommendation repository"""

    def __init__(self, session: Session):
        self.session = session

    async def save_job_recommendation(self, applicant_id: int, job_id: int, score: float, reason: str) -> int:
        """Save job recommendation"""
        from resume_pipeline.db import JobRecommendation

        rec = JobRecommendation(
            applicant_id=applicant_id,
            job_id=job_id,
            score=score,
            explain={'reason': reason},
        )
        self.session.add(rec)
        self.session.commit()

        logger.info(f"✅ Job recommendation saved: applicant {applicant_id} → job {job_id} ({score})")

        return rec.id

    async def get_job_recommendations(self, applicant_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get job recommendations"""
        from resume_pipeline.db import JobRecommendation

        recs = self.session.query(JobRecommendation).filter(
            JobRecommendation.applicant_id == applicant_id
        ).order_by(JobRecommendation.score.desc()).limit(limit).all()

        return [self._to_dict(r) for r in recs]

    async def update_job_recommendation_status(self, rec_id: int, status: str) -> bool:
        """Update job recommendation status"""
        from resume_pipeline.db import JobRecommendation

        rec = self.session.query(JobRecommendation).filter(JobRecommendation.id == rec_id).first()
        if not rec:
            return False

        rec.status = status
        self.session.commit()

        return True

    @staticmethod
    def _to_dict(rec):
        score = getattr(rec, 'score', None) or getattr(rec, 'recommend_score', None)
        explain = getattr(rec, 'explain', None) or {}
        reason = explain.get('reason', '') if isinstance(explain, dict) else ''
        return {
            'id': rec.id,
            'applicant_id': rec.applicant_id,
            'score': score,
            'reason': reason,
            'status': getattr(rec, 'status', 'recommended'),
        }
