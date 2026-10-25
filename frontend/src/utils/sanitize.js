/**
 * Input sanitization utilities to prevent XSS attacks
 * Provides functions to clean user input before rendering or storing
 */

/**
 * Sanitize a link/image URL against dangerous protocols.
 * Used as react-markdown's `urlTransform`: return '' to drop the target.
 * Allows http/https/mailto and relative URLs (including #fragments);
 * blocks javascript:, data:, vbscript:, file: and protocol-relative (//evil)
 * targets.
 */
export function safeUrlTransform(url) {
  const value = String(url ?? '').trim()

  if (!value) return ''
  if (value.startsWith('//')) return ''

  const scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(value)
  if (!scheme) return value // relative URL or fragment — safe

  const protocol = scheme[0].toLowerCase()
  if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') {
    return value
  }

  return ''
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return ''
  
  const trimmed = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  return emailRegex.test(trimmed) ? trimmed : ''
}

export default {
  safeUrlTransform,
  sanitizeEmail,
}
