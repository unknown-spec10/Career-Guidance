import tempfile
from faster_whisper import WhisperModel
import asyncio
from app.interfaces.isstt_service import ISTTService

class FasterWhisperSTT(ISTTService):
    def __init__(self, model_size: str = "small", device: str = "cpu"):
        self.model = WhisperModel(model_size, device=device)

    async def transcribe_chunk(self, chunk: bytes):
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as f:
            f.write(chunk)
            f.flush()
            segments, info = self.model.transcribe(f.name, beam_size=5)
            full = "".join(s.text for s in segments)
            return {"text": full, "is_final": True, "confidence": 0.9}
