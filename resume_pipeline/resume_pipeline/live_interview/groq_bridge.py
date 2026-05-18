import asyncio
import base64
import logging
from typing import Any

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from .event_schema import parse_client_event
from .groq_live_client import GroqLiveClient

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are a technical interview assistant for a career guidance platform. "
    "Ask one concise interview question at a time, evaluate user answers briefly, "
    "and keep the conversation natural, professional, and supportive."
)

MAX_AUDIO_CHUNK_BYTES = 64 * 1024


async def bridge_groq_live_stream(websocket: WebSocket, groq_client: GroqLiveClient) -> None:
    """Relay browser interview events through Groq speech and text services."""

    conversation_history: list[dict[str, str]] = []
    buffered_audio = bytearray()

    async def send_transcription(role: str, text: str, is_final: bool = True) -> None:
        await websocket.send_json({
            "type": "transcription",
            "role": role,
            "text": text,
            "is_final": is_final,
        })

    async def send_audio(audio_bytes: bytes) -> None:
        if not audio_bytes:
            return

        for offset in range(0, len(audio_bytes), MAX_AUDIO_CHUNK_BYTES):
            chunk = audio_bytes[offset:offset + MAX_AUDIO_CHUNK_BYTES]
            if len(chunk) % 2:
                chunk = chunk[:-1]
            if not chunk:
                continue

            await websocket.send_json({
                "type": "audio",
                "chunk_base64": base64.b64encode(chunk).decode("utf-8"),
                "mime_type": "audio/pcm",
            })

    async def process_turn(user_text: str) -> None:
        if not user_text.strip():
            return

        await send_transcription("user", user_text.strip(), True)
        conversation_history.append({"role": "user", "content": user_text.strip()})
        history_tail = conversation_history[-8:]

        assistant_text = await asyncio.to_thread(
            groq_client.generate_response,
            SYSTEM_PROMPT,
            user_text.strip(),
            history_tail,
        )
        conversation_history.append({"role": "assistant", "content": assistant_text})
        await send_transcription("model", assistant_text, True)

        try:
            assistant_audio = await asyncio.to_thread(groq_client.synthesize_speech, assistant_text)
            await send_audio(assistant_audio)
        except Exception as exc:
            logger.warning("Groq TTS unavailable for this turn: %s", exc)
            await websocket.send_json({
                "type": "error",
                "message": f"Text-to-speech unavailable: {exc}",
            })

    while True:
        try:
            raw_message = await websocket.receive_json()
        except WebSocketDisconnect:
            return
        client_event = parse_client_event(raw_message)

        if client_event["type"] == "control":
            action = client_event["action"]

            if action == "ping":
                await websocket.send_json({"type": "control", "action": "pong"})
                continue

            if action == "pause":
                await websocket.send_json({"type": "control", "action": "pause"})
                continue

            if action == "resume":
                await websocket.send_json({"type": "control", "action": "resume"})
                continue

            if action == "disconnect":
                await websocket.send_json({"type": "control", "action": "ended"})
                break

            if action == "end_turn":
                if buffered_audio:
                    audio_bytes = bytes(buffered_audio)
                    buffered_audio.clear()
                    user_text = await asyncio.to_thread(groq_client.transcribe_audio, audio_bytes)
                    await process_turn(user_text)
                continue

            if action == "start_turn":
                buffered_audio.clear()
                await websocket.send_json({"type": "control", "action": "start_turn"})
                continue

            continue

        if client_event["type"] == "audio":
            buffered_audio.extend(base64.b64decode(client_event["chunk_base64"]))
            continue

        if client_event["type"] == "text":
            await process_turn(client_event["text"])
