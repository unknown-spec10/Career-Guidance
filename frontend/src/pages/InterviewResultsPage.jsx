import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, ChevronDown, ChevronUp, BookOpen, Star, 
  AlertCircle, CheckCircle, Loader2, ArrowLeft, Sparkles, AlertTriangle
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import useResultsPolling from '../hooks/useResultsPolling'
import useStreamingText from '../hooks/useStreamingText'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import secureStorage from '../utils/secureStorage'

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

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 mt-8 mb-4 flex items-center gap-2.5 border-l-4 border-primary-500 pl-4 tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-7 mb-3">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base sm:text-lg font-semibold text-slate-800 mt-6 mb-2.5">{children}</h3>,
  p: ({ children }) => <p className="text-slate-700 leading-relaxed mb-4 text-sm sm:text-base font-normal">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-5 space-y-2.5 text-slate-650 text-sm sm:text-base marker:text-primary-500">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-5 space-y-2.5 text-slate-650 text-sm sm:text-base marker:text-primary-500 marker:font-bold">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-slate-950 bg-slate-100/70 px-1.5 py-0.5 rounded border border-slate-200/50">{children}</strong>,
  code: ({ inline, children }) => {
    if (inline) {
      return (
        <code className="bg-slate-100 text-primary-600 px-2 py-0.5 rounded font-mono text-xs sm:text-sm border border-slate-200/50">
          {children}
        </code>
      )
    }
    return (
      <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed my-5 border border-slate-800 shadow-sm">
        <code>{children}</code>
      </pre>
    )
  },
  a: ({ href, children }) => (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="text-primary-600 hover:text-primary-700 underline font-semibold transition-colors"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-amber-500 pl-4 italic text-slate-650 bg-amber-50/20 py-3 pr-3 rounded-r-xl my-5 text-sm sm:text-base">
      {children}
    </blockquote>
  )
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
        <circle cx={72} cy={72} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={10} />
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
        <span className={`text-3xl font-extrabold ${style.color} tracking-tight`}>{pct}%</span>
        <span className="text-[10px] uppercase font-bold text-gray-400 mt-1">{style.label}</span>
      </div>
    </div>
  )
}

