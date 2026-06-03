import json
import logging
import re
import time
import threading
from typing import Any, Dict, List, Optional

import requests
from groq import Groq, RateLimitError as GroqRateLimitError

from ..config import settings
from .rate_limiter import gemini_limiter, groq_limiter

logger = logging.getLogger(__name__)


def _parse_reset_duration(reset_str: str) -> float:
    """
    Parse a Groq reset-time string like '14h22m5s' or '2.45s' into seconds (float).
    Falls back to 0.0 if unparseable.
    """
    if not reset_str:
        return 0.0
    total = 0.0
    pattern = re.compile(r"([\d.]+)([hms])")
    for value, unit in pattern.findall(reset_str):
        v = float(value)
        if unit == "h":
            total += v * 3600
        elif unit == "m":
            total += v * 60
        elif unit == "s":
            total += v
    return total


def _default_provider_stats() -> Dict[str, Any]:
    """Return a clean provider telemetry block."""
    return {
        # Request counters
        "requests": 0,
        "successes": 0,
        "fallbacks": 0,
        "errors": 0,
        "total_latency": 0.0,
        # Cumulative token usage (all providers)
        "tokens_prompt": 0,
        "tokens_completion": 0,
        "tokens_total": 0,
        # Rate-limit live state (Groq primary; NIM optional; Gemini only on 429)
        "rate_limit_requests_limit": None,      # Total daily request cap (int or None)
        "rate_limit_requests_remaining": None,  # Remaining daily requests (int or None)
        "rate_limit_tokens_limit": None,        # Total per-minute token cap (int or None)
        "rate_limit_tokens_remaining": None,    # Remaining per-minute tokens (int or None)
        "rate_limit_reset_requests": None,      # Human string e.g. '14h22m5s' (Groq)
        "rate_limit_reset_tokens": None,        # Human string e.g. '2.45s' (Groq)
        # 429 cooldown — epoch timestamp when the cooldown expires (float or None)
        "retry_after_reset_time": None,
    }


