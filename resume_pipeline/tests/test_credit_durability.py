"""
P1.3 credit-economy durability regression tests.

Covers:
- spend_credits atomically decrements and logs a transaction
- spend_credits refuses (raises InsufficientCreditsError) when balance is too low
- concurrent double-spend is impossible (second spend raises, no negative balance)
- check_and_deduct_credits atomic failure path
- refund_credits restores the balance
- recommendation-bypass refund on generation failure (API level)
"""
import sys
import threading
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from resume_pipeline.app import app, get_db
from resume_pipeline.auth import get_current_user
from resume_pipeline.db import (
    Base, User, Applicant, CreditAccount, CreditTransaction,
)
from resume_pipeline.core.credit_service import (
    CreditService, InsufficientCreditsError,
)

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

STUDENT_ID = 21


@pytest.fixture(name="env")
def fixture_env():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        user = User(
            id=STUDENT_ID, email="credits@example.com", password_hash="x",
            role="student", name="Credit Test", is_active=True, is_verified=True,
        )
        applicant = Applicant(
            user_id=STUDENT_ID, applicant_id="app_credittest", display_name="Credit Test"
        )
        db.add_all([user, applicant])
        db.flush()
        # Parsed record required by several credit-gated endpoints.
        from resume_pipeline.db import LLMParsedRecord
        db.add(LLMParsedRecord(applicant_id=applicant.id, raw_llm_output={}, normalized={}))
        account = CreditAccount(
            applicant_id=applicant.id, current_credits=10, total_earned=10,
            next_refill_at=__import__("datetime").datetime.utcnow()
            + __import__("datetime").timedelta(days=7),
        )
        db.add(account)
        db.commit()
        yield {"db": db, "applicant": applicant, "account": account}
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_spend_credits_deducts_and_logs(env):
    svc = CreditService(env["db"])
    tx = svc.spend_credits(env["applicant"].id, "micro_session", 4, description="test")
    assert env["db"].refresh(env["account"]) is None
    assert env["account"].current_credits == 6
    assert tx.amount == -4
    assert tx.balance_after == 6


def test_spend_credits_insufficient_raises_without_negative_balance(env):
    svc = CreditService(env["db"])
    with pytest.raises(InsufficientCreditsError):
        svc.spend_credits(env["applicant"].id, "micro_session", 99)
    env["db"].expire(env["account"])
    assert env["account"].current_credits == 10  # untouched


def test_concurrent_double_spend_is_prevented():
    """Two threads race to spend 8 credits from a 10-credit balance.

    Exactly one must win; the balance must never go negative.
    Uses a file-backed SQLite so each session gets its own connection
    (StaticPool would serialize them onto a single connection).
    """
    import tempfile
    import uuid as _uuid
    from resume_pipeline.db import Base as _Base

    tmp = Path(tempfile.gettempdir()) / f"cg_credits_{_uuid.uuid4().hex}.db"
    file_engine = create_engine(f"sqlite:///{tmp.as_posix()}")
    FileSession = sessionmaker(autocommit=False, autoflush=False, bind=file_engine)
    _Base.metadata.create_all(bind=file_engine)

    try:
        setup_db = FileSession()
        user = User(
            id=31, email="race@example.com", password_hash="x",
            role="student", name="Race", is_active=True, is_verified=True,
        )
        applicant = Applicant(user_id=31, applicant_id="app_race", display_name="Race")
        setup_db.add_all([user, applicant])
        setup_db.flush()
        import datetime as _dt
        setup_db.add(CreditAccount(
            applicant_id=applicant.id, current_credits=10, total_earned=10,
            next_refill_at=_dt.datetime.utcnow() + _dt.timedelta(days=7),
        ))
        setup_db.commit()
        applicant_id = applicant.id
        setup_db.close()

        results = {"success": 0, "insufficient": 0}

        def worker():
            own_db = FileSession()
            try:
                svc = CreditService(own_db)
                svc.spend_credits(applicant_id, "micro_session", 8)
                results["success"] += 1
            except InsufficientCreditsError:
                results["insufficient"] += 1
            except Exception:
                results["insufficient"] += 1
            finally:
                own_db.close()

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert results["success"] == 1
        assert results["insufficient"] == 1

        check_db = FileSession()
        bal = check_db.query(CreditAccount).filter_by(applicant_id=applicant_id).first()
        assert bal.current_credits == 2
        check_db.close()
    finally:
        file_engine.dispose()
        import gc
        gc.collect()
        for _ in range(3):
            try:
                tmp.unlink()
                break
            except PermissionError:
                import time
                time.sleep(0.2)


def test_check_and_deduct_atomic_failure(env):
    svc = CreditService(env["db"])
    ok, err = svc.check_and_deduct_credits(env["applicant"].id, "full_interview", 50)
    assert not ok and err and "Insufficient" in err
    env["db"].expire(env["account"])
    assert env["account"].current_credits == 10

    ok, err = svc.check_and_deduct_credits(env["applicant"].id, "full_interview", 7)
    assert ok and err is None
    env["db"].expire(env["account"])
    assert env["account"].current_credits == 3


def test_refund_restores_balance(env):
    svc = CreditService(env["db"])
    svc.check_and_deduct_credits(env["applicant"].id, "full_interview", 6)
    env["db"].expire(env["account"])
    assert env["account"].current_credits == 4

    tx = svc.refund_credits(env["applicant"].id, 6, reason="generation failed")
    env["db"].expire(env["account"])
    assert env["account"].current_credits == 10
    assert tx.transaction_type == "refund"


# ---------------------------------------------------------------------------
# API-level: bypass cooldown refunds on failure
# ---------------------------------------------------------------------------

@pytest.fixture(name="authed_client")
def fixture_authed_client(env):
    def override_get_db():
        try:
            yield env["db"]
        finally:
            pass

    def override_user():
        return env["db"].query(User).filter(User.id == STUDENT_ID).first()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_bypass_cooldown_refunds_on_generation_failure(authed_client, env, monkeypatch):
    from datetime import datetime

    # Put the applicant into cooldown so the bypass path activates.
    from resume_pipeline.db import JobRecommendation, Employer, Job
    employer = Employer(company_name="Refund Co")
    env["db"].add(employer)
    env["db"].flush()
    job = Job(employer_id=employer.id, title="Dev", status="approved")
    env["db"].add(job)
    env["db"].flush()
    env["db"].add(JobRecommendation(
        applicant_id=env["applicant"].id, job_id=job.id, score=0.5,
        computed_at=datetime.utcnow(), status="recommended",
    ))
    env["db"].commit()

    class FakeService:
        def __init__(self, db):
            pass

        def get_recommendations(self, applicant_id):
            raise RuntimeError("LLM provider down")

    import resume_pipeline.recommendation.recommendation_service as rec_service_module
    monkeypatch.setattr(rec_service_module, "RecommendationService", FakeService)

    resp = authed_client.post(
        f"/api/applicant/{env['applicant'].id}/generate-recommendations?bypass_cooldown=true"
    )
    assert resp.status_code == 500

    env["db"].expire(env["account"])
    # 10 - 5 (bypass) + 5 (refund) = 10
    assert env["account"].current_credits == 10
