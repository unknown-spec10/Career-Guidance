# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Dict
from collections import defaultdict
from time import time
from ..auth import (
    get_current_user,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

RAG_RATE_LIMIT = 20
RAG_RATE_WINDOW = 60.0
rag_rate_limiter: Dict[str, Dict[str, float]] = defaultdict(
    lambda: {"count": 0, "reset_time": 0.0}
)


# ============================================================
# RAG (Retrieval Augmented Generation) Q&A Endpoints
# ============================================================

class RAGQuery(BaseModel):
    """Request model for RAG question"""
    query: str = Field(..., min_length=3, max_length=500, description="User's question")

class RAGSource(BaseModel):
    """Source document reference"""
    file: str
    section: str
    relevance: float
    preview: str

class RAGAnswerResponse(BaseModel):
    """Response from RAG system"""
    query: str
    answer: str
    sources: List[RAGSource]
    metadata: dict = Field(default_factory=dict)

class RAGSuggestionsResponse(BaseModel):
    """Suggested questions response"""
    suggestions: List[str]

def check_rag_rate_limit(user_id: str) -> tuple[bool, str]:
    """Check rate limit for RAG requests"""
    current_time = time()
    user_limits = rag_rate_limiter[user_id]
    
    if current_time > user_limits["reset_time"]:
        user_limits["count"] = 0
        user_limits["reset_time"] = current_time + RAG_RATE_WINDOW
    
    if user_limits["count"] >= RAG_RATE_LIMIT:
        remaining = int(user_limits["reset_time"] - current_time)
        return False, f"Rate limit exceeded. Please wait {remaining} seconds."
    
    user_limits["count"] += 1
    return True, ""

@router.post("/api/rag/ask", response_model=RAGAnswerResponse)
async def rag_ask_question(
    body: RAGQuery,
    request: Request,
    current_user = Depends(get_current_user)
):
    """
    Ask a question about the Career Guidance AI application.

    Authentication is required (each caller funds LLM cost and abuse would
    otherwise be anonymous). The RAG system uses documentation as its
    knowledge base and provides answers with source citations.

    Rate limits:
    - 20 requests per minute per user
    - Abuse prevention for off-topic/spam queries
    """
    from ..rag import get_rag_service

    # Authenticated user identifier for rate limiting
    user_id = str(current_user.id)
    
    # Check rate limit
    allowed, error_msg = check_rag_rate_limit(user_id)
    if not allowed:
        raise HTTPException(status_code=429, detail=error_msg)
    
    # Get RAG service
    rag_service = get_rag_service()
    
    # Initialize if needed
    if not rag_service._is_initialized:
        if not rag_service.initialize():
            raise HTTPException(
                status_code=503,
                detail="RAG system is temporarily unavailable. Please try again later."
            )
    
    # Process query
    try:
        response, error = await rag_service.ask(
            query=body.query,
            user_id=user_id,
            use_cache=True
        )
    except Exception:
        logger.exception("RAG ask failed")
        raise HTTPException(
            status_code=500,
            detail="Failed to process query. Please try again later."
        )

    if error or response is None:
        # Never surface upstream internals (provider errors may embed keys,
        # DSNs, or prompt text); log them and return a generic message.
        logger.warning("RAG query failed for user %s: %s", user_id, error)
        raise HTTPException(
            status_code=400,
            detail="Failed to process query. Please try again later."
        )
    
    return RAGAnswerResponse(
        query=response.query,
        answer=response.answer,
        sources=[RAGSource(**s) for s in response.sources],
        metadata=response.metadata
    )


@router.get("/api/rag/suggestions", response_model=RAGSuggestionsResponse)
async def rag_get_suggestions():
    """
    Get suggested questions that users can ask.
    
    Returns a list of common questions about the application.
    """
    from ..rag import get_rag_service
    
    rag_service = get_rag_service()
    suggestions = rag_service.get_suggested_questions()
    
    return RAGSuggestionsResponse(suggestions=suggestions)

