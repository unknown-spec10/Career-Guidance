from typing import List, Dict
import json
from difflib import SequenceMatcher
from ..core.interfaces import SkillMapper
from ..config import settings
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

try:
    from ..core.semantic_matching import SemanticMatcher
    SEMANTIC_MATCHING_AVAILABLE = True
except ImportError:
    SEMANTIC_MATCHING_AVAILABLE = False
    logger.debug("Semantic matching not available")

# Default canonical skills (can be overridden via config or DB)
DEFAULT_CANONICAL = {
    'python': 'skill_001',
    'java': 'skill_002',
    'c++': 'skill_003',
    'machine learning': 'skill_004',
    'data analysis': 'skill_005'
}

class SimpleSkillMapper(SkillMapper):
    def __init__(self):
        self.canonical = self._load_canonical_skills()
        # Initialize semantic matcher if available
        self.semantic_matcher = None
        if SEMANTIC_MATCHING_AVAILABLE and settings.SEMANTIC_MATCHING_ENABLED:
            try:
                self.semantic_matcher = SemanticMatcher()
                if self.semantic_matcher.enabled:
                    logger.info("Semantic skill mapping enabled")
            except Exception as e:
                logger.warning(f"Semantic matcher initialization failed: {e}")
    
    def _load_canonical_skills(self) -> Dict[str, str]:
        """Load canonical skills from env variable, JSON file, or defaults."""
        # Try loading from SKILL_TAXONOMY_PATH if set
        if hasattr(settings, 'SKILL_TAXONOMY_PATH') and settings.SKILL_TAXONOMY_PATH:
            try:
                path = Path(settings.SKILL_TAXONOMY_PATH)
                if path.exists():
                    with open(path, 'r') as f:
                        taxonomy = json.load(f)
                        logger.info(f"Loaded {len(taxonomy)} skills from {path}")
                        return taxonomy
            except Exception as e:
                logger.warning(f"Failed to load taxonomy from {settings.SKILL_TAXONOMY_PATH}: {e}")
        # Otherwise, try default taxonomy location in repo: ../../skill_taxonomy.json
        try:
            default_path = Path(__file__).resolve().parents[2] / 'skill_taxonomy.json'
            if default_path.exists():
                with open(default_path, 'r') as f:
                    taxonomy = json.load(f)
                    logger.info(f"Loaded {len(taxonomy)} skills from {default_path}")
                    return taxonomy
        except Exception as e:
            logger.warning(f"Failed to load default taxonomy: {e}")
        # Fall back to defaults
        logger.info(f"Using default canonical skills ({len(DEFAULT_CANONICAL)} skills)")
        return DEFAULT_CANONICAL.copy()
    
    def reload_taxonomy(self):
        """Reload taxonomy from file (useful after building new taxonomy)."""
        self.canonical = self._load_canonical_skills()
    
    def get_canonical_skills(self) -> Dict[str, str]:
        """Return the current canonical skill mapping."""
        return self.canonical
    
    def map(self, skills: List[str]) -> List[Dict]:
        """
        Map skills to canonical names using semantic matching + fallback.
        
        Priority:
        1. Semantic matching (embeddings + taxonomy)
        2. Fuzzy string matching (fallback)
        """
        mapped = []
        
        # Use batch semantic matching if available
        if self.semantic_matcher and self.semantic_matcher.enabled:
            semantic_results = self.semantic_matcher.match_skills_batch(
                skills,
                threshold=settings.SEMANTIC_SIMILARITY_THRESHOLD
            )
            
            for result in semantic_results:
                if result["found"] and result["canonical"]:
                    mapped.append({
                        "name": result["original"],
                        "canonical_id": result["skill_id"],
                        "canonical_name": result["canonical"],
                        "match_confidence": result["confidence"],
                        "match_type": "semantic",
                        "category": result["category"]
                    })
                else:
                    # Fallback to fuzzy matching for unmatched skills
                    fuzzy_result = self._fuzzy_match(result["original"])
                    mapped.append(fuzzy_result)
        else:
            # No semantic matcher, use fuzzy matching only
            for skill in skills:
                mapped.append(self._fuzzy_match(skill))
        
        return mapped
    
    def _fuzzy_match(self, skill: str) -> Dict:
        """Fuzzy match a skill using SequenceMatcher (fallback method)"""
        ss = skill.lower().strip()
        best_match = None
        best_score = 0
        match_type = None
        
        for k, vid in self.canonical.items():
            # Exact match (highest priority)
            if k == ss:
                best_match = vid
                best_score = 1.0
                match_type = 'exact'
                break
            
            # Substring match (high priority)
            if k in ss or ss in k:
                if best_score < 0.95:
                    best_match = vid
                    best_score = 0.95
                    match_type = 'substring'
                continue
            
            # Fuzzy match (threshold: 0.85)
            score = SequenceMatcher(None, k, ss).ratio()
            if score > best_score and score >= 0.85:
                best_score = score
                best_match = vid
                match_type = 'fuzzy'
        
        return {
            "name": skill,
            "canonical_id": best_match,
            "match_confidence": round(best_score, 2) if best_score > 0 else None,
            "match_type": match_type
        }

