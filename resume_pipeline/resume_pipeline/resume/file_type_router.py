"""
file_type_router.py
-------------------
Layer 1: Intelligent Ingestion for the redesigned resume parse pipeline.

Detects whether a PDF is:
  - Type A: Clean text-based PDF  → pdfplumber layout-aware extraction
  - Type B: Designed/multi-column → Gemini Vision (image input)
  - Type C: Scanned/image-only   → Gemini Vision (primary) / Tesseract (offline fallback)

Detection uses THREE signals (no model call needed):
  1. chars_per_page < ROUTER_THRESHOLDS['min_chars_per_page'] → Type C
  2. page.images present (pdfplumber image list) → Type B
  3. whitespace_ratio > ROUTER_THRESHOLDS['whitespace_ratio_limit'] → Type B
  Otherwise → Type A

Public API:
    router = FileTypeRouter(llm_client)
    text, resume_type = router.extract(pdf_path)
"""

import base64
import io
import json
import logging
import re
import zipfile
import xml.etree.ElementTree as ET
from enum import Enum
from pathlib import Path
from typing import Optional, Tuple

import pdfplumber  # type: ignore

from ..constants import ROUTER_THRESHOLDS

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Resume type enumeration
# ─────────────────────────────────────────────────────────────

class ResumeType(str, Enum):
    TEXT    = "text"    # Type A — clean ATS-friendly PDF
    VISUAL  = "visual"  # Type B — designed/multi-column PDF
    SCANNED = "scanned" # Type C — image-only / scanned PDF


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

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
                # Count whitespace characters (space, tab, newline)
                total_ws += sum(1 for c in text if c in " \t\n\r")
                # Signal 2: embedded image objects
                if page.images:
                    has_images = True

            avg_chars = total_chars / len(pages) if pages else 0
            ws_ratio  = total_ws / total_chars if total_chars > 0 else 0.0

            diagnostics["avg_chars_per_page"] = round(avg_chars, 1)
            diagnostics["whitespace_ratio"]   = round(ws_ratio, 3)
            diagnostics["has_images"]          = has_images

            # Signal 1: very few characters → scanned/image PDF
            if avg_chars < min_chars:
                diagnostics["detected_type"] = ResumeType.SCANNED
                return ResumeType.SCANNED, diagnostics

            # Signal 2: page has embedded image objects → designed PDF
            if has_images:
                diagnostics["detected_type"] = ResumeType.VISUAL
                return ResumeType.VISUAL, diagnostics

            # Signal 3: anomalous whitespace ratio → likely multi-column
            if ws_ratio > ws_limit:
                diagnostics["detected_type"] = ResumeType.VISUAL
                return ResumeType.VISUAL, diagnostics

            # Default → clean text PDF
            diagnostics["detected_type"] = ResumeType.TEXT
            return ResumeType.TEXT, diagnostics

    except Exception as e:
        logger.warning(f"FileTypeRouter: detection failed for {pdf_path}: {e}")
        diagnostics["detected_type"] = ResumeType.TEXT
        return ResumeType.TEXT, diagnostics  # safe fallback


