/**
 * Secure Storage Utility
 * Provides encrypted storage for sensitive data with automatic cleanup
 */

// Simple encryption using base64 encoding with a rotating key
// Note: For production, consider using a proper encryption library like crypto-js
const STORAGE_KEY_PREFIX = '_secure_'
const ROTATION_KEY = () => new Date().toISOString().split('T')[0] // Rotates daily

// Simple obfuscation (not true encryption, but better than plain text)
const encode = (data) => {
  try {
    const json = JSON.stringify(data)
    const key = ROTATION_KEY()
    return btoa(json + key)
  } catch (err) {
    console.error('Encoding error:', err)
    return null
  }
}

const decode = (encoded) => {
  try {
    const decoded = atob(encoded)
    const key = ROTATION_KEY()
    const json = decoded.replace(key, '')
    return JSON.parse(json)
  } catch (err) {
    console.error('Decoding error:', err)
    return null
  }
}

export const secureStorage = {
  /**
   * Set an item in secure storage
   */
  setItem: (key, value) => {
    const encoded = encode(value)
    if (encoded) {
      sessionStorage.setItem(STORAGE_KEY_PREFIX + key, encoded)
    }
  },

  /**
   * Get an item from secure storage
   */
  getItem: (key) => {
    const encoded = sessionStorage.getItem(STORAGE_KEY_PREFIX + key)
    if (!encoded) return null
    return decode(encoded)
  },

  /**
   * Remove an item from secure storage
   */
  removeItem: (key) => {
    sessionStorage.removeItem(STORAGE_KEY_PREFIX + key)
  },

  /**
   * Clear all secure storage items
   */
  clear: () => {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        sessionStorage.removeItem(key)
      }
    })
  },

  /**
   * Migrate from localStorage to secureStorage
   */
  migrateFromLocalStorage: () => {
    try {
      // Migrate token
      const token = localStorage.getItem('token')
      if (token) {
        secureStorage.setItem('token', token)
        localStorage.removeItem('token')
      }

      // Migrate user
      const user = localStorage.getItem('user')
      if (user) {
        secureStorage.setItem('user', JSON.parse(user))
        localStorage.removeItem('user')
      }

      // Migrate db_applicant_id
      const dbId = localStorage.getItem('db_applicant_id')
      if (dbId) {
        secureStorage.setItem('db_applicant_id', dbId)
        localStorage.removeItem('db_applicant_id')
      }
    } catch (err) {
      console.error('Migration error:', err)
    }
  }
}

// Auto-clear on tab close (sessionStorage handles this automatically)
// But we can add a timestamp check for additional security
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000 // 8 hours

export const checkSessionValidity = () => {
  const loginTime = secureStorage.getItem('login_time')
  if (loginTime && Date.now() - loginTime > SESSION_TIMEOUT) {
    secureStorage.clear()
    return false
  }
  return true
}

export default secureStorage
