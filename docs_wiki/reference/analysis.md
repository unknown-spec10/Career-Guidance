# Concurrency and Async Bottleneck Audit Report

This report presents the findings of a comprehensive audit of the Career Guidance system's FastAPI backend (`resume_pipeline/`) codebase. The focus of the audit is to identify async execution bottlenecks, blocking I/O (specifically synchronous HTTP calls via `requests`), and blocking Server-Sent Events (SSE) streams or background tasks that can starve the FastAPI event loop.

---

## 1. Blocking I/O & Synchronous HTTP Calls in Async Routes

FastAPI relies on a single-threaded event loop to handle concurrent async requests. When a route is defined with `async def`, any blocking (synchronous) operations called within it run on the event loop thread, completely blocking it from processing any other incoming requests. Several critical endpoints violate this convention.

### A. Employer Job Description Optimization Endpoint
* **File:** `resume_pipeline/app.py` (Lines 1727–1742)
* **Route:** `POST /api/employer/jobs/optimize`
* **Handler:** `async def optimize_job_description_route(...)`
* **Blocking Call:** Calls `optimize_job_description(...)` synchronously.
```python
1727: async def optimize_job_description_route(
1728:     data: JobOptimizeRequest,
1729:     current_user = Depends(require_role("employer"))
1730: ):
...
1736:         from .recommendation.optimizer import optimize_job_description
1737:         result = optimize_job_description(prompt_text=data.prompt, title=data.title)
1738:         return result
```
* **Root Cause:** `optimize_job_description` (in `resume_pipeline/recommendation/optimizer.py`) is a synchronous function that synchronously calls `llm_router.generate_chat_completion(...)` twice (primary Gemini, fallback Groq). `generate_chat_completion` (in `resume_pipeline/core/llm_router.py`) makes synchronous, blocking HTTP requests using `requests.post` with a timeout of up to 60-90 seconds.
* **Impact:** During the LLM call (which can take several seconds), the entire FastAPI event loop is blocked. All concurrent requests to the backend will hang.

### B. Recommendations Generation Endpoint
* **File:** `resume_pipeline/app.py` (Lines 2995–3112)
* **Route:** `POST /api/applicant/{applicant_id}/generate-recommendations`
* **Handler:** `async def generate_recommendations_for_applicant(...)`
* **Blocking Call:** Calls `service.get_recommendations(...)` synchronously.
```python
2995: async def generate_recommendations_for_applicant(
...
3087:         service = RecommendationService(db)
3088:         result = service.get_recommendations(applicant_id)
```
* **Root Cause:** `RecommendationService.get_recommendations` (in `resume_pipeline/recommendation/recommendation_service.py`) calls `compute_recommendations(...)` synchronously. `compute_recommendations` (in `resume_pipeline/recommendation/engine.py`) iterates through all active jobs to calculate scores, and for the top 5 matching jobs, calls `generate_explanation(...)` and `generate_employer_match_analysis(...)` synchronously.
* **Impact:** These explainer functions make direct synchronous HTTP requests to Gemini/Groq via `requests` (with a 6-second timeout per attempt, in `resume_pipeline/recommendation/explainer.py`). Since this happens sequentially inside an `async def` handler, the main thread is blocked for up to 10–30 seconds.

### C. RAG Ask Endpoint
* **File:** `resume_pipeline/app.py` (Lines 4219–4270)
* **Route:** `POST /api/rag/ask`
* **Handler:** `async def rag_ask_question(...)`
* **Blocking Call:** Calls `await rag_service.ask(...)`.
```python
4256:     response, error = await rag_service.ask(
4257:         query=body.query,
4258:         user_id=user_id,
4259:         use_cache=True
4260:     )
```
* **Root Cause:** Although `rag_service.ask(...)` (in `resume_pipeline/rag/rag_service.py`) is an `async def` function, it awaits `self.gemini_client.generate(...)` (line 642). The `GeminiRAGClient.generate(...)` method is implemented as follows:
```python
69:     async def generate(
...
75:     ) -> Tuple[Optional[str], Optional[str]]:
76:         """
77:         Generate a response using Gemini API (async wrapper for sync call).
78:         Returns (response, error).
79:         """
80:         # Gemini doesn't have native async, so we call sync version
81:         return self.generate_sync(system_prompt, user_message, max_tokens, temperature)
```
The method `generate_sync` calls `llm_router.generate_chat_completion(...)`, which performs a blocking HTTP call via `requests`.
* **Impact:** The event loop thread is blocked during the entire duration of the RAG answer generation, causing system-wide latency.

---

## 2. Blocking SSE Streams and Background Tasks

