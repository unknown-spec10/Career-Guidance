import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Cpu, Users, Heart, Shuffle, Zap, Target, BarChart2, 
  MessageSquare, AlertTriangle, Clock, ArrowRight, RefreshCw, ChevronLeft, Trophy, Calendar 
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import useInterviewSession from '../hooks/useInterviewSession'

const INTERVIEW_TYPES = [
  { id: 'technical', label: 'Technical', icon: Cpu, desc: 'Data structures, system design, coding fundamentals' },
  { id: 'hr', label: 'HR & Management', icon: Users, desc: 'Background, future goals, behavioral fit' },
  { id: 'behavioral', label: 'Behavioral', icon: Heart, desc: 'Leadership, conflict resolution, teamwork' },
  { id: 'mixed', label: 'Mixed Mode', icon: Shuffle, desc: 'A custom blended session of all styles' },
]

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', color: 'text-green-600 bg-green-50 border-green-200 active-border-green-500', desc: 'Foundational concepts' },
  { id: 'medium', label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200 active-border-amber-500', desc: 'Applied knowledge' },
  { id: 'hard', label: 'Hard', color: 'text-red-600 bg-red-50 border-red-200 active-border-red-500', desc: 'System design & edge cases' },
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
  })
  const [isStarting, setIsStarting] = useState(false)
  const [resumeStatus, setResumeStatus] = useState(null) // null | 'parsed' | 'missing'
  const [activeSession, setActiveSession] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Check resume status, active sessions, and history
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
        console.error('Failed to load portal configuration data:', err)
        setResumeStatus('missing')
      } finally {
        setHistoryLoading(false)
      }
    }
    checkStatus()
  }, [])

  const handleStart = async () => {
    if (resumeStatus === 'missing') {
      toast.error('Please upload and parse your resume first.')
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
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    toast.success(`Loaded configuration: ${session.interview_type} (${session.difficulty}, ${session.num_questions} Qs)`)
  }

  const estimatedTime = Math.round(config.num_questions * 3)

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        
        {/* Back Link */}
        <button 
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-4">
            <Zap className="w-3.5 h-3.5" />
            AI Interview Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Mock Interview Practice
          </h1>
          <p className="text-gray-600">
            Hone your skills with a smart, resume-aware mock interview. Receive detailed score sheets, concept breakdowns, and a gap-focused study plan.
          </p>
        </motion.div>

        {/* Unfinished session banner */}
        <AnimatePresence>
          {activeSession && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative mb-6 overflow-hidden rounded-2xl border border-primary-100 bg-primary-50/50 p-5 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
                    <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-950 text-sm">Unfinished Session Active</h3>
                    <p className="text-xs text-gray-600">
                      You have an active {activeSession.interview_type} session with {activeSession.answers_submitted} of {activeSession.total_questions} questions answered.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleResumeSession}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-colors self-start sm:self-center"
                >
                  Resume Interview →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resume missing warning */}
        <AnimatePresence>
          {resumeStatus === 'missing' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 border border-red-200 bg-red-50 text-red-800 rounded-2xl flex items-start gap-3 shadow-sm text-sm"
            >
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Resume Profile Missing:</span> To generate tailored questions matching your experience, please <a href="/dashboard" className="underline font-semibold hover:text-red-950">upload and parse your resume</a> on the dashboard workspace first.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Form Box */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="relative bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8"
        >
          {/* Interview Type Selection */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
              Select Focus Style
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INTERVIEW_TYPES.map(({ id, label, icon: Icon, desc }) => {
                const isSelected = config.interview_type === id
                return (
                  <button
                    key={id}
                    onClick={() => setConfig(c => ({ ...c, interview_type: id }))}
                    className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
                      isSelected 
                        ? 'border-primary-500 bg-primary-50/40 shadow-sm ring-1 ring-primary-500' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${isSelected ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isSelected ? 'text-primary-950' : 'text-gray-900'}`}>{label}</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-normal">{desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Difficulty Level */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
              Difficulty Level
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DIFFICULTIES.map(({ id, label, color, desc }) => {
                const isSelected = config.difficulty === id
                return (
                  <button
                    key={id}
                    onClick={() => setConfig(c => ({ ...c, difficulty: id }))}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                      isSelected 
                        ? `border-primary-500 bg-primary-50/30 ring-1 ring-primary-500` 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${color} mb-2`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {label}
                    </span>
                    <p className="text-[11px] text-gray-500 leading-normal">{desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Question Count */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Number of Questions
              </h3>
              <span className="text-sm font-bold text-primary-700">
                {config.num_questions} questions · ~{estimatedTime} min
              </span>
            </div>
            <div className="flex gap-3">
              {QUESTION_COUNTS.map(n => {
                const isSelected = config.num_questions === n
                return (
                  <button
                    key={n}
                    onClick={() => setConfig(c => ({ ...c, num_questions: n }))}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
                      isSelected 
                        ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                        : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Topic Focus */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Specific Topic Focus <span className="text-gray-300 font-normal">(Optional)</span>
            </h3>
            <input
              type="text"
              placeholder="e.g. React hooks, SQL database optimization, system architecture..."
              value={config.topic_focus}
              onChange={e => setConfig(c => ({ ...c, topic_focus: e.target.value }))}
              maxLength={200}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm placeholder:text-gray-400"
            />
          </div>

          {/* Pricing Info */}
          <div className="flex items-center gap-2.5 p-4 bg-primary-50/60 border border-primary-100 rounded-2xl text-xs text-primary-800">
            <Zap className="w-4 h-4 text-primary-600 flex-shrink-0" />
            <span>
              Generating this custom mock session costs <strong className="text-primary-950 font-bold">{config.num_questions} credits</strong>. Evaluation and study plans are included free of charge.
            </span>
          </div>
        </motion.div>

        {/* Start Button Action */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1, transition: { delay: 0.2 } }}
          className="mb-8"
        >
          <button
            id="start-interview-btn"
            onClick={handleStart}
            disabled={isStarting || resumeStatus === 'missing'}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-sm ${
              isStarting || resumeStatus === 'missing'
                ? 'bg-gray-200 border border-gray-300 text-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white hover:shadow-md active:scale-[0.99]'
            }`}
          >
            {isStarting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Assembling Your Custom Interview...
              </>
            ) : (
              <>
                <span>Begin Mock Practice Session</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </motion.div>

        {/* Benefits strip */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1, transition: { delay: 0.3 } }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-white border border-gray-200 rounded-2xl text-center shadow-sm"
        >
          {[
            { icon: Target, label: 'Resume Matching', desc: 'Sourced from your skills', color: 'text-purple-600' },
            { icon: Zap, label: 'Adaptive Prompts', desc: 'Responsive difficulty', color: 'text-amber-500' },
            { icon: BarChart2, label: 'Deep Breakdown', desc: 'Skill-by-skill metrics', color: 'text-blue-600' },
            { icon: Clock, label: `~${estimatedTime} Min Session`, desc: 'Estimated completion', color: 'text-green-600' },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="flex flex-col items-center p-2">
              <Icon className={`w-5 h-5 ${color} mb-1.5`} />
              <span className="text-xs font-bold text-gray-900 leading-tight">{label}</span>
              <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</span>
            </div>
          ))}
        </motion.div>

        {/* Practice History Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, transition: { delay: 0.4 } }}
          className="mt-12"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-950 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Practice History
            </h2>
            <span className="text-xs text-gray-500 font-semibold bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
              {history.length} {history.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>

          {historyLoading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white border border-gray-200 rounded-3xl shadow-sm text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mb-2" />
              <p className="text-sm">Retrieving your practice history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center bg-white border border-gray-200 rounded-3xl shadow-sm">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 mb-1">No Practice Sessions Yet</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto leading-normal">
                Start your first mock interview above to see your scores, details, and study plans listed here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((session) => {
                const createdDate = new Date(session.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
                
                return (
                  <div 
                    key={session.session_id} 
                    className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_2px_8px_rgb(0,0,0,0.02)] hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left"
                  >
                    {/* Left Side: Type, Date, Config, Topic */}
                    <div className="flex-grow space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-950 capitalize">
                          {session.interview_type === 'mixed' ? 'Mixed Mode' : `${session.interview_type} Interview`}
                        </span>
                        
                        {/* Difficulty Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          session.difficulty === 'easy' ? 'bg-green-50 text-green-700 border border-green-200' :
                          session.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {session.difficulty}
                        </span>

                        {/* Question Count Badge */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {session.num_questions} Questions
                        </span>

                        {/* Status / Score Badge */}
                        {session.status === 'completed' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-primary-600" />
                            Score: {session.overall_score !== null ? `${Math.round(session.overall_score * 100)}%` : 'N/A'}
                          </span>
                        ) : session.status === 'active' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            Abandoned
                          </span>
                        )}
                      </div>

                      {/* Topic Focus (if exists) */}
                      {session.topic_focus && (
                        <p className="text-xs text-gray-500 leading-snug">
                          <span className="font-semibold text-gray-600">Focus:</span> {session.topic_focus}
                        </p>
                      )}

                      {/* Creation date */}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Started on {createdDate}</span>
                      </div>
                    </div>

                    {/* Right Side: Action Buttons */}
                    <div className="flex items-center gap-2 sm:self-center">
                      {session.status === 'completed' && (
                        <>
                          <button
                            onClick={() => navigate(`/dashboard/interview/results/${session.session_id}`)}
                            className="px-3.5 py-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-semibold rounded-xl text-xs shadow-sm transition-all"
                          >
                            View Report
                          </button>
                          <button
                            onClick={() => handleRetake(session)}
                            className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Retake
                          </button>
                        </>
                      )}

                      {session.status === 'active' && (
                        <>
                          <button
                            onClick={() => navigate(`/dashboard/interview/${session.session_id}`)}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => handleRetake(session)}
                            className="px-3.5 py-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-semibold rounded-xl text-xs shadow-sm transition-all"
                          >
                            Retake
                          </button>
                        </>
                      )}

                      {session.status === 'abandoned' && (
                        <button
                          onClick={() => handleRetake(session)}
                          className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-xs shadow-sm transition-all flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Retake Settings
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
