"""
Credit Management Service - Handles quota, spending, and refills

Note: Pylance warnings about SQLAlchemy column assignments are expected.
SQLAlchemy uses descriptors that allow runtime assignment even though static type checking shows warnings.
These are not runtime errors - the code works correctly.
"""
# pyright: reportAttributeAccessIssue=false
import datetime
from typing import Tuple, Optional, Dict, TYPE_CHECKING
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import CreditAccount, CreditTransaction, CreditUsageStats, Applicant, SystemConfiguration
from ..constants import CREDIT_CONFIG


class CreditService:
    """
    Service for managing interview credits and usage quotas.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_or_create_account(self, applicant_id: int) -> CreditAccount:
        """
        Get credit account for applicant, create if doesn't exist.
        """
        account = self.db.query(CreditAccount).filter(
            CreditAccount.applicant_id == applicant_id
        ).first()
        
        if not account:
            # Calculate next refill date (7 days from now)
            next_refill = datetime.datetime.utcnow() + datetime.timedelta(days=CREDIT_CONFIG['CREDITS_REFILL_DAYS'])
            
            account = CreditAccount(
                applicant_id=applicant_id,
                current_credits=CREDIT_CONFIG['DEFAULT_WEEKLY_CREDITS'],
                total_earned=CREDIT_CONFIG['DEFAULT_WEEKLY_CREDITS'],
                next_refill_at=next_refill,
                weekly_credit_limit=CREDIT_CONFIG['DEFAULT_WEEKLY_CREDITS']
            )
            self.db.add(account)
            
            # Create usage stats
            stats = CreditUsageStats(account_id=account.id)
            self.db.add(stats)
            
            self.db.commit()
            self.db.refresh(account)
        
        return account
    
    def check_and_refill(self, account: CreditAccount) -> bool:
        """
        Check if refill is due and apply it.
        Returns True if refilled.
        """
        now = datetime.datetime.utcnow()
        
        # Compare dates - handle SQLAlchemy column safely
        next_refill = getattr(account, 'next_refill_at', None)
        if next_refill and now >= next_refill:
            # Apply refill
            refill_amount = account.weekly_credit_limit
            account.current_credits = min(
                account.current_credits + refill_amount,
                account.weekly_credit_limit * 2  # Max 2 weeks accumulated
            )
            account.total_earned += refill_amount
            account.last_refill_at = now
            account.next_refill_at = now + datetime.timedelta(days=CREDIT_CONFIG['CREDITS_REFILL_DAYS'])
            
            # Log transaction
            transaction = CreditTransaction(
                account_id=account.id,
                transaction_type='refill',
                amount=refill_amount,
                balance_after=account.current_credits,
                activity_type='weekly_refill',
                description=f"Weekly refill of {refill_amount} credits"
            )
            self.db.add(transaction)
            self.db.commit()
            
            return True
        
        return False
    
    def reset_daily_stats_if_needed(self, stats: CreditUsageStats) -> None:
        """Reset daily counters if it's a new day."""
        now = datetime.datetime.utcnow()
        last_reset = getattr(stats, 'last_daily_reset', None) or now
        
        # Check if last reset was yesterday or earlier
        if last_reset.date() < now.date():
            stats.credits_used_today = 0
            stats.micro_sessions_today = 0
            stats.coding_questions_today = 0
            stats.last_daily_reset = now
            self.db.commit()
    
    def reset_weekly_stats_if_needed(self, stats: CreditUsageStats) -> None:
        """Reset weekly counters if 7 days have passed."""
        now = datetime.datetime.utcnow()
        last_reset = getattr(stats, 'last_weekly_reset', None) or now
        
        days_diff = (now - last_reset).days
        if days_diff >= 7:
            stats.credits_used_this_week = 0
            stats.full_interviews_this_week = 0
            stats.project_ideas_this_week = 0
            stats.last_weekly_reset = now
            self.db.commit()
    
    def check_eligibility(
        self, 
        applicant_id: int, 
        activity_type: str
    ) -> Tuple[bool, str, Dict]:
        """
        Check if user can perform activity based on credits and rate limits.
        
        Returns:
            (can_proceed: bool, message: str, context: dict)
        """
        account = self.get_or_create_account(applicant_id)
        
        # Check for refill
        self.check_and_refill(account)
        
        # Get usage stats
        stats = self.db.query(CreditUsageStats).filter(
            CreditUsageStats.account_id == account.id
        ).first()
        
        if not stats:
            stats = CreditUsageStats(account_id=account.id)
            self.db.add(stats)
            self.db.commit()
            self.db.refresh(stats)
        
        # Reset counters if needed
        self.reset_daily_stats_if_needed(stats)
        self.reset_weekly_stats_if_needed(stats)
        
        # Determine cost and limits
        if activity_type == 'full_interview':
            cost = CREDIT_CONFIG['FULL_MOCK_INTERVIEW_COST']
            weekly_limit = CREDIT_CONFIG['MAX_FULL_INTERVIEWS_PER_WEEK']
            current_count = stats.full_interviews_this_week
            limit_name = "full interviews this week"
        elif activity_type == 'micro_session':
            cost = CREDIT_CONFIG['MICRO_SESSION_COST']
            daily_limit = CREDIT_CONFIG['MAX_MICRO_SESSIONS_PER_DAY']
            current_count = getattr(stats, 'micro_sessions_today', 0)
            limit_name = "micro-sessions today"
            
            if current_count >= daily_limit:
                return False, f"Daily limit reached ({daily_limit} {limit_name})", {
                    'credits': getattr(account, 'current_credits', 0),
                    'limit_reached': True
                }
        elif activity_type == 'coding_question':
            cost = CREDIT_CONFIG['CODING_QUESTION_COST']
            daily_limit = CREDIT_CONFIG['MAX_CODING_QUESTIONS_PER_DAY']
            current_count = getattr(stats, 'coding_questions_today', 0)
            limit_name = "coding questions today"
            
            if current_count >= daily_limit:
                return False, f"Daily limit reached ({daily_limit} {limit_name})", {
                    'credits': getattr(account, 'current_credits', 0),
                    'limit_reached': True
                }
        elif activity_type == 'project_idea':
            cost = CREDIT_CONFIG['PROJECT_IDEA_COST']
            weekly_limit = CREDIT_CONFIG['MAX_PROJECT_IDEAS_PER_WEEK']
            current_count = getattr(stats, 'project_ideas_this_week', 0)
            limit_name = "project ideas this week"
            
            if current_count >= weekly_limit:
                return False, f"Weekly limit reached ({weekly_limit} {limit_name})", {
                    'credits': getattr(account, 'current_credits', 0),
                    'limit_reached': True
                }
        else:
            cost = 1  # Default
        
        # Check credit balance
        current_credits = getattr(account, 'current_credits', 0)
        if current_credits < cost:
            next_refill = getattr(account, 'next_refill_at', datetime.datetime.utcnow())
            days_until_refill = (next_refill - datetime.datetime.utcnow()).days
            return False, f"Insufficient credits. Need {cost}, have {current_credits}. Refill in {days_until_refill} days.", {
                'credits': current_credits,
                'cost': cost,
                'next_refill_days': days_until_refill
            }
        
        # Check daily usage limit
        credits_today = getattr(stats, 'credits_used_today', 0)
        if credits_today + cost > CREDIT_CONFIG['MAX_DAILY_CREDITS_USAGE']:
            return False, f"Daily usage limit reached ({CREDIT_CONFIG['MAX_DAILY_CREDITS_USAGE']} credits/day)", {
                'credits': current_credits,
                'daily_limit_reached': True
            }
        
        # All checks passed
        context = {
            'credits': account.current_credits,
            'cost': cost,
            'balance_after': account.current_credits - cost,
            'next_refill_days': (account.next_refill_at - datetime.datetime.utcnow()).days
        }
        
        return True, "Eligible", context
    
    def spend_credits(
        self,
        applicant_id: int,
        activity_type: str,
        cost: int,
        reference_id: Optional[int] = None,
        reference_type: Optional[str] = None,
        description: Optional[str] = None
    ) -> CreditTransaction:
        """
        Deduct credits and log transaction.
        """
        account = self.get_or_create_account(applicant_id)
        stats = self.db.query(CreditUsageStats).filter(
            CreditUsageStats.account_id == account.id
        ).first()
        
        # Deduct credits
        current_credits = getattr(account, 'current_credits', 0)
        account.current_credits = current_credits - cost
        account.total_spent = getattr(account, 'total_spent', 0) + cost
        
        # Update usage stats
        if stats:
            stats.credits_used_today = getattr(stats, 'credits_used_today', 0) + cost
            stats.credits_used_this_week = getattr(stats, 'credits_used_this_week', 0) + cost
            
            if activity_type == 'full_interview':
                stats.full_interviews_this_week = getattr(stats, 'full_interviews_this_week', 0) + 1
                stats.last_full_interview_at = datetime.datetime.utcnow()
            elif activity_type == 'micro_session':
                stats.micro_sessions_today = getattr(stats, 'micro_sessions_today', 0) + 1
                stats.last_micro_session_at = datetime.datetime.utcnow()
            elif activity_type == 'coding_question':
                stats.coding_questions_today = getattr(stats, 'coding_questions_today', 0) + 1
                stats.last_coding_question_at = datetime.datetime.utcnow()
            elif activity_type == 'project_idea':
                stats.project_ideas_this_week = getattr(stats, 'project_ideas_this_week', 0) + 1
        
        # Log transaction
        transaction = CreditTransaction(
            account_id=account.id,
            transaction_type='spend',
            amount=-cost,
            balance_after=account.current_credits,
            activity_type=activity_type,
            reference_id=reference_id,
            reference_type=reference_type,
            description=description or f"Spent {cost} credits on {activity_type}"
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        
        return transaction
    
    def add_bonus_credits(
        self,
        applicant_id: int,
        amount: int,
        admin_email: str,
        reason: str
    ) -> CreditTransaction:
        """
        Admin function to add bonus credits.
        """
        account = self.get_or_create_account(applicant_id)
        
        account.current_credits = getattr(account, 'current_credits', 0) + amount
        account.total_earned = getattr(account, 'total_earned', 0) + amount
        account.admin_bonus_credits = getattr(account, 'admin_bonus_credits', 0) + amount
        
        transaction = CreditTransaction(
            account_id=account.id,
            transaction_type='bonus',
            amount=amount,
            balance_after=account.current_credits,
            activity_type='admin_adjustment',
            description=f"Admin bonus by {admin_email}: {reason}"
        )
        self.db.add(transaction)
        self.db.commit()
        self.db.refresh(transaction)
        
        return transaction
    
    def get_account_summary(self, applicant_id: int) -> Dict:
        """
        Get complete account summary for dashboard display.
        """
        account = self.get_or_create_account(applicant_id)
        self.check_and_refill(account)
        
        stats = self.db.query(CreditUsageStats).filter(
            CreditUsageStats.account_id == account.id
        ).first()
        
        if stats:
            self.reset_daily_stats_if_needed(stats)
            self.reset_weekly_stats_if_needed(stats)
        
        now = datetime.datetime.utcnow()
        next_refill = getattr(account, 'next_refill_at', now)
        days_until_refill = max(0, (next_refill - now).days)
        hours_until_refill = max(0, ((next_refill - now).seconds // 3600))
        
        return {
            'current_credits': getattr(account, 'current_credits', 0),
            'weekly_limit': getattr(account, 'weekly_credit_limit', 60),
            'is_premium': getattr(account, 'is_premium', False),
            'next_refill_days': days_until_refill,
            'next_refill_hours': hours_until_refill,
            'next_refill_at': next_refill.isoformat(),
            'usage_today': {
                'credits': getattr(stats, 'credits_used_today', 0) if stats else 0,
                'micro_sessions': getattr(stats, 'micro_sessions_today', 0) if stats else 0,
                'coding_questions': getattr(stats, 'coding_questions_today', 0) if stats else 0,
            },
            'usage_this_week': {
                'credits': getattr(stats, 'credits_used_this_week', 0) if stats else 0,
                'full_interviews': getattr(stats, 'full_interviews_this_week', 0) if stats else 0,
                'project_ideas': getattr(stats, 'project_ideas_this_week', 0) if stats else 0,
            },
            'limits': {
                'max_daily_credits': CREDIT_CONFIG['MAX_DAILY_CREDITS_USAGE'],
                'max_full_interviews_weekly': CREDIT_CONFIG['MAX_FULL_INTERVIEWS_PER_WEEK'],
                'max_micro_sessions_daily': CREDIT_CONFIG['MAX_MICRO_SESSIONS_PER_DAY'],
                'max_coding_questions_daily': CREDIT_CONFIG['MAX_CODING_QUESTIONS_PER_DAY'],
                'max_project_ideas_weekly': CREDIT_CONFIG['MAX_PROJECT_IDEAS_PER_WEEK'],
            },
            'costs': {
                'full_interview': CREDIT_CONFIG['FULL_MOCK_INTERVIEW_COST'],
                'micro_session': CREDIT_CONFIG['MICRO_SESSION_COST'],
                'coding_question': CREDIT_CONFIG['CODING_QUESTION_COST'],
                'project_idea': CREDIT_CONFIG['PROJECT_IDEA_COST'],
            }
        }