class LLMRouter:
    """
    Centralized, thread-safe LLM Router for routing chat completions to primary providers
    (Groq, Gemini) and falling back to Nvidia NIM (DeepSeek, Kimi) upon failure or quota exhaustion.

    Maintains live rate-limit telemetry from response headers and token-usage counters so the
    admin dashboard can display accurate remaining quota and backoff countdowns.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self.stats: Dict[str, Any] = {
            "total_requests": 0,
            "successful_requests": 0,
            "fallback_requests": 0,
            "failed_requests": 0,
            "provider_stats": {
                "groq": _default_provider_stats(),
                "gemini": _default_provider_stats(),
                "openrouter": _default_provider_stats(),
            },
        }

    # -------------------------------------------------------------------------
    # Public API
    # -------------------------------------------------------------------------

    def get_stats(self) -> Dict[str, Any]:
        """
        Return a serialisable snapshot of routing statistics.

        Enriches each provider block with:
        - avg_latency         – rolling average in seconds
        - is_configured       – True when the API key env-var is set and non-empty
        - retry_after_remaining – seconds left in the current 429 cooldown (0 if none)
        """
        with self._lock:
            stats_copy = json.loads(json.dumps(self.stats, default=str))

        now = time.time()
        provider_keys = {
            "groq": bool(settings.GROQ_API_KEY),
            "gemini": bool(settings.GEMINI_API_KEY),
            "openrouter": bool(settings.OPENROUTER_API_KEY),
        }
        provider_models = {
            "groq": settings.GROQ_CHAT_MODEL,
            "gemini": settings.GEMINI_SMALL_MODEL,
            "openrouter": settings.OPENROUTER_MODEL,
        }

        for prov, p_stats in stats_copy["provider_stats"].items():
            reqs = p_stats["requests"]
            p_stats["avg_latency"] = round(p_stats["total_latency"] / reqs, 3) if reqs > 0 else 0.0
            p_stats["is_configured"] = provider_keys.get(prov, False)
            p_stats["model"] = provider_models.get(prov, "")

            # Compute remaining cooldown seconds
            reset_epoch = p_stats.get("retry_after_reset_time")
            if reset_epoch is not None:
                remaining = max(0.0, float(reset_epoch) - now)
                p_stats["retry_after_remaining"] = round(remaining, 1)
                # Clear once expired
                if remaining == 0.0:
                    p_stats["retry_after_reset_time"] = None
            else:
                p_stats["retry_after_remaining"] = 0.0

        return stats_copy

    def reset_stats(self) -> None:
        """Reset all counters and rate-limit state to zero / None."""
        with self._lock:
            self.stats["total_requests"] = 0
            self.stats["successful_requests"] = 0
            self.stats["fallback_requests"] = 0
            self.stats["failed_requests"] = 0
            for prov in self.stats["provider_stats"]:
                self.stats["provider_stats"][prov] = _default_provider_stats()

    # -------------------------------------------------------------------------
    # Internal counters
    # -------------------------------------------------------------------------

    def _increment_request(self, provider: str) -> None:
        with self._lock:
            self.stats["total_requests"] += 1
            if provider in self.stats["provider_stats"]:
                self.stats["provider_stats"][provider]["requests"] += 1

    def _increment_success(self, provider: str, latency: float) -> None:
        with self._lock:
            self.stats["successful_requests"] += 1
            if provider in self.stats["provider_stats"]:
                self.stats["provider_stats"][provider]["successes"] += 1
                self.stats["provider_stats"][provider]["total_latency"] += latency

    def _increment_fallback(self, provider: str) -> None:
        with self._lock:
            self.stats["fallback_requests"] += 1
            if provider in self.stats["provider_stats"]:
                self.stats["provider_stats"][provider]["fallbacks"] += 1

    def _increment_error(self, provider: str) -> None:
        with self._lock:
            self.stats["failed_requests"] += 1
            if provider in self.stats["provider_stats"]:
                self.stats["provider_stats"][provider]["errors"] += 1

    def _update_token_counts(self, provider: str, prompt: int, completion: int, total: int) -> None:
        with self._lock:
            p = self.stats["provider_stats"].get(provider)
            if p:
                p["tokens_prompt"] += prompt
                p["tokens_completion"] += completion
                p["tokens_total"] += total

    def _update_groq_rate_limits(self, headers: Any) -> None:
        """Parse Groq HTTP response headers and store live rate-limit state."""
        def _hdr(name: str) -> Optional[str]:
            # httpx headers are case-insensitive; fall back gracefully
            try:
                return headers.get(name)
            except Exception:
                return None

        with self._lock:
            g = self.stats["provider_stats"]["groq"]
            rl_req = _hdr("x-ratelimit-limit-requests")
            rem_req = _hdr("x-ratelimit-remaining-requests")
            rl_tok = _hdr("x-ratelimit-limit-tokens")
            rem_tok = _hdr("x-ratelimit-remaining-tokens")
            reset_req = _hdr("x-ratelimit-reset-requests")
            reset_tok = _hdr("x-ratelimit-reset-tokens")

            if rl_req is not None:
                try:
                    g["rate_limit_requests_limit"] = int(rl_req)
                except ValueError:
                    pass
            if rem_req is not None:
                try:
                    g["rate_limit_requests_remaining"] = int(rem_req)
                except ValueError:
                    pass
            if rl_tok is not None:
                try:
                    g["rate_limit_tokens_limit"] = int(rl_tok)
                except ValueError:
                    pass
            if rem_tok is not None:
                try:
                    g["rate_limit_tokens_remaining"] = int(rem_tok)
                except ValueError:
                    pass
            if reset_req is not None:
                g["rate_limit_reset_requests"] = reset_req
            if reset_tok is not None:
                g["rate_limit_reset_tokens"] = reset_tok

    def _set_cooldown(self, provider: str, retry_after_seconds: float) -> None:
        """Record a 429 cooldown expiry timestamp for the given provider."""
        with self._lock:
            p = self.stats["provider_stats"].get(provider)
            if p:
                p["retry_after_reset_time"] = time.time() + retry_after_seconds

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

    def generate_chat_completion(
        self,
        messages: List[Dict[str, str]],
        provider: str,
        model_name: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        response_format: Optional[Dict[str, Any]] = None,
        timeout: int = 60,
    ) -> Dict[str, Any]:
        """
        Generate chat completion with automatic fallback to Nvidia NIM.

        Args:
            messages: List of chat messages [{\"role\": ..., \"content\": ...}]
            provider: Primary provider – \"groq\" or \"gemini\"
            model_name: Override default model
            temperature: Sampling temperature
            max_tokens: Max output tokens
            response_format: Optional {\"type\": \"json_object\"}
            timeout: HTTP timeout in seconds

        Returns:
            Dict with keys: content, model, _latency, _provenance
        """
        provider = provider.lower()
        if provider == "gemini" and not settings.GEMINI_MOCK_MODE:
            gemini_limiter.acquire_sync()
        elif provider == "groq":
            groq_limiter.acquire_sync()

        self._increment_request(provider)
        start_time = time.monotonic()

        if provider == "groq":
            return self._call_groq(
                messages=messages,
                model_name=model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                timeout=timeout,
                start_time=start_time,
            )

        if provider == "gemini":
            return self._call_gemini(
                messages=messages,
                model_name=model_name,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                timeout=timeout,
                start_time=start_time,
            )

        logger.error(f"LLMRouter: Unknown provider '{provider}' requested.")
        self._increment_error(provider)
        raise ValueError(f"Unknown provider: {provider}")

    # -------------------------------------------------------------------------
    # Groq provider
    # -------------------------------------------------------------------------

    def _call_groq(
        self,
        messages: List[Dict[str, str]],
        model_name: Optional[str],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, Any]],
        timeout: int,
        start_time: float,
    ) -> Dict[str, Any]:
        """Call Groq using with_raw_response to capture rate-limit headers."""
        actual_model = model_name or settings.GROQ_CHAT_MODEL
        logger.info(f"LLMRouter: Sending primary request to Groq (model={actual_model})")

        if not settings.GROQ_API_KEY:
            raise ValueError("Groq API key is not configured.")

        try:
            client = Groq(api_key=settings.GROQ_API_KEY)

            kwargs: Dict[str, Any] = {
                "model": actual_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "timeout": timeout,
            }
            if response_format:
                kwargs["response_format"] = response_format

            # Use with_raw_response to access HTTP response headers
            raw_resp = client.with_raw_response.chat.completions.create(**kwargs)
            latency = time.monotonic() - start_time

            # Extract and persist rate-limit headers
            self._update_groq_rate_limits(raw_resp.headers)

            # Parse structured completion object
            resp = raw_resp.parse()
            content = resp.choices[0].message.content

            # Capture token usage
            if resp.usage:
                self._update_token_counts(
                    "groq",
                    prompt=resp.usage.prompt_tokens or 0,
                    completion=resp.usage.completion_tokens or 0,
                    total=resp.usage.total_tokens or 0,
                )

            self._increment_success("groq", latency)

            return {
                "content": content,
                "model": actual_model,
                "_latency": latency,
                "_provenance": {
                    "provider": "groq",
                    "model": actual_model,
                    "fallback": False,
                    "mock": False,
                },
            }

        except GroqRateLimitError as e:
            logger.warning(
                f"LLMRouter: Groq rate-limit hit (429). Falling back to OpenRouter. Error: {e}"
            )
            # Extract retry-after from the exception headers
            try:
                retry_after = float(e.response.headers.get("retry-after", 60))
            except Exception:
                retry_after = 60.0
            self._set_cooldown("groq", retry_after)
            self._increment_fallback("groq")

            return self._call_openrouter_fallback(
                messages=messages,
                model_override=settings.OPENROUTER_MODEL,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                timeout=timeout,
                fallback_source="groq",
            )

        except Exception as e:
            logger.warning(
                f"LLMRouter: Primary Groq API call failed: {e}. Falling back to OpenRouter."
            )
            self._increment_fallback("groq")

            return self._call_openrouter_fallback(
                messages=messages,
                model_override=settings.OPENROUTER_MODEL,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                timeout=timeout,
                fallback_source="groq",
            )

    # -------------------------------------------------------------------------
    # Gemini provider
    # -------------------------------------------------------------------------

    def _call_gemini(
        self,
        messages: List[Dict[str, str]],
        model_name: Optional[str],
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, Any]],
        timeout: int,
        start_time: float,
    ) -> Dict[str, Any]:
        """Call Gemini REST API and capture usageMetadata for token tracking."""
        actual_model = model_name or settings.GEMINI_SMALL_MODEL
        logger.info(f"LLMRouter: Sending primary request to Gemini (model={actual_model})")

        # Mock mode shortcut
        if settings.GEMINI_MOCK_MODE:
            latency = time.monotonic() - start_time
            self._increment_success("gemini", latency)
            return {
                "content": self._get_mock_completion(messages),
                "model": actual_model,
                "_latency": latency,
                "_provenance": {
                    "provider": "gemini",
                    "model": actual_model,
                    "fallback": False,
                    "mock": True,
                },
            }

        if not settings.GEMINI_API_KEY:
            raise ValueError("Gemini API key is not configured.")

        # Build Gemini request payload
        contents = []
        system_instruction = None
        for msg in messages:
            role = msg.get("role")
            content_text = msg.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content_text}]}
            else:
                gemini_role = "model" if role in ("assistant", "model") else "user"
                contents.append({"role": gemini_role, "parts": [{"text": content_text}]})

        url = (
            f"{settings.GEMINI_API_URL}/models/{actual_model}"
            f":generateContent?key={settings.GEMINI_API_KEY}"
        )
        headers = {"Content-Type": "application/json"}
        body: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_instruction:
            body["systemInstruction"] = system_instruction
        if response_format and response_format.get("type") == "json_object":
            body["generationConfig"]["responseMimeType"] = "application/json"

        try:
            r = requests.post(url, headers=headers, json=body, timeout=timeout)
            latency = time.monotonic() - start_time

            if r.status_code == 429:
                retry_after = float(r.headers.get("Retry-After", 60))
                self._set_cooldown("gemini", retry_after)
                raise RuntimeError(
                    f"Gemini API quota exhausted (429). Retry after {retry_after}s."
                )

            if r.status_code != 200:
                raise RuntimeError(f"Gemini API status {r.status_code}: {r.text}")

            result = r.json()

            # Capture token usage from usageMetadata
            usage_meta = result.get("usageMetadata", {})
            if usage_meta:
                self._update_token_counts(
                    "gemini",
                    prompt=usage_meta.get("promptTokenCount", 0),
                    completion=usage_meta.get("candidatesTokenCount", 0),
                    total=usage_meta.get("totalTokenCount", 0),
                )

            candidates = result.get("candidates", [])
            if candidates:
                candidate = candidates[0]
                parts = candidate.get("content", {}).get("parts", [])
                if parts:
                    generated_text = parts[0].get("text", "")
                    self._increment_success("gemini", latency)
                    return {
                        "content": generated_text,
                        "model": actual_model,
                        "_latency": latency,
                        "_provenance": {
                            "provider": "gemini",
                            "model": actual_model,
                            "fallback": False,
                            "mock": False,
                        },
                    }

            raise RuntimeError("Empty response candidates returned from Gemini.")

        except Exception as e:
            logger.warning(
                f"LLMRouter: Primary Gemini API call failed: {e}. Falling back to OpenRouter."
            )
            self._increment_fallback("gemini")

            return self._call_openrouter_fallback(
                messages=messages,
                model_override=settings.OPENROUTER_MODEL,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                timeout=timeout,
                fallback_source="gemini",
            )

    # -------------------------------------------------------------------------
    # Nvidia NIM fallback
    # -------------------------------------------------------------------------

    def _call_openrouter_fallback(
        self,
        messages: List[Dict[str, str]],
        model_override: str,
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, Any]],
        timeout: int,
        fallback_source: str,
    ) -> Dict[str, Any]:
        """Perform fallback completions call using OpenRouter API."""
        start_time = time.monotonic()

        with self._lock:
            self.stats["provider_stats"]["openrouter"]["requests"] += 1

        if not settings.OPENROUTER_API_KEY:
            logger.error("LLMRouter: OPENROUTER_API_KEY is not set. Fallback cannot execute.")
            self._increment_error("openrouter")
            raise ValueError("Fallback triggered but OPENROUTER_API_KEY is missing.")

        url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
        req_headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/unknown-spec10/Career-Guidance",
            "X-Title": "Career Guidance AI",
        }
        body: Dict[str, Any] = {
            "model": model_override,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            body["response_format"] = response_format

        try:
            logger.info(f"LLMRouter: Invoking OpenRouter fallback (model={model_override})")
            r = requests.post(url, headers=req_headers, json=body, timeout=timeout)

            # If JSON mode is rejected, retry without it
            if r.status_code == 400 and response_format:
                logger.warning(
                    "LLMRouter: OpenRouter returned 400 with response_format. Retrying without it."
                )
                body.pop("response_format")
                r = requests.post(url, headers=req_headers, json=body, timeout=timeout)

            if r.status_code == 429:
                retry_after = float(r.headers.get("Retry-After", r.headers.get("retry-after", 60)))
                self._set_cooldown("openrouter", retry_after)
                raise RuntimeError(
                    f"OpenRouter quota exhausted (429). Retry after {retry_after}s."
                )

            if r.status_code != 200:
                raise RuntimeError(f"OpenRouter API status {r.status_code}: {r.text}")

            resp_data = r.json()
            content = resp_data["choices"][0]["message"]["content"]

            # Capture token usage
            usage = resp_data.get("usage", {})
            if usage:
                self._update_token_counts(
                    "openrouter",
                    prompt=usage.get("prompt_tokens", 0),
                    completion=usage.get("completion_tokens", 0),
                    total=usage.get("total_tokens", 0),
                )

            # Capture any rate-limit headers OpenRouter may return
            or_rem_req = r.headers.get("x-ratelimit-remaining-requests")
            or_lim_req = r.headers.get("x-ratelimit-limit-requests")
            or_rem_tok = r.headers.get("x-ratelimit-remaining-tokens")
            or_lim_tok = r.headers.get("x-ratelimit-limit-tokens")
            with self._lock:
                n = self.stats["provider_stats"]["openrouter"]
                if or_lim_req:
                    try:
                        n["rate_limit_requests_limit"] = int(or_lim_req)
                    except ValueError:
                        pass
                if or_rem_req:
                    try:
                        n["rate_limit_requests_remaining"] = int(or_rem_req)
                    except ValueError:
                        pass
                if or_lim_tok:
                    try:
                        n["rate_limit_tokens_limit"] = int(or_lim_tok)
                    except ValueError:
                        pass
                if or_rem_tok:
                    try:
                        n["rate_limit_tokens_remaining"] = int(or_rem_tok)
                    except ValueError:
                        pass

            # Post-process: auto-sanitize JSON if needed
            if response_format and response_format.get("type") == "json_object":
                cleaned = self.clean_json_text(content)
                try:
                    json.loads(cleaned)
                    content = cleaned
                except json.JSONDecodeError:
                    logger.warning(
                        "LLMRouter: OpenRouter output was not valid JSON even after sanitization."
                    )

            latency = time.monotonic() - start_time

            with self._lock:
                n = self.stats["provider_stats"]["openrouter"]
                n["successes"] += 1
                n["total_latency"] += latency

            self.stats["successful_requests"] += 1

            return {
                "content": content,
                "model": model_override,
                "_latency": latency,
                "_provenance": {
                    "provider": "openrouter",
                    "model": model_override,
                    "fallback": True,
                    "fallback_source": fallback_source,
                    "mock": False,
                },
            }

        except Exception as e:
            logger.error(f"LLMRouter: OpenRouter fallback failed: {e}")
            with self._lock:
                self.stats["provider_stats"]["openrouter"]["errors"] += 1
                self.stats["failed_requests"] += 1
            raise

    # -------------------------------------------------------------------------
    # Streaming completions (with fallback)
    # -------------------------------------------------------------------------

    def generate_chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        provider: str,
        model_name: Optional[str] = None,
        temperature: float = 0.5,
        max_tokens: int = 1024,
        timeout: int = 60,
    ):
        """
        Stream chat completion with automatic fallback to Nvidia NIM.
        Yields str content chunks.
        """
        provider = provider.lower()
        if provider == "gemini" and not settings.GEMINI_MOCK_MODE:
            gemini_limiter.acquire_sync()
        elif provider == "groq":
            groq_limiter.acquire_sync()

        self._increment_request(provider)

        if provider == "groq":
            try:
                actual_model = model_name or settings.GROQ_CHAT_MODEL
                logger.info(f"LLMRouter: Starting primary stream from Groq (model={actual_model})")

                if not settings.GROQ_API_KEY:
                    raise ValueError("Groq API key is not configured.")

                client = Groq(api_key=settings.GROQ_API_KEY)
                stream = client.chat.completions.create(
                    model=actual_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                    timeout=timeout,
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta.content
                    if delta:
                        yield delta

                self._increment_success("groq", 0.0)
                return

            except GroqRateLimitError as e:
                try:
                    retry_after = float(e.response.headers.get("retry-after", 60))
                except Exception:
                    retry_after = 60.0
                self._set_cooldown("groq", retry_after)
                logger.warning(
                    f"LLMRouter: Groq stream rate-limited (429). Falling back to OpenRouter. retry_after={retry_after}s"
                )
                self._increment_fallback("groq")
                yield from self._stream_openrouter_fallback(
                    messages=messages,
                    model_override=settings.OPENROUTER_MODEL,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    fallback_source="groq",
                )

            except Exception as e:
                logger.warning(
                    f"LLMRouter: Primary Groq stream failed: {e}. Falling back to OpenRouter."
                )
                self._increment_fallback("groq")
                yield from self._stream_openrouter_fallback(
                    messages=messages,
                    model_override=settings.OPENROUTER_MODEL,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    fallback_source="groq",
                )

        elif provider == "gemini":
            try:
                actual_model = model_name or settings.GEMINI_SMALL_MODEL
                logger.info(f"LLMRouter: Starting primary stream from Gemini (model={actual_model})")

                if settings.GEMINI_MOCK_MODE:
                    mock_content = self._get_mock_completion(messages)
                    for word in mock_content.split(" "):
                        yield word + " "
                        time.sleep(0.05)
                    self._increment_success("gemini", 0.0)
                    return

                # Delegate to the non-streaming path and simulate streaming
                res = self.generate_chat_completion(
                    messages=messages,
                    provider="gemini",
                    model_name=actual_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                )
                for word in res["content"].split(" "):
                    yield word + " "
                    time.sleep(0.02)
                return

            except Exception as e:
                logger.warning(
                    f"LLMRouter: Primary Gemini stream failed: {e}. Falling back to OpenRouter."
                )
                self._increment_fallback("gemini")
                yield from self._stream_openrouter_fallback(
                    messages=messages,
                    model_override=settings.OPENROUTER_MODEL,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    fallback_source="gemini",
                )

    def _stream_openrouter_fallback(
        self,
        messages: List[Dict[str, str]],
        model_override: str,
        temperature: float,
        max_tokens: int,
        timeout: int,
        fallback_source: str,
    ):
        """Stream completion from OpenRouter via SSE."""
        with self._lock:
            self.stats["provider_stats"]["openrouter"]["requests"] += 1

        if not settings.OPENROUTER_API_KEY:
            logger.error("LLMRouter: OPENROUTER_API_KEY is not set. Fallback stream cannot execute.")
            self._increment_error("openrouter")
            raise ValueError("Fallback stream triggered but OPENROUTER_API_KEY is missing.")

        url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
        req_headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/unknown-spec10/Career-Guidance",
            "X-Title": "Career Guidance AI",
        }
        body: Dict[str, Any] = {
            "model": model_override,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        try:
            r = requests.post(url, headers=req_headers, json=body, timeout=timeout, stream=True)

            if r.status_code == 429:
                retry_after = float(r.headers.get("Retry-After", r.headers.get("retry-after", 60)))
                self._set_cooldown("openrouter", retry_after)
                raise RuntimeError(
                    f"OpenRouter stream quota exhausted (429). Retry after {retry_after}s."
                )

            if r.status_code != 200:
                raise RuntimeError(f"OpenRouter fallback stream status {r.status_code}: {r.text}")

            for line in r.iter_lines():
                if line:
                    decoded = line.decode("utf-8").strip()
                    if decoded.startswith("data: "):
                        data_str = decoded[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk_json = json.loads(data_str)
                            delta = chunk_json["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except Exception:
                            pass

            with self._lock:
                self.stats["provider_stats"]["openrouter"]["successes"] += 1
                self.stats["successful_requests"] += 1

        except Exception as e:
            logger.error(f"LLMRouter: OpenRouter fallback stream failed: {e}")
            with self._lock:
                self.stats["provider_stats"]["openrouter"]["errors"] += 1
                self.stats["failed_requests"] += 1
            raise

    # -------------------------------------------------------------------------
    # Mock helpers
    # -------------------------------------------------------------------------

    def _get_mock_completion(self, messages: List[Dict[str, str]]) -> str:
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
        return "Mock response from LLMRouter (Gemini Mock Mode active)."


# Singleton instance
llm_router = LLMRouter()
