================================================================================
RESUME PARSE PIPELINE — RECONSTRUCTION DESIGN DOCUMENT
Career Guidance AI System | unknown-spec10/Career-Guidance
Date: May 2026
Version: 2.0 (Full rewrite — incorporates recommendation engine redesign context)
================================================================================

This document captures every architectural decision, trade-off, and reasoning
for reconstructing the resume parsing (parse_service) layer of the Career
Guidance system. It is written with full awareness of the parallel
recommendation engine redesign (RECOMMENDATION_ENGINE_ARCHITECTURE.md) and
must be read alongside it. Decisions in this document deliberately align with
and share infrastructure introduced in that redesign.

================================================================================
0. INFRASTRUCTURE MIGRATION PREAMBLE — JSON → PGVECTOR
================================================================================

CONTEXT:
  The original parse pipeline stored embeddings as JSON arrays (or BYTEA blobs)
  in standard PostgreSQL columns. This was a temporary approach used before the
  recommendation engine redesign was finalized.

  The recommendation engine redesign (RECOMMENDATION_ENGINE_ARCHITECTURE.md)
  introduced pgvector as the storage and similarity search layer for job
  description embeddings and resume embeddings. That decision has a direct
  consequence for this pipeline: ALL embedding storage in the system — whether
  in the recommendation layer or the parsing layer — must migrate to pgvector.

WHY A SINGLE VECTOR INFRASTRUCTURE:
  Having two different embedding storage strategies (JSON for parsing, pgvector
  for recommendations) would create split infrastructure with no shared query
  patterns, inconsistent index support, and unnecessary maintenance overhead.

  The unified approach is:
    - One PostgreSQL extension (pgvector) handles all vector storage
    - One index type (HNSW) used consistently across all vector columns
    - One query pattern (cosine distance operator <=>) used everywhere
    - The Python binding (pip install pgvector) is a single shared dependency

  This means the canonical_skills table (parsing layer) and the
  job_embeddings_cache table (recommendation layer) are both Vector columns,
  both indexed with HNSW, and both queried with the same SQL pattern.

EMBEDDING MODEL ALIGNMENT:
  The recommendation engine uses gemini-embedding-2-preview for all semantic
  embeddings (job descriptions, resume summaries, skill matching).

  IMPORTANT — Model Boundary:
  The parse pipeline's skill normalization layer uses a DIFFERENT Google
  embedding model: gemini-embedding-2-preview with task context set via prompt
  prefix for SEMANTIC_SIMILARITY use. The reason is that skill normalization
  is a short-string-to-short-string matching task, not a document retrieval
  task. Both layers use the same GEMINI_API_KEY and google-genai SDK. The
  vectors they produce live in the same pgvector infrastructure but in
  DIFFERENT tables — they are never compared cross-table.

  Summary of embedding model usage across the full system:
    canonical_skills.embedding     → gemini-embedding-2-preview
                                     (task: semantic similarity, short strings)
    job_embeddings_cache.embedding → gemini-embedding-2-preview
                                     (task: document matching, long text)
    resume_embeddings (future)     → gemini-embedding-2-preview
                                     (task: document matching, long text)

  All three use the same SDK and API key. Vector dimensions are consistent
  at 768 across all tables unless overridden in config.

WHAT THIS PREAMBLE MEANS FOR IMPLEMENTATION:
  Before implementing any layer of the parse pipeline redesign, the following
  migration must be completed first:

  Step 0a: Enable pgvector extension (if not already active)
    SQL: CREATE EXTENSION IF NOT EXISTS vector;
    Verify: SELECT * FROM pg_extension WHERE extname = 'vector';

  Step 0b: Add embedding column to canonical_skills
    SQL: ALTER TABLE canonical_skills ADD COLUMN embedding Vector(768);
    Then: CREATE INDEX ON canonical_skills
          USING hnsw (embedding vector_cosine_ops);

  Step 0c: Run the canonical skills embedding migration script
    A one-time script (seed_skill_embeddings.py) that:
      1. Reads all canonical skill names from canonical_skills
      2. Sends them in batches to gemini-embedding-2-preview
         with prompt prefix: "Represent this skill name for
         semantic similarity matching: {skill_name}"
      3. Stores returned 768-dim vectors in embedding column
    This runs ONCE. Only re-run when new skills are added to the taxonomy.

  Step 0d: Drop any existing JSON/BYTEA embedding columns
    If canonical_skills previously had an embedding JSON column, drop it
    after Step 0c is complete and verified.

