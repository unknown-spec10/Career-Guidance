import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  UserCheck,
  Flag,
  Ban,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Edit2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  X,
  CreditCard,
  Clock,
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

// ─── Helper Functions ────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_STATS = { total: 12450, active: 11200, flagged: 45, suspended: 205 }

const MOCK_USERS = [
  {
    id: 1,
    name: 'Marcus Johnson',
    email: 'mjohnson@university.edu',
    role: 'student',
    status: 'active',
    joined_at: '2023-10-12',
    last_activity_at: new Date(Date.now() - 7200000).toISOString(),
    last_activity_desc: 'Updated resume',
    credits_used: 150,
    credits_max: 200,
  },
  {
    id: 2,
    name: 'Sarah Williams',
    email: 'sarah@techcorp.com',
    role: 'employer',
    status: 'suspended',
    joined_at: '2024-01-05',
    last_activity_at: new Date(Date.now() - 259200000).toISOString(),
    last_activity_desc: 'Failed login attempt',
    credits_used: 50,
    credits_max: 500,
  },
  {
    id: 3,
    name: 'David Rodriguez',
    email: 'admin@careersync.ai',
    role: 'admin',
    status: 'active',
    joined_at: '2022-08-01',
    last_activity_at: new Date().toISOString(),
    last_activity_desc: 'System settings update',
    credits_used: null,
    credits_max: null,
  },
  {
    id: 4,
    name: 'Priya Sharma',
    email: 'priya.sharma@college.edu',
    role: 'student',
    status: 'active',
    joined_at: '2024-03-15',
    last_activity_at: new Date(Date.now() - 3600000).toISOString(),
    last_activity_desc: 'Viewed job listings',
    credits_used: 30,
    credits_max: 200,
  },
  {
    id: 5,
    name: 'James Carter',
    email: 'james@startupxyz.io',
    role: 'employer',
    status: 'active',
    joined_at: '2023-11-20',
    last_activity_at: new Date(Date.now() - 86400000).toISOString(),
    last_activity_desc: 'Posted new job',
    credits_used: 300,
    credits_max: 500,
  },
  {
    id: 6,
    name: 'Emily Chen',
    email: 'emily.chen@uni.edu',
    role: 'student',
    status: 'flagged',
    joined_at: '2024-02-10',
    last_activity_at: new Date(Date.now() - 43200000).toISOString(),
    last_activity_desc: 'Multiple failed uploads',
    credits_used: 5,
    credits_max: 200,
  },
  {
    id: 7,
    name: 'Robert Kim',
    email: 'rkim@megacorp.com',
    role: 'employer',
    status: 'active',
    joined_at: '2023-07-22',
    last_activity_at: new Date(Date.now() - 172800000).toISOString(),
    last_activity_desc: 'Reviewed applicants',
    credits_used: 420,
    credits_max: 500,
  },
]

// ─── Role Avatar Colors ───────────────────────────────────────────────────────

const ROLE_AVATAR_BG = {
  student: 'bg-blue-500',
  employer: 'bg-teal-500',
  admin: 'bg-slate-500',
}

