import json
import logging
import re
import threading
import time
import uuid
from datetime import date
from typing import Any, Dict, Iterator, List, Optional, Tuple

import requests

try:
    from groq import Groq
except ImportError:  # groq is an optional dependency (STT only)
    Groq = None  # type: ignore

from ..config import settings
from .rate_limiter import opencode_limiter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Daily call budget — a hard ceiling so a bug (or a long dev session) can never
# drain the provider account without anyone noticing.
# ---------------------------------------------------------------------------

_budget_lock = threading.Lock()
_budget_day = None
_budget_calls = 0


class LLMCallBudgetExceeded(RuntimeError):
    """Raised when LLM_MAX_CALLS_PER_DAY is exhausted."""


def _consume_call_budget() -> None:
    """Count one outbound LLM call against the daily ceiling (0 = unlimited)."""
    global _budget_day, _budget_calls
    limit = int(getattr(settings, "LLM_MAX_CALLS_PER_DAY", 0) or 0)
    if limit <= 0:
        return
    today = date.today()
    with _budget_lock:
        if _budget_day != today:
            _budget_day, _budget_calls = today, 0
        if _budget_calls >= limit:
            logger.error(
                "LLMRouter: daily LLM call budget exhausted (%s/%s) — refusing call.",
                _budget_calls,
                limit,
            )
            raise LLMCallBudgetExceeded(
                f"LLM_MAX_CALLS_PER_DAY={limit} reached; refusing further LLM calls today."
            )
        _budget_calls += 1
        if _budget_calls % 50 == 0:
            logger.info("LLMRouter: %s/%s daily LLM calls used.", _budget_calls, limit)

# Stable per-process session identifier for the OpenCode Go gateway, which
# requires ``x-opencode-session`` on every request (used for routing/caching).
_SESSION_ID = "careerguidance-" + uuid.uuid4().hex

# Product user agent for the Go gateway (must identify our own app, not a
# generic SDK/library name).
_USER_AGENT = "career-guidance-backend/1.0"


class AdapterClientError(Exception):
    """Single-attempt client error (4xx): do NOT trip the circuit breaker."""


def _mock_completion(messages: List[Dict[str, str]]) -> str:
    """Generate a basic mock response for development/test mode."""
    prompt_text = "".join([m.get("content", "") for m in messages]).lower()
    if "question" in prompt_text and "mcq" in prompt_text:
        return json.dumps({
            "questions": [{
                "question_type": "mcq",
                "question_text": "What is the time complexity of binary search?",
                "difficulty": "medium",
                "category": "DSA",
                "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
                "correct_answer": "O(log n)",
                "skills_tested": ["Algorithms"],
                "max_score": 10.0,
            }]
        })
    if "evaluate" in prompt_text:
        return json.dumps({
            "score": 10.0,
            "is_correct": True,
            "strengths": ["Clear answer"],
            "weaknesses": [],
            "improvement_suggestions": "None",
            "points_covered": ["Everything"],
            "points_missed": [],
        })
    if "gap" in prompt_text:
        return json.dumps({
            "skill_gaps": {"Python": "strong"},
            "overall_assessment": "Good performance",
            "priority_skills": ["Algorithms"],
            "recommended_courses": [],
            "recommended_projects": [],
            "practice_problems": [],
        })
    return "Mock response from LLMRouter (Mock Mode active)."


# ---------------------------------------------------------------------------
# Provider adapters — one per live provider, same chat()/stream() interface.
# Callers ask for a capability ("chat", "explanation"); the router uses the
# single configured primary provider for that capability. No model names or
# URLs live here.
# ---------------------------------------------------------------------------

class GroqAdapter:
    """STT-only transport for Groq Whisper. Chat was removed (Oct 2026 demock):
    all chat/explanation workloads route to opencode."""

    name = "groq"

    def has_credentials(self) -> bool:
        return Groq is not None and bool(settings.GROQ_API_KEY)

    def transcribe(self, audio_bytes: bytes, filename: str, model: str) -> str:
        if not self.has_credentials():
            raise ValueError("Groq API key is not configured.")
        client = Groq(api_key=settings.GROQ_API_KEY)
        transcription = client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model=model,
            response_format="json",
        )
        return transcription.text


