# pyright: reportGeneralTypeIssues=false, reportOptionalMemberAccess=false, reportAttributeAccessIssue=false
"""API routes split out of the former monolithic app module (paths/methods unchanged)."""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse, FileResponse
from ..config import settings
from ..auth import (
    get_current_user,
)
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def _get_repo_root() -> Path:
    """Get the repository root directory (project root)."""
    return Path(__file__).resolve().parents[2]


def _resolve_storage_path_root() -> Path:
    p = Path(settings.FILE_STORAGE_PATH)
    if p.is_absolute():
        return p.resolve()
    return (_get_repo_root() / p).resolve()


router = APIRouter()


@router.get("/static/{file_path:path}")
async def serve_static_file(file_path: str, current_user=Depends(get_current_user)):
    """Serve public files from local storage (avatars, assets).

    Authenticated: every caller presents a valid, non-revoked Bearer token
    (get_current_user also rejects deactivated accounts). Paths are resolved
    against the storage root and rejected when they escape it.
    """
    from fastapi.responses import RedirectResponse, FileResponse
    _require_safe_static_path(file_path)
    if (settings.STORAGE_BACKEND or "local").lower() == "gcs":
        from ..core.storage import get_storage_client
        storage = get_storage_client()
        return RedirectResponse(url=storage.get_file_url(file_path))
    else:
        base = _resolve_storage_path_root()
        local_path = (base / file_path).resolve()
        if not _is_within_root(local_path, base):
            raise HTTPException(status_code=403, detail="Access denied")
        if not local_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        import mimetypes
        media_type, _ = mimetypes.guess_type(str(local_path))
        return FileResponse(path=str(local_path), media_type=media_type or "application/octet-stream")


def _is_within_root(resolved: Path, base: Path) -> bool:
    try:
        resolved.relative_to(base)
        return True
    except ValueError:
        return False


def _require_safe_static_path(file_path: str) -> None:
    """Reject absolute paths and `..` segments before touching storage."""
    if not file_path or file_path.startswith(("/", "\\")):
        raise HTTPException(status_code=403, detail="Access denied")
    if ".." in Path(file_path).parts:
        raise HTTPException(status_code=403, detail="Access denied")
