import json
from typing import Optional

INTERROGATIVES = {"what","how","why","when","where","who","which","could","would","did","do"}

def validate_single_question(json_text):
    """
    Accept either dict or JSON string; return parsed dict or None.
    """
    try:
        obj = json.loads(json_text) if isinstance(json_text, str) else (json_text if isinstance(json_text, dict) else None)
        if not obj or "text" not in obj:
            return None
        text = obj["text"].strip()
        if len(text.split()) > 60:
            return None
        if text.count("?") > 1:
            return None
        if "?" in text or text.split()[0].lower() in INTERROGATIVES:
            return obj
        return None
    except Exception:
        return None
