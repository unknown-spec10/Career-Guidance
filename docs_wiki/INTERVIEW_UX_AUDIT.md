# Interview UX Audit — Candidate Flow (Frontend + Session Contract)

**Scope:** `frontend/src/pages/InterviewPage.jsx` (lobby), `frontend/src/pages/InterviewSessionPage.jsx` (live loop),
`frontend/src/pages/InterviewResultsPage.jsx` (results), `frontend/src/hooks/useInterviewSession.js`,
`frontend/src/hooks/useAudioRecorder.js`, `frontend/src/hooks/useResultsPolling.js`,
`frontend/src/hooks/useStreamingText.js`, `frontend/src/utils/speech.js`, `frontend/src/components/VoiceWaveform.jsx`,
vs backend `resume_pipeline/resume_pipeline/interview/sessions.py`, `streaming.py`, `service.py`, `schemas.py`,
`common.py`, `evaluator.py`, `limiter.py`. **Read-only audit; no source files changed.**

**InterviewFeedbackPage:** does not exist. Confirmed: no file matches `*Feedback*` under `frontend/src`,
no `FeedbackPage` references anywhere, and `frontend/src/App.jsx:113-133` registers only
`/dashboard/interview`, `/dashboard/interview/:sessionId`, `/dashboard/interview/results/:sessionId`.
Per-question feedback lives in the results-page accordion (`InterviewResultsPage.jsx:118-243`).

---

## 1. Full candidate flow walkthrough

### Step 1 — Lobby / setup (`InterviewPage.jsx`)

**Works**
- Parallel `Promise.allSettled` load of profile, active-session, history (`InterviewPage.jsx:54-80`); one failure doesn't kill the others.
- Active-session resume banner (`146-159`) backed by `GET /api/interview/active-session` (24h window, `service.py:403-414`).
- History rows route completed sessions to results, others reload config (`375-386`).
- Start errors (402 payment, 429 rate-limit, 403 suspension) surface via toast (`82-98` + `useInterviewSession.js:74-91`).

**Fragile**
- Any profile-fetch failure sets `resumeStatus='missing'` (`72-74`), which **hard-blocks Start** (`334`). A transient network blip looks identical to "no resume".
- `handleRetake` always resets `voice_mode: false` (`104-114`); a voice user retaking a config silently loses voice mode.
- Score display assumes 0–100 (see C2) — every history row is wrong.

**Missing**
- No indication of the server's start limits (1 session / 5 min, 3 / day, `limiter.py:8-51`) or the ≥3-abandons suspension (`sessions.py:83-99`) until the user trips them.
- No session-expiry countdown (server 24h active window); banner copy ("created recently") is static.

### Step 2 — Start (`useInterviewSession.js:74-91` → `POST /api/interview/start`)

**Works**
- Sends full config incl. `voice_mode`, `interviewer_persona`; stores HMAC `abandon_token` in-memory for the beacon path.

**Fragile**
- Server returns `first_question` (`sessions.py:221-225`) but the client **discards it** and immediately refetches the whole question list (`useInterviewSession.js:80`). Benign but a wasted round-trip on the most latency-sensitive step; if the fetch fails after a successful start, the user has a paid-for session with no questions and only "Failed to retrieve question list."
- No loading state beyond the button label; double-click is only guarded by `isStarting`.

**Missing**
- No reconnection logic anywhere in the interview flow (no `online`/`offline` listeners, no retry queue).

### Step 3 — Answer loop, text path (`InterviewSessionPage.jsx:171-193`, `401-424`)

**Works**
- Draft autosave to `sessionStorage` per question (`407-414`), cleared on submit (`181-183`); failed submits preserve the answer in the textarea with an inline error (`559-563`); `Ctrl/Cmd+Enter` shortcut (`187-193`).
- Prev/Next navigation preserves drafts; submitted answers restore from `user_answer` first (`87-96`).

**Fragile**
- Autosave is **tab-scoped `sessionStorage` only** — duplicate tab, new tab, or cache-clear loses unsaved text. Nothing is persisted server-side until submit (H5).
- Textarea is `disabled` while recording/transcribing (`418`), so the candidate can't type or fix transcript mid-recording.
- The 5000-char server cap (`schemas.py:52`) is unenforced client-side; only a char count is shown. Oversize submit → 422 surprise (M6).
- Out-of-order submit (Prev → edit Q1 → submit) is accepted by the server, but client/server "current question" notions diverge (server = first unanswered, `service.py:190-210`; client = index-based).

