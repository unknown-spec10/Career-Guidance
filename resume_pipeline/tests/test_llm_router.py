"""LLM router tests — single-provider architecture.

- Chat/explanation resolve to ONE configured primary provider (default
  opencode/DeepSeek). Exactly one adapter attempt per call; any failure
  raises (callers own their recovery: question bank, template, offline).
- Explicitly named providers try ONCE and raise.
- Groq is STT-only: provider="groq" chat raises (no HTTP, no silent mock).
- Missing credentials raise a clear configuration error at call time.
- Hermeticity comes from EXPLICIT mocks (unittest.mock on adapters/httpx);
  the shared _mock_completion helper may be reused directly as a stubbed
  return value, never via a global flag.
"""
from unittest.mock import patch, MagicMock
import pytest

from resume_pipeline.core.llm_router import _mock_completion, llm_router
from resume_pipeline.core import rate_limiter
from resume_pipeline.config import settings


class MockChoice:
    def __init__(self, content):
        self.message = MagicMock()
        self.message.content = content


class MockCompletion:
    def __init__(self, content):
        self.choices = [MockChoice(content)]
        self.usage = None


class MockResponse:
    def __init__(self, status_code, json_data=None, text=""):
        self.status_code = status_code
        self._json_data = json_data
        self.text = text
        self.headers = {}

    def json(self):
        return self._json_data


@pytest.fixture(autouse=True)
def run_around_tests():
    # Reset circuit breakers + pacing so limiter state never leaks between tests
    for limiter in (rate_limiter.groq_limiter, rate_limiter.opencode_limiter):
        limiter.state = rate_limiter.STATE_CLOSED
        limiter.last_state_change = 0.0
        limiter.trial_in_progress = False
        limiter.trial_start_time = 0.0
        limiter._last_call_time = 0.0
    # Save original settings
    orig_opencode_key = settings.OPENCODE_API_KEY
    orig_opencode_chat = settings.OPENCODE_CHAT_MODEL
    orig_primary_provider = settings.MODEL_CHAT_PRIMARY_PROVIDER
    orig_primary_name = settings.MODEL_CHAT_PRIMARY_NAME

    settings.OPENCODE_API_KEY = "oc_test_key"
    # Pin slots to the defaults; individual tests override via settings.
    settings.MODEL_CHAT_PRIMARY_PROVIDER = "opencode"
    settings.MODEL_CHAT_PRIMARY_NAME = ""

    yield

    # Restore original settings
    settings.OPENCODE_API_KEY = orig_opencode_key
    settings.OPENCODE_CHAT_MODEL = orig_opencode_chat
    settings.MODEL_CHAT_PRIMARY_PROVIDER = orig_primary_provider
    settings.MODEL_CHAT_PRIMARY_NAME = orig_primary_name


def test_json_cleaning():
    text_with_fences = "```json\n{\n  \"key\": \"value\"\n}\n```"
    cleaned = llm_router.clean_json_text(text_with_fences)
    assert cleaned == "{\n  \"key\": \"value\"\n}"

    text_no_fences = "{\n  \"key\": \"value\"\n}"
    cleaned = llm_router.clean_json_text(text_no_fences)
    assert cleaned == text_no_fences


@patch("resume_pipeline.core.llm_router.requests.post")
def test_groq_chat_removed_raises_without_http(mock_post):
    # Groq is STT-only after the demock: naming it for chat raises a clear
    # configuration error with no HTTP and no silent mock.
    with pytest.raises(ValueError, match="Unknown provider"):
        llm_router.generate_chat_completion(
            [{"role": "user", "content": "Hello Groq"}],
            provider="groq",
        )
    assert mock_post.call_count == 0


@patch("resume_pipeline.core.llm_router.requests.post")
def test_groq_stream_removed_raises_without_http(mock_post):
    with pytest.raises(ValueError, match="Unknown provider"):
        list(llm_router.generate_chat_completion_stream(
            [{"role": "user", "content": "Hi"}], provider="groq"
        ))
    assert mock_post.call_count == 0


def test_model_for_groq_raises():
    with pytest.raises(ValueError, match="Unknown provider"):
        llm_router.model_for("groq", "chat")
    with pytest.raises(ValueError, match="Unknown provider"):
        llm_router.model_for("groq", "explanation")


def test_missing_keys_raise_clear_error():
    # No credentials: a clear configuration error at call time, no HTTP.
    settings.OPENCODE_API_KEY = ""
    with patch("resume_pipeline.core.llm_router.requests.post") as mock_post:
        with pytest.raises(ValueError, match="OpenCode API key is not configured"):
            llm_router.generate_chat_completion(
                [{"role": "user", "content": "hello"}], provider=None, capability="chat"
            )
    assert mock_post.call_count == 0


