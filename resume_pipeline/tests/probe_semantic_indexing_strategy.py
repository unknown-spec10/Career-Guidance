#!/usr/bin/env python3
"""
Test script for current semantic indexing strategy.

Inputs (from user):
1) current_skill (single skill)
2) required_skills (comma-separated list)

Usage examples:
  python tests/test_semantic_indexing_strategy.py --current-skill "ReactJS" --required-skills "React,JavaScript,TypeScript"
  python tests/test_semantic_indexing_strategy.py
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional


# Ensure imports work whether run from repo root or resume_pipeline folder.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from resume_pipeline.config import settings
from resume_pipeline.core.semantic_matching import SemanticMatcher


def parse_required_skills(raw_required_skills: str) -> List[str]:
    """Parse comma-separated required skills and remove empty values."""
    return [item.strip() for item in raw_required_skills.split(",") if item.strip()]


def prompt_if_missing(current_skill: Optional[str], required_skills: Optional[str]) -> tuple[str, List[str]]:
    """Prompt user interactively if CLI args are missing."""
    if not current_skill:
        current_skill = input("Enter current skill: ").strip()

    if not required_skills:
        required_skills = input("Enter required skills (comma-separated): ").strip()

    parsed_required = parse_required_skills(required_skills)

    if not current_skill:
        raise ValueError("Current skill cannot be empty.")

    if not parsed_required:
        raise ValueError("Required skills list cannot be empty.")

    return current_skill, parsed_required


def canonicalize_skill(matcher: SemanticMatcher, skill: str, threshold: float) -> tuple[Optional[str], float]:
    """Map a skill to canonical taxonomy skill using current semantic matcher."""
    canonical, confidence = matcher.find_canonical_skill(skill, threshold=threshold)
    return canonical, confidence


def evaluate_pair(
    matcher: SemanticMatcher,
    current_skill: str,
    required_skill: str,
    threshold: float,
) -> dict:
    """Evaluate one current-vs-required skill pair."""
    current_canonical, current_conf = canonicalize_skill(matcher, current_skill, threshold)
    required_canonical, required_conf = canonicalize_skill(matcher, required_skill, threshold)

    same_text = current_skill.strip().lower() == required_skill.strip().lower()
    same_canonical = bool(current_canonical and required_canonical and current_canonical == required_canonical)

    current_vec, current_provider = matcher.embed_text(current_skill)
    required_vec, required_provider = matcher.embed_text(required_skill)

    if current_vec is not None and required_vec is not None:
        cosine = matcher.cosine_similarity(current_vec, required_vec)
    else:
        cosine = 0.0

    passes_semantic_threshold = cosine >= threshold
    overall_match = same_text or same_canonical or passes_semantic_threshold

    return {
        "required_skill": required_skill,
        "required_canonical": required_canonical,
        "required_canonical_confidence": required_conf,
        "same_text": same_text,
        "same_canonical": same_canonical,
        "cosine_similarity": cosine,
        "passes_semantic_threshold": passes_semantic_threshold,
        "overall_match": overall_match,
        "providers": f"{current_provider}/{required_provider}",
    }


def run_test(current_skill: str, required_skills: List[str], threshold: float) -> int:
    """Run semantic indexing checks and print a readable report."""
    matcher = SemanticMatcher()

    if not matcher.enabled:
        print("Semantic matcher is disabled. Check embedding dependencies and taxonomy files.")
        return 2

    current_canonical, current_conf = canonicalize_skill(matcher, current_skill, threshold)

    print("=" * 80)
    print("SEMANTIC INDEXING STRATEGY CHECK")
    print("=" * 80)
    print(f"Current skill: {current_skill}")
    print(f"Required skills: {', '.join(required_skills)}")
    print(f"Threshold: {threshold:.2f}")
    print(f"Current canonical: {current_canonical or 'N/A'} ({current_conf:.2%})")
    print("-" * 80)

    matches = 0
    for index, required in enumerate(required_skills, start=1):
        result = evaluate_pair(matcher, current_skill, required, threshold)
        if result["overall_match"]:
            matches += 1

        print(f"[{index}] Required skill: {result['required_skill']}")
        print(
            "    Canonical: "
            f"{result['required_canonical'] or 'N/A'} "
            f"({result['required_canonical_confidence']:.2%})"
        )
        print(
            "    Check: "
            f"same_text={result['same_text']}, "
            f"same_canonical={result['same_canonical']}, "
            f"cosine={result['cosine_similarity']:.4f}, "
            f"threshold_pass={result['passes_semantic_threshold']}"
        )
        print(f"    Providers: {result['providers']}")
        print(f"    Result: {'MATCH' if result['overall_match'] else 'NO MATCH'}")
        print("-" * 80)

    coverage = matches / len(required_skills)
    print(f"Matched {matches}/{len(required_skills)} required skills")
    print(f"Coverage: {coverage:.2%}")

    # Return non-zero when there are no matches so this can be used in CI checks.
    return 0 if matches > 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Check current semantic indexing strategy with 2 user inputs")
    parser.add_argument("--current-skill", help="Single current skill to test")
    parser.add_argument("--required-skills", help="Comma-separated required skills")
    parser.add_argument(
        "--threshold",
        type=float,
        default=settings.SEMANTIC_SIMILARITY_THRESHOLD,
        help="Semantic threshold override (default from settings)",
    )

    args = parser.parse_args()

    try:
        current_skill, required_skills = prompt_if_missing(args.current_skill, args.required_skills)
    except ValueError as exc:
        print(f"Input error: {exc}")
        return 2

    return run_test(current_skill=current_skill, required_skills=required_skills, threshold=args.threshold)


if __name__ == "__main__":
    raise SystemExit(main())
