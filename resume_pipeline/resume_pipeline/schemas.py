"""  
Pydantic models for API request/response schemas
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
# Auth schemas
class UserRole(str, Enum):
    STUDENT = "student"
    EMPLOYER = "employer"
    COLLEGE = "college"
    ADMIN = "admin"


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str
    role: UserRole
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=16)


class ResendCodeRequest(BaseModel):
    email: EmailStr


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Job posting schemas
class JobCreate(BaseModel):
    title: str
    description: str
    location_city: str
    location_state: Optional[str] = None
    work_type: str  # remote, on-site, hybrid
    min_experience_years: float = 0
    min_cgpa: Optional[float] = None
    required_skills: Optional[List[dict]] = None
    optional_skills: Optional[List[dict]] = None
    expires_at: Optional[datetime] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    work_type: Optional[str] = None
    min_experience_years: Optional[float] = None
    min_cgpa: Optional[float] = None
    required_skills: Optional[List[dict]] = None
    optional_skills: Optional[List[dict]] = None
    expires_at: Optional[datetime] = None


class JobResponse(BaseModel):
    id: int
    title: str
    description: str
    location_city: str
    work_type: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Job application schemas
class JobApplicationCreate(BaseModel):
    job_id: int
    cover_letter: Optional[str] = None


class JobApplicationResponse(BaseModel):
    id: int
    applicant_id: int
    job_id: int
    status: str
    applied_at: datetime
    
    class Config:
        from_attributes = True


# College program schemas
class CollegeProgramCreate(BaseModel):
    program_name: str
    duration_months: int
    required_skills: Optional[List[dict]] = None
    program_description: Optional[str] = None


class CollegeProgramResponse(BaseModel):
    id: int
    program_name: str
    duration_months: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# College application schemas
class CollegeApplicationCreate(BaseModel):
    college_id: int
    program_id: Optional[int] = None
    statement_of_purpose: Optional[str] = None
    twelfth_percentage: Optional[float] = None
    twelfth_board: Optional[str] = None
    twelfth_subjects: Optional[List[str]] = None


class CollegeApplicationResponse(BaseModel):
    id: int
    applicant_id: int
    college_id: int
    program_id: Optional[int]
    status: str
    applied_at: datetime
    
    class Config:
        from_attributes = True


# Application status update schemas
class ApplicationStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


# Human review schemas
class HumanReviewCreate(BaseModel):
    applicant_id: int
    field: str
    original_value: str
    corrected_value: str
    reason: Optional[str] = None


class HumanReviewResponse(BaseModel):
    id: int
    applicant_id: int
    field: str
    original_value: str
    corrected_value: str
    reviewer_id: Optional[int]
    reason: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Search and filter schemas
class AdvancedSearchRequest(BaseModel):
    query: Optional[str] = None
    entity_type: str  # 'job', 'college', 'applicant'
    filters: Optional[dict] = None
    use_semantic: bool = False
    limit: int = 20


class EmbeddingCreate(BaseModel):
    applicant_id: int
    vector_type: str  # 'resume_summary', 'skills', 'full_resume'
    force_regenerate: bool = False
    applied_at: datetime
    
    class Config:
        from_attributes = True


# Admin approval schemas
class ApprovalAction(BaseModel):
    action: str  # approve or reject
    reason: Optional[str] = None


class MarksheetUpload(BaseModel):
    twelfth_percentage: float
    twelfth_board: str
    twelfth_subjects: List[str]
    location: Optional[str] = None
    preferences: Optional[str] = None


# ============================================================
# INTERVIEW & ASSESSMENT SCHEMAS
# ============================================================

class InterviewSessionCreate(BaseModel):
    """Request to start a new interview session"""
    session_type: str = Field(..., pattern="^(technical|hr|behavioral|mixed)$")
    session_mode: Optional[str] = Field("full", pattern="^(full|micro)$")  # NEW: full or micro
    difficulty_level: Optional[str] = Field("medium", pattern="^(easy|medium|hard)$")
    focus_skills: Optional[List[str]] = None  # ["Python", "DSA"]
    

class InterviewSessionResponse(BaseModel):
    """Interview session details"""
    id: int
    applicant_id: int
    session_type: str
    difficulty_level: str
    focus_skills: Optional[List[str]]
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]
    status: str
    overall_score: Optional[float]
    technical_score: Optional[float]
    communication_score: Optional[float]
    problem_solving_score: Optional[float]
    skill_scores: Optional[Dict[str, float]]
    ai_feedback: Optional[Dict[str, Any]]
    skill_gap_analysis: Optional[Dict[str, str]]
    recommended_resources: Optional[List[Dict[str, Any]]]
    question_count: Optional[int] = None
    
    class Config:
        from_attributes = True


class QuestionResponse(BaseModel):
    """Interview question details"""
    id: int
    session_id: int
    question_order: int
    question_type: str
    question_text: str
    difficulty: str
    category: str
    options: Optional[List[str]]  # For MCQ
    starter_code: Optional[str]  # For coding
    max_score: float
    skills_tested: Optional[List[str]]
    
    class Config:
        from_attributes = True


class AnswerSubmit(BaseModel):
    """Submit an answer to a question"""
    question_id: int
    answer_text: Optional[str] = None  # For short answer/theory
    code_submitted: Optional[str] = None  # For coding
    selected_option: Optional[str] = None  # For MCQ
    time_taken_seconds: Optional[int] = None


class AnswerEvaluation(BaseModel):
    """AI evaluation of an answer"""
    answer_id: int
    question_id: int
    is_correct: Optional[bool]
    score: float
    max_score: float
    ai_evaluation: Optional[Dict[str, Any]]
    strengths: Optional[List[str]]
    weaknesses: Optional[List[str]]
    improvement_suggestions: Optional[str]
    
    class Config:
        from_attributes = True


class SessionCompleteRequest(BaseModel):
    """Request to complete and finalize a session"""
    generate_learning_path: bool = True


class SessionCompleteResponse(BaseModel):
    """Response after completing a session"""
    session: InterviewSessionResponse
    learning_path_id: Optional[int] = None
    should_retake: bool = False  # If score is old
    message: str


class SkillAssessmentCreate(BaseModel):
    """Start a skill assessment"""
    skill_name: str
    assessment_type: str = Field("mcq", pattern="^(mcq|coding|mixed)$")
    difficulty_level: Optional[str] = Field("medium", pattern="^(easy|medium|hard)$")


class SkillAssessmentResponse(BaseModel):
    """Skill assessment results"""
    id: int
    applicant_id: int
    skill_name: str
    assessment_type: str
    total_questions: int
    correct_answers: int
    score_percentage: float
    proficiency: Optional[str]
    time_taken_seconds: Optional[int]
    skill_breakdown: Optional[Dict[str, float]]
    completed_at: datetime
    
    class Config:
        from_attributes = True


class LearningPathResponse(BaseModel):
    """Personalized learning path"""
    id: int
    applicant_id: int
    generated_from: str
    source_session_id: Optional[int]
    skill_gaps: Dict[str, str]
    recommended_courses: Optional[List[Dict[str, Any]]]
    recommended_projects: Optional[List[Dict[str, Any]]]
    practice_problems: Optional[List[Dict[str, Any]]]
    priority_skills: Optional[List[str]]
    status: str
    progress_percentage: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class InterviewHistoryResponse(BaseModel):
    """Interview session history for an applicant"""
    sessions: List[InterviewSessionResponse]
    total_sessions: int
    latest_score: Optional[float]
    average_score: Optional[float]
    sessions_today: int
    can_start_new: bool  # Based on credit & rate limits
    needs_retake: bool  # If latest > 6 months old


# ============================================================
# CREDIT SYSTEM SCHEMAS
# ============================================================

class CreditAccountResponse(BaseModel):
    """Credit account summary"""
    current_credits: int
    weekly_limit: int
    is_premium: bool
    next_refill_days: int
    next_refill_hours: int
    next_refill_at: str
    usage_today: Dict[str, int]
    usage_this_week: Dict[str, int]
    limits: Dict[str, int]
    costs: Dict[str, int]


class CreditTransactionResponse(BaseModel):
    """Credit transaction log entry"""
    id: int
    transaction_type: str
    amount: int
    balance_after: int
    activity_type: Optional[str]
    description: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AdminCreditAdjustment(BaseModel):
    """Admin request to adjust user credits"""
    applicant_id: int
    amount: int = Field(..., ge=-1000, le=1000)  # +/- 1000 max
    reason: str = Field(..., min_length=10, max_length=255)


# ============================================================
# STUDENT PROFILE SCHEMAS
# ============================================================

class SkillItem(BaseModel):
    """Individual skill with proficiency"""
    name: str
    proficiency: Optional[str] = None  # beginner, intermediate, advanced, expert
    years_of_experience: Optional[float] = None


class EducationItem(BaseModel):
    """Education entry"""
    institution: str
    degree: Optional[str] = None
    branch: Optional[str] = None
    cgpa: Optional[float] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    description: Optional[str] = None


class ExperienceItem(BaseModel):
    """Work experience entry"""
    company: str
    role: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    technologies: Optional[List[str]] = None


class ProjectItem(BaseModel):
    """Project entry"""
    name: str
    description: Optional[str] = None
    technologies: Optional[List[str]] = None
    link: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class CertificationItem(BaseModel):
    """Certification entry"""
    name: str
    issuer: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    link: Optional[str] = None


class ProfileUpdate(BaseModel):
    """Student profile update request"""
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: Optional[List[SkillItem]] = None
    education: Optional[List[EducationItem]] = None
    experience: Optional[List[ExperienceItem]] = None
    projects: Optional[List[ProjectItem]] = None
    certifications: Optional[List[CertificationItem]] = None
    bio: Optional[str] = None


class ProfileResponse(BaseModel):
    """Student profile response"""
    id: int
    user_id: int
    display_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    location_city: Optional[str]
    location_state: Optional[str]
    linkedin_url: Optional[str]
    github_url: Optional[str]
    portfolio_url: Optional[str]
    skills: Optional[List[Dict[str, Any]]]
    education: Optional[List[Dict[str, Any]]]
    experience: Optional[List[Dict[str, Any]]]
    projects: Optional[List[Dict[str, Any]]]
    certifications: Optional[List[Dict[str, Any]]]
    bio: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

