import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Briefcase, Users, Eye, CheckCircle, XCircle, 
  Clock, PlusCircle, AlertTriangle, LogOut 
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'

export default function EmployerDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    approvedJobs: 0,
    totalApplicants: 0
  })
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalJob, setModalJob] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState(null)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/employer/jobs')
      const jobsData = response.data.jobs

      setJobs(jobsData)
      setStats({
        totalJobs: jobsData.length,
        pendingJobs: jobsData.filter(j => j.status === 'pending').length,
        approvedJobs: jobsData.filter(j => j.status === 'approved').length,
        totalApplicants: 0 // Would need separate endpoint to count
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-yellow-900/20 border border-yellow-500/30 rounded text-xs text-yellow-400">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        )
      case 'approved':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-green-900/20 border border-green-500/30 rounded text-xs text-green-400">
            <CheckCircle className="w-3 h-3" />
            <span>Approved</span>
          </span>
        )
      case 'rejected':
        return (
          <span className="flex items-center space-x-1 px-2 py-1 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-400">
            <XCircle className="w-3 h-3" />
            <span>Rejected</span>
          </span>
        )
      default:
        return null
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
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Employer Dashboard</h1>
            <p className="text-gray-400">Manage your job postings and applicants</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/employer/post-job')}
              className="btn-primary flex items-center space-x-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Post New Job</span>
              <span className="sm:hidden">Post Job</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </motion.div>
        {/* Job Details Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-3xl card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold">{modalLoading ? 'Loading...' : modalJob?.title}</h1>
                  <p className="text-sm text-gray-400">{modalJob?.location_city} • {modalJob?.work_type}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Status</div>
                  <div className="font-medium">{modalJob?.status}</div>
                </div>
              </div>

              {modalError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400">{modalError}</div>
              )}

              <div className="mb-4">
                <h3 className="text-sm text-gray-400 mb-2">Description</h3>
                <div className="text-sm text-gray-200 whitespace-pre-wrap">{modalJob?.description}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-400">Min Experience</p>
                  <p className="font-medium">{modalJob?.min_experience_years}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Min CGPA</p>
                  <p className="font-medium">{modalJob?.min_cgpa ?? 'N/A'}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Required Skills</p>
                <div className="flex flex-wrap gap-2">
                  {(modalJob?.required_skills || []).map((s, idx) => (
                    <span key={idx} className="px-2 py-1 text-xs rounded border border-dark-700 bg-dark-800">{typeof s === 'string' ? s : s.name || JSON.stringify(s)}</span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setModalOpen(false); setModalJob(null) }} className="px-4 py-2 border border-dark-600 rounded">Close</button>
                <button disabled={modalLoading} onClick={() => { if (modalJob?.id) navigate(`/employer/jobs/${modalJob.id}/applicants`) }} className="btn-primary">View Applicants</button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Jobs</p>
                <p className="text-3xl font-bold">{stats.totalJobs}</p>
              </div>
              <Briefcase className="w-10 h-10 text-primary-400 opacity-50" />
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
                <p className="text-sm text-gray-400 mb-1">Pending Review</p>
                <p className="text-3xl font-bold text-yellow-400">{stats.pendingJobs}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-400 opacity-50" />
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
                <p className="text-sm text-gray-400 mb-1">Approved</p>
                <p className="text-3xl font-bold text-green-400">{stats.approvedJobs}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-400 opacity-50" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 4 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Applicants</p>
                <p className="text-3xl font-bold">{stats.totalApplicants}</p>
              </div>
              <Users className="w-10 h-10 text-primary-400 opacity-50" />
            </div>
          </motion.div>
        </div>

        {/* Jobs List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
          className="card"
        >
          <h2 className="text-xl font-semibold mb-4">Your Job Postings</h2>
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No job postings yet</p>
              <button
                onClick={() => navigate('/employer/post-job')}
                className="btn-primary"
              >
                Post Your First Job
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job, idx) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{job.title}</h3>
                      <p className="text-sm text-gray-400">{job.location_city} • {job.work_type}</p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{job.description}</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-500">
                      Posted: {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    {job.status === 'approved' && (
                      <button
                        onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
                        className="flex items-center space-x-1 text-primary-400 hover:text-primary-300"
                      >
                        <Eye className="w-4 h-4" />
                        <span>View Applicants</span>
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        setModalError(null)
                        setModalLoading(true)
                        try {
                          const res = await api.get(`/api/employer/jobs/${job.id}`)
                          setModalJob(res.data.job)
                          setModalOpen(true)
                        } catch (err) {
                          setModalError(err.response?.data?.detail || 'Failed to load job details')
                        } finally {
                          setModalLoading(false)
                        }
                      }}
                      className="flex items-center space-x-1 text-gray-300 hover:text-white ml-3"
                    >
                      <span className="text-sm">Details</span>
                    </button>
                  </div>
                  {job.status === 'rejected' && job.rejection_reason && (
                    <div className="mt-3 p-2 bg-red-900/10 border border-red-500/20 rounded text-sm text-red-400">
                      <strong>Rejection reason:</strong> {job.rejection_reason}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
