"""Model-agnostic swap proof.

Changing ONLY env-level model selection (MODEL_* settings) must change which
provider/model the router calls, with zero code changes. These tests pin that.
"""
from unittest.mock import MagicMock, patch

import pytest

from resume_pipeline.config import settings
from resume_pipeline.core import rate_limiter
from resume_pipeline.core.llm_router import llm_router


class MockChoice:
    def __init__(self, content):
        self.message = MagicMock()
        self.message.content = content


class MockCompletion:
    def __init__(self, content):
        self.choices = [MockChoice(content)]


class MockOpenAIResponse:
    def __init__(self, status_code, json_data=None, text=""):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text

    def json(self):
        return self._json_data


@pytest.fixture(autouse=True)
def run_around_tests(monkeypatch):
    for limiter in (rate_limiter.groq_limiter, rate_limiter.opencode_limiter):
        limiter.state = rate_limiter.STATE_CLOSED
        limiter.last_state_change = 0.0
        limiter.trial_in_progress = False
        limiter.trial_start_time = 0.0
        limiter._last_call_time = 0.0
    monkeypatch.setattr(settings, "OPENCODE_API_KEY", "oc_test_key")
    # Pin chat slots to the defaults; each test then swaps via
    # monkeypatch (env-level selection only).
    monkeypatch.setattr(settings, "MODEL_CHAT_PRIMARY_PROVIDER", "opencode")
    monkeypatch.setattr(settings, "MODEL_CHAT_PRIMARY_NAME", "")
    yield


def _opencode_ok(content="swapped opencode response"):
    return MockOpenAIResponse(
        status_code=200,
        json_data={"choices": [{"message": {"content": content}}]},
    )


@patch("resume_pipeline.core.llm_router.requests.post")
def test_swap_primary_changes_provider(mock_post, monkeypatch):
    """Default: opencode serves. Swapping the primary slot to groq raises:
    groq is STT-only, so no chat provider resolves (no HTTP, clear error)."""
    mock_post.return_value = _opencode_ok("primary opencode response")

    messages = [{"role": "user", "content": "hello"}]
    res = llm_router.generate_chat_completion(messages, provider=None, capability="chat")
    assert res["_provenance"]["provider"] == "opencode"
    assert res["_provenance"]["fallback"] is False
    assert mock_post.call_count == 1

    # Env-only swap: groq no longer serves chat — a clear error, no HTTP.
    monkeypatch.setattr(settings, "MODEL_CHAT_PRIMARY_PROVIDER", "groq")
    with pytest.raises(ValueError, match="Unknown provider"):
        llm_router.generate_chat_completion(messages, provider=None, capability="chat")
    assert mock_post.call_count == 1  # only the first (opencode) call


@patch("resume_pipeline.core.llm_router.requests.post")
def test_model_name_override_without_code_change(mock_post, monkeypatch):
    """Setting MODEL_CHAT_PRIMARY_NAME changes the model the adapter is called with."""
    monkeypatch.setattr(settings, "MODEL_CHAT_PRIMARY_PROVIDER", "opencode")
    monkeypatch.setattr(settings, "MODEL_CHAT_PRIMARY_NAME", "custom-chat-model")
    mock_post.return_value = _opencode_ok("ok")

    res = llm_router.generate_chat_completion([{"role": "user", "content": "hi"}], provider=None, capability="chat")
    assert mock_post.call_args.kwargs["json"]["model"] == "custom-chat-model"
    assert res["model"] == "custom-chat-model"


@patch("resume_pipeline.core.llm_router.Groq")
def test_stt_model_selection_is_env_only(mock_groq, monkeypatch):
    """The STT model comes from MODEL_STT_NAME (else GROQ_STT_MODEL)."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_test_key")
    assert llm_router.stt_model() == settings.GROQ_STT_MODEL
    monkeypatch.setattr(settings, "MODEL_STT_NAME", "custom-stt-model")
    assert llm_router.stt_model() == "custom-stt-model"

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.return_value = MagicMock(text="hello")
    mock_groq.return_value = mock_client
    assert llm_router.transcribe_audio(b"bytes", "audio.webm") == "hello"
    assert mock_client.audio.transcriptions.create.call_args.kwargs["model"] == "custom-stt-model"


def test_explanation_order_defaults_to_opencode_first(monkeypatch):
    """Explainer order defaults to opencode unless the slots are swapped."""
    monkeypatch.setattr(settings, "MODEL_EXPLAIN_PRIMARY_PROVIDER", "opencode")
    monkeypatch.setattr(settings, "MODEL_EXPLAIN_PRIMARY_NAME", "")
    order = [a.name for a, _ in llm_router.ordered_adapters("explanation")]
    assert order == ["opencode"]
    assert llm_router.model_for("opencode", "explanation") == settings.OPENCODE_CHAT_MODEL
