import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Briefcase, Building2, FileText, TrendingUp, Clock, 
  CheckCircle, XCircle, AlertTriangle, LogOut, Upload, User, MapPin, GraduationCap 
} from 'lucide-react'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'

export default function StudentDashboard() {
  const navigate = useNavigate()
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
  const [applicantId, setApplicantId] = useState(null)
  const [noApplicantProfile, setNoApplicantProfile] = useState(false)
  const uploadFormRef = React.useRef(null)
  const recommendationsRef = React.useRef(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
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
            alert('Resume uploaded and parsed successfully! Check your recommendations.')
            setShowUploadForm(false)
            setNoApplicantProfile(false)
            // Persist DB applicant id to avoid upload prompt on refresh
            const dbId = parseRes.data?.db_applicant_id
            if (dbId) {
              localStorage.setItem('db_applicant_id', String(dbId))
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
            alert('Resume uploaded but parsing failed. Please contact support.')
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
        const storedId = localStorage.getItem('db_applicant_id')
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
        localStorage.setItem('db_applicant_id', String(profileRes.data.id))
        // Fetch dashboard data
        await fetchDashboardData()
        // Fetch recommendations
        const recRes = await api.get(`/api/recommendations/${profileRes.data.id}`)
        setRecommendations(recRes.data.job_recommendations || [])
      } catch (err) {
        if (err.response?.status === 404) {
          // If we have a stored applicant id or recommendations, don't prompt upload
          const storedId = localStorage.getItem('db_applicant_id')
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

  const handleApplyToJob = async (recId) => {
    try {
      await api.patch(`/api/job-recommendation/${recId}/status`, { status: 'applied' })
      setRecommendations((prev) => prev.map((r) => r.id === recId ? { ...r, status: 'applied' } : r))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to apply to job')
    }
  }

  const openEasyApply = (rec) => {
    setEasyApplyRec(rec)
    setEasyApplyError(null)
    setEasyApplyOpen(true)
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
      setRecommendations((prev) => prev.map((r) => r.id === easyApplyRec.id ? { ...r, status: 'applied' } : r))
      setEasyApplyOpen(false)
      setEasyApplyRec(null)
    } catch (err) {
      setEasyApplyError(err.response?.data?.detail || 'Easy Apply failed')
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
      <div className="min-h-screen bg-dark-900 pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
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
              {recommendations.slice(0, 5).map((rec) => (
                <div key={rec.id} className="p-4 bg-dark-900 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{rec.job.title}</h3>
                      <p className="text-sm text-gray-400">{rec.job.company}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Location: {rec.job.location_city || 'N/A'} | Type: {rec.job.work_type || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Score: <span className="text-primary-400 font-semibold">{rec.score?.toFixed(1)}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-primary-400 mb-2 capitalize">{rec.status.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEasyApply(rec)}
                            disabled={rec.status === 'applied' || rec.status === 'accepted' || rec.status === 'offered'}
                            className={`px-3 py-1 rounded-md text-sm border transition-colors ${rec.status === 'applied' ? 'border-green-500/40 text-green-400 bg-green-900/10' : 'border-primary-500/40 text-primary-400 hover:bg-primary-900/20'}`}
                          >
                            {rec.status === 'applied' ? 'Applied' : 'Easy Apply'}
                          </button>
                          <button
                            onClick={() => handleApplyToJob(rec.id)}
                            disabled={rec.status === 'applied' || rec.status === 'accepted' || rec.status === 'offered'}
                            className="px-3 py-1 rounded-md text-sm border border-dark-600 hover:bg-dark-800 transition-colors"
                          >
                            Mark Applied
                          </button>
                        </div>
                    </div>
                  </div>
                  {rec.explain?.reasons && (
                    <ul className="text-xs text-gray-400 mt-2 list-disc list-inside">
                      {rec.explain.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Job Applications</p>
                <p className="text-3xl font-bold">{stats.jobApplications}</p>
              </div>
              <Briefcase className="w-12 h-12 text-primary-400 opacity-50" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 2 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">College Applications</p>
                <p className="text-3xl font-bold">{stats.collegeApplications}</p>
              </div>
              <Building2 className="w-12 h-12 text-primary-400 opacity-50" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 3 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Applications</p>
                <p className="text-3xl font-bold">{stats.recommendations}</p>
              </div>
              <FileText className="w-12 h-12 text-primary-400 opacity-50" />
            </div>
          </motion.div>
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
              <p className="text-gray-400 text-center py-8">No job applications yet</p>
            ) : (
              <div className="space-y-3">
                {jobApplications.slice(0, 5).map((app) => (
                  <div key={app.application_id} className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium mb-1">{app.job_title}</h3>
                        <p className="text-sm text-gray-400">{app.company}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Applied: {new Date(app.applied_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(app.status)}
                        <span className="text-sm capitalize">{app.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
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
              <p className="text-gray-400 text-center py-8">No college applications yet</p>
            ) : (
              <div className="space-y-3">
                {collegeApplications.slice(0, 5).map((app) => (
                  <div key={app.application_id} className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium mb-1">{app.college_name}</h3>
                        <p className="text-sm text-gray-400">Program ID: {app.program_id || 'General'}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Applied: {new Date(app.applied_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(app.status)}
                        <span className="text-sm capitalize">{app.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
