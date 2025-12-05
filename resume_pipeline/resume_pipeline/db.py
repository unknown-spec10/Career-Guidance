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
    password_reset_token = Column(String(255), nullable=True, unique=True, index=True)
    password_reset_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='user', uselist=False, cascade='all, delete-orphan')
    employer = relationship('Employer', back_populates='user', uselist=False, cascade='all, delete-orphan')
    college = relationship('College', back_populates='user', uselist=False, cascade='all, delete-orphan')
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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship('User', back_populates='applicant')
    uploads = relationship('Upload', back_populates='applicant', cascade='all, delete-orphan')
    parsed_record = relationship('LLMParsedRecord', back_populates='applicant', uselist=False, cascade='all, delete-orphan')
    embeddings = relationship('EmbeddingsIndex', back_populates='applicant', cascade='all, delete-orphan')
    college_recommendations = relationship('CollegeApplicabilityLog', back_populates='applicant', cascade='all, delete-orphan')
    college_applications = relationship('CollegeApplication', back_populates='applicant', cascade='all, delete-orphan')
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
    field_confidences = Column(JSON, nullable=True)  # Per-field confidences
    llm_provenance = Column(JSON, nullable=True)  # Model name, tokens, call id
    needs_review = Column(Boolean, default=False, index=True)
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


# ============================================================
# COLLEGE-SIDE TABLES
# ============================================================

class College(Base):
    """Colleges/Universities (linked to user accounts)"""
    __tablename__ = 'colleges'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
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
    
    # Relationships
    user = relationship('User', back_populates='college')
    eligibility = relationship('CollegeEligibility', back_populates='college', cascade='all, delete-orphan')
    programs = relationship('CollegeProgram', back_populates='college', cascade='all, delete-orphan')
    meta = relationship('CollegeMetadata', back_populates='college', uselist=False, cascade='all, delete-orphan')
    recommendations = relationship('CollegeApplicabilityLog', back_populates='college', cascade='all, delete-orphan')
    applications = relationship('CollegeApplication', back_populates='college', cascade='all, delete-orphan')


class CollegeEligibility(Base):
    """Formal cutoffs & constraints"""
    __tablename__ = 'college_eligibility'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    college_id = Column(Integer, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    min_jee_rank = Column(Integer, nullable=True)
    min_cgpa = Column(Float, nullable=True)
    eligible_degrees = Column(JSON, nullable=True)  # ["BCA", "BSc"]
    reserved_category_cutoffs = Column(JSON, nullable=True)
    seats = Column(Integer, default=0)
    
    # Relationships
    college = relationship('College', back_populates='eligibility')


class CollegeProgram(Base):
    """Courses/branches inside a college (requires admin approval)"""
    __tablename__ = 'college_programs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    college_id = Column(Integer, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    program_name = Column(String(255))  # e.g., "B.Tech CSE"
    duration_months = Column(Integer)
    required_skills = Column(JSON, nullable=True)
    program_description = Column(Text, nullable=True)
    status = Column(Enum('pending', 'approved', 'rejected', name='program_status'), default='pending', index=True)
    rejection_reason = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    college = relationship('College', back_populates='programs')
    reviewer = relationship('User', foreign_keys=[reviewed_by])
    applications = relationship('CollegeApplication', back_populates='program')


class CollegeMetadata(Base):
    """Enrichment + embeddings pointer"""
    __tablename__ = 'college_metadata'
    
    college_id = Column(Integer, ForeignKey('colleges.id', ondelete='CASCADE'), primary_key=True)
    canonical_skills = Column(JSON, nullable=True)  # Skills college favors
    vector_store_id = Column(String(128), nullable=True)
    popularity_score = Column(Float, nullable=True)
    
    # Relationships
    college = relationship('College', back_populates='meta')


class CollegeApplicabilityLog(Base):
    """System-generated college recommendations"""
    __tablename__ = 'college_applicability_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    college_id = Column(Integer, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    recommend_score = Column(Float)
    explain = Column(JSON, nullable=True)  # Why recommended
    status = Column(Enum('recommended', 'viewed', 'dismissed', name='college_rec_status'), default='recommended')
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='college_recommendations')
    college = relationship('College', back_populates='recommendations')
    
    __table_args__ = (
        Index('idx_applicant_college', 'applicant_id', 'college_id'),
    )