**Missing**
- No per-question or session timer at all; the header badge is a static "Active Session" pill (`291-295`). No timer behavior to break — but also no pacing aid and no warning before the server's 24h active window lapses.
- No answered-state affordance in Prev/Next nav (`answer_status` from the questions endpoint is fetched and ignored, M-lowl5).
- No explicit retry button on submit failure (re-click Submit works, answer preserved — acceptable, but undiscoverable offline).

### Step 4 — Answer loop, audio/transcribe path (detail in §3)

**Works:** mic-denied errors render inline (`481-485`); Whisper failure keeps the live Web-Speech transcript and warns (`164-166`); transcribing/recording states are visually distinct (`429-454`).

**Fragile/missing:** silent mock transcript when Whisper is unconfigured (M3); `isSpeechSupported` dead flag (M4); unbounded recording length (M5); fixed 640px waveform canvas clips on phones (M10); voice mode can't be toggled mid-session.

### Step 5 — Hints (mid-interview SSE)

**Works:** the hint *display* panel with streaming caret exists (`380-399`).

**Fragile:** it is **dead UI**. Nothing in the session page ever calls `streamHint` (`useInterviewSession.js:226-262` is only referenced in tests). Even if wired, the client never receives an `answer_id`: `AnswerResponse` carries only `{status, next_question}` (`schemas.py:55-57`), while `GET /api/interview/hint/{answer_id}` requires one (`streaming.py:44-70`). Persona copy promises "No hints" for Tough FAANG (`InterviewPage.jsx:29`) but `stream_hint` generates regardless (`evaluator.py:195-228`) (H2).

**Missing:** any trigger (auto on weak score, or button), and any empty/error state for hint failure (server yields bare `[DONE]` on exception, `evaluator.py:225-228`).

### Step 6 — Finish / quit / abandon

**Works**
- Two distinct, correctly-wired paths: explicit Quit → Bearer `POST /abandon/:id` (`useInterviewSession.js:274-285` → `sessions.py:476-496`); tab-close → `sendBeacon` + HMAC to `/abandon-beacon/:id` (`287-293` → `sessions.py:499-525`), using `apiUrl()` so production doesn't hit the SPA rewrite.
- `beforeunload` listener is correctly skipped once complete (`296-300`); abandon is idempotent (`service.py:396-400`).
- Finish-early modal + `POST /finish/:id` marks `completed` immediately; pending evaluations continue server-side and results polling retries them (`sessions.py:605-625`, `428-467`).

**Fragile**
- Quit navigates away even when abandon fails (H7) — user believes they quit; the resume banner later contradicts them.
- Abandoned sessions recover as "Session Not Found" (H6): hook maps non-active → `redirect:'setup'` for abandoned (`useInterviewSession.js:100-103`), page only special-cases `'results'`.
- The suspension warning ("more than twice a day," `577-586`) matches the server's ≥3/24h rule, but there is no live counter — the 3rd quit is a surprise 403.

**Missing:** "abandon in progress" state; post-quit confirmation of what happened to the session.

### Step 7 — Results (`InterviewResultsPage.jsx` + `useResultsPolling.js`)

**Works**
- 2s polling of `GET /api/interview/results/:id` with completed/total progress bar (`271-295`); per-question accordion with streamed AI feedback; skill bars; skill-gap modal trigger.

**Fragile**
- Polling is unbounded with no timeout/backoff/stuck detection (H4); page copy claims "~15S" loop (`289-291`) but polls every 2s.
- `refresh()` (gap-modal callbacks, `456-466`) unconditionally overwrites complete results — a `processing` payload mid-regeneration wipes the scorecard into a 0% render (H3).
- Feedback SSE has no `response.ok`/null-body check, no abort on collapse, silent errors (M1); rapid open/close can interleave streams into one accordion.
- Finishing with zero answers renders 0% "Keep At It!" with empty sections and no empty-state guard (L6).

