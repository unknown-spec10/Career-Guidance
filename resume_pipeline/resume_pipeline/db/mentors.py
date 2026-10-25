from sqlalchemy import (
    Column, Integer, String, Text, DateTime, JSON, Enum, ForeignKey,
)
from sqlalchemy.orm import relationship
from .base import Base
import datetime


# ============================================================
# NETWORKING / MENTORSHIP TABLES
# ============================================================

class Mentor(Base):
    __tablename__ = 'mentors'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True, unique=True, index=True)
    bio = Column(Text, nullable=True)
    company = Column(String(200), nullable=False)
    role = Column(String(200), nullable=False)
    alumni_year = Column(String(50), nullable=True)
    status = Column(String(100), default='Available')
    skills = Column(JSON, nullable=True)  # JSON list of strings
    match_score = Column(Integer, default=85)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship('User')


class MentorRequest(Base):
    __tablename__ = 'mentor_requests'

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey('applicants.id', ondelete='CASCADE'), nullable=False, index=True)
    mentor_id = Column(Integer, ForeignKey('mentors.id', ondelete='CASCADE'), nullable=False, index=True)
    message = Column(Text, nullable=True)
    status = Column(Enum('pending', 'accepted', 'declined', name='mentor_request_status'), default='pending', index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    student = relationship('Applicant')
    mentor = relationship('Mentor')
