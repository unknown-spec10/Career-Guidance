import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, Building2, Search, Plus, CheckCircle, XCircle, 
  Clock, AlertTriangle, Eye, ExternalLink, ArrowLeft,
  RefreshCw, ChevronDown, ChevronUp, Globe, MapPin, FileText
} from 'lucide-react'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function AdminCollegeCollection() {
  const navigate = useNavigate()
  const toast = useToast()
  
  // Status dashboard data
  const [collectionStatus, setCollectionStatus] = useState({
    total_colleges: 0,
    draft: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    awaiting_approval: 0
  })
  
  // Pending colleges list
  const [pendingColleges, setPendingColleges] = useState([])
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  
  // Form state
  const [showForm, setShowForm] = useState(false)
  const [selectedCollege, setSelectedCollege] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    location_city: '',
    location_state: '',
    country: 'India',
    description: '',
    website: '',
    eligibility: {
      min_jee_rank: '',
      min_jee_rank_source: '',
      min_cgpa: '',
      min_cgpa_source: '',
      seats: '',
      seats_source: ''
    },
    programs: [{ 
      program_name: '', 
      duration_months: 48, 
      program_description: '',
      program_description_source: ''
    }],
    notes_for_reviewer: ''
  })
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [expandedPending, setExpandedPending] = useState(null)

  useEffect(() => {
    fetchCollectionStatus()
    fetchPendingColleges()
  }, [])

  const fetchCollectionStatus = async () => {
    try {
      const response = await api.get('/api/admin/colleges/status')
      setCollectionStatus(response.data)
    } catch (err) {
      console.error('Failed to fetch status:', err)
    }
  }

  const fetchPendingColleges = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/admin/colleges/pending')
      setPendingColleges(response.data.colleges || [])
    } catch (err) {
      toast.error('Failed to load pending colleges')
    } finally {
      setLoading(false)
    }
  }

  // Search for existing colleges or external sources
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    try {
      setSearching(true)
      // Search existing colleges in DB
      const response = await api.get(`/api/colleges?search=${encodeURIComponent(searchQuery)}&limit=10`)
      setSearchResults(response.data.colleges || [])
      
      if (response.data.colleges?.length === 0) {
        toast.info('No existing colleges found. You can add a new one.')
      }
    } catch (err) {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  // Pre-fill form with existing college data for update
  const handleSelectCollege = (college) => {
    setSelectedCollege(college)
    setFormData({
      name: college.name || '',
      location_city: college.location_city || '',
      location_state: college.location_state || '',
      country: college.country || 'India',
      description: college.description || '',
      website: college.website || '',
      eligibility: {
        min_jee_rank: college.eligibility?.min_jee_rank || '',
        min_jee_rank_source: '',
        min_cgpa: college.eligibility?.min_cgpa || '',
        min_cgpa_source: '',
        seats: college.eligibility?.seats || '',
        seats_source: ''
      },
      programs: college.programs?.length > 0 
        ? college.programs.map(p => ({
            program_name: p.program_name || '',
            duration_months: p.duration_months || 48,
            program_description: p.description || '',
            program_description_source: ''
          }))
        : [{ program_name: '', duration_months: 48, program_description: '', program_description_source: '' }],
      notes_for_reviewer: ''
    })
    setShowForm(true)
    setSearchResults([])
    setSearchQuery('')
  }

  // Start fresh form for new college
  const handleNewCollege = () => {
    setSelectedCollege(null)
    setFormData({
      name: searchQuery || '',
      location_city: '',
      location_state: '',
      country: 'India',
      description: '',
      website: '',
      eligibility: {
        min_jee_rank: '',
        min_jee_rank_source: '',
        min_cgpa: '',
        min_cgpa_source: '',
        seats: '',
        seats_source: ''
      },
      programs: [{ program_name: '', duration_months: 48, program_description: '', program_description_source: '' }],
      notes_for_reviewer: ''
    })
    setShowForm(true)
    setSearchResults([])
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEligibilityChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      eligibility: { ...prev.eligibility, [field]: value }
    }))
  }

  const handleProgramChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      programs: prev.programs.map((p, i) => 
        i === index ? { ...p, [field]: value } : p
      )
    }))
  }

  const addProgram = () => {
    setFormData(prev => ({
      ...prev,
      programs: [...prev.programs, { program_name: '', duration_months: 48, program_description: '', program_description_source: '' }]
    }))
  }

  const removeProgram = (index) => {
    if (formData.programs.length > 1) {
      setFormData(prev => ({
        ...prev,
        programs: prev.programs.filter((_, i) => i !== index)
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name.trim()) {
      toast.error('College name is required')
      return
    }
    if (!formData.location_city.trim() || !formData.location_state.trim()) {
      toast.error('Location is required')
      return
    }
    
    try {
      setSubmitting(true)
      
      // Build payload
      const payload = {
        name: formData.name,
        location_city: formData.location_city,
        location_state: formData.location_state,
        country: formData.country,
        description: formData.description || null,
        website: formData.website || null,
        eligibility: {
          min_jee_rank: formData.eligibility.min_jee_rank ? parseInt(formData.eligibility.min_jee_rank) : null,
          min_jee_rank_source: formData.eligibility.min_jee_rank_source || null,
          min_cgpa: formData.eligibility.min_cgpa ? parseFloat(formData.eligibility.min_cgpa) : null,
          min_cgpa_source: formData.eligibility.min_cgpa_source || null,
          seats: formData.eligibility.seats ? parseInt(formData.eligibility.seats) : null,
          seats_source: formData.eligibility.seats_source || null
        },
        programs: formData.programs
          .filter(p => p.program_name.trim())
          .map(p => ({
            program_name: p.program_name,
            duration_months: parseInt(p.duration_months),
            program_description: p.program_description || null,
            program_description_source: p.program_description_source || null
          })),
        data_sources: [],
        notes_for_reviewer: formData.notes_for_reviewer || null
      }
      
      // Use update endpoint if editing existing
      const endpoint = selectedCollege 
        ? `/api/admin/colleges/update/${selectedCollege.id}`
        : '/api/admin/colleges/submit'
      
      const response = await api.post(endpoint, payload)
      
      toast.success(response.data.message || 'College submitted for approval!')
      setShowForm(false)
      setSelectedCollege(null)
      
      // Refresh data
      await Promise.all([fetchCollectionStatus(), fetchPendingColleges()])
      
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit college data')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (collegeId) => {
    try {
      setActionLoading(`approve-${collegeId}`)
      await api.post(`/api/admin/colleges/approve/${collegeId}`)
      toast.success('College approved and verified!')
      
      // Update local state
      setPendingColleges(prev => prev.filter(c => c.id !== collegeId))
      await fetchCollectionStatus()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (collegeId) => {
    const reason = prompt('Enter rejection reason:')
    if (reason === null) return
    
    try {
      setActionLoading(`reject-${collegeId}`)
      await api.post(`/api/admin/colleges/reject/${collegeId}`, null, {
        params: { reason }
      })
      toast.success('College rejected')
      
      // Update local state
      setPendingColleges(prev => prev.filter(c => c.id !== collegeId))
      await fetchCollectionStatus()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Rejection failed')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            to="/admin/dashboard"
            className="flex items-center space-x-2 text-gray-600 hover:text-primary-600 transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>
          <div className="flex items-center space-x-3 mb-2">
            <Building2 className="w-8 h-8 text-primary-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">College Data Collection</h1>
          </div>
          <p className="text-gray-600">Search, add, and verify college information with source attribution</p>
        </motion.div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total', value: collectionStatus.total_colleges, color: 'blue' },
            { label: 'Draft', value: collectionStatus.draft, color: 'gray' },
            { label: 'Pending', value: collectionStatus.awaiting_approval, color: 'yellow' },
            { label: 'Approved', value: collectionStatus.approved, color: 'green' },
            { label: 'Rejected', value: collectionStatus.rejected, color: 'red' }
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-white rounded-xl p-4 border-2 border-${stat.color}-200 shadow-sm`}
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-600`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8"
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <Search className="w-5 h-5 text-primary-500" />
            <span>Search & Add College</span>
          </h2>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a college by name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {searching ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              <span>Search</span>
            </button>
            <button
              onClick={handleNewCollege}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add New</span>
            </button>
          </div>

          {/* Search Results */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border-t border-gray-200 pt-4"
              >
                <p className="text-sm text-gray-500 mb-3">Found {searchResults.length} existing college(s):</p>
                <div className="space-y-3">
                  {searchResults.map((college) => (
                    <div 
                      key={college.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-900">{college.name}</h3>
                        <p className="text-sm text-gray-500 flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{college.location_city}, {college.location_state}</span>
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/college/${college.id}`}
                          target="_blank"
                          className="p-2 text-gray-500 hover:text-primary-500"
                        >
                          <Eye className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleSelectCollege(college)}
                          className="px-4 py-2 bg-primary-500 text-white text-sm rounded-lg hover:bg-primary-600"
                        >
                          Update Data
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleNewCollege}
                  className="mt-4 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-500 transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add as New College Instead</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* College Submission Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  <span>{selectedCollege ? 'Update College Data' : 'Add New College'}</span>
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">College Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      value={formData.location_city}
                      onChange={(e) => handleInputChange('location_city', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <input
                      type="text"
                      value={formData.location_state}
                      onChange={(e) => handleInputChange('location_state', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Eligibility Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-yellow-500" />
                    <span>Eligibility Criteria</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minimum JEE Rank</label>
                      <input
                        type="number"
                        value={formData.eligibility.min_jee_rank}
                        onChange={(e) => handleEligibilityChange('min_jee_rank', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        JEE Rank Source URL
                        <Globe className="w-4 h-4 inline ml-1 text-gray-400" />
                      </label>
                      <input
                        type="url"
                        value={formData.eligibility.min_jee_rank_source}
                        onChange={(e) => handleEligibilityChange('min_jee_rank_source', e.target.value)}
                        placeholder="https://josaa.nic.in/..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Minimum CGPA</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={formData.eligibility.min_cgpa}
                        onChange={(e) => handleEligibilityChange('min_cgpa', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CGPA Source URL
                        <Globe className="w-4 h-4 inline ml-1 text-gray-400" />
                      </label>
                      <input
                        type="url"
                        value={formData.eligibility.min_cgpa_source}
                        onChange={(e) => handleEligibilityChange('min_cgpa_source', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Available Seats</label>
                      <input
                        type="number"
                        value={formData.eligibility.seats}
                        onChange={(e) => handleEligibilityChange('seats', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seats Source URL
                        <Globe className="w-4 h-4 inline ml-1 text-gray-400" />
                      </label>
                      <input
                        type="url"
                        value={formData.eligibility.seats_source}
                        onChange={(e) => handleEligibilityChange('seats_source', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Programs Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium flex items-center space-x-2">
                      <Building2 className="w-5 h-5 text-blue-500" />
                      <span>Programs</span>
                    </h3>
                    <button
                      type="button"
                      onClick={addProgram}
                      className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-sm hover:bg-blue-200"
                    >
                      + Add Program
                    </button>
                  </div>
                  
                  {formData.programs.map((program, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500">Program {idx + 1}</span>
                        {formData.programs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeProgram(idx)}
                            className="text-red-500 text-sm hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Program Name</label>
                          <input
                            type="text"
                            value={program.program_name}
                            onChange={(e) => handleProgramChange(idx, 'program_name', e.target.value)}
                            placeholder="B.Tech Computer Science"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Duration (months)</label>
                          <input
                            type="number"
                            value={program.duration_months}
                            onChange={(e) => handleProgramChange(idx, 'duration_months', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-600 mb-1">Description</label>
                          <input
                            type="text"
                            value={program.program_description}
                            onChange={(e) => handleProgramChange(idx, 'program_description', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-600 mb-1">
                            Source URL
                            <Globe className="w-4 h-4 inline ml-1 text-gray-400" />
                          </label>
                          <input
                            type="url"
                            value={program.program_description_source}
                            onChange={(e) => handleProgramChange(idx, 'program_description_source', e.target.value)}
                            placeholder="https://college.edu/programs/..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes for Reviewer</label>
                  <textarea
                    value={formData.notes_for_reviewer}
                    onChange={(e) => handleInputChange('notes_for_reviewer', e.target.value)}
                    rows={2}
                    placeholder="Any additional context for the reviewer..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {submitting && <RefreshCw className="w-5 h-5 animate-spin" />}
                    <span>Submit for Approval</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Approvals Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <span>Pending Approvals</span>
              {pendingColleges.length > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full">
                  {pendingColleges.length}
                </span>
              )}
            </h2>
            <button
              onClick={fetchPendingColleges}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : pendingColleges.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-500">No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingColleges.map((college) => (
                <div 
                  key={college.id}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedPending(expandedPending === college.id ? null : college.id)}
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">{college.name}</h3>
                      <p className="text-sm text-gray-500">{college.location}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Submitted: {new Date(college.submitted_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(college.id); }}
                        disabled={actionLoading === `approve-${college.id}`}
                        className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 flex items-center space-x-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(college.id); }}
                        disabled={actionLoading === `reject-${college.id}`}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 flex items-center space-x-1"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                      {expandedPending === college.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedPending === college.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Min JEE Rank</p>
                            <p className="font-medium">{college.min_jee_rank || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Min CGPA</p>
                            <p className="font-medium">{college.min_cgpa || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Seats</p>
                            <p className="font-medium">{college.seats || '-'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Programs</p>
                            <p className="font-medium">{college.programs_count || 0}</p>
                          </div>
                        </div>
                        {college.notes_for_reviewer && (
                          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              <strong>Reviewer Notes:</strong> {college.notes_for_reviewer}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
