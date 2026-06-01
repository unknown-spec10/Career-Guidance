"""
skill_normalizer.py
-------------------
Layer 3 (redesign v2.0): Two-pass skill normalization.

Pass 1: rapidfuzz WRatio fuzzy matching against canonical skill names.
        Fast, free, no API call. Catches abbreviations, spacing, case variants.
        Accept if score > SKILL_FUZZY_THRESHOLD (default 82).

Pass 2: Gemini embedding-2-preview + pgvector cosine similarity search.
        Handles semantic synonyms and abbreviations that fuzzy matching misses
        (e.g. "K8s" → "Kubernetes", "TF" → "TensorFlow").
        Accept if cosine similarity > SKILL_SEMANTIC_THRESHOLD (default 0.80).

Unrecognized: Skills failing both passes are stored in `unrecognized_skills`
(not discarded) to enable taxonomy growth over time.

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
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _batch_embed_gemini(skill_names: List[str]) -> List[Optional[List[float]]]:
    """
    Call Gemini batchEmbedContents for a list of skill name strings.
    Returns a list of 768-dim float vectors (or None on failure for that item).
    """
    import requests as _requests
    import time
    import random

    api_key = settings.GEMINI_API_KEY
    model = settings.EMBEDDING_MODEL  # gemini-embedding-2-preview

    if not api_key:
        logger.warning("SkillNormalizer: GEMINI_API_KEY not set — Pass 2 disabled")
        return [None] * len(skill_names)

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:batchEmbedContents?key={api_key}"
    )

    PREFIX = "Represent this skill name for semantic similarity matching: "

    requests_payload = [
        {
            "model": f"models/{model}",
            "content": {"parts": [{"text": PREFIX + name}]},
        }
        for name in skill_names
    ]

    max_retries = 5
    base_delay = 1.0

    for attempt in range(max_retries):
        try:
            resp = _requests.post(
                url,
                json={"requests": requests_payload},
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                raw = data.get("embeddings", [])
                results = [emb.get("values") for emb in raw]
                while len(results) < len(skill_names):
                    results.append(None)
                return results

            if resp.status_code in (429, 500, 502, 503, 504):
                if attempt == max_retries - 1:
                    logger.error(f"SkillNormalizer: Gemini embed attempt {attempt+1} failed with status {resp.status_code}. No retries left.")
                    return [None] * len(skill_names)

                delay = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
                logger.warning(
                    f"SkillNormalizer: Gemini embed rate limited/error ({resp.status_code}) on attempt {attempt+1}. Retrying in {delay:.2f} seconds..."
                )
                time.sleep(delay)
                continue

            logger.error(f"SkillNormalizer: Gemini embed error {resp.status_code}")
            return [None] * len(skill_names)

        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"SkillNormalizer: embedding API exception: {e}")
                return [None] * len(skill_names)
            delay = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
            logger.warning(f"SkillNormalizer: embedding API failed: {e}. Retrying in {delay:.2f}s...")
            time.sleep(delay)


def _pgvector_nearest(
    vector: List[float],
    db_session,
    threshold: float,
) -> Optional[Tuple[str, int, float, Optional[str]]]:
    """
    Query canonical_skills for the nearest skill by cosine similarity.
    Returns (name, id, similarity, category) or None if below threshold.

    Uses raw SQL via psycopg2 to avoid SQLAlchemy Vector type issues.
    Falls back to Python-side cosine similarity if pgvector is unavailable.
    """
    vec_literal = "[" + ",".join(str(v) for v in vector) + "]"

    try:
        # Try pgvector native SQL first
        result = db_session.execute(
            "SELECT name, id, category, "
            "1 - (embedding <=> :vec::vector) AS similarity "
            "FROM canonical_skills "
            "WHERE embedding IS NOT NULL "
            "ORDER BY embedding <=> :vec::vector "
            "LIMIT 1",
            {"vec": vec_literal},
        ).fetchone()

        if result:
            name, skill_id, category, similarity = result
            if similarity is not None and similarity >= threshold:
                return name, skill_id, float(similarity), category

        return None

    except Exception as e:
        logger.warning(f"SkillNormalizer: pgvector query failed, trying Python fallback: {e}")
        return _python_cosine_nearest(vector, db_session, threshold)


def _python_cosine_nearest(
    query_vector: List[float],
    db_session,
    threshold: float,
) -> Optional[Tuple[str, int, float, Optional[str]]]:
    """
    Python-side cosine similarity fallback when pgvector SQL is unavailable.
    Loads all embeddings into memory and computes dot product.
    Only used as a fallback — not production path.
    """
    import math

    try:
        from ..db import CanonicalSkill
        skills = db_session.query(CanonicalSkill).filter(
            CanonicalSkill.embedding.isnot(None)
        ).all()
    except Exception as e:
        logger.error(f"SkillNormalizer: Python fallback failed to load skills: {e}")
        return None

    def cosine(a: List[float], b: List[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

    best_sim = -1.0
    best_skill = None

    for skill in skills:
        emb = skill.embedding
        if not emb or not isinstance(emb, list):
            continue
        sim = cosine(query_vector, emb)
        if sim > best_sim:
            best_sim = sim
            best_skill = skill

    if best_skill and best_sim >= threshold:
        return best_skill.name, best_skill.id, best_sim, best_skill.category

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Main normalizer
# ─────────────────────────────────────────────────────────────────────────────

class SkillNormalizer:
    """
    Two-pass skill normalizer.

    Args:
        db_session: SQLAlchemy session (used for Pass 2 pgvector lookup and canonical name loading).
    """

    def __init__(self, db_session):
        self.db = db_session
        self.fuzzy_threshold = settings.SKILL_FUZZY_THRESHOLD    # default 82.0
        self.semantic_threshold = settings.SKILL_SEMANTIC_THRESHOLD  # default 0.80
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
                # Failed Pass 1 → queue for Pass 2
                needs_pass2.append((len(result.matched) + len(needs_pass2), raw_stripped))

        # ── Pass 2: Gemini embeddings + pgvector ───────────────────────────
        if needs_pass2:
            names_for_embed = [item[1] for item in needs_pass2]
            vectors = _batch_embed_gemini(names_for_embed)

            for (_, raw_name), vector in zip(needs_pass2, vectors):
                if vector is None:
                    result.unrecognized.append(raw_name)
                    continue

                nearest = _pgvector_nearest(vector, self.db, self.semantic_threshold)
                if nearest:
                    canon_name, canon_id, similarity, category = nearest
                    result.matched.append(MatchedSkill(
                        raw_name=raw_name,
                        canonical_name=canon_name,
                        canonical_id=canon_id,
                        match_type="semantic",
                        confidence=round(similarity, 4),
                        category=category,
                    ))
                else:
                    result.unrecognized.append(raw_name)

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
