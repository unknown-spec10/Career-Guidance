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
import Spinner from '../components/Spinner'
import { getApiError } from '../utils/apiError'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const toast = useToast()

  // State
  const [applicantData, setApplicantData] = useState(null)
  const [studentProfile, setStudentProfile] = useState(null)
  const [jobApplications, setJobApplications] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [moreTotal, setMoreTotal] = useState(0)
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
      const storedId = secureStorage.getItem('db_applicant_id')
      let profileId = storedId

      // Wave 1: independent reads fire together so one slow/failed call
      // cannot delay the others (previously five sequential awaits).
      const ts = Date.now()
      const [applicantResult, studentProfileResult, appsResult] = await Promise.allSettled([
        api.get(`/api/student/applicant?t=${ts}`),
        api.get(`/api/student/profile?t=${ts}`),
        api.get(`/api/student/applications/jobs?t=${ts}`),
      ])

      if (applicantResult.status === 'fulfilled') {
        const profileRes = applicantResult.value
        setApplicantData(profileRes.data)
        profileId = profileRes.data.id
        secureStorage.setItem('db_applicant_id', String(profileId))
      } else {
        console.warn('No applicant profile found.')
      }

      if (studentProfileResult.status === 'fulfilled') {
        setStudentProfile(studentProfileResult.value.data || null)
      } else {
        console.warn('Failed to load student profile.')
      }

      if (appsResult.status === 'fulfilled') {
        setJobApplications(appsResult.value.data?.applications || [])
      } else {
        console.warn('Failed to fetch job applications.')
      }

      // Wave 2: dependent reads need the resolved profileId, but still run
      // in parallel with each other.
      if (profileId) {
        const recTs = Date.now()
        const [recResult, interviewResult] = await Promise.allSettled([
          api.get(`/api/recommendations/${profileId}?t=${recTs}`),
          api.get('/api/interview/history'),
        ])

        if (recResult.status === 'fulfilled') {
          const data = recResult.value.data || {}
          // Presentation cut: `recommended` top slice plus the
          // `more_matches` remainder; older responses carry only
          // `job_recommendations`, used as-is for backward compatibility.
          setRecommendations(
            Array.isArray(data.recommended) ? data.recommended : (data.job_recommendations || [])
          )
          setMoreTotal(data.more_total ?? (Array.isArray(data.more_matches) ? data.more_matches.length : 0))
        } else {
          console.warn('Failed to fetch job recommendations.')
        }

        if (interviewResult.status === 'fulfilled') {
          const sessions = interviewResult.value.data || []
          const completed = sessions.filter(s => s.status?.toLowerCase() === 'completed').length
          setCompletedInterviewsCount(completed)
        } else {
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
      setError(getApiError(err, 'Upload or parsing failed.'))
      toast.error('Resume upload or parsing failed.')
    } finally {
      setUploadLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] pt-8 px-4">
        <SkeletonStats />
      </div>
    )
  }

  const hasProfile = !!applicantData
  const totalRecommendations = recommendations.length + moreTotal
  // Score calculations (ATS matching suitability)
  const confidenceScore = applicantData?.llm_confidence 
    ? Math.round(applicantData.llm_confidence * 100) 
    : 80 // Default to 80% if there is a profile but confidence is not set
  
  const formattedScore = hasProfile ? confidenceScore : 0
  const matchColor = formattedScore >= 80 ? 'text-success' : formattedScore >= 50 ? 'text-warning' : 'text-error'

  const renderRecommendationCard = (rec, index) => {
    const matchScore = rec.match_score || rec.score || 85
    const scoreColor = matchScore >= 90 ? 'text-success' : matchScore >= 75 ? 'text-primary' : 'text-warning'

    return (
      <div
        key={rec.id || index}
        onClick={() => navigate(`/job/${rec.job_id || rec.job?.id}`)}
        className="surface-card surface-card-interactive p-md group cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-md"
      >
        <div className="flex gap-md items-start">
          <div className="w-12 h-12 bg-surface-sunken rounded-card flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <h4 className="font-display text-title text-ink group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
              {rec.job_title || rec.job?.title || 'Software Developer'}
            </h4>
            <div className="flex items-center gap-sm text-ink-muted font-body text-caption mt-1">
              <span className="font-semibold">{rec.company || rec.job?.company || 'Company'}</span>
              <span>•</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3.5 h-3.5 text-ink-subtle" />
                {rec.location || rec.job?.location || 'Remote'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-lg sm:w-auto w-full border-t sm:border-t-0 border-hairline pt-sm sm:pt-0 mt-sm sm:mt-0">
          <div className="flex flex-col items-end">
            <span className={`font-display text-title ${scoreColor} font-bold`}>{Math.round(matchScore)}%</span>
            <span className={`text-overline uppercase ${scoreColor}`}>Match</span>
          </div>
          <button className="w-8 h-8 rounded-pill border border-hairline bg-surface-raised flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white group-hover:border-primary-600 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* Welcome Header */}
      <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md relative z-10">
        <div>
          <p className="eyebrow mb-2">Student Dashboard</p>
          <h1 className="app-page-title">
            Welcome back, {(studentProfile?.personal_info?.name || applicantData?.display_name || studentProfile?.display_name)?.split(' ')[0] || 'Scholar'}!
          </h1>
          <p className="app-page-subtitle">
            {hasProfile 
              ? `Your profile is ATS optimized. You have ${jobApplications.length} applications tracked and ${totalRecommendations} recommendations.`
              : "Upload your resume to receive AI-guided matching and interview prep."}
          </p>
        </div>
        <div>
          <button 
            onClick={() => setShowUploadForm(true)}
            className="app-btn-primary app-btn-sm inline-flex items-center justify-center gap-2"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>Upload New Resume</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      {!hasProfile ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="my-8 p-12 rounded-panel border border-dashed border-hairline-strong bg-surface-raised text-center shadow-soft-sm"
        >
          <div className="w-16 h-16 rounded-panel border border-hairline bg-surface-sunken flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="font-display text-title font-bold text-ink mb-2">Create Your Profile</h3>
          <p className="text-body text-ink-muted mb-6 max-w-md mx-auto">
            Upload your resume so our AI engine can identify your skills, calculate ATS suitability, suggest learning pathways, and customize mock interviews.
          </p>
          <button 
            onClick={() => setShowUploadForm(true)} 
            className="app-btn-primary"
          >
            Get Started
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg mb-xl items-start">
          
          {/* Main Pane (8/12 width) */}
          <div className="lg:col-span-8 flex flex-col gap-lg">
            
            {/* Resume Health Score Card */}
            <div className="surface-card p-lg relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-fixed-dim/20 rounded-pill blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
              
              <div className="flex flex-col md:flex-row items-center gap-lg relative z-10">
                {/* Circular Score Indicator */}
                <div className="w-36 h-36 shrink-0 relative flex items-center justify-center">
                  <svg className={`w-full h-full transform -rotate-90 ${matchColor}`} viewBox="0 0 36 36">
                    <path 
                      className="text-surface-sunken" 
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
                    <span className="font-display text-display-lg font-bold text-ink">{formattedScore}</span>
                    <span className="text-overline text-ink-subtle">Score</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-1.5 bg-success/10 text-success px-2.5 py-0.5 rounded-pill font-body text-caption font-semibold mb-sm">
                    <CheckCircle className="w-3.5 h-3.5" />
                    ATS Optimization Checked
                  </div>
                  <h2 className="app-section-title mb-sm">Resume Suitability</h2>
                  <p className="text-body text-ink-muted mb-md leading-relaxed">
                    Your resume has high keyword density for your primary field. Our AI analysis shows complete profile parsing with high confidence.
                  </p>
                  <div className="flex flex-wrap gap-sm justify-center md:justify-start">
                    <Link
                      to={`/results/${applicantData.applicant_id}`}
                      className="app-btn-secondary app-btn-sm"
                    >
                      Review Scorecard
                    </Link>
                    <Link
                      to="/student/intelligence"
                      className="px-4 py-2 text-ink-muted hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-body text-caption font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      Improve with AI
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Recommendations */}
            <div>
              <div className="flex justify-between items-center mb-md">
                <h3 className="app-section-title">Recommended Match Roles</h3>
                <Link to="/jobs" className="font-body text-caption font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-0.5">
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {recommendations.length === 0 ? (
                <div className="surface-card p-lg text-center text-body text-ink-muted">
                  No match recommendations generated yet. Try refreshing or upload a different resume.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-sm">
                    {recommendations.slice(0, 10).map(renderRecommendationCard)}
                  </div>
                  <button
                    onClick={() => navigate('/jobs')}
                    className="w-full py-2 text-caption font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    See more
                  </button>
                </>
              )}
            </div>

          </div>

          {/* Right Sidebar Pane (4/12 width) — sticky on lg+ so it stays
              visible while the main pane scrolls. `lg:` prefix disables it
              below the lg breakpoint where the layout collapses to one column.
              `self-start` keeps the grid item from stretching (required for
              sticky to engage) and `lg:top-6` offsets it below the header. */}
          <div className="lg:col-span-4 flex flex-col gap-lg lg:sticky lg:top-6 self-start">
            
            {/* Interview Readiness Card */}
            <div className="surface-card p-md">
              <div className="flex items-center gap-sm mb-md">
                <Mic className="w-5 h-5 text-interactive-purple" />
                <h3 className="font-display text-title text-ink">Interview Readiness</h3>
              </div>
              <div className="bg-surface-sunken rounded-card p-sm flex items-center justify-between mb-md">
                <div className="flex items-center gap-sm">
                  <div className="w-8 h-8 bg-interactive-purple/10 rounded-pill flex items-center justify-center text-interactive-purple">
                    <Mic className="w-4 h-4" />
                  </div>
                  <span className="font-body text-caption text-ink">Mock Interviews</span>
                </div>
                <span className="font-display text-title text-ink">
                  {completedInterviewsCount} <span className="text-ink-subtle text-[11px] font-normal uppercase">Done</span>
                </span>
              </div>
              <p className="font-body text-caption text-ink-muted mb-md leading-relaxed">
                Your communication index is climbing! The AI recommends practicing behavioral questions and system scalability concepts.
              </p>
              <button 
                onClick={() => navigate('/dashboard/interview')}
                className="app-btn-secondary app-btn-sm inline-flex w-full items-center justify-center gap-2"
              >
                <Play className="h-4 w-4 shrink-0 fill-current" /> Start Practice
              </button>
            </div>

            {/* Recent Applications Card */}
            <div className="surface-card p-md flex-1">
              <h3 className="font-display text-title text-ink mb-md">Recent Applications</h3>
              
              {jobApplications.length === 0 ? (
                <div className="text-center py-6 text-caption text-ink-muted">No active applications. Explore jobs to apply.</div>
              ) : (
                <div className="flex flex-col gap-sm">
                  {jobApplications.slice(0, 3).map((app, index) => {
                    const status = app.status || 'applied'
                    let badgeStyle = 'bg-primary-500/10 text-primary-700 dark:text-primary-300'
                    let dotColor = 'bg-primary-600'
                    if (status.toLowerCase() === 'interviewing') {
                      badgeStyle = 'bg-warning/10 text-warning border border-warning/20'
                      dotColor = 'bg-warning'
                    } else if (status.toLowerCase() === 'accepted') {
                      badgeStyle = 'bg-success/10 text-success border border-success/20'
                      dotColor = 'bg-success'
                    } else if (status.toLowerCase() === 'rejected') {
                      badgeStyle = 'bg-surface-sunken text-ink-subtle border border-hairline'
                      dotColor = 'bg-ink-subtle'
                    }

                    return (
                      <div key={app.id || index} className="flex items-center justify-between py-2 border-b border-hairline pb-sm last:border-0 last:pb-0">
                        <div className="flex items-center gap-sm">
                          <div className={`w-2 h-2 rounded-pill ${dotColor}`}></div>
                          <div>
                            <p className="font-body text-caption font-semibold text-ink truncate max-w-[120px]">
                              {app.company || app.job?.company || 'Company'}
                            </p>
                            <p className="text-[11px] text-ink-muted truncate max-w-[120px]">
                              {app.job_title || app.job?.title || 'Job Title'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-[0.1em] ${badgeStyle}`}>
                          {status}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              
              <div className="mt-md pt-sm border-t border-hairline text-center">
                <Link to="/jobs" className="font-body text-caption text-primary-600 dark:text-primary-400 hover:underline font-semibold">
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
            <div className="w-full max-w-lg rounded-panel border border-hairline bg-surface-overlay shadow-soft-xl p-6 relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display text-title-lg font-bold text-ink">Upload Resume</h3>
 <button onClick={() => setShowUploadForm(false)} className="p-1.5 text-ink-subtle hover:text-ink hover:bg-surface-sunken rounded-card transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleFileUpload} className="space-y-4">
                {error && (
                  <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3 rounded-card text-caption font-semibold border border-rose-500/20">
                    {error}
                  </div>
                )}
                <div>
                  <label className="app-label mb-2 block">Resume File (PDF/DOCX)</label>
                  <input 
                    type="file" 
                    name="resume" 
                    required 
                    accept=".pdf,.docx"
                    className="w-full bg-surface-sunken border border-hairline border-dashed rounded-panel p-6 text-center focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 cursor-pointer text-caption font-medium text-ink-muted transition-colors"
                    onChange={(e) => setSelectedResume(e.target.files[0])}
                  />
                </div>
                {selectedResume && (
                  <div className="text-caption text-success font-semibold flex items-center gap-1.5 bg-success/10 p-2.5 border border-success/20 rounded-card">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span>Selected: {selectedResume.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <input name="location" placeholder="Preferred Location" className="app-input" />
                  <input name="jee_rank" type="number" placeholder="JEE Rank (Optional)" className="app-input" />
                </div>
                <button 
                  type="submit" 
                  className="app-btn-primary w-full" 
                  disabled={uploadLoading}
                  aria-busy={uploadLoading}
                >
                  {uploadLoading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4 shrink-0" />}
                  <span>Upload &amp; Process</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