def test_explicit_mock_helper_serves_without_http():
    # Hermeticity via EXPLICIT mock: the shared _mock_completion helper is
    # reused directly as the stubbed adapter return (no global flag, no HTTP).
    stubbed = _mock_completion([{"role": "user", "content": "gap analysis please"}])
    assert "skill_gaps" in stubbed
    with patch.object(
        llm_router.get_adapter("opencode"), "chat", return_value=stubbed
    ) as mock_chat:
        with patch("resume_pipeline.core.llm_router.requests.post") as mock_post:
            res = llm_router.generate_chat_completion(
                [{"role": "user", "content": "gap analysis please"}],
                provider=None,
                capability="chat",
            )
    assert res["content"] == stubbed
    assert res["_provenance"]["mock"] is False
    assert res["_provenance"]["fallback"] is False
    assert mock_chat.call_count == 1
    assert mock_post.call_count == 0


def test_is_chat_available_false_without_keys():
    settings.OPENCODE_API_KEY = ""
    assert llm_router.is_chat_available() is False


def test_is_chat_available_true_with_keys():
    settings.OPENCODE_API_KEY = "oc_test_key"
    assert llm_router.is_chat_available() is True


# ---------------------------------------------------------------------------
# OpenCode provider (OpenAI-compatible). All HTTP is mocked; no live calls.
# ---------------------------------------------------------------------------


class MockOpenAIResponse(MockResponse):
    def __init__(self, status_code, json_data=None, text="", sse_lines=None):
        super().__init__(status_code, json_data, text)
        self._sse_lines = sse_lines or []

    def iter_lines(self):
        return iter(self._sse_lines)


def _opencode_ok(content="Mock OpenCode Response"):
    return MockOpenAIResponse(
        status_code=200,
        json_data={"choices": [{"message": {"content": content}}]},
    )


def _sse_chunk(content):
    import json as _json

    return "data: " + _json.dumps({"choices": [{"delta": {"content": content}}]})


@patch("resume_pipeline.core.llm_router.requests.post")
def test_opencode_completion_success(mock_post):
    mock_post.return_value = _opencode_ok()

    messages = [{"role": "user", "content": "Hello OpenCode"}]
    res = llm_router.generate_chat_completion(messages, provider="opencode")

    assert res["content"] == "Mock OpenCode Response"
    assert res["model"] == settings.OPENCODE_CHAT_MODEL
    assert res["_provenance"]["provider"] == "opencode"
    assert res["_provenance"]["fallback"] is False
    assert mock_post.call_count == 1
    url = mock_post.call_args.args[0]
    assert url == settings.OPENCODE_API_BASE_URL.rstrip("/") + "/chat/completions"
    assert mock_post.call_args.kwargs["headers"]["Authorization"] == "Bearer oc_test_key"
    assert mock_post.call_args.kwargs["json"]["model"] == settings.OPENCODE_CHAT_MODEL


@patch("resume_pipeline.core.llm_router.requests.post")
@patch("resume_pipeline.core.llm_router.Groq")
def test_capability_uses_single_configured_provider(mock_groq, mock_post):
    # Default: opencode primary serves; exactly one adapter attempt fires.
    mock_post.return_value = _opencode_ok("primary opencode response")

    messages = [{"role": "user", "content": "Hello"}]
    res = llm_router.generate_chat_completion(messages, provider=None, capability="chat")

    assert res["content"] == "primary opencode response"
    assert res["_provenance"]["provider"] == "opencode"
    assert res["_provenance"]["fallback"] is False
    assert mock_post.call_count == 1
    mock_groq.assert_not_called()


@patch("resume_pipeline.core.llm_router.requests.post")
@patch("resume_pipeline.core.llm_router.Groq")
def test_primary_failure_raises(mock_groq, mock_post):
    # Single provider: a primary failure raises; no second adapter fires.
    mock_post.return_value = MockOpenAIResponse(status_code=500, text="OpenCode down")

    messages = [{"role": "user", "content": "Hello"}]
    with pytest.raises(RuntimeError, match="OpenCode API status 500"):
        llm_router.generate_chat_completion(messages, provider=None, capability="chat")

    assert mock_post.call_count == 1
    mock_groq.assert_not_called()


@patch("resume_pipeline.core.llm_router.requests.post")
@patch("resume_pipeline.core.llm_router.Groq")
def test_no_second_adapter_on_primary_failure(mock_groq, mock_post):
    # Even with a credentialed second adapter available, the router makes
    # exactly one attempt and raises its error.
    mock_post.return_value = MockOpenAIResponse(status_code=500, text="OpenCode down")
    mock_client = MagicMock()
    mock_groq.return_value = mock_client

    messages = [{"role": "user", "content": "Hello"}]
    with pytest.raises(RuntimeError, match="OpenCode API status 500"):
        llm_router.generate_chat_completion(messages, provider=None, capability="chat")

    assert mock_post.call_count == 1
    mock_client.chat.completions.create.assert_not_called()


