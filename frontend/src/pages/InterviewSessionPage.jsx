import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../config/api'
import LoadingButton from '../components/LoadingButton'
import { Clock, ChevronLeft, ChevronRight, Send, AlertCircle } from 'lucide-react'

const Timer = ({ endTime, onTimeout }) => {
  const [timeLeft, setTimeLeft] = useState(0)
  const timeoutCalled = React.useRef(false)

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!endTime) return

      const now = new Date().getTime()
      const end = new Date(endTime).getTime()

      if (isNaN(end)) {
        console.error('Timer: Invalid end time', endTime)
        return
      }

      const diff = Math.max(0, Math.floor((end - now) / 1000))

      // console.log('Timer:', { endTime, diff })
      setTimeLeft(diff)

      if (diff === 0 && onTimeout && !timeoutCalled.current) {
        timeoutCalled.current = true
        onTimeout()
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [endTime, onTimeout])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isWarning = timeLeft < 60 // Less than 1 minute
  const isCritical = timeLeft < 30 // Less than 30 seconds
  const isLow = timeLeft < 300 // Less than 5 minutes

  return (
    <div className={`flex flex-col items-end p-3 rounded-lg border-2 ${isCritical ? 'bg-red-50 border-red-500 animate-pulse' :
      isWarning ? 'bg-red-50 border-red-400' :
        isLow ? 'bg-yellow-50 border-yellow-400' :
          'bg-blue-50 border-blue-400'
      }`}>
      <div className={`flex items-center ${isCritical ? 'text-red-700' :
        isWarning ? 'text-red-600' :
          isLow ? 'text-yellow-700' :
            'text-blue-700'
        }`}>
        <Clock className={`w-6 h-6 mr-2 ${isCritical ? 'animate-pulse' : ''}`} />
        <span className="text-2xl font-mono font-bold">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <span className={`text-xs mt-1 font-medium ${isCritical ? 'text-red-600' :
        isWarning ? 'text-red-500' :
          isLow ? 'text-yellow-600' :
            'text-blue-600'
        }`}>
        {isCritical ? 'Time almost up!' : isWarning ? 'Hurry up!' : isLow ? 'Running low' : 'Time remaining'}
      </span>
    </div>
  )
}

