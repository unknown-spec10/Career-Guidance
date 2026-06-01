import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..db import InterviewSession, InterviewAnswer
from ..constants import INTERVIEW_LIMITS

def check_session_start_limits(applicant_id: int, db: Session) -> None:
    """
    Enforce session start limits against the database:
    1. Rate Limit: Max 1 session per 5 minutes.
    2. Overall Limit: Max 3 sessions per day (24-hour sliding window).
    """
    now = datetime.datetime.utcnow()
    
    # 1. Rate Limit check (5 minutes)
    rate_window = datetime.timedelta(seconds=INTERVIEW_LIMITS['SESSION_START_WINDOW_SECONDS'])
    rate_cutoff = now - rate_window
    recent_session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.created_at >= rate_cutoff
        )
        .order_by(InterviewSession.created_at.desc())
        .first()
    )
    if recent_session:
        wait_seconds = int((recent_session.created_at + rate_window - now).total_seconds())
        if wait_seconds > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_seconds} seconds before starting another mock practice session."
            )
            
    # 2. Overall Limit check (24 hours sliding window)
    daily_window = datetime.timedelta(hours=24)
    daily_cutoff = now - daily_window
    daily_count = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewSession.created_at >= daily_cutoff
        )
        .count()
    )
    if daily_count >= INTERVIEW_LIMITS['SESSION_START_MAX_DAILY']:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You have reached your daily limit of {INTERVIEW_LIMITS['SESSION_START_MAX_DAILY']} mock practice sessions. Please try again tomorrow."
        )

def check_answer_submit_limits(applicant_id: int, db: Session) -> None:
    """
    Enforce answer submission limits against the database:
    1. Rate Limit: Max 1 answer per 10 seconds.
    2. Overall Limit: Max 30 evaluations per day (24-hour sliding window).
    """
    now = datetime.datetime.utcnow()
    
    # 1. Rate Limit check (10 seconds)
    rate_window = datetime.timedelta(seconds=INTERVIEW_LIMITS['ANSWER_SUBMIT_WINDOW_SECONDS'])
    rate_cutoff = now - rate_window
    recent_answer = (
        db.query(InterviewAnswer)
        .join(InterviewSession, InterviewAnswer.session_id == InterviewSession.id)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewAnswer.created_at >= rate_cutoff
        )
        .order_by(InterviewAnswer.created_at.desc())
        .first()
    )
    if recent_answer:
        wait_seconds = int((recent_answer.created_at + rate_window - now).total_seconds())
        if wait_seconds > 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_seconds} seconds between submitting answers to allow AI evaluation to process."
            )
            
    # 2. Overall Limit check (24 hours sliding window)
    daily_window = datetime.timedelta(hours=24)
    daily_cutoff = now - daily_window
    daily_count = (
        db.query(InterviewAnswer)
        .join(InterviewSession, InterviewAnswer.session_id == InterviewSession.id)
        .filter(
            InterviewSession.applicant_id == applicant_id,
            InterviewAnswer.created_at >= daily_cutoff
        )
        .count()
    )
    if daily_count >= INTERVIEW_LIMITS['ANSWER_SUBMIT_MAX_DAILY']:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You have reached your daily limit of {INTERVIEW_LIMITS['ANSWER_SUBMIT_MAX_DAILY']} AI answer evaluations. Please try again tomorrow."
        )
