/**
 * Extract a user-facing error message from an axios-style error.
 * Dedupe of 30+ identical `err.response?.data?.detail || '<fallback>'` blocks.
 * Semantics are exactly the old inline expression: backend detail, else fallback.
 */
export const getApiError = (err, fallback = 'Something went wrong') => {
  if (!err) return fallback
  return err.response?.data?.detail || fallback
}

export default getApiError
