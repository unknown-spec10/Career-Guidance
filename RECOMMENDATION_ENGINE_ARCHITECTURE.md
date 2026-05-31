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
| Embeddings | Gemini Embedding 2 Preview (`gemini-embedding-2-preview`) | Via `google-genai` SDK, uses existing `GEMINI_API_KEY` |
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

**`gemini-embedding-2-preview`** via Google Gemini API.
- Google's first natively multimodal embedding model — maps text, images, video, audio, and PDFs into one unified vector space
- For this project, text is the primary input modality
- Input context: up to 8,192 tokens per call
- Output dimensions: 768, 1536, or 3,072 (recommended default: 768 for speed, 3,072 for maximum quality)
- Uses existing `GEMINI_API_KEY` — no new credentials needed
- SDK: `google-genai` Python package
- **Important:** Does NOT support the `task_type` field. Instead, include the task as a natural language instruction in the content prompt itself (e.g., prefix with "Represent this text for semantic similarity matching:")
- **Important:** Embedding vectors from `gemini-embedding-2-preview` are incompatible with any older Gemini embedding model (`gemini-embedding-001`, `text-embedding-004`). If any existing embeddings exist in the DB from an older model, the entire `job_embeddings_cache` table must be cleared and re-embedded from scratch before using this model.

### How It Works

**Step 1 — Startup: embed all job skill lists**

```
for each job in jobs:
    prompt = "Represent this skill set for semantic similarity matching: " + ", ".join(job.required_skills)
    vector = gemini_client.embed(model="gemini-embedding-2-preview", content=prompt)
    store in memory dict: job_id → vector
    persist to job_embeddings_cache table
```

This runs once at app startup (or loads from DB cache if already computed). The task instruction is embedded in the prompt text directly since `gemini-embedding-2-preview` does not accept a `task_type` parameter.

**Step 2 — At recommendation time: embed user skills**

```
prompt = "Represent this skill set for semantic similarity matching: " + ", ".join(applicant.skills)
user_vector = gemini_client.embed(model="gemini-embedding-2-preview", content=prompt)
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
    embedder.py           ← wraps google-genai SDK. Exposes: embed(text), cosine_sim(v1, v2).
                            Handles task instruction prefixing, output dimension config,
                            and DB cache read/write. Shared by semantic_scorer and document_scorer.
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
resume_vector = gemini_client.embed(model="gemini-embedding-2-preview", content=prompt)
```

This uses the same `gemini-embedding-2-preview` model from Tier 2 — same API client, same `GEMINI_API_KEY`. No additional dependency.

**Step 3 — Embed the full job description**

At startup (or when job is added), embed the full job description:
```
prompt = "Represent this job posting for candidate matching: " + job.title + " " + job.description + " " + job.requirements
job_desc_vector = gemini_client.embed(model="gemini-embedding-2-preview", content=prompt)
```

Store this vector in the `job_embeddings_cache` table so it is computed only once per job. The task instruction prefix is different from Tier 2 (candidate-side vs job-side) — this is the correct asymmetric retrieval pattern for `gemini-embedding-2-preview` since the model does not support `task_type`.

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

### 9a. Embedding Fallback — Gemini → TF-IDF

#### Why not sentence-transformers as fallback?

Using a different embedding model as fallback is not viable. `gemini-embedding-2-preview` and `all-MiniLM-L6-v2` (sentence-transformers) produce vectors in completely different mathematical spaces. A job vector from Gemini compared against a resume vector from sentence-transformers would return a cosine similarity number that is numerically valid but semantically meaningless — the system would silently produce wrong results with no indication anything had failed.

#### The correct fallback: TF-IDF only

When the Gemini embedding API is unavailable (rate limit hit, network error, API outage), the engine falls back to **Tier 1 TF-IDF scoring exclusively**. TF-IDF runs entirely in-memory with no external calls, is always available, and still produces a meaningful skill match score.

```python
try:
    semantic_score = gemini_semantic_score(applicant, job_id)   # Tiers 2 + 5
    skill_score = (0.4 * tfidf_score) + (0.6 * semantic_score) # normal blend
except GeminiEmbeddingUnavailable:
    skill_score = tfidf_score                                    # TF-IDF only
    log_warning("Gemini embedding unavailable — using TF-IDF fallback for job_id={job_id}")
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
  "embedding_fallback_reason": "GeminiRateLimitError",
  "combined_skill_score": 0.61,
  "doc_similarity": null
}
```

