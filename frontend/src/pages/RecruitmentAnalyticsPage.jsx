import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Zap, Handshake, Briefcase, BarChart2, PieChart, Target,
  Award, ChevronRight, RefreshCw, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 p-6 animate-pulse">
      <div className="h-3 w-24 bg-slate-700 rounded mb-4" />
      <div className="h-9 w-20 bg-slate-700 rounded mb-2" />
      <div className="h-3 w-32 bg-slate-700 rounded" />
    </div>
  )
}

// ─── KPI Metric Card ─────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, trend, trendLabel, icon: Icon, accentColor, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="relative bg-slate-800/70 backdrop-blur-sm rounded-2xl border border-slate-700/60 p-6 hover:border-slate-600/80 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${accentColor}20 0%, transparent 60%)` }}
      />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] font-mono">{label}</span>
          <div className="p-1.5 rounded-lg" style={{ background: `${accentColor}25` }}>
            <Icon size={16} style={{ color: accentColor }} />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-4xl font-black text-white tracking-tight font-mono">{value}</span>
          {unit && <span className="text-slate-400 text-sm font-medium">{unit}</span>}
        </div>
        <div className={`flex items-center gap-1.5 mt-2 text-xs font-semibold ${
          trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-400'
        }`}>
          {trend === 'up' && <ArrowUpRight size={13} />}
          {trend === 'down' && <ArrowDownRight size={13} />}
          {trend === 'neutral' && <Minus size={13} />}
          <span>{trendLabel}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Pipeline Funnel (animated CSS bars) ─────────────────────────────────────