const ROLE_BADGE = {
  student:
    'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  employer:
    'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  admin:
    'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, iconBg, trend }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
          {value.toLocaleString()}
        </p>
        {trend && (
          <p className="text-xs text-emerald-500 font-medium mt-0.5">
            ↑ {trend}
          </p>
        )}
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-700">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

function UserAvatar({ user }) {
  if (user.profile_image) {
    return (
      <img
        src={user.profile_image}
        alt={user.name}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      />
    )
  }
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
        ROLE_AVATAR_BG[user.role] || 'bg-slate-500'
      }`}
    >
      {getInitials(user.name)}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="w-3.5 h-3.5" />
        Active
      </span>
    )
  }
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400">
        <XCircle className="w-3.5 h-3.5" />
        Suspended
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500 dark:text-amber-400">
      <Flag className="w-3.5 h-3.5" />
      Flagged
    </span>
  )
}

function ToggleSwitch({ checked, onChange, loading }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={loading}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out mt-0.5 ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function CreditsCell({ user }) {
  if (user.role === 'admin' || user.credits_max === null) {
    return (
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 italic">
        Unlimited
      </span>
    )
  }
  const pct = Math.min(100, Math.round((user.credits_used / user.credits_max) * 100))
  return (
    <div className="min-w-[90px]">
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
        <span>{user.credits_used}</span>
        <span className="text-slate-400">/{user.credits_max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-purple-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Suspend / Activate Confirmation Modal ───────────────────────────────────

function ConfirmModal({ user, onConfirm, onCancel, loading }) {
  const isSuspending = user.status === 'active' || user.status === 'flagged'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isSuspending ? 'bg-red-100 dark:bg-red-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'
            }`}
          >
            {isSuspending ? (
              <Ban className="w-6 h-6 text-red-500 dark:text-red-400" />
            ) : (
              <CheckCircle className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isSuspending ? 'Suspend User?' : 'Activate User?'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user.name}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
          {isSuspending
            ? `Suspending ${user.name} will immediately revoke their access. They will not be able to log in until reactivated.`
            : `Activating ${user.name} will restore their full access to the platform.`}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white flex items-center gap-2 transition-colors disabled:opacity-60 ${
              isSuspending
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSuspending ? 'Yes, Suspend' : 'Yes, Activate'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Credits Adjust Modal ─────────────────────────────────────────────────────

function CreditsModal({ user, onConfirm, onCancel, loading }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount))) return
    onConfirm({ user_id: user.id, amount: Number(amount), reason })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <motion.div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Adjust Credits</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {user.credits_max !== null && (
          <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-600 dark:text-slate-300">
            Current credits: <span className="font-semibold text-purple-600 dark:text-purple-400">{user.credits_used}</span>
            <span className="text-slate-400"> / {user.credits_max}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Amount <span className="font-normal text-slate-400">(positive = add, negative = deduct)</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50 or -20"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Reason <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Admin note for this adjustment..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Apply
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Activity Log Modal ───────────────────────────────────────────────────────

function ActivityModal({ user, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .get(`/api/admin/users/${user.id}/activity`)
      .then((res) => {
        if (!cancelled) setLogs(res.data?.activities || res.data || [])
      })
      .catch(() => {
        if (!cancelled) {
          // Fallback mock logs
          setLogs([
            { id: 1, action: user.last_activity_desc || 'Viewed dashboard', timestamp: user.last_activity_at, ip: '192.168.1.1' },
            { id: 2, action: 'Logged in', timestamp: new Date(Date.now() - 86400000).toISOString(), ip: '192.168.1.1' },
            { id: 3, action: 'Updated profile', timestamp: new Date(Date.now() - 172800000).toISOString(), ip: '10.0.0.5' },
          ])
          setError(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [user.id])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Activity Log</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-96 overflow-y-auto space-y-2">
          {loading && (
            <>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />
              ))}
            </>
          )}
          {!loading && error && (
            <div className="text-center py-6 text-sm text-red-500">{error}</div>
          )}
          {!loading && !error && logs.length === 0 && (
            <div className="text-center py-6 text-sm text-slate-400">No activity found.</div>
          )}
          {!loading &&
            logs.map((log, idx) => (
              <div
                key={log.id ?? idx}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {log.action}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400">{timeAgo(log.timestamp)}</span>
                    {log.ip && (
                      <span className="text-xs text-slate-400 font-mono">IP: {log.ip}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ROLE_TABS = ['all', 'student', 'employer', 'admin']
const ROLE_TAB_LABELS = { all: 'All', student: 'Students', employer: 'Employers', admin: 'Admins' }

export default function UserManagementPage() {
  const { addToast } = useToast()

  // Data state
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(MOCK_STATS)
  const [totalUsers, setTotalUsers] = useState(0)
  const [usersLoading, setUsersLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const LIMIT = 10

  // Modals
  const [confirmModal, setConfirmModal] = useState(null) // { user }
  const [creditsModal, setCreditsModal] = useState(null) // { user }
  const [activityModal, setActivityModal] = useState(null) // { user }

  // Loading flags
  const [toggleLoadingId, setToggleLoadingId] = useState(null)
  const [creditsLoading, setCreditsLoading] = useState(false)

  // Debounce ref
  const searchTimerRef = useRef(null)

  // ── Fetch Stats ──────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/stats')
      const d = res.data
      setStats({
        total: d.total_users ?? MOCK_STATS.total,
        active: d.active_users ?? MOCK_STATS.active,
        flagged: d.flagged_users ?? MOCK_STATS.flagged,
        suspended: d.suspended_users ?? MOCK_STATS.suspended,
      })
    } catch {
      setStats(MOCK_STATS)
    }
  }, [])

  // ── Fetch Users ──────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(
    async (currentPage = page, currentSearch = search) => {
      setUsersLoading(true)
      try {
        const params = {
          page: currentPage,
          limit: LIMIT,
          ...(roleFilter !== 'all' && { role: roleFilter }),
          ...(statusFilter && { status: statusFilter }),
          ...(currentSearch && { search: currentSearch }),
        }
        const res = await api.get('/api/admin/users', { params })
        const data = res.data
        if (data?.users?.length) {
          setUsers(data.users)
          setTotalUsers(data.total ?? data.users.length)
        } else {
          throw new Error('empty')
        }
      } catch {
        // Apply client-side mock filtering
        let filtered = [...MOCK_USERS]
        if (roleFilter !== 'all') filtered = filtered.filter((u) => u.role === roleFilter)
        if (statusFilter) filtered = filtered.filter((u) => u.status === statusFilter)
        if (currentSearch) {
          const q = currentSearch.toLowerCase()
          filtered = filtered.filter(
            (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
          )
        }
        setTotalUsers(filtered.length)
        const start = (currentPage - 1) * LIMIT
        setUsers(filtered.slice(start, start + LIMIT))
      } finally {
        setUsersLoading(false)
      }
    },
    [page, search, roleFilter, statusFilter]
  )

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchUsers(page, search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, statusFilter])

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPage(1)
      fetchUsers(1, search)
    }, 300)
    return () => clearTimeout(searchTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter])

  // ── Toggle Active ─────────────────────────────────────────────────────────────

  const handleToggleClick = (user) => {
    setConfirmModal({ user })
  }

  const handleConfirmToggle = async () => {
    const { user } = confirmModal
    const newStatus = user.status === 'active' ? 'suspended' : 'active'

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    )
    setConfirmModal(null)
    setToggleLoadingId(user.id)

    try {
      await api.post(`/api/admin/users/${user.id}/toggle-active`)
      addToast({
        type: 'success',
        message: `${user.name} has been ${newStatus === 'active' ? 'activated' : 'suspended'}.`,
      })
    } catch {
      // Revert
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: user.status } : u))
      )
      addToast({ type: 'error', message: 'Failed to update user status. Please try again.' })
    } finally {
      setToggleLoadingId(null)
    }
  }

  // ── Adjust Credits ────────────────────────────────────────────────────────────

  const handleCreditsConfirm = async ({ user_id, amount, reason }) => {
    setCreditsLoading(true)
    try {
      await api.post('/api/admin/credits/adjust', { user_id, amount, reason })
      addToast({ type: 'success', message: 'Credits adjusted successfully.' })
      setCreditsModal(null)
      fetchUsers(page, search)
    } catch {
      addToast({ type: 'error', message: 'Failed to adjust credits. Please try again.' })
    } finally {
      setCreditsLoading(false)
    }
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(totalUsers / LIMIT))
  const pageStart = (page - 1) * LIMIT + 1
  const pageEnd = Math.min(page * LIMIT, totalUsers)

  const getPageNumbers = () => {
    if (totalPages <= 5) return [...Array(totalPages)].map((_, i) => i + 1)
    if (page <= 3) return [1, 2, 3, 4, 5]
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [page - 2, page - 1, page, page + 1, page + 2]
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <ToastContainer />

      {/* ── Page Header ── */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          User Management Center
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monitor, manage, and moderate all platform users.
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <KpiCard icon={Users} label="Total Users" value={stats.total} iconBg="bg-blue-500" trend="+3.2% this month" />
        <KpiCard icon={UserCheck} label="Active Users" value={stats.active} iconBg="bg-emerald-500" trend="+1.8% this week" />
        <KpiCard icon={Flag} label="Flagged Accounts" value={stats.flagged} iconBg="bg-amber-500" />
        <KpiCard icon={Ban} label="Suspended" value={stats.suspended} iconBg="bg-red-500" />
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mb-5 flex flex-col sm:flex-row gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Role Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1 flex-shrink-0">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setRoleFilter(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                roleFilter === tab
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {ROLE_TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700">
                {['User', 'Role', 'Status', 'Joined', 'Last Activity', 'AI Credits', 'Actions'].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {usersLoading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <UserAvatar user={user} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[130px]">
                              {user.name}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[130px]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            ROLE_BADGE[user.role] || ROLE_BADGE.admin
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={user.status} />
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(user.joined_at)}
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {timeAgo(user.last_activity_at)}
                        </p>
                        <p className="text-xs text-slate-400 max-w-[140px] truncate">
                          {user.last_activity_desc}
                        </p>
                      </td>

                      {/* AI Credits */}
                      <td className="px-4 py-3">
                        <CreditsCell user={user} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* View Logs */}
                          <button
                            title="View Activity Log"
                            onClick={() => setActivityModal({ user })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                          >
                            <Activity className="w-4 h-4" />
                          </button>

                          {/* Adjust Credits (non-admin only) */}
                          {user.role !== 'admin' && (
                            <button
                              title="Adjust Credits"
                              onClick={() => setCreditsModal({ user })}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Toggle Active */}
                          <ToggleSwitch
                            checked={user.status === 'active'}
                            onChange={() => handleToggleClick(user)}
                            loading={toggleLoadingId === user.id}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}

              {/* Empty state */}
              {!usersLoading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        No users match your filters
                      </p>
                      <button
                        onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('') }}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {!usersLoading && totalUsers > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{pageStart}</span> to{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{pageEnd}</span> of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{totalUsers.toLocaleString()}</span> results
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {getPageNumbers().map((num) => (
              <button
                key={num}
                onClick={() => setPage(num)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                  page === num
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {confirmModal && (
          <ConfirmModal
            key="confirm-modal"
            user={confirmModal.user}
            onConfirm={handleConfirmToggle}
            onCancel={() => setConfirmModal(null)}
            loading={toggleLoadingId === confirmModal.user.id}
          />
        )}
        {creditsModal && (
          <CreditsModal
            key="credits-modal"
            user={creditsModal.user}
            onConfirm={handleCreditsConfirm}
            onCancel={() => setCreditsModal(null)}
            loading={creditsLoading}
          />
        )}
        {activityModal && (
          <ActivityModal
            key="activity-modal"
            user={activityModal.user}
            onClose={() => setActivityModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
