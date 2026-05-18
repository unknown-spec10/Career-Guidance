import io
import json
import wave
from typing import Any, Optional

import requests


class GroqLiveClient:
    """Groq-backed live interview client for STT, LLM, and TTS."""

    def __init__(
        self,
        api_key: str,
        base_url: str,
        chat_model: str,
        stt_model: str,
        tts_model: str,
        tts_voice: str,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.chat_model = chat_model
        self.stt_model = stt_model
        self.tts_model = tts_model
        self.tts_voice = tts_voice
        self._session = requests.Session()

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _pcm_to_wav_bytes(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_bytes)
        return buffer.getvalue()

    @staticmethod
    def _split_text_for_tts(text: str, max_length: int = 200) -> list[str]:
        cleaned = " ".join(text.split())
        if len(cleaned) <= max_length:
            return [cleaned]

        chunks: list[str] = []
        current = ""
        for sentence in cleaned.replace("?", ".").replace("!", ".").split("."):
            sentence = sentence.strip()
            if not sentence:
                continue
            piece = sentence + "."
            if len(piece) > max_length:
                words = piece.split()
                for word in words:
                    candidate = f"{current} {word}".strip()
                    if len(candidate) > max_length and current:
                        chunks.append(current)
                        current = word
                    else:
                        current = candidate
                continue
            candidate = f"{current} {piece}".strip()
            if len(candidate) > max_length and current:
                chunks.append(current)
                current = piece
            else:
                current = candidate

        if current:
            chunks.append(current)

        return [chunk[:max_length].strip() for chunk in chunks if chunk.strip()]

    def transcribe_audio(self, audio_bytes: bytes, mime_type: str = "audio/pcm") -> str:
        if not audio_bytes:
            return ""

        wav_bytes = audio_bytes if mime_type in {"audio/wav", "audio/x-wav"} else self._pcm_to_wav_bytes(audio_bytes)
        files = {
            "file": ("speech.wav", wav_bytes, "audio/wav"),
        }
        data = {
            "model": self.stt_model,
            "response_format": "json",
            "temperature": 0,
        }

        response = self._session.post(
            f"{self.base_url}/audio/transcriptions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            files=files,
            data=data,
            timeout=60,
        )
        if response.status_code != 200:
            raise RuntimeError(f"Groq transcription failed: {response.status_code} {response.text[:500]}")

        payload = response.json()
        text = payload.get("text") if isinstance(payload, dict) else None
        return text or ""

    def generate_response(
        self,
        system_prompt: str,
        user_text: str,
        history: Optional[list[dict[str, str]]] = None,
        temperature: float = 0.4,
        max_tokens: int = 512,
    ) -> str:
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_text})

        body = {
            "model": self.chat_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        response = self._session.post(
            f"{self.base_url}/chat/completions",
            headers=self._headers(),
            json=body,
            timeout=60,
        )
        if response.status_code != 200:
            raise RuntimeError(f"Groq chat failed: {response.status_code} {response.text[:500]}")

        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise RuntimeError("Groq chat returned no choices")

        message = choices[0].get("message") or {}
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Groq chat returned empty content")
        return content.strip()

    def synthesize_speech(self, text: str) -> bytes:
        segments = self._split_text_for_tts(text)
        if not segments:
            return b""

        pcm_segments: list[bytes] = []
        for segment in segments:
            body = {
                "model": self.tts_model,
                "voice": self.tts_voice,
                "input": segment,
                "response_format": "wav",
            }
            response = self._session.post(
                f"{self.base_url}/audio/speech",
                headers=self._headers(),
                json=body,
                timeout=60,
            )
            if response.status_code != 200:
                raise RuntimeError(f"Groq speech failed: {response.status_code} {response.text[:500]}")
            with wave.open(io.BytesIO(response.content), "rb") as wav_file:
                pcm_segments.append(wav_file.readframes(wav_file.getnframes()))

        if len(pcm_segments) == 1:
            return pcm_segments[0]

        return b"".join(pcm_segments)
