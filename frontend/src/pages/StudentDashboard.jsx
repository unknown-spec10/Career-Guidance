import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'

import {
  Briefcase, Building2, TrendingUp, Clock,
  CheckCircle, XCircle, AlertTriangle, Upload, User, MapPin, Target, Zap, BookOpen, FileText, GraduationCap, Loader2, RefreshCcw, X, Coins, Bookmark, Award, Check, Sparkles
} from 'lucide-react'

import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { SkeletonStats, SkeletonCard } from '../components/SkeletonLoader'
import useOptimistic from '../hooks/useOptimistic'
import CreditWidget from '../components/CreditWidget'
import ApplicationTracker from '../components/ApplicationTracker'

const normalizeMatchScore = (rawScore) => {
  const numericScore = Number(rawScore)
  if (!Number.isFinite(numericScore)) return 0
  if (numericScore <= 1) return numericScore * 100
  if (numericScore > 100) return numericScore / 100
  return numericScore
}

const checkSkillMatch = (candidateSkills, requiredSkillName) => {
  if (!candidateSkills || !requiredSkillName) return false
  const reqName = requiredSkillName.toLowerCase().trim()
  return candidateSkills.some(cand => {
    const candName = String(cand).toLowerCase().trim()
    if (candName === reqName) return true
    if (reqName.length >= 3 || candName.length >= 3) {
      try {
        const escapedReq = reqName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        const regexReq = new RegExp(`\\b${escapedReq}\\b`, 'i')
        return regexReq.test(candName)
      } catch (e) {
        return candName.includes(reqName) || reqName.includes(candName)
      }
    }
    return false
  })
}


