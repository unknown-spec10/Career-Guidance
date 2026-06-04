import hashlib
import os
import re
import html
import logging
from pathlib import Path
from typing import Tuple, Any, Dict, List

from .config import AI_INPUT_CONFIG

logger = logging.getLogger(__name__)


def ensure_dir(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)


def sanitize_text(text: str, max_length: int = 10000) -> str:
    """
    Sanitize user input text to prevent XSS attacks
    - Escape HTML entities
    - Remove control characters
    - Limit length
    """
    if not isinstance(text, str):
        return ""
    
    # Limit length
    text = text[:max_length]
    
    # Remove control characters except newlines and tabs
    text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', text)
    
    # Escape HTML entities
    text = html.escape(text, quote=True)
    
    return text.strip()


def sanitize_dict(data: Dict[str, Any], fields: List[str] = None, max_length: int = 10000) -> Dict[str, Any]:
    """
    Sanitize text fields in a dictionary
    If fields is None, sanitize all string values
    """
    if not isinstance(data, dict):
        return data
    
    sanitized = {}
    for key, value in data.items():
        # Only sanitize specified fields or all strings if fields=None
        if fields is None or key in fields:
            if isinstance(value, str):
                sanitized[key] = sanitize_text(value, max_length)
            elif isinstance(value, dict):
                sanitized[key] = sanitize_dict(value, fields, max_length)
            elif isinstance(value, list):
                sanitized[key] = [
                    sanitize_text(item, max_length) if isinstance(item, str) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        else:
            sanitized[key] = value
    
    return sanitized


def validate_email(email: str) -> bool:
    """Validate email format"""
    if not isinstance(email, str):
        return False
    
    email = email.strip().lower()
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email)) and len(email) <= 254


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal attacks"""
    if not isinstance(filename, str):
        return "file"
    
    # Remove path separators
    filename = os.path.basename(filename)
    
    # Remove or replace dangerous characters
    filename = re.sub(r'[^\w\s.-]', '_', filename)
    
    # Remove leading dots
    filename = filename.lstrip('.')
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    return filename or "file"


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def save_upload(file_obj, dest_dir: str, filename: str = None) -> Tuple[str, int]:
    """Save a starlette UploadFile-like object to disk. Returns (path, bytes_written)."""
    ensure_dir(dest_dir)
    if filename is None:
        filename = getattr(file_obj, "filename", "upload.bin")
    destination = os.path.join(dest_dir, filename)
    with open(destination, "wb") as out:
        content = file_obj.file.read()
        out.write(content)
    size = os.path.getsize(destination)
    return destination, size


def truncate_for_llm(text: str, limit_key: str) -> str:
    """
    Trim text before sending to any LLM.
    Logs a warning if truncation actually happened.
    """
    if not isinstance(text, str):
        return ""

    max_chars = AI_INPUT_CONFIG.get(limit_key)
    if max_chars is None:
        logger.warning(f"Limit key '{limit_key}' not found in AI_INPUT_CONFIG. Returning raw text.")
        return text

    if len(text) <= max_chars:
        return text  # no truncation needed

    strategy = "top_only"
    if limit_key == "resume_max_chars":
        strategy = AI_INPUT_CONFIG.get("resume_truncation_strategy", "top_only")

    if strategy == "top_and_tail":
        # Take first 70% and last 30% of the limit
        # Captures: name/contact/education at top + skills at bottom
        top = int(max_chars * 0.7)
        tail = max_chars - top
        truncated = text[:top] + "\n...\n" + text[-tail:]
    else:
        truncated = text[:max_chars]

    original_tokens_approx  = len(text) // 4
    truncated_tokens_approx = len(truncated) // 4

    logger.warning(
        f"Text truncated for limit key '{limit_key}': {len(text)} → {len(truncated)} chars "
        f"(~{original_tokens_approx} → ~{truncated_tokens_approx} tokens)"
    )

    return truncated
