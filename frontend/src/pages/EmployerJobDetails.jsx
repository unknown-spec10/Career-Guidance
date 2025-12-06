import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, LogOut } from 'lucide-react'
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

  if (loading) return <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center"><div className="text-gray-600">Loading...</div></div>
  if (error) return (<div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center"><div className="card max-w-md"><AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" /><p className="text-center text-gray-600">{error}</p></div></div>)

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{job?.title}</h1>
              <p className="text-sm text-gray-400">{job?.location_city} • {job?.work_type}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Status</div>
              <div className="font-medium">{job?.status}</div>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm text-gray-400 mb-2">Description</h3>
            <div className="text-sm text-gray-200 whitespace-pre-wrap">{job?.description}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-400">Min Experience</p>
              <p className="font-medium">{job?.min_experience_years}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Min CGPA</p>
              <p className="font-medium">{job?.min_cgpa ?? 'N/A'}</p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {(job?.required_skills || []).map((s, idx) => (
                <span key={idx} className="px-2 py-1 text-xs rounded border border-gray-300 bg-gray-100 text-gray-900">{s.name || s}</span>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => navigate('/employer/dashboard')} className="px-4 py-2 border border-gray-300 rounded text-gray-900 hover:bg-gray-100">Back</button>
            <button onClick={() => navigate(`/employer/jobs/${jobId}/applicants`)} className="btn-primary">View Applicants</button>
          </div>
        </div>
      </div>
    </div>
  )
}
