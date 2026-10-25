/**
 * useInterviewSession — manages the full active interview loop.
 * Handles session start, answer submission, crash recovery, and session abandonment.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import api, { apiUrl } from '../config/api'
import secureStorage from '../utils/secureStorage'
import { getApiError } from '../utils/apiError'

const INITIAL_STATE = {
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
  interviewerPersona: 'Friendly Senior Engineer',
}

// Drafts are persisted to localStorage under this prefix (see
// InterviewSessionPage AUTOSAVE_KEY) so they survive tab scope.
const DRAFT_KEY_PREFIX = 'interview_draft_'

const hasUnsavedDraft = () => {
  try {
    return Object.keys(localStorage).some(k => k.startsWith(DRAFT_KEY_PREFIX))
  } catch {
    return false
  }
}

const parseRetryAfter = (message) => {
  const m = String(message || '').match(/(\d+)\s*seconds?/i)
  return m ? parseInt(m[1], 10) : null
}

export default function useInterviewSession() {
  const [state, setState] = useState(INITIAL_STATE)
  const hintReaderRef = useRef(null)
  const abandonTokenRef = useRef(null)

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
    setState(prev => ({ ...prev, error: null, retryAfter: null }))
    try {
      const res = await api.post('/api/interview/start', config)
      const { session_id, abandon_token, first_question } = res.data
      abandonTokenRef.current = abandon_token || null
      const qRes = await fetchSessionQuestions(session_id, config.voice_mode || false, false)
      if (!qRes.success && first_question) {
        // The questions refetch failed after a paid-for start — fall back to
        // the first question from the start response so the candidate is not
        // stranded with a session and no questions.
        setState(prev => ({
          ...prev,
          sessionId: session_id,
          questions: [{
            id: first_question.id,
            text: first_question.text,
            question_number: first_question.question_number || 1,
            total_questions: first_question.total_questions || 1,
            skill_tag: first_question.skill_tag,
            user_answer: null,
            answer_status: null,
          }],
          currentIndex: 0,
          currentQuestion: {
            id: first_question.id,
            text: first_question.text,
            question_number: first_question.question_number || 1,
            total_questions: first_question.total_questions || 1,
            skill_tag: first_question.skill_tag,
          },
          questionNumber: first_question.question_number || 1,
          totalQuestions: first_question.total_questions || 1,
          voiceMode: config.voice_mode || false,
        }))
      }
      setState(prev => ({
        ...prev,
        interviewerPersona: config.interviewer_persona || 'Friendly Senior Engineer',
      }))
      return { success: true, sessionId: session_id }
    } catch (err) {
      const message = getApiError(err, 'Failed to start interview session.')
      setState(prev => ({ ...prev, error: message, retryAfter: parseRetryAfter(message) }))
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
        // Completed sessions go to results; abandoned sessions get their own
        // guidance screen instead of a generic "Session Not Found" error.
        if (data.status === 'completed') {
          return { success: false, redirect: 'results' }
        }
        if (data.status === 'abandoned') {
          return { success: false, redirect: 'abandoned', error: 'This session was abandoned.' }
        }
        return { success: false, redirect: 'setup' }
      }
      abandonTokenRef.current = data.abandon_token || null
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
      const message = getApiError(err, 'Failed to finish interview session early.')
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

    setState(prev => ({ ...prev, isSubmitting: true, hint: null, hintStreaming: false, hintError: null, error: null, retryAfter: null }))

    try {
      const res = await api.post('/api/interview/answer', {
        session_id: sessionId,
        question_id: currentQuestion.id,
        answer_text: answerText,
      })
      const { status, next_question, answer_id } = res.data

      // Update answer text dynamically in local state questions array
      const updatedQuestions = [...questions]
      updatedQuestions[currentIndex] = {
        ...updatedQuestions[currentIndex],
        user_answer: answerText,
      }

      if (status === 'interview_complete') {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          isComplete: true,
          questions: updatedQuestions,
          lastAnswerId: answer_id || null,
        }))
        return { complete: true, answerId: answer_id || null }
      }

      // Resubmission of an already-answered question: the server returns
      // next_question=null with status "ok" — stay on the current question
      // instead of advancing past it.
      if (!next_question) {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          questions: updatedQuestions,
          lastAnswerId: answer_id || null,
          hint: null,
        }))
        return { complete: false, answerId: answer_id || null, resubmitted: true }
      }

      // Drive the advance from the server's next_question (adaptive reserve
      // swaps arrive here). Merge it into the local list in case it is a
      // reserve question the client has never seen.
      let targetIdx = updatedQuestions.findIndex(q => q.id === next_question.id)
      if (targetIdx === -1) {
        updatedQuestions.push({
          id: next_question.id,
          text: next_question.text,
          question_number: next_question.question_number,
          total_questions: next_question.total_questions,
          skill_tag: next_question.skill_tag,
          user_answer: null,
          answer_status: null,
        })
        targetIdx = updatedQuestions.length - 1
      }
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
        lastAnswerId: answer_id || null,
        hint: null,
      }))

      return { complete: false, answerId: answer_id || null }
    } catch (err) {
      const message = getApiError(err, 'Failed to submit answer.')
      setState(prev => ({ ...prev, isSubmitting: false, error: message, retryAfter: parseRetryAfter(message) }))
      return { error: message, retryAfter: parseRetryAfter(message) }
    }
  }, [state])

  // -------------------------------------------------------------------------
  // Stream a hint for the last evaluated weak answer
  // -------------------------------------------------------------------------
  const streamHint = useCallback(async (answerId) => {
    if (!answerId) return { error: 'No answer to hint on yet — submit an answer first.' }

    setState(prev => ({ ...prev, hint: '', hintStreaming: true, hintError: null }))

    try {
      const token = secureStorage.getItem('token') || ''
      const response = await fetch(apiUrl(`/api/interview/hint/${answerId}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok || !response.body) {
        throw new Error(`Hint request failed (HTTP ${response.status})`)
      }
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
              if (data.error) {
                setState(prev => ({ ...prev, hintError: data.error, hint: null }))
              } else if (data.token) {
                setState(prev => ({ ...prev, hint: (prev.hint || '') + data.token }))
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }
      return { success: true }
    } catch (err) {
      const message = err?.message || 'Hint request failed.'
      console.error('Hint stream error:', err)
      setState(prev => ({ ...prev, hintError: message, hint: null }))
      return { error: message }
    } finally {
      setState(prev => ({ ...prev, hintStreaming: false }))
      hintReaderRef.current = null
    }
  }, [])

  // -------------------------------------------------------------------------
  // Abandon session (called on page unload via sendBeacon)
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Abandon session — two paths:
  //   quitSession():  explicit "Quit" button; normal Bearer auth via axios.
  //   abandonSession(): best-effort sendBeacon on tab close; authenticated by
  //     the single-purpose HMAC token issued at session start (beacons cannot
  //     set Authorization headers).
  // -------------------------------------------------------------------------
  const quitSession = useCallback(async () => {
    const { sessionId } = state
    if (!sessionId) return { success: false }
    try {
      await api.post(`/api/interview/abandon/${sessionId}`)
      setState(prev => ({ ...prev }))
      return { success: true }
    } catch (err) {
      console.error('Failed to abandon session:', err)
      return { success: false, error: getApiError(err, 'Failed to end session.') }
    }
  }, [state])

  const abandonSession = useCallback(() => {
    const { sessionId } = state
    if (!sessionId || !abandonTokenRef.current) return
    navigator.sendBeacon(
      apiUrl(`/api/interview/abandon-beacon/${sessionId}?abandon_token=${encodeURIComponent(abandonTokenRef.current)}`)
    )
  }, [state])

  // Register unload handlers:
  // - beforeunload only prompts when an unsaved draft exists (localStorage),
  //   so closing a tab with unsaved work requires confirmation;
  // - pagehide performs the best-effort abandon beacon on actual unload
  //   (never abandon on close while unsaved work exists without confirmation).
  useEffect(() => {
    if (!state.sessionId || state.isComplete) return
    const handleBeforeUnload = (e) => {
      if (hasUnsavedDraft()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', abandonSession)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', abandonSession)
    }
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
    quitSession,
    abandonSession,
  }
}