This lets you identify which recommendations were computed under degraded conditions and recompute them once the API recovers.

---

### 9b. LLM Fallback — Gemini 2.5 Flash → Groq → null + retry

The explainability call (Tier 5b) uses a two-level fallback chain before giving up gracefully.

#### Fallback chain

```
Primary:   Gemini 2.5 Flash  (google-genai SDK, GEMINI_API_KEY)
    ↓ fails (rate limit / outage)
Secondary: Groq LLaMA 3      (groq SDK, GROQ_API_KEY — already in .env)
    ↓ fails
Terminal:  Store null, mark for retry on next recompute
```

#### Why Groq works here but not for embeddings

LLM calls are pure text in, text out. The same prompt sent to Gemini 2.5 Flash or Groq's LLaMA 3 returns a plain string explanation. There is no vector space incompatibility — the outputs are semantically equivalent for this purpose.

#### Implementation pattern

```python
def generate_explanation(applicant, job, breakdown) -> str | None:
    prompt = build_explanation_prompt(applicant, job, breakdown)

    # Primary: Gemini 2.5 Flash
    try:
        return gemini_client.generate(model="gemini-2.5-flash", prompt=prompt)
    except GeminiUnavailable as e:
        log_warning(f"Gemini LLM unavailable: {e}. Trying Groq fallback.")

    # Secondary: Groq LLaMA 3
    try:
        return groq_client.generate(model="llama3-8b-8192", prompt=prompt)
    except GroqUnavailable as e:
        log_warning(f"Groq also unavailable: {e}. Storing null explanation.")

    # Terminal: return None — stored as null in DB, retried on next recompute
    return None
```

#### Null-and-retry behavior

If both APIs fail, `explanation = null` is stored in `job_recommendations`. This is not an error state — the recommendation itself is still valid and shown to the user, just without the explanation text. The frontend handles `null` explanation gracefully (hides the explanation section rather than showing an error).

On the next recompute trigger (resume re-upload, interview completion, admin refresh), the engine checks for `explanation IS NULL` records and attempts generation again before processing already-explained recommendations.

```python
# In engine.py, during recompute — retry null explanations first
for rec in existing_recommendations_with_null_explanation:
    explanation = generate_explanation(applicant, rec.job, rec.score_breakdown)
    update_explanation(rec.id, explanation)
```

#### Fallback flag in score_breakdown

```json
{
  "explanation_source": "groq_fallback",
  "explanation": "Your Python and backend skills are a strong match..."
}
```

Possible values for `explanation_source`: `"gemini"`, `"groq_fallback"`, `null` (both failed).

---

### Fallback Summary Table

| Component | Primary | Fallback | Terminal |
|---|---|---|---|
| Skill embeddings (Tier 2) | Gemini Embedding 2 Preview | TF-IDF score only | TF-IDF (always available) |
| Document embeddings (Tier 5) | Gemini Embedding 2 Preview | Skip doc_similarity | Use TF-IDF-only skill score |
| Explanation (Tier 5b) | Gemini 2.5 Flash | Groq LLaMA 3 | Store null, retry on recompute |

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
Resume parsed (first time)     → compute_recommendations(applicant_id)
Resume re-parsed               → recompute_recommendations(applicant_id)
New job added by recruiter     → compute_recommendations_for_new_job(job_id)
Interview completed            → refresh_recommendations(applicant_id)
Admin manual refresh           → recompute_recommendations(applicant_id)
```

### FastAPI BackgroundTasks Flow

```
POST /parse/{applicant_id}
    → parse resume (blocking)
    → background_tasks.add_task(compute_recommendations, applicant_id, db)
    → return parse result immediately to user

# In background (non-blocking):
compute_recommendations(applicant_id):
    1. Fetch applicant profile from DB
    2. For each active job:
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
        ├── engine.py               ← Orchestrator. Calls all scorers, aggregates score,
        │                             writes to DB. Entry point for background task.
        │                             Handles embedding fallback detection and
        │                             null-explanation retry logic.
        │
        ├── embedder.py             ← Wraps google-genai SDK for Gemini Embedding 2 Preview.
        │                             Exposes: embed(text), cosine_sim(v1, v2).
        │                             Handles task instruction prefixing, DB cache
        │                             read/write, and raises GeminiEmbeddingUnavailable
        │                             on failure so engine.py can trigger TF-IDF fallback.
        │                             Shared by semantic_scorer and document_scorer.
        │
        ├── explainer.py            ← Gemini 2.5 Flash primary, Groq LLaMA 3 fallback.
        │                             Takes (applicant, job, breakdown) → str | None.
        │                             Implements full fallback chain. Records
        │                             explanation_source in breakdown. Returns None
        │                             if both APIs fail (null-and-retry pattern).
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
        │   │                         Raises GeminiEmbeddingUnavailable on API failure.
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

