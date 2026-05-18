import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../config/api'
import LoadingButton from '../components/LoadingButton'
import InterviewKpiStrip from '../components/interview/InterviewKpiStrip'
import InterviewTipsPanel from '../components/interview/InterviewTipsPanel'
import { ArrowRight, Clock, CheckCircle, TrendingUp, Zap, AlertCircle, Camera, BellOff, FileText } from 'lucide-react'

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
    }
  }, [modeParam])

  useEffect(() => {
    fetchHistory()
    fetchCredits()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await api.get('/api/interviews/live/history')
      setHistory(response.data)
    } catch (error) {
      console.error('Error fetching history:', error)
      // Keep UI usable even if history endpoint is temporarily unavailable.
      setHistory({
        sessions: [],
        total_sessions: 0,
        completed_sessions: 0,
        average_duration_seconds: 0,
        average_score: 0,
        latest_score: 0,
        sessions_today: 0,
        can_start_new: true,
      })
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
      // Set safe fallback with backend-like structure so UI stays functional
      setCredits({
        current_credits: 0,
        weekly_limit: 60,
        is_premium: false,
        next_refill_days: 0,
        next_refill_hours: 0,
        next_refill_at: new Date().toISOString(),
        usage_today: {},
        usage_this_week: {},
        limits: {},
        costs: {
          micro_session: 1,
          full_interview: 10
        }
      })
    }
  }

  const getSessionCost = (mode) => {
    // Always get from backend data, or fallback to default if credits not yet loaded
    if (mode === 'micro') {
      return credits?.costs?.micro_session ?? 1
    }
    return credits?.costs?.full_interview ?? 10
  }

  const canStartInMode = (mode) => {
    // Allow optimistic interaction while credits are still loading.
    if (!credits) return true
    return credits.current_credits >= getSessionCost(mode)
  }

  const backendBlocksNewSession = history?.can_start_new === false

  const startInterview = async (overrides = {}) => {
    setLoading(true)
    try {
      const response = await api.post('/api/interviews/live/start', {
        session_type: overrides.sessionType ?? sessionType,
        difficulty_level: overrides.difficulty ?? difficulty,
        session_mode: overrides.sessionMode ?? sessionMode,
      })

      // Refresh credits after starting
      fetchCredits()

      // Navigate to interview session page
      navigate(`/dashboard/interview/live/${response.data.id}`)
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to start interview'
      alert(message)
    } finally {
      setLoading(false)
    }
  }



  const dynamicTips = React.useMemo(() => {
    const readiness = Math.round(history?.latest_score ?? history?.average_score ?? 0)
    const creditsAvailable = credits?.current_credits ?? 0
    const sessionsToday = history?.sessions_today ?? 0

    return [
      {
        title: readiness < 50 ? 'Warm up with micro mode' : 'Push for full simulation',
        description: readiness < 50
          ? `Current readiness is ${readiness}%. Use a few short rounds before a full interview.`
          : `Current readiness is ${readiness}%. You are ready for a full interview simulation.`,
        icon: Camera
      },
      {
        title: creditsAvailable <= 2 ? 'Watch credit usage' : 'Credits are healthy',
        description: creditsAvailable <= 2
          ? `Only ${creditsAvailable} credits remaining. Prioritize micro sessions until refill.`
          : `${creditsAvailable} credits available. You can take full practice sessions today.`,
        icon: BellOff
      },
      {
        title: 'Daily consistency',
        description: sessionsToday === 0
          ? 'No sessions logged today yet. Start one quick run to keep momentum.'
          : `${sessionsToday} session${sessionsToday > 1 ? 's' : ''} completed today. Keep your streak active.`,
        icon: FileText
      }
    ]
  }, [history, credits])

  // Check eligibility when mode changes
  useEffect(() => {
    if (credits) {
      const cost = getSessionCost(sessionMode)
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

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-8 pt-24 lg:px-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                  Interview Readiness: {Math.round(history?.latest_score ?? history?.average_score ?? 0)}%
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">Interview Preparation</h1>
                <p className="mt-2 max-w-2xl text-gray-600">
                  Start real-time AI interview conversations powered by live audio streaming.
                </p>
              </div>

              <LoadingButton
                onClick={() => startInterview({ sessionMode: 'micro' })}
                loading={loading}
                disabled={!canStartInMode('micro') || backendBlocksNewSession}
                icon={ArrowRight}
                className="h-11 w-full md:w-auto md:min-w-52"
              >
                Start Quick Practice
              </LoadingButton>
            </div>
          </section>

          <InterviewKpiStrip history={history} sessionMode={sessionMode} credits={credits} />

          <section id="start-interview-section" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">Interview Configuration</h2>

            {eligibility && !eligibility.canProceed && (
              <div className="mt-4 flex items-start space-x-2 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">Cannot start session</p>
                  <p className="text-sm text-red-700">{eligibility.message}</p>
                </div>
              </div>
            )}

            {eligibility && eligibility.canProceed && eligibility.message && (
              <div className="mt-4 flex items-start space-x-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-800">Recommendation</p>
                  <p className="text-sm text-yellow-700">{eligibility.message}</p>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Session Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSessionMode('full')}
                    className={`flex h-24 flex-col justify-center rounded-lg border-2 p-4 text-left transition-all ${
                      sessionMode === 'full' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold leading-none text-gray-900">Full Interview</p>
                    <p className="mt-1 text-xs text-gray-600">~30 minutes live conversation</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionMode('micro')}
                    className={`flex h-24 flex-col justify-center rounded-lg border-2 p-4 text-left transition-all ${
                      sessionMode === 'micro' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold leading-none text-gray-900">Micro Practice</p>
                    <p className="mt-1 text-xs text-gray-600">~5 minutes live warmup</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Interview Type</label>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  disabled={backendBlocksNewSession}
                >
                  <option value="technical">Technical Interview</option>
                  <option value="hr">HR Interview</option>
                  <option value="behavioral">Behavioral Interview</option>
                  <option value="mixed">Mixed Interview</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Difficulty Level</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  disabled={backendBlocksNewSession}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Focus Skills (Optional)</label>
                <input
                  type="text"
                  value={focusSkills}
                  onChange={(e) => setFocusSkills(e.target.value)}
                  placeholder="Resume-based auto prompts are generated in-session"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  disabled={backendBlocksNewSession}
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p className="flex items-center font-medium">
                <Clock className="mr-2 h-4 w-4" />
                Session details for {sessionMode === 'full' ? 'full interview' : 'micro practice'}
              </p>
              <p className="mt-1 text-blue-700">
                {sessionMode === 'full'
                  ? 'Includes a complete live interview conversation with transcript capture and session analytics.'
                  : 'Includes a short live conversation to build daily speaking consistency.'}
              </p>
            </div>

            <LoadingButton
              onClick={() => startInterview()}
              loading={loading}
              disabled={eligibility?.canProceed === false || backendBlocksNewSession}
              icon={Zap}
              className="mt-5 h-11 w-full"
            >
              Start {sessionMode === 'full' ? 'Full Interview' : 'Micro Practice'} ({getSessionCost(sessionMode)} credits)
            </LoadingButton>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-2xl font-semibold text-gray-900">
              <TrendingUp className="mr-2 h-6 w-6 text-primary-500" />
              Recent Sessions
            </h2>

            {loadingHistory ? (
              <div className="py-8 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary-500"></div>
              </div>
            ) : history?.sessions?.length > 0 ? (
              <div className="space-y-4">
                {history.sessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
                    onClick={() => navigate(`/dashboard/interview/live/${session.id}`)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center">
                          <span className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700">{session.session_type}</span>
                          <span className="ml-2 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{session.difficulty_level}</span>
                          {session.status === 'completed' ? (
                            <CheckCircle className="ml-2 h-5 w-5 text-green-600" />
                          ) : (
                            <Clock className="ml-2 h-5 w-5 text-yellow-600" />
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(session.started_at).toLocaleDateString()} at {new Date(session.started_at).toLocaleTimeString()}
                        </div>
                      </div>

                      {session.duration_seconds !== null && (
                        <div className="rounded-lg bg-gray-100 px-4 py-2 text-right">
                          <div className="text-2xl font-bold text-gray-800">
                            {Math.round((session.duration_seconds || 0) / 60)}m
                          </div>
                          <div className="text-xs text-gray-600">Duration</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <p>No interview sessions yet. Start your first interview above.</p>
              </div>
            )}
          </section>

          <footer className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-500">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-primary-600">Career Guide</p>
              <p className="text-xs text-gray-500">Use interview controls above to start, answer, and complete sessions.</p>
            </div>
          </footer>
        </main>

        <InterviewTipsPanel
          onStartQuickPractice={() => startInterview({ sessionMode: 'micro' })}
          loading={loading || !canStartInMode('micro') || backendBlocksNewSession}
          tipsData={dynamicTips}
        />
      </div>
    </div>
  )
}

export default InterviewPage
