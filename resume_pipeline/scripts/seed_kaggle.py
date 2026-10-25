#!/usr/bin/env python3
"""Build seed-ready JSON data files from Kaggle resume + job CSVs.

Dry-run by default: streams the (1.7GB) jobs CSV, takes a stratified sample
of tech roles, converts both sources into db.py-shaped rows, and writes them
under data/seed/. No database writes unless --load is passed.

Usage:
    python resume_pipeline/scripts/seed_kaggle.py
    python resume_pipeline/scripts/seed_kaggle.py --load   # needs reachable DB
"""

import argparse
import csv
import json
import logging
import random
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_kaggle")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Role/Title must match one of these to count as a tech role.
TECH_RE = re.compile(
    r"software|developer|engineer|data\b|machine learning|\bml\b|\bai\b|artificial intelligence"
    r"|devops|backend|frontend|full.?stack|cloud|qa\b|sdet|test|scientist|analyst"
    r"|mobile|android|ios|\bweb\b|database|system admin|network|security|ui\b|ux\b",
    re.IGNORECASE,
)

# Source Work Type values (Intern/Temporary/Full-Time/Contract/Part-Time) are
# employment types, not locations, so map deterministically onto the db enum.
WORK_TYPE_MAP = {
    "full-time": "on-site",
    "intern": "on-site",
    "temporary": "on-site",
    "part-time": "hybrid",
    "contract": "hybrid",
}
ALLOWED_WORK_TYPES = ("remote", "on-site", "hybrid")

# Resumes carry no location; rotate deterministically through Indian hubs.
INDIAN_CITIES = [
    "Bangalore", "Pune", "Delhi", "Chennai", "Hyderabad",
    "Mumbai", "Kolkata", "Ahmedabad", "Jaipur", "Kochi",
]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())[:40] or "unknown"


def split_list(raw: str) -> list:
    """Split a comma/semicolon/pipe separated cell; 'None'/'' -> [].

    Paren-aware: commas inside '(...)' (e.g. 'protocols (OAuth, JWT)')
    do not split.
    """
    if not raw or raw.strip().lower() in ("none", "nan", "null", "n/a"):
        return []
    items, buf, depth = [], "", 0
    for ch in raw.replace("\n", ";"):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch in (",", ";", "|", "/") and depth == 0:
            if buf.strip() and buf.strip().lower() != "none":
                items.append(buf.strip())
            buf = ""
        else:
            buf += ch
    if buf.strip() and buf.strip().lower() != "none":
        items.append(buf.strip())
    return items


def parse_min_experience(raw: str) -> float:
    """'5 to 15 Years' -> 5.0; '3 Years' -> 3.0; unparseable -> 0.0."""
    if not raw:
        return 0.0
    m = re.search(r"(\d+(?:\.\d+)?)", raw)
    return float(m.group(1)) if m else 0.0


def map_work_type(raw: str) -> str:
    low = (raw or "").strip().lower()
    if "remote" in low:
        return "remote"
    return WORK_TYPE_MAP.get(low, "on-site")


def skill_objs(names: list) -> list:
    """Map skill names onto db required_skills shape [{name, level}]."""
    objs = []
    for i, name in enumerate(names):
        level = "advanced" if i < 2 and len(names) > 2 else ("advanced" if i == 0 else "intermediate")
        objs.append({"name": name, "level": level})
    return objs


def is_tech_role(job_title: str, role: str) -> bool:
    return bool(TECH_RE.search(f"{job_title} {role}"))


