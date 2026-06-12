"""
Tests for SkillTaxonomyBuilder and the taxonomy expansion pipeline.

- test_google_search_credentials: Live integration test — skipped if API keys missing.
- test_search_skill_relevance_fallback: Unit test — verifies graceful fallback when no API keys.
- test_append_new_skills_no_api: Unit test — verifies append_new_skills writes to JSON files
  even without Google API access (zero-score fallback).
- test_taxonomy_expander_bridge: Unit test — verifies expand_unrecognized_skills() logs
  correctly and calls append_new_skills.
"""

import json
import pathlib
import sys
import tempfile
from unittest.mock import MagicMock, patch

import pytest

# Ensure package is importable when running from tests/ directory
_repo_root = pathlib.Path(__file__).resolve().parents[1]
if str(_repo_root) not in sys.path:
    sys.path.insert(0, str(_repo_root))

from resume_pipeline.resume.skill_taxonomy_builder import SkillTaxonomyBuilder


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _has_google_credentials() -> bool:
    builder = SkillTaxonomyBuilder()
    return bool(builder.api_key and builder.search_engine_id)


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
def test_google_search_credentials():
    """
    Live integration test: verify Google Custom Search API returns valid results.
    Skipped automatically if GOOGLE_API_KEY / GOOGLE_SEARCH_ENGINE_ID are absent.
    """
    builder = SkillTaxonomyBuilder()

    if not builder.api_key:
        pytest.skip("GOOGLE_API_KEY not configured — skipping live test")
    if not builder.search_engine_id:
        pytest.skip("GOOGLE_SEARCH_ENGINE_ID not configured — skipping live test")

    result = builder.search_skill_relevance("Python")

    assert isinstance(result, dict), "search_skill_relevance must return a dict"
    assert "relevance_score" in result
    assert "category" in result
    assert "related" in result
    assert result["relevance_score"] >= 0, "relevance_score must be non-negative"
    assert isinstance(result["related"], list)
    # A well-known skill like Python should have a non-zero score when API is live
    assert result["relevance_score"] > 0, (
        f"Expected non-zero relevance for 'Python', got {result['relevance_score']}"
    )


def test_search_skill_relevance_fallback():
    """
    Unit test: when API keys are absent the builder must return a safe fallback
    dict (not raise an exception).
    """
    with patch.object(SkillTaxonomyBuilder, "__init__", lambda self: None):
        builder = SkillTaxonomyBuilder()
        builder.api_key = None
        builder.search_engine_id = None
        builder.cache = {}
        builder.base_url = "https://www.googleapis.com/customsearch/v1"

        result = builder.search_skill_relevance("SomeObscureFramework")

    assert result == {"relevance_score": 0, "category": "uncategorized", "related": []}


def test_append_new_skills_no_api():
    """
    Unit test: append_new_skills() should still write JSON files with zero-score
    entries when Google Search is unavailable (i.e. no api_key).
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        mapping_path = str(pathlib.Path(tmpdir) / "skill_taxonomy.json")
        metadata_path = str(pathlib.Path(tmpdir) / "skill_taxonomy_metadata.json")

        # Pre-populate with one existing skill so we can verify de-dup
        pathlib.Path(mapping_path).write_text(json.dumps({"python": "skill_001"}))
        pathlib.Path(metadata_path).write_text(json.dumps({
            "python": {"skill_id": "skill_001", "display_name": "Python",
                       "relevance_score": 50.0, "category": "programming",
                       "related_skills": [], "market_demand": "high"},
        }))

        # Use a builder with no API key (search will return zero-score fallback)
        with patch.object(SkillTaxonomyBuilder, "__init__", lambda self: None):
            builder = SkillTaxonomyBuilder()
            builder.api_key = None          # no Google key
            builder.search_engine_id = None
            builder.cache = {}
            builder.base_url = "https://www.googleapis.com/customsearch/v1"

        new_skills = ["Python", "QuantumEntangledFramework", "HoloLens SDK"]
        added = builder.append_new_skills(new_skills, mapping_path, metadata_path)

        # "Python" already existed — only the 2 unknown skills should be added
        assert "python" not in added, "Python was already in taxonomy; must not be re-added"
        assert len(added) == 2

        # Check JSON files were written (must be inside `with` block — files live in tmpdir)
        mapping = json.loads(pathlib.Path(mapping_path).read_text())
        meta = json.loads(pathlib.Path(metadata_path).read_text())

        assert "quantumentangledframework" in mapping
        assert any("holol" in k for k in mapping), "HoloLens SDK must be in mapping (normalised key)"

        for key in added:
            assert key in meta
            assert meta[key]["market_demand"] in (
                "very_high", "high", "medium", "low", "very_low"
            ), "market_demand must be a valid level string"


def test_taxonomy_expander_bridge(monkeypatch):
    """
    Unit test: expand_unrecognized_skills() must call SkillTaxonomyBuilder.append_new_skills
    and _sync_new_skills_to_db with the returned skills.
    """
    from resume_pipeline.background_tasks import expand_unrecognized_skills
    import resume_pipeline.background_tasks as bg_tasks

    fake_added = {
        "rust": {
            "skill_id": "skill_999",
            "display_name": "Rust",
            "relevance_score": 75.0,
            "category": "programming",
            "related_skills": [],
            "market_demand": "high",
        }
    }

    mock_builder = MagicMock()
    mock_builder.api_key = "fake-key"
    mock_builder.search_engine_id = "fake-engine"
    mock_builder.append_new_skills.return_value = fake_added

    # SkillTaxonomyBuilder is imported lazily inside expand_unrecognized_skills(),
    # so patch at its definition module (where 'from ... import' binds from).
    with (
        patch("resume_pipeline.resume.skill_taxonomy_builder.SkillTaxonomyBuilder",
              return_value=mock_builder),
        patch.object(bg_tasks, "_sync_new_skills_to_db", return_value=1) as mock_sync,
    ):
        expand_unrecognized_skills(["Rust"])

    mock_builder.append_new_skills.assert_called_once()
    call_args = mock_builder.append_new_skills.call_args
    # The call is: append_new_skills(new_skills=[...], mapping_path=..., metadata_path=...)
    skills_arg = call_args.kwargs.get("new_skills") or (call_args.args[0] if call_args.args else [])
    assert "Rust" in skills_arg, f"Expected 'Rust' in skills_arg, got: {skills_arg}"
    mock_sync.assert_called_once_with(fake_added)


if __name__ == "__main__":
    # Diagnostic runner when executed directly (not via pytest)
    import logging
    logging.basicConfig(level=logging.INFO)

    print("=" * 60)
    print("Taxonomy Builder — Diagnostic Mode")
    print("=" * 60)

    builder = SkillTaxonomyBuilder()
    print(f"\nAPI Key set    : {'YES' if builder.api_key else 'NO'}")
    print(f"Search Engine  : {'YES' if builder.search_engine_id else 'NO'}")

    if builder.api_key and builder.search_engine_id:
        print(f"\nAPI Key (prefix): {str(builder.api_key)[:20]}...")
        for skill in ["Python", "React", "Kubernetes"]:
            r = builder.search_skill_relevance(skill)
            print(f"  {skill}: score={r['relevance_score']}, category={r['category']}, "
                  f"demand={builder._score_to_demand(r['relevance_score'])}")
    else:
        print("\nNo API credentials — Google Search disabled.")
        print("Set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env to enable.")
        print("\nFallback mode test:")
        r = builder.search_skill_relevance("Python")
        print(f"  Fallback result: {r}")
        assert r["relevance_score"] == 0, "Fallback should return 0"
        print("  ✓ Fallback works correctly")
