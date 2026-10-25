from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Float, JSON, Boolean, Enum,
    ForeignKey, Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from .base import Base
import datetime
import uuid


# ============================================================
# INTERVIEW SYSTEM (v2 — DeepSeek-via-OpenCode chat, Groq STT, text-based, UUID PKs)
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
    """Pre-generated interview questions — one chat-provider call per session."""
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
    """Candidate answers — evaluated asynchronously in background via llm_router."""
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
    # Number of evaluation attempts made (retry-on-poll recovery, see
    # interview/router.py get_results). After MAX_EVAL_RETRIES the answer is
    # reported as a partial result instead of blocking results forever.
    evaluation_attempts = Column(Integer, nullable=False, default=0)

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
    # UUID string id of the interview session this path was generated from.
    # (v2 sessions use UUIDs; widened from Integer via migration 0005.)
    source_session_id = Column(String(36), nullable=True)

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
# EMPLOYER INTERVIEW SCHEDULING / FEEDBACK TABLES
# ============================================================

class InterviewSchedule(Base):
    __tablename__ = 'interview_schedules'

    id = Column(Integer, primary_key=True, autoincrement=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    employer_id = Column(Integer, ForeignKey('employers.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey('jobs.id', ondelete='SET NULL'), nullable=True, index=True)
    interview_type = Column(String(50), nullable=False)  # technical | screening | system | culture
    format = Column(String(50), default='video')         # video | in-person | phone
    duration = Column(Integer, default=60)                # minutes
    date_time = Column(DateTime, nullable=False)
    interviewers = Column(JSON, nullable=True)            # JSON list of interviewer names/emails
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    applicant = relationship('Applicant')
    employer = relationship('Employer')
    job = relationship('Job')


class InterviewFeedback(Base):
    __tablename__ = 'interview_feedbacks'

    id = Column(Integer, primary_key=True, autoincrement=True)
    interview_schedule_id = Column(Integer, ForeignKey('interview_schedules.id', ondelete='SET NULL'), nullable=True, index=True)
    applicant_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    employer_id = Column(Integer, ForeignKey('employers.id', ondelete='CASCADE'), nullable=False, index=True)
    scores = Column(JSON, nullable=False)                # JSON object with category ratings
    behavioral_fit_notes = Column(Text, nullable=True)
    justification_notes = Column(Text, nullable=True)
    decision = Column(Enum('advance', 'hold', 'reject', name='hiring_decision'), default='hold', index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    interview_schedule = relationship('InterviewSchedule')
    applicant = relationship('Applicant')
    employer = relationship('Employer')