class CollegeApplication(Base):
    """Student applications to colleges"""
    __tablename__ = 'college_applications'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    college_id = Column(Integer, ForeignKey('colleges.id', ondelete='CASCADE'), nullable=False, index=True)
    program_id = Column(Integer, ForeignKey('college_programs.id', ondelete='SET NULL'), nullable=True, index=True)
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
    
    # Relationships
    applicant = relationship('Applicant', back_populates='college_applications')
    college = relationship('College', back_populates='applications')
    program = relationship('CollegeProgram', back_populates='applications')
    
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
    
    # Relationships
    applicant = relationship('Applicant', back_populates='job_recommendations')
    job = relationship('Job', back_populates='recommendations')
    
    __table_args__ = (
        Index('idx_applicant_job', 'applicant_id', 'job_id'),
    )


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


class AuditLog(Base):
    """Generic LLM / pipeline logs and user action audit trail"""
    __tablename__ = 'audit_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50))  # 'applicant', 'job', 'college' (legacy)
    entity_id = Column(Integer, index=True)  # Legacy field
    action = Column(String(100), index=True)
    payload = Column(JSON, nullable=True)  # Legacy field
    # New fields for user action auditing
    target_type = Column(String(50), nullable=True)  # 'JobRecommendation', 'CollegeRecommendation', 'Job', 'CollegeProgram'
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
# INTERVIEW & ASSESSMENT SYSTEM
# ============================================================

class InterviewSession(Base):
    """Mock interview sessions - full (30 min) or micro (1 question)"""
    __tablename__ = 'interview_sessions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    session_type = Column(Enum('technical', 'hr', 'behavioral', 'mixed', name='interview_type'), nullable=False)
    session_mode = Column(Enum('full', 'micro', name='session_mode'), default='full', index=True)  # NEW: full or micro
    difficulty_level = Column(Enum('easy', 'medium', 'hard', name='difficulty_level'), default='medium')
    focus_skills = Column(JSON, nullable=True)  # ["Python", "DSA", "DBMS"]
    
    # Credit tracking
    credits_used = Column(Integer, default=10)  # 10 for full, 1 for micro
    
    # Session metadata
    started_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    ends_at = Column(DateTime, nullable=True)  # Auto-calculated end time
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, nullable=True)  # 30 min = 1800 seconds
    status = Column(Enum('in_progress', 'completed', 'abandoned', name='session_status'), default='in_progress', index=True)
    
    # Scoring (0-100 scale)
    overall_score = Column(Float, nullable=True)
    technical_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)
    problem_solving_score = Column(Float, nullable=True)
    
    # Skill breakdown scores
    skill_scores = Column(JSON, nullable=True)  # {"python": 85, "dsa": 70, "dbms": 60}
    
    # AI feedback
    ai_feedback = Column(JSON, nullable=True)  # Structured feedback from Gemini
    skill_gap_analysis = Column(JSON, nullable=True)  # {"python": "strong", "dsa": "moderate", "dbms": "weak"}
    recommended_resources = Column(JSON, nullable=True)  # Learning path suggestions
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='interview_sessions')
    questions = relationship('InterviewQuestion', back_populates='session', cascade='all, delete-orphan')
    answers = relationship('InterviewAnswer', back_populates='session', cascade='all, delete-orphan')
    learning_paths = relationship('LearningPath', back_populates='source_session', foreign_keys='LearningPath.source_session_id')


