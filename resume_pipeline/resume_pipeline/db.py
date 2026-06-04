from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, JSON, Boolean, Enum,
    ForeignKey, Index, UniqueConstraint, create_engine
)
from sqlalchemy.engine import URL as SA_URL
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from .config import settings, IS_SUPABASE
import datetime
import os
import uuid

# pgvector SQLAlchemy integration — provides the Vector column type.
# If pgvector Python binding is not installed, fall back gracefully to JSON.
try:
    from pgvector.sqlalchemy import Vector as _PGVector  # type: ignore
    _PGVECTOR_AVAILABLE = True
except ImportError:
    _PGVECTOR_AVAILABLE = False
    _PGVector = None  # type: ignore
    import warnings
    warnings.warn(
        "pgvector Python binding not installed. "
        "Run: pip install pgvector  "
        "The embedding column will be defined as JSON until the binding is installed.",
        ImportWarning,
        stacklevel=1,
    )

# Gemini text-embedding-004 outputs 3072-dimensional vectors.
# Helper: use Vector(3072) if pgvector is available, else fall back to JSON.
GEMINI_EMBEDDING_DIM = 3072

def _vector_column(dim: int = GEMINI_EMBEDDING_DIM) -> Column:
    if _PGVECTOR_AVAILABLE and _PGVector is not None:
        return Column(_PGVector(dim), nullable=True)
    return Column(JSON, nullable=True)  # fallback — no ANN index support

Base = declarative_base()

# ============================================================
# COMMON / CORE TABLES
# ============================================================

