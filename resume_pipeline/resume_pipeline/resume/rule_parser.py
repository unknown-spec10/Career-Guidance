"""
rule_parser.py — DETERMINISTIC rule-based resume parser (module boundary).

████████████████████████████████████████████████████████████████████████
█  NO LLMs ANYWHERE IN THIS MODULE. No Groq, no Gemini, no Vision,     █
█  no embeddings, no network calls. Local regex + rapidfuzz only.      █
████████████████████████████████████████████████████████████████████████

Wires the four single-job stages together:

    ingest.py → preprocess_ocr.py (scanned pages only) → segmenter.py
        → extractors.py → ConfidenceScorer → state machine

Reused as-is: rapidfuzz normalization (Pass-1 semantics), ConfidenceScorer,
parse state-machine shapes (AUTO_ACCEPT / NEEDS_REVIEW / RE_PARSE), skill
taxonomy builder output (skill_taxonomy.json), extract_numeric_snippets.

RETUNED CONFIDENCE THRESHOLDS (rule-based output is sparser than LLM
output — the LLM infills plausible values, rules return null — so the
LLM bars would fail every honest parse):
    RULE_AUTO_ACCEPT_THRESHOLD = 0.75   (LLM equivalent: 0.85)
    RULE_REVIEW_THRESHOLD      = 0.50   (LLM equivalent: 0.60)
    RULE_SECTION_RETRY_THRESHOLD: n/a — rules are deterministic; a second
        pass over the same text yields the same result, so retry is
        replaced by the OCR-fallback leg (scanned pages get OCR text and
        are re-segmented once).
OCR BLEND: when the OCR leg ran, overall = 0.85 * scorer + 0.15 * OCR
    mean confidence, so weak scans cannot report high confidence.
    Per-page OCR confidence comes from preprocess_ocr.py.

Public API (mirrors ResumeParserService result shape):
    parser = RuleBasedParserService()
    result = parser.run_parse(applicant_root, applicant_id)
"""

import datetime as dt
import json
import logging
from pathlib import Path
from typing import List, Optional

from ..config import (
    PARSE_STATUS_ACCEPTED,
    PARSE_STATUS_FAILED,
    PARSE_STATUS_PENDING_REVIEW,
)
from .confidence_scorer import ConfidenceScorer
from .extractors import (
    extract_contact,
    extract_education,
    extract_experience,
    extract_extras,
    extract_numeric_snippets_ext,
    extract_projects,
    extract_skills,
)
from .ingest import IngestResult, ingest_resume
from .segmenter import split_sections

logger = logging.getLogger(__name__)

# ── Retuned thresholds for rule-based output (documented above) ──
RULE_AUTO_ACCEPT_THRESHOLD = 0.75
RULE_REVIEW_THRESHOLD = 0.50
OCR_BLEND_WEIGHT = 0.15


# Unrecognized skills feed taxonomy growth: a log line plus a durable
# JSONL review queue (resume/unrecognized_skills_review.jsonl) for later
# curation. No DB tables; writes are best-effort and never fail a parse.
_UNRECOGNIZED_REVIEW_PATH = (
    Path(__file__).resolve().parent / "unrecognized_skills_review.jsonl")


