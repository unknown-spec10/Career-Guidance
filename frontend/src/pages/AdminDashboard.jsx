import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Shield, Briefcase, CheckCircle, XCircle, 
  Clock, AlertTriangle, TrendingUp, Search, Coins, Plus, Minus, X
} from 'lucide-react'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

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
  const [applicantQuery, setApplicantQuery] = useState('')
  const [applicants, setApplicants] = useState([])
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

  useEffect(() => {
    fetchOverviewStats()
    fetchPendingReviews()
    fetchApplicants()
    fetchAllJobs()
  }, [])

  useEffect(() => {
    if (activeTab === 'all-jobs' && allJobs.length === 0) {
      fetchAllJobs()
    }
  }, [activeTab])

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

  const fetchApplicants = async () => {
    try {
      const response = await api.get('/api/applicants?limit=200')
      const list = response.data?.applicants || []
      setApplicants(list)
    } catch (err) {
      // Keep review page usable even if applicants lookup fails.
      setApplicants([])
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

  const filteredApplicants = applicants.filter((applicant) => {
    const query = applicantQuery.trim().toLowerCase()
    if (!query) return true
    const name = (applicant.display_name || '').toLowerCase()
    const applicantId = (applicant.applicant_id || '').toLowerCase()
    return name.includes(query) || applicantId.includes(query) || String(applicant.id).includes(query)
  })

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
    setCreditAmount('')
    setCreditReason('')
    try {
      const creditResponse = await api.get(`/api/admin/credits/applicant/${applicant.id}`)
      setSelectedApplicantCredits(creditResponse.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch applicant credits')
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
    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />

      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-yellow-50/40 opacity-70" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 mb-4">
                <Shield className="w-3.5 h-3.5" />
                Admin workspace
              </div>
              <div className="flex items-center space-x-3 mb-2">
                <Shield className="w-8 h-8 text-yellow-500 animate-pulse" />
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
                    Admin Management
                  </span>
                </h1>
              </div>
              <p className="text-gray-600 max-w-xl">One place for overview, job moderation, and applicant management.</p>
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

          <div className="relative mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'jobs', label: 'Job Reviews' },
              { id: 'all-jobs', label: 'All Jobs' },
              { id: 'applicants', label: 'Applicants' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => navigate(`/admin/dashboard?tab=${tab.id}`)}
                className={`px-4 py-2 rounded-xl transition-all duration-200 text-sm font-bold ${activeTab === tab.id ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                {tab.label}
              </button>
            ))}
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
          {/* Pending Jobs */}
          {activeTab === 'jobs' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 4 }}
              className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
            >
              <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary-500" />
                  <span>Pending Job Postings</span>
                </h2>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-700">
                  {pendingJobs.length} awaiting review
                </span>
              </div>
              {pendingJobs.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-slate-500 font-semibold">No pending jobs found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingJobs.map((job) => (
                    <div key={job.id} className="p-5 bg-white rounded-2xl border border-slate-100 transition-all hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 hover:-translate-y-0.5">
                      <div className="flex items-start justify-between mb-4 gap-4">
                        <div>
                          <h3 className="font-bold text-base text-slate-900 mb-1">{job.title}</h3>
                          <p className="text-sm font-semibold text-slate-500">{job.company}</p>
                          <p className="text-xs text-slate-400 mt-1 font-semibold">
                            Posted: {new Date(job.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                      </div>
                      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap border-t border-slate-50 pt-4">
                        <button
                          onClick={() => openJobDetails(job)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200"
                        >
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <span>Details</span>
                        </button>
                        
                        <div className="flex items-center gap-2 flex-1 md:flex-none">
                          <button
                            onClick={() => handleJobReview(job.id, 'approve')}
                            disabled={actionLoading === `job-${job.id}`}
                            className="flex-1 py-2 px-3 bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 duration-200"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => openRejectModal(job)}
                            disabled={actionLoading === `job-${job.id}`}
                            className="flex-1 py-2 px-3 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 rounded-xl transition-all text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 duration-200"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

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

          {/* Applicant Management */}
          {activeTab === 'applicants' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
              className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
            >
              <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary-500" />
                  <span>All Applicants</span>
                </h2>
                <p className="text-xs font-semibold text-slate-400">Search applicants and manage credits from one place.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Search Applicant</label>
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={applicantQuery}
                      onChange={(e) => setApplicantQuery(e.target.value)}
                      placeholder="Name, applicant_id, or DB id"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                    />
                  </div>
                  <div className="max-h-52 overflow-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
                    {filteredApplicants.slice(0, 20).map((applicant) => (
                      <button
                        key={applicant.id}
                        onClick={() => handleSelectApplicant(applicant)}
                        className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors ${selectedApplicant?.id === applicant.id ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <p className="font-bold text-sm text-slate-800">{applicant.display_name || `Applicant #${applicant.id}`}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{applicant.applicant_id || `DB ID: ${applicant.id}`}</p>
                      </button>
                    ))}
                    {filteredApplicants.length === 0 && (
                      <p className="px-4 py-4 text-xs font-semibold text-slate-400 text-center">No applicants found.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Selected Applicant</label>
                  <div className="mb-4 p-4 border border-slate-200 rounded-2xl bg-gradient-to-br from-slate-50/40 via-white to-slate-50/10">
                    {selectedApplicant ? (
                      <>
                        <p className="font-bold text-slate-800 text-sm">{selectedApplicant.display_name || `Applicant #${selectedApplicant.id}`}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{selectedApplicant.applicant_id || `DB ID: ${selectedApplicant.id}`}</p>
                        <p className="text-xs font-bold text-slate-500 mt-3 flex items-center gap-1.5">
                          Remaining Credits:
                          <span className="text-sm font-black text-primary-600 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-100">
                            {selectedApplicantCredits?.current_credits ?? '--'}
                          </span>
                        </p>
                      </>
                    ) : (
                      <p className="text-xs font-semibold text-slate-400">Pick an applicant from the list.</p>
                    )}
                  </div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adjustment Amount</label>
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setCreditAmount('-10')}
                      className="px-3.5 py-2.5 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition-all font-bold text-sm active:scale-95 duration-200"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="Use + for add, - for deduct"
                      className="flex-1 w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setCreditAmount('10')}
                      className="px-3.5 py-2.5 border border-emerald-200 text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all font-bold text-sm active:scale-95 duration-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audit Reason</label>
                  <textarea
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    rows={3}
                    placeholder="Provide audit description for allocation/deallocation"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm mb-4"
                  />

                  <button
                    onClick={handleCreditAdjustment}
                    disabled={creditLoading}
                    className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creditLoading ? 'Applying...' : 'Apply Credit Adjustment'}
                  </button>
                </div>
              </div>
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
            <div className="border-b border-slate-100 bg-gradient-to-br from-primary-50/40 via-white to-yellow-50/40 px-6 py-5">
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
                      <p className="whitespace-pre-wrap text-slate-700 text-sm leading-relaxed">
                        {viewJobLoading ? 'Loading...' : viewingJob.description || 'No description provided.'}
                      </p>
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
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitEditJob}
                    className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700 active:scale-95 duration-200 transition-all shadow-md shadow-primary-500/10"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEditJob}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleDisable(viewingJob)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
                  >
                    {viewingJob.status === 'rejected' ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    onClick={() => handleForceReview(viewingJob)}
                    className="rounded-xl border border-primary-100 px-4 py-2 text-xs font-bold text-primary-700 hover:bg-primary-50 active:scale-95 duration-200 transition-all"
                  >
                    Force Review
                  </button>
                  <button
                    onClick={closeJobDetails}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-95 duration-200 transition-all"
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
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
              <button onClick={closeConfirmAction} disabled={confirmAction.loading} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
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
