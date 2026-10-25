import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase, Calendar, Sparkles, CheckCircle, XCircle,
  Send, PartyPopper, ChevronRight, BrainCircuit, Clock,
  ArrowRight, Zap, User, TrendingUp
} from 'lucide-react'
import api from '../config/api'
import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import { getApiError } from '../utils/apiError'

// Column definitions
const COLUMNS = [
  {
    id: 'applied',
    label: 'Applied',
    dotClass: 'bg-ink-subtle',
    badgeClass: 'bg-surface-sunken text-ink-muted',
    headerBorder: 'border-hairline',
    topBorder: '',
    emptyIcon: Send,
    emptyText: 'No applications yet',
  },
  {
    id: 'interviewing',
    label: 'Interviewing',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    headerBorder: 'border-blue-200 dark:border-blue-800',
    topBorder: 'border-t-4 border-t-blue-500',
    emptyIcon: Calendar,
    emptyText: 'No active interviews',
  },
  {
    id: 'offered',
    label: 'Offered',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    headerBorder: 'border-emerald-200 dark:border-emerald-800',
    topBorder: 'border-t-4 border-t-emerald-500',
    emptyIcon: PartyPopper,
    emptyText: 'No offers yet — keep going!',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    headerBorder: 'border-rose-200 dark:border-rose-800',
    topBorder: 'border-t-4 border-t-rose-500',
    emptyIcon: XCircle,
    emptyText: 'No rejections — great!',
  },
]

function mapStatusToColumn(status) {
  if (!status) return 'applied'
  const s = status.toLowerCase()
  if (s === 'offered') return 'offered'
  if (s === 'rejected') return 'rejected'
  if (s === 'interview' || s === 'reviewing') return 'interviewing'
  return 'applied'
}

