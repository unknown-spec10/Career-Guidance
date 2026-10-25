import React from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Inline loading indicator for buttons and compact status rows.
 *
 * Buttons use this in place of their leading icon so the label text never
 * changes and the content stays centred at a fixed size.
 */
export default function Spinner({ className = 'h-4 w-4' }) {
  return <Loader2 className={`${className} shrink-0 animate-spin`} aria-hidden="true" />
}