================================================================================
1. CONTEXT — WHY WE ARE REBUILDING THIS
================================================================================

The existing parse pipeline was producing substandard results on real-world
resume inputs. Two failure modes were confirmed:

  Failure Mode 1: Missing fields
    - Skills were not being extracted fully or at all
    - Education sections were coming through incomplete (missing GPA, years,
      institution names truncated)
    - This directly degrades downstream recommendation quality because the
      recommendation scoring algorithm depends on complete, accurate parsed
      data for skill matching, experience fit, and academic signals

  Failure Mode 2: Layout-sensitive failures
    - Resumes worked on clean, plain text PDFs
    - Failed on designed PDFs (two-column layouts, icons, graphic headers)
    - Failed on scanned/image-based PDFs
    - This is a critical gap because most real candidate resumes use designed
      templates from Canva, Novoresume, or similar tools

Root Cause Diagnosis:
  The root cause was identified as the preprocessing layer, not the LLM.
  Gemini is a capable model, but it is only as good as the text it receives.
  The current preprocessor uses a naive text dump (pdfplumber or PyMuPDF with
  default settings) which destroys column layouts and drops text embedded in
  graphical elements entirely. Gemini then receives garbled or incomplete text
  and cannot recover missing information it was never given.

  The secondary cause is the single-shot prompting strategy — one large
  "extract everything" prompt tends to hallucinate values for missing fields
  rather than returning null, and systematically under-extracts nested
  structures like multi-role experience histories and project details.

================================================================================
2. HIGH-LEVEL REDESIGN — THE FOUR LAYERS
================================================================================

The reconstructed pipeline has four distinct layers, each with a clear
responsibility. They are described below and detailed in subsequent sections.

  Layer 1: Intelligent Ingestion (FileTypeRouter)
    Detects the resume type and routes to the appropriate text/image extractor.
    This is the highest-leverage change — fixes the layout-sensitive failures.

  Layer 2: Decomposed LLM Extraction (Concurrent Section Prompts)
    Replaces the single-shot Gemini prompt with six section-scoped prompts
    run concurrently via asyncio.gather(). Each section (contact, education,
    experience, skills, projects, extras) gets its own focused extraction call.
    Fixes missing fields and reduces total latency.

  Layer 3: Two-Pass Skill Normalization
    Replaces the word-boundary regex against canonical_skills with a two-pass
    system: rapidfuzz for fast fuzzy matching, then Gemini embeddings + pgvector
    for semantic matching of abbreviations and synonyms.

  Layer 4: Confidence-Aware Storage (State Machine)
    Adds a state machine on top of storage so that low-confidence parses are
    flagged for human review rather than silently stored with bad data.
    Confidence is computed via heuristic field completeness — not LLM
    self-reporting.

Full end-to-end flow:

  PDF Upload
      ↓
  FileTypeRouter (detect: text-based / designed / scanned)
      ↓               ↓                    ↓
  pdfplumber     Gemini Vision         Gemini Vision
  (layout-aware) (image input)         (primary) → Tesseract (offline fallback)
      ↓               ↓                    ↓
            Cleaned, section-aware text
                       ↓
      Six section-scoped prompts → asyncio.gather() → concurrent execution
                       ↓
          Pydantic validation per section
                       ↓
          Per-section confidence scoring (heuristic, not LLM self-report)
                       ↓
          Section retry if confidence < 0.70 (single retry, broader context)
                       ↓
      Skill normalization:
        Pass 1: rapidfuzz (score > 82 → accept)
        Pass 2: gemini-embedding-2-preview + pgvector cosine search (score > 0.80 → accept)
        Unrecognized: stored in unrecognized_skills field for taxonomy growth
                       ↓
      overall_confidence = average of per-section heuristic scores
                       ↓
      Confidence gate:
        ≥ 0.85  → AUTO_ACCEPT  → store → trigger recommendation pipeline
        0.60–0.84 → NEEDS_REVIEW → store pending → human_reviews queue
        < 0.60  → RE_PARSE     → retry with Vision → escalate or fail
                       ↓
      llm_parsed_records (with per-field confidence scores + unrecognized_skills)

================================================================================
3. LAYER 1 — INTELLIGENT INGESTION (FileTypeRouter)
================================================================================

WHY WE DESIGNED THIS:
  A single extraction strategy cannot handle the three fundamentally different
  resume formats that exist in practice. Treating all PDFs the same is the
  core reason the current system fails on designed and scanned resumes.

