import React from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import Modal from './Modal'

/**
 * ConfirmDialog — application-wide confirmation pattern replacing native
 * window.confirm(). Built on the shared Modal so Escape/backdrop/focus
 * behavior stays consistent with every other dialog in the app.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" closeOnOverlayClick={!loading}>
      <div className="flex items-start gap-3">
        {destructive && (
          <div className="w-10 h-10 rounded-card bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
        )}
        <p className="text-sm text-ink-muted leading-relaxed">{message}</p>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} disabled={loading} className="app-btn-secondary app-btn-sm">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          aria-busy={loading}
          className={
            destructive
              ? 'inline-flex h-9 items-center justify-center gap-2 rounded-card border border-transparent bg-red-600 px-4 text-xs font-semibold text-white shadow-soft-xs transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
              : 'app-btn-primary app-btn-sm inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60'
          }
        >
          {loading ? (
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-pill border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
          ) : (
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{confirmLabel}</span>
        </button>
      </div>
    </Modal>
  )
}