class InterviewQuestion(Base):
    """Questions asked during interview - MCQ and short descriptive"""
    __tablename__ = 'interview_questions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    question_order = Column(Integer, nullable=False)
    
    # Question content
    question_type = Column(Enum('mcq', 'short_answer', 'coding', 'theory', 'behavioral', name='question_type'), nullable=False)
    question_text = Column(Text, nullable=False)
    difficulty = Column(String(20))  # easy/medium/hard
    category = Column(String(100), index=True)  # DSA, DBMS, OS, Java, Python, etc.
    
    # For coding questions
    starter_code = Column(Text, nullable=True)
    test_cases = Column(JSON, nullable=True)  # [{"input": "...", "expected": "..."}]
    
    # For MCQ
    options = Column(JSON, nullable=True)  # ["Option A", "Option B", "Option C", "Option D"]
    correct_answer = Column(String(255), nullable=True)  # For MCQ: "A" or "Option A"
    
    # Expected answer (for short answer/theory)
    expected_answer_points = Column(JSON, nullable=True)  # Key points to cover
    max_score = Column(Float, default=10.0)  # Maximum points for this question
    
    # Skills being tested
    skills_tested = Column(JSON, nullable=True)  # ["recursion", "dynamic_programming"]
    
    # Auto-generated metadata
    generated_by = Column(String(50), default='gemini')  # gemini, google_search, manual
    source_url = Column(String(1024), nullable=True)  # If fetched from Google
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    session = relationship('InterviewSession', back_populates='questions')
    answer = relationship('InterviewAnswer', back_populates='question', uselist=False, cascade='all, delete-orphan')


class InterviewAnswer(Base):
    """User answers to interview questions"""
    __tablename__ = 'interview_answers'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('interview_sessions.id', ondelete='CASCADE'), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey('interview_questions.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Answer content
    answer_text = Column(Text, nullable=True)
    code_submitted = Column(Text, nullable=True)  # For coding questions
    selected_option = Column(String(255), nullable=True)  # For MCQ
    
    # Timing
    time_taken_seconds = Column(Integer, nullable=True)
    answered_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Scoring
    is_correct = Column(Boolean, nullable=True)  # For MCQ/objective
    score = Column(Float, nullable=True)  # Actual score received
    
    # AI Evaluation
    ai_evaluation = Column(JSON, nullable=True)  # Detailed feedback from Gemini
    strengths = Column(JSON, nullable=True)  # ["good logic", "clear explanation"]
    weaknesses = Column(JSON, nullable=True)  # ["edge case missed", "incomplete answer"]
    improvement_suggestions = Column(Text, nullable=True)
    
    # Code execution results (for coding questions - optional)
    test_results = Column(JSON, nullable=True)  # [{"test": 1, "passed": true, "output": "..."}]
    
    # Relationships
    session = relationship('InterviewSession', back_populates='answers')
    question = relationship('InterviewQuestion', back_populates='answer')
    
    __table_args__ = (
        UniqueConstraint('session_id', 'question_id', name='uq_session_question_answer'),
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
    
    # Source of learning path
    generated_from = Column(Enum('interview', 'assessment', 'manual', name='path_source'), default='interview')
    source_session_id = Column(Integer, ForeignKey('interview_sessions.id', ondelete='SET NULL'), nullable=True)
    
    # Path details
    skill_gaps = Column(JSON, nullable=False)  # {"python": "weak", "dsa": "moderate", "dbms": "weak"}
    recommended_courses = Column(JSON, nullable=True)  # [{"title": "...", "url": "...", "provider": "Udemy"}]
    recommended_projects = Column(JSON, nullable=True)  # [{"title": "...", "description": "..."}]
    practice_problems = Column(JSON, nullable=True)  # Coding problems from Google Search
    
    # Priority areas
    priority_skills = Column(JSON, nullable=True)  # ["DSA", "DBMS"] - top 3 skills to focus on
    
    # Status tracking
    status = Column(Enum('active', 'in_progress', 'completed', name='path_status'), default='active')
    progress_percentage = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    applicant = relationship('Applicant', back_populates='learning_paths')
    source_session = relationship('InterviewSession', back_populates='learning_paths', foreign_keys=[source_session_id])


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