def _queue_unrecognized_for_review(applicant_id: str,
                                   skills: List[str]) -> None:
    """Append unrecognized skill names to the JSONL review queue."""
    if not skills:
        return
    try:
        record = {"ts": dt.datetime.now(dt.timezone.utc).isoformat(),
                  "applicant_id": applicant_id,
                  "skills": sorted(set(skills))}
        with open(_UNRECOGNIZED_REVIEW_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except Exception as e:
        logger.warning(f"rule_parser: review-queue write failed: {e}")


def _count_words(text: str) -> int:
    return len(text.split()) if text else 0


class RuleBasedParserService:
    """Deterministic, offline resume parser. Same result shape as the LLM service."""

    def __init__(self):
        self.scorer = ConfidenceScorer()
        self._last_path: str = ""

    # ── primary pipeline ──────────────────────────────────────
    def run_parse(self, applicant_root: str, applicant_id: str,
                  db_session=None) -> dict:
        result: dict = {
            "applicant_id": applicant_id,
            "normalized": {},
            "flags": [],
            "needs_review": False,
            "parse_status": PARSE_STATUS_ACCEPTED,
            "per_section_confidence": {},
            "overall_confidence": 0.0,
            "unrecognized_skills": [],
            "provenance": {"parser": "rule_based_v1", "llm_calls": 0},
            "llm_provenance": {"parser": "rule_based_v1", "llm_calls": 0},
            "resume_type": "unknown",
            "retry_used": False,
        }

        resume_path = self._find_resume_file(Path(applicant_root))
        if not resume_path:
            result["flags"].append("no_resume_file")
            result["parse_status"] = PARSE_STATUS_FAILED
            return result
        self._last_path = resume_path

        # Stage 1: ingest (deterministic; no LLM).
        ingested = ingest_resume(resume_path)
        result["resume_type"] = ingested.resume_type.value
        result["flags"].extend(ingested.flags)

        raw_text = ingested.raw_text
        ocr_conf: Optional[float] = None

        # Stage 2: OCR leg for scanned pages (offline RapidOCR/Tesseract).
        if self._needs_ocr(ingested):
            raw_text, ocr_conf = self._ocr_leg(resume_path, ingested, result)

        if not raw_text or len(raw_text.strip()) < 50:
            result["flags"].append("empty_extracted_text")
            result["parse_status"] = PARSE_STATUS_FAILED
            return result

        # Stage 3: segment + extract (regex/rapidfuzz only).
        sections = split_sections(raw_text)
        contact = extract_contact(sections["contact"])
        education = extract_education(sections["education"])
        experience = extract_experience(sections["experience"])
        skills = extract_skills(sections["skills"], fallback_text=raw_text)
        projects = extract_projects(sections["projects"])
        extras = extract_extras(sections["certifications"], sections["extras"])

        # Stage 4: score with the existing scorer; blend OCR confidence.
        word_count = _count_words(raw_text)
        scores = self.scorer.score_all(
            {"name": contact["name"], "email": contact["email"],
             "phone": contact["phone"], "location": contact["location"],
             "linkedin_url": contact["linkedin_url"],
             "github_url": contact["github_url"],
             "portfolio_url": contact["portfolio_url"]},
            education, experience, skills, projects, extras,
            resume_text=raw_text, resume_word_count=word_count,
        )
        if ocr_conf is not None:
            scores["overall"] = round(
                (1 - OCR_BLEND_WEIGHT) * scores["overall"]
                + OCR_BLEND_WEIGHT * ocr_conf, 4)
            result["provenance"]["ocr_mean_confidence"] = ocr_conf
        result["per_section_confidence"] = scores
        result["overall_confidence"] = scores["overall"]
        # Alias kept for embedding_tasks / routers/resume consumers.
        result["llm_provenance"] = result["provenance"]

        # Stage 5: merge + numeric snippets.
        normalized = {
            "personal": contact,
            "education": education["education"],
            "experience": experience["experience"],
            "skills": skills["skills"],
            "projects": projects["projects"],
            "certifications": extras["certifications"],
            "awards": extras["awards"],
            "languages_spoken": extras["languages_spoken"],
            "publications": extras["publications"],
            "volunteer": extras["volunteer"],
            "jee_rank": extract_numeric_snippets_ext(raw_text).get("jee_rank"),
        }
        result["normalized"] = normalized
        result["unrecognized_skills"] = [
            s["name"] for s in skills["skills"]
            if s.get("match_type") == "unrecognized"]
        if result["unrecognized_skills"]:
            logger.warning(
                "rule_parser: %d unrecognized skills for %s: %s",
                len(result["unrecognized_skills"]), applicant_id,
                ", ".join(result["unrecognized_skills"][:20]))
            _queue_unrecognized_for_review(applicant_id,
                                           result["unrecognized_skills"])

        # Stage 6: state machine with retuned thresholds.
        parse_status, needs_review = self._state_machine(
            scores["overall"], result)
        result["parse_status"] = parse_status
        result["needs_review"] = needs_review
        return result

    # ── helpers ───────────────────────────────────────────────
    def _find_resume_file(self, p: Path) -> Optional[str]:
        for f in p.glob("*"):
            if f.suffix.lower() in (".pdf", ".docx", ".doc", ".txt",
                                    ".png", ".jpg", ".jpeg") \
                    and "metadata.json" not in f.name:
                return str(f)
        return None

    def _needs_ocr(self, ingested: IngestResult) -> bool:
        ext = Path(self._last_path).suffix.lower()
        if ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
            return True
        if ext != ".pdf":
            return False  # txt/docx have no pages to render
        return any(p.scanned for p in ingested.pages) \
            or len(ingested.raw_text.strip()) < 100

    def _ocr_leg(self, resume_path: str, ingested: IngestResult,
                 result: dict) -> tuple:
        from .preprocess_ocr import ocr_image_file, ocr_scanned_pages
        self._last_path = resume_path
        ext = Path(resume_path).suffix.lower()
        if ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
            text, conf, engine = ocr_image_file(resume_path)
            result["flags"].append(f"ocr_engine:{engine}")
            return text, conf
        scanned = [p.page_no for p in ingested.pages if p.scanned] or None
        ocr = ocr_scanned_pages(resume_path, page_nos=scanned)
        if not ocr.pages:
            result["flags"].append("ocr_failed")
            return ingested.raw_text, None
        result["flags"].append(
            f"ocr_engine:{next(iter(ocr.pages.values())).engine}")
        merged = ingested.raw_text.strip()
        ocr_text = "\n\n".join(p.text for _, p in sorted(ocr.pages.items())
                               if p.text.strip())
        # Re-segment on OCR text when ingest found almost nothing.
        if len(merged) < 100 and ocr_text.strip():
            return ocr_text, ocr.mean_confidence
        if ocr_text.strip():
            merged = (merged + "\n\n" + ocr_text).strip()
        return merged, ocr.mean_confidence

    def run_parse_file(self, file_path: str,
                       applicant_id: str = "golden") -> dict:
        """Parse a single file directly (golden-set / debugging helper)."""
        self._last_path = file_path
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            dest = Path(tmpdir) / Path(file_path).name
            import shutil
            shutil.copy(file_path, dest)
            self._last_path = str(dest)
            res = self.run_parse(tmpdir, applicant_id)
            self._last_path = file_path
            return res

    def _state_machine(self, overall: float,
                       result: dict) -> tuple:
        if overall >= RULE_AUTO_ACCEPT_THRESHOLD:
            logger.info(f"rule_parser: AUTO_ACCEPT ({overall:.3f})")
            return PARSE_STATUS_ACCEPTED, False
        if overall >= RULE_REVIEW_THRESHOLD:
            logger.info(f"rule_parser: NEEDS_REVIEW ({overall:.3f})")
            result["flags"].append(f"low_confidence:{overall:.3f}")
            return PARSE_STATUS_PENDING_REVIEW, True
        logger.warning(f"rule_parser: RE_PARSE ({overall:.3f})")
        result["flags"].append(f"very_low_confidence:{overall:.3f}")
        return PARSE_STATUS_FAILED, True
