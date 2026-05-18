import React, { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import api from '../config/api'

// Components
import SessionTimer from '../components/interview/SessionTimer'
import QuestionDisplay from '../components/interview/QuestionDisplay'
import NavigationControls from '../components/interview/NavigationControls'

// Hooks
import { useInterviewSession, useAnswerManagement, useInterviewNavigation } from '../hooks/useInterviewSession'

// Utility component for tips
const InterviewTips = () => (
  <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
    <AlertCircle className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
    <div className="text-sm text-blue-800">
      <p className="font-semibold mb-2">Interview Tips:</p>
      <ul className="space-y-1">
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>For MCQs: Click an option to submit instantly and see explanation</span>
        </li>
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>For short answers: Click "Submit Answer" to get AI feedback</span>
        </li>
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>You can navigate between questions freely to review</span>
        </li>
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>The session will auto-submit when time runs out</span>
        </li>
        <li className="flex items-start">
          <span className="mr-2">•</span>
          <span>Click "Complete Interview" when you're done to see your final results</span>
        </li>
      </ul>
    </div>
  </div>
)

// Loading state component
const LoadingState = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600" />
  </div>
)

// Error state component
const ErrorState = ({ title, message, onRetry, onBack }) => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        )}
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  </div>
)

// Session Header Component
const SessionHeader = React.memo(({ session, currentIndex, totalQuestions, endTime, onTimeout }) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {session?.session_type} Interview
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Difficulty: <span className="font-semibold capitalize">{session?.difficulty_level}</span>
        </p>
      </div>
      <SessionTimer endTime={endTime} onTimeout={onTimeout} />
    </div>
  </div>
))

SessionHeader.displayName = 'SessionHeader'

/**
 * Main Interview Session Page Component
 * Orchestrates the interview flow with all extracted sub-components
 */
const InterviewSessionPage = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  // Custom hooks for session management
  const { session, questions, loading, error, refetch } = useInterviewSession(sessionId)
  const { answers, evaluations, submitting, handleAnswerChange, submitAnswer, setAnswers } = useAnswerManagement()
  const { currentIndex, goToNext, goToPrevious } = useInterviewNavigation(questions.length)

  const [completing, setCompleting] = React.useState(false)

  // Initialize answers when questions load
  React.useEffect(() => {
    if (questions.length > 0) {
      const initialAnswers = {}
      questions.forEach((q) => {
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
      setAnswers(initialAnswers)
    }
  }, [questions, setAnswers])

  // Handle answer submission
  const handleSubmitAnswer = useCallback(async (questionId, value, isOption) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) return

    try {
      await submitAnswer(sessionId, question, value, isOption)
    } catch (error) {
      alert('Failed to submit answer: ' + (error.response?.data?.detail || error.message))
    }
  }, [questions, sessionId, submitAnswer])

  // Handle interview completion
  const handleComplete = useCallback(async () => {
    setCompleting(true)
    try {
      await api.post(`/api/interviews/${sessionId}/complete`, {
        early_completion: false
      })
      navigate(`/dashboard/interview/results/${sessionId}`)
    } catch (error) {
      alert('Failed to complete session: ' + (error.response?.data?.detail || error.message))
    } finally {
      setCompleting(false)
    }
  }, [sessionId, navigate])

  // Handle timeout
  const handleTimeout = useCallback(async () => {
    alert('Time is up! Submitting your interview...')
    try {
      await api.post(`/api/interviews/${sessionId}/complete`, {
        early_completion: false
      })
      navigate(`/dashboard/interview/results/${sessionId}`)
    } catch (error) {
      console.error('Error completing session:', error)
    }
  }, [sessionId, navigate])

  // Render states
  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Interview"
        message={error}
        onRetry={refetch}
        onBack={() => navigate('/dashboard/interview')}
      />
    )
  }

  if (!questions || questions.length === 0) {
    return (
      <ErrorState
        title="No Questions Found"
        message="This interview session doesn't have any questions."
        onBack={() => navigate('/dashboard/interview')}
      />
    )
  }

  const currentQuestion = questions[currentIndex]

  if (!currentQuestion) {
    return (
      <ErrorState
        title="Question Not Found"
        message="Unable to load the current question."
        onRetry={() => navigate(0)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Session Header */}
        <SessionHeader
          session={session}
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          endTime={session?.ends_at}
          onTimeout={handleTimeout}
        />

        {/* Question Display */}
        <QuestionDisplay
          question={currentQuestion}
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          answerId={currentQuestion.id}
          answers={answers}
          evaluations={evaluations}
          loading={submitting}
          onAnswerChange={handleAnswerChange}
          onSubmitAnswer={handleSubmitAnswer}
        />

        {/* Navigation Controls */}
        <NavigationControls
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          onPrevious={goToPrevious}
          onNext={goToNext}
          onComplete={handleComplete}
          completing={completing}
        />

        {/* Tips Section */}
        <InterviewTips />
      </div>
    </div>
  )
}

export default InterviewSessionPage
