"""
P0.1 security-perimeter regression tests.

Covers:
- /api/applicants            : admin-only
- /api/applicant/{id}        : authenticated + ownership (student=own, employer=applied-pipeline, admin=any)
- /parse/{id}                : authenticated + ownership (owner student / admin only)
- /api/parse/status/{id}     : owner student / admin only
- /api/stats                 : admin-only
- /api/search/semantic       : employer/admin only
- /api/job-recommendation/{rec_id}/status : ownership enforced, 404 (not 500) for missing rec,
                                            invalid status -> 400
"""
import sys
import pytest
from unittest.mock import patch
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure package is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_current_user_optional, get_db
from resume_pipeline.auth import get_current_user
from resume_pipeline.interview.router import get_db as interview_get_db
from resume_pipeline.db import (
    Base, User, Applicant, Employer, Job, JobApplication, JobRecommendation,
)

DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

OWNER_STUDENT_ID = 1      # student who owns applicant A
OTHER_STUDENT_ID = 2      # unrelated student
EMPLOYER_USER_ID = 3      # employer with a job applicant A applied to
UNRELATED_EMPLOYER_ID = 4 # employer with no relationship to applicant A
ADMIN_ID = 5


def _make_users(db):
    specs = [
        (OWNER_STUDENT_ID, "owner@example.com", "student"),
        (OTHER_STUDENT_ID, "other@example.com", "student"),
        (EMPLOYER_USER_ID, "employer@example.com", "employer"),
        (UNRELATED_EMPLOYER_ID, "employer2@example.com", "employer"),
        (ADMIN_ID, "admin@example.com", "admin"),
    ]
    for uid, email, role in specs:
        db.add(User(
            id=uid, email=email, password_hash="fakehash",
            role=role, name=f"User {uid}", is_active=True, is_verified=True,
        ))
    db.commit()


@pytest.fixture(name="db_session")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        _make_users(db)

        applicant_a = Applicant(
            user_id=OWNER_STUDENT_ID, applicant_id="app_owneraaaa",
            display_name="Applicant A",
        )
        applicant_b = Applicant(
            user_id=OTHER_STUDENT_ID, applicant_id="app_otherbbbb",
            display_name="Applicant B",
        )
        db.add_all([applicant_a, applicant_b])
        db.flush()

        emp1 = Employer(user_id=EMPLOYER_USER_ID, company_name="Linked Co")
        emp2 = Employer(user_id=UNRELATED_EMPLOYER_ID, company_name="Unrelated Co")
        db.add_all([emp1, emp2])
        db.flush()

        job = Job(employer_id=emp1.id, title="Backend Dev", status="approved")
        db.add(job)
        db.flush()

        # applicant A applied to employer 1's job -> legitimate employer access
        db.add(JobApplication(applicant_id=applicant_a.id, job_id=job.id))
        # recommendation owned by applicant A on that job
        rec = JobRecommendation(
            applicant_id=applicant_a.id, job_id=job.id, score=0.9, status="recommended"
        )
        db.add(rec)
        db.commit()

        yield {
            "db": db,
            "applicant_a_id": applicant_a.id,
            "applicant_b_id": applicant_b.id,
            "rec_id": rec.id,
            "employer_job_id": job.id,
        }
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def _override_get_db(db_session):
    def override():
        try:
            yield db_session["db"]
        finally:
            pass
    return override


@pytest.fixture(name="anon_client")
def fixture_anon_client(db_session):
    app.dependency_overrides[get_db] = _override_get_db(db_session)
    app.dependency_overrides[interview_get_db] = _override_get_db(db_session)
    # NOTE: get_current_user intentionally NOT overridden -> anonymous requests
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_client")
def fixture_auth_client(db_session):
    """Client whose current-user can be switched per request via header-independent helper."""
    state = {"user_id": OWNER_STUDENT_ID}

    def override_get_current_user():
        return db_session["db"].query(User).filter(User.id == state["user_id"]).first()

    app.dependency_overrides[get_db] = _override_get_db(db_session)
    app.dependency_overrides[interview_get_db] = _override_get_db(db_session)
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_current_user_optional] = override_get_current_user

    client = TestClient(app)
    client.current_user_state = state  # type: ignore[attr-defined]
    yield client
    app.dependency_overrides.clear()


def login_as(client, user_id):
    client.current_user_state["user_id"] = user_id  # type: ignore[attr-defined]


# ------------------------------------------------------------------
# /api/applicants — admin only
# ------------------------------------------------------------------

def test_applicants_list_rejects_anonymous(anon_client):
    assert anon_client.get("/api/applicants").status_code == 401


def test_applicants_list_forbids_student(auth_client):
    login_as(auth_client, OWNER_STUDENT_ID)
    assert auth_client.get("/api/applicants").status_code == 403


def test_applicants_list_allows_admin(auth_client):
    login_as(auth_client, ADMIN_ID)
    resp = auth_client.get("/api/applicants")
    assert resp.status_code == 200
    assert len(resp.json()["applicants"]) == 2


