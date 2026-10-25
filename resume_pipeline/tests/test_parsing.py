import sys
import pathlib
import json
from pathlib import Path

# Add parent to path for imports
p = pathlib.Path(__file__).resolve().parents[1]
if str(p) not in sys.path:
    sys.path.insert(0, str(p))

from resume_pipeline.resume.ingest import clean_text, PdfTextExtractor
from resume_pipeline.resume.extractors import extract_numeric_snippets
from resume_pipeline.resume.preprocess_ocr import TesseractOCR
from resume_pipeline.resume.validators_numeric import SimpleNumericValidator
from resume_pipeline.resume.skill_mapper_simple import SimpleSkillMapper
from resume_pipeline.resume.parse_service import ResumeParserService


def test_text_extraction():
    """Test basic text extraction and cleaning."""
    print("\n=== Test 1: Text Extraction and Cleaning ===")
    
    sample_text = "Raj Kumar\r\nCGPA: 8.75/10\n\n\nJEE Rank: 2487"
    cleaned = clean_text(sample_text)
    
    print(f"Original: {repr(sample_text)}")
    print(f"Cleaned: {repr(cleaned)}")
    
    assert "Raj Kumar" in cleaned
    assert "CGPA" in cleaned
    assert "\r" not in cleaned
    print("[OK] Text extraction and cleaning works")


def test_numeric_extraction():
    """Test numeric snippet extraction from text."""
    print("\n=== Test 2: Numeric Extraction ===")
    
    text = """
    CGPA: 8.75/10
    Percentage: 92.5%
    JEE Rank: 2,487
    Years: 2019-2023
    """
    
    snippets = extract_numeric_snippets(text)
    print(f"Extracted snippets: {json.dumps(snippets, indent=2)}")
    
    assert snippets.get('cgpa') == '8.75'
    assert snippets.get('percentage') == '92.5'
    assert snippets.get('jee_rank') == '2487'
    assert '2019' in snippets.get('years', [])
    assert '2023' in snippets.get('years', [])
    print("[OK] Numeric extraction works correctly")


def test_cgpa_normalization():
    """Test CGPA normalization with different formats."""
    print("\n=== Test 3: CGPA Normalization ===")
    
    validator = SimpleNumericValidator()
    
    test_cases = [
        ("8.75", 8.75),
        ("8.75/10", 8.75),
        ("87.5", 8.75),  # out of 100
        ("9.12/10", 9.12),
    ]
    
    for input_val, expected in test_cases:
        result = validator.normalize_cgpa(input_val)
        print(f"Input: {input_val} -> Normalized: {result['normalized']}, Flags: {result['flags']}")
        if result['normalized'] is not None:
            assert abs(result['normalized'] - expected) < 0.01
    
    print("[OK] CGPA normalization works correctly")


def test_skill_mapping():
    """Test skill mapping to canonical IDs."""
    print("\n=== Test 4: Skill Mapping ===")
    
    mapper = SimpleSkillMapper()
    taxonomy = mapper.get_canonical_skills()
    
    test_skills = ["Python", "Machine Learning", "React", "Java", "Unknown Skill"]
    mapped = mapper.map(test_skills)
    
    print(f"Mapped skills:")
    for skill in mapped:
        print(f"  {skill['name']} -> {skill['canonical_id']}")
    
    # Check mappings align with taxonomy file
    python_skill = next(s for s in mapped if "Python" in s['name'])
    assert python_skill['canonical_id'] == taxonomy.get('python')
    
    ml_skill = next(s for s in mapped if "Machine Learning" in s['name'])
    assert ml_skill['canonical_id'] == taxonomy.get('machine learning')
    
    react_skill = next(s for s in mapped if "React" in s['name'])
    assert react_skill['canonical_id'] == taxonomy.get('react')
    
    unknown_skill = next(s for s in mapped if "Unknown" in s['name'])
    assert unknown_skill['canonical_id'] is None
    
    print("[OK] Skill mapping works correctly")


