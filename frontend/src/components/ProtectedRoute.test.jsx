import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { __resetAuthTokenForTests } from '../utils/authToken'

const enc = (obj) => btoa(JSON.stringify(obj))

const validToken = () => `hdr.${enc({ exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
const expiredToken = () => `hdr.${enc({ exp: Math.floor(Date.now() / 1000) - 60 })}.sig`

const student = { id: 1, role: 'student', email: 's@example.com' }
const employer = { id: 2, role: 'employer', email: 'e@example.com' }
const admin = { id: 3, role: 'admin', email: 'a@example.com' }

function renderAt(path, allowedRoles) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/test"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              <div>PROTECTED_CONTENT</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route path="/student/dashboard" element={<div>STUDENT_DASH</div>} />
        <Route path="/admin/dashboard" element={<div>ADMIN_DASH</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    __resetAuthTokenForTests()
    sessionStorage.clear()
  })
  afterEach(() => {
    sessionStorage.clear()
  })

  it('redirects unauthenticated visitors to /login', async () => {
    renderAt('/test', [])
    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument())
    expect(screen.queryByText('PROTECTED_CONTENT')).not.toBeInTheDocument()
  })

  it('clears stale sessions before redirecting', async () => {
    // login_time older than the 8-hour session window
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now() - 9 * 60 * 60 * 1000)))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(validToken())))
    renderAt('/test', [])
    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument())
    expect(sessionStorage.getItem('_secure_token')).toBeNull()
  })

  it('renders children for an authenticated user with an allowed role', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(validToken())))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(student)))
    renderAt('/test', ['student'])
    await waitFor(() => expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument())
  })

  it('bounces a student off a role-restricted route to their own dashboard (UI-level authorization)', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(validToken())))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(student)))
    renderAt('/test', ['staff'])
    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
    expect(screen.queryByText('PROTECTED_CONTENT')).not.toBeInTheDocument()
  })

  it('routes unknown roles to the student dashboard fallback', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(validToken())))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(employer)))
    renderAt('/test', ['student'])
    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
  })

  it('renders children for an admin on an admin-only route', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(validToken())))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(admin)))
    renderAt('/test', ['admin'])
    await waitFor(() => expect(screen.getByText('PROTECTED_CONTENT')).toBeInTheDocument())
  })

  it('bounces an admin off a student-only route to /admin/dashboard', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(validToken())))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(admin)))
    renderAt('/test', ['student'])
    await waitFor(() => expect(screen.getByText('ADMIN_DASH')).toBeInTheDocument())
    expect(screen.queryByText('PROTECTED_CONTENT')).not.toBeInTheDocument()
    expect(screen.queryByText('STUDENT_DASH')).not.toBeInTheDocument()
  })

  it('bounces a student off an admin-only route to /student/dashboard', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(validToken())))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(student)))
    renderAt('/test', ['admin'])
    await waitFor(() => expect(screen.getByText('STUDENT_DASH')).toBeInTheDocument())
    expect(screen.queryByText('PROTECTED_CONTENT')).not.toBeInTheDocument()
    expect(screen.queryByText('ADMIN_DASH')).not.toBeInTheDocument()
  })

  it('rejects expired tokens even when session data exists', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify(expiredToken())))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(student)))
    renderAt('/test', ['student'])
    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument())
    expect(screen.queryByText('PROTECTED_CONTENT')).not.toBeInTheDocument()
  })

  it('treats malformed tokens as unauthenticated rather than crashing', async () => {
    sessionStorage.setItem('_secure_login_time', btoa(JSON.stringify(Date.now())))
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify('not-a-jwt')))
    sessionStorage.setItem('_secure_user', btoa(JSON.stringify(student)))
    renderAt('/test', ['student'])
    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument())
  })
})
