import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Lock, MapPin, Calendar, Save, AlertTriangle, CheckCircle, Edit2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { sanitizeText } from '../utils/sanitize'

export default function StudentProfile() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
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
      const response = await api.get('/api/auth/me')
      setUser(response.data)
      setFormData({
        full_name: response.data.full_name || '',
        email: response.data.email || '',
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
      const sanitizedName = sanitizeText(formData.full_name)
      
      // Update basic info
      await api.patch('/api/auth/profile', {
        full_name: sanitizedName
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

      // Update local storage
      const updatedUser = { ...user, full_name: sanitizedName }
      setUser(updatedUser)
      secureStorage.setItem('user', updatedUser)

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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">My Profile</h1>
          <p className="text-gray-400">Manage your account information and settings</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          {/* Profile Header */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-dark-700">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-primary-500/20 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-primary-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{user?.full_name || 'Student'}</h2>
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
            {/* Account Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <User className="w-5 h-5 text-primary-400" />
                  <span>Account Information</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Full Name</label>
                    <input
                      type="text"
                      disabled={!editing}
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="input w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter your full name"
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

                  <div>
                    <label className="block text-sm font-medium mb-2">Role</label>
                    <input
                      type="text"
                      disabled
                      value="Student"
                      className="input w-full opacity-50 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Account Status</label>
                    <div className="flex items-center space-x-2">
                      {user?.is_verified ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-400" />
                          <span className="text-green-400">Verified</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-yellow-400" />
                          <span className="text-yellow-400">Not Verified</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Member Since</label>
                    <div className="flex items-center space-x-2 text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Section - Only visible when editing */}
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

                    <div>
                      <label className="block text-sm font-medium mb-2">New Password</label>
                      <input
                        type="password"
                        value={formData.new_password}
                        onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                        className="input w-full"
                        placeholder="Enter new password (min 8 characters)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                        className="input w-full"
                        placeholder="Confirm new password"
                      />
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