class OpenCodeAdapter:
    """Chat transport for OpenCode (OpenAI-compatible /chat/completions).

    Single attempt per call; raises on failure. Same timeout/error semantics
    as the other adapters: 4xx raises AdapterClientError (no breaker trip),
    other failures raise and trip the breaker.
    """

    name = "opencode"

    def _url(self) -> str:
        return f"{(settings.OPENCODE_API_BASE_URL or '').rstrip('/')}/chat/completions"

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {settings.OPENCODE_API_KEY}",
            "Content-Type": "application/json",
            "x-opencode-session": _SESSION_ID,
            "User-Agent": _USER_AGENT,
        }

    def _body(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            body["response_format"] = response_format
        # Reasoning models on the Go gateway can burn the whole max_tokens
        # budget on reasoning_content and return empty content. Opt-in only:
        # when the flag is false the body stays exactly as before.
        if settings.OPENCODE_DISABLE_REASONING:
            body["reasoning_effort"] = "none"
        return body

    def has_credentials(self) -> bool:
        return bool(settings.OPENCODE_API_KEY)

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, Any]],
        timeout: int,
    ) -> str:
        if not self.has_credentials():
            raise ValueError("OpenCode API key is not configured.")
        try:
            r = requests.post(
                self._url(),
                headers=self._headers(),
                json=self._body(messages, model, temperature, max_tokens, response_format),
                timeout=timeout,
            )
        except Exception as e:
            raise RuntimeError(f"OpenCode request failed: {e}")
        if r.status_code in (400, 401, 403):
            # Client errors - do NOT trip the breaker.
            raise AdapterClientError(f"OpenCode API status {r.status_code}: {r.text}")
        if r.status_code != 200:
            raise RuntimeError(f"OpenCode API status {r.status_code}: {r.text}")
        try:
            content = r.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as e:
            raise RuntimeError(f"Empty response candidates returned from OpenCode: {e}")
        if not content:
            raise RuntimeError("Empty response candidates returned from OpenCode.")
        return content

    def stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: int,
    ) -> Iterator[str]:
        if not self.has_credentials():
            raise ValueError("OpenCode API key is not configured.")
        body = self._body(messages, model, temperature, max_tokens, None)
        body["stream"] = True
        try:
            r = requests.post(
                self._url(), headers=self._headers(), json=body,
                timeout=timeout, stream=True,
            )
        except Exception as e:
            raise RuntimeError(f"OpenCode request failed: {e}")
        if r.status_code in (400, 401, 403):
            raise AdapterClientError(f"OpenCode API status {r.status_code}: {r.text}")
        if r.status_code != 200:
            raise RuntimeError(f"OpenCode API status {r.status_code}: {r.text}")
        for line in r.iter_lines():
            if not line:
                continue
            text = line.decode("utf-8") if isinstance(line, bytes) else line
            text = text.strip()
            if not text.startswith("data:"):
                continue
            payload = text[5:].strip()
            if payload == "[DONE]":
                break
            try:
                chunk = json.loads(payload)
            except ValueError:
                continue
            try:
                delta = chunk["choices"][0]["delta"].get("content")
            except (KeyError, IndexError, TypeError, AttributeError):
                continue
            if delta:
                yield delta


