"""
skill_normalizer.py
-------------------
Single-pass skill normalization (offline).

Pass 1: rapidfuzz WRatio fuzzy matching against canonical skill names.
        Fast, free, no API call. Catches abbreviations, spacing, case variants.
        Accept if score > SKILL_FUZZY_THRESHOLD (default 82).

Anything failing Pass 1 lands in `unrecognized_skills` for taxonomy growth.

Public API:
    normalizer = SkillNormalizer(db_session)
    result = normalizer.normalize(["Python", "K8s", "some_unknown_skill"])
    # Returns: NormalizationResult(matched=[...], unrecognized=[...])
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from ..config import settings

logger = logging.getLogger(__name__)


@dataclass
class MatchedSkill:
    raw_name: str              # As extracted from resume
    canonical_name: str        # Matched canonical skill name
    canonical_id: int          # DB id from canonical_skills
    match_type: str            # 'exact' | 'fuzzy' | 'semantic'
    confidence: float          # 0.0–1.0 (or 0–100 for fuzzy, normalized)
    category: Optional[str] = None


@dataclass
class NormalizationResult:
    matched: List[MatchedSkill] = field(default_factory=list)
    unrecognized: List[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Main normalizer
# ─────────────────────────────────────────────────────────────────────────────

class SkillNormalizer:
    """
    Single-pass skill normalizer.

    Args:
        db_session: SQLAlchemy session (used for canonical name loading).
    """

    def __init__(self, db_session):
        self.db = db_session
        self.fuzzy_threshold = settings.SKILL_FUZZY_THRESHOLD    # default 82.0
        self._canonical_cache: Optional[List[Tuple[str, int, Optional[str]]]] = None

    def _load_canonical(self) -> List[Tuple[str, int, Optional[str]]]:
        """Load (name, id, category) tuples from canonical_skills (cached per instance)."""
        if self._canonical_cache is not None:
            return self._canonical_cache
        try:
            from ..db import CanonicalSkill
            rows = self.db.query(
                CanonicalSkill.name, CanonicalSkill.id, CanonicalSkill.category
            ).all()
            self._canonical_cache = [(r.name, r.id, r.category) for r in rows]
        except Exception as e:
            logger.error(f"SkillNormalizer: failed to load canonical skills: {e}")
            self._canonical_cache = []
        return self._canonical_cache

    def normalize(self, skill_names: List[str]) -> NormalizationResult:
        """
        Normalize a list of raw skill strings.
        Returns a NormalizationResult with matched and unrecognized lists.
        """
        if not skill_names:
            return NormalizationResult()

        try:
            from rapidfuzz import process as rf_process, fuzz as rf_fuzz  # type: ignore
        except ImportError:
            logger.error("rapidfuzz not installed. Run: pip install rapidfuzz")
            return NormalizationResult(
                matched=[],
                unrecognized=skill_names,
            )

        canonical = self._load_canonical()
        if not canonical:
            logger.warning("SkillNormalizer: canonical_skills table is empty")
            return NormalizationResult(unrecognized=skill_names)

        canonical_names = [row[0] for row in canonical]
        name_to_meta: Dict[str, Tuple[int, Optional[str]]] = {
            row[0]: (row[1], row[2]) for row in canonical
        }

        result = NormalizationResult()
        needs_pass2: List[Tuple[int, str]] = []  # (original_index, raw_name)

        # ── Pass 1: rapidfuzz ──────────────────────────────────────────────
        for raw in skill_names:
            raw_stripped = raw.strip()
            if not raw_stripped:
                continue

            # Exact match (fastest)
            if raw_stripped in name_to_meta:
                meta = name_to_meta[raw_stripped]
                result.matched.append(MatchedSkill(
                    raw_name=raw_stripped,
                    canonical_name=raw_stripped,
                    canonical_id=meta[0],
                    match_type="exact",
                    confidence=1.0,
                    category=meta[1],
                ))
                continue

            # Case-insensitive exact match
            lower = raw_stripped.lower()
            exact_ci = next(
                (n for n in canonical_names if n.lower() == lower), None
            )
            if exact_ci:
                meta = name_to_meta[exact_ci]
                result.matched.append(MatchedSkill(
                    raw_name=raw_stripped,
                    canonical_name=exact_ci,
                    canonical_id=meta[0],
                    match_type="exact",
                    confidence=1.0,
                    category=meta[1],
                ))
                continue

            # Fuzzy match
            match_result = rf_process.extractOne(
                raw_stripped,
                canonical_names,
                scorer=rf_fuzz.WRatio,
                score_cutoff=self.fuzzy_threshold,
            )
            if match_result:
                matched_name, score, _ = match_result
                meta = name_to_meta[matched_name]
                result.matched.append(MatchedSkill(
                    raw_name=raw_stripped,
                    canonical_name=matched_name,
                    canonical_id=meta[0],
                    match_type="fuzzy",
                    confidence=round(score / 100.0, 4),
                    category=meta[1],
                ))
            else:
                # Failed Pass 1 → unrecognized (Pass 2 offline, no embedding)
                result.unrecognized.append(raw_stripped)

        logger.info(
            f"SkillNormalizer: {len(result.matched)} matched, "
            f"{len(result.unrecognized)} unrecognized from {len(skill_names)} raw skills"
        )
        return result

    def to_legacy_format(self, result: NormalizationResult) -> List[Dict[str, Any]]:
        """
        Convert NormalizationResult to the legacy skill list format expected by
        the rest of the pipeline (same shape as the old skill_mapper_simple output).
        """
        output = []
        for m in result.matched:
            output.append({
                "name": m.canonical_name,
                "canonical_id": m.canonical_id,
                "match_confidence": m.confidence,
                "match_type": m.match_type,
                "category": m.category,
            })
        for raw in result.unrecognized:
            output.append({
                "name": raw,
                "canonical_id": None,
                "match_confidence": None,
                "match_type": "unrecognized",
                "category": None,
            })
        return output
