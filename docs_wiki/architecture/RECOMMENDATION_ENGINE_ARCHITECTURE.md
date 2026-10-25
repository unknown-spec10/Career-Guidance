# Recommendation Engine — Full Architecture
## Career Guidance Platform | unknown-spec10/Career-Guidance

> **Scope:** This document covers the complete redesign of the recommendation engine
> from the current regex/weighted-formula approach to a 5-tier intelligent system.
> Resume parsing is assumed to be working correctly. This document starts from the
> point where skills and profile data are already extracted.

---

## Table of Contents

1. [Overview & Design Principles](#1-overview--design-principles)
2. [System Layers](#2-system-layers)
3. [Tier 1 — TF-IDF Weighted Skill Matching](#3-tier-1--tf-idf-weighted-skill-matching)
4. [Tier 2 — Semantic Skill Matching via Embeddings](#4-tier-2--semantic-skill-matching-via-embeddings)
5. [Tier 3 — Personalization via Implicit Feedback](#5-tier-3--personalization-via-implicit-feedback)
6. [Tier 4 — Temporal Decay & Job Market Awareness](#6-tier-4--temporal-decay--job-market-awareness)
7. [Tier 5 — Full Semantic Understanding via Document Embeddings](#7-tier-5--full-semantic-understanding-via-document-embeddings)
8. [Tier 5b — Explainability Layer](#8-tier-5b--explainability-layer)
9. [Fallback Strategy](#9-fallback-strategy)
10. [Scoring Aggregation — How All Tiers Combine](#10-scoring-aggregation--how-all-tiers-combine)
11. [Background Task Architecture](#11-background-task-architecture)
12. [Database Changes](#12-database-changes)
13. [File & Folder Structure](#13-file--folder-structure)
14. [Dependency Summary](#14-dependency-summary)
15. [Build Order](#15-build-order)

---

## 1. Overview & Design Principles

### What is wrong with the current system

The current engine scores each job using a static formula:

```
score = (0.35 × JEE_rank) + (0.25 × CGPA) + (0.25 × skill_match) + (0.15 × interview_score) + (0.20 × academic_fit)
```

Problems:
- Weights add up to more than 1.0 (inconsistency)
- Skill matching uses word-boundary regex — brittle, case-sensitive, no synonyms
- Every user with the same resume gets identical recommendations — no personalization
- Recommendations are recomputed on every API request — slow
- Jobs posted 6 months ago rank the same as jobs posted today
- No explanation for why a job was recommended — users don't trust it

### Design Goals

- All tiers must work within the existing free-tier infrastructure
- No new external services except what is already present (Groq API key exists)
- Recommendations must be pre-computed and stored — API reads from DB, not recomputed live
- Each tier is independently testable and can be toggled on/off via config
- The scoring formula must be transparent and stored per recommendation

### Infrastructure Constraints (Free Tier)

| Resource | Tool | Notes |
|---|---|---|
| Embeddings | Local `all-MiniLM-L6-v2` ONNX export via `onnxruntime` (384-dim, fully offline, no API key) | Lazy-loaded singleton in `core/minilm_onnx.py`, shared by `recommendation/embedder.py`; vectors stored via the existing pgvector path |
| LLM reasoning | Gemini 2.5 Flash (`gemini-2.5-flash`) | Via `google-genai` SDK, uses existing `GEMINI_API_KEY` |
| Database | PostgreSQL (existing) | Add columns/tables only |
| Background jobs | FastAPI BackgroundTasks | No new infrastructure |
| Caching | PostgreSQL `job_embeddings_cache` + in-memory dict | Embed once, persist to DB, load into RAM on startup |

---

## 2. System Layers

The engine is organized into three horizontal layers and five vertical tiers.

### Horizontal Layers

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (FastAPI)                   │
│  GET /api/recommendations/{applicant_id}  →  reads DB   │
│    ?purpose=jobs|browse (top 10, or 20 for JobsPage)    │
│    → recommended (top slice) + paged more_matches       │
│    (job_recommendations keeps the full list, unchanged) │
│  POST /api/recommendations/refresh        →  triggers BG │
│  POST /api/feedback                       →  stores signal│
└─────────────────────────────────────────────────────────┘
                          ↓ triggers
┌─────────────────────────────────────────────────────────┐
│              Recommendation Engine (Background)          │
│  Tier 1: TF-IDF skill weighting                         │
│  Tier 2: Embedding-based semantic matching               │
│  Tier 3: Personalization via feedback signals            │
│  Tier 4: Temporal decay + demand signals                 │
│  Tier 5: Full document semantic match + explainability   │
└─────────────────────────────────────────────────────────┘
                          ↓ writes
┌─────────────────────────────────────────────────────────┐
│                  Persistence Layer (PostgreSQL)          │
│  job_recommendations  (updated scores + breakdown)       │
│  user_feedback        (click/apply/dismiss signals)      │
│  job_embeddings_cache (pre-computed job vectors)         │
└─────────────────────────────────────────────────────────┘
```

### When Recommendations Are (Re)Computed

Recommendations are NOT computed on every API request. They are computed:

- After a resume is parsed for the first time
- After a resume is re-uploaded and re-parsed
- After a new job is added (for all existing applicants — batched)
- After a user completes a mock interview (score may change boost)
- On explicit refresh via admin endpoint

The API endpoint only reads from the `job_recommendations` table.

---

## 3. Tier 1 — TF-IDF Weighted Skill Matching

### Concept (Plain English)

Regex matching asks: "Is this skill present? Yes/No."
TF-IDF matching asks: "How important is this skill to this job, and does the user have it?"

A job that mentions "Python" in the title, description, AND requirements treats Python as critical. A job that mentions it once in a long list treats it as optional. TF-IDF captures this importance difference automatically.

### How It Works

**Step 1 — Build a job corpus at startup**

Treat each job as a "document". The document is the concatenation of:
- Job title
- Job description
- Required skills list
- Preferred skills list

Compute TF-IDF vectors across all jobs. This gives you term weights — how important each skill/word is *per job* relative to all jobs.

**Step 2 — Score a user against a job**

For each skill the user has:
1. Look up that skill's TF-IDF weight in the target job
2. If skill is present: contribute `tfidf_weight` to the score
3. If skill is absent: contribute 0

Normalize the final score to 0.0–1.0.

**Step 3 — Cache the TF-IDF matrix**

Computed once at application startup. Invalidated when a new job is added.
Stored in memory as a sparse matrix (negligible RAM for hundreds of jobs).

### Output

`tfidf_skill_score: float` — range 0.0 to 1.0

### Where It Lives

```
recommendation/
    scorers/
        tfidf_scorer.py   ← build_corpus(), score(user_skills, job_id)
```

---

## 4. Tier 2 — Semantic Skill Matching via Embeddings

### Concept (Plain English)

TF-IDF knows importance but still requires exact string matches.
Embeddings convert words into numbers that capture meaning — so "ML" and "Machine Learning" land close together in that number space, and score high similarity.

### Model

**`all-MiniLM-L6-v2`** via the pre-exported ONNX graph run by `onnxruntime`
(loaded once through the shared `core/minilm_onnx.py` helper).
- Lightweight local transformer (~90MB fp32 ONNX graph) — no API key, no network calls, no rate limiter
- Output dimensions: 384 (`EMBEDDING_DIM = 384` in `core/minilm_onnx.py`)
- Lazy-loaded singleton: the model loads once on first `embed()` call, so app
  startup and non-ranking paths stay fast
- The task instruction is still prepended to the prompt text (e.g., "Represent this
  skill set for semantic similarity matching: ...") to preserve the asymmetric
  retrieval convention and existing cache semantics
- **Important:** 384-dim local vectors are incompatible with legacy 1536-dim Gemini
  rows. Stale rows are NOT compared — the Embedder treats a dimension mismatch as a
  cache miss and re-embeds locally (old rows are replaced on write). A future
  incremental Alembic migration may alter legacy `vector(1536)` columns to
  `vector(384)`; until then, fresh databases create `vector(384)` columns
  (`LOCAL_EMBEDDING_DIM` in `db.py`) while pre-existing tables are untouched.
  Reads tolerate every stored shape — JSON lists, vector text, ndarrays,
  pgvector `Vector` objects — via `coerce_embedding_vector()` plus a
  crash-proof Vector result processor, so legacy rows load (then re-embed on
  dim mismatch) instead of raising `'list' object has no attribute 'split'`.

### How It Works

**Step 1 — Posting time: embed all job skill lists**

```
for each job in jobs:
    prompt = "Represent this skill set for semantic similarity matching: " + ", ".join(job.required_skills)
    vector = embedder.embed(prompt)   # local all-MiniLM-L6-v2, 384-dim
    store in memory dict: job_id → vector
    persist to job_embeddings_cache table (precompute.ensure_job_embeddings)
```

This runs once per job at posting time via the precompute path (or loads from DB
cache if already computed). The task instruction stays embedded in the prompt text,
preserving the asymmetric retrieval convention.

**Step 2 — At recommendation time: embed user skills**

```
prompt = "Represent this skill set for semantic similarity matching: " + ", ".join(applicant.skills)
user_vector = embedder.embed(prompt)   # local all-MiniLM-L6-v2, 384-dim
```

**Step 3 — Compute cosine similarity**

```
similarity = cosine_similarity(user_vector, job_vector)
```

Cosine similarity returns a value between 0.0 and 1.0.
- 1.0 = identical meaning
- 0.8+ = strong match
- 0.5–0.8 = partial match
- Below 0.5 = weak match

**Step 4 — Combine with Tier 1**

```
combined_skill_score = (0.4 × tfidf_score) + (0.6 × semantic_score)
```

Tier 1 rewards exact important skills. Tier 2 rewards semantic closeness.
Together they handle both precision and recall.

### Output

`semantic_skill_score: float` — range 0.0 to 1.0
`combined_skill_score: float` — weighted blend of Tier 1 + Tier 2

### Where It Lives

```
recommendation/
    embedder.py           ← wraps the local all-MiniLM-L6-v2 ONNX encoder (core/minilm_onnx.py).
                            Exposes the same interface: embed(text), cosine_sim(v1, v2).
                            Handles task instruction prefixing, 384-dim output,
                            lazy singleton model load, and DB cache read/write
                            (stale 1536-dim rows are re-embedded). Raises
                            GeminiEmbeddingUnavailable (legacy name) only on local
                            model failure so ranking.py can trigger TF-IDF fallback.
                            Shared by semantic_scorer and document_scorer.
    scorers/
        semantic_scorer.py ← score(user_skills, job_id) → float.
```

---

## 5. Tier 3 — Personalization via Implicit Feedback

### Concept (Plain English)

Two students can have identical resumes but different preferences.
One wants remote frontend roles. The other wants on-site backend roles.
Implicit feedback — what they *do* after seeing recommendations — reveals this.

### Signals (Stored in `user_feedback` table)

| Action | Signal Strength | Score Adjustment |
|---|---|---|
| Clicked job detail | Weak positive | +0.05 boost to similar jobs |
| Applied to job | Strong positive | +0.15 boost to similar jobs |
| Dismissed/ignored | Negative | -0.10 penalty to similar jobs |
| Saved to wishlist | Medium positive | +0.10 boost to similar jobs |

"Similar jobs" means jobs in the same category/tag cluster as the interacted job.

### How It Works

**Step 1 — Store feedback**

Every time a user clicks, applies, or dismisses, record it:
```
user_feedback table:
  applicant_id, job_id, action_type, timestamp
```

**Step 2 — Build a preference profile**

At recommendation time, look at the user's feedback history:
- What job categories did they engage with positively?
- What locations did they apply to?
- What seniority levels?

This builds a lightweight preference vector: `{category: weight, location: weight, ...}`

**Step 3 — Adjust scores**

For each candidate job, check if it matches the user's preference profile.
Apply a multiplier to the base score:

```
personalization_multiplier = 1.0 + sum(preference_weights for matching attributes)
final_score = base_score × min(personalization_multiplier, 1.3)  # cap at 30% boost
```

Cap the boost so recommendations don't become an echo chamber.

**Step 4 — Cold start handling**

New users have no feedback. For them, personalization_multiplier = 1.0 (no effect).
The system naturally becomes personalized as the user interacts.

### Output

`personalization_multiplier: float` — range 1.0 to 1.3

### Where It Lives

```
recommendation/
    scorers/
        personalization_scorer.py  ← build_preference_profile(), get_multiplier()
```

---

## 6. Tier 4 — Temporal Decay & Job Market Awareness

### Concept (Plain English)

A job posted today is more relevant than one posted 6 months ago.
A job with 50 applicants signals high demand. A job with 0 applicants after 60 days is probably expired or unattractive.

### Temporal Decay Formula

```
freshness_score = e^(- days_since_posted / 30)
```

What this means in practice:
- Posted today → freshness = 1.0 (no penalty)
- Posted 30 days ago → freshness ≈ 0.37
- Posted 90 days ago → freshness ≈ 0.05 (heavily penalized)

You can tune the `30` divisor. A higher number means slower decay.

### Demand Signal

```
if job.applicant_count > 20:
    demand_boost = 0.05   # Popular, in-demand role
elif job.applicant_count == 0 and days_since_posted > 45:
    demand_penalty = -0.10  # Likely stale or unattractive
else:
    demand_modifier = 0.0   # Neutral
```

### Combined Temporal Score

```
temporal_score = freshness_score + demand_modifier
temporal_score = clamp(temporal_score, 0.0, 1.0)
```

### When This Is Applied

This is applied as a multiplier on the final combined score, not as an additive component.
It is not a measure of fit — it is a measure of opportunity quality.

```
opportunity_multiplier = 0.5 + (0.5 × temporal_score)
# Worst case: 0.5× (heavily stale job still shows, just ranked lower)
# Best case: 1.0× (fresh, in-demand job gets full score)
```

### Output

`temporal_score: float` — range 0.0 to 1.0
`opportunity_multiplier: float` — range 0.5 to 1.0

### Where It Lives

```
recommendation/
    scorers/
        temporal_scorer.py  ← freshness_score(), demand_signal(), opportunity_multiplier()
```

---

## 7. Tier 5 — Full Semantic Understanding via Document Embeddings

### Concept (Plain English)

Tiers 1–2 match skills to skills. But job descriptions contain context that extracted skills miss entirely.

Example:
- Resume says: "built REST APIs, worked in agile teams, deployed on AWS"
- Job says: "looking for a backend engineer comfortable with cloud infrastructure"

Zero skill overlap. But this is clearly a strong match. Document-level embeddings catch this.

### How It Works

**Step 1 — Build resume summary text**

Construct a single text block from the parsed resume:
```
"{name} is a {seniority} professional with {years} years of experience.
Skills: {skills}. Education: {degree} in {field} from {college} with {cgpa} CGPA.
Experience: {experience_summary}. Preferred location: {location}."
```

**Step 2 — Embed the full resume summary**

```
prompt = "Represent this candidate profile for job matching: " + resume_summary_text
resume_vector = embedder.embed(prompt)   # local all-MiniLM-L6-v2, 384-dim
```

This uses the same local `all-MiniLM-L6-v2` model from Tier 2 — no API client, no `GEMINI_API_KEY`. No additional dependency.

**Step 3 — Embed the full job description**

At parse/posting time (via `precompute.ensure_job_embeddings`), embed the full job description:
```
prompt = "Represent this job posting for candidate matching: " + job.title + " " + job.description + " " + job.requirements
job_desc_vector = embedder.embed(prompt)   # local all-MiniLM-L6-v2, 384-dim
```

Store this vector in the `job_embeddings_cache` table so it is computed only once per job. The task instruction prefix is different from Tier 2 (candidate-side vs job-side) — this preserves the asymmetric retrieval convention.

**Step 4 — Compute document-level similarity**

```
doc_similarity = cosine_similarity(resume_vector, job_desc_vector)
```

This single number captures the holistic match between the person and the role.

### Combining with Skill-Level Scores

```
semantic_understanding_score = (0.5 × combined_skill_score) + (0.5 × doc_similarity)
```

Skill-level matching (Tiers 1+2) catches specific technical requirements.
Document-level matching (Tier 5) catches role-fit, seniority, culture signals.
Together they form the strongest possible signal without a fine-tuned model.

### Output

`doc_similarity: float` — range 0.0 to 1.0
`semantic_understanding_score: float` — weighted blend

### Where It Lives

```
recommendation/
    scorers/
        document_scorer.py  ← build_resume_text(), score(applicant, job_id)
```

---

## 8. Tier 5b — Explainability Layer

### Concept (Plain English)

All the scores above are numbers. Users see a job ranked #1 and wonder why.
Explainability converts the score breakdown into a human-readable reason.
This is one Groq API call per recommendation. The result is cached permanently.

### How It Works

**Step 1 — Assemble the score breakdown**

After all tiers run, you have:
```python
breakdown = {
    "skill_match": 0.82,
    "semantic_fit": 0.74,
    "location_match": 1.0,
    "experience_fit": 0.65,
    "freshness": 0.91,
    "personalization_boost": 1.15,
    "final_score": 0.84
}
```

**Step 2 — One Gemini call to generate the explanation**

Uses `gemini-2.5-flash` via the `google-genai` SDK — same `GEMINI_API_KEY`, no new credentials.

Prompt structure:
```
System: You are a career advisor. Given a score breakdown of how well a
candidate matches a job, write a 2-sentence explanation in plain English.
Be specific about strengths and one gap if any. Do not mention scores or numbers.

User: Candidate skills: Python, FastAPI, PostgreSQL, Docker.
Job: Senior Backend Engineer at TechCorp.
Score breakdown: {breakdown}
```

**Step 3 — Store the explanation**

Store in the `job_recommendations` table in the `explanation` column.
This is generated ONCE and never regenerated unless the resume changes.
Cost: ~1 Gemini 2.5 Flash call per recommendation per resume version. Negligible — the explanation is short (2–3 sentences) and cached permanently in the DB.

### Example Output

```
"Your strong backend and database skills align well with this Senior Backend Engineer role,
and your preferred location matches the job's remote-friendly policy. You may want to
strengthen your system design experience before applying, as the role lists it as preferred."
```

### Output

`explanation: str` — 1–3 sentences, stored permanently in DB

### Where It Lives

```
recommendation/
    explainer.py  ← Gemini 2.5 Flash call via google-genai SDK. Takes (applicant, job, breakdown).
                    Returns explanation string. Skips if already cached in DB.
```

---

## 9. Fallback Strategy

The engine has two distinct fallback concerns — one for embeddings (Tiers 2 and 5) and one for LLM text generation (Tier 5b). They are handled separately because they fail for different reasons and have different recovery paths.

---

### 9a. Embedding Fallback — local model → TF-IDF

The ranking stage is fully offline: Tiers 2 and 5 use the local `all-MiniLM-L6-v2`
model, so there is no rate limit, network error, or API outage to recover from.
The TF-IDF fallback remains intact for the only remaining failure mode — the local
model itself failing to load or encode (missing package/weights, corrupt input).

#### Why the fallback is still TF-IDF only

Legacy 1536-dim Gemini rows must never be compared against 384-dim local vectors:
cross-model cosine similarity is numerically valid but semantically meaningless.
The Embedder therefore treats any dimension mismatch as a cache miss and re-embeds
locally, and the engine falls back to **Tier 1 TF-IDF scoring exclusively** when the
local model raises. TF-IDF runs entirely in-memory, is always available, and still
produces a meaningful skill match score.

```python
try:
    semantic_score = local_semantic_score(applicant, job_id)   # Tiers 2 + 5
    skill_score = (0.4 * tfidf_score) + (0.6 * semantic_score) # normal blend
except GeminiEmbeddingUnavailable:  # legacy name; raised only by the local model now
    skill_score = tfidf_score                                    # TF-IDF only
    log_warning("Embeddings unavailable (using TF-IDF fallback) for job_id={job_id}")
```

#### What changes in the final score during fallback

The aggregation formula adjusts automatically when semantic scores are unavailable. The TF-IDF score is promoted to represent the full skill signal:

```
# Normal mode
semantic_understanding = (0.5 x combined_skill_score) + (0.5 x doc_similarity)

# Fallback mode (TF-IDF only)
semantic_understanding = tfidf_score   # doc_similarity unavailable, no penalty applied
```

The user still gets ranked recommendations. Quality is reduced — synonyms and contextual matches are missed — but results are correct and the system keeps running.

#### Fallback flag in score_breakdown

When fallback was used, it is recorded in the stored score breakdown:

```json
{
  "embedding_fallback": true,
  "embedding_fallback_reason": "Local embedding failure: ...",
  "combined_skill_score": 0.61,
  "doc_similarity": null
}
```

This lets you identify which recommendations were computed under degraded conditions and recompute them once the local model is healthy.

---

### 9b. LLM Explanation — single opencode attempt → offline

The explainability call (Tier 5b) makes exactly one LLM attempt through the
shared `llm_router` (default `opencode`/DeepSeek, `MODEL_EXPLAIN_*` slots),
then gives up gracefully to the offline path.

#### Attempt order

```
Single attempt: configured explanation provider (opencode/DeepSeek, 6s timeout)
    ↓ fails (rate limit / outage / missing key)
Offline: pgvector-aware template explanation (no API calls)
```

#### Why one attempt is enough here

LLM calls are pure text in, text out, but a second provider attempt only
delays the inevitable: when the single attempt fails the offline explanation
(fired immediately, not after cascading retries) already produces a sensible
2-sentence candidate-facing message from skill overlap, and the
recommendation itself is still valid and shown with or without LLM text.

#### Implementation pattern

```python
def generate_explanation(applicant, job, breakdown, db=None):
    prompt = build_explanation_prompt(applicant, job, breakdown)

    # Single attempt: the configured explanation provider, exactly once
    for adapter, _model in llm_router.ordered_adapters("explanation"):
        result = _try_once(adapter, prompt)  # 6s timeout, per-adapter breaker
        if result:
            return result, adapter.name  # 'opencode' | 'groq'

    # Offline: pgvector applicant embedding context + string match
    return _offline_explanation_with_embeddings(applicant, job, db=db), "offline_fallback"
```

#### Offline behavior

If the LLM attempt fails, the offline explanation is served immediately.
This is not an error state — the recommendation itself is still valid and
shown to the user, just without LLM-generated text. The frontend handles the
`offline_fallback` source gracefully.

On the next recompute trigger (resume re-upload, interview completion, admin
refresh), the engine's null-explanation retry re-attempts the single LLM call
for records stored with the offline source before processing
already-explained recommendations.

```python
# In ranking.py, during recompute — retry offline explanations first
for rec in existing_recommendations_with_offline_explanation:
    explanation, source = generate_explanation(applicant, rec.job, rec.score_breakdown, db)
    update_explanation(rec.id, explanation, source)
```

#### Source flag in score_breakdown

```json
{
  "explanation_source": "opencode",
  "explanation": "Your Python and backend skills are a strong match..."
}
```

Possible values for `explanation_source`: `"opencode"`, `"groq"` (when the
slots point the single attempt at groq), `"offline_fallback"` (LLM attempt failed).

---

### Fallback Summary Table

| Component | Primary | Fallback | Terminal |
|---|---|---|---|
| Skill embeddings (Tier 2) | Local all-MiniLM-L6-v2 (384-dim, offline) | TF-IDF score only | TF-IDF (always available) |
| Document embeddings (Tier 5) | Local all-MiniLM-L6-v2 (384-dim, offline) | Skip doc_similarity | Use TF-IDF-only skill score |
| Explanation (Tier 5b) | Configured provider (opencode/DeepSeek), one attempt | Offline template explanation | Served with `offline_fallback` source |

---

## 10. Scoring Aggregation — How All Tiers Combine

### The Final Score Formula

```
# Step 1: Base semantic understanding (Tiers 1 + 2 + 5)
semantic_understanding = (0.5 × combined_skill_score) + (0.5 × doc_similarity)

# Step 2: Structured signals
location_score      = exact_match ? 1.0 : fuzzy_match_score   # 0.0–1.0
experience_fit      = compute_experience_fit(user_years, job_min_years)  # 0.0–1.0
academic_score      = compute_academic_fit(cgpa, degree)  # 0.0–1.0
interview_boost     = (interview_score / 100) × 0.15 if interview_taken else 0.0

# Step 3: Weighted base score (weights sum to 1.0)
base_score = (
    0.45 × semantic_understanding +
    0.20 × location_score +
    0.15 × experience_fit +
    0.10 × academic_score +
    0.10 × interview_boost
)

# Handle missing interview score — redistribute weight
if not interview_taken:
    base_score = (
        0.50 × semantic_understanding +
        0.25 × location_score +
        0.15 × experience_fit +
        0.10 × academic_score
    )

# Step 4: Apply temporal multiplier (Tier 4)
adjusted_score = base_score × opportunity_multiplier   # 0.5–1.0

# Step 5: Apply personalization multiplier (Tier 3)
final_score = adjusted_score × personalization_multiplier  # 1.0–1.3

# Clamp to 0.0–1.0
final_score = clamp(final_score, 0.0, 1.0)
```

### Score Breakdown Stored Per Recommendation

```json
{
  "combined_skill_score": 0.79,
  "doc_similarity": 0.74,
  "semantic_understanding": 0.765,
  "location_score": 1.0,
  "experience_fit": 0.65,
  "academic_score": 0.80,
  "interview_boost": 0.0,
  "base_score": 0.78,
  "opportunity_multiplier": 0.91,
  "personalization_multiplier": 1.10,
  "final_score": 0.78,
  "explanation": "Your Python and backend skills are a strong match..."
}
```

---

## 11. Background Task Architecture

### Trigger Points

```
Event                          → Action
─────────────────────────────────────────────────────
Resume parsed (first time)     → service.request_recommendations_async(applicant_id)
Resume re-parsed               → recompute via service.get_recommendations(applicant_id, db)
New job added by recruiter     → ranking.compute_recommendations_for_new_job(job_id, db)
Interview completed            → refresh via service.get_recommendations(applicant_id, db)
Admin manual refresh           → recompute via service.get_recommendations(applicant_id, db)
```

### FastAPI BackgroundTasks Flow

```
POST /parse/{applicant_id}
    → parse resume (blocking) + precompute applicant embeddings (best-effort)
    → background_tasks.add_task(request_recommendations_async, applicant_id)
    → return parse result immediately to user

# In background (non-blocking), staged pipeline:
service.get_recommendations(applicant_id, db, purpose="jobs"):
    1. retrieval.retrieve_candidate_jobs: hard filters + TF-IDF over active jobs (~100 IDs)
    2. ranking.rank_candidates: heavy scorers + aggregator over the retrieved set only
    3. reranking.rerank_scored: purpose weights, freshness boost, diversity cap
    4. reranking.attach_explanations: cached-or-generated text for the top 5 only
    5. reranking.persist_recommendations: upsert into job_recommendations table
    6. Log completion

# Legacy per-pair scoring detail (unchanged math, now runs per retrieved job):
run_pipeline_for_applicant_job(applicant, job, ...):
    1. Fetch applicant profile from DB
    2. For each retrieved job:
        a. Tier 1: tfidf_score
        b. Tier 2: semantic_skill_score
        c. Tier 4: temporal_score, opportunity_multiplier
        d. Tier 5: doc_similarity
        e. Tier 3: personalization_multiplier (from feedback history)
        f. Aggregate final_score
        g. Generate explanation via Groq (if not cached)
    3. Sort jobs by final_score descending
    4. Write top-N to job_recommendations table
        (upsert: update if record exists, insert if new)
    5. Log completion
```

### Handling New Jobs (Batch Update)

When a recruiter posts a new job:
```
POST /api/recruiter/job
    → create job in DB
    → background_tasks.add_task(compute_recommendations_for_new_job, job_id, db)
    → return job created response

# In background:
compute_recommendations_for_new_job(job_id):
    1. Embed new job description → store in job_embeddings_cache
    2. Update TF-IDF corpus (add new document, recompute weights)
    3. For each active applicant:
        a. Compute score for this specific job
        b. Upsert into job_recommendations
```

---

## 12. Database Changes

### New Columns on `job_recommendations` Table

Add to the existing `job_recommendations` table:

```sql
ALTER TABLE job_recommendations
ADD COLUMN score_breakdown  JSONB,
ADD COLUMN explanation      TEXT,
ADD COLUMN computed_at      TIMESTAMP DEFAULT NOW(),
ADD COLUMN engine_version   VARCHAR(10) DEFAULT 'v2';
```

`engine_version` lets you recompute only old-format recommendations after future upgrades.

### New Table: `user_feedback`

```sql
CREATE TABLE user_feedback (
    id              SERIAL PRIMARY KEY,
    applicant_id    INTEGER REFERENCES applicants(id),
    job_id          INTEGER REFERENCES jobs(id),
    action_type     VARCHAR(20),   -- 'click', 'apply', 'dismiss', 'save'
    timestamp       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_feedback_applicant ON user_feedback(applicant_id);
```

### New Table: `job_embeddings_cache`

```sql
CREATE TABLE job_embeddings_cache (
    job_id          INTEGER PRIMARY KEY REFERENCES jobs(id),
    embedding       BYTEA,         -- serialized numpy array (pickle)
    computed_at     TIMESTAMP DEFAULT NOW()
);
```

Storing embeddings in the DB avoids recomputing on every server restart.
At startup, load all embeddings from DB into memory dict.

### No Other Schema Changes Required

All other signals (skills, location, CGPA, experience, interview score) are already in the existing tables.

---

## 13. File & Folder Structure

```
resume_pipeline/
└── resume_pipeline/
    └── recommendation/
        │
        ├── __init__.py
        │
        ├── retrieval.py          ← Stage 1: candidate generation over ALL active jobs.
        │                           Lenient location/experience hard filters + TF-IDF
        │                           skill overlap only. No embeddings, no network.
        │                           Output: ranked list of ~100 job IDs (RETRIEVAL_TOP_K).
        │                           Owns the TF-IDF corpus cache (moved out of ranking).
        │
        ├── ranking.py            ← Stage 2: slimmed successor of engine.py. Heavy scorers
        │                           (semantic, personalization, temporal, document) +
        │                           aggregator over the retrieved ~100 only, with
        │                           unchanged scoring logic. TF-IDF arrives as input.
        │                           Uniform entry points: score_pair() → rank_candidates()
        │                           → compute_ranked_for_applicant(). Also hosts the
        │                           new-job backfill, null-explanation retry, and the
        │                           single-pair ensure helper. scorers/ untouched.
        │
        ├── reranking.py          ← Stage 3: business rules live here, not in scorers.
        │                           Purpose weights (jobs / skill_gaps / digest),
        │                           freshness boost, diversity cap (3 per employer),
        │                           interview-blend flag, explanation attach
        │                           (top 5; digest = cached/offline only),
        │                           persistence, read-only cooldown view.
        │
        ├── service.py            ← Shared facade: get_recommendations(applicant_id,
        │                           db, purpose=...). Same pipeline, different rerank
        │                           weights, no forks. All backend callers go through it.
        │                           Exposes RecommendationFacade (canonical) and
        │                           RecommendationService (legacy alias).
        │
        ├── precompute.py         ← Embed-once helpers: applicant vectors at parse time,
        │                           job vectors at posting time, via the existing
        │                           Embedder + pgvector path. Best-effort, never raises.
        │
        ├── engine.py               ← Backward-compatible shim: re-exports the ranking API
        │                             (compute_recommendations, run_pipeline_for_applicant_job,
        │                             backfill/retry/ensure helpers) so existing callers
        │                             keep working. New code imports ranking/service directly.
        │
        ├── embedder.py             ← Wraps the local all-MiniLM-L6-v2 ONNX encoder (core/minilm_onnx.py).
        │                             Exposes the same interface: embed(text), cosine_sim(v1, v2).
        │                             Lazy singleton load, 384-dim output, task instruction
        │                             prefixing, DB cache read/write (stale 1536-dim rows
        │                             are re-embedded). Raises GeminiEmbeddingUnavailable
        │                             (legacy name) only on local model failure so
        │                             ranking.py can trigger TF-IDF fallback.
        │                             Shared by semantic_scorer and document_scorer.
        │
        ├── explainer.py            ← Single LLM attempt (opencode/DeepSeek via llm_router).
        │                             Takes (applicant, job, breakdown, db) → (str, source).
        │                             Records explanation_source in breakdown. Serves the
        │                             offline template immediately if the attempt fails.
        │
        ├── scorers/
        │   ├── __init__.py
        │   │
        │   ├── tfidf_scorer.py     ← Tier 1. Builds TF-IDF corpus at startup.
        │   │                         Exposes: build_corpus(jobs), score(user_skills, job_id).
        │   │                         Always available — no external dependencies.
        │   │                         Acts as the embedding fallback score provider.
        │   │
        │   ├── semantic_scorer.py  ← Tier 2. Uses embedder. Skill-level semantic match.
        │   │                         Exposes: score(user_skills, job_id) → float.
        │   │                         Raises GeminiEmbeddingUnavailable (legacy name)
        │   │                         only on local model failure.
        │   │
        │   ├── personalization_scorer.py  ← Tier 3. Reads user_feedback table.
        │   │                               Exposes: get_multiplier(applicant_id, job) → float.
        │   │
        │   ├── temporal_scorer.py  ← Tier 4. Freshness + demand signals.
        │   │                         Exposes: opportunity_multiplier(job) → float.
        │   │
        │   └── document_scorer.py  ← Tier 5. Full resume vs full job description.
        │                             Uses embedder. Reads job_embeddings_cache.
        │                             Exposes: score(applicant, job_id) → float | None.
        │                             Returns None on embedding failure (engine.py handles).
        │
        └── aggregator.py           ← Pure function. Takes all scorer outputs including
                                      fallback flags. Returns final_score + full
                                      score_breakdown dict with embedding_fallback and
                                      explanation_source fields. No DB access, no side
                                      effects. Easy to unit test.
```

---

## 14. Dependency Summary

### Python Packages

```
onnxruntime>=1.20.0     # Tier 2 + Tier 5 local embeddings (all-MiniLM-L6-v2 ONNX, 384-dim)
tokenizers>=0.21.0     # BERT word-piece tokenizer for the ONNX graph
huggingface_hub>=0.30.0  # HF cache resolution for the pre-baked ONNX export
scikit-learn==1.4.0    # Tier 1 TF-IDF (TfidfVectorizer) + cosine similarity math
numpy==1.26.0          # Vector math (likely already installed)
```

`onnxruntime` covers Tier 2 + Tier 5 fully offline — no API key, no rate
limiter, no network. `groq` SDK is already installed (used for the
single-attempt chat path when the slots point at groq, and for STT).
`google-genai` was never a declared dependency in `requirements.txt` and is
not needed by the ranking stage (the explainer's optional per-skill semantic
path and `tests/test_api.py` import it guardedly and degrade gracefully
without it).

### Usage Pattern

```python
from resume_pipeline.recommendation.embedder import Embedder

embedder = Embedder(db)  # no keys, no client, no limiter

# Embeddings (Tier 2 + Tier 5) — local, offline, 384-dim
vector = embedder.embed(
    "Python, FastAPI, PostgreSQL",
    instruction="Represent this skill set for semantic similarity matching:",
)

# LLM text generation — single attempt (Tier 5b), then offline
res = llm_router.generate_chat_completion(
    messages=[{"role": "user", "content": "Your explanation prompt here..."}],
    provider=None,
    capability="explanation",
    temperature=0.7,
    max_tokens=150,
)
explanation = res["content"]  # raises on failure; caller serves offline text
```

### What Is NOT Needed

- No API key or network for Tier 2 / Tier 5 (local `all-MiniLM-L6-v2` model)
- No Redis (in-memory dict is sufficient at free tier scale)
- No Celery (FastAPI BackgroundTasks is enough)
- No vector database like Pinecone or Weaviate (PostgreSQL pgvector columns for embeddings)

---

## 15. Build Order

Build and test each tier independently before moving to the next.

```
Step 1:  Build embedder.py
         Test: embed a list of skills via the local all-MiniLM-L6-v2 model,
               verify 384-dim vector shape, determinism, and that
               GeminiEmbeddingUnavailable is raised only on local model failure

Step 2:  Build tfidf_scorer.py (Tier 1)
         Test: build corpus from seed jobs, score a sample applicant, verify 0.0–1.0 output
         Note: This is the embedding fallback — must be solid before Tier 2

Step 3:  Build semantic_scorer.py (Tier 2)
         Test: "ML" vs "Machine Learning" should score > 0.85
         Test: simulate local model failure → verify TF-IDF fallback activates

Step 4:  Build temporal_scorer.py (Tier 4)
         Test: job posted today → multiplier ~1.0, job posted 90 days ago → multiplier ~0.52

Step 5:  Build document_scorer.py (Tier 5)
         Test: embed resume summary vs job description, verify similarity is sensible
         Test: simulate local model failure → verify None is returned cleanly

Step 6:  Build aggregator.py
         Test: feed normal scorer outputs, verify formula and 0.0–1.0 range
         Test: feed fallback outputs (embedding_fallback=True, doc_similarity=None),
               verify score degrades gracefully and breakdown flags are set correctly

Step 7:  Build personalization_scorer.py (Tier 3)
         Test: simulate feedback history, verify multiplier increases for matching jobs
         Note: Build this last because it requires the feedback table and real user data

Step 8:  Build explainer.py
         Test: call the configured provider with a sample breakdown, verify natural language output
         Test: simulate LLM failure → verify the offline explanation is served with source=offline_fallback
         Test: simulate LLM failure → verify the recommendation is still stored and shown

Step 9:  Build engine.py (orchestrator)
         Test: run full pipeline on one applicant against seed jobs, check DB output
         Test: verify null-explanation retry logic — records with explanation=null
               are retried before fresh recommendations are processed

Step 10: Wire into app.py
         - Add background task trigger in parse endpoint
         - Add background task trigger in job creation endpoint
         - Add POST /api/feedback endpoint
         - Verify GET /api/recommendations reads from DB (no live computation)

Step 11: Add DB migrations
         - ALTER job_recommendations (add score_breakdown, explanation, computed_at, engine_version)
         - CREATE user_feedback table
         - CREATE job_embeddings_cache table
```

---

## Summary Table

| Tier | Name | What It Adds | Primary Tool | Fallback |
|---|---|---|---|---|
| Baseline | Structured Signals | Location, experience, CGPA, interview | Pure Python | — |
| 1 | TF-IDF Skill Weighting | Importance-aware skill matching | scikit-learn | — (always available) |
| 2 | Semantic Skill Matching | Synonym/context-aware skill matching | Local all-MiniLM-L6-v2 (offline) | TF-IDF (Tier 1) |
| 3 | Personalization | User-specific re-ranking via behavior | PostgreSQL (feedback table) | — |
| 4 | Temporal Decay | Job freshness + demand awareness | Pure Python (math) | — |
| 5 | Document Semantics | Full resume vs full job description | Local all-MiniLM-L6-v2 (offline) | TF-IDF-only skill score |
| 5b | Explainability | Human-readable reason per recommendation | Configured provider (opencode/DeepSeek), one attempt | Offline template (`offline_fallback`) |

---

*Document version: 1.2 | Project: unknown-spec10/Career-Guidance | Scope: Recommendation Engine Redesign (Tier 2/5 embeddings now local all-MiniLM-L6-v2, offline)*
