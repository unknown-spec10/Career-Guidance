"""OpenCode (DeepSeek) connectivity smoke test — live key only, excluded from CI.

Skips when OPENCODE_API_KEY is unset. Never runs in CI (see pytest ignore).
"""
import os

import pytest
import requests


def test_opencode_api_connectivity():
    api_key = os.environ.get("OPENCODE_API_KEY", "")
    if not api_key:
        pytest.skip("OPENCODE_API_KEY is not set")

    base_url = os.environ.get("OPENCODE_API_BASE_URL", "https://opencode.ai/zen/v1").rstrip("/")
    model = os.environ.get("OPENCODE_CHAT_MODEL", "deepseek-v4.1-flash")
    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [{"role": "user", "content": "Explain how AI works in a few words"}],
                "max_tokens": 64,
            },
            timeout=30,
        )
    except Exception as e:
        pytest.skip(f"OpenCode API unreachable: {e}")
    if resp.status_code in (401, 403):
        pytest.skip(f"OpenCode API key rejected (status {resp.status_code})")
    if resp.status_code == 429:
        pytest.skip(f"OpenCode API quota exhausted: {resp.text[:200]}")
    assert resp.status_code == 200, resp.text[:500]
    assert resp.json()["choices"][0]["message"]["content"] is not None
