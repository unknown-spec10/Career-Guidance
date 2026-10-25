import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Cpu, Users, Heart, Shuffle, Zap, Target, BarChart2,
  Clock, ArrowRight, RefreshCw, ChevronLeft, Award, Play, Mic,
  Smile, ShieldAlert, AlertTriangle
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import Spinner from '../components/Spinner'
import useInterviewSession from '../hooks/useInterviewSession'

const INTERVIEW_TYPES = [
  { id: 'technical', label: 'Technical Round', icon: Cpu, desc: 'Algorithms, system design, coding syntax' },
  { id: 'hr', label: 'HR Behavioral', icon: Users, desc: 'STAR stories, company fit, leadership scenarios' },
  { id: 'behavioral', label: 'Soft Skills Fit', icon: Heart, desc: 'Conflict resolution, team building, situational judgement' },
  { id: 'mixed', label: 'Mixed Mode Prep', icon: Shuffle, desc: 'A blended custom panel of all styles' },
]

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', color: 'text-success bg-success/10 border-success/20', desc: 'Foundational concepts' },
  { id: 'medium', label: 'Medium', color: 'text-warning bg-warning/10 border-warning/20', desc: 'Applied knowledge' },
  { id: 'hard', label: 'Hard', color: 'text-error bg-error/10 border-error/20', desc: 'Scalability & edge cases' },
]

const PERSONAS = [
  { id: 'Friendly Senior Engineer', label: 'Friendly Senior Engineer', icon: Smile, desc: 'Warm, collaborative, offers helpful hints when you get stuck.', badge: 'Warm Hinting' },
  { id: 'Tough FAANG Interviewer', label: 'Tough FAANG Interviewer', icon: ShieldAlert, desc: 'Strict, minimal feedback, optimal performance focus. Hints are disabled for this persona.', badge: 'Strict Strict' },
  { id: 'Startup CTO', label: 'Startup CTO', icon: Cpu, desc: 'Pragmatic, values quick shipping, trade-offs, and shipping MVPs.', badge: 'Pragmatic MVP' }
]

const QUESTION_COUNTS = [5, 10, 15]

