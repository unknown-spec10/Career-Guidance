import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../config/api'
import LoadingButton from '../components/LoadingButton'
import CreditWidget from '../components/CreditWidget'
import { Clock, Brain, CheckCircle, XCircle, TrendingUp, Zap, AlertCircle } from 'lucide-react'

const InterviewPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [credits, setCredits] = useState(null)
  const [eligibility, setEligibility] = useState(null)

  // Session configuration
  const [sessionType, setSessionType] = useState('technical')
  const [difficulty, setDifficulty] = useState('medium')
  const [focusSkills, setFocusSkills] = useState('')
  const [sessionMode, setSessionMode] = useState('full') // 'full' or 'micro'

  // URL Params for pre-selection
  const [searchParams] = useSearchParams()
  const modeParam = searchParams.get('mode')

  useEffect(() => {
    if (modeParam === 'micro') {
      setSessionMode('micro')
      // Optional: Auto-scroll to start section
      const startSection = document.getElementById('start-interview-section')
      if (startSection) {
        startSection.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [modeParam])

  useEffect(() => {
    fetchHistory()
    fetchCredits()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await api.get('/api/interviews/history')
      setHistory(response.data)
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const fetchCredits = async () => {
    try {
      const response = await api.get('/api/credits/balance')
      setCredits(response.data)
    } catch (error) {
      console.error('Error fetching credits:', error)
    }
  }

  const startInterview = async () => {
    setLoading(true)
    try {
      const skills = focusSkills ? focusSkills.split(',').map(s => s.trim()).filter(s => s) : null

      const response = await api.post('/api/interviews/start', {
        session_type: sessionType,
        difficulty_level: difficulty,
        focus_skills: skills,
        session_mode: sessionMode
      })

      // Refresh credits after starting
      fetchCredits()

      // Navigate to interview session page
      navigate(`/dashboard/interview/${response.data.id}`)
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to start interview'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  // Check eligibility when mode changes
  useEffect(() => {
    if (credits) {
      const cost = sessionMode === 'full' ? credits.costs.full_interview : credits.costs.micro_session
      const canProceed = credits.current_credits >= cost

      let message = ''
      if (!canProceed) {
        message = `Insufficient credits. You need ${cost} credits but have ${credits.current_credits}.`
      } else if (sessionMode === 'full' && history?.latest_score < 40) {
        message = 'Your last interview score was below 40%. Consider micro-practice first to build confidence.'
      }

      setEligibility({ canProceed, message })
    }
  }, [sessionMode, credits, history])

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-blue-100'
    if (score >= 40) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Mock Interview & Assessment</h1>
        <p className="text-gray-600">Practice with AI-powered interviews to improve your skills and boost recommendations</p>
      </div>

      {/* Credit Widget */}
      <div className="mb-8">
        <CreditWidget />
      </div>

      {/* History Summary Card */}
      {history && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 mb-8 text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm opacity-90">Total Sessions</div>
              <div className="text-3xl font-bold">{history.total_sessions}</div>
            </div>
            <div>
              <div className="text-sm opacity-90">Latest Score</div>
              <div className="text-3xl font-bold">
                {history.latest_score ? `${history.latest_score.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-90">Average Score</div>
              <div className="text-3xl font-bold">
                {history.average_score ? `${history.average_score.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-90">Today's Sessions</div>
              <div className="text-3xl font-bold">{history.sessions_today}/2</div>
            </div>
          </div>

          {history.needs_retake && (
            <div className="mt-4 bg-white bg-opacity-20 rounded p-3">
              <p className="text-sm">⚠️ Your last interview was over 6 months ago. Consider taking a new test to refresh your scores!</p>
            </div>
          )}
        </div>
      )}

      {/* Start New Interview */}
      <div id="start-interview-section" className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
          <Brain className="mr-2 text-indigo-600" />
          Start New Interview
        </h2>

        {eligibility && !eligibility.canProceed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-semibold">Cannot start session</p>
              <p className="text-red-700 text-sm">{eligibility.message}</p>
            </div>
          </div>
        )}

        {eligibility && eligibility.canProceed && eligibility.message && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-800 font-semibold">Recommendation</p>
              <p className="text-yellow-700 text-sm">{eligibility.message}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Session Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSessionMode('full')}
                className={`p-4 rounded-lg border-2 transition-all ${sessionMode === 'full'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">Full Interview</span>
                  <div className="flex items-center text-indigo-600">
                    <Zap className="w-4 h-4 mr-1" />
                    <span className="text-sm font-bold">{credits?.costs.full_interview || 10}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 text-left">~30 minutes • 7 MCQ + 3 Short Answer</p>
              </button>
              <button
                onClick={() => setSessionMode('micro')}
                className={`p-4 rounded-lg border-2 transition-all ${sessionMode === 'micro'
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">Micro Practice</span>
                  <div className="flex items-center text-green-600">
                    <Zap className="w-4 h-4 mr-1" />
                    <span className="text-sm font-bold">{credits?.costs.micro_session || 1}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 text-left">~5 minutes • 1 Quick Question</p>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interview Type
            </label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={!history?.can_start_new}
            >
              <option value="technical">Technical Interview</option>
              <option value="hr">HR Interview</option>
              <option value="behavioral">Behavioral Interview</option>
              <option value="mixed">Mixed Interview</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={!history?.can_start_new}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            {history?.average_score > 70 && (
              <p className="mt-1 text-sm text-gray-500">
                💡 Based on your performance, we recommend trying a harder level!
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Focus Skills (Optional)
            </label>
            <input
              type="text"
              value={focusSkills}
              onChange={(e) => setFocusSkills(e.target.value)}
              placeholder="e.g., Python, DSA, DBMS (comma-separated)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              disabled={!history?.can_start_new}
            />
            <p className="mt-1 text-sm text-gray-500">
              Leave empty to generate questions based on your resume skills
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center text-blue-800">
              <Clock className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Session Details:</span>
            </div>
            {sessionMode === 'full' ? (
              <ul className="text-sm text-blue-700 space-y-1 ml-7">
                <li>• Duration: ~30 minutes</li>
                <li>• Questions: 7 MCQ + 3 Short Answer</li>
                <li>• Instant AI feedback on each answer</li>
                <li>• Comprehensive performance report</li>
                <li>• Personalized learning path generated</li>
              </ul>
            ) : (
              <ul className="text-sm text-blue-700 space-y-1 ml-7">
                <li>• Duration: ~5 minutes</li>
                <li>• Questions: 1 quick question</li>
                <li>• Instant AI feedback</li>
                <li>• Perfect for daily practice</li>
                <li>• Build confidence incrementally</li>
              </ul>
            )}
          </div>

          <LoadingButton
            onClick={startInterview}
            loading={loading}
            disabled={!eligibility?.canProceed}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <span>Start {sessionMode === 'full' ? 'Full Interview' : 'Micro Practice'}</span>
            <div className="flex items-center">
              <Zap className="w-4 h-4 ml-2" />
              <span className="text-sm">
                {sessionMode === 'full' ? credits?.costs.full_interview || 10 : credits?.costs.micro_session || 1}
              </span>
            </div>
          </LoadingButton>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="mr-2 text-indigo-600" />
          Recent Sessions
        </h2>

        {loadingHistory ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : history?.sessions?.length > 0 ? (
          <div className="space-y-4">
            {history.sessions.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/dashboard/interview/results/${session.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full">
                        {session.session_type}
                      </span>
                      <span className="ml-2 px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                        {session.difficulty_level}
                      </span>
                      {session.status === 'completed' ? (
                        <CheckCircle className="ml-2 w-5 h-5 text-green-600" />
                      ) : (
                        <Clock className="ml-2 w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(session.started_at).toLocaleDateString()} at {new Date(session.started_at).toLocaleTimeString()}
                    </div>
                  </div>
                  {session.overall_score !== null && (
                    <div className={`text-right ${getScoreBg(session.overall_score)} px-4 py-2 rounded-lg`}>
                      <div className={`text-2xl font-bold ${getScoreColor(session.overall_score)}`}>
                        {session.overall_score.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Overall Score</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No interview sessions yet. Start your first interview above!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default InterviewPage
