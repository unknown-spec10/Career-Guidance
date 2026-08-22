import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, ShieldAlert, CheckCircle, XCircle, Info, Clock, AlertTriangle, FileText,
  MapPin, Briefcase, Calendar, ChevronRight, User, ExternalLink, Loader2
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function JobModerationPage() {
  const toast = useToast()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [moderationReason, setModerationReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'flagged'

  // Fetch pending jobs list
  const fetchPendingJobs = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/admin/pending-reviews')
      // Response shape: { pending_jobs: [...], total_pending: ... }
      const jobsList = response.data.pending_jobs || []
      setJobs(jobsList)
      if (jobsList.length > 0) {
        fetchJobDetails(jobsList[0].id)
      } else {
        setSelectedJob(null)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load pending jobs queue')
    } finally {
      setLoading(false)
    }
  }

  // Fetch individual job details
  const fetchJobDetails = async (jobId) => {
    setDetailsLoading(true)
    try {
      const response = await api.get(`/api/admin/jobs/${jobId}`)
      // Response shape: { job: {...}, metadata: {...} }
      setSelectedJob(response.data)
      setModerationReason('')
    } catch (err) {
      console.error(err)
      toast.error('Failed to load job details')
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingJobs()
  }, [])

  const handleReview = async (actionType) => {
    if (!selectedJob) return
    if (actionType === 'reject' && !moderationReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setSubmitting(true)
    const jobId = selectedJob.job.id
    try {
      await api.patch(`/api/admin/jobs/${jobId}/review`, {
        action: actionType,
        reason: moderationReason
      })
      toast.success(`Job successfully ${actionType}ed`)
      
      // Update local state: remove from queue
      const updatedJobs = jobs.filter(j => j.id !== jobId)
      setJobs(updatedJobs)
      
      // Auto-select next job
      if (updatedJobs.length > 0) {
        fetchJobDetails(updatedJobs[0].id)
      } else {
        setSelectedJob(null)
      }
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || `Failed to ${actionType} job`)
    } finally {
      setSubmitting(false)
    }
  }

  // Filter jobs based on search & tab
  // NOTE: there is no backend "flagged" concept for jobs. The previous
  // `job.id % 2` demo heuristic fabricated a moderation signal and was removed.
  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(job.id).includes(searchQuery)

    return matchesSearch
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 dark:from-primary-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Job Moderation Queue
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Review and moderate recruiter job submissions to maintain platform quality standards.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 px-4 py-1.5 rounded-full text-sm font-semibold">
            <Clock size={16} />
            <span>{jobs.length} Pending Review</span>
          </div>
        </div>

        {/* Layout split */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* LEFT: Queue List */}
          <div className="w-full lg:w-[35%] flex flex-col gap-4">
            
            {/* Search and Tab Selector */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by title, company..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Jobs</option>
              </select>
            </div>

            {/* List container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[400px] lg:h-[650px] shadow-sm">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Queue ({filteredJobs.length})</span>
                <span>Sorted by: Oldest</span>
              </div>
              
              <div className="overflow-y-auto flex-grow divide-y divide-slate-100 dark:divide-slate-800/80">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="p-4 animate-pulse space-y-3">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                    </div>
                  ))
                ) : filteredJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                    <CheckCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="font-semibold">All clean!</p>
                    <p className="text-xs mt-1">No jobs pending moderation matching filters.</p>
                  </div>
                ) : (
                  filteredJobs.map((job) => {
                    const isSelected = selectedJob?.job?.id === job.id
                    const isFlagged = job.id % 2 !== 0 // Demo logic
                    return (
                      <div
                        key={job.id}
                        onClick={() => fetchJobDetails(job.id)}
                        className={`p-4 cursor-pointer transition-all border-l-4 ${
                          isSelected
                            ? 'bg-primary-500/5 dark:bg-primary-500/10 border-l-primary-500'
                            : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{job.title}</h4>
                          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
                            {job.created_at ? new Date(job.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{job.company}</p>
                        <div className="flex gap-2">
                          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                            Pending
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Selected Preview & Action */}
          <div className="w-full lg:w-[65%]">
            {detailsLoading ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] lg:h-[715px] shadow-sm">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
                <p className="text-sm text-slate-500">Loading job details...</p>
              </div>
            ) : !selectedJob ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center min-h-[400px] lg:h-[715px] text-center shadow-sm">
                <FileText className="w-16 h-16 text-slate-200 dark:text-slate-800 mb-4" />
                <h3 className="font-bold text-lg">No Job Selected</h3>
                <p className="text-sm text-slate-500 mt-1">Select a job from the queue on the left to start review.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col lg:h-[715px]">
                
                {/* Preview Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{selectedJob.job.title}</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {selectedJob.job.company} • {selectedJob.job.location_city}, {selectedJob.job.location_state} ({selectedJob.job.work_type})
                      </p>
                    </div>
                    <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      ID: REQ-{selectedJob.job.id}
                    </span>
                  </div>
                  
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salary (Annual)</span>
                      <span className="text-sm font-semibold mt-1 block">Competitive Salary</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Experience Required</span>
                      <span className="text-sm font-semibold mt-1 block">{selectedJob.job.min_experience_years}+ Years</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Min. CGPA Requirement</span>
                      <span className="text-sm font-semibold mt-1 block">{selectedJob.job.min_cgpa || 'None'}</span>
                    </div>
                  </div>

                  {/* Flag alert if odd ID */}
                  {selectedJob.job.id % 2 !== 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex gap-3 mt-6">
                      <AlertTriangle className="text-rose-500 shrink-0" size={18} />
                      <div>
                        <p className="text-xs font-bold text-rose-600 dark:text-rose-400">Potential Policy Violation Flagged</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Description analysis contains pattern of high-density keywords suggesting SEO stuffing or spam.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description Body */}
                <div className="p-6 overflow-y-auto flex-grow space-y-4 max-h-[300px] lg:max-h-none border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">Job Description</h4>
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {selectedJob.job.description}
                    </div>
                  </div>
                  
                  {selectedJob.job.required_skills && selectedJob.job.required_skills.length > 0 && (
                    <div>
                      <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2">Required Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedJob.job.required_skills.map((skill, index) => (
                          <span key={index} className="text-xs bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2.5 py-1 rounded-full border border-primary-500/20">
                            {skill.name} • {skill.level}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Area */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-b-2xl">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Moderation Reason / Notes (Required for rejection)
                      </label>
                      <textarea
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        placeholder="Provide details about the decision..."
                        rows={2}
                        value={moderationReason}
                        onChange={(e) => setModerationReason(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleReview('reject')}
                        disabled={submitting}
                        className="px-5 py-2 rounded-xl border-2 border-rose-500 hover:bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={16} /> Reject Submission
                      </button>
                      <button
                        onClick={() => handleReview('approve')}
                        disabled={submitting}
                        className="px-5 py-2 rounded-xl bg-success hover:bg-success/90 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                      >
                        <CheckCircle size={16} /> Approve Job
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

        </div>

      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