**Missing:** "evaluation failed" recovery action for the candidate (server caps retries at `MAX_EVAL_RETRIES=3`, `common.py:22`, then serves partials — the UI shows a spinner icon per failed item but no explanation or retry).

### Cross-cutting: loading / empty / error / mobile

- Lobby: loading + empty history covered (`346-349`); session page: spinner vs "Session Not Found" covered (`240-249`, `222-238`); results: processing vs error covered. **Gaps:** no offline state anywhere; SSE failures are silent everywhere; `!results → return null` (`297`) is a blank page if a complete payload is ever falsy.
- Mobile: layout collapses sensibly (`max-w-3xl`, `sm:` breakpoints, full-width recorder/mic buttons, `p-4` modals). Exceptions: fixed-width waveform canvas (M10); Prev/Next + Finish stack vertically (fine); accordion and score hero wrap (fine). TTS/STT depend on mobile browser capabilities with no messaging (Web Speech missing on iOS Firefox etc. — M4).

---

## 2. Frontend ↔ backend contract mismatches

| # | Expectation gap | Frontend | Backend | Impact |
|---|---|---|---|---|
| F1 | History `overall_score` scale: FE treats as 0–100 (`Math.round(score)%`, `>=75`), BE stores 0.0–1.0 | `InterviewPage.jsx:353,369-371` | `service.py:329,382`, `schemas.py:128-138` | **Critical** (C2) |
| F2 | `AnswerResponse.next_question` ignored; client advances by local index. Adaptive reserve swap (`service.py:121-187`) can never surface; resubmit returns `next_question:null` + `status:"ok"` which the client doesn't distinguish | `useInterviewSession.js:160-221` | `sessions.py:271-295,348-351`, `service.py:121-187` | **High** (H1) |
| F3 | Hint needs `answer_id`; no endpoint ever gives the client one (`AnswerResponse` has none; `SessionQuestionItem` has none) + no UI trigger exists | `useInterviewSession.js:226-262`, `InterviewSessionPage.jsx:380-399` | `streaming.py:44-70`, `schemas.py:55-57,145-152` | **High** (H2) |
| F4 | `refresh()` assumes results-shaped payload; BE may return `{status:"processing", completed, total}` which then renders as a 0% scorecard | `useResultsPolling.js:59-69`, `InterviewResultsPage.jsx:456-466` | `sessions.py:462-467`, `service.py:381-389` | **High** (H3) |
| F5 | Poll copy says "~15S loop"; actual poll is 2s; BE has no documented poll contract (retry budget `MAX_EVAL_RETRIES=3` is server-internal) | `useResultsPolling.js:32`, `InterviewResultsPage.jsx:289-291` | `sessions.py:428-467` | **High** (H4, unbounded) |
| F6 | Abandoned session: hook returns `redirect:'setup'`; page renders it as "Session Not Found" error | `InterviewSessionPage.jsx:65-79` | `useInterviewSession.js:100-103` (FE-internal, but the *server* truth "abandoned" has no client representation) | **High** (H6) |
| F7 | SSE error shapes differ per endpoint: skill-gap yields `{error}` then `[DONE]`; hint/feedback swallow exceptions and yield bare `[DONE]`. All three clients only accumulate `data.token` and never surface errors | `useStreamingText.js:64-71`, `InterviewSessionPage` hint display, `InterviewResultsPage.jsx:139-147` | `streaming.py:236-238`, `evaluator.py:225-228,275-278` | **Medium** (M2) |
| F8 | Transcribe shape `{transcript}` matches — but mock mode returns a canned sentence under the same key with success status, indistinguishable from real STT | `useAudioRecorder.js:163-165` | `streaming.py:124-126` | **Medium** (M3) |
| F9 | `SessionStateResponse.current_question` / `current_question_index` unused; client re-derives "first unanswered" from the questions list — duplicated sequencing logic that can disagree after out-of-order submits | `useInterviewSession.js:96-114,32-69` | `sessions.py:358-393`, `service.py:190-210` | **Low** (benign today) |
| F10 | `StartInterviewResponse.first_question` discarded; extra questions round-trip required before the candidate sees anything | `useInterviewSession.js:74-91` | `sessions.py:221-225` | **Low** (latency) |
| F11 | Session expiry: server 24h active window + 429/403/402/401 matrix; client has no expiry notice, no 429 countdown, and 401 hard-redirects to `/login` losing in-memory session | `api.js:52-88`, `InterviewSessionPage` | `service.py:403-414`, `limiter.py`, `sessions.py:83-110` | **Medium** (M7/M8/M9) |
| F12 | Answer `max_length=5000` enforced only server-side (422); client shows raw char count | `InterviewSessionPage.jsx:421-423` | `schemas.py:49-52` | **Medium** (M6) |

