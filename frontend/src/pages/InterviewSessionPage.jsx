import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, Lightbulb, Clock, MessageSquare, ChevronRight, XCircle, ArrowLeft,
  Mic, MicOff, Volume2, VolumeX, Play, Square, RefreshCw, CheckCircle
} from 'lucide-react'
import useInterviewSession from '../hooks/useInterviewSession'
import useAudioRecorder, { MAX_RECORD_SECONDS } from '../hooks/useAudioRecorder'
import VoiceWaveform from '../components/VoiceWaveform'
import { speakQuestion, stopSpeech, isTtsSupported } from '../utils/speech'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import Spinner from '../components/Spinner'

const AUTOSAVE_KEY = 'interview_draft_'
const ANSWER_MAX_LENGTH = 5000 // mirrors schemas.py AnswerRequest max_length

export default function InterviewSessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    interviewerPersona,
    sessionId: activeSessionId,
    currentQuestion,
    questionNumber,
    totalQuestions,
    isSubmitting,
    isComplete,
    hint,
    hintStreaming,
    hintError,
    lastAnswerId,
    retryAfter,
    error,
    voiceMode,
    questions,
    currentIndex,
    recoverSession,
    submitAnswer,
    streamHint,
    navigateToQuestion,
    finishSession,
    quitSession,
  } = useInterviewSession()

  const {
    status: micStatus,
    error: micError,
    recordTime,
    recordLimit,
    recordLimitHit,
    micStream,
    isSpeechSupported,
    startRecording,
    stopRecording,
    clearRecorder,
  } = useAudioRecorder()

  const [answer, setAnswer] = useState('')
  const [recovered, setRecovered] = useState(false)
  const [recoverError, setRecoverError] = useState(null)
  const [isAbandoned, setIsAbandoned] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [sessionElapsed, setSessionElapsed] = useState(0)
  const [rateCountdown, setRateCountdown] = useState(0)
  const textareaRef = useRef(null)
  const initialAnswerRef = useRef('')
  const draftKey = currentQuestion ? `${AUTOSAVE_KEY}${sessionId}_${currentQuestion.id}` : ''
  const hintsDisabled = interviewerPersona === 'Tough FAANG Interviewer'

  // -------------------------------------------------------------------------
  // On mount: recover session from URL param if no active session in state
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (sessionId && !activeSessionId) {
      recoverSession(sessionId).then(result => {
        if (!result.success) {
          if (result.redirect === 'results') {
            navigate(`/dashboard/interview/results/${sessionId}`, { replace: true })
          } else if (result.redirect === 'abandoned') {
            setIsAbandoned(true)
          } else if (result.redirect === 'setup') {
            setIsExpired(true)
          } else {
            setRecoverError(result.error || 'Session not found.')
          }
        } else {
          setRecovered(true)
        }
      })
    }
  }, [sessionId, activeSessionId, recoverSession, navigate])

  // Session pacing timer (L2): elapsed time since the page mounted, plus
  // the server's 24h active-window notice.
  useEffect(() => {
    if (isComplete) return
    const t = setInterval(() => setSessionElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [isComplete])

  // 429 countdown display (M9): tick the server-provided wait down locally.
  useEffect(() => {
    if (!retryAfter) {
      setRateCountdown(0)
      return
    }
    setRateCountdown(retryAfter)
    const t = setInterval(() => {
      setRateCountdown(s => {
        if (s <= 1) {
          clearInterval(t)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [retryAfter])

  const formatElapsed = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Scroll textarea into view and focus on question change, restoring previous answers if they exist
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
    
    const activeIndex = questionNumber - 1
    const activeQ = questions && questions[activeIndex]
    
    if (activeQ && activeQ.user_answer) {
      setAnswer(activeQ.user_answer)
    } else {
      const saved = draftKey ? localStorage.getItem(draftKey) : null
      setAnswer(saved || '')
    }
  }, [currentQuestion?.id, questions, questionNumber, draftKey])

  // Navigate to results when complete
  useEffect(() => {
    if (isComplete) {
      stopSpeech()
      setTimeout(() => {
        navigate(`/dashboard/interview/results/${sessionId || activeSessionId}`)
      }, 1500)
    }
  }, [isComplete, sessionId, activeSessionId, navigate])

  // -------------------------------------------------------------------------
  // Text-To-Speech: Automatically read question when voice mode is enabled
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (voiceMode && currentQuestion && !isMuted) {
      speakQuestion(currentQuestion.text)
    }
    return () => {
      stopSpeech()
    }
  }, [currentQuestion?.id, voiceMode, isMuted])

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false)
      if (currentQuestion) speakQuestion(currentQuestion.text)
      toast.success('TTS voice narration unmuted.')
    } else {
      setIsMuted(true)
      stopSpeech()
      toast.info('TTS voice narration muted.')
    }
  }

  const handleReplayQuestion = () => {
    setIsMuted(false)
    if (currentQuestion) speakQuestion(currentQuestion.text)
  }

  // -------------------------------------------------------------------------
  // Speech-To-Text: Audio recording toggler using Groq Whisper API
  // -------------------------------------------------------------------------
  // Shared handler for both manual stops and the recording-cap auto-stop.
  const handleTranscribeResult = (result, { capped = false } = {}) => {
    if (result.success && result.text) {
      // High-accuracy Whisper text correction
      const base = initialAnswerRef.current.trim()
      const fullText = base ? `${base}\n${result.text}` : result.text
      setAnswer(fullText.slice(0, ANSWER_MAX_LENGTH))
      if (draftKey) {
        localStorage.setItem(draftKey, fullText.slice(0, ANSWER_MAX_LENGTH))
      }
      if (result.mock) {
        // Mock mode is labeled as such — never presented as real Whisper output.
        toast.warning('Mock transcription (demo mode). Review the text before submitting.')
      } else {
        toast.success(capped ? 'Recording reached the time limit. Speech corrected via Whisper!' : 'Speech corrected via Whisper!')
      }
    } else if (result.error) {
      // Whisper failed - keep Web Speech transcript (do not block the user)
      if (capped) toast.warning('Recording reached the time limit. Whisper correction failed. Kept live transcript.')
      else toast.warning('Whisper correction failed. Kept live transcript.')
    }
  }

  const handleRecordLimit = async () => {
    const result = await stopRecording()
    handleTranscribeResult(result, { capped: true })
  }

  const handleToggleRecord = async () => {
    if (micStatus === 'idle') {
      stopSpeech() // stop reading question when speaking starts
      initialAnswerRef.current = answer
      await startRecording((liveText) => {
        // Live feedback: show Web Speech transcript on screen immediately as they speak
        const base = initialAnswerRef.current.trim()
        const fullText = base ? `${base}\n${liveText}` : liveText
        setAnswer(fullText.slice(0, ANSWER_MAX_LENGTH))
        if (draftKey) {
          localStorage.setItem(draftKey, fullText.slice(0, ANSWER_MAX_LENGTH))
        }
      }, handleRecordLimit)
    } else if (micStatus === 'recording') {
      const result = await stopRecording()
      handleTranscribeResult(result)
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim()) {
      toast.warning('Please write an answer before submitting.')
      return
    }
    if (answer.trim().length > ANSWER_MAX_LENGTH) {
      toast.error(`Answers are limited to ${ANSWER_MAX_LENGTH} characters. Please shorten yours.`)
      return
    }
    stopSpeech() // stop any active question playback on answer submit
    const result = await submitAnswer(answer.trim())
    if (result?.error) {
      toast.error(result.error)
    } else {
      if (draftKey) {
        localStorage.removeItem(draftKey)
      }
    }
  }

  const handleHint = async () => {
    if (!lastAnswerId) {
      toast.warning('Submit an answer first, then ask for a hint.')
      return
    }
    const result = await streamHint(lastAnswerId)
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

  const handleConfirmExit = async () => {
    stopSpeech()
    setShowExitModal(false)
    // Explicitly abandon the session via authenticated API call, then navigate.
    // A failed quit must not navigate away — the session is still live.
    const result = await quitSession()
    if (result?.error) {
      toast.error(result.error)
      return
    }
    navigate('/dashboard/interview', { replace: true })
  }

  const handleConfirmFinish = async () => {
    stopSpeech()
    setShowFinishModal(false)
    const result = await finishSession()
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Completing interview practice early...')
    }
  }

  // Answered-based progress (L1): reaches 100% when every question is answered.
  const answeredCount = questions ? questions.filter(q => q.user_answer).length : 0
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0

  // -------------------------------------------------------------------------
  // Error / recovery states
  // -------------------------------------------------------------------------
  if (isAbandoned) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="font-display text-title text-ink mb-2">Session Abandoned</h2>
          <p className="text-body text-ink-muted mb-6 leading-relaxed">
            You left this practice session early, so it was marked as abandoned and can&apos;t be resumed.
            Your submitted answers were kept. Start a fresh session to continue practicing.
          </p>
          <button
            onClick={() => navigate('/dashboard/interview')}
            className="app-btn-primary w-full"
          >
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="font-display text-title text-ink mb-2">Session Expired</h2>
          <p className="text-body text-ink-muted mb-6 leading-relaxed">
            This session is no longer active and can&apos;t be resumed.
            Sessions expire after 24 hours. Start a fresh session to continue practicing.
          </p>
          <button
            onClick={() => navigate('/dashboard/interview')}
            className="app-btn-primary w-full"
          >
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  if (recoverError) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <div className="surface-card p-8 max-w-sm w-full text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="font-display text-title text-ink mb-2">Session Not Found</h2>
          <p className="text-body text-ink-muted mb-6">{recoverError}</p>
          <button 
            onClick={() => navigate('/dashboard/interview')}
            className="app-btn-primary w-full"
          >
            Start New Interview
          </button>
        </div>
      </div>
    )
  }

  if (!currentQuestion && !isComplete) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-pill animate-spin" />
          <p className="text-caption text-ink-muted font-medium">Restoring practice session...</p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Interview Complete state
  // -------------------------------------------------------------------------
  if (isComplete) {
    return (
      <div className="flex items-center justify-center py-16 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="surface-card p-8 max-w-sm w-full text-center"
        >
          <span className="text-4xl block mb-4">🎉</span>
          <h2 className="font-display text-title text-ink mb-2">Session Complete!</h2>
          <p className="text-body text-ink-muted mb-6 leading-relaxed">
            Evaluating your responses in the background. Generating your personalized study plan...
          </p>
          <div className="flex items-center justify-center gap-2 text-caption font-semibold text-primary-700 bg-primary-50 rounded-card py-2 px-4 inline-flex">
            <div className="w-3.5 h-3.5 border-2 border-primary-600 border-t-transparent rounded-pill animate-spin" />
            <span>Redirecting to score report...</span>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative pb-8">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="mx-auto w-full max-w-container-max">
        
        {/* Sticky session header: quit action + pacing timer stay visible while scrolling */}
        <div className="sticky -top-4 md:-top-8 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-6 bg-canvas backdrop-blur-sm border-b border-hairline">
          <div className="flex items-center justify-between gap-2 flex-wrap max-w-container-max mx-auto">
          <button 
            onClick={() => setShowExitModal(true)}
            className="inline-flex items-center gap-1 text-caption font-semibold text-ink-muted hover:text-red-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quit Practice
          </button>
          
          <div className="flex items-center gap-2 text-caption bg-surface-sunken border border-hairline text-ink-muted px-3 py-1.5 rounded-pill font-bold" title="Sessions expire 24 hours after creation">
            <Clock className="w-3.5 h-3.5" />
            Active Session · {formatElapsed(sessionElapsed)}
          </div>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              <span className="text-caption font-medium text-ink">
                Question <strong className="text-ink">{questionNumber}</strong> of <strong className="text-ink">{totalQuestions}</strong>
              </span>
              <span className="text-[11px] text-ink-muted font-semibold" title="Questions you have submitted an answer for">
                · {answeredCount}/{totalQuestions} answered
              </span>
            </div>
            <div className="flex items-center gap-2">
              {interviewerPersona && (
                <span className="text-caption bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-pill uppercase tracking-wider">
                  Interviewer: {interviewerPersona}
                </span>
              )}
              <span className="text-caption bg-primary-50 border border-primary-100 text-primary-700 font-bold px-2.5 py-1 rounded-pill uppercase tracking-wider">
                {currentQuestion.skill_tag}
              </span>
            </div>
          </div>
          
          <p className="text-[11px] text-ink-muted mt-1 font-normal">
            Sessions expire 24 hours after creation. Pace yourself — about 2–3 minutes per answer.
          </p>

          {/* Progress bar */}
          <div className="h-2 bg-surface-sunken rounded-pill overflow-hidden">
            <motion.div
              className="h-full bg-primary-600 rounded-pill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Two-column session layout: question rail + answer workspace.
            Single column below lg, where the rail stacks as a scrollable strip. */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
          {/* Question rail: per-question answered state from existing data. */}
          <aside aria-label="Interview questions" className="lg:sticky lg:top-6 surface-card p-4">
            <div className="flex items-center justify-between px-1 mb-3">
              <h2 className="text-overline uppercase text-ink">
                Questions
              </h2>
              <span className="text-[11px] font-bold text-ink-muted">
                {answeredCount}/{totalQuestions} answered
              </span>
            </div>
            <ol className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
              {questions?.map((q, idx) => {
                const answered = !!q.user_answer
                const isCurrent = idx === currentIndex
                return (
                  <li key={q.id || idx} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => navigateToQuestion(idx)}
                      disabled={isSubmitting}
                      aria-current={isCurrent ? 'true' : undefined}
                      title={answered ? `Question ${q.question_number || idx + 1}: answered` : `Question ${q.question_number || idx + 1}: not answered yet`}
                      className={`flex items-center gap-2.5 rounded-card border px-3 py-2.5 text-left text-caption font-semibold transition-all w-full min-w-[150px] lg:min-w-0 ${
                        isCurrent
                          ? 'border-primary bg-primary-50 text-primary-700 dark:text-primary-600'
                          : answered
                            ? 'border-hairline hover:bg-surface-sunken text-ink'
                            : 'border-hairline hover:bg-surface-sunken text-ink-muted'
                      } ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className={`flex items-center justify-center w-6 h-6 rounded-pill text-[11px] font-bold shrink-0 ${
                        answered
                          ? 'bg-emerald-100 text-emerald-700'
                          : isCurrent
                            ? 'bg-primary-600 text-white'
                            : 'bg-surface-sunken text-ink-muted'
                      }`}>
                        {answered ? '✓' : (q.question_number || idx + 1)}
                      </span>
                      <span className="truncate">Question {q.question_number || idx + 1}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </aside>

          {/* Answer workspace */}
          <div className="min-w-0">

        {/* Question Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="surface-card p-6 sm:p-8 mb-6 flex flex-col gap-4"
          >
            <div className="flex items-start gap-4 w-full">
              <div className="p-2.5 bg-primary-50 text-primary-600 rounded-card flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-ink font-semibold text-body-lg leading-relaxed flex-1 min-w-0 break-words">
                {currentQuestion.text}
              </p>
            </div>
            
            {voiceMode && (
              <div className="flex items-center gap-3 pt-3 border-t border-hairline w-full text-caption font-semibold text-ink-muted flex-wrap">
                <button 
                  onClick={handleReplayQuestion}
 className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-primary-600 transition-colors bg-surface-sunken hover:bg-surface-raised border border-hairline rounded-card px-3 py-2 shadow-soft-xs"
                  title="Replay question narration"
                >
                  <Volume2 className="w-3.5 h-3.5 text-primary-600" />
                  <span>Replay Narration</span>
                </button>
                <button 
                  onClick={handleToggleMute}
 className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-primary-600 transition-colors bg-surface-sunken hover:bg-surface-raised border border-hairline rounded-card px-3 py-2 shadow-soft-xs"
                  title={isMuted ? "Unmute narration" : "Mute narration"}
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-red-500" />
                      <span>Narration Paused</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Narration Active</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Hint trigger + display: wired to the last submitted answer (H1/H2).
            Hidden for the Tough FAANG persona, which offers no hints. */}
        {!hintsDisabled && lastAnswerId && !hint && !hintError && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handleHint}
              disabled={hintStreaming || isSubmitting}
              className="inline-flex items-center gap-1.5 text-caption font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-card px-3.5 py-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lightbulb className="w-4 h-4" />
              <span>{hintStreaming ? 'Getting hint...' : 'Get a Hint'}</span>
            </button>
          </div>
        )}

        {/* Nudge Hint Alert */}
        <AnimatePresence>
          {(hint || hintStreaming) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-card p-4 flex gap-3 text-body">
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

        {hintError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-card p-4 flex gap-3 text-body">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-bold block mb-0.5">Couldn&apos;t load hint</strong>
              <p className="leading-relaxed">{hintError}</p>
              <button
                type="button"
                onClick={handleHint}
                className="mt-2 text-xs font-bold underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Textarea answer input */}
        <div className="relative mb-6">
          <textarea
            ref={textareaRef}
            id="answer-textarea"
            value={answer}
            maxLength={ANSWER_MAX_LENGTH}
            onChange={e => {
              const val = e.target.value.slice(0, ANSWER_MAX_LENGTH)
              setAnswer(val)
              if (draftKey) {
                if (val) localStorage.setItem(draftKey, val)
                else localStorage.removeItem(draftKey)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Write or speak your answer details here... (Use Ctrl+Enter as a shortcut to submit)"
            rows={8}
            disabled={isSubmitting || micStatus === 'recording' || micStatus === 'transcribing'}
            className="app-textarea min-h-[160px] resize-y pb-10 disabled:bg-surface-sunken disabled:text-ink-muted"
          />
          <span className={`absolute bottom-4 right-4 text-caption font-semibold px-2 py-1 rounded-card border ${answer.length >= ANSWER_MAX_LENGTH ? 'text-red-600 bg-red-50 border-red-200' : 'text-ink-muted bg-surface-sunken border-hairline'}`}>
            {answer.length} / {ANSWER_MAX_LENGTH} chars
          </span>
        </div>

        {/* Voice capability warnings (M4/L3): recording without live
            captions, or voice mode without TTS, gets an explicit notice. */}
        {voiceMode && !isSpeechSupported && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-card p-4 text-caption font-semibold leading-relaxed">
            Your browser doesn&apos;t support live speech captions, so recording will capture audio without on-screen text.
            You can still record — transcription runs server-side after you stop.
          </div>
        )}
        {voiceMode && !isTtsSupported() && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-card p-4 text-caption font-semibold leading-relaxed">
            Your browser doesn&apos;t support voice narration, so questions won&apos;t be read aloud. You can still read and answer them here.
          </div>
        )}

        {/* Voice Recorder Section (Visible only when voiceMode is enabled) */}
        {voiceMode && (
          <div className="surface-card p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-pill ${micStatus === 'recording' ? 'bg-red-500 animate-pulse' : micStatus === 'transcribing' ? 'bg-amber-500 animate-ping' : 'bg-hairline-strong'}`} />
                <span className="text-caption font-bold uppercase tracking-wider text-ink-muted">
                  {micStatus === 'recording' ? 'Recording Spoken Response' : micStatus === 'transcribing' ? 'Analyzing Audio via Whisper...' : 'Voice Input Controller'}
                </span>
              </div>
              {micStatus === 'recording' && (
                <span className="text-caption font-mono font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-pill border border-red-100 animate-pulse" title={`Recordings auto-stop at ${recordLimit}s`}>
                  {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')} / {Math.floor(recordLimit / 60)}:{(recordLimit % 60).toString().padStart(2, '0')} max
                </span>
              )}
            </div>

            {/* Display Waveform during active recording */}
            {micStatus === 'recording' && micStream && (
              <VoiceWaveform stream={micStream} height={90} />
            )}

            {/* Whisper Loading Overlay during transcription */}
            {micStatus === 'transcribing' && (
              <div className="flex flex-col items-center justify-center py-6 bg-surface-sunken rounded-card border border-hairline">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mb-2" />
                <p className="text-caption text-ink-muted font-semibold">Running high-accuracy audio correction...</p>
              </div>
            )}

            {/* Microphone Action Trigger Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleToggleRecord}
                disabled={micStatus === 'transcribing' || isSubmitting}
                className={`w-full py-3.5 px-6 rounded-card font-bold text-caption flex items-center justify-center gap-2.5 shadow-soft-xs transition-all active:scale-[0.99] ${
                  micStatus === 'recording'
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow'
                    : 'bg-primary-50 border border-primary-200 hover:bg-primary-100 text-primary-700 dark:text-primary-600'
                }`}
              >
                {micStatus === 'recording' ? (
                  <>
                    <Square className="w-4 h-4 fill-current animate-pulse" />
                    <span>Stop Recording & Transcribe</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>{answer.trim() ? 'Record Additional Response' : 'Start Speaking Answer'}</span>
                  </>
                )}
              </button>

              {micError && (
                <div className="text-caption font-semibold text-red-650 bg-red-50/50 border border-red-100 rounded-card p-3 flex-1 w-full text-center sm:text-left">
                  {micError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation & Finish early bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 surface-card p-4">
          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigateToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0 || isSubmitting}
              title={questions?.[currentIndex - 1]?.user_answer ? 'Answered ✓' : 'Not answered yet'}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 sm:flex-none ${ currentIndex === 0 || isSubmitting ? 'h-9 px-3 text-xs rounded-card bg-surface-sunken border border-hairline text-ink-subtle cursor-not-allowed' : 'app-btn-secondary app-btn-sm' }`}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span>Previous{questions?.[currentIndex - 1]?.user_answer ? ' ✓' : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToQuestion(currentIndex + 1)}
              disabled={currentIndex === totalQuestions - 1 || isSubmitting}
              title={questions?.[currentIndex + 1]?.user_answer ? 'Answered ✓' : 'Not answered yet'}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 sm:flex-none ${ currentIndex === totalQuestions - 1 || isSubmitting ? 'h-9 px-3 text-xs rounded-card bg-surface-sunken border border-hairline text-ink-subtle cursor-not-allowed' : 'app-btn-secondary app-btn-sm' }`}
            >
              <span>Next{questions?.[currentIndex + 1]?.user_answer ? ' ✓' : ''}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowFinishModal(true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 bg-ink text-canvas hover:opacity-90 font-bold rounded-card text-caption transition-all shadow-soft-xs active:scale-[0.98]"
          >
            Finish Practice Early
          </button>
        </div>

        {/* Action button */}
        <div className="space-y-3">
          <button
            id="submit-answer-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !answer.trim()}
            aria-busy={isSubmitting}
            className={`w-full font-bold flex items-center justify-center gap-2 transition-all ${ isSubmitting || !answer.trim() ? 'h-11 rounded-card bg-surface-sunken border border-hairline text-ink-subtle cursor-not-allowed' : 'app-btn-primary' }`}
          >
            {isSubmitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4 shrink-0" />}
            <span>Submit Response</span>
          </button>

          <p className="text-center text-caption text-ink-muted">
            Press <kbd className="bg-surface-sunken border border-hairline text-ink-muted rounded-card px-1.5 py-0.5 mx-0.5 text-[10px] font-mono shadow-soft-xs">Ctrl</kbd> + <kbd className="bg-surface-sunken border border-hairline text-ink-muted rounded-card px-1.5 py-0.5 mx-0.5 text-[10px] font-mono shadow-soft-xs">Enter</kbd> to submit
          </p>

          {rateCountdown > 0 && (
            <p className="text-amber-600 text-center text-body font-semibold mt-2">
              Rate limited — please wait {rateCountdown}s before submitting again.
            </p>
          )}

          {error && (
            <p className="text-red-600 text-center text-body font-semibold mt-2">
              {error}
            </p>
          )}
        </div>
        {/* End answer workspace + two-column grid */}
        </div>
        </div>

        {/* Exit confirmation modal */}
        <AnimatePresence>
          {showExitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-panel border border-hairline bg-surface-overlay shadow-soft-xl w-full max-w-sm overflow-hidden p-6 text-center"
              >
                <div className="w-12 h-12 rounded-pill bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="font-display text-title text-ink mb-2">Leave practice session?</h3>
                <p className="text-body text-ink-muted mb-4 leading-relaxed">
                  Quitting now will end this session and mark it as <strong>abandoned</strong> — it cannot be resumed. Exiting more than twice a day triggers the suspension warning below.
                </p>
                <div className="bg-red-50 border border-red-100 text-red-800 rounded-card p-3.5 text-caption mb-6 text-left space-y-1">
                  <strong className="font-bold block text-red-950">⚠️ Practice Suspension Alert</strong>
                  <p className="leading-relaxed">Exiting ongoing sessions <strong>more than twice a day</strong> will result in the temporary <strong>suspension</strong> of your interview practice privileges.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowExitModal(false)}
 className="app-btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmExit}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-card text-caption shadow-soft-xs"
                  >
                    Leave Session
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Early finish confirmation modal */}
        <AnimatePresence>
          {showFinishModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-panel border border-hairline bg-surface-overlay shadow-soft-xl w-full max-w-sm overflow-hidden p-6 text-center"
              >
                <div className="w-12 h-12 rounded-pill bg-primary-50 text-primary-650 flex items-center justify-center mx-auto mb-4 border border-primary-100">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="font-display text-title text-ink mb-2">Finish Interview Early?</h3>
                <p className="text-body text-ink-muted mb-6 leading-relaxed">
                  Are you sure you want to finish this practice session now? Your submitted answers will be graded and summarized, but any unanswered questions will be skipped.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowFinishModal(false)}
 className="app-btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmFinish}
                    className="app-btn-primary flex-1"
                  >
                    Yes, Finish Early
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
