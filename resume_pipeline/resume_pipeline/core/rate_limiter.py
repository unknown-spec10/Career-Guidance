import time
import asyncio
import threading
import logging

logger = logging.getLogger(__name__)

# Circuit Breaker states
STATE_CLOSED = "CLOSED"
STATE_OPEN = "OPEN"
STATE_HALF_OPEN = "HALF_OPEN"

class RateLimiter:
    def __init__(self, calls_per_minute: int):
        self.min_interval = 60.0 / calls_per_minute  # e.g. 10 RPM → 6s gap
        self._last_call_time = 0.0
        self._async_lock = asyncio.Lock()
        self._sync_lock = threading.Lock()

        # Circuit Breaker state
        self.state = STATE_CLOSED
        self.last_state_change = 0.0
        self.cooldown_duration = 60.0  # seconds the circuit stays OPEN before testing
        self.trial_in_progress = False
        self.trial_start_time = 0.0

    async def acquire(self):
        """Async — await this before every AI API call."""
        async with self._async_lock:
            elapsed = time.monotonic() - self._last_call_time
            wait = self.min_interval - elapsed
            if wait > 0:
                logger.debug(f"Rate limiter sleeping {wait:.1f}s")
                await asyncio.sleep(wait)
            self._last_call_time = time.monotonic()

    def acquire_sync(self):
        """Sync — call this in non-async code (like backfill scripts or sync background tasks)."""
        with self._sync_lock:
            elapsed = time.monotonic() - self._last_call_time
            wait = self.min_interval - elapsed
            if wait > 0:
                logger.debug(f"Rate limiter sleeping {wait:.1f}s")
                time.sleep(wait)
            self._last_call_time = time.monotonic()

    # ------------------------------------------------------------------
    # Circuit Breaker API
    # ------------------------------------------------------------------

    def allow_call(self) -> bool:
        """Check if the circuit breaker allows calls to proceed.
        
        Manages transition from OPEN to HALF_OPEN after the cooldown period.
        """
        with self._sync_lock:
            now = time.monotonic()

            if self.state == STATE_CLOSED:
                return True

            if self.state == STATE_OPEN:
                # If cooldown period has elapsed, transition to HALF_OPEN
                if now - self.last_state_change >= self.cooldown_duration:
                    self.state = STATE_HALF_OPEN
                    self.trial_in_progress = True
                    self.trial_start_time = now
                    logger.info("Circuit breaker transitioned to HALF_OPEN. Allowing trial call.")
                    return True
                return False

            if self.state == STATE_HALF_OPEN:
                # Permit a new trial call only if the previous trial call has timed out (e.g., 15s)
                if self.trial_in_progress and (now - self.trial_start_time < 15.0):
                    return False
                self.trial_in_progress = True
                self.trial_start_time = now
                return True

            return True

    def report_success(self):
        """Report a successful call. Closes the circuit breaker."""
        with self._sync_lock:
            if self.state != STATE_CLOSED:
                logger.info(f"Circuit breaker transitioned from {self.state} to CLOSED (success).")
                self.state = STATE_CLOSED
            self.trial_in_progress = False
            self.trial_start_time = 0.0

    def report_failure(self):
        """Report a failed call. Trips/opens the circuit breaker."""
        with self._sync_lock:
            now = time.monotonic()
            if self.state != STATE_OPEN:
                logger.warning(f"Circuit breaker tripped to OPEN for {self.cooldown_duration}s (failure).")
                self.state = STATE_OPEN
                self.last_state_change = now
            self.trial_in_progress = False
            self.trial_start_time = 0.0

# Shared singletons — import these wherever you call AI
gemini_limiter = RateLimiter(calls_per_minute=10)  # Gemini free tier ~15 RPM, use 10
groq_limiter   = RateLimiter(calls_per_minute=20)  # Groq is generous, 20 is safe

# Embedding rate limits: Gemini Embedding free tier is 15 RPM
gemini_embedding_limiter = RateLimiter(calls_per_minute=10)
gemini_embedding_limiter.cooldown_duration = 30.0  # Tripped cooldown duration (seconds)


