from abc import ABC, abstractmethod
from typing import Dict, Any

class ITTSService(ABC):
    @abstractmethod
    async def synthesize(self, text: str) -> Dict[str, Any]:
        """
        Return {"audio_bytes": b"...", "duration": float}
        """
        raise NotImplementedError