function PipelineFunnel({ data }) {
  const max = data[0]?.count || 1
  const styles = [
    { bar: '#6366f1', bg: '#6366f112', label: '#a5b4fc' },
    { bar: '#3b82f6', bg: '#3b82f612', label: '#93c5fd' },
    { bar: '#06b6d4', bg: '#06b6d412', label: '#67e8f9' },
    { bar: '#10b981', bg: '#10b98112', label: '#6ee7b7' },
    { bar: '#f59e0b', bg: '#f59e0b12', label: '#fcd34d' },
  ]

  return (
    <div className="space-y-3 pt-2">
      {data.map((item, i) => {
        const pct = max > 0 ? (item.count / max) * 100 : 0
        const convPct = i > 0 && data[i - 1].count > 0
          ? Math.round((item.count / data[i - 1].count) * 100) : null
        const s = styles[i] || styles[styles.length - 1]
        return (
          <div key={item.stage} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium w-20 text-right flex-shrink-0">{item.stage}</span>
            <div className="flex-1 relative h-11 rounded-xl overflow-hidden" style={{ background: s.bg }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 4)}%` }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="h-full rounded-xl flex items-center px-4"
                style={{ background: `linear-gradient(90deg, ${s.bar}bb, ${s.bar})` }}
              >
                <span className="text-white font-black text-sm font-mono">{item.count.toLocaleString()}</span>
              </motion.div>
            </div>
            {convPct !== null && (
              <span className="text-[11px] font-bold w-16 text-right flex-shrink-0 font-mono" style={{ color: s.label }}>
                {convPct}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ data, total }) {
  const radius = 68
  const cx = 90
  const cy = 90
  const circ = 2 * Math.PI * radius
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#64748b']
  let cumLen = 0
  const segments = data.map((item, i) => {
    const len = total > 0 ? (item.count / total) * circ : 0
    const seg = { ...item, cumLen, len, color: COLORS[i] || '#334155' }
    cumLen += len
    return seg
  })

  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1e293b" strokeWidth="22" />
        {segments.map((seg, i) => (
          <motion.circle
            key={i}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth="22"
            strokeDasharray={`${seg.len} ${circ - seg.len}`}
            strokeDashoffset={circ * 0.25 - seg.cumLen}
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${seg.len} ${circ - seg.len}` }}
            transition={{ delay: 0.5 + i * 0.12, duration: 0.8, ease: 'easeOut' }}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="21" fontWeight="900" fontFamily="monospace">
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="Inter, sans-serif">
          Total
        </text>
      </svg>
      <div className="w-full space-y-2.5 mt-1">
        {data.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
              <span className="text-slate-300 text-sm font-medium">{item.source}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-xs font-mono">{item.count}</span>
              <span className="text-xs font-bold text-slate-500 w-8 text-right">
                {total > 0 ? `${Math.round((item.count / total) * 100)}%` : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Top Jobs Table ───────────────────────────────────────────────────────────
function TopJobsTable({ jobs }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500">
        <Briefcase size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">No job data available for this period</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-700/60">
            {['Role', 'Applications', 'Shortlisted', 'Shortlist Rate', ''].map(h => (
              <th key={h} className="pb-3 pr-6 last:pr-0 text-[11px] font-bold text-slate-500 uppercase tracking-[0.07em]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {jobs.map((job, i) => {
            const rate = job.applications > 0 ? Math.round((job.shortlisted / job.applications) * 100) : 0
            return (
              <motion.tr
                key={job.job_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="group hover:bg-slate-700/20 transition-colors"
              >
                <td className="py-4 pr-6">
                  <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors text-sm">{job.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Job #{job.job_id}</div>
                </td>
                <td className="py-4 pr-6">
                  <span className="text-white font-black font-mono">{job.applications.toLocaleString()}</span>
                </td>
                <td className="py-4 pr-6">
                  <span className="text-emerald-400 font-bold font-mono">{job.shortlisted}</span>
                </td>
                <td className="py-4 pr-6">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: rate > 20 ? '#10b981' : rate > 10 ? '#f59e0b' : '#6366f1' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${rate}%` }}
                        transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">{rate}%</span>
                  </div>
                </td>
                <td className="py-4">
                  <ChevronRight size={15} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function RecruitmentAnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const toast = useToast()

  const fetchAnalytics = async (p) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/api/employer/analytics?period=${p}`)
      setData(res.data)
    } catch (err) {
      // Honest failure state — no fabricated demo data.
      console.error('Failed to load analytics:', err)
      setData(null)
      setError(err.response?.data?.detail || 'Failed to load analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAnalytics(period) }, [period])

  const ov = data?.overview || {}
  const sourceBreakdown = data?.source_breakdown || null
  const sourceTotal = (sourceBreakdown || []).reduce((s, x) => s + x.count, 0)
  // Offer-acceptance is only shown when real data exists — no default fabrication.
  const offerAcceptPct = ov.hired && ov.shortlisted
    ? Math.round((ov.hired / ov.shortlisted) * 100) : null

  const PERIODS = [
    { key: '30d', label: 'Last 30 Days' },
    { key: '90d', label: 'Quarter' },
    { key: 'ytd', label: 'YTD' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8">
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      {/* ── Error banner ── */}
      {!loading && error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-4 mb-6 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchAnalytics(period)} className="font-bold underline hover:text-red-200">
            Retry
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-[11px] font-bold mb-1.5 uppercase tracking-widest">
            <BarChart2 size={12} />
            <span>Employer Portal</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Analytics Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Monitor recruitment pipeline health and key performance indicators.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/80 border border-slate-700/60 rounded-xl p-1 gap-1">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                  period === p.key
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchAnalytics(period)}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {/* ── KPI Cards ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard label="Total Applications" value={ov.total_applications?.toLocaleString() || '0'}
            icon={Users} accentColor="#6366f1" delay={0} />
          <MetricCard label="Hiring Velocity" value={ov.avg_time_to_hire_days || '0'} unit="days"
            trendLabel="Avg. time to hire" icon={Zap} accentColor="#06b6d4" delay={0.05} />
          <MetricCard label="Offer Acceptance" value={offerAcceptPct !== null ? `${offerAcceptPct}%` : '—'}
            trendLabel={offerAcceptPct !== null ? 'Hired ÷ shortlisted this period' : 'Insufficient data'} icon={Handshake} accentColor="#10b981" delay={0.10} />
          <MetricCard label="Active Jobs" value={ov.active_jobs || '0'}
            trendLabel={`${ov.hired || 0} hires this period`} icon={Briefcase} accentColor="#f59e0b" delay={0.15} />
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Donut */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/60 p-6"
        >
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
            <PieChart size={15} className="text-indigo-400" />
            Source Breakdown
          </h2>
          {loading ? (
            <div className="flex justify-center">
              <div className="w-36 h-36 rounded-full border-[22px] border-slate-700 animate-pulse" />
            </div>
          ) : sourceBreakdown ? (
            <DonutChart data={sourceBreakdown} total={sourceTotal} />
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs">
              Source tracking is not available yet.
            </div>
          )}
        </motion.div>

        {/* Funnel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/60 p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Target size={15} className="text-cyan-400" />
              Hiring Pipeline Conversion
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">{period === '30d' ? 'Last 30 days' : period === '90d' ? 'Quarter' : 'Year to date'}</span>
          </div>
          {loading ? (
            <div className="space-y-3 pt-2">
              {[100, 75, 45, 20, 8].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-20 h-3 bg-slate-700 rounded animate-pulse" />
                  <div className="h-11 bg-slate-700 rounded-xl animate-pulse" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <PipelineFunnel data={data?.pipeline_funnel || []} />
          )}
        </motion.div>
      </div>

      {/* ── Top Jobs ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/60 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-900/30">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Award size={15} className="text-amber-400" />
            Top Performing Jobs
          </h2>
          <span className="text-xs text-slate-500 font-medium">by applications this period</span>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-6">
                  <div className="h-4 bg-slate-700 rounded w-48" />
                  <div className="h-4 bg-slate-700 rounded w-16" />
                  <div className="h-4 bg-slate-700 rounded w-12" />
                  <div className="h-4 bg-slate-700 rounded w-24" />
                </div>
              ))}
            </div>
          ) : (
            <TopJobsTable jobs={data?.top_jobs || []} />
          )}
        </div>
      </motion.div>
    </div>
  )
}
