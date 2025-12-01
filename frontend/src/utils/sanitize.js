/**
 * Input sanitization utilities to prevent XSS attacks
 * Provides functions to clean user input before rendering or storing
 */

/**
 * Sanitize plain text input by escaping HTML entities
 * Use for text that should never contain HTML
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize HTML content by removing dangerous tags and attributes
 * Use for content that may contain safe HTML (like markdown output)
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string') return html
  
  // Remove script tags and their content
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  
  // Remove event handlers (onclick, onerror, etc.)
  clean = clean.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  clean = clean.replace(/on\w+\s*=\s*[^\s>]*/gi, '')
  
  // Remove javascript: protocol
  clean = clean.replace(/javascript:/gi, '')
  
  // Remove data: protocol (can be used for XSS)
  clean = clean.replace(/data:text\/html/gi, '')
  
  // Remove iframe, object, embed tags
  clean = clean.replace(/<(iframe|object|embed)[^>]*>.*?<\/\1>/gi, '')
  
  // Remove style tags (can contain expression() for IE XSS)
  clean = clean.replace(/<style[^>]*>.*?<\/style>/gi, '')
  
  return clean
}

/**
 * Sanitize URL to prevent javascript: and data: protocols
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') return ''
  
  const trimmed = url.trim().toLowerCase()
  
  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return ''
  }
  
  return url.trim()
}

/**
 * Sanitize an object's string values recursively
 * Useful for sanitizing form data before submission
 */
export function sanitizeObject(obj, deep = true) {
  if (!obj || typeof obj !== 'object') return obj
  
  const sanitized = Array.isArray(obj) ? [] : {}
  
  for (const key in obj) {
    const value = obj[key]
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value)
    } else if (deep && typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, deep)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
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

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return ''
  
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 255)
}

/**
 * Hook to sanitize form data automatically
 */
export function useSanitizedForm(initialValues = {}) {
  const [values, setValues] = React.useState(sanitizeObject(initialValues))
  
  const handleChange = (name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: typeof value === 'string' ? sanitizeInput(value) : value
    }))
  }
  
  const reset = () => {
    setValues(sanitizeObject(initialValues))
  }
  
  return { values, handleChange, reset, sanitize: sanitizeObject }
}

export default {
  sanitizeInput,
  sanitizeHTML,
  sanitizeURL,
  sanitizeObject,
  sanitizeEmail,
  sanitizeFilename,
}
