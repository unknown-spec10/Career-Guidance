import base64
import os
import uuid
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.runtime.runtime_manager import RuntimeManager
from app.runtime.langgraph_nodes import graph
from app.logger import logger

app = FastAPI(title="Hybrid Live Interviewer Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

runtime = RuntimeManager()

@app.post("/session/start")
async def start_session():
    sid = str(uuid.uuid4())
    runtime.create_session(session_id=sid)
    return {"session_id": sid}

@app.post("/session/{session_id}/stop")
async def stop_session(session_id: str):
    await runtime.close_session(session_id)
    return {"stopped": True}

@app.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = runtime.get_session(session_id)
    if not session:
        await websocket.close(code=1000)
        return

    state = {"session": session}
    try:
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype == "audio":
                data_b64 = msg.get("data_b64")
                if data_b64:
                    raw = base64.b64decode(data_b64)
                else:
                    raw = (msg.get("data") or "").encode()
                stt_res = await session.receive_audio_chunk(raw)
                state["stt_partial"] = {"text": stt_res.get("text",""), "is_final": stt_res.get("is_final", False), "confidence": stt_res.get("confidence", 0.0)}
                state["audio_features"] = msg.get("audio_features", {})
                state["vad_state"] = msg.get("vad_state", "unknown")

                result_state = await graph.run(state)
                if result_state.get("validated_question") and result_state.get("tts_audio_b64"):
                    await websocket.send_json({"type":"question", "payload": result_state.get("validated_question"), "audio_b64": result_state.get("tts_audio_b64")})
                else:
                    await websocket.send_json({"type":"stt_update","payload": stt_res})
            elif mtype == "ask_next":
                state["stt_partial"] = {"text": session.state.last_answer_partial or "", "is_final": True, "confidence": 0.9}
                result_state = await graph.run(state)
                if result_state.get("validated_question") and result_state.get("tts_audio_b64"):
                    await websocket.send_json({"type":"question","payload": result_state.get("validated_question"), "audio_b64": result_state.get("tts_audio_b64")})
                else:
                    await websocket.send_json({"type":"error","message":"no question generated"})
            elif mtype == "command":
                cmd = msg.get("cmd")
                if cmd == "pause":
                    await session.pause()
                    await websocket.send_json({"type":"command_ack","cmd":"pause"})
                elif cmd == "resume":
                    await session.resume()
                    await websocket.send_json({"type":"command_ack","cmd":"resume"})
                elif cmd == "stop":
                    await session.stop()
                    await websocket.send_json({"type":"command_ack","cmd":"stop"})
                else:
                    await websocket.send_json({"type":"command_ack","cmd":"unknown"})
            else:
                await websocket.send_json({"type":"error","message":"unknown message type"})
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {session_id}")
    except Exception as e:
        logger.exception("WS error")
        await websocket.close()
