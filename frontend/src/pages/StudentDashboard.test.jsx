import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import StudentDashboard from './StudentDashboard'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'
import { __resetAuthTokenForTests } from '../utils/authToken'

const enc = (v) => btoa(JSON.stringify(v))

function seedSession() {
  sessionStorage.setItem('_secure_user', enc({ id: 5, email: 's@x.com', role: 'student' }))
  sessionStorage.setItem('_secure_token', enc('tok'))
  sessionStorage.setItem('_secure_db_applicant_id', enc(7))
  sessionStorage.setItem('_secure_login_time', enc(Date.now()))
}

const mkRec = (id) => ({
  id,
  job_id: id,
  job_title: `Dash Job ${id}`,
  company: `Company ${id}`,
  location: 'Remote',
  match_score: 0.9 - id * 0.001,
})

function mockDashboardApi(recommendedCount = 12) {
  const recommended = Array.from({ length: recommendedCount }, (_, i) => mkRec(i + 1))
  const more = [mkRec(101), mkRec(102)]
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/student/applicant')) {
      return Promise.resolve({
        data: { id: 7, applicant_id: 'app_x', full_name: 'Test Scholar', llm_confidence: 0.85 },
      })
    }
    if (url.startsWith('/api/student/profile')) {
      return Promise.resolve({ data: {} })
    }
    if (url.startsWith('/api/student/applications/jobs')) {
      return Promise.resolve({ data: { applications: [] } })
    }
    if (url.startsWith('/api/recommendations/')) {
      return Promise.resolve({
        data: {
          job_recommendations: [...recommended, ...more],
          recommended,
          more_matches: more,
          total: recommended.length + more.length,
          recommended_count: recommended.length,
          more_total: more.length,
          more_offset: 0,
        },
      })
    }
    if (url === '/api/interview/history') {
      return Promise.resolve({ data: [] })
    }
    return Promise.reject(new Error(`unexpected GET ${url}`))
  })
}

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={['/student/dashboard']}>
      <Routes>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/jobs" element={<div>Jobs page marker</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('StudentDashboard — recommendation display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetAuthTokenForTests()
    sessionStorage.clear()
    seedSession()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockDashboardApi(12)
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('shows the top 10 recommended jobs as cards without inline more_matches expansion', async () => {
    renderDashboard()

    expect(await screen.findByText('Dash Job 1')).toBeInTheDocument()
    expect(screen.getByText('Dash Job 10')).toBeInTheDocument()
    expect(screen.queryByText('Dash Job 11')).not.toBeInTheDocument()
    expect(screen.queryByText('Dash Job 12')).not.toBeInTheDocument()
    // more_matches must not expand inline on the dashboard.
    expect(screen.queryByText('Dash Job 101')).not.toBeInTheDocument()
    expect(screen.queryByText(/show .* more matches/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/show less/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^see more$/i })).toBeInTheDocument()
  })

  it('navigates to the Jobs page (/jobs) on See more', async () => {
    renderDashboard()

    await userEvent.click(await screen.findByRole('button', { name: /^see more$/i }))
    expect(await screen.findByText('Jobs page marker')).toBeInTheDocument()
  })

  it('keeps the right rail (interview readiness + recent applications) sticky on desktop only', async () => {
    renderDashboard()

    await screen.findByText('Interview Readiness')
    // The rail is the ancestor grid item wrapping both cards; locate it via
    // a class-substring selector (no layout engine needed — asserts the
    // Tailwind sticky contract, not computed position).
    const rail = screen.getByText('Interview Readiness').closest('[class*="lg:col-span-4"]')
    expect(rail).not.toBeNull()
    expect(rail.className).toMatch(/lg:sticky/)
    expect(rail.className).toMatch(/lg:top-6/)
    // Must NOT be unconditionally sticky: below the lg breakpoint the layout
    // collapses to one column, so only the `lg:`-prefixed variant may exist.
    expect(rail.className).not.toMatch(/(^|\s)sticky(\s|$)/)
    // Both cards live inside the same sticky rail.
    expect(rail.textContent).toMatch(/Recent Applications/)
  })

  it('fires independent reads in parallel instead of waiting for the applicant call', async () => {
    let releaseApplicant
    const applicantGate = new Promise((resolve) => { releaseApplicant = resolve })
    const applicantData = { id: 7, applicant_id: 'app_x', full_name: 'Test Scholar', llm_confidence: 0.85 }
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/student/applicant')) return applicantGate.then(() => ({ data: applicantData }))
      if (url.startsWith('/api/student/profile')) return Promise.resolve({ data: {} })
      if (url.startsWith('/api/student/applications/jobs')) return Promise.resolve({ data: { applications: [] } })
      if (url.startsWith('/api/recommendations/')) return Promise.resolve({ data: { recommended: [], more_total: 0 } })
      if (url === '/api/interview/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderDashboard()

    // The applicant call is still gated, yet the other wave-1 reads must
    // already have been issued — sequential awaits would not have reached them.
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/student/profile'))
    })
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/student/applications/jobs'))

    releaseApplicant()
    expect(await screen.findByText(/Welcome back/)).toBeInTheDocument()
  })

  it('still resolves loading and renders the rest when recommendations fail', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/student/applicant')) {
        return Promise.resolve({
          data: { id: 7, applicant_id: 'app_x', full_name: 'Test Scholar', llm_confidence: 0.85 },
        })
      }
      if (url.startsWith('/api/student/profile')) return Promise.resolve({ data: {} })
      if (url.startsWith('/api/student/applications/jobs')) return Promise.resolve({ data: { applications: [] } })
      if (url.startsWith('/api/recommendations/')) return Promise.reject(new Error('recs down'))
      if (url === '/api/interview/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderDashboard()

    expect(await screen.findByText(/Welcome back/)).toBeInTheDocument()
    expect(await screen.findByText(/No match recommendations generated yet/)).toBeInTheDocument()
    expect(screen.getByText('Interview Readiness')).toBeInTheDocument()
    expect(console.warn).toHaveBeenCalledWith('Failed to fetch job recommendations.')
  })

  it('still loads the rest of the dashboard when the applicant call fails', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/student/applicant')) return Promise.reject(new Error('no profile'))
      if (url.startsWith('/api/student/profile')) return Promise.resolve({ data: {} })
      if (url.startsWith('/api/student/applications/jobs')) return Promise.resolve({ data: { applications: [] } })
      if (url.startsWith('/api/recommendations/')) return Promise.resolve({ data: { recommended: [], more_total: 0 } })
      if (url === '/api/interview/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderDashboard()

    // No applicant profile: the empty-state prompt renders, proving loading
    // resolved despite the failed call.
    expect(await screen.findByText('Create Your Profile')).toBeInTheDocument()
    expect(console.warn).toHaveBeenCalledWith('No applicant profile found.')
  })

  it('greets with the first name from student profile personal_info.name and falls back to Scholar when empty', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/student/applicant')) {
        return Promise.resolve({
          data: { id: 7, applicant_id: 'app_x', display_name: 'Applicant Display', llm_confidence: 0.85 },
        })
      }
      if (url.startsWith('/api/student/profile')) {
        return Promise.resolve({ data: { personal_info: { name: 'Ada Lovelace' }, display_name: 'Profile Display' } })
      }
      if (url.startsWith('/api/student/applications/jobs')) {
        return Promise.resolve({ data: { applications: [] } })
      }
      if (url.startsWith('/api/recommendations/')) {
        return Promise.resolve({ data: { recommended: [], more_total: 0 } })
      }
      if (url === '/api/interview/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const firstRender = renderDashboard()
    expect(await screen.findByText('Welcome back, Ada!')).toBeInTheDocument()
    firstRender.unmount()

    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/student/applicant')) {
        return Promise.resolve({
          data: { id: 7, applicant_id: 'app_x', display_name: '', llm_confidence: 0.85 },
        })
      }
      if (url.startsWith('/api/student/profile')) {
        return Promise.resolve({ data: { personal_info: { name: '' }, display_name: '' } })
      }
      if (url.startsWith('/api/student/applications/jobs')) {
        return Promise.resolve({ data: { applications: [] } })
      }
      if (url.startsWith('/api/recommendations/')) {
        return Promise.resolve({ data: { recommended: [], more_total: 0 } })
      }
      if (url === '/api/interview/history') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderDashboard()
    expect(await screen.findByText('Welcome back, Scholar!')).toBeInTheDocument()
  })
})