Server-Sent Events (SSE) are designed for long-running streaming responses. FastAPI supports SSE using `StreamingResponse` wrapping an async generator. However, if the generator performs synchronous blocking operations during iteration, it defeats the purpose and freezes the event loop.

### A. Study Plan Streaming Endpoint
* **File:** `resume_pipeline/interview/router.py` (Lines 517–597)
* **Route:** `GET /api/interview/study-plan/{session_id}`
* **Handler:** `async def stream_study_plan_endpoint(...)`
* **Blocking Call:** Yields tokens using `_stream_and_cache_study_plan(...)`.
```python
481:     async for item in stream_study_plan(
...
489:         yield item
```
* **Root Cause:** `stream_study_plan(...)` (in `resume_pipeline/interview/evaluator.py`) is an `async def` generator, but it iterates over `llm_router.generate_chat_completion_stream(...)` using a synchronous loop:
```python
293:         for chunk in llm_router.generate_chat_completion_stream(
294:             messages=messages,
295:             provider="groq",
...
300:             yield f"data: {json.dumps({'token': chunk})}\n\n"
```
`llm_router.generate_chat_completion_stream` is a synchronous generator (`def`) that calls the blocking Groq SDK stream or `requests.post(..., stream=True)` (OpenRouter fallback) and yields chunks via synchronous line iteration (`r.iter_lines()`). It also contains synchronous `time.sleep()` statements (Lines 831 and 846) for Gemini simulation.
* **Impact:** Every yielded token blocks the FastAPI event loop thread, creating massive bottleneck cascades for concurrent users.

### B. Hint and Feedback Streaming Endpoints
* **File:** `resume_pipeline/interview/router.py` (Lines 605–632 and Lines 640–667)
* **Routes:** `GET /api/interview/hint/{answer_id}` & `GET /api/interview/feedback/{question_id}`
* **Handlers:** `stream_hint_endpoint(...)` & `stream_feedback_endpoint(...)`
* **Root Cause:** These delegate to `stream_hint(...)` and `stream_feedback(...)` (in `resume_pipeline/interview/evaluator.py`), which are `async def` generators that similarly iterate over the synchronous `llm_router.generate_chat_completion_stream(...)` generator in a blocking `for chunk in ...` loop.
* **Impact:** Same as the study plan stream, the event loop thread is frozen during the entire duration of the token generation and streaming.

### C. Skill Gap Analysis Streaming Endpoint
* **File:** `resume_pipeline/interview/router.py` (Lines 949–973)
* **Route:** `GET /api/interview/skill-gap-analysis/{session_id}`
* **Handler:** `async def skill_gap_analysis_endpoint(...)`
* **Blocking Call:** Returns `StreamingResponse(_stream_skill_gap_analysis(...))`.
```python
887: async def _stream_skill_gap_analysis(
...
894: ) -> AsyncGenerator[str, None]:
...
897:     from groq import Groq
898:     
899:     groq_client = Groq(api_key=settings.GROQ_API_KEY)
...
911:         stream = groq_client.chat.completions.create(
...
916:             stream=True
917:         )
918:         
919:         for chunk in stream:
920:             delta = chunk.choices[0].delta.content
921:             if delta:
922:                 accumulated_tokens.append(delta)
923:                 yield f"data: {json.dumps({'token': delta})}\n\n"
```
* **Root Cause:** `_stream_skill_gap_analysis` is an `async def` generator, but it instantiates a synchronous `Groq` client, triggers a synchronous streaming completion, and iterates over the response chunks using a standard synchronous `for chunk in stream` loop.
* **Impact:** The event loop blocks entirely while waiting for new chunks from the Groq stream.

---

## 3. Detailed Recommendations for Refactoring

To resolve these concurrency bottlenecks, we recommend three main approaches depending on the context:

### Recommendation 1: Implement Asynchronous HTTP Clients (`httpx`)
Instead of using the synchronous `requests` library and synchronous SDKs, migrate the networking logic to `httpx.AsyncClient` and the asynchronous counterparts of the LLM SDKs (e.g., `AsyncGroq`).

#### A. Centralized Async LLMRouter
Refactor `LLMRouter` to support async completions and streams:
```python
# Proposed changes in resume_pipeline/core/llm_router.py

import httpx
from groq import AsyncGroq

class LLMRouter:
    # Existing init code...

    async def generate_chat_completion_async(
        self,
        messages: List[Dict[str, str]],
        provider: str,
        model_name: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 4096,
        response_format: Optional[Dict[str, Any]] = None,
        timeout: int = 60,
    ) -> Dict[str, Any]:
        """Asynchronous version of generate_chat_completion using httpx or AsyncGroq."""
        provider = provider.lower()
        if provider == "groq":
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            # Use await for completion
            response = await client.chat.completions.create(
                model=model_name or settings.GROQ_CHAT_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
                timeout=timeout
            )
            # return formatted response...
        elif provider == "gemini":
            # Use async httpx client
            async with httpx.AsyncClient() as client:
                # url & body setup...
                resp = await client.post(url, json=body, timeout=timeout)
                # return formatted response...
```

