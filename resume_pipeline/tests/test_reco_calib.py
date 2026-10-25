"""Recommendation recalibration tests: replace-on-persist + display normalization.

Fix 1 — persist replaces per applicant: recomputing must delete the
applicant's existing JobRecommendation rows before inserting the fresh set
(stale high rows must never shadow fresh ones for the top-by-score read).

Fix 2 — display normalization: persisted scores are min-max scaled to 0-100
(top = 100) so runs from different scorer mixes are comparable. Scaling is
monotonic, so ranking order is unchanged (verified on the golden fixture).
"""
import datetime
import json
import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from resume_pipeline.db import Applicant, Base, Employer, Job, JobRecommendation
from resume_pipeline.recommendation.reranking import (
    normalize_display_scores,
    persist_recommendations,
)


@pytest.fixture(name="db")
def fixture_db():
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def _make_applicant(db, tag):
    applicant = Applicant(applicant_id=f"app_calib_{tag}", display_name=f"Calib {tag}")
    db.add(applicant)
    db.flush()
    return applicant


def _make_job(db, employer, title):
    job = Job(employer_id=employer.id, title=title, status="approved",
              expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=30))
    db.add(job)
    db.flush()
    return job


def _entry(job, score):
    return {
        "job": job,
        "breakdown": {"final_score": score / 100.0},
        "score": score,
        "base_score": score,
        "gap_signal": 0.0,
        "missing_skills": [],
        "explanation": f"Offline match for {job.title}.",
        "explanation_source": "offline_fallback",
        "is_fallback": True,
        "fallback_source": "explainer",
        "explain_compat": {"reasons": [f"Offline match for {job.title}."]},
    }


def _scores_for(db, applicant_id):
    rows = (
        db.query(JobRecommendation)
        .filter(JobRecommendation.applicant_id == applicant_id)
        .order_by(JobRecommendation.score.desc())
        .all()
    )
    return [(r.job_id, r.score) for r in rows]


def test_recompute_replaces_stale_rows(db):
    """Recomputing twice leaves exactly one generation of rows per applicant."""
    employer = Employer(company_name="Calib Co")
    db.add(employer)
    db.flush()
    applicant = _make_applicant(db, "replace")
    jobs = [_make_job(db, employer, f"Role {i}") for i in range(4)]
    db.commit()

    # First generation: jobs 0-2.
    persist_recommendations(applicant, [_entry(j, s) for j, s in
                                       zip(jobs[:3], (88.0, 77.0, 66.0))], db)
    assert len(_scores_for(db, applicant.id)) == 3

    # Simulate a stale high row from an older run (job outside the fresh set).
    db.add(JobRecommendation(applicant_id=applicant.id, job_id=jobs[3].id,
                             score=99.9, computed_at=datetime.datetime.utcnow(),
                             engine_version="v2"))
    db.commit()
    assert len(_scores_for(db, applicant.id)) == 4

    # Second generation: jobs 1-3 only. Stale rows must not survive.
    persist_recommendations(applicant, [_entry(j, s) for j, s in
                                       zip(jobs[1:], (70.0, 65.0, 60.0))], db)
    rows = _scores_for(db, applicant.id)
    assert [job_id for job_id, _ in rows] == [jobs[1].id, jobs[2].id, jobs[3].id]
    assert len(rows) == 3


def test_recompute_does_not_touch_other_applicants(db):
    employer = Employer(company_name="Calib Co")
    db.add(employer)
    db.flush()
    applicant_a = _make_applicant(db, "a")
    applicant_b = _make_applicant(db, "b")
    jobs = [_make_job(db, employer, f"Role {i}") for i in range(3)]
    db.commit()

    persist_recommendations(applicant_a, [_entry(jobs[0], 80.0)], db)
    persist_recommendations(applicant_b, [_entry(j, s) for j, s in
                                         zip(jobs, (90.0, 80.0, 70.0))], db)
    # Recompute A with a smaller set; B's rows must be untouched.
    persist_recommendations(applicant_a, [_entry(jobs[2], 75.0)], db)
    assert [job_id for job_id, _ in _scores_for(db, applicant_a.id)] == [jobs[2].id]
    assert [job_id for job_id, _ in _scores_for(db, applicant_b.id)] == [
        jobs[0].id, jobs[1].id, jobs[2].id]


def test_single_persist_leaves_one_generation(db):
    """One persist call (including the null-explanation retry) leaves one computed_at."""
    employer = Employer(company_name="Calib Co")
    db.add(employer)
    db.flush()
    applicant = _make_applicant(db, "onegeneration")
    jobs = [_make_job(db, employer, f"Role {i}") for i in range(8)]
    db.commit()

    # Mimic attach_explanations output: top-N carry explanations, the rest are
    # null and get backfilled by the retry inside persist_recommendations.
    entries = [_entry(j, s) for j, s in
               zip(jobs, (90.0, 88.0, 86.0, 84.0, 82.0, 80.0, 78.0, 76.0))]
    for e in entries[5:]:
        e["explanation"] = None
        e["explanation_source"] = None
    persist_recommendations(applicant, entries, db)

    timestamps = {
        r.computed_at
        for r in db.query(JobRecommendation)
        .filter(JobRecommendation.applicant_id == applicant.id)
        .all()
    }
    assert len(timestamps) == 1


@pytest.mark.parametrize("raw_scores", [
    (95.0, 92.5, 88.0, 84.2),   # TF-IDF-only scale (high cluster)
    (66.1, 63.4, 61.0, 58.8),   # semantic-mix scale (low cluster)
])
def test_persisted_scores_span_normalized_range_with_stable_order(db, raw_scores):
    """Persisted scores span 0-100 with top = 100 and unchanged ranking order."""
    employer = Employer(company_name="Calib Co")
    db.add(employer)
    db.flush()
    applicant = _make_applicant(db, f"norm_{raw_scores[0]}")
    jobs = [_make_job(db, employer, f"Role {i}") for i in range(len(raw_scores))]
    db.commit()

    entries = [_entry(j, s) for j, s in zip(jobs, raw_scores)]
    expected_order = [e["job"].id for e in entries]

    persist_recommendations(applicant, entries, db)
    rows = _scores_for(db, applicant.id)

    assert [job_id for job_id, _ in rows] == expected_order
    persisted = [score for _, score in rows]
    assert persisted[0] == 100.0
    assert persisted[-1] == 0.0
    assert persisted == sorted(persisted, reverse=True)


def test_normalize_preserves_golden_fixture_order():
    """Order-identical before/after normalization on the golden fixture."""
    golden_path = Path(__file__).parent / "golden_recommendations.json"
    golden = json.loads(golden_path.read_text())
    assert golden["applicants"], "golden fixture is empty"

    for spec in golden["applicants"]:
        ranked = spec["ranked"]
        entries = [
            {"job": type("J", (), {"id": r["job_id"]})(), "score": r["score"] * 100.0}
            for r in ranked
        ]
        before = [e["job"].id for e in entries]
        normalize_display_scores(entries)
        assert [e["job"].id for e in entries] == before
        assert entries[0]["score"] == 100.0


def test_normalize_degenerate_scores():
    assert normalize_display_scores([]) == []
    single = [{"score": 42.0}]
    assert normalize_display_scores(single) == [{"score": 100.0}]
    tied = [{"score": 70.0}, {"score": 70.0}]
    assert [e["score"] for e in normalize_display_scores(tied)] == [100.0, 100.0]
