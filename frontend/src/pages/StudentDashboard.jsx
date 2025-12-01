import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Briefcase, Building2, FileText, TrendingUp, Clock, 
  CheckCircle, XCircle, AlertTriangle, LogOut, Upload, User, MapPin, GraduationCap, Target 
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import StatusBadge, { NewBadge } from '../components/StatusBadge'
import MatchScore from '../components/MatchScore'
import ProgressBar from '../components/ProgressBar'
import { SkeletonStats, SkeletonCard } from '../components/SkeletonLoader'
import useOptimistic from '../hooks/useOptimistic'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [stats, setStats] = useState({
    jobApplications: 0,
    collegeApplications: 0,
    recommendations: 0
  })
  const [jobApplications, setJobApplications] = useState([])
  const [collegeApplications, setCollegeApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedResume, setSelectedResume] = useState(null)
  const [selectedMarksheets, setSelectedMarksheets] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [easyApplyOpen, setEasyApplyOpen] = useState(false)
  const [easyApplyRec, setEasyApplyRec] = useState(null)
  const [easyApplyLoading, setEasyApplyLoading] = useState(false)
  const [easyApplyError, setEasyApplyError] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsRec, setDetailsRec] = useState(null)
  const [applicantId, setApplicantId] = useState(null)
  const [noApplicantProfile, setNoApplicantProfile] = useState(false)
  const uploadFormRef = React.useRef(null)
  const recommendationsRef = React.useRef(null)

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

    const form = e.target
    const formData = new FormData()
    
    // Add resume file (required)
    const resumeInput = form.elements['resume']
    if (resumeInput.files[0]) {
      formData.append('resume', resumeInput.files[0])
    }
    
    // Add marksheets (optional, multiple files)
    const marksheetsInput = form.elements['marksheets']
    if (marksheetsInput.files.length > 0) {
      for (let i = 0; i < marksheetsInput.files.length; i++) {
        formData.append('marksheets', marksheetsInput.files[i])
      }
    }
    
    // Add text fields
    const location = form.elements['location']?.value
    if (location) formData.append('location', location)
    
    const jeeRank = form.elements['jee_rank']?.value
    if (jeeRank) formData.append('jee_rank', jeeRank)
    
    const preferences = form.elements['preferences']?.value
    if (preferences) formData.append('preferences', preferences)
    
    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      setUploadSuccess(true)
      form.reset()
      
      // Parse the resume if applicant_id is returned
      if (response.data.applicant_id) {
        setTimeout(async () => {
          try {
            const parseRes = await api.post(`/parse/${response.data.applicant_id}`)
            toast.success('Resume uploaded and parsed successfully! Check your recommendations.')
            setShowUploadForm(false)
            setNoApplicantProfile(false)
            // Persist DB applicant id to avoid upload prompt on refresh
            const dbId = parseRes.data?.db_applicant_id
            if (dbId) {
              secureStorage.setItem('db_applicant_id', String(dbId))
              setApplicantId(dbId)
            }
            fetchDashboardData()
            // After dashboard refresh, also fetch recommendations and scroll to section
            try {
              const targetId = dbId || response.data.db_id || applicantId
              const recRes = await api.get(`/api/recommendations/${targetId}`)
              setRecommendations(recRes.data.job_recommendations || [])
            } catch {}
            setTimeout(() => {
              if (recommendationsRef.current) {
                recommendationsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }, 200)
          } catch (parseErr) {
            console.error('Parse error:', parseErr)
            toast.error('Resume uploaded but parsing failed. Please contact support.')
          }
        }, 1000)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
      console.error('Upload error:', err)
    } finally {
      setUploadLoading(false)
    }
  }


  useEffect(() => {
    // Fetch applicant profile, then dashboard data and recommendations
    const fetchAll = async () => {
      try {
        setLoading(true)
        // Prefer persisted applicant id first (set after parse)
        const storedId = secureStorage.getItem('db_applicant_id')
        if (storedId) {
          setApplicantId(Number(storedId))
          await fetchDashboardData()
          try {
            const recRes = await api.get(`/api/recommendations/${storedId}`)
            setRecommendations(recRes.data.job_recommendations || [])
            setNoApplicantProfile(false)
            return
          } catch {
            // fall through to profile fetch
          }
        }

        // Get applicant profile (DB id)
        const profileRes = await api.get('/api/student/applicant')
        setApplicantId(profileRes.data.id)
        secureStorage.setItem('db_applicant_id', String(profileRes.data.id))
        // Fetch dashboard data
        await fetchDashboardData()
        // Fetch recommendations
        const recRes = await api.get(`/api/recommendations/${profileRes.data.id}`)
        setRecommendations(recRes.data.job_recommendations || [])
      } catch (err) {
        if (err.response?.status === 404) {
          // If we have a stored applicant id or recommendations, don't prompt upload
          const storedId = secureStorage.getItem('db_applicant_id')
          if (storedId || recommendations.length > 0) {
            setNoApplicantProfile(false)
          } else {
            setNoApplicantProfile(true)
            setShowUploadForm(true)
          }
          setError(null)
        } else {
          setError(err.response?.data?.detail || 'Failed to load dashboard')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [jobApps, collegeApps] = await Promise.all([
        api.get('/api/student/applications/jobs'),
        api.get('/api/student/applications/colleges')
      ])

      setJobApplications(jobApps.data.applications)
      setCollegeApplications(collegeApps.data.applications)
      setStats({
        jobApplications: jobApps.data.total,
        collegeApplications: collegeApps.data.total,
        recommendations: jobApps.data.total + collegeApps.data.total
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const {
    data: optimisticRecs,
    update: updateRecStatus,
    isPending: statusUpdatePending,
  } = useOptimistic(recommendations, setRecommendations)

  const handleApplyToJob = async (recId) => {
    try {
      // Optimistically update UI
      updateRecStatus(
        async () => {
          await api.patch(`/api/job-recommendation/${recId}/status`, { status: 'applied' })
        },
        (prev) => prev.map((r) => r.id === recId ? { ...r, status: 'applied' } : r)
      )
      toast.success('Applied to job successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply to job')
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

  const submitEasyApply = async (e) => {
    e.preventDefault()
    if (!easyApplyRec) return
    setEasyApplyLoading(true)
    setEasyApplyError(null)
    try {
      const form = e.currentTarget
      const formData = new FormData(form)
      // Attach recommendation id for backend
      formData.append('recommendation_id', easyApplyRec.id)
      
      // Optimistically update UI before API call
      updateRecStatus(
        async () => {
          // Try a dedicated apply endpoint if available
          let ok = false
          try {
            const res = await api.post(`/api/job-recommendation/${easyApplyRec.id}/apply`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
            ok = res.status >= 200 && res.status < 300
          } catch {
            ok = false
          }
          if (!ok) {
            // Fallback: mark recommendation as applied
            await api.patch(`/api/job-recommendation/${easyApplyRec.id}/status`, { status: 'applied' })
          }
        },
        (prev) => prev.map((r) => r.id === easyApplyRec.id ? { ...r, status: 'applied' } : r)
      )
      
      setEasyApplyOpen(false)
      setEasyApplyRec(null)
      toast.success('Application submitted successfully!')
    } catch (err) {
      setEasyApplyError(err.response?.data?.detail || 'Easy Apply failed')
      toast.error(err.response?.data?.detail || 'Easy Apply failed')
    } finally {
      setEasyApplyLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'applied':
      case 'under_review':
        return <Clock className="w-5 h-5 text-yellow-400" />
      case 'shortlisted':
      case 'interviewing':
      case 'offered':
        return <TrendingUp className="w-5 h-5 text-blue-400" />
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'rejected':
      case 'withdrawn':
        return <XCircle className="w-5 h-5 text-red-400" />
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-400" />
    }
  }

  // When upload form opens, scroll it into view subtly
  useEffect(() => {
    if (showUploadForm && uploadFormRef.current) {
      uploadFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [showUploadForm])

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 px-4">
        <div className="max-w-7xl mx-auto py-8 space-y-8">
          <div className="animate-pulse">
            <div className="h-8 bg-dark-800 rounded w-64 mb-2"></div>
            <div className="h-4 bg-dark-800 rounded w-96"></div>
          </div>
          <SkeletonStats />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard count={2} />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 flex items-center justify-center">
        <div className="card max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-center text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">

        {noApplicantProfile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mb-8 border border-yellow-500/30 bg-dark-800"
          >
            <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2">
              <Upload className="w-6 h-6 text-yellow-400" />
              <span>Upload your resume to get personalized recommendations</span>
            </h2>
            <p className="text-gray-400 mb-4">We couldn’t find your profile yet. Upload your resume and optional marksheets to generate college and job recommendations tailored to you.</p>
            <button
              onClick={() => setShowUploadForm(true)}
              className="btn-primary w-full sm:w-auto"
            >
              Upload Documents
            </button>
          </motion.div>
        )}

        {/* Recommended Jobs Section */}
        {recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 1.5 }}
            className="card mb-8 border border-primary-500/30 bg-dark-800"
            ref={recommendationsRef}
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <TrendingUp className="w-6 h-6 text-primary-400" />
              <span>Recommended Jobs For You</span>
            </h2>
            <div className="space-y-3">
              {optimisticRecs.slice(0, 5).map((rec, idx) => (
                <motion.div 
                  key={rec.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`p-4 bg-dark-900 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-all hover:shadow-lg hover:shadow-primary-500/10 group ${
                    statusUpdatePending ? 'opacity-70' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{rec.job.title}</h3>
                        {idx < 3 && <NewBadge />}
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{rec.job.company}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {rec.job.location_city || 'N/A'}
                        </span>
                        <span>•</span>
                        <span>{rec.job.work_type || 'N/A'}</span>
                      </div>
                      <div className="mt-2">
                        <StatusBadge status={rec.status} size="sm" />
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center gap-3">
                      <MatchScore score={rec.score || 0.5} size="sm" showLabel={false} />
                      
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openDetails(rec)}
                          className="px-3 py-1.5 rounded-md text-sm border border-dark-600 hover:bg-dark-800 hover:border-primary-500/50 transition-all whitespace-nowrap"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => openEasyApply(rec)}
                          disabled={rec.status === 'applied' || rec.status === 'accepted' || rec.status === 'offered'}
                          className={`px-3 py-1.5 rounded-md text-sm border transition-all whitespace-nowrap ${
                            rec.status === 'applied' 
                              ? 'border-green-500/40 text-green-400 bg-green-900/10 cursor-not-allowed' 
                              : 'border-primary-500/40 text-primary-400 hover:bg-primary-900/20 hover:border-primary-500'
                          }`}
                        >
                          {rec.status === 'applied' ? 'Applied ✓' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {rec.explain?.reasons && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-3 pt-3 border-t border-dark-700"
                    >
                      <p className="text-xs text-gray-500 mb-1">Why recommended:</p>
                      <ul className="text-xs text-gray-400 space-y-1">
                        {rec.explain.reasons.slice(0, 2).map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Student Dashboard</h1>
            <p className="text-gray-400">Track your applications and recommendations</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </motion.div>
        {easyApplyOpen && easyApplyRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-lg card border border-primary-500/30 bg-dark-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Easy Apply — {easyApplyRec.job?.title}</h3>
                <button className="text-gray-400 hover:text-white" onClick={() => { setEasyApplyOpen(false); setEasyApplyRec(null) }}>✕</button>
              </div>
              {easyApplyError && (
                <div className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">{easyApplyError}</div>
              )}
              <form onSubmit={submitEasyApply} encType="multipart/form-data" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Full Name</label>
                    <input name="full_name" required className="input" placeholder="Your name" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Email</label>
                    <input name="email" type="email" required className="input" placeholder="you@example.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Resume (PDF/DOCX)</label>
                  <input name="resume" type="file" accept=".pdf,.doc,.docx" required className="input" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Quick Questions</label>
                  <textarea name="questions" rows="3" className="input" placeholder="e.g., Notice period, current CTC, skills summary"></textarea>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={easyApplyLoading} className="btn-primary flex-1">
                    {easyApplyLoading ? 'Submitting...' : 'Submit Application'}
                  </button>
                  <button type="button" className="px-6 py-2 border border-dark-600 rounded-lg hover:bg-dark-800" onClick={() => { setEasyApplyOpen(false); setEasyApplyRec(null) }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {detailsOpen && detailsRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-2xl card border border-primary-500/30 bg-dark-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{detailsRec.job?.title} — Details</h3>
                <button className="text-gray-400 hover:text-white" onClick={() => { setDetailsOpen(false); setDetailsRec(null) }}>✕</button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Company</p>
                    <p className="font-medium">{detailsRec.job?.company || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Location</p>
                    <p className="font-medium">{detailsRec.job?.location_city || detailsRec.job?.location || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Work Type</p>
                    <p className="font-medium">{detailsRec.job?.work_type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Popularity</p>
                    <p className="font-medium">{detailsRec.job?.popularity ?? 'N/A'}</p>
                  </div>
                </div>
                <div>
                  {(() => {
                    const required = (detailsRec.job?.required_skills || detailsRec.job?.skills || []).map((s) => typeof s === 'string' ? s : (s?.name || ''))
                    const matched = (detailsRec.explain?.matched_skills || detailsRec.explain?.skills_matched || []).map((s) => typeof s === 'string' ? s.toLowerCase() : (s?.toLowerCase?.() || ''))
                    const matchCount = required.filter((s) => matched.includes(String(s).toLowerCase())).length
                    return (
                      <>
                        <p className="text-sm text-gray-400 mb-1">Required Skills</p>
                        {required.length > 0 ? (
                          <div className="mb-2 text-xs text-gray-400">{matchCount}/{required.length} required skills matched</div>
                        ) : (
                          <div className="mb-2 text-xs text-gray-500">No skills listed</div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {required.map((sk, idx) => {
                            const isMatch = matched.includes(String(sk).toLowerCase())
                            return (
                              <span
                                key={idx}
                                className={`px-2 py-1 text-xs rounded border ${isMatch ? 'bg-green-900/20 border-green-500/40 text-green-300' : 'bg-dark-900 border-dark-700 text-gray-300'}`}
                              >
                                {sk}
                              </span>
                            )
                          })}
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Job Description</p>
                  <div className="prose prose-invert max-w-none text-sm text-gray-300 whitespace-pre-wrap">
                    {detailsRec.job?.description || detailsRec.job?.jd || 'No description provided.'}
                  </div>
                </div>
                {detailsRec.explain?.reasons && detailsRec.explain.reasons.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Why this job is recommended</p>
                    <ul className="list-disc list-inside text-sm text-gray-300">
                      {detailsRec.explain.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => { setDetailsOpen(false); openEasyApply(detailsRec) }}>Easy Apply</button>
                  <button className="px-6 py-2 border border-dark-600 rounded-lg hover:bg-dark-800" onClick={() => setDetailsOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Form */}
        {showUploadForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mb-8"
            ref={uploadFormRef}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center space-x-2">
                <Upload className="w-6 h-6 text-primary-400" />
                <span>Upload Your Documents</span>
              </h2>
              <button
                onClick={() => setShowUploadForm(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-red-400 text-sm">{error}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm">Upload successful! Processing your resume...</span>
              </div>
            )}

            <form onSubmit={handleFileUpload} className="space-y-4" encType="multipart/form-data">
              <div>
                <label className="block text-sm font-medium mb-2">Resume (PDF/DOCX) *</label>
                <input
                  type="file"
                  name="resume"
                  accept=".pdf,.doc,.docx"
                  required
                  onChange={(e) => setSelectedResume(e.target.files[0])}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:border-primary-500 focus:outline-none"
                />
                {selectedResume && (
                  <p className="text-xs text-primary-400 mt-1 flex items-center">
                    <FileText className="w-3 h-3 mr-1" />
                    {selectedResume.name} ({(selectedResume.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Marksheets (PDF/DOCX)</label>
                <input
                  type="file"
                  name="marksheets"
                  accept=".pdf,.doc,.docx"
                  multiple
                  onChange={(e) => setSelectedMarksheets(Array.from(e.target.files))}
                  className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:border-primary-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">You can select multiple files</p>
                {selectedMarksheets.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {selectedMarksheets.map((file, idx) => (
                      <p key={idx} className="text-xs text-primary-400 flex items-center">
                        <FileText className="w-3 h-3 mr-1" />
                        {file.name} ({(file.size / 1024).toFixed(2)} KB)
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Preferred Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    placeholder="e.g., Bangalore, India"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    <GraduationCap className="w-4 h-4 inline mr-1" />
                    JEE Rank (if applicable)
                  </label>
                  <input
                    type="number"
                    name="jee_rank"
                    placeholder="Enter your JEE rank"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Career Preferences</label>
                <textarea
                  name="preferences"
                  rows="3"
                  placeholder="Tell us about your career goals, interests, or specific requirements..."
                  className="input"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="btn-primary flex-1"
                >
                  {uploadLoading ? 'Uploading...' : 'Upload & Process'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-6 py-2 border border-dark-600 rounded-lg hover:bg-dark-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Job Applications"
            value={stats.jobApplications}
            icon={Briefcase}
            color="blue"
            delay={ANIMATION_DELAYS.CARD_STAGGER}
          />
          
          <StatCard
            title="College Applications"
            value={stats.collegeApplications}
            icon={Building2}
            color="purple"
            delay={ANIMATION_DELAYS.CARD_STAGGER * 2}
          />
          
          <StatCard
            title="Recommendations"
            value={stats.recommendations}
            icon={Target}
            color="green"
            trend={stats.recommendations > 0 ? 'up' : undefined}
            trendValue={stats.recommendations > 0 ? `${stats.recommendations} new` : undefined}
            delay={ANIMATION_DELAYS.CARD_STAGGER * 3}
          />

          <StatCard
            title="Profile Strength"
            value={applicantId ? '85%' : '10%'}
            icon={User}
            color={applicantId ? 'green' : 'red'}
            delay={ANIMATION_DELAYS.CARD_STAGGER * 4}
          />
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${recommendations.length > 0 ? 'hidden' : ''}`}>
          {/* Job Applications */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 4 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Briefcase className="w-6 h-6 text-primary-400" />
              <span>Job Applications</span>
            </h2>
            {jobApplications.length === 0 ? (
              <EmptyState
                icon="briefcase"
                title="No Job Applications"
                message="Start exploring job opportunities and apply to positions that match your skills and interests."
                actionLabel="Browse Jobs"
                onAction={() => navigate('/jobs')}
              />
            ) : (
              <div className="space-y-3">
                {jobApplications.slice(0, 5).map((app, idx) => (
                  <motion.div 
                    key={app.application_id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium mb-1">{app.job_title}</h3>
                        <p className="text-sm text-gray-400">{app.company}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Applied: {new Date(app.applied_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={app.status} size="sm" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* College Applications */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-primary-400" />
              <span>College Applications</span>
            </h2>
            {collegeApplications.length === 0 ? (
              <EmptyState
                icon="building"
                title="No College Applications"
                message="Discover colleges and programs that align with your academic profile and career goals."
                actionLabel="Explore Colleges"
                onAction={() => navigate('/colleges')}
              />
            ) : (
              <div className="space-y-3">
                {collegeApplications.slice(0, 5).map((app, idx) => (
                  <motion.div 
                    key={app.application_id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium mb-1">{app.college_name}</h3>
                        <p className="text-sm text-gray-400">Program ID: {app.program_id || 'General'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Applied: {new Date(app.applied_at).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={app.status} size="sm" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
