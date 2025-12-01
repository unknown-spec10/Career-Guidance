import hashlib
import os
import re
import html
from pathlib import Path
from typing import Tuple, Any, Dict, List


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
