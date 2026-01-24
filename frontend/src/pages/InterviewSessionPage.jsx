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
  const [evaluations, setEvaluations] = useState({}) // Store evaluation results
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    fetchSessionData()
  }, [sessionId])

  const fetchSessionData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/interviews/${sessionId}/questions`)
      console.log('🔍 Full API Response:', response)
      console.log('🔍 Response data:', response.data)
      console.log('🔍 Session:', response.data?.session)
      console.log('🔍 Questions:', response.data?.questions)
      
      if (!response.data) {
        throw new Error('No data received from server')
      }

      setSession(response.data.session)
      
      const questionsList = response.data.questions || []
      console.log('🔍 Questions array length:', questionsList.length)
      console.log('🔍 First question:', questionsList[0])
      
      setQuestions(questionsList)

      // Initialize answers object including pre-filled ones
      const initialAnswers = {}
      
      questionsList.forEach((q, index) => {
        console.log(`🔍 Processing question ${index + 1}:`, q)
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
      
      console.log('🔍 Initial answers:', initialAnswers)
      setAnswers(initialAnswers)
      
      console.log('✅ Session data loaded successfully')
    } catch (error) {
      console.error('❌ Error fetching session:', error)
      console.error('❌ Error details:', error.response?.data)
      alert('Failed to load interview session: ' + (error.response?.data?.detail || error.message))
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

  const submitAnswerInstantly = async (questionId, value, isOption = false) => {
    // Update the answer first
    handleAnswerChange(questionId, value, isOption)
    
    const question = questions.find(q => q.id === questionId)
    if (!question) return

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
      
      // Store evaluation result
      setEvaluations(prev => ({
        ...prev,
        [questionId]: res.data
      }))

      // Mark question as submitted by updating the questions array
      setQuestions(prev => prev.map(q => 
        q.id === questionId ? { ...q, submitted_answer: res.data } : q
      ))
    } catch (error) {
      console.error('Error submitting answer:', error)
      alert('Failed to submit answer: ' + (error.response?.data?.detail || error.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
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

  // Helper function to safely render evaluation text (handles arrays, objects, strings)
  const renderEvaluationText = (data) => {
    if (!data) return null
    if (typeof data === 'string') return data
    if (Array.isArray(data)) return data.join(', ')
    if (typeof data === 'object') return JSON.stringify(data)
    return String(data)
  }

  // Debug logs before render
  console.log('📊 RENDER CHECK - loading:', loading)
  console.log('📊 RENDER CHECK - questions:', questions)
  console.log('📊 RENDER CHECK - questions.length:', questions?.length)
  console.log('📊 RENDER CHECK - currentIndex:', currentIndex)
  console.log('📊 RENDER CHECK - currentQuestion:', questions?.[currentIndex])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Questions Found</h2>
          <p className="text-gray-600 mb-4">This interview session doesn't have any questions.</p>
          <button
            onClick={() => navigate('/dashboard/interview')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Back to Interview
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const currentAnswer = answers[currentQuestion?.id]

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Question Not Found</h2>
          <p className="text-gray-600 mb-4">Unable to load the current question.</p>
          <button
            onClick={() => setCurrentIndex(0)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Go to First Question
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
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
            <div className="flex items-center mb-2 flex-wrap gap-2">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                {currentQuestion?.question_type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
              </span>
              {(currentQuestion?.skill || currentQuestion?.category) && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                  {currentQuestion?.skill || currentQuestion?.category || 'General'}
                </span>
              )}
            </div>
            <p className="text-lg text-gray-900 mb-4 whitespace-pre-wrap">
              {currentQuestion?.question_text}
            </p>

            {/* MCQ Options */}
            {currentQuestion?.question_type === 'mcq' && currentQuestion?.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => {
                  const evaluation = evaluations[currentQuestion.id]
                  const isSelected = currentAnswer?.selected_option === idx
                  const isSubmitted = !!currentQuestion?.submitted_answer || !!evaluation
                  const isCorrect = evaluation?.is_correct
                  
                  // Determine border color based on state
                  let borderColor = 'border-gray-200'
                  let bgColor = ''
                  
                  if (isSubmitted && isSelected) {
                    if (isCorrect) {
                      borderColor = 'border-green-500'
                      bgColor = 'bg-green-50'
                    } else {
                      borderColor = 'border-red-500'
                      bgColor = 'bg-red-50'
                    }
                  } else if (!isSubmitted && isSelected) {
                    borderColor = 'border-indigo-600'
                    bgColor = 'bg-indigo-50'
                  }

                  return (
                    <label
                      key={idx}
                      className={`flex items-center p-4 border-2 rounded-lg transition-all ${borderColor} ${bgColor} ${
                        isSubmitted ? 'cursor-default opacity-90' : 'cursor-pointer hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={idx}
                        checked={isSelected}
                        onChange={() => !isSubmitted && submitAnswerInstantly(currentQuestion.id, idx, true)}
                        disabled={isSubmitted}
                        className="w-5 h-5 text-indigo-600"
                      />
                      <span className="ml-3 text-gray-900">{option}</span>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Evaluation Feedback */}
            {evaluations[currentQuestion?.id] && (
              <div className={`mt-4 p-4 rounded-lg border-2 ${
                evaluations[currentQuestion.id].is_correct 
                  ? 'bg-green-50 border-green-500' 
                  : 'bg-red-50 border-red-500'
              }`}>
                <div className="flex items-start gap-2 mb-2">
                  {evaluations[currentQuestion.id].is_correct ? (
                    <div className="flex items-center text-green-700">
                      <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold">That's right!</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-700">
                      <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold">Not quite</span>
                    </div>
                  )}
                </div>
                
                {evaluations[currentQuestion.id].ai_evaluation && (
                  <div className={`text-sm ${
                    evaluations[currentQuestion.id].is_correct ? 'text-green-800' : 'text-red-800'
                  }`}>
                    <p className="whitespace-pre-wrap">{renderEvaluationText(evaluations[currentQuestion.id].ai_evaluation)}</p>
                  </div>
                )}

                {evaluations[currentQuestion.id].strengths && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Strengths:</p>
                    <p className="text-sm text-gray-700">{renderEvaluationText(evaluations[currentQuestion.id].strengths)}</p>
                  </div>
                )}

                {evaluations[currentQuestion.id].improvement_suggestions && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">How to improve:</p>
                    <p className="text-sm text-gray-700">{renderEvaluationText(evaluations[currentQuestion.id].improvement_suggestions)}</p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs text-gray-600">
                    Score: <span className="font-bold">{evaluations[currentQuestion.id].score?.toFixed(1) || 0}/{evaluations[currentQuestion.id].max_score || 10}</span>
                  </p>
                </div>
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
                  disabled={!!currentQuestion?.submitted_answer || !!evaluations[currentQuestion?.id]}
                />
                <p className="text-sm text-gray-500 mt-2">
                  Tip: Be concise and focus on key points
                </p>
                
                {!currentQuestion?.submitted_answer && !evaluations[currentQuestion?.id] && (
                  <LoadingButton
                    onClick={() => submitAnswerInstantly(currentQuestion.id, currentAnswer?.answer_text || '', false)}
                    loading={submitting}
                    disabled={!currentAnswer?.answer_text?.trim() || submitting}
                    className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Submit Answer
                  </LoadingButton>
                )}

                {/* Evaluation Feedback for Short Answer */}
                {evaluations[currentQuestion?.id] && (
                  <div className={`mt-4 p-4 rounded-lg border-2 ${
                    (evaluations[currentQuestion.id].score / evaluations[currentQuestion.id].max_score) >= 0.7
                      ? 'bg-green-50 border-green-500' 
                      : (evaluations[currentQuestion.id].score / evaluations[currentQuestion.id].max_score) >= 0.4
                      ? 'bg-yellow-50 border-yellow-500'
                      : 'bg-red-50 border-red-500'
                  }`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`flex items-center ${
                        (evaluations[currentQuestion.id].score / evaluations[currentQuestion.id].max_score) >= 0.7
                          ? 'text-green-700'
                          : (evaluations[currentQuestion.id].score / evaluations[currentQuestion.id].max_score) >= 0.4
                          ? 'text-yellow-700'
                          : 'text-red-700'
                      }`}>
                        <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">Submitted</span>
                      </div>
                    </div>
                    
                    {evaluations[currentQuestion.id].ai_evaluation && (
                      <div className="text-sm text-gray-800 mb-3">
                        <p className="whitespace-pre-wrap">{renderEvaluationText(evaluations[currentQuestion.id].ai_evaluation)}</p>
                      </div>
                    )}

                    {evaluations[currentQuestion.id].strengths && (
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        <p className="text-xs font-semibold text-green-700 mb-1">✓ Strengths:</p>
                        <p className="text-sm text-gray-700">{renderEvaluationText(evaluations[currentQuestion.id].strengths)}</p>
                      </div>
                    )}

                    {evaluations[currentQuestion.id].weaknesses && (
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        <p className="text-xs font-semibold text-red-700 mb-1">✗ Areas to improve:</p>
                        <p className="text-sm text-gray-700">{renderEvaluationText(evaluations[currentQuestion.id].weaknesses)}</p>
                      </div>
                    )}

                    {evaluations[currentQuestion.id].improvement_suggestions && (
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        <p className="text-xs font-semibold text-blue-700 mb-1">💡 Suggestions:</p>
                        <p className="text-sm text-gray-700">{renderEvaluationText(evaluations[currentQuestion.id].improvement_suggestions)}</p>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-xs text-gray-600">
                        Score: <span className="font-bold">{evaluations[currentQuestion.id].score?.toFixed(1) || 0}/{evaluations[currentQuestion.id].max_score || 10}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            Next
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
        ) : (
          <LoadingButton
            onClick={handleComplete}
            loading={completing}
            disabled={completing}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Complete Interview
          </LoadingButton>
        )}
      </div>

      {/* Warning Message */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
        <AlertCircle className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Interview Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>For MCQs: Click an option to submit instantly and see explanation</li>
            <li>For short answers: Click "Submit Answer" to get AI feedback</li>
            <li>You can navigate between questions freely to review</li>
            <li>The session will auto-submit when time runs out</li>
            <li>Click "Complete Interview" when you're done to see your final results</li>
          </ul>
        </div>
      </div>
    </div>
    </div>
  )
}

export default InterviewSessionPage
