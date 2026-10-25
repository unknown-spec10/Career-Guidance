/**
 * Shared date formatting for admin surfaces.
 * Returns an em dash for missing/invalid timestamps so tables never render
 * "Invalid Date".
 */
export const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export default formatDateTime
