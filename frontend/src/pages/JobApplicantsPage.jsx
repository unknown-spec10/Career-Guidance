import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, User, Calendar, FileText, CheckCircle, 
  XCircle, Clock, ChevronDown, AlertTriangle, Sparkles
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import ScrollToTop from '../components/ScrollToTop'

export default function JobApplicantsPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [job, setJob] = useState(null)
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCoverLetter, setSelectedCoverLetter] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [activeTab, setActiveTab] = useState('top')

  useEffect(() => {
    fetchData()
  }, [jobId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch job details
      const jobRes = await api.get(`/api/employer/jobs/${jobId}`)
      setJob(jobRes.data?.job)

      // Fetch applicants
      const appRes = await api.get(`/api/employer/jobs/${jobId}/applicants`)
      const fetched = appRes.data?.applicants || []
      setApplicants(fetched)

      // Auto-set active tab to the first one that has applicants
      const topCount = fetched.filter(app => (app.match_score ?? 0) >= 85).length
      const potCount = fetched.filter(app => (app.match_score ?? 0) >= 60 && (app.match_score ?? 0) < 85).length
      
      if (topCount > 0) {
        setActiveTab('top')
      } else if (potCount > 0) {
        setActiveTab('potential')
      } else if (fetched.length > 0) {
        setActiveTab('low')
      }
    } catch (err) {
      console.error('Error loading applicants:', err)
      setError(err.response?.data?.detail || 'Failed to load applicants')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (applicationId, newStatus) => {
    setUpdatingId(applicationId)
    try {
      await api.patch(`/api/employer/applications/${applicationId}/status`, { status: newStatus })
      toast.success(`Application status updated to ${newStatus}`)
      
      // Update local state
      setApplicants(prev => prev.map(app => 
        app.application_id === applicationId ? { ...app, status: newStatus } : app
      ))
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to update status'
      toast.error(errorMsg)
    } finally {
      setUpdatingId(null)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'applied':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'interviewing':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'offered':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const topMatches = applicants.filter(app => (app.match_score ?? 0) >= 85)
  const potentialFits = applicants.filter(app => (app.match_score ?? 0) >= 60 && (app.match_score ?? 0) < 85)
  const lowAlignment = applicants.filter(app => (app.match_score ?? 0) < 60)

  const getFilteredApplicants = () => {
    switch (activeTab) {
      case 'top':
        return topMatches
      case 'potential':
        return potentialFits
      case 'low':
        return lowAlignment
      default:
        return topMatches
    }
  }

  const filteredApplicants = getFilteredApplicants()

  const getScoreBadgeStyles = (score) => {
    const s = score ?? 0
    if (s >= 85) {
      return 'bg-gradient-to-r from-emerald-500 to-teal-650 text-white shadow-emerald-500/10'
    } else if (s >= 60) {
      return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/10'
    } else {
      return 'bg-gradient-to-r from-rose-500 to-red-650 text-white shadow-rose-500/10'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading applicants...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="card max-w-md text-center p-8">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => navigate('/employer/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
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
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/employer/dashboard')}
            className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition-colors duration-200 mb-4 font-bold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-white/40 opacity-70" />
            <div className="relative">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                Applicants for <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-primary-950">{job?.title}</span>
              </h1>
              <p className="text-slate-600 text-xs font-semibold">{job?.location_city} • {job?.work_type} • <span className="text-primary-650">{applicants.length} Total {applicants.length === 1 ? 'Applicant' : 'Applicants'}</span></p>
            </div>
          </div>
        </motion.div>

        {/* Automated Candidate Tiering (Tabs) */}
        {applicants.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-100 pb-4">
            <button
              onClick={() => setActiveTab('top')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'top'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <span>Top Matches (85%+)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'top' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {topMatches.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('potential')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'potential'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/10'
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <span>Potential Fits (60-84%)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'potential' ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {potentialFits.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('low')}
              className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'low'
                  ? 'bg-slate-700 text-white shadow-md shadow-slate-700/10'
                  : 'bg-white border border-slate-200 text-slate-650 hover:bg-slate-50'
              }`}
            >
              <span>Low Alignment (&lt;60%)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'low' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {lowAlignment.length}
              </span>
            </button>
          </div>
        )}

        {/* Applicants List */}
        {applicants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
          >
            <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">No Applicants Yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto text-sm font-semibold">
              As soon as students apply to this position, their profile and applications will appear here.
            </p>
          </motion.div>
        ) : filteredApplicants.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl p-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
          >
            <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-1">No Applicants in this Tier</h3>
            <p className="text-slate-500 max-w-sm mx-auto text-sm font-semibold">
              {activeTab === 'top' && "No Top Matches Yet. Keep sourcing or review Potential Fits!"}
              {activeTab === 'potential' && "No Potential Fits in this score range."}
              {activeTab === 'low' && "No Low Alignment applicants. Everything looks highly relevant!"}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            {filteredApplicants.map((app, idx) => (
              <motion.div
                key={app.application_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-5 md:p-6 border border-slate-100 bg-white/90 backdrop-blur-sm rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_15px_35px_rgba(15,23,42,0.05)] hover:border-slate-200 hover:-translate-y-0.5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  {/* Left Column: Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-50 border border-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{app.applicant_name}</h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide shadow-sm ${getScoreBadgeStyles(app.match_score)}`}>
                            {Math.round(app.match_score)}% Match
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-bold mt-1">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Applied: {new Date(app.applied_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI Match Card */}
                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[10px] font-extrabold tracking-wide uppercase text-slate-400">Key Reasons for Match</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-semibold pl-5">
                          {app.match_reasons}
                        </p>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] font-extrabold tracking-wide uppercase text-slate-400">Skill Gaps / Discrepancies</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-semibold pl-5">
                          {app.skill_gaps}
                        </p>
                      </div>
                    </div>

                    {app.cover_letter && (
                      <button
                        onClick={() => setSelectedCoverLetter(app)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100/70 border border-primary-100 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 duration-200"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary-500" />
                        <span>View Cover Letter</span>
                      </button>
                    )}
                  </div>

                  {/* Middle Column: Status Badge */}
                  <div className="flex items-center">
                    <span className={`inline-flex items-center border px-3 py-1 rounded-full text-xs font-bold capitalize shadow-sm ${getStatusColor(app.status)}`}>
                      {app.status}
                    </span>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => navigate(`/applicant/${app.applicant_id}`)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all active:scale-95 duration-200 shadow-sm"
                    >
                      View Resume Profile
                    </button>

                    <div className="relative group">
                      <button
                        disabled={updatingId === app.application_id}
                        className="px-4 py-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl disabled:opacity-50 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 duration-200"
                      >
                        <span>Change Status</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-20 overflow-hidden">
                        {['applied', 'interviewing', 'offered', 'accepted', 'rejected'].map(status => (
                          <button
                            key={status}
                            onClick={() => handleUpdateStatus(app.application_id, status)}
                            className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 capitalize font-bold first:pt-3 last:pb-3 border-b border-slate-50 last:border-b-0"
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>

      {/* Cover Letter Modal */}
      <AnimatePresence>
        {selectedCoverLetter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCoverLetter(null)}
            className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-slate-100 bg-white/95 backdrop-blur shadow-2xl p-6 md:p-8 space-y-4"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600">Cover Letter</p>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    From {selectedCoverLetter.applicant_name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedCoverLetter(null)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-slate-350 hover:text-slate-750 hover:bg-slate-50 transition-colors flex-shrink-0"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto bg-slate-50/50 p-5 border border-slate-100 rounded-2xl">
                {selectedCoverLetter.cover_letter}
              </p>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedCoverLetter(null)}
                  className="w-full md:w-auto px-6 py-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-xl font-bold text-xs text-slate-700 transition-colors active:scale-95 duration-200"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollToTop />
    </div>
  )
}
