import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Building2, TrendingUp, Clock,
  CheckCircle, XCircle, AlertTriangle, LogOut, Upload, User, MapPin, Target, Zap, BookOpen, FileText, GraduationCap, Loader2, RefreshCcw
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import MatchScore from '../components/MatchScore'
import { SkeletonStats, SkeletonCard } from '../components/SkeletonLoader'
import useOptimistic from '../hooks/useOptimistic'
import CreditWidget from '../components/CreditWidget'
import ApplicationTracker from '../components/ApplicationTracker'
import ProfileHealth from '../components/ProfileHealth'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const toast = useToast()

  // State
  const [applicantData, setApplicantData] = useState(null)
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
  const [showPracticeModal, setShowPracticeModal] = useState(false)

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
    <div className="min-h-screen bg-slate-50 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">

        {/* --- HEADER ROW --- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">Student Dashboard</h1>
            <p className="text-gray-600">Welcome back, {applicantData?.full_name?.split(' ')[0] || 'Student'}</p>
            <p className="text-sm text-gray-500 mt-1">
              You have {interviewingCount} interview {interviewingCount === 1 ? 'invitation' : 'invitations'} and {newSuggestionCount} new path {newSuggestionCount === 1 ? 'suggestion' : 'suggestions'}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Profile Health Badge */}
            <ProfileHealth applicantData={applicantData} />

            {/* Practice Button (Quick Action Dial) */}
            <button
              onClick={() => setShowPracticeModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm active:scale-95"
            >
              <Zap className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Practice</span>
            </button>

            <button
              onClick={() => navigate('/dashboard/learning-paths')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
            >
              <BookOpen className="w-5 h-5" />
              <span className="font-semibold">Paths</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-red-50 hover:border-red-300 transition-colors text-gray-600 hover:text-red-600"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </motion.div>

        {/* --- QUICK ACTIONS ROW (Credit + Tracker) --- */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        >
          <CreditWidget />
          <ApplicationTracker jobApps={jobApplications} />
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3" ref={recommendationsRef}>
            <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/jobs')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:border-primary-400 hover:text-primary-700 transition-colors"
              >
                View All
              </button>
              <button
                onClick={handleRecomputeRecommendations}
                disabled={recalcLoading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${recalcLoading ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 text-gray-700 hover:border-primary-400 hover:text-primary-700'}`}
              >
                <RefreshCcw className="w-4 h-4" />
                <span>{recalcLoading ? 'Updating...' : 'Re-run'}</span>
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
                transition={{ delay: idx * 0.1 }}
                className="p-5 bg-white rounded-2xl border border-gray-200 transition-all hover:shadow-md hover:border-primary-200 flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 mr-2">
                    <h3 className="font-bold text-lg leading-tight mb-1 text-gray-900">{rec.job?.title || rec.title}</h3>
                    <p className="text-sm text-gray-600">{rec.job?.company || rec.company}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <MatchScore
                      score={((rec.match_score ?? rec.match_percentage ?? rec.score ?? 0) / 100)}
                      size="sm"
                      showLabel={false}
                    />
                    <span className="text-xs text-primary-700 font-medium">AI Match</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full text-gray-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {rec.job?.location_city || 'Remote'}
                  </span>
                  <span className="text-xs bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full text-gray-600">
                    {rec.job?.work_type || 'Full-time'}
                  </span>
                  {rec.status === 'applied' && (
                    <span className="text-xs bg-green-50 border border-green-200 px-2.5 py-1 rounded-full text-green-700">
                      Applied
                    </span>
                  )}
                </div>

                {(rec.job?.min_salary || rec.job?.max_salary) && (
                  <div className="mb-4 text-xs text-gray-600">
                    Salary: {rec.job?.min_salary ? `INR ${(rec.job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
                    {rec.job?.max_salary ? ` - INR ${(rec.job.max_salary / 100000).toFixed(1)}L` : ''}
                  </div>
                )}

                <div className="text-xs text-gray-500 mb-4">
                  {rec.explain?.reasons?.[0] || 'Matched based on your profile strength and skill overlap.'}
                </div>

                <div className="mt-auto pt-4 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => openDetails(rec)}
                    className="flex-1 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => generateLearningPath(rec)}
                    disabled={
                      learningPathState.loadingId === (rec.job?.id || rec.job_id) ||
                      (learningPathState.success?.jobId === (rec.job?.id || rec.job_id) && learningPathState.success?.alreadyExists)
                    }
                    className="flex-1 py-2 text-sm font-medium rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {learningPathState.loadingId === (rec.job?.id || rec.job_id) ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      (learningPathState.success?.jobId === (rec.job?.id || rec.job_id) && learningPathState.success?.alreadyExists)
                        ? 'Already Generated'
                        : 'Path 2c'
                    )}
                  </button>
                  <button
                    onClick={() => openEasyApply(rec)}
                    disabled={rec.status === 'applied' || rec.status === 'accepted'}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${rec.status === 'applied'
                      ? 'bg-green-50 text-green-700 cursor-not-allowed border border-green-200'
                      : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                      }`}
                  >
                    {rec.status === 'applied' ? 'Applied' : 'Easy Apply'}
                  </button>
                </div>

                {learningPathState.success?.jobId === (rec.job?.id || rec.job_id) && learningPathState.loadingId === null && (
                  <div className="mt-3 text-sm flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <Link to={`/dashboard/learning-path/${learningPathState.success.pathId || learningPathState.success.jobId}`} className="underline hover:text-green-700">
                      {learningPathState.success?.alreadyExists ? 'Open existing learning path' : 'View learning path'}
                    </Link>
                  </div>
                )}
                {learningPathState.error && learningPathState.loadingId === null && (
                  <p className="mt-2 text-sm text-red-500">{learningPathState.error}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {!noApplicantProfile && recommendations.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900">No recommendations yet</h3>
            <p className="text-gray-600 mt-2 max-w-xl mx-auto">
              Re-run recommendations after profile updates or continue practicing interviews to improve matching quality.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                onClick={handleRecomputeRecommendations}
                disabled={recalcLoading}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-60"
              >
                {recalcLoading ? 'Updating...' : 'Re-run Recommendations'}
              </button>
              <button
                onClick={() => setShowPracticeModal(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
              >
                Practice Interview
              </button>
            </div>
          </div>
        )}

        {/* --- MODALS --- */}

        {/* Practice Mode Selection Modal */}
        <AnimatePresence>
          {showPracticeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowPracticeModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white border border-gray-200 rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
              >
                <div className="p-6 text-center border-b border-gray-200">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Practice for Success</h3>
                  <p className="text-gray-600 text-sm">Choose your interview mode</p>
                </div>
                <div className="p-6 grid gap-4">
                  <button
                    onClick={() => navigate('/dashboard/interview?mode=micro')}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left group"
                  >
                    <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200">
                      <Zap className="w-6 h-6 text-primary-700" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 group-hover:text-primary-700">Micro Practice</h4>
                      <p className="text-xs text-gray-500">Quick 5-minute session. 1 question.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/dashboard/interview')}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left group"
                  >
                    <div className="p-3 bg-primary-100 rounded-lg group-hover:bg-primary-200">
                      <BookOpen className="w-6 h-6 text-primary-700" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 group-hover:text-primary-700">Full Mock Interview</h4>
                      <p className="text-xs text-gray-500">Deep dive ~30mins. Comprehensive feedback.</p>
                    </div>
                  </button>
                </div>
                <div className="p-4 bg-white text-center border border-gray-200 rounded-lg">
                  <button onClick={() => setShowPracticeModal(false)} className="text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Easy Apply Modal */}
        {easyApplyOpen && easyApplyRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg card border border-gray-200 bg-white shadow-xl">
              <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
                <h3 className="font-bold text-lg">Apply to {easyApplyRec.job?.title}</h3>
                <button onClick={() => setEasyApplyOpen(false)} className="text-gray-600 hover:text-gray-900"><XCircle className="w-6 h-6" /></button>
              </div>
              <form onSubmit={submitEasyApply} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Full Name</label>
                    <input name="full_name" className="input bg-white" placeholder="Name" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Email</label>
                    <input name="email" type="email" className="input bg-white" placeholder="Email" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Resume</label>
                  <div className="p-2 border border-gray-300 rounded bg-gray-50 text-sm text-gray-700 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Using uploaded resume</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Cover Letter / Note</label>
                  <textarea name="questions" className="input bg-white" rows="3" placeholder="Why are you a good fit?"></textarea>
                </div>
                <div className="pt-2">
                  <button className="btn-primary w-full py-3" disabled={easyApplyLoading}>
                    {easyApplyLoading ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {detailsOpen && detailsRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl card border border-gray-200 bg-white max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-start mb-6 border-b border-gray-200 pb-4">
                <div>
                  <h3 className="font-bold text-xl">{detailsRec.job?.title}</h3>
                  <p className="text-primary-600 text-sm">{detailsRec.job?.company}</p>
                </div>
                <button onClick={() => setDetailsOpen(false)} className="text-gray-600 hover:text-gray-900"><XCircle className="w-6 h-6" /></button>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl">
                  {[
                    { label: 'Location', value: detailsRec.job?.location_city || 'Remote' },
                    { label: 'Type', value: detailsRec.job?.work_type || 'Full-time' },
                    { label: 'Match', value: `${detailsRec.match_percentage || (detailsRec.score ? Math.round(detailsRec.score * 100) : 0)}%` },
                    { label: 'Posted', value: '2d ago' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                      <div className="font-medium text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">About the Role</h4>
                  <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{detailsRec.job?.description || 'No description available.'}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Why Recommended</h4>
                  <ul className="space-y-2">
                    {(detailsRec.explain?.reasons || []).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button onClick={() => setDetailsOpen(false)} className="flex-1 py-3 border border-gray-300 rounded-xl hover:bg-gray-50">Close</button>
                  <button onClick={() => { setDetailsOpen(false); openEasyApply(detailsRec) }} className="flex-1 py-3 btn-primary rounded-xl">Apply Now</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowUploadForm(false)}>
            <div className="card w-full max-w-lg border border-gray-200 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl">Upload Resume</h3>
                <button onClick={() => setShowUploadForm(false)} className="text-gray-400"><XCircle className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-gray-700">Resume File (PDF/DOCX)</label>
                  <input type="file" name="resume" required className="input w-full p-3 border-dashed"
                    onChange={(e) => setSelectedResume(e.target.files[0])}
                  />
                </div>
                {selectedResume && (
                  <div className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Selected: {selectedResume.name}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <input name="location" placeholder="Preferred Location" className="input" />
                  <input name="jee_rank" type="number" placeholder="JEE Rank (Optional)" className="input" />
                </div>
                <button type="submit" className="btn-primary w-full py-3" disabled={uploadLoading}>
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
