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
  voiceMode: false,
  questions: [],
  currentIndex: 0,
  interviewerPersona: 'Friendly Senior Engineer',
}

export default function useInterviewSession() {
  const [state, setState] = useState(INITIAL_STATE)
  const hintReaderRef = useRef(null)

  // Helper to fetch all questions for the session along with their answer states
  const fetchSessionQuestions = useCallback(async (sessionId, voiceMode = false, selectFirstUnanswered = true) => {
    try {
      const res = await api.get(`/api/interview/session/${sessionId}/questions`)
      const questionsList = res.data || []
      
      // Auto-focus the first unanswered question
      let targetIndex = 0
      if (selectFirstUnanswered) {
        const unansweredIdx = questionsList.findIndex(q => !q.user_answer)
        if (unansweredIdx !== -1) {
          targetIndex = unansweredIdx
        }
      }
      
      const activeQ = questionsList[targetIndex]
      
      setState(prev => ({
        ...prev,
        sessionId,
        questions: questionsList,
        currentIndex: targetIndex,
        currentQuestion: activeQ ? {
          id: activeQ.id,
          text: activeQ.text,
          question_number: activeQ.question_number,
          total_questions: activeQ.total_questions,
          skill_tag: activeQ.skill_tag,
        } : null,
        questionNumber: activeQ ? activeQ.question_number : 1,
        totalQuestions: questionsList.length || prev.totalQuestions,
        voiceMode,
      }))
      return { success: true }
    } catch (err) {
      console.error('Failed to load session questions:', err)
      return { success: false, error: 'Failed to retrieve question list.' }
    }
  }, [])

  // -------------------------------------------------------------------------
  // Start a new session
  // -------------------------------------------------------------------------
  const startSession = useCallback(async (config) => {
    setState(prev => ({ ...prev, error: null }))
    try {
      const res = await api.post('/api/interview/start', config)
      const { session_id } = res.data
      await fetchSessionQuestions(session_id, config.voice_mode || false, false)
      setState(prev => ({
        ...prev,
        interviewerPersona: config.interviewer_persona || 'Friendly Senior Engineer',
      }))
      return { success: true, sessionId: session_id }
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to start interview session.'
      setState(prev => ({ ...prev, error: message }))
      return { success: false, error: message }
    }
  }, [fetchSessionQuestions])

  // -------------------------------------------------------------------------
  // Recover a session on page refresh
  // -------------------------------------------------------------------------
  const recoverSession = useCallback(async (sessionId) => {
    try {
      const res = await api.get(`/api/interview/session/${sessionId}`)
      const data = res.data
      if (data.status !== 'active') {
        // Session is completed or abandoned — redirect to results
        return { success: false, redirect: data.status === 'completed' ? 'results' : 'setup' }
      }
      await fetchSessionQuestions(sessionId, data.voice_mode || false, true)
      setState(prev => ({
        ...prev,
        interviewerPersona: data.interviewer_persona || 'Friendly Senior Engineer',
      }))
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Session not found.' }
    }
  }, [fetchSessionQuestions])

  // -------------------------------------------------------------------------
  // Navigate backward / forward manually between question indexes
  // -------------------------------------------------------------------------
  const navigateToQuestion = useCallback((index) => {
    setState(prev => {
      if (index < 0 || index >= prev.questions.length) return prev
      const q = prev.questions[index]
      return {
        ...prev,
        currentIndex: index,
        currentQuestion: {
          id: q.id,
          text: q.text,
          question_number: q.question_number,
          total_questions: q.total_questions,
          skill_tag: q.skill_tag,
        },
        questionNumber: q.question_number,
      }
    })
  }, [])

  // -------------------------------------------------------------------------
  // Early mid-interview Finish trigger
  // -------------------------------------------------------------------------
  const finishSession = useCallback(async () => {
    const { sessionId } = state
    if (!sessionId) return { error: 'No active session.' }
    
    setState(prev => ({ ...prev, isSubmitting: true }))
    try {
      await api.post(`/api/interview/finish/${sessionId}`)
      setState(prev => ({ ...prev, isSubmitting: false, isComplete: true }))
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to finish interview session early.'
      setState(prev => ({ ...prev, isSubmitting: false, error: message }))
      return { error: message }
    }
  }, [state])

  // -------------------------------------------------------------------------
  // Submit an answer — supports regular sequences and re-submissions/updates
  // -------------------------------------------------------------------------
  const submitAnswer = useCallback(async (answerText) => {
    const { sessionId, currentQuestion, currentIndex, questions } = state
    if (!sessionId || !currentQuestion || !answerText.trim()) return

    setState(prev => ({ ...prev, isSubmitting: true, hint: null, hintStreaming: false, error: null }))

    try {
      const res = await api.post('/api/interview/answer', {
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_text: answerText,
      })
      const { status } = res.data

      // Update answer text dynamically in local state questions array
      const updatedQuestions = [...questions]
      updatedQuestions[currentIndex] = {
        ...updatedQuestions[currentIndex],
        user_answer: answerText,
      }

      // Check if early finish or all questions resolved
      const nextIndex = currentIndex + 1
      const isLastQuestion = nextIndex >= questions.length

      if (isLastQuestion && status === 'interview_complete') {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          isComplete: true,
          questions: updatedQuestions,
        }))
        return { complete: true }
      }

      // Progress automatically to next question in sequence
      const targetIdx = isLastQuestion ? currentIndex : nextIndex
      const nextQ = updatedQuestions[targetIdx]

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        questions: updatedQuestions,
        currentIndex: targetIdx,
        currentQuestion: {
          id: nextQ.id,
          text: nextQ.text,
          question_number: nextQ.question_number,
          total_questions: nextQ.total_questions,
          skill_tag: nextQ.skill_tag,
        },
        questionNumber: nextQ.question_number,
        hint: null,
      }))

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
    navigateToQuestion,
    finishSession,
    submitAnswer,
    streamHint,
    abandonSession,
  }
}