# ------------------------------------------------------------------
# /api/applicant/{id} — ownership matrix
# ------------------------------------------------------------------

def test_applicant_detail_rejects_anonymous(anon_client, db_session):
    aid = db_session["applicant_a_id"]
    assert anon_client.get(f"/api/applicant/{aid}").status_code == 401


def test_applicant_detail_owner_can_read(auth_client, db_session):
    login_as(auth_client, OWNER_STUDENT_ID)
    aid = db_session["applicant_a_id"]
    resp = auth_client.get(f"/api/applicant/{aid}")
    assert resp.status_code == 200
    assert resp.json()["applicant"]["display_name"] == "Applicant A"


def test_applicant_detail_other_student_denied(auth_client, db_session):
    login_as(auth_client, OTHER_STUDENT_ID)
    aid = db_session["applicant_a_id"]
    assert auth_client.get(f"/api/applicant/{aid}").status_code == 403


def test_applicant_detail_related_employer_allowed(auth_client, db_session):
    login_as(auth_client, EMPLOYER_USER_ID)
    aid = db_session["applicant_a_id"]
    assert auth_client.get(f"/api/applicant/{aid}").status_code == 200


def test_applicant_detail_unrelated_employer_denied(auth_client, db_session):
    login_as(auth_client, UNRELATED_EMPLOYER_ID)
    aid = db_session["applicant_a_id"]
    assert auth_client.get(f"/api/applicant/{aid}").status_code == 403


def test_applicant_detail_admin_allowed(auth_client, db_session):
    login_as(auth_client, ADMIN_ID)
    aid = db_session["applicant_b_id"]
    assert auth_client.get(f"/api/applicant/{aid}").status_code == 200


def test_applicant_detail_missing_returns_404(auth_client):
    login_as(auth_client, ADMIN_ID)
    assert auth_client.get("/api/applicant/999999").status_code == 404


def test_applicant_detail_external_uuid_lookup_scoped(auth_client, db_session):
    login_as(auth_client, OTHER_STUDENT_ID)
    resp = auth_client.get("/api/applicant/app_owneraaaa")
    assert resp.status_code == 403


# ------------------------------------------------------------------
# /parse/{id} — paid LLM trigger requires ownership
# ------------------------------------------------------------------

def test_parse_rejects_anonymous(anon_client):
    assert anon_client.post("/parse/app_owneraaaa").status_code == 401


def test_parse_non_owner_student_denied(auth_client):
    login_as(auth_client, OTHER_STUDENT_ID)
    resp = auth_client.post("/parse/app_owneraaaa")
    assert resp.status_code == 403


def test_parse_unrelated_employer_denied(auth_client):
    login_as(auth_client, EMPLOYER_USER_ID)
    resp = auth_client.post("/parse/app_owneraaaa")
    assert resp.status_code == 403


def test_parse_owner_passes_guard(auth_client):
    # Guard passes; downstream storage lookup 404s in the test environment
    login_as(auth_client, OWNER_STUDENT_ID)
    from resume_pipeline.config import settings
    with patch.object(settings, "STORAGE_BACKEND", "local"):
        resp = auth_client.post("/parse/app_owneraaaa")
    assert resp.status_code != 403 and resp.status_code != 401


# ------------------------------------------------------------------
# /api/parse/status/{id}
# ------------------------------------------------------------------

def test_parse_status_other_student_denied(auth_client):
    login_as(auth_client, OTHER_STUDENT_ID)
    assert auth_client.get("/api/parse/status/app_owneraaaa").status_code == 403


def test_parse_status_owner_allowed(auth_client):
    login_as(auth_client, OWNER_STUDENT_ID)
    resp = auth_client.get("/api/parse/status/app_owneraaaa")
    assert resp.status_code == 200
    assert resp.json()["applicant_id"] == "app_owneraaaa"


# ------------------------------------------------------------------
# /api/stats — admin only
# ------------------------------------------------------------------

def test_stats_rejects_anonymous(anon_client):
    assert anon_client.get("/api/stats").status_code == 401


def test_stats_forbids_student(auth_client):
    login_as(auth_client, OWNER_STUDENT_ID)
    assert auth_client.get("/api/stats").status_code == 403


def test_stats_allows_admin(auth_client):
    login_as(auth_client, ADMIN_ID)
    assert auth_client.get("/api/stats").status_code == 200


# ------------------------------------------------------------------
# /api/search/semantic — employer/admin only
# ------------------------------------------------------------------

def test_semantic_search_rejects_anonymous(anon_client):
    resp = anon_client.post("/api/search/semantic", json={"query": "python"})
    assert resp.status_code == 401


def test_semantic_search_forbids_student(auth_client):
    login_as(auth_client, OWNER_STUDENT_ID)
    resp = auth_client.post("/api/search/semantic", json={"query": "python"})
    assert resp.status_code == 403


def test_semantic_search_allows_employer(auth_client):
    login_as(auth_client, EMPLOYER_USER_ID)
    resp = auth_client.post(
        "/api/search/semantic", json={"query": "backend", "entity_type": "job"}
    )
    assert resp.status_code == 200


