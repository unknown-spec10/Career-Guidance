import pytest
import time
from unittest.mock import MagicMock, patch
from resume_pipeline.core.rate_limiter import RateLimiter, STATE_CLOSED, STATE_OPEN, STATE_HALF_OPEN

def test_circuit_breaker_initial_state():
    """Verify rate limiter starts in CLOSED state and allows calls."""
    limiter = RateLimiter(calls_per_minute=10)
    assert limiter.state == STATE_CLOSED
    assert limiter.allow_call() is True

def test_circuit_breaker_tripping_on_failure():
    """Verify circuit trips to OPEN and rejects calls after a failure."""
    limiter = RateLimiter(calls_per_minute=10)
    assert limiter.allow_call() is True
    
    limiter.report_failure()
    assert limiter.state == STATE_OPEN
    assert limiter.allow_call() is False

def test_circuit_breaker_cooldown_to_half_open():
    """Verify circuit transitions to HALF_OPEN after cooldown duration passes."""
    limiter = RateLimiter(calls_per_minute=10)
    limiter.cooldown_duration = 0.1  # Set a tiny cooldown for testing
    
    limiter.report_failure()
    assert limiter.allow_call() is False
    
    # Sleep to exceed the cooldown duration
    time.sleep(0.15)
    
    #allow_call() should transition it to HALF_OPEN and return True
    assert limiter.allow_call() is True
    assert limiter.state == STATE_HALF_OPEN

def test_circuit_breaker_half_open_limits_to_one_trial():
    """Verify only exactly one concurrent trial call is allowed in HALF_OPEN."""
    limiter = RateLimiter(calls_per_minute=10)
    limiter.cooldown_duration = 0.1
    
    limiter.report_failure()
    time.sleep(0.15)
    
    # First call goes through (trial call)
    assert limiter.allow_call() is True
    assert limiter.trial_in_progress is True
    
    # Concurrent second call should be blocked
    assert limiter.allow_call() is False

def test_circuit_breaker_half_open_recovery():
    """Verify success in HALF_OPEN closes the circuit again."""
    limiter = RateLimiter(calls_per_minute=10)
    limiter.cooldown_duration = 0.1
    
    limiter.report_failure()
    time.sleep(0.15)
    
    # Trial call allowed
    assert limiter.allow_call() is True
    
    # Report success
    limiter.report_success()
    assert limiter.state == STATE_CLOSED
    assert limiter.trial_in_progress is False
    
    # Subsequent calls allowed
    assert limiter.allow_call() is True

def test_circuit_breaker_half_open_re_trip():
    """Verify failure in HALF_OPEN trips the circuit back to OPEN."""
    limiter = RateLimiter(calls_per_minute=10)
    limiter.cooldown_duration = 0.1
    
    limiter.report_failure()
    time.sleep(0.15)
    
    # Trial call allowed
    assert limiter.allow_call() is True
    
    # Trial fails
    limiter.report_failure()
    assert limiter.state == STATE_OPEN
    assert limiter.trial_in_progress is False
    
    # Tripped again
    assert limiter.allow_call() is False
