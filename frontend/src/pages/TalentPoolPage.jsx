import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import {
  Search, SlidersHorizontal, X, MapPin, Bookmark, BookmarkCheck,
  Sparkles, ChevronDown, Users, History, Star, ArrowRight,
  Briefcase, Filter, RotateCcw, Eye
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        </div>
        <div className="w-14 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
      </div>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        ))}
      </div>
      <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex-1 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="w-10 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Match Score Badge ────────────────────────────────────────────────────────
function MatchBadge({ score }) {
  // No score fabrication: when the backend returns no vector-match score
  // (text fallback), render an unscored badge instead of a random number.
  if (score === null || score === undefined) {
    return (
      <div className="flex flex-col items-center px-3 py-1.5 rounded-xl border bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700">
        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-0.5">
          <Sparkles size={10} /> Unscored
        </span>
      </div>
    )
  }
  const color =
    score >= 85 ? 'text-emerald-600 dark:text-emerald-400'
    : score >= 70 ? 'text-amber-600 dark:text-amber-400'
    : 'text-rose-500 dark:text-rose-400'

  const bg =
    score >= 85 ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700'
    : score >= 70 ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'
    : 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700'

  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl border ${bg}`}>
      <span className={`text-xl font-black leading-none ${color}`}>{Math.round(score)}%</span>
      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-0.5">
        <Sparkles size={10} /> AI Match
      </span>
    </div>
  )
}

// ─── Candidate Card ───────────────────────────────────────────────────────────
function CandidateCard({ candidate, onViewProfile, onShortlist, shortlisted }) {
  const score = candidate.match_score ?? candidate.score ?? null
  const topColor = score === null ? 'bg-gray-300 dark:bg-gray-600' : score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-400' : 'bg-rose-400'
  const name = candidate.name || candidate.full_name || 'Unknown Candidate'
  const role = candidate.current_role || candidate.desired_role || 'Professional'
  const location = candidate.location || 'Not specified'
  const skills = (candidate.skills || []).slice(0, 3)
  const summary = candidate.summary || candidate.professional_summary || ''
  const yearsExp = candidate.years_experience || candidate.experience_years || null
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2557a7&color=fff&size=96&bold=true`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden relative group"
    >
      {/* Score-colored top strip */}
      <div className={`h-1 w-full ${topColor}`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt={name}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 shrink-0"
            />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-[15px] leading-tight">{name}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{role}</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                <MapPin size={11} /> {location}
              </p>
            </div>
          </div>
          <MatchBadge score={score} />
        </div>

        {/* Summary */}
        {summary && (
          <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-3 leading-relaxed">
            {summary}
          </p>
        )}

        {/* Skills + Exp */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-600"
            >
              {skill}
            </span>
          ))}
          {yearsExp && (
            <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md text-xs font-medium border border-blue-200 dark:border-blue-700">
              {yearsExp} Yrs Exp
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => onViewProfile(candidate)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Eye size={14} /> View Profile
          </button>
          <button
            onClick={() => onShortlist(candidate)}
            title={shortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}
            className={`p-2 rounded-lg border font-semibold text-sm transition-all ${
              shortlisted
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
          >
            {shortlisted ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Filter Sidebar ───────────────────────────────────────────────────────────
const EXPERIENCE_LEVELS = [
  { label: 'Junior (0–2 yrs)', value: 'junior' },
  { label: 'Mid (3–5 yrs)', value: 'mid' },
  { label: 'Senior (6+ yrs)', value: 'senior' },
]
const SKILL_SUGGESTIONS = ['React', 'Python', 'TypeScript', 'Node.js', 'SQL', 'AWS', 'Java', 'Django', 'Flutter']
const LOCATION_OPTIONS = ['Any Location', 'Remote Only', 'Hybrid', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai']

function FilterSidebar({ filters, setFilters, onClear }) {
  const [skillInput, setSkillInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = SKILL_SUGGESTIONS.filter(
    s => s.toLowerCase().includes(skillInput.toLowerCase()) && !filters.skills.includes(s)
  )

  const addSkill = (skill) => {
    if (skill && !filters.skills.includes(skill)) {
      setFilters(f => ({ ...f, skills: [...f.skills, skill] }))
    }
    setSkillInput('')
    setShowSuggestions(false)
  }

  const removeSkill = (skill) => setFilters(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }))

  const toggleExp = (val) => {
    setFilters(f => ({
      ...f,
      experience: f.experience.includes(val) ? f.experience.filter(e => e !== val) : [...f.experience, val]
    }))
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Filter size={16} /> Filters
        </h2>
        <button
          onClick={onClear}
          className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center gap-1"
        >
          <RotateCcw size={13} /> Clear
        </button>
      </div>

      {/* Skills */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
          Skills & Technologies
        </label>
        <div className="relative mb-2">
          <input
            type="text"
            value={skillInput}
            onChange={e => { setSkillInput(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Add skill..."
            className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
              {suggestions.slice(0, 5).map(s => (
                <button
                  key={s}
                  onMouseDown={() => addSkill(s)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {filters.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {filters.skills.map(skill => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium"
              >
                {skill}
                <button onClick={() => removeSkill(skill)} className="hover:text-blue-900 dark:hover:text-white">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Experience */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
          Experience Level
        </label>
        <div className="space-y-2">
          {EXPERIENCE_LEVELS.map(level => (
            <label key={level.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.experience.includes(level.value)}
                onChange={() => toggleExp(level.value)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                {level.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
          Location
        </label>
        <select
          value={filters.location}
          onChange={e => setFilters(f => ({ ...f, location: e.target.value }))}
          className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
        >
          {LOCATION_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
        </select>
      </div>

      {/* Availability */}
      <div>
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-2">
          Availability
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-700 dark:text-gray-300">Immediately Available</span>
          <div
            onClick={() => setFilters(f => ({ ...f, available: !f.available }))}
            className={`relative w-10 h-5 rounded-full transition-colors ${filters.available ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${filters.available ? 'translate-x-5' : ''}`}
            />
          </div>
        </label>
      </div>
    </div>
  )
}

// ─── Recent Searches (session-local, real searches only) ─────────────────────
function RecentSearches({ onPick }) {
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('talent_recent_searches') || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    const handler = () => {
      try {
        setHistory(JSON.parse(sessionStorage.getItem('talent_recent_searches') || '[]'))
      } catch { /* ignore */ }
    }
    window.addEventListener('talent-search', handler)
    return () => window.removeEventListener('talent-search', handler)
  }, [])

  if (!history.length) return null

  return (
    <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2 mb-3">
        <History size={15} /> Recent Searches
      </h3>
      <div className="space-y-1.5">
        {history.map(s => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            <Search size={12} />
            <span className="truncate">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ query }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-6">
        <Users size={36} className="text-blue-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No candidates found</h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm leading-relaxed">
        {query
          ? `We couldn't find candidates matching "${query}". Try broadening your search or adjusting filters.`
          : 'Use the search bar above to discover talent. Try natural language like "Senior React developer open to remote".'}
      </p>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const SORT_OPTIONS = ['Match Score', 'Recent Activity', 'Experience', 'Name (A-Z)']

export default function TalentPoolPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const searchRef = useRef(null)

  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [sortBy, setSortBy] = useState('Match Score')
  const [shortlisted, setShortlisted] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [filters, setFilters] = useState({
    skills: [],
    experience: [],
    location: 'Any Location',
    available: false,
  })

  const clearFilters = () => setFilters({ skills: [], experience: [], location: 'Any Location', available: false })

  const handleSearch = useCallback(async (searchQuery = query) => {
    if (!searchQuery.trim()) return
    setLoading(true)
    setHasSearched(true)
    setSearchError(null)
    try {
      const res = await api.post('/api/search/semantic', {
        query: searchQuery,
        filters: {
          skills: filters.skills,
          location: filters.location !== 'Any Location' ? filters.location : null,
          experience: filters.experience,
        },
      })
      const data = res.data?.results || res.data?.candidates || []
      // Normalize: keep only real API data. No score fabrication — candidates
      // without a vector-match score are simply shown unscored.
      setCandidates(Array.isArray(data) ? data : [])
      try {
        const prev = JSON.parse(sessionStorage.getItem('talent_recent_searches') || '[]')
        const next = [searchQuery, ...prev.filter(s => s !== searchQuery)].slice(0, 5)
        sessionStorage.setItem('talent_recent_searches', JSON.stringify(next))
        window.dispatchEvent(new Event('talent-search'))
      } catch { /* ignore storage failures */ }
    } catch (err) {
      console.error('Search failed:', err)
      setCandidates([])
      setSearchError(
        err.response?.status === 403
          ? 'You do not have permission to search the talent pool.'
          : err.response?.data?.detail || 'Search is temporarily unavailable. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [query, filters])

  const sortedCandidates = [...candidates].sort((a, b) => {
    if (sortBy === 'Match Score') return (b.match_score ?? 0) - (a.match_score ?? 0)
    if (sortBy === 'Experience') return (b.years_experience ?? 0) - (a.years_experience ?? 0)
    if (sortBy === 'Name (A-Z)') return (a.name || '').localeCompare(b.name || '')
    return 0
  })

  const toggleShortlist = (candidate) => {
    const id = candidate.applicant_id || candidate.id
    setShortlisted(prev => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
        toast.info(`${candidate.name} removed from shortlist`)
      } else {
        next[id] = candidate
        toast.success(`${candidate.name} added to shortlist`)
      }
      return next
    })
  }

  const viewProfile = (candidate) => {
    navigate(`/employer/talent/${candidate.applicant_id || candidate.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* ─── Hero Search Header ─── */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-8 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Users className="text-blue-600" size={24} />
              Talent Pool
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Proactive candidate discovery powered by semantic AI matching.
            </p>
          </div>

          {/* Search bar with gradient glow */}
          <div className={`relative transition-all duration-300 ${focused ? 'drop-shadow-[0_0_18px_rgba(37,87,167,0.35)]' : ''}`}>
            <div className={`flex items-center bg-white dark:bg-gray-800 border-2 rounded-2xl overflow-hidden transition-all duration-300 ${
              focused
                ? 'border-blue-500 dark:border-blue-400 ring-4 ring-blue-500/10'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              <div className="pl-4 pr-2 flex items-center text-gray-400">
                <Search size={20} className={`transition-colors ${focused ? 'text-blue-500' : ''}`} />
              </div>
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. Senior React developer with 3+ years open to remote..."
                className="flex-1 bg-transparent py-4 px-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none text-base"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="px-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-7 py-4 transition-colors flex items-center gap-2 shrink-0"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Search</>
                )}
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors md:hidden"
            >
              <SlidersHorizontal size={14} /> Filters
              {(filters.skills.length + filters.experience.length + (filters.location !== 'Any Location' ? 1 : 0)) > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {filters.skills.length + filters.experience.length + (filters.location !== 'Any Location' ? 1 : 0)}
                </span>
              )}
            </button>
            {filters.experience.map(exp => (
              <span key={exp} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-200 dark:border-blue-700">
                <span className="capitalize">{exp}</span>
                <button onClick={() => setFilters(f => ({ ...f, experience: f.experience.filter(e => e !== exp) }))}><X size={12} /></button>
              </span>
            ))}
            {filters.skills.map(skill => (
              <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-200 dark:border-blue-700">
                {skill}
                <button onClick={() => setFilters(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }))}><X size={12} /></button>
              </span>
            ))}
            {filters.location !== 'Any Location' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm border border-blue-200 dark:border-blue-700">
                <MapPin size={12} /> {filters.location}
                <button onClick={() => setFilters(f => ({ ...f, location: 'Any Location' }))}><X size={12} /></button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Layout ─── */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">

        {/* Filter Sidebar — Desktop always visible, Mobile as drawer overlay */}
        <AnimatePresence>
          {(sidebarOpen || true) && (
            <aside className={`w-64 shrink-0 hidden md:block`}>
              <FilterSidebar filters={filters} setFilters={setFilters} onClear={clearFilters} />

              {/* Search history (session-local, real searches only) */}
              <RecentSearches onPick={(s) => { setQuery(s); handleSearch(s) }} />
            </aside>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Error banner */}
          {!loading && searchError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-4 mb-4 text-sm">
              {searchError}
            </div>
          )}
          {/* Sort bar */}
          {hasSearched && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {loading ? 'Searching…' : `Showing ${sortedCandidates.length} AI-matched candidate${sortedCandidates.length !== 1 ? 's' : ''}`}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-transparent border-none focus:ring-0 outline-none cursor-pointer"
                >
                  {SORT_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Results grid */}
          {!loading && hasSearched && sortedCandidates.length > 0 && (
            <motion.div
              layout
              className="grid grid-cols-1 xl:grid-cols-2 gap-4"
            >
              <AnimatePresence>
                {sortedCandidates.map(candidate => (
                  <CandidateCard
                    key={candidate.applicant_id || candidate.id || Math.random()}
                    candidate={candidate}
                    onViewProfile={viewProfile}
                    onShortlist={toggleShortlist}
                    shortlisted={!!shortlisted[candidate.applicant_id || candidate.id]}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Empty state */}
          {!loading && hasSearched && sortedCandidates.length === 0 && (
            <EmptyState query={query} />
          )}

          {/* Pre-search state */}
          {!loading && !hasSearched && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-xl shadow-blue-500/25">
                <Sparkles size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Discover Top Talent with AI
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md text-sm leading-relaxed mb-8">
                Use natural language to search for candidates. Our AI understands context, skills, and seniority to surface the best matches.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Senior React developer open to remote',
                  'Python ML engineer with 5+ years',
                  'Product designer with Figma skills',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => { setQuery(suggestion); handleSearch(suggestion) }}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center gap-1.5"
                  >
                    <Search size={12} /> {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right sidebar — Saved Talent (desktop) */}
        {Object.keys(shortlisted).length > 0 && (
          <aside className="w-64 shrink-0 hidden xl:block">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm sticky top-40">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2 mb-3">
                <BookmarkCheck size={15} className="text-blue-600" />
                Shortlisted ({Object.keys(shortlisted).length})
              </h3>
              <div className="space-y-2">
                {Object.values(shortlisted).map(c => (
                  <div
                    key={c.applicant_id || c.id}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => viewProfile(c)}
                  >
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || '')}&background=2557a7&color=fff&size=40&bold=true`}
                      className="w-8 h-8 rounded-full shrink-0"
                      alt={c.name}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-white truncate">{c.name}</div>
                      <div className="text-xs text-gray-400 truncate">{c.current_role}</div>
                    </div>
                    <ArrowRight size={14} className="text-gray-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-72 bg-white dark:bg-gray-900 shadow-2xl p-5 overflow-y-auto md:hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-gray-900 dark:text-white">Filters</span>
                <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <FilterSidebar filters={filters} setFilters={setFilters} onClear={clearFilters} />
              <button
                onClick={() => { setSidebarOpen(false); handleSearch() }}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Apply Filters
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
