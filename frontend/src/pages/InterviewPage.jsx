import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, Users, Heart, Shuffle, Zap, Target, BarChart2,
  Clock, ArrowRight, RefreshCw, ChevronLeft, Award, Play, Mic,
  Smile, ShieldAlert, AlertTriangle
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
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
  { id: 'Tough FAANG Interviewer', label: 'Tough FAANG Interviewer', icon: ShieldAlert, desc: 'Strict, minimal feedback, optimal performance focus. No hints.', badge: 'Strict Strict' },
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
        }
        if (sessionRes.status === 'fulfilled' && sessionRes.value.data?.has_active_session) {
          setActiveSession(sessionRes.value.data)
        }
        if (historyRes.status === 'fulfilled') {
          setHistory(historyRes.value.data || [])
        }
      } catch (err) {
        console.error('Failed to load prep configs:', err)
        setResumeStatus('missing')
      } finally {
        setHistoryLoading(false)
      }
    }
    checkStatus()
  }, [])

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
          <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface mb-xs font-bold leading-tight">
            AI Interview Coach
          </h1>
          <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">
            Set up real-time voice or text sessions aligned with your resume experience.
          </p>
        </div>
      </div>

      {/* Warning if resume missing */}
      {resumeStatus === 'missing' && (
        <div className="mb-lg p-md bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <div>
            <h4>Resume Profile Required</h4>
            <p className="text-slate-500 font-normal mt-0.5">
              Please go to the <Link to="/student/dashboard" className="underline text-rose-900">Dashboard</Link> and upload a resume before starting mock sessions so the coach can tailor questions to your skills.
            </p>
          </div>
        </div>
      )}

      {/* Active Session Callout */}
      {activeSession && (
        <div className="mb-lg bg-primary/10 border border-primary/20 p-md rounded-xl flex flex-col sm:flex-row justify-between items-center gap-md">
          <div>
            <h4 className="font-body-bold text-[14px] text-primary dark:text-primary-fixed-dim">Active session in progress</h4>
            <p className="text-xs text-slate-500 mt-0.5">You have a pending mock session created recently.</p>
          </div>
          <button 
            onClick={handleResumeSession}
            className="px-4 py-2 bg-primary text-white rounded-lg font-body-bold text-xs hover:bg-primary-500 transition-all cursor-pointer"
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
          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-lg soft-shadow">
            <h2 className="text-lg font-bold text-on-surface dark:text-inverse-on-surface mb-lg flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              Configure Mock Session
            </h2>

            <div className="space-y-lg">
              
              {/* Type Selection */}
              <div>
                <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-sm">Interview Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                  {INTERVIEW_TYPES.map(type => {
                    const active = config.interview_type === type.id
                    const Icon = type.icon
                    return (
                      <button
                        key={type.id}
                        onClick={() => setConfig(prev => ({ ...prev, interview_type: type.id }))}
                        className={`p-md rounded-lg text-left border transition-all cursor-pointer flex gap-3 ${
                          active
                            ? 'bg-primary/5 dark:bg-primary/10 border-primary text-primary dark:text-primary-fixed-dim font-body-bold'
                            : 'border-border-subtle hover:bg-surface-container-low text-on-surface-variant dark:text-surface-variant'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${active ? 'bg-primary/10 text-primary dark:text-primary-fixed-dim' : 'bg-slate-50 text-slate-400'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-[13px] font-bold">{type.label}</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-tight font-normal">{type.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Persona Selection */}
              <div>
                <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-sm">Coach Persona</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
                  {PERSONAS.map(p => {
                    const active = config.interviewer_persona === p.id
                    const Icon = p.icon
                    return (
                      <button
                        key={p.id}
                        onClick={() => setConfig(prev => ({ ...prev, interviewer_persona: p.id }))}
                        className={`p-md rounded-lg text-left border transition-all cursor-pointer ${
                          active
                            ? 'bg-primary/5 dark:bg-primary/10 border-primary text-primary dark:text-primary-fixed-dim font-body-bold'
                            : 'border-border-subtle hover:bg-surface-container-low text-on-surface-variant dark:text-surface-variant'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-slate-400'}`} />
                          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{p.badge}</span>
                        </div>
                        <h4 className="text-[12px] font-bold">{p.label}</h4>
                        <p className="text-[10px] text-slate-400 mt-1 font-normal leading-normal">{p.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-sm">Complexity Level</label>
                <div className="grid grid-cols-3 gap-sm">
                  {DIFFICULTIES.map(diff => {
                    const active = config.difficulty === diff.id
                    return (
                      <button
                        key={diff.id}
                        onClick={() => setConfig(prev => ({ ...prev, difficulty: diff.id }))}
                        className={`p-sm rounded-lg text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
                          active
                            ? diff.color + ' font-body-bold shadow-sm'
                            : 'border-border-subtle hover:bg-surface-container-low text-on-surface-variant dark:text-surface-variant'
                        }`}
                      >
                        <span className="text-[13px] font-bold">{diff.label}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 font-normal">{diff.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Details & Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md pt-md border-t border-border-subtle dark:border-outline-variant/10">
                
                {/* Topic Focus */}
                <div>
                  <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-xs">Sub-topic Focus (Optional)</label>
                  <input
                    type="text"
                    name="topic_focus"
                    placeholder="e.g. system design, async loops, STAR behavioral"
                    value={config.topic_focus}
                    onChange={(e) => setConfig(prev => ({ ...prev, topic_focus: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-border-subtle rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all dark:text-white"
                  />
                </div>

                {/* Question Count Selection */}
                <div>
                  <label className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider block mb-xs">Question Count</label>
                  <div className="flex bg-slate-50 dark:bg-inverse-surface/30 rounded-lg p-0.5 border border-border-subtle">
                    {QUESTION_COUNTS.map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, num_questions: cnt }))}
                        className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer text-center ${
                          config.num_questions === cnt
                            ? 'bg-white dark:bg-inverse-surface text-primary border border-border-subtle shadow-sm'
                            : 'text-slate-400 hover:text-slate-650'
                        }`}
                      >
                        {cnt} Qs
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Voice Mode Toggle */}
              <div className="pt-md flex items-center justify-between border-t border-border-subtle dark:border-outline-variant/10">
                <div>
                  <h4 className="text-[13px] font-bold text-on-surface dark:text-inverse-on-surface">Voice Interactive Mode</h4>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5 font-normal">Synthesize voice responses and answer using speech recognition.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, voice_mode: !prev.voice_mode }))}
                  className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer relative ${config.voice_mode ? 'bg-primary' : 'bg-slate-200'}`}
                >
                  <div className={`w-5.5 h-5.5 rounded-full bg-white shadow transition-all transform ${config.voice_mode ? 'translate-x-5.5' : 'translate-x-0'}`} />
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Info & History Pane (4/12 width) */}
        <div className="lg:col-span-4 flex flex-col gap-lg">
          
          {/* Action Trigger Card */}
          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow text-center">
            <div className="w-12 h-12 rounded-full bg-primary/5 text-primary border border-primary/10 flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">Ready to start?</h3>
            <p className="font-metadata text-[11px] text-slate-400 leading-normal my-sm">
              Estimated duration: {config.num_questions * 3} minutes.
            </p>
            <button
              onClick={handleStart}
              disabled={isStarting || resumeStatus === 'missing'}
              className="w-full py-2.5 bg-primary hover:bg-primary-500 text-white rounded-lg font-body-bold text-xs transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-current" />
              {isStarting ? 'Setting up Round...' : 'Launch AI Practice'}
            </button>
          </div>

          {/* History Tracker */}
          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow flex-1">
            <h3 className="font-body-bold text-[14px] font-bold text-on-surface dark:text-inverse-on-surface mb-md">Practice History</h3>
            
            {historyLoading ? (
              <div className="text-center py-6 text-xs text-on-surface-variant">Loading records...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-6 text-xs text-on-surface-variant">No sessions completed yet. Launch your first round!</div>
            ) : (
              <div className="space-y-sm">
                {history.slice(0, 4).map((session, index) => {
                  const score = session.overall_score || session.score
                  const isGood = score && score >= 75
                  
                  return (
                    <div 
                      key={session.session_id || index}
                      className="p-sm bg-slate-50 dark:bg-inverse-surface/10 border border-border-subtle dark:border-outline-variant/20 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-body-bold text-[12px] text-on-surface dark:text-inverse-on-surface capitalize truncate max-w-[120px]">{session.interview_type} Round</h4>
                        <p className="text-[10px] text-slate-400 capitalize mt-0.5">
                          {session.difficulty} • {session.num_questions} Qs
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {score !== null && score !== undefined && (
                          <div className="text-right mr-1">
                            <span className={`font-label-caps text-sm font-bold ${isGood ? 'text-success' : 'text-warning'}`}>{Math.round(score)}%</span>
                            <span className="block text-[8px] text-slate-400 uppercase tracking-wider font-semibold">Score</span>
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
                          className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors cursor-pointer"
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
