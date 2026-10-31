from sqlalchemy import (
    Column, Integer, String, Text, DateTime, JSON, Boolean, Enum,
    ForeignKey, Index,
)
from sqlalchemy.orm import relationship
from .base import Base
import datetime


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
    profile_picture_url = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    # How this account signs in. 'password' accounts hold a real bcrypt hash;
    # provider accounts (google, later github/apple) hold the sentinel from
    # auth.OAUTH_PASSWORD_SENTINEL until the user sets a password. Keeping the
    # method on the row — rather than only inferring it from a provider id —
    # is what lets each login route decide whether it may serve this account.
    login_method = Column(String(20), nullable=False, default="password", server_default="password")
    # Stable subject id from the provider (Google `sub`). Null for password
    # accounts. A second linked provider needs a user_identities table; this
    # single column intentionally covers the one external provider we support.
    login_subject = Column(String(255), nullable=True, index=True)
    verification_token = Column(String(255), nullable=True, unique=True, index=True)
    verification_token_created_at = Column(DateTime, nullable=True)
    password_reset_token = Column(String(255), nullable=True, unique=True, index=True)
    password_reset_expires = Column(DateTime, nullable=True)
    # Set on password change/reset. JWTs issued before this instant are
    # rejected (see auth.get_current_user) so stolen tokens die with the
    # compromised credential.
    password_changed_at = Column(DateTime, nullable=True)
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


# ============================================================
# JOB-SIDE TABLES (employer profile lives here)
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


# ============================================================
# ADMIN / AUXILIARY TABLES (core-owned)
# ============================================================

class SecurityAttempt(Base):
    """Failed security-code attempts (verification / reset lockouts).

    DB-backed so brute-force lockouts hold across multiple workers/processes
    (the previous in-memory defaultdict was per-process and dilutable).
    Rows older than the attempt window are pruned on touch.
    """
    __tablename__ = 'security_attempts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Identity-scoped key: e.g. "verify:<email>", "reset:<ip>", "forgot:<email>"
    attempt_key = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    __table_args__ = (
        Index('ix_security_attempts_key_time', 'attempt_key', 'created_at'),
    )


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
