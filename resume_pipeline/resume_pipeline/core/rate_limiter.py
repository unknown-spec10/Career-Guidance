import time
import asyncio
import threading
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, calls_per_minute: int):
        self.min_interval = 60.0 / calls_per_minute  # e.g. 10 RPM → 6s gap
        self._last_call_time = 0.0
        self._async_lock = asyncio.Lock()
        self._sync_lock = threading.Lock()

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

# Shared singletons — import these wherever you call AI
gemini_limiter = RateLimiter(calls_per_minute=10)  # Gemini free tier ~15 RPM, use 10
groq_limiter   = RateLimiter(calls_per_minute=20)  # Groq is generous, 20 is safe
