import React from 'react'

/**
 * Consistent page heading for the admin console pages.
 */
export default function AdminPageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="text-overline uppercase text-primary">
          Admin console
        </p>
        <h1 className="app-page-title mt-1 text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-body text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
