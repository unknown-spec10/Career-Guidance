import io
import asyncio
import openai
from app.interfaces.isstt_service import ISTTService
from app.config import settings

class OpenAIWhisperSTT(ISTTService):
    def __init__(self, api_key: str = None, model: str = "gpt-4o-transcribe"):
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY required for OpenAIWhisperSTT")
        openai.api_key = self.api_key
        self.model = model

    async def transcribe_chunk(self, chunk: bytes):
        loop = asyncio.get_event_loop()
        def blocking():
            audio_file = io.BytesIO(chunk)
            audio_file.name = "audio.webm"
            resp = openai.Audio.transcriptions.create(model=self.model, file=audio_file)
            return resp
        try:
            resp = await loop.run_in_executor(None, blocking)
            text = resp.get("text") if isinstance(resp, dict) else str(resp)
            return {"text": text, "is_final": True, "confidence": 0.92}
        except Exception as e:
            return {"text": "", "is_final": True, "confidence": 0.0, "error": str(e)}
