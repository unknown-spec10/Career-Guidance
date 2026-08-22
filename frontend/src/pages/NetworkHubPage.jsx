import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Coffee, Bookmark, BookmarkCheck,
  Sparkles, RotateCcw, AlertCircle
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const BOOKMARKS_KEY = 'mentor_bookmarks'

export default function NetworkHubPage() {
  const toast = useToast()
  const [mentors, setMentors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [bookmarkedMentors, setBookmarkedMentors] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [requestedMentors, setRequestedMentors] = useState([])

  useEffect(() => {
    let cancelled = false
    const fetchMentors = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get('/api/mentors')
        if (!cancelled) setMentors(res.data?.mentors || [])
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load mentors:', err)
          setError('Failed to load mentors. Please try again.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMentors()
    return () => { cancelled = true }
  }, [])

  const handleToggleBookmark = (id) => {
    setBookmarkedMentors(prev => {
      const next = prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
      try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      toast.success(prev.includes(id) ? 'Removed mentor from bookmarks' : 'Saved mentor to bookmarks')
      return next
    })
  }

  const handleRequestChat = useCallback(async (mentor) => {
    if (requestedMentors.includes(mentor.id)) {
      toast.error(`You already requested a chat with this mentor.`)
      return
    }
    try {
      await api.post('/api/mentor-requests', {
        mentor_id: mentor.id,
        message: 'I would like to request a coffee chat.',
      })
      setRequestedMentors(prev => [...prev, mentor.id])
      toast.success(`Request sent! We will notify you when the mentor confirms.`)
    } catch (err) {
      console.error('Mentor request failed:', err)
      toast.error(err.response?.data?.detail || 'Failed to send request.')
    }
  }, [requestedMentors, toast])

  // Filtering Logic
  const filteredMentors = mentors.filter(mentor => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      (mentor.role || '').toLowerCase().includes(q) ||
      (mentor.company || '').toLowerCase().includes(q) ||
      (mentor.skills || []).some(skill => skill.toLowerCase().includes(q))

    return matchesSearch
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Info banner */}
        <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 flex items-center gap-3 text-blue-600 dark:text-blue-400">
          <Sparkles className="shrink-0" size={20} />
          <div className="text-sm font-medium">
            <span className="font-bold">Full Mentor Matching coming soon:</span> Our AI matching algorithm will analyze your parsed resume, suggest optimal networking targets, and unlock direct connections.
          </div>
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 dark:from-primary-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Alumni &amp; Mentorship Hub
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Connect with experienced industry professionals and university alumni to scale your career journey.
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search mentors by role, company, skill..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Error banner */}
        {!loading && error && (
          <div className="bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 rounded-xl p-4 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
            <button onClick={() => window.location.reload()} className="font-bold underline">Retry</button>
          </div>
        )}

        {/* Empty state — honest, no fabricated personas */}
        {!loading && !error && filteredMentors.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary-500/10 flex items-center justify-center mb-6">
              <Coffee size={36} className="text-primary-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">Mentor matching isn&apos;t available yet</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md text-sm leading-relaxed">
              No mentors have joined the network so far. We&apos;re building AI-powered mentor matching —
              check back soon, or keep practicing mock interviews to strengthen your profile.
            </p>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 max-w-3xl">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm animate-pulse space-y-3">
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Mentor list — real records only */}
        {!loading && filteredMentors.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              {filteredMentors.map((mentor) => {
                const isBookmarked = bookmarkedMentors.includes(mentor.id)
                const hasRequested = requestedMentors.includes(mentor.id)
                const initials = (mentor.company || 'M').slice(0, 2).toUpperCase()
                return (
                  <motion.div
                    key={mentor.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 text-white font-black flex items-center justify-center shrink-0 text-lg">
                        {initials}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                            {mentor.role || 'Industry Mentor'}
                          </h3>
                          {typeof mentor.match_score === 'number' && mentor.match_score > 0 && (
                            <span className="text-[10px] font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded flex items-center gap-0.5">
                              <Sparkles size={10} /> {mentor.match_score}% Match
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {mentor.company || 'Independent'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {mentor.alumni_year ? `Class of ${mentor.alumni_year}` : 'Industry Mentor'} •{' '}
                          <span className="text-emerald-500 font-semibold">{mentor.status || 'Available'}</span>
                        </p>
                      </div>
                    </div>

                    {mentor.bio && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">{mentor.bio}</p>
                    )}

                    {(mentor.skills || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {mentor.skills.map((skill, idx) => (
                          <span key={idx} className="text-xs bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                      <button
                        onClick={() => handleRequestChat(mentor)}
                        disabled={hasRequested}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          hasRequested
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-primary-600 hover:bg-primary-700 text-white dark:bg-primary-500 dark:hover:bg-primary-600'
                        }`}
                      >
                        <Coffee size={14} />
                        {hasRequested ? 'Chat Requested' : 'Request Coffee Chat'}
                      </button>
                      <button
                        onClick={() => handleToggleBookmark(mentor.id)}
                        aria-label={isBookmarked ? 'Remove bookmark' : 'Save bookmark'}
                        className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
                      >
                        {isBookmarked ? (
                          <BookmarkCheck size={16} className="text-primary-500" />
                        ) : (
                          <Bookmark size={16} className="text-slate-400" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