export default function InterviewPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { startSession } = useInterviewSession()

  const [config, setConfig] = useState({
    interview_type: 'technical',
    difficulty: 'medium',
    num_questions: 10,
    topic_focus: '',
    voice_mode: false,
    interviewer_persona: 'Friendly Senior Engineer',
  })
  const [isStarting, setIsStarting] = useState(false)
  const [resumeStatus, setResumeStatus] = useState(null) // null | 'parsed' | 'missing'
  const [profileError, setProfileError] = useState(false)
  const [activeSession, setActiveSession] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [profileRes, sessionRes, historyRes] = await Promise.allSettled([
          api.get('/api/student/profile'),
          api.get('/api/interview/active-session'),
          api.get('/api/interview/history'),
        ])
        if (profileRes.status === 'fulfilled') {
          const skills = profileRes.value.data?.skills || []
          setResumeStatus(skills.length > 0 ? 'parsed' : 'missing')
          setProfileError(false)
        } else {
          // A failed profile fetch is not the same as "no resume" — leave
          // status unknown so Start isn't hard-blocked by a network blip.
          setProfileError(true)
        }
        if (sessionRes.status === 'fulfilled' && sessionRes.value.data?.has_active_session) {
          setActiveSession(sessionRes.value.data)
        }
        if (historyRes.status === 'fulfilled') {
          setHistory(historyRes.value.data || [])
        }
      } catch (err) {
        console.error('Failed to load prep configs:', err)
        setProfileError(true)
      } finally {
        setHistoryLoading(false)
      }
    }
    checkStatus()
  }, [])

  const handleRetryProfile = async () => {
    setProfileError(false)
    try {
      const res = await api.get('/api/student/profile')
      const skills = res.data?.skills || []
      setResumeStatus(skills.length > 0 ? 'parsed' : 'missing')
    } catch (err) {
      console.error('Failed to load profile:', err)
      setProfileError(true)
    }
  }

  const handleStart = async () => {
    if (resumeStatus === 'missing') {
      toast.error('Please upload your resume in the dashboard first.')
      return
    }
    setIsStarting(true)
    const result = await startSession({
      ...config,
      topic_focus: config.topic_focus.trim() || null,
    })
    setIsStarting(false)
    if (result.success) {
      navigate(`/dashboard/interview/${result.sessionId}`)
    } else {
      toast.error(result.error || 'Failed to start interview.')
    }
  }

  const handleResumeSession = () => {
    navigate(`/dashboard/interview/${activeSession.session_id}`)
  }

  const handleRetake = (session) => {
    setConfig({
      interview_type: session.interview_type,
      difficulty: session.difficulty,
      num_questions: session.num_questions,
      topic_focus: session.topic_focus || '',
      voice_mode: false,
      interviewer_persona: session.interviewer_persona || 'Friendly Senior Engineer',
    })
    toast.success(`Config loaded: ${session.interview_type}`)
  }

  return (
    <div className="relative">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      
      {/* Welcome Header */}
      <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md relative z-10">
        <div>
          <h1 className="app-page-title">
            AI Interview Coach
          </h1>
          <p className="app-page-subtitle">
            Set up real-time voice or text sessions aligned with your resume experience.
          </p>
        </div>
      </div>

      {/* Warning when resume status could not be verified (network error) */}
      {profileError && resumeStatus !== 'missing' && (
        <div className="mb-lg p-md rounded-card bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <h4>Couldn&apos;t verify resume status</h4>
            <p className="text-ink-muted font-normal mt-0.5">
              A network error stopped us checking your resume. You can still try starting — the server will confirm.
            </p>
          </div>
          <button onClick={handleRetryProfile} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-card text-xs font-bold transition-colors cursor-pointer flex-shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Warning if resume missing */}
      {resumeStatus === 'missing' && (
        <div className="mb-lg p-md rounded-card bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <div>
            <h4>Resume Profile Required</h4>
            <p className="text-ink-muted font-normal mt-0.5">
              Please go to the <Link to="/student/dashboard" className="underline text-rose-900">Dashboard</Link> and upload a resume before starting mock sessions so the coach can tailor questions to your skills.
            </p>
          </div>
        </div>
      )}

      {/* Active Session Callout */}
      {activeSession && (
        <div className="mb-lg bg-primary-500/10 border border-primary-500/20 p-md rounded-card flex flex-col sm:flex-row justify-between items-center gap-md">
          <div>
            <h4 className="font-body text-caption font-bold text-primary">Active session in progress</h4>
            <p className="text-xs text-ink-muted mt-0.5">You have a pending mock session created recently.</p>
          </div>
          <button 
            onClick={handleResumeSession}
            className="app-btn-primary app-btn-sm"
          >
            Resume Session
          </button>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        
        {/* Settings Columns (8/12 width) */}
        <div className="lg:col-span-8 flex flex-col gap-lg">
          
          {/* Card 1: Setup configurations */}
          <div className="surface-card p-lg">
            <h2 className="app-section-title mb-lg flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              Configure Mock Session
            </h2>

            <div className="space-y-lg">
              
              {/* Type Selection */}
              <div>
                <label className="app-label block mb-sm">Interview Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  {INTERVIEW_TYPES.map(type => {
                    const active = config.interview_type === type.id
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setConfig(prev => ({ ...prev, interview_type: type.id }))}
                        className={`p-md rounded-card text-left border transition-all cursor-pointer flex gap-3 ${
                          active
                            ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary text-primary font-body font-bold'
 : 'border-hairline hover:bg-surface-sunken text-ink-muted'
                        }`}
                      >
                        <div className={`p-2 rounded-card ${active ? 'bg-primary-500/10 text-primary' : 'bg-surface-sunken text-ink-subtle'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold">{type.label}</h4>
                          <p className="text-[11px] text-ink-subtle mt-0.5 leading-tight font-normal">{type.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Persona Selection */}
              <div>
                <label className="app-label block mb-sm">Coach Persona</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
                  {PERSONAS.map(p => {
                    const active = config.interviewer_persona === p.id
                    const Icon = p.icon
                    return (
                      <button
                        key={p.id}
                        onClick={() => setConfig(prev => ({ ...prev, interviewer_persona: p.id }))}
                        className={`p-md rounded-card text-left border transition-all cursor-pointer ${
                          active
                            ? 'bg-primary-500/5 dark:bg-primary-500/10 border-primary text-primary font-body font-bold'
 : 'border-hairline hover:bg-surface-sunken text-ink-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-ink-subtle'}`} />
                          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-pill bg-surface-sunken text-ink-muted">{p.badge}</span>
                        </div>
                        <h4 className="text-[12px] font-bold">{p.label}</h4>
                        <p className="text-[10px] text-ink-subtle mt-1 font-normal leading-normal">{p.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="app-label block mb-sm">Complexity Level</label>
                <div className="grid grid-cols-3 gap-sm">
                  {DIFFICULTIES.map(diff => {
                    const active = config.difficulty === diff.id
                    return (
                      <button
                        key={diff.id}
                        onClick={() => setConfig(prev => ({ ...prev, difficulty: diff.id }))}
                        className={`p-sm rounded-card text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
                          active
                            ? diff.color + ' font-body font-bold shadow-soft-xs'
 : 'border-hairline hover:bg-surface-sunken text-ink-muted'
                        }`}
                      >
                        <span className="text-[13px] font-bold">{diff.label}</span>
                        <span className="text-[9px] text-ink-subtle mt-0.5 font-normal">{diff.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Details & Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md pt-md border-t border-hairline">
                
                {/* Topic Focus */}
                <div>
                  <label className="app-label block mb-xs">Sub-topic Focus (Optional)</label>
                  <input
                    type="text"
                    name="topic_focus"
                    placeholder="e.g. system design, async loops, STAR behavioral"
                    value={config.topic_focus}
                    onChange={(e) => setConfig(prev => ({ ...prev, topic_focus: e.target.value }))}
                    className="app-input"
                  />
                </div>

                {/* Question Count Selection */}
                <div>
                  <label className="app-label block mb-xs">Question Count</label>
                  <div className="flex bg-surface-sunken rounded-card p-0.5 border border-hairline">
                    {QUESTION_COUNTS.map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, num_questions: cnt }))}
                        className={`flex-1 py-1.5 rounded-card text-xs font-bold transition-all cursor-pointer text-center ${
                          config.num_questions === cnt
                            ? 'bg-surface-raised text-primary border border-hairline shadow-soft-xs'
                            : 'text-ink-subtle hover:text-ink'
                        }`}
                      >
                        {cnt} Qs
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Voice Mode Toggle */}
              <div className="pt-md flex items-center justify-between border-t border-hairline">
                <div>
                  <h4 className="text-[13px] font-bold text-ink">Voice Interactive Mode</h4>
                  <p className="text-[11px] text-ink-subtle leading-tight mt-0.5 font-normal">Hear questions read aloud and answer by voice. Needs a microphone, Chrome or Edge, and HTTPS — live captions only where the browser supports speech recognition.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, voice_mode: !prev.voice_mode }))}
                  className={`w-12 h-7 rounded-pill p-0.5 transition-colors cursor-pointer relative ${config.voice_mode ? 'bg-primary' : 'bg-surface-sunken'}`}
                >
                  <div className={`w-6 h-6 rounded-pill bg-surface-raised shadow-soft-xs transition-transform ${config.voice_mode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Info & History Pane (4/12 width) — sticky rail on lg+ so it stays
            visible while the settings column scrolls; static below lg where
            the layout collapses to one column. */}
        <div className="lg:col-span-4 flex flex-col gap-lg lg:sticky lg:top-6 self-start">
          
          {/* Action Trigger Card */}
          <div className="surface-card p-md text-center">
            <div className="w-12 h-12 rounded-pill bg-primary-500/5 text-primary border border-primary-500/10 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-body text-caption font-bold text-ink">Ready to start?</h3>
            <p className="text-[11px] text-ink-subtle leading-normal my-sm">
              Estimated duration: {config.num_questions * 3} minutes.
            </p>
            <button
              onClick={handleStart}
              disabled={isStarting || resumeStatus === 'missing'}
              aria-busy={isStarting}
              className="app-btn-primary app-btn-sm inline-flex w-full items-center justify-center gap-2"
            >
              {isStarting ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4 shrink-0 fill-current" />}
              <span>Launch AI Practice</span>
            </button>
          </div>

          {/* History Tracker */}
          <div className="surface-card p-md flex-1">
            <h3 className="font-body text-caption font-bold text-ink mb-md">Practice History</h3>
            
            {historyLoading ? (
              <div className="text-center py-6 text-xs text-ink-muted">Loading records...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-6 text-xs text-ink-muted">No sessions completed yet. Launch your first round!</div>
            ) : (
              <div className="space-y-sm">
                {history.slice(0, 4).map((session, index) => {
                  // Backend stores overall_score 0.0–1.0; normalize to 0–100 for display.
                  const rawScore = session.overall_score ?? session.score
                  const pct = rawScore !== null && rawScore !== undefined
                    ? Math.round(rawScore <= 1 ? rawScore * 100 : rawScore)
                    : null
                  const isGood = pct !== null && pct >= 75
                  
                  return (
                    <div 
                      key={session.session_id || index}
                      className="p-sm bg-surface-sunken border border-hairline rounded-card flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-body text-[12px] font-bold text-ink capitalize truncate max-w-[120px]">{session.interview_type} Round</h4>
                        <p className="text-[10px] text-ink-subtle capitalize mt-0.5">
                          {session.difficulty} • {session.num_questions} Qs
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {pct !== null && (
                          <div className="text-right mr-1">
                            <span className={`font-body text-sm font-bold ${isGood ? 'text-success' : 'text-warning'}`}>{pct}%</span>
                            <span className="block text-[8px] text-ink-subtle uppercase tracking-wider font-semibold">Score</span>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            if (session.status?.toLowerCase() === 'completed') {
                              navigate(`/dashboard/interview/results/${session.session_id}`)
                            } else {
                              handleRetake(session)
                            }
                          }}
 className="p-1 rounded-pill hover:bg-surface-sunken text-ink-subtle hover:text-primary transition-colors cursor-pointer"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
