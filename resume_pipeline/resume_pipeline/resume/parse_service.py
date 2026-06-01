"""
parse_service.py
----------------
Redesigned resume parse pipeline (v2.0).

Architecture:
  Layer 1: FileTypeRouter — detects resume type, routes to pdfplumber or Gemini Vision
  Layer 2: Decomposed concurrent LLM extraction — 6 section-scoped prompts via asyncio.gather()
  Layer 3: Two-pass skill normalization — rapidfuzz → pgvector cosine similarity
  Layer 4: Heuristic confidence scoring + state machine (AUTO_ACCEPT / NEEDS_REVIEW / RE_PARSE)

The pipeline runs entirely as a FastAPI BackgroundTask and is non-blocking from the API.

Public API:
    service = ResumeParserService()
    result = await service.run_parse_async(applicant_root, applicant_id, db_session)
"""

import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..config import settings
from ..constants import (
    PARSE_AUTO_ACCEPT_THRESHOLD,
    PARSE_REVIEW_THRESHOLD,
    PARSE_STATUS_ACCEPTED,
    PARSE_STATUS_FAILED,
    PARSE_STATUS_PENDING_REVIEW,
    SECTION_RETRY_THRESHOLD,
)
from ..core.interfaces import ParserService
from .confidence_scorer import ConfidenceScorer
from .file_type_router import FileTypeRouter, ResumeType
from .llm_gemini import GeminiLLMClient
from .llm_groq import (
    extract_contact,
    extract_education,
    extract_experience,
    extract_extras,
    extract_projects,
    extract_skills,
)
from .skill_normalizer import SkillNormalizer

logger = logging.getLogger(__name__)


def _count_words(text: str) -> int:
    return len(text.split()) if text else 0


def _safe_get(d: Any, key: str, default: Any = None) -> Any:
    """Safely get a key from a dict that might be an error dict."""
    if not isinstance(d, dict) or "error" in d:
        return default
    return d.get(key, default)


def _merge_sections(
    contact: dict,
    education: dict,
    experience: dict,
    skills: dict,
    projects: dict,
    extras: dict,
) -> dict:
    """Merge all six section dicts into a single normalized resume dict."""
    return {
        "personal": {
            "name":          _safe_get(contact, "name"),
            "email":         _safe_get(contact, "email"),
            "phone":         _safe_get(contact, "phone"),
            "location":      _safe_get(contact, "location"),
            "linkedin_url":  _safe_get(contact, "linkedin_url"),
            "github_url":    _safe_get(contact, "github_url"),
            "portfolio_url": _safe_get(contact, "portfolio_url"),
        },
        "education":       _safe_get(education, "education",  []) or [],
        "experience":      _safe_get(experience, "experience", []) or [],
        "skills":          [],   # filled in after normalization
        "projects":        _safe_get(projects, "projects",    []) or [],
        "certifications":  _safe_get(extras, "certifications", []) or [],
        "awards":          _safe_get(extras, "awards",         []) or [],
        "languages_spoken": _safe_get(extras, "languages_spoken", []) or [],
        "publications":    _safe_get(extras, "publications",   []) or [],
        "volunteer":       _safe_get(extras, "volunteer",      []) or [],
        "jee_rank":        None,
    }


# ─────────────────────────────────────────────────────────────────────────────