THE THREE RESUME TYPES AND THEIR EXTRACTORS:

  Type A: Text-based PDFs (ATS-friendly)
    These are resumes created in Word, Google Docs, or simple LaTeX. They
    contain actual text characters embedded in the PDF. pdfplumber can extract
    this text reliably IF configured for layout awareness (column detection).
    Use pdfplumber with layout=True and explicit bounding box handling.

  Type B: Designed PDFs (Canva, Novoresume, multi-column templates)
    These PDFs technically contain text, but it is arranged in visually complex
    layouts — two columns, sidebar sections, icon-prefixed items. Naive text
    extraction reads columns left-to-right across the page, merging unrelated
    content. The extracted text is garbled and nearly unparseable.
    The correct strategy: do NOT extract text. Render the PDF page as an image
    and send it directly to Gemini Vision. Gemini's multimodal capability
    understands visual layout and correctly identifies sections even in complex
    designs. This is the key architectural insight for this type.

  Type C: Scanned/Image PDFs
    These are PDFs that contain only rasterized images with no embedded text
    at all (typically scanned physical documents). pdfplumber returns empty
    strings. Primary strategy: Gemini Vision (same as Type B — it reads image
    content directly). Offline fallback: Tesseract OCR if Gemini API is down.

DETECTION LOGIC:
  The router detects type using a heuristic that requires no model call:

  Step 1: Attempt text extraction with pdfplumber on the first 2 pages.
  Step 2: Count extracted characters per page.
    - If characters per page < 200
      → scanned/image PDF → route to Gemini Vision (Tesseract if offline)
    - If characters per page ≥ 200 but whitespace ratio is anomalous
      (more than 40% of characters are spaces or newlines in unexpected
      patterns) → likely multi-column designed PDF → route to Gemini Vision
    - Otherwise → clean text PDF → route to pdfplumber layout-aware extraction

  This heuristic runs in milliseconds and handles the vast majority of
  real-world cases without any model call.

FALLBACK CHAIN FOR TYPE B AND TYPE C:
  Primary:  Gemini Vision (gemini-2.5-flash multimodal, image input)
  Fallback: Tesseract OCR (offline, no API dependency)
  Condition: Tesseract only activates if Gemini Vision API is unavailable.
             For all normal operating conditions, Gemini Vision is used for
             both designed and scanned PDFs.

TRADE-OFFS:
  Trade-off: Gemini Vision costs more per call than text extraction (image
  tokens are more expensive than text tokens).
  Decision: Accepted. The quality improvement is significant and the cost
  difference for a single resume is negligible. Resume parsing is not a
  high-frequency operation.

  Trade-off: Tesseract is less accurate than Gemini Vision for low-quality
  or handwritten scans.
  Decision: Accepted. Tesseract is only the offline fallback. In normal
  operation it is never invoked. Low-quality Tesseract output on genuinely
  bad scans will be caught by the confidence gate in Layer 4 and flagged
  for re-upload.

================================================================================
4. LAYER 2 — DECOMPOSED LLM EXTRACTION (CONCURRENT)
================================================================================

WHY WE DESIGNED THIS:
  A single "extract everything from this resume" prompt has two systematic
  problems. First, when a section is missing from the resume, the LLM
  hallucinates a value rather than returning null, because the prompt creates
  implicit pressure to fill all fields. Second, a large combined prompt
  produces shallower extraction on each section because attention is
  distributed across everything simultaneously.

  Section-scoped prompts fix both problems: the model has full attention on
  one section, and returning null/empty is natural when a focused prompt
  finds no relevant content.

CONCURRENCY — WHY asyncio.gather():
  Six sequential Gemini API calls would produce 10-15 seconds of wall time
  per resume parse. This is unacceptable even for a background task.

  All six section prompts are INDEPENDENT — they do not depend on each other's
  output. This makes them trivially parallelizable via asyncio.gather():

    results = await asyncio.gather(
        extract_contact(text),
        extract_education(text),
        extract_experience(text),
        extract_skills(text),
        extract_projects(text),
        extract_extras(text),
    )

  Total wall time = latency of the SLOWEST single call, not the sum of all six.
  In practice this reduces parse time from ~12 seconds to ~3-4 seconds.

  Note: All six prompts receive the FULL cleaned resume text, not pre-segmented
  sections. Section segmentation is the LLM's job — pre-segmenting in Python
  would require its own logic and would replicate the fragility of the old
  approach. Each focused prompt naturally attends to its section within the
  full text.