# ------------------------------------------------------------------
# /api/job-recommendation/{rec_id}/status — BOLA + error paths
# ------------------------------------------------------------------

def _patch_status(client, rec_id, payload):
    return client.patch(
        f"/api/job-recommendation/{rec_id}/status",
        json=payload,
    )


def test_rec_status_owner_can_update(auth_client, db_session):
    login_as(auth_client, OWNER_STUDENT_ID)
    resp = _patch_status(auth_client, db_session["rec_id"], {"status": "applied"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "applied"


def test_rec_status_non_owner_student_denied(auth_client, db_session):
    login_as(auth_client, OTHER_STUDENT_ID)
    resp = _patch_status(auth_client, db_session["rec_id"], {"status": "applied"})
    assert resp.status_code == 403


def test_rec_status_employer_denied(auth_client, db_session):
    login_as(auth_client, EMPLOYER_USER_ID)
    resp = _patch_status(auth_client, db_session["rec_id"], {"status": "applied"})
    assert resp.status_code == 403


def test_rec_status_missing_returns_404_not_500(auth_client):
    login_as(auth_client, OWNER_STUDENT_ID)
    resp = _patch_status(auth_client, 987654321, {"status": "applied"})
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Applicant not found"


def test_rec_status_invalid_value_returns_400(auth_client, db_session):
    login_as(auth_client, OWNER_STUDENT_ID)
    resp = _patch_status(auth_client, db_session["rec_id"], {"status": "not-a-status"})
    assert resp.status_code == 400


def test_rec_status_invalid_transition_returns_400(auth_client, db_session):
    login_as(auth_client, OWNER_STUDENT_ID)
    resp = _patch_status(auth_client, db_session["rec_id"], {"status": "accepted"})
    assert resp.status_code == 400


# ------------------------------------------------------------------
# /api/admin/stats — P1.2
# ------------------------------------------------------------------

def test_admin_stats_forbids_student(auth_client):
    login_as(auth_client, OWNER_STUDENT_ID)
    assert auth_client.get("/api/admin/stats").status_code == 403


def test_admin_stats_returns_real_counts(auth_client, db_session):
    login_as(auth_client, ADMIN_ID)
    resp = auth_client.get("/api/admin/stats")
    assert resp.status_code == 200
    data = resp.json()
    # 5 seeded users: 4 active + none suspended by default
    assert data["total_users"] == 5
    assert data["active_users"] == 5
    assert data["suspended_users"] == 0
    assert data["flagged_users"] >= 0


# ------------------------------------------------------------------
# P1.5 — Employer/applicant relationship enforcement
# ------------------------------------------------------------------

def test_schedule_interview_unrelated_employer_denied(auth_client, db_session):
    login_as(auth_client, UNRELATED_EMPLOYER_ID)
    resp = auth_client.post("/api/interviews/schedule", json={
        "applicant_id": db_session["applicant_a_id"],
        "interview_type": "technical",
        "format": "video",
        "duration": 45,
        "date_time": "2026-09-01T10:00:00",
        "interviewers": [],
    })
    assert resp.status_code == 403


def test_schedule_interview_related_employer_allowed(auth_client, db_session):
    login_as(auth_client, EMPLOYER_USER_ID)
    resp = auth_client.post("/api/interviews/schedule", json={
        "applicant_id": db_session["applicant_a_id"],
        "interview_type": "technical",
        "format": "video",
        "duration": 45,
        "date_time": "2026-09-01T10:00:00",
        "interviewers": [],
    })
    assert resp.status_code == 200


def test_feedback_unrelated_employer_denied(auth_client, db_session):
    login_as(auth_client, UNRELATED_EMPLOYER_ID)
    resp = auth_client.post(
        f"/api/employer/applicants/{db_session['applicant_a_id']}/feedback",
        json={"scores": {"technical": 4}, "decision": "strong_yes"},
    )
    assert resp.status_code == 403


def test_feedback_related_employer_allowed(auth_client, db_session):
    login_as(auth_client, EMPLOYER_USER_ID)
    resp = auth_client.post(
        f"/api/employer/applicants/{db_session['applicant_a_id']}/feedback",
        json={"scores": {"technical": 4}, "decision": "strong_yes"},
    )
    assert resp.status_code == 200


def test_candidate_intelligence_unrelated_employer_denied(auth_client, db_session):
    login_as(auth_client, UNRELATED_EMPLOYER_ID)
    resp = auth_client.get(f"/api/interview/candidate-intelligence/{db_session['applicant_a_id']}")
    assert resp.status_code == 403


def test_candidate_intelligence_related_employer_allowed(auth_client, db_session):
    login_as(auth_client, EMPLOYER_USER_ID)
    resp = auth_client.get(f"/api/interview/candidate-intelligence/{db_session['applicant_a_id']}")
    assert resp.status_code in (200, 404)  # 404 only if no profile exists yet