class ResumeParserService(ParserService):
    """
    Async-first resume parser service.

    Provides:
      - run_parse_async(): full v2 pipeline (primary)
      - run_parse(): legacy sync shim for backward compatibility
    """

    def __init__(self):
        self.llm = GeminiLLMClient()
        self.router = FileTypeRouter(
            llm_client=self.llm,
            vision_model=settings.GEMINI_SMALL_MODEL,  # gemini-2.5-flash
        )
        self.scorer = ConfidenceScorer()

    # ─────────────────────────────────────────────────────────
    # Primary async pipeline
    # ─────────────────────────────────────────────────────────

    async def run_parse_async(
        self,
        applicant_root: str,
        applicant_id: str,
        db_session=None,
    ) -> dict:
        """
        Full v2 async pipeline. Returns a result dict consumed by embedding_tasks.py.

        Result keys:
            applicant_id, normalized, flags, needs_review, parse_status,
            per_section_confidence, overall_confidence, unrecognized_skills,
            llm_provenance, resume_type, retry_used
        """
        p = Path(applicant_root)
        result: dict = {
            "applicant_id":         applicant_id,
            "normalized":           {},
            "flags":                [],
            "needs_review":         False,
            "parse_status":         PARSE_STATUS_ACCEPTED,
            "per_section_confidence": {},
            "overall_confidence":   0.0,
            "unrecognized_skills":  [],
            "llm_provenance":       {},
            "resume_type":          "unknown",
            "retry_used":           False,
        }

        # ── Step 1: Find resume file ──────────────────────────────────────
        resume_path = self._find_resume_file(p)
        if not resume_path:
            logger.error(f"No resume file found in {applicant_root}")
            result["flags"].append("no_resume_file")
            result["parse_status"] = PARSE_STATUS_FAILED
            return result

        # ── Step 2: Layer 1 — FileTypeRouter ─────────────────────────────
        try:
            raw_text, resume_type = self.router.extract(resume_path)
            result["resume_type"] = resume_type.value
            logger.info(
                f"Extracted {len(raw_text)} chars from {resume_path} "
                f"(type={resume_type.value})"
            )
        except Exception as e:
            logger.error(f"FileTypeRouter failed for {resume_path}: {e}")
            result["flags"].append(f"extraction_error:{e!s}")
            result["parse_status"] = PARSE_STATUS_FAILED
            return result

        if not raw_text or len(raw_text.strip()) < 50:
            result["flags"].append("empty_extracted_text")
            result["parse_status"] = PARSE_STATUS_FAILED
            return result

        word_count = _count_words(raw_text)
        model = settings.GROQ_CHAT_MODEL
        api_key = settings.GROQ_API_KEY
        base_url = settings.GROQ_API_BASE_URL

        # ── Step 3: Layer 2 — Six concurrent section prompts ─────────────
        contact, education, experience, skills, projects, extras = \
            await self._extract_all_sections(raw_text, model, api_key, base_url)

        # ── Step 4: Per-section confidence + retry ────────────────────────
        contact, education, experience, skills, projects, extras, retry_used = \
            await self._retry_low_confidence_sections(
                raw_text, word_count, model, api_key, base_url,
                contact, education, experience, skills, projects, extras
            )
        result["retry_used"] = retry_used

        # ── Step 5: Compute confidence scores ────────────────────────────
        scores = self.scorer.score_all(
            contact, education, experience, skills, projects, extras,
            resume_text=raw_text,
            resume_word_count=word_count,
        )
        result["per_section_confidence"] = scores
        result["overall_confidence"] = scores["overall"]

        # ── Step 6: Layer 3 — Skill normalization ─────────────────────────
        raw_skills = _safe_get(skills, "skills", []) or []
        if not isinstance(raw_skills, list):
            raw_skills = []

        normalized_skills, unrecognized = self._normalize_skills(raw_skills, db_session)
        result["unrecognized_skills"] = unrecognized

        # ── Step 7: Merge sections ────────────────────────────────────────
        normalized = _merge_sections(contact, education, experience, skills, projects, extras)
        normalized["skills"] = normalized_skills
        result["normalized"] = normalized

        # ── Step 8: Layer 4 — State machine ──────────────────────────────
        parse_status, needs_review = self._state_machine(
            scores["overall"],
            result,
        )
        result["parse_status"] = parse_status
        result["needs_review"] = needs_review

        # ── Step 9: RE_PARSE escalation — Vision fallback ─────────────────
        if parse_status == PARSE_STATUS_FAILED and resume_type == ResumeType.TEXT:
            logger.info(
                f"RE_PARSE triggered for {applicant_id} — retrying with Gemini Vision"
            )
            vision_result = await self._reparse_with_vision(
                resume_path, applicant_id, db_session
            )
            if vision_result.get("overall_confidence", 0) >= PARSE_REVIEW_THRESHOLD:
                logger.info(
                    f"Vision re-parse improved confidence to "
                    f"{vision_result['overall_confidence']} for {applicant_id}"
                )
                vision_result["retry_used"] = True
                return vision_result
            else:
                result["flags"].append("reparse_failed")
                result["parse_status"] = PARSE_STATUS_FAILED
                logger.warning(f"Vision re-parse still below threshold for {applicant_id}")

        result["llm_provenance"] = {
            "model": model,
            "resume_type": resume_type.value,
            "word_count": word_count,
            "sections_extracted": 6,
            "retry_used": result["retry_used"],
        }

        return result

    # ─────────────────────────────────────────────────────────
    # Internal helpers
    # ─────────────────────────────────────────────────────────

    def _find_resume_file(self, p: Path) -> Optional[str]:
        """Find the first resume file in the applicant directory."""
        for f in p.glob("*"):
            if f.suffix.lower() in [".pdf", ".docx", ".doc", ".txt", ".png", ".jpg", ".jpeg"] \
                    and "metadata.json" not in f.name:
                return str(f)
        return None

    async def _extract_all_sections(
        self,
        text: str,
        model: str,
        api_key: str,
        base_url: str,
    ) -> Tuple[dict, dict, dict, dict, dict, dict]:
        """Fire all 6 section prompts concurrently under a semaphore. Returns tuple of section dicts."""
        sem = asyncio.Semaphore(2)

        async def _wrapped(coro):
            async with sem:
                return await coro

        results = await asyncio.gather(
            _wrapped(extract_contact(text, model, api_key, base_url)),
            _wrapped(extract_education(text, model, api_key, base_url)),
            _wrapped(extract_experience(text, model, api_key, base_url)),
            _wrapped(extract_skills(text, model, api_key, base_url)),
            _wrapped(extract_projects(text, model, api_key, base_url)),
            _wrapped(extract_extras(text, model, api_key, base_url)),
            return_exceptions=False,
        )
        contact, education, experience, skills, projects, extras = results
        logger.info(
            f"Section extraction complete — latencies: "
            f"contact={contact.get('_latency', '?'):.2f}s "
            f"edu={education.get('_latency', '?'):.2f}s "
            f"exp={experience.get('_latency', '?'):.2f}s "
            f"skills={skills.get('_latency', '?'):.2f}s "
            f"proj={projects.get('_latency', '?'):.2f}s "
            f"extras={extras.get('_latency', '?'):.2f}s"
        )
        return contact, education, experience, skills, projects, extras

    async def _retry_low_confidence_sections(
        self,
        text: str,
        word_count: int,
        model: str,
        api_key: str,
        base_url: str,
        contact: dict,
        education: dict,
        experience: dict,
        skills: dict,
        projects: dict,
        extras: dict,
    ) -> Tuple[dict, dict, dict, dict, dict, dict, bool]:
        """
        For any section with confidence < SECTION_RETRY_THRESHOLD,
        fire a single retry concurrently. Uses the same model and full text.
        Returns (contact, education, experience, skills, projects, extras, retry_used).
        """
        # Score each section individually for retry decision
        section_scores = {
            "contact":    self.scorer.score_contact(contact),
            "education":  self.scorer.score_education(education, word_count),
            "experience": self.scorer.score_experience(experience, word_count),
            "skills":     self.scorer.score_skills(skills),
            "projects":   self.scorer.score_projects(projects),
            "extras":     self.scorer.score_extras(extras, text),
        }

        retry_tasks = {}
        section_map = {
            "contact":    (contact,    extract_contact),
            "education":  (education,  extract_education),
            "experience": (experience, extract_experience),
            "skills":     (skills,     extract_skills),
            "projects":   (projects,   extract_projects),
            "extras":     (extras,     extract_extras),
        }

        for name, score in section_scores.items():
            if score < SECTION_RETRY_THRESHOLD:
                logger.info(
                    f"Section '{name}' confidence {score:.2f} < {SECTION_RETRY_THRESHOLD} — retrying"
                )
                _, prompt_fn = section_map[name]
                retry_tasks[name] = prompt_fn(text, model, api_key, base_url)

        if not retry_tasks:
            return contact, education, experience, skills, projects, extras, False

        # Fire retries concurrently under a semaphore
        sem = asyncio.Semaphore(2)
        async def _wrapped(coro):
            async with sem:
                return await coro

        retry_keys = list(retry_tasks.keys())
        retry_results = await asyncio.gather(
            *[_wrapped(task) for task in retry_tasks.values()],
            return_exceptions=False,
        )

        updated = {
            "contact":    contact,
            "education":  education,
            "experience": experience,
            "skills":     skills,
            "projects":   projects,
            "extras":     extras,
        }

        for key, retry_result in zip(retry_keys, retry_results):
            if not isinstance(retry_result, dict) or "error" in retry_result:
                logger.warning(f"Retry for '{key}' also failed — keeping original")
            else:
                updated[key] = retry_result
                logger.info(f"Section '{key}' updated with retry result")

        return (
            updated["contact"],
            updated["education"],
            updated["experience"],
            updated["skills"],
            updated["projects"],
            updated["extras"],
            True,
        )

    def _normalize_skills(
        self,
        raw_skills: List[Any],
        db_session=None,
    ) -> Tuple[List[dict], List[str]]:
        """
        Run two-pass skill normalization.
        Returns (normalized_skill_list, unrecognized_skill_names).
        Falls back to legacy name-only list if DB session unavailable.
        """
        # Coerce to strings
        names = []
        for s in raw_skills:
            if isinstance(s, dict):
                n = s.get("name") or s.get("skill") or ""
            else:
                n = str(s)
            n = n.strip()
            if n:
                names.append(n)

        # Deduplicate preserving order
        seen = set()
        unique_names = []
        for n in names:
            if n.lower() not in seen:
                seen.add(n.lower())
                unique_names.append(n)

        if db_session is None:
            logger.warning(
                "SkillNormalizer: no DB session provided — returning raw skill names only"
            )
            return [{"name": n, "canonical_id": None, "match_type": "raw"} for n in unique_names], []

        try:
            normalizer = SkillNormalizer(db_session)
            norm_result = normalizer.normalize(unique_names)
            skill_list = normalizer.to_legacy_format(norm_result)
            unrecognized = norm_result.unrecognized
            return skill_list, unrecognized
        except Exception as e:
            logger.error(f"Skill normalization failed: {e}")
            return [{"name": n, "canonical_id": None, "match_type": "raw"} for n in unique_names], []

    def _state_machine(
        self,
        overall_confidence: float,
        result: dict,
    ) -> Tuple[str, bool]:
        """
        Apply confidence gate and return (parse_status, needs_review).

        ≥ 0.85 → AUTO_ACCEPT  (accepted)
        0.60–0.84 → NEEDS_REVIEW (pending_review)
        < 0.60 → RE_PARSE     (failed — caller handles Vision fallback)
        """
        if overall_confidence >= PARSE_AUTO_ACCEPT_THRESHOLD:
            logger.info(
                f"State machine: AUTO_ACCEPT (confidence={overall_confidence:.3f})"
            )
            return PARSE_STATUS_ACCEPTED, False

        if overall_confidence >= PARSE_REVIEW_THRESHOLD:
            logger.info(
                f"State machine: NEEDS_REVIEW (confidence={overall_confidence:.3f})"
            )
            result["flags"].append(
                f"low_confidence:{overall_confidence:.3f}"
            )
            return PARSE_STATUS_PENDING_REVIEW, True

        logger.warning(
            f"State machine: RE_PARSE (confidence={overall_confidence:.3f})"
        )
        result["flags"].append(
            f"very_low_confidence:{overall_confidence:.3f}"
        )
        return PARSE_STATUS_FAILED, True

    async def _reparse_with_vision(
        self,
        resume_path: str,
        applicant_id: str,
        db_session=None,
    ) -> dict:
        """
        Retry parsing a text-based PDF using Gemini Vision.
        This is the RE_PARSE fallback — only triggered when overall_confidence < 0.60.
        """
        from .file_type_router import ResumeType

        result: dict = {
            "applicant_id": applicant_id,
            "normalized": {},
            "flags": ["vision_reparse"],
            "needs_review": True,
            "parse_status": PARSE_STATUS_FAILED,
            "per_section_confidence": {},
            "overall_confidence": 0.0,
            "unrecognized_skills": [],
            "llm_provenance": {},
            "resume_type": ResumeType.VISUAL.value,
            "retry_used": True,
        }

        try:
            # Force Vision extraction by rendering the PDF as an image and bypassing classification routing
            raw_text = self.router._vision_from_pdf(resume_path, ResumeType.VISUAL)
            resume_type = ResumeType.VISUAL
        except Exception as e:
            result["flags"].append(f"vision_reparse_extraction_error:{e!s}")
            return result

        if not raw_text or len(raw_text.strip()) < 50:
            result["flags"].append("vision_reparse_empty_text")
            return result

        model = settings.GROQ_CHAT_MODEL
        api_key = settings.GROQ_API_KEY
        base_url = settings.GROQ_API_BASE_URL
        word_count = _count_words(raw_text)

        contact, education, experience, skills, projects, extras = \
            await self._extract_all_sections(raw_text, model, api_key, base_url)

        scores = self.scorer.score_all(
            contact, education, experience, skills, projects, extras,
            resume_text=raw_text,
            resume_word_count=word_count,
        )
        result["per_section_confidence"] = scores
        result["overall_confidence"] = scores["overall"]

        raw_skills = _safe_get(skills, "skills", []) or []
        normalized_skills, unrecognized = self._normalize_skills(raw_skills, db_session)
        result["unrecognized_skills"] = unrecognized

        normalized = _merge_sections(contact, education, experience, skills, projects, extras)
        normalized["skills"] = normalized_skills
        result["normalized"] = normalized

        parse_status, needs_review = self._state_machine(scores["overall"], result)
        result["parse_status"] = parse_status
        result["needs_review"] = needs_review
        result["llm_provenance"] = {
            "model": model,
            "resume_type": ResumeType.VISUAL.value,
            "word_count": word_count,
            "sections_extracted": 6,
            "retry_used": True,
            "vision_reparse": True,
        }

        return result

    # ─────────────────────────────────────────────────────────
    # Legacy sync shim (backward compatibility)
    # ─────────────────────────────────────────────────────────

    def run_parse(self, applicant_root: str, applicant_id: str) -> dict:
        """
        Synchronous wrapper around the async pipeline.
        Used by any existing sync callers (direct /parse/{id} endpoint fallback).
        NOTE: Does NOT pass a DB session, so skill normalization uses raw names only.
              Prefer run_parse_async() from within an async context with a DB session.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Already in an async context — run in a new thread's event loop
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(
                        asyncio.run,
                        self.run_parse_async(applicant_root, applicant_id, db_session=None),
                    )
                    return future.result(timeout=120)
            else:
                return loop.run_until_complete(
                    self.run_parse_async(applicant_root, applicant_id, db_session=None)
                )
        except Exception as e:
            logger.error(f"run_parse (sync shim) failed: {e}")
            return {
                "applicant_id": applicant_id,
                "normalized": {},
                "flags": [f"sync_shim_error:{e!s}"],
                "needs_review": True,
                "parse_status": PARSE_STATUS_FAILED,
                "per_section_confidence": {},
                "overall_confidence": 0.0,
                "unrecognized_skills": [],
                "llm_provenance": {},
                "retry_used": False,
            }
