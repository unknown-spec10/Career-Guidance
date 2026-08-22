"""
P1.4 verification/reset-code hardening regression tests.

Covers:
- verify-code brute-force lockout (5 failed attempts -> 429 + code invalidated)
- uniform responses on /api/auth/resend-verification (no account enumeration)
- uniform responses on /api/auth/forgot-password
- reset-password brute-force lockout
"""
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_db, _clear_code_attempts, _record_failed_code_attempt
from resume_pipeline.db import Base, User

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import datetime as dt


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=41, email="codes@example.com", password_hash="x",
            role="student", name="Codes", is_active=True,
            is_verified=False,
            verification_token="123456-deadbeef",
            verification_token_created_at=dt.datetime.utcnow(),
            password_reset_token="654321",
            password_reset_expires=dt.datetime.utcnow() + dt.timedelta(minutes=30),
        )
        db.add(user)
        db.commit()
        yield {"db": db}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client", autouse=True)
def fixture_client(env):
    def override_get_db():
        try:
            yield env["db"]
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_verify_code_success(env):
    resp = env and None
    client = TestClient(app)
    r = client.post("/api/auth/verify-code", json={"email": "codes@example.com", "code": "123456"})
    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_verify_code_lockout_after_five_failures(env):
    client = TestClient(app)
    for i in range(5):
        r = client.post("/api/auth/verify-code", json={"email": "codes@example.com", "code": "000000"})
        if i < 4:
            assert r.status_code == 400
        else:
            assert r.status_code == 400  # 5th failure recorded normally

    # 6th attempt hits the lockout (429), even with the CORRECT code
    r = client.post("/api/auth/verify-code", json={"email": "codes@example.com", "code": "123456"})
    assert r.status_code == 429

    # The stored code must have been invalidated by the lockout.
    user = env["db"].query(User).filter(User.email == "codes@example.com").first()
    env["db"].refresh(user)
    assert user.verification_token is None


def test_resend_verification_no_enumeration(env):
    client = TestClient(app)
    known = client.post("/api/auth/resend-verification", json={"email": "codes@example.com"})
    unknown = client.post("/api/auth/resend-verification", json={"email": "ghost@example.com"})

    # Both return 200 with the same generic message shape.
    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json() == unknown.json()


def test_forgot_password_no_enumeration(env):
    client = TestClient(app)
    known = client.post("/api/auth/forgot-password", json={"email": "codes@example.com"})
    unknown = client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


def test_reset_password_lockout_after_five_failures(env):
    client = TestClient(app)
    for i in range(6):
        r = client.post("/api/auth/reset-password", json={"code": "999999", "new_password": "newpassword1"})
        if i >= 5:
            assert r.status_code == 429  # per-IP lockout
        else:
            assert r.status_code == 400
