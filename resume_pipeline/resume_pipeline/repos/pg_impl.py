"""
PostgreSQL implementation using SQLAlchemy.
Used for all environments. Persists data across restarts.
"""

from typing import List, Optional, Dict, Any
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


class PGCollegeRepository:
    """PostgreSQL College repository"""

    def __init__(self, session: Session):
        self.session = session

    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List colleges"""
        from resume_pipeline.db import College

        colleges = self.session.query(College).limit(limit).offset(offset).all()
        return [self._to_dict(c) for c in colleges]

    async def get_by_id(self, college_id: int) -> Optional[Dict[str, Any]]:
        """Get college by ID"""
        from resume_pipeline.db import College

        college = self.session.query(College).filter(College.id == college_id).first()
        if not college:
            return None

        return self._to_dict(college)

    async def search_by_eligibility(self, jee_rank: int, cgpa: float, limit: int = 50) -> List[Dict[str, Any]]:
        """Search colleges by eligibility"""
        from resume_pipeline.db import College

        colleges = self.session.query(College).limit(limit).all()
        return [self._to_dict(c) for c in colleges]

    async def create(self, name: str, location: str, min_jee: int, min_cgpa: float, programs: List[Dict]) -> Dict[str, Any]:
        """Create college"""
        from resume_pipeline.db import College

        college = College(name=name, location_city=location)
        self.session.add(college)
        self.session.commit()

        return self._to_dict(college)

    @staticmethod
    def _to_dict(college):
        return {
            'id': college.id,
            'name': college.name,
            'location_city': college.location_city,
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
            query = query.filter(Job.location == location)

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
        """Create job"""
        from resume_pipeline.db import Job

        job = Job(title=title, company=company, location=location)
        self.session.add(job)
        self.session.commit()

        return self._to_dict(job)

    @staticmethod
    def _to_dict(job):
        return {
            'id': job.id,
            'title': job.title,
            'company': job.company,
            'location': job.location,
        }


class PGRecommendationRepository:
    """PostgreSQL Recommendation repository"""

    def __init__(self, session: Session):
        self.session = session

    async def save_college_recommendation(self, applicant_id: int, college_id: int, score: float, reason: str) -> int:
        """Save college recommendation"""
        from resume_pipeline.db import CollegeApplicabilityLog

        rec = CollegeApplicabilityLog(
            applicant_id=applicant_id,
            college_id=college_id,
            recommend_score=score,
            explain={'reason': reason},
        )
        self.session.add(rec)
        self.session.commit()

        logger.info(f"✅ College recommendation saved: applicant {applicant_id} → college {college_id} ({score})")

        return rec.id

    async def get_college_recommendations(self, applicant_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Get college recommendations"""
        from resume_pipeline.db import CollegeApplicabilityLog

        recs = self.session.query(CollegeApplicabilityLog).filter(
            CollegeApplicabilityLog.applicant_id == applicant_id
        ).order_by(CollegeApplicabilityLog.recommend_score.desc()).limit(limit).all()

        return [self._to_dict(r) for r in recs]

    async def update_college_recommendation_status(self, rec_id: int, status: str) -> bool:
        """Update college recommendation status"""
        from resume_pipeline.db import CollegeApplicabilityLog

        rec = self.session.query(CollegeApplicabilityLog).filter(CollegeApplicabilityLog.id == rec_id).first()
        if not rec:
            return False

        rec.status = status
        self.session.commit()

        return True

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
        # CollegeApplicabilityLog uses recommend_score + explain JSON
        # JobRecommendation uses score + explain JSON
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