---

## 3. Audio path robustness

- **Recorder errors (good):** `getUserMedia` denial → inline error box, status reset, stream cleanup (`useAudioRecorder.js:106-111`; rendered `InterviewSessionPage.jsx:481-485`). `MediaRecorder` mime fallback chain webm→ogg→mp4 (`57-64`) mirrors the server's extension allow-list (`streaming.py:141-143`).
- **Transcription failure display (good):** `stopRecording` resolves `{success:false}`, page keeps the live transcript and toasts a warning (`InterviewSessionPage.jsx:164-166`; `useAudioRecorder.js:166-173`).
- **Whisper-unavailable fallback (bad, M3):** no `GROQ_API_KEY` or `GEMINI_MOCK_MODE` → server returns a canned sentence as a *successful* transcript (`streaming.py:124-126`); the client appends it to the answer and toasts "Speech corrected via Whisper!" (`InterviewSessionPage.jsx:163`). A candidate can submit mock text as their answer with no indication it isn't their speech.
- **No-SpeechRecognition browsers (bad, M4):** `isSpeechSupported` is computed (`useAudioRecorder.js:19-22`) and never read by the page — recording proceeds with zero live feedback and no warning.
- **Unbounded capture (M5):** `recordTime` counts up with no cap/auto-stop; a long answer risks the 60s axios timeout (`api.js:28`) mid-upload with only a generic error.
- **TTS gaps (L3):** unsupported `speechSynthesis` → `console.warn` only (`speech.js:43-47`); narration auto-plays per question with mute/replay, but voice mode is lobby-locked.

---

## 4. Ranked findings (file:line for each)

### Critical (2)
- **C1 — Lobby crashes for users without a resume.** `<Link>` rendered at `InterviewPage.jsx:139` but never imported (`InterviewPage.jsx:2` imports only `useNavigate`) → `ReferenceError` the moment `resumeStatus==='missing'` renders. The exact users the branch targets can never see it.
- **C2 — History scores all display as ~1%.** `InterviewPage.jsx:353` (`score >= 75`) and `371` (`Math.round(score)%`) assume 0–100; backend stores 0.0–1.0 (`service.py:329`). A 0.85 session shows "1%" in warning color.

### High (7)
- **H1 — Client ignores server sequencing; adaptive questions unreachable.** `useInterviewSession.js:195-213` advances by local index, never reading `AnswerResponse.next_question`; the reserve-swap in `service.py:148-170` can never display. Resubmit (`sessions.py:295`, `next_question=None`) is indistinguishable from a normal advance.
- **H2 — Hint pipeline dead end-to-end.** Display without trigger (`InterviewSessionPage.jsx:380-399`); `streamHint` uncalled outside tests (`useInterviewSession.js:226`); no `answer_id` ever issued (`schemas.py:55-57` vs `streaming.py:44`); "Tough FAANG… No hints" copy (`InterviewPage.jsx:29`) contradicted by `evaluator.py:195-228`.
- **H3 — `refresh()` can wipe complete results.** `useResultsPolling.js:59-69` + `InterviewResultsPage.jsx:464-465`: a `processing` payload overwrites the scorecard → 0% render with `isProcessing=false`.
- **H4 — Unbounded results polling.** `useResultsPolling.js:18-46`: fixed 2s loop, no timeout/backoff/abandon; contradicts the "~15S" copy (`InterviewResultsPage.jsx:289-291`).
- **H5 — Unsaved answers die with the tab.** `sessionStorage`-only drafts (`InterviewSessionPage.jsx:60,407-414`); plus `beforeunload` beacon abandons the session (`useInterviewSession.js:287-300`), destroying resumability for a closed tab.
- **H6 — Abandoned sessions misreported.** `useInterviewSession.js:100-103` → `InterviewSessionPage.jsx:65-79`: abandoned maps to a "Session Not Found" error screen instead of guidance.
- **H7 — Failed quit still exits.** `InterviewSessionPage.jsx:195-204` navigates even when `quitSession` errors, leaving a live session the user thinks is dead.

