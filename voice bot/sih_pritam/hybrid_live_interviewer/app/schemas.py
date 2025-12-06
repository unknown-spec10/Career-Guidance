from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from enum import Enum

class Mode(str, Enum):
    resume = "resume"
    domain = "domain"
    rag = "rag"

class QAItem(BaseModel):
    id: str
    question: str
    answer: str
    meta: Optional[Dict] = None

class SessionState(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    mode: Mode = Mode.resume
    active: bool = True
    paused: bool = False
    last_question: Optional[str] = None
    last_answer_partial: Optional[str] = None
    memory: List[QAItem] = Field(default_factory=list)
    topics_covered: List[str] = Field(default_factory=list)
    depth_scores: Dict[str, int] = Field(default_factory=dict)
    interview_stage: Optional[str] = None
    tts_state: Dict = Field(default_factory=lambda: {"playing": False, "play_id": None})

class LLMQuestionOutput(BaseModel):
    text: str
    type: Optional[str] = "new"  # followup|new
    topic: Optional[str] = None

class AudioChunk(BaseModel):
    session_id: str
    seq: int
    payload_b64: str  # base64 audio payload
    ts: Optional[float] = None
