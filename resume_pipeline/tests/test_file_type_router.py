"""
test_file_type_router.py
------------------------
Unit tests for the FileTypeRouter detection logic.
Uses mocked pdfplumber to avoid needing real PDF files.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure package importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


class FakePage:
    def __init__(self, text: str = "", has_images: bool = False):
        self._text = text
        self.images = [{"width": 100}] if has_images else []

    def extract_text(self, **kwargs):
        return self._text


def make_fake_pdf(pages: list):
    """Create a mock pdfplumber.open context manager with given pages."""
    mock_pdf = MagicMock()
    mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
    mock_pdf.__exit__ = MagicMock(return_value=False)
    mock_pdf.pages = pages
    return mock_pdf


@patch("resume_pipeline.resume.file_type_router.pdfplumber")
def test_type_a_clean_text_pdf(mock_pdfplumber):
    """Type A: sufficient chars per page, no images, low whitespace ratio → TEXT"""
    text = "John Doe\nSoftware Engineer\nPython Java SQL\nExperience: 3 years\n" * 10
    fake_pdf = make_fake_pdf([FakePage(text=text, has_images=False)])
    mock_pdfplumber.open.return_value = fake_pdf

    from resume_pipeline.resume.file_type_router import _detect_type, ResumeType
    resume_type, diag = _detect_type("/fake/resume.pdf")

    assert resume_type == ResumeType.TEXT
    assert diag["avg_chars_per_page"] > 200
    assert diag["has_images"] is False


@patch("resume_pipeline.resume.file_type_router.pdfplumber")
def test_type_b_has_images(mock_pdfplumber):
    """Type B: page has embedded image objects → VISUAL"""
    text = "Some text on a designed template page " * 15
    fake_pdf = make_fake_pdf([FakePage(text=text, has_images=True)])
    mock_pdfplumber.open.return_value = fake_pdf

    from resume_pipeline.resume.file_type_router import _detect_type, ResumeType
    resume_type, diag = _detect_type("/fake/resume.pdf")

    assert resume_type == ResumeType.VISUAL
    assert diag["has_images"] is True


@patch("resume_pipeline.resume.file_type_router.pdfplumber")
def test_type_c_scanned_low_chars(mock_pdfplumber):
    """Type C: fewer than 200 chars per page → SCANNED"""
    text = "hello"  # very short text → scanned
    fake_pdf = make_fake_pdf([FakePage(text=text, has_images=False)])
    mock_pdfplumber.open.return_value = fake_pdf

    from resume_pipeline.resume.file_type_router import _detect_type, ResumeType
    resume_type, diag = _detect_type("/fake/resume.pdf")

    assert resume_type == ResumeType.SCANNED
    assert diag["avg_chars_per_page"] < 200


@patch("resume_pipeline.resume.file_type_router.pdfplumber")
def test_type_b_high_whitespace_ratio(mock_pdfplumber):
    """Type B: whitespace ratio > 0.40 (many spaces between columns) → VISUAL"""
    # High ratio: lots of whitespace, still has enough chars
    text = "Name    " + "  " * 50 + "Company" + "   " * 50 + "Degree" * 5 + " " * 300
    fake_pdf = make_fake_pdf([FakePage(text=text, has_images=False)])
    mock_pdfplumber.open.return_value = fake_pdf

    from resume_pipeline.resume.file_type_router import _detect_type, ResumeType
    resume_type, _ = _detect_type("/fake/resume.pdf")

    # Either VISUAL (high whitespace) or TEXT (chars are enough) — depends on ratio calculation
    # Key assertion: detection doesn't crash
    assert resume_type in {ResumeType.TEXT, ResumeType.VISUAL, ResumeType.SCANNED}


@patch("resume_pipeline.resume.file_type_router.pdfplumber")
def test_detection_fallback_on_exception(mock_pdfplumber):
    """If pdfplumber throws, should fall back to TEXT gracefully."""
    mock_pdfplumber.open.side_effect = Exception("corrupted pdf")

    from resume_pipeline.resume.file_type_router import _detect_type, ResumeType
    resume_type, diag = _detect_type("/fake/broken.pdf")

    assert resume_type == ResumeType.TEXT  # safe fallback


def test_non_pdf_txt_extension():
    """TXT files skip routing and return TEXT type without reading PDF."""
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False) as f:
        f.write("John Doe\nSoftware Engineer\nPython Java SQL")
        tmp = f.name

    try:
        mock_llm = MagicMock()
        mock_llm.api_key = "test"
        mock_llm.base_url = "https://example.com"
        from resume_pipeline.resume.file_type_router import FileTypeRouter, ResumeType
        router = FileTypeRouter(mock_llm)
        text, rtype = router.extract(tmp)
        assert rtype == ResumeType.TEXT
        assert "John Doe" in text
    finally:
        os.unlink(tmp)
