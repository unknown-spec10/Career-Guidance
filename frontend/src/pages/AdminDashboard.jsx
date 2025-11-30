import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Shield, Briefcase, Building2, CheckCircle, XCircle, 
  Clock, AlertTriangle, TrendingUp, LogOut, ArrowLeft 
} from 'lucide-react'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'

export default function AdminReviewsPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    pendingJobs: 0,
    pendingPrograms: 0,
    totalPending: 0
  })
  const [pendingJobs, setPendingJobs] = useState([])
  const [pendingPrograms, setPendingPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }

  useEffect(() => {
    fetchPendingReviews()
  }, [])

  const fetchPendingReviews = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/admin/pending-reviews')
      
      setPendingJobs(response.data.pending_jobs)
      setPendingPrograms(response.data.pending_programs)
      setStats({
        pendingJobs: response.data.pending_jobs.length,
        pendingPrograms: response.data.pending_programs.length,
        totalPending: response.data.total_pending
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
      await fetchPendingReviews()
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleProgramReview = async (programId, action, reason = '') => {
    try {
      setActionLoading(`program-${programId}`)
      await api.patch(`/api/admin/programs/${programId}/review`, { action, reason })
      await fetchPendingReviews()
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <Link 
              to="/admin/dashboard"
              className="flex items-center space-x-2 text-gray-400 hover:text-primary-400 transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
            <div className="flex items-center space-x-3 mb-2">
              <Shield className="w-8 h-8 text-yellow-400" />
              <h1 className="text-3xl md:text-4xl font-bold">Pending Reviews</h1>
            </div>
            <p className="text-gray-400">Review and approve pending job postings and college programs</p>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                <p className="text-sm text-gray-400 mb-1">Pending Programs</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.pendingPrograms}</p>
              </div>
              <Building2 className="w-10 h-10 text-yellow-400 opacity-50" />
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
                <p className="text-sm text-gray-400 mb-1">Total Pending</p>
                <p className="text-3xl font-bold text-primary-400">{stats.totalPending}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-primary-400 opacity-50" />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                <p className="text-gray-400">No pending jobs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingJobs.map((job) => (
                  <div key={job.id} className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold mb-1">{job.title}</h3>
                        <p className="text-sm text-gray-400">{job.company}</p>
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

          {/* Pending Programs */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-primary-400" />
              <span>Pending College Programs</span>
            </h2>
            {pendingPrograms.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-400">No pending programs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPrograms.map((program) => (
                  <div key={program.id} className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold mb-1">{program.program_name}</h3>
                        <p className="text-sm text-gray-400">{program.college}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Posted: {new Date(program.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Clock className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleProgramReview(program.id, 'approve')}
                        disabled={actionLoading === `program-${program.id}`}
                        className="flex-1 px-3 py-2 bg-green-900/20 border border-green-500/30 rounded hover:bg-green-900/30 transition-colors flex items-center justify-center space-x-1 text-sm text-green-400"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Rejection reason (optional):')
                          if (reason !== null) handleProgramReview(program.id, 'reject', reason)
                        }}
                        disabled={actionLoading === `program-${program.id}`}
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
        </div>
      </div>
    </div>
  )
}
