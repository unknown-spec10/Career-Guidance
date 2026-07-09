# Database Performance Audit: FastAPI Backend & Recommendation Engine

This report presents the findings, root causes, and refactoring recommendations for database performance issues (primarily N+1 query patterns) identified in the FastAPI backend (`resume_pipeline/`) of the Career Guidance system.

---

## Executive Summary
The Career Guidance backend suffers from several classic database performance bottlenecks. In the `/api/applicants` route, paginated lookups trigger individual queries for each record. In the recommendation engine, candidate-job scoring loops execute redundant database queries (up to hundreds per recommendation run) for user history, interview sessions, and cached embeddings. Crucially, a logical bug in the job embedding cache causes skill and document embeddings to collide, leading to incorrect similarity calculations.

---

## Findings & Refactoring Recommendations

### Finding 1: N+1 Queries in `/api/applicants` Endpoint

- **File Path**: `resume_pipeline/resume_pipeline/app.py`
- **Line Numbers**: 1631–1672 (specifically line 1654)
- **Root Cause**: The route handler queries paginated `Applicant` records and then, for each applicant, executes a separate query to fetch their `LLMParsedRecord`.
- **Code snippet (Current)**:
  ```python
  applicants = query.limit(limit).all()
  ...
  result = []
  for app in applicants:
      llm_record = db.query(LLMParsedRecord).filter(LLMParsedRecord.applicant_id == app.id).first()
      result.append({
          ...
          "has_parsed_data": llm_record is not None,
          "needs_review": llm_record.needs_review if llm_record else False
      })
  ```
- **Impact**: Up to 51 queries are executed for a default limit of 50 applicants.
- **Refactoring Recommendation**: 
  Since the `Applicant` model has a defined 1-to-1 relationship `parsed_record` pointing to `LLMParsedRecord`, we should eagerly load it using SQLAlchemy's `joinedload`.
- **Proposed Refactoring**:
  ```python
  from sqlalchemy.orm import joinedload

  # Eagerly load parsed_record
  query = db.query(Applicant).options(joinedload(Applicant.parsed_record)).order_by(desc(Applicant.created_at))
  ...
  applicants = query.limit(limit).all()
  ...
  result = []
  for app in applicants:
      # Access pre-loaded relationship attribute
      llm_record = app.parsed_record
      result.append({
          ...
          "has_parsed_data": llm_record is not None,
          "needs_review": llm_record.needs_review if llm_record else False
      })
  ```

---

### Finding 2: Multiple N+1 Queries in Recommendation Engine (`compute_recommendations`)

- **File Path**: `resume_pipeline/resume_pipeline/recommendation/engine.py`
- **Line Numbers**: 125–285
- **Root Cause**: The scoring engine loops through all `active_jobs` (up to hundreds of jobs) for a single applicant and triggers three separate query-loop patterns:
  1. **Job Recommendation Cache Lookup (Lines 188–191)**: Queries `JobRecommendation` one-by-one to inspect cached explanations.
  2. **Interview Session Lookup (Lines 66–69, inside `run_pipeline_for_applicant_job`)**: Queries the applicant's completed `InterviewSession` repeatedly for *every* job.
  3. **Personalization Scorer Profile Building (Lines 22 & 39 in `personalization_scorer.py`, inside `run_pipeline_for_applicant_job`)**: Queries `UserFeedback` and corresponding interacted `Job` records repeatedly for the same applicant on *every* job.
- **Code snippets (Current)**:
  *Looping JobRecommendation lookup:*
  ```python
  for i, (job, breakdown, score_percent) in enumerate(scored_jobs):
      existing_rec = db.query(JobRecommendation).filter(
          JobRecommendation.applicant_id == applicant_id,
          JobRecommendation.job_id == job.id
      ).first()
  ```
  *Looping InterviewSession query (inside `run_pipeline_for_applicant_job`):*
  ```python
  latest_session = db.query(InterviewSession).filter(
      InterviewSession.applicant_id == applicant.id,
      InterviewSession.status == "completed"
  ).order_by(InterviewSession.completed_at.desc()).first()
  ```
- **Impact**: Executes `3 * len(active_jobs)` database queries. If there are 100 active jobs, this results in 300 database queries, causing severe request latency.
- **Refactoring Recommendation**:
  1. **Batch `JobRecommendation` Lookups**: Query all existing recommendations for this applicant and active jobs in a single query and store them in a lookup dictionary.
  2. **Query `InterviewSession` Once**: Fetch the completed interview session for the applicant once outside the loop and pass the resolved score to `run_pipeline_for_applicant_job`.
  3. **Precompute Personalization Preferences**: Retrieve the user's feedback and interacted jobs once per recommendation run, compiling the preferences object inside `PersonalizationScorer` rather than rebuilding it on every iteration.
- **Proposed Refactoring**:
  *In `engine.py` (`compute_recommendations`):*
  ```python
  # 1. Fetch applicant's interview score once
  latest_session = db.query(InterviewSession).filter(
      InterviewSession.applicant_id == applicant_id,
      InterviewSession.status == "completed"
  ).order_by(InterviewSession.completed_at.desc()).first()
  interview_score = float(latest_session.overall_score) / 100.0 if latest_session and latest_session.overall_score is not None else None

  # 2. Batch query existing job recommendations
  existing_recs = db.query(JobRecommendation).filter(
      JobRecommendation.applicant_id == applicant_id,
      JobRecommendation.job_id.in_([job.id for job in active_jobs])
  ).all()
  existing_recs_dict = {rec.job_id: rec for rec in existing_recs}

  # 3. Pre-initialize PersonalizationScorer with applicant data
  personalization_scorer = PersonalizationScorer(db)
  personalization_scorer.precompute_preferences(applicant_id)
  
  # Pass interview_score to the pipeline runner
  for job in active_jobs:
      breakdown = run_pipeline_for_applicant_job(
          ...,
          interview_score=interview_score,
          personalization_scorer=personalization_scorer,
          ...
      )
  ...
  for i, (job, breakdown, score_percent) in enumerate(scored_jobs):
      existing_rec = existing_recs_dict.get(job.id)
  ```

