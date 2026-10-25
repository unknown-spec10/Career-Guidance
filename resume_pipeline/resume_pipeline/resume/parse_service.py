"""
parse_service.py — resume parse entry point.

Deterministic rule-based engine (no LLMs, no network calls). This module
is a thin backward-compatible facade over rule_parser.RuleBasedParserService
so existing callers (routers, embedding_tasks, tests) keep working unchanged:

    service = ResumeParserService()
    result = await service.run_parse_async(applicant_root, applicant_id, db_session)
    result = service.run_parse(applicant_root, applicant_id)

Result keys: applicant_id, normalized, flags, needs_review, parse_status,
per_section_confidence, overall_confidence, unrecognized_skills,
provenance (+ llm_provenance alias), resume_type, retry_used.
"""

import asyncio
import logging

from ..core.interfaces import ParserService
from .rule_parser import (
    RuleBasedParserService,
)

logger = logging.getLogger(__name__)


class ResumeParserService(RuleBasedParserService, ParserService):
    """Facade: historic class name and async API, deterministic engine."""

    async def run_parse_async(
        self,
        applicant_root: str,
        applicant_id: str,
        db_session=None,
    ) -> dict:
        """Thread off the CPU-bound deterministic pipeline; never blocks the loop."""
        return await asyncio.to_thread(
            self.run_parse, applicant_root, applicant_id, db_session
        )
