"""
ingest.py — DETERMINISTIC resume ingestion (rule-based parser boundary).

No LLMs anywhere in this module. No network calls. Pure local heuristics.

Job: turn a resume file (.pdf / .txt / .docx / image) into ordered raw text
plus per-page diagnostics, reusing the existing project's components:

- Detection uses FileTypeRouter's THREE signals and ROUTER_THRESHOLDS
  (chars/page floor → scanned, embedded images → visual, whitespace
  ratio → visual) — see file_type_router.py `_detect_type`.
- Text extraction runs a layout-aware pass first (column-aware reading
  order + extract_tables for tabular resumes), then falls back to the
  existing PdfTextExtractor chain (pdfplumber → pdfminer → pdftotext).

Adds per-page `encrypted` and `scanned` flags consumed by the OCR
preprocessing stage (preprocess_ocr.py).

Public API:
    result = ingest_resume(file_path)  # -> IngestResult
"""

import logging
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber  # type: ignore
from pdfminer.high_level import extract_text

from ..config import ROUTER_THRESHOLDS
from ..core.interfaces import TextExtractor
from .file_type_router import ResumeType

logger = logging.getLogger(__name__)


class PdfTextExtractor(TextExtractor):
    def extract_text(self, path: str) -> str:
        # 1) Try pdfplumber for accurate layout-preserving extraction
        try:
            with pdfplumber.open(path) as pdf:
                pages_text = []
                for page in pdf.pages:
                    pages_text.append(page.extract_text(x_tolerance=2, y_tolerance=2) or "")
                text = "\n\n".join(pages_text)
                if text and len(text.strip()) > 0:
                    return text
        except Exception:
            pass
        # 2) Fallback to pdfminer.six
        try:
            text = extract_text(path)
            if text and len(text.strip()) > 0:
                return text
        except Exception:
            pass
        # 3) Fallback to system pdftotext if available
        try:
            out = subprocess.check_output(["pdftotext", path, "-"])
            return out.decode("utf-8", errors="ignore")
        except Exception:
            return ""


def clean_text(text: str) -> str:
    s = text.replace('\r', '\n')
    s = re.sub(r"\n{2,}", "\n\n", s)
    s = re.sub(r"[^\x00-\x7F]+", " ", s)
    return s.strip()


_FALLBACK_EXTRACTOR = PdfTextExtractor()

_LINE_TOL = 3          # vertical tolerance (pt) for grouping words into lines
_COLUMN_GAP_RATIO = 0.12  # min x-gap as a fraction of page width to count as a column split
_COLUMN_MIN_SHARE = 0.15  # each column must hold at least this share of words


@dataclass
class PageIngest:
    page_no: int
    text: str
    chars: int
    scanned: bool       # True when the page holds almost no embedded text
    has_images: bool    # embedded image objects present
    table_count: int    # tables found via extract_tables
    encrypted: bool = False


@dataclass
class IngestResult:
    raw_text: str
    resume_type: ResumeType
    pages: List[PageIngest] = field(default_factory=list)
    tables: List[List[List[Optional[str]]]] = field(default_factory=list)
    flags: List[str] = field(default_factory=list)
    diagnostics: Dict[str, Any] = field(default_factory=dict)


# ─────────────────────────────────────────────────────────────
# Column-aware reading order: sort words on x-position
# ─────────────────────────────────────────────────────────────

def _split_columns(words: List[dict], page_width: float) -> List[List[dict]]:
    """Split words into 1–2 columns by the largest x-gap. Single job: columns."""
    if len(words) < 4 or not page_width:
        return [words]
    by_x = sorted(words, key=lambda w: w["x0"])
    gaps = [by_x[i + 1]["x0"] - by_x[i]["x1"] for i in range(len(by_x) - 1)]
    if not gaps:
        return [words]
    best = max(range(len(gaps)), key=lambda i: gaps[i])
    if gaps[best] < page_width * _COLUMN_GAP_RATIO:
        return [words]
    left, right = by_x[: best + 1], by_x[best + 1:]
    share = min(len(left), len(right)) / len(words)
    if share < _COLUMN_MIN_SHARE:
        return [words]
    return [left, right]


