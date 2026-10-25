# LLM Telemetry & System Health Diagnostics Architecture

> SUPERSEDED in part (October 2026): the `/api/admin/llm-status`, `/api/embeddings/*`,
> and `/api/rag/stats` endpoints and the `AdminDashboard.jsx` visual dashboard were
> removed in the student-scope cut (verified: no such routes remain in
> `resume_pipeline/routers/`).
>
> SUPERSEDED in full (October 2026 router slim): the OpenRouter third path and the
> in-memory provider stats/telemetry block (`provider_stats`, token counters,
> rate-limit header parsing, 429 cooldown epochs, `get_stats`/`reset_stats`) were
> deleted from `resume_pipeline/core/llm_router.py` — verified: no live caller
> reads them.
>
> SUPERSEDED again (October 2026 LLM cutover + fallback removal): Gemini was fully removed. The
> router is now a thin single-provider switch (one configured opencode/DeepSeek
> primary per capability; any failure raises). The Groq/OpenCode circuit breakers in
> `resume_pipeline/core/rate_limiter.py` are retained and still gate calls.
> Everything below is a historical record of the removed machinery.

This document provides a detailed technical overview of the real-time LLM Telemetry and System Health diagnostics suite. It explains how metrics are harvested on the backend, routed through API endpoints, and visualized on the administrative dashboard.

---

## 1. System Telemetry Architecture

```mermaid
graph TD
    Client[React Admin Dashboard] -->|1. Polls Stats JSON via Promise.allSettled| Router[FastAPI API Endpoints]
    
    subgraph Backend Services
        Router -->|2a. Read LLM Telemetry| LLMR[LLM Router In-Memory Stats]
        Router -->|2b. Query FAISS State| RAGS[RAG Service FAISS Index]
        Router -->|2c. Calculate DB Coverages| DB[Postgres database / SQLAlchemy]
    end

    subgraph LLM Providers (historical; live: opencode single provider, Groq STT only)
        LLMR -->|Primary| Groq[Groq API]
        LLMR -->|Single attempt, else raise| Gemini[Google Gemini API]
    end

    subgraph DB Relations
        DB -->|Count Records| ApplicantTable[(Applicant Table)]
        DB -->|Count Records| JobTable[(Job Table)]
    end
```

---

## 2. Backend Data Harvesting Pipelines

