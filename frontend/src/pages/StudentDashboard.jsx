import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import {
  Briefcase, TrendingUp, Clock,
  CheckCircle, Upload, User, MapPin, Target, Zap, BookOpen, FileText, GraduationCap, RefreshCcw, X, Coins, Bookmark, Award, Sparkles
} from 'lucide-react'

import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { SkeletonStats } from '../components/SkeletonLoader'
import CreditWidget from '../components/CreditWidget'
import ApplicationTracker from '../components/ApplicationTracker'

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

  // Recommendation State (for counts only)
  const [recommendations, setRecommendations] = useState([])
  const [applicantId, setApplicantId] = useState(null)
  const [noApplicantProfile, setNoApplicantProfile] = useState(false)

  // Refs
  const uploadFormRef = React.useRef(null)

  const interviewingCount = jobApplications.filter((app) => app.status?.toLowerCase() === 'interviewing').length
  const newSuggestionCount = recommendations.filter((rec) => rec.status === 'recommended').length

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

      // Don't set Content-Type manually - axios sets it with boundary automatically
      const response = await api.post('/upload', formData, {
        timeout: 120000 // 120s for upload
      })
      setUploadSuccess(true)
      form.reset()

      if (response.data.applicant_id) {
        setTimeout(async () => {
          try {
            const parseRes = await api.post(`/parse/${response.data.applicant_id}`, null, {
              timeout: 120000 // 120s for parse
            })
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
        setNoApplicantProfile(false)
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

      // Recommendations (to calculate counts)
      if (profileId) {
        const recRes = await api.get(`/api/recommendations/${profileId}?t=${Date.now()}`)
        setRecommendations(recRes.data.job_recommendations || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

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

        {/* --- CARDS GRID --- */}
        {!noApplicantProfile && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* AI Job Recommendations Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-primary-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
            >
              <div>
                <div className="rounded-2xl p-3 bg-primary-50 text-primary-600 w-fit border border-primary-100 shadow-sm mb-5">
                  <Target className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-primary-900 transition-colors">
                  AI Job Recommendations
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Discover job roles matched to your unique profile. Our multi-tiered scoring engine ranks jobs by skill overlap, location alignment, and experience suitability, showing you the most relevant opportunities first.
                </p>
              </div>
              <Link
                to="/jobs"
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 text-center active:scale-95 duration-200 font-semibold"
              >
                Explore Recommendations
              </Link>
            </motion.div>

            {/* AI Mock Interviews Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-indigo-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
            >
              <div>
                <div className="rounded-2xl p-3 bg-indigo-50 text-indigo-600 w-fit border border-indigo-100 shadow-sm mb-5">
                  <Sparkles className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-indigo-900 transition-colors">
                  AI Mock Interviews
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Practice technical and soft skill questions tailored to your field. Get scored by our AI engine with comprehensive feedback to continuously improve your performance and readiness.
                </p>
              </div>
              <Link
                to="/dashboard/interview"
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 text-center active:scale-95 duration-200 font-semibold"
              >
                Practice Interviews
              </Link>
            </motion.div>

            {/* Learning Paths Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-emerald-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
            >
              <div>
                <div className="rounded-2xl p-3 bg-emerald-50 text-emerald-600 w-fit border border-emerald-100 shadow-sm mb-5">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-emerald-900 transition-colors">
                  Skill Roadmaps & Learning Paths
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Targeted developmental roadmaps generated automatically for skill gaps. Prepare step-by-step with structured modules and online references designed to make you industry-ready.
                </p>
              </div>
              <Link
                to="/dashboard/learning-paths"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 text-center active:scale-95 duration-200 font-semibold"
              >
                View Learning Paths
              </Link>
            </motion.div>

            {/* Intelligence Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-8 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-amber-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col justify-between h-full relative overflow-hidden group"
            >
              <div>
                <div className="rounded-2xl p-3 bg-amber-50 text-amber-600 w-fit border border-amber-100 shadow-sm mb-5">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-xl text-slate-900 mb-2 group-hover:text-amber-900 transition-colors">
                  Longitudinal Intelligence Profile
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Analyze your skill progress and profile scoring logs over time. Monitor your growth across technical focus areas, experience suitability, and alignment with modern market demands.
                </p>
              </div>
              <Link
                to="/student/intelligence"
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl font-bold transition-all shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 text-center active:scale-95 duration-200 font-semibold"
              >
                View Intelligence Profile
              </Link>
            </motion.div>
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
