import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import InterviewSessionPage from './InterviewSessionPage'
import useInterviewSession from '../hooks/useInterviewSession'

vi.mock('../hooks/useInterviewSession', () => ({
  default: vi.fn(),
}))

vi.mock('../hooks/useAudioRecorder', () => ({
  default: () => ({
    status: 'idle',
    error: null,
    recordTime: 0,
    recordLimit: 55,
    recordLimitHit: false,
    micStream: null,
    isSpeechSupported: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    clearRecorder: vi.fn(),
  }),
  MAX_RECORD_SECONDS: 55,
}))

const baseSession = (overrides = {}) => ({
  interviewerPersona: 'Friendly Senior Engineer',
  sessionId: null,
  currentQuestion: null,
  questionNumber: 1,
  totalQuestions: 10,
  isSubmitting: false,
  isComplete: false,
  hint: null,
  hintStreaming: false,
  hintError: null,
  lastAnswerId: null,
  retryAfter: null,
  error: null,
  voiceMode: false,
  questions: [],
  currentIndex: 0,
  recoverSession: vi.fn(),
  submitAnswer: vi.fn(),
  streamHint: vi.fn(),
  navigateToQuestion: vi.fn(),
  finishSession: vi.fn(),
  quitSession: vi.fn(),
  ...overrides,
})

const renderSession = (sessionId = 'sess-1') =>
  render(
    <MemoryRouter initialEntries={[`/dashboard/interview/${sessionId}`]}>
      <Routes>
        <Route path="/dashboard/interview/:sessionId" element={<InterviewSessionPage />} />
        <Route path="/dashboard/interview" element={<div>Setup page marker</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('InterviewSessionPage — ended-session guidance (H6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the abandoned guidance for redirect:abandoned', async () => {
    useInterviewSession.mockReturnValue(
      baseSession({
        recoverSession: vi.fn().mockResolvedValue({ success: false, redirect: 'abandoned' }),
      })
    )
    renderSession()

    await screen.findByText('Session Abandoned')
    expect(screen.getByRole('button', { name: 'Start New Interview' })).toBeInTheDocument()
    expect(screen.queryByText('Session Not Found')).not.toBeInTheDocument()
  })

  it('shows the expired guidance for redirect:setup', async () => {
    useInterviewSession.mockReturnValue(
      baseSession({
        recoverSession: vi.fn().mockResolvedValue({ success: false, redirect: 'setup' }),
      })
    )
    renderSession()

    await screen.findByText('Session Expired')
    expect(screen.getByRole('button', { name: 'Start New Interview' })).toBeInTheDocument()
    expect(screen.queryByText('Session Not Found')).not.toBeInTheDocument()
  })

  it('keeps Session Not Found for never-started sessions', async () => {
    useInterviewSession.mockReturnValue(
      baseSession({
        recoverSession: vi.fn().mockResolvedValue({ success: false, error: 'Session not found.' }),
      })
    )
    renderSession()

    await screen.findByText('Session Not Found')
    expect(screen.queryByText('Session Abandoned')).not.toBeInTheDocument()
    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument()
  })

  it('stays on the session page when quit fails instead of navigating away (H7)', async () => {
    const quitSession = vi.fn().mockResolvedValue({ success: false, error: 'Could not end session.' })
    useInterviewSession.mockReturnValue(
      baseSession({
        sessionId: 'sess-1',
        currentQuestion: { id: 'q1', text: 'What is REST?', skill_tag: 'API' },
        questions: [{ id: 'q1', text: 'What is REST?', question_number: 1, total_questions: 1, user_answer: null }],
        quitSession,
      })
    )
    renderSession()

    fireEvent.click(screen.getByRole('button', { name: /quit practice/i }))
    fireEvent.click(await screen.findByRole('button', { name: /leave session/i }))

    expect(quitSession).toHaveBeenCalled()
    // Failed quit must not navigate: the live session page stays rendered.
    expect(screen.queryByText('Setup page marker')).not.toBeInTheDocument()
    expect(await screen.findByText('Could not end session.')).toBeInTheDocument()
  })
})
