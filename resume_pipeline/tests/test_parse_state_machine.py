"""
test_parse_state_machine.py
---------------------------
Unit tests for the state machine logic in ResumeParserService.
Tests the three threshold transitions: AUTO_ACCEPT, NEEDS_REVIEW, RE_PARSE.
No file system, no API calls — directly calls _state_machine().

Thresholds are the RULE-based retuned values (rule_parser.py):
  AUTO_ACCEPT >= 0.75, NEEDS_REVIEW 0.50-0.74, RE_PARSE < 0.50.
"""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.resume.parse_service import ResumeParserService
from resume_pipeline.resume.rule_parser import (
    RULE_AUTO_ACCEPT_THRESHOLD,
    RULE_REVIEW_THRESHOLD,
)
from resume_pipeline.config import (
    PARSE_STATUS_ACCEPTED,
    PARSE_STATUS_FAILED,
    PARSE_STATUS_PENDING_REVIEW,
)


@pytest.fixture
def service():
    return ResumeParserService()


# ── AUTO_ACCEPT ───────────────────────────────────────────────────────────────

def test_state_machine_auto_accept_at_threshold(service):
    """Exactly at 0.75 → AUTO_ACCEPT"""
    result = {}
    status, needs_review = service._state_machine(RULE_AUTO_ACCEPT_THRESHOLD, result)
    assert RULE_AUTO_ACCEPT_THRESHOLD == 0.75
    assert status == PARSE_STATUS_ACCEPTED
    assert needs_review is False
    assert result.get("flags", []) == []


def test_state_machine_auto_accept_above_threshold(service):
    """0.95 → AUTO_ACCEPT"""
    result = {}
    status, needs_review = service._state_machine(0.95, result)
    assert status == PARSE_STATUS_ACCEPTED
    assert needs_review is False


# ── NEEDS_REVIEW ──────────────────────────────────────────────────────────────

def test_state_machine_needs_review_at_lower_threshold(service):
    """Exactly at 0.50 → NEEDS_REVIEW"""
    result = {"flags": []}
    status, needs_review = service._state_machine(RULE_REVIEW_THRESHOLD, result)
    assert RULE_REVIEW_THRESHOLD == 0.50
    assert status == PARSE_STATUS_PENDING_REVIEW
    assert needs_review is True
    assert any("low_confidence" in f for f in result["flags"])


def test_state_machine_needs_review_midpoint(service):
    """0.65 → NEEDS_REVIEW"""
    result = {"flags": []}
    status, needs_review = service._state_machine(0.65, result)
    assert status == PARSE_STATUS_PENDING_REVIEW
    assert needs_review is True


def test_state_machine_needs_review_just_below_accept(service):
    """0.74 → NEEDS_REVIEW (one tick below AUTO_ACCEPT threshold)"""
    result = {"flags": []}
    status, needs_review = service._state_machine(0.74, result)
    assert status == PARSE_STATUS_PENDING_REVIEW
    assert needs_review is True


# ── RE_PARSE ──────────────────────────────────────────────────────────────────

def test_state_machine_reparse_at_zero(service):
    """0.0 → RE_PARSE (FAILED)"""
    result = {"flags": []}
    status, needs_review = service._state_machine(0.0, result)
    assert status == PARSE_STATUS_FAILED
    assert needs_review is True
    assert any("very_low_confidence" in f for f in result["flags"])


def test_state_machine_reparse_just_below_review_threshold(service):
    """0.49 → RE_PARSE"""
    result = {"flags": []}
    status, needs_review = service._state_machine(0.49, result)
    assert status == PARSE_STATUS_FAILED
    assert needs_review is True


# ── Boundary precision ────────────────────────────────────────────────────────

def test_state_machine_boundary_0_50(service):
    """0.50 must be NEEDS_REVIEW not FAILED"""
    result = {"flags": []}
    status, _ = service._state_machine(0.50, result)
    assert status == PARSE_STATUS_PENDING_REVIEW, (
        f"0.50 should be NEEDS_REVIEW (got {status})"
    )


def test_state_machine_boundary_0_75(service):
    """0.75 must be ACCEPTED not NEEDS_REVIEW"""
    result = {}
    status, _ = service._state_machine(0.75, result)
    assert status == PARSE_STATUS_ACCEPTED, (
        f"0.75 should be ACCEPTED (got {status})"
    )


# ── Flags integrity ───────────────────────────────────────────────────────────

def test_state_machine_auto_accept_adds_no_flags(service):
    """AUTO_ACCEPT should not add any flags to result"""
    result = {"flags": []}
    service._state_machine(0.90, result)
    assert result["flags"] == []


def test_state_machine_needs_review_adds_flag(service):
    """NEEDS_REVIEW should append a low_confidence flag"""
    result = {"flags": []}
    service._state_machine(0.60, result)
    assert len(result["flags"]) == 1
    assert "low_confidence" in result["flags"][0]


def test_state_machine_reparse_adds_very_low_flag(service):
    """RE_PARSE should append a very_low_confidence flag"""
    result = {"flags": []}
    service._state_machine(0.30, result)
    assert any("very_low_confidence" in f for f in result["flags"])
