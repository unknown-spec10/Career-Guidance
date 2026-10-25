"""
Security follow-up regression tests:
- JWT revocation: tokens issued before a password change/reset are rejected
- password change/reset stamp users.password_changed_at
"""
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_db
from resume_pipeline.auth import (
    create_access_token, decode_access_token, _token_is_revoked,
)
from resume_pipeline.db import (
    Base, User, Applicant,
)

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=71, email="revoke@example.com", password_hash="x",
            role="student", name="Revoke", is_active=True, is_verified=True,
        )
        applicant = Applicant(
            user_id=71, applicant_id="app_revoketest", display_name="Revoke"
        )
        db.add_all([user, applicant])
        db.commit()
        yield {"db": db, "user": user, "applicant": applicant}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


# ---------------------------------------------------------------------------
# Token revocation unit tests
# ---------------------------------------------------------------------------

def test_token_revoked_after_password_change(env):
    db = env["db"]
    user = env["user"]

    # Token issued BEFORE the credential change
    old_payload = decode_access_token(create_access_token({"sub": str(user.id)}))
    user.password_changed_at = __import__("datetime").datetime.utcnow() + __import__("datetime").timedelta(seconds=5)
    db.commit()

    assert _token_is_revoked(old_payload, user) is True


def test_token_valid_when_issued_after_change(env):
    import datetime
    db = env["db"]
    user = env["user"]

    user.password_changed_at = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    db.commit()

    new_payload = decode_access_token(create_access_token({"sub": str(user.id)}))  # iat = now
    assert _token_is_revoked(new_payload, user) is False


def test_tokens_without_iat_fail_closed_after_change(env):
    """Legacy tokens (no iat claim) cannot prove freshness — once a credential
    change exists they are revoked (fail closed)."""
    user = env["user"]
    assert _token_is_revoked({"sub": str(user.id)}, user) is False

    user.password_changed_at = __import__("datetime").datetime.utcnow()
    assert _token_is_revoked({"sub": str(user.id)}, user) is True


def test_malformed_iat_fails_closed(env):
    user = env["user"]
    user.password_changed_at = __import__("datetime").datetime.utcnow()
    assert _token_is_revoked({"sub": str(user.id), "iat": "not-a-number"}, user) is True


# ---------------------------------------------------------------------------
# Change-password stamps the revocation timestamp
# ---------------------------------------------------------------------------

@pytest.fixture(name="client")
def fixture_client(env):
    def override_get_db():
        try:
            yield env["db"]
        finally:
            pass

    from resume_pipeline.auth import get_current_user

    def override_user():
        return env["db"].query(User).filter(User.id == 71).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_change_password_sets_revocation_timestamp(env, client):
    from resume_pipeline.auth import pwd_context
    import datetime

    # Seed a properly-formatted hash so verify_password behaves normally.
    user = env["user"]
    user.password_hash = pwd_context.hash("correct-old")
    db = env["db"]
    db.commit()

    # Wrong current password -> 401, no revocation stamp.
    resp = client.patch("/api/auth/change-password", json={
        "current_password": "wrong-password",
        "new_password": "newpassword1",
    })
    assert resp.status_code == 401
    db.refresh(user)
    assert user.password_changed_at is None

    # Correct current password -> 200 + revocation stamped.
    resp = client.patch("/api/auth/change-password", json={
        "current_password": "correct-old",
        "new_password": "newpassword1",
    })
    assert resp.status_code == 200
    db.refresh(user)
    assert isinstance(user.password_changed_at, datetime.datetime)


# ---------------------------------------------------------------------------
# H1: SECRET_KEY handling — ephemeral dev key, production fail-closed
# ---------------------------------------------------------------------------