THE SIX EXTRACTION SECTIONS:

  1. contact
     Extract: full name, email, phone number, LinkedIn URL, GitHub URL,
     portfolio URL, city/location.
     Why separate: contact info has a very different format from everything
     else and benefits from its own validation (email regex, URL format check).

  2. education
     Extract: for each degree — institution name, degree type (B.Tech, BCA,
     M.Sc etc.), field of study, start year, end year, GPA/CGPA/percentage,
     board/university name, relevant coursework if listed.
     Why separate: education is the most critical section for this use case.
     CGPA is used directly in the recommendation scoring formula and needs
     the most careful extraction.

  3. experience
     Extract: for each role — company name, job title, employment type
     (full-time/internship/contract), start date, end date, location,
     bullet points/responsibilities as a list.
     Why separate: experience sections have the most varied formatting in
     real resumes. A dedicated prompt handles bullets, paragraphs, and
     mixed formats explicitly.

  4. skills
     Extract: all skills mentioned anywhere in the document, grouped loosely
     by type if grouping is present (Languages, Frameworks, Tools).
     Return as a flat list if no grouping is evident.
     Why separate: skills are scattered throughout resumes — in a dedicated
     skills section, in experience bullets ("built using React"), in project
     descriptions. A focused pass catches all of them.

  5. projects
     Extract: for each project — name, description (1-2 sentences), tech
     stack as a list, URLs if present, role if specified, duration.
     Why separate: projects are the most structured section but also the
     most frequently missed by single-shot prompts. A dedicated section
     recovers significantly more project detail.

  6. extras
     Extract: certifications (name, issuer, year), awards, languages spoken,
     publications, volunteer work, hobbies if listed.
     Why separate: catch-all for everything outside the main five sections.
     Keeping it as a focused prompt ensures residual information is not lost.

RETRY LOGIC:
  After concurrent execution, check per-section confidence (see Section 5
  for how confidence is computed). If a section confidence < 0.70:
    - Retry that section prompt ONCE with a broader context window
      (include surrounding text hints in the prompt)
    - Do NOT retry the full document — only the failing section
    - If retry confidence is still < 0.70 → accept lower score,
      Layer 4 state machine handles escalation

  Retries are also run concurrently if multiple sections need retry.

TRADE-OFFS:
  Trade-off: 6 API calls instead of 1.
  Decision: Accepted. Total token count is comparable or lower because each
  prompt carries less context. Quality improvement is significant. Concurrency
  via asyncio.gather() keeps wall time acceptable (3-4 seconds, not 12+).

  Trade-off: More complex orchestration code in parse_service.py.
  Decision: Accepted. A simple async loop over the section list is manageable.
  The existing ResumeParserService class absorbs this cleanly.

================================================================================
5. CONFIDENCE SCORING — HOW IT IS COMPUTED
================================================================================

WHY NOT LLM SELF-REPORTING:
  Asking the LLM to return a confidence score alongside its extraction output
  (e.g. "confidence": 0.82) is unreliable. Language models are poorly
  calibrated at self-assessment — they frequently return high confidence for
  hallucinated values. LLM self-reported confidence cannot be trusted as a
  quality gate.

THE CORRECT APPROACH — HEURISTIC FIELD COMPLETENESS:
  Confidence is computed by the Python layer AFTER extraction, based on
  observable properties of the extracted data. It does not ask the model
  to evaluate itself.

  Per-section confidence formula:

  contact_confidence:
    Score = (fields_present / total_expected_fields)
    Expected fields: name, email, phone, location (4 fields)
    Bonus: +0.05 if LinkedIn or GitHub URL present
    Example: name + email + phone extracted, no location → 3/4 = 0.75

  education_confidence:
    For each degree entry, check: institution, degree_type, field, year,
    cgpa/gpa (5 fields). Score = average completeness across all entries.
    Critical field penalty: if cgpa/gpa is missing → cap section confidence
    at 0.70 regardless of other fields (CGPA is directly used in scoring).

  experience_confidence:
    For each role: company, title, start_date, end_date, responsibilities (5 fields).
    Score = average completeness across all roles.
    If zero roles extracted but resume has > 500 words → likely extraction
    failure → set confidence = 0.30 to trigger re-parse.

  skills_confidence:
    Minimum expected: 3 skills for any technical resume.
    Score: min(skills_count / 8, 1.0) — capped at 1.0 at 8+ skills.
    Rationale: fewer than 3 skills almost always indicates extraction failure,
    not an unusually sparse resume.

  projects_confidence:
    Optional section — if zero projects found, confidence = 0.80 (not a
    failure, many resumes have no dedicated projects section).
    If projects section is detected by the LLM but extraction is empty
    → confidence = 0.40.

  extras_confidence:
    Optional section — defaults to 0.85 (absence is normal).
    Only penalized if certifications are mentioned in text but not extracted.

  overall_confidence:
    Weighted average of per-section scores:
      overall = (
          0.10 × contact_confidence +
          0.35 × education_confidence +   ← highest weight: CGPA critical
          0.25 × experience_confidence +
          0.20 × skills_confidence +
          0.05 × projects_confidence +
          0.05 × extras_confidence
      )

  This weighted average reflects the relative importance of each section to
  downstream recommendation quality. Education and skills matter most.

