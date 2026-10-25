import sys
import io
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_current_user, get_current_user_optional, get_db
from resume_pipeline.db import Base, User
from resume_pipeline.config import settings

# Create memory SQLite database for testing the profile picture state
from sqlalchemy.pool import StaticPool
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Create a test user in SQLite memory db
        test_user = User(
            id=999,
            email="avatar_test@example.com",
            password_hash="fakehash",
            role="student",
            name="Test User",
            is_active=True,
            is_verified=True
        )
        db.add(test_user)
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        user = db_session.query(User).filter(User.id == 999).first()
        return user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_user_optional] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()


@patch("resume_pipeline.core.storage.get_storage_client")
def test_upload_profile_picture_success(mock_get_storage, client, db_session):
    mock_storage = MagicMock()
    mock_get_storage.return_value = mock_storage

    file_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32  # minimal valid PNG magic bytes
    file_name = "test_avatar.png"
    file_io = io.BytesIO(file_content)

    with patch.object(settings, "STORAGE_BACKEND", "local"):
        response = client.post(
            "/api/auth/profile/picture",
            files={"file": (file_name, file_io, "image/png")}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "/static/avatars/999/test_avatar.png" in data["profile_picture_url"]

        # Verify database updated
        user = db_session.query(User).filter(User.id == 999).first()
        assert user.profile_picture_url == "/static/avatars/999/test_avatar.png"

        # Verify storage client upload was called
        mock_storage.upload_fileobj.assert_called_once()


def test_upload_profile_picture_invalid_extension(client):
    file_content = b"fake txt bytes"
    file_name = "test_avatar.txt"
    file_io = io.BytesIO(file_content)

    response = client.post(
        "/api/auth/profile/picture",
        files={"file": (file_name, file_io, "text/plain")}
    )

    assert response.status_code == 400
    assert "Invalid image format" in response.json()["detail"]


def test_upload_profile_picture_too_large(client):
    large_content = b"x" * (3 * 1024 * 1024) # 3MB (Limit is 2MB)
    file_name = "large.png"
    file_io = io.BytesIO(large_content)

    response = client.post(
        "/api/auth/profile/picture",
        files={"file": (file_name, file_io, "image/png")}
    )

    assert response.status_code == 400
    assert "exceeds maximum limit" in response.json()["detail"]


@patch("resume_pipeline.core.storage.get_storage_client")
def test_delete_profile_picture_success(mock_get_storage, client, db_session):
    mock_storage = MagicMock()
    mock_get_storage.return_value = mock_storage

    # Set user's profile picture first
    user = db_session.query(User).filter(User.id == 999).first()
    user.profile_picture_url = "/static/avatars/999/test_avatar.png"
    db_session.commit()

    response = client.delete("/api/auth/profile/picture")

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify database updated to None
    user = db_session.query(User).filter(User.id == 999).first()
    assert user.profile_picture_url is None

    # Verify storage client delete was called
    mock_storage.delete_file.assert_called_once_with("avatars/999/test_avatar.png")