def _extract_text_pdfplumber(pdf_path: str) -> str:
    """
    Type A extraction: pdfplumber with layout-aware settings.
    Uses x_tolerance and y_tolerance to preserve column structure.
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            pages_text = []
            for page in pdf.pages:
                text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                pages_text.append(text)
            return "\n\n".join(pages_text)
    except Exception as e:
        logger.error(f"pdfplumber extraction failed for {pdf_path}: {e}")
        return ""


def _pdf_pages_to_base64(pdf_path: str, dpi: int = 150) -> list:
    """
    Render PDF pages as PNG images and return as list of base64-encoded strings.
    Requires pdf2image (poppler). Falls back to [] on failure.
    """
    try:
        from pdf2image import convert_from_path  # type: ignore
        images = convert_from_path(pdf_path, dpi=dpi, fmt="png")
        encoded = []
        for img in images:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            encoded.append(base64.b64encode(buf.getvalue()).decode("utf-8"))
        return encoded
    except Exception as e:
        logger.error(f"PDF-to-image conversion failed for {pdf_path}: {e}")
        return []


def _extract_text_tesseract(pdf_path: str) -> str:
    """
    Offline OCR fallback using Tesseract (pytesseract + pdf2image).
    Only invoked when Gemini Vision is unavailable.
    Returns empty string if Tesseract is not installed.
    """
    try:
        import pytesseract  # type: ignore
        from pdf2image import convert_from_path  # type: ignore
        pages = convert_from_path(pdf_path, dpi=200)
        texts = []
        for page_img in pages:
            texts.append(pytesseract.image_to_string(page_img))
        return "\n\n".join(texts)
    except ImportError:
        logger.warning("Tesseract/pdf2image not available — cannot perform OCR fallback")
        return ""
    except Exception as e:
        logger.error(f"Tesseract OCR failed for {pdf_path}: {e}")
        return ""


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


# ─────────────────────────────────────────────────────────────
# Main router class
# ─────────────────────────────────────────────────────────────

class FileTypeRouter:
    """
    Detects resume type and routes to the appropriate text extractor.

    Args:
        llm_client: GeminiLLMClient instance (used for Vision extraction on Type B/C).
        vision_model: Gemini model name to use for Vision calls.
    """

    def __init__(self, llm_client, vision_model: str = "gemini-2.5-flash"):
        self.llm = llm_client
        self.vision_model = vision_model

    def extract(self, file_path: str) -> Tuple[str, ResumeType]:
        """
        Main entry point. Returns (extracted_text, resume_type).
        Dispatches based on detected type.
        """
        path = Path(file_path)
        ext = path.suffix.lower()

        # Non-PDF formats: direct extraction (no routing needed)
        if ext == ".txt":
            text = path.read_text(encoding="utf-8", errors="ignore")
            return _clean(text), ResumeType.TEXT

        if ext == ".docx":
            text = _extract_docx_text(file_path)
            return _clean(text), ResumeType.TEXT

        if ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
            text = self._vision_from_image_file(file_path)
            return _clean(text), ResumeType.VISUAL

        if ext != ".pdf":
            logger.warning(f"FileTypeRouter: unsupported extension '{ext}', attempting text read")
            try:
                return path.read_text(encoding="utf-8", errors="ignore"), ResumeType.TEXT
            except Exception:
                return "", ResumeType.TEXT

        # PDF: run detection heuristic
        resume_type, diagnostics = _detect_type(file_path)
        logger.info(
            f"FileTypeRouter: {path.name} → {resume_type.value} "
            f"(chars/page={diagnostics['avg_chars_per_page']}, "
            f"ws_ratio={diagnostics['whitespace_ratio']}, "
            f"has_images={diagnostics['has_images']})"
        )

        if resume_type == ResumeType.TEXT:
            text = _extract_text_pdfplumber(file_path)
            return _clean(text), resume_type

        # Type B or C → Gemini Vision
        text = self._vision_from_pdf(file_path, resume_type)
        return _clean(text), resume_type

    def _vision_from_pdf(self, pdf_path: str, resume_type: ResumeType) -> str:
        """
        Send PDF pages as images to Gemini Vision.
        Falls back to Tesseract if Gemini Vision fails.
        """
        page_images_b64 = _pdf_pages_to_base64(pdf_path)
        if not page_images_b64:
            logger.warning(
                f"FileTypeRouter: PDF-to-image conversion returned no pages for {pdf_path}. "
                "Attempting Tesseract fallback."
            )
            return _extract_text_tesseract(pdf_path)

        try:
            text = self._call_gemini_vision(page_images_b64)
            if text and len(text.strip()) > 50:
                return text
            logger.warning(
                f"FileTypeRouter: Gemini Vision returned thin output for {pdf_path}. "
                "Attempting Tesseract fallback."
            )
        except Exception as e:
            logger.error(f"FileTypeRouter: Gemini Vision error for {pdf_path}: {e}")

        return _extract_text_tesseract(pdf_path)

    def _vision_from_image_file(self, image_path: str) -> str:
        """Send a single image file to Gemini Vision."""
        try:
            with open(image_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            return self._call_gemini_vision([b64])
        except Exception as e:
            logger.error(f"FileTypeRouter: image Vision error for {image_path}: {e}")
            return ""

    def _call_gemini_vision(self, pages_b64: list) -> str:
        """
        Call Gemini Vision to extract resume text from page images.
        Sends all pages in one call, up to a maximum of 10 pages.
        """
        import requests as _requests

        api_key = self.llm.api_key
        base_url = self.llm.base_url
        model = self.vision_model

        url = f"{base_url}/models/{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}

        # Build parts: instruction text + one inline_data image per page
        parts = [
            {
                "text": (
                    "You are a resume text extractor. The following image(s) are pages of a resume. "
                    "Extract ALL text exactly as it appears, preserving section structure. "
                    "Output ONLY the extracted text — no commentary, no JSON, no markdown formatting. "
                    "If multiple pages, separate them with a blank line."
                )
            }
        ]

        for b64_img in pages_b64[:10]:  # cap at 10 pages
            parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": b64_img,
                }
            })

        body = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 8192,
            },
        }

        resp = _requests.post(url, headers=headers, json=body, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"Gemini Vision API error {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        candidates = data.get("candidates", [])
        if candidates:
            content = candidates[0].get("content", {})
            parts_out = content.get("parts", [])
            if parts_out:
                return parts_out[0].get("text", "")

        return ""


def _clean(text: str) -> str:
    """Normalize whitespace and remove non-ASCII control characters."""
    s = text.replace("\r", "\n")
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", " ", s)
    return s.strip()