================================================================================
6. LAYER 3 — TWO-PASS SKILL NORMALIZATION
================================================================================

WHY WE REDESIGNED THIS:
  The current skill taxonomy matching uses word-boundary regex against the
  canonical_skills table. This has three failure modes:
    1. Abbreviations: "K8s" does not match "Kubernetes", "TF" does not match
       "TensorFlow", "GCP" does not match "Google Cloud Platform"
    2. Variations: "React.js" vs "ReactJS" vs "React" — same skill, regex
       treats them as distinct unless all variants are explicitly enumerated
    3. Implicit skills: "built REST APIs with FastAPI" contains skills that
       require contextual extraction, not direct string matching

WHY NOT TF-IDF FOR SKILL NORMALIZATION:
  TF-IDF is used in the recommendation engine for job-to-candidate matching
  (see RECOMMENDATION_ENGINE_ARCHITECTURE.md, Tier 1). It is NOT appropriate
  for skill normalization for two reasons:

  Problem 1 — Out-of-vocabulary: If "K8s" was not in the TF-IDF training
  corpus, it gets a zero vector. You cannot find its nearest neighbor because
  it has no representation. This is exactly the abbreviation problem.

  Problem 2 — Semantic blindness: TF-IDF has no concept of meaning.
  "React" and "Redux" appear unrelated. Character n-gram similarity would
  make "Java" and "JavaScript" appear similar even though they are different.

  TF-IDF is correctly used in the recommendation layer. It is wrong here.

THE TWO-PASS DESIGN:

  Pass 1 — rapidfuzz (fast, free, no API call)
    rapidfuzz implements fuzzy string matching using edit distance algorithms
    (Levenshtein, Jaro-Winkler, token sort ratio). It handles:
      - Case variations: "python" → "Python"
      - Minor spelling differences: "Postgressql" → "PostgreSQL"
      - Hyphen/dot variations: "React.js" → "ReactJS"
      - Partial abbreviation overlap: "JS" → "JavaScript"

    Implementation:
      Load all canonical skill names from canonical_skills at service startup.
      For each extracted skill string:
        result = process.extractOne(skill, canonical_names, scorer=WRatio)
        if result.score > 82 → accept mapping → done
        if result.score ≤ 82 → escalate to Pass 2

    Threshold of 82: High enough to avoid false positives (prevents "Go"
    mapping to "Google") but low enough to catch genuine abbreviation matches.

    Why rapidfuzz over fuzzywuzzy: rapidfuzz is the modern drop-in replacement,
    written in C++, 10-100x faster, actively maintained. fuzzywuzzy is
    deprecated. Install: pip install rapidfuzz.

  Pass 2 — gemini-embedding-2-preview + pgvector (semantic matching)
    For skills that rapidfuzz cannot confidently match (score ≤ 82), use
    semantic embeddings to find the nearest canonical skill by meaning.

    Model: gemini-embedding-2-preview via google-genai SDK.
    Same API key (GEMINI_API_KEY), same SDK — no new credentials or libraries.

    Task context (via prompt prefix, since gemini-embedding-2-preview does not
    accept a task_type parameter):
      Prefix: "Represent this skill name for semantic similarity matching: "
      This is consistent with how canonical skill embeddings were pre-populated
      in Step 0c of the migration preamble.

    At parse time, for a skill that fails Pass 1:
      1. Embed the extracted skill string via gemini-embedding-2-preview
      2. Query pgvector:
           SELECT name, 1 - (embedding <=> [query_vector]) AS similarity
           FROM canonical_skills
           ORDER BY embedding <=> [query_vector]
           LIMIT 1;
      3. If similarity > 0.80 → accept the mapping
      4. If similarity ≤ 0.80 → skill is genuinely unrecognized

    The <=> operator is pgvector's cosine distance operator.
    The HNSW index (created in migration Step 0b) makes this query fast
    regardless of canonical skills table size.

  Unrecognized Skills:
    Skills falling through both passes are stored in an unrecognized_skills
    array on the parsed record — NOT discarded. These are valuable signal.
    A weekly batch job can cluster unrecognized_skills across all parses and
    propose new entries for the canonical taxonomy. This creates a
    self-improving taxonomy over time.

