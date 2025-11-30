import requests
import json
import re
from typing import List, Dict, Tuple
from pathlib import Path
from ..config import settings


class SkillTaxonomyBuilder:
    """Builds skill taxonomy dynamically using Google Search for market relevance."""
    
    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.search_engine_id = settings.GOOGLE_SEARCH_ENGINE_ID
        self.base_url = "https://www.googleapis.com/customsearch/v1"
    
    def search_skill_relevance(self, skill: str) -> Dict:
        """Search Google for skill to determine market relevance and category."""
        if not self.api_key or not self.search_engine_id:
            return {"relevance_score": 0, "category": "uncategorized", "related": []}
        
        try:
            # Search for skill + jobs/careers to gauge market demand
            query = f"{skill} programming jobs salary demand 2024 2025"
            params = {
                "key": self.api_key,
                "cx": self.search_engine_id,
                "q": query,
                "num": 5
            }
            
            response = requests.get(self.base_url, params=params, timeout=10)
            if response.status_code != 200:
                return {"relevance_score": 0, "category": "uncategorized", "related": []}
            
            data = response.json()
            
            # Calculate relevance score based on search results
            total_results = int(data.get('searchInformation', {}).get('totalResults', '0'))
            relevance_score = min(total_results / 1000000, 100)  # normalize to 0-100
            
            # Extract category from snippets
            snippets = [item.get('snippet', '') for item in data.get('items', [])]
            category = self._extract_category(skill, snippets)
            
            # Extract related skills
            related = self._extract_related_skills(snippets)
            
            return {
                "relevance_score": round(relevance_score, 2),
                "category": category,
                "related": related[:5],
                "total_results": total_results
            }
        
        except Exception as e:
            print(f"Search error for '{skill}': {e}")
            return {"relevance_score": 0, "category": "uncategorized", "related": []}
    
    def _extract_category(self, skill: str, snippets: List[str]) -> str:
        """Extract skill category from search snippets."""
        text = " ".join(snippets).lower()
        
        categories = {
            "programming": ["programming", "coding", "software development", "developer"],
            "data_science": ["data science", "machine learning", "ai", "analytics", "data analysis"],
            "web_development": ["web development", "frontend", "backend", "full stack", "web designer"],
            "mobile": ["mobile", "android", "ios", "app development"],
            "cloud": ["cloud", "aws", "azure", "gcp", "devops"],
            "database": ["database", "sql", "nosql", "mongodb", "postgresql"],
            "framework": ["framework", "library", "react", "angular", "vue", "spring"],
            "tools": ["tool", "git", "docker", "kubernetes", "ci/cd"],
            "soft_skills": ["communication", "teamwork", "leadership", "management"]
        }
        
        for category, keywords in categories.items():
            if any(kw in text for kw in keywords):
                return category
        
        return "other"
    
    def _extract_related_skills(self, snippets: List[str]) -> List[str]:
        """Extract related skills mentioned in snippets."""
        text = " ".join(snippets)
        
        # Common tech skills to look for
        tech_patterns = [
            r'\b(Python|Java|JavaScript|C\+\+|C#|Ruby|Go|Rust|Swift|Kotlin)\b',
            r'\b(React|Angular|Vue|Node\.?js|Django|Flask|Spring|Express)\b',
            r'\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins)\b',
            r'\b(SQL|MongoDB|PostgreSQL|MySQL|Redis|Cassandra)\b',
            r'\b(Machine Learning|Deep Learning|AI|NLP|Computer Vision)\b'
        ]
        
        related = set()
        for pattern in tech_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            related.update(m.lower() for m in matches)
        
        return list(related)
    
    def build_taxonomy_for_skills(self, skills: List[str]) -> Dict[str, Dict]:
        """Build taxonomy for a list of extracted skills."""
        print(f"\n=== Building Skill Taxonomy ===")
        print(f"Processing {len(skills)} skills...\n")
        
        taxonomy = {}
        for i, skill in enumerate(skills, 1):
            print(f"{i}/{len(skills)}: Searching '{skill}'...")
            
            info = self.search_skill_relevance(skill)
            skill_key = skill.lower().strip()
            
            taxonomy[skill_key] = {
                "skill_id": f"skill_{str(i).zfill(3)}",
                "display_name": skill,
                "relevance_score": info["relevance_score"],
                "category": info["category"],
                "related_skills": info["related"],
                "market_demand": self._score_to_demand(info["relevance_score"])
            }
            
            print(f"   → Category: {info['category']}, Score: {info['relevance_score']}, Demand: {taxonomy[skill_key]['market_demand']}")
        
        # Sort by relevance score
        sorted_taxonomy = dict(sorted(
            taxonomy.items(),
            key=lambda x: x[1]["relevance_score"],
            reverse=True
        ))
        
        return sorted_taxonomy
    
    def _score_to_demand(self, score: float) -> str:
        """Convert relevance score to demand level."""
        if score >= 80:
            return "very_high"
        elif score >= 60:
            return "high"
        elif score >= 40:
            return "medium"
        elif score >= 20:
            return "low"
        else:
            return "very_low"
    
    def save_taxonomy(self, taxonomy: Dict, output_path: str):
        """Save taxonomy to JSON file."""
        # Create simple mapping for skill mapper
        simple_mapping = {
            skill: info["skill_id"]
            for skill, info in taxonomy.items()
        }
        
        # Save full taxonomy with metadata
        full_path = Path(output_path)
        meta_path = full_path.parent / f"{full_path.stem}_metadata.json"
        
        with open(output_path, 'w') as f:
            json.dump(simple_mapping, f, indent=2)
        
        with open(meta_path, 'w') as f:
            json.dump(taxonomy, f, indent=2)
        
        print(f"\n✓ Taxonomy saved to: {output_path}")
        print(f"✓ Metadata saved to: {meta_path}")

    def append_new_skills(self, new_skills: List[str], mapping_path: str, metadata_path: str) -> Dict[str, Dict]:
        """Append new skills to existing taxonomy files incrementally.

        - Loads existing simple mapping and metadata JSONs if they exist
        - Computes next available skill_id as 'skill_XXX'
        - Uses Google Search relevance to enrich metadata
        - Saves both files back to disk

        Returns a dict of added skills -> metadata (including assigned skill_id).
        """
        mapping_file = Path(mapping_path)
        meta_file = Path(metadata_path)

        existing_map: Dict[str, str] = {}
        existing_meta: Dict[str, Dict] = {}

        if mapping_file.exists():
            with open(mapping_file, 'r') as f:
                existing_map = json.load(f)
        if meta_file.exists():
            with open(meta_file, 'r') as f:
                existing_meta = json.load(f)

        # Normalize keys for existence check
        existing_keys = {k.lower(): k for k in existing_map.keys()}

        # Determine next numeric suffix
        def _extract_num(skill_id: str) -> int:
            try:
                return int(str(skill_id).split('_')[-1])
            except Exception:
                return 0

        max_id_num = 0
        for sid in existing_map.values():
            max_id_num = max(max_id_num, _extract_num(sid))

        added: Dict[str, Dict] = {}
        for skill in new_skills:
            key = skill.lower().strip()
            if key in existing_keys:
                continue

            # Query relevance
            info = self.search_skill_relevance(skill)

            # Next id
            max_id_num += 1
            skill_id = f"skill_{str(max_id_num).zfill(3)}"

            # Update structures
            existing_map[key] = skill_id
            existing_meta[key] = {
                "skill_id": skill_id,
                "display_name": skill,
                "relevance_score": info.get("relevance_score", 0.0),
                "category": info.get("category", "other"),
                "related_skills": info.get("related", []),
                "market_demand": self._score_to_demand(info.get("relevance_score", 0.0))
            }
            added[key] = existing_meta[key]

        # Persist updates if any
        if added:
            with open(mapping_file, 'w') as f:
                json.dump(existing_map, f, indent=2)
            with open(meta_file, 'w') as f:
                json.dump(existing_meta, f, indent=2)

        return added
    
    def update_taxonomy_from_resume(self, resume_text: str, existing_taxonomy_path: str | None = None) -> Dict:
        """Extract skills from resume and build/update taxonomy."""
        # Simple skill extraction (can be enhanced with NER)
        potential_skills = self._extract_potential_skills(resume_text)
        
        print(f"Extracted {len(potential_skills)} potential skills from resume")
        
        # Load existing taxonomy if provided
        existing = {}
        if existing_taxonomy_path and Path(existing_taxonomy_path).exists():
            with open(existing_taxonomy_path, 'r') as f:
                existing = json.load(f)
        
        # Only search for new skills not in existing taxonomy
        new_skills = [s for s in potential_skills if s.lower() not in existing]
        
        if not new_skills:
            print("All skills already in taxonomy")
            return existing
        
        print(f"Building taxonomy for {len(new_skills)} new skills...")
        new_taxonomy = self.build_taxonomy_for_skills(new_skills)
        
        # Merge with existing
        merged = {**existing, **{s: info["skill_id"] for s, info in new_taxonomy.items()}}
        
        return merged
    
    def _extract_potential_skills(self, text: str) -> List[str]:
        """Extract potential technical skills from resume text."""
        # Common technical skills patterns
        patterns = [
            r'\b(Python|Java|JavaScript|TypeScript|C\+\+|C#|C|Ruby|Go|Rust|Swift|Kotlin|PHP|Scala|R)\b',
            r'\b(React|Angular|Vue|Svelte|Node\.?js|Express|Django|Flask|Spring|FastAPI|Laravel)\b',
            r'\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|CI/CD|DevOps)\b',
            r'\b(SQL|MySQL|PostgreSQL|MongoDB|Redis|Cassandra|Oracle|SQLite)\b',
            r'\b(Machine Learning|Deep Learning|AI|NLP|Computer Vision|Data Science|Data Analysis)\b',
            r'\b(HTML|CSS|SASS|SCSS|Tailwind|Bootstrap|Material UI)\b',
            r'\b(Linux|Unix|Windows|MacOS|Bash|PowerShell)\b',
            r'\b(TensorFlow|PyTorch|Scikit-learn|Pandas|NumPy|Matplotlib)\b'
        ]
        
        skills = set()
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            skills.update(m for m in matches)
        
        return list(skills)
