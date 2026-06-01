import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Briefcase, Users, Eye, CheckCircle, XCircle, 
  Clock, AlertTriangle, LogOut, X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'
import ScrollToTop from '../components/ScrollToTop'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import secureStorage from '../utils/secureStorage'

export default function EmployerDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    approvedJobs: 0,
    totalApplicants: 0
  })
  const [jobs, setJobs] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalJob, setModalJob] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState(null)

  const handleLogout = () => {
    secureStorage.clear()
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
      const jobsData = response.data?.jobs || []

      setJobs(jobsData)
      setStats({
        totalJobs: jobsData.length,
        pendingJobs: jobsData.filter(j => j.status === 'pending').length,
        approvedJobs: jobsData.filter(j => j.status === 'approved').length,
        totalApplicants: jobsData.reduce((sum, j) => sum + (j.applicant_count || 0), 0)
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
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Approved</span>
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
            <XCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </span>
        )
      default:
        return null
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-white/40 opacity-70" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700 mb-3">
                <Briefcase className="w-3.5 h-3.5" />
                Employer workspace
              </div>
              <div className="flex items-center space-x-3 mb-2">
                <Briefcase className="w-8 h-8 text-primary-500" />
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
                    Employer Dashboard
                  </span>
                </h1>
              </div>
              <p className="text-gray-600 max-w-xl">Manage your job postings and applicants</p>
            </div>
          </div>
        </motion.div>

        {/* Job Details Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
                <div>
                  <div className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 mb-3">
                    Active Job Profile
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 leading-tight">
                    {modalLoading ? 'Loading...' : modalJob?.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-800 shadow-sm">
                      {modalJob?.location_city}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-slate-100 bg-slate-50/50 px-3 py-1 text-slate-600 text-xs capitalize">
                      {modalJob?.work_type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setModalOpen(false); setModalJob(null) }}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-colors flex-shrink-0"
                  aria-label="Close job details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {modalError}
                </div>
              )}

              <div className="space-y-6">
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{modalJob?.description}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Min Experience</p>
                    <p className="font-semibold text-slate-800 text-sm">{modalJob?.min_experience_years} years</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Min CGPA Requirement</p>
                    <p className="font-semibold text-slate-800 text-sm">{modalJob?.min_cgpa ?? 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-2">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {(modalJob?.required_skills || []).map((s, idx) => (
                      <span key={idx} className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold shadow-sm">
                        {typeof s === 'string' ? s : s.name || JSON.stringify(s)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <button onClick={() => { setModalOpen(false); setModalJob(null) }} className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-95 duration-200">
                    Close
                  </button>
                  <button
                    disabled={modalLoading}
                    onClick={() => { if (modalJob?.id) navigate(`/employer/jobs/${modalJob.id}/applicants`) }}
                    className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 duration-200"
                  >
                    View Applicants
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { title: 'Total Jobs', value: stats.totalJobs, icon: Briefcase, color: 'slate', textCol: 'text-slate-600', bgCol: 'bg-slate-50', borderCol: 'border-slate-100' },
            { title: 'Pending Review', value: stats.pendingJobs, icon: Clock, color: 'amber', textCol: 'text-amber-600', bgCol: 'bg-amber-50/50', borderCol: 'border-amber-100' },
            { title: 'Approved', value: stats.approvedJobs, icon: CheckCircle, color: 'emerald', textCol: 'text-emerald-600', bgCol: 'bg-emerald-50/50', borderCol: 'border-emerald-100' },
            { title: 'Total Applicants', value: stats.totalApplicants, icon: Users, color: 'primary', textCol: 'text-primary-600', bgCol: 'bg-primary-50/50', borderCol: 'border-primary-100' }
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

        {/* Jobs List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
          className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary-500" />
              Your Job Postings
            </h2>
            {jobs.length > 0 && (
              <span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1">
                Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, jobs.length)} of {jobs.length}
              </span>
            )}
          </div>
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 mb-4 font-semibold">No job postings yet</p>
              <button
                onClick={() => navigate('/employer/post-job')}
                className="px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 duration-200"
              >
                Post Your First Job
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {jobs.slice((page - 1) * pageSize, page * pageSize).map((job, idx) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 bg-white rounded-2xl border border-slate-100 transition-all hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between mb-3 gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-base text-slate-900 mb-1">{job.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                          <span>{job.location_city} • {job.work_type}</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-100">
                            {job.applicant_count || 0} {job.applicant_count === 1 ? 'applicant' : 'applicants'}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-2">{job.description}</p>
                    <div className="flex items-center justify-between text-xs border-t border-slate-50 pt-4 flex-wrap gap-3">
                      <span className="text-slate-400 font-semibold">
                        Posted: {new Date(job.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {job.status === 'approved' && (
                          <button
                            onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary-200 hover:bg-primary-50 text-primary-700 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
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
                              const errorMsg = err.response?.data?.detail || 'Failed to load job details'
                              setModalError(errorMsg)
                              toast.error(errorMsg)
                            } finally {
                              setModalLoading(false)
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all text-xs font-bold active:scale-95 duration-200"
                        >
                          <span>Details</span>
                        </button>
                      </div>
                    </div>
                    {job.status === 'rejected' && job.rejection_reason && (
                      <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-xs font-medium text-red-700">
                        <strong>Rejection reason:</strong> {job.rejection_reason}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              
              {/* Pagination */}
              {Math.ceil(jobs.length / pageSize) > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400 text-xs font-semibold">
                    Page {page} of {Math.ceil(jobs.length / pageSize)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(jobs.length / pageSize), p + 1))}
                    disabled={page === Math.ceil(jobs.length / pageSize)}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
        <ScrollToTop />
      </div>
    </div>
  )
}