### Python Packages to Add

```
google-genai           # Gemini Embedding 2 Preview + Gemini 2.5 Flash (one SDK for both)
scikit-learn==1.4.0    # Tier 1 TF-IDF (TfidfVectorizer) + cosine similarity math
numpy==1.26.0          # Vector math (likely already installed)
```

`google-genai` covers both embedding and LLM generation via a single `GEMINI_API_KEY`.
`groq` SDK is already installed (used elsewhere in the project) — no new package needed for the LLM fallback.

### API Usage Pattern

```python
from google import genai

client = genai.Client(api_key=GEMINI_API_KEY)

# Embeddings (Tier 2 + Tier 5)
result = client.models.embed_content(
    model="gemini-embedding-2-preview",
    contents="Represent this skill set for semantic similarity matching: Python, FastAPI, PostgreSQL"
)
vector = result.embeddings[0].values  # list of floats

# LLM text generation — primary (Tier 5b)
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Your explanation prompt here..."
)
explanation = response.text

# LLM text generation — fallback (Tier 5b)
from groq import Groq
groq_client = Groq(api_key=GROQ_API_KEY)
response = groq_client.chat.completions.create(
    model="llama3-8b-8192",
    messages=[{"role": "user", "content": "Your explanation prompt here..."}]
)
explanation = response.choices[0].message.content
```

### What Is NOT Needed

- No `sentence-transformers` package (replaced by Gemini Embedding API)
- No local model download (~80MB saved)
- No Redis (in-memory dict is sufficient at free tier scale)
- No Celery (FastAPI BackgroundTasks is enough)
- No vector database like Pinecone or Weaviate (PostgreSQL BYTEA for embeddings)

---

## 15. Build Order

Build and test each tier independently before moving to the next.

```
Step 1:  Build embedder.py
         Test: embed a list of skills via Gemini API, verify vector shape,
               test GeminiEmbeddingUnavailable exception is raised on failure

Step 2:  Build tfidf_scorer.py (Tier 1)
         Test: build corpus from seed jobs, score a sample applicant, verify 0.0–1.0 output
         Note: This is the embedding fallback — must be solid before Tier 2

Step 3:  Build semantic_scorer.py (Tier 2)
         Test: "ML" vs "Machine Learning" should score > 0.85
         Test: simulate Gemini failure → verify TF-IDF fallback activates

Step 4:  Build temporal_scorer.py (Tier 4)
         Test: job posted today → multiplier ~1.0, job posted 90 days ago → multiplier ~0.52

Step 5:  Build document_scorer.py (Tier 5)
         Test: embed resume summary vs job description, verify similarity is sensible
         Test: simulate Gemini failure → verify None is returned cleanly

Step 6:  Build aggregator.py
         Test: feed normal scorer outputs, verify formula and 0.0–1.0 range
         Test: feed fallback outputs (embedding_fallback=True, doc_similarity=None),
               verify score degrades gracefully and breakdown flags are set correctly

Step 7:  Build personalization_scorer.py (Tier 3)
         Test: simulate feedback history, verify multiplier increases for matching jobs
         Note: Build this last because it requires the feedback table and real user data

Step 8:  Build explainer.py
         Test: call Gemini 2.5 Flash with a sample breakdown, verify natural language output
         Test: simulate Gemini failure → verify Groq fallback activates
         Test: simulate both APIs failing → verify None returned, explanation_source=null

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
| 2 | Semantic Skill Matching | Synonym/context-aware skill matching | Gemini Embedding 2 Preview | TF-IDF (Tier 1) |
| 3 | Personalization | User-specific re-ranking via behavior | PostgreSQL (feedback table) | — |
| 4 | Temporal Decay | Job freshness + demand awareness | Pure Python (math) | — |
| 5 | Document Semantics | Full resume vs full job description | Gemini Embedding 2 Preview | TF-IDF-only skill score |
| 5b | Explainability | Human-readable reason per recommendation | Gemini 2.5 Flash | Groq LLaMA 3 → null + retry |

---

*Document version: 1.1 | Project: unknown-spec10/Career-Guidance | Scope: Recommendation Engine Redesign*
