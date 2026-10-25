"""
preprocess_ocr.py — DETERMINISTIC OCR preprocessing (rule-based parser boundary).

No LLMs anywhere in this module. Thin by design: one job is image
cleanup + offline OCR for scanned pages flagged by ingest.py.

Pipeline per page: render at 300 DPI → grayscale → adaptive threshold →
deskew → RapidOCR, with TesseractOCR as fallback.

Per-page OCR confidence (mean RapidOCR recognition score, or 0.5 for the
Tesseract fallback which reports none) is returned alongside the text so
the parser can blend it into the existing confidence scorer — see
rule_parser.py OCR blend weights.

Public API:
    result = ocr_scanned_pages(pdf_path, page_nos=None)  # -> OCRResult
    text, conf = ocr_image_file(image_path)
"""

import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from pdf2image import convert_from_path  # type: ignore
from PIL import Image

from ..core.interfaces import OCRService

logger = logging.getLogger(__name__)

OCR_DPI = 300
_TESSERACT_FALLBACK_CONFIDENCE = 0.5


class TesseractOCR(OCRService):
    def ocr_image(self, path: str) -> str:
        try:
            import pytesseract  # lazy: only needed if tesseract binary is installed
            return pytesseract.image_to_string(path)
        except Exception as e:
            raise RuntimeError(f"Tesseract OCR failed: {e}") from e

    def ocr_pdf_pages(self, path: str) -> Dict[int, str]:
        pages = convert_from_path(path)
        ocr_text = {}
        for i, page in enumerate(pages, start=1):
            tmp = Path(path).parent / f"_tmp_page_{i}.png"
            page.save(tmp, "PNG")
            ocr_text[i] = self.ocr_image(str(tmp))
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass
        return ocr_text


_tesseract = TesseractOCR()
_rapid_ocr = None


def _rapidocr():
    """Lazy singleton — RapidOCR model load is slow and only needed for scans."""
    global _rapid_ocr
    if _rapid_ocr is None:
        from rapidocr_onnxruntime import RapidOCR
        _rapid_ocr = RapidOCR()
    return _rapid_ocr


@dataclass
class OCRPageResult:
    page_no: int
    text: str
    confidence: float   # 0.0–1.0 mean recognition confidence for the page
    engine: str         # 'rapidocr' | 'tesseract'


@dataclass
class OCRResult:
    pages: Dict[int, OCRPageResult] = field(default_factory=dict)
    mean_confidence: float = 0.0


# ─────────────────────────────────────────────────────────────
# Image cleanup: grayscale → adaptive threshold → deskew
# ─────────────────────────────────────────────────────────────

def clean_image(img: Image.Image) -> np.ndarray:
    """Render-ready cleanup. Single-purpose: return a binary deskewed array."""
    import cv2

    gray = np.array(img.convert("L"))
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10,
    )
    coords = np.column_stack(np.where(binary < 128))
    if len(coords) > 100:
        angle = cv2.minAreaRect(coords)[-1]
        angle = angle + 90 if angle < -45 else angle
        if abs(angle) > 0.5:
            h, w = binary.shape
            matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
            binary = cv2.warpAffine(
                binary, matrix, (w, h),
                flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE,
            )
    return binary


# ─────────────────────────────────────────────────────────────
# OCR engines: RapidOCR primary, TesseractOCR fallback
# ─────────────────────────────────────────────────────────────

def _rapidocr_array(arr: np.ndarray) -> Tuple[str, float]:
    results, _ = _rapidocr()(arr)
    if not results:
        return "", 0.0
    texts, confs = [], []
    for line in results:
        texts.append(str(line[1]))
        try:
            confs.append(float(line[2]))
        except (IndexError, TypeError, ValueError):
            continue
    text = "\n".join(texts)
    return text, (sum(confs) / len(confs) if confs else 0.0)


def ocr_image_file(image_path: str) -> Tuple[str, float, str]:
    """
    OCR a single image file. Returns (text, confidence, engine).
    RapidOCR first; TesseractOCR on failure/empty output.
    """
    img = Image.open(image_path).convert("RGB")
    cleaned = clean_image(img)
    try:
        text, conf = _rapidocr_array(cleaned)
        if text.strip():
            return text.strip(), round(conf, 4), "rapidocr"
        logger.warning(f"preprocess_ocr: RapidOCR empty for {image_path}, trying Tesseract")
    except Exception as e:
        logger.warning(f"preprocess_ocr: RapidOCR failed for {image_path}: {e}")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        Image.fromarray(cleaned).save(tmp.name)
        tmp_path = tmp.name
    try:
        text = _tesseract.ocr_image(tmp_path) or ""
    finally:
        Path(tmp_path).unlink(missing_ok=True)
    return text.strip(), _TESSERACT_FALLBACK_CONFIDENCE, "tesseract"


def ocr_scanned_pages(pdf_path: str, page_nos: Optional[List[int]] = None) -> OCRResult:
    """
    Render the requested PDF pages at 300 DPI and OCR them.
    page_nos: 1-based page numbers (None = all pages). Failed pages are
    skipped with a warning, never raised — caller decides what is fatal.
    """
    result = OCRResult()
    try:
        images = convert_from_path(pdf_path, dpi=OCR_DPI)
    except Exception as e:
        logger.error(f"preprocess_ocr: render failed for {pdf_path}: {e}")
        return result
    targets = page_nos or list(range(1, len(images) + 1))
    for page_no in targets:
        if page_no < 1 or page_no > len(images):
            continue
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            images[page_no - 1].save(tmp.name, "PNG")
            tmp_path = tmp.name
        try:
            text, conf, engine = ocr_image_file(tmp_path)
        finally:
            Path(tmp_path).unlink(missing_ok=True)
        result.pages[page_no] = OCRPageResult(
            page_no=page_no, text=text,
            confidence=round(conf, 4), engine=engine,
        )
    confs = [p.confidence for p in result.pages.values() if p.text.strip()]
    result.mean_confidence = round(sum(confs) / len(confs), 4) if confs else 0.0
    logger.info(
        f"preprocess_ocr: {Path(pdf_path).name} pages={sorted(result.pages)} "
        f"mean_conf={result.mean_confidence}"
    )
    return result
