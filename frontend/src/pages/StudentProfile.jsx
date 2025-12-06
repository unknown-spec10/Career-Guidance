import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Calendar, Save, AlertTriangle, CheckCircle, Shield, ArrowLeft, Briefcase, GraduationCap, Code, Award, Plus, X, Edit2, Upload } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState('profile')
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [editingResume, setEditingResume] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = React.useRef(null)
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  })
  const [resumeData, setResumeData] = useState({
    skills: [],
    education: [],
    experience: [],
    projects: [],
    certifications: []
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    fetchProfile()
    fetchResumeData()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/auth/me')
      setUser(response.data)
      setFormData({
        name: response.data.name || '',
        email: response.data.email || ''
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load profile')
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const fetchResumeData = async () => {
    try {
      const response = await api.get('/api/student/profile')
      console.log('📋 Profile API Response:', response.data)
      setProfile(response.data)

      console.log('Skills from API:', response.data.skills)
      console.log('Education from API:', response.data.education)
      console.log('Experience from API:', response.data.experience)

      setResumeData({
        skills: response.data.skills || [],
        education: response.data.education || [],
        experience: response.data.experience || [],
        projects: response.data.projects || [],
        certifications: response.data.certifications || []
      })
    } catch (err) {
      console.error('Failed to load resume data:', err)
    }
  }

  const handleSaveResumeData = async () => {
    try {
      setSaving(true)
      await api.put('/api/student/profile', resumeData)
      toast.success('Resume details updated successfully')
      setEditingResume(false)
      fetchResumeData()
    } catch (err) {
      toast.error('Failed to update resume details')
    } finally {
      setSaving(false)
    }
  }

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or Word document')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      const formData = new FormData()
      formData.append('file', file)

      // Upload with progress tracking
      const response = await api.post('/api/upload/resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 90000, // 90 seconds for upload + parsing
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(progress)
        }
      })

      toast.success('Resume uploaded successfully! Parsing in progress...')

      // Wait a bit for parsing to complete
      setTimeout(() => {
        fetchResumeData()
        toast.success('Resume parsed successfully!')
      }, 2000)

    } catch (error) {
      console.error('Upload error:', error)
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to upload resume'
      toast.error(errorMsg)
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const addSkill = () => {
    setResumeData({
      ...resumeData,
      skills: [...resumeData.skills, { name: '', proficiency: 'intermediate' }]
    })
  }

  const removeSkill = (index) => {
    setResumeData({
      ...resumeData,
      skills: resumeData.skills.filter((_, i) => i !== index)
    })
  }

  const updateSkill = (index, field, value) => {
    const newSkills = [...resumeData.skills]
    newSkills[index] = { ...newSkills[index], [field]: value }
    setResumeData({ ...resumeData, skills: newSkills })
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      setError('Full name is required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const sanitizedName = sanitizeText(formData.name)
      await api.patch('/api/auth/profile', { name: sanitizedName })

      toast.success('Profile updated successfully')
      setUser({ ...user, name: sanitizedName })

      const storedUser = secureStorage.getItem('user')
      if (storedUser) {
        storedUser.name = sanitizedName
        secureStorage.setItem('user', storedUser)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile')
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()

    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      setError('All password fields are required')
      return
    }

    if (passwordData.new_password.length < 8) {
      setError('New password must be at least 8 characters long')
      return
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match')
      return
    }

    try {
      setSaving(true)
      setError(null)

      await api.patch('/api/auth/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      })

      toast.success('Password changed successfully')
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password')
      toast.error('Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'resume', label: 'Resume Details', icon: Briefcase },
    { id: 'security', label: 'Security', icon: Shield }
  ]

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
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Account Settings</h1>
          <p className="text-gray-400">Manage your profile information and security settings</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="card p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setError(null)
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${activeTab === tab.id
                      ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Profile Summary Card */}
            <div className="card p-6 mt-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-1">{user?.name || 'Student'}</h3>
                <p className="text-sm text-gray-400 mb-3">{user?.email}</p>
                <div className="flex items-center justify-center space-x-2 text-sm">
                  {user?.is_verified ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Verified</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400">Unverified</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3"
          >
            <div className="card p-6 md:p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-red-400">{error}</span>
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">Profile Information</h2>
                    <p className="text-gray-400">Update your account details and personal information</p>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                          <User className="w-4 h-4 text-primary-400" />
                          <span>Full Name</span>
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="input w-full"
                          placeholder="Enter your full name"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>Email Address</span>
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          disabled
                          className="input w-full opacity-60 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Role</label>
                        <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900">
                          Student
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-600" />
                          <span>Member Since</span>
                        </label>
                        <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900">
                          {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary flex items-center space-x-2 px-6"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Resume Details Tab */}
              {activeTab === 'resume' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Resume Details</h2>
                      <p className="text-gray-400">View and edit your parsed resume information</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Re-upload Resume Button */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleResumeUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{uploading ? `Uploading ${uploadProgress}%` : 'Re-upload Resume'}</span>
                      </button>

                      {/* Edit/Save Buttons */}
                      {!editingResume ? (
                        <button
                          onClick={() => setEditingResume(true)}
                          className="btn-primary flex items-center space-x-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingResume(false)
                              fetchResumeData()
                            }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveResumeData}
                            disabled={saving}
                            className="btn-primary flex items-center space-x-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Skills Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Code className="w-5 h-5 text-primary-400" />
                        <span>Skills</span>
                      </h3>
                      <div className="space-y-3">
                        {resumeData.skills.map((skill, index) => (
                          <div key={index} className="flex items-center space-x-3">
                            {editingResume ? (
                              <>
                                <input
                                  type="text"
                                  value={skill.name || ''}
                                  onChange={(e) => updateSkill(index, 'name', e.target.value)}
                                  className="input flex-1"
                                  placeholder="Skill name"
                                />
                                <select
                                  value={skill.proficiency || 'intermediate'}
                                  onChange={(e) => updateSkill(index, 'proficiency', e.target.value)}
                                  className="input w-40"
                                >
                                  <option value="beginner">Beginner</option>
                                  <option value="intermediate">Intermediate</option>
                                  <option value="advanced">Advanced</option>
                                  <option value="expert">Expert</option>
                                </select>
                                <button
                                  onClick={() => removeSkill(index)}
                                  className="p-2 text-red-400 hover:text-red-300"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              <div className="flex-1 px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg\">
                                <span className="font-medium">{skill.name}</span>
                                {skill.proficiency && (
                                  <span className="ml-3 text-sm text-gray-400">({skill.proficiency})</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {editingResume && (
                          <button
                            onClick={addSkill}
                            className="flex items-center space-x-2 text-primary-400 hover:text-primary-300"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add Skill</span>
                          </button>
                        )}
                        {!editingResume && resumeData.skills.length === 0 && (
                          <p className="text-gray-500 italic">No skills added yet</p>
                        )}
                      </div>
                    </div>

                    {/* Education Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <GraduationCap className="w-5 h-5 text-primary-400" />
                        <span>Education</span>
                      </h3>
                      <div className="space-y-4">
                        {resumeData.education.map((edu, index) => (
                          <div key={index} className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                            <div className="font-medium text-gray-900">{edu.degree} {edu.branch && `in ${edu.branch}`}</div>
                            <div className="text-sm text-gray-600 mt-1">{edu.institution}</div>
                            {edu.cgpa && <div className="text-sm text-gray-600">CGPA: {edu.cgpa}</div>}
                            {(edu.start_year || edu.end_year) && (
                              <div className="text-sm text-gray-600">
                                {edu.start_year} - {edu.end_year || 'Present'}
                              </div>
                            )}
                          </div>
                        ))}
                        {resumeData.education.length === 0 && (
                          <p className="text-gray-500 italic">No education details added yet</p>
                        )}
                      </div>
                    </div>

                    {/* Experience Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Briefcase className="w-5 h-5 text-primary-400" />
                        <span>Work Experience</span>
                      </h3>
                      <div className="space-y-4">
                        {resumeData.experience.map((exp, index) => (
                          <div key={index} className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                            <div className="font-medium text-gray-900">{exp.title}</div>
                            <div className="text-sm text-gray-600 mt-1">{exp.company}</div>
                            {(exp.start_date || exp.end_date) && (
                              <div className="text-sm text-gray-600">
                                {exp.start_date} - {exp.end_date || 'Present'}
                              </div>
                            )}
                            {exp.description && (
                              <p className="text-sm text-gray-700 mt-2">{exp.description}</p>
                            )}
                          </div>
                        ))}
                        {resumeData.experience.length === 0 && (
                          <p className="text-gray-500 italic">No work experience added yet</p>
                        )}
                      </div>
                    </div>

                    {/* Projects Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Code className="w-5 h-5 text-primary-400" />
                        <span>Projects</span>
                      </h3>
                      <div className="space-y-4">
                        {resumeData.projects.map((project, index) => (
                          <div key={index} className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                            <div className="font-medium">{project.name}</div>
                            {project.description && (
                              <p className="text-sm text-gray-700 mt-2">{project.description}</p>
                            )}
                            {project.technologies && project.technologies.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {project.technologies.map((tech, i) => (
                                  <span key={i} className="px-2 py-1 bg-primary-500/20 text-primary-400 text-xs rounded">
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {resumeData.projects.length === 0 && (
                          <p className="text-gray-500 italic">No projects added yet</p>
                        )}
                      </div>
                    </div>

                    {/* Certifications Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Award className="w-5 h-5 text-primary-400" />
                        <span>Certifications</span>
                      </h3>
                      <div className="space-y-4">
                        {resumeData.certifications.map((cert, index) => (
                          <div key={index} className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                            <div className="font-medium">{cert.name}</div>
                            {cert.issuer && (
                              <div className="text-sm text-gray-600 mt-1">Issued by: {cert.issuer}</div>
                            )}
                            {cert.issue_date && (
                              <div className="text-sm text-gray-600">Date: {cert.issue_date}</div>
                            )}
                          </div>
                        ))}
                        {resumeData.certifications.length === 0 && (
                          <p className="text-gray-500 italic">No certifications added yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">Security Settings</h2>
                    <p className="text-gray-400">Update your password and manage account security</p>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                          <Lock className="w-4 h-4 text-primary-400" />
                          <span>Current Password</span>
                        </label>
                        <input
                          type="password"
                          value={passwordData.current_password}
                          onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                          className="input w-full"
                          placeholder="Enter your current password"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                          <Lock className="w-4 h-4 text-primary-400" />
                          <span>New Password</span>
                        </label>
                        <input
                          type="password"
                          value={passwordData.new_password}
                          onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                          className="input w-full"
                          placeholder="Enter new password (min 8 characters)"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center space-x-2">
                          <Lock className="w-4 h-4 text-primary-400" />
                          <span>Confirm New Password</span>
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirm_password}
                          onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                          className="input w-full"
                          placeholder="Confirm your new password"
                        />
                      </div>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-400 mb-2">Password Requirements:</h3>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• At least 8 characters long</li>
                        <li>• Mix of uppercase and lowercase letters recommended</li>
                        <li>• Include numbers and special characters for better security</li>
                      </ul>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-primary flex items-center space-x-2 px-6"
                      >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Updating...' : 'Update Password'}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
