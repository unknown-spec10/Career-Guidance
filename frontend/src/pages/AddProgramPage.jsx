import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, ArrowLeft, Plus, X, AlertCircle } from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function AddProgramPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    program_name: '',
    duration_months: '',
    program_description: '',
    required_skills: []
  })
  const [skillInput, setSkillInput] = useState('')

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.required_skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, skillInput.trim()]
      })
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (index) => {
    setFormData({
      ...formData,
      required_skills: formData.required_skills.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.program_name || !formData.duration_months) {
      toast.addToast('Please fill in all required fields', 'error')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/college/programs', {
        program_name: formData.program_name,
        duration_months: parseInt(formData.duration_months),
        program_description: formData.program_description || null,
        required_skills: formData.required_skills.length > 0 
          ? formData.required_skills.map(skill => ({ name: skill }))
          : null
      })

      toast.addToast('Program submitted successfully! Awaiting admin approval.', 'success')
      setTimeout(() => navigate('/college/dashboard'), 1500)
    } catch (err) {
      toast.addToast(
        err.response?.data?.detail || 'Failed to create program',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/college/dashboard')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Add New Program</h1>
          <p className="text-gray-600">Create a new program for your institution (pending admin approval)</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-200">
            <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Program Details</h2>
              <p className="text-sm text-gray-600">All programs require admin approval before going live</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Program Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Program Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.program_name}
                onChange={(e) => setFormData({ ...formData, program_name: e.target.value })}
                className="input w-full"
                placeholder="e.g., B.Tech in Computer Science"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Duration (Months) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.duration_months}
                onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
                className="input w-full"
                placeholder="e.g., 48 for 4 years"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter duration in months (e.g., 48 for 4 years, 24 for 2 years)
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Program Description
              </label>
              <textarea
                value={formData.program_description}
                onChange={(e) => setFormData({ ...formData, program_description: e.target.value })}
                className="input w-full"
                rows="5"
                placeholder="Provide a detailed description of the program, curriculum highlights, career prospects, etc."
              />
            </div>

            {/* Required Skills */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Required Skills (Optional)
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSkill()
                    }
                  }}
                  className="input flex-1"
                  placeholder="Enter a skill and press Enter or click Add"
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>

              {formData.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.required_skills.map((skill, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-2 px-3 py-1 bg-primary-500/20 border border-primary-500/30 rounded-full text-sm"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(index)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Program Review Process</p>
                <p>Your program will be reviewed by our admin team. You'll be notified once it's approved and visible to students.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/college/dashboard')}
                className="btn-secondary flex-1"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting...</span>
                  </span>
                ) : (
                  'Submit Program'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