### Medium (10)
- **M1 — Feedback SSE failure-silent.** `InterviewResultsPage.jsx:124-158`: no `response.ok`/null-body guard, no abort on collapse, stale-closure `loadFeedback`; errors leave permanent "Evaluating feedback response…".
- **M2 — Inconsistent SSE error events.** `streaming.py:236-238` (`{error}`) vs `evaluator.py:225-228,275-278` (bare `[DONE]`); clients only consume `token` (`useStreamingText.js:64-71`).
- **M3 — Silent mock transcription.** `streaming.py:124-126` + `InterviewSessionPage.jsx:163`: canned text presented as "Whisper correction".
- **M4 — Dead `isSpeechSupported` flag.** `useAudioRecorder.js:10-22` vs `InterviewSessionPage.jsx:42-50`: no-SR browsers record blind.
- **M5 — No recording cap.** `useAudioRecorder.js:75-80`; 60s axios timeout (`api.js:28`) can kill large uploads.
- **M6 — 5000-char cap is server-only.** `schemas.py:52` vs `InterviewSessionPage.jsx:421-423` (count display, no limit).
- **M7 — Profile-fetch failure blocks Start.** `InterviewPage.jsx:72-74,334`: network error ≡ "no resume".
- **M8 — 401 mid-interview bounces to login, losing in-memory session.** `api.js:62-71`; no return-to-session.
- **M9 — Answer 429 has no countdown.** `limiter.py:53-80` (1/10s) vs toast-only client (`useInterviewSession.js:216-220`).
- **M10 — Waveform clips on mobile.** Fixed 640px canvas (`InterviewSessionPage.jsx:445`; `VoiceWaveform.jsx:132-140`) inside an `overflow-hidden` wrapper.

### Low (8)
- **L1 — Progress never hits 100%.** `InterviewSessionPage.jsx:217` (`(qn-1)/total`).
- **L2 — No timers; static "Active Session" badge.** `InterviewSessionPage.jsx:291-295`; server 24h window (`service.py:403-414`) invisible.
- **L3 — TTS gaps + lobby-locked voice mode.** `speech.js:43-47`; `InterviewPage.jsx:104-114,299-311`; `InterviewSessionPage.jsx:108-118`.
- **L4 — Unused `motion`/`AnimatePresence` imports in `InterviewPage.jsx:3`.**
- **L5 — `answer_status` fetched, never shown in nav.** `useInterviewSession.js:32-69`; `InterviewSessionPage.jsx:490-527`.
- **L6 — Zero-answer finish renders empty 0% scorecard.** `service.py:313-389`; `InterviewResultsPage.jsx:297-355`.
- **L7 — `InterviewFeedbackPage` confirmed removed** (no file, no route in `App.jsx:113-133`); feedback lives in the results accordion. Informational, no action.
- **L8 — Voice-toggle copy overpromises** ("speech recognition," `InterviewPage.jsx:299-311`) with no capability/mic/HTTPS caveats.

---

## Top 3 fixes (candidate-impact order)

1. **Fix `InterviewPage` crash + score scale (C1, C2).** Import `Link` (or replace with a button + `navigate`), and normalize `overall_score` (×100 at render or at fetch). Blocks onboarding for resume-less users and misreports every returning user's history.
2. **Reconcile answer sequencing + hint plumbing (H1, H2).** Either drive question advance from `AnswerResponse.next_question` (surfacing adaptive reserves and returning `answer_id` for hints) with a UI trigger, or delete the dead hint/adaptive surface. Core loop correctness.
3. **Bound results polling + fix `refresh` clobber (H3, H4).** Ignore non-complete payloads in `refresh()`, add poll timeout/backoff with a "still working / retry" state, and correct the "~15S" copy. Prevents infinite spinners and 0% scorecard wipes.
