import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Briefcase, Users, Eye, CheckCircle, XCircle,
  Clock, AlertTriangle, X, Sparkles, TrendingUp, ArrowRight
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-bold border border-warning/20">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-bold border border-success/20">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Approved</span>
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error/10 text-error text-xs font-bold border border-error/20">
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
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white dark:bg-inverse-surface/10 p-6 rounded-2xl border border-error max-w-md text-center shadow-sm">
          <AlertTriangle className="w-12 h-12 text-error mx-auto mb-4" />
          <p className="text-on-surface dark:text-inverse-on-surface font-semibold">{error}</p>
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
          <h1 className="font-display-lg text-display-lg text-on-surface dark:text-inverse-on-surface mb-xs font-bold leading-tight">
            Recruitment Overview
          </h1>
          <p className="font-body-base text-body-base text-on-surface-variant dark:text-surface-variant">
            Analyze matches, review applicants, and manage your active job listings.
          </p>
        </div>
        <div>
          <Link
            to="/employer/post-job"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white dark:text-on-primary-container dark:bg-primary-container rounded-lg font-body-bold text-[14px] hover:bg-primary-500 hover:shadow-lg active:scale-95 duration-150 transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Post a New Job
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
        {[
          { title: 'Total Listings', value: stats.totalJobs, icon: Briefcase, textCol: 'text-primary dark:text-primary-fixed-dim', bgCol: 'bg-primary/5 dark:bg-primary/10', borderCol: 'border-primary/10' },
          { title: 'Under Review', value: stats.pendingJobs, icon: Clock, textCol: 'text-warning', bgCol: 'bg-warning/5 dark:bg-warning/10', borderCol: 'border-warning/10' },
          { title: 'Approved Roles', value: stats.approvedJobs, icon: CheckCircle, textCol: 'text-success', bgCol: 'bg-success/5 dark:bg-success/10', borderCol: 'border-success/10' },
          { title: 'Total Applicants', value: stats.totalApplicants, icon: Users, textCol: 'text-purple-600 dark:text-purple-400', bgCol: 'bg-purple-500/5 dark:bg-purple-500/10', borderCol: 'border-purple-500/10' }
        ].map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="border border-border-subtle dark:border-outline-variant/30 bg-white dark:bg-inverse-surface/5 rounded-xl p-md soft-shadow flex items-center justify-between"
          >
            <div>
              <p className="font-metadata text-[12px] font-bold text-on-surface-variant dark:text-surface-variant uppercase tracking-wider mb-1">{stat.title}</p>
              <p className={`font-label-caps text-3xl font-extrabold ${stat.textCol}`}>{stat.value}</p>
            </div>
            <div className={`p-2.5 rounded-lg ${stat.bgCol} ${stat.textCol} border ${stat.borderCol}`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
        
        {/* Main Jobs List (8/12 width) */}
        <div className="lg:col-span-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="border border-border-subtle dark:border-outline-variant/30 bg-white dark:bg-inverse-surface/5 rounded-xl p-lg soft-shadow"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-on-surface dark:text-inverse-on-surface flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                Active Job Postings
              </h2>
              {jobs.length > 0 && (
                <span className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant bg-surface-container-low dark:bg-surface-variant/40 rounded-lg px-2.5 py-1">
                  Page {page} of {Math.ceil(jobs.length / pageSize) || 1}
                </span>
              )}
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-on-surface-variant dark:text-surface-variant mb-4 font-semibold">No job postings created yet</p>
                <Link
                  to="/employer/post-job"
                  className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold transition-all shadow-md hover:bg-primary-500 text-xs cursor-pointer"
                >
                  Create Your First Listing
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.slice((page - 1) * pageSize, page * pageSize).map((job, idx) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-md bg-white dark:bg-inverse-surface/10 rounded-xl border border-border-subtle dark:border-outline-variant/20 transition-all hover:shadow-[0_10px_25px_rgba(0,0,0,0.02)] hover:border-slate-200"
                  >
                    <div className="flex items-start justify-between mb-2 gap-4">
                      <div>
                        <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">{job.title}</h3>
                        <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant mt-0.5">
                          {job.location_city} • {job.work_type}
                        </p>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>
                    
                    <p className="text-[13px] text-on-surface-variant dark:text-surface-variant leading-relaxed line-clamp-2 mb-4">
                      {job.description}
                    </p>

                    <div className="flex items-center justify-between text-xs border-t border-border-subtle dark:border-outline-variant/10 pt-3 flex-wrap gap-2">
                      <span className="text-[11px] text-slate-400 font-semibold">
                        Posted: {new Date(job.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {job.status === 'approved' && (
                          <button
                            onClick={() => navigate(`/employer/jobs/${job.id}/applicants`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-blue-100 text-primary-600 dark:text-primary-600 rounded-lg text-[12px] font-bold transition-all active:scale-95 duration-150 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Applicants ({job.applicant_count || 0})</span>
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
                              const errorMsg = err.response?.data?.detail || 'Failed to load details'
                              setModalError(errorMsg)
                              toast.error(errorMsg)
                            } finally {
                              setModalLoading(false)
                            }
                          }}
                          className="btn-secondary-sm inline-flex items-center gap-1.5 !px-3 !py-1.5 !rounded-lg text-[12px] font-bold cursor-pointer"
                        >
                          <span>Review Specs</span>
                        </button>
                      </div>
                    </div>

                    {job.status === 'rejected' && job.rejection_reason && (
                      <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 text-[11px] font-bold text-red-700">
                        <strong>Rejection Reason:</strong> {job.rejection_reason}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {Math.ceil(jobs.length / pageSize) > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-6 pt-4 border-t border-border-subtle dark:border-outline-variant/20">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary-sm !px-3.5 !py-1.5 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
                >
                  Previous
                </button>
                <span className="text-slate-400 text-xs font-semibold">
                  {page} / {Math.ceil(jobs.length / pageSize)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(jobs.length / pageSize), p + 1))}
                  disabled={page === Math.ceil(jobs.length / pageSize)}
                  className="btn-primary-sm !px-3.5 !py-1.5 !rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
                >
                  Next
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Sidebar Info Pane (4/12 width) */}
        <div className="lg:col-span-4 flex flex-col gap-lg">
          
          {/* AI Talent Intelligence Tips */}
          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow">
            <div className="flex items-center gap-sm mb-md">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface">Recruiter Analytics</h3>
            </div>
            <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant leading-relaxed mb-md">
              Our parsing engine automatically maps candidates' skill clusters against your job requirements. Ensure your listing requirements match specific skills (e.g. <code className="font-mono text-primary font-bold">Python</code>, <code className="font-mono text-primary font-bold">React</code>) to improve ATS alignment.
            </p>
            <Link
              to="/employer/post-job"
              className="w-full py-2 bg-surface-container-low dark:bg-surface-variant/40 hover:bg-primary hover:text-white text-primary rounded-lg font-body-bold text-[13px] transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
            >
              Post Another Spec
            </Link>
          </div>

          {/* Quick Help Guide */}
          <div className="bg-white dark:bg-inverse-surface/5 border border-border-subtle dark:border-outline-variant/30 rounded-xl p-md soft-shadow">
            <h3 className="font-body-bold text-[15px] font-bold text-on-surface dark:text-inverse-on-surface mb-xs">Job Visibility Rules</h3>
            <p className="font-metadata text-[12px] text-on-surface-variant dark:text-surface-variant leading-relaxed">
              Jobs are approved automatically or reviewed by admins. To appear publicly in student recommendation searches, the status must show as <strong className="text-success">Approved</strong>.
            </p>
          </div>

        </div>

      </div>

      {/* Spec Details Modal */}
      <AnimatePresence>
        {modalOpen && modalJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => { setModalOpen(false); setModalJob(null) }}>
            <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-border-subtle bg-white dark:bg-inverse-surface backdrop-blur shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle dark:border-outline-variant/30 pb-4 mb-6">
                <div>
                  <div className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
                    Requirements Spec
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-inverse-on-surface leading-tight">
                    {modalJob.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-white dark:bg-inverse-surface px-2.5 py-0.5 font-semibold text-slate-800 dark:text-slate-300 shadow-sm">
                      {modalJob.location_city}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-50 dark:bg-inverse-surface/30 px-2.5 py-0.5 text-slate-600 dark:text-slate-400 capitalize">
                      {modalJob.work_type}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setModalOpen(false); setModalJob(null) }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-50/50 dark:bg-inverse-surface/20 border border-slate-100 dark:border-outline-variant/20 rounded-xl p-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Description</h4>
                  <div className="text-xs text-slate-750 dark:text-slate-300 leading-relaxed">
                    {modalJob.description ? (
                      <ReactMarkdown components={jobMarkdownComponents}>
                        {modalJob.description}
                      </ReactMarkdown>
                    ) : (
                      'No description provided.'
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 dark:bg-inverse-surface/20 border border-slate-100 dark:border-outline-variant/20 rounded-xl">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1">Min Experience</p>
                    <p className="font-bold text-slate-850 dark:text-white text-xs">{modalJob.min_experience_years} Years</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider mb-1">Min CGPA Requirement</p>
                    <p className="font-bold text-slate-850 dark:text-white text-xs">{modalJob.min_cgpa ?? 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-850 dark:text-white text-xs mb-2">Required Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(modalJob.required_skills || []).map((s, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary dark:text-primary-fixed-dim text-[11px] font-bold">
                        {typeof s === 'string' ? s : s.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-border-subtle dark:border-outline-variant/30">
                  <button onClick={() => { setModalOpen(false); setModalJob(null) }} className="btn-secondary-sm flex-1 !py-2.5 !text-xs !rounded-xl cursor-pointer">
                    Close
                  </button>
                  <button
                    onClick={() => { if (modalJob.id) navigate(`/employer/jobs/${modalJob.id}/applicants`) }}
                    className="btn-primary-sm flex-1 !py-2.5 !text-xs !rounded-xl shadow-md cursor-pointer"
                  >
                    View Applicants
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