PGVECTOR OVER JSON — WHY:
  This was a deliberate migration decision (see Section 0). In summary:
    - JSON: full table scan on every parse, O(n) Python loop, no index support,
      no type safety, memory pressure under concurrent load
    - pgvector Vector(768): single SQL query, HNSW index (approx. O(log n)),
      dimension enforcement at DB level, consistent with recommendation layer
  The migration to pgvector for canonical_skills.embedding is a prerequisite
  for this layer to function correctly.

TRADE-OFFS:
  Trade-off: rapidfuzz adds a new dependency.
  Decision: Accepted. Single pip install, zero configuration, replaces fragile
  regex with something more accurate and maintainable.

  Trade-off: Gemini embedding API has a per-character cost for Pass 2 calls.
  Decision: Acceptable. Each skill string is 5-30 characters. Only 5-15
  embedding calls per resume (only for skills rapidfuzz cannot match). Cost
  per parse is negligible. Pre-populated canonical embeddings mean the DB-side
  cost is paid only once.

================================================================================
7. LAYER 4 — CONFIDENCE-AWARE STORAGE (STATE MACHINE)
================================================================================

WHY WE DESIGNED THIS:
  The llm_parsed_records table already has a confidence_scores column per the
  existing schema, but without a state machine acting on those scores,
  low-confidence parses are silently stored and treated identically to
  high-confidence ones. This degrades recommendation quality invisibly.

  The human_reviews table also exists but is underutilized. This layer puts
  both tables to proper use and ensures the recommendation engine only ever
  operates on data it can trust.

THE STATE MACHINE:
  After all six sections are extracted and overall_confidence is computed
  (see Section 5):

  Case 1: overall_confidence ≥ 0.85
    Status: AUTO_ACCEPT
    Action:
      - Store to llm_parsed_records with status=accepted
      - Immediately trigger recommendation generation pipeline (background task)
      - No human intervention needed

  Case 2: overall_confidence between 0.60 and 0.84
    Status: NEEDS_REVIEW
    Action:
      - Store to llm_parsed_records with status=pending_review
      - Create entry in human_reviews flagging which sections had low confidence
      - Do NOT trigger recommendation pipeline until review is complete
      - Surface "profile under review" state in user dashboard

  Case 3: overall_confidence < 0.60
    Status: RE_PARSE
    Action:
      - Attempt re-parse using Gemini Vision fallback
        (even if original routing chose text extraction — the text may have
        been corrupt or the layout misidentified)
      - If re-parse overall_confidence ≥ 0.60 → promote to Case 2
      - If re-parse confidence still < 0.60:
          → Store with status=failed
          → Flag for manual resume re-upload
          → Send user notification: "We could not reliably parse your resume.
            Please re-upload or try a different file format."

  This state machine means recommendations are only generated from trusted
  data. The human_reviews queue captures everything needing attention without
  blocking the pipeline for other users.

TRADE-OFFS:
  Trade-off: Users in Case 2 (NEEDS_REVIEW) will not receive recommendations
  immediately.
  Decision: Accepted. It is better to surface an honest "your profile is being
  reviewed" state than to generate recommendations from incomplete data that
  leads to poor matches. A pending state is a better user experience than
  irrelevant recommendations.

  Trade-off: Case 3 re-parse adds latency and a second Gemini Vision API call.
  Decision: Accepted. Case 3 is expected to be rare (< 5% of resumes in
  practice). The cost of one extra Vision call on a small fraction of uploads
  is negligible compared to the cost of storing and acting on bad data.

================================================================================
8. ASYNC ARCHITECTURE — FULL PIPELINE AS BACKGROUND TASK
================================================================================

