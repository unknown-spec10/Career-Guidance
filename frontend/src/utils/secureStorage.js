/**
 * Session-scoped key/value store.
 *
 * HONEST SECURITY NOTE (H7): values are only base64-encoded JSON, NOT
 * encrypted. base64 is reversible by anyone — it stops casual shoulder
 * surfing, nothing more. Everything here (including the JWT) is readable by
 * any JavaScript running on this origin, so it must NOT be relied upon as
 * XSS protection. The JWT's primary copy lives in the in-memory holder
 * (`authToken.js`); sessionStorage is only its reload-restore mirror. The
 * durable fix is an httpOnly (+ Secure + SameSite) session cookie set by the
 * backend, which would keep the token out of JS reach entirely.
 */

// Base64 obfuscation for casual readability only — NOT encryption.
// For production, consider moving secrets to httpOnly cookies instead.
const STORAGE_KEY_PREFIX = '_secure_'

// Base64 obfuscation (NOT encryption — see the security note at the top).
// Decodable by any script on the page; never treat this as secret storage.
const encode = (data) => {
  try {
    const json = JSON.stringify(data)
    return btoa(json)
  } catch (err) {
    console.error('Encoding error:', err)
    return null
  }
}

const decode = (encoded) => {
  try {
    const decoded = atob(encoded)
    return JSON.parse(decoded)
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
