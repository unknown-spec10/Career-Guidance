"""
Semantic skill matching service using embeddings + skill taxonomy.

Uses sentence-transformers for embedding generation and cosine similarity
to find canonical skill matches from the pre-built taxonomy.
"""
import json
import logging
from typing import Tuple, List, Optional, Dict
from pathlib import Path
import numpy as np

from ..config import settings
from .embedding_client import GoogleEmbeddingClient

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import SentenceTransformer
    EMBEDDING_AVAILABLE = True
except ImportError:
    EMBEDDING_AVAILABLE = False
    logger.warning("sentence-transformers not available; MiniLM fallback disabled")


class SemanticMatcher:
    """
    Semantic skill matching using embeddings + taxonomy lookup.
    
    Workflow:
    1. Load taxonomy (canonical skill names + metadata)
    2. Initialize embedding model (lazy load on first use)
    3. Pre-compute embeddings for canonical skills
    4. For user input: find best matching canonical skill via cosine similarity
    5. Return canonical name + confidence + related skills
    """
    
    _instance = None  # Singleton for shared embeddings
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SemanticMatcher, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return

        self.google_client = GoogleEmbeddingClient()
        self.local_model_available = EMBEDDING_AVAILABLE
        self.enabled = bool(self.google_client.is_available() or self.local_model_available)

        if not self.enabled:
            logger.error("Semantic matching disabled: neither Google embeddings nor MiniLM fallback is available")
            return

        self.model = None  # Lazy load
        self.taxonomy = {}
        self.metadata = {}
        self.canonical_embeddings = {}
        self.embedding_cache = {}  # Cache user inputs
        self.text_embedding_cache = {}  # Cache free-form text embeddings
        self.last_embedding_provider = "unknown"
        
        self._load_taxonomy()
        self._initialized = True
        logger.info("SemanticMatcher initialized")

    def _cache_text_embedding(self, key: str, value: np.ndarray):
        max_items = max(100, int(settings.EMBEDDING_CACHE_MAX_ITEMS))
        if len(self.text_embedding_cache) >= max_items:
            # FIFO eviction based on insertion order
            first_key = next(iter(self.text_embedding_cache), None)
            if first_key is not None:
                self.text_embedding_cache.pop(first_key, None)
        self.text_embedding_cache[key] = value
    
    def _load_taxonomy(self):
        """Load skill taxonomy from JSON files"""
        try:
            # Try multiple paths for taxonomy files
            paths_to_try = [
                Path("./skill_taxonomy.json"),
                Path("../skill_taxonomy.json"),
                Path("../../skill_taxonomy.json"),
                Path("resume_pipeline/skill_taxonomy.json"),
            ]
            
            taxonomy_path = None
            for path in paths_to_try:
                if path.exists():
                    taxonomy_path = path
                    break
            
            if not taxonomy_path:
                logger.warning("skill_taxonomy.json not found; canonical mapping will be limited")
                return
            
            with open(taxonomy_path, 'r') as f:
                self.taxonomy = json.load(f)
            
            # Load metadata
            metadata_path = taxonomy_path.parent / "skill_taxonomy_metadata.json"
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    self.metadata = json.load(f)
            
            logger.info(f"Loaded taxonomy with {len(self.taxonomy)} skills")
        
        except Exception as e:
            logger.error(f"Error loading taxonomy: {e}")
    
    def _ensure_model(self):
        """Lazy load embedding model on first use"""
        if not self.local_model_available:
            raise RuntimeError("MiniLM fallback is not available")

        if self.model is None:
            try:
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("Loaded embedding model: all-MiniLM-L6-v2")
            except Exception as e:
                logger.error(f"Failed to load embedding model: {e}")
                self.local_model_available = False
                raise
    
    def _precompute_embeddings(self):
        """Pre-compute embeddings for all canonical skills (called once)"""
        if self.canonical_embeddings:
            return  # Already computed
        
        if not self.enabled or not self.local_model_available:
            return
        
        try:
            self._ensure_model()
            if self.model is None:
                return
            
            for skill_name in self.taxonomy.keys():
                embedding = self.model.encode(skill_name.lower())
                self.canonical_embeddings[skill_name] = embedding
            
            logger.info(f"Pre-computed embeddings for {len(self.canonical_embeddings)} canonical skills")
        
        except Exception as e:
            logger.error(f"Error pre-computing embeddings: {e}")
    
    def find_canonical_skill(
        self, 
        user_skill: str, 
        threshold: float = 0.70
    ) -> Tuple[Optional[str], float]:
        """
        Find best matching canonical skill from user input.
        
        Args:
            user_skill: Skill name from user resume/job description
            threshold: Minimum cosine similarity to consider a match (0.0-1.0)
        
        Returns:
            (canonical_skill_name, confidence_score) or (None, 0.0) if no match
        """
        if not self.enabled or not user_skill or not self.local_model_available:
            return None, 0.0

        # Ensure model is loaded
        self._ensure_model()
        if self.model is None:
            return None, 0.0
        
        user_skill_lower = user_skill.lower().strip()
        
        # Check cache first
        if user_skill_lower in self.embedding_cache:
            return self.embedding_cache[user_skill_lower]
        
        # Lazy load model and pre-compute embeddings
        if not self.canonical_embeddings:
            self._precompute_embeddings()
        
        if self.model is None:
            return None, 0.0
        
        try:
            user_embedding = self.model.encode(user_skill_lower)
            
            best_match = None
            best_score = 0.0
            
            # Find best matching canonical skill via cosine similarity
            for canonical_name, canonical_embedding in self.canonical_embeddings.items():
                # Cosine similarity: dot(a,b) / (||a|| * ||b||)
                similarity = np.dot(user_embedding, canonical_embedding) / (
                    np.linalg.norm(user_embedding) * np.linalg.norm(canonical_embedding)
                )
                
                if similarity > best_score:
                    best_score = similarity
                    best_match = canonical_name
            
            # Only return match if above threshold
            if best_score >= threshold:
                result = (best_match, float(best_score))
            else:
                result = (None, 0.0)
            
            # Cache the result
            self.embedding_cache[user_skill_lower] = result
            
            return result
        
        except Exception as e:
            logger.error(f"Error finding canonical skill for '{user_skill}': {e}")
            return None, 0.0
    
    def get_canonical_id(self, canonical_skill: str) -> Optional[str]:
        """Get canonical skill ID from taxonomy"""
        if not canonical_skill:
            return None
        return self.taxonomy.get(canonical_skill.lower())
    
    def get_related_skills(self, canonical_skill: str) -> List[str]:
        """Get related skills from taxonomy metadata"""
        if not canonical_skill:
            return []
        
        skill_meta = self.metadata.get(canonical_skill.lower())
        if not skill_meta:
            return []
        
        return skill_meta.get("related_skills", [])
    
    def get_skill_category(self, canonical_skill: str) -> str:
        """Get skill category from metadata"""
        if not canonical_skill:
            return "uncategorized"
        
        skill_meta = self.metadata.get(canonical_skill.lower())
        if not skill_meta:
            return "uncategorized"
        
        return skill_meta.get("category", "uncategorized")
    
    def get_skill_metadata(self, canonical_skill: str) -> Dict:
        """Get full metadata for a canonical skill"""
        if not canonical_skill:
            return {}
        
        return self.metadata.get(canonical_skill.lower(), {})
    
    def match_skills_batch(
        self, 
        skills: List[str],
        threshold: float = 0.70
    ) -> List[Dict]:
        """
        Match multiple skills at once. More efficient than individual calls.
        
        Args:
            skills: List of skill names to normalize
            threshold: Minimum similarity threshold
        
        Returns:
            List of dicts: 
            {
                "original": "ReactJS",
                "canonical": "React",
                "confidence": 0.92,
                "skill_id": "skill_004",
                "category": "framework"
            }
        """
        results = []
        
        # Ensure local model is loaded for canonical mapping
        try:
            self._ensure_model()
        except Exception:
            self.model = None

        if not self.enabled or self.model is None:
            # Return unfound results if embeddings unavailable
            return [
                {
                    "original": skill,
                    "canonical": None,
                    "confidence": 0.0,
                    "skill_id": None,
                    "category": "uncategorized",
                    "found": False
                }
                for skill in skills
            ]

        for skill in skills:
            canonical, confidence = self.find_canonical_skill(skill, threshold)
            
            if canonical and confidence >= threshold:
                skill_id = self.get_canonical_id(canonical)
                category = self.get_skill_category(canonical)
                
                results.append({
                    "original": skill,
                    "canonical": canonical,
                    "confidence": float(confidence),
                    "skill_id": skill_id,
                    "category": category,
                    "found": True
                })
            else:
                results.append({
                    "original": skill,
                    "canonical": None,
                    "confidence": 0.0,
                    "skill_id": None,
                    "category": "uncategorized",
                    "found": False
                })
        
        return results
    
    def get_stats(self) -> Dict:
        """Get service statistics for debugging/monitoring"""
        return {
            "enabled": self.enabled,
            "taxonomy_size": len(self.taxonomy),
            "metadata_size": len(self.metadata),
            "canonical_embeddings": len(self.canonical_embeddings),
            "cache_size": len(self.embedding_cache),
            "model_loaded": self.model is not None,
            "text_embedding_cache_size": len(self.text_embedding_cache),
            "last_embedding_provider": self.last_embedding_provider,
        }

    def embed_text(self, text: str) -> Tuple[Optional[np.ndarray], str]:
        """Embed free-form text with Google as primary and MiniLM as fallback."""
        clean_text = (text or "").strip()
        if not clean_text:
            return None, "empty"

        if clean_text in self.text_embedding_cache:
            return self.text_embedding_cache[clean_text], self.last_embedding_provider

        # Primary: Google embedding API
        google_result = self.google_client.embed_text(clean_text)
        if google_result.get("ok"):
            values = google_result.get("values") or []
            vector = np.array(values, dtype=float)
            self.last_embedding_provider = "google"
            self._cache_text_embedding(clean_text, vector)
            return vector, "google"

        # Fallback: local MiniLM
        if EMBEDDING_AVAILABLE:
            try:
                self._ensure_model()
                if self.model is not None:
                    vector = np.array(self.model.encode(clean_text), dtype=float)
                    self.last_embedding_provider = "minilm"
                    self._cache_text_embedding(clean_text, vector)
                    return vector, "minilm"
            except Exception as e:
                logger.error("MiniLM fallback embedding failed: %s", e)

        self.last_embedding_provider = "unavailable"
        return None, "unavailable"

    @staticmethod
    def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """Compute cosine similarity on two vectors."""
        try:
            denom = np.linalg.norm(vec_a) * np.linalg.norm(vec_b)
            if denom == 0:
                return 0.0
            return float(np.dot(vec_a, vec_b) / denom)
        except Exception:
            return 0.0
