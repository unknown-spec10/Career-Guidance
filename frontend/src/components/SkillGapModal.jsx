import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Sparkles, BookOpen, ArrowRight, Play, CheckCircle, 
  Code, AlertCircle, Loader2, Youtube, Terminal, Award, 
  Activity, Check, ExternalLink, Zap, Lightbulb, Compass, Award as MedalIcon
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'

export default function SkillGapModal({ 
  isOpen, 
  onClose, 
  sessionId, 
  initialSkills, 
  targetRole = 'Software Developer',
  experienceLevel = 'junior',
  learningPathId = null,
  onPathGenerated = null,
  onGapAnalysisCompleted = null
}) {
  const toast = useToast()
  
  // Phase state: 'gap' (Phase 1) or 'roadmap' (Phase 2)
  const [phase, setPhase] = useState('gap')
  
  // Phase 1 (Gap Analysis) States
  const [gapStreamBuffer, setGapStreamBuffer] = useState('')
  const [gapStreamDone, setGapStreamDone] = useState(false)
  const [gapStreamError, setGapStreamError] = useState(null)
  const [gapData, setGapData] = useState(null)
  const [activeConsoleLog, setActiveConsoleLog] = useState('Initializing analysis engine...')

  // Phase 2 (Roadmap) States
  const [roadmapLoading, setRoadmapLoading] = useState(false)
  const [roadmapData, setRoadmapData] = useState(null)
  const [playingVideoId, setPlayingVideoId] = useState(null)
  
  const [currentLearningPathId, setCurrentLearningPathId] = useState(null)
  
  const streamRef = useRef(null)

  useEffect(() => {
    setCurrentLearningPathId(learningPathId)
  }, [learningPathId])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Trigger streaming gap analysis on open
  useEffect(() => {
    if (isOpen && sessionId) {
      // Reset state
      setPhase('gap')
      setGapStreamBuffer('')
      setGapStreamDone(false)
      setGapStreamError(null)
      setGapData(null)
      setRoadmapData(null)
      setPlayingVideoId(null)
      setActiveConsoleLog('Establishing AI feedback channel...')
      
      startGapAnalysisStream()
    }
  }, [isOpen, sessionId])

  const startGapAnalysisStream = async () => {
    try {
      const token = secureStorage.getItem('token') || ''
      const response = await fetch(`/api/interview/skill-gap-analysis/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }
      
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      
      // Update logs during streaming to keep user engaged
      const logs = [
        'Synthesizing interview answers...',
        'Cross-referencing resume metadata...',
        'Mapping technical skill scores...',
        'Compiling syntax and architectural gaps...',
        'Evaluating design patterns coverage...',
        'Formulating lightning-fast quick wins...'
      ]
      let logIndex = 0
      const logInterval = setInterval(() => {
        if (logIndex < logs.length) {
          setActiveConsoleLog(logs[logIndex])
          logIndex++
        } else {
          clearInterval(logInterval)
        }
      }, 1200)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawJson = line.substring(6).trim()
            if (rawJson === '[DONE]') {
              setGapStreamDone(true)
              clearInterval(logInterval)
              setActiveConsoleLog('Compilation successful.')
              break
            }
            try {
              const data = JSON.parse(rawJson)
              if (data.error) {
                setGapStreamError(data.error)
              } else if (data.token) {
                accumulated += data.token
                setGapStreamBuffer(accumulated)
              }
            } catch (e) {
              // Ignore malformed chunks
            }
          }
        }
      }
      
      setGapStreamDone(true)
      clearInterval(logInterval)

      // Try parsing the final accumulated buffer
      try {
        const cleanedBuffer = cleanJsonBuffer(accumulated)
        console.log("Structured Skill Gap Analysis JSON compiled from Groq:", cleanedBuffer)
        const parsed = JSON.parse(cleanedBuffer)
        setGapData(parsed)
        if (onGapAnalysisCompleted) {
          onGapAnalysisCompleted()
        }
      } catch (err) {
        console.error('Failed to parse final JSON:', err, accumulated)
        setGapStreamError('Could not process structured gap analysis format. Please try again.')
      }

    } catch (err) {
      console.error('Stream error:', err)
      setGapStreamError(err.message || 'Network error streaming gap analysis.')
    }
  }

  // Helper to remove any markdown tags or leading text if the LLM output was slightly messy
  const cleanJsonBuffer = (str) => {
    let clean = str.trim()
    if (clean.startsWith('```')) {
      clean = clean.split('```')[1]
      if (clean.startsWith('json')) {
        clean = clean.substring(4)
      }
    }
    return clean.trim()
  }

  // Handle generating / fetching the learning path (Phase 2)
  const handleGeneratePath = async () => {
    setRoadmapLoading(true)
    setPhase('roadmap')
    
    try {
      // 1. Post to generate learning path
      const response = await api.post(`/api/interview/generate-learning-path/${sessionId}`)
      const pathId = response.data.path_id
      setCurrentLearningPathId(pathId)
      if (onPathGenerated) {
        onPathGenerated(pathId)
      }
      
      // 2. Fetch full learning path data
      const pathDetailResponse = await api.get(`/api/learning-paths/${pathId}`)
      setRoadmapData(pathDetailResponse.data)
      
      toast.addToast({
        title: response.data.already_exists ? 'Fetched Cached Path' : 'Path Generated!',
        description: response.data.already_exists 
          ? 'Loaded your existing cached study roadmap.' 
          : 'Charged 10 credits. Your roadmap is ready!',
        type: 'success'
      })
    } catch (err) {
      console.error('Error generating roadmap:', err)
      const msg = err.response?.data?.detail || 'Failed to generate pathway.'
      setPhase('gap') // return to gap analysis if failed
      toast.addToast({
        title: 'Roadmap Generation Failed',
        description: msg,
        type: 'error'
      })
    } finally {
      setRoadmapLoading(false)
    }
  }

  // Find color schemes for scores
  const getScoreColor = (score) => {
    if (score >= 0.8) return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-150', bar: 'bg-green-500' }
    if (score >= 0.6) return { text: 'text-indigo-650', bg: 'bg-indigo-50', border: 'border-indigo-150', bar: 'bg-indigo-500' }
    if (score >= 0.4) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-150', bar: 'bg-amber-500' }
    return { text: 'text-red-650', bg: 'bg-red-50', border: 'border-red-150', bar: 'bg-red-500' }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
        >
          {/* Modal Box */}
          <motion.div 
            initial={{ scale: 0.95, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-800 font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-150 bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-650">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-750 bg-clip-text text-transparent">
                    {phase === 'gap' ? 'AI Skill Gap Interpretation' : 'Personalized Learning Pathway'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target Role: <span className="text-indigo-600 font-semibold">{targetRole}</span> ({experienceLevel})
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-750 border border-slate-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scroll Container */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-slate-50/20">
              
              {phase === 'gap' && (
                <div className="space-y-8">
                  {/* Skill Progress Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450 mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      Mock Performance Scorecard
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {initialSkills.map(({ skill, score, label }) => {
                        const scheme = getScoreColor(score)
                        const parsedGap = gapData?.skills?.find(s => s.skill.toLowerCase() === skill.toLowerCase())
                        
                        return (
                          <div 
                            key={skill} 
                            className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-indigo-150/60 shadow-[0_2px_8px_rgba(0,0,0,0.015)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.025)] transition-all flex flex-col justify-between space-y-4"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-slate-900">{skill}</span>
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${scheme.bg} ${scheme.border} ${scheme.text}`}>
                                  {Math.round(score * 100)}% · {label}
                                </span>
                              </div>
                              <div className="h-2 bg-slate-105 rounded-full overflow-hidden mb-4">
                                <motion.div
                                  className={`h-full rounded-full ${scheme.bar}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.round(score * 100)}%` }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                />
                              </div>

                              {/* Live/Streaming detailed content mapping */}
                              <div className="text-sm">
                                {parsedGap ? (
                                  <div className="space-y-3.5 mt-2">
                                    <p className="text-slate-650 text-xs sm:text-sm leading-relaxed border-l-2 border-indigo-500/20 pl-3">
                                      {parsedGap.why_it_matters}
                                    </p>
                                    
                                    {parsedGap.key_gaps && parsedGap.key_gaps.length > 0 && (
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">Key Gaps</span>
                                        <div className="flex flex-wrap gap-1.5">
                                          {parsedGap.key_gaps.map((gap, i) => (
                                            <span 
                                              key={i} 
                                              className="px-2.5 py-0.5 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-semibold rounded"
                                            >
                                              {gap}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : !gapStreamDone ? (
                                  <div className="space-y-2 mt-2">
                                    <div className="h-3.5 bg-slate-100 rounded animate-pulse w-5/6" />
                                    <div className="h-3.5 bg-slate-100 rounded animate-pulse w-3/4" />
                                    <div className="h-3.5 bg-slate-100 rounded animate-pulse w-1/2" />
                                  </div>
                                ) : (
                                  // Verified Proficient State (No gaps identified from JSON)
                                  <div className="space-y-3.5 mt-2">
                                    <p className="text-slate-500 text-xs sm:text-sm leading-relaxed border-l-2 border-emerald-500/20 pl-3">
                                      Verified Proficient — No significant conceptual gaps identified. You demonstrated solid, complete command of this topic during the technical practice session.
                                    </p>
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-450 block uppercase mb-1">Skill Status</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[11px] font-semibold rounded flex items-center gap-1">
                                          <Check className="w-3 h-3 text-emerald-500" />
                                          Strong Competence
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Quick win block or Proficient badge */}
                            {parsedGap?.quick_win ? (
                              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 flex gap-2.5 items-start mt-4">
                                <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5 animate-pulse" />
                                <div>
                                  <span className="text-[10px] font-bold text-indigo-650 block uppercase">Quick Win</span>
                                  <p className="text-xs text-slate-700 leading-relaxed mt-0.5">{parsedGap.quick_win}</p>
                                </div>
                              </div>
                            ) : gapStreamDone ? (
                              <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 flex gap-2.5 items-start mt-4">
                                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[10px] font-bold text-emerald-600 block uppercase">Continuous Growth</span>
                                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">Maintain this strength! Apply your proficiency to advanced design challenges and architectural practice.</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Compiling active diagnosis log indicator (raw JSON console hidden) */}
                  {!gapStreamDone && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-indigo-50/30 border border-indigo-150 rounded-2xl p-5 flex items-center justify-between shadow-sm relative overflow-hidden backdrop-blur"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600 animate-pulse" />
                      <div className="flex items-center gap-4">
                        <div className="relative flex items-center justify-center flex-shrink-0">
                          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 absolute animate-pulse" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">AI Technical Reasoner Active</span>
                          <p className="text-xs sm:text-sm font-semibold text-slate-750 mt-0.5 animate-pulse">
                            {activeConsoleLog}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider hidden sm:inline-block">
                        COMPILING KNOWLEDGE GRAPH • GROQ STREAM
                      </span>
                    </motion.div>
                  )}

                  {/* Overall Verdict Panel (Visible only when parsed successfully) */}
                  {gapData?.overall_verdict && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-indigo-600" />
                          <h4 className="font-bold text-slate-800">AI Executive Verdict</h4>
                        </div>
                        <p className="text-slate-650 text-sm leading-relaxed max-w-3xl font-normal">
                          {gapData.overall_verdict}
                        </p>
                      </div>
                      
                      {gapData.priority_order && gapData.priority_order.length > 0 && (
                        <div className="flex-shrink-0 min-w-[200px] border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-5 space-y-2">
                          <span className="text-[10px] font-bold text-slate-450 block uppercase tracking-wider">Priority Roadmap Order</span>
                          <ol className="space-y-1 text-xs">
                            {gapData.priority_order.map((skill, index) => (
                              <li key={index} className="flex items-center gap-2 text-slate-750 font-medium">
                                <span className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                                  {index + 1}
                                </span>
                                {skill}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {phase === 'roadmap' && (
                <div className="space-y-10">
                  {roadmapLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-6">
                      <div className="relative flex items-center justify-center">
                        <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
                        <Compass className="w-6 h-6 text-indigo-500 absolute animate-pulse" />
                      </div>
                      <div className="text-center space-y-2">
                        <h4 className="text-lg font-bold text-slate-800">Constructing Your Interactive Journey</h4>
                        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                          Performing YouTube API search discovery, fetching video stats, computing quality scoring parameters, and organizing LeetCode practice problem sets. This can take ~10 seconds.
                        </p>
                      </div>
                    </div>
                  ) : (
                    roadmapData && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Flowchart Timeline (Left Column: 2-span) */}
                        <div className="lg:col-span-2 space-y-8">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450 mb-6 flex items-center gap-2">
                            <Compass className="w-4 h-4 text-indigo-500" />
                            Vertical Flowchart Milestone Roadmap
                          </h4>
                          
                          <div className="relative pl-8 border-l border-slate-200 space-y-12 ml-4">
                            {roadmapData.topics_outline?.map((stage, idx) => {
                              const isVideoPlaying = playingVideoId === stage.video?.video_id

                              return (
                                <motion.div 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.1 }}
                                  key={idx} 
                                  className="relative group"
                                >
                                  {/* Week Node Bubble */}
                                  <div className="absolute -left-[45px] top-0.5 w-8 h-8 rounded-full bg-white border-2 border-indigo-650 flex items-center justify-center text-xs font-bold text-indigo-650 group-hover:bg-indigo-650 group-hover:text-white transition-all shadow-sm">
                                    {idx + 1}
                                  </div>

                                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 hover:border-indigo-150 hover:bg-slate-50/10 transition-all space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                                    {/* Week Badge + Skill focus */}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-55 border border-indigo-100 text-indigo-750">
                                        {stage.week}
                                      </span>
                                      <h5 className="text-base font-bold text-slate-800 flex-1 pl-1">
                                        {stage.skill_focus}
                                      </h5>
                                    </div>

                                    {/* Action instructions */}
                                    <p className="text-sm text-slate-650 leading-relaxed border-l-2 border-slate-150 pl-3.5 font-normal">
                                      {stage.action}
                                    </p>

                                    {/* Why recommended & What it achieves explanations */}
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 border border-slate-200 rounded-xl p-4 text-xs sm:text-sm">
                                      {stage.why_recommended && (
                                        <div className="space-y-1">
                                          <span className="font-bold text-indigo-700 flex items-center gap-1.5">
                                            <Lightbulb className="w-3.5 h-3.5" />
                                            Why Recommended
                                          </span>
                                          <p className="text-slate-600 leading-relaxed font-normal">
                                            {stage.why_recommended}
                                          </p>
                                        </div>
                                      )}
                                      {stage.what_it_achieves && (
                                        <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                                          <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            What It Achieves
                                          </span>
                                          <p className="text-slate-600 leading-relaxed font-normal">
                                            {stage.what_it_achieves}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    {/* In-app Autoplay YouTube IFrame Player Pattern */}
                                    {stage.video && (
                                      <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-100 relative">
                                        {isVideoPlaying ? (
                                          <div className="aspect-video w-full">
                                            <iframe
                                              src={`https://www.youtube.com/embed/${stage.video.video_id}?autoplay=1`}
                                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                              allowFullScreen
                                              title={stage.video.title}
                                              className="w-full h-full border-0"
                                            />
                                          </div>
                                        ) : (
                                          <div 
                                            onClick={() => setPlayingVideoId(stage.video.video_id)}
                                            className="relative aspect-video w-full overflow-hidden cursor-pointer group/thumb bg-slate-50"
                                          >
                                            <img 
                                              src={stage.video.thumbnail_url} 
                                              alt={stage.video.title}
                                              className="w-full h-full object-cover opacity-90 group-hover/thumb:scale-101 transition-transform duration-300"
                                            />
                                            {/* Video Metadata Panel overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-between p-4">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white/95 rounded border border-slate-200 text-slate-700 backdrop-blur-sm">
                                                  {stage.video.channel_title}
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white/95 rounded border border-slate-200 text-slate-700 backdrop-blur-sm">
                                                  {stage.video.duration_minutes} Mins
                                                </span>
                                              </div>
                                              
                                              <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-650 group-hover/thumb:bg-indigo-700 text-white flex items-center justify-center shadow-lg transition-colors flex-shrink-0">
                                                  <Play className="w-5 h-5 fill-current ml-0.5" />
                                                </div>
                                                <p className="text-xs sm:text-sm font-semibold text-white line-clamp-2 pr-1.5 leading-snug drop-shadow pr-2">
                                                  {stage.video.title}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Projects & Practice (Right Column: 1-span) */}
                        <div className="space-y-6">
                          
                          {/* Recommended Projects */}
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-2">
                              <Code className="w-4 h-4 text-indigo-500" />
                              Interactive Projects
                            </h4>
                            
                            <div className="space-y-4">
                              {roadmapData.recommended_projects?.map((proj, idx) => (
                                <div 
                                  key={idx} 
                                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-150 transition-all space-y-2.5 shadow-[0_2px_6px_rgba(0,0,0,0.01)]"
                                >
                                  <h5 className="font-bold text-slate-800 text-sm">{proj.title}</h5>
                                  <p className="text-xs text-slate-500 leading-relaxed font-normal">
                                    {proj.description}
                                  </p>
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {proj.skills_practiced?.map(skill => (
                                      <span 
                                        key={skill} 
                                        className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[10px] font-bold text-indigo-650"
                                      >
                                        {skill}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* LeetCode Practice Problems */}
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-2">
                              <MedalIcon className="w-4 h-4 text-indigo-500" />
                              Practice Challenges
                            </h4>
                            
                            <div className="space-y-3">
                              {roadmapData.practice_problems?.map((prob, idx) => {
                                const isHard = prob.difficulty?.toLowerCase() === 'hard'
                                const isMed = prob.difficulty?.toLowerCase() === 'medium'
                                const diffColor = isHard 
                                  ? 'bg-red-50 border-red-100 text-red-650' 
                                  : isMed 
                                    ? 'bg-amber-50 border-amber-100 text-amber-650' 
                                    : 'bg-green-50 border-green-100 text-green-650'

                                return (
                                  <a 
                                    key={idx} 
                                    href={prob.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50/50 border border-slate-200 rounded-xl transition-all hover:border-indigo-150 group shadow-[0_2px_6px_rgba(0,0,0,0.01)]"
                                  >
                                    <div className="space-y-1 pr-3">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block">
                                        {prob.platform || 'LeetCode'}
                                      </span>
                                      <h5 className="font-bold text-slate-800 text-xs sm:text-sm group-hover:text-indigo-600 line-clamp-1 leading-snug">
                                        {prob.title}
                                      </h5>
                                    </div>
                                    <div className="flex items-center gap-2.5 flex-shrink-0">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${diffColor}`}>
                                        {prob.difficulty}
                                      </span>
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                    </div>
                                  </a>
                                )
                              })}
                            </div>
                          </div>

                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] font-bold text-slate-450 tracking-wider flex items-center gap-1">
                <MedalIcon className="w-3.5 h-3.5" />
                POWERED BY LLaMA-3 TECHNICAL REASONING
              </span>

              {phase === 'gap' ? (
                currentLearningPathId ? (
                  <button
                    onClick={handleGeneratePath}
                    disabled={!gapStreamDone || !!gapStreamError}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-98"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>View Your Interactive Learning Path</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleGeneratePath}
                    disabled={!gapStreamDone || !!gapStreamError}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Build Interactive Pathway (10 Credits)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )
              ) : (
                <button
                  onClick={() => {
                    onClose()
                    // Navigate to study roadmap dashboard list or path if saved
                    if (roadmapData?.id) {
                      window.location.href = `/dashboard/learning-path/${roadmapData.id}`
                    }
                  }}
                  disabled={roadmapLoading}
                  className="px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-200 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to Dashboard & Close</span>
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
