"""PATCH /api/auth/profile persists name/phone/location (no silent discards)."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_current_user, get_current_user_optional, get_db
from resume_pipeline.db import Base, User, Applicant

DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        db.add(
            User(
                id=1001,
                email="profile_patch@example.com",
                password_hash="fakehash",
                role="student",
                name="Old Name",
                is_active=True,
                is_verified=True,
            )
        )
        db.add(
            Applicant(
                id=1001,
                user_id=1001,
                applicant_id="app_test_patch",
                display_name="Old Name",
            )
        )
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
        return db_session.query(User).filter(User.id == 1001).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_user_optional] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_update_profile_name_only_still_works(client, db_session):
    """Backward compat: legacy {"name": ...} clients keep working."""
    response = client.patch("/api/auth/profile", json={"name": "New Name"})
    assert response.status_code == 200
    assert db_session.query(User).filter(User.id == 1001).first().name == "New Name"


def test_update_profile_persists_phone_and_location(client, db_session):
    response = client.patch(
        "/api/auth/profile",
        json={"name": "New Name", "phone": "+911234567890", "location": "Bengaluru"},
    )
    assert response.status_code == 200
    user = db_session.query(User).filter(User.id == 1001).first()
    applicant = db_session.query(Applicant).filter(Applicant.user_id == 1001).first()
    assert user.phone == "+911234567890"
    assert applicant.location_city == "Bengaluru"
    assert user.name == "New Name"


def test_update_profile_omitted_fields_untouched(client, db_session):
    client.patch("/api/auth/profile", json={"phone": "+919999999999"})
    user = db_session.query(User).filter(User.id == 1001).first()
    assert user.phone == "+919999999999"
    assert user.name == "Old Name"
