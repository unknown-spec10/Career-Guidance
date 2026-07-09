import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { 
  Shield, Briefcase, CheckCircle, XCircle, 
  Clock, AlertTriangle, TrendingUp, Search, Coins, Plus, Minus, X,
  FileText, Activity, Database, Cpu, RefreshCw, Ban, PlayCircle, Eye, GraduationCap, Server, Check, Edit2, Play, Users, Sparkles,
  Zap, RotateCcw
} from 'lucide-react'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const jobMarkdownComponents = {
  h1: ({ children }) => <h1 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-inherit">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 space-y-1 list-disc text-inherit">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 space-y-1 list-decimal text-inherit">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>,
  code: ({ inline, children }) => {
    if (inline) {
      return <code className="bg-slate-100 dark:bg-slate-800 text-primary-700 dark:text-primary-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[10px]">{children}</code>
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
  blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-200 dark:border-primary-800 pl-3 italic text-slate-600 dark:text-slate-400 mb-2">{children}</blockquote>,
}

export default function AdminReviewsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const initialTab = searchParams.get('tab') || 'overview'
  const [stats, setStats] = useState({
    pendingJobs: 0,
    totalPending: 0
  })
  const [overviewStats, setOverviewStats] = useState(null)
  const [pendingJobs, setPendingJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  // User Management State
  const [users, setUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersTotal, setUsersTotal] = useState(0)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedUserActivity, setSelectedUserActivity] = useState([])
  const [selectedUserActivityLoading, setSelectedUserActivityLoading] = useState(false)

  const [allJobs, setAllJobs] = useState([])
  const [allJobsLoading, setAllJobsLoading] = useState(false)
  const [jobQuery, setJobQuery] = useState('')
  const [jobStatusFilter, setJobStatusFilter] = useState('all')
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [selectedApplicantCredits, setSelectedApplicantCredits] = useState(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [creditLoading, setCreditLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [rejectingJob, setRejectingJob] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [viewingJob, setViewingJob] = useState(null)
  const [viewJobLoading, setViewJobLoading] = useState(false)
  const [viewJobError, setViewJobError] = useState(null)
  const [editingMode, setEditingMode] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', location_city: '', location_state: '', expires_at: '' })
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'disable'|'enable'|'requeue', job, loading }

  // Resume Reviews Center
  const [pendingResumeReviews, setPendingResumeReviews] = useState([])
  const [pendingResumeReviewsLoading, setPendingResumeReviewsLoading] = useState(false)
  const [selectedResumeReview, setSelectedResumeReview] = useState(null)
  const [selectedResumeReviewLoading, setSelectedResumeReviewLoading] = useState(false)
  const [reviewForm, setReviewForm] = useState({ cgpa: '', jee_rank: '', reason: '' })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [resumeReviewSearchQuery, setResumeReviewSearchQuery] = useState('')

  // System Health Hub
  const [systemHealthStats, setSystemHealthStats] = useState(null)
  const [systemHealthLoading, setSystemHealthLoading] = useState(false)
  const [systemHealthActionLoading, setSystemHealthActionLoading] = useState(null)
  const [llmResetLoading, setLlmResetLoading] = useState(false)
  const [hoveredBar, setHoveredBar] = useState(null)

  // Candidate Mock Practice & Supervision
  const [applicantSessions, setApplicantSessions] = useState([])
  const [applicantSessionsLoading, setApplicantSessionsLoading] = useState(false)
  const [applicantIntelligence, setApplicantIntelligence] = useState(null)
  const [applicantIntelligenceLoading, setApplicantIntelligenceLoading] = useState(false)
  const [suspensionLoading, setSuspensionLoading] = useState(false)

  useEffect(() => {
    fetchOverviewStats()
    fetchPendingReviews()
    fetchAllJobs()
  }, [])

  useEffect(() => {
    if (activeTab === 'all-jobs' && allJobs.length === 0) {
      fetchAllJobs()
    } else if (activeTab === 'resume-reviews') {
      fetchPendingResumeReviews()
    } else if (activeTab === 'system-health') {
      fetchSystemHealth()
    } else if (activeTab === 'users') {
      fetchUsers()
    }
  }, [activeTab, userRoleFilter, userStatusFilter, userSearchQuery])

  useEffect(() => {
    const tab = searchParams.get('tab') || 'overview'
    setActiveTab(tab)
  }, [searchParams])

  const fetchOverviewStats = async () => {
    try {
      const response = await api.get('/api/stats')
      setOverviewStats(response.data)
    } catch (err) {
      setOverviewStats(null)
    }
  }

  const fetchUsers = async () => {
    try {
      setUsersLoading(true)
      let activeVal = undefined
      if (userStatusFilter === 'active') activeVal = true
      if (userStatusFilter === 'suspended') activeVal = false
      
      const params = new URLSearchParams()
      if (userRoleFilter && userRoleFilter !== 'all') params.append('role', userRoleFilter)
      if (activeVal !== undefined) params.append('is_active', String(activeVal))
      if (userSearchQuery) params.append('search', userSearchQuery)
      params.append('limit', '100')
      
      const response = await api.get(`/api/admin/users?${params.toString()}`)
      const list = response.data?.users || []
      setUsers(list)
      setUsersTotal(response.data?.total || list.length)
      
      // Auto-select first user if none selected
      if (list.length > 0 && !selectedUser) {
        handleSelectUser(list[0])
      }
    } catch (err) {
      toast.error('Failed to fetch users list')
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchUserActivity = async (userId) => {
    try {
      setSelectedUserActivityLoading(true)
      const response = await api.get(`/api/admin/users/${userId}/activity`)
      setSelectedUserActivity(response.data || [])
    } catch (err) {
      setSelectedUserActivity([])
    } finally {
      setSelectedUserActivityLoading(false)
    }
  }

  const handleSelectUser = async (user) => {
    setSelectedUser(user)
    setSelectedUserActivity([])
    
    // Fetch activity log
    fetchUserActivity(user.id)
    
    // If student, delegate to handleSelectApplicant
    if (user.role === 'student' && user.db_applicant_id) {
      const applicant = {
        id: user.db_applicant_id,
        applicant_id: user.applicant_id,
        display_name: user.name || user.email,
        user_id: user.id,
        is_active: user.is_active
      }
      handleSelectApplicant(applicant)
    } else {
      setSelectedApplicant(null)
      setSelectedApplicantCredits(null)
      setApplicantSessions([])
      setApplicantIntelligence(null)
    }
  }

  const fetchAllJobs = async () => {
    try {
      setAllJobsLoading(true)
      const response = await api.get('/api/admin/jobs?limit=200')
      setAllJobs(response.data?.jobs || [])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load jobs')
      setAllJobs([])
    } finally {
      setAllJobsLoading(false)
    }
  }

  const fetchPendingReviews = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/admin/pending-reviews')
      
      const jobs = response.data.pending_jobs || []
      setPendingJobs(jobs)
      setStats({
        pendingJobs: jobs.length,
        totalPending: response.data.total_pending ?? jobs.length
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load pending reviews')
    } finally {
      setLoading(false)
    }
  }

  const handleJobReview = async (jobId, action, reason = '') => {
    try {
      setActionLoading(`job-${jobId}`)
      await api.patch(`/api/admin/jobs/${jobId}/review`, { action, reason })
      
      // Optimistic update: remove from pending list
      setPendingJobs(prev => prev.filter(j => j.id !== jobId))
      setStats(prev => ({
        ...prev,
        pendingJobs: Math.max(0, prev.pendingJobs - 1),
        totalPending: Math.max(0, prev.totalPending - 1)
      }))
      
      toast.success(`Job ${action === 'approve' ? 'approved' : 'rejected'} successfully`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed')
      // Reload on error to restore accurate state
      await fetchPendingReviews()
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectModal = (job) => {
    setRejectingJob(job)
    setRejectReason('')
  }

  const openJobDetails = async (job) => {
    setViewJobError(null)
    setViewJobLoading(true)
    setViewingJob({ ...job, detailsLoaded: false })

    try {
      const response = await api.get(`/api/admin/jobs/${job.id}`)
      setViewingJob({ ...response.data.job, metadata: response.data.metadata, detailsLoaded: true })
      setEditingMode(false)
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to load job details'
      setViewJobError(errorMsg)
      toast.error(errorMsg)
      setViewingJob(job)
    } finally {
      setViewJobLoading(false)
    }
  }

  const closeJobDetails = () => {
    if (viewJobLoading) return
    setViewingJob(null)
    setViewJobError(null)
    setEditingMode(false)
  }

  const startEditJob = () => {
    if (!viewingJob) return
    setEditForm({
      title: viewingJob.title || '',
      description: viewingJob.description || '',
      location_city: viewingJob.location_city || '',
      location_state: viewingJob.location_state || '',
      expires_at: viewingJob.expires_at ? viewingJob.expires_at.split('T')[0] : ''
    })
    setEditingMode(true)
  }

  const cancelEditJob = () => {
    setEditingMode(false)
  }

  const submitEditJob = async () => {
    if (!viewingJob) return
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        location_city: editForm.location_city,
        location_state: editForm.location_state,
        expires_at: editForm.expires_at || null,
      }
      const resp = await api.patch(`/api/admin/jobs/${viewingJob.id}`, payload)
      const updated = resp.data.job
      // Update viewingJob and allJobs list
      setViewingJob(prev => ({ ...prev, ...updated }))
      setAllJobs(prev => prev.map(j => j.id === updated.id ? { ...j, ...updated } : j))
      toast.success('Job updated')
      setEditingMode(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update job')
    }
  }

  const handleToggleDisable = (job) => {
    if (!job) return
    const type = job.status === 'rejected' ? 'enable' : 'disable'
    setConfirmAction({ type, job, loading: false })
  }

  const handleForceReview = (job) => {
    if (!job) return
    setConfirmAction({ type: 'requeue', job, loading: false })
  }

  const closeConfirmAction = () => setConfirmAction(null)

  const submitConfirmAction = async () => {
    if (!confirmAction || !confirmAction.job) return
    const { type, job } = confirmAction
    setConfirmAction(prev => ({ ...prev, loading: true }))
    try {
      if (type === 'disable' || type === 'enable') {
        await api.post(`/api/admin/jobs/${job.id}/${type}`, {})
      } else if (type === 'requeue') {
        await api.post(`/api/admin/jobs/${job.id}/requeue`)
      }
      await fetchAllJobs()
      if (viewingJob && viewingJob.id === job.id) {
        await openJobDetails(job)
      }
      toast.success(
        type === 'disable' ? 'Job disabled' : type === 'enable' ? 'Job enabled' : 'Job requeued for review'
      )
      setConfirmAction(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed')
      setConfirmAction(prev => ({ ...prev, loading: false }))
    }
  }

  const closeRejectModal = () => {
    if (rejectSubmitting) return
    setRejectingJob(null)
    setRejectReason('')
  }

  const submitRejectModal = async () => {
    if (!rejectingJob) return

    const reason = rejectReason.trim()
    if (!reason) {
      toast.error('Please enter a rejection reason')
      return
    }

    try {
      setRejectSubmitting(true)
      await handleJobReview(rejectingJob.id, 'reject', reason)
      setRejectingJob(null)
      setRejectReason('')
    } finally {
      setRejectSubmitting(false)
    }
  }


  const handleCreditAdjustment = async () => {
    if (!selectedApplicant) {
      toast.error('Select an applicant first')
      return
    }

    const amount = parseInt(creditAmount, 10)
    if (Number.isNaN(amount) || amount === 0) {
      toast.error('Enter a valid non-zero amount')
      return
    }

    if (!creditReason.trim()) {
      toast.error('Reason is required')
      return
    }

    try {
      setCreditLoading(true)
      await api.post('/api/admin/credits/adjust', {
        applicant_id: selectedApplicant.id,
        amount,
        reason: creditReason.trim(),
      })
      const creditResponse = await api.get(`/api/admin/credits/applicant/${selectedApplicant.id}`)
      setSelectedApplicantCredits(creditResponse.data)
      toast.success(`Credits updated for ${selectedApplicant.display_name || selectedApplicant.applicant_id || `Applicant #${selectedApplicant.id}`}`)
      setCreditAmount('')
      setCreditReason('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to adjust credits')
    } finally {
      setCreditLoading(false)
    }
  }

  const handleSelectApplicant = async (applicant) => {
    setSelectedApplicant(applicant)
    setSelectedApplicantCredits(null)
    setApplicantSessions([])
    setApplicantIntelligence(null)
    setCreditAmount('')
    setCreditReason('')
    
    // Fetch credits balance
    try {
      const creditResponse = await api.get(`/api/admin/credits/applicant/${applicant.id}`)
      setSelectedApplicantCredits(creditResponse.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch applicant credits')
    }

    // Fetch details (to resolve is_active and user_id)
    try {
      const detailResponse = await api.get(`/api/applicant/${applicant.id}`)
      setSelectedApplicant(prev => prev && prev.id === applicant.id ? { ...prev, ...detailResponse.data.applicant } : prev)
    } catch (err) {
      // Ignored: fallback to base applicant info
    }

    // Fetch mock practice sessions list
    try {
      setApplicantSessionsLoading(true)
      const sessionsResponse = await api.get(`/api/admin/applicants/${applicant.id}/sessions`)
      setApplicantSessions(sessionsResponse.data || [])
    } catch (err) {
      setApplicantSessions([])
    } finally {
      setApplicantSessionsLoading(false)
    }

    // Fetch candidate cumulative AI profile
    try {
      setApplicantIntelligenceLoading(true)
      const intelligenceResponse = await api.get(`/api/interview/candidate-intelligence/${applicant.applicant_id}`)
      setApplicantIntelligence(intelligenceResponse.data)
    } catch (err) {
      setApplicantIntelligence(null)
    } finally {
      setApplicantIntelligenceLoading(false)
    }
  }

  const handleToggleUserSuspension = async () => {
    if (!selectedApplicant || !selectedApplicant.user_id) {
      toast.error('Applicant user account information not loaded')
      return
    }
    
    try {
      setSuspensionLoading(true)
      const response = await api.post(`/api/admin/users/${selectedApplicant.user_id}/toggle-active`, {})
      setSelectedApplicant(prev => prev ? { ...prev, is_active: response.data.is_active } : null)
      toast.success(response.data.message || `User account suspension state updated`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to toggle account suspension state')
    } finally {
      setSuspensionLoading(false)
    }
  }

  const fetchPendingResumeReviews = async () => {
    try {
      setPendingResumeReviewsLoading(true)
      const response = await api.get('/api/reviews/pending')
      setPendingResumeReviews(response.data.pending_reviews || [])
    } catch (err) {
      toast.error('Failed to load pending resume reviews')
      setPendingResumeReviews([])
    } finally {
      setPendingResumeReviewsLoading(false)
    }
  }

  const handleSelectResumeReview = async (applicantId) => {
    try {
      setSelectedResumeReviewLoading(true)
      setSelectedResumeReview(null)
      const response = await api.get(`/api/applicant/${applicantId}`)
      setSelectedResumeReview(response.data)
      
      const parsed = response.data.parsed_data || {}
      const edu = parsed.education && parsed.education[0] ? parsed.education[0] : {}
      const cgpaVal = edu.grade || edu.cgpa || ''
      const jeeVal = parsed.jee_rank || ''
      
      setReviewForm({
        cgpa: cgpaVal,
        jee_rank: jeeVal,
        reason: ''
      })
    } catch (err) {
      toast.error('Failed to fetch resume parsed details')
    } finally {
      setSelectedResumeReviewLoading(false)
    }
  }

  const handleApplyResumeReviewOverride = async () => {
    if (!selectedResumeReview || !selectedResumeReview.applicant) return
    const applicantId = selectedResumeReview.applicant.id
    
    if (!reviewForm.reason.trim()) {
      toast.error('Please provide a correction reason for audit records')
      return
    }

    try {
      setReviewSubmitting(true)
      const parsed = selectedResumeReview.parsed_data || {}
      const edu = parsed.education && parsed.education[0] ? parsed.education[0] : {}
      const originalCgpa = edu.grade || edu.cgpa || ''
      const originalJee = parsed.jee_rank || ''

      let submittedAny = false

      if (reviewForm.cgpa !== '' && String(reviewForm.cgpa) !== String(originalCgpa)) {
        await api.post('/api/reviews/submit', {
          applicant_id: applicantId,
          field: 'cgpa',
          original_value: String(originalCgpa),
          corrected_value: String(reviewForm.cgpa),
          reason: reviewForm.reason.trim()
        })
        submittedAny = true
      }

      if (reviewForm.jee_rank !== '' && String(reviewForm.jee_rank) !== String(originalJee)) {
        await api.post('/api/reviews/submit', {
          applicant_id: applicantId,
          field: 'jee_rank',
          original_value: String(originalJee),
          corrected_value: String(reviewForm.jee_rank),
          reason: reviewForm.reason.trim()
        })
        submittedAny = true
      }

      if (!submittedAny) {
        toast.error('No changes were made to override')
        return
      }

      toast.success('Resume correction overrides applied successfully')
      setSelectedResumeReview(null)
      fetchPendingResumeReviews()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit human review override')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleApproveResumeReviewWithoutChanges = async (applicantId) => {
    try {
      setReviewSubmitting(true)
      await api.patch(`/api/reviews/mark-reviewed/${applicantId}`)
      toast.success('Resume parser data approved successfully')
      setSelectedResumeReview(null)
      fetchPendingResumeReviews()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve parsed resume')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const fetchSystemHealth = async () => {
    try {
      setSystemHealthLoading(true)
      const [healthResponse, ragResponse, llmResponse] = await Promise.allSettled([
        api.get('/api/embeddings/health'),
        api.get('/api/rag/stats'),
        api.get('/api/admin/llm-status'),
      ])
      setSystemHealthStats({
        embeddings: healthResponse.status === 'fulfilled' ? healthResponse.value.data : null,
        rag: ragResponse.status === 'fulfilled' ? ragResponse.value.data : null,
        llm: llmResponse.status === 'fulfilled' ? llmResponse.value.data : null,
      })
    } catch (err) {
      toast.error('Failed to load system health statistics')
    } finally {
      setSystemHealthLoading(false)
    }
  }

  const handleResetLLMStats = async () => {
    try {
      setLlmResetLoading(true)
      await api.post('/api/admin/llm-status/reset')
      toast.success('LLM telemetry statistics reset successfully')
      fetchSystemHealth()
    } catch (err) {
      toast.error('Failed to reset LLM statistics')
    } finally {
      setLlmResetLoading(false)
    }
  }

  const triggerReindex = async (type) => {
    try {
      setSystemHealthActionLoading(type)
      if (type === 'jobs') {
        await api.post('/api/embeddings/reindex/jobs', {})
        toast.success('Queued background embedding reindexing for jobs')
      } else if (type === 'applicants') {
        await api.post('/api/embeddings/reindex/applicants', {})
        toast.success('Queued background embedding reindexing for applicants')
      } else if (type === 'rag') {
        await api.post('/api/rag/initialize', { force_rebuild: true })
        toast.success('Triggered documentation RAG index reinitialization')
      }
      setTimeout(fetchSystemHealth, 1500)
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to trigger action for ${type}`)
    } finally {
      setSystemHealthActionLoading(null)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="card max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-center text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative text-on-surface dark:text-inverse-on-surface">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="max-w-container-max mx-auto">
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-lg relative overflow-hidden rounded-xl border border-border-subtle dark:border-outline-variant/30 bg-white dark:bg-inverse-surface/5 p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                <Shield className="w-3.5 h-3.5" />
                Admin workspace
              </div>
              <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface font-extrabold mb-1">
                Admin Control Panel
              </h1>
              <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">One place for overview diagnostics, job moderation, and applicant management.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50/80 px-4 py-3 text-sm text-yellow-700 shadow-sm font-semibold">
                <div>Pending reviews</div>
                <div className="text-lg font-black text-yellow-900">{stats.pendingJobs}</div>
              </div>
              <div className="rounded-2xl border border-primary-100 bg-primary-50/80 px-4 py-3 text-sm text-primary-700 shadow-sm font-semibold">
                <div>Applicants</div>
                <div className="text-lg font-black text-primary-900">{overviewStats?.total_applicants ?? 0}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { title: 'Total Applicants', value: overviewStats?.total_applicants ?? 0, icon: Shield, color: 'primary', bgCol: 'bg-primary-50/50', textCol: 'text-primary-600', borderCol: 'border-primary-100' },
              { title: 'Total Jobs', value: overviewStats?.total_jobs ?? 0, icon: Briefcase, color: 'green', bgCol: 'bg-emerald-50/50', textCol: 'text-emerald-600', borderCol: 'border-emerald-100' },
              { title: 'Pending Reviews', value: stats.pendingJobs, icon: Clock, color: 'yellow', bgCol: 'bg-amber-50/50', textCol: 'text-amber-600', borderCol: 'border-amber-100' },
              { title: 'Pending Total', value: stats.totalPending, icon: TrendingUp, color: 'primary', bgCol: 'bg-indigo-50/50', textCol: 'text-indigo-600', borderCol: 'border-indigo-100' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="cursor-default border border-slate-100 bg-white/90 backdrop-blur-sm rounded-2xl p-5 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.title}</p>
                  <p className={`text-3xl font-black ${stat.textCol}`}>{stat.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${stat.bgCol} ${stat.textCol} border ${stat.borderCol}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          {activeTab === 'all-jobs' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 4 }}
              className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
            >
              <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary-500" />
                  <span>All Job Postings</span>
                </h2>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-700">
                  {allJobs.length} total
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div className="md:col-span-2 relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={jobQuery}
                    onChange={(e) => setJobQuery(e.target.value)}
                    placeholder="Search title, company, location"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                  />
                </div>
                <select
                  value={jobStatusFilter}
                  onChange={(e) => setJobStatusFilter(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-semibold text-slate-700"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {allJobsLoading ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-slate-500 font-semibold">Loading jobs...</p>
                </div>
              ) : (() => {
                const query = jobQuery.trim().toLowerCase()
                const filteredJobs = allJobs.filter((job) => {
                  const matchesStatus = jobStatusFilter === 'all' || job.status === jobStatusFilter
                  const matchesQuery = !query || [job.title, job.company, job.location_city, job.location_state].filter(Boolean).join(' ').toLowerCase().includes(query)
                  return matchesStatus && matchesQuery
                })

                if (filteredJobs.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-semibold">No jobs match your filters.</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {filteredJobs.map((job) => (
                      <div key={job.id} className="p-5 bg-white rounded-2xl border border-slate-100 transition-all hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 hover:-translate-y-0.5">
                        <div className="flex items-start justify-between mb-3 gap-4">
                          <div>
                            <h3 className="font-bold text-base text-slate-900 mb-1">{job.title}</h3>
                            <p className="text-sm font-semibold text-slate-500">{job.company}</p>
                            <p className="text-xs text-slate-400 mt-1 font-semibold">
                              {job.location_city}{job.location_state ? ` • ${job.location_state}` : ''}
                              {job.work_type ? ` • ${job.work_type}` : ''}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border flex items-center gap-1 ${
                            job.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                            job.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {job.status || 'pending'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-slate-50 pt-4">
                          <p className="text-xs text-slate-400 font-semibold">
                            Posted: {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openJobDetails(job)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200"
                            >
                              <Search className="w-3.5 h-3.5 text-slate-400" />
                              <span>Details</span>
                            </button>
                            {job.status === 'pending' && (
                              <button
                                onClick={() => openRejectModal(job)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Review</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {job.status === 'rejected' && job.rejection_reason && (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50/50 px-3 py-2 text-xs font-medium text-red-700">
                            <strong>Rejection reason:</strong> {job.rejection_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </motion.div>
          )}

          {/* User Management Tab (replaces applicants) */}
          {activeTab === 'users' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
              className="border border-slate-100 dark:border-outline-variant/30 bg-white/90 dark:bg-inverse-surface/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
            >
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary-500 animate-pulse" />
                    <span>User Management Center</span>
                  </h2>
                  <p className="text-xs font-semibold text-slate-400 mt-1">Audit registry accounts, filter by roles, manage credit allocations, and toggle portal suspensions.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Search & User List */}
                <div className="rounded-2xl border border-slate-100 dark:border-outline-variant/20 bg-slate-50/40 dark:bg-inverse-surface/10 p-4 lg:col-span-1 flex flex-col gap-4">
                  {/* Search Query */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Search Account</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Email or display name"
                        className="w-full bg-white dark:bg-inverse-surface border border-slate-200 dark:border-outline-variant rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Role filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filter by Role</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['all', 'student', 'employer', 'admin'].map((r) => (
                        <button
                          key={r}
                          onClick={() => setUserRoleFilter(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all active:scale-95 duration-150 border ${
                            userRoleFilter === r
                              ? 'bg-primary-container text-white border-primary-500 shadow-sm'
                              : 'bg-white dark:bg-inverse-surface text-slate-600 dark:text-slate-350 border-slate-200 dark:border-outline-variant hover:bg-slate-50'
                          }`}
                        >
                          {r === 'all' ? 'All Roles' : `${r}s`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status filter */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Account Status</label>
                    <div className="flex gap-1.5">
                      {['all', 'active', 'suspended'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setUserStatusFilter(s)}
                          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all active:scale-95 duration-150 border ${
                            userStatusFilter === s
                              ? 'bg-primary-container text-white border-primary-500 shadow-sm'
                              : 'bg-white dark:bg-inverse-surface text-slate-600 dark:text-slate-350 border-slate-200 dark:border-outline-variant hover:bg-slate-50'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* User List Grid */}
                  <div className="border border-slate-200 dark:border-outline-variant/20 rounded-2xl bg-white dark:bg-inverse-surface/40 shadow-sm overflow-hidden flex-1 max-h-[30rem] overflow-y-auto">
                    {usersLoading ? (
                      <div className="py-16 text-center text-xs font-bold text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary-500" />
                        Fetching registry accounts...
                      </div>
                    ) : users.length > 0 ? (
                      users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleSelectUser(u)}
                          className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-outline-variant/10 last:border-b-0 transition-colors flex items-center justify-between gap-3 ${
                            selectedUser?.id === u.id
                              ? 'bg-primary-50/50 dark:bg-primary-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-surface-variant/10'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{u.name || u.email.split('@')[0]}</p>
                            <p className="text-[10px] text-slate-400 font-semibold truncate">{u.email}</p>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider border ${
                              u.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400' :
                              u.role === 'employer' ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400' :
                              'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400'
                            }`}>
                              {u.role}
                            </span>
                            
                            {!u.is_active && (
                              <span className="text-[8px] font-extrabold text-rose-500 uppercase tracking-widest animate-pulse">
                                Suspended
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-8 text-xs font-semibold text-slate-400 text-center">No accounts found matching filters.</p>
                    )}
                  </div>
                </div>

                {/* Right Panel: Selected User Detail View */}
                <div className="rounded-2xl border border-slate-100 dark:border-outline-variant/30 bg-white dark:bg-inverse-surface p-5 shadow-sm lg:col-span-2 space-y-6">
                  {selectedUser ? (
                    <div className="space-y-6">
                      {/* User profile header card */}
                      <div className="p-4 border border-slate-200 dark:border-outline-variant/20 rounded-2xl bg-gradient-to-br from-slate-50/40 via-white to-slate-50/10 dark:from-inverse-surface/30 dark:to-inverse-surface/10 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-800 dark:text-white text-base">{selectedUser.name || 'No Display Name'}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                              selectedUser.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              selectedUser.role === 'employer' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-blue-50 text-blue-700 border-blue-100'
                            }`}>
                              {selectedUser.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{selectedUser.email} &bull; Reg: {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        
                        <div className="flex items-center gap-3 border border-slate-100 dark:border-outline-variant/20 rounded-2xl bg-white dark:bg-inverse-surface/80 p-2 shadow-sm">
                          <div className="text-right">
                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Account Access</span>
                            <span className={`text-[10px] font-black uppercase tracking-wider ${selectedUser.is_active !== false ? 'text-emerald-600' : 'text-rose-600 animate-pulse'}`}>
                              {selectedUser.is_active !== false ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                          <button
                            onClick={handleToggleUserSuspension}
                            disabled={suspensionLoading}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all duration-200 active:scale-95 flex items-center gap-1 border cursor-pointer ${
                              selectedUser.is_active !== false
                                ? 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                            }`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{suspensionLoading ? 'Updating...' : selectedUser.is_active !== false ? 'Suspend User' : 'Lift Suspension'}</span>
                          </button>
                        </div>
                      </div>

                      {/* If the user is a student: Render their full audit panel */}
                      {selectedUser.role === 'student' && selectedApplicant && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Credits adjustment section */}
                            <div className="p-4 border border-slate-100 dark:border-outline-variant/20 rounded-2xl bg-slate-50/30 dark:bg-inverse-surface/10 space-y-4">
                              <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Coins className="w-4 h-4 text-primary-500" />
                                <span>Credit Management</span>
                              </h3>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                Remaining Balance:
                                <span className="text-sm font-black text-primary-600 bg-primary-50 dark:bg-primary-950/20 px-2 py-0.5 rounded-lg border border-primary-100 dark:border-primary-800">
                                  {selectedApplicantCredits?.current_credits ?? '--'}
                                </span>
                              </p>

                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Adjustment Amount</label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCreditAmount('-10')}
                                      className="px-2.5 py-2 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all font-bold text-xs"
                                    >
                                      -10
                                    </button>
                                    <input
                                      type="number"
                                      value={creditAmount}
                                      onChange={(e) => setCreditAmount(e.target.value)}
                                      placeholder="Use + / -"
                                      className="flex-1 w-full bg-white dark:bg-inverse-surface border border-slate-200 dark:border-outline-variant rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold text-center dark:text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setCreditAmount('10')}
                                      className="px-2.5 py-2 border border-emerald-200 text-emerald-600 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all font-bold text-xs"
                                    >
                                      +10
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reason / Description</label>
                                  <textarea
                                    value={creditReason}
                                    onChange={(e) => setCreditReason(e.target.value)}
                                    rows={2}
                                    placeholder="Audit logs reason..."
                                    className="w-full bg-white dark:bg-inverse-surface border border-slate-200 dark:border-outline-variant rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold dark:text-white"
                                  />
                                </div>

                                <button
                                  onClick={handleCreditAdjustment}
                                  disabled={creditLoading}
                                  className="w-full py-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 duration-200 text-xs disabled:opacity-50 cursor-pointer"
                                >
                                  {creditLoading ? 'Applying...' : 'Apply Credit Adjust'}
                                </button>
                              </div>
                            </div>

                            {/* Mock practice session history section */}
                            <div className="p-4 border border-slate-100 dark:border-outline-variant/20 rounded-2xl bg-slate-50/30 dark:bg-inverse-surface/10 flex flex-col h-72">
                              <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5 mb-3 flex-shrink-0">
                                <GraduationCap className="w-4 h-4 text-emerald-500" />
                                <span>Mock Sessions History</span>
                              </h3>
                              <div className="overflow-y-auto flex-1 pr-1 space-y-2 border border-slate-150 dark:border-outline-variant/10 bg-white dark:bg-inverse-surface/40 rounded-xl p-2 shadow-inner">
                                {applicantSessionsLoading ? (
                                  <div className="py-12 text-center text-[10px] font-semibold text-slate-400">
                                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-500" />
                                    Loading session histories...
                                  </div>
                                ) : applicantSessions.length > 0 ? (
                                  applicantSessions.map((session) => (
                                    <div key={session.id} className="p-2 border border-slate-100 dark:border-outline-variant/10 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-variant/20 transition-colors flex items-center justify-between gap-2">
                                      <div>
                                        <p className="font-bold text-[11px] text-slate-800 dark:text-white capitalize">{session.interview_type} practice ({session.difficulty})</p>
                                        <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Persona: {session.interviewer_persona}</p>
                                        <p className="text-[8px] text-slate-350">{session.created_at ? new Date(session.created_at).toLocaleDateString() : 'N/A'}</p>
                                      </div>
                                      <div className="text-right">
                                        <span className={`inline-block rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                          session.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                          session.status === 'abandoned' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                                        }`}>
                                          {session.status}
                                        </span>
                                        {session.overall_score !== null && (
                                          <p className="font-black text-xs text-slate-700 dark:text-slate-300 mt-1">Score: {session.overall_score.toFixed(0)}%</p>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="py-16 text-center text-[10px] font-semibold text-slate-400">
                                    No mock practice sessions completed.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Cumulative AI Intelligence insights profile section */}
                          <div className="p-4 border border-slate-100 dark:border-outline-variant/20 rounded-2xl bg-gradient-to-br from-primary-50/10 via-indigo-50/5 to-white dark:from-inverse-surface/30 dark:to-inverse-surface/10 shadow-sm space-y-4">
                            <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 dark:border-outline-variant/10 pb-2">
                              <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
                              <span>Candidate AI Intelligence Profile</span>
                            </h3>
                            {applicantIntelligenceLoading ? (
                              <div className="py-12 text-center text-xs font-semibold text-slate-400">
                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary-500" />
                                Synthesizing cumulative candidate intelligence...
                              </div>
                            ) : applicantIntelligence && applicantIntelligence.status !== 'no_sessions' ? (
                              <div className="space-y-4 text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="p-3 rounded-xl bg-white dark:bg-inverse-surface border border-slate-100 dark:border-outline-variant/20 shadow-sm">
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interviewer Tips</span>
                                    <p className="text-[11px] text-slate-650 dark:text-slate-350 font-semibold">{applicantIntelligence.interviewer_tips || 'N/A'}</p>
                                  </div>
                                  <div className="p-3 rounded-xl bg-white dark:bg-inverse-surface border border-slate-100 dark:border-outline-variant/20 shadow-sm">
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Core Weaknesses</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(applicantIntelligence.core_weaknesses || []).map((w, wIdx) => (
                                        <span key={wIdx} className="rounded px-1.5 py-0.5 bg-rose-50 border border-rose-100 text-[9px] font-bold text-rose-600">
                                          {w}
                                        </span>
                                      ))}
                                      {(applicantIntelligence.core_weaknesses || []).length === 0 && <span className="text-[9px] text-slate-400">None logged</span>}
                                    </div>
                                  </div>
                                  <div className="p-3 rounded-xl bg-white dark:bg-inverse-surface border border-slate-100 dark:border-outline-variant/20 shadow-sm">
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Key Strengths</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(applicantIntelligence.key_strengths || []).map((s, sIdx) => (
                                        <span key={sIdx} className="rounded px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-[9px] font-bold text-emerald-600">
                                          {s}
                                        </span>
                                      ))}
                                      {(applicantIntelligence.key_strengths || []).length === 0 && <span className="text-[9px] text-slate-400">None logged</span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="p-3.5 rounded-xl border border-slate-100 dark:border-outline-variant/20 bg-white/50 dark:bg-inverse-surface/40">
                                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Growth Summary</span>
                                  <p className="text-[11px] text-slate-650 dark:text-slate-350 font-normal leading-relaxed">{applicantIntelligence.growth_summary || 'No growth summary logged yet.'}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 text-center text-xs font-semibold text-slate-400">
                                Candidate has not completed any mock sessions yet. No AI insights available.
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* User Activity log */}
                      <div className="p-4 border border-slate-100 dark:border-outline-variant/20 rounded-2xl bg-slate-50/30 dark:bg-inverse-surface/10 space-y-4">
                        <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-primary-500 animate-pulse" />
                          <span>Recent Activity History</span>
                        </h3>
                        <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-150 dark:border-outline-variant/10 bg-white dark:bg-inverse-surface/40 rounded-xl p-3 shadow-inner">
                          {selectedUserActivityLoading ? (
                            <div className="py-8 text-center text-xs font-semibold text-slate-400">
                              <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-primary-500" />
                              Loading activity registry...
                            </div>
                          ) : selectedUserActivity.length > 0 ? (
                            selectedUserActivity.map((log) => {
                              let actionText = log.action
                              if (log.action === 'user_ban_toggle') {
                                const active = log.details?.new_status
                                actionText = active ? 'Account suspension lifted by Admin' : 'Account suspended by Admin'
                              } else if (log.action === 'credit_adjustment') {
                                const amt = log.details?.amount
                                actionText = `Credits adjusted by Admin (${amt > 0 ? `+${amt}` : amt})`
                              }
                              
                              return (
                                <div key={log.id} className="p-2.5 border border-slate-100 dark:border-outline-variant/10 rounded-lg hover:bg-slate-50 dark:hover:bg-surface-variant/20 flex items-center justify-between gap-3 text-[11px] leading-tight">
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 dark:text-white">{actionText}</p>
                                    {log.details?.reason && (
                                      <p className="text-[9px] text-slate-400 mt-0.5">Reason: {log.details.reason}</p>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                                    {log.created_at ? new Date(log.created_at).toLocaleDateString() : 'N/A'}
                                  </span>
                                </div>
                              )
                            })
                          ) : (
                            <p className="text-center py-6 text-[10px] text-slate-400 font-semibold">No recent activity logs recorded for this user.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 text-center">
                      <Users className="w-16 h-16 text-slate-250 mx-auto mb-3 animate-pulse" />
                      <p className="text-slate-400 font-semibold text-xs">Select a user account from the registry to view profiles, manage credentials, and audit activity history.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Resume Reviews Hub */}
          {activeTab === 'resume-reviews' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 4 }}
              className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
            >
              <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  <span>Resume Parsing Correction Hub</span>
                </h2>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
                  {pendingResumeReviews.length} parses need human review
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side list */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 lg:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pending Resume Reviews</label>
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={resumeReviewSearchQuery}
                      onChange={(e) => setResumeReviewSearchQuery(e.target.value)}
                      placeholder="Search applicant name..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                    />
                  </div>
                  <div className="max-h-[50vh] overflow-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                    {pendingResumeReviewsLoading ? (
                      <div className="p-8 text-center text-slate-400 font-semibold text-xs">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
                        Loading reviews...
                      </div>
                    ) : pendingResumeReviews.filter(r => (r.applicant_name || '').toLowerCase().includes(resumeReviewSearchQuery.toLowerCase())).map((reviewItem) => (
                      <button
                        key={reviewItem.applicant_id}
                        onClick={() => handleSelectResumeReview(reviewItem.applicant_id)}
                        className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${selectedResumeReview?.applicant?.id === reviewItem.applicant_id ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <p className="font-bold text-sm text-slate-800">{reviewItem.applicant_name || `Applicant #${reviewItem.applicant_id}`}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-slate-400 font-semibold">Confidence: {(reviewItem.confidence * 100).toFixed(0)}%</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${reviewItem.confidence < 0.7 ? 'bg-rose-50 text-rose-655' : 'bg-amber-50 text-amber-655'}`}>
                            {reviewItem.confidence < 0.7 ? 'Low' : 'Medium'}
                          </span>
                        </div>
                      </button>
                    ))}
                    {pendingResumeReviews.length === 0 && !pendingResumeReviewsLoading && (
                      <p className="px-4 py-8 text-xs font-semibold text-slate-400 text-center">No pending resume reviews!</p>
                    )}
                  </div>
                </div>

                {/* Right side details override form */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Resume Correction Console</label>
                  {selectedResumeReviewLoading ? (
                    <div className="p-16 text-center text-slate-400 font-semibold text-sm">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary-500" />
                      Loading parse details...
                    </div>
                  ) : selectedResumeReview ? (
                    <div className="space-y-6">
                      <div className="p-4 border border-slate-100 rounded-2xl bg-gradient-to-br from-slate-50/50 via-white to-slate-50/10">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div>
                            <h4 className="font-black text-slate-800 text-base">{selectedResumeReview.applicant?.display_name || `Applicant #${selectedResumeReview.applicant?.id}`}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">ID: {selectedResumeReview.applicant?.applicant_id} | DB ID: {selectedResumeReview.applicant?.id}</p>
                          </div>
                          <div className="flex gap-2">
                            <span className="rounded-xl border border-rose-100 bg-rose-50/50 px-2.5 py-1 text-[10px] font-bold text-rose-700">
                              Confidence: {(selectedResumeReview.field_confidences?.overall * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Fields Override section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CGPA */}
                        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">CGPA / Grade</label>
                          <p className="text-[10px] text-slate-400 font-semibold mb-2">Original parsed: <span className="font-black text-slate-700">{selectedResumeReview.parsed_data?.education?.[0]?.grade || selectedResumeReview.parsed_data?.education?.[0]?.cgpa || 'N/A'}</span></p>
                          <input
                            type="number"
                            step="0.01"
                            value={reviewForm.cgpa}
                            onChange={(e) => setReviewForm(prev => ({ ...prev, cgpa: e.target.value }))}
                            placeholder="Enter corrected CGPA (e.g. 8.5)"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold text-slate-800"
                          />
                        </div>

                        {/* JEE Rank */}
                        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">JEE Rank</label>
                          <p className="text-[10px] text-slate-400 font-semibold mb-2">Original parsed: <span className="font-black text-slate-700">{selectedResumeReview.parsed_data?.jee_rank || 'N/A'}</span></p>
                          <input
                            type="number"
                            value={reviewForm.jee_rank}
                            onChange={(e) => setReviewForm(prev => ({ ...prev, jee_rank: e.target.value }))}
                            placeholder="Enter corrected JEE rank (e.g. 12500)"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xs font-semibold text-slate-800"
                          />
                        </div>
                      </div>

                      {/* Skills review */}
                      <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Parsed Skills</label>
                        <div className="flex flex-wrap gap-1.5">
                          {(selectedResumeReview.parsed_data?.skills || []).map((skill, sIdx) => {
                            const skillName = typeof skill === 'string' ? skill : skill.name || JSON.stringify(skill)
                            return (
                              <span key={sIdx} className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                                {skillName}
                              </span>
                            )
                          })}
                          {(selectedResumeReview.parsed_data?.skills || []).length === 0 && (
                            <p className="text-xs font-semibold text-slate-400">No skills parsed.</p>
                          )}
                        </div>
                      </div>

                      {/* Audit Reason */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Human Correction Reason (Audit Logs)</label>
                        <textarea
                          rows={3}
                          value={reviewForm.reason}
                          onChange={(e) => setReviewForm(prev => ({ ...prev, reason: e.target.value }))}
                          placeholder="Explain why these fields are being overridden..."
                          className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                          onClick={() => handleApproveResumeReviewWithoutChanges(selectedResumeReview.applicant.id)}
                          disabled={reviewSubmitting}
                          className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Without Overrides</span>
                        </button>
                        <button
                          onClick={handleApplyResumeReviewOverride}
                          disabled={reviewSubmitting}
                          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-xl transition-all text-xs font-bold active:scale-95 duration-200 disabled:opacity-50 shadow-md flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{reviewSubmitting ? 'Submitting Override...' : 'Apply Correction Overrides'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-24 text-center">
                      <FileText className="w-16 h-16 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 font-semibold text-xs">Select a pending resume review from the list to begin human loop corrections.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}          {/* System Health Tab */}
          {activeTab === 'system-health' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 4 }}
              className="border border-slate-100 dark:border-outline-variant/30 bg-white/90 dark:bg-inverse-surface/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
            >
              <div className="mb-6 flex items-center justify-between gap-3 flex-wrap font-sans">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary-500" />
                    <span>System Health & Semantic Indexing Center</span>
                  </h2>
                  <p className="text-xs font-semibold text-slate-400 mt-1">Monitor real-time LLM telemetry, semantic index coverages, and trigger vector reconstructions.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetLLMStats}
                    disabled={llmResetLoading || systemHealthLoading}
                    className="rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-800/40 p-2 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 active:scale-95 duration-200 cursor-pointer"
                    title="Reset LLM Telemetry Counters"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${llmResetLoading ? 'animate-spin' : ''}`} />
                    <span>Reset Telemetry</span>
                  </button>
                  <button
                    onClick={fetchSystemHealth}
                    disabled={systemHealthLoading}
                    className="rounded-xl border border-slate-200 dark:border-outline-variant/40 p-2 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-inverse-surface-variant transition-colors flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 active:scale-95 duration-200 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${systemHealthLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh Stats</span>
                  </button>
                </div>
              </div>

              {systemHealthLoading && !systemHealthStats ? (
                <div className="py-24 text-center text-slate-400 font-semibold">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary-500" />
                  Loading system health diagnostics...
                </div>
              ) : systemHealthStats ? (
                <div className="space-y-6 font-sans">
                  {/* Dynamic Cooldown Banner Alert */}
                  {(() => {
                    const cooldowns = Object.entries(systemHealthStats.llm?.provider_stats || {})
                      .filter(([_, s]) => (s.retry_after_remaining || 0) > 0)
                    if (cooldowns.length > 0) {
                      return (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3 animate-pulse">
                          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-black text-sm">Provider Quota Exhaustion / Cooldown Active</p>
                            <p className="text-xs font-semibold opacity-90 mt-0.5">
                              The system is currently observing a backup routing backoff for the following provider(s): {cooldowns.map(([p, s]) => `${p.toUpperCase()} (${s.retry_after_remaining}s remaining)`).join(', ')}. All API calls are falling back automatically.
                            </p>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Stats Grid */}
                  {(() => {
                    const llm = systemHealthStats.llm || {}
                    const pStats = llm.provider_stats || {}
                    
                    const totalTokens = (pStats.groq?.tokens_total || 0) + 
                                        (pStats.gemini?.tokens_total || 0) + 
                                        (pStats.openrouter?.tokens_total || 0)
                                        
                    const totalRequests = (pStats.groq?.requests || 0) + 
                                          (pStats.gemini?.requests || 0) + 
                                          (pStats.openrouter?.requests || 0)
                                          
                    const totalLatency = (pStats.groq?.total_latency || 0) + 
                                         (pStats.gemini?.total_latency || 0) + 
                                         (pStats.openrouter?.total_latency || 0)
                                         
                    const avgLatency = totalRequests > 0 ? (totalLatency / totalRequests).toFixed(3) : '0.000'
                    const totalFallbacks = llm.fallback_requests || 0
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Token Usage */}
                        <div className="p-5 border border-slate-100 dark:border-outline-variant/20 bg-white dark:bg-inverse-surface rounded-2xl shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Token Volume</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">
                              {totalTokens.toLocaleString()}
                            </p>
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-450 mt-1">
                              All active routed channels
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-800 text-primary-600 dark:text-primary-400">
                            <Cpu className="w-6 h-6" />
                          </div>
                        </div>

                        {/* Avg Latency */}
                        <div className="p-5 border border-slate-100 dark:border-outline-variant/20 bg-white dark:bg-inverse-surface rounded-2xl shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Average Response Latency</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">
                              {avgLatency}s
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">
                              Across {totalRequests} total requests
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                            <Clock className="w-6 h-6" />
                          </div>
                        </div>

                        {/* RAG Chunks */}
                        <div className="p-5 border border-slate-100 dark:border-outline-variant/20 bg-white dark:bg-inverse-surface rounded-2xl shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">RAG Doc Chunks</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">
                              {systemHealthStats.rag?.total_chunks ?? 0}
                            </p>
                            <p className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 mt-1">
                              Index: {systemHealthStats.rag?.is_initialized ? 'Initialized' : 'Uninitialized'}
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-850 text-indigo-600 dark:text-indigo-400">
                            <Database className="w-6 h-6" />
                          </div>
                        </div>

                        {/* Active Fallbacks */}
                        <div className="p-5 border border-slate-100 dark:border-outline-variant/20 bg-white dark:bg-inverse-surface rounded-2xl shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Routed Fallbacks</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">
                              {totalFallbacks}
                            </p>
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-450 mt-1">
                              Automatic failovers logged
                            </p>
                          </div>
                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-850 text-amber-600 dark:text-amber-400">
                            <TrendingUp className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Comparison Charts & Recent Alerts */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SVG Comparison Charts */}
                    <div className="lg:col-span-2 p-5 border border-slate-100 dark:border-outline-variant/20 bg-white dark:bg-inverse-surface rounded-2xl shadow-sm relative">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Channel Telemetry Metrics</h3>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Real-time benchmark distributions for requests and response latencies.</p>
                        </div>
                        {hoveredBar && (
                          <div className="bg-slate-900/90 text-white text-[9px] px-2 py-0.5 rounded border border-slate-800 shadow-md font-bold uppercase tracking-wider">
                            {hoveredBar.provider} &bull; {hoveredBar.metric}: <span className="text-primary-400 font-extrabold">{hoveredBar.value}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Traffic Chart */}
                        <div className="p-3 border border-slate-100 dark:border-outline-variant/10 rounded-xl bg-slate-50/20 dark:bg-inverse-surface/30">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-350 uppercase tracking-widest text-center mb-2">Request Traffic distribution</p>
                          {(() => {
                            const pStats = systemHealthStats.llm?.provider_stats || {}
                            const groqVal = pStats.groq?.requests || 0
                            const geminiVal = pStats.gemini?.requests || 0
                            const openrouterVal = pStats.openrouter?.requests || 0
                            const maxVal = Math.max(groqVal, geminiVal, openrouterVal, 1)

                            const hGroq = (groqVal / maxVal) * 110
                            const hGemini = (geminiVal / maxVal) * 110
                            const hOpenrouter = (openrouterVal / maxVal) * 110

                            return (
                              <svg viewBox="0 0 300 160" className="w-full h-auto">
                                <defs>
                                  <linearGradient id="groqGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" />
                                    <stop offset="100%" stopColor="#a78bfa" />
                                  </linearGradient>
                                  <linearGradient id="geminiGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" />
                                    <stop offset="100%" stopColor="#60a5fa" />
                                  </linearGradient>
                                  <linearGradient id="openrouterGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" />
                                    <stop offset="100%" stopColor="#fbbf24" />
                                  </linearGradient>
                                </defs>
                                {/* Grid Lines */}
                                <line x1="40" y1="20" x2="280" y2="20" stroke="#94a3b8" strokeOpacity="0.1" strokeDasharray="3" />
                                <line x1="40" y1="65" x2="280" y2="65" stroke="#94a3b8" strokeOpacity="0.1" strokeDasharray="3" />
                                <line x1="40" y1="110" x2="280" y2="110" stroke="#94a3b8" strokeOpacity="0.1" strokeDasharray="3" />
                                <line x1="40" y1="130" x2="280" y2="130" stroke="#94a3b8" strokeOpacity="0.2" />

                                {/* Groq Bar */}
                                <rect
                                  x="65"
                                  y={130 - hGroq}
                                  width="30"
                                  height={hGroq}
                                  fill="url(#groqGrad)"
                                  rx="4"
                                  className="cursor-pointer transition-all duration-300 hover:opacity-85"
                                  onMouseEnter={() => setHoveredBar({ provider: 'Groq', metric: 'Traffic', value: `${groqVal} requests` })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                />
                                {/* Gemini Bar */}
                                <rect
                                  x="135"
                                  y={130 - hGemini}
                                  width="30"
                                  height={hGemini}
                                  fill="url(#geminiGrad)"
                                  rx="4"
                                  className="cursor-pointer transition-all duration-300 hover:opacity-85"
                                  onMouseEnter={() => setHoveredBar({ provider: 'Gemini', metric: 'Traffic', value: `${geminiVal} requests` })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                />
                                {/* OpenRouter Bar */}
                                <rect
                                  x="205"
                                  y={130 - hOpenrouter}
                                  width="30"
                                  height={hOpenrouter}
                                  fill="url(#openrouterGrad)"
                                  rx="4"
                                  className="cursor-pointer transition-all duration-300 hover:opacity-85"
                                  onMouseEnter={() => setHoveredBar({ provider: 'OpenRouter', metric: 'Traffic', value: `${openrouterVal} requests` })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                />

                                {/* X Labels */}
                                <text x="80" y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400">Groq</text>
                                <text x="150" y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400">Gemini</text>
                                <text x="220" y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400">OpenRouter</text>

                                {/* Y Labels */}
                                <text x="35" y="23" textAnchor="end" className="text-[8px] font-bold fill-slate-400">{maxVal.toFixed(0)}</text>
                                <text x="35" y="70" textAnchor="end" className="text-[8px] font-bold fill-slate-400">{(maxVal/2).toFixed(0)}</text>
                                <text x="35" y="133" textAnchor="end" className="text-[8px] font-bold fill-slate-400">0</text>
                              </svg>
                            )
                          })()}
                        </div>

                        {/* Latency Chart */}
                        <div className="p-3 border border-slate-100 dark:border-outline-variant/10 rounded-xl bg-slate-50/20 dark:bg-inverse-surface/30">
                          <p className="text-[10px] font-bold text-slate-550 dark:text-slate-350 uppercase tracking-widest text-center mb-2">Average Response Latency (Sec)</p>
                          {(() => {
                            const pStats = systemHealthStats.llm?.provider_stats || {}
                            const groqLat = pStats.groq?.avg_latency || 0
                            const geminiLat = pStats.gemini?.avg_latency || 0
                            const openrouterLat = pStats.openrouter?.avg_latency || 0
                            const maxLat = Math.max(groqLat, geminiLat, openrouterLat, 1.0)

                            const hGroq = (groqLat / maxLat) * 110
                            const hGemini = (geminiLat / maxLat) * 110
                            const hOpenrouter = (openrouterLat / maxLat) * 110

                            return (
                              <svg viewBox="0 0 300 160" className="w-full h-auto">
                                {/* Grid Lines */}
                                <line x1="40" y1="20" x2="280" y2="20" stroke="#94a3b8" strokeOpacity="0.1" strokeDasharray="3" />
                                <line x1="40" y1="65" x2="280" y2="65" stroke="#94a3b8" strokeOpacity="0.1" strokeDasharray="3" />
                                <line x1="40" y1="110" x2="280" y2="110" stroke="#94a3b8" strokeOpacity="0.1" strokeDasharray="3" />
                                <line x1="40" y1="130" x2="280" y2="130" stroke="#94a3b8" strokeOpacity="0.2" />

                                {/* Groq Bar */}
                                <rect
                                  x="65"
                                  y={130 - hGroq}
                                  width="30"
                                  height={hGroq}
                                  fill="url(#groqGrad)"
                                  rx="4"
                                  className="cursor-pointer transition-all duration-300 hover:opacity-85"
                                  onMouseEnter={() => setHoveredBar({ provider: 'Groq', metric: 'Avg Latency', value: `${groqLat.toFixed(3)}s` })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                />
                                {/* Gemini Bar */}
                                <rect
                                  x="135"
                                  y={130 - hGemini}
                                  width="30"
                                  height={hGemini}
                                  fill="url(#geminiGrad)"
                                  rx="4"
                                  className="cursor-pointer transition-all duration-300 hover:opacity-85"
                                  onMouseEnter={() => setHoveredBar({ provider: 'Gemini', metric: 'Avg Latency', value: `${geminiLat.toFixed(3)}s` })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                />
                                {/* OpenRouter Bar */}
                                <rect
                                  x="205"
                                  y={130 - hOpenrouter}
                                  width="30"
                                  height={hOpenrouter}
                                  fill="url(#openrouterGrad)"
                                  rx="4"
                                  className="cursor-pointer transition-all duration-300 hover:opacity-85"
                                  onMouseEnter={() => setHoveredBar({ provider: 'OpenRouter', metric: 'Avg Latency', value: `${openrouterLat.toFixed(3)}s` })}
                                  onMouseLeave={() => setHoveredBar(null)}
                                />

                                {/* X Labels */}
                                <text x="80" y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400">Groq</text>
                                <text x="150" y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400">Gemini</text>
                                <text x="220" y="145" textAnchor="middle" className="text-[8px] font-bold fill-slate-400">OpenRouter</text>

                                {/* Y Labels */}
                                <text x="35" y="23" textAnchor="end" className="text-[8px] font-bold fill-slate-400">{maxLat.toFixed(1)}s</text>
                                <text x="35" y="70" textAnchor="end" className="text-[8px] font-bold fill-slate-400">{(maxLat/2).toFixed(1)}s</text>
                                <text x="35" y="133" textAnchor="end" className="text-[8px] font-bold fill-slate-400">0s</text>
                              </svg>
                            )
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Alerts List */}
                    <div className="lg:col-span-1 p-5 border border-slate-100 dark:border-outline-variant/20 bg-white dark:bg-inverse-surface rounded-2xl shadow-sm flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">Live System Log Alerts</h3>
                        
                        {(() => {
                          const alerts = []
                          const llm = systemHealthStats.llm || {}
                          const pStats = llm.provider_stats || {}
                          
                          // Check for cooldowns
                          Object.entries(pStats).forEach(([name, s]) => {
                            if ((s.retry_after_remaining || 0) > 0) {
                              alerts.push({
                                type: 'error',
                                title: `${name.toUpperCase()} Backoff Cooldown`,
                                desc: `${s.retry_after_remaining}s remaining before channel recovery.`,
                              })
                            }
                          })

                          // Check for missing keys
                          Object.entries(pStats).forEach(([name, s]) => {
                            if (!s.is_configured) {
                              alerts.push({
                                type: 'warning',
                                title: `${name.toUpperCase()} Key Missing`,
                                desc: `No api key detected in environment config. Channel disabled.`,
                              })
                            }
                          })

                          // RAG Status
                          if (systemHealthStats.rag && !systemHealthStats.rag.is_initialized) {
                            alerts.push({
                              type: 'warning',
                              title: 'RAG Index Empty',
                              desc: 'Semantic doc index is uninitialized. Rebuild index recommended.',
                            })
                          }

                          // Embeddings Coverage Drift
                          const emb = systemHealthStats.embeddings?.coverage || {}
                          if (emb.applicants_total > 0 && emb.applicants_embedded < emb.applicants_total) {
                            alerts.push({
                              type: 'info',
                              title: 'Resume Index Drift',
                              desc: `${emb.applicants_total - emb.applicants_embedded} profiles pending semantic re-indexing.`,
                            })
                          }
                          if (emb.jobs_total > 0 && emb.jobs_embedded < emb.jobs_total) {
                            alerts.push({
                              type: 'info',
                              title: 'Jobs Index Drift',
                              desc: `${emb.jobs_total - emb.jobs_embedded} postings pending semantic re-indexing.`,
                            })
                          }

                          if (alerts.length === 0) {
                            return (
                              <div className="py-8 text-center">
                                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-800 dark:text-white">All Systems Operational</p>
                                <p className="text-[10px] text-slate-400 mt-1">No warnings or routing drifts active.</p>
                              </div>
                            )
                          }

                          return (
                            <div className="space-y-3.5 max-h-48 overflow-y-auto pr-1">
                              {alerts.map((al, idx) => (
                                <div key={idx} className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-[11px] leading-tight ${
                                  al.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400' :
                                  al.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400' :
                                  'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400'
                                }`}>
                                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                    al.type === 'error' ? 'text-rose-500' :
                                    al.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                                  }`} />
                                  <div>
                                    <p className="font-extrabold">{al.title}</p>
                                    <p className="text-[9px] opacity-80 mt-0.5">{al.desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-outline-variant/10 text-[9px] text-slate-400 font-semibold flex items-center justify-between">
                        <span>Check interval: 10s</span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span>Telemetry Active</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100 dark:border-outline-variant/20">
                    {/* Job Reindexing Card */}
                    <div className="p-5 border border-slate-100 dark:border-outline-variant/20 bg-slate-50/30 dark:bg-inverse-surface/30 rounded-2xl flex flex-col justify-between h-48">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Server className="w-4 h-4 text-emerald-600" />
                          <h3 className="font-bold text-slate-800 dark:text-white text-sm">Job Semantic Index</h3>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                          Queue background embedding generation for all approved jobs. Essential for semantic matching scoring.
                        </p>
                      </div>
                      <button
                        onClick={() => triggerReindex('jobs')}
                        disabled={systemHealthActionLoading !== null}
                        className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 dark:bg-inverse-surface dark:hover:bg-inverse-surface-variant border border-slate-200 dark:border-outline-variant rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-white flex items-center justify-center gap-1.5 active:scale-95 duration-200 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${systemHealthActionLoading === 'jobs' ? 'animate-spin' : ''}`} />
                        <span>Reindex Approved Jobs</span>
                      </button>
                    </div>

                    {/* Applicant Reindexing Card */}
                    <div className="p-5 border border-slate-100 dark:border-outline-variant/20 bg-slate-50/30 dark:bg-inverse-surface/30 rounded-2xl flex flex-col justify-between h-48">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-primary-600" />
                          <h3 className="font-bold text-slate-800 dark:text-white text-sm">Resume Semantic Index</h3>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                          Queue background embedding generation for all parsed resume profiles. Powerhouse of semantic queries.
                        </p>
                      </div>
                      <button
                        onClick={() => triggerReindex('applicants')}
                        disabled={systemHealthActionLoading !== null}
                        className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 dark:bg-inverse-surface dark:hover:bg-inverse-surface-variant border border-slate-200 dark:border-outline-variant rounded-xl text-xs font-bold transition-all text-slate-700 dark:text-white flex items-center justify-center gap-1.5 active:scale-95 duration-200 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${systemHealthActionLoading === 'applicants' ? 'animate-spin' : ''}`} />
                        <span>Reindex Resumes</span>
                      </button>
                    </div>

                    {/* RAG Reinitialize Card */}
                    <div className="p-5 border border-slate-100 dark:border-outline-variant/20 bg-slate-50/30 dark:bg-inverse-surface/30 rounded-2xl flex flex-col justify-between h-48">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="w-4 h-4 text-amber-600 animate-pulse" />
                          <h3 className="font-bold text-slate-800 dark:text-white text-sm">Documentation RAG</h3>
                        </div>
                        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                          Force fully rebuilding the vector search chunk index from files. Resolves document answer drifts.
                        </p>
                      </div>
                      <button
                        onClick={() => triggerReindex('rag')}
                        disabled={systemHealthActionLoading !== null}
                        className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 duration-200 disabled:opacity-50 shadow-md shadow-primary-500/10 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{systemHealthActionLoading === 'rag' ? 'Rebuilding RAG...' : 'Force Rebuild RAG'}</span>
                      </button>
                    </div>
                  </div>

                  {/* LLM Key & Routing Telemetry Panel */}
                  {systemHealthStats.llm && (() => {
                    const llm = systemHealthStats.llm
                    const providers = [
                      {
                        key: 'groq',
                        label: 'Groq',
                        subtitle: llm.provider_stats?.groq?.model || 'llama-3.3-70b-versatile',
                        accentColor: 'violet',
                        icon: Zap,
                        stats: llm.provider_stats?.groq,
                        showRateLimit: true,
                      },
                      {
                        key: 'gemini',
                        label: 'Google Gemini',
                        subtitle: llm.provider_stats?.gemini?.model || 'gemini-2.5-flash',
                        accentColor: 'blue',
                        icon: Sparkles,
                        stats: llm.provider_stats?.gemini,
                        showRateLimit: false,
                      },
                      {
                        key: 'openrouter',
                        label: 'OpenRouter Backup',
                        subtitle: llm.provider_stats?.openrouter?.model || 'deepseek / kimi',
                        accentColor: 'emerald',
                        icon: Cpu,
                        stats: llm.provider_stats?.openrouter,
                        showRateLimit: false,
                      },
                    ]

                    const colorMap = {
                      violet: {
                        bg: 'bg-violet-50 dark:bg-violet-950/20', border: 'border-violet-100 dark:border-violet-900/30', text: 'text-violet-700 dark:text-violet-400',
                        iconBg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/30', badgeActive: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/30',
                        bar: 'bg-violet-500', barBg: 'bg-violet-100 dark:bg-violet-950/30',
                      },
                      blue: {
                        bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-100 dark:border-blue-900/30', text: 'text-blue-700 dark:text-blue-400',
                        iconBg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/30', badgeActive: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30',
                        bar: 'bg-blue-500', barBg: 'bg-blue-100 dark:bg-blue-950/30',
                      },
                      emerald: {
                        bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-450',
                        iconBg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/30', badgeActive: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-450 dark:border-emerald-900/30',
                        bar: 'bg-emerald-500', barBg: 'bg-emerald-100 dark:bg-emerald-950/30',
                      },
                    }

                    const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString())
                    const fmtPct = (rem, lim) => {
                      if (rem == null || lim == null || lim === 0) return null
                      return Math.round((rem / lim) * 100)
                    }

                    return (
                      <div className="pt-6 border-t border-slate-100 dark:border-outline-variant/20">
                        <div className="flex items-center gap-2 mb-4">
                          <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                          <h3 className="text-sm font-bold text-slate-800 dark:text-white">LLM Provider Quota Registry</h3>
                          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Total: {fmtNum(llm.total_requests)} req &bull; {fmtNum(llm.fallback_requests)} fallbacks
                          </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {providers.map(({ key, label, subtitle, accentColor, icon: Icon, stats, showRateLimit }) => {
                            if (!stats) return null
                            const c = colorMap[accentColor]
                            const cooldown = stats.retry_after_remaining || 0
                            const hasCooldown = cooldown > 0
                            const reqPct = showRateLimit ? fmtPct(stats.rate_limit_requests_remaining, stats.rate_limit_requests_limit) : null
                            const tokPct = showRateLimit ? fmtPct(stats.rate_limit_tokens_remaining, stats.rate_limit_tokens_limit) : null

                            return (
                              <div
                                key={key}
                                className={`relative rounded-2xl border bg-white dark:bg-inverse-surface shadow-sm overflow-hidden transition-all ${
                                  hasCooldown ? 'border-rose-300 dark:border-rose-900 ring-1 ring-rose-200 dark:ring-rose-950/30' : 'border-slate-100 dark:border-outline-variant/10'
                                }`}
                              >
                                {/* Card header */}
                                <div className={`px-4 py-3 flex items-center justify-between gap-3 border-b ${
                                  hasCooldown ? 'border-rose-100 dark:border-rose-955 bg-rose-50/60 dark:bg-rose-950/10' : `${c.bg} ${c.border}`
                                }`}>
                                  <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-lg border ${c.iconBg}`}>
                                      <Icon className={`w-4 h-4 ${c.text}`} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{label}</p>
                                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate max-w-[140px]">{subtitle}</p>
                                    </div>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                                    hasCooldown
                                      ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30'
                                      : stats.is_configured
                                        ? c.badgeActive
                                        : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-inverse-surface-variant dark:text-slate-400 dark:border-outline-variant/20'
                                  }`}>
                                    {hasCooldown ? 'Cooling Down' : stats.is_configured ? 'Active' : 'Not Set'}
                                  </span>
                                </div>

                                {/* 429 Cooldown alert */}
                                {hasCooldown && (
                                  <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                    <p className="text-[11px] font-bold text-rose-705 dark:text-rose-400">
                                      Rate limited — retry in <span className="font-black">{cooldown}s</span>
                                    </p>
                                  </div>
                                )}

                                {/* Stats grid */}
                                <div className="p-4 space-y-3 font-sans">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-inverse-surface-variant/20 border border-slate-100 dark:border-outline-variant/10">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Requests</p>
                                      <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{fmtNum(stats.requests)}</p>
                                      <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-450">{fmtNum(stats.successes)} ok</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-inverse-surface-variant/20 border border-slate-100 dark:border-outline-variant/10">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Avg Latency</p>
                                      <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{stats.avg_latency ?? '—'}s</p>
                                      <p className="text-[9px] font-semibold text-rose-500 dark:text-rose-400">{fmtNum(stats.errors)} err</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-inverse-surface-variant/20 border border-slate-100 dark:border-outline-variant/10">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fallbacks</p>
                                      <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{fmtNum(stats.fallbacks)}</p>
                                      <p className="text-[9px] font-semibold text-amber-600 dark:text-amber-450">{key === 'openrouter' ? 'None' : 'to Backup'}</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-inverse-surface-variant/20 border border-slate-100 dark:border-outline-variant/10">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tokens Out</p>
                                      <p className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{fmtNum(stats.tokens_total)}</p>
                                      <p className="text-[9px] font-semibold text-slate-400 mt-0.5">{fmtNum(stats.tokens_prompt)} in</p>
                                    </div>
                                  </div>

                                  {/* Groq-only: rate limit progress bars */}
                                  {showRateLimit && (
                                    <div className="space-y-2 pt-1">
                                      {/* Daily requests bar */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[9px] font-bold text-slate-550 dark:text-slate-405 uppercase tracking-wider">Daily Requests</span>
                                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                            {fmtNum(stats.rate_limit_requests_remaining)} / {fmtNum(stats.rate_limit_requests_limit)}
                                          </span>
                                        </div>
                                        <div className={`w-full h-1.5 rounded-full ${c.barBg} overflow-hidden`}>
                                          <div
                                            className={`h-full rounded-full transition-all duration-700 ${
                                              reqPct != null && reqPct < 10 ? 'bg-rose-500' :
                                              reqPct != null && reqPct < 30 ? 'bg-amber-500' : c.bar
                                            }`}
                                            style={{ width: reqPct != null ? `${reqPct}%` : '0%' }}
                                          />
                                        </div>
                                        {stats.rate_limit_reset_requests && (
                                          <p className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                            Resets in {stats.rate_limit_reset_requests}
                                          </p>
                                        )}
                                      </div>

                                      {/* Per-minute tokens bar */}
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[9px] font-bold text-slate-550 dark:text-slate-405 uppercase tracking-wider">Tokens / Min</span>
                                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                            {fmtNum(stats.rate_limit_tokens_remaining)} / {fmtNum(stats.rate_limit_tokens_limit)}
                                          </span>
                                        </div>
                                        <div className={`w-full h-1.5 rounded-full ${c.barBg} overflow-hidden`}>
                                          <div
                                            className={`h-full rounded-full transition-all duration-700 ${
                                              tokPct != null && tokPct < 10 ? 'bg-rose-500' :
                                              tokPct != null && tokPct < 30 ? 'bg-amber-500' : c.bar
                                            }`}
                                            style={{ width: tokPct != null ? `${tokPct}%` : '0%' }}
                                          />
                                        </div>
                                        {stats.rate_limit_reset_tokens && (
                                          <p className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                            Window clears in {stats.rate_limit_reset_tokens}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Non-Groq providers: token breakdown counters */}
                                  {!showRateLimit && (
                                    <div className="pt-1 border-t border-slate-100 dark:border-outline-variant/10">
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cumulative Token Usage</p>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {[['Prompt', stats.tokens_prompt], ['Completion', stats.tokens_completion], ['Total', stats.tokens_total]].map(([lbl, val]) => (
                                          <div key={lbl} className="text-center p-2 rounded-lg bg-slate-50 dark:bg-inverse-surface-variant/20 border border-slate-100 dark:border-outline-variant/10">
                                            <p className="text-[9px] font-bold text-slate-400 mb-0.5">{lbl}</p>
                                            <p className={`text-xs font-black ${c.text}`}>{fmtNum(val)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                </div>
              ) : (
                <div className="py-24 text-center text-slate-400 font-semibold">
                  Failed to fetch diagnostic reports. Ensure backend is running.
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeJobDetails} />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl"
          >
            <div className="border-b border-slate-100 bg-gradient-to-br from-primary-50/40 via-white to-yellow-50/40 dark:from-[#161c24] dark:via-[#1c252e] dark:to-[#161c24] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600">Job Details</p>
                  {!editingMode ? (
                    <h3 className="mt-2 text-2xl font-black text-slate-900">
                      {viewJobLoading ? 'Loading job...' : viewingJob.title || 'Untitled Job'}
                    </h3>
                  ) : (
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-2 w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-xl font-bold text-slate-900"
                    />
                  )}
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {viewingJob.company || 'Unknown company'}
                    {viewingJob.location_city ? ` • ${viewingJob.location_city}${viewingJob.location_state ? `, ${viewingJob.location_state}` : ''}` : ''}
                  </p>
                </div>
                <button
                  onClick={closeJobDetails}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-colors flex-shrink-0"
                  aria-label="Close job details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-6">
              {viewJobError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-bold">
                  {viewJobError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                  <section className="rounded-2xl border border-slate-100 bg-slate-50/40 p-5">
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Description</h4>
                    {!editingMode ? (
                      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {viewJobLoading ? (
                          'Loading...'
                        ) : viewingJob.description ? (
                          <ReactMarkdown components={jobMarkdownComponents}>
                            {viewingJob.description}
                          </ReactMarkdown>
                        ) : (
                          'No description provided.'
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={8}
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                      />
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Skills</h4>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Required Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {(viewingJob.required_skills || []).length > 0 ? (
                            viewingJob.required_skills.map((skill, index) => (
                              <span key={index} className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 shadow-sm">
                                {typeof skill === 'string' ? skill : skill.name || JSON.stringify(skill)}
                              </span>
                            ))
                          ) : (
                            <p className="text-xs font-semibold text-slate-400">No required skills listed.</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Optional Skills</p>
                        <div className="flex flex-wrap gap-2">
                          {(viewingJob.optional_skills || []).length > 0 ? (
                            viewingJob.optional_skills.map((skill, index) => (
                              <span key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-100 shadow-sm">
                                {typeof skill === 'string' ? skill : skill.name || JSON.stringify(skill)}
                              </span>
                            ))
                          ) : (
                            <p className="text-xs font-semibold text-slate-400">No optional skills listed.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">Job Summary</h4>
                    <div className="space-y-3 text-xs text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 font-semibold">Status</span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider border ${
                          viewingJob.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          viewingJob.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {viewingJob.status || 'pending'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 font-semibold">
                        <span className="text-slate-400">Work type</span>
                        <span className="text-slate-800 capitalize">{viewingJob.work_type || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 font-semibold">
                        <span className="text-slate-400">Min experience</span>
                        <span className="text-slate-800">{viewingJob.min_experience_years ?? 'N/A'} years</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 font-semibold">
                        <span className="text-slate-400">Min CGPA</span>
                        <span className="text-slate-800">{viewingJob.min_cgpa ?? 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 font-semibold">
                        <span className="text-slate-400">Created</span>
                        <span className="text-slate-800">{viewingJob.created_at ? new Date(viewingJob.created_at).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 font-semibold">
                        <span className="text-slate-400">Expires</span>
                        <span className="text-slate-800">{viewingJob.expires_at ? new Date(viewingJob.expires_at).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                  </section>
 
                  {viewingJob.metadata && (
                    <section className="rounded-2xl border border-slate-100 bg-slate-50/40 p-5">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Metadata</h4>
                      <div className="space-y-2 text-xs text-slate-700 font-semibold">
                        <p><span className="text-slate-400">Tags:</span> {(viewingJob.metadata.tags || []).join(', ') || 'None'}</p>
                        <p><span className="text-slate-400">Popularity:</span> {viewingJob.metadata.popularity ?? 0}</p>
                      </div>
                    </section>
                  )}
                </aside>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-white">
              {viewingJob.rejection_reason && (
                <p className="mr-auto text-xs font-bold text-rose-600">
                  Rejection reason: {viewingJob.rejection_reason}
                </p>
              )}
              {editingMode ? (
                <>
                  <button
                    onClick={cancelEditJob}
                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitEditJob}
                    className="btn-primary-sm !px-4 !py-2 !text-xs !rounded-xl shadow-md shadow-primary-500/10"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEditJob}
                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleDisable(viewingJob)}
                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                  >
                    {viewingJob.status === 'rejected' ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    onClick={() => handleForceReview(viewingJob)}
                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                  >
                    Force Review
                  </button>
                  <button
                    onClick={closeJobDetails}
                    className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {rejectingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeRejectModal} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Reject job posting</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {rejectingJob.title} · {rejectingJob.company}
                </p>
              </div>
              <button
                onClick={closeRejectModal}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                aria-label="Close reject dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Rejection reason
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Explain why this posting was rejected"
              className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm mb-4"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={closeRejectModal}
                disabled={rejectSubmitting}
                className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRejectModal}
                disabled={rejectSubmitting}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-xs font-bold active:scale-95 duration-200"
              >
                {rejectSubmitting ? 'Rejecting...' : 'Reject Job'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {confirmAction && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeConfirmAction} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 w-full max-w-lg rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 relative overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Confirm action</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">{confirmAction.job?.title} · {confirmAction.job?.company}</p>
              </div>
              <button onClick={closeConfirmAction} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 animate-pulse" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mb-4 text-xs font-semibold text-slate-600 leading-relaxed">
              {confirmAction.type === 'disable' && 'Are you sure you want to disable this job? This will mark it as rejected.'}
              {confirmAction.type === 'enable' && 'Are you sure you want to enable this job? It will be marked as approved.'}
              {confirmAction.type === 'requeue' && 'Force this job back into the review queue? It will become pending again.'}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button onClick={closeConfirmAction} disabled={confirmAction.loading} className="btn-secondary-sm !px-4 !py-2 !text-xs !rounded-xl">
                Cancel
              </button>
              <button onClick={submitConfirmAction} disabled={confirmAction.loading} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-bold active:scale-95 duration-200">
                {confirmAction.loading ? 'Processing...' : confirmAction.type === 'requeue' ? 'Requeue' : confirmAction.type === 'enable' ? 'Enable' : 'Disable'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
