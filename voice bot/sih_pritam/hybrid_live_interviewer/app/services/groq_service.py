# app/services/groq_service.py
import asyncio
import json
import logging
import re
from typing import Any, Dict, Optional

import httpx

from app.interfaces.illm_service import ILLMService
from app.config import settings

logger = logging.getLogger("hybrid_interviewer.groq")

class GroqServiceError(Exception):
    pass

class GroqResponseParseError(GroqServiceError):
    pass

JSON_SUBSTRING_RE = re.compile(r"(\{(?:[^{}]|(?R))*\}|\[(?:[^\[\]]|(?R))*\])", re.DOTALL)

class GroqService(ILLMService):
    def __init__(
        self,
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_factor: float = 0.5,
    ):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.api_url = api_url or settings.GROQ_API_URL
        self.model = model or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor

        if not self.api_url or not self.api_key:
            raise GroqServiceError("GROQ_API_URL and GROQ_API_KEY must be set in settings or constructor")

        self._default_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream, text/plain",
        }

    async def generate_question(self, context: Dict[str, Any], *, stream: bool = False, **kwargs) -> Dict[str, Any]:
        prompt = self._build_prompt(context)
        payload = {
            "model": self.model,
            "input": prompt,
            "max_output_tokens": kwargs.get("max_output_tokens", 128),
            "temperature": kwargs.get("temperature", 0.0),
        }
        payload.update({k: v for k, v in kwargs.items() if k not in payload})

        logger.debug("GroqService.generate_question payload prepared (model=%s)", self.model)

        attempt = 0
        last_exc: Optional[Exception] = None
        while attempt <= self.max_retries:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    url = self.api_url.rstrip("/") + "/complete"
                    logger.debug("POST %s", url)
                    if stream:
                        async with client.stream("POST", url, json=payload, headers=self._default_headers) as resp:
                            resp.raise_for_status()
                            content_type = resp.headers.get("content-type", "")
                            logger.debug("Groq stream content-type=%s", content_type)
                            accumulated = ""
                            async for chunk in resp.aiter_text():
                                accumulated += chunk
                                if "{" in chunk or "[" in chunk:
                                    maybe = self._extract_json_from_text(accumulated)
                                    if maybe:
                                        return maybe
                            full = accumulated.strip()
                            if full:
                                parsed = await self._parse_model_output(full)
                                return parsed
                            raise GroqResponseParseError("Streaming response contained no parseable output")
                    else:
                        resp = await client.post(url, json=payload, headers=self._default_headers)
                        resp.raise_for_status()
                        try:
                            j = resp.json()
                        except Exception:
                            text_body = await resp.aread()
                            text_text = text_body.decode("utf-8") if isinstance(text_body, (bytes, bytearray)) else str(text_body)
                            parsed = await self._parse_model_output(text_text, http_json=None)
                            return parsed
                        parsed = await self._parse_model_output(None, http_json=j)
                        return parsed
            except httpx.HTTPStatusError as e:
                status = e.response.status_code if e.response is not None else None
                logger.warning("Groq HTTP error (status=%s) attempt=%d: %s", status, attempt, str(e))
                last_exc = e
                if status and 400 <= status < 500 and status != 429:
                    raise GroqServiceError(f"Groq API returned status {status}: {e}") from e
            except (httpx.RequestError, asyncio.TimeoutError) as e:
                logger.warning("Groq request error attempt=%d: %s", attempt, str(e))
                last_exc = e
            except Exception as e:
                logger.exception("Unexpected Groq error on attempt %d", attempt)
                last_exc = e

            attempt += 1
            wait = self.backoff_factor * (2 ** (attempt - 1))
            logger.debug("Retrying Groq request in %.2fs (attempt %d/%d)", wait, attempt, self.max_retries)
            await asyncio.sleep(wait)

        raise GroqServiceError(f"Groq request failed after {self.max_retries} retries") from last_exc

    def _build_prompt(self, context: Dict[str, Any]) -> str:
        try:
            from app.utils.prompts import build_llm_prompt
            return build_llm_prompt(context)
        except Exception:
            last = context.get("last_answer", "")
            memory = context.get("memory", [])[-6:]
            mode = context.get("mode", "resume")
            return f"SYSTEM: You are an interviewer. MODE:{mode}\nMEMORY:{json.dumps(memory)}\nLAST_ANSWER:{last}\nReturn JSON: {{\"text\":\"...\",\"type\":\"followup|new\",\"topic\":\"...\"}}"

    async def _parse_model_output(self, text: Optional[str], http_json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if http_json:
            if isinstance(http_json, dict):
                choices = http_json.get("choices")
                if choices and isinstance(choices, list) and len(choices) > 0:
                    candidate = choices[0].get("text") or choices[0].get("output") or choices[0].get("message") or None
                    if candidate:
                        return await self._try_parse_text_candidate(candidate)
                if "output" in http_json:
                    out = http_json["output"]
                    if isinstance(out, list):
                        combined = " ".join(map(str, out))
                        return await self._try_parse_text_candidate(combined)
                    else:
                        return await self._try_parse_text_candidate(str(out))
                if "result" in http_json:
                    return await self._try_parse_text_candidate(str(http_json["result"]))
                dumped = json.dumps(http_json)
                maybe = self._extract_json_from_text(dumped)
                if maybe:
                    return maybe
        if text:
            return await self._try_parse_text_candidate(text)
        raise GroqResponseParseError("No usable output in Groq response")

    async def _try_parse_text_candidate(self, candidate: Any) -> Dict[str, Any]:
        if candidate is None:
            raise GroqResponseParseError("Empty candidate")
        if isinstance(candidate, dict):
            return candidate
        s = str(candidate).strip()
        try:
            parsed = json.loads(s)
            if isinstance(parsed, (dict, list)):
                if isinstance(parsed, list):
                    return {"text": " ".join(map(str, parsed))}
                return parsed if isinstance(parsed, dict) else {"text": str(parsed)}
        except Exception:
            pass
        maybe = self._extract_json_from_text(s)
        if maybe:
            return maybe
        return {"text": s}

    def _extract_json_from_text(self, s: str) -> Optional[Dict[str, Any]]:
        try:
            for match in JSON_SUBSTRING_RE.finditer(s):
                candidate = match.group(0)
                try:
                    parsed = json.loads(candidate)
                    return parsed if isinstance(parsed, dict) else {"text": json.dumps(parsed)}
                except Exception:
                    continue
        except Exception:
            return None
        return None
