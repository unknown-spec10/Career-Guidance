/**
 * In-memory JWT holder.
 *
 * SECURITY MODEL (read this before changing):
 * - The JWT lives in this module's memory as the primary copy used for API
 *   requests. Memory is cleared on logout and never survives longer than the
 *   page session.
 * - `sessionStorage` (via `secureStorage`) is only the *restore source*: the
 *   token is mirrored there so a page reload keeps the user logged in, and
 *   re-hydrated into memory on next load. sessionStorage is still readable by
 *   any JavaScript on the page, so it does NOT protect the token from an XSS
 *   attacker — it only narrows the window to code running in this tab.
 * - The durable fix is an httpOnly (+ Secure + SameSite) session cookie set
 *   by the backend, which would remove the token from JS reach entirely.
 *   Until then, callers must use THESE helpers (never touch the stored token
 *   directly) so the cookie migration only changes this file.
 */

import secureStorage from './secureStorage'

let inMemoryToken = null

/** Persist a fresh token: memory first, storage mirror for reload restore. */
export function setAuthToken(token) {
  inMemoryToken = token || null
  if (token) {
    secureStorage.setItem('token', token)
  } else {
    secureStorage.removeItem('token')
  }
}

/**
 * Return the active token. Memory is authoritative within a page session;
 * on a fresh page load (memory empty) the token is restored once from
 * sessionStorage and cached.
 */
export function getAuthToken() {
  if (inMemoryToken) return inMemoryToken
  const restored = secureStorage.getItem('token')
  if (restored) {
    inMemoryToken = restored
  }
  return restored
}

/** Clear the token from both memory and storage (logout / 401 / expiry). */
export function clearAuthToken() {
  inMemoryToken = null
  secureStorage.removeItem('token')
}

/** Test-only: drop the cached copy so test files start isolated. */
export function __resetAuthTokenForTests() {
  inMemoryToken = null
}

export default {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
}
