import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Plus,
  Edit2,
  Upload,
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  BookOpen,
  Briefcase,
  Code,
  Coins,
  ChevronRight,
  Award,
  Sparkles,
  AlertTriangle,
  Star,
  RefreshCcw,
  Camera,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import Spinner from '../components/Spinner'
import secureStorage from '../utils/secureStorage'
import { calculateProfileCompletion } from '../utils/profileCompletion'
import { getApiError } from '../utils/apiError'

export default function StudentProfile() {
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [loadingResumeData, setLoadingResumeData] = useState(true)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    jee_rank: null,
    cgpa: null,
    location: '',
    skills: [],
    profile_picture_url: '',
  })
  const [resumeData, setResumeData] = useState(null)
  const [editing, setEditing] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [uploadingResume, setUploadingResume] = useState(false)
  const [parsingResume, setParsingResume] = useState(false)
  const [resumeStatusMessage, setResumeStatusMessage] = useState('')
  const [resumeStatusType, setResumeStatusType] = useState('info')
  const [showPreview, setShowPreview] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarDeleteDialogOpen, setAvatarDeleteDialogOpen] = useState(false)
  const [deletingAvatar, setDeletingAvatar] = useState(false)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [creditInfo, setCreditInfo] = useState(null)
  const [accountActive, setAccountActive] = useState(true)

  // Scorecard state variables
  const [scorecard, setScorecard] = useState(null)
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState('')
  const [recommendations, setRecommendations] = useState([])

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
          profile_picture_url: response.data.profile_picture_url || '',
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

  const fetchRecommendations = async (profileId) => {
    try {
      const recRes = await api.get(`/api/recommendations/${profileId}`)
      setRecommendations(recRes.data.job_recommendations || [])
    } catch (err) {
      console.error('Failed to load recommendations:', err)
    }
  }

  const fetchScorecard = async (jobId = null) => {
    setScorecardLoading(true)
    try {
      const url = jobId 
        ? `/api/student/resume/scorecard?job_id=${jobId}` 
        : '/api/student/resume/scorecard'
      const response = await api.get(url)
      setScorecard(response.data)
    } catch (err) {
      console.error('Error fetching scorecard:', err)
    } finally {
      setScorecardLoading(false)
    }
  }

  useEffect(() => {
    if (resumeData) {
      fetchScorecard(selectedJobId || null)
    }
  }, [selectedJobId, resumeData])

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
        if (response.data.applicant_id) {
          fetchRecommendations(response.data.applicant_id)
        }
      }
    } catch (err) {
      console.error('Error fetching resume data:', err)
    } finally {
      setLoadingResumeData(false)
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
          if (response.data.applicant_id) {
            fetchRecommendations(response.data.applicant_id)
          }
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

  const handleDeactivateAccount = () => setDeactivateDialogOpen(true)

  const performDeactivateAccount = async () => {
    try {
      setDeactivating(true)
      await api.patch('/api/auth/deactivate')
      toast.success('Account deactivated successfully')
      secureStorage.clear()
      navigate('/login')
    } catch (err) {
      console.error('Error deactivating account:', err)
      toast.error(getApiError(err, 'Failed to deactivate account'))
    } finally {
      setDeactivating(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    try {
      await api.patch('/api/auth/profile', {
        name: profile.full_name,
        phone: profile.phone,
        location: profile.location,
      })
      toast.success('Profile updated successfully')
      setEditing(false)
      fetchProfile()
    } catch (err) {
      console.error('Error updating profile:', err)
      toast.error('Failed to update profile')
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match')
      return
    }
    if (passwords.new.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    try {
      await api.patch('/api/auth/change-password', {
        current_password: passwords.current,
        new_password: passwords.new,
      })
      toast.success('Password changed successfully')
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err) {
      console.error('Error changing password:', err)
      toast.error(getApiError(err, 'Failed to change password'))
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
          toast.success('Resume uploaded. Parsing started.')
        } else {
          setParsingResume(false)
          setResumeStatusType('success')
          setResumeStatusMessage('Resume uploaded and parsed successfully.')
          toast.success('Resume uploaded and parsed successfully')
          fetchResumeData()
        }
      }
    } catch (err) {
      console.error('Error uploading resume:', err)
      setParsingResume(false)
      setResumeStatusType('error')
      setResumeStatusMessage(getApiError(err, 'Failed to upload or parse resume.'))
      toast.error('Failed to upload resume')
    } finally {
      setUploadingResume(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setUploadingAvatar(true)
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await api.post('/api/auth/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      if (response.data && response.data.profile_picture_url) {
        setProfile((prev) => ({
          ...prev,
          profile_picture_url: response.data.profile_picture_url,
        }))
        
        // Update global secureStorage user info
        const storedUser = secureStorage.getItem('user')
        if (storedUser) {
          storedUser.profile_picture_url = response.data.profile_picture_url
          secureStorage.setItem('user', storedUser)
          window.dispatchEvent(new Event('userProfileUpdated'))
        }
        
        toast.success('Profile picture updated successfully')
      }
    } catch (err) {
      console.error('Error uploading profile picture:', err)
      toast.error(getApiError(err, 'Failed to upload profile picture'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleAvatarDelete = () => setAvatarDeleteDialogOpen(true)

  const performAvatarDelete = async () => {
    try {
      setDeletingAvatar(true)
      await api.delete('/api/auth/profile/picture')
      setProfile((prev) => ({
        ...prev,
        profile_picture_url: '',
      }))

      // Update global secureStorage user info
      const storedUser = secureStorage.getItem('user')
      if (storedUser) {
        storedUser.profile_picture_url = ''
        secureStorage.setItem('user', storedUser)
        window.dispatchEvent(new Event('userProfileUpdated'))
      }

      toast.success('Profile picture removed')
      setAvatarDeleteDialogOpen(false)
    } catch (err) {
      console.error('Error deleting profile picture:', err)
      toast.error(getApiError(err, 'Failed to remove profile picture'))
    } finally {
      setDeletingAvatar(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-pill"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-error/10 border border-error/20 p-6 rounded-card text-error"
        >
          <AlertCircle className="w-6 h-6 mb-2" />
          {error}
        </motion.div>
      </div>
    )
  }

  const fieldClass = 'app-input'
  const buttonClass = 'app-btn-primary'
  const parsedSkills = Array.isArray(resumeData?.skills)
    ? resumeData.skills
      .map((skill) => (typeof skill === 'string' ? skill : skill?.name))
      .filter(Boolean)
    : []
  const mergedSkills = parsedSkills.length > 0 ? parsedSkills : profile.skills
  const mergedPersonalInfo = {
    name: profile.full_name || resumeData?.personal_info?.name || resumeData?.display_name || '',
    email: profile.email || resumeData?.personal_info?.email || '',
    phone: profile.phone || resumeData?.personal_info?.phone || '',
    location: profile.location || resumeData?.personal_info?.location || '',
  }
  const creditBalance = typeof creditInfo?.current_credits === 'number' ? creditInfo.current_credits : 0
  const deepAnalysisCost = creditInfo?.costs?.deep_analysis || 5
  const estimatedAnalyses = deepAnalysisCost > 0 ? Math.floor(creditBalance / deepAnalysisCost) : 0
  const profileCompletion = calculateProfileCompletion({
    personal_info: mergedPersonalInfo,
    skills: mergedSkills,
    education: resumeData?.education || [],
    experience: resumeData?.experience || [],
    projects: resumeData?.projects || [],
    certifications: resumeData?.certifications || [],
    cgpa: profile.cgpa,
    jee_rank: profile.jee_rank || resumeData?.jee_rank,
  })
  const profileCompletionLoading = loading || loadingResumeData

  return (
    <div className="min-h-screen bg-canvas text-ink font-body">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pt-6 pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="eyebrow mb-2">Account</p>
              <h1 className="app-page-title">My Profile</h1>
              <p className="app-page-subtitle">Manage your academic and professional identity</p>
            </div>
            <div className="relative group w-20 h-20 flex-shrink-0">
              <div className="w-full h-full rounded-pill overflow-hidden border-2 border-surface-raised shadow-soft bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                {profile.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url.startsWith("http") ? profile.profile_picture_url : `${api.defaults.baseURL || ""}${profile.profile_picture_url}`}
                    alt="Profile Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-white" />
                )}
              </div>
              
              <div className="absolute inset-0 bg-black/60 rounded-pill opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                <label className="cursor-pointer p-1.5 bg-primary-600 text-white rounded-pill hover:bg-primary-700 transition" title="Upload Photo">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                </label>
                {profile.profile_picture_url && (
                  <button
                    type="button"
                    onClick={handleAvatarDelete}
                    className="p-1.5 bg-error text-white rounded-pill hover:bg-error/90 transition"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/40 rounded-pill flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-pill animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setEditing(!editing)}
              className={`inline-flex items-center justify-center gap-2 whitespace-nowrap ${editing ? 'app-btn-secondary' : 'app-btn-primary'}`}
            >
              <Edit2 className="h-4 w-4 shrink-0" />
              {editing ? 'Cancel' : 'Edit Profile'}
            </motion.button>
            <label className="app-btn-secondary inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap">
              {uploadingResume || parsingResume ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4 shrink-0" />}
              <span>Upload Resume</span>
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
          <div className="mt-6 pt-6 border-t border-hairline">
            {profileCompletionLoading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-40 animate-pulse rounded-card bg-surface-sunken" />
                  <div className="h-6 w-12 animate-pulse rounded-card bg-surface-sunken" />
                </div>
                <div className="h-2 w-full animate-pulse rounded-pill bg-surface-sunken" />
                <div className="h-4 w-3/4 animate-pulse rounded-card bg-surface-sunken" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="app-label">Profile Completeness</span>
                  <span className="text-title text-primary-600 dark:text-primary-400">{profileCompletion}%</span>
                </div>
                <div className="w-full bg-surface-sunken rounded-pill h-2 overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-pill" style={{ width: `${profileCompletion}%` }} />
                </div>
                <p className="text-caption text-ink-muted mt-2">
                  Almost there! Complete the remaining sections to unlock personalized AI career roadmaps.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="rounded-panel bg-primary-800 text-white p-6 sticky top-24 shadow-soft-sm">
              <h3 className="font-display text-title font-bold mb-4 pb-4 border-b border-white/20">Sections</h3>
              <nav className="space-y-2">
                <a href="#personal" className="block px-4 py-2 rounded-card hover:bg-primary-700 transition">
                  <User className="w-4 h-4 inline mr-2" />
                  Personal Information
                </a>
                <a href="#education" className="block px-4 py-2 rounded-card hover:bg-primary-700 transition">
                  <BookOpen className="w-4 h-4 inline mr-2" />
                  Education
                </a>
                <a href="#experience" className="block px-4 py-2 rounded-card hover:bg-primary-700 transition">
                  <Briefcase className="w-4 h-4 inline mr-2" />
                  Experience
                </a>
                <a href="#resume" className="block px-4 py-2 rounded-card hover:bg-primary-700 transition">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Resume
                </a>
                <a href="#skills" className="block px-4 py-2 rounded-card hover:bg-primary-700 transition">
                  <Code className="w-4 h-4 inline mr-2" />
                  Skills
                </a>
                <a href="#credits" className="block px-4 py-2 rounded-card hover:bg-primary-700 transition">
                  <Coins className="w-4 h-4 inline mr-2" />
                  Credits
                </a>
                <a href="#security" className="block px-4 py-2 rounded-card hover:bg-primary-700 transition">
                  <Lock className="w-4 h-4 inline mr-2" />
                  Security
                </a>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-8">
            {/* Personal Information */}
            <section id="personal" className="surface-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-100 rounded-pill flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="app-section-title">Personal Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="app-label block mb-2">Full Name</label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    disabled={!editing}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="app-label block mb-2">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className={`${fieldClass} bg-surface-sunken text-ink-muted`}
                  />
                </div>
                <div>
                  <label className="app-label block mb-2">Phone Number</label>
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
                  <label className="app-label block mb-2">Location</label>
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
            <section id="education" className="surface-card p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-pill flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="app-section-title">Education</h3>
                </div>
                {editing && (
                  <button type="button" disabled aria-disabled="true" title="Education editing is coming soon" className="app-btn-primary app-btn-sm flex items-center gap-2 opacity-60 cursor-not-allowed">
                    <Plus className="w-4 h-4" />
                    Add Education
                  </button>
                )}
              </div>

              {resumeData?.education && resumeData.education.length > 0 ? (
                <div className="space-y-4">
                  {resumeData.education.map((edu, idx) => (
                    <div key={edu.id || `edu-${edu.institution}-${edu.degree}-${idx}`} className="rounded-card border border-hairline bg-surface-sunken p-4">
                      <h4 className="font-bold text-ink">{edu.institution}</h4>
                      <p className="text-caption text-ink-muted">{[edu.start_date, edu.end_date].filter(Boolean).join(' - ')}</p>
                      <p className="text-caption text-ink-muted">{[edu.degree, edu.field].filter(Boolean).join(' - ')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body text-ink-muted text-center py-8">No education records yet</p>
              )}
            </section>

            {/* Experience */}
            <section id="experience" className="surface-card p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-pill flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="app-section-title">Experience</h3>
                </div>
                {editing && (
                  <button type="button" disabled aria-disabled="true" title="Experience editing is coming soon" className="app-btn-primary app-btn-sm flex items-center gap-2 opacity-60 cursor-not-allowed">
                    <Plus className="w-4 h-4" />
                    Add Experience
                  </button>
                )}
              </div>

              {resumeData?.experience && resumeData.experience.length > 0 ? (
                <div className="space-y-4">
                  {resumeData.experience.map((exp, idx) => (
                    <div key={exp.id || `exp-${exp.company}-${exp.title}-${idx}`} className="rounded-card border border-hairline bg-surface-sunken p-4">
                      <h4 className="font-bold text-ink">{exp.title}</h4>
                      <p className="text-caption text-ink">{exp.company}</p>
                      <p className="text-caption text-ink-muted">{[exp.start_date, exp.end_date].filter(Boolean).join(' - ')}</p>
                      <p className="text-caption text-ink-muted mt-2">{exp.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body text-ink-muted text-center py-8">No experience records yet</p>
              )}
            </section>

            {/* Resume */}
            <section id="resume" className="surface-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-orange-100 rounded-pill flex items-center justify-center">
                  <Upload className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="app-section-title">Resume</h3>
              </div>

              {resumeStatusMessage && (
                <div
                  className={`mb-6 rounded-card border px-4 py-3 text-caption font-medium ${
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
                  {/* Resume Score Card Sub-section */}
                  {scorecard && (
                    <div className="mb-8 p-6 rounded-panel border border-hairline bg-surface-sunken shadow-soft-xs">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-hairline">
                        <div>
                          <h4 className="text-title text-ink flex items-center gap-2">
                            <Award className="w-5 h-5 text-warning" />
                            ATS Resume Grader
                          </h4>
                          <p className="text-caption text-ink-muted mt-1">Rule-based deterministic keyword & format optimizer</p>
                        </div>
                        {/* Selector */}
                        <div className="flex items-center gap-2">
                          <label className="app-label">Scoring Mode:</label>
                          <select
                            value={selectedJobId}
                            onChange={(e) => setSelectedJobId(e.target.value)}
                            className="app-input w-auto pr-8"
                          >
                            <option value="">General Scan (Market Demand)</option>
                            {recommendations.map((rec) => (
                              <option key={rec.id} value={rec.job?.id || rec.job_id}>
                                Job Specific: {rec.job?.title || rec.title} ({rec.job?.company || rec.company})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {scorecardLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-pill"
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                          {/* Left: Dial Column */}
                          <div className="lg:col-span-4 flex flex-col items-center text-center">
                            <div className="relative w-36 h-36 flex items-center justify-center">
                              {/* Circle Background */}
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                  cx="72"
                                  cy="72"
                                  r="56"
                                  className="stroke-hairline-strong fill-none"
                                  strokeWidth="10"
                                />
                                <motion.circle
                                  cx="72"
                                  cy="72"
                                  r="56"
                                  className="fill-none"
                                  strokeWidth="10"
                                  strokeLinecap="round"
                                  strokeDasharray={2 * Math.PI * 56}
                                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                                  animate={{ strokeDashoffset: 2 * Math.PI * 56 - (scorecard.total / 100) * 2 * Math.PI * 56 }}
                                  transition={{ duration: 1 }}
                                  style={{
                                    stroke: scorecard.total >= 80 
                                      ? '#10b981' 
                                      : scorecard.total >= 60 
                                        ? '#f59e0b' 
                                        : '#ef4444'
                                  }}
                                />
                              </svg>
                              <div className="absolute flex flex-col items-center">
                                <span className="text-title-lg text-ink font-mono">
                                  {scorecard.total}%
                                </span>
                                <span className="text-overline text-ink-subtle uppercase mt-0.5">
                                  {scorecard.total >= 80 
                                    ? 'EXCELLENT' 
                                    : scorecard.total >= 60 
                                      ? 'AVERAGE' 
                                      : 'NEEDS FIXES'}
                                </span>
                              </div>
                            </div>
                            <p className="text-caption text-ink-muted mt-4 leading-normal max-w-[200px]">
                              Matched against <strong className="text-ink">{scorecard.target_job_title || 'General Market Demand'}</strong>
                            </p>
                          </div>

                          {/* Right: Breakdown & Suggs Column */}
                          <div className="lg:col-span-8 space-y-4">
                            {/* Progress bars */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                              {Object.entries(scorecard.breakdown || {}).map(([key, val]) => {
                                const labelMap = {
                                  keyword_match: 'Keyword Match (35%)',
                                  completeness: 'Section Completeness (20%)',
                                  experience_depth: 'Experience Depth (20%)',
                                  formatting: 'Formatting (15%)',
                                  contact_info: 'Contact Info (10%)'
                                };
                                return (
                                  <div key={key}>
                                    <div className="flex justify-between text-caption font-semibold mb-1">
                                      <span className="text-ink-muted">{labelMap[key] || key}</span>
                                      <span className="font-mono text-ink">{val}%</span>
                                    </div>
                                    <div className="w-full bg-surface-raised rounded-pill h-1.5 overflow-hidden">
                                      <div
                                        className="h-full rounded-pill transition-all duration-500"
                                        style={{
                                          width: `${val}%`,
                                          backgroundColor: val >= 80 
                                            ? '#10b981' 
                                            : val >= 60 
                                              ? '#f59e0b' 
                                              : '#ef4444'
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Top Actionable Suggestions */}
                            {scorecard.suggestions && scorecard.suggestions.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-hairline">
                                <h5 className="app-label mb-2.5 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                                  Improvement Checklist
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {scorecard.suggestions.map((sugg, idx) => {
                                    const isPositive = sugg.toLowerCase().includes('excellent') || sugg.toLowerCase().includes('great job');
                                    return (
                                      <div 
                                        key={`sugg-${sugg.slice(0, 30)}-${idx}`} 
                                        className={`flex items-start gap-2 p-2 rounded-card text-caption ${
                                          isPositive 
                                            ? 'bg-emerald-50/50 text-emerald-800 border border-emerald-100/50' 
                                            : 'bg-amber-50/50 text-amber-800 border border-amber-100/50'
                                        }`}
                                      >
                                        {isPositive ? (
                                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                        ) : (
                                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                        )}
                                        <span className="leading-tight">{sugg}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-ink mb-3">Summary</h4>
                    <p className="text-body text-ink-muted">{resumeData.summary}</p>
                  </div>

                  {/* Resume File Info & Preview Toggle */}
                  <div className="mt-6 pt-6 border-t border-hairline">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-card border border-hairline bg-surface-sunken p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-card flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-caption font-semibold text-ink truncate max-w-[200px] sm:max-w-md">
                            {resumeData?.resume_filename || "resume.pdf"}
                          </h4>
                          <p className="text-caption text-ink-muted font-medium">Uploaded Resume Document</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setShowPreview(!showPreview)}
                          className="app-btn-secondary app-btn-sm flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {showPreview ? "Hide Preview" : "View Preview"}
                        </button>
                        <a
                          href={`${api.defaults.baseURL || ""}/api/student/resume/preview?token=${encodeURIComponent(secureStorage.getItem("token") || "")}`}
                          download
                          target="_blank"
                          rel="noreferrer"
 className="app-btn-secondary app-btn-sm flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      </div>
                    </div>

                    {showPreview && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-card border border-hairline overflow-hidden bg-surface-sunken shadow-soft-xs"
                      >
                        <iframe
                          src={`${api.defaults.baseURL || ""}/api/student/resume/preview?token=${encodeURIComponent(secureStorage.getItem("token") || "")}`}
                          className="w-full h-[600px] border-none bg-surface-sunken"
                          title="Resume Preview"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Upload className="w-16 h-16 mx-auto text-ink-subtle mb-4" />
                  <p className="text-title text-ink mb-4">No resume uploaded yet</p>
                  <p className="text-body text-ink-muted mb-6">Upload your PDF resume to let AI scan for missing skills.</p>
                  <label className="app-btn-primary inline-flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Upload PDF
                    <input type="file" accept=".pdf" onChange={handleResumeUpload} hidden />
                  </label>
                </div>
              )}
            </section>

            {/* Skills — read from the parsed resume; manual edits are not
                stored anywhere, so editing affordances were removed. */}
            <section id="skills" className="surface-card p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-pill flex items-center justify-center">
                  <Code className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="app-section-title">Skills & Tech Stack</h3>
              </div>
              <p className="text-caption text-ink-muted mb-6">
                Skills are extracted from your parsed resume. Upload a new resume to update them.
              </p>

              <div className="mb-6">
                <div className="flex flex-wrap gap-3">
                  {(parsedSkills.length > 0 ? parsedSkills : profile.skills).length > 0 ? (
                    (parsedSkills.length > 0 ? parsedSkills : profile.skills).map((skill) => (
                      <div
                        key={skill}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-pill font-medium border border-primary-200 dark:bg-primary-500/10 dark:text-primary-300 dark:border-primary-500/30"
                      >
                        {skill}
                      </div>
                    ))
                  ) : (
                    <p className="text-ink-muted">No skills yet — upload a resume to extract them</p>
                  )}
                </div>
              </div>
            </section>

            {/* AI Credits */}
            <section id="credits" className="surface-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-yellow-100 rounded-pill flex items-center justify-center">
                  <Coins className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="app-section-title">AI Credits</h3>
              </div>

              {creditInfo ? (
                <div>
                  <div className="text-center py-8 rounded-card border border-amber-200 bg-amber-50/60 mb-6">
                    <div className="text-display-lg text-amber-600 mb-2">{creditBalance}</div>
                    <p className="text-ink-muted font-medium">Tokens remaining</p>
                    <p className="text-caption text-ink-muted mt-1">Estimated {estimatedAnalyses} deep career analyses</p>
                    <p className="text-caption text-ink-subtle mt-2">
                      Next refill in {creditInfo.next_refill_days}d {creditInfo.next_refill_hours}h
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/dashboard/credits/transactions')}
                    className="w-full px-6 py-3 text-primary-600 hover:text-primary-700 dark:hover:text-primary font-semibold flex items-center justify-center gap-2"
                  >
                    View Transaction History <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-body text-ink-muted text-center py-8">Loading credit information...</p>
              )}
            </section>

            {/* Security & Account */}
            <section id="security" className="surface-card p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-red-100 rounded-pill flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="app-section-title">Security & Account</h3>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-green-50 rounded-card border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="app-label">Account Status</p>
                      <p className={`text-title mt-1 ${accountActive ? 'text-green-600' : 'text-red-600'}`}>
                        {accountActive ? 'Active' : 'Deactivated'}
                      </p>
                    </div>
                    <CheckCircle className={`w-8 h-8 ${accountActive ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </div>

                {/* Change Password */}
                <form onSubmit={handleChangePassword} className="p-6 rounded-card border border-hairline bg-surface-sunken">
                  <h4 className="font-bold text-ink mb-6">Change Password</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="app-label block mb-2">Current Password</label>
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
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
                        >
                          {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="app-label block mb-2">New Password</label>
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
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
                        >
                          {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="app-label block mb-2">Confirm New Password</label>
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
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
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
                <div className="p-6 bg-red-50 rounded-card border border-red-200">
                  <h4 className="font-bold text-red-900 mb-4">Danger Zone</h4>
                  <button
                    onClick={handleDeactivateAccount}
                    disabled={!accountActive}
                    className={`w-full px-6 py-3 text-white rounded-card transition font-semibold ${
                      accountActive 
                        ? 'bg-red-600 hover:bg-red-700 shadow-soft-xs' 
                        : 'bg-surface-sunken text-ink-subtle cursor-not-allowed'
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
        <footer className="mt-16 pt-8 border-t border-hairline text-center text-caption text-ink-subtle">
          <p>© 2026 CareerSync AI. Empowering students with intelligent guidance.</p>
        </footer>
      </div>
      <ConfirmDialog
        isOpen={avatarDeleteDialogOpen}
        title="Remove profile picture?"
        message="Your current profile picture will be removed and your initials avatar will be shown instead."
        confirmLabel="Remove"
        destructive
        loading={deletingAvatar}
        onConfirm={performAvatarDelete}
        onClose={() => !deletingAvatar && setAvatarDeleteDialogOpen(false)}
      />
      <ConfirmDialog
        isOpen={deactivateDialogOpen}
        title="Deactivate your account?"
        message="Your account will be deactivated and you will be signed out. You will need to contact support to reactivate it."
        confirmLabel="Deactivate Account"
        destructive
        loading={deactivating}
        onConfirm={performDeactivateAccount}
        onClose={() => !deactivating && setDeactivateDialogOpen(false)}
      />
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
