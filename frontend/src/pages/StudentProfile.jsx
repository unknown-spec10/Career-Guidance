import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Plus,
  X,
  Edit2,
  Upload,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  BookOpen,
  Briefcase,
  Code,
  Coins,
  ChevronRight,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import secureStorage from '../utils/secureStorage'

export default function StudentProfile() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    jee_rank: null,
    cgpa: null,
    location: '',
    skills: [],
  })
  const [resumeData, setResumeData] = useState(null)
  const [editing, setEditing] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [uploadingResume, setUploadingResume] = useState(false)
  const [parsingResume, setParsingResume] = useState(false)
  const [resumeStatusMessage, setResumeStatusMessage] = useState('')
  const [resumeStatusType, setResumeStatusType] = useState('info')
  const [newSkill, setNewSkill] = useState('')
  const [creditInfo, setCreditInfo] = useState(null)
  const [accountActive, setAccountActive] = useState(true)

  useEffect(() => {
    fetchProfile()
    fetchResumeData()
    fetchCreditInfo()
  }, [])

  useEffect(() => {
    if (!resumeData) return
    setProfile((prev) => ({
      ...prev,
      full_name: prev.full_name?.trim() || resumeData?.personal_info?.name || resumeData?.display_name || '',
      location: prev.location?.trim() || resumeData?.personal_info?.location || '',
      phone: prev.phone?.trim() || resumeData?.personal_info?.phone || '',
    }))
  }, [resumeData])

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/auth/me')
      if (response.data) {
        setProfile({
          full_name: response.data.name || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          jee_rank: response.data.jee_rank || null,
          cgpa: response.data.cgpa || null,
          location: response.data.location || '',
          skills: response.data.skills || [],
        })
        setAccountActive(response.data.is_active !== false)
      }
      setLoading(false)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile')
      setLoading(false)
    }
  }

  const fetchResumeData = async () => {
    try {
      const response = await api.get('/api/student/profile')
      if (response.data) {
        setResumeData(response.data)
        setProfile((prev) => ({
          ...prev,
          full_name: prev.full_name?.trim() || response.data?.personal_info?.name || response.data?.display_name || '',
          location: prev.location?.trim() || response.data?.personal_info?.location || '',
          phone: prev.phone?.trim() || response.data?.personal_info?.phone || '',
        }))
      }
    } catch (err) {
      console.error('Error fetching resume data:', err)
    }
  }

  const hasParsedResumeData = (data) => {
    if (!data) return false
    const hasSummary = typeof data.summary === 'string' && data.summary.trim().length > 0
    const hasEducation = Array.isArray(data.education) && data.education.length > 0
    const hasExperience = Array.isArray(data.experience) && data.experience.length > 0
    const hasSkills = Array.isArray(data.skills) && data.skills.length > 0
    return hasSummary || hasEducation || hasExperience || hasSkills
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const pollForParsedResume = async () => {
    // Poll for up to ~60 seconds while parser updates student profile payload.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(5000)
      try {
        const response = await api.get('/api/student/profile')
        if (response.data) {
          setResumeData(response.data)
        }
        if (hasParsedResumeData(response.data)) {
          setParsingResume(false)
          setResumeStatusType('success')
          setResumeStatusMessage('Parsing complete. Your profile has been updated.')
          return
        }
      } catch (err) {
        console.error('Error polling parsed resume data:', err)
      }
    }

    setParsingResume(false)
    setResumeStatusType('info')
    setResumeStatusMessage('Parsing is taking longer than usual. Please refresh after a moment.')
  }

  const fetchCreditInfo = async () => {
    try {
      const response = await api.get('/api/credits/balance')
      if (response.data) {
        setCreditInfo(response.data)
      }
    } catch (err) {
      console.error('Error fetching credit info:', err)
    }
  }

  const handleDeactivateAccount = async () => {
    const confirmed = window.confirm('Are you sure you want to deactivate your account?')
    if (!confirmed) return

    try {
      await api.patch('/api/auth/deactivate')
      showToast('Account deactivated successfully', 'success')
      secureStorage.clear()
      navigate('/login')
    } catch (err) {
      console.error('Error deactivating account:', err)
      showToast(err.response?.data?.detail || 'Failed to deactivate account', 'error')
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    try {
      await api.patch('/api/auth/profile', {
        name: profile.full_name
      })
      showToast('Profile updated successfully', 'success')
      setEditing(false)
      fetchProfile()
    } catch (err) {
      console.error('Error updating profile:', err)
      showToast('Failed to update profile', 'error')
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwords.new !== passwords.confirm) {
      showToast('New passwords do not match', 'error')
      return
    }
    if (passwords.new.length < 8) {
      showToast('Password must be at least 8 characters', 'error')
      return
    }
    try {
      await api.patch('/api/auth/change-password', {
        current_password: passwords.current,
        new_password: passwords.new,
      })
      showToast('Password changed successfully', 'success')
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err) {
      console.error('Error changing password:', err)
      showToast(err.response?.data?.detail || 'Failed to change password', 'error')
    }
  }

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingResume(true)
    setParsingResume(false)
    setResumeStatusType('info')
    setResumeStatusMessage('Uploading resume...')
    try {
      const formData = new FormData()
      formData.append('resume', file)

      const response = await api.post('/api/upload/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (response.data?.applicant_id) {
        setResumeStatusMessage('Resume uploaded. Parsing in progress...')
        setParsingResume(true)

        const parseResponse = await api.post(`/parse/${response.data.applicant_id}`, null, {
          timeout: 120000,
        })

        if (parseResponse?.data?.status === 'queued') {
          setResumeStatusType('info')
          setResumeStatusMessage('Parsing queued. This may take up to a minute...')
          await pollForParsedResume()
          showToast('Resume uploaded. Parsing started.', 'success')
        } else {
          setParsingResume(false)
          setResumeStatusType('success')
          setResumeStatusMessage('Resume uploaded and parsed successfully.')
          showToast('Resume uploaded and parsed successfully', 'success')
          fetchResumeData()
        }
      }
    } catch (err) {
      console.error('Error uploading resume:', err)
      setParsingResume(false)
      setResumeStatusType('error')
      setResumeStatusMessage(err.response?.data?.detail || 'Failed to upload or parse resume.')
      showToast('Failed to upload resume', 'error')
    } finally {
      setUploadingResume(false)
    }
  }

  const addSkill = () => {
    if (newSkill.trim() && !profile.skills.includes(newSkill.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, newSkill.trim()] })
      setNewSkill('')
    }
  }

  const removeSkill = (skillToRemove) => {
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    })
  }

  const updateSkill = (index, newValue) => {
    const updatedSkills = [...profile.skills]
    updatedSkills[index] = newValue
    setProfile({ ...profile, skills: updatedSkills })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 p-6 rounded-lg text-red-800"
        >
          <AlertCircle className="w-6 h-6 mb-2" />
          {error}
        </motion.div>
      </div>
    )
  }

  const fieldClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition'
  const buttonClass = 'px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium'
  const parsedSkills = Array.isArray(resumeData?.skills)
    ? resumeData.skills
      .map((skill) => (typeof skill === 'string' ? skill : skill?.name))
      .filter(Boolean)
    : []
  const creditBalance = typeof creditInfo?.current_credits === 'number' ? creditInfo.current_credits : 0
  const deepAnalysisCost = creditInfo?.costs?.deep_analysis || 5
  const estimatedAnalyses = deepAnalysisCost > 0 ? Math.floor(creditBalance / deepAnalysisCost) : 0

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-4xl font-bold text-gray-900">My Profile</h2>
              <p className="text-gray-600 mt-2">Manage your academic and professional identity</p>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setEditing(!editing)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
                editing ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Edit2 className="w-4 h-4" />
              {editing ? 'Cancel' : 'Edit Profile'}
            </motion.button>
            <label className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-lg font-semibold text-gray-900 hover:bg-gray-50 transition cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploadingResume ? 'Uploading...' : parsingResume ? 'Parsing...' : 'Upload Resume'}
              <input type="file" accept=".pdf" onChange={handleResumeUpload} hidden />
            </label>
            {editing && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={handleUpdateProfile}
                className={buttonClass}
              >
                Save Changes
              </motion.button>
            )}
          </div>

          {/* Profile Completeness */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-700">Profile Completeness</span>
              <span className="text-lg font-bold text-blue-600">85%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '85%' }} />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Almost there! Complete the remaining sections to unlock personalized AI career roadmaps.
            </p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-gradient-to-b from-blue-600 to-blue-800 text-white rounded-lg p-6 sticky top-24">
              <h3 className="font-bold text-lg mb-4 pb-4 border-b border-blue-400">Sections</h3>
              <nav className="space-y-2">
                <a href="#personal" className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <User className="w-4 h-4 inline mr-2" />
                  Personal Information
                </a>
                <a href="#education" className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <BookOpen className="w-4 h-4 inline mr-2" />
                  Education
                </a>
                <a href="#experience" className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <Briefcase className="w-4 h-4 inline mr-2" />
                  Experience
                </a>
                <a href="#resume" className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Resume
                </a>
                <a href="#skills" className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <Code className="w-4 h-4 inline mr-2" />
                  Skills
                </a>
                <a href="#credits" className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <Coins className="w-4 h-4 inline mr-2" />
                  Credits
                </a>
                <a href="#security" className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                  <Lock className="w-4 h-4 inline mr-2" />
                  Security
                </a>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-8">
            {/* Personal Information */}
            <section id="personal" className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Personal Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    disabled={!editing}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className={`${fieldClass} bg-gray-50`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                    disabled={!editing}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    disabled={!editing}
                    className={fieldClass}
                  />
                </div>
              </div>
            </section>

            {/* Education */}
            <section id="education" className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Education</h3>
                </div>
                {editing && (
                  <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <Plus className="w-4 h-4" />
                    Add Education
                  </button>
                )}
              </div>

              {resumeData?.education && resumeData.education.length > 0 ? (
                <div className="space-y-4">
                  {resumeData.education.map((edu, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-gray-900">{edu.institution}</h4>
                      <p className="text-sm text-gray-600">{[edu.start_date, edu.end_date].filter(Boolean).join(' - ')}</p>
                      <p className="text-sm text-gray-700">{[edu.degree, edu.field].filter(Boolean).join(' - ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">No education records yet</p>
              )}
            </section>

            {/* Experience */}
            <section id="experience" className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Experience</h3>
                </div>
                {editing && (
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Plus className="w-4 h-4" />
                    Add Experience
                  </button>
                )}
              </div>

              {resumeData?.experience && resumeData.experience.length > 0 ? (
                <div className="space-y-4">
                  {resumeData.experience.map((exp, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-bold text-gray-900">{exp.title}</h4>
                      <p className="text-sm text-gray-700">{exp.company}</p>
                      <p className="text-sm text-gray-600">{[exp.start_date, exp.end_date].filter(Boolean).join(' - ')}</p>
                      <p className="text-sm text-gray-600 mt-2">{exp.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">No experience records yet</p>
              )}
            </section>

            {/* Resume */}
            <section id="resume" className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Resume</h3>
              </div>

              {resumeStatusMessage && (
                <div
                  className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
                    resumeStatusType === 'success'
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : resumeStatusType === 'error'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : 'border-blue-200 bg-blue-50 text-blue-800'
                  }`}
                >
                  {resumeStatusMessage}
                </div>
              )}

              {resumeData ? (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3">Summary</h4>
                    <p className="text-gray-700">{resumeData.summary}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 text-lg mb-4">No resume uploaded yet</p>
                  <p className="text-gray-500 mb-6">Upload your PDF resume to let AI scan for missing skills.</p>
                  <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-semibold">
                    <Upload className="w-4 h-4" />
                    Upload PDF
                    <input type="file" accept=".pdf" onChange={handleResumeUpload} hidden />
                  </label>
                </div>
              )}
            </section>

            {/* Skills */}
            <section id="skills" className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Code className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Skills & Tech Stack</h3>
              </div>

              <div className="mb-6">
                <div className="flex flex-wrap gap-3">
                  {(parsedSkills.length > 0 ? parsedSkills : profile.skills).length > 0 ? (
                    (parsedSkills.length > 0 ? parsedSkills : profile.skills).map((skill, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-900 rounded-full font-medium border border-blue-300"
                      >
                        {editing && parsedSkills.length === 0 ? (
                          <input
                            type="text"
                            value={skill}
                            onChange={(e) => updateSkill(idx, e.target.value)}
                            className="bg-transparent outline-none w-24"
                          />
                        ) : (
                          skill
                        )}
                        {editing && (
                          <button onClick={() => removeSkill(skill)} className="text-blue-900 hover:text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No skills added yet</p>
                  )}
                </div>
              </div>

              {editing && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a new skill..."
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                    className={fieldClass}
                  />
                  <button onClick={addSkill} className={`${buttonClass} px-4`}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </section>

            {/* AI Credits */}
            <section id="credits" className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Coins className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">AI Credits</h3>
              </div>

              {creditInfo ? (
                <div>
                  <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200 mb-6">
                    <div className="text-5xl font-bold text-yellow-600 mb-2">{creditBalance}</div>
                    <p className="text-gray-600 font-medium">Tokens remaining</p>
                    <p className="text-sm text-gray-500 mt-1">Estimated {estimatedAnalyses} deep career analyses</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Next refill in {creditInfo.next_refill_days}d {creditInfo.next_refill_hours}h
                    </p>
                  </div>
                  <button className="w-full px-6 py-3 text-blue-600 hover:text-blue-700 font-semibold flex items-center justify-center gap-2">
                    View Transaction History <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">Loading credit information...</p>
              )}
            </section>

            {/* Security & Account */}
            <section id="security" className="bg-white border border-gray-200 rounded-lg p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Security & Account</h3>
              </div>

              <div className="space-y-6">
                {/* Account Status */}
                <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Account Status</p>
                      <p className={`text-lg font-bold mt-1 ${accountActive ? 'text-green-600' : 'text-red-600'}`}>
                        {accountActive ? 'Active' : 'Deactivated'}
                      </p>
                    </div>
                    <CheckCircle className={`w-8 h-8 ${accountActive ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </div>

                {/* Change Password */}
                <form onSubmit={handleChangePassword} className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-900 mb-6">Change Password</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                      <div className="relative">
                        <input
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwords.current}
                          onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                          className={fieldClass}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600"
                        >
                          {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                      <div className="relative">
                        <input
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwords.new}
                          onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                          className={fieldClass}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600"
                        >
                          {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                          className={fieldClass}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600"
                        >
                          {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button type="submit" className={`${buttonClass} w-full`}>
                      Update Password
                    </button>
                  </div>
                </form>

                {/* Danger Zone */}
                <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-bold text-red-900 mb-4">Danger Zone</h4>
                  <button
                    onClick={handleDeactivateAccount}
                    disabled={!accountActive}
                    className={`w-full px-6 py-3 text-white rounded-lg transition font-semibold ${
                      accountActive ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Deactivate Account
                  </button>
                </div>
              </div>
            </section>
          </main>
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-gray-600 text-sm">
          <p>© 2024 Career AI. Empowering students with intelligent guidance.</p>
        </footer>
      </div>
    </div>
  )
}