function SkillBar({ skill, score, label }) {
  const style = getScoreStyle(score)
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-semibold text-gray-900">{skill}</span>
        <span className={`text-xs font-bold ${style.color}`}>{Math.round(score * 100)}% · {label}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
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
  const style = getScoreStyle(item.score)

  const loadFeedback = async () => {
    if (!open || feedbackText) return
    setFeedbackLoading(true)
    try {
      const token = secureStorage.getItem('token') || ''
      const response = await fetch(`/api/interview/feedback/${item.question_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''))
              accumulated += data.token || ''
              setFeedbackText(accumulated)
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Feedback stream error:', err)
    } finally {
      setFeedbackLoading(false)
    }
  }

  useEffect(() => {
    loadFeedback()
  }, [open])

  return (
    <div className={`bg-white border rounded-2xl mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all ${open ? 'border-gray-300' : 'border-gray-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 bg-white border-none cursor-pointer flex items-start gap-4 text-left rounded-2xl"
      >
        <div className="flex-shrink-0 mt-0.5">
          {item.status === 'evaluated' && item.score !== null ? (
            <div className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${style.bg} ${style.border} ${style.color}`}>
              {Math.round(item.score * 100)}%
            </div>
          ) : item.status === 'evaluation_failed' ? (
            <AlertCircle className="w-5 h-5 text-red-500" />
          ) : (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          )}
        </div>
        <p className="text-gray-900 font-semibold text-sm flex-1 leading-relaxed pr-2">{item.question}</p>
        <div className="flex-shrink-0 text-gray-400 mt-1">
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
            <div className="px-5 pb-5 pt-3 border-t border-gray-100 bg-slate-50/50 text-sm">
              
              {/* Answer details */}
              <div className="mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">Your Submission</span>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{item.answer || '(no answer provided)'}</p>
              </div>

              {/* Strength box */}
              {item.strength && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3.5 flex gap-2.5 items-start mb-4">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-800 block mb-0.5">Key Strengths</span>
                    <p className="text-xs text-green-700 leading-normal">{item.strength}</p>
                  </div>
                </div>
              )}

              {/* Missing concepts */}
              {item.missing_concepts?.length > 0 && (
                <div className="mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1.5">Missing Key Concepts</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.missing_concepts.map(concept => (
                      <span key={concept} className="px-2.5 py-0.5 bg-red-50 border border-red-100 rounded-md text-red-600 text-xs font-semibold">
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Streamed feedback */}
              <div className="pt-2 border-t border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                  Detailed AI Feedback
                  {feedbackLoading && <span className="text-gray-400 font-normal lowercase tracking-normal">(streaming feedback...)</span>}
                </span>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {feedbackText || item.feedback || 'Evaluating feedback response...'}
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
  const { results, isProcessing, completedCount, totalCount, error } = useResultsPolling(sessionId)
  const { text: studyPlan, isStreaming: studyPlanStreaming, startStream } = useStreamingText()
  const [studyPlanOpen, setStudyPlanOpen] = useState(false)

  // Auto-open study plan if it has already been generated
  useEffect(() => {
    if (results?.study_plan) {
      setStudyPlanOpen(true)
    }
  }, [results])

  const handleOpenStudyPlan = () => {
    setStudyPlanOpen(true)
    if (!studyPlan && !studyPlanStreaming) {
      startStream(`/api/interview/study-plan/${sessionId}`)
    }
  }

  // Error layout
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white border border-gray-200 rounded-3xl p-8 max-w-sm shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Report</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/dashboard/interview')}
            className="w-full btn-primary py-3 rounded-xl text-sm font-semibold"
          >
            Back to Interview Lobby
          </button>
        </div>
      </div>
    )
  }

  // Processing evaluation state
  if (isProcessing) {
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full shadow-sm">
          <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold text-gray-950 mb-2">Analyzing Responses</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Scored <strong className="text-gray-900">{completedCount}</strong> of <strong className="text-gray-900">{totalCount}</strong> responses. Evaluating criteria, keywords, and code structure.
          </p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full bg-primary-600 rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-[10px] text-gray-400 font-semibold tracking-wide">
            AUTOMATIC PROGRESS REFRESH • MOCK SCORING LOOP (~15S)
          </p>
        </div>
      </div>
    )
  }

  if (!results) return null

  const overallPct = Math.round((results.overall_score || 0) * 100)
  const style = getScoreStyle(results.overall_score)

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 font-sans text-gray-900">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        
        {/* Back Link */}
        <button 
          onClick={() => navigate('/dashboard/interview')}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Setup
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-3">
            <Trophy className="w-3.5 h-3.5" />
            Performance Evaluation
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950">
            Mock Practice Scorecard
          </h1>
        </div>

        {/* Score Hero panel */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-6 flex flex-col md:flex-row items-center justify-around gap-8"
        >
          <ScoreRing score={results.overall_score} />
          
          <div className="flex-1 max-w-md text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-950 mb-2">
              {overallPct >= 80 ? '🎉 Excellent Job!' : overallPct >= 60 ? '👍 Good Progress!' : overallPct >= 40 ? '📚 Foundational Check' : '💪 Keep At It!'}
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              You finished the mock session with an overall match score of <strong className={`${style.color} font-bold`}>{overallPct}%</strong>. Review the skill tracker and gap analyses below.
            </p>

            {/* Score category markers */}
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto md:mx-0">
              <div className="px-3.5 py-2 bg-slate-50 border border-gray-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Answered</span>
                <span className="text-sm font-bold text-gray-900">{results.questions_review?.length || 0} questions</span>
              </div>
              <div className="px-3.5 py-2 bg-slate-50 border border-gray-200 rounded-xl text-center">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Matching Tier</span>
                <span className={`text-sm font-bold ${style.color}`}>{style.label}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Skill Breakdown block */}
        {results.skill_breakdown?.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
            className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-6"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-5">
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
            className="bg-gradient-to-br from-primary-50/40 to-indigo-50/20 border border-primary-100/80 rounded-3xl p-6 sm:p-8 mb-6 shadow-sm"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-3 bg-primary-100 text-primary-600 rounded-2xl flex-shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-950 text-base leading-tight">Personalized 30-Day Study Plan</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Custom curriculum focusing on gaps: {results.weak_skills.join(', ')}
                  </p>
                </div>
              </div>
              {!results.study_plan && !studyPlanOpen && (
                <button
                  id="open-study-plan-btn"
                  onClick={handleOpenStudyPlan}
                  disabled={studyPlanStreaming}
                  className="px-4.5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{studyPlanStreaming ? 'Generating Plan...' : 'Generate Gap Curriculum'}</span>
                </button>
              )}
            </div>

            {/* Study plan stream panel */}
            <AnimatePresence>
              {studyPlanOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 p-6 bg-gradient-to-br from-white to-slate-50/50 border border-slate-200 rounded-3xl text-gray-800 text-sm leading-relaxed whitespace-normal max-h-[500px] overflow-y-auto shadow-[inset_0_2px_4px_rgba(0,0,0,0.01),0_10px_35px_-10px_rgba(0,0,0,0.04)]">
                    {(studyPlan || results?.study_plan) ? (
                      <div className="text-left">
                        <ReactMarkdown components={markdownComponents}>{studyPlan || results.study_plan}</ReactMarkdown>
                        {studyPlanStreaming && <span className="animate-pulse font-bold text-primary-600 ml-0.5">▌</span>}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-xs font-medium text-gray-400 py-6">
                        <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
                        <span>Compiling custom curriculum timeline...</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Detailed Question-by-Question review
            </h3>
          </div>
          {results.questions_review?.map(item => (
            <QuestionAccordion key={item.question_id} item={item} />
          ))}
        </motion.div>

        {/* Action actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center border-t border-gray-200 pt-6">
          <button 
            onClick={() => navigate('/dashboard/interview')}
            className="px-6 py-3 border border-gray-300 rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50 bg-white transition-colors"
          >
            Start New Practice
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
          >
            Return to Dashboard Workspace
          </button>
        </div>

      </div>
    </div>
  )
}
