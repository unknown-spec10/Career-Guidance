import { useState, useEffect, useCallback } from 'react'
import api from '../../config/api'

/**
 * Hook to fetch and manage interview session data
 */
export const useInterviewSession = (sessionId) => {
  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSessionData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await api.get(`/api/interviews/${sessionId}/questions`)

      if (!response.data) {
        throw new Error('No data received from server')
      }

      setSession(response.data.session)
      const questionsList = response.data.questions || []
      setQuestions(questionsList)

      // Initialize answers object with pre-filled data
      const initialAnswers = {}
      questionsList.forEach((q) => {
        let selectedOptionIndex = null
        if (q.submitted_answer?.selected_option && q.options) {
          selectedOptionIndex = q.options.indexOf(q.submitted_answer.selected_option)
          if (selectedOptionIndex === -1) selectedOptionIndex = null
        }

        initialAnswers[q.id] = {
          answer_text: q.submitted_answer?.answer_text || '',
          selected_option: selectedOptionIndex
        }
      })

      return initialAnswers
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message
      setError(errorMsg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchSessionData()
  }, [fetchSessionData])

  return { session, questions, loading, error, refetch: fetchSessionData }
}

/**
 * Hook to manage answer submissions
 */
export const useAnswerManagement = () => {
  const [answers, setAnswers] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const handleAnswerChange = useCallback((questionId, value, isOption = false) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [isOption ? 'selected_option' : 'answer_text']: value
      }
    }))
  }, [])

  const submitAnswer = useCallback(async (sessionId, question, value, isOption) => {
    setSubmitting(true)
    try {
      const payload = {
        question_id: question.id,
        answer_text: question.question_type === 'mcq' ? null : value,
        selected_option: (question.question_type === 'mcq' && question.options)
          ? question.options[value]
          : null
      }

      const res = await api.post(`/api/interviews/${sessionId}/submit-answer`, payload)

      // Update evaluations with response
      setEvaluations(prev => ({
        ...prev,
        [question.id]: res.data
      }))

      return res.data
    } catch (error) {
      console.error('Error submitting answer:', error)
      throw error
    } finally {
      setSubmitting(false)
    }
  }, [])

  return {
    answers,
    evaluations,
    submitting,
    handleAnswerChange,
    submitAnswer,
    setAnswers,
    setEvaluations
  }
}

/**
 * Hook to manage interview navigation
 */
export const useInterviewNavigation = (totalQuestions) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, totalQuestions - 1))
  }, [totalQuestions])

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const goToQuestion = useCallback((index) => {
    setCurrentIndex(Math.max(0, Math.min(index, totalQuestions - 1)))
  }, [totalQuestions])

  return {
    currentIndex,
    goToNext,
    goToPrevious,
    goToQuestion,
    setCurrentIndex
  }
}