const InterviewSessionPage = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    fetchSessionData()
  }, [sessionId])

  const fetchSessionData = async () => {
    try {
      const response = await api.get(`/api/interviews/${sessionId}/questions`)
      setSession(response.data.session)
      setQuestions(response.data.questions)

      // Initialize answers object including pre-filled ones
      const initialAnswers = {}
      response.data.questions.forEach(q => {
        let selectedOptionIndex = null
        // If we have a submitted answer for MCQ, find its index
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
    } catch (error) {
      console.error('Error fetching session:', error)
      alert('Failed to load interview session')
      navigate('/dashboard/interview')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (questionId, value, isOption = false) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [isOption ? 'selected_option' : 'answer_text']: value
      }
    }))
  }

  const submitAnswer = async (isNavigation = false) => {
    console.log('🔵 submitAnswer CLICKED', { isNavigation })
    const question = questions[currentIndex]
    const answer = answers[question.id]
    console.log('Payload check:', { question, answer })

    // If already submitted, just move next if navigating
    if (question.submitted_answer) {
      if (isNavigation && currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1)
      }
      return
    }

    // Validate answer
    if (question.question_type === 'mcq') {
      if (answer.selected_option === null || answer.selected_option === undefined) {
        alert('Please select an option')
        return
      }
    } else {
      if (!answer.answer_text?.trim()) {
        alert('Please provide an answer')
        return
      }
    }

    setSubmitting(true)
    try {
      console.log('Constructing payload...')
      const payload = {
        question_id: question.id,
        answer_text: question.question_type === 'mcq' ? null : answer.answer_text,
        selected_option: (question.question_type === 'mcq' && question.options)
          ? question.options[answer.selected_option]
          : null
      }
      console.log('Sending payload:', payload)

      const res = await api.post(`/api/interviews/${sessionId}/submit-answer`, payload)
      console.log('API Response:', res.status, res.data)

      // Move to next question if available
      if (isNavigation && currentIndex < questions.length - 1) {
        console.log('Moving to next question...')
        setCurrentIndex(currentIndex + 1)
      } else {
        console.log('Question submitted successfully.')
      }
    } catch (error) {
      console.error('❌ Error submitting answer:', error)
      if (error.response) {
        console.error('Response data:', error.response.data)
        console.error('Response status:', error.response.status)
      }
      alert('Failed to submit answer: ' + (error.message || 'Unknown error'))
    } finally {
      console.log('🏁 submitAnswer finally block')
      setSubmitting(false)
    }
  }



  const handleComplete = async () => {
    const question = questions[currentIndex]
    // If current question not submitted, submit it first
    if (!question.submitted_answer) {
      // Quick validation check
      const answer = answers[question.id]
      const isAnswered = question.question_type === 'mcq'
        ? answer?.selected_option !== null
        : answer?.answer_text?.trim().length > 0

      if (isAnswered) {
        console.log('Auto-submitting last question before completion...')
        await submitAnswer(false)
      }
    }
    await completeSession()
  }

  const completeSession = async () => {
    console.log('🟢 completeSession CLICKED')
    // Removed blocking confirm dialog
    // if (!window.confirm('Are you sure you want to complete this interview? You cannot change your answers afterwards.')) {
    //   return
    // }

    setCompleting(true)
    try {
      console.log('Sending complete API call...')
      await api.post(`/api/interviews/${sessionId}/complete`, {
        early_completion: false
      })

      navigate(`/dashboard/interview/results/${sessionId}`)
    } catch (error) {
      console.error('Error completing session:', error)
      alert('Failed to complete session')
    } finally {
      setCompleting(false)
    }
  }

  const handleTimeout = async () => {
    alert('Time is up! Submitting your interview...')
    try {
      await api.post(`/api/interviews/${sessionId}/complete`, {
        early_completion: false
      })
      navigate(`/dashboard/interview/results/${sessionId}`)
    } catch (error) {
      console.error('Error completing session:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers[currentQuestion?.id]
  const isAnswered = currentQuestion?.question_type === 'mcq'
    ? currentAnswer?.selected_option !== null
    : currentAnswer?.answer_text?.trim().length > 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {session?.session_type} Interview
            </h1>
            <p className="text-sm text-gray-600">
              Difficulty: <span className="font-medium capitalize">{session?.difficulty_level}</span>
            </p>
          </div>
          <Timer
            endTime={session?.ends_at}
            onTimeout={handleTimeout}
          />
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="text-sm text-gray-600 mt-2 text-right">
          Question {currentIndex + 1} of {questions.length}
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-start mb-4">
          <span className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
            {currentIndex + 1}
          </span>
          <div className="ml-4 flex-1">
            <div className="flex items-center mb-2">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                {currentQuestion?.question_type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
              </span>
              <span className="ml-2 px-3 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                {currentQuestion?.skill}
              </span>
            </div>
            <p className="text-lg text-gray-900 mb-4 whitespace-pre-wrap">
              {currentQuestion?.question_text}
            </p>

            {/* MCQ Options */}
            {currentQuestion?.question_type === 'mcq' && currentQuestion?.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center p-4 border-2 rounded-lg transition-all ${currentAnswer?.selected_option === idx
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200'
                      } ${currentQuestion?.submitted_answer ? 'cursor-default opacity-80' : 'cursor-pointer hover:border-indigo-300'}`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={idx}
                      checked={currentAnswer?.selected_option === idx}
                      onChange={() => !currentQuestion?.submitted_answer && handleAnswerChange(currentQuestion.id, idx, true)}
                      disabled={!!currentQuestion?.submitted_answer}
                      className="w-5 h-5 text-indigo-600"
                    />
                    <span className="ml-3 text-gray-900">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Short Answer */}
            {currentQuestion?.question_type === 'short_answer' && (
              <div>
                <textarea
                  value={currentAnswer?.answer_text || ''}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:text-gray-600"
                  rows={6}
                  disabled={!!currentQuestion?.submitted_answer}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Tip: Be concise and focus on key points
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0 || submitting}
          className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <LoadingButton
            onClick={() => submitAnswer(true)}
            loading={submitting}
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </LoadingButton>
        ) : (
          <LoadingButton
            onClick={handleComplete}
            loading={completing || submitting}
            disabled={completing || submitting}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Complete Interview
          </LoadingButton>
        )}
      </div>

      {/* Warning Message */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
        <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium mb-1">Important Notes:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>You can navigate between questions freely</li>
            <li>Submit each answer before moving to ensure it's evaluated</li>
            <li>The session will auto-submit when time runs out</li>
            <li>Click "Complete Interview" when you're done to see your results</li>
          </ul>
        </div>
      </div>
    </div>

  )
}

export default InterviewSessionPage
