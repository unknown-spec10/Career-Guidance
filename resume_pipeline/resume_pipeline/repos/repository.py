"""
Abstract repository interfaces - Business logic depends only on these.
No SQL, no Firestore-specific code here.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any


class UserRepository(ABC):
    """User management abstraction"""
    
    @abstractmethod
    async def create(self, email: str, password_hash: str, role: str, name: str) -> Dict[str, Any]:
        """Create user, return dict with 'id', 'email', etc."""
        pass
    
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Fetch user by email"""
        pass
    
    @abstractmethod
    async def get_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Fetch user by ID"""
        pass
    
    @abstractmethod
    async def update_verified(self, user_id: int, is_verified: bool) -> bool:
        """Mark user as verified"""
        pass


class ApplicantRepository(ABC):
    """Applicant profile management"""
    
    @abstractmethod
    async def create(self, user_id: int, display_name: str, location: str) -> Dict[str, Any]:
        """Create applicant profile"""
        pass
    
    @abstractmethod
    async def get_by_user_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Fetch applicant by user ID"""
        pass
    
    @abstractmethod
    async def get_by_id(self, applicant_id: int) -> Optional[Dict[str, Any]]:
        """Fetch applicant by ID"""
        pass
    
    @abstractmethod
    async def update_jee_cgpa(self, applicant_id: int, jee_rank: int, cgpa: float) -> bool:
        """Update JEE rank and CGPA"""
        pass


class CollegeRepository(ABC):
    """College catalog management"""
    
    @abstractmethod
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List colleges with pagination"""
        pass
    
    @abstractmethod
    async def get_by_id(self, college_id: int) -> Optional[Dict[str, Any]]:
        """Fetch college details"""
        pass
    
    @abstractmethod
    async def search_by_eligibility(self, jee_rank: int, cgpa: float, limit: int = 50) -> List[Dict[str, Any]]:
        """Find colleges matching eligibility criteria"""
        pass
    
    @abstractmethod
    async def create(self, name: str, location: str, min_jee: int, min_cgpa: float, programs: List[Dict]) -> Dict[str, Any]:
        """Create college record"""
        pass


class JobRepository(ABC):
    """Job posting management"""
    
    @abstractmethod
    async def list_active(self, location: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """List published, non-expired jobs"""
        pass
    
    @abstractmethod
    async def get_by_id(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Fetch job details"""
        pass
    
    @abstractmethod
    async def create(self, title: str, company: str, location: str, skills: List[str], salary_min: float, salary_max: float) -> Dict[str, Any]:
        """Create job posting"""
        pass


class RecommendationRepository(ABC):
    """College and job recommendations"""
    
    @abstractmethod
    async def save_college_recommendation(self, applicant_id: int, college_id: int, score: float, reason: str) -> int:
        """Save college recommendation"""
        pass
    
    @abstractmethod
    async def get_college_recommendations(self, applicant_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch applicant's college recommendations (sorted by score desc)"""
        pass
    
    @abstractmethod
    async def update_college_recommendation_status(self, rec_id: int, status: str) -> bool:
        """Update recommendation status (recommended, applied, accepted, etc.)"""
        pass
    
    @abstractmethod
    async def save_job_recommendation(self, applicant_id: int, job_id: int, score: float, reason: str) -> int:
        """Save job recommendation"""
        pass
    
    @abstractmethod
    async def get_job_recommendations(self, applicant_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch applicant's job recommendations (sorted by score desc)"""
        pass
    
    @abstractmethod
    async def update_job_recommendation_status(self, rec_id: int, status: str) -> bool:
        """Update job recommendation status"""
        pass
