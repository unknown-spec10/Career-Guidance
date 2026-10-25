import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LearningPathPage from './LearningPathPage'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '../config/api'

function renderPath(pathId = 'lp-1') {
  return render(
    <MemoryRouter initialEntries={[`/dashboard/learning-path/${pathId}`]}>
      <Routes>
        <Route path="/dashboard/learning-path/:pathId" element={<LearningPathPage />} />
        <Route path="/dashboard/interview" element={<div>INTERVIEW_SETUP</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LearningPathPage — honest media CTA contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders Play Video only when a video id exists, with honest fallbacks otherwise', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        status: 'ready',
        recommended_courses: [
          { title: 'Real Course', video_id: 'abc123', focus_skills: ['Python'] },
          { title: 'Course Without Video', focus_skills: ['SQL'] },
        ],
        recommended_projects: [{ title: 'Orphan Project', description: 'no link attached' }],
        practice_problems: [],
        topics_outline: [],
        skill_gaps: {},
      },
    })
    renderPath()

    await screen.findByText('Your Personalized Learning Journey')

    // Live video item keeps its working CTA.
    expect(screen.getByRole('button', { name: /play video/i })).toBeInTheDocument()
    // Items without generated media no longer render dead/broken CTAs.
    expect(screen.getByRole('button', { name: /video coming soon/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /link coming soon/i })).toBeDisabled()
    expect(api.get).toHaveBeenCalledWith('/api/learning-paths/lp-1')
  })

  it('renders an honest empty state when the path has no items at all', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        status: 'ready',
        recommended_courses: [],
        recommended_projects: [],
        practice_problems: [],
        topics_outline: [],
        skill_gaps: {},
      },
    })
    renderPath()

    await screen.findByText('Your learning path is ready')
    expect(
      screen.getByText(/no course, project, or practice items were returned yet/i)
    ).toBeInTheDocument()
  })
})
