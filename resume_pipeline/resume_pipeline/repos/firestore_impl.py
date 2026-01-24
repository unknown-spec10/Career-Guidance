"""
Firestore implementation for cloud deployment.
Zero idle cost, scale-to-zero compatible.
No persistent connections - stateless.
"""

from typing import List, Optional, Dict, Any
from google.cloud import firestore
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FirestoreUserRepository:
    """Firestore User repository"""
    
    def __init__(self, db: firestore.Client):
        self.db = db
    
    async def create(self, email: str, password_hash: str, role: str, name: str) -> Dict[str, Any]:
        """Create user"""
        doc_ref = self.db.collection('users').document()
        doc_ref.set({
            'email': email,
            'password_hash': password_hash,
            'role': role,
            'name': name,
            'is_active': True,
            'is_verified': False,
            'created_at': datetime.utcnow(),
        })
        
        logger.info(f"✅ Firestore user created: {email} (role: {role})")
        
        return {
            'id': doc_ref.id,
            'email': email,
            'role': role,
            'name': name,
            'is_verified': False,
        }
    
    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Fetch user by email"""
        docs = list(self.db.collection('users').where('email', '==', email).limit(1).stream())
        
        if not docs:
            return None
        
        doc = docs[0]
        data = doc.to_dict()
        
        return {
            'id': doc.id,
            'email': data.get('email'),
            'password_hash': data.get('password_hash'),
            'role': data.get('role'),
            'is_verified': data.get('is_verified'),
            'is_active': data.get('is_active', True),
        }
    
    async def get_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch user by ID"""
        doc = self.db.collection('users').document(user_id).get()
        
        if not doc.exists:
            return None
        
        data = doc.to_dict()
        
        return {
            'id': doc.id,
            'email': data.get('email'),
            'role': data.get('role'),
            'name': data.get('name'),
            'is_verified': data.get('is_verified'),
            'is_active': data.get('is_active', True),
        }
    
    async def update_verified(self, user_id: str, is_verified: bool) -> bool:
        """Mark user as verified"""
        self.db.collection('users').document(user_id).update({
            'is_verified': is_verified,
            'updated_at': datetime.utcnow(),
        })
        
        logger.info(f"✅ Firestore user verified: {user_id}")
        
        return True


class FirestoreApplicantRepository:
    """Firestore Applicant repository"""
    
    def __init__(self, db: firestore.Client):
        self.db = db
    
    async def create(self, user_id: str, display_name: str, location: str) -> Dict[str, Any]:
        """Create applicant profile"""
        doc_ref = self.db.collection('applicants').document()
        doc_ref.set({
            'user_id': user_id,
            'display_name': display_name,
            'location_city': location,
            'created_at': datetime.utcnow(),
        })
        
        logger.info(f"✅ Firestore applicant created: {display_name}")
        
        return {
            'id': doc_ref.id,
            'user_id': user_id,
            'display_name': display_name,
            'location_city': location,
        }
    
    async def get_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch applicant by user ID"""
        docs = list(self.db.collection('applicants').where('user_id', '==', user_id).limit(1).stream())
        
        if not docs:
            return None
        
        doc = docs[0]
        data = doc.to_dict()
        
        return self._doc_to_dict(doc, data)
    
    async def get_by_id(self, applicant_id: str) -> Optional[Dict[str, Any]]:
        """Fetch applicant by ID"""
        doc = self.db.collection('applicants').document(applicant_id).get()
        
        if not doc.exists:
            return None
        
        data = doc.to_dict()
        return self._doc_to_dict(doc, data)
    
    async def update_jee_cgpa(self, applicant_id: str, jee_rank: int, cgpa: float) -> bool:
        """Update JEE rank and CGPA"""
        self.db.collection('applicants').document(applicant_id).update({
            'jee_rank': jee_rank,
            'cgpa': cgpa,
            'updated_at': datetime.utcnow(),
        })
        
        return True
    
    @staticmethod
    def _doc_to_dict(doc, data):
        return {
            'id': doc.id,
            'user_id': data.get('user_id'),
            'display_name': data.get('display_name'),
            'location_city': data.get('location_city'),
            'jee_rank': data.get('jee_rank'),
            'cgpa': data.get('cgpa'),
        }


class FirestoreCollegeRepository:
    """Firestore College repository"""
    
    def __init__(self, db: firestore.Client):
        self.db = db
    
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List colleges"""
        # Note: Firestore doesn't support OFFSET; use pagination cursor instead
        docs = list(self.db.collection('colleges').limit(limit).stream())
        return [self._doc_to_dict(doc) for doc in docs]
    
    async def get_by_id(self, college_id: str) -> Optional[Dict[str, Any]]:
        """Get college by ID"""
        doc = self.db.collection('colleges').document(college_id).get()
        
        if not doc.exists:
            return None
        
        return self._doc_to_dict(doc)
    
    async def search_by_eligibility(self, jee_rank: int, cgpa: float, limit: int = 50) -> List[Dict[str, Any]]:
        """Search colleges by eligibility"""
        # Firestore multi-field query
        docs = list(self.db.collection('colleges')
                    .where('min_jee_rank', '<=', jee_rank)
                    .where('min_cgpa', '<=', cgpa)
                    .limit(limit)
                    .stream())
        
        return [self._doc_to_dict(doc) for doc in docs]
    
    async def create(self, name: str, location: str, min_jee: int, min_cgpa: float, programs: List[Dict]) -> Dict[str, Any]:
        """Create college"""
        doc_ref = self.db.collection('colleges').document()
        doc_ref.set({
            'name': name,
            'location_city': location,
            'min_jee_rank': min_jee,
            'min_cgpa': min_cgpa,
            'programs': programs,
            'created_at': datetime.utcnow(),
        })
        
        logger.info(f"✅ Firestore college created: {name}")
        
        return {
            'id': doc_ref.id,
            'name': name,
            'location_city': location,
        }
    
    @staticmethod
    def _doc_to_dict(doc):
        data = doc.to_dict()
        return {
            'id': doc.id,
            'name': data.get('name'),
            'location_city': data.get('location_city'),
            'min_jee_rank': data.get('min_jee_rank'),
            'min_cgpa': data.get('min_cgpa'),
            'programs': data.get('programs', []),
        }


