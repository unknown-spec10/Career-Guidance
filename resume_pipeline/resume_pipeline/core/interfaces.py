from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Tuple


class LLMClient(ABC):
    @abstractmethod
    def call_parse(self, model_name: str, payload: dict, images: Optional[List[str]] = None, system_instruction: Optional[str] = None) -> dict: ...

    @abstractmethod
    def call_rerank(self, model_name: str, payload: dict) -> dict: ...


class TextExtractor(ABC):
    @abstractmethod
    def extract_text(self, path: str) -> str: ...

    @abstractmethod
    def summarize(self, text: str, max_sentences: int) -> str: ...


class OCRService(ABC):
    @abstractmethod
    def ocr_image(self, path: str) -> str: ...

    @abstractmethod
    def ocr_pdf_pages(self, path: str) -> Dict[int, str]: ...


class NumericValidator(ABC):
    @abstractmethod
    def normalize_cgpa(self, value) -> Dict: ...

    @abstractmethod
    def parse_numeric(self, s: str): ...

    @abstractmethod
    def validate_dates(self, start: Optional[str], end: Optional[str]) -> Dict: ...


class SkillMapper(ABC):
    @abstractmethod
    def map(self, skills: List[str]) -> List[Dict]: ...


class VectorStore(ABC):
    @abstractmethod
    def upsert(self, id: str, vector: List[float], metadata: dict): ...

    @abstractmethod
    def query(self, vector: List[float], top_k: int = 10): ...


class ParserService(ABC):
    @abstractmethod
    def run_parse(self, applicant_root: str, applicant_id: str) -> dict: ...
