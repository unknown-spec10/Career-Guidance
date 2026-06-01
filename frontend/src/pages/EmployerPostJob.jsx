import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Briefcase, PlusCircle, Trash2, LogOut, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { sanitizeInput } from '../utils/sanitize'

export default function EmployerPostJob() {
  const navigate = useNavigate()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [locationState, setLocationState] = useState('')
  const [workType, setWorkType] = useState('remote')
  const [minExperienceYears, setMinExperienceYears] = useState(0)
  const [minCgpa, setMinCgpa] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [requiredSkills, setRequiredSkills] = useState([])
  const [optionalSkills, setOptionalSkills] = useState([])
  const [reqSkillDraft, setReqSkillDraft] = useState({ name: '', level: '' })
  const [optSkillDraft, setOptSkillDraft] = useState({ name: '', level: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [optimizing, setOptimizing] = useState(false)

  const handleOptimizeDescription = async () => {
    if (!description.trim()) {
      toast.error('Please write a brief draft in the description field first before optimizing.')
      return
    }
    setOptimizing(true)
    try {
      const res = await api.post('/api/employer/jobs/optimize', {
        prompt: description,
        title: title || null
      })
      if (res.data) {
        setDescription(res.data.optimized_description)
        
        // Auto-populate required skills if returned
        if (res.data.required_skills && res.data.required_skills.length > 0) {
          setRequiredSkills(res.data.required_skills.map(sk => ({
            name: sk.name,
            level: sk.level || 'basic'
          })))
        }
        
        // Auto-populate optional skills if returned
        if (res.data.optional_skills && res.data.optional_skills.length > 0) {
          setOptionalSkills(res.data.optional_skills.map(sk => ({
            name: sk.name,
            level: sk.level || 'basic'
          })))
        }
        
        toast.success('Description expanded! Recommended tech stack populated.')
      }
    } catch (err) {
      console.error('Error optimizing description:', err)
      toast.error(err.response?.data?.detail || 'Failed to optimize description with AI.')
    } finally {
      setOptimizing(false)
    }
  }

  const handleLogout = () => {
    secureStorage.clear()
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }

  const addRequiredSkill = () => {
    if (!reqSkillDraft.name.trim()) return
    const sanitizedName = sanitizeInput(reqSkillDraft.name.trim())
    setRequiredSkills(prev => [...prev, { name: sanitizedName, level: reqSkillDraft.level || 'basic' }])
    setReqSkillDraft({ name: '', level: '' })
  }

  const removeRequiredSkill = (idx) => {
    setRequiredSkills(prev => prev.filter((_, i) => i !== idx))
  }

  const addOptionalSkill = () => {
    if (!optSkillDraft.name.trim()) return
    const sanitizedName = sanitizeInput(optSkillDraft.name.trim())
    setOptionalSkills(prev => [...prev, { name: sanitizedName, level: optSkillDraft.level || 'basic' }])
    setOptSkillDraft({ name: '', level: '' })
  }

  const removeOptionalSkill = (idx) => {
    setOptionalSkills(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    if (!title || !description || !locationCity) {
      setError('Title, description and location city are required.')
      setSubmitting(false)
      return
    }

    try {
      const payload = {
        title: sanitizeInput(title),
        description: sanitizeInput(description),
        location_city: sanitizeInput(locationCity),
        location_state: locationState ? sanitizeInput(locationState) : null,
        work_type: workType,
        min_experience_years: Number(minExperienceYears) || 0,
        min_cgpa: minCgpa ? Number(minCgpa) : null,
        required_skills: requiredSkills.length ? requiredSkills : null,
        optional_skills: optionalSkills.length ? optionalSkills : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
      }

      const res = await api.post('/api/employer/jobs', payload)
      setSuccess(true)
      toast.success('Job posted successfully! Pending admin approval.')
      setTimeout(() => {
        navigate('/employer/dashboard')
      }, 1500)
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to create job'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
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
                <Briefcase className="w-3.5 h-3.5" />
                Postings
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-primary-950">
                  Post a New Job
                </span>
              </h1>
              <p className="text-gray-600">Fill out the details below. Job will be pending admin approval.</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl hover:bg-rose-100 transition-all text-xs font-bold active:scale-95 duration-200 shadow-sm"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Logout</span>
            </button>
          </div>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-6"
        >
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-2 text-rose-700 text-sm font-medium">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0" /> 
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" /> 
              <span>Job created! Redirecting...</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Job Title *</label>
              <input
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Developer"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Work Type *</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-semibold text-slate-700"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                required
              >
                <option value="remote">Remote</option>
                <option value="on-site">On-site</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Description *</label>
              <button
                type="button"
                onClick={handleOptimizeDescription}
                disabled={optimizing || !description.trim()}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all shadow-sm active:scale-95 duration-200 ${
                  optimizing
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-150 animate-pulse'
                    : description.trim()
                    ? 'bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white shadow-md'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${optimizing ? 'animate-spin' : ''}`} />
                <span>{optimizing ? 'Optimizing Description...' : 'Optimize with AI'}</span>
              </button>
            </div>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400"
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe responsibilities, qualifications, and role impact... (Tip: Write a short draft and click 'Optimize with AI' to expand it into a professional listing!)"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">City *</label>
              <input
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g. Bengaluru"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">State</label>
              <input
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400"
                value={locationState}
                onChange={(e) => setLocationState(e.target.value)}
                placeholder="e.g. Karnataka"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Expires At</label>
              <input
                type="date"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Minimum Experience (years)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400"
                value={minExperienceYears}
                onChange={(e) => setMinExperienceYears(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Minimum CGPA</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400"
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value)}
                placeholder="e.g. 7.5"
              />
            </div>
          </div>

          {/* Required Skills */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Required Skills</label>
              <div className="text-[10px] font-bold text-slate-400">Add core skills with level</div>
            </div>
            <div className="flex flex-wrap md:flex-nowrap gap-2 mb-4">
              <input
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400 flex-1"
                placeholder="Skill name"
                value={reqSkillDraft.name}
                onChange={(e) => setReqSkillDraft(s => ({ ...s, name: e.target.value }))}
              />
              <select
                className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-semibold text-slate-700"
                value={reqSkillDraft.level}
                onChange={(e) => setReqSkillDraft(s => ({ ...s, level: e.target.value }))}
              >
                <option value="">Level</option>
                <option value="basic">Basic</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button
                type="button"
                onClick={addRequiredSkill}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl shadow-md transition-all active:scale-95 duration-200 text-xs font-bold"
              >
                <PlusCircle className="w-4 h-4 text-white" />
                <span>Add</span>
              </button>
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {requiredSkills.map((sk, idx) => (
                  <span key={idx} className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary-50 border border-primary-100 text-primary-750 text-xs font-bold shadow-sm">
                    <span>{sk.name}</span>
                    <span className="text-[10px] text-primary-500 font-medium">({sk.level})</span>
                    <button type="button" onClick={() => removeRequiredSkill(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Optional Skills */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Optional Skills</label>
              <div className="text-[10px] font-bold text-slate-400">Nice-to-have skills</div>
            </div>
            <div className="flex flex-wrap md:flex-nowrap gap-2 mb-4">
              <input
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-medium text-slate-800 placeholder-slate-400 flex-1"
                placeholder="Skill name"
                value={optSkillDraft.name}
                onChange={(e) => setOptSkillDraft(s => ({ ...s, name: e.target.value }))}
              />
              <select
                className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-semibold text-slate-700"
                value={optSkillDraft.level}
                onChange={(e) => setOptSkillDraft(s => ({ ...s, level: e.target.value }))}
              >
                <option value="">Level</option>
                <option value="basic">Basic</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button
                type="button"
                onClick={addOptionalSkill}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 text-slate-700 transition-all active:scale-95 duration-200 text-xs font-bold"
              >
                <PlusCircle className="w-4 h-4 text-slate-450" />
                <span>Add</span>
              </button>
            </div>
            {optionalSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {optionalSkills.map((sk, idx) => (
                  <span key={idx} className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-sm">
                    <span>{sk.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">({sk.level})</span>
                    <button type="button" onClick={() => removeOptionalSkill(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/employer/dashboard')}
              className="flex-1 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-750 active:scale-95 duration-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 duration-200 text-sm"
            >
              {submitting ? 'Submitting...' : 'Create Job'}
            </button>
          </div>
        </motion.form>
      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
