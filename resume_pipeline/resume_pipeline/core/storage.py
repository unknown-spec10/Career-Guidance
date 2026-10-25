import os
import shutil
import logging
from pathlib import Path
from typing import List, Optional

from .interfaces import FileStorage
from ..config import settings

logger = logging.getLogger(__name__)


def _get_repo_root() -> Path:
    """Get the repository root directory (project root)."""
    return Path(__file__).resolve().parents[2]


def _resolve_storage_path(path: str) -> Path:
    """Resolve storage path relative to repo root if relative; absolute paths pass through unchanged."""
    p = Path(path)
    if p.is_absolute():
        return p.resolve()
    return (_get_repo_root() / p).resolve()


class LocalFileStorage(FileStorage):
    """Local filesystem implementation of FileStorage."""

    def __init__(self, base_path: str = None):
        if base_path is not None:
            self.base_path = _resolve_storage_path(base_path)
        else:
            self.base_path = Path(settings.FILE_STORAGE_PATH).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_absolute_path(self, path: str) -> Path:
        # Convert remote/relative key to local absolute path
        abs_path = Path(self.base_path / path).resolve()
        # Prevent path traversal attacks
        if not str(abs_path).startswith(str(self.base_path)):
            raise ValueError(f"Path traversal detected: {path}")
        return abs_path

    def upload_file(self, local_path: str, remote_path: str, is_public: bool = False) -> str:
        dest_path = self._get_absolute_path(remote_path)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(local_path, dest_path)
        return remote_path

    def upload_fileobj(self, fileobj, remote_path: str, is_public: bool = False) -> str:
        dest_path = self._get_absolute_path(remote_path)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        # Handle file upload objects
        if hasattr(fileobj, "seek"):
            fileobj.seek(0)
        
        with open(dest_path, "wb") as f:
            if hasattr(fileobj, "read"):
                # Handle standard file-like object or Starlette UploadFile
                content = fileobj.read()
                if isinstance(content, str):
                    content = content.encode("utf-8")
                f.write(content)
            else:
                f.write(fileobj)
        return remote_path

    def download_file(self, remote_path: str, local_path: str) -> None:
        src_path = self._get_absolute_path(remote_path)
        if not src_path.exists():
            raise FileNotFoundError(f"File not found in local storage: {remote_path}")
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, local_path)

    def delete_file(self, remote_path: str) -> None:
        file_path = self._get_absolute_path(remote_path)
        if file_path.exists() and file_path.is_file():
            file_path.unlink()

    def get_file_url(self, remote_path: str, expires_in: int = 900) -> str:
        # For local backend, return file URL or absolute path string
        # Since it's a web API, we can route it through /static or return the key
        return f"/static/{remote_path}"

    def list_files(self, prefix: str) -> List[str]:
        target_dir = self._get_absolute_path(prefix)
        if not target_dir.exists():
            return []
        
        files = []
        if target_dir.is_file():
            # If the path matches exactly a file
            return [prefix]
            
        for root, _, filenames in os.walk(target_dir):
            for filename in filenames:
                full_path = Path(root) / filename
                rel_path = full_path.relative_to(self.base_path)
                files.append(str(rel_path).replace("\\", "/"))
        return files


