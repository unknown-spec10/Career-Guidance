from sqlalchemy import (
    Column, Integer, String, DateTime, JSON, Boolean, Enum,
    ForeignKey, Index,
)
from sqlalchemy.orm import relationship
from .base import Base
import datetime


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
        'learning_path_generation', 'recommendation_refresh',
        'refund', 'bonus_credits',
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
