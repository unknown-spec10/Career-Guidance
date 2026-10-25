import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import JobsPage from './JobsPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'
import { __resetAuthTokenForTests } from '../utils/authToken'

const job = {
  id: 11,
  title: 'React Developer',
  company: 'Acme Corp',
  location_city: 'Kolkata',
  work_type: 'remote',
  description: 'Build UIs.',
  required_skills: [{ name: 'React' }],
}

const recommendation = {
  job,
  match_score: 0.87,
  scoring_breakdown: { skills_breakdown: { matched_skills: ['React'], partial_matches: [] } },
}

const enc = (v) => btoa(JSON.stringify(v))

function seedStudentSession() {
  sessionStorage.setItem('_secure_user', enc({ id: 5, email: 's@x.com', role: 'student' }))
  sessionStorage.setItem('_secure_token', enc('tok'))
  sessionStorage.setItem('_secure_db_applicant_id', enc(7))
  sessionStorage.setItem('_secure_login_time', enc(Date.now()))
}

const renderJobs = () =>
  render(
    <MemoryRouter>
      <JobsPage />
    </MemoryRouter>
  )

describe('JobsPage — job listing & application contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetAuthTokenForTests()
    sessionStorage.clear()
    seedStudentSession()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      if (url === '/api/student/applicant') {
        return Promise.resolve({ data: { id: 7, location_city: 'kolkata' } })
      }
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { personal_info: { location: 'Kolkata, India' } } })
      }
      if (url === '/api/credits/balance') {
        return Promise.resolve({ data: { current_credits: 50 } })
      }
      if (url.startsWith('/api/recommendations/')) {
        // Students see jobs through the recommendation pipeline
        return Promise.resolve({ data: { job_recommendations: [recommendation] } })
      }
      if (url.startsWith('/api/jobs')) {
        return Promise.resolve({ data: { jobs: [job], total: 1 } })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    api.post.mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('fetches recommendations and renders the recommended job cards for students', async () => {
    renderJobs()

    expect(await screen.findByText('React Developer')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    const recCall = api.get.mock.calls.find(([url]) => url.startsWith('/api/recommendations/'))
    expect(recCall[0]).toMatch(/^\/api\/recommendations\/7\?purpose=browse&t=\d+$/)
  })

  it('batches the combined recommended + more_matches list in groups of 21 behind See more', async () => {
    const mkRec = (id) => ({
      job: {
        id,
        title: `Batch Job ${id}`,
        company: `Company ${id}`,
        location_city: 'Kolkata',
        work_type: 'remote',
        description: 'Desc.',
        required_skills: [],
      },
      match_score: 0.95 - id * 0.001,
      scoring_breakdown: { skills_breakdown: { matched_skills: [], partial_matches: [] } },
    })
    const recommended = Array.from({ length: 15 }, (_, i) => mkRec(i + 1))
    const more = Array.from({ length: 10 }, (_, i) => mkRec(100 + i + 1))
    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      if (url === '/api/student/applicant') {
        return Promise.resolve({ data: { id: 7, location_city: 'kolkata' } })
      }
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { personal_info: { location: 'Kolkata, India' } } })
      }
      if (url === '/api/credits/balance') {
        return Promise.resolve({ data: { current_credits: 50 } })
      }
      if (url.startsWith('/api/recommendations/')) {
        return Promise.resolve({
          data: {
            job_recommendations: [...recommended, ...more],
            recommended,
            more_matches: more,
            total: 25,
            recommended_count: 15,
            more_total: 10,
            more_offset: 0,
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderJobs()

    // First batch of 21 renders (recommended first, then more_matches).
    expect(await screen.findByText('Batch Job 1')).toBeInTheDocument()
    expect(screen.getByText('Batch Job 106')).toBeInTheDocument()
    expect(screen.queryByText('Batch Job 107')).not.toBeInTheDocument()

    // Recommended slice precedes the more_matches slice.
    const cards = screen.getAllByText(/Batch Job \d+/)
    expect(cards[0]).toHaveTextContent('Batch Job 1')

    await userEvent.click(await screen.findByRole('button', { name: /^see more$/i }))
    expect(await screen.findByText('Batch Job 110')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^see more$/i })).not.toBeInTheDocument()
  })

  it('fetches the next more_matches page via purpose=browse & more_offset when the client batch is exhausted', async () => {
    const mkRec = (id, title) => ({
      job: {
        id,
        title,
        company: 'Acme Corp',
        location_city: 'Kolkata',
        work_type: 'remote',
        description: 'Desc.',
        required_skills: [],
      },
      match_score: 0.8,
      scoring_breakdown: { skills_breakdown: { matched_skills: [], partial_matches: [] } },
    })
    const recA = mkRec(1, 'React Developer')
    const recB = mkRec(2, 'Vue Developer')
    const recExtra = mkRec(3, 'Svelte Developer')
    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      if (url === '/api/student/applicant') {
        return Promise.resolve({ data: { id: 7, location_city: 'kolkata' } })
      }
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { personal_info: { location: 'Kolkata, India' } } })
      }
      if (url === '/api/credits/balance') {
        return Promise.resolve({ data: { current_credits: 50 } })
      }
      if (url.startsWith('/api/recommendations/')) {
        if (url.includes('more_offset=1')) {
          return Promise.resolve({ data: { more_matches: [recExtra], more_total: 2, more_offset: 1 } })
        }
        return Promise.resolve({
          data: {
            job_recommendations: [recA, recB],
            recommended: [recA],
            more_matches: [recB],
            total: 3,
            recommended_count: 1,
            more_total: 2,
            more_offset: 0,
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderJobs()

    // Small list fits in one 21-batch, but one server page remains.
    expect(await screen.findByText('React Developer')).toBeInTheDocument()
    expect(screen.getByText('Vue Developer')).toBeInTheDocument()
    expect(screen.queryByText('Svelte Developer')).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /^see more$/i }))
    expect(await screen.findByText('Svelte Developer')).toBeInTheDocument()
    const pageCall = api.get.mock.calls.find(([url]) => url.includes('more_offset=1'))
    expect(pageCall[0]).toContain('purpose=browse')
  })

  it('applies to a job via POST /api/jobs/:id/apply with the correct body and marks it applied', async () => {
    api.post.mockResolvedValueOnce({ data: { status: 'ok' } })
    renderJobs()

    await screen.findByText('React Developer')
    const applyBtn = await screen.findByRole('button', { name: /easy apply/i })
    await userEvent.click(applyBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/jobs/11/apply', { job_id: 11 })
    })
    // Applied state replaces the Easy Apply affordance
    await waitFor(() => {
      expect(screen.getByText('Applied')).toBeInTheDocument()
    })
  })

  it('surfaces the backend detail when the application fails (e.g. already applied)', async () => {
    api.post.mockRejectedValueOnce({
      response: { status: 400, data: { detail: 'You have already applied to this job.' } },
    })
    renderJobs()

    await screen.findByText('React Developer')
    const applyBtn = await screen.findByRole('button', { name: /easy apply/i })
    await userEvent.click(applyBtn)

    await waitFor(() => {
      expect(screen.getByText('You have already applied to this job.')).toBeInTheDocument()
    })
    // Failed application must NOT mark the job as applied
    expect(screen.queryByText('Applied')).not.toBeInTheDocument()
  })

  it('shows an honest error banner when recommendation fetching fails', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/recommendations/')) {
        return Promise.reject({ response: { status: 500, data: {} } })
      }
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      return Promise.resolve({ data: {} })
    })
    renderJobs()

    expect(await screen.findByText(/unable to fetch recommendations right now/i)).toBeInTheDocument()
    expect(screen.queryByText('React Developer')).not.toBeInTheDocument()
  })

  it('blocks applications from non-students at the handler level (role guard)', async () => {
    // The Easy Apply button is rendered for all sessions, but handleApply
    // enforces the student role client-side; the backend enforces it for real.
    sessionStorage.setItem('_secure_user', enc({ id: 9, email: 'e@x.com', role: 'employer' }))
    renderJobs()

    const applyBtn = await screen.findByRole('button', { name: /easy apply/i })
    await userEvent.click(applyBtn)

    expect(await screen.findByText('Only students can apply to jobs.')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalledWith('/api/jobs/11/apply', { job_id: 11 })
  })

  it('keeps the filter toolbar sticky below the header above the scrolling job grid (opaque curtain wrapper, inner card not sticky)', async () => {
    renderJobs()

    await screen.findByText('React Developer')
    // Curtain structure: outer wrapper sticks, inner card is plain rounded
    // styling only (locate via testid; no layout engine needed —
    // asserts the Tailwind sticky contract, not computed position).
    const toolbar = screen.getByTestId('jobs-filter-toolbar')
    expect(toolbar.className).toMatch(/(^|\s)sticky(\s|$)/)
    // Header lives outside the scrollport (sibling above main.flex-1.overflow-y-auto),
    // but main carries top padding (16px mobile / 32px desktop), so plain
    // top-0 would dock below that padding and leave a strip where scrolled
    // cards stay visible. The negative offset exactly cancels main's top
    // padding (-top-4 = 16px mobile, md:-top-8 = 32px desktop): when stuck,
    // the curtain's padded opaque region slides under the header (z-30
    // covers it) and its visible edge lands flush at the header bottom.
    expect(toolbar.className).toMatch(/-top-4/)
    expect(toolbar.className).toMatch(/md:-top-8/)
    expect(toolbar.className).not.toMatch(/(^|\s)top-0(\s|$)/)
    expect(toolbar.className).not.toMatch(/top-16/)
    // Below the header (z-30) so the header always covers it.
    expect(toolbar.className).toMatch(/z-20/)
    expect(toolbar.className).not.toMatch(/z-30/)
    // Fully opaque curtain in the page background: cards sliding underneath
    // vanish before reaching the card edge. No translucency allowed.
    expect(toolbar.className).toMatch(/bg-canvas/)
    expect(toolbar.className).not.toMatch(/\/\d+/)
    // Curtain padding covers main's top padding zone above the card and adds
    // a band below it (mirrors DashboardLayout main p-margin tokens).
    expect(toolbar.className).toMatch(/pt-margin-mobile/)
    expect(toolbar.className).toMatch(/md:pt-margin-desktop/)
    expect(toolbar.className).toMatch(/pb-lg/)
    // Inner card keeps rounded styling but must NOT stick on its own — only
    // the outer curtain wrapper sticks.
    const innerCard = toolbar.querySelector('[class*="surface-card"]')
    expect(innerCard).not.toBeNull()
    expect(innerCard).not.toBe(toolbar)
    expect(innerCard.className).not.toMatch(/(^|\s)sticky(\s|$)/)
    expect(innerCard.className).toMatch(/rounded-panel/)
    // Overlays (modals, toasts, dropdowns at z-50) must stay above it.
    expect(toolbar.className).not.toMatch(/z-50/)
    // Job grid carries scroll margin so the first row never clips under the stickies.
    const grid = toolbar.parentElement.querySelector('.grid.scroll-mt-24')
    expect(grid).not.toBeNull()
  })

  it('renders the compact single-row toolbar: no card title/hint/button rows, reset is an icon-button with tooltip', async () => {
    renderJobs()

    await screen.findByText('React Developer')
    const toolbar = screen.getByTestId('jobs-filter-toolbar')

    // Removed: card title, subtitle, auto-update hint, skills field, and the
    // old second button row (exactly one button — the reset icon — remains
    // inside the sticky bar).
    expect(screen.queryByText('Search Listings')).not.toBeInTheDocument()
    expect(screen.queryByText(/filters update automatically/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/skills \(react, python\)/i)).not.toBeInTheDocument()
    expect(within(toolbar).getAllByRole('button')).toHaveLength(1)

    // Single keyword input covers titles, companies, and skills.
    expect(screen.getByPlaceholderText(/keyword, title, company, or skills/i)).toBeInTheDocument()
    // Compact location / work-type / sort controls stay in the same row.
    expect(screen.getByPlaceholderText(/^location$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/work type filter/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sort jobs/i)).toBeInTheDocument()

    // Reset is a small always-visible icon-button with a tooltip; disabled
    // with no active filters and no count badge yet.
    const reset = screen.getByRole('button', { name: 'Reset filters' })
    expect(toolbar.contains(reset)).toBe(true)
    expect(reset).toBeDisabled()
    expect(reset.getAttribute('title')).toMatch(/no active filters/i)
    expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument()

    // "Learning Paths" is navigation, not a filter: it lives in the page
    // header row next to Refresh, outside the sticky bar.
    const learningPaths = screen.getByRole('link', { name: /learning paths/i })
    expect(toolbar.contains(learningPaths)).toBe(false)
  })

  it('matches a keyword against ex-title and ex-skill content identically to the old split fields (union)', async () => {
    const mkRec = (id, title, company, description, skills) => ({
      job: { id, title, company, location_city: 'Kolkata', work_type: 'remote', description, required_skills: skills.map((name) => ({ name })) },
      match_score: 0.8,
      scoring_breakdown: { skills_breakdown: { matched_skills: [], partial_matches: [] } },
    })
    api.get.mockImplementation((url) => {
      if (url === '/api/student/applications/jobs') {
        return Promise.resolve({ data: { applications: [] } })
      }
      if (url === '/api/student/applicant') {
        return Promise.resolve({ data: { id: 7, location_city: 'kolkata' } })
      }
      if (url === '/api/student/profile') {
        return Promise.resolve({ data: { personal_info: { location: 'Kolkata, India' } } })
      }
      if (url === '/api/credits/balance') {
        return Promise.resolve({ data: { current_credits: 50 } })
      }
      if (url.startsWith('/api/recommendations/')) {
        return Promise.resolve({
          data: {
            job_recommendations: [
              // Title-hit job: keyword "react" matches the title (old `q`).
              mkRec(1, 'React Developer', 'Acme Corp', 'Build UIs.', ['React']),
              // Skill-only job: keyword "kubernetes" appears ONLY in
              // required_skills, never in title/company/description
              // (old `skills` field match).
              mkRec(2, 'Backend Engineer', 'Beta Ltd', 'Systems work.', ['Kubernetes']),
            ],
          },
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    renderJobs()

    expect(await screen.findByText('React Developer')).toBeInTheDocument()
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument()

    const keyword = screen.getByLabelText(/keyword search/i)

    // Ex-`q` behavior: title hit narrows to the React job.
    await userEvent.clear(keyword)
    await userEvent.type(keyword, 'react')
    expect(await screen.findByText('React Developer', {}, { timeout: 3000 })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument()
    }, { timeout: 3000 })
    // Compact active-filter indication: count badge on the reset icon.
    expect(await screen.findByTestId('filter-count-badge')).toHaveTextContent('1')

    // Ex-`skills` behavior: a keyword present ONLY in required_skills still
    // matches (union) — the old split Skills field would have matched it.
    await userEvent.clear(keyword)
    await userEvent.type(keyword, 'kubernetes')
    expect(await screen.findByText('Backend Engineer', {}, { timeout: 3000 })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('React Developer')).not.toBeInTheDocument()
    }, { timeout: 3000 })
    expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('1')

    // Reset clears the keyword and restores both jobs.
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(await screen.findByText('React Developer', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument()
    expect(screen.queryByTestId('filter-count-badge')).not.toBeInTheDocument()
  })
})
