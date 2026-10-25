import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, ChevronDown, ChevronUp, BookOpen, Star, 
  AlertCircle, CheckCircle, Loader2, ArrowLeft, Sparkles, AlertTriangle
} from 'lucide-react'
import useResultsPolling from '../hooks/useResultsPolling'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import api, { apiUrl } from '../config/api'
import secureStorage from '../utils/secureStorage'
import SkillGapModal from '../components/SkillGapModal'

const SCORE_COLORS = [
  { min: 0.80, color: 'text-green-600', fill: '#16a34a', bg: 'bg-green-50', border: 'border-green-200', label: 'Strong' },
  { min: 0.60, color: 'text-primary-600', fill: '#4f46e5', bg: 'bg-primary-50', border: 'border-primary-200', label: 'Good' },
  { min: 0.40, color: 'text-amber-600', fill: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Moderate' },
  { min: 0.00, color: 'text-red-600', fill: '#dc2626', bg: 'bg-red-50', border: 'border-red-200', label: 'Needs Practice' },
]

function getScoreStyle(score) {
  if (score === null || score === undefined) return SCORE_COLORS[3]
  return SCORE_COLORS.find(s => score >= s.min) || SCORE_COLORS[3]
}

function ScoreRing({ score }) {
  const pct = Math.round((score || 0) * 100)
  const style = getScoreStyle(score)
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dash = circumference * (1 - pct / 100)

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width={144} height={144} className="transform -rotate-90">
        <circle cx={72} cy={72} r={radius} fill="none" strokeWidth={10} className="stroke-hairline" />
        <motion.circle
          cx={72} cy={72} r={radius} fill="none" stroke={style.fill} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-title-lg font-extrabold ${style.color} tracking-tight`}>{pct}%</span>
        <span className="text-overline uppercase font-bold text-ink-subtle mt-1">{style.label}</span>
      </div>
    </div>
  )
}

function SkillBar({ skill, score, label }) {
  const style = getScoreStyle(score)
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-caption font-semibold text-ink">{skill}</span>
        <span className={`text-caption font-bold ${style.color}`}>{Math.round(score * 100)}% · {label}</span>
      </div>
      <div className="h-2 bg-surface-sunken rounded-pill overflow-hidden">
        <motion.div
          className="h-full rounded-pill"
          style={{ backgroundColor: style.fill }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(score * 100)}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  )
}

function QuestionAccordion({ item }) {
  const [open, setOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState(null)
  const abortRef = useRef(null)
  const style = getScoreStyle(item.score)

  const loadFeedback = async () => {
    if (!open || feedbackText) return
    // Abort any in-flight stream (rapid open/close must not interleave).
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFeedbackLoading(true)
    setFeedbackError(null)
    try {
      const token = secureStorage.getItem('token') || ''
      const response = await fetch(apiUrl(`/api/interview/feedback/${item.question_id}`), {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        throw new Error(`Feedback request failed (HTTP ${response.status})`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (controller.signal.aborted) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''))
              if (data.error) {
                setFeedbackError(data.error)
              } else if (data.token) {
                accumulated += data.token
                if (!controller.signal.aborted) setFeedbackText(accumulated)
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Feedback stream error:', err)
        setFeedbackError(err?.message || 'Feedback failed to load.')
      }
    } finally {
      if (!controller.signal.aborted) setFeedbackLoading(false)
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  useEffect(() => {
    loadFeedback()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [open])

  return (
    <div className={`rounded-card border bg-surface-raised mb-3 shadow-soft-xs transition-all ${open ? 'border-hairline-strong shadow-soft-sm' : 'border-hairline'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 border-none cursor-pointer flex items-start gap-4 text-left rounded-card"
      >
        <div className="flex-shrink-0 mt-0.5">
          {item.status === 'evaluated' && item.score !== null ? (
            <div className={`px-2.5 py-0.5 rounded-card border text-caption font-bold ${style.bg} ${style.border} ${style.color}`}>
              {Math.round(item.score * 100)}%
            </div>
          ) : item.status === 'evaluation_failed' ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : (
            <Loader2 className="w-5 h-5 text-ink-subtle animate-spin" />
          )}
        </div>
        <p className="text-ink font-semibold text-caption flex-1 leading-relaxed pr-2">{item.question}</p>
        <div className="flex-shrink-0 text-ink-subtle mt-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-3 border-t border-hairline bg-surface-sunken text-caption">
              
              {/* Answer details */}
              <div className="mb-4">
                <span className="text-overline uppercase text-ink-subtle block mb-1">Your Submission</span>
                <p className="text-ink-muted text-caption leading-relaxed whitespace-pre-wrap">{item.answer || '(no answer provided)'}</p>
              </div>

              {/* Strength box */}
              {item.strength && (
                <div className="bg-green-50 border border-green-100 rounded-card p-3.5 flex gap-2.5 items-start mb-4">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-overline uppercase text-green-800 block mb-0.5">Key Strengths</span>
                    <p className="text-caption text-green-700 leading-normal">{item.strength}</p>
                  </div>
                </div>
              )}

              {/* Missing concepts */}
              {item.missing_concepts?.length > 0 && (
                <div className="mb-4">
                  <span className="text-overline uppercase text-ink-subtle block mb-1.5">Missing Key Concepts</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.missing_concepts.map(concept => (
                      <span key={concept} className="px-2.5 py-0.5 bg-red-50 border border-red-100 rounded-pill text-red-600 text-caption font-semibold">
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Streamed feedback */}
              <div className="pt-2 border-t border-hairline">
                <span className="text-overline uppercase text-ink-subtle flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                  Detailed AI Feedback
                  {feedbackLoading && <span className="text-ink-subtle font-normal lowercase tracking-normal">(streaming feedback...)</span>}
                </span>
                <p className="text-ink-muted text-caption leading-relaxed">
                  {feedbackError ? (
                    <span className="text-red-600 font-semibold">
                      {feedbackError}{' '}
                      <button
                        onClick={() => { setFeedbackError(null); setFeedbackText(''); loadFeedback() }}
                        className="underline hover:no-underline"
                      >
                        Try again
                      </button>
                    </span>
                  ) : (
                    feedbackText || item.feedback || 'Evaluating feedback response...'
                  )}
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function InterviewResultsPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { results, isProcessing, completedCount, totalCount, error, timedOut, refresh, retry } = useResultsPolling(sessionId)
  const [showGapModal, setShowGapModal] = useState(false)

  // Error layout
  if (error) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="font-display text-title text-ink mb-2">Error Loading Report</h2>
          <p className="text-body text-ink-muted mb-6">{error}</p>
          <button 
            onClick={() => navigate('/dashboard/interview')}
            className="app-btn-primary w-full"
          >
            Back to Interview Lobby
          </button>
        </div>
      </div>
    )
  }

  // Timed-out polling state (H4): bounded polling gives up with a retry
  // action instead of spinning forever.
  if (timedOut && !results) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="font-display text-title text-ink mb-2">Evaluation is taking longer than expected</h2>
          <p className="text-body text-ink-muted mb-6 leading-relaxed">
            Scored <strong className="text-ink">{completedCount}</strong> of <strong className="text-ink">{totalCount}</strong> responses
            so far. The evaluation may still be running — you can keep waiting or go back and check later.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={retry}
              className="app-btn-primary"
            >
              Keep Waiting
            </button>
            <button
              onClick={() => navigate('/dashboard/interview')}
              className="app-btn-secondary"
            >
              Back to Interview Lobby
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Processing evaluation state
  if (isProcessing) {
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-6" />
          <h2 className="font-display text-title text-ink mb-2">Analyzing Responses</h2>
          <p className="text-body text-ink-muted mb-6 leading-relaxed">
            Scored <strong className="text-ink">{completedCount}</strong> of <strong className="text-ink">{totalCount}</strong> responses. Evaluating criteria, keywords, and code structure.
          </p>
          <div className="h-2 bg-surface-sunken rounded-pill overflow-hidden mb-3">
            <motion.div
              className="h-full bg-primary-600 rounded-pill"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-overline text-ink-subtle font-semibold tracking-wide">
            AUTOMATIC PROGRESS REFRESH • CHECKING EVERY FEW SECONDS
          </p>
        </div>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-sm w-full text-center">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-6" />
          <p className="text-caption text-ink-muted font-medium">Loading score report...</p>
        </div>
      </div>
    )
  }

  // Zero-answer finish (L6): finishing without answering renders an honest
  // empty state instead of a 0% scorecard.
  const answeredReviews = (results.questions_review || []).filter(q => q.answer && q.answer.trim())
  if (answeredReviews.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-sm w-full text-center">
          <span className="text-4xl block mb-4">📝</span>
          <h2 className="font-display text-title text-ink mb-2">No answers submitted</h2>
          <p className="text-body text-ink-muted mb-6 leading-relaxed">
            This session finished without any submitted answers, so there&apos;s nothing to score yet.
            Start a new session to get your first evaluation.
          </p>
          <button
            onClick={() => navigate('/dashboard/interview')}
            className="app-btn-primary w-full"
          >
            Start New Practice
          </button>
        </div>
      </div>
    )
  }

  const overallPct = Math.round((results.overall_score || 0) * 100)
  const style = getScoreStyle(results.overall_score)

  return (
    <div className="relative">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="max-w-container-max mx-auto">
        
        {/* Back Link */}
        <button 
          onClick={() => navigate('/dashboard/interview')}
          className="inline-flex items-center gap-1 text-caption font-semibold text-ink-muted hover:text-ink transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Setup
        </button>

        {/* Header */}
        <div className="mb-lg">
          <div className="inline-flex items-center gap-2 rounded-pill border border-primary-100 bg-primary-50 px-3 py-1 text-overline font-bold uppercase tracking-wider text-primary mb-3">
            <Trophy className="w-3.5 h-3.5" />
            Performance Evaluation
          </div>
          <h1 className="app-page-title mb-1">
            Mock Practice Scorecard
          </h1>
        </div>

        {/* Score Hero panel */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          className="surface-card p-6 sm:p-8 mb-6 flex flex-col md:flex-row items-center justify-around gap-8"
        >
          <ScoreRing score={results.overall_score} />
          
          <div className="flex-1 max-w-md text-center md:text-left">
            <h2 className="font-display text-title-lg text-ink mb-2">
              {overallPct >= 80 ? '🎉 Excellent Job!' : overallPct >= 60 ? '👍 Good Progress!' : overallPct >= 40 ? '📚 Foundational Check' : '💪 Keep At It!'}
            </h2>
            <p className="text-ink-muted text-body leading-relaxed mb-6">
              You finished the mock session with an overall match score of <strong className={`${style.color} font-bold`}>{overallPct}%</strong>. Review the skill tracker and gap analyses below.
            </p>

            {/* Score category markers */}
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto md:mx-0">
              <div className="px-3.5 py-2 bg-surface-sunken border border-hairline rounded-card text-center">
                <span className="text-overline font-bold text-ink-subtle block uppercase">Answered</span>
                <span className="text-caption font-bold text-ink">{results.questions_review?.length || 0} questions</span>
              </div>
              <div className="px-3.5 py-2 bg-surface-sunken border border-hairline rounded-card text-center">
                <span className="text-overline font-bold text-ink-subtle block uppercase">Matching Tier</span>
                <span className={`text-caption font-bold ${style.color}`}>{style.label}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Skill Breakdown block */}
        {results.skill_breakdown?.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
            className="surface-card p-6 sm:p-8 mb-6"
          >
            <h3 className="text-overline font-bold uppercase tracking-wider text-ink-subtle mb-5">
              Topic Skill Breakdown
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
              {results.skill_breakdown.map(({ skill, score, label }) => (
                <SkillBar key={skill} skill={skill} score={score} label={label} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Study Plan gap analysis */}
        {results.weak_skills?.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }}
            className="bg-gradient-to-br from-indigo-500/10 via-indigo-600/5 to-slate-900 border border-indigo-500/20 rounded-panel p-6 sm:p-8 mb-6 shadow-soft-xl relative overflow-hidden"
          >
            {/* Background absolute glowing blob */}
            <div className="absolute -right-20 -top-20 w-60 h-60 rounded-pill bg-indigo-500/10 blur-3xl pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start sm:items-center gap-4">
                <div className="p-3.5 bg-indigo-600/10 text-indigo-400 rounded-card border border-indigo-600/20 flex-shrink-0">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-slate-100 text-title leading-tight flex items-center gap-2">
                    AI-Driven Skill Gap & Course Roadmap Analysis
                  </h3>
                  <p className="text-caption text-slate-400 mt-1.5 max-w-lg leading-relaxed">
                    Identify your technical concepts gaps based on your answers and compile an interactive, flowchart-based week-by-week learning pathway with quality video tutorials, coding practice, and real-world projects.
                  </p>
                </div>
              </div>
              {results.study_plan && results.study_plan.trim().startsWith("{") ? (
                <button
                  id="open-gap-analysis-modal-btn"
                  onClick={() => setShowGapModal(true)}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-caption font-bold rounded-card flex items-center gap-2 shadow-soft-lg shadow-emerald-600/10 transition-all hover:scale-102 active:scale-98"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>View Skill Gap Diagnosis</span>
                </button>
              ) : (
                <button
                  id="open-gap-analysis-modal-btn"
                  onClick={() => setShowGapModal(true)}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-caption font-bold rounded-card flex items-center gap-2 shadow-soft-lg shadow-indigo-600/10 transition-all hover:scale-102 active:scale-98"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Run Skill Gap Diagnosis</span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Detailed Question Review List */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h3 className="text-overline font-bold uppercase tracking-wider text-ink-subtle">
              Detailed Question-by-Question review
            </h3>
          </div>
          {results.questions_review?.map(item => (
            <QuestionAccordion key={item.question_id} item={item} />
          ))}
        </motion.div>

        {/* Action actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center border-t border-hairline pt-6">
          <button 
            onClick={() => navigate('/dashboard/interview')}
 className="app-btn-secondary"
          >
            Start New Practice
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="app-btn-primary"
          >
            Return to Dashboard Workspace
          </button>
        </div>

        {/* Full Screen Overlay Modal */}
        <SkillGapModal 
          isOpen={showGapModal}
          onClose={() => setShowGapModal(false)}
          sessionId={sessionId}
          initialSkills={results.skill_breakdown || []}
          targetRole="Software Developer"
          experienceLevel="junior"
          learningPathId={results.learning_path_id}
          onPathGenerated={refresh}
          onGapAnalysisCompleted={refresh}
        />

      </div>
    </div>
  )
}
