import uuid
from typing import Dict, Optional
from app.services.groq_service import GroqService
from app.services.openai_whisper_stt import OpenAIWhisperSTT
from app.services.coqui_tts import CoquiTTSService
from app.controllers.session_controller import SessionController
from app.config import settings
from app.logger import logger

class RuntimeManager:
    def __init__(self, config: Dict = None):
        self.sessions: Dict[str, SessionController] = {}
        cfg = config or {}
        def llm_factory():
            return GroqService(api_key=cfg.get("GROQ_API_KEY") or settings.GROQ_API_KEY,
                               api_url=cfg.get("GROQ_API_URL") or settings.GROQ_API_URL,
                               model=cfg.get("GROQ_MODEL") or settings.GROQ_MODEL)
        def stt_factory():
            if cfg.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY:
                return OpenAIWhisperSTT(api_key=cfg.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY)
            else:
                raise RuntimeError("No STT configured")
        def tts_factory():
            return CoquiTTSService(model_name=cfg.get("COQUI_MODEL") or settings.COQUI_MODEL)

        self._llm_factory = llm_factory
        self._stt_factory = stt_factory
        self._tts_factory = tts_factory

    def create_session(self, session_id: Optional[str] = None) -> SessionController:
        sid = session_id or str(uuid.uuid4())
        llm = self._llm_factory()
        stt = self._stt_factory()
        tts = self._tts_factory()
        sc = SessionController(session_id=sid, llm=llm, stt=stt, tts=tts)
        self.sessions[sid] = sc
        logger.info(f"Session created: {sid}")
        return sc

    def get_session(self, session_id: str) -> Optional[SessionController]:
        return self.sessions.get(session_id)

    async def close_session(self, session_id: str):
        s = self.sessions.pop(session_id, None)
        if s:
            await s.stop()
            logger.info(f"Session closed: {session_id}")
