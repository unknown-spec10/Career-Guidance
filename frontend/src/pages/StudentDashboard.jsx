import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Building2, TrendingUp, Clock,
  CheckCircle, XCircle, AlertTriangle, Upload, User, MapPin, Target, Zap, BookOpen, FileText, GraduationCap, Loader2, RefreshCcw, X
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { SkeletonStats, SkeletonCard } from '../components/SkeletonLoader'
import useOptimistic from '../hooks/useOptimistic'
import CreditWidget from '../components/CreditWidget'
import ApplicationTracker from '../components/ApplicationTracker'
import ProfileHealth from '../components/ProfileHealth'

const normalizeMatchScore = (rawScore) => {
  const numericScore = Number(rawScore)
  if (!Number.isFinite(numericScore)) return 0
  if (numericScore <= 1) return numericScore * 100
  if (numericScore > 100) return numericScore / 100
  return numericScore
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
        const profileRes = await api.get('/api/student/applicant')
        setApplicantData(profileRes.data) // SAVE DATA for ProfileHealth
        setApplicantId(profileRes.data.id)
        secureStorage.setItem('db_applicant_id', String(profileRes.data.id))
        profileId = profileRes.data.id
      } catch (e) {
        // Profile probably not found
        if (!profileId) setNoApplicantProfile(true)
      }

      try {
        const studentProfileRes = await api.get('/api/student/profile')
        setStudentProfile(studentProfileRes.data || null)
      } catch (profileErr) {
        console.error('Failed to load student profile data:', profileErr)
        setStudentProfile(null)
      }

      // Applications
      const [jobApps] = await Promise.all([
        api.get('/api/student/applications/jobs').catch(() => ({ data: { applications: [] } }))
      ])
      setJobApplications(jobApps.data?.applications || [])

      // Recommendations
      if (profileId) {
        const recRes = await api.get(`/api/recommendations/${profileId}`)
        console.log('📊 Recommendations API response:', recRes.data)
        console.log('📊 Job recommendations count:', recRes.data.job_recommendations?.length || 0)
        setRecommendations(recRes.data.job_recommendations || [])
        setNoApplicantProfile(false)
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

  const handleRecomputeRecommendations = async () => {
    if (!applicantId) return
    try {
      setRecalcLoading(true)
      await api.post(`/api/applicant/${applicantId}/generate-recommendations`)
      await fetchAll()
      toast.success('Recommendations updated')
      // Scroll to recommendations after refresh
      if (recommendationsRef.current) {
        recommendationsRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to regenerate recommendations'
      toast.error(detail)
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
  const openEasyApply = (rec) => {
    setEasyApplyRec(rec)
    setEasyApplyError(null)
    setEasyApplyOpen(true)
  }

  const openDetails = (rec) => {
    setDetailsRec(rec)
    setDetailsOpen(true)
  }

  const generateLearningPath = async (rec) => {
    const jobId = rec?.job?.id || rec?.job_id
    if (!jobId) return

    setLearningPathState({ loadingId: jobId, error: null, success: null })
    try {
      const response = await api.post(`/api/jobs/${jobId}/learning-path`)
      const pathId = response?.data?.id
      const alreadyExists = response?.data?.already_exists
      setLearningPathState({
        loadingId: null,
        error: null,
        success: { jobId, pathId, alreadyExists: !!alreadyExists }
      })
      toast.success(alreadyExists ? 'Learning path already exists for this job' : 'Learning path generated (2 credits used)')
      // Refresh credit balance
      fetchAll()
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to generate learning path'
      const status = err?.response?.status
      if (status === 402) {
        toast.error('Insufficient credits. ' + detail)
      } else {
        toast.error(detail)
      }
      setLearningPathState({ loadingId: null, error: detail, success: null })
    }
  }

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
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                <ProfileHealth profileData={studentProfile} />

                <button
                  onClick={() => navigate('/dashboard/interview')}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 active:scale-95 duration-200"
                >
                  <Zap className="w-5 h-5 text-white animate-pulse" />
                  <span className="font-bold text-white">Start Practice</span>
                </button>

                <button
                  onClick={() => navigate('/dashboard/learning-paths')}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-700 shadow-sm active:scale-95 duration-200"
                >
                  <BookOpen className="w-5 h-5 text-slate-500" />
                  <span className="font-bold">Learning Paths</span>
                </button>
              </div>

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
              <button
                onClick={() => navigate('/jobs')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm text-sm"
              >
                View All Jobs
              </button>
              <button
                onClick={handleRecomputeRecommendations}
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

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-slate-600 flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {rec.job?.location_city || 'Remote'}
                  </span>
                  <span className="text-xs bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-slate-600 capitalize font-medium">
                    {rec.job?.work_type || 'Full-time'}
                  </span>
                  {rec.status === 'applied' && (
                    <span className="text-xs bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Applied
                    </span>
                  )}
                </div>

                {(rec.job?.min_salary || rec.job?.max_salary) && (
                  <div className="mb-4 text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <span>Compensation:</span>
                    <span className="text-slate-800">
                      {rec.job?.min_salary ? `INR ${(rec.job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
                      {rec.job?.max_salary ? ` - ${(rec.job.max_salary / 100000).toFixed(1)}L` : ''}
                    </span>
                  </div>
                )}

                <div className="text-xs text-slate-500 leading-relaxed mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  {rec.explanation || rec.explain?.reasons?.[0] || 'Matched based on your profile strength and skill overlap.'}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => openDetails(rec)}
                    className="flex-1 py-2 px-3 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 active:scale-95 duration-200"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => generateLearningPath(rec)}
                    disabled={
                      learningPathState.loadingId === (rec.job?.id || rec.job_id) ||
                      (learningPathState.success?.jobId === (rec.job?.id || rec.job_id) && learningPathState.success?.alreadyExists)
                    }
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-primary-200 text-primary-700 hover:bg-primary-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:scale-95 duration-200"
                  >
                    {learningPathState.loadingId === (rec.job?.id || rec.job_id) ? (
                      <span className="flex items-center justify-center gap-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      (learningPathState.success?.jobId === (rec.job?.id || rec.job_id) && learningPathState.success?.alreadyExists)
                        ? 'Path Generated'
                        : <>
                            <BookOpen className="w-3.5 h-3.5 text-primary-600" />
                            <span>Path (2c)</span>
                          </>
                    )}
                  </button>
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
                onClick={handleRecomputeRecommendations}
                disabled={recalcLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-60 shadow-sm"
              >
                {recalcLoading ? 'Updating...' : 'Re-run Recommendations'}
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
                  <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50/60 to-indigo-50/60 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary-700 mb-2">AI Matching Insights</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{detailsRec.explanation || detailsRec.explain.summary}</p>
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
 
                    return (
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-2">Key Skills in this Role</h4>
                        <div className="flex flex-wrap gap-2">
                          {skillsToRender.map((skill, idx) => {
                            const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || `Skill ${idx + 1}`
                            return (
                              <span key={`${skillName}-${idx}`} className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold shadow-sm">
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
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{detailsRec.job?.description || 'No description available.'}</p>
                </div>
 
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-2">Why Recommended</h4>
                  {detailsRec.explanation ? (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {detailsRec.explanation}
                    </p>
                  ) : Array.isArray(detailsRec.explain?.reasons) && detailsRec.explain.reasons.length > 0 ? (
                    <ul className="space-y-2">
                      {detailsRec.explain.reasons.slice(0, 5).map((r, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-600">
                      This role is aligned with your profile, preferred location, and available skill overlap.
                    </p>
                  )}
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
