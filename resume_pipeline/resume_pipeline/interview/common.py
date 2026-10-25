"""Interview System v2 — shared route helpers.

Single home for the small utilities used by both route modules
(:mod:`sessions` and :mod:`streaming`): the sendBeacon HMAC helpers,
the request DB dependency, applicant resolution, question shaping,
the retry budget, the generic async-generator streaming adapters, and
the SSE hygiene wrappers (idle timeout + heartbeat comments, audit §4.2).
No routes are defined here.
"""
import asyncio
import json
import logging
import time
from typing import Any, AsyncGenerator, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session as DBSession

from ..config import settings, INTERVIEW_CONFIG_V2
from ..db import Applicant, InterviewQuestion, SessionLocal
from .schemas import QuestionOut

logger = logging.getLogger(__name__)

MAX_EVAL_RETRIES = 3  # total attempts per answer (initial + 2 retries)

# SSE hygiene (audit §4.2): idle streams must not pin a uvicorn worker
# forever. Streams are cut after SSE_STREAM_TIMEOUT_SECONDS and emit an
# SSE comment (`: ping`) whenever idle for SSE_HEARTBEAT_INTERVAL_SECONDS.
# Frontend fetch-loops only react to `data: ` lines, so comments are a
# no-op for the UI while keeping proxies/load-balancers from closing
# idle connections.
SSE_STREAM_TIMEOUT_SECONDS = INTERVIEW_CONFIG_V2.get("SSE_STREAM_TIMEOUT_SECONDS", 120)
SSE_HEARTBEAT_INTERVAL_SECONDS = INTERVIEW_CONFIG_V2.get("SSE_HEARTBEAT_INTERVAL_SECONDS", 15)


def _hmac_key() -> Optional[bytes]:
    secret = settings.SECRET_KEY
    if not secret:
        return None
    return secret.encode()


def _make_abandon_token(session_id: str, applicant_id: int) -> str:
    """Single-purpose HMAC token authorizing abandonment of ONE session.

    navigator.sendBeacon cannot set Authorization headers, so the abandon
    endpoint accepts this token instead. It grants no other capability and is
    only derivable with the server-side SECRET_KEY. Fails closed when no
    secret is configured.
    """
    import hmac
    import hashlib
    key = _hmac_key()
    if key is None:
        logger.error("Refusing to mint abandon token: SECRET_KEY is not configured")
        raise HTTPException(status_code=500, detail="Server misconfiguration")
    msg = f"abandon:{session_id}:{applicant_id}".encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def _abandon_token_is_valid(session, token: Optional[str]) -> bool:
    if not token:
        return False
    key = _hmac_key()
    if key is None:
        logger.error("Refusing to verify abandon token: SECRET_KEY is not configured")
        return False
    import hmac
    import hashlib
    msg = f"abandon:{session.id}:{session.applicant_id}".encode()
    expected = hmac.new(key, msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, str(token))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_applicant(current_user, db: DBSession) -> Applicant:
    """Resolve the Applicant record from the authenticated user."""
    if not getattr(current_user, "is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    applicant = db.query(Applicant).filter_by(user_id=current_user.id).first()
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant profile not found.")
    return applicant


def _question_to_out(q: InterviewQuestion, number: int, total: int, hint: Optional[str] = None) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        text=q.question_text,
        question_number=number,
        total_questions=total,
        skill_tag=q.skill_tag,
        hint=hint,
    )


# ---------------------------------------------------------------------------
# GET /api/interview/study-plan/{session_id}  — SSE stream
# ---------------------------------------------------------------------------

async def _stream_cached_plan(plan_text: str) -> AsyncGenerator[str, None]:
    """Yield cached study plan in small chunks to simulate streaming animation quickly."""
    import asyncio
    chunk_size = 120
    for i in range(0, len(plan_text), chunk_size):
        chunk = plan_text[i:i+chunk_size]
        yield f"data: {json.dumps({'token': chunk})}\n\n"
        await asyncio.sleep(0.005)
    yield "data: [DONE]\n\n"


async def wrap_sse_with_heartbeat(
    stream: AsyncGenerator[str, None],
    timeout: float = SSE_STREAM_TIMEOUT_SECONDS,
    heartbeat_interval: float = SSE_HEARTBEAT_INTERVAL_SECONDS,
) -> AsyncGenerator[str, None]:
    """Bound an SSE stream with an idle timeout and heartbeat comments.

    Yields upstream chunks unchanged; when no chunk arrives within
    ``heartbeat_interval`` seconds a ``: ping`` comment keeps the
    connection alive. Stops after ``timeout`` seconds total so a stalled
    LLM can never pin a worker indefinitely. The inner generators already
    terminate with ``data: [DONE]`` on the success path.
    """
    start = time.monotonic()
    iterator = stream.__aiter__()
    # A single in-flight `__anext__` task survives heartbeat timeouts via
    # shield: timing out the wait must never cancel the upstream generator.
    pending = None
    try:
        while True:
            elapsed = time.monotonic() - start
            if elapsed >= timeout:
                logger.warning("SSE stream cut after %.0fs idle timeout", timeout)
                return
            if pending is None:
                pending = asyncio.ensure_future(iterator.__anext__())
            try:
                item = await asyncio.wait_for(
                    asyncio.shield(pending), timeout=heartbeat_interval
                )
                pending = None
                yield item
            except (StopAsyncIteration, StopIteration):
                return
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        if pending is not None and not pending.done():
            pending.cancel()


# ---------------------------------------------------------------------------
async def run_generator_in_thread(sync_gen) -> AsyncGenerator[Any, None]:
    """Utility to run a synchronous generator in a background thread and yield asynchronously."""
    import queue
    import asyncio
    q = queue.Queue(maxsize=10)
    loop = asyncio.get_running_loop()

    def producer():
        try:
            for item in sync_gen:
                q.put(item)
        except Exception as e:
            q.put(e)
        finally:
            q.put(None)

    # Offload the synchronous iteration to the thread pool executor (without awaiting)
    loop.run_in_executor(None, producer)

    while True:
        item = await asyncio.to_thread(q.get)
        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        yield item