---

### Finding 3: N+1 Queries in New Job Recommendation Backfilling (`compute_recommendations_for_new_job`)

- **File Path**: `resume_pipeline/resume_pipeline/recommendation/engine.py`
- **Line Numbers**: 288–438
- **Root Cause**: When backfilling recommendations for a new job:
  1. The code fetches all applicants using `db.query(Applicant).join(LLMParsedRecord).all()` but fails to eagerly load `parsed_record`. During pipeline execution, accessing `applicant.parsed_record` triggers an N+1 query loop.
  2. Inside the batch iteration loop, it queries `JobRecommendation` one-by-one for each candidate.
- **Impact**: Generates `2 * len(applicants)` database queries, which degrades performance as the number of registered users scales.
- **Refactoring Recommendation**:
  1. Use `options(joinedload(Applicant.parsed_record))` when loading the applicant base.
  2. Query `JobRecommendation` records in batches matching the applicant IDs in the current chunk.
- **Proposed Refactoring**:
  ```python
  # Eager load parsed_record
  applicants = db.query(Applicant).options(joinedload(Applicant.parsed_record)).join(LLMParsedRecord).all()
  ...
  # Batch load recommendations for all applicants for this job
  existing_recs = db.query(JobRecommendation).filter(
      JobRecommendation.job_id == job_id,
      JobRecommendation.applicant_id.in_([app.id for app in applicants])
  ).all()
  existing_recs_dict = {rec.applicant_id: rec for rec in existing_recs}
  ...
  for idx, (applicant, breakdown, score_percent) in enumerate(batch):
      existing_rec = existing_recs_dict.get(applicant.id)
  ```

---

### Finding 4: Embedding Cache Redundant DB Queries & Critical Collision Bug

- **File Path**: `resume_pipeline/resume_pipeline/recommendation/embedder.py`
- **Line Numbers**: 94–175
- **Root Cause**:
  1. **Redundant Queries**: `get_applicant_embedding` is called twice per job (for skills and full document matching) and runs a database query to `ApplicantEmbedding` every single time, leading to `2 * len(active_jobs)` identical database requests for the same applicant. Similarly, `get_job_embedding` queries the database individually for each job inside the loop.
  2. **Critical Cache Collision Bug**: The `JobEmbeddingsCache` table has only `job_id` as the primary key. It lacks a `source_hash` or `suffix` column. Because of this, when `SemanticScorer` queries the cache for the job's skills embedding, it generates and stores it under `job_id`. When `DocumentScorer` later queries the cache for the job's full description embedding, it hits the same `job_id` entry and returns the *skills embedding* instead of generating the description embedding. This corrupts the document-level similarity score.
- **Impact**: Performance degradation due to redundant queries, and logical corruption of recommendation scores because document similarity matching incorrectly compares the candidate's resume to the job's skills list.
- **Refactoring Recommendation**:
  1. Add an in-memory dictionary cache on the `Embedder` instance (e.g. `self._local_cache`) to avoid repeated database lookups for the applicant's embedding during the request lifecycle. Eagerly load all cached job embeddings for the active job IDs into the local cache before running the loop.
  2. **Schema Migration**: Add a `source_hash` or `suffix` column (similar to `ApplicantEmbedding`) to the `JobEmbeddingsCache` schema. Use a composite primary key or filter by `(job_id, source_hash)` to resolve cache collisions.
- **Proposed Refactoring (In-memory caching)**:
  *In `embedder.py`:*
  ```python
  class Embedder:
      def __init__(self, db: Session):
          self.db = db
          self._local_cache = {} # Keyed by (entity_type, entity_id, suffix_or_hash)

      def get_applicant_embedding(self, applicant, text: str, suffix: str = "", instruction: str = None):
          source_hash = self._source_hash(text, suffix)
          cache_key = ("applicant", applicant.id, source_hash)
          if cache_key in self._local_cache:
              return self._local_cache[cache_key]

          # Query DB if not cached in memory
          existing = self.db.query(ApplicantEmbedding).filter(
              ApplicantEmbedding.applicant_id == applicant.id,
              ApplicantEmbedding.source_hash == source_hash
          ).first()
          
          if existing:
              vector = list(existing.embedding_vector)
              self._local_cache[cache_key] = vector
              return vector

          # Generate embedding via Gemini and save...
  ```

---

### Finding 5: N+1 Queries in Skill Normalizer pgvector Lookups

- **File Path**: `resume_pipeline/resume_pipeline/resume/skill_normalizer.py`
- **Line Numbers**: 335–350
- **Root Cause**: During semantic normalizer pass 2, the engine queries the nearest canonical skill using native pgvector cosine similarity inside a loop for each unmatched skill.
- **Impact**: Executes a separate database query for each skill that requires semantic matching.
- **Refactoring Recommendation**: Use a PostgreSQL `LATERAL` join combined with a `VALUES` expression containing all input vectors to execute a single batched pgvector query.
- **Proposed Refactoring**:
  ```python
  # Build a VALUES list representation for SQL lateral join
  # Execute a single query fetching the nearest matching CanonicalSkill for all vectors:
  # SELECT v.idx, cs.name, cs.id, cs.category, 1 - (cs.embedding <=> v.vec::vector) AS similarity ...
  ```
