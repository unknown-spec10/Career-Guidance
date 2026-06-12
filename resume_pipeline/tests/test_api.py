import os
import pytest
from google import genai

def test_gemini_api_connectivity():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        pytest.skip("GEMINI_API_KEY is not set")
    
    client = genai.Client(api_key=api_key)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash", contents="Explain how AI works in a few words"
        )
        assert response.text is not None
    except Exception as e:
        if "quota" in str(e).lower() or "429" in str(e) or "exhausted" in str(e).lower():
            pytest.skip(f"Gemini API quota exhausted: {e}")
        raise