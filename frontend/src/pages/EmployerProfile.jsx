import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Building2, MapPin, Phone, Globe, Calendar, Save, AlertTriangle, CheckCircle, Edit2, X, Briefcase, Eye, EyeOff } from 'lucide-react'
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

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
      
      // prefer server values, but fall back to locally-stored user (from login) for missing fields
      const serverUser = userResponse.data || {}
      const serverEmployer = employerResponse.data || {}
      const storedUser = secureStorage.getItem('user') || {}

      setUser(serverUser)
      setEmployer(serverEmployer)

      setFormData({
        full_name: serverUser.full_name || storedUser.full_name || '',
        email: serverUser.email || storedUser.email || '',
        company_name: serverEmployer.company_name || '',
        company_description: serverEmployer.company_description || '',
        company_website: serverEmployer.company_website || '',
        location: serverEmployer.location || '',
        contact_phone: serverEmployer.contact_phone || '',
        current_password: '',
        new_password: '',
        confirm_password: ''
      })

      // If no name was provided by the server or during login, open edit mode so user can fill it in
      if (!serverUser.full_name && !storedUser.full_name) {
        setEditing(true)
      }
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

      // keep local stored user in sync so other pages show updated name immediately
      try {
        secureStorage.setItem('user', { full_name: sanitizeText(formData.full_name), email: formData.email || user?.email, role: user?.role || 'employer' })
      } catch (e) {
        // ignore storage failures
      }

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
    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-white/40 opacity-70" />
          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700 mb-3">
                <Building2 className="w-3.5 h-3.5" />
                Settings
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
                  Employer Profile
                </span>
              </h1>
              <p className="text-gray-600">Manage your company information and account settings</p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl hover:from-primary-700 hover:to-indigo-700 transition-all shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 active:scale-95 duration-200 font-semibold text-sm"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
        >
          {/* Profile Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/10 shadow-inner">
                <Building2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{employer?.company_name || 'Company Name'}</h2>
                <p className="text-slate-500 flex items-center space-x-2 text-sm mt-0.5 font-medium">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{user?.email}</span>
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center space-x-2 text-rose-700 font-medium text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="space-y-8">
              {/* Account Information */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 md:p-6">
                <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center space-x-2">
                  <User className="w-4 h-4 text-primary-500" />
                  <span>Account Information</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Name</label>
                    <input
                      type="text"
                      disabled={!editing}
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={formData.email}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
                    />
                    <p className="text-[10px] font-bold text-slate-400 mt-1.5">Email cannot be changed</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 flex-wrap gap-3">
                  <div className="flex items-center space-x-2">
                    {user?.is_verified ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <span className="text-emerald-600 text-sm font-semibold">Verified Account</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="text-amber-600 text-sm font-semibold">Not Verified</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400 text-xs font-bold">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 md:p-6">
                <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-primary-500" />
                  <span>Company Information</span>
                </h3>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company Name *</label>
                    <input
                      type="text"
                      disabled={!editing}
                      required
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company Description</label>
                    <textarea
                      disabled={!editing}
                      value={formData.company_description}
                      onChange={(e) => setFormData({ ...formData, company_description: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      rows="4"
                      placeholder="Brief description of your company"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company Website</label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="url"
                          disabled={!editing}
                          value={formData.company_website}
                          onChange={(e) => setFormData({ ...formData, company_website: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          disabled={!editing}
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        disabled={!editing}
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                        placeholder="City, State/Country"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              {editing && (
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 md:p-6">
                  <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-primary-500" />
                    <span>Change Password (Optional)</span>
                  </h3>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={formData.current_password}
                          onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={formData.new_password}
                            onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                            className="w-full bg-white border border-slate-200 pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 rounded-xl"
                            placeholder="Min 8 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={formData.confirm_password}
                            onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                            className="w-full bg-white border border-slate-200 pl-4 pr-10 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-700 rounded-xl"
                            placeholder="Confirm password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {editing && (
                <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-700 font-semibold text-sm active:scale-95 duration-200"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all active:scale-95 duration-200 text-sm"
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
