from typing import List, Dict
from ..core.interfaces import LLMClient

class CollegeRecommender:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    def filter_and_rank(self, applicant_json: Dict, colleges: List[Dict]) -> List[Dict]:
        # Placeholder: deterministic filters and LLM rerank to be implemented later
        return colleges