@patch("resume_pipeline.core.llm_router.requests.post")
def test_opencode_failure_raises_no_further_fallback(mock_post):
    # Single provider: failure must raise, never silently succeed.
    mock_post.return_value = MockOpenAIResponse(status_code=500, text="OpenCode down")

    messages = [{"role": "user", "content": "Hello OpenCode"}]
    with pytest.raises(RuntimeError, match="OpenCode API status 500"):
        llm_router.generate_chat_completion(messages, provider="opencode")

    assert mock_post.call_count == 1


@patch("resume_pipeline.core.llm_router.requests.post")
def test_opencode_client_error_raises_without_breaker_trip(mock_post):
    # 4xx surfaces as AdapterClientError; success afterwards proves no trip.
    from resume_pipeline.core.llm_router import AdapterClientError

    mock_post.return_value = MockOpenAIResponse(status_code=401, text="bad key")

    messages = [{"role": "user", "content": "Hello OpenCode"}]
    with pytest.raises(AdapterClientError, match="OpenCode API status 401"):
        llm_router.generate_chat_completion(messages, provider="opencode")
    assert rate_limiter.opencode_limiter.state == rate_limiter.STATE_CLOSED


def test_opencode_missing_key_raises():
    settings.OPENCODE_API_KEY = ""
    with pytest.raises(ValueError, match="OpenCode API key is not configured"):
        llm_router.generate_chat_completion([{"role": "user", "content": "hi"}], provider="opencode")


@patch("resume_pipeline.core.llm_router.requests.post")
def test_opencode_stream_success(mock_post):
    mock_post.return_value = MockOpenAIResponse(
        status_code=200,
        sse_lines=[_sse_chunk("hello "), _sse_chunk("world"), "data: [DONE]"],
    )

    messages = [{"role": "user", "content": "Hi"}]
    out = "".join(llm_router.generate_chat_completion_stream(messages, provider="opencode"))

    assert out == "hello world"
    body = mock_post.call_args.kwargs["json"]
    assert body["stream"] is True


def test_primary_name_override_and_unknown_primary():
    # MODEL_CHAT_PRIMARY_NAME pins the model the single provider is called
    # with; an unknown primary provider raises instead of silently skipping.
    settings.MODEL_CHAT_PRIMARY_PROVIDER = "opencode"
    settings.MODEL_CHAT_PRIMARY_NAME = "custom-chat-model"
    assert llm_router.model_for("opencode", "chat") == "custom-chat-model"
    settings.MODEL_CHAT_PRIMARY_NAME = ""
    assert llm_router.model_for("opencode", "chat") == settings.OPENCODE_CHAT_MODEL
    settings.MODEL_CHAT_PRIMARY_PROVIDER = "nim"
    with pytest.raises(ValueError, match="Unknown provider"):
        llm_router.generate_chat_completion([{"role": "user", "content": "hi"}], provider=None, capability="chat")


# ---------------------------------------------------------------------------
# OpenCode Go gateway headers
# ---------------------------------------------------------------------------


def test_opencode_headers_include_go_gateway_fields():
    import uuid as _uuid

    from resume_pipeline.core.llm_router import _SESSION_ID, OpenCodeAdapter

    adapter = OpenCodeAdapter()
    headers = adapter._headers()

    assert headers["Authorization"] == "Bearer oc_test_key"
    assert headers["Content-Type"] == "application/json"
    assert headers["x-opencode-session"] == _SESSION_ID
    assert headers["User-Agent"] == "career-guidance-backend/1.0"

    # Session id is process-stable: identical across calls (and across
    # adapter instances), and generated once at import time.
    assert adapter._headers()["x-opencode-session"] == headers["x-opencode-session"]
    assert OpenCodeAdapter()._headers()["x-opencode-session"] == _SESSION_ID

    # Stable per process, not a fresh uuid per call.
    assert _SESSION_ID.startswith("careerguidance-")
    _uuid.UUID(_SESSION_ID[len("careerguidance-"):])


@patch("resume_pipeline.core.llm_router.requests.post")
def test_opencode_headers_sent_on_chat_and_stream(mock_post):
    from resume_pipeline.core.llm_router import _SESSION_ID

    mock_post.return_value = _opencode_ok("ok")
    llm_router.generate_chat_completion(
        [{"role": "user", "content": "Hello"}], provider="opencode"
    )
    chat_headers = mock_post.call_args.kwargs["headers"]
    assert chat_headers["x-opencode-session"] == _SESSION_ID
    assert chat_headers["User-Agent"] == "career-guidance-backend/1.0"
    assert chat_headers["Authorization"] == "Bearer oc_test_key"

    mock_post.return_value = MockOpenAIResponse(
        status_code=200,
        sse_lines=[_sse_chunk("hi"), "data: [DONE]"],
    )
    assert "".join(
        llm_router.generate_chat_completion_stream(
            [{"role": "user", "content": "Hi"}], provider="opencode"
        )
    ) == "hi"
    stream_headers = mock_post.call_args.kwargs["headers"]
    assert stream_headers["x-opencode-session"] == _SESSION_ID
    assert stream_headers["User-Agent"] == "career-guidance-backend/1.0"