def _column_to_lines(words: List[dict]) -> List[str]:
    """Group one column's words into lines (top order, x order within a line)."""
    lines: Dict[int, List[dict]] = {}
    for w in words:
        key = round(w["top"] / _LINE_TOL)
        lines.setdefault(key, []).append(w)
    out = []
    for key in sorted(lines):
        ordered = sorted(lines[key], key=lambda w: w["x0"])
        out.append(" ".join(w["text"] for w in ordered if w["text"].strip()))
    return [line for line in out if line]


def _column_aware_text(page) -> str:
    """Extract a page's text in column-aware reading order (left col, then right)."""
    try:
        words = page.extract_words(x_tolerance=3, y_tolerance=3, keep_blank_chars=False)
    except Exception:
        return page.extract_text(x_tolerance=3, y_tolerance=3) or ""
    if not words:
        return ""
    width = getattr(page, "width", 0) or 0
    return "\n".join(
        line for col in _split_columns(words, width) for line in _column_to_lines(col)
    )


def _tables_text(page) -> Tuple[str, int]:
    """Extract tables for tabular resumes; returns (joined_text, table_count)."""
    try:
        tables = page.extract_tables() or []
    except Exception:
        return "", 0
    chunks = []
    for table in tables:
        for row in table:
            cells = [(c or "").strip() for c in row if (c or "").strip()]
            if cells:
                chunks.append(" | ".join(cells))
    return "\n".join(chunks), len(tables)


# ─────────────────────────────────────────────────────────────
# Detection: FileTypeRouter's three signals, per page + aggregate
# ─────────────────────────────────────────────────────────────

def _classify(avg_chars: float, has_images: bool, ws_ratio: float) -> ResumeType:
    """Same three signals and ROUTER_THRESHOLDS as FileTypeRouter._detect_type."""
    if avg_chars < ROUTER_THRESHOLDS.get("min_chars_per_page", 200):
        return ResumeType.SCANNED
    if has_images:
        return ResumeType.VISUAL
    if ws_ratio > ROUTER_THRESHOLDS.get("whitespace_ratio_limit", 0.40):
        return ResumeType.VISUAL
    return ResumeType.TEXT


# ─────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────

def _is_encrypted_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "password" in msg or "encrypt" in msg


def _ingest_pdf(path: Path) -> IngestResult:
    pages: List[PageIngest] = []
    all_tables: List[List[List[Optional[str]]]] = []
    flags: List[str] = []

    try:
        pdf = pdfplumber.open(str(path))
    except Exception as e:
        if _is_encrypted_error(e):
            logger.warning(f"ingest: {path.name} is encrypted/password-protected")
            return IngestResult(
                raw_text="", resume_type=ResumeType.SCANNED,
                flags=["encrypted"], diagnostics={"encrypted": True},
            )
        logger.error(f"ingest: pdfplumber open failed for {path.name}: {e}")
        return IngestResult(
            raw_text="", resume_type=ResumeType.TEXT,
            flags=[f"open_error:{e!s}"],
        )

    with pdf:
        for i, page in enumerate(pdf.pages, start=1):
            page_flags = {"scanned": False, "has_images": False, "encrypted": False}
            try:
                col_text = _column_aware_text(page)
                tbl_text, tbl_count = _tables_text(page)
                try:
                    page_tables = page.extract_tables() or []
                    all_tables.extend(page_tables)
                except Exception:
                    pass
                text = col_text + ("\n" + tbl_text if tbl_text else "")
                has_images = bool(page.images)
            except Exception as e:
                logger.warning(f"ingest: page {i} of {path.name} failed: {e}")
                text, tbl_count, has_images = "", 0, False
            chars = len(text)
            scanned = chars < ROUTER_THRESHOLDS.get("min_chars_per_page", 200)
            page_flags.update(scanned=scanned, has_images=has_images)
            pages.append(PageIngest(
                page_no=i, text=text.strip(), chars=chars,
                scanned=scanned, has_images=has_images,
                table_count=tbl_count,
            ))

    if not pages:
        return IngestResult(raw_text="", resume_type=ResumeType.TEXT, flags=["no_pages"])

    total_chars = sum(p.chars for p in pages)
    total_ws = sum(sum(1 for c in p.text if c in " \t\n\r") for p in pages)
    avg_chars = total_chars / len(pages)
    ws_ratio = total_ws / total_chars if total_chars else 0.0
    has_images = any(p.has_images for p in pages)
    resume_type = _classify(avg_chars, has_images, ws_ratio)

    raw_text = "\n\n".join(p.text for p in pages if p.text).strip()

    # Fallback leg: reuse PdfTextExtractor's pdfplumber → pdfminer → pdftotext
    # chain when the layout-aware pass yields thin text.
    if len(raw_text) < 100:
        flags.append("thin_text_fallback")
        try:
            fallback = _FALLBACK_EXTRACTOR.extract_text(str(path)) or ""
        except Exception as e:
            logger.warning(f"ingest: fallback chain failed for {path.name}: {e}")
            fallback = ""
        if len(fallback.strip()) > len(raw_text):
            raw_text = fallback.strip()
            # Re-check: recovered text changes the scanned verdict, not images.
            avg_chars = len(raw_text) / len(pages)
            resume_type = _classify(avg_chars, has_images, ws_ratio)

    if all(p.scanned for p in pages):
        flags.append("all_pages_scanned")

    diagnostics = {
        "pages_checked": len(pages),
        "avg_chars_per_page": round(avg_chars, 1),
        "whitespace_ratio": round(ws_ratio, 3),
        "has_images": has_images,
        "detected_type": resume_type.value,
        "tables_found": len(all_tables),
    }
    logger.info(f"ingest: {path.name} → {resume_type.value} ({diagnostics})")
    return IngestResult(
        raw_text=_clean(raw_text), resume_type=resume_type,
        pages=pages, tables=all_tables, flags=flags, diagnostics=diagnostics,
    )


