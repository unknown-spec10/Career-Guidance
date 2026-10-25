"""Auth router package — thin aggregator (paths/methods/guards unchanged).

Split of the former ``routers/auth.py`` monolith (1027 lines) into one router
per concern; lifecycle (startup/shutdown) wiring already lives in
:mod:`resume_pipeline.app` and is not duplicated here.

Import surface is backward compatible: ``from .routers.auth import router``.
"""
from fastapi import APIRouter

from .session import router as session_router
from .oauth import router as oauth_router
from .password_reset import router as password_reset_router
from .verification import router as verification_router

router = APIRouter()
router.include_router(session_router)
router.include_router(oauth_router)
router.include_router(password_reset_router)
router.include_router(verification_router)

__all__ = [
    "router",
    "session_router",
    "oauth_router",
    "password_reset_router",
    "verification_router",
]
