"""
Pydantic schemas for college data collection and verification workflow.
Used by admin interface to submit and approve college data with source attribution.
"""

from pydantic import BaseModel, HttpUrl, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class CollectionStatus(str, Enum):
    """College data collection status"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class SourceAttribution(BaseModel):
    """Attribution for a single data point"""
    field_name: str  # e.g., 'min_jee_rank', 'program_description'
    source_url: str  # URL to source (official website, govt portal, etc.)
    source_type: str  # 'official_website', 'govt_portal', 'official_document'
    verified_date: datetime
    notes: Optional[str] = None


class CollegeEligibilitySubmit(BaseModel):
    """Eligibility data submission with sources"""
    min_jee_rank: Optional[int] = None
    min_jee_rank_source: Optional[str] = None
    
    min_cgpa: Optional[float] = None
    min_cgpa_source: Optional[str] = None
    
    seats: Optional[int] = None
    seats_source: Optional[str] = None
    
    eligible_degrees: Optional[List[str]] = None
    eligible_degrees_source: Optional[str] = None
    
    reserved_category_cutoffs: Optional[Dict[str, int]] = None
    
    @validator('min_jee_rank')
    def validate_jee_rank(cls, v):
        if v is not None and (v < 1 or v > 300000):
            raise ValueError("JEE rank must be between 1 and 300000")
        return v
    
    @validator('min_cgpa')
    def validate_cgpa(cls, v):
        if v is not None and (v < 0 or v > 10):
            raise ValueError("CGPA must be between 0 and 10")
        return v
    
    @validator('seats')
    def validate_seats(cls, v):
        if v is not None and v < 0:
            raise ValueError("Seats cannot be negative")
        return v


class CollegeProgramSubmit(BaseModel):
    """Program data submission with sources"""
    program_name: str
    duration_months: int
    program_description: Optional[str] = None
    program_description_source: Optional[str] = None
    
    duration_months_source: Optional[str] = None
    
    required_skills: Optional[List[str]] = None
    required_skills_source: Optional[str] = None
    
    @validator('duration_months')
    def validate_duration(cls, v):
        if v < 12 or v > 120:
            raise ValueError("Program duration must be between 12 and 120 months")
        return v


class CollegeDataSubmit(BaseModel):
    """
    Complete college data submission for admin approval.
    Includes all basic info and source attribution.
    """
    # Basic college info
    name: str = Field(..., min_length=3, max_length=255)
    location_city: str
    location_state: str
    country: str = "India"
    
    # Descriptive
    description: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    
    # Eligibility data
    eligibility: CollegeEligibilitySubmit
    
    # Programs
    programs: List[CollegeProgramSubmit] = Field(default_factory=list)
    
    # Data sources (collection-level)
    data_sources: List[SourceAttribution] = Field(default_factory=list)
    notes_for_reviewer: Optional[str] = None
    
    @validator('website')
    def validate_website(cls, v):
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError("Website must start with http:// or https://")
        return v


class CollegeDataApprove(BaseModel):
    """Admin approval request"""
    college_id: int
    action: str = Field(..., pattern='^(approve|reject)$')
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class CollegeDataResponse(BaseModel):
    """Response model for college data"""
    id: int
    name: str
    location_city: str
    location_state: str
    collection_status: str
    submitted_by: Optional[int] = None
    submitted_date: Optional[datetime] = None
    approved_by: Optional[int] = None
    approved_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    last_verification_date: Optional[datetime] = None
    data_freshness_flag: Optional[str] = None
    
    class Config:
        from_attributes = True


class CollectionStatusResponse(BaseModel):
    """Batch status check response"""
    total_colleges: int
    draft: int
    submitted: int
    approved: int
    rejected: int
    awaiting_approval: int


class VerificationAuditLog(BaseModel):
    """Audit trail for data verification"""
    college_id: int
    field_name: str
    old_value: Any
    new_value: Any
    verified_by: int
    verified_date: datetime
    source_url: Optional[str] = None
    status: str = "verified"  # verified, rejected, flagged_for_review
    notes: Optional[str] = None
