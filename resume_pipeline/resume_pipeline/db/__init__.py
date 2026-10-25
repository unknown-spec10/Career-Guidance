"""Database package — domain-split ORM models sharing a single ``Base``.

Drop-in replacement for the legacy ``resume_pipeline/db.py`` god-module.
Every name previously importable from ``resume_pipeline.db`` is re-exported
here, so all existing importers keep working unchanged::

    from resume_pipeline.db import User
    from resume_pipeline.db import Base, SessionLocal, engine, init_db, active_job_criteria

Layout:
    base.py          Base, vector-column helpers, embedding dims
    core.py          User, Applicant, Upload, Employer, AuditLog, SecurityAttempt, SystemConfiguration
    jobs.py          Job, JobMetadata, JobRecommendation, JobApplication,
                     JobEmbedding, JobEmbeddingsCache, UserFeedback, HumanReview
    resume_models.py ResumeParsed, LLMParsedRecord, EmbeddingsIndex,
                     ApplicantEmbedding, CanonicalSkill
    interview.py     InterviewSession, InterviewQuestion, InterviewAnswer,
                     InterviewSchedule, InterviewFeedback, SkillAssessment, LearningPath
    credits.py       CreditAccount, CreditTransaction, CreditUsageStats
    mentors.py       Mentor, MentorRequest
    helpers.py       engine, SessionLocal, init_db, active_job_criteria
"""

from .base import (
    Base,
    _TolerantVector,
    _PGVECTOR_AVAILABLE,
    _vector_column,
    LOCAL_EMBEDDING_DIM,
)
from .core import (
    User,
    Applicant,
    Upload,
    Employer,
    AuditLog,
    SecurityAttempt,
    SystemConfiguration,
)
from .jobs import (
    Job,
    JobMetadata,
    JobRecommendation,
    JobApplication,
    JobEmbedding,
    JobEmbeddingsCache,
    UserFeedback,
    HumanReview,
)
from .resume_models import (
    ResumeParsed,
    LLMParsedRecord,
    EmbeddingsIndex,
    ApplicantEmbedding,
    CanonicalSkill,
)
from .interview import (
    InterviewSession,
    InterviewQuestion,
    InterviewAnswer,
    InterviewSchedule,
    InterviewFeedback,
    SkillAssessment,
    LearningPath,
)
from .credits import (
    CreditAccount,
    CreditTransaction,
    CreditUsageStats,
)
from .mentors import (
    Mentor,
    MentorRequest,
)
from .helpers import (
    engine,
    SessionLocal,
    init_db,
    active_job_criteria,
)

__all__ = [
    # base
    "Base",
    "_TolerantVector",
    "_PGVECTOR_AVAILABLE",
    "_vector_column",
    "LOCAL_EMBEDDING_DIM",
    # core
    "User",
    "Applicant",
    "Upload",
    "Employer",
    "AuditLog",
    "SecurityAttempt",
    "SystemConfiguration",
    # jobs
    "Job",
    "JobMetadata",
    "JobRecommendation",
    "JobApplication",
    "JobEmbedding",
    "JobEmbeddingsCache",
    "UserFeedback",
    "HumanReview",
    # resume_models
    "ResumeParsed",
    "LLMParsedRecord",
    "EmbeddingsIndex",
    "ApplicantEmbedding",
    "CanonicalSkill",
    # interview
    "InterviewSession",
    "InterviewQuestion",
    "InterviewAnswer",
    "InterviewSchedule",
    "InterviewFeedback",
    "SkillAssessment",
    "LearningPath",
    # credits
    "CreditAccount",
    "CreditTransaction",
    "CreditUsageStats",
    # mentors
    "Mentor",
    "MentorRequest",
    # helpers
    "engine",
    "SessionLocal",
    "init_db",
    "active_job_criteria",
]
