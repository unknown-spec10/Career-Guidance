from abc import ABC, abstractmethod
from typing import Dict, Any

class ISTTService(ABC):
    @abstractmethod
    async def transcribe_chunk(self, chunk: bytes) -> Dict[str, Any]:
        """
        Accepts a chunk of audio bytes; returns a dict:
          {"text": "...", "is_final": Bool, "confidence": float}
        """
        raise NotImplementedError
