"""Deterministic verification of the three LLM-cost fixes (no network needed).

Run inside the backend container:  python /tmp/verify_llm_fixes.py
"""

import datetime
import os
import sys

sys.path.insert(0, "D:/Projects/CareerSync/resume_pipeline")

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from resume_pipeline.db.base import Base  # noqa: E402

engine = create_engine("sqlite+pysqlite:///:memory:")
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)
db = Session()

from resume_pipeline.db import Applicant, Job, JobRecommendation  # noqa: E402
from resume_pipeline.recommendation import ranking, reranking  # noqa: E402

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


# ---------------------------------------------------------------- fixtures
applicant = Applicant(id=1, display_name="Test Applicant", user_id=1)
job = Job(
    id=101,
    title="Backend Engineer",
    employer_id=1,
    required_skills=["Python", "FastAPI"],
    min_experience_years=2,
    status="approved",
)
db.add_all([applicant, job])
db.commit()

ENTRY = {
    "job": job,
    "breakdown": {"skills_score": 0.8, "experience_score": 0.7},
    "score": 90.0,
    "base_score": 90.0,
    "gap_signal": 0.0,
    "missing_skills": [],
}

calls = {"analysis": 0, "explanation": 0}


def fake_analysis(applicant, job, breakdown, db=None):
    calls["analysis"] += 1
    return {"reasons": "fresh reasons", "gaps": "fresh gaps", "source": "opencode"}


def fake_explanation(applicant, job, breakdown, db=None):
    calls["explanation"] += 1
    return "fresh explanation", "opencode"


reranking.generate_employer_match_analysis = fake_analysis
reranking.generate_explanation = fake_explanation
ranking.generate_explanation = fake_explanation

# ------------------------------------------------- 1. cached analysis reuse
rec = JobRecommendation(
    applicant_id=1,
    job_id=101,
    score=90.0,
    score_breakdown={"skills_score": 0.8},
    explanation="cached explanation",
    explain={
        "employer_reasons": "cached reasons",
        "employer_gaps": "cached gaps",
        "employer_analysis_source": "opencode",
    },
    engine_version="v2",
    is_fallback=False,
    computed_at=datetime.datetime.utcnow(),
)
db.add(rec)
db.commit()

calls["analysis"] = calls["explanation"] = 0
out = reranking.attach_explanations(applicant, [dict(ENTRY)], db, top_n=5)
check("cached analysis: no LLM call", calls["analysis"] == 0, f"calls={calls['analysis']}")
check("cached analysis: no explanation call", calls["explanation"] == 0, f"calls={calls['explanation']}")
check(
    "cached analysis: text reused",
    out[0]["explain_compat"]["employer_reasons"] == "cached reasons",
    str(out[0]["explain_compat"].get("employer_reasons")),
)

# --------------------------------------- 2. fallback rows are NOT cache hits
rec.is_fallback = True
db.commit()
calls["analysis"] = 0
reranking.attach_explanations(applicant, [dict(ENTRY)], db, top_n=5)
check("fallback row regenerates analysis", calls["analysis"] == 1, f"calls={calls['analysis']}")

# ------------------------------------------------- 3. retry cap on null rows
db.query(JobRecommendation).delete()
db.commit()
rec2 = JobRecommendation(
    applicant_id=1,
    job_id=101,
    score=80.0,
    score_breakdown={"explanation_attempts": ranking.MAX_EXPLANATION_ATTEMPTS},
    explanation=None,
    engine_version="v2",
    computed_at=datetime.datetime.utcnow(),
)
db.add(rec2)
db.commit()

calls["explanation"] = 0
ranking.retry_null_explanations(1, db, limit=5)
check("exhausted row is skipped", calls["explanation"] == 0, f"calls={calls['explanation']}")

rec2.score_breakdown = {"explanation_attempts": 0}
db.commit()
calls["explanation"] = 0
ranking.retry_null_explanations(1, db, limit=5)
db.refresh(rec2)
check("first attempt runs", calls["explanation"] == 1, f"calls={calls['explanation']}")
check(
    "attempt counter incremented",
    int(rec2.score_breakdown.get("explanation_attempts")) == 1,
    str(rec2.score_breakdown.get("explanation_attempts")),
)

# ------------------------------------------------------ 4. daily call budget
from resume_pipeline.config import settings  # noqa: E402
from resume_pipeline.core import llm_router  # noqa: E402

settings.LLM_MAX_CALLS_PER_DAY = 2
llm_router._budget_day = None
llm_router._budget_calls = 0

ok_calls = 0
try:
    for _ in range(2):
        llm_router._consume_call_budget()
        ok_calls += 1
    llm_router._consume_call_budget()
    check("budget raises past the limit", False, "no exception on 3rd call")
except llm_router.LLMCallBudgetExceeded:
    check("budget raises past the limit", ok_calls == 2, f"allowed={ok_calls}")

settings.LLM_MAX_CALLS_PER_DAY = 0
llm_router._budget_day = None
llm_router._budget_calls = 0
try:
    for _ in range(50):
        llm_router._consume_call_budget()
    check("0 = unlimited", True)
except Exception as exc:  # noqa: BLE001
    check("0 = unlimited", False, str(exc))

# ------------------------------------------------------------------ results
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
