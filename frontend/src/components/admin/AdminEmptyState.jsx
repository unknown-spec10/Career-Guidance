import React from 'react'

export default function AdminEmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 h-9 w-9 text-ink-subtle" aria-hidden="true" />}
      <p className="text-body font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-caption text-ink-muted">
          {description}
        </p>
      )}
    </div>
  )
}
