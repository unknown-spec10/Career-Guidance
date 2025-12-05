import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Building2, TrendingUp, Clock,
  CheckCircle, XCircle, AlertTriangle, LogOut, Upload, User, MapPin, Target, Zap, BookOpen, FileText, GraduationCap
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import StatusBadge, { NewBadge } from '../components/StatusBadge'
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
  const [collegeApplications, setCollegeApplications] = useState([])
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
  const [applicantId, setApplicantId] = useState(null)
  const [noApplicantProfile, setNoApplicantProfile] = useState(false)

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

    const form = e.target
    const formData = new FormData()

    const resumeInput = form.elements['resume']
    if (!resumeInput || !resumeInput.files || !resumeInput.files[0]) {
      setError('Please select a resume file')
      setUploadLoading(false)
      return
    }
    formData.append('resume', resumeInput.files[0])

    const marksheetsInput = form.elements['marksheets']
    if (marksheetsInput.files.length > 0) {
      for (let i = 0; i < marksheetsInput.files.length; i++) {
        formData.append('marksheets', marksheetsInput.files[i])
      }
    }

    const location = form.elements['location']?.value
    if (location) formData.append('location', location)
    const jeeRank = form.elements['jee_rank']?.value
    if (jeeRank) formData.append('jee_rank', jeeRank)
    const preferences = form.elements['preferences']?.value
    if (preferences) formData.append('preferences', preferences)

    try {
      const response = await api.post('/upload', formData)
      setUploadSuccess(true)
      form.reset()

      if (response.data.applicant_id) {
        setTimeout(async () => {
          try {
            const parseRes = await api.post(`/parse/${response.data.applicant_id}`)
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
            toast.error('Resume uploaded but parsing failed.')
          }
        }, 1000)
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.response?.data?.detail || 'Upload failed.')
    } finally {
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
      const [jobApps, collegeApps] = await Promise.all([
        api.get('/api/student/applications/jobs').catch(() => ({ data: { applications: [] } })),
        api.get('/api/student/applications/colleges').catch(() => ({ data: { applications: [] } }))
      ])
      setJobApplications(jobApps.data?.applications || [])
      setCollegeApplications(collegeApps.data?.applications || [])

      // Recommendations
      if (profileId) {
        const recRes = await api.get(`/api/recommendations/${profileId}`)
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
      <div className="min-h-screen bg-dark-900 pt-24 px-4">
        <div className="max-w-7xl mx-auto py-8">
          <SkeletonStats />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">

        {/* --- HEADER ROW --- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1">Student Dashboard</h1>
            <p className="text-gray-400">Welcome back, {applicantData?.full_name?.split(' ')[0] || 'Student'}</p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Profile Health Badge */}
            <ProfileHealth applicantData={applicantData} />

            {/* Practice Button (Quick Action Dial) */}
            <button
              onClick={() => setShowPracticeModal(true)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
            >
              <Zap className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Practice</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 bg-dark-800 border border-dark-600 rounded-xl hover:bg-red-900/20 hover:border-red-500/30 transition-colors text-gray-400 hover:text-red-400"
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
          <ApplicationTracker jobApps={jobApplications} collegeApps={collegeApplications} />
        </motion.div>

        {/* --- NO PROFILE STATE --- */}
        {noApplicantProfile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-8 p-8 border border-dashed border-dark-600 rounded-2xl bg-dark-800/50 text-center"
          >
            <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Setup Your Profile</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">Upload your resume to unlock AI-powered recommendations and interview practice.</p>
            <button onClick={() => setShowUploadForm(true)} className="btn-primary">Upload Resume</button>
          </motion.div>
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
                className="p-5 bg-dark-800 rounded-xl border border-dark-700 hover:border-primary-500/30 transition-all hover:shadow-lg flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 mr-2">
                    <h3 className="font-bold text-lg leading-tight mb-1 text-white">{rec.job?.title || rec.title}</h3>
                    <p className="text-sm text-gray-400">{rec.job?.company || rec.company}</p>
                  </div>
                  <MatchScore score={rec.score || rec.match_score || 0.5} size="sm" showLabel={false} />
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-dark-900 border border-dark-700 px-2 py-1 rounded text-gray-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {rec.job?.location_city || 'Remote'}
                  </span>
                  <span className="text-xs bg-dark-900 border border-dark-700 px-2 py-1 rounded text-gray-400">
                    {rec.job?.work_type || 'Full-time'}
                  </span>
                </div>

                <div className="mt-auto pt-4 border-t border-dark-700/50 flex gap-2">
                  <button
                    onClick={() => openDetails(rec)}
                    className="flex-1 py-2 text-sm font-medium border border-dark-600 rounded-lg hover:bg-dark-700 transition-colors text-gray-300"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => openEasyApply(rec)}
                    disabled={rec.status === 'applied' || rec.status === 'accepted'}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${rec.status === 'applied'
                        ? 'bg-green-900/20 text-green-400 cursor-not-allowed border border-green-500/20'
                        : 'bg-primary-600/90 hover:bg-primary-500 text-white shadow-lg shadow-primary-900/20'
                      }`}
                  >
                    {rec.status === 'applied' ? 'Applied' : 'Easy Apply'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* --- MODALS --- */}

        {/* Practice Mode Selection Modal */}
        <AnimatePresence>
          {showPracticeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowPracticeModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-6 text-center border-b border-dark-700">
                  <h3 className="text-2xl font-bold mb-2">Practice for Success</h3>
                  <p className="text-gray-400 text-sm">Choose your interview mode</p>
                </div>
                <div className="p-6 grid gap-4">
                  <button
                    onClick={() => navigate('/dashboard/interview?mode=micro')}
                    className="flex items-center gap-4 p-4 rounded-xl border border-dark-600 hover:border-blue-500 hover:bg-blue-900/10 transition-all text-left group"
                  >
                    <div className="p-3 bg-blue-900/20 rounded-lg group-hover:bg-blue-900/30">
                      <Zap className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-200 group-hover:text-blue-300">Micro Practice</h4>
                      <p className="text-xs text-gray-500">Quick 5-minute session. 1 Question.</p>
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/dashboard/interview')}
                    className="flex items-center gap-4 p-4 rounded-xl border border-dark-600 hover:border-purple-500 hover:bg-purple-900/10 transition-all text-left group"
                  >
                    <div className="p-3 bg-purple-900/20 rounded-lg group-hover:bg-purple-900/30">
                      <BookOpen className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-200 group-hover:text-purple-300">Full Mock Interview</h4>
                      <p className="text-xs text-gray-500">Deep dive ~30mins. Comprehensive feedback.</p>
                    </div>
                  </button>
                </div>
                <div className="p-4 bg-dark-900/50 text-center">
                  <button onClick={() => setShowPracticeModal(false)} className="text-sm text-gray-500 hover:text-gray-300">Cancel</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Easy Apply Modal */}
        {easyApplyOpen && easyApplyRec && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg card border border-primary-500/30 bg-dark-800">
              <div className="flex justify-between items-center mb-6 border-b border-dark-700 pb-4">
                <h3 className="font-bold text-lg">Apply to {easyApplyRec.job?.title}</h3>
                <button onClick={() => setEasyApplyOpen(false)} className="text-gray-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
              </div>
              <form onSubmit={submitEasyApply} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Full Name</label>
                    <input name="full_name" className="input bg-dark-900" placeholder="Name" required />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Email</label>
                    <input name="email" type="email" className="input bg-dark-900" placeholder="Email" required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Resume</label>
                  <div className="p-2 border border-dark-600 rounded bg-dark-900/50 text-sm text-gray-300 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Using uploaded resume</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Cover Letter / Note</label>
                  <textarea name="questions" className="input bg-dark-900" rows="3" placeholder="Why are you a good fit?"></textarea>
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
            <div className="w-full max-w-2xl card border border-primary-500/30 bg-dark-800 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6 border-b border-dark-700 pb-4">
                <div>
                  <h3 className="font-bold text-xl">{detailsRec.job?.title}</h3>
                  <p className="text-primary-400 text-sm">{detailsRec.job?.company}</p>
                </div>
                <button onClick={() => setDetailsOpen(false)} className="text-gray-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-dark-900/50 rounded-xl">
                  {[
                    { label: 'Location', value: detailsRec.job?.location_city || 'Remote' },
                    { label: 'Type', value: detailsRec.job?.work_type || 'Full-time' },
                    { label: 'Match', value: `${detailsRec.score || 0}%` },
                    { label: 'Posted', value: '2d ago' },
                  ].map((item, i) => (
                    <div key={i}>
                      <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                      <div className="font-medium text-sm">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <h4 className="font-semibold text-gray-300 mb-2">About the Role</h4>
                  <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">{detailsRec.job?.description || 'No description available.'}</p>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-300 mb-2">Why Recommended</h4>
                  <ul className="space-y-2">
                    {(detailsRec.explain?.reasons || []).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3 pt-4 border-t border-dark-700">
                  <button onClick={() => setDetailsOpen(false)} className="flex-1 py-3 border border-dark-600 rounded-xl hover:bg-dark-700">Close</button>
                  <button onClick={() => { setDetailsOpen(false); openEasyApply(detailsRec) }} className="flex-1 py-3 btn-primary rounded-xl">Apply Now</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowUploadForm(false)}>
            <div className="card w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl">Upload Resume</h3>
                <button onClick={() => setShowUploadForm(false)} className="text-gray-400"><XCircle className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-gray-400">Resume File (PDF/DOCX)</label>
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
                <button className="btn-primary w-full py-3" disabled={uploadLoading}>
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