def test_jwt_uses_ephemeral_key_in_dev_without_secret(monkeypatch):
    import resume_pipeline.auth as auth_module
    from resume_pipeline.config import settings

    monkeypatch.setattr(settings, "SECRET_KEY", "")
    monkeypatch.setattr(settings, "APP_ENV", "development")
    monkeypatch.setattr(auth_module, "_EPHEMERAL_SECRET_KEY", None)
    monkeypatch.setattr(auth_module, "_EPHEMERAL_WARNED", False)

    token = auth_module.create_access_token({"sub": "71"})
    payload = auth_module.decode_access_token(token)
    assert payload["sub"] == "71"
    # Ephemeral key is per-boot random, stable within the process.
    assert auth_module._EPHEMERAL_SECRET_KEY
    assert auth_module._active_secret_key() == auth_module._EPHEMERAL_SECRET_KEY


def test_jwt_refuses_weak_secret_in_production(monkeypatch):
    import resume_pipeline.auth as auth_module
    from resume_pipeline.config import settings

    monkeypatch.setattr(settings, "SECRET_KEY", "too-short")
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(auth_module, "_EPHEMERAL_SECRET_KEY", None)
    monkeypatch.setattr(auth_module, "_EPHEMERAL_WARNED", False)

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        auth_module.create_access_token({"sub": "71"})


# ---------------------------------------------------------------------------
# H2/H3: Google OAuth — signed state + single-use exchange (no JWT in URL)
# ---------------------------------------------------------------------------

@pytest.fixture(name="oauth_client")
def fixture_oauth_client(env, monkeypatch):
    from resume_pipeline.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://frontend.test")
    monkeypatch.setattr(settings, "BACKEND_URL", "http://backend.test")

    def override_get_db():
        try:
            yield env["db"]
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_oauth_state_round_trip_and_tamper_rejected():
    from resume_pipeline.routers.auth.oauth import sign_oauth_state, verify_oauth_state

    state = sign_oauth_state("employer")
    assert verify_oauth_state(state) == "employer"

    # Role escalation via client-asserted state is rejected.
    tampered = "role:employer"
    with pytest.raises(ValueError):
        verify_oauth_state(tampered)
    forged = state.rsplit(":", 1)[0] + ":0" * 64
    with pytest.raises(ValueError):
        verify_oauth_state(forged)

    # Expired state is rejected (craft an old-but-validly-signed token).
    import hashlib
    import hmac as hmac_lib
    import time as time_lib
    from resume_pipeline.auth import _active_secret_key
    old_ts = str(int(time_lib.time()) - 3600)
    body = f"student:{old_ts}:deadbeef01"
    sig = hmac_lib.new(
        _active_secret_key().encode("utf-8"), body.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    with pytest.raises(ValueError):
        verify_oauth_state(f"{body}:{sig}")


def _mock_google(monkeypatch, email="oauth.user@example.com"):
    """Stub the Google token + userinfo HTTP calls used by the callback."""
    import httpx

    class FakeResponse:
        def __init__(self, payload):
            self.status_code = 200
            self._payload = payload

        def json(self):
            return self._payload

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, data=None, timeout=None):
            assert "oauth2.googleapis.com/token" in url
            return FakeResponse({"access_token": "google-access-token"})

        async def get(self, url, headers=None, timeout=None):
            assert "googleapis.com/oauth2" in url
            return FakeResponse({"email": email, "name": "OAuth User"})

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)


