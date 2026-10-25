import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useInterviewSession from './useInterviewSession'

vi.mock('../config/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
  apiUrl: (path) => `http://backend.test${path}`,
}))

import api from '../config/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const questions = [
  { id: 'q1', text: 'What is REST?', question_number: 1, total_questions: 2, skill_tag: 'API' },
  { id: 'q2', text: 'Explain indexing.', question_number: 2, total_questions: 2, skill_tag: 'DB' },
]

const nextQ2 = { id: 'q2', text: 'Explain indexing.', question_number: 2, total_questions: 2, skill_tag: 'DB' }

const mockStart = ({ abandonToken = 'hmac-token-1' } = {}) => {
  api.post.mockImplementation((url) => {
    if (url === '/api/interview/start') {
      return Promise.resolve({ data: { session_id: 'sess-9', abandon_token: abandonToken } })
    }
    return Promise.reject(new Error(`unexpected POST ${url}`))
  })
  api.get.mockResolvedValue({ data: questions })
}

const sseResponse = (chunks) => ({
  ok: true,
  body: {
    getReader: () => {
      let i = 0
      return {
        read: async () =>
          i < chunks.length
            ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
            : { done: true, value: undefined },
        cancel: vi.fn(),
      }
    },
  },
})

describe('useInterviewSession — interview lifecycle contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts a session, loads its questions, and focuses the first one', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())

    let outcome
    await act(async () => {
      outcome = await result.current.startSession({ role_target: 'Backend Dev' })
    })

    expect(outcome.success).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/api/interview/start', { role_target: 'Backend Dev' })
    expect(api.get).toHaveBeenCalledWith('/api/interview/session/sess-9/questions')
    expect(result.current.sessionId).toBe('sess-9')
    expect(result.current.currentQuestion?.id).toBe('q1')
    expect(result.current.questions).toHaveLength(2)
  })

  it('surfaces the backend detail when starting fails (e.g. insufficient credits)', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 402, data: { detail: 'Not enough credits. 10 required.' } },
    })
    const { result } = renderHook(() => useInterviewSession())

    let outcome
    await act(async () => {
      outcome = await result.current.startSession({})
    })

    expect(outcome.success).toBe(false)
    expect(outcome.error).toBe('Not enough credits. 10 required.')
    expect(result.current.error).toBe('Not enough credits. 10 required.')
  })

  it('advances from the server next_question and stores the answer_id for hints', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => {
      await result.current.startSession({})
    })

    api.post.mockResolvedValueOnce({ data: { status: 'ok', next_question: nextQ2, answer_id: 'ans-1' } })
    let outcome
    await act(async () => {
      outcome = await result.current.submitAnswer('REST is an architectural style.')
    })

    expect(api.post).toHaveBeenCalledWith('/api/interview/answer', {
      session_id: 'sess-9',
      question_id: 'q1',
      answer_text: 'REST is an architectural style.',
    })
    // H1: the advance is driven by AnswerResponse.next_question, not local index.
    expect(result.current.currentQuestion?.id).toBe('q2')
    // H2: the answer_id is surfaced so the client can request a hint for it.
    expect(outcome.answerId).toBe('ans-1')
    expect(result.current.lastAnswerId).toBe('ans-1')
    expect(result.current.isSubmitting).toBe(false)
  })

  it('stays on the current question when the server returns a resubmission (next_question null)', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    api.post.mockResolvedValueOnce({ data: { status: 'ok', next_question: null, answer_id: 'ans-1' } })
    let outcome
    await act(async () => {
      outcome = await result.current.submitAnswer('Edited answer.')
    })

    expect(result.current.currentQuestion?.id).toBe('q1')
    expect(outcome.resubmitted).toBe(true)
    expect(outcome.answerId).toBe('ans-1')
  })

  it('surfaces an adaptive reserve question the client has never seen', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    const reserve = { id: 'qr-1', text: 'Harder follow-up.', question_number: 2, total_questions: 2, skill_tag: 'API' }
    api.post.mockResolvedValueOnce({ data: { status: 'ok', next_question: reserve, answer_id: 'ans-1' } })
    await act(async () => {
      await result.current.submitAnswer('First answer.')
    })

    expect(result.current.currentQuestion?.id).toBe('qr-1')
    expect(result.current.questions.map(q => q.id)).toContain('qr-1')
  })

  it('marks the session complete after the last answer reports interview_complete', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    api.post.mockResolvedValueOnce({ data: { status: 'ok', next_question: nextQ2, answer_id: 'ans-1' } })
    await act(async () => {
      await result.current.submitAnswer('First answer.')
    })
    expect(result.current.currentQuestion?.id).toBe('q2')

    api.post.mockResolvedValueOnce({ data: { status: 'interview_complete', next_question: null, answer_id: 'ans-2' } })
    let outcome
    await act(async () => {
      outcome = await result.current.submitAnswer('Indexing speeds up reads.')
    })

    expect(outcome.complete).toBe(true)
    expect(outcome.answerId).toBe('ans-2')
    expect(result.current.isComplete).toBe(true)
  })

  it('keeps the error message from a failed answer submission', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    api.post.mockRejectedValueOnce({ response: { status: 500, data: { detail: 'Evaluation failed' } } })
    let outcome
    await act(async () => {
      outcome = await result.current.submitAnswer('answer')
    })

    expect(outcome.error).toBe('Evaluation failed')
    expect(result.current.error).toBe('Evaluation failed')
  })

  it('finish() posts to the early-finish endpoint and flags completion', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    api.post.mockResolvedValueOnce({ data: {} })
    let outcome
    await act(async () => {
      outcome = await result.current.finishSession()
    })

    expect(api.post).toHaveBeenCalledWith('/api/interview/finish/sess-9')
    expect(outcome.success).toBe(true)
    expect(result.current.isComplete).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Abandon paths — regression protection for the redesigned abandon flow
  // -------------------------------------------------------------------------

  it('explicit quit posts to /api/interview/abandon/:id with Bearer auth via axios', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    api.post.mockResolvedValueOnce({ data: {} })
    let outcome
    await act(async () => {
      outcome = await result.current.quitSession()
    })

    expect(api.post).toHaveBeenCalledWith('/api/interview/abandon/sess-9')
    expect(outcome.success).toBe(true)
  })

  it('abandon-beacon uses sendBeacon against the HMAC token endpoint (tab-close path)', async () => {
    const beacon = vi.fn()
    navigator.sendBeacon = beacon

    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => {
      await result.current.startSession({})
    })

    act(() => {
      result.current.abandonSession()
    })

    // Regression: the beacon must hit the single-purpose abandon-beacon route
    // with the per-session HMAC token as a query parameter.
    expect(beacon).toHaveBeenCalledTimes(1)
    const url = beacon.mock.calls[0][0]
    expect(url).toContain('http://backend.test/api/interview/abandon-beacon/sess-9')
    expect(url).toContain('abandon_token=hmac-token-1')
  })

  it('abandon-beacon is a no-op without a stored HMAC token', async () => {
    const beacon = vi.fn()
    navigator.sendBeacon = beacon
    api.post.mockResolvedValue({ data: { session_id: 's', abandon_token: null } })
    api.get.mockResolvedValue({ data: questions })

    const { result } = renderHook(() => useInterviewSession())
    await act(async () => {
      await result.current.startSession({})
    })
    act(() => {
      result.current.abandonSession()
    })
    expect(beacon).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Crash recovery
  // -------------------------------------------------------------------------

  it('recovers an active session on refresh and resumes at the first unanswered question', async () => {
    const recoveredQuestions = [
      { ...questions[0], user_answer: 'already answered' },
      questions[1],
    ]
    api.get.mockImplementation((url) => {
      if (url === '/api/interview/session/sess-9') {
        return Promise.resolve({ data: { status: 'active', voice_mode: true, interviewer_persona: 'Formal Interviewer' } })
      }
      return Promise.resolve({ data: recoveredQuestions })
    })

    const { result } = renderHook(() => useInterviewSession())
    let outcome
    await act(async () => {
      outcome = await result.current.recoverSession('sess-9')
    })

    expect(outcome.success).toBe(true)
    expect(result.current.voiceMode).toBe(true)
    expect(result.current.interviewerPersona).toBe('Formal Interviewer')
    // resumes at first UNANSWERED question
    expect(result.current.currentQuestion?.id).toBe('q2')
  })

  it('redirects to results when recovering a completed session', async () => {
    api.get.mockResolvedValueOnce({ data: { status: 'completed' } })
    const { result } = renderHook(() => useInterviewSession())

    let outcome
    await act(async () => {
      outcome = await result.current.recoverSession('sess-done')
    })

    expect(outcome.success).toBe(false)
    expect(outcome.redirect).toBe('results')
  })

  it('redirects abandoned sessions to the abandoned guidance path', async () => {
    api.get.mockResolvedValueOnce({ data: { status: 'abandoned' } })
    const { result } = renderHook(() => useInterviewSession())

    let outcome
    await act(async () => {
      outcome = await result.current.recoverSession('sess-old')
    })

    expect(outcome.success).toBe(false)
    expect(outcome.redirect).toBe('abandoned')
  })

  it('exposes retryAfter when the server rate-limits an answer', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    api.post.mockRejectedValueOnce({
      response: { status: 429, data: { detail: 'Please wait 7 seconds between submitting answers to allow AI evaluation to process.' } },
    })
    let outcome
    await act(async () => {
      outcome = await result.current.submitAnswer('answer')
    })

    expect(outcome.error).toContain('Please wait 7 seconds')
    expect(outcome.retryAfter).toBe(7)
    expect(result.current.retryAfter).toBe(7)
  })

  it('surfaces SSE error events from the hint stream instead of swallowing them', async () => {
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify('tok-hint')))
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"error":"Hints are disabled for the Tough FAANG Interviewer persona."}\n',
        'data: [DONE]\n',
      ])
    )

    const { result } = renderHook(() => useInterviewSession())

    let outcome
    await act(async () => {
      outcome = await result.current.streamHint('ans-9')
    })

    expect(result.current.hintError).toBe('Hints are disabled for the Tough FAANG Interviewer persona.')
    expect(result.current.hint).toBeNull()
    expect(result.current.hintStreaming).toBe(false)
    expect(outcome.success).toBe(true)
    sessionStorage.removeItem('_secure_token')
  })

  it('reports a failed hint fetch instead of leaving a silent empty hint', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, body: null })
    const { result } = renderHook(() => useInterviewSession())

    let outcome
    await act(async () => {
      outcome = await result.current.streamHint('ans-9')
    })

    expect(outcome.error).toBeTruthy()
    expect(result.current.hintError).toBeTruthy()
    expect(result.current.hintStreaming).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Hint streaming (raw fetch + SSE parsing through apiUrl)
  // -------------------------------------------------------------------------

  it('streams hint tokens over SSE with Bearer auth and clears streaming state when done', async () => {
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify('tok-hint')))
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        'data: {"token":"Think about "}\n\n',
        'data: {"token":"HTTP verbs."}\n',
        'data: [DONE]\n',
      ])
    )

    const { result } = renderHook(() => useInterviewSession())

    await act(async () => {
      await result.current.streamHint('ans-1')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/api/interview/hint/ans-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok-hint' } })
    )
    expect(result.current.hint).toBe('Think about HTTP verbs.')
    expect(result.current.hintStreaming).toBe(false)
    sessionStorage.removeItem('_secure_token')
  })

  it('tolerates malformed SSE chunks without breaking the stream', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {broken json}\n', 'data: {"token":"ok"}\n'])
    )
    const warn = vi.spyOn(console, 'error')
    const { result } = renderHook(() => useInterviewSession())

    await act(async () => {
      await result.current.streamHint('ans-2')
    })

    expect(result.current.hint).toBe('ok')
    expect(result.current.hintStreaming).toBe(false)
    warn.mockRestore()
  })

  it('quitSession reports failure so the page can stay put instead of navigating away (H7)', async () => {
    mockStart()
    const { result } = renderHook(() => useInterviewSession())
    await act(async () => { await result.current.startSession({}) })

    api.post.mockRejectedValueOnce({
      response: { status: 500, data: { detail: 'Could not end session.' } },
    })
    let outcome
    await act(async () => {
      outcome = await result.current.quitSession()
    })

    expect(outcome.success).toBe(false)
    expect(outcome.error).toBe('Could not end session.')
  })
})
