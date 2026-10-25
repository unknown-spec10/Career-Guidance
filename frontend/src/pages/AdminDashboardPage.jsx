import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileText,
  RefreshCw,
  ScrollText,
  Settings2,
  Upload,
  Users,
} from 'lucide-react'
import AdminPageHeader from '../components/admin/AdminPageHeader'
import AdminStatCard from '../components/admin/AdminStatCard'
import AdminPagination from '../components/admin/AdminPagination'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import { SkeletonStats } from '../components/SkeletonLoader'
import { ToastContainer } from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { getApiError } from '../utils/apiError'
import { formatDateTime } from '../utils/formatDate'
import { PAGINATION } from '../config/constants'
import {
  getAdminAuditLogs,
  getAdminConfig,
  getAdminOverview,
} from '../services/adminApi'

const AUDIT_PAGE_SIZE = PAGINATION.DEFAULT_PAGE_SIZE

const errorBannerClass =
  'flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-caption text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'

export default function AdminDashboardPage() {
  const { toasts, removeToast, error: showError } = useToast()

  const [overview, setOverview] = useState(null)
  const [audit, setAudit] = useState({ logs: [], total: 0 })
  const [config, setConfig] = useState([])
  const [configLoaded, setConfigLoaded] = useState(false)
  const [auditPage, setAuditPage] = useState(0)
  const [auditLoading, setAuditLoading] = useState(false)
  const [tab, setTab] = useState('audit')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    // One concurrent wave: overview + first audit page + config. allSettled so
    // one failed tab never blanks the whole console.
    const [overviewResult, auditResult, configResult] = await Promise.allSettled([
      getAdminOverview(),
      getAdminAuditLogs({ skip: 0, limit: AUDIT_PAGE_SIZE }),
      getAdminConfig(),
    ])

    const errors = []

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value)
    } else {
      const message = getApiError(overviewResult.reason, 'Unable to load the admin overview')
      setLoadError(message)
      errors.push(message)
    }

    if (auditResult.status === 'fulfilled') {
      setAudit({
        logs: auditResult.value?.logs || [],
        total: auditResult.value?.total || 0,
      })
      setAuditPage(0)
    } else {
      errors.push(getApiError(auditResult.reason, 'Unable to load audit logs'))
    }

    if (configResult.status === 'fulfilled') {
      setConfig(configResult.value?.config || [])
      setConfigLoaded(true)
    } else {
      errors.push(getApiError(configResult.reason, 'Unable to load configuration'))
    }

    setLoading(false)
    errors.forEach((message) => showError(message))
  }, [showError])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const changeAuditPage = async (nextPage) => {
    if (nextPage < 0) return
    setAuditLoading(true)
    try {
      const data = await getAdminAuditLogs({
        skip: nextPage * AUDIT_PAGE_SIZE,
        limit: AUDIT_PAGE_SIZE,
      })
      setAudit({ logs: data?.logs || [], total: data?.total || 0 })
      setAuditPage(nextPage)
    } catch (err) {
      showError(getApiError(err, 'Unable to load audit logs'))
    } finally {
      setAuditLoading(false)
    }
  }

  const jobsByStatus = overview?.jobs_by_status || {}
  const pendingJobs = jobsByStatus.pending || 0
  const recentActivity = overview?.latest_audits || []
  const creditTotals = overview?.credit_totals || {}

  return (
    <div className="pb-8">
      <AdminPageHeader
        title="Admin dashboard"
        description="Platform health, moderation pressure, and a read-only view of configuration and audit history."
      >
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="app-btn-secondary app-btn-sm inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </AdminPageHeader>

      {loading ? (
        <div className="space-y-6">
          <SkeletonStats />
          <div className="h-24 animate-pulse rounded-panel border border-hairline bg-surface-sunken" />
          <div className="h-72 animate-pulse rounded-panel border border-hairline bg-surface-sunken" />
        </div>
      ) : (
        <>
          {loadError && (
            <div className={`mb-6 ${errorBannerClass}`} role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Overview unavailable</p>
                <p className="mt-0.5 text-[11px]">{loadError}</p>
              </div>
              <button type="button" onClick={loadDashboard} className="app-btn-secondary app-btn-sm">
                Retry
              </button>
            </div>
          )}

          {overview && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AdminStatCard
                  label="Total users"
                  value={overview.users_total ?? 0}
                  hint="Registered accounts across every role"
                  icon={Users}
                />
                <AdminStatCard
                  label="Applicants"
                  value={overview.applicants_total ?? 0}
                  hint="Candidate profiles on the platform"
                  icon={FileText}
                  tone="emerald"
                />
                <AdminStatCard
                  label="Resume uploads"
                  value={overview.uploads_total ?? 0}
                  hint="Files processed by the parsing pipeline"
                  icon={Upload}
                  tone="primary"
                />
                <AdminStatCard
                  label="Pending approvals"
                  value={pendingJobs}
                  hint={`${jobsByStatus.approved ?? 0} approved · ${jobsByStatus.rejected ?? 0} rejected`}
                  icon={Briefcase}
                  tone={pendingJobs > 0 ? 'amber' : 'emerald'}
                />
              </div>

              <Link
                to="/admin/jobs"
                className={`group mt-6 flex flex-col gap-3 rounded-card border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  pendingJobs > 0
                    ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/70 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15'
                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${
                      pendingJobs > 0
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {pendingJobs > 0 ? (
                      <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-body font-semibold text-ink">
                      {pendingJobs > 0
                        ? `${pendingJobs} job request${pendingJobs === 1 ? '' : 's'} awaiting moderation`
                        : 'Moderation queue is clear'}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-muted">
                      Approve or reject pending listings from the jobs moderation queue.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-caption font-semibold text-primary">
                  Open moderation queue
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <section className="surface-card p-5 lg:col-span-2">
                  <div className="mb-4 flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h2 className="text-body font-bold text-ink">
                      Recent activity
                    </h2>
                  </div>
                  {recentActivity.length === 0 ? (
                    <AdminEmptyState
                      icon={ScrollText}
                      title="No activity recorded yet"
                      description="Admin actions will appear here as soon as they are audited."
                    />
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {recentActivity.map((entry) => (
                        <li key={entry.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-caption font-semibold text-ink">
                              {entry.action}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink-muted">
                              {entry.target_type || 'Unknown target'}
                              {entry.target_id != null ? ` #${entry.target_id}` : ''}
                              {entry.user_id != null ? ` · actor #${entry.user_id}` : ''}
                            </p>
                          </div>
                          <time className="shrink-0 text-[11px] text-ink-subtle">
                            {formatDateTime(entry.created_at)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="surface-card p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h2 className="text-body font-bold text-ink">
                      Credit snapshot
                    </h2>
                  </div>
                  <dl className="space-y-3 text-caption">
                    {[
                      ['Accounts', creditTotals.accounts ?? 0],
                      ['Credits in circulation', creditTotals.current_credits ?? 0],
                      ['Lifetime earned', creditTotals.total_earned ?? 0],
                      ['Lifetime spent', creditTotals.total_spent ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3">
                        <dt className="text-ink-muted">{label}</dt>
                        <dd className="font-semibold text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>

              <section className="mt-6 overflow-hidden rounded-panel border border-hairline bg-surface-raised shadow-soft-sm">
                <div
                  role="tablist"
                  aria-label="Admin reference tabs"
                  className="flex gap-1 border-b border-hairline px-3 pt-3"
                >
                  <button
                    type="button"
                    role="tab"
                    id="admin-audit-tab"
                    aria-selected={tab === 'audit'}
                    aria-controls="admin-audit-panel"
                    onClick={() => setTab('audit')}
                    className={`rounded-t-card px-4 py-2 text-caption font-semibold transition-colors ${
                      tab === 'audit'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Audit log
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="admin-config-tab"
                    aria-selected={tab === 'config'}
                    aria-controls="admin-config-panel"
                    onClick={() => setTab('config')}
                    className={`rounded-t-card px-4 py-2 text-caption font-semibold transition-colors ${
                      tab === 'config'
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    Configuration
                  </button>
                </div>

                {tab === 'audit' ? (
                  <div role="tabpanel" id="admin-audit-panel" aria-labelledby="admin-audit-tab">
                    {audit.logs.length === 0 ? (
                      <AdminEmptyState
                        icon={ScrollText}
                        title="No audit entries"
                        description="Administrative actions are recorded here with actor and target details."
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-caption">
                          <thead className="bg-surface-sunken text-ink-subtle uppercase tracking-[0.12em] text-overline">
                            <tr>
                              <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Action</th>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Target</th>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Actor</th>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {audit.logs.map((entry) => (
                              <tr key={entry.id} className="border-b border-hairline align-top hover:bg-surface-sunken">
                                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                                  {formatDateTime(entry.created_at)}
                                </td>
                                <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-ink">
                                  {entry.action}
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                                  {entry.target_type || '—'}
                                  {entry.target_id != null ? ` #${entry.target_id}` : ''}
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                                  {entry.user_id != null ? `#${entry.user_id}` : '—'}
                                </td>
                                <td className="max-w-xs px-4 py-2.5">
                                  <span
                                    className="block truncate font-mono text-[10px] text-ink-subtle"
                                    title={entry.details ? JSON.stringify(entry.details) : ''}
                                  >
                                    {entry.details ? JSON.stringify(entry.details) : '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <AdminPagination
                      page={auditPage}
                      pageSize={AUDIT_PAGE_SIZE}
                      total={audit.total}
                      onPageChange={changeAuditPage}
                      loading={auditLoading}
                    />
                  </div>
                ) : (
                  <div role="tabpanel" id="admin-config-panel" aria-labelledby="admin-config-tab">
                    <div className="flex items-center gap-2 border-b border-hairline bg-surface-sunken px-4 py-2 text-[11px] text-ink-muted">
                      <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Read-only view. Configuration changes must go through the backend.
                    </div>
                    {!configLoaded || config.length === 0 ? (
                      <AdminEmptyState
                        icon={Settings2}
                        title="No configuration entries"
                        description="Seeded system configuration keys will appear here."
                      />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-caption">
                          <thead className="bg-surface-sunken text-ink-subtle uppercase tracking-[0.12em] text-overline">
                            <tr>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Key</th>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Value</th>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Category</th>
                              <th scope="col" className="px-4 py-2.5 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {config.map((entry) => (
                              <tr key={entry.key} className="border-b border-hairline align-top hover:bg-surface-sunken">
                                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] font-semibold text-ink">
                                  {entry.key}
                                </td>
                                <td className="px-4 py-2.5">
                                  <pre className="max-h-28 max-w-md overflow-auto whitespace-pre-wrap break-words rounded-card bg-surface-sunken p-2 font-mono text-[10px] text-ink-muted">
                                    {typeof entry.value === 'string'
                                      ? entry.value
                                      : JSON.stringify(entry.value, null, 2)}
                                  </pre>
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5 text-ink-muted">
                                  {entry.category || '—'}
                                </td>
                                <td className="max-w-xs px-4 py-2.5 text-ink-muted">
                                  {entry.description || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
