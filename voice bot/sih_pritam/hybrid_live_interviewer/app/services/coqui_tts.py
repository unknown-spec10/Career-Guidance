import tempfile
import io
import soundfile as sf
import asyncio
from app.interfaces.itts_service import ITTSService
from app.config import settings

try:
    from TTS.api import TTS
except Exception:
    TTS = None

class CoquiTTSService(ITTSService):
    def __init__(self, model_name: str = None):
        model_name = model_name or settings.COQUI_MODEL
        if TTS is None:
            raise RuntimeError("Coqui TTS (TTS package) not installed")
        self.model = TTS(model_name)

    async def synthesize(self, text: str):
        loop = asyncio.get_event_loop()
        def blocking():
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tf:
                self.model.tts_to_file(text=text, file_path=tf.name)
                data, samplerate = sf.read(tf.name)
                buf = io.BytesIO()
                sf.write(buf, data, samplerate, format="WAV")
                return buf.getvalue()
        audio_bytes = await loop.run_in_executor(None, blocking)
        return {"audio_bytes": audio_bytes, "duration": max(0.2, len(text)/50.0)}