class FirestoreJobRepository:
    """Firestore Job repository"""
    
    def __init__(self, db: firestore.Client):
        self.db = db
    
    async def list_active(self, location: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """List active jobs"""
        query = self.db.collection('jobs').where('status', '==', 'approved')
        
        if location:
            query = query.where('location', '==', location)
        
        docs = list(query.limit(limit).stream())
        return [self._doc_to_dict(doc) for doc in docs]
    
    async def get_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job by ID"""
        doc = self.db.collection('jobs').document(job_id).get()
        
        if not doc.exists:
            return None
        
        return self._doc_to_dict(doc)
    
    async def create(self, title: str, company: str, location: str, skills: List[str], salary_min: float, salary_max: float) -> Dict[str, Any]:
        """Create job"""
        doc_ref = self.db.collection('jobs').document()
        doc_ref.set({
            'title': title,
            'company': company,
            'location': location,
            'skills_required': skills,
            'salary_min': salary_min,
            'salary_max': salary_max,
            'status': 'published',
            'created_at': datetime.utcnow(),
        })
        
        logger.info(f"✅ Firestore job created: {title}")
        
        return {
            'id': doc_ref.id,
            'title': title,
            'company': company,
            'location': location,
        }
    
    @staticmethod
    def _doc_to_dict(doc):
        data = doc.to_dict()
        return {
            'id': doc.id,
            'title': data.get('title'),
            'company': data.get('company'),
            'location': data.get('location'),
            'skills_required': data.get('skills_required', []),
            'salary_min': data.get('salary_min'),
            'salary_max': data.get('salary_max'),
        }


class FirestoreRecommendationRepository:
    """Firestore Recommendation repository"""
    
    def __init__(self, db: firestore.Client):
        self.db = db
    
    async def save_college_recommendation(self, applicant_id: str, college_id: str, score: float, reason: str) -> str:
        """Save college recommendation"""
        doc_ref = self.db.collection('recommendations').document(applicant_id)\
            .collection('college_recs').document()
        
        doc_ref.set({
            'college_id': college_id,
            'score': score,
            'reason': reason,
            'status': 'recommended',
            'created_at': datetime.utcnow(),
        })
        
        logger.info(f"✅ Firestore college recommendation saved: {applicant_id} → {college_id} ({score})")
        
        return doc_ref.id
    
    async def get_college_recommendations(self, applicant_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get college recommendations"""
        docs = list(self.db.collection('recommendations').document(applicant_id)\
            .collection('college_recs')\
            .order_by('score', direction=firestore.Query.DESCENDING)\
            .limit(limit).stream())
        
        return [{
            'id': doc.id,
            **doc.to_dict()
        } for doc in docs]
    
    async def update_college_recommendation_status(self, applicant_id: str, rec_id: str, status: str) -> bool:
        """Update college recommendation status"""
        self.db.collection('recommendations').document(applicant_id)\
            .collection('college_recs').document(rec_id).update({
                'status': status,
                'updated_at': datetime.utcnow(),
            })
        
        return True
    
    async def save_job_recommendation(self, applicant_id: str, job_id: str, score: float, reason: str) -> str:
        """Save job recommendation"""
        doc_ref = self.db.collection('recommendations').document(applicant_id)\
            .collection('job_recs').document()
        
        doc_ref.set({
            'job_id': job_id,
            'score': score,
            'reason': reason,
            'status': 'recommended',
            'created_at': datetime.utcnow(),
        })
        
        logger.info(f"✅ Firestore job recommendation saved: {applicant_id} → {job_id} ({score})")
        
        return doc_ref.id
    
    async def get_job_recommendations(self, applicant_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get job recommendations"""
        docs = list(self.db.collection('recommendations').document(applicant_id)\
            .collection('job_recs')\
            .order_by('score', direction=firestore.Query.DESCENDING)\
            .limit(limit).stream())
        
        return [{
            'id': doc.id,
            **doc.to_dict()
        } for doc in docs]
    
    async def update_job_recommendation_status(self, applicant_id: str, rec_id: str, status: str) -> bool:
        """Update job recommendation status"""
        self.db.collection('recommendations').document(applicant_id)\
            .collection('job_recs').document(rec_id).update({
                'status': status,
                'updated_at': datetime.utcnow(),
            })
        
        return True
