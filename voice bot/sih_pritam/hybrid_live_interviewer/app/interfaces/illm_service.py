from abc import ABC, abstractmethod
from typing import Dict, Any

class ILLMService(ABC):
    """Abstract interface for LLM services."""

    @abstractmethod
    async def generate_question(self, context: Dict[str, Any]) -> Any:
        """
        Given context (dict), return a single question or structured JSON.
        Return types supported: dict or str (JSON string).
        """
        raise NotImplementedError
