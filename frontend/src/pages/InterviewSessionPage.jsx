import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Lightbulb, Clock, MessageSquare, ChevronRight, XCircle, ArrowLeft } from 'lucide-react'
import useInterviewSession from '../hooks/useInterviewSession'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const AUTOSAVE_KEY = 'interview_draft_'

export default function InterviewSessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    sessionId: activeSessionId,
    currentQuestion,
    questionNumber,
    totalQuestions,
    isSubmitting,
    isComplete,
    hint,
    hintStreaming,
    error,
    recoverSession,
    submitAnswer,
  } = useInterviewSession()

  const [answer, setAnswer] = useState('')
  const [recovered, setRecovered] = useState(false)
  const [recoverError, setRecoverError] = useState(null)
  const [showExitModal, setShowExitModal] = useState(false)
  const textareaRef = useRef(null)
  const draftKey = AUTOSAVE_KEY + sessionId

  // -------------------------------------------------------------------------
  // On mount: recover session from URL param if no active session in state
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (sessionId && !activeSessionId) {
      recoverSession(sessionId).then(result => {
        if (!result.success) {
          if (result.redirect === 'results') {
            navigate(`/dashboard/interview/results/${sessionId}`, { replace: true })
          } else {
            setRecoverError(result.error || 'Session not found.')
          }
        } else {
          setRecovered(true)
        }
      })
    }
  }, [sessionId, activeSessionId, recoverSession, navigate])

  // Restore draft answer
  useEffect(() => {
    const saved = sessionStorage.getItem(draftKey)
    if (saved) setAnswer(saved)
  }, [draftKey])

  // Autosave draft on each keystroke
  useEffect(() => {
    if (answer) sessionStorage.setItem(draftKey, answer)
    else sessionStorage.removeItem(draftKey)
  }, [answer, draftKey])

  // Scroll textarea into view and focus on question change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
    setAnswer('')
    sessionStorage.removeItem(draftKey)
  }, [currentQuestion?.id, draftKey])

  // Navigate to results when complete
  useEffect(() => {
    if (isComplete) {
      setTimeout(() => {
        navigate(`/dashboard/interview/results/${sessionId || activeSessionId}`)
      }, 1500)
    }
  }, [isComplete, sessionId, activeSessionId, navigate])

  const handleSubmit = async () => {
    if (!answer.trim()) {
      toast.warning('Please write an answer before submitting.')
      return
    }
    const result = await submitAnswer(answer.trim())
    if (result?.error) {
      toast.error(result.error)
    }
  }

  const handleKeyDown = (e) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleConfirmExit = () => {
    // Abandon will trigger on navigate or page close beacon
    navigate('/dashboard/interview', { replace: true })
  }

  const progress = totalQuestions > 0 ? ((questionNumber - 1) / totalQuestions) * 100 : 0

  // -------------------------------------------------------------------------
  // Error / recovery states
  // -------------------------------------------------------------------------
  if (recoverError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white border border-gray-200 rounded-3xl p-8 max-w-sm shadow-sm">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">{recoverError}</p>
          <button 
            onClick={() => navigate('/dashboard/interview')}
            className="w-full btn-primary py-3 rounded-xl text-sm font-semibold"
          >
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  if (!currentQuestion && !isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-medium">Restoring practice session...</p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Interview Complete state
  // -------------------------------------------------------------------------
  if (isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="text-center bg-white border border-gray-200 rounded-3xl p-8 max-w-sm shadow-md"
        >
          <span className="text-4xl block mb-4">🎉</span>
          <h2 className="text-2xl font-bold text-gray-950 mb-2">Session Complete!</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Evaluating your responses in the background. Generating your personalized study plan...
          </p>
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-primary-700 bg-primary-50 rounded-xl py-2 px-4 inline-flex">
            <div className="w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>Redirecting to score report...</span>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 font-sans">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        
        {/* Header navigation bar */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => setShowExitModal(true)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quit Practice
          </button>
          
          <div className="flex items-center gap-2 text-xs bg-gray-100 border border-gray-200 text-gray-500 px-3 py-1.5 rounded-full font-bold">
            <Clock className="w-3.5 h-3.5" />
            Active Session
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">
                Question <strong className="text-gray-900">{questionNumber}</strong> of <strong className="text-gray-900">{totalQuestions}</strong>
              </span>
            </div>
            <span className="text-xs bg-primary-50 border border-primary-100 text-primary-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              {currentQuestion.skill_tag}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Question Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-6 flex items-start gap-4"
          >
            <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-gray-950 font-semibold text-lg leading-relaxed">
              {currentQuestion.text}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Nudge Hint Alert */}
        <AnimatePresence>
          {hint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 text-sm">
                <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed text-amber-800">
                  <strong className="font-bold text-amber-950 block mb-0.5">Quick Hint</strong>
                  {hint}
                  {hintStreaming && <span className="animate-pulse ml-0.5">|</span>}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea answer input */}
        <div className="relative mb-6">
          <textarea
            ref={textareaRef}
            id="answer-textarea"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your answer details here... (Use Ctrl+Enter as a shortcut to submit)"
            rows={8}
            disabled={isSubmitting}
            className="w-full box-border border border-gray-300 rounded-2xl p-4 md:p-5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white outline-none text-base text-gray-900 placeholder:text-gray-400 shadow-sm transition-all resize-y min-h-[160px] disabled:bg-gray-50 disabled:text-gray-400"
          />
          <span className="absolute bottom-4 right-4 text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
            {answer.length} chars
          </span>
        </div>

        {/* Action button */}
        <div className="space-y-3">
          <button
            id="submit-answer-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !answer.trim()}
            className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all shadow-sm ${
              isSubmitting || !answer.trim()
                ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white active:scale-[0.99] hover:shadow'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span>Saving response and pulling next prompt...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Response</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            Press <kbd className="bg-gray-200 border border-gray-300 text-gray-600 rounded px-1.5 py-0.5 mx-0.5 text-[10px] font-mono shadow-sm">Ctrl</kbd> + <kbd className="bg-gray-200 border border-gray-300 text-gray-600 rounded px-1.5 py-0.5 mx-0.5 text-[10px] font-mono shadow-sm">Enter</kbd> to submit
          </p>

          {error && (
            <p className="text-red-600 text-center text-sm font-semibold mt-2">
              {error}
            </p>
          )}
        </div>

        {/* Exit confirmation modal */}
        <AnimatePresence>
          {showExitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl p-6 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-950 mb-2">Leave practice session?</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  Quitting now will mark this session as abandoned. You can resume this session within 24 hours from the setup dashboard.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowExitModal(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 text-gray-700"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmExit}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-sm"
                  >
                    Leave Session
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}

function AlertTriangle(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