def test_oauth_callback_issues_exchange_not_token(oauth_client, env, monkeypatch):
    from resume_pipeline.routers.deps import rate_limiting_storage
    rate_limiting_storage.clear()
    _mock_google(monkeypatch)

    from resume_pipeline.routers.auth.oauth import sign_oauth_state
    state = sign_oauth_state("student")
    resp = oauth_client.get(
        "/api/auth/google/callback", params={"code": "authcode123", "state": state},
        follow_redirects=False,
    )
    assert resp.status_code in (302, 303, 307)
    location = resp.headers["location"]
    assert "exchange=" in location
    # No JWT in the URL.
    assert "token=" not in location.split("exchange=")[0]

    code = location.split("exchange=")[1].split("&")[0]
    # Exchange the code for a JWT via POST body.
    resp = oauth_client.post("/api/auth/google/exchange", json={"code": code})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    payload = decode_access_token(body["access_token"])
    assert payload["sub"]
    assert body["user"]["email"] == "oauth.user@example.com"

    # Single-use: replaying the code fails.
    resp = oauth_client.post("/api/auth/google/exchange", json={"code": code})
    assert resp.status_code == 400

    # The minted JWT authenticates normally (role preserved from state).
    from resume_pipeline.auth import get_current_user
    from resume_pipeline.db import User as UserModel

    def override_user():
        return env["db"].query(UserModel).filter(
            UserModel.email == "oauth.user@example.com"
        ).first()

    app.dependency_overrides[get_current_user] = override_user
    try:
        me = oauth_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        assert me.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_oauth_callback_rejects_tampered_state(oauth_client, monkeypatch):
    _mock_google(monkeypatch)
    resp = oauth_client.get(
        "/api/auth/google/callback",
        params={"code": "authcode123", "state": "role:employer"},
        follow_redirects=False,
    )
    assert resp.status_code in (302, 303, 307)
    assert "error=" in resp.headers["location"]
    assert "token=" not in resp.headers["location"]


def test_oauth_login_issues_signed_state(oauth_client):
    resp = oauth_client.get(
        "/api/auth/google/login", params={"role": "employer"}, follow_redirects=False
    )
    assert resp.status_code in (302, 303, 307)
    location = resp.headers["location"]
    assert "accounts.google.com" in location
    import urllib.parse as urlparse

    state = urlparse.parse_qs(urlparse.urlparse(location).query)["state"][0]
    from resume_pipeline.routers.auth.oauth import verify_oauth_state
    assert verify_oauth_state(state) == "employer"


# ---------------------------------------------------------------------------
# H3: resume preview — session JWTs rejected in ?token=, preview grants work
# ---------------------------------------------------------------------------

@pytest.fixture(name="preview_client")
def fixture_preview_client(env, tmp_path):
    from resume_pipeline.db import Upload

    pdf = tmp_path / "resume.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake resume content")
    db = env["db"]
    applicant = db.query(Applicant).filter_by(user_id=71).first()
    db.add(Upload(
        applicant_id=applicant.id, file_name="resume.pdf",
        file_type="resume", storage_path=str(pdf),
    ))
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    from resume_pipeline.auth import get_current_user, get_current_user_optional
    from resume_pipeline.db import User as UserModel

    def override_user():
        return db.query(UserModel).filter(UserModel.id == 71).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_current_user_optional] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_preview_rejects_session_jwt_in_url(env, preview_client):
    from resume_pipeline.auth import get_current_user_optional
    from resume_pipeline.db import User as UserModel

    db = env["db"]
    logged_in = lambda: db.query(UserModel).filter(UserModel.id == 71).first()  # noqa: E731

    # Simulate "no Authorization header" so only ?token= is evaluated.
    app.dependency_overrides[get_current_user_optional] = lambda: None  # noqa: E731
    try:
        session_token = create_access_token({"sub": "71"})
        resp = preview_client.get(
            "/api/student/resume/preview", params={"token": session_token}
        )
        assert resp.status_code == 401

        # Anonymous with no token at all is also rejected.
        assert preview_client.get("/api/student/resume/preview").status_code == 401
    finally:
        app.dependency_overrides[get_current_user_optional] = logged_in


def test_preview_token_grant_flow(preview_client):
    from resume_pipeline.auth import get_current_user_optional

    # Mint a short-lived preview grant as the logged-in student.
    resp = preview_client.post("/api/student/resume/preview-token")
    assert resp.status_code == 200
    grant = resp.json()["preview_token"]
    payload = decode_access_token(grant)
    assert payload.get("purpose") == "resume_preview"

    # Use the grant via ?token= with no Authorization header.
    app.dependency_overrides[get_current_user_optional] = lambda: None  # noqa: E731
    resp = preview_client.get(
        "/api/student/resume/preview", params={"token": grant}
    )
    assert resp.status_code == 200

