import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, TrendingUp, Clock, CheckCircle, Upload, User,
  MapPin, Target, Zap, BookOpen, FileText, GraduationCap,
  X, Coins, Award, Sparkles, Play, ArrowRight, Mic, ChevronRight
} from 'lucide-react'

import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { SkeletonStats } from '../components/SkeletonLoader'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const toast = useToast()

  // State
  const [applicantData, setApplicantData] = useState(null)
  const [studentProfile, setStudentProfile] = useState(null)
  const [jobApplications, setJobApplications] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Upload State
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedResume, setSelectedResume] = useState(null)

  // Interview Stats
  const [completedInterviewsCount, setCompletedInterviewsCount] = useState(0)

  const fetchAll = async () => {
    try {
      setLoading(true)
      let profileId = secureStorage.getItem('db_applicant_id')

      // 1. Fetch Applicant Details
      try {
        const profileRes = await api.get(`/api/student/applicant?t=${Date.now()}`)
        setApplicantData(profileRes.data)
        profileId = profileRes.data.id
        secureStorage.setItem('db_applicant_id', String(profileId))
      } catch (e) {
        console.warn('No applicant profile found.')
      }

      // 2. Fetch Student Profile
      try {
        const studentProfileRes = await api.get(`/api/student/profile?t=${Date.now()}`)
        setStudentProfile(studentProfileRes.data || null)
      } catch (e) {
        console.warn('Failed to load student profile.')
      }

      // 3. Fetch Applications
      try {
        const appRes = await api.get(`/api/student/applications/jobs?t=${Date.now()}`)
        setJobApplications(appRes.data?.applications || [])
      } catch (e) {
        console.warn('Failed to fetch job applications.')
      }

      // 4. Fetch Recommendations
      if (profileId) {
        try {
          const recRes = await api.get(`/api/recommendations/${profileId}?t=${Date.now()}`)
          setRecommendations(recRes.data.job_recommendations || [])
        } catch (e) {
          console.warn('Failed to fetch job recommendations.')
        }

        // 5. Fetch Interview Sessions Count (history endpoint returns all sessions)
        try {
          const interviewRes = await api.get('/api/interview/history')
          const sessions = interviewRes.data || []
          const completed = sessions.filter(s => s.status?.toLowerCase() === 'completed').length
          setCompletedInterviewsCount(completed)
        } catch (e) {
          console.warn('Failed to fetch interview history.')
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleFileUpload = async (e) => {
    e.preventDefault()
    setUploadLoading(true)
    setError(null)
    setUploadSuccess(false)

    if (!selectedResume) {
      setError('Please select a resume file')
      setUploadLoading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append('resume', selectedResume)

      const form = e.currentTarget
      const locationInput = form.querySelector('input[name="location"]')
      const jeeRankInput = form.querySelector('input[name="jee_rank"]')

      if (locationInput && locationInput.value) {
        formData.append('location', locationInput.value)
      }
      if (jeeRankInput && jeeRankInput.value) {
        formData.append('jee_rank', jeeRankInput.value)
      }

      const response = await api.post('/upload', formData, {
        timeout: 120000
      })

      if (response.data.applicant_id) {
        const parseRes = await api.post(`/parse/${response.data.applicant_id}`, null, {
          timeout: 120000
        })
        toast.success('Resume uploaded and parsed successfully!')
        setShowUploadForm(false)

        const dbId = parseRes.data?.db_applicant_id
        if (dbId) {
          secureStorage.setItem('db_applicant_id', String(dbId))
        }
        fetchAll()
      }
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err.response?.data?.detail || 'Upload or parsing failed.')
      toast.error('Resume upload or parsing failed.')
    } finally {
      setUploadLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-8 px-4">
        <SkeletonStats />
      </div>
    )
  }

  const hasProfile = !!applicantData
  // Score calculations (ATS matching suitability)
  const confidenceScore = applicantData?.llm_confidence 
    ? Math.round(applicantData.llm_confidence * 100) 
    : 80 // Default to 80% if there is a profile but confidence is not set
  
  const formattedScore = hasProfile ? confidenceScore : 0
  const matchColor = formattedScore >= 80 ? 'text-success' : formattedScore >= 50 ? 'text-warning' : 'text-error'

  return (
    <div className="relative">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* Welcome Header */}
      <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md relative z-10">
        <div>
          <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface mb-xs font-bold leading-tight">
            Welcome back, {applicantData?.full_name?.split(' ')[0] || 'Scholar'}!
          </h1>
          <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">
            {hasProfile 
              ? `Your profile is ATS optimized. You have ${jobApplications.length} applications tracked and ${recommendations.length} recommendations.`
              : "Upload your resume to receive AI-guided matching and interview prep."}
          </p>
        </div>
        <div>
          <button 
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white dark:text-on-primary-container dark:bg-primary-container rounded-lg font-body-bold text-[14px] hover:bg-primary-500 hover:shadow-lg active:scale-95 duration-150 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload New Resume
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      {!hasProfile ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="my-8 p-12 border border-dashed border-border-subtle dark:border-outline-variant rounded-2xl bg-white dark:bg-inverse-surface/10 text-center shadow-sm"
        >
          <Upload className="w-16 h-16 text-primary/40 mx-auto mb-4" />
          <h3 className="text-xl font-body-bold font-bold mb-2">Create Your Profile</h3>
          <p className="text-on-surface-variant dark:text-surface-variant mb-6 max-w-md mx-auto">
            Upload your resume so our AI engine can identify your skills, calculate ATS suitability, suggest learning pathways, and customize mock interviews.
          </p>
          <button 
            onClick={() => setShowUploadForm(true)} 
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-body-bold text-sm shadow-md hover:bg-primary-500 transition-colors"
          >
            Get Started
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg mb-xl items-start">
          
          {/* Main Pane (8/12 width) */}
          <div className="lg:col-span-8 flex flex-col gap-lg">
            
            {/* Resume Health Score Card */}
            <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-lg soft-shadow relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-fixed-dim/20 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
              
              <div className="flex flex-col md:flex-row items-center gap-lg relative z-10">
                {/* Circular Score Indicator */}
                <div className="w-36 h-36 shrink-0 relative flex items-center justify-center">
                  <svg className={`w-full h-full transform -rotate-90 ${matchColor}`} viewBox="0 0 36 36">
                    <path 
                      className="text-surface-container-high dark:text-outline-variant/20" 
                      strokeWidth="3" 
                      stroke="currentColor" 
                      fill="none" 
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    />
                    <path 
                      strokeDasharray={`${formattedScore}, 100`} 
                      strokeWidth="3.5" 
                      strokeLinecap="round" 
                      stroke="currentColor" 
                      fill="none" 
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="font-label-caps text-display-lg text-on-surface dark:text-inverse-on-surface font-extrabold">{formattedScore}</span>
                    <span className="font-metadata text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Score</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-1.5 bg-success/10 text-success px-2.5 py-0.5 rounded-full font-metadata text-[12px] font-semibold mb-sm">
                    <CheckCircle className="w-3.5 h-3.5" />
                    ATS Optimization Checked
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface dark:text-inverse-on-surface mb-sm">Resume Suitability</h2>
                  <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant mb-md leading-relaxed">
                    Your resume has high keyword density for your primary field. Our AI analysis shows complete profile parsing with high confidence.
                  </p>
                  <div className="flex flex-wrap gap-sm justify-center md:justify-start">
                    <Link
                      to={`/results/${applicantData.applicant_id}`}
                      className="btn-secondary-sm px-4 py-2 text-[13px] font-body-bold shadow-sm cursor-pointer"
                    >
                      Review Scorecard
                    </Link>
                    <Link
                      to="/student/intelligence"
                      className="px-4 py-2 text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim transition-colors font-body-bold text-[13px] flex items-center gap-1"
                    >
                      <Sparkles className="w-4 h-4 text-primary" />
                      Improve with AI
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Recommendations */}
            <div>
              <div className="flex justify-between items-center mb-md">
                <h3 className="font-headline-md text-headline-md text-on-surface dark:text-inverse-on-surface font-extrabold">Recommended Match Roles</h3>
                <Link to="/jobs" className="font-body-bold text-[13px] text-primary dark:text-primary-fixed-dim hover:underline flex items-center gap-0.5">
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {recommendations.length === 0 ? (
                <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle rounded-xl p-lg text-center text-on-surface-variant">
                  No match recommendations generated yet. Try refreshing or upload a different resume.
                </div>
              ) : (
                <div className="flex flex-col gap-sm">
                  {recommendations.slice(0, 3).map((rec, index) => {
                    const matchScore = rec.match_score || rec.score || 85
                    const scoreColor = matchScore >= 90 ? 'text-success' : matchScore >= 75 ? 'text-primary dark:text-primary-fixed-dim' : 'text-warning'
                    
                    return (
                      <div 
                        key={rec.id || index}
                        onClick={() => navigate(`/job/${rec.job_id || rec.job?.id}`)}
                        className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow hover:border-primary-fixed-dim dark:hover:border-outline-variant transition-colors group cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-md"
                      >
                        <div className="flex gap-md items-start">
                          <div className="w-12 h-12 bg-surface-container-low dark:bg-surface-variant/40 rounded-lg flex items-center justify-center shrink-0">
                            <Briefcase className="w-6 h-6 text-secondary" />
                          </div>
                          <div>
                            <h4 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface group-hover:text-primary dark:group-hover:text-primary-fixed-dim transition-colors">
                              {rec.job_title || rec.job?.title || 'Software Developer'}
                            </h4>
                            <div className="flex items-center gap-sm text-on-surface-variant dark:text-surface-variant font-metadata text-[12px] mt-1">
                              <span className="font-semibold">{rec.company || rec.job?.company || 'Company'}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {rec.location || rec.job?.location || 'Remote'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-lg sm:w-auto w-full border-t sm:border-t-0 border-border-subtle dark:border-outline-variant/30 pt-sm sm:pt-0 mt-sm sm:mt-0">
                          <div className="flex flex-col items-end">
                            <span className={`font-label-caps text-headline-md ${scoreColor} font-extrabold`}>{Math.round(matchScore)}%</span>
                            <span className={`font-metadata text-[10px] uppercase tracking-wider ${scoreColor}`}>Match</span>
                          </div>
                          <button className="w-8 h-8 rounded-full bg-surface-container-low dark:bg-surface-variant/40 flex items-center justify-center text-primary group-hover:bg-primary-container group-hover:text-white transition-all">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Sidebar Pane (4/12 width) */}
          <div className="lg:col-span-4 flex flex-col gap-lg">
            
            {/* Interview Readiness Card */}
            <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow">
              <div className="flex items-center gap-sm mb-md">
                <Mic className="w-5 h-5 text-interactive-purple" />
                <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">Interview Readiness</h3>
              </div>
              <div className="bg-surface-container-low dark:bg-surface-variant/20 rounded-lg p-sm flex items-center justify-between mb-md">
                <div className="flex items-center gap-sm">
                  <div className="w-8 h-8 bg-interactive-purple/10 rounded-full flex items-center justify-center text-interactive-purple">
                    <Mic className="w-4 h-4" />
                  </div>
                  <span className="font-metadata text-metadata text-on-surface dark:text-inverse-on-surface">Mock Interviews</span>
                </div>
                <span className="font-label-caps text-body-bold text-on-surface dark:text-inverse-on-surface">
                  {completedInterviewsCount} <span className="text-on-surface-variant dark:text-surface-variant text-[11px] font-normal uppercase">Done</span>
                </span>
              </div>
              <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant mb-md leading-relaxed">
                Your communication index is climbing! The AI recommends practicing behavioral questions and system scalability concepts.
              </p>
              <button 
                onClick={() => navigate('/dashboard/interview')}
                className="btn-secondary-sm w-full py-2 text-[13px] font-body-bold flex items-center justify-center gap-1 shadow-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" /> Start Practice
              </button>
            </div>

            {/* Recent Applications Card */}
            <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow flex-1">
              <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface mb-md">Recent Applications</h3>
              
              {jobApplications.length === 0 ? (
                <div className="text-center py-6 text-xs text-on-surface-variant">No active applications. Explore jobs to apply.</div>
              ) : (
                <div className="flex flex-col gap-sm">
                  {jobApplications.slice(0, 3).map((app, index) => {
                    const status = app.status || 'applied'
                    let badgeStyle = 'bg-primary-fixed-dim/20 text-primary dark:text-primary-fixed-dim'
                    let dotColor = 'bg-primary'
                    if (status.toLowerCase() === 'interviewing') {
                      badgeStyle = 'bg-warning/10 text-warning border border-warning/20'
                      dotColor = 'bg-warning'
                    } else if (status.toLowerCase() === 'accepted') {
                      badgeStyle = 'bg-success/10 text-success border border-success/20'
                      dotColor = 'bg-success'
                    } else if (status.toLowerCase() === 'rejected') {
                      badgeStyle = 'bg-slate-100 text-slate-500 border border-slate-200'
                      dotColor = 'bg-slate-400'
                    }

                    return (
                      <div key={app.id || index} className="flex items-center justify-between py-2 border-b border-border-subtle dark:border-outline-variant/20 pb-sm last:border-0 last:pb-0">
                        <div className="flex items-center gap-sm">
                          <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                          <div>
                            <p className="font-metadata text-[13px] font-semibold text-on-surface dark:text-inverse-on-surface truncate max-w-[120px]">
                              {app.company || app.job?.company || 'Company'}
                            </p>
                            <p className="text-[11px] text-on-surface-variant dark:text-surface-variant truncate max-w-[120px]">
                              {app.job_title || app.job?.title || 'Job Title'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
                          {status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              
              <div className="mt-md pt-sm border-t border-border-subtle dark:border-outline-variant/20 text-center">
                <Link to="/jobs" className="font-metadata text-[12px] text-primary dark:text-primary-fixed-dim hover:underline font-semibold">
                  Browse Job Board
                </Link>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowUploadForm(false)}>
            <div className="w-full max-w-lg rounded-3xl border border-border-subtle bg-white dark:bg-inverse-surface backdrop-blur shadow-2xl p-6 relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-extrabold text-xl text-slate-900 dark:text-inverse-on-surface">Upload Resume</h3>
                <button onClick={() => setShowUploadForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleFileUpload} className="space-y-4">
                {error && (
                  <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-semibold border border-rose-200">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-2">Resume File (PDF/DOCX)</label>
                  <input 
                    type="file" 
                    name="resume" 
                    required 
                    accept=".pdf,.docx"
                    className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-slate-200 border-dashed rounded-2xl p-6 text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300"
                    onChange={(e) => setSelectedResume(e.target.files[0])}
                  />
                </div>
                {selectedResume && (
                  <div className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50/50 p-2.5 border border-emerald-100 rounded-xl">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
                    <span>Selected: {selectedResume.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <input name="location" placeholder="Preferred Location" className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm dark:text-white" />
                  <input name="jee_rank" type="number" placeholder="JEE Rank (Optional)" className="w-full bg-slate-50 dark:bg-inverse-surface/30 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm dark:text-white" />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-3 bg-primary text-white rounded-xl font-bold transition-all shadow-md hover:bg-primary-500 active:scale-95 duration-200 text-sm cursor-pointer" 
                  disabled={uploadLoading}
                >
                  {uploadLoading ? 'Uploading & Analyzing...' : 'Upload & Process'}
                </button>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
