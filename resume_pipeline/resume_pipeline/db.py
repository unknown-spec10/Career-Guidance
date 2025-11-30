from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, JSON, Boolean, Enum,
    ForeignKey, Index, UniqueConstraint, create_engine
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from .config import settings
import datetime

Base = declarative_base()

# ============================================================
# COMMON / CORE TABLES
# ============================================================

class User(Base):
    """Portal accounts (students/employers/colleges/admins)"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('student', 'employer', 'college', 'admin', name='user_role'), default='student')
    name = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True, unique=True, index=True)
    verification_token_created_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Applicant(Base):
    """Student profile (linked to uploads & parsed data)"""
    __tablename__ = 'applicants'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    applicant_id = Column(String(64), unique=True, index=True)  # Legacy compatibility
    display_name = Column(String(200))
    location_city = Column(String(100), index=True)
    location_state = Column(String(100))
    country = Column(String(100), default='India')
    preferred_locations = Column(JSON, nullable=True)  # Array of city/state
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Upload(Base):
    """Store raw files & hashes"""
    __tablename__ = 'uploads'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    file_name = Column(String(255))
    file_type = Column(Enum('resume', 'marksheet', 'other', name='file_type'))
    storage_path = Column(String(1024))
    file_hash = Column(String(64), unique=True, index=True)
    ocr_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class LLMParsedRecord(Base):
    """Normalized LLM output + provenance (replaces ResumeParsed)"""
    __tablename__ = 'llm_parsed_records'
    
    applicant_id = Column(Integer, ForeignKey('applicants.id'), primary_key=True)
    raw_llm_output = Column(JSON, nullable=False)  # Store raw for audit
    normalized = Column(JSON, nullable=False)  # Validated shape
    field_confidences = Column(JSON, nullable=True)  # Per-field confidences
    llm_provenance = Column(JSON, nullable=True)  # Model name, tokens, call id
    needs_review = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class EmbeddingsIndex(Base):
    """Reference between applicant and external vector store"""
    __tablename__ = 'embeddings_index'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    vector_store_id = Column(String(128), nullable=True)
    vector_type = Column(String(50))  # e.g., 'resume_summary', 'skills'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ============================================================
# COLLEGE-SIDE TABLES
# ============================================================

class College(Base):
    """Colleges/Universities (linked to user accounts)"""
    __tablename__ = 'colleges'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True)
    location_city = Column(String(100), index=True)
    location_state = Column(String(100))
    country = Column(String(100), default='India')
    description = Column(Text, nullable=True)
    website = Column(String(512), nullable=True)
    logo_url = Column(String(512), nullable=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class CollegeEligibility(Base):
    """Formal cutoffs & constraints"""
    __tablename__ = 'college_eligibility'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    college_id = Column(Integer, ForeignKey('colleges.id'), nullable=False, index=True)
    min_jee_rank = Column(Integer, nullable=True)
    min_cgpa = Column(Float, nullable=True)
    eligible_degrees = Column(JSON, nullable=True)  # ["BCA", "BSc"]
    reserved_category_cutoffs = Column(JSON, nullable=True)
    seats = Column(Integer, default=0)


class CollegeProgram(Base):
    """Courses/branches inside a college (requires admin approval)"""
    __tablename__ = 'college_programs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    college_id = Column(Integer, ForeignKey('colleges.id'), nullable=False, index=True)
    program_name = Column(String(255))  # e.g., "B.Tech CSE"
    duration_months = Column(Integer)
    required_skills = Column(JSON, nullable=True)
    program_description = Column(Text, nullable=True)
    status = Column(Enum('pending', 'approved', 'rejected', name='program_status'), default='pending', index=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class CollegeMetadata(Base):
    """Enrichment + embeddings pointer"""
    __tablename__ = 'college_metadata'
    
    college_id = Column(Integer, ForeignKey('colleges.id'), primary_key=True)
    canonical_skills = Column(JSON, nullable=True)  # Skills college favors
    vector_store_id = Column(String(128), nullable=True)
    popularity_score = Column(Float, nullable=True)


class CollegeApplicabilityLog(Base):
    """System-generated college recommendations"""
    __tablename__ = 'college_applicability_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    college_id = Column(Integer, ForeignKey('colleges.id'), nullable=False, index=True)
    recommend_score = Column(Float)
    explain = Column(JSON, nullable=True)  # Why recommended
    status = Column(Enum('recommended', 'viewed', 'dismissed', name='college_rec_status'), default='recommended')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    __table_args__ = (
        Index('idx_applicant_college', 'applicant_id', 'college_id'),
    )


class CollegeApplication(Base):
    """Student applications to colleges"""
    __tablename__ = 'college_applications'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    college_id = Column(Integer, ForeignKey('colleges.id'), nullable=False, index=True)
    program_id = Column(Integer, ForeignKey('college_programs.id'), nullable=True, index=True)
    statement_of_purpose = Column(Text, nullable=True)
    twelfth_percentage = Column(Float, nullable=True)
    twelfth_board = Column(String(100), nullable=True)
    twelfth_subjects = Column(JSON, nullable=True)
    status = Column(
        Enum('applied', 'under_review', 'shortlisted', 'accepted', 'rejected', 'waitlisted', 'withdrawn',
             name='college_app_status'),
        default='applied',
        index=True
    )
    college_notes = Column(Text, nullable=True)
    applied_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('applicant_id', 'college_id', 'program_id', name='uq_applicant_college_program'),
        Index('idx_college_status', 'college_id', 'status'),
    )


# ============================================================
# JOB-SIDE TABLES
# ============================================================

class Employer(Base):
    """Companies/Employers (linked to user accounts)"""
    __tablename__ = 'employers'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    company_name = Column(String(255), nullable=False)
    website = Column(String(512), nullable=True)
    location_city = Column(String(100))
    location_state = Column(String(100))
    description = Column(Text, nullable=True)
    logo_url = Column(String(512), nullable=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Job(Base):
    """Job postings (requires admin approval)"""
    __tablename__ = 'jobs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    employer_id = Column(Integer, ForeignKey('employers.id'), nullable=False, index=True)
    title = Column(String(255))
    description = Column(Text)
    location_city = Column(String(100), index=True)
    location_state = Column(String(100))
    work_type = Column(Enum('remote', 'on-site', 'hybrid', name='work_type'))
    min_experience_years = Column(Float, default=0)
    min_cgpa = Column(Float, nullable=True)
    required_skills = Column(JSON, nullable=True)  # Array of {"name", "level"}
    optional_skills = Column(JSON, nullable=True)
    status = Column(Enum('pending', 'approved', 'rejected', name='job_status'), default='pending', index=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class JobMetadata(Base):
    """Job enrichment + embeddings"""
    __tablename__ = 'job_metadata'
    
    job_id = Column(Integer, ForeignKey('jobs.id'), primary_key=True)
    vector_store_id = Column(String(128), nullable=True)
    tags = Column(JSON, nullable=True)  # ["ml", "backend"]
    popularity = Column(Float, nullable=True)


class JobRecommendation(Base):
    """System-generated job recommendations"""
    __tablename__ = 'job_recommendations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id'), nullable=False, index=True)
    score = Column(Float)
    scoring_breakdown = Column(JSON, nullable=True)  # skill_score, acad_score, geo_score
    explain = Column(JSON, nullable=True)  # Structured explanation
    status = Column(Enum('recommended', 'viewed', 'dismissed', name='job_rec_status'), default='recommended')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    __table_args__ = (
        Index('idx_applicant_job', 'applicant_id', 'job_id'),
    )


class JobApplication(Base):
    """Student applications to jobs"""
    __tablename__ = 'job_applications'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id'), nullable=False, index=True)
    cover_letter = Column(Text, nullable=True)
    status = Column(
        Enum('applied', 'under_review', 'shortlisted', 'interviewing', 'offered', 'accepted', 'rejected', 'withdrawn', 
             name='job_app_status'),
        default='applied',
        index=True
    )
    employer_notes = Column(Text, nullable=True)
    applied_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('applicant_id', 'job_id', name='uq_applicant_job_application'),
        Index('idx_job_status', 'job_id', 'status'),
    )


# ============================================================
# ADMIN / AUXILIARY TABLES
# ============================================================

class CanonicalSkill(Base):
    """Central skill ontology"""
    __tablename__ = 'canonical_skills'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), unique=True, nullable=False, index=True)
    aliases = Column(JSON, nullable=True)  # ["py", "python3"]
    category = Column(String(64))  # 'ml', 'frontend'
    market_score = Column(Float, nullable=True)
    demand_level = Column(String(32), nullable=True)


class AuditLog(Base):
    """Generic LLM / pipeline logs"""
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50))  # 'applicant', 'job', 'college'
    entity_id = Column(Integer, index=True)
    action = Column(String(100))
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class HumanReview(Base):
    """Human-in-loop corrections"""
    __tablename__ = 'human_reviews'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id'), nullable=False, index=True)
    field = Column(String(128))
    original_value = Column(Text)
    corrected_value = Column(Text)
    reviewer_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ============================================================
# LEGACY COMPATIBILITY (Keep for migration)
# ============================================================

class ResumeParsed(Base):
    """Legacy table - migrate to LLMParsedRecord"""
    __tablename__ = 'resume_parsed'
    
    id = Column(Integer, primary_key=True)
    applicant_id = Column(Integer, index=True)
    raw_gemini = Column(JSON)
    normalized = Column(JSON)
    provenance = Column(JSON)
    flags = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ============================================================
# DATABASE SETUP
# ============================================================

if settings.MYSQL_DSN is None:
    raise RuntimeError("MYSQL_DSN is not set in settings; cannot create engine")

engine = create_engine(settings.MYSQL_DSN, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine)


def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def drop_all_tables():
    """Drop all tables (use with caution!)"""
    Base.metadata.drop_all(bind=engine)
