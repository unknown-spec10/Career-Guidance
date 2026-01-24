import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, Users, FileText, CheckCircle, XCircle, 
  Clock, PlusCircle, AlertTriangle, LogOut, User, X
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function CollegeDashboard() {
  const navigate = useNavigate()
  const toast = useToast()
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
  const [modalOpen, setModalOpen] = useState(false)
  const [modalFilter, setModalFilter] = useState('all') // 'all', 'pending', 'approved'

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

  const getFilteredPrograms = () => {
    if (modalFilter === 'all') return programs
    if (modalFilter === 'pending') return programs.filter(p => p.status === 'pending')
    if (modalFilter === 'approved') return programs.filter(p => p.status === 'approved')
    return programs
  }

  const openModal = (filter) => {
    setModalFilter(filter)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
  }

  // Modal Component
  const ProgramsModal = () => {
    const filteredPrograms = getFilteredPrograms()
    
    return (
      <>
        {/* Backdrop */}
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />
        )}
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={modalOpen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none ${
            modalOpen ? 'pointer-events-auto' : ''
          }`}
        >
          <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-900">
                {modalFilter === 'all' ? 'All Programs' : modalFilter === 'pending' ? 'Pending Programs' : 'Approved Programs'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 px-6 pt-4 border-b border-gray-200 flex-wrap">
              {[
                { value: 'all', label: 'All', count: programs.length },
                { value: 'pending', label: 'Pending', count: programs.filter(p => p.status === 'pending').length },
                { value: 'approved', label: 'Approved', count: programs.filter(p => p.status === 'approved').length }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setModalFilter(tab.value)}
                  className={`px-4 py-2 rounded-lg transition-colors mb-4 text-sm font-medium ${
                    modalFilter === tab.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              {filteredPrograms.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-gray-600">No programs found</p>
                </div>
              ) : (
                <div className="space-y-3 p-6">
                  {filteredPrograms.map((program) => (
                    <motion.div
                      key={program.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{program.program_name}</h3>
                        {getStatusBadge(program.status)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                        <div>
                          <p className="text-xs text-gray-500">Duration</p>
                          <p className="font-medium">{program.duration_months} months</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Status</p>
                          <p className="font-medium capitalize">{program.status}</p>
                        </div>
                      </div>
                      {program.program_description && (
                        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{program.program_description}</p>
                      )}
                      {program.required_skills && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-2">Required Skills</p>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(program.required_skills) ? program.required_skills : []).map((skill, idx) => (
                              <span key={idx} className="px-2 py-1 bg-primary-100 border border-primary-200 rounded text-xs text-primary-700">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 p-4 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </>
    )
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
      <ProgramsModal />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">College Dashboard</h1>
            <p className="text-gray-600">Manage your programs and applications</p>
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
              onClick={() => navigate('/college/profile')}
              className="flex items-center space-x-2 px-4 py-2 border border-primary-500/30 rounded-lg hover:bg-primary-900/20 transition-colors text-primary-400"
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">My Profile</span>
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
            className="card cursor-pointer hover:shadow-lg hover:border-primary-500/50 transition-all"
            onClick={() => openModal('all')}
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
            className="card cursor-pointer hover:shadow-lg hover:border-yellow-500/50 transition-all"
            onClick={() => openModal('pending')}
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
            className="card cursor-pointer hover:shadow-lg hover:border-green-500/50 transition-all"
            onClick={() => openModal('approved')}
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
                  <div key={program.id} className="p-3 bg-white rounded-lg border border-gray-200">
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
                  <div key={app.application_id} className="p-3 bg-white rounded-lg border border-gray-200">
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
