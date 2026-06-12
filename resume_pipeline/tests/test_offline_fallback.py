import sys
import pathlib
import pytest
from unittest.mock import MagicMock, patch

# Add parent to path for imports
p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from resume_pipeline.resume.parse_service import ResumeParserService
from resume_pipeline.resume.file_type_router import ResumeType

@pytest.mark.asyncio
async def test_offline_fallback_extraction():
    """Test that if the LLM extraction fails, the offline spaCy + Regex fallback runs successfully."""
    
    # 1. Setup sample resume text containing contact details, location, and skills
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

    # 2. Mock DB Session and CanonicalSkill queries
    db_mock = MagicMock()
    # Mock return list of canonical skills as tuples of (name, id, category) to match in raw text
    db_mock.query.return_value.all.return_value = [
        ("Python", 1, "Programming Languages"),
        ("FastAPI", 2, "Frameworks"),
        ("PostgreSQL", 3, "Database"),
        ("Docker", 4, "DevOps"),
        ("React", 5, "Frontend") # Not in sample text
    ]

    service = ResumeParserService()

    # Mock _extract_all_sections to raise an LLM exception
    with patch.object(service, '_extract_all_sections', side_effect=RuntimeError("Groq 429: Rate limit hit")) as mock_extract:
        # Mock _find_resume_file to return a dummy path
        with patch.object(service, '_find_resume_file', return_value="dummy_path.pdf"):
            # Mock the FileTypeRouter to return the text and type without LLM calls
            with patch.object(service.router, 'extract', return_value=(sample_text, ResumeType.TEXT)):
                
                result = await service.run_parse_async(
                    applicant_root="dummy_root",
                    applicant_id="app_test_123",
                    db_session=db_mock
                )

                # 3. Assert fallback triggering and results
                assert mock_extract.called
                assert "offline_fallback_active" in result["flags"]
                assert result["parse_status"] == "pending_review"
                assert result["needs_review"] is True
                assert result["overall_confidence"] == 0.59
                
                # Check extracted contact info
                normalized = result["normalized"]
                assert normalized["personal"]["email"] == "deeppodder57@gmail.com"
                assert normalized["personal"]["phone"] == "+91 6289622872"
                assert normalized["personal"]["linkedin_url"] == "https://www.linkedin.com/in/deeppodder2005"
                assert normalized["personal"]["github_url"] == "https://github.com/unknown-spec10"
                assert normalized["personal"]["location"] == "Kolkata, India"
                assert normalized["personal"]["name"] == "DEEP PODDER"
                
                # Check empty lists for other sections
                assert normalized["education"] == []
                assert normalized["experience"] == []
                assert normalized["projects"] == []
                
                # Check matching skills
                extracted_skills = [s["name"] for s in normalized["skills"]]
                assert "Python" in extracted_skills
                assert "FastAPI" in extracted_skills
                assert "PostgreSQL" in extracted_skills
                assert "Docker" in extracted_skills
                assert "React" not in extracted_skills
                
                print("\n[OK] Offline fallback parsed successfully under simulated LLM rate limits")

@pytest.mark.asyncio
async def test_offline_fallback_on_llm_error_dict():
    """Test that if sections return error dicts, the fallback triggers."""
    # Ensure sample text is > 50 characters to prevent early return in ingestion checks
    sample_text = "John Doe\njohndoe@gmail.com\nSkills: Java, Python, PostgreSQL, Git, Docker, Bash"
    
    db_mock = MagicMock()
    db_mock.query.return_value.all.return_value = [("Java", 1, "Languages")]

    service = ResumeParserService()
    
    # Mock _extract_all_sections to return a dictionary containing error keys
    error_response = (
        {"name": "John Doe"}, 
        {"education": []}, 
        {"experience": []}, 
        {"error": "Groq rate limit exceeded"}, # Skills failed
        {"projects": []}, 
        {"extras": []}
    )

    with patch.object(service, '_extract_all_sections', return_value=error_response) as mock_extract:
        with patch.object(service, '_find_resume_file', return_value="dummy_path.pdf"):
            with patch.object(service.router, 'extract', return_value=(sample_text, ResumeType.TEXT)):
                
                result = await service.run_parse_async(
                    applicant_root="dummy_root",
                    applicant_id="app_test_123",
                    db_session=db_mock
                )

                assert mock_extract.called
                assert "offline_fallback_active" in result["flags"]
                assert result["parse_status"] == "pending_review"
                assert result["needs_review"] is True
                assert result["normalized"]["personal"]["email"] == "johndoe@gmail.com"
                
                print("[OK] Offline fallback parsed successfully on structured LLM error dictionary response")
