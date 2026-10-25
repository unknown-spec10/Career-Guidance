from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, JSON, Boolean, Enum,
    ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .base import Base, _vector_column, LOCAL_EMBEDDING_DIM
import datetime


class JobEmbedding(Base):
    """Persisted job embedding generated asynchronously by worker."""
    __tablename__ = 'job_embeddings'

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, unique=True, index=True)
    embedding_vector = _vector_column(LOCAL_EMBEDDING_DIM)  # vector(384) via pgvector
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
    source_hash = Column(String(64), primary_key=True, default="")
    embedding = _vector_column(LOCAL_EMBEDDING_DIM)  # vector(384) via pgvector
    computed_at = Column(DateTime, default=datetime.datetime.utcnow)

    job = relationship('Job')


# ============================================================
# JOB-SIDE TABLES
# ============================================================

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
    status = Column(Enum('pending', 'approved', 'rejected', 'expired', name='job_status'), default='pending', index=True)
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
    # Tracking pipeline vocabulary (aligned with VALID_JOB_STATUS_TRANSITIONS in app.py
    # and the frontend ApplicationTracker board). Legacy DBs only defined the first three
    # values; widening is handled by migration 0002.
    status = Column(
        Enum('recommended', 'viewed', 'dismissed', 'applied', 'interviewing',
             'offered', 'accepted', 'rejected', 'withdrawn', name='job_rec_status'),
        default='recommended'
    )
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
# ADMIN / AUXILIARY TABLES (job-owned review trail)
# ============================================================

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
