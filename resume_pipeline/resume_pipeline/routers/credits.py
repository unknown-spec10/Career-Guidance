# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..db import (
    Applicant,
    CreditAccount,
    CreditTransaction,
)
from typing import List
from ..schemas import (
    CreditAccountResponse,
    CreditTransactionResponse,
)
from ..auth import (
    get_current_user,
)
import logging
import datetime as dt
from .deps import (
    get_db,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# INTERVIEW SYSTEM v2
# ============================================================
# All interview endpoints are now handled by the interview router
# registered via app.include_router(interview_router_v2) above.
# Routes: /api/interview/start, /api/interview/answer,
#         /api/interview/session/{id}, /api/interview/results/{id},
#         /api/interview/study-plan/{id}, /api/interview/hint/{id},
#         /api/interview/feedback/{id}, /api/interview/abandon/{id},
#         /api/interview/active-session


# ============================================================
# CREDIT SYSTEM ENDPOINTS
# ============================================================

@router.get("/api/credits/balance", response_model=CreditAccountResponse)
def get_credit_balance(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current credit balance and usage statistics.
    """
    from ..core.credit_service import CreditService
    
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    credit_service = CreditService(db)
    applicant_id_val = getattr(applicant, 'id', 0)
    
    summary = credit_service.get_account_summary(applicant_id_val)
    return summary


@router.get("/api/credits/transactions", response_model=List[CreditTransactionResponse])
def get_credit_transactions(
    limit: int = 50,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get credit transaction history.
    """
    from ..db import CreditAccount, CreditTransaction
    
    applicant = (
        db.query(Applicant)
        .filter(Applicant.user_id == current_user.id)
        .order_by(desc(Applicant.id))
        .first()
    )
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
    
    applicant_id_val = getattr(applicant, 'id', 0)
    
    # Get account
    account = db.query(CreditAccount).filter(
        CreditAccount.applicant_id == applicant_id_val
    ).first()
    
    if not account:
        return []
    
    # Get transactions
    transactions = db.query(CreditTransaction).filter(
        CreditTransaction.account_id == account.id
    ).order_by(desc(CreditTransaction.created_at)).limit(limit).all()
    
    return [
        {
            "id": t.id,
            "transaction_type": getattr(t, 'transaction_type', ''),
            "amount": getattr(t, 'amount', 0),
            "balance_after": getattr(t, 'balance_after', 0),
            "activity_type": getattr(t, 'activity_type', None),
            "description": getattr(t, 'description', None),
            "created_at": getattr(t, 'created_at', dt.datetime.utcnow())
        }
        for t in transactions
    ]


@router.post("/api/credits/upgrade")
def upgrade_to_premium(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upgrade student to premium tier.
    Sets is_premium to True, increases weekly limit to 300, and adjusts current credits to 300.
    """
    from ..core.credit_service import CreditService
    from ..db import Applicant, CreditTransaction
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
        
    credit_service = CreditService(db)
    account = credit_service.get_or_create_account(applicant.id)
    
    # Update fields
    account.is_premium = True
    account.weekly_credit_limit = 300
    
    # Instantly set or add credits to 300
    if account.current_credits < 300:
        added_amount = 300 - account.current_credits
        account.current_credits = 300
        account.total_earned += added_amount
        
        # Log transaction
        transaction = CreditTransaction(
            account_id=account.id,
            transaction_type='bonus',
            amount=added_amount,
            balance_after=account.current_credits,
            activity_type='bonus_credits',
            description="Upgraded to Pro: Instantly refilled to 300 credits"
        )
        db.add(transaction)
    else:
        # Just log standard upgrade
        transaction = CreditTransaction(
            account_id=account.id,
            transaction_type='bonus',
            amount=0,
            balance_after=account.current_credits,
            activity_type='bonus_credits',
            description="Upgraded to Pro subscription tier"
        )
        db.add(transaction)
        
    db.commit()
    db.refresh(account)
    
    return credit_service.get_account_summary(applicant.id)


@router.post("/api/credits/downgrade")
def downgrade_to_free(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Downgrade student back to free tier.
    Resets is_premium to False, sets weekly limit to 60, and caps credits at 60.
    """
    from ..core.credit_service import CreditService
    from ..db import Applicant, CreditTransaction
    
    applicant = db.query(Applicant).filter(Applicant.user_id == current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found")
        
    credit_service = CreditService(db)
    account = credit_service.get_or_create_account(applicant.id)
    
    # Update fields
    account.is_premium = False
    account.weekly_credit_limit = 60
    
    # Cap credits at 60
    if account.current_credits > 60:
        lost_amount = account.current_credits - 60
        account.current_credits = 60
        
        # Log transaction
        transaction = CreditTransaction(
            account_id=account.id,
            transaction_type='charge',
            amount=lost_amount,
            balance_after=account.current_credits,
            activity_type='full_interview',  # generic charge
            description="Downgraded to Free: Credits adjusted back to 60"
        )
        db.add(transaction)
    else:
        transaction = CreditTransaction(
            account_id=account.id,
            transaction_type='charge',
            amount=0,
            balance_after=account.current_credits,
            activity_type='full_interview',
            description="Downgraded to Free tier subscription"
        )
        db.add(transaction)
        
    db.commit()
    db.refresh(account)
    
    return credit_service.get_account_summary(applicant.id)