function CompanyLogo({ company, logoUrl }) {
  const [imgError, setImgError] = useState(false)
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(company || 'C')}&background=random&size=40&bold=true`
  const src = (!imgError && logoUrl) ? logoUrl : fallback
  return (
    <div className="w-10 h-10 rounded-card overflow-hidden border border-hairline flex-shrink-0 bg-surface-raised">
      <img
        src={src}
        alt={company}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="surface-card p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-card bg-surface-sunken flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-sunken rounded-card w-3/4" />
          <div className="h-3 bg-surface-sunken rounded-card w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-surface-sunken rounded-card w-2/3 mb-3" />
      <div className="h-8 bg-surface-sunken rounded-card" />
    </div>
  )
}

function EmptyColumnCard({ col }) {
  const Icon = col.emptyIcon
  return (
    <div className="rounded-card border-2 border-dashed border-hairline p-6 flex flex-col items-center justify-center text-center gap-2">
      <Icon className="w-8 h-8 text-ink-subtle" />
      <p className="text-caption text-ink-subtle">{col.emptyText}</p>
    </div>
  )
}

function ApplicationCard({ app, colId, index, onPrepareAI, onUpdateStatus }) {
  const formattedDate = app.applied_date
    ? new Date(app.applied_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : app.created_at
    ? new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const interviewDate = app.interview_date
    ? new Date(app.interview_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const isInterviewing = colId === 'interviewing'
  const isOffered = colId === 'offered'
  const isRejected = colId === 'rejected'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`relative overflow-hidden surface-card p-4 transition-all duration-200 group cursor-default hover:border-hairline-strong ${
        isRejected ? 'opacity-70 dark:opacity-60' : ''
      }`}
    >
      {/* Column-specific top border accent */}
      {isInterviewing && (
        <>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400 rounded-t-panel" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-900/10 pointer-events-none rounded-panel" />
        </>
      )}
      {isOffered && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-t-panel" />
      )}
      {isRejected && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-rose-400 rounded-t-panel" />
      )}

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <CompanyLogo company={app.company || app.company_name} logoUrl={app.company_logo} />
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-caption text-ink leading-tight truncate" title={app.job_title || app.title}>
                {app.job_title || app.title || 'Job Position'}
              </h4>
              <p className="text-caption text-ink-muted truncate" title={app.company}>
                {app.company || 'Company'}
              </p>
            </div>
          </div>
        </div>

        {/* Status / date info */}
        {isInterviewing && (
          <div className="flex items-center gap-1.5 text-caption text-blue-600 dark:text-blue-400 mb-3">
            <Calendar className="w-3.5 h-3.5" />
            <span>{interviewDate ? `Interview: ${interviewDate}` : 'Interview Scheduled'}</span>
          </div>
        )}
        {isOffered && (
          <div className="flex items-center gap-1.5 text-caption text-emerald-600 dark:text-emerald-400 mb-3">
            <PartyPopper className="w-3.5 h-3.5" />
            <span>Offer Received!</span>
          </div>
        )}
        {isRejected && (
          <div className="flex items-center gap-1.5 text-caption text-rose-500 dark:text-rose-400 mb-3">
            <XCircle className="w-3.5 h-3.5" />
            <span>Not Selected</span>
          </div>
        )}
        {colId === 'applied' && formattedDate && (
          <div className="flex items-center gap-1.5 text-caption text-ink-muted mb-3">
            <Clock className="w-3.5 h-3.5" />
            <span>Applied {formattedDate}</span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 border-t border-hairline">
          {isInterviewing ? (
            <button
              onClick={() => onPrepareAI(app)}
              className="app-btn-primary app-btn-sm w-full flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Prepare with AI Coach
            </button>
          ) : isOffered ? (
            <div className="flex gap-2">
              <button
                onClick={() => onUpdateStatus(app.application_id, 'accepted')}
                className="flex-1 text-caption font-semibold py-2 rounded-card border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
              >
                Accept
              </button>
              <button
                onClick={() => onUpdateStatus(app.application_id, 'rejected')}
 className="flex-1 text-caption font-semibold py-2 rounded-card border border-hairline text-ink-muted hov-surface transition-colors cursor-pointer"
              >
                Decline
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Link to={`/job/${app.job_id}`} className="flex items-center gap-1 text-caption text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">
                View Details <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function MyApplicationsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApplications()
  }, [])

  async function fetchApplications() {
    try {
      setLoading(true)
      const res = await api.get('/api/student/applications/jobs')
      const data = Array.isArray(res.data) ? res.data : (res.data?.applications || res.data?.jobs || [])
      setApplications(data)
    } catch (err) {
      console.error('Failed to load applications:', err)
      toast.error('Failed to load applications. Please try again.')
      setApplications([])
    } finally {
      setLoading(false)
    }
  }

  const grouped = useMemo(() => {
    const map = { applied: [], interviewing: [], offered: [], rejected: [] }
    applications.forEach(app => {
      const col = mapStatusToColumn(app.status)
      map[col].push(app)
    })
    return map
  }, [applications])

  const recentActivity = useMemo(() => {
    return [...applications]
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 5)
      .map(app => {
        const col = mapStatusToColumn(app.status)
        const icons = { applied: Send, interviewing: Calendar, offered: PartyPopper, rejected: XCircle }
        const colors = {
          applied: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
          interviewing: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
          offered: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
          rejected: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
        }
        const descriptions = {
          applied: `Applied to ${app.job_title || 'position'} at ${app.company || 'company'}`,
          interviewing: `Interview scheduled with ${app.company || 'company'}`,
          offered: `Offer received from ${app.company || 'company'}`,
          rejected: `Application to ${app.company || 'company'} not selected`,
        }
        const date = app.updated_at || app.created_at
        const timeStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
        return { ...app, col, Icon: icons[col], colorClass: colors[col], description: descriptions[col], timeStr }
      })
  }, [applications])

  const upcomingInterviews = useMemo(() => grouped.interviewing.slice(0, 3), [grouped])

  function handlePrepareAI(app) {
    toast.info(`Opening AI Coach to prepare for ${app.job_title || 'your interview'}...`)
    navigate('/dashboard/interview')
  }

  const handleUpdateStatus = async (appId, newStatus) => {
    try {
      await api.patch(`/api/student/applications/${appId}/status`, { status: newStatus })
      toast.success(`Application status updated successfully.`)
      fetchApplications()
    } catch (err) {
      console.error(err)
      toast.error(getApiError(err, 'Failed to update status. Please try again.'))
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink font-body">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <p className="eyebrow mb-2">Applications</p>
          <h1 className="app-page-title">
            My Applications
          </h1>
          <p className="app-page-subtitle">
            Track your job application progress and upcoming interviews.
          </p>
        </motion.div>

        {/* Main 70/30 Layout */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* === LEFT: Main Kanban Pane (70%) === */}
          <div className="w-full lg:w-[70%] flex flex-col gap-8">

            {/* Kanban Board */}
            <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 min-w-[640px]">
                {COLUMNS.map((col) => (
                  <div key={col.id} className="flex flex-col gap-3">
                    {/* Column Header */}
                    <div className={`flex items-center justify-between pb-3 border-b ${col.headerBorder}`}>
                      <h3 className="font-semibold text-caption text-ink flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-pill ${col.dotClass}`} />
                        {col.label}
                      </h3>
                      <span className={`text-caption font-bold px-2 py-0.5 rounded-pill ${col.badgeClass}`}>
                        {loading ? '—' : grouped[col.id].length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex flex-col gap-3">
                      {loading ? (
                        [0, 1, 2].map(i => <SkeletonCard key={i} />)
                      ) : grouped[col.id].length === 0 ? (
                        <EmptyColumnCard col={col} />
                      ) : (
                        grouped[col.id].map((app, idx) => (
                          <ApplicationCard
                            key={app.id || idx}
                            app={app}
                            colId={col.id}
                            index={idx}
                            onPrepareAI={handlePrepareAI}
                            onUpdateStatus={handleUpdateStatus}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <h3 className="app-section-title mb-4">
                Recent Activity
              </h3>
              <div className="surface-card overflow-hidden">
                {loading ? (
                  <div className="divide-y divide-hairline">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                        <div className="w-8 h-8 rounded-pill bg-surface-sunken" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-surface-sunken rounded-card w-3/4" />
                          <div className="h-3 bg-surface-sunken rounded-card w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="p-8 text-center text-ink-subtle">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No activity yet. Start applying!</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-hairline">
                    {recentActivity.map((item, idx) => {
                      const rowContent = (
                        <>
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-pill flex items-center justify-center flex-shrink-0 ${item.colorClass}`}>
                              <item.Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-caption text-ink">{item.description}</p>
                              {item.timeStr && (
                                <p className="text-caption text-ink-subtle">{item.timeStr}</p>
                              )}
                            </div>
                          </div>
                          {item.job_id && <ChevronRight className="w-4 h-4 text-ink-subtle flex-shrink-0" />}
                        </>
                      )
                      return (
                        <motion.li
                          key={item.id || idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="p-4 hov-surface transition-colors flex items-center justify-between"
                        >
                          {item.job_id ? (
                            <Link to={`/job/${item.job_id}`} className="flex items-center justify-between w-full">
                              {rowContent}
                            </Link>
                          ) : (
                            rowContent
                          )}
                        </motion.li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT: Sidebar (30%) — sticky rail on lg+ (static below lg where the layout stacks) */}
          <aside className="w-full lg:w-[30%] flex flex-col gap-5 lg:sticky lg:top-6 self-start">

            {/* Upcoming Interviews */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="surface-card p-5"
            >
              <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                Upcoming Interviews
              </h3>
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  {[0, 1].map(i => (
                    <div key={i} className="flex gap-3">
                      <div className="w-10 h-10 rounded-card bg-surface-sunken flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-surface-sunken rounded-card w-3/4" />
                        <div className="h-3 bg-surface-sunken rounded-card w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingInterviews.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-ink-subtle" />
                  <p className="text-caption text-ink-subtle">No upcoming interviews</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {upcomingInterviews.map((app, idx) => (
                    <li key={app.id || idx} className="flex gap-3 items-start">
                      <div className="w-10 h-10 rounded-card bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-caption font-semibold text-ink truncate">
                          {app.job_title || app.title}
                        </h4>
                        <p className="text-caption text-ink-muted truncate">
                          {app.company}
                          {app.interview_date && ` • ${new Date(app.interview_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        </p>
                        <button
                          onClick={() => handlePrepareAI(app)}
                          className="text-caption text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block font-medium"
                        >
                          Prepare with AI Coach
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>

            {/* AI Coach Activity / Recommended Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="surface-card p-5"
            >
              <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Recommended Actions
              </h3>
              <ul className="space-y-2">
                {[
                  { Icon: BrainCircuit, label: 'Practice for technical round', color: 'text-yellow-500', to: '/dashboard/interview' },
                  { Icon: User, label: 'Finish your profile', color: 'text-blue-500', to: '/student/profile' },
                  { Icon: TrendingUp, label: 'Review job recommendations', color: 'text-emerald-500', to: '/jobs' },
                ].map(({ Icon, label, color, to }, idx) => (
                  <li
                    key={idx}
 className="p-0 border border-hairline rounded-card hov-surface cursor-pointer transition-colors group"
                  >
                    <Link to={to} className="flex items-center justify-between p-3 w-full h-full">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className="text-caption text-ink-muted">{label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-ink-subtle group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Quick stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-panel bg-primary-800 p-5 shadow-soft-sm text-white"
            >
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Application Summary
              </h3>
              {loading ? (
                <div className="space-y-2 animate-pulse">
                  {[0, 1, 2].map(i => <div key={i} className="h-4 bg-primary-700/50 rounded-card" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total', val: applications.length, color: 'text-blue-100' },
                    { label: 'Interviewing', val: grouped.interviewing.length, color: 'text-blue-200' },
                    { label: 'Offered', val: grouped.offered.length, color: 'text-emerald-300' },
                    { label: 'Rejected', val: grouped.rejected.length, color: 'text-rose-300' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-primary-700/50 rounded-card p-3">
                      <p className={`text-title-lg font-bold ${color}`}>{val}</p>
                      <p className="text-caption text-white/70">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </aside>
        </div>
      </div>
    </div>
  )
}
