import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, Users, FileText, CheckCircle, XCircle, 
  Clock, PlusCircle, AlertTriangle, LogOut 
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'

export default function CollegeDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalPrograms: 0,
    pendingPrograms: 0,
    approvedPrograms: 0,
    totalApplications: 0
  })
  const [programs, setPrograms] = useState([])
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
      const [programsRes, applicationsRes] = await Promise.all([
        api.get('/api/college/programs'),
        api.get('/api/college/applications')
      ])

      const programsData = programsRes.data.programs
      const applicationsData = applicationsRes.data.applications

      setPrograms(programsData)
      setApplications(applicationsData)
      setStats({
        totalPrograms: programsData.length,
        pendingPrograms: programsData.filter(p => p.status === 'pending').length,
        approvedPrograms: programsData.filter(p => p.status === 'approved').length,
        totalApplications: applicationsData.length
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
            <h1 className="text-3xl md:text-4xl font-bold mb-2">College Dashboard</h1>
            <p className="text-gray-400">Manage your programs and applications</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/college/add-program')}
              className="btn-primary flex items-center space-x-2"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Add Program</span>
              <span className="sm:hidden">Add</span>
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
                <p className="text-sm text-gray-400 mb-1">Total Programs</p>
                <p className="text-3xl font-bold">{stats.totalPrograms}</p>
              </div>
              <Building2 className="w-10 h-10 text-primary-400 opacity-50" />
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
                <p className="text-3xl font-bold text-yellow-400">{stats.pendingPrograms}</p>
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
                <p className="text-3xl font-bold text-green-400">{stats.approvedPrograms}</p>
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
                <p className="text-sm text-gray-400 mb-1">Applications</p>
                <p className="text-3xl font-bold">{stats.totalApplications}</p>
              </div>
              <Users className="w-10 h-10 text-primary-400 opacity-50" />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Programs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 5 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4">Your Programs</h2>
            {programs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No programs yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {programs.map((program) => (
                  <div key={program.id} className="p-3 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium">{program.program_name}</h3>
                      {getStatusBadge(program.status)}
                    </div>
                    <p className="text-sm text-gray-400">Duration: {program.duration_months} months</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Applications */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: ANIMATION_DELAYS.CARD_STAGGER * 6 }}
            className="card"
          >
            <h2 className="text-xl font-semibold mb-4">Recent Applications</h2>
            {applications.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No applications yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.slice(0, 5).map((app) => (
                  <div key={app.application_id} className="p-3 bg-dark-800 rounded-lg border border-dark-700">
                    <h3 className="font-medium mb-1">{app.applicant_name}</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">12th: {app.twelfth_percentage}%</span>
                      <span className="text-gray-400">{app.twelfth_board}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </span>
                      {getStatusBadge(app.status)}
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
