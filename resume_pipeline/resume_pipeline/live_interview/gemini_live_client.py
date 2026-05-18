import json
from typing import Any
from urllib.parse import quote_plus

import aiohttp


class GeminiLiveClient:
    """Thin relay client for Gemini Live API over WebSocket using aiohttp."""

    def __init__(self, api_key: str, model: str, endpoint: str):
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self._session = None
        self._ws = None

    async def connect(self) -> None:
        # Gemini API-key auth is provided via URL query parameter.
        url = f"{self.endpoint}?key={quote_plus(self.api_key)}"
        
        # Create session if not exists
        if self._session is None:
            self._session = aiohttp.ClientSession()
        
        self._ws = await self._session.ws_connect(
            url,
            heartbeat=None  # Disable heartbeat to avoid interference with Gemini protocol
        )

    async def send_event(self, payload: dict[str, Any]) -> None:
        if self._ws is None:
            raise RuntimeError("Gemini Live socket is not connected")
        await self._ws.send_json(payload)

    async def recv_event(self) -> dict[str, Any]:
        if self._ws is None:
            raise RuntimeError("Gemini Live socket is not connected")
        msg = await self._ws.receive()

        if msg.type == aiohttp.WSMsgType.TEXT:
            return json.loads(msg.data)

        if msg.type == aiohttp.WSMsgType.BINARY:
            return json.loads(msg.data.decode("utf-8", errors="ignore"))

        if msg.type == aiohttp.WSMsgType.CLOSE:
            raise RuntimeError(
                f"Gemini websocket closed: code={self._ws.close_code}, data={msg.data}, extra={msg.extra}"
            )

        if msg.type == aiohttp.WSMsgType.CLOSED:
            raise RuntimeError(f"Gemini websocket already closed: code={self._ws.close_code}")

        if msg.type == aiohttp.WSMsgType.ERROR:
            raise RuntimeError(f"Gemini websocket error: {self._ws.exception()}")

        raise RuntimeError(f"Unexpected Gemini websocket message type: {msg.type}")

    async def close(self) -> None:
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
        if self._session is not None:
            await self._session.close()
            self._session = None