def _ingest_docx(path: Path) -> IngestResult:
    """Minimal stdlib .docx reader (same visible-text approach as the router)."""
    import zipfile
    import xml.etree.ElementTree as ET

    try:
        with zipfile.ZipFile(path) as zf:
            xml_bytes = zf.read("word/document.xml")
        root = ET.fromstring(xml_bytes)
        texts = [n.text for n in root.iter() if n.tag.endswith("}t") and n.text]
        raw = "\n".join(texts)
    except Exception as e:
        logger.warning(f"ingest: DOCX read failed for {path.name}: {e}")
        return IngestResult(raw_text="", resume_type=ResumeType.TEXT,
                            flags=[f"docx_error:{e!s}"])
    return IngestResult(raw_text=_clean(raw), resume_type=ResumeType.TEXT,
                        pages=[PageIngest(page_no=1, text=_clean(raw),
                                          chars=len(raw), scanned=not raw.strip(),
                                          has_images=False, table_count=0)])


def ingest_resume(file_path: str) -> IngestResult:
    """
    Deterministic entry point. Returns (text, type, per-page flags).
    Image files are returned as SCANNED with no text — OCR them via
    preprocess_ocr.py. No LLM calls on any path.
    """
    path = Path(file_path)
    if not path.exists():
        return IngestResult(raw_text="", resume_type=ResumeType.TEXT,
                            flags=["file_not_found"])
    ext = path.suffix.lower()
    if ext == ".pdf":
        return _ingest_pdf(path)
    if ext == ".txt":
        raw = path.read_text(encoding="utf-8", errors="ignore")
        return IngestResult(raw_text=_clean(raw), resume_type=ResumeType.TEXT)
    if ext == ".docx":
        return _ingest_docx(path)
    if ext in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
        return IngestResult(raw_text="", resume_type=ResumeType.SCANNED,
                            flags=["image_needs_ocr"])
    try:
        return IngestResult(raw_text=_clean(
            path.read_text(encoding="utf-8", errors="ignore")),
            resume_type=ResumeType.TEXT)
    except Exception as e:
        return IngestResult(raw_text="", resume_type=ResumeType.TEXT,
                            flags=[f"read_error:{e!s}"])


def _clean(text: str) -> str:
    s = text.replace("\r", "\n")
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", " ", s)
    return s.strip()