### A. Current LLM Router (`llm_router.py`) — opencode-primary switch (October 2026 cutover)
All LLM requests are routed through the thread-safe singleton, [LLMRouter](file:///d:/Career%20Guidence/resume_pipeline/resume_pipeline/core/llm_router.py). The removed telemetry machinery (request/token counters, rate-limit header interception, 429 cooldown epochs, `get_stats`/`reset_stats`) is described in the historical note below and no longer exists:

1. **Routing**: capability slots (`chat` / `explanation`) each resolve to a
   single configured provider — default `opencode` (DeepSeek). Exactly one
   adapter attempt is made; a failure raises (caller banks engage:
   interview question bank, evaluator error path, learning-path template
   fallback, RAG error return, offline explanation). There is no fallback
   provider to configure. Named providers try once and raise.
   Unknown providers raise `ValueError`. The global mock toggle serves offline
   mock completions with no HTTP. STT stays on Groq Whisper via
   `transcribe_audio`.
2. **Rate limiting (retained)**: the Groq/OpenCode circuit breakers in
   `rate_limiter.py` still gate calls (`allow_call`/`acquire_sync`,
   `report_success`/`report_failure`; client 4xx errors do not trip the breaker).
   They are also used directly by `recommendation/explainer.py`.
3. **Streaming**: the serving adapter streams natively (Groq) or via SSE
   (OpenCode); in mock mode the mock completion streams word-by-word; then raises.

### Historical note: removed telemetry harvesting (pre-October 2026)
The following no longer exists in code. Previously, telemetry was captured inline during request execution:

1. **Request Tracking**:
   - Every invocation increments `total_requests`.
   - Successful completions increment `successful_requests`.
   - API failures increment `failed_requests` and log errors.
   - Provider timeouts or quota exceptions trigger backoff transitions, incrementing `fallback_requests` and redirecting traffic.

2. **Rolling Latency Calculations**:
   - The router records the exact epoch time immediately before making an HTTP request and immediately after receiving a response:
     ```python
     start_time = time.time()
     # ... LLM API call ...
     latency = time.time() - start_time
     ```
   - Latencies are added to `total_latency` and divided by the successful request counts on-the-fly to serve a weighted average latency.

3. **Quota & Rate-Limit Interception**:
   - For **Groq**, rate-limit headers returned in successful HTTP responses are read and stored:
     - `x-ratelimit-remaining-requests` -> `rate_limit_requests_remaining`
     - `x-ratelimit-remaining-tokens` -> `rate_limit_tokens_remaining`
     - `x-ratelimit-reset-requests` -> `rate_limit_reset_requests`
     - `x-ratelimit-reset-tokens` -> `rate_limit_reset_tokens`

4. **HTTP 429 Cooldown Tracking**:
   - If a provider rejects a request with an `HTTP 429` (Rate Limit Exceeded), the router logs the recommended backoff duration (defaulting to 60s if not specified by a `Retry-After` header) and sets the cooldown reset epoch:
     ```python
     self.stats["provider_stats"][provider]["retry_after_reset_time"] = time.time() + cooldown_duration
     ```
   - During subsequent queries, the remaining cooldown is dynamically computed relative to `time.time()`.

### B. Semantic Search Index Coverage (`semantic_matching.py`)
Vector indexing coverage statistics map database rows to vector database records:
- Queries the total row counts in Postgres for the `Applicant` and approved `Job` tables.
- Cross-references these with rows having generated embeddings in the respective tables to measure matching index coverage.

### C. FAISS RAG System Diagnostics (`rag_service.py`)
- Returns FAISS vector database metrics directly from the RAG service, counting the total number of initialized document chunks, vector dimensions, cache records, and full index rebuild operations.

---

## 3. Telemetry API Endpoints

All telemetry endpoints are hosted in [app.py](file:///d:/Career%20Guidence/resume_pipeline/resume_pipeline/app.py) and gated by role checks:

| HTTP Method | Route | Security Guard | Purpose |
|---|---|---|---|
| **GET** | `/api/admin/llm-status` | `Depends(require_role("admin"))` | Retrieves stats from the `LLMRouter` instance. |
| **POST** | `/api/admin/llm-status/reset` | `Depends(require_role("admin"))` | Resets all telemetry counters to zero. |
| **GET** | `/api/embeddings/health` | `Depends(require_role("admin"))` | Calculates embedding coverages for applicants and jobs. |
| **GET** | `/api/rag/stats` | `Depends(require_role("admin"))` | Returns FAISS indexing counters and config status. |

---

## 4. Frontend Visual Dashboard (`AdminDashboard.jsx`)

The System Health dashboard in [AdminDashboard.jsx](file:///d:/Career%20Guidence/frontend/src/pages/AdminDashboard.jsx) aggregates these endpoints into an intuitive dashboard:

1. **Vibrant Metric Grid**:
   - Summarizes total token volume, rolling weighted average latencies, vector chunks, and routed fallovers.

2. **Gradients & Vector Charts**:
   - Renders custom responsive SVG charts for request distribution and response speed comparing the active providers side-by-side.
   - Leverages SVG elements (`<rect>`, `<defs>`, `<linearGradient>`) and React state hover handlers (`onMouseEnter`) to show metric tooltips without external dependencies.

3. **Live System Log Alerts**:
   - Generates alerts on rate-limit cooldowns, missing environment variables, RAG index initialization gaps, and database embedding drifts.

4. **Quota Registry & Rate Limit Meters**:
   - Shows provider configs, models, prompt/completion tokens, and active cooldown statuses.
   - Renders horizontal progress bars for Groq request caps and per-minute tokens, changing colors (green, amber, red) based on remaining capacity.