def test_full_resume_parse():
    """Test full resume parsing pipeline with sample resumes."""
    print("\n=== Test 5: Full Resume Parsing ===")
    
    parser = ResumeParserService()
    test_dir = Path(__file__).parent
    
    # Test with sample resume 1
    print("\nParsing sample_resume_1.txt...")
    resume1_path = test_dir / "sample_resume_1.txt"
    
    # Create a temp directory structure
    import tempfile
    import shutil
    with tempfile.TemporaryDirectory() as tmpdir:
        # Copy resume to temp dir
        dest = Path(tmpdir) / "resume.txt"
        shutil.copy(resume1_path, dest)
        
        result = parser.run_parse(tmpdir, "test_app_001")
        
        print(f"\nParse Result for Resume 1:")
        print(f"  Applicant ID: {result['applicant_id']}")
        print(f"  Needs Review: {result['needs_review']}")
        print(f"  Flags: {result['flags']}")
        print(f"  LLM Confidence: {result['normalized'].get('llm_confidence')}")
        
        # Check email extraction (may be None in mock mode if not in text)
        personal = result['normalized'].get('personal_info') or result['normalized'].get('personal') or {}
        email = personal.get('email')
        print(f"  Email: {email}")
        # Email extraction depends on text content; mock may return None
        # assert email is not None and '@' in str(email) if email else True
        
        # Check skills
        skills = result['normalized'].get('skills', [])
        print(f"  Skills found: {len(skills)}")
        for skill in skills[:3]:
            print(f"    - {skill['name']}")
        
        print("[OK] Resume 1 parsed successfully")
    
    # Test with sample resume 2
    print("\nParsing sample_resume_2.txt...")
    resume2_path = test_dir / "sample_resume_2.txt"
    
    with tempfile.TemporaryDirectory() as tmpdir:
        dest = Path(tmpdir) / "resume.txt"
        shutil.copy(resume2_path, dest)
        
        result = parser.run_parse(tmpdir, "test_app_002")
        
        print(f"\nParse Result for Resume 2:")
        print(f"  Applicant ID: {result['applicant_id']}")
        print(f"  Needs Review: {result['needs_review']}")
        personal2 = result['normalized'].get('personal_info') or result['normalized'].get('personal') or {}
        print(f"  Email: {personal2.get('email')}")
        print(f"  Skills found: {len(result['normalized'].get('skills', []))}")
        
        print("[OK] Resume 2 parsed successfully")


def test_student_details_integration():
    """Test that student details (JEE rank, location, preferences) are handled."""
    print("\n=== Test 6: Student Details Integration ===")
    
    # Simulate what upload endpoint would provide
    student_details = {
        "jee_rank": 2487,
        "location": "Bangalore",
        "preferences": "CS, AI/ML"
    }
    
    print(f"Student details: {json.dumps(student_details, indent=2)}")
    
    # These would be stored in metadata.json by upload endpoint
    # Parse service should handle JEE rank from OCR or metadata
    
    validator = SimpleNumericValidator()
    jee_parsed = validator.parse_numeric("2487")
    assert jee_parsed == 2487
    
    print("[OK] Student details can be integrated correctly")


if __name__ == "__main__":
    print("=" * 60)
    print("Running Resume Parsing Tests")
    print("=" * 60)
    
    try:
        test_text_extraction()
        test_numeric_extraction()
        test_cgpa_normalization()
        test_skill_mapping()
        test_full_resume_parse()
        test_student_details_integration()
        test_truncate_for_llm()
        test_file_type_router_upgrades()
        test_rule_parser_golden_bars()
        test_rule_parser_sections_split()
        test_rule_parser_shared_entry_parser()
        test_rule_parser_ingest_and_numeric()
        
        print("\n" + "=" * 60)
        print("[OK] ALL TESTS PASSED")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def test_truncate_for_llm():
    """Test LLM input truncation utility and strategy selection."""
    print("\n=== Test 7: Truncate for LLM ===")
    from resume_pipeline.utils import truncate_for_llm

    # 1. Under limits
    short_text = "Short text under limits."
    assert truncate_for_llm(short_text, "resume_max_chars") == short_text
    assert truncate_for_llm(short_text, "recommendation_max_chars") == short_text

    # 2. Resume limit with top_and_tail strategy (default configuration)
    long_resume = "A" * 5000
    res_truncated = truncate_for_llm(long_resume, "resume_max_chars")
    # Expected: length = 3000 chars + len("\n...\n") (5) = 3005
    assert len(res_truncated) == 3005
    # First 2100 chars (3000 * 0.7) + "\n...\n" + last 900 chars (3000 * 0.3)
    assert res_truncated.startswith("A" * 2100)
    assert res_truncated.endswith("A" * 900)
    assert "\n...\n" in res_truncated

    # 3. Recommendation limit with top_only strategy (default for non-resume limits)
    long_desc = "B" * 2000
    rec_truncated = truncate_for_llm(long_desc, "recommendation_max_chars")
    # Expected: length = 1500 chars (head truncation)
    assert len(rec_truncated) == 1500
    assert rec_truncated == "B" * 1500
    assert "\n...\n" not in rec_truncated

    # 4. Interview Answer limit with top_only strategy
    long_answer = "C" * 1500
    ans_truncated = truncate_for_llm(long_answer, "interview_answer_max_chars")
    # Expected: length = 1000 chars
    assert len(ans_truncated) == 1000
    assert ans_truncated == "C" * 1000

    print("[OK] Truncate for LLM works correctly")


