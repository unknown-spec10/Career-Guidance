"""Avatar delivery.

Avatars are served from the API rather than from the bucket URL, because the
storage bucket also holds resumes and must stay private. The route resolves the
stored object key, streams the bytes, and answers with a generated placeholder
when the object is missing — a broken image is never the user's problem.

Stored values may be legacy absolute URLs (``https://storage.googleapis.com/…``
or a retired S3 host); only the part from ``avatars/`` onwards is used, so a
bucket migration can never break an existing row.
"""

import mimetypes
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..core.storage import get_storage_client
from ..db import User
from .deps import get_db

router = APIRouter(tags=["media"])


def public_avatar_url(user_id: int) -> str:
    """Absolute URL the SPA can put straight into an <img> tag."""
    base = (settings.BACKEND_URL or "").rstrip("/")
    return f"{base}/api/media/avatar/{user_id}"

_AVATAR_MARKER = "avatars/"
_DEFAULT_COLOURS = (
    "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#14b8a6", "#f472b6",
)


def avatar_key(user: User) -> str:
    """Object key for a user's avatar, tolerant of legacy absolute URLs."""
    stored = (getattr(user, "profile_picture_url", None) or "").strip()
    if stored:
        if "/avatars/" in stored:
            return "avatars/" + stored.split("/avatars/", 1)[1].strip("/")
        if stored.startswith("avatars/"):
            return stored
    return f"avatars/{user.id}/me.jpg"


def _initials(user: User) -> str:
    name = (getattr(user, "name", None) or (user.email or "").split("@")[0] or "?").strip()
    parts = [p for p in name.replace("_", " ").replace(".", " ").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _placeholder_svg(user: User) -> bytes:
    colour = _DEFAULT_COLOURS[user.id % len(_DEFAULT_COLOURS)]
    initials = _initials(user)
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'
        f'<rect width="160" height="160" rx="80" fill="{colour}"/>'
        '<text x="80" y="80" dy="0.35em" text-anchor="middle" '
        'font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" '
        f'font-size="64" font-weight="600" fill="#ffffff">{initials}</text>'
        "</svg>"
    )
    return svg.encode("utf-8")


@router.get("/api/media/avatar/{user_id}")
def get_avatar(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Stream a user's avatar (auth required; the bucket stays private)."""
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    key = avatar_key(user)
    data: Optional[bytes] = None
    try:
        data = get_storage_client().read_bytes(key)
    except Exception:
        data = None

    if not data:
        return Response(
            content=_placeholder_svg(user),
            media_type="image/svg+xml",
            headers={"Cache-Control": "public, max-age=60"},
        )

    media_type = mimetypes.guess_type(key)[0] or "image/jpeg"
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=300"},
    )