class User(Base):
    """Portal accounts (students, employers, and admins)"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('student', 'employer', 'admin', name='user_role'), default='student')
    name = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True, unique=True, index=True)
    verification_token_created_at = Column(DateTime, nullable=True)
    password_reset_token = Column(String(255), nullable=True, unique=True, index=True)
    password_reset_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='user', uselist=False, cascade='all, delete-orphan')
    employer = relationship('Employer', back_populates='user', uselist=False, cascade='all, delete-orphan')
    audit_logs = relationship('AuditLog', back_populates='user', cascade='all, delete-orphan')
    human_reviews = relationship('HumanReview', back_populates='reviewer', foreign_keys='HumanReview.reviewer_id')


class Applicant(Base):
    """Student profile (linked to uploads & parsed data)"""
    __tablename__ = 'applicants'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
    applicant_id = Column(String(64), unique=True, index=True)  # Legacy compatibility
    display_name = Column(String(200))
    location_city = Column(String(100), index=True)
    location_state = Column(String(100))
    country = Column(String(100), default='India')
    preferred_locations = Column(JSON, nullable=True)  # Array of city/state
    candidate_profile = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship('User', back_populates='applicant')
    uploads = relationship('Upload', back_populates='applicant', cascade='all, delete-orphan')
    parsed_record = relationship('LLMParsedRecord', back_populates='applicant', uselist=False, cascade='all, delete-orphan')
    embeddings = relationship('EmbeddingsIndex', back_populates='applicant', cascade='all, delete-orphan')
    job_recommendations = relationship('JobRecommendation', back_populates='applicant', cascade='all, delete-orphan')
    job_applications = relationship('JobApplication', back_populates='applicant', cascade='all, delete-orphan')
    human_reviews = relationship('HumanReview', back_populates='applicant', cascade='all, delete-orphan')
    interview_sessions = relationship('InterviewSession', back_populates='applicant', cascade='all, delete-orphan')
    skill_assessments = relationship('SkillAssessment', back_populates='applicant', cascade='all, delete-orphan')
    learning_paths = relationship('LearningPath', back_populates='applicant', cascade='all, delete-orphan')
    credit_account = relationship('CreditAccount', uselist=False, cascade='all, delete-orphan')


class Upload(Base):
    """Store raw files & hashes"""
    __tablename__ = 'uploads'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    file_name = Column(String(255))
    file_type = Column(Enum('resume', 'marksheet', 'other', name='file_type'))
    storage_path = Column(String(1024))
    file_hash = Column(String(64), unique=True, index=True)
    ocr_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='uploads')


class LLMParsedRecord(Base):
    """Normalized LLM output + provenance (replaces ResumeParsed)"""
    __tablename__ = 'llm_parsed_records'
    
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), primary_key=True)
    raw_llm_output = Column(JSON, nullable=False)  # Store raw for audit
    normalized = Column(JSON, nullable=False)  # Validated shape
    field_confidences = Column(JSON, nullable=True)  # Per-field confidences (legacy)
    per_section_confidence = Column(JSON, nullable=True)  # Per-section heuristic scores (redesign)
    llm_provenance = Column(JSON, nullable=True)  # Model name, tokens, call id
    needs_review = Column(Boolean, default=False, index=True)
    # State machine status: 'processing' | 'accepted' | 'pending_review' | 'failed'
    parse_status = Column(String(32), default='accepted', index=True)
    # Skills that fell through both normalization passes — not discarded, stored for taxonomy growth
    unrecognized_skills = Column(JSON, nullable=True)  # [{"name": "K8s", "raw": "K8s"}]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='parsed_record')


class EmbeddingsIndex(Base):
    """Reference between applicant and external vector store"""
    __tablename__ = 'embeddings_index'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    vector_store_id = Column(String(128), nullable=True)
    vector_type = Column(String(50))  # e.g., 'resume_summary', 'skills'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='embeddings')


class ApplicantEmbedding(Base):
    """Persisted applicant embedding generated asynchronously by worker."""
    __tablename__ = 'applicant_embeddings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    embedding_vector = _vector_column(GEMINI_EMBEDDING_DIM)  # vector(3072) via pgvector
    embedding_provider = Column(String(32), nullable=True)
    embedding_model = Column(String(128), nullable=True)
    source_hash = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    applicant = relationship('Applicant')

    __table_args__ = (
        UniqueConstraint('applicant_id', 'embedding_model', name='uq_applicant_embeddings_applicant_model'),
    )


class JobEmbedding(Base):
    """Persisted job embedding generated asynchronously by worker."""
    __tablename__ = 'job_embeddings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    embedding_vector = _vector_column(GEMINI_EMBEDDING_DIM)  # vector(3072) via pgvector
    embedding_provider = Column(String(32), nullable=True)
    embedding_model = Column(String(128), nullable=True)
    source_hash = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    job = relationship('Job')


class JobEmbeddingsCache(Base):
    """Cached job embeddings for the redesigned recommendation engine."""
    __tablename__ = 'job_embeddings_cache'

    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), primary_key=True)
    embedding = _vector_column(GEMINI_EMBEDDING_DIM)  # vector(3072) via pgvector
    computed_at = Column(DateTime, default=datetime.datetime.utcnow)

    job = relationship('Job')


# ============================================================
# JOB-SIDE TABLES
# ============================================================

class Employer(Base):
    """Companies/Employers (linked to user accounts)"""
    __tablename__ = 'employers'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    company_name = Column(String(255), nullable=False)
    website = Column(String(512), nullable=True)
    location_city = Column(String(100))
    location_state = Column(String(100))
    description = Column(Text, nullable=True)
    logo_url = Column(String(512), nullable=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship('User', back_populates='employer')
    jobs = relationship('Job', back_populates='employer', cascade='all, delete-orphan')


class Job(Base):
    """Job postings (requires admin approval)"""
    __tablename__ = 'jobs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    employer_id = Column(Integer, ForeignKey('employers.id', ondelete='CASCADE'), nullable=False, index=True)
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
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    employer = relationship('Employer', back_populates='jobs')
    reviewer = relationship('User', foreign_keys=[reviewed_by])
    meta = relationship('JobMetadata', back_populates='job', uselist=False, cascade='all, delete-orphan')
    recommendations = relationship('JobRecommendation', back_populates='job', cascade='all, delete-orphan')
    applications = relationship('JobApplication', back_populates='job', cascade='all, delete-orphan')
    learning_paths = relationship('LearningPath', back_populates='job', cascade='all, delete-orphan')


class JobMetadata(Base):
    """Job enrichment + embeddings"""
    __tablename__ = 'job_metadata'
    
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), primary_key=True)
    vector_store_id = Column(String(128), nullable=True)
    tags = Column(JSON, nullable=True)  # ["ml", "backend"]
    popularity = Column(Float, nullable=True)
    
    # Relationships
    job = relationship('Job', back_populates='meta')


class JobRecommendation(Base):
    """System-generated job recommendations"""
    __tablename__ = 'job_recommendations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True)
    score = Column(Float)
    scoring_breakdown = Column(JSON, nullable=True)  # skill_score, acad_score, geo_score
    explain = Column(JSON, nullable=True)  # Structured explanation
    status = Column(Enum('recommended', 'viewed', 'dismissed', name='job_rec_status'), default='recommended')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    score_breakdown = Column(JSON, nullable=True)
    explanation = Column(Text, nullable=True)
    computed_at = Column(DateTime, default=datetime.datetime.utcnow)
    engine_version = Column(String(10), default='v2')
    is_saved = Column(Boolean, default=False)
    is_fallback = Column(Boolean, default=False, nullable=False)
    fallback_source = Column(String(100), nullable=True)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='job_recommendations')
    job = relationship('Job', back_populates='recommendations')
    
    __table_args__ = (
        Index('idx_applicant_job', 'applicant_id', 'job_id'),
    )


class UserFeedback(Base):
    """User interactions (clicks, applies, saves, dismissals) for personalization."""
    __tablename__ = 'user_feedback'

    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True)
    action_type = Column(String(20), nullable=False)  # 'click', 'apply', 'dismiss', 'save'
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    applicant = relationship('Applicant')
    job = relationship('Job')


class JobApplication(Base):
    """Student applications to jobs"""
    __tablename__ = 'job_applications'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True)
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
    
    # Relationships
    applicant = relationship('Applicant', back_populates='job_applications')
    job = relationship('Job', back_populates='applications')
    
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
    # pgvector embedding for semantic skill normalization (Pass 2)
    # Populated once by seed_skill_embeddings.py, updated when new skills are added.
    embedding = _vector_column(768)


class AuditLog(Base):
    """Generic LLM / pipeline logs and user action audit trail"""
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50))  # 'applicant' or 'job' (legacy)
    entity_id = Column(Integer, index=True)  # Legacy field
    action = Column(String(100), index=True)
    payload = Column(JSON, nullable=True)  # Legacy field
    # New fields for user action auditing
    target_type = Column(String(50), nullable=True)  # 'JobRecommendation' or 'Job'
    target_id = Column(Integer, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    details = Column(JSON, nullable=True)  # New structured details
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    # Relationships
    user = relationship('User', back_populates='audit_logs')


class HumanReview(Base):
    """Human-in-loop corrections"""
    __tablename__ = 'human_reviews'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    field = Column(String(128))
    original_value = Column(Text)
    corrected_value = Column(Text)
    reviewer_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='human_reviews')
    reviewer = relationship('User', back_populates='human_reviews', foreign_keys=[reviewer_id])


# ============================================================
# INTERVIEW SYSTEM (v2 — Groq-powered, text-based, UUID PKs)
# ============================================================

class InterviewSession(Base):
    """Mock interview sessions — pre-generated questions, background evaluation."""
    __tablename__ = 'interview_sessions'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)

    # Configuration
    interview_type = Column(String(20), nullable=False)   # technical | hr | behavioral | mixed
    difficulty = Column(String(10), nullable=False)        # easy | medium | hard
    total_questions = Column(Integer, nullable=False)      # N configured + reserve pool
    voice_mode = Column(Boolean, default=False)
    topic_focus = Column(String(255), nullable=True)       # Optional user-specified focus
    interviewer_persona = Column(String(50), nullable=True, default="Friendly Senior Engineer")

    # Status
    status = Column(
        Enum('active', 'completed', 'abandoned', name='interview_session_status_v2'),
        default='active',
        index=True,
    )

    # Scoring — populated once all evaluations are complete
    overall_score = Column(Float, nullable=True)
    study_plan = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    applicant = relationship('Applicant', back_populates='interview_sessions')
    questions = relationship('InterviewQuestion', back_populates='session', cascade='all, delete-orphan')
    answers = relationship('InterviewAnswer', back_populates='session', cascade='all, delete-orphan')


class InterviewQuestion(Base):
    """Pre-generated interview questions — one Groq call per session."""
    __tablename__ = 'interview_questions'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False, index=True)

    # Position in interview
    order_index = Column(Integer, nullable=False)          # 0-based; reserve questions have high indices
    is_reserve = Column(Boolean, default=False)            # True for adaptive pool questions
    is_followup = Column(Boolean, default=False)

    # Question content
    question_text = Column(Text, nullable=False)
    skill_tag = Column(String(128), nullable=False, index=True)  # e.g. 'React', 'System Design'
    difficulty_level = Column(String(10), nullable=False)  # may differ from session default (adaptive)
    expected_keywords = Column(JSON, nullable=True)        # list of key concepts
    question_type = Column(String(20), default='open_ended')  # conceptual | practical | scenario

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship('InterviewSession', back_populates='questions')
    answer = relationship('InterviewAnswer', back_populates='question', uselist=False, cascade='all, delete-orphan')


class InterviewAnswer(Base):
    """Candidate answers — evaluated asynchronously by Groq in background."""
    __tablename__ = 'interview_answers'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey('interview_questions.id', ondelete='CASCADE'), nullable=False, index=True)

    # Answer content
    answer_text = Column(Text, nullable=True)

    # Evaluation — populated by background task
    score = Column(Float, nullable=True)            # 0.0 to 1.0
    feedback = Column(Text, nullable=True)          # AI narrative feedback
    strength = Column(Text, nullable=True)          # What candidate did well
    missing_concepts = Column(JSON, nullable=True)  # List of concepts not covered
    hint_for_next = Column(Text, nullable=True)     # Optional nudge for next question
    status = Column(
        Enum('pending_evaluation', 'evaluated', 'evaluation_failed', name='answer_eval_status'),
        default='pending_evaluation',
        index=True,
    )

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    evaluated_at = Column(DateTime, nullable=True)

    # Relationships
    session = relationship('InterviewSession', back_populates='answers')
    question = relationship('InterviewQuestion', back_populates='answer')

    __table_args__ = (
        UniqueConstraint('session_id', 'question_id', name='uq_session_question_answer_v2'),
    )


class SkillAssessment(Base):
    """Skill-specific assessments - optional MCQ quizzes"""
    __tablename__ = 'skill_assessments'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    skill_name = Column(String(128), nullable=False, index=True)  # "DBMS", "Java", "Python"
    assessment_type = Column(Enum('mcq', 'coding', 'mixed', name='assessment_type'), default='mcq')
    
    # Scoring
    total_questions = Column(Integer, nullable=False)
    correct_answers = Column(Integer, nullable=False)
    score_percentage = Column(Float, nullable=False)  # 0-100
    
    # Proficiency level based on score
    proficiency = Column(Enum('beginner', 'intermediate', 'advanced', 'expert', name='proficiency'), nullable=True)
    
    # Timing
    time_limit_seconds = Column(Integer, nullable=True)  # 1800 for 30 min
    time_taken_seconds = Column(Integer, nullable=True)
    
    # Results
    questions_data = Column(JSON, nullable=True)  # Store question/answer pairs
    skill_breakdown = Column(JSON, nullable=True)  # {"sql_queries": 80, "normalization": 60}
    
    completed_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='skill_assessments')
    
    __table_args__ = (
        Index('idx_applicant_skill', 'applicant_id', 'skill_name'),
    )


class LearningPath(Base):
    """Personalized learning recommendations based on skill gaps"""
    __tablename__ = 'learning_paths'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True, index=True)
    
    # Source of learning path
    generated_from = Column(Enum('interview', 'assessment', 'manual', 'job', name='path_source'), default='interview')
    # source_session_id kept as nullable Integer for backward compatibility;
    # new interview sessions use UUID strings so new learning paths set this to NULL.
    source_session_id = Column(Integer, nullable=True)

    # Path details
    skill_gaps = Column(JSON, nullable=False)  # {"python": "weak", "dsa": "moderate", "dbms": "weak"}
    recommended_courses = Column(JSON, nullable=True)  # [{"title": "...", "url": "...", "provider": "Udemy"}]
    recommended_projects = Column(JSON, nullable=True)  # [{"title": "...", "description": "..."}]
    practice_problems = Column(JSON, nullable=True)  # Coding problems from Google Search
    topics_outline = Column(JSON, nullable=True)  # Structured topics tree with videos/resources

    # Priority areas
    priority_skills = Column(JSON, nullable=True)  # ["DSA", "DBMS"] - top 3 skills to focus on

    # Status tracking
    status = Column(Enum('active', 'in_progress', 'completed', name='path_status'), default='active')
    progress_percentage = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    applicant = relationship('Applicant', back_populates='learning_paths')
    job = relationship('Job', back_populates='learning_paths')


# ============================================================
# CREDIT SYSTEM & QUOTA MANAGEMENT
# ============================================================

class CreditAccount(Base):
    """Tracks interview credits for each applicant"""
    __tablename__ = 'credit_accounts'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    
    # Credit balance
    current_credits = Column(Integer, default=60, nullable=False)  # Default 60 credits
    total_earned = Column(Integer, default=60, nullable=False)  # Lifetime earned
    total_spent = Column(Integer, default=0, nullable=False)  # Lifetime spent
    
    # Refill tracking
    last_refill_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    next_refill_at = Column(DateTime, nullable=False)  # Auto-calculated
    weekly_credit_limit = Column(Integer, default=60, nullable=False)  # Configurable by admin
    
    # Premium status
    is_premium = Column(Boolean, default=False)
    premium_expires_at = Column(DateTime, nullable=True)
    
    # Admin adjustments
    admin_bonus_credits = Column(Integer, default=0)  # Admin can add bonus credits
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    transactions = relationship('CreditTransaction', back_populates='account', cascade='all, delete-orphan')
    usage_stats = relationship('CreditUsageStats', back_populates='account', uselist=False, cascade='all, delete-orphan')


class CreditTransaction(Base):
    """Log of all credit transactions"""
    __tablename__ = 'credit_transactions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('credit_accounts.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Transaction details
    transaction_type = Column(Enum('spend', 'refill', 'bonus', 'refund', name='transaction_type'), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # Positive for earn, negative for spend
    balance_after = Column(Integer, nullable=False)
    
    # Context
    activity_type = Column(Enum(
        'full_interview', 'micro_session', 'coding_question', 
        'project_idea', 'weekly_refill', 'admin_adjustment',
        'learning_path_generation', 'recommendation_refresh',
        name='activity_type'
    ), nullable=True, index=True)
    
    reference_id = Column(Integer, nullable=True)  # Links to session/assessment ID
    reference_type = Column(String(50), nullable=True)  # 'interview_session', 'skill_assessment'
    
    description = Column(String(255), nullable=True)
    transaction_metadata = Column(JSON, nullable=True)  # Additional context (renamed from metadata to avoid SQLAlchemy conflict)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    # Relationships
    account = relationship('CreditAccount', back_populates='transactions')
    
    __table_args__ = (
        Index('idx_account_type_date', 'account_id', 'activity_type', 'created_at'),
    )


class CreditUsageStats(Base):
    """Rolling usage statistics for rate limiting"""
    __tablename__ = 'credit_usage_stats'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey('credit_accounts.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    
    # Daily stats (reset at midnight)
    credits_used_today = Column(Integer, default=0)
    micro_sessions_today = Column(Integer, default=0)
    coding_questions_today = Column(Integer, default=0)
    last_daily_reset = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Weekly stats (reset every 7 days)
    credits_used_this_week = Column(Integer, default=0)
    full_interviews_this_week = Column(Integer, default=0)
    project_ideas_this_week = Column(Integer, default=0)
    last_weekly_reset = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Session timestamps for cooldowns
    last_full_interview_at = Column(DateTime, nullable=True)
    last_micro_session_at = Column(DateTime, nullable=True)
    last_coding_question_at = Column(DateTime, nullable=True)
    
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    account = relationship('CreditAccount', back_populates='usage_stats')


class SystemConfiguration(Base):
    """Admin-configurable system settings"""
    __tablename__ = 'system_configurations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)  # Flexible value storage
    description = Column(Text, nullable=True)
    category = Column(String(50), default='general')  # 'credits', 'limits', 'costs', etc.
    
    updated_by = Column(String(100), nullable=True)  # Admin email
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    __table_args__ = (
        Index('idx_category_key', 'category', 'key'),
    )


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

if settings.PG_DSN is None:
    raise RuntimeError("PG_DSN is not set in settings; cannot create engine")

if IS_SUPABASE:
    # If a full PG_DSN or DATABASE_URL is set directly (e.g., in Render), use it.
    # Ensure it's prefixed with postgresql+psycopg2:// and has query options.
    _env_db_url = os.environ.get("DATABASE_URL") or settings.DATABASE_URL or settings.PG_DSN
    # Check if we should use this full DSN instead of building from parts.
    # We use this DSN if we don't have individual credentials (like PG_HOST).
    if _env_db_url and not os.environ.get("PG_HOST") and not settings.PG_HOST:
        dsn = _env_db_url
        if dsn.startswith("postgres://"):
            dsn = dsn.replace("postgres://", "postgresql+psycopg2://", 1)
        elif dsn.startswith("postgresql://"):
            dsn = dsn.replace("postgresql://", "postgresql+psycopg2://", 1)
        
        # Add query parameters if not present
        if "?" not in dsn:
            dsn += "?sslmode=require&gssencmode=disable"
        else:
            if "sslmode=" not in dsn:
                dsn += "&sslmode=require"
            if "gssencmode=" not in dsn:
                dsn += "&gssencmode=disable"
        engine = create_engine(dsn, echo=False, future=True)
    else:
        # Use URL.create() to avoid any string-parsing issues with special chars in username/password.
        # Read directly from OS env vars as the ultimate source of truth.
        _pg_user = os.environ.get("PG_USER") or settings.PG_USER or "postgres"
        _pg_pass = os.environ.get("PG_PASSWORD") or settings.PG_PASSWORD or ""
        _pg_host = os.environ.get("PG_HOST") or settings.PG_HOST or "localhost"
        _pg_port = int(os.environ.get("PG_PORT") or settings.PG_PORT or 5432)
        _pg_db   = os.environ.get("PG_DB")   or settings.PG_DB   or "postgres"
        _url = SA_URL.create(
            drivername="postgresql+psycopg2",
            username=_pg_user,
            password=_pg_pass,
            host=_pg_host,
            port=_pg_port,
            database=_pg_db,
            query={"sslmode": "require", "gssencmode": "disable"},
        )
        engine = create_engine(_url, echo=False, future=True)
else:
    engine = create_engine(settings.PG_DSN, echo=False, future=True)

SessionLocal = sessionmaker(bind=engine)


def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def drop_all_tables():
    """Drop all tables (use with caution!)"""
    Base.metadata.drop_all(bind=engine)
