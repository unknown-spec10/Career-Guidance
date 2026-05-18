import asyncio
import logging

from fastapi import WebSocket

from .event_schema import from_gemini_event, parse_client_event, to_gemini_event
from .gemini_live_client import GeminiLiveClient

logger = logging.getLogger(__name__)


async def bridge_live_stream(websocket: WebSocket, gemini_client: GeminiLiveClient) -> None:
    """Bidirectionally relay strict events between browser and Gemini Live API."""

    async def client_to_gemini() -> None:
        while True:
            raw_message = await websocket.receive_json()
            client_event = parse_client_event(raw_message)

            if client_event["type"] == "control":
                action = client_event["action"]

                if action == "ping":
                    await websocket.send_json({"type": "control", "action": "pong"})
                    continue

                if action == "disconnect":
                    await websocket.send_json({"type": "control", "action": "ended"})
                    break

                if action in ("pause", "resume"):
                    await websocket.send_json({"type": "control", "action": action})
                    continue

            gemini_payload = to_gemini_event(client_event)
            if gemini_payload is not None:
                await gemini_client.send_event(gemini_payload)

    async def gemini_to_client() -> None:
        while True:
            event = await gemini_client.recv_event()
            server_events = from_gemini_event(event)
            for server_event in server_events:
                await websocket.send_json(server_event)

    await asyncio.gather(client_to_gemini(), gemini_to_client())
