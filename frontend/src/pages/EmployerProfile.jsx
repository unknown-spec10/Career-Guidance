import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Building2, MapPin, Phone, Globe, Calendar, Save, AlertTriangle, CheckCircle, Edit2, X, Briefcase } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { sanitizeText } from '../utils/sanitize'

export default function EmployerProfile() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [employer, setEmployer] = useState(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    company_name: '',
    company_description: '',
    company_website: '',
    location: '',
    contact_phone: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const [userResponse, employerResponse] = await Promise.all([
        api.get('/api/auth/me'),
        api.get('/api/employer/profile')
      ])
      
      setUser(userResponse.data)
      setEmployer(employerResponse.data)
      
      setFormData({
        full_name: userResponse.data.full_name || '',
        email: userResponse.data.email || '',
        company_name: employerResponse.data.company_name || '',
        company_description: employerResponse.data.company_description || '',
        company_website: employerResponse.data.company_website || '',
        location: employerResponse.data.location || '',
        contact_phone: employerResponse.data.contact_phone || '',
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load profile')
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // Update basic user info
      await api.patch('/api/auth/profile', {
        full_name: sanitizeText(formData.full_name)
      })

      // Update employer-specific info
      await api.patch('/api/employer/profile', {
        company_name: sanitizeText(formData.company_name),
        company_description: sanitizeText(formData.company_description),
        company_website: formData.company_website,
        location: sanitizeText(formData.location),
        contact_phone: formData.contact_phone
      })

      // Update password if provided
      if (formData.new_password) {
        if (formData.new_password !== formData.confirm_password) {
          throw new Error('Passwords do not match')
        }
        if (formData.new_password.length < 8) {
          throw new Error('Password must be at least 8 characters')
        }
        if (!formData.current_password) {
          throw new Error('Current password is required to set new password')
        }

        await api.patch('/api/auth/change-password', {
          current_password: formData.current_password,
          new_password: formData.new_password
        })
      }

      // Refresh data
      await fetchProfile()
      
      toast.success('Profile updated successfully!')
      setEditing(false)
      setFormData({
        ...formData,
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (err) {
      const errorMsg = err.message || err.response?.data?.detail || 'Failed to update profile'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setFormData({
      full_name: user?.full_name || '',
      email: user?.email || '',
      company_name: employer?.company_name || '',
      company_description: employer?.company_description || '',
      company_website: employer?.company_website || '',
      location: employer?.location || '',
      contact_phone: employer?.contact_phone || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    })
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Employer Profile</h1>
          <p className="text-gray-400">Manage your company information and account settings</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          {/* Profile Header */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <Building2 className="w-10 h-10 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{employer?.company_name || 'Company'}</h2>
                <p className="text-gray-400 flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>{user?.email}</span>
                </p>
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="space-y-6">
              {/* Account Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <User className="w-5 h-5 text-primary-400" />
                  <span>Account Information</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Contact Name</label>
                    <input
                      type="text"
                      disabled={!editing}
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="input w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={formData.email}
                      className="input w-full opacity-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {user?.is_verified ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 text-sm">Verified Account</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <span className="text-yellow-400 text-sm">Not Verified</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-gray-400 text-sm">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-primary-400" />
                  <span>Company Information</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Company Name *</label>
                    <input
                      type="text"
                      disabled={!editing}
                      required
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="input w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Company Description</label>
                    <textarea
                      disabled={!editing}
                      value={formData.company_description}
                      onChange={(e) => setFormData({ ...formData, company_description: e.target.value })}
                      className="input w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      rows="4"
                      placeholder="Brief description of your company"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Company Website</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="url"
                          disabled={!editing}
                          value={formData.company_website}
                          onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                          className="input w-full pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Contact Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="tel"
                          disabled={!editing}
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                          className="input w-full pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        disabled={!editing}
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="input w-full pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="City, State/Country"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              {editing && (
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <Lock className="w-5 h-5 text-primary-400" />
                    <span>Change Password (Optional)</span>
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Current Password</label>
                      <input
                        type="password"
                        value={formData.current_password}
                        onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                        className="input w-full"
                        placeholder="Enter current password"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">New Password</label>
                        <input
                          type="password"
                          value={formData.new_password}
                          onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                          className="input w-full"
                          placeholder="Min 8 characters"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          value={formData.confirm_password}
                          onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                          className="input w-full"
                          placeholder="Confirm password"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {editing && (
                <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors flex items-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              )}
            </div>
          </form>
        </motion.div>
      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