class GCSFileStorage(FileStorage):
    """Google Cloud Storage (GCS) implementation of FileStorage."""

    def __init__(self):
        try:
            from google.cloud import storage as gcs
        except ImportError:
            raise ImportError(
                "google-cloud-storage is required for GCS storage backend. "
                "Install it using 'pip install google-cloud-storage'."
            )
        
        self.bucket_name = settings.GCS_BUCKET_NAME
        client_kwargs = {}
        if settings.GCS_PROJECT_ID:
            client_kwargs["project"] = settings.GCS_PROJECT_ID
            
        self.gcs_client = gcs.Client(**client_kwargs)
        self.bucket = self.gcs_client.bucket(self.bucket_name)

    def upload_file(self, local_path: str, remote_path: str, is_public: bool = False) -> str:
        import mimetypes
        blob = self.bucket.blob(remote_path)
        content_type, _ = mimetypes.guess_type(remote_path)
        if content_type:
            blob.content_type = content_type
            
        try:
            blob.upload_from_filename(local_path)
            if is_public:
                try:
                    blob.make_public()
                except Exception as acl_err:
                    logger.info(f"GCS make_public skipped or failed: {acl_err}")
            return remote_path
        except Exception as e:
            logger.error(f"GCS upload_file error: {e}")
            raise

    def upload_fileobj(self, fileobj, remote_path: str, is_public: bool = False) -> str:
        import mimetypes
        import io
        blob = self.bucket.blob(remote_path)
        content_type, _ = mimetypes.guess_type(remote_path)
        if content_type:
            blob.content_type = content_type

        try:
            if hasattr(fileobj, "seek"):
                fileobj.seek(0)
            file_bytes = fileobj.read()
        except Exception as read_err:
            logger.warning(f"Could not read fileobj into memory: {read_err}")
            file_bytes = None

        try:
            if file_bytes is not None:
                blob.upload_from_file(io.BytesIO(file_bytes))
            else:
                blob.upload_from_file(fileobj)

            if is_public:
                try:
                    blob.make_public()
                except Exception as acl_err:
                    logger.info(f"GCS make_public skipped or failed: {acl_err}")
            return remote_path
        except Exception as e:
            logger.error(f"GCS upload_fileobj error: {e}")
            raise

    def download_file(self, remote_path: str, local_path: str) -> None:
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        try:
            blob = self.bucket.blob(remote_path)
            blob.download_to_filename(local_path)
        except Exception as e:
            logger.error(f"GCS download_file error: {e}")
            raise

    def delete_file(self, remote_path: str) -> None:
        try:
            blob = self.bucket.blob(remote_path)
            blob.delete()
        except Exception as e:
            logger.error(f"GCS delete_file error: {e}")
            raise

    def get_file_url(self, remote_path: str, expires_in: int = 900) -> str:
        from datetime import timedelta
        try:
            blob = self.bucket.blob(remote_path)
            return blob.generate_signed_url(expiration=timedelta(seconds=expires_in))
        except Exception as e:
            logger.error(f"GCS generate_signed_url error: {e}")
            return f"https://storage.googleapis.com/{self.bucket_name}/{remote_path}"

    def list_files(self, prefix: str) -> List[str]:
        try:
            blobs = self.gcs_client.list_blobs(self.bucket_name, prefix=prefix)
            return [b.name for b in blobs if not b.name.endswith("/")]
        except Exception as e:
            logger.error(f"GCS list_files error: {e}")
            raise


_storage_client: Optional[FileStorage] = None

def get_storage_client() -> FileStorage:
    """Return the configured active storage client (Singleton)."""
    global _storage_client
    if _storage_client is None:
        backend = (settings.STORAGE_BACKEND or "local").lower()
        if backend == "gcs":
            logger.info("Initializing GCS File Storage client")
            _storage_client = GCSFileStorage()
        else:
            logger.info("Initializing Local File Storage client")
            _storage_client = LocalFileStorage()
    return _storage_client


from contextlib import contextmanager
import tempfile

@contextmanager
def get_local_directory(applicant_id: str):
    """
    Context manager that yields a local directory path containing the applicant's files.
    If storage backend is GCS, it downloads files to a temporary directory and cleans it up on exit.
    If local, it returns the local directory path.
    """
    storage = get_storage_client()
    base_data_root = Path(settings.FILE_STORAGE_PATH).resolve()
    backend = (settings.STORAGE_BACKEND or "local").lower()
    
    if backend == "gcs":
        with tempfile.TemporaryDirectory() as temp_dir:
            prefix = f"resumes/{applicant_id}/"
            logger.info(f"Downloading files from {backend.upper()} prefix {prefix} to temporary local directory {temp_dir}")
            try:
                files = storage.list_files(prefix)
                for f in files:
                    filename = os.path.basename(f)
                    if filename:
                        dest = os.path.join(temp_dir, filename)
                        storage.download_file(f, dest)
            except Exception as e:
                logger.error(f"Failed to download files from {backend.upper()} for applicant {applicant_id}: {e}")
            yield temp_dir
    else:
        # Check resumes/app_id path format, then fallback to legacy app_id path format
        new_path = base_data_root / "resumes" / applicant_id
        legacy_path = base_data_root / applicant_id
        if new_path.exists():
            yield str(new_path)
        elif legacy_path.exists():
            yield str(legacy_path)
        else:
            yield str(new_path)


