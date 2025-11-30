import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Briefcase, PlusCircle, Trash2, LogOut, AlertTriangle, CheckCircle } from 'lucide-react'
import api from '../config/api'

export default function EmployerPostJob() {
  const navigate = useNavigate()
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

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }

  const addRequiredSkill = () => {
    if (!reqSkillDraft.name.trim()) return
    setRequiredSkills(prev => [...prev, { name: reqSkillDraft.name.trim(), level: reqSkillDraft.level || 'basic' }])
    setReqSkillDraft({ name: '', level: '' })
  }

  const removeRequiredSkill = (idx) => {
    setRequiredSkills(prev => prev.filter((_, i) => i !== idx))
  }

  const addOptionalSkill = () => {
    if (!optSkillDraft.name.trim()) return
    setOptionalSkills(prev => [...prev, { name: optSkillDraft.name.trim(), level: optSkillDraft.level || 'basic' }])
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
        title,
        description,
        location_city: locationCity,
        location_state: locationState || null,
        work_type: workType,
        min_experience_years: Number(minExperienceYears) || 0,
        min_cgpa: minCgpa ? Number(minCgpa) : null,
        required_skills: requiredSkills.length ? requiredSkills : null,
        optional_skills: optionalSkills.length ? optionalSkills : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
      }

      const res = await api.post('/api/employer/jobs', payload)
      setSuccess(true)
      setTimeout(() => {
        navigate('/employer/dashboard')
      }, 1000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create job')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2"><Briefcase className="w-8 h-8 text-primary-400" /> Post a New Job</h1>
            <p className="text-gray-400">Fill out the details below. Job will be pending admin approval.</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card space-y-6"
        >
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-5 h-5" /> {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-900/20 border border-green-500/30 rounded flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-5 h-5" /> Job created! Redirecting...
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Job Title *</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Developer"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Work Type *</label>
              <select
                className="input"
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
            <label className="block text-sm font-medium mb-2">Description *</label>
            <textarea
              className="input"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe responsibilities, qualifications, and role impact..."
              required
            />
          </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">City *</label>
                <input
                  className="input"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">State</label>
                <input
                  className="input"
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value)}
                  placeholder="e.g. Karnataka"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Expires At</label>
                <input
                  type="date"
                  className="input"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Experience (years)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                className="input"
                value={minExperienceYears}
                onChange={(e) => setMinExperienceYears(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Minimum CGPA</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                className="input"
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value)}
                placeholder="e.g. 7.5"
              />
            </div>
          </div>

          {/* Required Skills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Required Skills</label>
              <div className="text-xs text-gray-500">Add core skills with level</div>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className="input flex-1"
                placeholder="Skill name"
                value={reqSkillDraft.name}
                onChange={(e) => setReqSkillDraft(s => ({ ...s, name: e.target.value }))}
              />
              <select
                className="input w-32"
                value={reqSkillDraft.level}
                onChange={(e) => setReqSkillDraft(s => ({ ...s, level: e.target.value }))}
              >
                <option value="">Level</option>
                <option value="basic">Basic</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button type="button" onClick={addRequiredSkill} className="px-3 py-2 rounded bg-primary-600 hover:bg-primary-500 text-sm flex items-center gap-1">
                <PlusCircle className="w-4 h-4" /> Add
              </button>
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {requiredSkills.map((sk, idx) => (
                  <span key={idx} className="group px-2 py-1 text-xs rounded border border-primary-500/40 bg-primary-900/20 flex items-center gap-1">
                    {sk.name} <em className="text-primary-300 not-italic">({sk.level})</em>
                    <button type="button" onClick={() => removeRequiredSkill(idx)} className="opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Optional Skills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Optional Skills</label>
              <div className="text-xs text-gray-500">Nice-to-have skills</div>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                className="input flex-1"
                placeholder="Skill name"
                value={optSkillDraft.name}
                onChange={(e) => setOptSkillDraft(s => ({ ...s, name: e.target.value }))}
              />
              <select
                className="input w-32"
                value={optSkillDraft.level}
                onChange={(e) => setOptSkillDraft(s => ({ ...s, level: e.target.value }))}
              >
                <option value="">Level</option>
                <option value="basic">Basic</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <button type="button" onClick={addOptionalSkill} className="px-3 py-2 rounded bg-dark-700 hover:bg-dark-600 text-sm flex items-center gap-1 border border-dark-600">
                <PlusCircle className="w-4 h-4" /> Add
              </button>
            </div>
            {optionalSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {optionalSkills.map((sk, idx) => (
                  <span key={idx} className="group px-2 py-1 text-xs rounded border border-dark-600 bg-dark-800 flex items-center gap-1">
                    {sk.name} <em className="text-gray-400 not-italic">({sk.level})</em>
                    <button type="button" onClick={() => removeOptionalSkill(idx)} className="opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? 'Submitting...' : 'Create Job'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/employer/dashboard')}
              className="px-6 py-2 border border-dark-600 rounded-lg hover:bg-dark-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  )
}
