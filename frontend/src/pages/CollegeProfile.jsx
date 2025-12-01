import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Lock, GraduationCap, MapPin, Phone, Globe, Calendar, Save, AlertTriangle, CheckCircle, Edit2, X, Building } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { sanitizeText } from '../utils/sanitize'

export default function CollegeProfile() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [college, setCollege] = useState(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    college_name: '',
    college_description: '',
    college_website: '',
    location_city: '',
    location_state: '',
    contact_phone: '',
    contact_email: '',
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
      const [userResponse, collegeResponse] = await Promise.all([
        api.get('/api/auth/me'),
        api.get('/api/college/profile')
      ])
      
      setUser(userResponse.data)
      setCollege(collegeResponse.data)
      
      setFormData({
        full_name: userResponse.data.full_name || '',
        email: userResponse.data.email || '',
        college_name: collegeResponse.data.name || '',
        college_description: collegeResponse.data.description || '',
        college_website: collegeResponse.data.website || '',
        location_city: collegeResponse.data.location_city || '',
        location_state: collegeResponse.data.location_state || '',
        contact_phone: collegeResponse.data.contact_phone || '',
        contact_email: collegeResponse.data.contact_email || '',
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

      // Update college-specific info
      await api.patch('/api/college/profile', {
        name: sanitizeText(formData.college_name),
        description: sanitizeText(formData.college_description),
        website: formData.college_website,
        location_city: sanitizeText(formData.location_city),
        location_state: sanitizeText(formData.location_state),
        contact_phone: formData.contact_phone,
        contact_email: formData.contact_email
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
      college_name: college?.name || '',
      college_description: college?.description || '',
      college_website: college?.website || '',
      location_city: college?.location_city || '',
      location_state: college?.location_state || '',
      contact_phone: college?.contact_phone || '',
      contact_email: college?.contact_email || '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    })
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">College Profile</h1>
          <p className="text-gray-400">Manage your institution information and account settings</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          {/* Profile Header */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-dark-700">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center">
                <GraduationCap className="w-10 h-10 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{college?.name || 'College'}</h2>
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
                    <label className="block text-sm font-medium mb-2">Contact Person Name</label>
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
                    <label className="block text-sm font-medium mb-2">Account Email</label>
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

              {/* College Information */}
              <div className="pt-6 border-t border-dark-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5 text-primary-400" />
                  <span>Institution Information</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">College/University Name *</label>
                    <input
                      type="text"
                      disabled={!editing}
                      required
                      value={formData.college_name}
                      onChange={(e) => setFormData({ ...formData, college_name: e.target.value })}
                      className="input w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter college name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      disabled={!editing}
                      value={formData.college_description}
                      onChange={(e) => setFormData({ ...formData, college_description: e.target.value })}
                      className="input w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      rows="4"
                      placeholder="Brief description of your institution"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">City</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          disabled={!editing}
                          value={formData.location_city}
                          onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                          className="input w-full pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="City"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">State/Province</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          disabled={!editing}
                          value={formData.location_state}
                          onChange={(e) => setFormData({ ...formData, location_state: e.target.value })}
                          className="input w-full pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="State or Province"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Official Website</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="url"
                        disabled={!editing}
                        value={formData.college_website}
                        onChange={(e) => setFormData({ ...formData, college_website: e.target.value })}
                        className="input w-full pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="https://college.edu"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div>
                      <label className="block text-sm font-medium mb-2">Public Contact Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          disabled={!editing}
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          className="input w-full pl-10 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="admissions@college.edu"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              {editing && (
                <div className="pt-6 border-t border-dark-700">
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
                <div className="flex items-center justify-end space-x-3 pt-6 border-t border-dark-700">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 border border-dark-600 rounded-lg hover:border-dark-500 transition-colors flex items-center space-x-2"
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