THE CORE PRINCIPLE:
  The entire parse pipeline — FileTypeRouter, all six section prompts, skill
  normalization, confidence scoring, and the state machine — runs as a
  FastAPI BackgroundTask. The API endpoint never blocks waiting for any of
  this to complete. The user gets a response immediately.

  This is distinct from the internal concurrency (asyncio.gather) inside the
  pipeline. That is about speed within the task. This is about the task itself
  being non-blocking from the API's perspective.

REQUEST/RESPONSE FLOW:

  Step 1: User uploads resume
    POST /upload
      → validate file type and size (synchronous, milliseconds)
      → store raw file to uploads table with status=processing
      → generate parse_id
      → enqueue full parse pipeline as BackgroundTask
      → return immediately:
          HTTP 202 Accepted
          { "parse_id": "uuid", "status": "processing" }

  Step 2: Parse pipeline runs in background (non-blocking)
    Background task executes the full pipeline:
      FileTypeRouter → text extraction / Gemini Vision
          ↓
      asyncio.gather() — six concurrent section prompts
          ↓
      Pydantic validation + heuristic confidence scoring
          ↓
      Section retries if confidence < 0.70 (concurrent)
          ↓
      Skill normalization (rapidfuzz → pgvector)
          ↓
      State machine → AUTO_ACCEPT / NEEDS_REVIEW / RE_PARSE
          ↓
      Write final status to llm_parsed_records
          ↓
      If AUTO_ACCEPT → enqueue recommendation pipeline
                       as a second BackgroundTask

  Step 3: Frontend polls for status
    GET /parse/status/{parse_id}
      → reads status field from llm_parsed_records
      → returns one of:
          { "status": "processing" }        ← pipeline still running
          { "status": "accepted" }          ← AUTO_ACCEPT, recs being generated
          { "status": "pending_review" }    ← NEEDS_REVIEW, awaiting human
          { "status": "failed" }            ← RE_PARSE exhausted, needs re-upload

    Frontend polls this endpoint every 3-4 seconds until status is no longer
    "processing". No webhooks, no WebSockets needed — simple polling is
    sufficient given the expected parse time of 3-4 seconds.

INTERNAL CONCURRENCY WITHIN THE BACKGROUND TASK:

  The background task itself uses asyncio.gather() for internal operations
  that are independent of each other:

  Six section extraction prompts:
    All fire simultaneously. Wall time = slowest single call (~3-4 seconds).
    Sequential would be ~12-15 seconds — unacceptable even in background.

  Section retries (if confidence < 0.70 on any section):
    Failing sections are retried concurrently, not one by one.

  Pass 2 embedding calls (skill normalization):
    All unmatched skills are sent to Gemini embedding API in a single
    batch call, not one call per skill. Google's embedding API supports
    batch input — this is one API call regardless of how many skills
    need Pass 2.

STATUS FIELD LIFECYCLE:
  uploads.status         processing → (parse completes) → removed/archived
  llm_parsed_records.status:
    processing           → set immediately when background task starts
    accepted             → AUTO_ACCEPT path
    pending_review       → NEEDS_REVIEW path
    failed               → RE_PARSE exhausted path

  The frontend always reads from llm_parsed_records.status via the
  /parse/status/{parse_id} endpoint. It never reads directly from uploads.

RECOMMENDATION PIPELINE HANDOFF:
  When the state machine reaches AUTO_ACCEPT, it enqueues the recommendation
  pipeline as a SEPARATE BackgroundTask. The parse task does not wait for
  recommendations to complete — it hands off and exits. The recommendation
  pipeline has its own status tracking in the job_recommendations table
  (see RECOMMENDATION_ENGINE_ARCHITECTURE.md Section 11).

  From the user's perspective:
    Upload → "processing" → "accepted" → recommendations appear
  Each transition is observable via polling without any long-running
  connection from the client.

================================================================================
9. IMPLEMENTATION PRIORITY ORDER
================================================================================

  Priority 0: pgvector migration (PREREQUISITE — do this before anything else)
    - Enable extension, add Vector(768) column to canonical_skills
    - Run seed_skill_embeddings.py to pre-populate embeddings
    - Drop old JSON/BYTEA embedding columns
    Effort: Low. One migration script, one schema change.

  Priority 1: FileTypeRouter + Gemini Vision for designed/scanned PDFs
    Reason: Highest immediate quality jump. Fixes layout-sensitive failures
    completely. New module, does not require modifying existing code.
    Effort: Medium.

  Priority 2: Decomposed concurrent prompting in llm_gemini.py
    Reason: Fixes missing fields for all resume types. asyncio.gather()
    also eliminates the latency concern from 6 calls.
    Effort: Medium. Refactor llm_gemini.py + parse_service.py.

  Priority 3: Heuristic confidence scoring + state machine (Layers 4 + 5)
    Reason: Implement confidence scoring immediately after decomposed
    prompting, since it depends on per-section output being available.
    The state machine is mostly logic in parse_service.py.
    Effort: Low-Medium.

  Priority 4: rapidfuzz skill normalization (Pass 1)
    Reason: Drop-in improvement over regex. ~20 lines of code.
    Effort: Low.

  Priority 5: Gemini embedding + pgvector skill normalization (Pass 2)
    Reason: Handles the semantic gap rapidfuzz cannot cover. Depends on
    Priority 0 migration being complete and stable.
    Effort: Medium. Do after Priorities 1-4 are stable and tested.

