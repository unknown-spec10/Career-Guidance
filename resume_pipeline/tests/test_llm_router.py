import json
from unittest.mock import patch, MagicMock
import pytest

from resume_pipeline.core.llm_router import llm_router
from resume_pipeline.config import settings

# Test mock helpers
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
    # Reset stats before each test
    llm_router.reset_stats()
    # Save original settings
    orig_groq_key = settings.GROQ_API_KEY
    orig_gemini_key = settings.GEMINI_API_KEY
    orig_or_key = settings.OPENROUTER_API_KEY
    
    settings.GROQ_API_KEY = "gsk_test_key"
    settings.GEMINI_API_KEY = "gemini_test_key"
    settings.OPENROUTER_API_KEY = "or_test_key"
    
    yield
    
    # Restore original settings
    settings.GROQ_API_KEY = orig_groq_key
    settings.GEMINI_API_KEY = orig_gemini_key
    settings.OPENROUTER_API_KEY = orig_or_key


def test_json_cleaning():
    text_with_fences = "```json\n{\n  \"key\": \"value\"\n}\n```"
    cleaned = llm_router.clean_json_text(text_with_fences)
    assert cleaned == "{\n  \"key\": \"value\"\n}"

    text_no_fences = "{\n  \"key\": \"value\"\n}"
    cleaned = llm_router.clean_json_text(text_no_fences)
    assert cleaned == text_no_fences


@patch("resume_pipeline.core.llm_router.Groq")
def test_groq_completion_success(mock_groq):
    # Mock Groq client completions.create
    mock_client = MagicMock()
    mock_raw_resp = MagicMock()
    mock_raw_resp.headers = {}
    mock_raw_resp.parse.return_value = MockCompletion("Mock Groq Response")
    
    mock_client.with_raw_response.chat.completions.create.return_value = mock_raw_resp
    mock_groq.return_value = mock_client

    messages = [{"role": "user", "content": "Hello Groq"}]
    res = llm_router.generate_chat_completion(messages, provider="groq")

    assert res["content"] == "Mock Groq Response"
    assert res["model"] == settings.GROQ_CHAT_MODEL
    assert res["_provenance"]["provider"] == "groq"
    assert res["_provenance"]["fallback"] is False

    stats = llm_router.get_stats()
    assert stats["total_requests"] == 1
    assert stats["successful_requests"] == 1
    assert stats["fallback_requests"] == 0
    assert stats["provider_stats"]["groq"]["requests"] == 1
    assert stats["provider_stats"]["groq"]["successes"] == 1


@patch("resume_pipeline.core.llm_router.Groq")
@patch("resume_pipeline.core.llm_router.requests.post")
def test_groq_completion_fallback_to_openrouter(mock_post, mock_groq):
    # Groq client raises an exception (e.g. rate limit / quota exhausted)
    mock_client = MagicMock()
    mock_client.with_raw_response.chat.completions.create.side_effect = Exception("Rate limit exceeded")
    mock_groq.return_value = mock_client

    # Mock OpenRouter fallback API response
    mock_post.return_value = MockResponse(
        status_code=200, 
        json_data={
            "choices": [
                {
                    "message": {
                        "content": "Mock OpenRouter Response"
                    }
                }
            ]
        }
    )

    messages = [{"role": "user", "content": "Hello Groq"}]
    res = llm_router.generate_chat_completion(messages, provider="groq")

    assert res["content"] == "Mock OpenRouter Response"
    assert res["model"] == settings.OPENROUTER_MODEL
    assert res["_provenance"]["provider"] == "openrouter"
    assert res["_provenance"]["fallback"] is True
    assert res["_provenance"]["fallback_source"] == "groq"

    stats = llm_router.get_stats()
    assert stats["total_requests"] == 1
    assert stats["successful_requests"] == 1
    assert stats["fallback_requests"] == 1
    assert stats["provider_stats"]["groq"]["requests"] == 1
    assert stats["provider_stats"]["groq"]["successes"] == 0
    assert stats["provider_stats"]["openrouter"]["requests"] == 1
    assert stats["provider_stats"]["openrouter"]["successes"] == 1


@patch("resume_pipeline.core.llm_router.requests.post")
def test_gemini_completion_success(mock_post):
    # Mock Gemini generateContent API response
    mock_post.return_value = MockResponse(
        status_code=200,
        json_data={
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Mock Gemini Response"}
                        ]
                    }
                }
            ]
        }
    )

    messages = [{"role": "user", "content": "Hello Gemini"}]
    res = llm_router.generate_chat_completion(messages, provider="gemini")

    assert res["content"] == "Mock Gemini Response"
    assert res["model"] == settings.GEMINI_SMALL_MODEL
    assert res["_provenance"]["provider"] == "gemini"
    assert res["_provenance"]["fallback"] is False

    stats = llm_router.get_stats()
    assert stats["total_requests"] == 1
    assert stats["successful_requests"] == 1
    assert stats["fallback_requests"] == 0
    assert stats["provider_stats"]["gemini"]["requests"] == 1
    assert stats["provider_stats"]["gemini"]["successes"] == 1


@patch("resume_pipeline.core.llm_router.requests.post")
def test_gemini_completion_fallback_to_openrouter(mock_post):
    # Mock Gemini post to fail (e.g. 429 rate limit) then mock OpenRouter success
    # Side effect returns first failure then success for OpenRouter
    mock_post.side_effect = [
        MockResponse(status_code=429, text="Quota Exceeded"),
        MockResponse(
            status_code=200,
            json_data={
                "choices": [
                    {
                        "message": {
                            "content": "Mock OpenRouter Response"
                        }
                    }
                ]
            }
        )
    ]

    messages = [{"role": "user", "content": "Hello Gemini"}]
    res = llm_router.generate_chat_completion(messages, provider="gemini")

    assert res["content"] == "Mock OpenRouter Response"
    assert res["model"] == settings.OPENROUTER_MODEL
    assert res["_provenance"]["provider"] == "openrouter"
    assert res["_provenance"]["fallback"] is True
    assert res["_provenance"]["fallback_source"] == "gemini"

    stats = llm_router.get_stats()
    assert stats["total_requests"] == 1
    assert stats["successful_requests"] == 1
    assert stats["fallback_requests"] == 1
    assert stats["provider_stats"]["gemini"]["requests"] == 1
    assert stats["provider_stats"]["gemini"]["successes"] == 0
    assert stats["provider_stats"]["openrouter"]["requests"] == 1
    assert stats["provider_stats"]["openrouter"]["successes"] == 1
