import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, LogOut, Briefcase } from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function EmployerJobDetails(){
  const { jobId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [job, setJob] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDetails = async () => {
      try{
        setLoading(true)
        const res = await api.get(`/api/employer/jobs/${jobId}`)
        setJob(res.data.job)
        setMetadata(res.data.metadata)
      } catch (err){
        const errorMsg = err.response?.data?.detail || 'Failed to load job details'
        setError(errorMsg)
        toast.error(errorMsg)
      } finally {
        setLoading(false)
      }
    }
    fetchDetails()
  }, [jobId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-24 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-650">Loading details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 pt-24 flex items-center justify-center">
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
        >
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700 mb-3">
                <Briefcase className="w-3.5 h-3.5" />
                Job details
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{job?.title}</h1>
              <p className="text-xs text-slate-500 mt-1 font-semibold">{job?.location_city} • {job?.work_type}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Status</p>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                job?.status === 'approved' ? 'bg-green-50 border-green-200 text-green-700' :
                job?.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'
              }`}>
                {job?.status || 'pending'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Description</h4>
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{job?.description}</div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl mb-6">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Min Experience</p>
              <p className="font-semibold text-slate-800 text-sm">{job?.min_experience_years} years</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Min CGPA Requirement</p>
              <p className="font-semibold text-slate-800 text-sm">{job?.min_cgpa ?? 'N/A'}</p>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-bold text-slate-800 text-sm mb-3">Required Skills</h4>
            <div className="flex flex-wrap gap-2">
              {(job?.required_skills || []).map((s, idx) => (
                <span key={idx} className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-100 text-primary-750 text-xs font-bold shadow-sm">
                  {s.name || s}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => navigate('/employer/dashboard')}
              className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700 active:scale-95 duration-200 text-sm text-center"
            >
              Back
            </button>
            <button
              onClick={() => navigate(`/employer/jobs/${jobId}/applicants`)}
              className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 duration-200 text-sm"
            >
              View Applicants
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
