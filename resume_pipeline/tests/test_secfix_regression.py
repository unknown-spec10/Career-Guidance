"""Secfix regression tests: static traversal, HMAC fail-closed, RAG safety."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app
from resume_pipeline.auth import get_current_user
from resume_pipeline.config import settings
from resume_pipeline.db import Base, User, Applicant, InterviewSession
from resume_pipeline.interview.router import get_db as interview_get_db
from resume_pipeline.interview.common import (
    _abandon_token_is_valid,
    _make_abandon_token,
)
from resume_pipeline.routers.deps import get_db

DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session")
def fixture_db_session(tmp_path):
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=1, email="secfix@example.com", password_hash="x",
            role="student", name="Secfix", is_active=True, is_verified=True,
        )
        db.add(user)
        db.flush()
        applicant = Applicant(
            user_id=1, applicant_id="app_secfix", display_name="Secfix",
        )
        db.add(applicant)
        db.commit()
        yield {"db": db, "storage": tmp_path}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def _client(db_session, user=None):
    def override_db():
        try:
            yield db_session["db"]
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[interview_get_db] = override_db
    if user is not None:
        app.dependency_overrides[get_current_user] = lambda: user
    else:
        app.dependency_overrides.pop(get_current_user, None)
    client = TestClient(app, raise_server_exceptions=False)
    return client


@pytest.fixture(name="teardown_overrides")
def fixture_teardown():
    yield
    app.dependency_overrides.clear()


# --- 1. Static path traversal -------------------------------------------

def test_static_rejects_unauthenticated(db_session, teardown_overrides):
    client = _client(db_session)
    resp = client.get("/static/avatars/1/x.png")
    assert resp.status_code == 401


def test_static_blocks_traversal_and_absolute(db_session, teardown_overrides, monkeypatch):
    user = db_session["db"].query(User).filter_by(id=1).first()
    client = _client(db_session, user=user)
    storage = db_session["storage"]
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "FILE_STORAGE_PATH", str(storage))
    # Secret outside the storage root must never be served.
    outside = storage.parent / "outside_secret.txt"
    outside.write_text("top-secret")
    for evil in ("../outside_secret.txt", "..%2Foutside_secret.txt", "/etc/passwd"):
        resp = client.get(f"/static/{evil}")
        assert resp.status_code in (403, 404)
        assert "top-secret" not in resp.text


def test_static_serves_file_inside_root(db_session, teardown_overrides, monkeypatch):
    user = db_session["db"].query(User).filter_by(id=1).first()
    client = _client(db_session, user=user)
    storage = db_session["storage"]
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "FILE_STORAGE_PATH", str(storage))
    target = storage / "avatars" / "1"
    target.mkdir(parents=True)
    (target / "x.png").write_bytes(b"\x89PNG\r\n\x1a\nfakepng")
    resp = client.get("/static/avatars/1/x.png")
    assert resp.status_code == 200


# --- 2. HMAC fails closed without a secret -------------------------------

def test_hmac_fails_closed_without_secret(db_session, monkeypatch):
    db = db_session["db"]
    applicant = db.query(Applicant).filter_by(user_id=1).first()
    session = InterviewSession(
        id="sess-fail-closed", applicant_id=applicant.id,
        interview_type="technical", difficulty="medium",
        total_questions=5, status="active",
    )
    monkeypatch.setattr(settings, "SECRET_KEY", "")
    assert _abandon_token_is_valid(session, "a" * 64) is False
    with pytest.raises(Exception):
        _make_abandon_token(session.id, session.applicant_id)


def test_beacon_rejects_deactivated_owner(db_session, teardown_overrides):
    import uuid as uuidlib
    db = db_session["db"]
    applicant = db.query(Applicant).filter_by(user_id=1).first()
    sid = str(uuidlib.uuid4())
    db.add(InterviewSession(
        id=sid, applicant_id=applicant.id,
        interview_type="technical", difficulty="medium",
        total_questions=5, status="active",
    ))
    db.commit()
    session = db.query(InterviewSession).filter_by(id=sid).first()
    token = _make_abandon_token(session.id, session.applicant_id)
    # Deactivate the owner: even a valid HMAC must stop working.
    owner = db.query(User).filter_by(id=1).first()
    owner.is_active = False
    db.commit()
    client = _client(db_session)
    resp = client.post(f"/api/interview/abandon-beacon/{sid}?abandon_token={token}")
    assert resp.status_code == 403
    db.refresh(session)
    assert session.status == "active"


def test_avatar_rejects_mislabeled_executable(db_session, teardown_overrides):
    import io
    from unittest.mock import MagicMock, patch
    from resume_pipeline.routers.deps import get_db as deps_get_db

    user = db_session["db"].query(User).filter_by(id=1).first()

    def override_db():
        try:
            yield db_session["db"]
        finally:
            pass

    app.dependency_overrides[deps_get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: user
    client = TestClient(app, raise_server_exceptions=False)
    with patch("resume_pipeline.core.storage.get_storage_client") as mock_gs:
        mock_gs.return_value = MagicMock()
        resp = client.post(
            "/api/auth/profile/picture",
            files={"file": ("evil.png", io.BytesIO(b"MZ" + b"\x00" * 64), "image/png")},
        )
    assert resp.status_code == 400
    assert "Invalid image format" in resp.json()["detail"]


# --- 3. RAG route (auth required) ---------------------------------------
def test_rag_ask_requires_auth(db_session, teardown_overrides):
    client = _client(db_session)
    resp = client.post(
        "/api/rag/ask",
        json={"query": "How do I use the app?"},
    )
    assert resp.status_code == 401


def test_rag_ask_responds_without_crashing(db_session, teardown_overrides, monkeypatch, tmp_path):
    import resume_pipeline.rag.rag_service as rag_module
    from unittest.mock import patch as _patch

    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "GUIDE.md").write_text(
        "# Guide\n\n## Upload\n\nYou can upload your resume on the upload page.\n"
    )
    monkeypatch.setattr(rag_module, "_rag_service", None)
    svc = rag_module.RAGService(
        docs_path=str(docs),
        cache_path=str(tmp_path / "cache"),
        enable_file_watcher=False,
    )
    monkeypatch.setattr(rag_module, "_rag_service", svc)
    # Hermeticity via EXPLICIT mock (no global flag, no live keys, no HTTP).
    stub = {
        "content": "You can upload your resume on the upload page.",
        "model": "deepseek-v4.1-flash",
        "_latency": 0.0,
        "_provenance": {"provider": "opencode", "fallback": False, "mock": False},
    }
    user = db_session["db"].query(User).filter_by(id=1).first()
    client = _client(db_session, user=user)
    with _patch.object(
        rag_module.llm_router, "generate_chat_completion", return_value=stub
    ):
        resp = client.post(
            "/api/rag/ask",
            json={"query": "How do I upload my resume to the app?"},
        )
    assert resp.status_code == 200
    assert "answer" in resp.json()


def test_rag_leaks_no_internals(db_session, teardown_overrides, monkeypatch):
    import resume_pipeline.rag as rag_pkg
    import resume_pipeline.rag.rag_service as rag_module

    class ExplodingService:
        _is_initialized = True

        async def ask(self, **kwargs):
            raise RuntimeError("postgres://admin:s3cret@db/internal exploded")

    monkeypatch.setattr(rag_module, "_rag_service", ExplodingService())
    monkeypatch.setattr(rag_pkg, "get_rag_service", lambda: ExplodingService())
    user = db_session["db"].query(User).filter_by(id=1).first()
    client = _client(db_session, user=user)
    resp = client.post("/api/rag/ask", json={"query": "How do I use the app?"})
    assert resp.status_code in (400, 500)
    assert "postgres://" not in resp.text
    assert "s3cret" not in resp.text
    assert "exploded" not in resp.text
