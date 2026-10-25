# Interview UX Fix Notes (follow-up to INTERVIEW_UX_AUDIT.md)

Behavior contracts changed by the C1–L8 fix pass. Frontend and backend
were updated together; no API breakage (all additions are additive/optional).

## Backend additions

- `AnswerResponse` gains optional `answer_id` (interview/schemas.py).
  `POST /api/interview/answer` returns it on first answers, resubmits
  (with `next_question: null`), and `interview_complete` alike. The client
  needs it for `GET /api/interview/hint/{answer_id}`.
- `POST /api/interview/transcribe` returns `{transcript, mock: bool}`.
  `mock: true` means demo-mode output — the client labels it and never
  presents it as Whisper transcription.
- SSE streams (`stream_hint`, `stream_feedback`) now yield
  `data: {"error": "..."}` before `[DONE]` on provider failure, matching
  the existing skill-gap stream shape. Clients surface it.
- `GET /api/interview/hint/{answer_id}` returns an SSE error event for the
  `Tough FAANG Interviewer` persona (hints disabled by design) instead of
  generating a hint anyway.

## Frontend behavior

- History scores: backend 0.0–1.0 normalized to 0–100 at render.
- Answer advance is driven by `AnswerResponse.next_question` (adaptive
  reserve swaps surface; unknown reserve ids are merged into the list).
  Resubmits (`next_question: null`) stay on the current question.
- Hint UI is trigger-based ("Get a Hint" after a submit), hidden for Tough
  FAANG, with visible error + retry states.
- Results polling: 2s base with exponential backoff (cap 10s), 60-attempt /
  5-minute bound, timeout screen with "Keep Waiting" retry. `refresh()`
  ignores non-complete payloads.
- Drafts persist in `localStorage` (survive new tabs); `beforeunload` only
  prompts when an unsaved draft exists; the abandon beacon fires on
  `pagehide`. Failed quit no longer navigates away.
- Recording auto-stops at 55s (under the 60s upload timeout) with a
  `elapsed / max` countdown; answers capped at 5000 chars client-side;
  429 responses show a live wait countdown; 401 preserves
  `post_login_redirect` for return-to-session after login.
- Waveform canvas measures its container (ResizeObserver) instead of a
  fixed 640px width.

## Decisions and edge-case semantics (B234 verification)

- Hint trigger is manual ("Get a Hint" after a submit), not auto-on-weak-score:
  evaluation runs as a background task, so the client never knows the score
  at submit time. The surfaced `answer_id` + SSE error/empty states cover the
  viable wiring; no dead UI remains. Tough FAANG honors its "No hints" copy
  (SSE error event) instead of generating anyway.
- Out-of-order submits: the server derives the next question from the
  unanswered set (`get_next_question` skips answered ids) and the client
  follows `AnswerResponse.next_question`; resubmits return
  `next_question: null` and stay on the current question. Double-submits
  collapse into a single answer row (idempotency guard).
- `refresh()` ignores non-complete payloads; results polling is bounded
  (60 attempts / 5-minute cap, exponential backoff 2s→10s) with a "Keep
  Waiting" retry screen; timed-out polls never overwrite results.
- Zero-answer finish returns an honest `complete` payload with an empty
  review (overall 0.0); the results page renders a "No answers submitted"
  empty state instead of a 0% scorecard. Partial evaluations after retry
  exhaustion surface per-question `evaluation_failed` badges.
- Failed quit reports the error and stays on the live session page (no
  navigation); closing a tab with an unsaved draft prompts first, otherwise
  the HMAC beacon abandons server-side while the `localStorage` draft
  survives for inspection.
