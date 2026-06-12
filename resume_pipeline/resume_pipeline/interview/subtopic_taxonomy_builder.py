import json
import logging
import requests
from pathlib import Path
from typing import Dict, List, Optional
from sqlalchemy.orm import Session as DBSession
from ..config import settings
from ..db import SystemConfiguration
from ..core.llm_router import llm_router
from .prompts import GROQ_MODEL

logger = logging.getLogger(__name__)

class SubtopicTaxonomyBuilder:
    def __init__(self, db: DBSession):
        self.db = db
        self.api_key = settings.GOOGLE_API_KEY
        self.search_engine_id = settings.GOOGLE_SEARCH_ENGINE_ID
        self.base_url = "https://www.googleapis.com/customsearch/v1"
        self.local_json_path = Path(__file__).resolve().parent / "subtopic_taxonomy.json"
        self._taxonomy: Dict[str, List[str]] = {}
        self._load_taxonomy()

    def _load_taxonomy(self):
        # 1. Load from pre-seeded file if it exists
        if self.local_json_path.exists():
            try:
                with open(self.local_json_path, "r", encoding="utf-8") as f:
                    self._taxonomy = json.load(f)
            except Exception as e:
                logger.error("Failed to load local subtopic taxonomy: %s", e)

        # 2. Merge from system_configurations in DB
        try:
            config_record = self.db.query(SystemConfiguration).filter_by(key="dynamic_subtopic_taxonomy").first()
            if config_record and isinstance(config_record.value, dict):
                for skill, subtopics in config_record.value.items():
                    self._taxonomy[skill.lower().strip()] = subtopics
        except Exception as e:
            logger.error("Failed to load dynamic subtopic taxonomy from database: %s", e)

    def get_subtopics(self, skill: str) -> List[str]:
        skill_key = skill.lower().strip()
        
        # If found in taxonomy, return
        if skill_key in self._taxonomy:
            return self._taxonomy[skill_key]

        # Otherwise, dynamically discover subtopics using Google Search + LLM
        logger.info("Dynamic sub-topic discovery triggered for skill: %s", skill)
        discovered = self._discover_subtopics(skill)
        
        if discovered:
            self._save_dynamic_subtopics(skill_key, discovered)
            return discovered
            
        # Fallback to general default subtopics if discovery fails
        return [f"{skill} - fundamentals", f"{skill} - best practices", f"{skill} - debugging"]

    def _discover_subtopics(self, skill: str) -> List[str]:
        if not self.api_key or not self.search_engine_id:
            logger.warning("Google Search API key or Engine ID not set. Skipping dynamic search.")
            return []

        query = f"{skill} programming core technical interview concepts key topics syllabus"
        params = {
            "key": self.api_key,
            "cx": self.search_engine_id,
            "q": query,
            "num": 5
        }

        snippets = []
        try:
            res = requests.get(self.base_url, params=params, timeout=10)
            if res.status_code == 200:
                data = res.json()
                snippets = [item.get("snippet", "") for item in data.get("items", [])]
        except Exception as e:
            logger.error("Google Search failed during subtopic discovery for %s: %s", skill, e)

        search_context = "\n".join(snippets)
        prompt = f"""You are a technical curriculum designer.
Analyze this technical search context about the skill "{skill}":
{search_context}

Based on this context, generate exactly 8-12 granular, distinct interview sub-topics for this skill.
Each sub-topic must follow the exact format: "category - subtopic description".
For example:
- "hooks - useState internals"
- "performance - lazy loading"

Ensure they cover a range of difficulty from foundational to advanced.
Respond ONLY with a valid JSON array of strings. No preamble, no explanation, no markdown.
"""

        try:
            res = llm_router.generate_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                provider="groq",
                model_name=GROQ_MODEL,
                temperature=0.2,
                max_tokens=600,
                response_format={"type": "json_object"}
            )
            raw = res["content"].strip()
            data = json.loads(raw)
            if isinstance(data, list):
                return [str(s).strip() for s in data if s]
            elif isinstance(data, dict) and "subtopics" in data:
                return [str(s).strip() for s in data["subtopics"] if s]
        except Exception as e:
            logger.error("LLM subtopic generation failed for %s: %s", skill, e)
            
        return []

    def _save_dynamic_subtopics(self, skill_key: str, subtopics: List[str]):
        self._taxonomy[skill_key] = subtopics
        try:
            config_record = self.db.query(SystemConfiguration).filter_by(key="dynamic_subtopic_taxonomy").first()
            if not config_record:
                config_record = SystemConfiguration(
                    key="dynamic_subtopic_taxonomy",
                    value={skill_key: subtopics},
                    category="interview"
                )
                self.db.add(config_record)
            else:
                current_value = dict(config_record.value) if config_record.value else {}
                current_value[skill_key] = subtopics
                config_record.value = current_value
            self.db.commit()
            logger.info("Saved dynamic subtopics to DB for skill: %s", skill_key)
        except Exception as e:
            self.db.rollback()
            logger.error("Failed to persist dynamic subtopics to DB: %s", e)
