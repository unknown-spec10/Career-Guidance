import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Send, Lightbulb, Clock, MessageSquare, ChevronRight, XCircle, ArrowLeft,
  Mic, MicOff, Volume2, VolumeX, Play, Square, RefreshCw, CheckCircle
} from 'lucide-react'
import useInterviewSession from '../hooks/useInterviewSession'
import useAudioRecorder from '../hooks/useAudioRecorder'
import VoiceWaveform from '../components/VoiceWaveform'
import { speakQuestion, stopSpeech } from '../utils/speech'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const AUTOSAVE_KEY = 'interview_draft_'

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
    error,
    voiceMode,
    questions,
    currentIndex,
    recoverSession,
    submitAnswer,
    navigateToQuestion,
    finishSession,
  } = useInterviewSession()

  const {
    status: micStatus,
    error: micError,
    recordTime,
    micStream,
    startRecording,
    stopRecording,
    clearRecorder,
  } = useAudioRecorder()

  const [answer, setAnswer] = useState('')
  const [recovered, setRecovered] = useState(false)
  const [recoverError, setRecoverError] = useState(null)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const textareaRef = useRef(null)
  const initialAnswerRef = useRef('')
  const draftKey = currentQuestion ? `${AUTOSAVE_KEY}${sessionId}_${currentQuestion.id}` : ''

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
      const saved = draftKey ? sessionStorage.getItem(draftKey) : null
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
  const handleToggleRecord = async () => {
    if (micStatus === 'idle') {
      stopSpeech() // stop reading question when speaking starts
      initialAnswerRef.current = answer
      await startRecording((liveText) => {
        // Live feedback: show Web Speech transcript on screen immediately as they speak
        const base = initialAnswerRef.current.trim()
        const fullText = base ? `${base}\n${liveText}` : liveText
        setAnswer(fullText)
        if (draftKey) {
          sessionStorage.setItem(draftKey, fullText)
        }
      })
    } else if (micStatus === 'recording') {
      const result = await stopRecording()
      if (result.success && result.text) {
        // High-accuracy Whisper text correction
        const base = initialAnswerRef.current.trim()
        const fullText = base ? `${base}\n${result.text}` : result.text
        setAnswer(fullText)
        if (draftKey) {
          sessionStorage.setItem(draftKey, fullText)
        }
        toast.success('Speech corrected via Whisper!')
      } else if (result.error) {
        // Whisper failed - keep Web Speech transcript (do not block the user)
        toast.warning('Whisper correction failed. Kept live transcript.')
      }
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim()) {
      toast.warning('Please write an answer before submitting.')
      return
    }
    stopSpeech() // stop any active question playback on answer submit
    const result = await submitAnswer(answer.trim())
    if (result?.error) {
      toast.error(result.error)
    } else {
      if (draftKey) {
        sessionStorage.removeItem(draftKey)
      }
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
    stopSpeech()
    // Abandon will trigger on navigate or page close beacon
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
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">
                Question <strong className="text-gray-900">{questionNumber}</strong> of <strong className="text-gray-900">{totalQuestions}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {interviewerPersona && (
                <span className="text-xs bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Interviewer: {interviewerPersona}
                </span>
              )}
              <span className="text-xs bg-primary-50 border border-primary-100 text-primary-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {currentQuestion.skill_tag}
              </span>
            </div>
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
            className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] mb-6 flex flex-col gap-4"
          >
            <div className="flex items-start gap-4 w-full">
              <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-gray-950 font-semibold text-lg leading-relaxed flex-1">
                {currentQuestion.text}
              </p>
            </div>
            
            {voiceMode && (
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100 w-full text-xs font-semibold text-slate-500">
                <button 
                  onClick={handleReplayQuestion}
                  className="inline-flex items-center gap-1.5 hover:text-primary-600 transition-colors bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 shadow-sm"
                  title="Replay question narration"
                >
                  <Volume2 className="w-3.5 h-3.5 text-primary-600" />
                  <span>Replay Narration</span>
                </button>
                <button 
                  onClick={handleToggleMute}
                  className="inline-flex items-center gap-1.5 hover:text-primary-600 transition-colors bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 shadow-sm"
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
            onChange={e => {
              const val = e.target.value
              setAnswer(val)
              if (draftKey) {
                if (val) sessionStorage.setItem(draftKey, val)
                else sessionStorage.removeItem(draftKey)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Write or speak your answer details here... (Use Ctrl+Enter as a shortcut to submit)"
            rows={8}
            disabled={isSubmitting || micStatus === 'recording' || micStatus === 'transcribing'}
            className="w-full box-border border border-gray-300 rounded-2xl p-4 md:p-5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white outline-none text-base text-gray-900 placeholder:text-gray-400 shadow-sm transition-all resize-y min-h-[160px] disabled:bg-slate-50 disabled:text-slate-500"
          />
          <span className="absolute bottom-4 right-4 text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
            {answer.length} chars
          </span>
        </div>

        {/* Voice Recorder Section (Visible only when voiceMode is enabled) */}
        {voiceMode && (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${micStatus === 'recording' ? 'bg-red-500 animate-pulse' : micStatus === 'transcribing' ? 'bg-amber-500 animate-ping' : 'bg-slate-300'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {micStatus === 'recording' ? 'Recording Spoken Response' : micStatus === 'transcribing' ? 'Analyzing Audio via Whisper...' : 'Voice Input Controller'}
                </span>
              </div>
              {micStatus === 'recording' && (
                <span className="text-xs font-mono font-bold bg-red-50 text-red-600 px-2.5 py-1 rounded-full border border-red-100 animate-pulse">
                  {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>

            {/* Display Waveform during active recording */}
            {micStatus === 'recording' && micStream && (
              <VoiceWaveform stream={micStream} width={640} height={90} />
            )}

            {/* Whisper Loading Overlay during transcription */}
            {micStatus === 'transcribing' && (
              <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-2xl border border-slate-200/50">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-600 mb-2" />
                <p className="text-xs text-slate-500 font-semibold">Running high-accuracy audio correction...</p>
              </div>
            )}

            {/* Microphone Action Trigger Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleToggleRecord}
                disabled={micStatus === 'transcribing' || isSubmitting}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all active:scale-[0.99] ${
                  micStatus === 'recording'
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow'
                    : 'bg-primary-50 border border-primary-200 hover:bg-primary-100 text-primary-750'
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
                <div className="text-xs font-semibold text-red-650 bg-red-50/50 border border-red-100 rounded-xl p-3 flex-1 w-full text-center sm:text-left">
                  {micError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation & Finish early bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigateToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0 || isSubmitting}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                currentIndex === 0 || isSubmitting
                  ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 active:scale-[0.98]'
              }`}
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => navigateToQuestion(currentIndex + 1)}
              disabled={currentIndex === totalQuestions - 1 || isSubmitting}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                currentIndex === totalQuestions - 1 || isSubmitting
                  ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 active:scale-[0.98]'
              }`}
            >
              Next →
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowFinishModal(true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-[0.98]"
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
                <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                  Quitting now will mark this session as abandoned. You can resume this session within 24 hours from the setup dashboard.
                </p>
                <div className="bg-red-50 border border-red-100 text-red-800 rounded-2xl p-3.5 text-xs mb-6 text-left space-y-1">
                  <strong className="font-bold block text-red-950">⚠️ Practice Suspension Alert</strong>
                  <p className="leading-relaxed">Exiting ongoing sessions <strong>more than twice a day</strong> will result in the temporary <strong>suspension</strong> of your interview practice privileges.</p>
                </div>
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

        {/* Early finish confirmation modal */}
        <AnimatePresence>
          {showFinishModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-gray-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl p-6 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-650 flex items-center justify-center mx-auto mb-4 border border-primary-100">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-950 mb-2">Finish Interview Early?</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  Are you sure you want to finish this practice session now? Your submitted answers will be graded and summarized, but any unanswered questions will be skipped.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowFinishModal(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 text-gray-700"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmFinish}
                    className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl text-sm shadow-sm active:scale-[0.98]"
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
