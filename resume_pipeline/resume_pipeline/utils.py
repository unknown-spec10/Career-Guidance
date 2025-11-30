import hashlib
import os
from pathlib import Path
from typing import Tuple


def ensure_dir(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)


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
