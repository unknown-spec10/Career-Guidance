import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import JobDetailsPage from './JobDetailsPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'

const jobPayload = {
  job: {
    id: 5,
    title: 'Backend Developer',
    location_city: 'Kolkata',
    work_type: 'remote',
    required_skills: [],
    description: 'Build APIs.',
  },
  employer: null,
  metadata: {},
}

const renderDetails = () =>
  render(
    <MemoryRouter initialEntries={['/job/5']}>
      <Routes>
        <Route path="/job/:jobId" element={<JobDetailsPage />} />
      </Routes>
    </MemoryRouter>
  )

describe('JobDetailsPage — sticky rail contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockImplementation((url) => {
      if (url === '/api/job/5') {
        return Promise.resolve({ data: jobPayload })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the left info rail sticky on desktop only', async () => {
    renderDetails()

    await screen.findByText('Backend Developer')
    // The rail is the lg:col-span-1 grid item; locate it via a
    // class-substring selector (no layout engine needed — asserts the
    // Tailwind sticky contract, not computed position).
    const rail = screen.getByText('Requirements').closest('[class*="lg:col-span-1"]')
    expect(rail).not.toBeNull()
    expect(rail.className).toMatch(/lg:sticky/)
    expect(rail.className).toMatch(/lg:top-6/)
    expect(rail.className).toMatch(/(^|\s)self-start(\s|$)/)
    // Must NOT be unconditionally sticky: below the lg breakpoint the
    // layout collapses to one column, so only the `lg:` variant may exist.
    expect(rail.className).not.toMatch(/(^|\s)sticky(\s|$)/)
  })
})