def stream_tech_sample(jobs_path: Path, sample_jobs: int, seed: int) -> list:
    """Single streaming pass; per-Role reservoir (cap 80) then round-robin fill.

    Never holds more than ~roles*80 slim dicts in memory regardless of the
    1.6M-row input size.
    """
    rng = random.Random(seed)
    buckets: dict = defaultdict(list)
    scanned = tech_hits = 0
    keep_cols = (
        "Job Id", "Experience", "location", "Country", "Work Type",
        "Job Title", "Role", "Job Portal", "Job Description",
        "skills", "Responsibilities", "Company",
    )
    with open(jobs_path, encoding="utf-8", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            scanned += 1
            if not is_tech_role(row.get("Job Title", ""), row.get("Role", "")):
                continue
            tech_hits += 1
            key = (row.get("Role") or "Other").strip()
            slim = {c: row.get(c, "") for c in keep_cols}
            bucket = buckets[key]
            if len(bucket) < 80:
                bucket.append(slim)
            elif rng.random() < 80 / tech_hits:
                bucket[rng.randrange(80)] = slim
    # Stratified fill: round-robin over roles (alphabetical = deterministic).
    roles = sorted(buckets)
    for b in buckets.values():
        rng.shuffle(b)
    sampled, idx = [], 0
    while len(sampled) < sample_jobs and any(buckets[r][idx:] for r in roles):
        for r in roles:
            if len(sampled) >= sample_jobs:
                break
            if idx < len(buckets[r]):
                sampled.append((r, buckets[r][idx]))
        idx += 1
    logger.info(f"scanned={scanned} tech_hits={tech_hits} roles={len(roles)} sampled={len(sampled)}")
    return sampled


def build_job(i: int, role: str, row: dict, rng: random.Random, today) -> tuple:
    skills = [s for s in split_list(row.get("skills", "")) if len(s) >= 2][:15]
    if not skills:  # keep NOT-NULL skill shape non-empty (validated later)
        skills = [role]
    company = (row.get("Company") or "Unknown").strip() or "Unknown"
    description = (row.get("Job Description") or "").strip()
    resp = (row.get("Responsibilities") or "").strip()
    if resp and resp not in description:
        description = f"{description}\n\nResponsibilities: {resp}".strip()
    job = {
        "title": (row.get("Job Title") or role).strip(),
        "description": description,
        "location_city": (row.get("location") or "").strip() or "Remote",
        "location_state": "",
        "country": (row.get("Country") or "").strip(),
        "work_type": map_work_type(row.get("Work Type", "")),
        "min_experience_years": parse_min_experience(row.get("Experience", "")),
        "min_cgpa": round(rng.uniform(6.0, 8.5), 2),  # synthesized
        "required_skills": skill_objs(skills),
        "optional_skills": [],
        "status": "approved",
        "expires_at": (today + timedelta(days=rng.randint(30, 90))).isoformat(),
        "source": {"job_id": row.get("Job Id", ""), "role": role,
                   "portal": row.get("Job Portal", "")},
        "company_name": company,  # resolved to employer_id on --load
    }
    employer = {
        "company_name": company,
        "contact_email": f"hiring@{slug(company) or 'company'}.example.com",  # synthesized
        "location_city": job["location_city"],
        "description": f"{company} — hiring team (seeded from Kaggle jobs sample).",
    }
    return job, employer


def build_applicant(i: int, row: dict, rng: random.Random) -> tuple:
    name = (row.get("Name") or f"Candidate {i}").strip()
    key = f"app_kaggle_{i:04d}"
    email = f"{slug(name)}{i}@example.com"  # synthesized
    phone = f"+91-9{rng.randint(100000000, 999999999)}"  # synthesized
    city = INDIAN_CITIES[(i - 1) % len(INDIAN_CITIES)]  # synthesized (no source location)
    skills = split_list(row.get("Skills", ""))
    certs = split_list(row.get("Certifications", ""))
    prev = split_list(row.get("Previous_Job_Titles", ""))
    curr = (row.get("Current_Job_Title") or "").strip()
    curr = "" if curr.lower() == "none" else curr

    applicant = {
        "applicant_key": key,
        "email": email,
        "display_name": name,
        "location_city": city,
        "location_state": "",
        "country": "India",
    }
    education = {
        "degree": (row.get("Degrees") or row.get("Education_Level") or "").strip(),
        "field": (row.get("Field_of_Study") or "").strip(),
        "institute": (row.get("Institute_Name") or "").strip(),
        "year": (row.get("Graduation_Year") or "").strip(),
    }
    if rng.random() < 0.30:  # synthesized gap-fill for ~30% of rows
        education["grade"] = round(rng.uniform(6.0, 9.8), 2)  # CGPA
    target = (row.get("Target_Job_Description") or "").strip()
    projects = []
    if target and target.lower() != "none":
        projects = [{
            "name": f"Project toward: {' '.join(target.split()[:8])}",
            "technologies": skills[:3],
        }]
    normalized = {
        "personal": {"name": name, "email": email, "phone": phone,
                     "age": (row.get("Age") or "").strip(),
                     "gender": (row.get("Gender") or "").strip()},
        "education": [education],
        "experience": {
            "years": (row.get("Experience_Years") or "").strip(),
            "current_title": curr,
            "previous_titles": prev,
        },
        "skills": [{"name": s} for s in skills],
        "projects": projects,
        "certifications": [{"name": c} for c in certs],
    }
    if rng.random() < 0.10:  # synthesized JEE-style numeric fields, ~10% of rows
        normalized["extras"] = {
            "jee_main_percentile": round(rng.uniform(85.0, 99.9), 2),
            "jee_advanced_rank": rng.randint(500, 15000),
        }
    record = {
        "applicant_key": key,
        "raw_llm_output": {"source": "kaggle_resume_dataset_1200", "row": i},
        "normalized": normalized,
        "field_confidences": {"skills": 0.9, "experience": 0.8, "education": 0.85},
        "llm_provenance": {"provider": "seed", "model": "kaggle_offline"},
        "needs_review": False,
        "parse_status": "accepted",
    }
    return applicant, record


def validate(jobs: list, applicants: list, records: list) -> dict:
    errors = []
    for j in jobs:
        for col in ("title", "description", "location_city", "work_type",
                     "min_experience_years", "required_skills", "status", "expires_at"):
            if j.get(col) in (None, "", []):
                errors.append(f"job missing {col}: {j.get('title')!r}")
        if j.get("work_type") not in ALLOWED_WORK_TYPES:
            errors.append(f"bad work_type: {j.get('work_type')!r}")
        if j.get("status") != "approved":
            errors.append(f"bad status: {j.get('status')!r}")
        try:
            datetime.fromisoformat(j["expires_at"])
        except (ValueError, TypeError):
            errors.append(f"bad expires_at: {j.get('expires_at')!r}")
        if not isinstance(j.get("min_experience_years"), (int, float)):
            errors.append(f"bad min_experience_years: {j.get('title')!r}")
    for a, r in zip(applicants, records):
        if not a.get("display_name") or not a.get("location_city"):
            errors.append(f"applicant missing name/city: {a.get('applicant_key')}")
        if r["applicant_key"] != a["applicant_key"]:
            errors.append(f"record/applicant key mismatch: {a['applicant_key']}")
        if not r["normalized"].get("skills"):
            errors.append(f"empty skills: {a['applicant_key']}")
    return {"errors": errors, "jobs": len(jobs),
            "jobs_with_skills": sum(1 for j in jobs if j.get("required_skills")),
            "applicants": len(applicants)}


def load_to_db(out_dir: Path) -> None:
    """Insert seed files into the live DB. Mirrors seed_database.py conventions.

    Idempotent: rows whose natural key already exists are skipped, so a
    re-run after a partway death resumes instead of duplicating.
    Natural keys: User.email, Employer.company_name, (Job.title,
    employer_id), Applicant.applicant_id (LLMParsedRecord/CreditAccount
    ride on the applicant row; missing children are backfilled).
    Commits in batches so partial progress persists across runs.
    """
    sys.path.insert(0, str(REPO_ROOT / "resume_pipeline"))
    from resume_pipeline.auth import get_password_hash  # noqa: E402
    from resume_pipeline.db import (  # noqa: E402
        Applicant, CreditAccount, Employer, Job, LLMParsedRecord, SessionLocal, User,
    )
    jobs = json.loads((out_dir / "jobs.json").read_text(encoding="utf-8"))
    employers = json.loads((out_dir / "employers.json").read_text(encoding="utf-8"))
    applicants = json.loads((out_dir / "applicants.json").read_text(encoding="utf-8"))
    records = {r["applicant_key"]: r for r in
               json.loads((out_dir / "llm_parsed_records.json").read_text(encoding="utf-8"))}
    db = SessionLocal()
    # One hash for all seed users (shared password) instead of ~2000 bcrypt rounds.
    pw_hash = get_password_hash("12345678")
    existing_emails = {row[0] for row in db.query(User.email).all()}
    emp_by_name = {name: eid for eid, name in
                   db.query(Employer.id, Employer.company_name).all()}
    job_keys = {(row[0], row[1]) for row in db.query(Job.title, Job.employer_id).all()}
    existing_applicant_keys = {row[0] for row in db.query(Applicant.applicant_id).all()
                               if row[0]}
    applicant_ids = {row[0]: row[1] for row in
                     db.query(Applicant.applicant_id, Applicant.id).all() if row[0]}
    record_applicants = {row[0] for row in db.query(LLMParsedRecord.applicant_id).all()}
    credited_applicants = {row[0] for row in db.query(CreditAccount.applicant_id).all()}
    seen_job_keys = set()
    stats = defaultdict(int)

    def checkpoint() -> None:
        db.commit()

    try:
        for n, e in enumerate(employers, 1):
            if e["company_name"] in emp_by_name:
                stats["employers_skipped"] += 1
                continue
            if e["contact_email"] in existing_emails:
                user = db.query(User).filter_by(email=e["contact_email"]).one()
                stats["users_skipped"] += 1
            else:
                user = User(email=e["contact_email"], password_hash=pw_hash,
                            role="employer", name=e["company_name"],
                            is_active=True, is_verified=True)
                db.add(user)
                db.flush()
                existing_emails.add(e["contact_email"])
                stats["users_inserted"] += 1
            emp = Employer(user_id=user.id, company_name=e["company_name"],
                           location_city=e["location_city"], location_state="",
                           description=e["description"], is_verified=True)
            db.add(emp)
            db.flush()
            emp_by_name[e["company_name"]] = emp.id
            stats["employers_inserted"] += 1
            if n % 200 == 0:
                checkpoint()
        checkpoint()
        for n, j in enumerate(jobs, 1):
            key = (j["title"], emp_by_name[j["employer_ref"]])
            if key in job_keys or key in seen_job_keys:
                stats["jobs_skipped"] += 1
                continue
            seen_job_keys.add(key)
            db.add(Job(employer_id=emp_by_name[j["employer_ref"]],
                       title=j["title"], description=j["description"],
                       location_city=j["location_city"], location_state="",
                       work_type=j["work_type"],
                       min_experience_years=float(j["min_experience_years"]),
                       min_cgpa=float(j["min_cgpa"]),
                       required_skills=j["required_skills"],
                       optional_skills=j["optional_skills"], status="approved",
                       expires_at=datetime.fromisoformat(j["expires_at"])))
            stats["jobs_inserted"] += 1
            if n % 500 == 0:
                checkpoint()
        checkpoint()
        for n, a in enumerate(applicants, 1):
            r = records[a["applicant_key"]]
            app_id = applicant_ids.get(a["applicant_key"])
            if app_id is None:
                if a["email"] in existing_emails:
                    user = db.query(User).filter_by(email=a["email"]).one()
                    stats["users_skipped"] += 1
                else:
                    user = User(email=a["email"], password_hash=pw_hash,
                                role="student", name=a["display_name"],
                                is_active=True, is_verified=True)
                    db.add(user)
                    db.flush()
                    existing_emails.add(a["email"])
                    stats["users_inserted"] += 1
                app = Applicant(user_id=user.id, applicant_id=a["applicant_key"],
                                display_name=a["display_name"],
                                location_city=a["location_city"], location_state="",
                                country="India",
                                preferred_locations=[a["location_city"], "Remote"])
                db.add(app)
                db.flush()
                app_id = app.id
                applicant_ids[a["applicant_key"]] = app_id
                stats["applicants_inserted"] += 1
            else:
                stats["applicants_skipped"] += 1
            if app_id not in record_applicants:
                db.add(LLMParsedRecord(applicant_id=app_id,
                                       raw_llm_output=r["raw_llm_output"],
                                       normalized=r["normalized"],
                                       field_confidences=r["field_confidences"],
                                       llm_provenance=r["llm_provenance"],
                                       needs_review=False, parse_status="accepted"))
                record_applicants.add(app_id)
                stats["records_inserted"] += 1
            else:
                stats["records_skipped"] += 1
            if app_id not in credited_applicants:
                db.add(CreditAccount(applicant_id=app_id, current_credits=60,
                                     total_earned=60, total_spent=0,
                                     last_refill_at=datetime.utcnow(),
                                     next_refill_at=datetime.utcnow() + timedelta(days=7),
                                     weekly_credit_limit=60, is_premium=False))
                credited_applicants.add(app_id)
                stats["credits_inserted"] += 1
            else:
                stats["credits_skipped"] += 1
            if n % 200 == 0:
                checkpoint()
                logger.info(f"... {n}/{len(applicants)} applicants "
                            f"(+{stats['applicants_inserted']} new)")
        checkpoint()
        logger.info(f"✓ Loaded +{stats['employers_inserted']} employers "
                    f"(skip {stats['employers_skipped']}), "
                    f"+{stats['jobs_inserted']} jobs (skip {stats['jobs_skipped']}), "
                    f"+{stats['applicants_inserted']} applicants "
                    f"(skip {stats['applicants_skipped']}), "
                    f"+{stats['records_inserted']} records "
                    f"(skip {stats['records_skipped']}), "
                    f"+{stats['credits_inserted']} credit accounts "
                    f"(skip {stats['credits_skipped']}), "
                    f"+{stats['users_inserted']} users (skip {stats['users_skipped']}).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    ap = argparse.ArgumentParser(description="Build Kaggle seed files (dry-run default).")
    ap.add_argument("--resumes", default="C:/Users/user/AppData/Local/hermes/cache/scratch/"
                    "career-datasets/resumes/resume_dataset_1200.csv")
    ap.add_argument("--jobs", default="C:/Users/user/AppData/Local/hermes/cache/scratch/"
                    "career-datasets/jobs/job_descriptions.csv")
    ap.add_argument("--sample-jobs", type=int, default=2000)
    ap.add_argument("--out-dir", default=str(REPO_ROOT / "data" / "seed"))
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--load", action="store_true",
                    help="Insert the generated files into the DB (default: dry-run).")
    args = ap.parse_args()

    rng = random.Random(args.seed)
    today = datetime.utcnow().date()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    sampled = stream_tech_sample(Path(args.jobs), args.sample_jobs, args.seed)
    jobs, employers_by_name = [], {}
    for i, (role, row) in enumerate(sampled, 1):
        job, emp = build_job(i, role, row, rng, today)
        jobs.append({k: v for k, v in job.items() if k != "company_name"} | {"employer_ref": job["company_name"]})
        employers_by_name.setdefault(job["company_name"], emp)
    employers = list(employers_by_name.values())

    applicants, records = [], []
    with open(args.resumes, encoding="utf-8", errors="replace", newline="") as f:
        for i, row in enumerate(csv.DictReader(f), 1):
            a, r = build_applicant(i, row, rng)
            applicants.append(a)
            records.append(r)

    summary = validate(
        [{**j, "company_name": j["employer_ref"]} for j in jobs], applicants, records)
    if summary["errors"]:
        for e in summary["errors"][:20]:
            logger.error(f"VALIDATION: {e}")
        raise SystemExit(f"validation failed with {len(summary['errors'])} errors")

    (out_dir / "employers.json").write_text(json.dumps(employers, indent=1, ensure_ascii=False), encoding="utf-8")
    (out_dir / "jobs.json").write_text(json.dumps(jobs, indent=1, ensure_ascii=False), encoding="utf-8")
    (out_dir / "applicants.json").write_text(json.dumps(applicants, indent=1, ensure_ascii=False), encoding="utf-8")
    (out_dir / "llm_parsed_records.json").write_text(json.dumps(records, indent=1, ensure_ascii=False), encoding="utf-8")
    manifest = {
        "sources": {"resumes": args.resumes, "jobs": args.jobs},
        "seed": args.seed, "generated_at": datetime.utcnow().isoformat(),
        "counts": {"employers": len(employers), "jobs": len(jobs),
                   "applicants": len(applicants), "parsed_records": len(records)},
        "validation": summary, "db_loaded": False,
    }
    if args.load:
        load_to_db(out_dir)
        manifest["db_loaded"] = True
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    logger.info(f"✓ Wrote {len(jobs)} jobs / {len(employers)} employers / "
                f"{len(applicants)} applicants to {out_dir} (db_loaded={manifest['db_loaded']})")


if __name__ == "__main__":
    main()
