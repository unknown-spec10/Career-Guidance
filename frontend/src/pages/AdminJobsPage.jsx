import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Briefcase, Check, RefreshCw, ShieldCheck, X } from 'lucide-react'
import AdminPageHeader from '../components/admin/AdminPageHeader'
import AdminPagination from '../components/admin/AdminPagination'
import AdminStatusBadge from '../components/admin/AdminStatusBadge'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonTable } from '../components/SkeletonLoader'
import { ToastContainer } from '../components/Toast'
import { useToast } from '../hooks/useToast'
import { PAGINATION } from '../config/constants'
import { getApiError } from '../utils/apiError'
import { formatDate } from '../utils/formatDate'
import { approveAdminJob, getAdminJobs, rejectAdminJob } from '../services/adminApi'

const PAGE_SIZE = PAGINATION.DEFAULT_PAGE_SIZE
const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'expired']

const errorBannerClass =
  'mb-4 flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-caption text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'

export default function AdminJobsPage() {
  const { toasts, removeToast, success: showSuccess, error: showError } = useToast()

  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(0)
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const requestRef = useRef(0)

  const loadJobs = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++requestRef.current
      if (!silent) setLoading(true)
      try {
        const data = await getAdminJobs({
          status: statusFilter,
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
        })
        if (requestId !== requestRef.current) return
        setJobs(data?.jobs || [])
        setTotal(data?.total || 0)
        setLoadError('')
      } catch (err) {
        if (requestId !== requestRef.current) return
        const message = getApiError(err, 'Unable to load jobs')
        setLoadError(message)
        showError(message)
      } finally {
        if (requestId === requestRef.current && !silent) setLoading(false)
      }
    },
    [statusFilter, page, showError]
  )

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const changeStatus = (status) => {
    setStatusFilter(status)
    setPage(0)
  }

  const confirmModeration = async () => {
    if (!confirmAction) return
    const { job, action } = confirmAction
    const previousJobs = jobs
    const previousTotal = total

    setActionLoading(true)
    setConfirmAction(null)
    // Optimistic removal from the queue; restored verbatim if the transition
    // is rejected (e.g. the job was approved in another tab).
    setJobs((prev) => prev.filter((row) => row.id !== job.id))
    setTotal((value) => Math.max(0, value - 1))

    try {
      if (action === 'approve') {
        await approveAdminJob(job.id)
        showSuccess(`“${job.title}” approved.`)
      } else {
        await rejectAdminJob(job.id)
        showSuccess(`“${job.title}” rejected.`)
      }
      await loadJobs({ silent: true })
    } catch (err) {
      setJobs(previousJobs)
      setTotal(previousTotal)
      showError(getApiError(err, `Unable to ${action} this job`))
    } finally {
      setActionLoading(false)
    }
  }

  const isPendingFilter = statusFilter === 'pending'

  return (
    <div className="pb-8">
      <AdminPageHeader
        title="Job moderation"
        description="Review employer submissions, approve public listings, or reject them with an audited decision."
      >
        <button
          type="button"
          onClick={() => loadJobs()}
          disabled={loading}
          className="app-btn-secondary app-btn-sm inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </AdminPageHeader>

      <div className="surface-card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Job status filter" className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((status) => {
            const active = statusFilter === status
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => changeStatus(status)}
                className={`app-btn-sm inline-flex items-center justify-center gap-2 rounded-pill capitalize ${active ? 'app-btn-primary' : 'app-btn-secondary'}`}
              >
                {status}
              </button>
            )
          })}
        </div>
        <p className="text-caption text-ink-muted">
          {total} {statusFilter} listing{total === 1 ? '' : 's'}
        </p>
      </div>

      {loadError && (
        <div className={errorBannerClass} role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-panel border border-hairline bg-surface-raised shadow-soft-sm">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : jobs.length === 0 ? (
          <AdminEmptyState
            icon={isPendingFilter ? ShieldCheck : Briefcase}
            title={isPendingFilter ? 'Moderation queue is clear' : `No ${statusFilter} jobs`}
            description={
              isPendingFilter
                ? 'New employer submissions will appear here for review.'
                : 'Switch the status filter to review a different part of the pipeline.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-caption">
              <thead className="bg-surface-sunken text-ink-subtle uppercase tracking-[0.12em] text-overline">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Company</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Location</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Posted</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Expires</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Decision</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-hairline transition-colors hover:bg-surface-sunken"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">
                        {job.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">
                        Job #{job.id}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-muted">
                      {job.company_name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-muted">
                      {job.location_city || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <AdminStatusBadge status={job.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-muted">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-muted">
                      {formatDate(job.expires_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {job.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ job, action: 'approve' })}
                            aria-label={`Approve ${job.title}`}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-pill border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                          >
                            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ job, action: 'reject' })}
                            aria-label={`Reject ${job.title}`}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-pill border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                          >
                            <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <p className="text-right text-[11px] text-ink-subtle">
                          Decision recorded
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && jobs.length > 0 && (
          <AdminPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={(next) => setPage(Math.max(0, next))}
            loading={loading}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmAction?.action === 'approve' ? 'Approve this job?' : 'Reject this job?'}
        message={
          confirmAction
            ? confirmAction.action === 'approve'
              ? `Approve “${confirmAction.job.title}” from ${confirmAction.job.company_name || 'this employer'}? It becomes visible in public job search immediately.`
              : `Reject “${confirmAction.job.title}” from ${confirmAction.job.company_name || 'this employer'}? The listing leaves the moderation queue and cannot be approved later.`
            : ''
        }
        confirmLabel={confirmAction?.action === 'approve' ? 'Approve job' : 'Reject job'}
        destructive={confirmAction?.action === 'reject'}
        loading={actionLoading}
        onConfirm={confirmModeration}
        onClose={() => {
          if (!actionLoading) setConfirmAction(null)
        }}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