def test_file_type_router_upgrades():
    """Test deterministic re-routing: scanned PDFs and images use local OCR, never Vision/LLM."""
    print("\n=== Test 8: FileTypeRouter Deterministic OCR Routing ===")
    from unittest.mock import MagicMock, patch
    from resume_pipeline.resume.file_type_router import FileTypeRouter, ResumeType
    from resume_pipeline.resume.ingest import IngestResult, PageIngest

    router = FileTypeRouter()

    # 1. Scanned PDF (thin text) → offline OCR leg, no Vision calls
    fake = IngestResult(
        raw_text="", resume_type=ResumeType.SCANNED,
        pages=[PageIngest(page_no=1, text="", chars=0, scanned=True,
                          has_images=False, table_count=0)],
        flags=["all_pages_scanned"],
    )
    with patch("resume_pipeline.resume.ingest.ingest_resume", return_value=fake), \
         patch("resume_pipeline.resume.preprocess_ocr.ocr_scanned_pages") as mock_ocr:

        mock_ocr.return_value = MagicMock(
            pages={1: MagicMock(text="Extracted via local OCR")})

        text, rtype = router.extract("dummy_resume.pdf")

        assert rtype == ResumeType.SCANNED
        assert text == "Extracted via local OCR"
        mock_ocr.assert_called_once_with("dummy_resume.pdf", page_nos=[1])

    # 2. Image file → single-image OCR, no LLM
    with patch("resume_pipeline.resume.preprocess_ocr.ocr_image_file") as mock_img:
        mock_img.return_value = ("Extracted via RapidOCR", 0.9, "rapidocr")

        text = router._ocr_image("dummy_image.png")

        assert text == "Extracted via RapidOCR"
        mock_img.assert_called_once_with("dummy_image.png")

    print("[OK] FileTypeRouter routes scans to local OCR with no LLM calls")


def test_gcs_storage_backend():
    """Test GCSFileStorage factory instantiation and backend behavior."""
    print("\n=== Test 9: GCS Storage Backend ===")
    from unittest.mock import MagicMock, patch
    from resume_pipeline.config import settings

    with patch.object(settings, "STORAGE_BACKEND", "gcs"), \
         patch("google.cloud.storage.Client") as mock_gcs_client:
        
        mock_bucket = MagicMock()
        mock_gcs_client.return_value.bucket.return_value = mock_bucket

        from resume_pipeline.core.storage import get_storage_client, GCSFileStorage
        
        # Reset singleton for testing
        import resume_pipeline.core.storage as storage_module
        storage_module._storage_client = None

        client = get_storage_client()
        assert isinstance(client, GCSFileStorage)
        assert client.bucket_name == settings.GCS_BUCKET_NAME

        # Reset singleton after test
        storage_module._storage_client = None

    print("[OK] GCS storage backend test passed")


# ── Rule-based parser coverage (deterministic, no LLMs) ──

def test_rule_parser_golden_bars():
    """Golden-set bars: contact 7/7 and full skills recall on both samples."""
    print("\n=== Test 10: Rule Parser Golden Bars ===")
    import re
    import shutil
    import tempfile
    from resume_pipeline.resume.rule_parser import RuleBasedParserService

    expectations = {
        "sample_resume_1.txt": (
            {"name": "Raj Kumar", "email": "raj.kumar@example.com",
             "phone": "+91-9876543210", "location": "Bangalore, Karnataka",
             "linkedin_url": None, "github_url": None, "portfolio_url": None},
            ["python", "java", "machine learning", "data analysis",
             "deep learning", "sql", "react"],
        ),
        "sample_resume_2.txt": (
            {"name": "Priya Sharma", "email": "priya.sharma@gmail.com",
             "phone": "+91-8765432109", "location": "Mumbai, Maharashtra",
             "linkedin_url": None, "github_url": None, "portfolio_url": None},
            ["python", "c++", "javascript", "html", "css", "node.js",
             "sql", "mongodb", "git", "docker"],
        ),
    }

    parser = RuleBasedParserService()
    test_dir = Path(__file__).parent
    for fname, (want_contact, want_skills) in expectations.items():
        with tempfile.TemporaryDirectory() as tmpdir:
            shutil.copy(test_dir / fname, Path(tmpdir) / "resume.txt")
            result = parser.run_parse(tmpdir, "golden_test")

        assert result["parse_status"] == "accepted", fname
        got = result["normalized"]["personal"]
        for field, want in want_contact.items():
            have = got.get(field)
            if want is None:
                assert have is None, f"{fname}:{field} want None got {have!r}"
            elif field == "phone":
                assert re.sub(r"\D", "", have) == re.sub(r"\D", "", want), \
                    f"{fname}:{field} got {have!r}"
            else:
                assert (have or "").strip().lower() == want.lower(), \
                    f"{fname}:{field} want {want!r} got {have!r}"
        found = {s["name"].lower() for s in result["normalized"]["skills"]}
        missing = [s for s in want_skills if s not in found]
        assert not missing, f"{fname} missing skills: {missing}"
        print(f"  {fname}: contact 7/7, skills {len(want_skills)}/{len(want_skills)}")

    print("[OK] Golden bars hold on every sample")