class LLMRouter:
    """
    Capability-based router over a small provider-adapter registry.

    Callers ask for a capability ("chat", "explanation") and the router uses
    the single configured primary provider for that capability. Exactly one
    adapter attempt per call; any failure raises (callers own their recovery:
    interview question bank, evaluator error path, learning-path template,
    RAG error return, offline explanation).
    Any explicitly named provider tries once and raises.
    """

    def __init__(self) -> None:
        self._adapters: Dict[str, Any] = {
            "groq": GroqAdapter(),
            "opencode": OpenCodeAdapter(),
        }

    # -------------------------------------------------------------------------
    # Registry / selection helpers
    # -------------------------------------------------------------------------

    def get_adapter(self, name: str) -> Any:
        key = (name or "").lower()
        if key not in self._adapters:
            raise ValueError(f"Unknown provider: {name}")
        return self._adapters[key]

    def _slot(self, capability: str) -> Tuple[str, str]:
        if capability == "explanation":
            return (
                settings.MODEL_EXPLAIN_PRIMARY_PROVIDER,
                settings.MODEL_EXPLAIN_PRIMARY_NAME,
            )
        return (
            settings.MODEL_CHAT_PRIMARY_PROVIDER,
            settings.MODEL_CHAT_PRIMARY_NAME,
        )

    def _order_for_capability(self, capability: str) -> List[str]:
        cap = capability if capability in ("chat", "explanation") else "chat"
        primary, _ = self._slot(cap)
        name = (primary or "").lower()
        if name not in self._adapters:
            raise ValueError(f"Unknown provider: {primary!r} (capability {cap!r})")
        return [name]

    def model_for(self, provider: str, capability: str = "chat") -> str:
        """Resolve the concrete model name for a provider + capability slot."""
        pname = (provider or "").lower()
        cap = capability if capability in ("chat", "explanation") else "chat"
        primary, primary_name = self._slot(cap)
        if pname == (primary or "").lower() and primary_name:
            return primary_name
        if pname == "opencode":
            return settings.OPENCODE_CHAT_MODEL
        raise ValueError(f"Unknown provider: {provider}")

    def ordered_adapters(self, capability: str = "chat") -> List[Tuple[Any, str]]:
        """Adapter + resolved model for a capability (single provider)."""
        cap = capability if capability in ("chat", "explanation") else "chat"
        return [(self._adapters[n], self.model_for(n, cap)) for n in self._order_for_capability(cap)]

    def is_chat_available(self) -> bool:
        """True when the configured chat primary adapter has credentials."""
        try:
            names = self._order_for_capability("chat")
        except ValueError:
            return False
        return self._adapters[names[0]].has_credentials()

    def stt_model(self) -> str:
        return settings.MODEL_STT_NAME or settings.GROQ_STT_MODEL

    def transcribe_audio(self, audio_bytes: bytes, filename: str) -> str:
        """Speech-to-text via the configured MODEL_STT_PROVIDER adapter."""
        provider = (settings.MODEL_STT_PROVIDER or "groq").lower()
        adapter = self._adapters.get(provider)
        if adapter is None or not hasattr(adapter, "transcribe"):
            raise ValueError(f"Unknown STT provider: {settings.MODEL_STT_PROVIDER}")
        return adapter.transcribe(
            audio_bytes=audio_bytes, filename=filename, model=self.stt_model()
        )

    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------

    def clean_json_text(self, text: str) -> str:
        """Strip markdown fences and extract raw JSON content."""
        if not text:
            return ""
        text = text.strip()
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return text

    # -------------------------------------------------------------------------
    # Primary completion routing
    # -------------------------------------------------------------------------

    def _resolve_order(
        self, provider: Optional[str], capability: str
    ) -> Tuple[List[str], str]:
        """Return (single adapter name to try, capability slot for model resolution)."""
        if provider is None:
            cap = capability if capability in ("chat", "explanation") else "chat"
            return self._order_for_capability(cap), cap
        key = str(provider).lower()
        if key in self._adapters:
            # Explicitly named providers try once and raise.
            cap = capability if capability in ("chat", "explanation") else "chat"
            return [key], cap
        if key in ("chat", "explanation"):
            return self._order_for_capability(key), key
        if key == "auto":
            return self._order_for_capability("chat"), "chat"
        logger.error(f"LLMRouter: Unknown provider '{provider}' requested.")
        raise ValueError(f"Unknown provider: {provider}")

    def _limiter_for(self, adapter_name: str):
        return opencode_limiter

    def generate_chat_completion(
        self,
        messages: List[Dict[str, str]],
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        response_format: Optional[Dict[str, Any]] = None,
        timeout: int = 60,
        capability: str = "chat",
    ) -> Dict[str, Any]:
        """
        Generate chat completion via the single configured adapter.

        Callers pass ``capability="chat"`` (or ``"explanation"``) and no
        provider/model; named providers try once. Exactly one adapter attempt
        is made; any failure raises. Missing credentials raise a clear
        configuration error at call time (no silent mock responses).

        Returns:
            Dict with keys: content, model, _latency, _provenance
        """
        names, slot_cap = self._resolve_order(provider, capability)
        pname = names[0]
        adapter = self._adapters[pname]
        model = model_name or self.model_for(pname, slot_cap)
        _consume_call_budget()
        logger.info(f"LLMRouter: Sending request to {pname} (model={model})")
        limiter = self._limiter_for(pname)
        if not limiter.allow_call():
            logger.warning(f"LLMRouter: {pname} circuit breaker is OPEN.")
            raise RuntimeError(f"{pname} circuit breaker is OPEN.")
        limiter.acquire_sync()
        start_time = time.monotonic()
        try:
            content = adapter.chat(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                timeout=timeout,
            )
        except AdapterClientError as e:
            # Client errors - do NOT trip the breaker.
            logger.warning(f"LLMRouter: {pname} client error: {e}.")
            raise
        except Exception as e:
            logger.warning(f"LLMRouter: {pname} call failed: {e}.")
            limiter.report_failure()
            raise
        latency = time.monotonic() - start_time
        limiter.report_success()
        provenance: Dict[str, Any] = {
            "provider": pname,
            "model": model,
            "fallback": False,
            "mock": False,
        }
        return {
            "content": content,
            "model": model,
            "_latency": latency,
            "_provenance": provenance,
        }

    # -------------------------------------------------------------------------
    # Streaming completions
    # -------------------------------------------------------------------------

    def generate_chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: float = 0.5,
        max_tokens: int = 1024,
        timeout: int = 60,
        capability: str = "chat",
    ):
        """
        Stream chat completion via the single configured adapter.

        Callers pass ``capability="chat"`` and no provider/model; named
        providers try once. Any failure raises. Missing credentials raise a
        clear configuration error at call time (no silent mock responses).
        Yields str content chunks.
        """
        names, slot_cap = self._resolve_order(provider, capability)
        pname = names[0]
        adapter = self._adapters[pname]
        model = model_name or self.model_for(pname, slot_cap)
        _consume_call_budget()
        logger.info(f"LLMRouter: Starting stream from {pname} (model={model})")
        limiter = self._limiter_for(pname)
        if not limiter.allow_call():
            logger.warning(f"LLMRouter: {pname} circuit breaker is OPEN.")
            raise RuntimeError(f"{pname} circuit breaker is OPEN.")
        limiter.acquire_sync()
        try:
            for chunk in adapter.stream(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=timeout,
            ):
                if chunk:
                    yield chunk
            limiter.report_success()
            return
        except AdapterClientError as e:
            logger.warning(f"LLMRouter: {pname} stream client error: {e}.")
            raise
        except Exception as e:
            logger.warning(f"LLMRouter: {pname} stream failed: {e}.")
            limiter.report_failure()
            raise


# Singleton instance
llm_router = LLMRouter()
