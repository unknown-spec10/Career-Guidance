"""
file_type_router.py — DETERMINISTIC ingestion router (rule-based parser boundary).

No LLMs, no Vision calls, no network. Detects PDF type with the same THREE
zero-cost signals as before (chars/page floor → scanned, embedded images →
visual, whitespace ratio → visual; see ROUTER_THRESHOLDS) and routes to
local extraction only:

  Type A (text)    → pdfplumber layout-aware text (+ tables via ingest.py)
  Type B (visual)  → same local text pass (column-aware reading order)
  Type C (scanned) → offline OCR (RapidOCR, Tesseract fallback)
  images           → offline OCR directly

Public API (unchanged):
    router = FileTypeRouter()
    text, resume_type = router.extract(pdf_path)
"""

import logging
import re
import zipfile
import xml.etree.ElementTree as ET
from enum import Enum
from pathlib import Path
from typing import Tuple

import pdfplumber  # type: ignore

from ..config import ROUTER_THRESHOLDS

logger = logging.getLogger(__name__)


class ResumeType(str, Enum):
    TEXT    = "text"    # Type A — clean ATS-friendly PDF
    VISUAL  = "visual"  # Type B — designed/multi-column PDF
    SCANNED = "scanned" # Type C — image-only / scanned PDF


def _detect_type(pdf_path: str) -> Tuple[ResumeType, dict]:
    """
    Determine the PDF type using three zero-cost heuristic signals.
    Returns (ResumeType, diagnostic_dict).
    """
    min_chars = ROUTER_THRESHOLDS.get("min_chars_per_page", 200)
    ws_limit   = ROUTER_THRESHOLDS.get("whitespace_ratio_limit", 0.40)

    diagnostics: dict = {
        "pages_checked": 0,
        "avg_chars_per_page": 0,
        "whitespace_ratio": 0.0,
        "has_images": False,
        "detected_type": None,
    }

    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages = pdf.pages[:3]  # check first 3 pages max
            diagnostics["pages_checked"] = len(pages)

            total_chars = 0
            total_ws    = 0
            has_images  = False

            for page in pages:
                text = page.extract_text() or ""
                total_chars += len(text)
                total_ws += sum(1 for c in text if c in " \t\n\r")
                if page.images:
                    has_images = True

            avg_chars = total_chars / len(pages) if pages else 0
            ws_ratio  = total_ws / total_chars if total_chars > 0 else 0.0

            diagnostics["avg_chars_per_page"] = round(avg_chars, 1)
            diagnostics["whitespace_ratio"]   = round(ws_ratio, 3)
            diagnostics["has_images"]          = has_images

            if avg_chars < min_chars:
                diagnostics["detected_type"] = ResumeType.SCANNED
                return ResumeType.SCANNED, diagnostics
            if has_images:
                diagnostics["detected_type"] = ResumeType.VISUAL
                return ResumeType.VISUAL, diagnostics
            if ws_ratio > ws_limit:
                diagnostics["detected_type"] = ResumeType.VISUAL
                return ResumeType.VISUAL, diagnostics

            diagnostics["detected_type"] = ResumeType.TEXT
            return ResumeType.TEXT, diagnostics

    except Exception as e:
        logger.warning(f"FileTypeRouter: detection failed for {pdf_path}: {e}")
        diagnostics["detected_type"] = ResumeType.TEXT
        return ResumeType.TEXT, diagnostics  # safe fallback


def _extract_docx_text(path: str) -> str:
    """Extract visible text from a .docx file without external dependencies."""
    try:
        with zipfile.ZipFile(path) as zf:
            xml_bytes = zf.read("word/document.xml")
        root = ET.fromstring(xml_bytes)
        texts = [node.text for node in root.iter() if node.tag.endswith("}t") and node.text]
        return "\n".join(texts)
    except Exception as e:
        logger.warning(f"DOCX extraction failed for {path}: {e}")
        return ""


class FileTypeRouter:
    """Detects resume type and routes to the local (non-LLM) text extractor."""

    def __init__(self):
        pass

    def extract(self, file_path: str) -> Tuple[str, ResumeType]:
        """Main entry point. Returns (extracted_text, resume_type)."""
        from .ingest import ingest_resume

        path = Path(file_path)
        ext = path.suffix.lower()

        if ext == ".txt":
            text = path.read_text(encoding="utf-8", errors="ignore")
            return _clean(text), ResumeType.TEXT

        if ext == ".docx":
            return _clean(_extract_docx_text(file_path)), ResumeType.TEXT

        if ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
            return _clean(self._ocr_image(file_path)), ResumeType.SCANNED

        if ext != ".pdf":
            logger.warning(f"FileTypeRouter: unsupported extension '{ext}', attempting text read")
            try:
                return path.read_text(encoding="utf-8", errors="ignore"), ResumeType.TEXT
            except Exception:
                return "", ResumeType.TEXT

        ingested = ingest_resume(file_path)
        if ingested.raw_text.strip() and not all(
                p.scanned for p in ingested.pages if ingested.pages):
            return ingested.raw_text, ingested.resume_type

        # Thin or fully scanned text → offline OCR leg (no Vision calls).
        logger.info(f"FileTypeRouter: {path.name} needs OCR "
                    f"(type={ingested.resume_type.value})")
        ocr_text = self._ocr_pdf(file_path, ingested)
        merged = (ingested.raw_text.strip() + "\n\n" + ocr_text.strip()).strip()
        return _clean(merged), ResumeType.SCANNED

    def _ocr_pdf(self, pdf_path: str, ingested=None) -> str:
        """Offline OCR for scanned/thin PDFs via preprocess_ocr.py."""
        from .preprocess_ocr import ocr_scanned_pages

        scanned = None
        if ingested is not None and ingested.pages:
            scanned = [p.page_no for p in ingested.pages if p.scanned] or None
        result = ocr_scanned_pages(pdf_path, page_nos=scanned)
        return "\n\n".join(
            p.text for _, p in sorted(result.pages.items()) if p.text.strip())

    def _ocr_image(self, image_path: str) -> str:
        """Offline OCR for a single image file."""
        from .preprocess_ocr import ocr_image_file

        text, _, _ = ocr_image_file(image_path)
        return text


def _clean(text: str) -> str:
    """Normalize whitespace and remove non-ASCII control characters."""
    s = text.replace("\r", "\n")
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", " ", s)
    return s.strip()
