import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Shield, Briefcase, CheckCircle, XCircle, 
  Clock, AlertTriangle, TrendingUp, LogOut, ArrowLeft, Search, Coins, Plus, Minus
} from 'lucide-react'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import secureStorage from '../utils/secureStorage'

export default function AdminReviewsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [stats, setStats] = useState({
    pendingJobs: 0,
    totalPending: 0
  })
  const [pendingJobs, setPendingJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [applicantQuery, setApplicantQuery] = useState('')
  const [applicants, setApplicants] = useState([])
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [selectedApplicantCredits, setSelectedApplicantCredits] = useState(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditReason, setCreditReason] = useState('')
  const [creditLoading, setCreditLoading] = useState(false)

  const handleLogout = () => {
    secureStorage.clear()
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }

  useEffect(() => {
    fetchPendingReviews()
    fetchApplicants()
  }, [])

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
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <Link 
              to="/admin/dashboard"
              className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
            <div className="flex items-center space-x-3 mb-2">
              <Shield className="w-8 h-8 text-yellow-400" />
              <h1 className="text-3xl md:text-4xl font-bold">Pending Reviews</h1>
            </div>
            <p className="text-gray-600">Review and approve pending job postings</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Pending Jobs</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.pendingJobs}</p>
              </div>
              <Briefcase className="w-10 h-10 text-yellow-400 opacity-50" />
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
                <p className="text-sm text-gray-400 mb-1">Total Pending</p>
                <p className="text-3xl font-bold text-primary-400">{stats.totalPending}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-primary-400 opacity-50" />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Pending Jobs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 4 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Briefcase className="w-6 h-6 text-primary-400" />
              <span>Pending Job Postings</span>
            </h2>
            {pendingJobs.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600">No pending jobs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingJobs.map((job) => (
                  <div key={job.id} className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold mb-1">{job.title}</h3>
                        <p className="text-sm text-gray-600">{job.company}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Posted: {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleJobReview(job.id, 'approve')}
                        disabled={actionLoading === `job-${job.id}`}
                        className="flex-1 px-3 py-2 bg-green-900/20 border border-green-500/30 rounded hover:bg-green-900/30 transition-colors flex items-center justify-center space-x-1 text-sm text-green-400"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Rejection reason (optional):')
                          if (reason !== null) handleJobReview(job.id, 'reject', reason)
                        }}
                        disabled={actionLoading === `job-${job.id}`}
                        className="flex-1 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded hover:bg-red-900/30 transition-colors flex items-center justify-center space-x-1 text-sm text-red-400"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Quick Credit Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center space-x-2">
                <Coins className="w-6 h-6 text-primary-400" />
                <span>Applicant Credits</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Search Applicant</label>
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={applicantQuery}
                    onChange={(e) => setApplicantQuery(e.target.value)}
                    placeholder="Name, applicant_id, or DB id"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="max-h-52 overflow-auto border border-gray-200 rounded-lg">
                  {filteredApplicants.slice(0, 20).map((applicant) => (
                    <button
                      key={applicant.id}
                      onClick={() => handleSelectApplicant(applicant)}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 transition-colors ${selectedApplicant?.id === applicant.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                    >
                      <p className="font-medium text-gray-800">{applicant.display_name || `Applicant #${applicant.id}`}</p>
                      <p className="text-xs text-gray-500">{applicant.applicant_id || `DB ID: ${applicant.id}`}</p>
                    </button>
                  ))}
                  {filteredApplicants.length === 0 && (
                    <p className="px-3 py-4 text-sm text-gray-500">No applicants found.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Selected Applicant</label>
                <div className="mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                  {selectedApplicant ? (
                    <>
                      <p className="font-medium text-gray-800">{selectedApplicant.display_name || `Applicant #${selectedApplicant.id}`}</p>
                      <p className="text-xs text-gray-500">{selectedApplicant.applicant_id || `DB ID: ${selectedApplicant.id}`}</p>
                      <p className="text-sm text-gray-700 mt-2">
                        Remaining Credits:{' '}
                        <span className="font-semibold text-primary-600">
                          {selectedApplicantCredits?.current_credits ?? '--'}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Pick an applicant from the list.</p>
                  )}
                </div>

                <label className="block text-sm text-gray-600 mb-2">Amount</label>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setCreditAmount('-10')}
                    className="px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="Use + for add, - for deduct"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setCreditAmount('10')}
                    className="px-3 py-2 border border-green-200 text-green-600 rounded-lg hover:bg-green-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <label className="block text-sm text-gray-600 mb-2">Reason</label>
                <textarea
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  rows={3}
                  placeholder="Reason for allocation/deallocation"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                />

                <button
                  onClick={handleCreditAdjustment}
                  disabled={creditLoading}
                  className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {creditLoading ? 'Applying...' : 'Apply Credit Adjustment'}
                </button>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}