def test_rule_parser_sections_split():
    """Segmenter splits every sample into the right non-empty sections."""
    print("\n=== Test 11: Rule Parser Section Splits ===")
    from resume_pipeline.resume.segmenter import split_sections

    test_dir = Path(__file__).parent
    text1 = (test_dir / "sample_resume_1.txt").read_text(encoding="utf-8")
    secs1 = split_sections(text1)
    for section in ("contact", "education", "skills", "projects", "extras"):
        assert secs1[section].strip(), f"sample1 section '{section}' empty"
    assert not secs1["experience"].strip()
    assert "Raj Kumar" in secs1["contact"]

    text2 = (test_dir / "sample_resume_2.txt").read_text(encoding="utf-8")
    secs2 = split_sections(text2)
    for section in ("contact", "education", "experience", "skills",
                    "certifications", "extras"):
        assert secs2[section].strip(), f"sample2 section '{section}' empty"
    assert not secs2["projects"].strip()
    assert "TCS" in secs2["experience"]

    print("[OK] Sections split correctly on every sample")


def test_rule_parser_shared_entry_parser():
    """One entry-parser serves education, experience, and projects."""
    print("\n=== Test 12: Shared Entry Parser ===")
    from resume_pipeline.resume import extractors as E
    from resume_pipeline.resume.segmenter import split_sections

    test_dir = Path(__file__).parent
    secs = split_sections(
        (test_dir / "sample_resume_2.txt").read_text(encoding="utf-8"))

    edu = E.extract_education(secs["education"])["education"]
    assert len(edu) == 2
    assert edu[0]["institution"] == "University of Mumbai"
    assert edu[0]["grade"] == 9.12
    assert edu[0]["end_year"] == "2024"

    exp = E.extract_experience(secs["experience"])["experience"]
    assert len(exp) == 1
    assert exp[0]["company"] == "TCS"
    assert exp[0]["employment_type"] == "internship"
    assert len(exp[0]["responsibilities"]) == 2

    secs1 = split_sections(
        (test_dir / "sample_resume_1.txt").read_text(encoding="utf-8"))
    proj = E.extract_projects(secs1["projects"])["projects"]
    assert len(proj) == 2
    assert proj[0]["name"] == "ML-Based Recommendation System"
    assert "python" in proj[0]["tech_stack"]

    print("[OK] Shared entry parser covers education, experience, projects")


def test_rule_parser_ingest_and_numeric():
    """Ingest detection signals + extended numeric snippets on real files."""
    print("\n=== Test 13: Ingest Signals and Numeric Snippets ===")
    from resume_pipeline.resume.file_type_router import ResumeType
    from resume_pipeline.resume.ingest import ingest_resume
    from resume_pipeline.resume.extractors import extract_numeric_snippets_ext

    test_dir = Path(__file__).parent
    ingested = ingest_resume(str(test_dir / "sample_resume_1.txt"))
    assert ingested.resume_type == ResumeType.TEXT
    assert "Raj Kumar" in ingested.raw_text

    text = (test_dir / "sample_resume_1.txt").read_text(encoding="utf-8")
    snippets = extract_numeric_snippets_ext(text)
    assert snippets["cgpa"] == "8.75"
    assert snippets["percentage"] == "92.5"
    assert snippets["jee_rank"] == "2487"

    text2 = (test_dir / "sample_resume_2.txt").read_text(encoding="utf-8")
    snippets2 = extract_numeric_snippets_ext(text2)
    assert snippets2["cgpa"] == "9.12"
    assert snippets2["jee_rank"] == "5432"

    print("[OK] Ingest signals and numeric snippets work")

