import uuid
import asyncio
from typing import Dict, Any
from app.schemas import SessionState, QAItem
from app.interfaces.illm_service import ILLMService
from app.interfaces.isstt_service import ISTTService
from app.interfaces.itts_service import ITTSService
from app.utils.validator import validate_single_question
from app.logger import logger

class SessionController:
    def __init__(self, session_id: str, llm: ILLMService, stt: ISTTService, tts: ITTSService):
        self.state = SessionState(session_id=session_id)
        self.llm = llm
        self.stt = stt
        self.tts = tts
        self._lock = asyncio.Lock()
        self._stop = False

    async def receive_audio_chunk(self, chunk: bytes):
        stt_res = await self.stt.transcribe_chunk(chunk)
        text = stt_res.get("text","")
        self.state.last_answer_partial = text
        if stt_res.get("is_final"):
            qa = QAItem(id=str(uuid.uuid4()), question=self.state.last_question or "", answer=text)
            self.state.memory.append(qa)
            self.state.memory = self.state.memory[-50:]
        return stt_res

    async def ask_next_question(self) -> Dict[str, Any]:
        context = {
            "last_answer": (self.state.last_answer_partial or ""),
            "memory": [q.dict() for q in self.state.memory],
            "mode": self.state.mode.value,
        }
        llm_out = await self.llm.generate_question(context)
        if isinstance(llm_out, dict) and "text" in llm_out:
            qobj = llm_out
        else:
            parsed = validate_single_question(llm_out if isinstance(llm_out, str) else "")
            if parsed:
                qobj = parsed
            else:
                try:
                    llm_out2 = await self.llm.generate_question({**context, "_repr": True})
                    if isinstance(llm_out2, dict) and "text" in llm_out2:
                        qobj = llm_out2
                    else:
                        qobj = {"text": "Can you tell me more about your last role?", "type": "followup", "topic": "roles"}
                except Exception:
                    qobj = {"text": "Can you tell me about a recent project you completed?", "type": "new", "topic": "projects"}
        self.state.last_question = qobj.get("text")
        return qobj

    async def synthesize_and_return(self, text: str):
        tts_res = await self.tts.synthesize(text)
        play_id = str(uuid.uuid4())
        self.state.tts_state = {"playing": True, "play_id": play_id}
        return {"play_id": play_id, "audio_bytes_len": len(tts_res.get("audio_bytes", b""))}

    async def stop(self):
        self.state.active = False
        self._stop = True

    async def pause(self):
        self.state.paused = True

    async def resume(self):
        self.state.paused = False
