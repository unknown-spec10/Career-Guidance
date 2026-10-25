"""Offline deterministic parsing tests (rule-based parser: no LLMs, no mocks).

The parser runs fully offline by design, so these tests prove the old
"LLM failed → offline fallback" path is now the only path: plain sample
text in, structured resume dict out, no network, no mocks.
"""
import sys
import pathlib
import tempfile
import pytest
from pathlib import Path

p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from resume_pipeline.resume.parse_service import ResumeParserService


def _parse_text(sample_text: str, name: str = "resume.txt") -> dict:
    import asyncio
    service = ResumeParserService()
    with tempfile.TemporaryDirectory() as tmpdir:
        Path(tmpdir, name).write_text(sample_text, encoding="utf-8")
        return asyncio.run(
            service.run_parse_async(tmpdir, "app_test_123", db_session=None)
        )


@pytest.mark.asyncio
async def test_offline_fallback_extraction():
    """Deterministic parse of contact + skills text with no external calls."""

    sample_text = """
    DEEP PODDER
    AI/ML Engineer
    +91 6289622872
    deeppodder57@gmail.com
    Kolkata, India
    https://www.linkedin.com/in/deeppodder2005
    https://github.com/unknown-spec10

    SKILLS
    Python, FastAPI, PostgreSQL, Docker, Java
    """

    service = ResumeParserService()
    with tempfile.TemporaryDirectory() as tmpdir:
        Path(tmpdir, "resume.txt").write_text(sample_text, encoding="utf-8")
        result = await service.run_parse_async(
            applicant_root=tmpdir,
            applicant_id="app_test_123",
            db_session=None,
        )

    assert result["parse_status"] == "pending_review"
    assert result["needs_review"] is True

    normalized = result["normalized"]
    assert normalized["personal"]["email"] == "deeppodder57@gmail.com"
    assert normalized["personal"]["phone"] == "+91 6289622872"
    assert normalized["personal"]["linkedin_url"] == "https://www.linkedin.com/in/deeppodder2005"
    assert normalized["personal"]["github_url"] == "https://github.com/unknown-spec10"
    assert normalized["personal"]["location"] == "Kolkata, India"
    assert normalized["personal"]["name"] == "DEEP PODDER"

    assert normalized["education"] == []
    assert normalized["experience"] == []
    assert normalized["projects"] == []

    extracted_skills = [s["name"] for s in normalized["skills"]]
    assert "python" in extracted_skills
    assert "fastapi" in extracted_skills
    assert "docker" in extracted_skills
    assert "java" in extracted_skills

    print("\n[OK] Deterministic offline parse succeeded with no LLM calls")


@pytest.mark.asyncio
async def test_offline_fallback_on_llm_error_dict():
    """Header-less inline skills line still yields contact + fallback skills."""
    sample_text = "John Doe\njohndoe@gmail.com\nSkills: Java, Python, PostgreSQL, Git, Docker, Bash"

    service = ResumeParserService()
    with tempfile.TemporaryDirectory() as tmpdir:
        Path(tmpdir, "resume.txt").write_text(sample_text, encoding="utf-8")
        result = await service.run_parse_async(
            applicant_root=tmpdir,
            applicant_id="app_test_123",
            db_session=None,
        )

    assert result["parse_status"] == "pending_review"
    assert result["needs_review"] is True
    assert result["normalized"]["personal"]["name"] == "John Doe"
    assert result["normalized"]["personal"]["email"] == "johndoe@gmail.com"

    extracted = [s["name"] for s in result["normalized"]["skills"]]
    assert "java" in extracted
    assert "python" in extracted
    assert "docker" in extracted

    print("[OK] Deterministic parse succeeded on header-less skills line")
