import React from 'react'
import { AlertTriangle } from 'lucide-react'
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
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
        )}
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} disabled={loading} className="btn-secondary-sm">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          aria-busy={loading}
          className={
            destructive
              ? 'inline-flex items-center gap-2 py-2 px-4 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed'
              : 'btn-primary-sm inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed'
          }
        >
          {loading && (
            <span
              className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
