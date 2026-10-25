import { describe, it, expect, beforeEach } from 'vitest'
import {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  __resetAuthTokenForTests,
} from './authToken'
import secureStorage from './secureStorage'

describe('authToken (in-memory JWT holder)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    __resetAuthTokenForTests()
  })

  it('setAuthToken keeps the token in memory and mirrors it for reload restore', () => {
    setAuthToken('tok-abc')

    expect(getAuthToken()).toBe('tok-abc')
    expect(secureStorage.getItem('token')).toBe('tok-abc')
  })

  it('getAuthToken serves from memory without needing the storage copy', () => {
    setAuthToken('tok-memory')
    sessionStorage.removeItem('_secure_token')

    expect(getAuthToken()).toBe('tok-memory')
  })

  it('getAuthToken restores a session from storage on a fresh page load', () => {
    // No setAuthToken call: simulates a reload where only storage survived.
    secureStorage.setItem('token', 'tok-restored')

    expect(getAuthToken()).toBe('tok-restored')
    // Second read is served from the warmed memory copy.
    sessionStorage.removeItem('_secure_token')
    expect(getAuthToken()).toBe('tok-restored')
  })

  it('clearAuthToken drains both memory and the storage mirror', () => {
    setAuthToken('tok-abc')
    clearAuthToken()

    expect(getAuthToken()).toBeNull()
    expect(secureStorage.getItem('token')).toBeNull()
  })

  it('returns null when there is no session anywhere', () => {
    expect(getAuthToken()).toBeNull()
  })
})