const jobMarkdownComponents = {
  h1: ({ children }) => <h1 className="text-sm font-bold text-slate-900 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-inherit">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 space-y-1 list-disc text-inherit">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 space-y-1 list-decimal text-inherit">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  code: ({ inline, children }) => {
    if (inline) {
      return <code className="bg-white text-primary-700 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[10px]">{children}</code>
    }

    return (
      <pre className="bg-slate-950 text-slate-100 p-3 rounded-xl overflow-x-auto text-[10px] leading-relaxed border border-slate-800 mb-2">
        <code>{children}</code>
      </pre>
    )
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline font-semibold">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-200 pl-3 italic text-slate-600 mb-2">{children}</blockquote>,
}


const formatMatchLabel = (percentage) => {
  if (percentage >= 85) return 'Good'
  if (percentage >= 70) return 'Good'
  if (percentage >= 55) return 'Avg'
  return 'Weak'
}

const getMatchColor = (percentage) => {
  if (percentage >= 85) return 'bg-green-600'
  if (percentage >= 70) return 'bg-primary-600'
  if (percentage >= 55) return 'bg-yellow-600'
  return 'bg-gray-500'
}

export default function StudentDashboard() {
  const navigate = useNavigate()
  const toast = useToast()

  // State
  const [applicantData, setApplicantData] = useState(null)
  const [studentProfile, setStudentProfile] = useState(null)
  const [jobApplications, setJobApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Upload State
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedResume, setSelectedResume] = useState(null)
  const [selectedMarksheets, setSelectedMarksheets] = useState([])

  // Recommendation State
  const [recommendations, setRecommendations] = useState([])
  const [learningPathState, setLearningPathState] = useState({
    loadingId: null,
    error: null,
    success: null
  })
  const [applicantId, setApplicantId] = useState(null)
  const [noApplicantProfile, setNoApplicantProfile] = useState(false)
  const [recalcLoading, setRecalcLoading] = useState(false)

  // Cooldown & Bypass State
  const [cooldownActive, setCooldownActive] = useState(false)
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState(null)
  const [cooldownTimeLeft, setCooldownTimeLeft] = useState('')
  const [bypassCost, setBypassCost] = useState(5)
  const [showBypassModal, setShowBypassModal] = useState(false)
  const [creditsBalance, setCreditsBalance] = useState(null)

  // Modal States
  const [easyApplyOpen, setEasyApplyOpen] = useState(false)
  const [easyApplyRec, setEasyApplyRec] = useState(null)
  const [easyApplyLoading, setEasyApplyLoading] = useState(false)
  const [easyApplyError, setEasyApplyError] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsRec, setDetailsRec] = useState(null)

  // Refs
  const uploadFormRef = React.useRef(null)
  const recommendationsRef = React.useRef(null)

  const interviewingCount = jobApplications.filter((app) => app.status?.toLowerCase() === 'interviewing').length
  const newSuggestionCount = recommendations.filter((rec) => rec.status === 'recommended').length

  // --- Handlers (Logout, Upload, etc.) ---
  const handleLogout = () => {
    secureStorage.clear()
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }

  const handleFileUpload = async (e) => {
    e.preventDefault()
    setUploadLoading(true)
    setError(null)
    setUploadSuccess(false)

    // Validate file was selected
    if (!selectedResume) {
      setError('Please select a resume file')
      setUploadLoading(false)
      return
    }

    try {
      // Create FormData with resume file
      const formData = new FormData()
      formData.append('resume', selectedResume)

      // Get form values from the form element
      const form = e.currentTarget
      const locationInput = form.querySelector('input[name="location"]')
      const jeeRankInput = form.querySelector('input[name="jee_rank"]')

      // Append optional fields if they have values
      if (locationInput && locationInput.value) {
        formData.append('location', locationInput.value)
      }
      if (jeeRankInput && jeeRankInput.value) {
        formData.append('jee_rank', jeeRankInput.value)
      }

      console.log('Starting file upload with file:', selectedResume.name)
      console.log('FormData entries:', Array.from(formData.entries()))

      // Don't set Content-Type manually - axios sets it with boundary automatically
      const response = await api.post('/upload', formData, {
        timeout: 120000 // 120s for upload
      })
      console.log('Upload response:', response.data)
      setUploadSuccess(true)
      form.reset()

      if (response.data.applicant_id) {
        console.log('Got applicant_id, starting parse:', response.data.applicant_id)
        setTimeout(async () => {
          try {
            const parseRes = await api.post(`/parse/${response.data.applicant_id}`, null, {
              timeout: 120000 // 120s for parse
            })
            console.log('Parse completed:', parseRes.data)
            toast.success('Resume uploaded and parsed successfully!')
            setShowUploadForm(false)
            setNoApplicantProfile(false)

            const dbId = parseRes.data?.db_applicant_id
            if (dbId) {
              secureStorage.setItem('db_applicant_id', String(dbId))
              setApplicantId(dbId)
            }
            // Refresh data
            fetchAll()
          } catch (parseErr) {
            console.error('Parse error:', parseErr)
            const errMsg = parseErr.response?.data?.detail || parseErr.message || 'Unknown error'
            setError(`Parsing failed: ${errMsg}`)
            toast.error('Resume uploaded but parsing failed.')
          } finally {
            setUploadLoading(false)
          }
        }, 500)
      } else {
        setUploadLoading(false)
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.detail || 'Upload failed.')
      setUploadLoading(false)
    }
  }

  // --- Data Fetching ---
  const fetchAll = async () => {
    try {
      setLoading(true)
      // Profile
      let profileId = secureStorage.getItem('db_applicant_id')

      try {
        const profileRes = await api.get(`/api/student/applicant?t=${Date.now()}`)
        setApplicantData(profileRes.data) // SAVE DATA for ProfileHealth
        setApplicantId(profileRes.data.id)
        secureStorage.setItem('db_applicant_id', String(profileRes.data.id))
        profileId = profileRes.data.id
      } catch (e) {
        // Profile probably not found
        if (!profileId) setNoApplicantProfile(true)
      }

      try {
        const studentProfileRes = await api.get(`/api/student/profile?t=${Date.now()}`)
        setStudentProfile(studentProfileRes.data || null)
      } catch (profileErr) {
        console.error('Failed to load student profile data:', profileErr)
        setStudentProfile(null)
      }

      // Applications
      const [jobApps] = await Promise.all([
        api.get(`/api/student/applications/jobs?t=${Date.now()}`).catch(() => ({ data: { applications: [] } }))
      ])
      setJobApplications(jobApps.data?.applications || [])

      // Recommendations
      if (profileId) {
        const recRes = await api.get(`/api/recommendations/${profileId}?t=${Date.now()}`)
        console.log('📊 Recommendations API response:', recRes.data)
        console.log('📊 Job recommendations count:', recRes.data.job_recommendations?.length || 0)
        setRecommendations(recRes.data.job_recommendations || [])
        
        if (recRes.data.cooldown_active) {
          setCooldownActive(true)
          setCooldownExpiresAt(recRes.data.cooldown_expires_at)
          setBypassCost(recRes.data.bypass_cost || 5)
        } else {
          setCooldownActive(false)
          setCooldownExpiresAt(null)
        }
        
        setNoApplicantProfile(false)
      }

      // Credit Balance
      try {
        const balanceRes = await api.get('/api/credits/balance')
        setCreditsBalance(balanceRes.data?.current_credits ?? 0)
      } catch (creditsErr) {
        console.error('Failed to load credit balance:', creditsErr)
      }
    } catch (err) {
      console.error(err)
      // Silent fail or minimal error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  // Cooldown Countdown Timer
  useEffect(() => {
    if (!cooldownActive || !cooldownExpiresAt) {
      setCooldownTimeLeft('')
      return undefined
    }

    const calculateTimeLeft = () => {
      const difference = +new Date(cooldownExpiresAt) - +new Date()
      if (difference <= 0) {
        setCooldownActive(false)
        setCooldownExpiresAt(null)
        setCooldownTimeLeft('')
        return
      }

      const hours = Math.floor(difference / (1000 * 60 * 60))
      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      setCooldownTimeLeft(
        `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
      )
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [cooldownActive, cooldownExpiresAt])

  const handleRecomputeRecommendations = async (bypass = false) => {
    if (!applicantId) return

    if (cooldownActive && !bypass) {
      try {
        const balanceRes = await api.get('/api/credits/balance')
        setCreditsBalance(balanceRes.data?.current_credits ?? 0)
      } catch (e) {}
      setShowBypassModal(true)
      return
    }

    try {
      setRecalcLoading(true)
      const url = `/api/applicant/${applicantId}/generate-recommendations${bypass ? '?bypass_cooldown=true' : ''}`
      const response = await api.post(url)
      
      toast.success('Recommendations updated')
      
      if (response.data?.cooldown_active) {
        setCooldownActive(true)
        setCooldownExpiresAt(response.data.cooldown_expires_at)
      } else {
        setCooldownActive(false)
        setCooldownExpiresAt(null)
      }
      
      if (response.data?.credits_left !== undefined) {
        setCreditsBalance(response.data.credits_left)
      }
      
      setShowBypassModal(false)
      
      await fetchAll()
      
      // Scroll to recommendations after refresh
      if (recommendationsRef.current) {
        recommendationsRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    } catch (err) {
      const status = err.response?.status
      const data = err.response?.data
      
      if (status === 400 && data?.status === 'cooldown') {
        setCooldownActive(true)
        setCooldownExpiresAt(data.cooldown_expires_at)
        setBypassCost(data.bypass_cost || 5)
        setShowBypassModal(true)
        toast.info('Recommendations are in cooldown. Spend credits to refresh now!')
      } else if (status === 402) {
        toast.error(`Insufficient credits: ${data?.detail || 'Upgrade or wait for refill.'}`)
      } else {
        const detail = data?.detail || err.message || 'Failed to regenerate recommendations'
        toast.error(detail)
      }
    } finally {
      setRecalcLoading(false)
    }
  }

  // --- Optimistic UI ---
  const {
    data: optimisticRecs,
    update: updateRecStatus,
    isPending: statusUpdatePending,
  } = useOptimistic(recommendations, setRecommendations)

  // --- Action Handlers ---
  const toggleSaveJob = async (recId, currentSavedState) => {
    try {
      // Optimistic update
      setRecommendations(prev => prev.map(r => r.id === recId ? { ...r, is_saved: !currentSavedState } : r))
      await api.patch(`/api/job-recommendation/${recId}/save`, { is_saved: !currentSavedState })
      toast.success(!currentSavedState ? 'Job saved to tracker!' : 'Job removed from tracker.')
    } catch (err) {
      console.error('Failed to toggle save state:', err)
      toast.error('Failed to update saved status.')
      // Rollback
      setRecommendations(prev => prev.map(r => r.id === recId ? { ...r, is_saved: currentSavedState } : r))
    }
  }

  const updateTrackStatus = async (jobId, recId, newStatus) => {
    const previousRecs = [...recommendations]
    try {
      // Optimistically update recommendations local status
      setRecommendations(prev => prev.map(r => {
        if (r.id === recId) {
          return {
            ...r,
            application_status: newStatus,
            status: newStatus === 'applied' ? 'applied' : r.status
          }
        }
        return r
      }))
      
      await api.patch(`/api/student/jobs/${jobId}/track`, { status: newStatus })
      toast.success(`Job tracker updated to ${newStatus === 'interviewing' ? 'Interview Scheduled' : newStatus === 'offered' ? 'Offer Received' : 'Applied'}!`)
      fetchAll() // Reload to keep everything completely sync
    } catch (err) {
      console.error('Failed to update tracker status:', err)
      toast.error('Failed to update job tracking status.')
      // Rollback
      setRecommendations(previousRecs)
    }
  }

  const openEasyApply = (rec) => {
    setEasyApplyRec(rec)
    setEasyApplyError(null)
    setEasyApplyOpen(true)
  }

  const openDetails = (rec) => {
    setDetailsRec(rec)
    setDetailsOpen(true)
  }

  // Learning-path generation feature removed; no handler needed

  const submitEasyApply = async (e) => {
    e.preventDefault()
    if (!easyApplyRec) return
    setEasyApplyLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.append('recommendation_id', easyApplyRec.id)

      updateRecStatus(
        async () => {
          try {
            await api.post(`/api/job-recommendation/${easyApplyRec.id}/apply`, formData)
          } catch {
            await api.patch(`/api/job-recommendation/${easyApplyRec.id}/status`, { status: 'applied' })
          }
        },
        (prev) => prev.map((r) => r.id === easyApplyRec.id ? { ...r, status: 'applied' } : r)
      )
      setEasyApplyOpen(false)
      toast.success('Application submitted!')
    } catch (err) {
      setEasyApplyError('Failed.')
      toast.error('Failed to apply')
    } finally {
      setEasyApplyLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'applied': return <Clock className="w-5 h-5 text-yellow-400" />
      case 'shortlisted': return <TrendingUp className="w-5 h-5 text-blue-400" />
      case 'accepted': return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'rejected': return <XCircle className="w-5 h-5 text-red-400" />
      default: return <AlertTriangle className="w-5 h-5 text-gray-400" />
    }
  }

  // Scroll effect
  useEffect(() => {
    if (showUploadForm && uploadFormRef.current) {
      uploadFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showUploadForm])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-24 px-4">
        <div className="max-w-7xl mx-auto py-8">
          <SkeletonStats />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">

        {/* --- HEADER ROW --- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-sky-50/40 opacity-70" />
          <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-4">
                <Briefcase className="w-3.5 h-3.5" />
                Student workspace
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
                  Student Dashboard
                </span>
              </h1>
              <p className="text-gray-600">Welcome back, {applicantData?.full_name?.split(' ')[0] || 'Student'}</p>
              <p className="text-sm text-gray-500 mt-2 max-w-xl">
                You have {interviewingCount} interview {interviewingCount === 1 ? 'invitation' : 'invitations'} and {newSuggestionCount} new path {newSuggestionCount === 1 ? 'suggestion' : 'suggestions'}.
              </p>
            </div>

            <div className="flex flex-col gap-4 lg:items-end lg:justify-end lg:min-w-[360px]">
              <div className="grid w-full gap-3 md:grid-cols-2">
                <CreditWidget compact />
                <ApplicationTracker jobApps={jobApplications} compact />
              </div>
            </div>
          </div>
        </motion.div>

        {/* --- NO PROFILE STATE --- */}
        {noApplicantProfile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-8 p-8 border border-dashed border-gray-300 rounded-2xl bg-white text-center shadow-sm"
          >
            <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Setup Your Profile</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">Upload your resume to unlock AI-powered recommendations and interview practice.</p>
            <button onClick={() => setShowUploadForm(true)} className="btn-primary">Upload Resume</button>
          </motion.div>
        )}

        {/* --- RECOMMENDATIONS HEADER + ACTION --- */}
        {!noApplicantProfile && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3" ref={recommendationsRef}>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Target className="w-6 h-6 text-primary-500" />
              Recommended for You
            </h2>
            <div className="flex items-center gap-2">
              {cooldownActive ? (
                <button
                  onClick={() => handleRecomputeRecommendations(false)}
                  disabled={recalcLoading}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm shadow-md border duration-200 active:scale-95 ${
                    recalcLoading
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 border-amber-400 text-white shadow-amber-500/20 hover:shadow-amber-500/30'
                  }`}
                >
                  <Zap className={`w-4 h-4 text-white ${recalcLoading ? '' : 'animate-bounce'}`} />
                  <span>{recalcLoading ? 'Updating...' : `Refresh Now (${bypassCost}c)`}</span>
                  {cooldownTimeLeft && (
                    <span className="ml-1 text-[10px] font-medium bg-black/25 px-2 py-0.5 rounded-full font-mono text-amber-100">
                      {cooldownTimeLeft}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => handleRecomputeRecommendations(false)}
                  disabled={recalcLoading}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold transition-all text-sm shadow-sm ${
                    recalcLoading
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <RefreshCcw className={`w-4 h-4 ${recalcLoading ? 'animate-spin' : ''}`} />
                  <span>{recalcLoading ? 'Updating...' : 'Re-run AI'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* --- RECOMMENDATIONS (Optimistic List) --- */}
        {recommendations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {optimisticRecs.map((rec, idx) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="p-6 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-primary-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col h-full relative overflow-hidden group"
              >
                {/* Visual hover accent line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-primary-500 group-hover:via-indigo-500 group-hover:to-purple-500 transition-all duration-300" />
                
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 mr-2">
                    <h3 className="font-bold text-lg leading-tight mb-1 text-slate-900 group-hover:text-primary-900 transition-colors">{rec.job?.title || rec.title}</h3>
                    <p className="text-sm font-semibold text-slate-500">{rec.job?.company || rec.company}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleSaveJob(rec.id, rec.is_saved)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        rec.is_saved 
                          ? 'bg-amber-50 border-amber-200 text-amber-500 shadow-sm' 
                          : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                      }`}
                      title={rec.is_saved ? 'Unsave job' : 'Save job'}
                    >
                      <Bookmark className="w-4 h-4" style={{ fill: rec.is_saved ? 'currentColor' : 'none' }} />
                    </button>
                    {(() => {
                      const rawScore = rec.match_score ?? rec.match_percentage ?? rec.score ?? null
                      const score = normalizeMatchScore(rawScore)
                      if (score === null || score === 0) return null
                      const percentage = Math.round(score)
                      
                      let bgGradient = 'from-slate-400 to-slate-500'
                      let label = 'Weak'
                      if (percentage >= 85) {
                        bgGradient = 'from-emerald-500 to-teal-500'
                        label = 'Good'
                      } else if (percentage >= 70) {
                        bgGradient = 'from-primary-500 to-indigo-500'
                        label = 'Good'
                      } else if (percentage >= 55) {
                        bgGradient = 'from-amber-500 to-orange-500'
                        label = 'Avg'
                      }
                      
                      return (
                        <div className={`bg-gradient-to-r ${bgGradient} text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm flex-shrink-0`}>
                          {label}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {(() => {
                  const candidateSkills = (studentProfile?.skills || []).map(s => {
                    if (typeof s === 'object' && s !== null) {
                      return (s.name || s.canonical_name || '').toLowerCase().trim()
                    }
                    return String(s).toLowerCase().trim()
                  })

                  const userCity = (
                    applicantData?.location_city ||
                    (studentProfile?.personal_info?.location ? studentProfile.personal_info.location.split(',')[0] : '') ||
                    ''
                  ).toLowerCase().trim();
                  const jobCity = (rec.job?.location_city || '').toLowerCase().trim();
                  const isCityMatched = userCity && jobCity && (userCity.includes(jobCity) || jobCity.includes(userCity));
                  
                  // Location city chip is green ONLY if the physical city matches.
                  const showLocGreen = isCityMatched || (!rec.job?.location_city && rec.job?.work_type === 'remote');
                  
                  // Work type chip is green ONLY if it is remote or hybrid
                  const showWorkTypeGreen = rec.job?.work_type === 'remote' || rec.job?.work_type === 'hybrid';

                  const isExpMatched = (rec.scoring_breakdown?.experience_fit ?? 0) >= 0.5;
                  const isCgpaMatched = (rec.scoring_breakdown?.academic_score ?? 0) >= 0.5;

                  return (
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border flex items-center gap-1.5 transition-all ${
                          showLocGreen 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                            : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}>
                          <MapPin className={`w-3.5 h-3.5 ${showLocGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
                          {rec.job?.location_city || 'Remote'}
                        </span>
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border capitalize flex items-center gap-1.5 transition-all ${
                          showWorkTypeGreen 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                            : 'bg-slate-50 border-slate-100 text-slate-600'
                        }`}>
                          <Clock className={`w-3.5 h-3.5 ${showWorkTypeGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
                          {rec.job?.work_type || 'Full-time'}
                        </span>
                        {rec.job?.min_experience_years !== null && rec.job?.min_experience_years !== undefined && (
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border flex items-center gap-1.5 transition-all ${
                            isExpMatched 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                              : 'bg-slate-50 border-slate-100 text-slate-600'
                          }`}>
                            <Sparkles className={`w-3.5 h-3.5 ${isExpMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
                            {rec.job.min_experience_years}+ yrs
                          </span>
                        )}
                        {rec.job?.min_cgpa && (
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium border flex items-center gap-1.5 transition-all ${
                            isCgpaMatched 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                              : 'bg-slate-50 border-slate-100 text-slate-600'
                          }`}>
                            <Award className={`w-3.5 h-3.5 ${isCgpaMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
                            CGPA {rec.job.min_cgpa}+
                          </span>
                        )}
                        {(rec.status === 'applied' || rec.application_status === 'applied') && (
                          <span className="text-xs bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Applied
                          </span>
                        )}
                      </div>

                      {/* Job Skills Section directly inside the card */}
                      {(() => {
                        const explicit = Array.isArray(rec.job?.required_skills) && rec.job.required_skills.length > 0;
                        const matched = rec.scoring_breakdown?.skills_breakdown?.matched_skills || [];
                        const partial = rec.scoring_breakdown?.skills_breakdown?.partial_matches || [];
                        const fallbackSkills = [...new Set([...matched, ...partial])];
                        const skillsToRender = explicit ? rec.job.required_skills.slice(0, 3) : fallbackSkills.slice(0, 3);
                        
                        if (!skillsToRender || skillsToRender.length === 0) return null;
                        
                        return (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {skillsToRender.map((skill, idx) => {
                              const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || `Skill ${idx + 1}`;
                              const reqName = skillName.toLowerCase().trim();
                              const isMatched = checkSkillMatch(candidateSkills, reqName) ||
                                                matched.some(m => checkSkillMatch([m], reqName)) ||
                                                partial.some(p => checkSkillMatch([p], reqName));
                              return (
                                <span
                                  key={`${skillName}-${idx}`}
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-all inline-flex items-center ${
                                    isMatched 
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                                      : 'bg-slate-50 border-slate-100 text-slate-500'
                                  }`}
                                >
                                  {isMatched && <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-600 flex-shrink-0" />}
                                  {skillName}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                {(rec.job?.min_salary || rec.job?.max_salary) && (
                  <div className="mb-4 text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <span>Compensation:</span>
                    <span className="text-slate-800">
                      {rec.job?.min_salary ? `INR ${(rec.job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
                      {rec.job?.max_salary ? ` - ${(rec.job.max_salary / 100000).toFixed(1)}L` : ''}
                    </span>
                  </div>
                )}

                {/* Stepper tracker */}
                {(() => {
                  const getTrackerStep = (rec) => {
                    const status = rec.application_status;
                    if (status === 'offered') return 3;
                    if (status === 'interviewing') return 2;
                    if (status === 'applied' || status === 'under_review' || status === 'shortlisted') return 1;
                    if (rec.is_saved) return 0;
                    return -1;
                  };
                  const activeStep = getTrackerStep(rec);
                  const steps = ['Saved', 'Applied', 'Interview', 'Offered'];
                  return (
                    <div className="mb-4 bg-slate-50/50 border border-slate-100/80 rounded-2xl p-3">
                      <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Tracker Workflow</span>
                        <span className="text-slate-600 font-extrabold text-[9px] lowercase first-letter:uppercase">
                          {activeStep === 3 ? 'Offer Received! 🎉' : activeStep === 2 ? 'Interview Scheduled 🗓️' : activeStep === 1 ? 'Applied ✉️' : activeStep === 0 ? 'Saved ⭐️' : 'Not Tracked'}
                        </span>
                      </div>
                      <div className="relative flex justify-between items-center w-full mt-2 px-2 pb-1">
                        {/* Progress bar line */}
                        <div className="absolute left-4 right-4 h-0.5 bg-slate-200 top-1/2 -translate-y-1/2 z-0" />
                        <div 
                          className="absolute left-4 h-0.5 bg-gradient-to-r from-primary-500 to-indigo-500 top-1/2 -translate-y-1/2 z-0 transition-all duration-500" 
                          style={{ 
                            width: activeStep >= 0 
                              ? `${(activeStep / (steps.length - 1)) * 88}%` 
                              : '0%' 
                          }} 
                        />
                        
                        {steps.map((step, sIdx) => {
                          const isCompleted = activeStep >= sIdx;
                          return (
                            <div key={sIdx} className="flex flex-col items-center z-10 relative">
                              <div 
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${
                                  isCompleted 
                                    ? 'bg-gradient-to-r from-primary-600 to-indigo-600 border-primary-500 text-white shadow-sm shadow-primary-500/10' 
                                    : 'bg-white border-slate-200 text-slate-400'
                                }`}
                              >
                                {isCompleted ? (
                                  <Check className="w-2.5 h-2.5 text-white" />
                                ) : (
                                  <span className="text-[8px] font-extrabold">{sIdx + 1}</span>
                                )}
                              </div>
                              <span className={`text-[8px] mt-1 font-extrabold ${isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>{step}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {rec.is_fallback && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                      Rule-based match · AI unavailable
                    </span>
                  </div>
                )}

                <div className="text-xs text-slate-500 leading-relaxed mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <ReactMarkdown components={jobMarkdownComponents}>
                    {rec.explanation || rec.explain?.reasons?.[0] || 'Matched based on your profile strength and skill overlap.'}
                  </ReactMarkdown>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => openDetails(rec)}
                      className="flex-1 py-2 px-3 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 active:scale-95 duration-200"
                    >
                      Details
                    </button>
                    
                    {(() => {
                      const getTrackerStep = (rec) => {
                        const status = rec.application_status;
                        if (status === 'offered') return 3;
                        if (status === 'interviewing') return 2;
                        if (status === 'applied' || status === 'under_review' || status === 'shortlisted') return 1;
                        if (rec.is_saved) return 0;
                        return -1;
                      };
                      const activeStep = getTrackerStep(rec);
                      
                      // Offered (Phase 3)
                      if (activeStep === 3) {
                        return (
                          <div className="flex-1 py-2 px-3 text-xs font-extrabold rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 text-center flex items-center justify-center gap-1">
                            <CheckCircle className="w-4 h-4 text-emerald-600 animate-pulse" />
                            Offer Received!
                          </div>
                        );
                      }
                      
                      // Interviewing (Phase 2)
                      if (activeStep === 2) {
                        return (
                          <button
                            onClick={() => updateTrackStatus(rec.job?.id || rec.job_id, rec.id, 'offered')}
                            className="flex-1 py-2 px-3 text-xs font-extrabold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-sm shadow-emerald-500/10 active:scale-95 duration-200"
                          >
                            🎉 Got Offer
                          </button>
                        );
                      }
                      
                      // Applied (Phase 1)
                      if (activeStep === 1) {
                        return (
                          <button
                            onClick={() => updateTrackStatus(rec.job?.id || rec.job_id, rec.id, 'interviewing')}
                            className="flex-1 py-2 px-3 text-xs font-extrabold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-sm shadow-indigo-500/10 active:scale-95 duration-200"
                          >
                            🗓️ Interviewed
                          </button>
                        );
                      }
                      
                      // Saved or none
                      return (
                        <button
                          onClick={() => openEasyApply(rec)}
                          disabled={rec.status === 'applied' || rec.status === 'accepted'}
                          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all active:scale-95 duration-200 ${
                            rec.status === 'applied'
                              ? 'bg-emerald-50 text-emerald-700 cursor-not-allowed border border-emerald-200 flex items-center justify-center gap-1'
                              : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/10'
                          }`}
                        >
                          {rec.status === 'applied' ? 'Applied' : 'Easy Apply'}
                        </button>
                      );
                    })()}
                  </div>
                  
                  {(() => {
                    const getTrackerStep = (rec) => {
                      const status = rec.application_status;
                      if (status === 'offered') return 3;
                      if (status === 'interviewing') return 2;
                      if (status === 'applied' || status === 'under_review' || status === 'shortlisted') return 1;
                      if (rec.is_saved) return 0;
                      return -1;
                    };
                    return getTrackerStep(rec) <= 0 && (
                      <button
                        onClick={() => updateTrackStatus(rec.job?.id || rec.job_id, rec.id, 'applied')}
                        className="text-[9px] text-primary-600 font-extrabold hover:underline self-center pt-0.5"
                      >
                        Applied outside portal? Mark as Applied
                      </button>
                    );
                  })()}
                </div>

                {learningPathState.success?.jobId === (rec.job?.id || rec.job_id) && learningPathState.loadingId === null && (
                  <div className="mt-3 text-xs flex items-center gap-1.5 text-emerald-600 font-semibold bg-emerald-50/50 p-2 rounded-xl border border-emerald-100 justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <Link to={`/dashboard/learning-path/${learningPathState.success.pathId || learningPathState.success.jobId}`} className="underline hover:text-emerald-700">
                      {learningPathState.success?.alreadyExists ? 'Open existing learning path' : 'View generated learning path'}
                    </Link>
                  </div>
                )}
                {learningPathState.error && learningPathState.loadingId === null && (
                  <p className="mt-2.5 text-xs font-semibold text-rose-500 text-center">{learningPathState.error}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!noApplicantProfile && recommendations.length === 0 && (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">No recommendations yet</h3>
            <p className="text-gray-600 mt-2 max-w-xl mx-auto">
              Re-run recommendations after profile updates or continue practicing interviews to improve matching quality.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={() => handleRecomputeRecommendations(false)}
                disabled={recalcLoading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all text-sm shadow-md border duration-200 active:scale-95 ${
                  recalcLoading
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : cooldownActive
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 border-amber-400 text-white shadow-amber-500/20'
                    : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm border-primary-500'
                }`}
              >
                {cooldownActive ? (
                  <>
                    <Zap className="w-4 h-4 text-white animate-bounce" />
                    <span>{recalcLoading ? 'Updating...' : `Refresh Now (${bypassCost} Credits)`}</span>
                    {cooldownTimeLeft && (
                      <span className="ml-1 text-[10px] font-medium bg-black/25 px-2 py-0.5 rounded-full font-mono text-amber-100">
                        {cooldownTimeLeft}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <RefreshCcw className={`w-4 h-4 ${recalcLoading ? 'animate-spin' : ''}`} />
                    <span>{recalcLoading ? 'Updating...' : 'Re-run Recommendations'}</span>
                  </>
                )}
              </button>
              <button
                onClick={() => navigate('/dashboard/learning-paths')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                View Paths
              </button>
            </div>
          </div>
        )}

        {/* --- MODALS --- */}

        {/* Cooldown Bypass Confirmation Modal */}
        {showBypassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 relative overflow-hidden"
            >
              {/* Gold gradient top glow */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500" />
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl p-2.5 bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">
                    <Zap className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900">Instant AI Refresh</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Bypass active recommendation cooldown</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBypassModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 my-4">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    AI recommendations utilize complex multi-tiered embedding matching and RAG pipelines. To cover computational limits, refreshes are <strong className="text-slate-900 font-bold">free once every 24 hours</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cooldown Left</span>
                    <span className="text-base font-extrabold text-amber-600 mt-1 font-mono">
                      {cooldownTimeLeft || "calculating..."}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Balance</span>
                    <span className="text-base font-extrabold text-slate-800 mt-1">
                      {creditsBalance !== null ? `${creditsBalance} Credits` : "Loading..."}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="text-xs font-bold text-amber-900">Bypass Refresh Cost</div>
                      <div className="text-[10px] text-slate-400 font-semibold">Instant recomputation</div>
                    </div>
                  </div>
                  <div className="text-lg font-black text-amber-600">
                    -{bypassCost} Credits
                  </div>
                </div>

                {creditsBalance !== null && creditsBalance < bypassCost && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0 animate-bounce" />
                    <div>
                      <h4 className="text-xs font-bold text-rose-800">Insufficient Credits</h4>
                      <p className="text-[10px] text-rose-700 mt-0.5 leading-normal">
                        You need at least {bypassCost} credits to bypass this cooldown. Please wait for the cooldown or weekly refill to refresh.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setShowBypassModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700 text-sm active:scale-95 duration-200"
                >
                  Wait for Cooldown
                </button>
                <button
                  disabled={recalcLoading || (creditsBalance !== null && creditsBalance < bypassCost)}
                  onClick={() => handleRecomputeRecommendations(true)}
                  className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-md border duration-200 active:scale-95 flex items-center justify-center gap-1.5 ${
                    recalcLoading || (creditsBalance !== null && creditsBalance < bypassCost)
                      ? 'bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 border-amber-400 shadow-amber-500/10'
                  }`}
                >
                  {recalcLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 text-white" />
                      <span>Spend {bypassCost} Credits</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* --- MODALS --- */}
 
        {/* Easy Apply Modal */}
        {easyApplyOpen && easyApplyRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <h3 className="font-extrabold text-lg text-slate-900">Apply to {easyApplyRec.job?.title}</h3>
                <button onClick={() => setEasyApplyOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={submitEasyApply} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name</label>
                    <input name="full_name" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm" placeholder="Your Name" required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Email Address</label>
                    <input name="email" type="email" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm" placeholder="your.email@example.com" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Resume</label>
                  <div className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 text-sm text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">Using uploaded resume</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Cover Letter / Note</label>
                  <textarea name="questions" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm" rows="3" placeholder="Why are you a good fit for this role?"></textarea>
                </div>
                <div className="pt-2">
                  <button className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 active:scale-95 duration-200" disabled={easyApplyLoading}>
                    {easyApplyLoading ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
 
        {/* Details Modal */}
        {detailsOpen && detailsRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-100 bg-white/95 backdrop-blur max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
                <div className="min-w-0">
                  <div className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 mb-3">
                    Recommended Role
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 leading-tight">
                    {detailsRec.job?.title || 'Job Details'}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-800 shadow-sm">
                      {detailsRec.job?.company_name || detailsRec.job?.company || 'Company'}
                    </span>
                    {detailsRec.job?.location_city && (
                      <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50/50 px-3 py-1 text-slate-600 text-xs">
                        {detailsRec.job.location_city}{detailsRec.job.location_state ? `, ${detailsRec.job.location_state}` : ''}
                      </span>
                    )}
                    {detailsRec.job?.work_type && (
                      <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50/50 px-3 py-1 text-slate-600 text-xs capitalize">
                        {detailsRec.job.work_type}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setDetailsOpen(false)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-colors flex-shrink-0"
                  aria-label="Close job details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-6">
                {(detailsRec.explanation || detailsRec.explain?.summary) && (
                  <div className={`rounded-2xl border p-4 shadow-sm ${detailsRec.is_fallback ? 'border-amber-100 bg-gradient-to-r from-amber-50/60 to-orange-50/60' : 'border-primary-100 bg-gradient-to-r from-primary-50/60 to-indigo-50/60'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className={`text-xs font-bold uppercase tracking-wider ${detailsRec.is_fallback ? 'text-amber-700' : 'text-primary-700'}`}>
                        {detailsRec.is_fallback ? 'Rule-based Match' : 'AI Matching Insights'}
                      </p>
                      {detailsRec.is_fallback && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          AI unavailable
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 leading-relaxed">
                      <ReactMarkdown components={jobMarkdownComponents}>
                        {detailsRec.explanation || detailsRec.explain.summary}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
 
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                  {[
                    { label: 'Location', value: detailsRec.job?.location_city || 'Remote' },
                    { label: 'Type', value: detailsRec.job?.work_type || 'Full-time' },
                    { label: 'Match Strength', value: `${formatMatchLabel(normalizeMatchScore(detailsRec.match_percentage ?? detailsRec.match_score ?? detailsRec.score ?? 0))}` },
                    { label: 'Posted', value: 'Recent' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">{item.label}</div>
                      <div className="font-semibold text-slate-800 text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>
 
                {
                  // Prefer explicit job.required_skills, but fall back to matched/partial skills
                  (() => {
                    const explicit = Array.isArray(detailsRec.job?.required_skills) && detailsRec.job.required_skills.length > 0
                    const matched = detailsRec.scoring_breakdown?.skills_breakdown?.matched_skills || []
                    const partial = detailsRec.scoring_breakdown?.skills_breakdown?.partial_matches || []
                    const fallbackSkills = [...new Set([...matched, ...partial])]
                    const skillsToRender = explicit ? detailsRec.job.required_skills.slice(0, 8) : fallbackSkills.slice(0, 8)
 
                    if (!skillsToRender || skillsToRender.length === 0) {
                      return (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 text-sm text-amber-800">
                              <div className="font-bold">No role-specific skills found</div>
                              <div className="text-xs text-amber-800/90 mt-1">We couldn't extract explicit skills for this job from the data available. Try re-running recommendations or update your profile to surface skill matches.</div>
                              <div className="mt-3 flex gap-2">
                                <button onClick={handleRecomputeRecommendations} className="px-3 py-1 bg-amber-100 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">Re-run Recommendations</button>
                                <Link to="/student/profile" className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50">Update Profile</Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }
 
                     const candidateSkills = (studentProfile?.skills || []).map(s => {
                      if (typeof s === 'object' && s !== null) {
                        return (s.name || s.canonical_name || '').toLowerCase().trim()
                      }
                      return String(s).toLowerCase().trim()
                    })

                    return (
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-2">Key Skills in this Role</h4>
                        <div className="flex flex-wrap gap-2">
                          {skillsToRender.map((skill, idx) => {
                            const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || `Skill ${idx + 1}`
                            const reqName = skillName.toLowerCase().trim()
                            const isMatched = checkSkillMatch(candidateSkills, reqName) ||
                                              matched.some(m => checkSkillMatch([m], reqName)) ||
                                              partial.some(p => checkSkillMatch([p], reqName))
                            return (
                              <span
                                key={`${skillName}-${idx}`}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm border transition-all inline-flex items-center ${
                                  isMatched
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                                    : 'bg-primary-50 border-primary-100 text-primary-700'
                                }`}
                              >
                                {isMatched && <Check className="w-3 h-3 mr-1 text-emerald-600 flex-shrink-0" />}
                                {skillName}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()
                }
 
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-2">About the Role</h4>
                  <div className="text-slate-600 text-sm leading-relaxed whitespace-normal bg-slate-50/50 rounded-2xl p-4 border border-slate-100/80">
                    <ReactMarkdown components={jobMarkdownComponents}>
                      {detailsRec.job?.description || 'No description available.'}
                    </ReactMarkdown>
                  </div>
                </div>

 
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5">
                  <h4 className="font-bold text-indigo-900 text-sm mb-1.5">Useful next steps</h4>
                  <p className="text-xs text-slate-600 leading-normal">
                    Review the skill chips above, open the application, and generate a learning path if you want a gap-focused plan before applying.
                  </p>
                </div>
 
                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button onClick={() => setDetailsOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-95 duration-200">Close</button>
                  <button onClick={() => { setDetailsOpen(false); openEasyApply(detailsRec) }} className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 duration-200">Apply Now</button>
                </div>
              </div>
            </div>
          </div>
        )}
 
        {/* Upload Modal */}
        {showUploadForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowUploadForm(false)}>
            <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-extrabold text-xl text-slate-900">Upload Resume</h3>
                <button onClick={() => setShowUploadForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Resume File (PDF/DOCX)</label>
                  <input type="file" name="resume" required className="w-full bg-slate-50/50 border border-slate-200 border-dashed rounded-2xl p-4 text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer text-sm font-medium text-slate-600"
                    onChange={(e) => setSelectedResume(e.target.files[0])}
                  />
                </div>
                {selectedResume && (
                  <div className="text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50/50 p-2 border border-emerald-100 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>Selected: {selectedResume.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <input name="location" placeholder="Preferred Location" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm" />
                  <input name="jee_rank" type="number" placeholder="JEE Rank (Optional)" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm" />
                </div>
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 active:scale-95 duration-200" disabled={uploadLoading}>
                  {uploadLoading ? 'Uploading & Analyzing...' : 'Upload & Process'}
                </button>
              </form>
            </div>
          </div>
        )}
 
      </div>
    </div>
  )
}
