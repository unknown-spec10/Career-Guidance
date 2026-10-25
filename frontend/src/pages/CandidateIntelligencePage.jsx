import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles, Award, TrendingUp, Clock, AlertTriangle, ArrowRight,
  Shield, BrainCircuit, UserCheck, MessageSquare, Zap, BookOpen, Layers, CheckCircle
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { SkeletonStats, SkeletonCard } from '../components/SkeletonLoader'
import { getApiError } from '../utils/apiError'

export default function CandidateIntelligencePage() {
  const navigate = useNavigate()
  const toast = useToast()
  
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchIntelligence = async () => {
      try {
        setLoading(true)
        const res = await api.get('/api/interview/candidate-intelligence')
        if (res.data && res.data.status !== 'no_sessions') {
          setProfile(res.data)
        } else if (res.data && res.data.status === 'no_sessions') {
          setProfile(null)
        }
      } catch (err) {
        console.error('Failed to load candidate intelligence:', err)
        setError(getApiError(err, 'Failed to fetch candidate AI insights.'))
      } finally {
        setLoading(false)
      }
    }
    fetchIntelligence()
  }, [])

  if (loading) {
    return (
      <div className="relative py-8">
        <div className="max-w-7xl mx-auto py-8 space-y-6">
          <div className="h-12 w-1/3 bg-surface-sunken animate-pulse rounded-card" />
          <SkeletonStats />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  return (
    <div className="relative pb-8 overflow-hidden">
      {/* Ambient glass glows */}
      <div className="pointer-events-none absolute left-1/4 top-10 h-[500px] w-[500px] rounded-pill bg-gradient-to-br from-primary-400/5 to-indigo-300/5 blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 top-40 h-[500px] w-[500px] rounded-pill bg-gradient-to-br from-fuchsia-400/5 to-pink-300/5 blur-[120px]" />

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      
      <div className="relative z-10">
        
        {/* --- HEADER Row --- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden surface-card p-6 md:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/20 dark:from-indigo-950/10 via-white/50 dark:via-inverse-surface/20 to-fuchsia-50/20 dark:to-rose-950/10 opacity-70" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-pill border border-indigo-100 bg-indigo-50 px-3 py-1 text-overline font-semibold uppercase tracking-wider text-indigo-700 mb-3 animate-pulse">
                <BrainCircuit className="w-3.5 h-3.5" />
                Longitudinal AI Insights
              </div>
              <h1 className="app-page-title mb-2">
                AI Living Candidate Model
              </h1>
              <p className="app-page-subtitle max-w-2xl">
                A dynamic, self-evolving behavioral model of your actual mock interview performance. 
                Instead of just tracking scores, it analyzes patterns in your technical depth and habits over time.
              </p>
            </div>

             {profile && (
              <div className="flex items-center gap-3 bg-surface-sunken border border-hairline rounded-card p-4 shadow-soft-xs">
                <div className="h-12 w-12 rounded-card bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-overline text-ink-subtle font-bold uppercase tracking-wider">Sessions Analyzed</div>
                  <div className="font-display text-title-lg font-black text-ink">{profile.sessions_count || 1}</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* --- NO PROFILE / NO SESSIONS STATE --- */}
        {!profile ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-12 border border-dashed border-hairline-strong rounded-panel bg-surface-raised text-center shadow-soft-sm max-w-2xl mx-auto my-8 relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-indigo-500" />
            <BrainCircuit className="w-16 h-16 text-indigo-400 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
            <h3 className="font-display text-title text-ink mb-3">Unlock Your AI Living Model</h3>
            <p className="text-body text-ink-muted mb-8 max-w-md mx-auto leading-relaxed">
              Complete mock interview sessions to initiate candidate pattern intelligence. The system will automatically build a deep, multidimensional analysis of your technical vocabulary, context habits, and pressure responses.
            </p>
            <button
              onClick={() => navigate('/dashboard/interview')}
              className="app-btn-primary inline-flex items-center justify-center gap-2"
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span>Start Your First Mock Session</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT / MAIN COLUMN: Living Model & Answer Patterns (2 cols) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* SECTION 1: Living Model Summary */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden surface-card p-6 md:p-8 group"
              >
                <div className="absolute -right-16 -top-16 w-32 h-32 rounded-pill bg-indigo-500/5 group-hover:scale-150 transition-transform duration-500" />
                <h2 className="app-section-title mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  AI Living Persona Analysis
                </h2>
                <div className="text-body-lg text-ink leading-relaxed font-medium bg-surface-sunken border border-hairline p-5 rounded-card">
                  "{profile.summary}"
                </div>
                
                {profile.last_updated && (
                  <div className="mt-4 flex items-center gap-1 text-[11px] font-semibold text-ink-subtle">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Last analyzed: {new Date(profile.last_updated).toLocaleString()}</span>
                  </div>
                )}
              </motion.div>

              {/* SECTION 2: Answer Pattern Analysis */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                <h2 className="app-section-title flex items-center gap-2 px-1">
                  <MessageSquare className="w-5 h-5 text-fuchsia-500" />
                  Answer Pattern Analysis (Not Just Scores)
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Pattern 1: Explanation Depth */}
                  <div className="surface-card surface-card-interactive p-5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="font-body text-caption font-extrabold text-ink flex items-center gap-2 uppercase tracking-wide">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        Explanation Depth
                      </div>
                      <span className="text-overline font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-pill border border-emerald-100 flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Healthy
                      </span>
                    </div>
                    <p className="text-caption text-ink-muted leading-relaxed font-semibold bg-surface-sunken rounded-card p-3 border border-hairline">
                      {profile.answer_patterns?.explanation_depth || "Synthesizes concepts cleanly and scales depth dynamically based on questioning."}
                    </p>
                  </div>

                  {/* Pattern 2: Example Coverage */}
                  <div className="surface-card surface-card-interactive p-5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="font-body text-caption font-extrabold text-ink flex items-center gap-2 uppercase tracking-wide">
                        <UserCheck className="w-4 h-4 text-amber-500" />
                        Example Coverage
                      </div>
                      <span className="text-overline font-extrabold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-pill border border-amber-100 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Improvement
                      </span>
                    </div>
                    <p className="text-caption text-ink-muted leading-relaxed font-semibold bg-surface-sunken rounded-card p-3 border border-hairline">
                      {profile.answer_patterns?.example_coverage || "Tends to keep concepts abstract; could benefit from writing out concrete code snippet blocks."}
                    </p>
                  </div>

                  {/* Pattern 3: Time & Pressure */}
                  <div className="surface-card surface-card-interactive p-5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="font-body text-caption font-extrabold text-ink flex items-center gap-2 uppercase tracking-wide">
                        <Clock className="w-4 h-4 text-red-500" />
                        Time & Pressure
                      </div>
                      <span className="text-overline font-extrabold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-pill border border-amber-100 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3 text-amber-600" /> Focus Area
                      </span>
                    </div>
                    <p className="text-caption text-ink-muted leading-relaxed font-semibold bg-surface-sunken rounded-card p-3 border border-hairline">
                      {profile.answer_patterns?.time_pressure || "Needs to streamline easy conceptual questions to avoid running out of time on coding blocks."}
                    </p>
                  </div>

                  {/* Pattern 4: Context Assumption */}
                  <div className="surface-card surface-card-interactive p-5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-500" />
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="font-body text-caption font-extrabold text-ink flex items-center gap-2 uppercase tracking-wide">
                        <Shield className="w-4 h-4 text-fuchsia-500" />
                        Audience Assumptions
                      </div>
                      <span className="text-overline font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-pill border border-emerald-100 flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Healthy
                      </span>
                    </div>
                    <p className="text-caption text-ink-muted leading-relaxed font-semibold bg-surface-sunken rounded-card p-3 border border-hairline">
                      {profile.answer_patterns?.context_assumption || "Explicitly lays out initial context frameworks, avoiding communication assumptions."}
                    </p>
                  </div>

                </div>
              </motion.div>

              {/* Strengths & Weaknesses Bullet Lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="surface-card p-6 space-y-3">
                  <h3 className="font-body font-extrabold flex items-center gap-2 border-b border-hairline pb-2 text-caption uppercase tracking-wider text-emerald-700">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Technical Core Strengths
                  </h3>
                  <ul className="space-y-2">
                    {profile.strengths?.map((st, i) => (
                      <li key={i} className="text-caption text-ink font-semibold flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-pill bg-emerald-500 mt-1.5 flex-shrink-0" />
                        <span>{st}</span>
                      </li>
                    )) || <li className="text-caption text-ink-subtle italic">No key strengths extracted yet.</li>}
                  </ul>
                </div>

                <div className="surface-card p-6 space-y-3">
                  <h3 className="font-body font-extrabold flex items-center gap-2 border-b border-hairline pb-2 text-caption uppercase tracking-wider text-amber-700">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Key Improvement Areas
                  </h3>
                  <ul className="space-y-2">
                    {profile.weaknesses?.map((wk, i) => (
                      <li key={i} className="text-caption text-ink font-semibold flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-pill bg-amber-500 mt-1.5 flex-shrink-0" />
                        <span>{wk}</span>
                      </li>
                    )) || <li className="text-caption text-ink-subtle italic">No key weaknesses extracted yet.</li>}
                  </ul>
                </div>

              </div>

            </div>

            {/* RIGHT COLUMN: Role Readiness & Skill Trajectories (1 col) — sticky rail on lg+ */}
            <div className="space-y-8 lg:sticky lg:top-6 self-start">
              
              {/* SECTION 3: Role Readiness */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="surface-card p-6 space-y-5"
              >
                <h2 className="app-section-title flex items-center gap-2 pb-3 border-b border-hairline">
                  <TrendingUp className="w-5 h-5 text-indigo-500 animate-pulse" />
                  Role Tier Readiness
                </h2>
                
                <div className="space-y-4">
                  {/* Junior Gauge */}
                  <div>
                    <div className="flex justify-between text-caption font-bold text-ink-muted mb-1">
                      <span>Junior Roles</span>
                      <span className="text-indigo-600 font-black">{profile.role_readiness?.junior || 0}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-surface-sunken rounded-pill overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-pill transition-all duration-1000" 
                        style={{ width: `${profile.role_readiness?.junior || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Mid-Level Gauge */}
                  <div>
                    <div className="flex justify-between text-caption font-bold text-ink-muted mb-1">
                      <span>Mid-Level Roles</span>
                      <span className="text-indigo-600 font-black">{profile.role_readiness?.mid_level || 0}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-surface-sunken rounded-pill overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-pill transition-all duration-1000" 
                        style={{ width: `${profile.role_readiness?.mid_level || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Senior Gauge */}
                  <div>
                    <div className="flex justify-between text-caption font-bold text-ink-muted mb-1">
                      <span>Senior Roles</span>
                      <span className="text-indigo-600 font-black">{profile.role_readiness?.senior || 0}%</span>
                    </div>
                    <div className="h-2.5 w-full bg-surface-sunken rounded-pill overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-pill transition-all duration-1000" 
                        style={{ width: `${profile.role_readiness?.senior || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-caption text-ink-muted leading-relaxed font-semibold bg-surface-sunken border border-hairline rounded-card p-4 mt-2">
                  <div className="font-extrabold uppercase text-ink-muted tracking-wider text-overline mb-1">AI Verdict</div>
                  "{profile.role_readiness?.verdict || "Evaluating role compatibility based on technical depth and experience levels."}"
                </div>

              </motion.div>

              {/* SECTION 4: Skill Trajectories */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="surface-card p-6 space-y-4"
              >
                <h2 className="app-section-title flex items-center gap-2 pb-3 border-b border-hairline">
                  <BookOpen className="w-5 h-5 text-fuchsia-500" />
                  Skill Trajectories
                </h2>

                <div className="space-y-5">
                  {Object.entries(profile.technical_skills || {}).map(([skill, data]) => {
                    const label = data.level || 'Good'
                    let badgeColor = 'bg-surface-sunken border-hairline text-ink'
                    if (label === 'Strong') badgeColor = 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    else if (label === 'Good') badgeColor = 'bg-indigo-50 border-indigo-100 text-indigo-700'
                    else if (label === 'Moderate') badgeColor = 'bg-amber-50 border-amber-100 text-amber-700'
                    
                    return (
                      <div key={skill} className="space-y-2 border-b border-hairline pb-3 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-center">
                          <span className="font-body font-extrabold text-caption text-ink">{skill}</span>
                          <span className={`text-overline font-extrabold px-2.5 py-0.5 rounded-pill border ${badgeColor}`}>
                            {label}
                          </span>
                        </div>
                        
                        {/* Score chronological points */}
                        {data.score_history && data.score_history.length > 0 && (
                          <div className="flex items-center gap-2 py-1">
                            <span className="text-overline font-bold text-ink-subtle uppercase">Trajectory:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {data.score_history.map((sc, idx) => (
                                <React.Fragment key={idx}>
                                  {idx > 0 && <span className="text-ink-subtle text-caption font-bold">→</span>}
                                  <span className="text-[10px] font-extrabold bg-surface-sunken border border-hairline px-2 py-0.5 rounded-card font-mono text-ink">
                                    {Math.round(sc * 100)}%
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-ink-muted font-semibold italic leading-relaxed">
                          {data.trend_summary}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

            </div>

          </div>
        )}

      </div>
    </div>
  )
}
