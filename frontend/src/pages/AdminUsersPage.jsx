import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Search,
  UserCheck,
  UserX,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import AdminPageHeader from '../components/admin/AdminPageHeader'
import AdminPagination from '../components/admin/AdminPagination'
import AdminStatusBadge from '../components/admin/AdminStatusBadge'
import AdminEmptyState from '../components/admin/AdminEmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonTable } from '../components/SkeletonLoader'
import Spinner from '../components/Spinner'
import { ToastContainer } from '../components/Toast'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import { DEBOUNCE_DELAYS, PAGINATION } from '../config/constants'
import { getApiError } from '../utils/apiError'
import { formatDate, formatDateTime } from '../utils/formatDate'
import secureStorage from '../utils/secureStorage'
import {
  adjustAdminCredits,
  getAdminCreditTransactions,
  getAdminUsers,
  updateAdminUser,
} from '../services/adminApi'

const PAGE_SIZE = PAGINATION.DEFAULT_PAGE_SIZE
const TRANSACTION_LIMIT = 100

const errorBannerClass =
  'mb-4 flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-caption text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'

export default function AdminUsersPage() {
  const { toasts, removeToast, success: showSuccess, error: showError } = useToast()
  const currentUser = secureStorage.getItem('user')

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, DEBOUNCE_DELAYS.SEARCH)

  const [page, setPage] = useState(0)
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [pendingToggle, setPendingToggle] = useState(null)
  const [toggleLoading, setToggleLoading] = useState(false)

  const [drawerUser, setDrawerUser] = useState(null)
  const [drawerTransactions, setDrawerTransactions] = useState([])
  const [drawerApplicantId, setDrawerApplicantId] = useState(null)
  const [drawerBalance, setDrawerBalance] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [lastAdjustment, setLastAdjustment] = useState(null)
  const closeButtonRef = useRef(null)
  const drawerRequestRef = useRef(0)

  useEffect(() => {
    let active = true
    setLoading(true)

    getAdminUsers({ skip: page * PAGE_SIZE, limit: PAGE_SIZE, search: debouncedSearch })
      .then((data) => {
        if (!active) return
        setUsers(data?.users || [])
        setTotal(data?.total || 0)
        setLoadError('')
      })
      .catch((err) => {
        if (!active) return
        const message = getApiError(err, 'Unable to load users')
        setLoadError(message)
        showError(message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [page, debouncedSearch, showError])

  const handleSearchChange = (event) => {
    setSearch(event.target.value)
    setPage(0)
  }

  const openToggleDialog = (user) => {
    setPendingToggle({ user, nextActive: !user.is_active })
  }

  const confirmToggle = async () => {
    if (!pendingToggle) return
    const { user, nextActive } = pendingToggle
    setToggleLoading(true)
    try {
      const updated = await updateAdminUser(user.id, { is_active: nextActive })
      setUsers((prev) => prev.map((row) => (row.id === user.id ? { ...row, ...updated } : row)))
      setDrawerUser((prev) => (prev && prev.id === user.id ? { ...prev, ...updated } : prev))
      showSuccess(`${user.email} ${nextActive ? 'reactivated' : 'deactivated'}.`)
    } catch (err) {
      // Includes the backend's self-deactivation rejection.
      showError(getApiError(err, `Unable to ${nextActive ? 'reactivate' : 'deactivate'} this user`))
    } finally {
      setToggleLoading(false)
      setPendingToggle(null)
    }
  }

  const closeDrawer = useCallback(() => {
    drawerRequestRef.current += 1
    setDrawerUser(null)
    setLastAdjustment(null)
    setDrawerError('')
    setAdjustAmount('')
    setAdjustReason('')
  }, [])

  useEffect(() => {
    if (!drawerUser) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', handleKeyDown)
    closeButtonRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [drawerUser, closeDrawer])

  const openDrawer = async (user) => {
    const requestId = ++drawerRequestRef.current
    setDrawerUser(user)
    setDrawerTransactions([])
    setDrawerApplicantId(null)
    setDrawerBalance(null)
    setDrawerError('')
    setLastAdjustment(null)
    setAdjustAmount('')
    setAdjustReason('')
    setDrawerLoading(true)

    try {
      const data = await getAdminCreditTransactions({
        search: user.email,
        limit: TRANSACTION_LIMIT,
      })
      if (requestId !== drawerRequestRef.current) return
      const transactions = data?.transactions || []
      setDrawerTransactions(transactions)
      setDrawerApplicantId(
        transactions.find((tx) => tx.applicant_id != null)?.applicant_id ?? null
      )
      setDrawerBalance(transactions[0]?.balance_after ?? null)
    } catch (err) {
      if (requestId !== drawerRequestRef.current) return
      const message = getApiError(err, 'Unable to load this user’s credit history')
      setDrawerError(message)
      showError(message)
    } finally {
      if (requestId === drawerRequestRef.current) setDrawerLoading(false)
    }
  }

  const handleAdjustCredits = async (event) => {
    event.preventDefault()
    if (!drawerUser || !drawerApplicantId) return

    const amount = Number(adjustAmount)
    const reason = adjustReason.trim()

    if (!Number.isInteger(amount) || amount === 0) {
      showError('Enter a non-zero whole number of credits.')
      return
    }
    if (reason.length < 10) {
      showError('Add a reason of at least 10 characters for the audit trail.')
      return
    }

    setAdjusting(true)
    const before = drawerBalance
    try {
      const result = await adjustAdminCredits({
        applicantId: drawerApplicantId,
        amount,
        reason,
      })
      const after = result?.current_credits ?? null
      setLastAdjustment({ before, after, amount })
      setDrawerBalance(after)
      if (result?.transaction) {
        setDrawerTransactions((prev) => [
          {
            ...result.transaction,
            applicant_id: drawerApplicantId,
            user_email: drawerUser.email,
          },
          ...prev,
        ])
      }
      showSuccess(
        `${amount > 0 ? 'Added' : 'Deducted'} ${Math.abs(amount)} credits for ${drawerUser.email}.`
      )
      setAdjustAmount('')
      setAdjustReason('')
    } catch (err) {
      showError(getApiError(err, 'Unable to adjust credits for this user'))
    } finally {
      setAdjusting(false)
    }
  }

  const adjustDisabled = !drawerApplicantId || adjusting

  return (
    <div className="pb-8">
      <AdminPageHeader
        title="Users"
        description="Search accounts, review access, and apply auditable credit adjustments."
      />

      <div className="surface-card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md">
          <span className="sr-only">Search users by email or name</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by email or name"
            aria-label="Search users by email or name"
            className="app-input w-full !pl-9"
          />
        </label>
        <p className="text-caption text-ink-muted">
          {total} account{total === 1 ? '' : 's'} matching the current search
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
            <SkeletonTable rows={5} columns={5} />
          </div>
        ) : users.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title="No users found"
            description="Try a different email or name, or clear the search."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-caption">
              <thead className="bg-surface-sunken text-ink-subtle uppercase tracking-[0.12em] text-overline">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">User</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = currentUser?.id === user.id
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-hairline transition-colors hover:bg-surface-sunken"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-ink">
                            {user.name || 'Unnamed user'}
                          </p>
                          {isSelf && (
                            <span className="rounded-pill border border-primary-500/20 bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              You
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink-muted">
                          {user.email}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] capitalize text-ink-muted">
                        {user.role}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <AdminStatusBadge status={user.is_active ? 'active' : 'inactive'} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ink-muted">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDrawer(user)}
                            aria-label={`Manage ${user.email}`}
                            className="app-btn-secondary app-btn-sm inline-flex items-center gap-1.5"
                          >
                            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                            Manage
                          </button>
                          <button
                            type="button"
                            onClick={() => openToggleDialog(user)}
                            aria-label={`${user.is_active ? 'Deactivate' : 'Reactivate'} ${user.email}`}
                            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-pill border px-3 text-xs font-semibold transition-colors ${
                              user.is_active
                                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15'
                            }`}
                          >
                            {user.is_active ? (
                              <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {user.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && users.length > 0 && (
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
        isOpen={Boolean(pendingToggle)}
        title={pendingToggle?.nextActive ? 'Reactivate user?' : 'Deactivate user?'}
        message={
          pendingToggle
            ? pendingToggle.nextActive
              ? `Reactivate ${pendingToggle.user.email}? They will be able to sign in again.`
              : `Deactivate ${pendingToggle.user.email}? They will be signed out and blocked from signing in until reactivated.`
            : ''
        }
        confirmLabel={pendingToggle?.nextActive ? 'Reactivate' : 'Deactivate'}
        destructive={!pendingToggle?.nextActive}
        loading={toggleLoading}
        onConfirm={confirmToggle}
        onClose={() => {
          if (!toggleLoading) setPendingToggle(null)
        }}
      />

      <AnimatePresence>
        {drawerUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
            onClick={closeDrawer}
          >
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              role="dialog"
              aria-modal="true"
              aria-label={`Manage ${drawerUser.email}`}
              onClick={(event) => event.stopPropagation()}
              className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface-overlay shadow-soft-xl"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-hairline bg-surface-overlay px-5 py-4">
                <div className="min-w-0">
                  <p className="text-overline uppercase text-primary">
                    User account
                  </p>
                  <h2 className="mt-0.5 truncate font-display text-title text-ink">
                    {drawerUser.name || drawerUser.email}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                    {drawerUser.email} · {drawerUser.role}
                  </p>
                </div>
                <button
                  type="button"
                  ref={closeButtonRef}
                  onClick={closeDrawer}
                  aria-label="Close user drawer"
                  className="rounded-pill p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-6 px-5 py-5">
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-body font-bold text-ink">
                      Credit adjustments
                    </h3>
                    <AdminStatusBadge status={drawerUser.is_active ? 'active' : 'inactive'} />
                  </div>

                  <div
                    data-testid="credit-balance-summary"
                    className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface-sunken p-4"
                  >
                    <div>
                      <p className="text-overline uppercase text-ink-subtle">
                        Before
                      </p>
                      <p
                        data-testid="balance-before"
                        className="mt-1 font-display text-title text-ink"
                      >
                        {lastAdjustment?.before ?? drawerBalance ?? '—'}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-ink-subtle" aria-hidden="true" />
                    <div className="text-right">
                      <p className="text-overline uppercase text-ink-subtle">
                        After
                      </p>
                      <p
                        data-testid="balance-after"
                        className="mt-1 font-display text-title text-ink"
                      >
                        {lastAdjustment?.after ?? drawerBalance ?? '—'}
                      </p>
                    </div>
                  </div>

                  {drawerLoading ? (
                    <p className="mt-2 text-[11px] text-ink-muted">
                      Loading credit account…
                    </p>
                  ) : (
                    <>
                      {!drawerApplicantId && (
                        <div className="mt-4 rounded-card border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                          No credit account activity was found for this user, so an applicant id cannot be resolved.
                          Adjustments unlock after the student has an initial credit transaction.
                        </div>
                      )}
                      <form onSubmit={handleAdjustCredits} className="mt-4 space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block text-caption font-semibold text-ink">
                            Amount
                            <input
                              type="number"
                              value={adjustAmount}
                              onChange={(event) => setAdjustAmount(event.target.value)}
                              min={-1000}
                              max={1000}
                              step={1}
                              required
                              disabled={!drawerApplicantId}
                              placeholder="e.g. 25 or -10"
                              className="app-input mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          </label>
                          <label className="block text-caption font-semibold text-ink">
                            Applicant
                            <input
                              type="text"
                              value={drawerApplicantId ? `#${drawerApplicantId}` : 'Not resolved'}
                              readOnly
                              aria-label="Applicant id"
                              className="app-input mt-1 w-full opacity-70"
                            />
                          </label>
                        </div>
                        <label className="block text-caption font-semibold text-ink">
                          Reason (audit trail)
                          <textarea
                            value={adjustReason}
                            onChange={(event) => setAdjustReason(event.target.value)}
                            minLength={10}
                            maxLength={255}
                            rows={2}
                            required
                            disabled={!drawerApplicantId}
                            placeholder="At least 10 characters explaining this adjustment"
                            className="app-textarea mt-1 w-full resize-y disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </label>
                        <p className="text-[11px] text-ink-muted">
                          Positive values add credits; negative values deduct. Every change is written to the audit log.
                        </p>
                        <button
                          type="submit"
                          disabled={adjustDisabled}
                          aria-busy={adjusting}
                          className="app-btn-primary app-btn-sm inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {adjusting ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4 shrink-0" />}
                          <span>Apply adjustment</span>
                        </button>
                      </form>
                    </>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-body font-bold text-ink">
                    Recent transactions
                  </h3>
                  {drawerError && (
                    <div className={errorBannerClass} role="alert">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{drawerError}</span>
                    </div>
                  )}
                  {drawerTransactions.length === 0 && !drawerLoading ? (
                    <p className="rounded-card border border-hairline bg-surface-sunken p-3 text-[11px] text-ink-muted">
                      No credit transactions recorded for this user yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-hairline overflow-hidden rounded-card border border-hairline">
                      {drawerTransactions.slice(0, 20).map((tx) => (
                        <li key={tx.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <AdminStatusBadge status={tx.transaction_type} />
                              <span className="text-[11px] text-ink-muted">
                                {tx.activity_type || 'adjustment'}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-ink-muted">
                              {tx.description || 'No description'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={`text-caption font-bold ${
                                Number(tx.amount) >= 0
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-red-700 dark:text-red-300'
                              }`}
                            >
                              {Number(tx.amount) > 0 ? '+' : ''}
                              {tx.amount}
                            </p>
                            <p className="text-[10px] text-ink-subtle">
                              bal {tx.balance_after ?? '—'} · {formatDateTime(tx.created_at)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
