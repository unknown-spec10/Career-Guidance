# 🔧 Career Guidance AI - Implementation Guide

Developer guide for implementing dual-database architecture, repository pattern, and key features.

---

## 📑 Table of Contents

1. [Repository Pattern Implementation](#repository-pattern-implementation)
2. [Dual-Database Setup](#dual-database-setup)
3. [Adding New Features](#adding-new-features)
4. [Database Operations](#database-operations)
5. [Testing Strategy](#testing-strategy)
6. [Best Practices](#best-practices)

---

## Repository Pattern Implementation

### Overview

The repository pattern provides a database-agnostic abstraction layer, allowing the application to switch between MySQL (local) and Firestore (cloud) without changing business logic.

### Directory Structure

```
resume_pipeline/repos/
├── __init__.py           # Package initialization
├── repository.py         # Abstract interfaces
├── factory.py            # Database factory
├── mysql_impl.py         # MySQL implementations
└── firestore_impl.py     # Firestore implementations
```

### Step 1: Define Abstract Repository Interface

**File**: `resume_pipeline/repos/repository.py`

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class CollegeRepository(ABC):
    """Abstract interface for college data operations"""
    
    @abstractmethod
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all colleges with pagination"""
        pass
    
    @abstractmethod
    async def get_by_id(self, college_id: str) -> Optional[Dict[str, Any]]:
        """Get college by ID"""
        pass
    
    @abstractmethod
    async def create(self, college_data: Dict[str, Any]) -> str:
        """Create new college, returns ID"""
        pass
    
    @abstractmethod
    async def update(self, college_id: str, updates: Dict[str, Any]) -> bool:
        """Update college, returns success status"""
        pass
    
    @abstractmethod
    async def delete(self, college_id: str) -> bool:
        """Delete college, returns success status"""
        pass

class JobRepository(ABC):
    """Abstract interface for job data operations"""
    
    @abstractmethod
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        pass
    
    @abstractmethod
    async def get_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        pass
    
    @abstractmethod
    async def list_active(self, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """List active (approved, not expired) jobs"""
        pass

# Add similar interfaces for:
# - UserRepository
# - ApplicantRepository
# - RecommendationRepository
# - CreditRepository
```

### Step 2: Implement MySQL Repository

**File**: `resume_pipeline/repos/mysql_impl.py`

```python
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from ..db import College, Job
from .repository import CollegeRepository, JobRepository

class MySQLCollegeRepository(CollegeRepository):
    """MySQL implementation of CollegeRepository"""
    
    def __init__(self, session: Session):
        self.session = session
    
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all colleges"""
        colleges = self.session.query(College).limit(limit).offset(offset).all()
        return [self._to_dict(c) for c in colleges]
    
    async def get_by_id(self, college_id: str) -> Optional[Dict[str, Any]]:
        """Get college by ID"""
        college = self.session.query(College).filter(College.id == int(college_id)).first()
        return self._to_dict(college) if college else None
    
    async def create(self, college_data: Dict[str, Any]) -> str:
        """Create new college"""
        college = College(**college_data)
        self.session.add(college)
        self.session.commit()
        return str(college.id)
    
    async def update(self, college_id: str, updates: Dict[str, Any]) -> bool:
        """Update college"""
        result = self.session.query(College).filter(
            College.id == int(college_id)
        ).update(updates)
        self.session.commit()
        return result > 0
    
    async def delete(self, college_id: str) -> bool:
        """Delete college"""
        result = self.session.query(College).filter(
            College.id == int(college_id)
        ).delete()
        self.session.commit()
        return result > 0
    
    def _to_dict(self, college: College) -> Dict[str, Any]:
        """Convert SQLAlchemy model to dict"""
        return {
            "id": str(college.id),
            "name": college.name,
            "location": college.location,
            "ranking": college.ranking,
            "website": college.website,
            "programs": college.programs,
            "eligibility_criteria": college.eligibility_criteria,
            "created_at": college.created_at.isoformat() if college.created_at else None
        }

class MySQLJobRepository(JobRepository):
    """MySQL implementation of JobRepository"""
    
    def __init__(self, session: Session):
        self.session = session
    
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        jobs = self.session.query(Job).limit(limit).offset(offset).all()
        return [self._to_dict(j) for j in jobs]
    
    async def get_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self.session.query(Job).filter(Job.id == int(job_id)).first()
        return self._to_dict(job) if job else None
    
    async def list_active(self, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """List active jobs (approved, not expired)"""
        query = self.session.query(Job).filter(
            Job.status == 'approved',
            Job.expires_at > datetime.now()
        )
        if location:
            query = query.filter(Job.location == location)
        jobs = query.all()
        return [self._to_dict(j) for j in jobs]
    
    def _to_dict(self, job: Job) -> Dict[str, Any]:
        return {
            "id": str(job.id),
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "salary_range": job.salary_range,
            "requirements": job.requirements,
            "status": job.status,
            "expires_at": job.expires_at.isoformat() if job.expires_at else None,
            "created_at": job.created_at.isoformat() if job.created_at else None
        }
```

### Step 3: Implement Firestore Repository

**File**: `resume_pipeline/repos/firestore_impl.py`

```python
from typing import List, Dict, Any, Optional
from google.cloud.firestore import Client
from datetime import datetime

from .repository import CollegeRepository, JobRepository

class FirestoreCollegeRepository(CollegeRepository):
    """Firestore implementation of CollegeRepository"""
    
    def __init__(self, client: Client):
        self.client = client
        self.collection = client.collection('colleges')
    
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all colleges"""
        docs = self.collection.limit(limit).offset(offset).stream()
        colleges = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            colleges.append(data)
        return colleges
    
    async def get_by_id(self, college_id: str) -> Optional[Dict[str, Any]]:
        """Get college by ID"""
        doc = self.collection.document(college_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None
    
    async def create(self, college_data: Dict[str, Any]) -> str:
        """Create new college"""
        college_data['created_at'] = datetime.now()
        doc_ref = self.collection.add(college_data)
        return doc_ref[1].id
    
    async def update(self, college_id: str, updates: Dict[str, Any]) -> bool:
        """Update college"""
        updates['updated_at'] = datetime.now()
        self.collection.document(college_id).update(updates)
        return True
    
    async def delete(self, college_id: str) -> bool:
        """Delete college"""
        self.collection.document(college_id).delete()
        return True

class FirestoreJobRepository(JobRepository):
    """Firestore implementation of JobRepository"""
    
    def __init__(self, client: Client):
        self.client = client
        self.collection = client.collection('jobs')
    
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        docs = self.collection.limit(limit).offset(offset).stream()
        jobs = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            jobs.append(data)
        return jobs
    
    async def get_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        doc = self.collection.document(job_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None
    
    async def list_active(self, location: Optional[str] = None) -> List[Dict[str, Any]]:
        """List active jobs"""
        query = self.collection.where('status', '==', 'approved')
        if location:
            query = query.where('location', '==', location)
        
        docs = query.stream()
        jobs = []
        now = datetime.now()
        for doc in docs:
            data = doc.to_dict()
            # Filter expired jobs (client-side since Firestore has query limitations)
            if 'expires_at' in data and data['expires_at'] > now:
                data['id'] = doc.id
                jobs.append(data)
        return jobs
```

### Step 4: Create Database Factory

**File**: `resume_pipeline/repos/factory.py`

```python
import os
from typing import Literal

class DatabaseFactory:
    """Factory for selecting database backend based on environment"""
    
    @classmethod
    def get_backend(cls) -> Literal['local', 'cloud']:
        """Returns 'local' or 'cloud' based on APP_ENV"""
        env = os.getenv("APP_ENV", "local").lower()
        if env not in ['local', 'cloud']:
            raise ValueError(f"Invalid APP_ENV: {env}. Must be 'local' or 'cloud'")
        return env
    
    @classmethod
    def get_college_repository(cls):
        """Returns CollegeRepository class (not instance)"""
        backend = cls.get_backend()
        if backend == 'local':
            from .mysql_impl import MySQLCollegeRepository
            return MySQLCollegeRepository
        else:
            from .firestore_impl import FirestoreCollegeRepository
            return FirestoreCollegeRepository
    
    @classmethod
    def get_job_repository(cls):
        """Returns JobRepository class (not instance)"""
        backend = cls.get_backend()
        if backend == 'local':
            from .mysql_impl import MySQLJobRepository
            return MySQLJobRepository
        else:
            from .firestore_impl import FirestoreJobRepository
            return FirestoreJobRepository
```

### Step 5: Integrate with FastAPI Routes

**File**: `resume_pipeline/app.py`

```python
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from google.cloud import firestore

from .repos.factory import DatabaseFactory
from .db import SessionLocal

app = FastAPI()

# Helper functions for dependency injection
def get_mysql_session():
    """Get MySQL session (for local)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_firestore_client():
    """Get Firestore client (for cloud)"""
    return firestore.Client()

def get_college_repo():
    """Get appropriate college repository"""
    backend = DatabaseFactory.get_backend()
    if backend == 'cloud':
        from .repos.firestore_impl import FirestoreCollegeRepository
        return FirestoreCollegeRepository(get_firestore_client())
    else:
        from .repos.mysql_impl import MySQLCollegeRepository
        return MySQLCollegeRepository(next(get_mysql_session()))

def get_job_repo():
    """Get appropriate job repository"""
    backend = DatabaseFactory.get_backend()
    if backend == 'cloud':
        from .repos.firestore_impl import FirestoreJobRepository
        return FirestoreJobRepository(get_firestore_client())
    else:
        from .repos.mysql_impl import MySQLJobRepository
        return MySQLJobRepository(next(get_mysql_session()))

# Routes using repository pattern
@app.get("/api/colleges")
async def get_colleges(limit: int = 100, offset: int = 0):
    """List all colleges - works with both MySQL and Firestore"""
    college_repo = get_college_repo()
    colleges = await college_repo.list_all(limit=limit, offset=offset)
    return {"colleges": colleges, "total": len(colleges)}

@app.get("/api/college/{college_id}")
async def get_college_by_id(college_id: str):
    """Get specific college - works with both databases"""
    college_repo = get_college_repo()
    college = await college_repo.get_by_id(college_id)
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    return college

@app.get("/api/jobs")
async def get_jobs(location: Optional[str] = None):
    """List active jobs - works with both databases"""
    job_repo = get_job_repo()
    jobs = await job_repo.list_active(location=location)
    return {"jobs": jobs, "total": len(jobs)}
```

---

## Dual-Database Setup

### Local Development Setup (MySQL)

#### 1. Install MySQL

```powershell
# Download MySQL 8.0
# https://dev.mysql.com/downloads/installer/

# Or use Docker
docker run -d `
  --name career-mysql `
  -e MYSQL_ROOT_PASSWORD=rootpassword `
  -e MYSQL_DATABASE=career_guidance `
  -e MYSQL_USER=career_user `
  -e MYSQL_PASSWORD=yourpassword `
  -p 3306:3306 `
  mysql:8.0
```

#### 2. Configure Environment

```bash
# .env
APP_ENV=local
MYSQL_HOST=localhost
MYSQL_USER=career_user
MYSQL_PASSWORD=yourpassword
MYSQL_DB=career_guidance
MYSQL_PORT=3306
```

#### 3. Initialize Database

```python
# scripts/init_db.py
from resume_pipeline.db import Base, engine

def init_database():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized")

if __name__ == "__main__":
    init_database()
```

Run:
```powershell
python scripts/init_db.py
```

#### 4. Seed Sample Data

```python
# scripts/seed_database.py
from resume_pipeline.db import SessionLocal, User, College, Job
from resume_pipeline.auth import hash_password

def seed_data():
    db = SessionLocal()
    
    # Create user
    user = User(
        email="student@example.com",
        password_hash=hash_password("password123"),
        role="student",
        is_verified=True
    )
    db.add(user)
    
    # Create college
    college = College(
        name="IIT Bombay",
        location="Mumbai",
        ranking=1,
        website="https://www.iitb.ac.in",
        programs=["B.Tech", "M.Tech"],
        eligibility_criteria={"jee_rank": 100}
    )
    db.add(college)
    
    # Create job
    job = Job(
        title="Software Engineer",
        company="Google",
        location="Bangalore",
        salary_range="15-25 LPA",
        requirements=["Python", "FastAPI"],
        status="approved",
        expires_at=datetime.now() + timedelta(days=30)
    )
    db.add(job)
    
    db.commit()
    print("✅ Sample data seeded")

if __name__ == "__main__":
    seed_data()
```

### Cloud Setup (Firestore)

#### 1. Enable Firestore

```powershell
# Enable API
gcloud services enable firestore.googleapis.com

# Create database
gcloud firestore databases create `
  --location=asia-south1 `
  --type=firestore-native
```

#### 2. Configure Environment

```bash
# Cloud Run environment
APP_ENV=cloud
# GOOGLE_APPLICATION_CREDENTIALS is auto-injected
```

#### 3. Seed Firestore

```python
# scripts/seed_firestore.py
from google.cloud import firestore
from datetime import datetime, timedelta

def seed_firestore():
    db = firestore.Client()
    
    # Create user
    db.collection('users').document('user1').set({
        'email': 'student@example.com',
        'password_hash': 'hashed_password',
        'role': 'student',
        'is_verified': True,
        'created_at': datetime.now()
    })
    
    # Create college
    db.collection('colleges').document('college1').set({
        'name': 'IIT Bombay',
        'location': 'Mumbai',
        'ranking': 1,
        'website': 'https://www.iitb.ac.in',
        'programs': ['B.Tech', 'M.Tech'],
        'eligibility_criteria': {'jee_rank': 100},
        'created_at': datetime.now()
    })
    
    # Create job
    db.collection('jobs').document('job1').set({
        'title': 'Software Engineer',
        'company': 'Google',
        'location': 'Bangalore',
        'salary_range': '15-25 LPA',
        'requirements': ['Python', 'FastAPI'],
        'status': 'approved',
        'expires_at': datetime.now() + timedelta(days=30),
        'created_at': datetime.now()
    })
    
    print("✅ Firestore seeded")

if __name__ == "__main__":
    # Authenticate first:
    # gcloud auth application-default login
    seed_firestore()
```

Run:
```powershell
gcloud auth application-default login
python scripts/seed_firestore.py
```

---

## Adding New Features

### Example: Adding InterviewRepository

#### 1. Define Interface

```python
# resume_pipeline/repos/repository.py

class InterviewRepository(ABC):
    @abstractmethod
    async def create_session(self, applicant_id: str, skill: str) -> str:
        """Create interview session, returns session_id"""
        pass
    
    @abstractmethod
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get interview session details"""
        pass
    
    @abstractmethod
    async def save_answer(self, session_id: str, question_id: str, answer: str, score: int) -> bool:
        """Save answer to session"""
        pass
    
    @abstractmethod
    async def finalize_session(self, session_id: str, total_score: int) -> bool:
        """Finalize interview session"""
        pass
```

#### 2. MySQL Implementation

```python
# resume_pipeline/repos/mysql_impl.py

class MySQLInterviewRepository(InterviewRepository):
    def __init__(self, session: Session):
        self.session = session
    
    async def create_session(self, applicant_id: str, skill: str) -> str:
        session = InterviewSession(
            applicant_id=int(applicant_id),
            skill=skill,
            status='in_progress',
            started_at=datetime.now()
        )
        self.session.add(session)
        self.session.commit()
        return str(session.id)
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = self.session.query(InterviewSession).filter(
            InterviewSession.id == int(session_id)
        ).first()
        if not session:
            return None
        return {
            'id': str(session.id),
            'applicant_id': str(session.applicant_id),
            'skill': session.skill,
            'status': session.status,
            'questions': session.questions,
            'answers': session.answers,
            'score': session.score
        }
    
    async def save_answer(self, session_id: str, question_id: str, answer: str, score: int) -> bool:
        session = self.session.query(InterviewSession).filter(
            InterviewSession.id == int(session_id)
        ).first()
        if not session:
            return False
        
        # Update answers JSON
        answers = session.answers or {}
        answers[question_id] = {'answer': answer, 'score': score}
        session.answers = answers
        self.session.commit()
        return True
    
    async def finalize_session(self, session_id: str, total_score: int) -> bool:
        result = self.session.query(InterviewSession).filter(
            InterviewSession.id == int(session_id)
        ).update({
            'status': 'completed',
            'score': total_score,
            'completed_at': datetime.now()
        })
        self.session.commit()
        return result > 0
```

#### 3. Firestore Implementation

```python
# resume_pipeline/repos/firestore_impl.py

class FirestoreInterviewRepository(InterviewRepository):
    def __init__(self, client: Client):
        self.client = client
        self.collection = client.collection('interview_sessions')
    
    async def create_session(self, applicant_id: str, skill: str) -> str:
        doc_ref = self.collection.add({
            'applicant_id': applicant_id,
            'skill': skill,
            'status': 'in_progress',
            'started_at': datetime.now(),
            'questions': [],
            'answers': {},
            'score': 0
        })
        return doc_ref[1].id
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        doc = self.collection.document(session_id).get()
        if doc.exists:
            data = doc.to_dict()
            data['id'] = doc.id
            return data
        return None
    
    async def save_answer(self, session_id: str, question_id: str, answer: str, score: int) -> bool:
        doc_ref = self.collection.document(session_id)
        doc_ref.update({
            f'answers.{question_id}': {'answer': answer, 'score': score}
        })
        return True
    
    async def finalize_session(self, session_id: str, total_score: int) -> bool:
        self.collection.document(session_id).update({
            'status': 'completed',
            'score': total_score,
            'completed_at': datetime.now()
        })
        return True
```

#### 4. Add to Factory

```python
# resume_pipeline/repos/factory.py

class DatabaseFactory:
    # ... existing methods ...
    
    @classmethod
    def get_interview_repository(cls):
        backend = cls.get_backend()
        if backend == 'local':
            from .mysql_impl import MySQLInterviewRepository
            return MySQLInterviewRepository
        else:
            from .firestore_impl import FirestoreInterviewRepository
            return FirestoreInterviewRepository
```

#### 5. Use in Route

```python
# resume_pipeline/app.py

def get_interview_repo():
    backend = DatabaseFactory.get_backend()
    if backend == 'cloud':
        from .repos.firestore_impl import FirestoreInterviewRepository
        return FirestoreInterviewRepository(get_firestore_client())
    else:
        from .repos.mysql_impl import MySQLInterviewRepository
        return MySQLInterviewRepository(next(get_mysql_session()))

@app.post("/api/interview/start")
async def start_interview(applicant_id: str, skill: str):
    interview_repo = get_interview_repo()
    session_id = await interview_repo.create_session(applicant_id, skill)
    return {"session_id": session_id}

@app.post("/api/interview/{session_id}/answer")
async def submit_answer(session_id: str, question_id: str, answer: str):
    interview_repo = get_interview_repo()
    
    # Evaluate answer (using Gemini)
    score = await evaluate_answer(question_id, answer)
    
    # Save to database
    await interview_repo.save_answer(session_id, question_id, answer, score)
    
    return {"score": score}
```

---

## Database Operations

### CRUD Operations

#### Create

**MySQL**:
```python
college = College(name="IIT Delhi", location="Delhi")
db.add(college)
db.commit()
```

**Firestore**:
```python
doc_ref = db.collection('colleges').add({
    'name': 'IIT Delhi',
    'location': 'Delhi',
    'created_at': datetime.now()
})
college_id = doc_ref[1].id
```

#### Read

**MySQL**:
```python
# By ID
college = db.query(College).filter(College.id == 1).first()

# List all
colleges = db.query(College).all()

# With filter
colleges = db.query(College).filter(College.location == "Delhi").all()
```

**Firestore**:
```python
# By ID
doc = db.collection('colleges').document('college_id').get()
college = doc.to_dict() if doc.exists else None

# List all
docs = db.collection('colleges').stream()
colleges = [doc.to_dict() for doc in docs]

# With filter
docs = db.collection('colleges').where('location', '==', 'Delhi').stream()
colleges = [doc.to_dict() for doc in docs]
```

#### Update

**MySQL**:
```python
db.query(College).filter(College.id == 1).update({'ranking': 2})
db.commit()
```

**Firestore**:
```python
db.collection('colleges').document('college_id').update({'ranking': 2})
```

#### Delete

**MySQL**:
```python
db.query(College).filter(College.id == 1).delete()
db.commit()
```

**Firestore**:
```python
db.collection('colleges').document('college_id').delete()
```

### Complex Queries

#### MySQL - JOINs

```python
# Get college recommendations with college details
recommendations = db.query(
    CollegeRecommendation,
    College
).join(
    College, CollegeRecommendation.college_id == College.id
).filter(
    CollegeRecommendation.applicant_id == applicant_id
).all()
```

#### Firestore - Denormalization

```python
# Store college details in recommendation document
db.collection('college_recommendations').add({
    'applicant_id': applicant_id,
    'college_id': college_id,
    'college_name': 'IIT Bombay',  # Denormalized
    'college_location': 'Mumbai',   # Denormalized
    'score': 95,
    'created_at': datetime.now()
})

# Query directly without JOIN
docs = db.collection('college_recommendations').where(
    'applicant_id', '==', applicant_id
).stream()
```

---

## Testing Strategy

### Unit Tests

#### Test Repository Implementation

```python
# tests/test_repositories.py
import pytest
from unittest.mock import Mock, MagicMock
from resume_pipeline.repos.mysql_impl import MySQLCollegeRepository
from resume_pipeline.repos.firestore_impl import FirestoreCollegeRepository

@pytest.mark.asyncio
async def test_mysql_college_repository_list_all():
    # Arrange
    mock_session = Mock()
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.offset.return_value = mock_query
    mock_query.all.return_value = [
        Mock(id=1, name="IIT Bombay", location="Mumbai")
    ]
    
    repo = MySQLCollegeRepository(mock_session)
    
    # Act
    colleges = await repo.list_all(limit=10, offset=0)
    
    # Assert
    assert len(colleges) == 1
    assert colleges[0]['name'] == "IIT Bombay"

@pytest.mark.asyncio
async def test_firestore_college_repository_list_all():
    # Arrange
    mock_client = Mock()
    mock_collection = Mock()
    mock_client.collection.return_value = mock_collection
    
    mock_doc = Mock()
    mock_doc.id = "college1"
    mock_doc.to_dict.return_value = {"name": "IIT Bombay", "location": "Mumbai"}
    
    mock_collection.limit.return_value = mock_collection
    mock_collection.offset.return_value = mock_collection
    mock_collection.stream.return_value = [mock_doc]
    
    repo = FirestoreCollegeRepository(mock_client)
    
    # Act
    colleges = await repo.list_all(limit=10, offset=0)
    
    # Assert
    assert len(colleges) == 1
    assert colleges[0]['name'] == "IIT Bombay"
```

#### Test Factory

```python
# tests/test_factory.py
import pytest
import os
from resume_pipeline.repos.factory import DatabaseFactory

def test_factory_returns_local_backend():
    os.environ['APP_ENV'] = 'local'
    backend = DatabaseFactory.get_backend()
    assert backend == 'local'

def test_factory_returns_cloud_backend():
    os.environ['APP_ENV'] = 'cloud'
    backend = DatabaseFactory.get_backend()
    assert backend == 'cloud'

def test_factory_raises_on_invalid_env():
    os.environ['APP_ENV'] = 'invalid'
    with pytest.raises(ValueError):
        DatabaseFactory.get_backend()
```

### Integration Tests

```python
# tests/test_integration.py
import pytest
from fastapi.testclient import TestClient
from resume_pipeline.app import app

client = TestClient(app)

def test_get_colleges_local():
    os.environ['APP_ENV'] = 'local'
    response = client.get("/api/colleges")
    assert response.status_code == 200
    data = response.json()
    assert 'colleges' in data
    assert isinstance(data['colleges'], list)

def test_get_colleges_cloud():
    os.environ['APP_ENV'] = 'cloud'
    response = client.get("/api/colleges")
    assert response.status_code == 200
    data = response.json()
    assert 'colleges' in data
```

### End-to-End Tests

```python
# tests/test_e2e.py
import pytest
from fastapi.testclient import TestClient

@pytest.mark.e2e
def test_upload_parse_recommend_flow():
    client = TestClient(app)
    
    # 1. Upload resume
    with open("tests/fixtures/sample_resume.txt") as f:
        response = client.post(
            "/upload",
            files={"resume": ("resume.txt", f, "text/plain")}
        )
    assert response.status_code == 200
    applicant_id = response.json()['applicant_id']
    
    # 2. Parse resume
    response = client.post(f"/parse/{applicant_id}")
    assert response.status_code == 200
    db_id = response.json()['db_applicant_id']
    
    # 3. Get recommendations
    response = client.get(f"/api/recommendations/{db_id}")
    assert response.status_code == 200
    data = response.json()
    assert 'college_recommendations' in data
    assert 'job_recommendations' in data
```

---

## Best Practices

### 1. Error Handling

```python
@app.get("/api/college/{college_id}")
async def get_college(college_id: str):
    try:
        college_repo = get_college_repo()
        college = await college_repo.get_by_id(college_id)
        
        if not college:
            raise HTTPException(status_code=404, detail="College not found")
        
        return college
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching college: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### 2. Logging

```python
import logging

logger = logging.getLogger(__name__)

async def create_college(college_data: Dict[str, Any]) -> str:
    logger.info(f"Creating college: {college_data['name']}")
    
    try:
        college_repo = get_college_repo()
        college_id = await college_repo.create(college_data)
        
        logger.info(f"✅ College created: {college_id}")
        return college_id
    
    except Exception as e:
        logger.error(f"❌ Failed to create college: {e}")
        raise
```

### 3. Dependency Injection

```python
from fastapi import Depends

def get_college_repo_dependency():
    """Dependency for injecting college repository"""
    return get_college_repo()

@app.get("/api/colleges")
async def get_colleges(
    college_repo: CollegeRepository = Depends(get_college_repo_dependency),
    limit: int = 100
):
    colleges = await college_repo.list_all(limit=limit)
    return {"colleges": colleges}
```

### 4. Data Validation

```python
from pydantic import BaseModel, Field

class CollegeCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    location: str = Field(..., min_length=2, max_length=100)
    ranking: int = Field(..., ge=1, le=1000)
    website: Optional[str] = Field(None, max_length=500)

@app.post("/api/colleges")
async def create_college(college: CollegeCreate):
    college_repo = get_college_repo()
    college_id = await college_repo.create(college.dict())
    return {"id": college_id}
```

### 5. Transaction Management

**MySQL (with transactions)**:
```python
async def create_recommendation_with_log(applicant_id: str, college_id: str):
    db = SessionLocal()
    try:
        # Create recommendation
        rec = CollegeRecommendation(applicant_id=applicant_id, college_id=college_id)
        db.add(rec)
        
        # Create log entry
        log = CollegeApplicabilityLog(
            applicant_id=applicant_id,
            college_id=college_id,
            action="recommended"
        )
        db.add(log)
        
        # Commit both together
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()
```

**Firestore (no transactions across collections)**:
```python
async def create_recommendation_with_log(applicant_id: str, college_id: str):
    db = firestore.Client()
    
    # Create recommendation
    rec_ref = db.collection('college_recommendations').add({
        'applicant_id': applicant_id,
        'college_id': college_id,
        'created_at': datetime.now()
    })
    
    # Create log entry (separate operation)
    db.collection('college_applicability_logs').add({
        'applicant_id': applicant_id,
        'college_id': college_id,
        'action': 'recommended',
        'created_at': datetime.now()
    })
```

### 6. Caching

```python
from functools import lru_cache
from datetime import datetime, timedelta

# Cache colleges for 5 minutes
_college_cache = {}
_cache_expiry = {}

async def get_colleges_cached():
    cache_key = "all_colleges"
    
    # Check cache
    if cache_key in _college_cache:
        if datetime.now() < _cache_expiry[cache_key]:
            logger.info("✅ Returning cached colleges")
            return _college_cache[cache_key]
    
    # Fetch from database
    college_repo = get_college_repo()
    colleges = await college_repo.list_all()
    
    # Update cache
    _college_cache[cache_key] = colleges
    _cache_expiry[cache_key] = datetime.now() + timedelta(minutes=5)
    
    return colleges
```

### 7. Background Tasks

```python
from fastapi import BackgroundTasks

def send_notification_email(email: str, message: str):
    """Send email notification (runs in background)"""
    logger.info(f"Sending email to {email}")
    # Email sending logic

@app.post("/api/recommendations/{applicant_id}/generate")
async def generate_recommendations(
    applicant_id: str,
    background_tasks: BackgroundTasks
):
    # Generate recommendations
    recommendations = await generate_recs(applicant_id)
    
    # Send email in background
    applicant = await get_applicant(applicant_id)
    background_tasks.add_task(
        send_notification_email,
        applicant.email,
        f"Generated {len(recommendations)} recommendations"
    )
    
    return recommendations
```

---

## Summary

### Key Takeaways

1. **Repository Pattern**: Abstracts database operations behind interfaces
2. **Factory Pattern**: Selects database implementation based on environment
3. **Dual-Database**: MySQL for local (full SQL), Firestore for cloud (serverless)
4. **Single Codebase**: One set of routes, tests, and business logic
5. **Environment-Driven**: `APP_ENV` variable controls database selection

### Migration Checklist

- [ ] Define repository interfaces
- [ ] Implement MySQL repositories
- [ ] Implement Firestore repositories
- [ ] Create database factory
- [ ] Add helper functions for dependency injection
- [ ] Refactor routes to use repositories
- [ ] Write unit tests for repositories
- [ ] Write integration tests for routes
- [ ] Test with both APP_ENV=local and APP_ENV=cloud
- [ ] Deploy to production

---

**Last Updated**: January 23, 2026  
**Implementation Version**: 2.0  
**Status**: ✅ Complete
