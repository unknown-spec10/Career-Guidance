import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Shared pagination footer for admin tables.
 * `page` is zero-based to match the backend `skip` parameter.
 */
export default function AdminPagination({ page, pageSize, total, onPageChange, loading = false }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)

  return (
    <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3 text-caption text-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 0 || loading}
          className="app-btn-secondary app-btn-sm inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </button>
        <span className="px-1 font-semibold text-ink">
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page + 1 >= totalPages || loading}
          className="app-btn-secondary app-btn-sm inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
