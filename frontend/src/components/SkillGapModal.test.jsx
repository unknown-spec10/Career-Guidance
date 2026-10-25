import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SkillGapModal from './SkillGapModal'

vi.mock('../config/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  apiUrl: (path) => `http://backend.test${path}`,
}))

import api from '../config/api'
import { __resetAuthTokenForTests } from '../utils/authToken'

const GAP_JSON = {
  skills: [
    {
      skill: 'React',
      why_it_matters: 'Core UI framework for the role.',
      key_gaps: ['Hooks internals', 'Server components'],
      quick_win: 'Re-read the hooks docs.',
    },
  ],
  overall_verdict: 'Solid fundamentals with two focus areas.',
  priority_order: ['React'],
}

const sseResponse = (chunks) => ({
  ok: true,
  statusText: 'OK',
  body: {
    getReader: () => {
      let i = 0
      return {
        read: async () =>
          i < chunks.length
            ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
            : { done: true, value: undefined },
        cancel: vi.fn(),
      }
    },
  },
})

const tokenChunk = (rawSlice) => `data: ${JSON.stringify({ token: rawSlice })}\n`

const renderModal = (props = {}) =>
  render(
    <SkillGapModal
      isOpen
      onClose={() => {}}
      sessionId="sess-42"
      initialSkills={[{ skill: 'React', score: 0.4, label: 'Needs Work' }]}
      {...props}
    />
  )

describe('SkillGapModal — gap analysis streaming + learning path contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetAuthTokenForTests()
    sessionStorage.setItem('_secure_token', btoa(JSON.stringify('tok-sg')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('streams the SSE gap analysis and renders parsed per-skill insight', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseResponse([
        tokenChunk(JSON.stringify(GAP_JSON).slice(0, 60)),
        tokenChunk(JSON.stringify(GAP_JSON).slice(60)),
        'data: [DONE]\n',
      ])
    )

    const onGapAnalysisCompleted = vi.fn()
    renderModal({ onGapAnalysisCompleted })

    expect(await screen.findByText('Core UI framework for the role.')).toBeInTheDocument()
    expect(screen.getByText('Hooks internals')).toBeInTheDocument()
    expect(await screen.findByText('Solid fundamentals with two focus areas.')).toBeInTheDocument()
    expect(onGapAnalysisCompleted).toHaveBeenCalled()

    // Streaming request hit the correct endpoint through apiUrl with Bearer auth
    expect(global.fetch).toHaveBeenCalledWith(
      'http://backend.test/api/interview/skill-gap-analysis/sess-42',
      expect.objectContaining({ headers: { Authorization: 'Bearer tok-sg' } })
    )
  })

  it('keeps roadmap generation disabled while the analysis stream is in flight', async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
    renderModal()

    await screen.findByText(/AI Technical Reasoner Active/i)
    expect(screen.getByRole('button', { name: /build interactive pathway/i })).toBeDisabled()
  })

  it('disables roadmap generation when the stream fails and never fabricates insight content', async () => {
    // NOTE: current product behavior on stream failure = generation button
    // stays disabled and no fabricated analysis is shown; there is NO visible
    // error banner yet (documented as a known limitation).
    global.fetch = vi.fn().mockRejectedValue(new Error('connection reset'))
    renderModal()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /build interactive pathway/i })).toBeDisabled()
    })
    // No fabricated per-skill insight appears
    expect(screen.queryByText(/Verified Proficient/i)).not.toBeInTheDocument()
  })

  it('generates a learning path via POST then fetches its detail and renders the roadmap', async () => {
    global.fetch = vi.fn().mockResolvedValue(sseResponse([tokenChunk(JSON.stringify(GAP_JSON)), 'data: [DONE]\n']))
    api.post.mockResolvedValueOnce({ data: { path_id: 'lp-7', already_exists: false } })
    api.get.mockResolvedValueOnce({
      data: {
        id: 7,
        topics_outline: [
          {
            week: 'Week 1',
            skill_focus: 'React Hooks Deep Dive',
            action: 'Study and rebuild a small app.',
            why_recommended: 'Closes the biggest gap.',
            what_it_achieves: 'Confident hook usage.',
            video: { video_id: 'vid1', title: 'Hooks Course', thumbnail_url: 't.jpg', channel_title: 'Academy', duration_minutes: 18 },
          },
        ],
        recommended_projects: [{ title: 'Mini CRM', description: 'Build it.', skills_practiced: ['React'] }],
        practice_problems: [{ title: 'Two Sum', difficulty: 'Easy', platform: 'LeetCode', url: 'https://leetcode.com/two-sum' }],
      },
    })

    const onPathGenerated = vi.fn()
    renderModal({ onPathGenerated })

    await screen.findByText('Solid fundamentals with two focus areas.')
    await userEvent.click(screen.getByRole('button', { name: /build interactive pathway/i }))

    expect(api.post).toHaveBeenCalledWith('/api/interview/generate-learning-path/sess-42')
    expect(api.get).toHaveBeenCalledWith('/api/learning-paths/lp-7')
    expect(onPathGenerated).toHaveBeenCalledWith('lp-7')

    // Success feedback must actually be visible (regression: toasts used to
    // be swallowed by an isolated toast instance and never rendered)
    expect(await screen.findByText(/path generated! charged 10 credits/i)).toBeInTheDocument()

    // Roadmap content rendered from the real API payload
    expect(await screen.findByText('React Hooks Deep Dive')).toBeInTheDocument()
    expect(screen.getByText('Week 1')).toBeInTheDocument()
    expect(screen.getByText('Two Sum')).toBeInTheDocument()
    expect(screen.getByText('Mini CRM')).toBeInTheDocument()
  })

  it('returns to the gap phase when generation fails (e.g. insufficient credits)', async () => {
    global.fetch = vi.fn().mockResolvedValue(sseResponse([tokenChunk(JSON.stringify(GAP_JSON)), 'data: [DONE]\n']))
    api.post.mockRejectedValueOnce({
      response: { status: 402, data: { detail: 'Not enough credits for a learning path.' } },
    })
    renderModal()

    await screen.findByText('Solid fundamentals with two focus areas.')
    await userEvent.click(screen.getByRole('button', { name: /build interactive pathway/i }))

    // Back to the gap phase UI; roadmap never rendered
    await waitFor(() => {
      expect(screen.getByText('Solid fundamentals with two focus areas.')).toBeInTheDocument()
    })
    expect(screen.queryByText('React Hooks Deep Dive')).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()

    // Failure feedback must be visible with the backend detail (regression:
    // toasts used to be swallowed by an isolated toast instance)
    expect(await screen.findByText(/Not enough credits for a learning path/i)).toBeInTheDocument()
  })
})
