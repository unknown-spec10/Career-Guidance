# 🗄️ Database Documentation

Complete database reference for the Career Guidance AI system — PostgreSQL via SQLAlchemy.

---

## 📑 Table of Contents

1. [Database Overview](#database-overview)
2. [Repository Pattern](#repository-pattern)
3. [Data Models](#data-models)
4. [Operations (CRUD)](#operations-crud)
5. [Queries & Examples](#queries--examples)
6. [PostgreSQL Setup](#postgresql-setup)
7. [Best Practices](#best-practices)

---

## Database Overview

### Architecture

All environments (local dev, Docker, cloud) use **PostgreSQL 16** via SQLAlchemy. The repository pattern keeps business logic decoupled from the database driver.

```
┌─────────────────────────────────────────────────────┐
│              APPLICATION LOGIC                       │
│         (FastAPI Routes, Business Logic)             │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Repository Factory   │
        │  (always PostgreSQL)  │
        └──────────┬───────────┘
                   │
                   ▼
            ┌────────────┐
            │ PostgreSQL │
            │  via       │
            │ SQLAlchemy │
            └────────────┘
```

### Connection

Set the connection via environment variables in `.env`:

```env
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=yourpassword
PG_DB=career_guidance
```

Or provide a full DSN:
```env
PG_DSN=postgresql+psycopg2://postgres:yourpassword@localhost:5432/career_guidance
```

When `PG_HOST` is not set, the system falls back to `sqlite:///:memory:` for demos/tests.

---

## Repository Pattern
- ✅ Production scales automatically

### Environment Configuration

```bash
# Local development
APP_ENV=local
MYSQL_HOST=localhost
MYSQL_USER=career_user
MYSQL_PASSWORD=yourpassword
MYSQL_DB=career_guidance

# Cloud production
APP_ENV=cloud
# GOOGLE_APPLICATION_CREDENTIALS=auto-injected by Cloud Run
```

### Database Selection Flow

```
Route Handler
    │
    ├─→ get_college_repo()
    │       │
    │       ▼
    │   DatabaseFactory.get_backend()
    │       │
    │       ▼
    │   Check APP_ENV
    │       │
    │   ┌───┴───┐
    │   │       │
    │   ▼       ▼
    │  MySQL  Firestore
```

---

## Data Models

### 18 Core Tables/Collections

#### 🔐 Authentication & Users

**`users`** - User accounts with roles
```
id (PK)
email (UNIQUE)
password_hash
role (student|employer|college|admin)
is_verified
created_at
updated_at
```

**`credit_accounts`** - User credit balances
```
id (PK)
user_id (FK → users)
balance
refill_timestamp
created_at
```

**`credit_transactions`** - Credit audit log
```
id (PK)
user_id (FK → users)
transaction_type (spend|refill|bonus)
amount
reason
created_at
```

#### 👤 Applicants & Profiles

**`applicants`** - Student profiles
```
id (PK)
user_id (FK → users)
display_name
location
jee_rank
cgpa
skills (JSON array)
created_at
updated_at
```

**`uploads`** - Resume files
```
id (PK)
applicant_id (FK → applicants)
file_path
file_hash (SHA256, for deduplication)
file_size
upload_date
parsed_status
```

**`llm_parsed_records`** - Parsed resume data
```
id (PK)
applicant_id (FK → applicants)
upload_id (FK → uploads)
parsed_education (JSON)
parsed_experience (JSON)
parsed_skills (JSON)
confidence_scores (JSON)
raw_text
created_at
```

#### 🎓 Colleges & Programs

**`colleges`** - College master data
```
id (PK)
name
location
ranking
website
programs (JSON array: ["B.Tech", "M.Tech"])
created_at
```

**`college_eligibility`** - Admission criteria
```
id (PK)
college_id (FK → colleges)
program (e.g., "B.Tech")
min_jee_rank
min_cgpa
required_skills (JSON)
created_at
```

**`college_programs`** - Detailed program info
```
id (PK)
college_id (FK → colleges)
program_name
duration_years
placement_avg_salary
companies_recruited (JSON)
created_at
```

**`college_metadata`** - Additional college info
```
id (PK)
college_id (FK → colleges)
popularity_score
skill_distribution (JSON)
reviews_count
average_rating
created_at
```

**`college_applicability_logs`** - Recommendation history
```
id (PK)
applicant_id (FK → applicants)
college_id (FK → colleges)
action (recommended|applied|accepted|rejected)
timestamp
```

**`college_recommendations`** - Applicant → College matches
```
id (PK)
applicant_id (FK → applicants)
college_id (FK → colleges)
score
status (recommended|applied|accepted|rejected|withdrawn)
reason (JSON)
created_at
updated_at
```

#### 💼 Jobs & Employers

**`employers`** - Company information
```
id (PK)
name
industry
website
headquarters
created_at
```

**`jobs`** - Job postings
```
id (PK)
employer_id (FK → employers)
title
description
location
salary_range
requirements (JSON)
status (approved|pending|rejected|expired)
expires_at
created_at
```

**`job_metadata`** - Job tags & popularity
```
id (PK)
job_id (FK → jobs)
difficulty_level (junior|mid|senior)
experience_years
skills_required (JSON)
popularity_score
clicks_count
created_at
```

**`job_recommendations`** - Applicant → Job matches
```
id (PK)
applicant_id (FK → applicants)
job_id (FK → jobs)
score
status (recommended|applied|interviewing|offered|accepted|rejected|withdrawn)
applied_date
created_at
```

#### 🎯 Interviews & Assessments

**`interview_sessions`** - Mock interview sessions
```
id (PK)
applicant_id (FK → applicants)
skill (e.g., "Python")
session_type (full|micro)
status (in_progress|completed)
score
questions (JSON: [q1, q2, ...])
answers (JSON: {q1: {answer, score}, ...})
started_at
completed_at
```

**`interview_questions`** - Question bank
```
id (PK)
skill
question_type (mcq|short_answer)
question_text
options (JSON, for MCQ)
correct_answer
difficulty (easy|medium|hard)
created_at
```

**`interview_answers`** - Student answers
```
id (PK)
session_id (FK → interview_sessions)
question_id (FK → interview_questions)
answer_text
score
feedback
evaluated_at
```

#### 🏷️ Auxiliary Tables

**`canonical_skills`** - Standardized skill taxonomy
```
id (PK)
skill_name (e.g., "Python", "JavaScript")
category (language|framework|database)
description
created_at
```

**`audit_logs`** - System activity tracking
```
id (PK)
user_id (FK → users)
action
entity_type
entity_id
old_value
new_value
timestamp
```

**`human_reviews`** - Manual corrections
```
id (PK)
applicant_id (FK → applicants)
reviewer_id (FK → users)
correction_type
old_value
new_value
reason
reviewed_at
```

---

## Repository Pattern

### Abstract Interfaces

All repositories follow the same interface for database-agnostic operations:

```python
class CollegeRepository(ABC):
    @abstractmethod
    async def list_all(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """List all colleges with pagination"""
        pass
    
    @abstractmethod
    async def get_by_id(self, college_id: str) -> Optional[Dict]:
        """Get college by ID"""
        pass
    
    @abstractmethod
    async def create(self, college_data: Dict) -> str:
        """Create new college, returns ID"""
        pass
    
    @abstractmethod
    async def update(self, college_id: str, updates: Dict) -> bool:
        """Update college, returns success status"""
        pass
    
    @abstractmethod
    async def delete(self, college_id: str) -> bool:
        """Delete college"""
        pass
```

### Repository Classes Implemented

**MySQL Implementations** (`resume_pipeline/repos/mysql_impl.py`):
- `MySQLCollegeRepository`
- `MySQLJobRepository`
- `MySQLUserRepository`
- `MySQLApplicantRepository`
- `MySQLRecommendationRepository`
- `MySQLCreditRepository`
- `MySQLInterviewRepository`

**Firestore Implementations** (`resume_pipeline/repos/firestore_impl.py`):
- `FirestoreCollegeRepository`
- `FirestoreJobRepository`
- `FirestoreUserRepository`
- `FirestoreApplicantRepository`
- `FirestoreRecommendationRepository`
- `FirestoreCreditRepository`
- `FirestoreInterviewRepository`

### Database Factory

```python
class DatabaseFactory:
    @classmethod
    def get_backend(cls) -> str:
        """Returns 'local' or 'cloud' based on APP_ENV"""
        env = os.getenv("APP_ENV", "local").lower()
        return env
    
    @classmethod
    def get_college_repository(cls):
        """Returns appropriate repository class"""
        backend = cls.get_backend()
        if backend == 'local':
            return MySQLCollegeRepository
        else:
            return FirestoreCollegeRepository
```

---

## Operations (CRUD)

### Create

#### MySQL
```python
# Using SQLAlchemy
college = College(
    name="IIT Bombay",
    location="Mumbai",
    ranking=1,
    website="https://www.iitb.ac.in"
)
db.add(college)
db.commit()
return str(college.id)
```

#### Firestore
```python
# Using firebase-admin
doc_ref = db.collection('colleges').add({
    'name': 'IIT Bombay',
    'location': 'Mumbai',
    'ranking': 1,
    'website': 'https://www.iitb.ac.in',
    'created_at': datetime.now()
})
return doc_ref[1].id  # Returns document ID
```

### Read (By ID)

#### MySQL
```python
# Using SQLAlchemy
college = db.query(College).filter(College.id == 1).first()
if college:
    return {
        'id': str(college.id),
        'name': college.name,
        'location': college.location,
        ...
    }
```

#### Firestore
```python
# Using firebase-admin
doc = db.collection('colleges').document('college_id').get()
if doc.exists:
    data = doc.to_dict()
    data['id'] = doc.id
    return data
return None
```

### Read (List All)

#### MySQL
```python
# With pagination
colleges = db.query(College).limit(100).offset(0).all()
return [
    {
        'id': str(c.id),
        'name': c.name,
        'location': c.location,
        ...
    }
    for c in colleges
]
```

#### Firestore
```python
# With pagination
docs = db.collection('colleges').limit(100).offset(0).stream()
colleges = []
for doc in docs:
    data = doc.to_dict()
    data['id'] = doc.id
    colleges.append(data)
return colleges
```

### Update

#### MySQL
```python
db.query(College).filter(College.id == 1).update({
    'ranking': 2,
    'website': 'https://new-website.com'
})
db.commit()
return True
```

#### Firestore
```python
db.collection('colleges').document('college_id').update({
    'ranking': 2,
    'website': 'https://new-website.com',
    'updated_at': datetime.now()
})
return True
```

### Delete

#### MySQL
```python
db.query(College).filter(College.id == 1).delete()
db.commit()
return True
```

#### Firestore
```python
db.collection('colleges').document('college_id').delete()
return True
```

---

## Queries & Examples

### Complex Queries

#### MySQL - JOINs & Relationships

```python
# Get all college recommendations for an applicant with college details
recommendations = db.query(
    CollegeRecommendation,
    College
).join(
    College, CollegeRecommendation.college_id == College.id
).filter(
    CollegeRecommendation.applicant_id == applicant_id
).order_by(
    CollegeRecommendation.score.desc()
).all()

# Result: List of (CollegeRecommendation, College) tuples
for rec, college in recommendations:
    print(f"{college.name} - Score: {rec.score}")
```

#### Firestore - Denormalization

```python
# Firestore doesn't support JOINs, so data is denormalized
# Store college details in recommendation document

db.collection('college_recommendations').add({
    'applicant_id': applicant_id,
    'college_id': college_id,
    # Denormalized fields (duplicated for fast reads)
    'college_name': 'IIT Bombay',
    'college_location': 'Mumbai',
    'college_ranking': 1,
    # Other recommendation fields
    'score': 95,
    'status': 'recommended',
    'created_at': datetime.now()
})

# Query directly without JOIN
docs = db.collection('college_recommendations').where(
    'applicant_id', '==', applicant_id
).order_by('score', direction='DESCENDING').stream()

recommendations = [doc.to_dict() for doc in docs]
```

### Filtering & Search

#### MySQL - Find Colleges by Location
```python
colleges = db.query(College).filter(
    College.location == "Mumbai"
).all()
```

#### Firestore - Find Colleges by Location
```python
docs = db.collection('colleges').where(
    'location', '==', 'Mumbai'
).stream()
colleges = [doc.to_dict() for doc in docs]
```

#### MySQL - Find Active Jobs
```python
from datetime import datetime

active_jobs = db.query(Job).filter(
    Job.status == 'approved',
    Job.expires_at > datetime.now()
).all()
```

#### Firestore - Find Active Jobs
```python
from datetime import datetime

docs = db.collection('jobs').where(
    'status', '==', 'approved'
).where(
    'expires_at', '>', datetime.now()
).stream()
active_jobs = [doc.to_dict() for doc in docs]
```

### Aggregations

#### MySQL - Count Recommendations by Status
```python
from sqlalchemy import func

counts = db.query(
    CollegeRecommendation.status,
    func.count(CollegeRecommendation.id).label('count')
).group_by(
    CollegeRecommendation.status
).all()

# Result: [('recommended', 45), ('applied', 12), ('accepted', 3)]
```

#### Firestore - Count Recommendations (Client-side)
```python
# Firestore doesn't support aggregations in queries
# Must count client-side

docs = db.collection('college_recommendations').stream()
counts = {}
for doc in docs:
    status = doc.get('status')
    counts[status] = counts.get(status, 0) + 1

# Result: {'recommended': 45, 'applied': 12, 'accepted': 3}
```

### Transactions

#### MySQL - Atomic Updates
```python
try:
    # Deduct credits
    user = db.query(CreditAccount).filter(
        CreditAccount.user_id == user_id
    ).first()
    user.balance -= 10
    
    # Create transaction log
    log = CreditTransaction(
        user_id=user_id,
        transaction_type='spend',
        amount=10,
        reason='interview_session'
    )
    db.add(log)
    
    # Commit both together (atomic)
    db.commit()
    
except Exception as e:
    db.rollback()
    raise
```

#### Firestore - Limited Transactions
```python
# Firestore supports transactions within a single collection
# For cross-collection, use client-side consistency

# Deduct credits (separate operations)
db.collection('credit_accounts').document(user_id).update({
    'balance': firestore.Increment(-10)
})

# Create transaction log
db.collection('credit_transactions').add({
    'user_id': user_id,
    'transaction_type': 'spend',
    'amount': 10,
    'reason': 'interview_session',
    'created_at': datetime.now()
})
```

---

## Firestore Setup

### Prerequisites

1. **GCP Account**: https://cloud.google.com/free
2. **gcloud CLI**: https://cloud.google.com/sdk/docs/install
3. **Project**: Create GCP project (e.g., `resume-app-10864`)

### Step 1: Enable Firestore API

```powershell
# Set project
gcloud config set project resume-app-10864

# Enable Firestore API
gcloud services enable firestore.googleapis.com
```

### Step 2: Create Firestore Database

```powershell
# Create database in asia-south1 region
gcloud firestore databases create `
  --location=asia-south1 `
  --type=firestore-native
```

**Verify**:
```powershell
gcloud firestore databases list
```

### Step 3: Set Up Authentication

```powershell
# Use Application Default Credentials
gcloud auth application-default login

# This creates ~/.config/gcloud/application_default_credentials.json
# Cloud Run automatically uses this without explicit configuration
```

### Step 4: Seed Sample Data

```powershell
# Run seeding script
cd resume_pipeline
python scripts/seed_firestore.py
```

**Script Content** (`scripts/seed_firestore.py`):
```python
from google.cloud import firestore
from datetime import datetime, timedelta

def seed_firestore():
    db = firestore.Client()
    
    # Create users
    for i in range(1, 4):
        db.collection('users').document(f'user{i}').set({
            'email': f'user{i}@example.com',
            'role': 'student',
            'is_verified': True,
            'created_at': datetime.now()
        })
    
    # Create colleges
    for i in range(1, 4):
        db.collection('colleges').document(f'college{i}').set({
            'name': f'College {i}',
            'location': 'Mumbai',
            'ranking': i,
            'website': f'https://college{i}.com',
            'programs': ['B.Tech', 'M.Tech'],
            'created_at': datetime.now()
        })
    
    # Create jobs
    for i in range(1, 4):
        db.collection('jobs').document(f'job{i}').set({
            'title': f'Job {i}',
            'company': 'Tech Company',
            'location': 'Bangalore',
            'status': 'approved',
            'expires_at': datetime.now() + timedelta(days=30),
            'created_at': datetime.now()
        })
    
    print("✅ Firestore seeded successfully")

if __name__ == "__main__":
    seed_firestore()
```

### Step 5: View Data

**Firebase Console**:
```
https://console.firebase.google.com/project/resume-app-10864/firestore
```

**gcloud CLI**:
```powershell
# List documents
gcloud firestore documents list users --limit 5

# Get specific document
gcloud firestore documents get users/user1

# Query documents
gcloud firestore documents query colleges --where location==Mumbai
```

---

## MySQL Setup

### Prerequisites

1. **MySQL Server**: Version 8.0+
2. **MySQL Client**: Command-line tools

### Option A: Docker (Recommended)

```powershell
# Create and run container
docker run -d `
  --name career-mysql `
  -e MYSQL_ROOT_PASSWORD=rootpassword `
  -e MYSQL_DATABASE=career_guidance `
  -e MYSQL_USER=career_user `
  -e MYSQL_PASSWORD=yourpassword `
  -p 3306:3306 `
  -v mysql_data:/var/lib/mysql `
  mysql:8.0

# Verify running
docker ps | Select-String career-mysql

# View logs
docker logs career-mysql

# Stop container
docker stop career-mysql

# Start container
docker start career-mysql
```

### Option B: Manual Installation

1. **Download**: https://dev.mysql.com/downloads/installer/
2. **Install**: Follow installer prompts
3. **Create Database**:
   ```sql
   CREATE DATABASE career_guidance;
   CREATE USER 'career_user'@'localhost' IDENTIFIED BY 'yourpassword';
   GRANT ALL PRIVILEGES ON career_guidance.* TO 'career_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Step 1: Configure Connection

**`.env` file**:
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=career_user
MYSQL_PASSWORD=yourpassword
MYSQL_DB=career_guidance
```

### Step 2: Initialize Database

```powershell
# Create all tables
python scripts/init_db.py

# Verify tables created
mysql -h localhost -u career_user -p career_guidance -e "SHOW TABLES;"
```

### Step 3: Seed Sample Data

```powershell
# Load sample data
python scripts/seed_database.py

# Verify data
mysql -h localhost -u career_user -p career_guidance -e "SELECT COUNT(*) FROM colleges;"
```

### Common Commands

```powershell
# Connect to MySQL
mysql -h localhost -u career_user -p career_guidance

# Show databases
SHOW DATABASES;

# Show tables
SHOW TABLES;

# Describe table
DESCRIBE colleges;

# Query data
SELECT * FROM applicants LIMIT 5;

# Count records
SELECT COUNT(*) FROM colleges;
```

---

## Data Migration

### MySQL → Firestore

```python
from google.cloud import firestore
from resume_pipeline.db import SessionLocal, College

def migrate_colleges_to_firestore():
    """Migrate college data from MySQL to Firestore"""
    
    # Connect to both databases
    mysql_session = SessionLocal()
    firestore_db = firestore.Client()
    
    # Fetch all colleges from MySQL
    mysql_colleges = mysql_session.query(College).all()
    
    migrated = 0
    for college in mysql_colleges:
        # Convert SQLAlchemy model to dict
        college_data = {
            'name': college.name,
            'location': college.location,
            'ranking': college.ranking,
            'website': college.website,
            'programs': college.programs,
            'created_at': college.created_at,
            'updated_at': college.updated_at
        }
        
        # Add to Firestore
        firestore_db.collection('colleges').document(
            f'college_{college.id}'
        ).set(college_data)
        
        migrated += 1
        print(f"✅ Migrated: {college.name}")
    
    print(f"\n✅ Migration complete: {migrated} colleges")

if __name__ == "__main__":
    migrate_colleges_to_firestore()
```

### Firestore → MySQL

```python
from google.cloud import firestore
from resume_pipeline.db import SessionLocal, College

def migrate_colleges_from_firestore():
    """Migrate college data from Firestore to MySQL"""
    
    # Connect to both databases
    firestore_db = firestore.Client()
    mysql_session = SessionLocal()
    
    # Fetch all colleges from Firestore
    docs = firestore_db.collection('colleges').stream()
    
    migrated = 0
    for doc in docs:
        data = doc.to_dict()
        
        # Create MySQL record
        college = College(
            name=data['name'],
            location=data['location'],
            ranking=data['ranking'],
            website=data['website'],
            programs=data['programs'],
            created_at=data['created_at'],
            updated_at=data['updated_at']
        )
        
        mysql_session.add(college)
        migrated += 1
        print(f"✅ Migrated: {data['name']}")
    
    mysql_session.commit()
    print(f"\n✅ Migration complete: {migrated} colleges")

if __name__ == "__main__":
    migrate_colleges_from_firestore()
```

---

## Best Practices

### 1. Use Repository Pattern

```python
# ✅ GOOD: Use repository
college_repo = get_college_repo()
colleges = await college_repo.list_all()

# ❌ BAD: Direct database access
colleges = db.query(College).all()
```

**Benefits**:
- Database-agnostic
- Easy to test (mock repositories)
- Single source of change

### 2. Handle NULL/Missing Values

#### MySQL
```python
# SQLAlchemy handles NULL automatically
college = db.query(College).filter(College.id == 1).first()
if college is None:
    handle_not_found()
```

#### Firestore
```python
# Firestore returns None if document doesn't exist
doc = db.collection('colleges').document('id').get()
if not doc.exists:
    handle_not_found()
```

### 3. Pagination for Large Result Sets

#### MySQL
```python
def get_colleges_paginated(page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    colleges = db.query(College).limit(page_size).offset(offset).all()
    total = db.query(College).count()
    return {
        'items': colleges,
        'total': total,
        'page': page,
        'page_size': page_size
    }
```

#### Firestore
```python
def get_colleges_paginated(page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    docs = db.collection('colleges').limit(page_size).offset(offset).stream()
    colleges = [doc.to_dict() for doc in docs]
    
    # To get total, query all (expensive)
    # Firestore doesn't efficiently count documents
    all_docs = db.collection('colleges').stream()
    total = sum(1 for _ in all_docs)
    
    return {
        'items': colleges,
        'total': total,
        'page': page,
        'page_size': page_size
    }
```

### 4. Denormalization for Firestore

```python
# ❌ DON'T: Store college_id only
db.collection('recommendations').add({
    'applicant_id': app_id,
    'college_id': college_id,  # Requires separate lookup
    'score': 95
})

# ✅ DO: Include frequently accessed fields
db.collection('recommendations').add({
    'applicant_id': app_id,
    'college_id': college_id,
    'college_name': 'IIT Bombay',  # Denormalized
    'college_location': 'Mumbai',   # Denormalized
    'score': 95
})
```

### 5. Indexing

#### MySQL
```python
# Indexes defined in SQLAlchemy models
class College(Base):
    __tablename__ = "colleges"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(200), index=True)
    location = Column(String(100), index=True)
    ranking = Column(Integer, index=True)
```

#### Firestore
```
# Firestore automatically indexes all fields
# For composite queries, indexes are created on demand
# Or pre-create in Firestore console:
# Collection: colleges
# Fields: location (Ascending), ranking (Ascending)
```

### 6. Error Handling

```python
try:
    college_repo = get_college_repo()
    college = await college_repo.get_by_id(college_id)
    
    if not college:
        raise HTTPException(status_code=404, detail="College not found")
    
    return college

except ValueError as e:
    # Input validation error
    raise HTTPException(status_code=400, detail=str(e))
    
except Exception as e:
    # Unexpected error
    logger.error(f"Database error: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

### 7. Caching

```python
from functools import lru_cache
from datetime import datetime, timedelta

# Cache colleges for 5 minutes
_cache = {}
_cache_expiry = {}

async def get_colleges_cached():
    key = 'all_colleges'
    
    if key in _cache and datetime.now() < _cache_expiry[key]:
        logger.info("Cache hit: colleges")
        return _cache[key]
    
    logger.info("Cache miss: fetching from database")
    college_repo = get_college_repo()
    colleges = await college_repo.list_all()
    
    _cache[key] = colleges
    _cache_expiry[key] = datetime.now() + timedelta(minutes=5)
    
    return colleges
```

### 8. Logging

```python
import logging

logger = logging.getLogger(__name__)

async def create_college(data: Dict):
    logger.info(f"Creating college: {data['name']}")
    
    try:
        college_repo = get_college_repo()
        college_id = await college_repo.create(data)
        logger.info(f"✅ College created: {college_id}")
        return college_id
    
    except Exception as e:
        logger.error(f"❌ Failed to create college: {e}")
        raise
```

---

## References

- **SQLAlchemy ORM**: https://docs.sqlalchemy.org/
- **Firestore Documentation**: https://firebase.google.com/docs/firestore
- **MySQL Reference**: https://dev.mysql.com/doc/
- **Repository Pattern**: https://martinfowler.com/eaaCatalog/repository.html

---

**Last Updated**: January 23, 2026  
**Database Version**: 2.0  
**Status**: ✅ Production Ready
