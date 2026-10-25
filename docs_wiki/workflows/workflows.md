# Core Workflows & Business Logic

This document details the step-by-step logic governing the platform's core services: resume parsing, recommendation scoring, interactive interviews, and the credit billing system.

---

## 1. Resume Parsing Workflow

When an applicant uploads a resume, the backend executes the following pipeline:

```mermaid
sequenceDiagram
    participant App as Frontend
    participant API as FastAPI Backend
    participant FS as Local FileStorage
    participant LLM as DeepSeek (OpenCode) via llm_router
    participant DB as SQL Database

    App->>API: POST /api/v1/resume/upload
    API->>FS: Save file to data/raw_files/app_<uuid>/
    API->>FS: Update metadata.json (hash & format)
    API->>API: Extract Text (OCR/PyPDF/pdfplumber)
    API->>LLM: Prompt chat provider with raw text & structure schema (RESUME PARSE IS OFFLINE — no LLM call; rule-based rule_parser only)
    LLM-->>API: Returns JSON (skills, experiences, education)
    API->>API: Normalize Skills & Match Taxonomy
    API->>DB: Save User, Applicant, Experience, Education, Resume records
    API-->>App: Return 201 Created & Parsed Data
```

### Skill Normalization Rules
* **Long Skills ($\ge$ 3 chars)**: Matched using word-boundary regex (`\bPython\b`) against the user's resume text.
* **Short Skills (< 3 chars)**: Exact substring matching to prevent false positives (e.g. matching "Go" inside "Google").

---

## 2. Recommendation Engine Scoring Workflow

The recommendation engine matches applicants to jobs and colleges based on multi-dimensional scores.

### Job Recommendation Scoring

Student recommendations run a staged pipeline (`resume_pipeline/recommendation/`):

1. **Retrieval** (`retrieval.py`): candidate generation over ALL active jobs —
   existing `active_job_criteria` SQL filters plus lenient location/experience
   gates, then TF-IDF skill overlap only (no embeddings, no network). Output is
   a ranked list of ~100 job IDs.
2. **Ranking** (`ranking.py`): the heavy scorers (semantic skill match,
   personalization multiplier from `user_feedback`, temporal freshness/demand,
   document similarity) plus the weighted aggregator run over the retrieved set
   only. Scoring math is unchanged from the previous engine.
3. **Reranking** (`reranking.py`): business rules — purpose weights, freshness
   boost, diversity cap (3 per employer), interview-score blend, explanation
   attach for the top 5, persistence.
4. **Facade** (`service.py`): `get_recommendations(applicant_id, purpose=...)`
   with `jobs` (default), `skill_gaps` (adds `missing_skills` + `gap_signal`),
   `digest` (lightweight top 5), and `browse` (same weights as `jobs`, top-20
   slice for JobsPage) purposes. The response splits the ranked list into
   `recommended` (top slice) + paged `more_matches` (`more_offset`/`more_limit`);
   `job_recommendations` mirrors `recommended` for backward compatibility.
   Job vectors are embedded once at
   posting time and applicant vectors once at parse time (`precompute.py`);
   requests read the stored pgvector cache.

> [!IMPORTANT]
> **Job Visibility Constraints**: A job listing is only visible and eligible for recommendations if it has `status = 'approved'` AND its `expires_at` timestamp is in the future (`expires_at > now()`).

### College Recommendation Scoring
Students are recommended courses based on:
1. **CGPA Verification**: Student's CGPA must meet or exceed the college's `cutoff_cgpa`.
2. **Preference Match**: Matches student preferences against the college course curriculum.

---

## 3. Interactive Interview Practice Workflow

Provides mock interviews where DeepSeek (via OpenCode/llm_router) acts as an interviewer and scores candidate responses.

1. **Initialization**: The chat provider reviews candidate profile/skills and generates custom questions for the target job role.
2. **Chat Loop**: Candidate sends answers, the provider generates natural conversation replies, asking follow-up questions.
3. **Scoring**: At the end of the session, the provider evaluates responses on:
   * Technical accuracy
   * Communication skills
   * Job alignment
   It saves the feedback and final score to the `interview_sessions` table.

---

## 4. Credit Gating Workflow

All premium features (e.g., full recommendations, mock interview sessions) are guarded by the `CreditService`. (Resume parsing itself is a free offline operation — local OCR, no LLM calls.)

> [!CAUTION]
> Always enforce credit checks **before** running the premium operation, and only deduct credits **after** the operation completes successfully to prevent charging users for failed API calls.

```python
# Standard code pattern for credit gating
from .core.credit_service import CreditService

# 1. Check eligibility (returns 402 HTTP error if balance insufficient)
await CreditService.check_eligibility(db, user_id, action="mock_interview")

# 2. Perform the premium action
success = await execute_premium_action(...)

# 3. Deduct credits upon success
if success:
    await CreditService.spend_credits(db, user_id, action="mock_interview")
```

---

## Detailed Workflow References (`docs/`)

For detailed technical specification of these workflows, see:
- **[Recommendation Engine Architecture](../docs/RECOMMENDATION_ENGINE_ARCHITECTURE.md)**: Breakdown of recommendation algorithms, math formulas, and weight thresholds.
- **[Interview System Architecture](../docs/INTERVIEW_SYSTEM_ARCHITECTURE.md)**: AI interviewer flow, chat states, and prompt engineering instructions.
- **[Live Interview Architecture](../docs/LIVE_INTERVIEW_ARCHITECTURE.md)**: Websocket/realtime communication setup for live interview sessions.
- **[Live Interview Roadmap](../docs/LIVE_INTERVIEW_ROADMAP.md)**: Milestone implementations and checklist for next-generation features.
- **[Resume Parse Redesign Plan](../docs/RESUME_PARSE_PIPELINE_REDESIGN.txt)**: OCR and document format extraction improvement designs.

