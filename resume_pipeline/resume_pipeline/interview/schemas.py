"""
Interview System v2 — Pydantic Schemas
All request/response models for the interview API endpoints.
"""
from typing import Optional, List
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class QuestionOut(BaseModel):
    """A single interview question as returned to the frontend."""
    id: str
    text: str
    question_number: int
    total_questions: int
    skill_tag: str
    hint: Optional[str] = None  # Populated on weak previous answer


# ---------------------------------------------------------------------------
# POST /api/interview/start
# ---------------------------------------------------------------------------

class StartInterviewRequest(BaseModel):
    applicant_id: Optional[str] = Field(None, description="String applicant_id (app_<uuid>)")
    interview_type: str = Field("technical", pattern="^(technical|hr|behavioral|mixed)$")
    difficulty: str = Field("medium", pattern="^(easy|medium|hard)$")
    num_questions: int = Field(10, ge=5, le=15)
    topic_focus: Optional[str] = Field(None, max_length=200)
    voice_mode: bool = False
    interviewer_persona: str = Field("Friendly Senior Engineer", pattern="^(Friendly Senior Engineer|Tough FAANG Interviewer|HR Behavioral Round|Startup CTO)$")


class StartInterviewResponse(BaseModel):
    session_id: str
    first_question: QuestionOut


# ---------------------------------------------------------------------------
# POST /api/interview/answer
# ---------------------------------------------------------------------------

class AnswerRequest(BaseModel):
    session_id: str
    question_id: str
    answer_text: str = Field(..., min_length=1, max_length=5000)


class AnswerResponse(BaseModel):
    status: str  # "ok" | "interview_complete"
    next_question: Optional[QuestionOut] = None


# ---------------------------------------------------------------------------
# GET /api/interview/session/{session_id}  — crash recovery
# ---------------------------------------------------------------------------

class SessionStateResponse(BaseModel):
    session_id: str
    status: str
    current_question_index: int
    total_questions: int
    current_question: Optional[QuestionOut] = None
    answers_submitted: int
    interview_type: str
    difficulty: str
    voice_mode: bool = False
    interviewer_persona: Optional[str] = "Friendly Senior Engineer"


# ---------------------------------------------------------------------------
# GET /api/interview/results/{session_id}
# ---------------------------------------------------------------------------

class SkillBreakdownItem(BaseModel):
    skill: str
    score: float          # 0.0–1.0 average across questions for this skill
    questions: int        # Number of questions tagged with this skill
    label: str            # "Strong" | "Good" | "Moderate" | "Needs Work"


class QuestionReviewItem(BaseModel):
    question_id: str
    question: str
    answer: str
    score: Optional[float]
    feedback: Optional[str]
    strength: Optional[str]
    missing_concepts: Optional[List[str]]
    status: str           # evaluated | evaluation_failed | pending_evaluation


class ResultsResponse(BaseModel):
    status: str           # "processing" | "complete"
    completed: Optional[int] = None   # how many evaluations done (for processing state)
    total: Optional[int] = None
    overall_score: Optional[float] = None
    skill_breakdown: Optional[List[SkillBreakdownItem]] = None
    questions_review: Optional[List[QuestionReviewItem]] = None
    weak_skills: Optional[List[str]] = None  # skills with avg score < 0.60
    study_plan: Optional[str] = None


# ---------------------------------------------------------------------------
# Active session banner — GET /api/interview/active-session
# ---------------------------------------------------------------------------

class ActiveSessionResponse(BaseModel):
    has_active_session: bool
    session_id: Optional[str] = None
    created_at: Optional[str] = None
    answers_submitted: Optional[int] = None
    total_questions: Optional[int] = None
    interview_type: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /api/interview/history
# ---------------------------------------------------------------------------

class InterviewHistoryItem(BaseModel):
    session_id: str
    interview_type: str
    difficulty: str
    num_questions: int
    overall_score: Optional[float] = None
    status: str
    topic_focus: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    interviewer_persona: Optional[str] = "Friendly Senior Engineer"


# ---------------------------------------------------------------------------
# GET /api/interview/session/{session_id}/questions
# ---------------------------------------------------------------------------

class SessionQuestionItem(BaseModel):
    id: str
    text: str
    question_number: int
    total_questions: int
    skill_tag: str
    user_answer: Optional[str] = None
    answer_status: Optional[str] = None