#### B. Centralized Async LLMRouter Streaming
```python
    async def generate_chat_completion_stream_async(
        self,
        messages: List[Dict[str, str]],
        provider: str,
        model_name: Optional[str] = None,
        temperature: float = 0.5,
        max_tokens: int = 1024,
        timeout: int = 60,
    ) -> AsyncGenerator[str, None]:
        """Asynchronously yield chat completion chunks using AsyncGroq/httpx."""
        provider = provider.lower()
        if provider == "groq":
            client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            stream = await client.chat.completions.create(
                model=model_name or settings.GROQ_CHAT_MODEL,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
                timeout=timeout,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
```

### Recommendation 2: Offload Blocking Operations to Thread Pools
For blocking database calculations (e.g. TF-IDF scoring and sequential LLM explainer calls during recommendation generation) or existing sync libraries, offload them using `asyncio.to_thread` or `loop.run_in_executor`.

#### A. Recommendation Refresher Route
In `resume_pipeline/app.py`, offload the synchronous recommendation service call using `asyncio.to_thread`:
```python
# Before
result = service.get_recommendations(applicant_id)

# After
import asyncio
result = await asyncio.to_thread(service.get_recommendations, applicant_id)
```
This runs the entire recommendation pipeline (scoring and explainer LLM requests) inside FastAPI's default worker thread pool, keeping the main event loop thread fully responsive.

#### B. Job Optimizer Route
In `resume_pipeline/app.py`, offload job description optimization:
```python
# Before
result = optimize_job_description(prompt_text=data.prompt, title=data.title)

# After
import asyncio
result = await asyncio.to_thread(optimize_job_description, data.prompt, data.title)
```

#### C. RAG Generation Async Wrap
In `resume_pipeline/rag/rag_service.py`, run `generate_sync` inside a thread:
```python
    async def generate(
        self,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2048,
        temperature: float = 0.3
    ) -> Tuple[Optional[str], Optional[str]]:
        import asyncio
        return await asyncio.to_thread(
            self.generate_sync, system_prompt, user_message, max_tokens, temperature
        )
```

### Recommendation 3: Refactor SSE Streams to Async Iteration
Once `LLMRouter` supports `generate_chat_completion_stream_async`, update the generators in `evaluator.py` to use `async for` and awaitable sleeps (`asyncio.sleep` instead of `time.sleep`).

#### A. Study Plan Stream
In `resume_pipeline/interview/evaluator.py`:
```python
# Proposed refactored async generator
async def stream_study_plan(
    # args...
) -> AsyncGenerator[str, None]:
    # ...prompt setup...
    try:
        # call the new async stream method on llm_router
        async for chunk in llm_router.generate_chat_completion_stream_async(
            messages=messages,
            provider="groq",
            model_name=GROQ_MODEL,
            temperature=0.7,
            max_tokens=2048
        ):
            yield f"data: {json.dumps({'token': chunk})}\n\n"
    except Exception as e:
        logger.error(f"stream_study_plan stream error: {e}")
    yield "data: [DONE]\n\n"
```

#### B. Skill Gap Analysis Stream
In `resume_pipeline/interview/router.py`:
```python
async def _stream_skill_gap_analysis(
    # args...
) -> AsyncGenerator[str, None]:
    from groq import AsyncGroq
    groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    # ...
    try:
        stream = await groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1500,
            stream=True
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                accumulated_tokens.append(delta)
                yield f"data: {json.dumps({'token': delta})}\n\n"
```

---

## 4. Verification & Testing

To verify the performance improvements post-refactoring, we recommend using a concurrency benchmark tool (e.g. `locust` or `wrk`) while simulating slow responses:
1. Run a baseline test on the existing endpoints `/api/employer/jobs/optimize` and `/api/interview/study-plan/{session_id}`. Measure response times of *other* lightweight routes (like `/api/stats`) during the load test. You will observe that they experience high latency due to the event loop blocking.
2. Apply the refactored changes (async clients and thread offloading).
3. Run the same load test. The response times of the lightweight routes should remain near-instantaneous (under 10ms), demonstrating that the event loop is no longer blocked during LLM operations.
