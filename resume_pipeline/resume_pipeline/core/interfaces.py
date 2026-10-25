from abc import ABC, abstractmethod
from typing import List, Dict, Optional


class TextExtractor(ABC):
    @abstractmethod
    def extract_text(self, path: str) -> str: ...


class OCRService(ABC):
    @abstractmethod
    def ocr_image(self, path: str) -> str: ...

    @abstractmethod
    def ocr_pdf_pages(self, path: str) -> Dict[int, str]: ...


class NumericValidator(ABC):
    @abstractmethod
    def normalize_cgpa(self, value) -> Dict: ...

    @abstractmethod
    def parse_numeric(self, s: str): ...

    @abstractmethod
    def validate_dates(self, start: Optional[str], end: Optional[str]) -> Dict: ...


class SkillMapper(ABC):
    @abstractmethod
    def map(self, skills: List[str]) -> List[Dict]: ...


class VectorStore(ABC):
    @abstractmethod
    def upsert(self, id: str, vector: List[float], metadata: dict): ...

    @abstractmethod
    def query(self, vector: List[float], top_k: int = 10): ...


class ParserService(ABC):
    @abstractmethod
    def run_parse(self, applicant_root: str, applicant_id: str) -> dict: ...


class FileStorage(ABC):
    @abstractmethod
    def upload_file(self, local_path: str, remote_path: str, is_public: bool = False) -> str:
        """Upload a file from a local path to the storage backend.
        Returns the remote path/key or public URL depending on the implementation.
        """
        ...

    @abstractmethod
    def upload_fileobj(self, fileobj, remote_path: str, is_public: bool = False) -> str:
        """Upload a file-like object to the storage backend.
        Returns the remote path/key or public URL depending on the implementation.
        """
        ...

    @abstractmethod
    def download_file(self, remote_path: str, local_path: str) -> None:
        """Download a file from the storage backend to a local path."""
        ...

    @abstractmethod
    def delete_file(self, remote_path: str) -> None:
        """Delete a file from the storage backend."""
        ...

    @abstractmethod
    def get_file_url(self, remote_path: str, expires_in: int = 900) -> str:
        """Get a URL (public or temporary signed URL) to access the file."""
        ...

    @abstractmethod
    def list_files(self, prefix: str) -> List[str]:
        """List files with the given prefix in the storage backend."""
        ...

