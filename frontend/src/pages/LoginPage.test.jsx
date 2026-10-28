import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

vi.mock('../config/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
  API_BASE_URL: '',
}))

import api from '../config/api'
import LoginPage from './LoginPage'
import { __resetAuthTokenForTests } from '../utils/authToken'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function loginRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <>
            <LoginPage />
            <LocationProbe />
          </>
        )}
      />
      <Route path="/student/dashboard" element={<div>STUDENT_DASH</div>} />
      <Route path="/forgot-password" element={<div>FORGOT</div>} />
      <Route path="/register" element={<div>REGISTER</div>} />
    </Routes>
  )
}

function renderLogin(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      {loginRoutes()}
    </MemoryRouter>
  )
}

describe('LoginPage — credential login contract', () => {
  beforeEach(() => {
    __resetAuthTokenForTests()
    sessionStorage.clear()
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('submits OAuth2 form-encoded credentials to /api/auth/login and routes students to their dashboard', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({
      data: { access_token: 'tok-abc', user: { id: 1, role: 'student' } },
    })
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'student@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'secret123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())

    expect(api.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = api.post.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    // OAuth2PasswordRequestForm expects username/password fields
    expect(body.get('username')).toBe('student@example.com')
    expect(body.get('password')).toBe('secret123')

    // Session persisted for the rest of the app
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_token')))).toBe('tok-abc')
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_user')))).toEqual({ id: 1, role: 'student' })
    expect(api.defaults.headers.common.Authorization).toBe('Bearer tok-abc')
  })

  it('routes unknown roles to the student dashboard fallback', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({
      data: { access_token: 'tok-e', user: { id: 2, role: 'employer' } },
    })
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'hr@corp.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
  })

  it('shows the backend error detail on failed login and does not create a session', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValueOnce({
      response: { status: 401, data: { detail: 'Invalid email or password' } },
    })
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'student@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'bad')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    // Backend detail is surfaced verbatim in the inline alert AND the toast
    // (no misleading generic copy)
    await waitFor(() => {
      const notices = screen.getAllByText('Invalid email or password')
      expect(notices.length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.queryByText('STUDENT_DASH')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('_secure_token')).toBeNull()
  })

  it('disables the submit button while a login request is in flight', async () => {
    const user = userEvent.setup()
    let resolveLogin
    api.post.mockReturnValueOnce(new Promise((resolve) => { resolveLogin = resolve }))
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 's@e.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    const submit = screen.getByRole('button', { name: /^sign in$/i })
    await waitFor(() => expect(submit).toBeDisabled())
    expect(submit).toHaveAttribute('aria-busy', 'true')

    resolveLogin({ data: { access_token: 't', user: { role: 'student' } } })
    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
  })

  it('renders navigation links to registration and password reset', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register')
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password')
  })

  it('remember-me persists only the email for prefill when checked', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({
      data: { access_token: 'tok-r', user: { id: 1, role: 'student' } },
    })
    renderLogin()

    await user.type(screen.getByPlaceholderText('you@example.com'), 'remember@example.com')
    await user.type(screen.getByPlaceholderText('Enter your password'), 'pw123456')
    await user.click(screen.getByRole('checkbox', { name: /remember me/i }))
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
    // Only the email is persisted for prefill — never the password or token.
    expect(localStorage.getItem('remembered_email')).toBe('remember@example.com')
  })

  it('prefills the email from a previous remember-me choice and clears it when unchecked', async () => {
    localStorage.setItem('remembered_email', 'back@example.com')
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({
      data: { access_token: 'tok-r2', user: { id: 1, role: 'student' } },
    })
    renderLogin()

    expect(screen.getByPlaceholderText('you@example.com')).toHaveValue('back@example.com')
    expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: /remember me/i }))
    await user.type(screen.getByPlaceholderText('Enter your password'), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
    expect(localStorage.getItem('remembered_email')).toBeNull()
  })
})

describe('LoginPage - Google OAuth exchange redemption', () => {
  beforeEach(() => {
    __resetAuthTokenForTests()
    sessionStorage.clear()
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('redeems the exchange code, stores the session and routes by role', async () => {
    api.post.mockResolvedValueOnce({
      data: {
        access_token: 'tok-oauth',
        token_type: 'bearer',
        user: { id: 9, email: 'oauth@example.com', name: 'OAuth User', role: 'student' },
      },
    })
    renderLogin('/login?exchange=code-123')

    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/api/auth/google/exchange', { code: 'code-123' })

    // Same session persistence as the password flow
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_token')))).toBe('tok-oauth')
    expect(JSON.parse(atob(sessionStorage.getItem('_secure_user')))).toEqual({
      id: 9,
      email: 'oauth@example.com',
      name: 'OAuth User',
      role: 'student',
    })
    expect(api.defaults.headers.common.Authorization).toBe('Bearer tok-oauth')
  })

  it('redeems the single-use code exactly once under StrictMode double effects', async () => {
    api.post.mockResolvedValueOnce({
      data: { access_token: 'tok-strict', user: { id: 10, role: 'student' } },
    })
    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={['/login?exchange=strict-code']}>
          {loginRoutes()}
        </MemoryRouter>
      </React.StrictMode>
    )

    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/api/auth/google/exchange', { code: 'strict-code' })
  })

  it('shows the backend error and stays on the login page for an invalid or expired code', async () => {
    api.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { detail: 'Invalid or expired exchange code. Please sign in again.' },
      },
    })
    renderLogin('/login?exchange=stale-code')

    // Inline alert + toast, matching the failed-password-login display
    await waitFor(() => {
      const notices = screen.getAllByText('Invalid or expired exchange code. Please sign in again.')
      expect(notices.length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.queryByText('STUDENT_DASH')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('_secure_token')).toBeNull()
    // The dead code is stripped from the URL, and the request is not retried
    expect(screen.getByTestId('location-search')).toHaveTextContent('')
    expect(api.post).toHaveBeenCalledTimes(1)
  })

  it('does not call the exchange endpoint when no exchange param is present', async () => {
    renderLogin()

    await waitFor(() => expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument())
    expect(api.post).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalled()
  })
})
