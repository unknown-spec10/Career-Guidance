/**
 * useInterviewSession — manages the full active interview loop.
 * Handles session start, answer submission, crash recovery, and session abandonment.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'

const INITIAL_STATE = {
  sessionId: null,
  currentQuestion: null,
  questionNumber: 1,
  totalQuestions: 10,
  isSubmitting: false,
  isComplete: false,
  hint: null,
  hintStreaming: false,
  error: null,
}

export default function useInterviewSession() {
  const [state, setState] = useState(INITIAL_STATE)
  const hintReaderRef = useRef(null)

  // -------------------------------------------------------------------------
  // Start a new session
  // -------------------------------------------------------------------------
  const startSession = useCallback(async (config) => {
    setState(prev => ({ ...prev, error: null }))
    try {
      const res = await api.post('/api/interview/start', config)
      const { session_id, first_question } = res.data
      setState({
        ...INITIAL_STATE,
        sessionId: session_id,
        currentQuestion: first_question,
        questionNumber: first_question.question_number,
        totalQuestions: first_question.total_questions,
      })
      return { success: true, sessionId: session_id }
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to start interview session.'
      setState(prev => ({ ...prev, error: message }))
      return { success: false, error: message }
    }
  }, [])

  // -------------------------------------------------------------------------
  // Recover a session on page refresh
  // -------------------------------------------------------------------------
  const recoverSession = useCallback(async (sessionId) => {
    try {
      const res = await api.get(`/api/interview/session/${sessionId}`)
      const data = res.data
      if (data.status !== 'active' || !data.current_question) {
        // Session is completed or abandoned — redirect to results
        return { success: false, redirect: data.status === 'completed' ? 'results' : 'setup' }
      }
      setState({
        ...INITIAL_STATE,
        sessionId,
        currentQuestion: data.current_question,
        questionNumber: data.current_question.question_number,
        totalQuestions: data.total_questions,
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Session not found.' }
    }
  }, [])

  // -------------------------------------------------------------------------
  // Submit an answer — returns next question or signals interview_complete
  // -------------------------------------------------------------------------
  const submitAnswer = useCallback(async (answerText) => {
    const { sessionId, currentQuestion } = state
    if (!sessionId || !currentQuestion || !answerText.trim()) return

    setState(prev => ({ ...prev, isSubmitting: true, hint: null, hintStreaming: false, error: null }))

    try {
      const res = await api.post('/api/interview/answer', {
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_text: answerText,
      })
      const { status, next_question } = res.data

      if (status === 'interview_complete') {
        setState(prev => ({ ...prev, isSubmitting: false, isComplete: true }))
        return { complete: true }
      }

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        currentQuestion: next_question,
        questionNumber: next_question.question_number,
        totalQuestions: next_question.total_questions,
        hint: null,
      }))

      // If the next question has a pre-computed hint, stream it
      if (next_question.hint) {
        // hint is already populated from backend — display directly
        setState(prev => ({ ...prev, hint: next_question.hint }))
      }

      return { complete: false }
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to submit answer.'
      setState(prev => ({ ...prev, isSubmitting: false, error: message }))
      return { error: message }
    }
  }, [state])

  // -------------------------------------------------------------------------
  // Stream a hint for the last evaluated weak answer
  // -------------------------------------------------------------------------
  const streamHint = useCallback(async (answerId) => {
    if (!answerId) return

    setState(prev => ({ ...prev, hint: '', hintStreaming: true }))

    try {
      const token = secureStorage.getItem('token') || ''
      const response = await fetch(`/api/interview/hint/${answerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const reader = response.body.getReader()
      hintReaderRef.current = reader
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.replace('data: ', ''))
              setState(prev => ({ ...prev, hint: (prev.hint || '') + (data.token || '') }))
            } catch {
              // skip malformed chunks
            }
          }
        }
      }
    } catch (err) {
      console.error('Hint stream error:', err)
    } finally {
      setState(prev => ({ ...prev, hintStreaming: false }))
      hintReaderRef.current = null
    }
  }, [])

  // -------------------------------------------------------------------------
  // Abandon session (called on page unload via sendBeacon)
  // -------------------------------------------------------------------------
  const abandonSession = useCallback(() => {
    const { sessionId } = state
    if (!sessionId) return
    const token = secureStorage.getItem('token') || ''
    navigator.sendBeacon(
      `/api/interview/abandon/${sessionId}`,
      JSON.stringify({ Authorization: `Bearer ${token}` })
    )
  }, [state])

  // Register beforeunload handler
  useEffect(() => {
    if (!state.sessionId || state.isComplete) return
    window.addEventListener('beforeunload', abandonSession)
    return () => window.removeEventListener('beforeunload', abandonSession)
  }, [state.sessionId, state.isComplete, abandonSession])

  // Cleanup hint reader on unmount
  useEffect(() => {
    return () => {
      if (hintReaderRef.current) {
        hintReaderRef.current.cancel()
      }
    }
  }, [])

  return {
    ...state,
    startSession,
    recoverSession,
    submitAnswer,
    streamHint,
    abandonSession,
  }
}
