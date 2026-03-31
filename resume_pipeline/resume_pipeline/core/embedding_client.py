"""Google embedding API client with lightweight retries and error handling."""

from __future__ import annotations

import logging
from typing import Optional, Dict, Any

import requests

from ..config import settings

logger = logging.getLogger(__name__)


class GoogleEmbeddingClient:
    """Client wrapper for Google Generative Language embedContent API."""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.base_url = base_url or settings.GEMINI_API_URL
        self.model = settings.EMBEDDING_MODEL
        self.timeout = settings.EMBEDDING_TIMEOUT_SECONDS

    def is_available(self) -> bool:
        return bool(self.api_key and settings.GOOGLE_EMBEDDING_ENABLED)

    def embed_text(self, text: str) -> Dict[str, Any]:
        """Return embedding values for input text.

        Response shape:
            {
                "ok": bool,
                "values": list[float] | None,
                "provider": "google",
                "error": str | None,
            }
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return {"ok": False, "values": None, "provider": "google", "error": "empty_input"}

        if not self.is_available():
            return {"ok": False, "values": None, "provider": "google", "error": "google_embedding_unavailable"}

        model_name = self.model
        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"

        url = f"{self.base_url}/{model_name}:embedContent?key={self.api_key}"
        payload = {
            "model": model_name,
            "content": {
                "parts": [{"text": clean_text}],
            },
        }

        try:
            response = requests.post(url, json=payload, timeout=self.timeout)
            if response.status_code != 200:
                msg = f"google_embed_status_{response.status_code}"
                try:
                    details = response.json()
                except Exception:
                    details = response.text[:300]
                logger.warning("Google embedding request failed: %s | %s", msg, details)
                return {"ok": False, "values": None, "provider": "google", "error": msg}

            data = response.json()
            values = (((data or {}).get("embedding") or {}).get("values"))
            if not isinstance(values, list) or not values:
                return {"ok": False, "values": None, "provider": "google", "error": "google_embed_invalid_response"}

            return {"ok": True, "values": values, "provider": "google", "error": None}
        except requests.Timeout:
            return {"ok": False, "values": None, "provider": "google", "error": "google_embed_timeout"}
        except Exception as exc:
            logger.error("Google embedding exception: %s", exc)
            return {"ok": False, "values": None, "provider": "google", "error": "google_embed_exception"}
