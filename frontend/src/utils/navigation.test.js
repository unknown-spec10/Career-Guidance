import { describe, expect, it } from 'vitest'
import { getDashboardPath } from './navigation'

describe('getDashboardPath', () => {
  it('routes students to the student dashboard', () => {
    expect(getDashboardPath('student')).toBe('/student/dashboard')
  })

  it('routes admins to the admin dashboard', () => {
    expect(getDashboardPath('admin')).toBe('/admin/dashboard')
  })

  it('keeps the caller-provided fallback for unknown roles', () => {
    expect(getDashboardPath('employer', '/student/dashboard')).toBe('/student/dashboard')
    expect(getDashboardPath(undefined, '/login')).toBe('/login')
  })
})