================================================================================
10. DEPENDENCIES SUMMARY
================================================================================

New Python packages required:

  rapidfuzz
    Purpose: Pass 1 of skill normalization (fuzzy string matching)
    Install: pip install rapidfuzz
    Notes: Drop-in replacement for fuzzywuzzy. Written in C++. Fast.

  pgvector (Python binding)
    Purpose: SQLAlchemy Vector column type and pgvector query support
    Install: pip install pgvector
    Notes: The PostgreSQL extension is already in the stack. This is only
    the Python/SQLAlchemy binding.

  pytesseract + tesseract-ocr (optional — offline fallback only)
    Purpose: OCR fallback for scanned PDFs if Gemini Vision is unavailable
    Install: pip install pytesseract + system install of tesseract-ocr
    Notes: Only needed if offline fallback is required. If Gemini Vision is
    always available (expected normal case), this can be deferred.

  google-genai
    Purpose: Gemini Vision (Layer 1), section extraction (Layer 2),
             embedding API (Layer 3), explainability fallback
    Install: pip install google-genai
    Notes: Already in the stack. No new API keys. GEMINI_API_KEY reused.
    Also used by the recommendation engine — single shared dependency.

No new infrastructure. No new API keys. No new databases.
All changes operate within the existing FastAPI + PostgreSQL + Gemini stack.

================================================================================
11. SCHEMA CHANGES REQUIRED
================================================================================

Table: canonical_skills
  Add column:  embedding Vector(768)
  Add index:   CREATE INDEX ON canonical_skills
               USING hnsw (embedding vector_cosine_ops);
  Drop column: embedding JSON (if exists from previous approach)
  Migration:   seed_skill_embeddings.py (one-time, see Section 0)

Table: llm_parsed_records
  Add column:  unrecognized_skills JSONB
               (stores skills that fell through both normalization passes)
  Already has: confidence_scores column — used as-is for per-section scores
  Already has: status column — used by state machine (accepted/pending_review/failed)

Table: human_reviews
  No changes. Used as-is by the state machine.

Note: job_embeddings_cache schema changes (Vector column for recommendation
engine) are documented in RECOMMENDATION_ENGINE_ARCHITECTURE.md Section 12
and are a separate migration from the changes listed here.

================================================================================
12. WHAT STAYS THE SAME
================================================================================

  - FastAPI endpoint structure (POST /upload, POST /parse/{applicant_id})
    stays the same. Pipeline changes are internal to the service layer.

  - Pydantic schemas for parsed resume data stay the same. Section-scoped
    extraction still produces the same output shape — just via 6 concurrent
    calls instead of 1 sequential call.

  - Database table structure (except changes in Section 11) stays the same.

  - Authentication, credit system, and all other services are unaffected.

NOTE ON RECOMMENDATION SCORING:
  The original document stated "the recommendation scoring algorithm stays
  the same." This is NO LONGER TRUE. The recommendation engine has been
  fully redesigned in parallel (see RECOMMENDATION_ENGINE_ARCHITECTURE.md).
  This parse pipeline feeds cleaner data into the NEW recommendation engine,
  not the old one. Specifically:
    - Normalized skills from this pipeline feed into Tier 1 (TF-IDF) and
      Tier 2 (semantic matching) of the recommendation engine
    - The confidence gate ensures the recommendation engine only receives
      AUTO_ACCEPT quality data
    - unrecognized_skills are stored but excluded from recommendation scoring
      until they are added to the canonical taxonomy

================================================================================
END OF DOCUMENT
Version 2.0 | Project: unknown-spec10/Career-Guidance
Documents: This file + RECOMMENDATION_ENGINE_ARCHITECTURE.md (v1.1)
================================================================================
