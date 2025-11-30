"""
Pydantic models for API request/response schemas
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
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
