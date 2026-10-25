import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../config/api'
import { BookOpen, ExternalLink, Code, Video, FileText, Award, Target, ArrowRight, X, Check } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const LearningPathPage = () => {
  const { pathId } = useParams()
  const navigate = useNavigate()
  const [learningPath, setLearningPath] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeLightboxVideo, setActiveLightboxVideo] = useState(null)
  const toast = useToast()

  useEffect(() => {
    fetchLearningPath()
  }, [pathId])

  const fetchLearningPath = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/learning-paths/${pathId}`)
      setLearningPath(response.data)
    } catch (error) {
      console.error('Error fetching learning path:', error)
      toast.error('Failed to load learning path')
      navigate('/dashboard/interview')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkCompleted = async () => {
    try {
      const response = await api.post(`/api/learning-paths/${pathId}/complete`)
      setLearningPath(response.data)
      toast.success("Congratulations! Learning path marked as completed.")
    } catch (error) {
      console.error('Error completing learning path:', error)
      toast.error('Failed to mark learning path as completed.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-pill h-16 w-16 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const colors = [
    { circle: 'bg-purple-500', text: 'text-purple-700' },
    { circle: 'bg-blue-500', text: 'text-blue-700' },
    { circle: 'bg-teal-500', text: 'text-teal-700' },
    { circle: 'bg-pink-500', text: 'text-pink-700' },
    { circle: 'bg-red-500', text: 'text-red-700' },
    { circle: 'bg-amber-500', text: 'text-amber-700' }
  ]

  // Combine all items into one learning pathway
  const allItems = [
    ...(learningPath?.recommended_courses || []).map(course => ({
      ...course,
      type: 'course',
      title: course.title,
      description: course.focus_skills?.join(', ') || ''
    })),
    ...(learningPath?.recommended_projects || []).map(project => ({
      ...project,
      type: 'project',
      title: project.title,
      description: project.description || ''
    })),
    ...(learningPath?.practice_problems || []).map(problem => ({
      ...problem,
      type: 'practice',
      title: problem.title,
      description: `${problem.platform} - ${problem.difficulty}`
    })),
    ...(learningPath?.topics_outline || []).flatMap((topic) => {
      const topicItems = []

      if (topic?.topic) {
        topicItems.push({
          type: 'topic',
          title: topic.topic,
          description: topic.why_it_matters || 'Core area to strengthen'
        })
      }

      ;(topic?.subtopics || []).forEach((subtopic) => {
        if (!subtopic?.title) return
        topicItems.push({
          type: 'topic',
          title: subtopic.title,
          description: subtopic.details || topic.topic || 'Subtopic to review'
        })
      })

      return topicItems
    }),
  ].slice(0, 6) // Limit to 6 items for the circular layout

  const fallbackItems = Object.entries(learningPath?.skill_gaps || {})
    .slice(0, 6)
    .map(([skill, level]) => ({
      type: 'topic',
      title: skill,
      description: `${level} priority area`
    }))

  const displayItems = allItems.length > 0 ? allItems : fallbackItems

  return (
    <div className="min-h-screen bg-canvas text-ink font-body py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => navigate(-1)}
            className="text-ink-muted hover:text-ink mb-4 flex items-center text-caption font-medium transition-colors"
          >
            ← Go Back
          </button>
          <p className="eyebrow mb-2">Learning</p>
          <h1 className="app-page-title flex items-center gap-3 mb-2">
            <BookOpen className="text-primary-600 dark:text-primary-400" size={32} />
            Learning Pathway
          </h1>
          <p className="app-page-subtitle">
            Follow this structured learning path to build skills and close knowledge gaps
          </p>
        </div>

        {/* Main Learning Pathway */}
        <div className="surface-card p-8 md:p-12 mb-12">
          <h2 className="app-section-title mb-12 text-center">Your Personalized Learning Journey</h2>
          
          <div className="relative">
            {/* SVG for connecting lines */}
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" className="fill-hairline-strong" />
                </marker>
              </defs>
              {/* Connecting paths between items */}
              {allItems.length > 1 && (
                <>
                  {/* Top row connections */}
                  {allItems.length > 1 && (
                    <line x1="25%" y1="200" x2="75%" y2="200" className="stroke-hairline-strong" strokeWidth="3" markerEnd="url(#arrowhead)" />
                  )}
                  {/* Middle connections */}
                  {allItems.length > 3 && (
                    <>
                      <line x1="75%" y1="200" x2="75%" y2="400" className="stroke-hairline-strong" strokeWidth="3" markerEnd="url(#arrowhead)" />
                      <line x1="75%" y1="400" x2="25%" y2="400" className="stroke-hairline-strong" strokeWidth="3" markerEnd="url(#arrowhead)" />
                    </>
                  )}
                  {/* Bottom connections */}
                  {allItems.length > 5 && (
                    <>
                      <line x1="25%" y1="400" x2="25%" y2="600" className="stroke-hairline-strong" strokeWidth="3" markerEnd="url(#arrowhead)" />
                      <line x1="25%" y1="600" x2="75%" y2="600" className="stroke-hairline-strong" strokeWidth="3" markerEnd="url(#arrowhead)" />
                    </>
                  )}
                </>
              )}
            </svg>

            {/* Items Grid */}
            {displayItems.length > 0 ? (
              <div className="relative z-10 grid grid-cols-3 gap-12" style={{ minHeight: displayItems.length > 3 ? '700px' : '300px' }}>
                {displayItems.map((item, idx) => {
                  const colorScheme = colors[idx % colors.length]
                  const row = Math.floor(idx / 3)

                  return (
                    <div key={idx} className={`flex flex-col items-center ${row > 0 ? 'mt-32' : ''}`}>
                      <div className={`${colorScheme.circle} text-white rounded-pill w-20 h-20 flex items-center justify-center text-title-lg font-bold mb-4 shadow-soft-sm`}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>

                      <div className="rounded-card border border-hairline bg-surface-sunken p-6 text-center max-w-xs w-full">
                        <h3 className={`${colorScheme.text} font-bold text-overline uppercase tracking-wide mb-2`}>
                          {item.type === 'course' ? 'Learn' : item.type === 'project' ? 'Build' : item.type === 'practice' ? 'Practice' : 'Review'}
                        </h3>
                        <h4 className="text-ink font-bold text-body mb-2 line-clamp-2">
                          {item.title}
                        </h4>
                        <p className="text-ink-muted text-caption mb-4 line-clamp-2">
                          {item.description}
                        </p>

                        {/* YouTube Player or Thumbnail Preview */}
                        {item.type === 'course' && item.video_id && (
                          <div className="mb-4">
                            <div
                              className="relative group/thumb cursor-pointer overflow-hidden rounded-card border border-hairline shadow-soft-xs"
                              onClick={() => setActiveLightboxVideo(item)}
                            >
                              <img
                                src={item.thumbnail_url || item.thumbnail || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'}
                                alt={item.title}
                                className="w-full h-40 object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover/thumb:bg-black/50 transition-colors">
                                <div className="bg-surface-overlay text-primary-600 dark:text-primary-400 rounded-pill p-3 shadow-soft group-hover/thumb:scale-110 transition-transform">
                                  <Video size={24} className="fill-current" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {item.type === 'course' ? (
                          item.video_id ? (
                            <button
                              onClick={() => setActiveLightboxVideo(item)}
                              className={`inline-flex items-center px-4 py-2 ${colorScheme.circle} text-white rounded-card text-caption font-medium hover:shadow-soft transition-all w-full justify-center`}
                            >
                              Play Video
                              <Video size={14} className="ml-2" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="No video was generated for this item yet"
                              className="inline-flex items-center px-4 py-2 bg-surface-raised text-ink-subtle border border-hairline rounded-card text-caption font-medium w-full justify-center cursor-not-allowed"
                            >
                              Video coming soon
                              <Video size={14} className="ml-2" />
                            </button>
                          )
                        ) : (
                          (item.url || item.platform) ? (
                            <a
                              href={item.url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center px-4 py-2 ${colorScheme.circle} text-white rounded-card text-caption font-medium hover:shadow-soft transition-shadow w-full justify-center`}
                            >
                              {item.type === 'project' ? 'View Project' : 'Solve Problem'}
                              <ExternalLink size={14} className="ml-2" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="No link was generated for this item yet"
                              className="inline-flex items-center px-4 py-2 bg-surface-raised text-ink-subtle border border-hairline rounded-card text-caption font-medium w-full justify-center cursor-not-allowed"
                            >
                              Link coming soon
                              <ExternalLink size={14} className="ml-2" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="relative z-10 rounded-panel border border-dashed border-hairline-strong bg-surface-sunken px-6 py-16 text-center">
                <BookOpen className="mx-auto mb-4 text-ink-subtle" size={32} />
                <h3 className="text-title text-ink mb-2">Your learning path is ready</h3>
                <p className="mx-auto max-w-2xl text-body text-ink-muted">
                  The path was generated, but no course, project, or practice items were returned yet.
                  Try generating again, or use the focus areas below to continue manually.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Focus Areas */}
        {learningPath?.skill_gaps && Object.keys(learningPath.skill_gaps).length > 0 && (
          <div className="surface-card p-8 mb-12">
            <h2 className="app-section-title mb-6 flex items-center gap-3">
              <Target size={28} className="text-warning" />
              Key Focus Areas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(learningPath.skill_gaps).map(([skill, level]) => (
                <div key={skill} className="rounded-card border border-hairline bg-surface-sunken p-4 text-center">
                  <p className="text-ink font-semibold capitalize">{skill}</p>
                  <p className="text-caption text-warning mt-1 capitalize">{level}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Tips */}
        <div className="rounded-panel border border-success/20 bg-success/10 p-8">
          <h3 className="text-title text-ink mb-4">📚 Learning Tips</h3>
          <ul className="space-y-3 text-body text-ink-muted">
            <li className="flex items-start">
              <span className="text-success font-bold mr-3">→</span>
              <span>Follow the pathway in order. Each step builds on the previous one</span>
            </li>
            <li className="flex items-start">
              <span className="text-success font-bold mr-3">→</span>
              <span>Complete courses first, then build projects to apply what you've learned</span>
            </li>
            <li className="flex items-start">
              <span className="text-success font-bold mr-3">→</span>
              <span>Use practice problems to test your knowledge and identify weak areas</span>
            </li>
            <li className="flex items-start">
              <span className="text-success font-bold mr-3">→</span>
              <span>Spend 2-4 weeks on each module before moving to the next</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="app-btn-primary"
          >
            Back to Dashboard
          </button>
          {learningPath?.status !== 'completed' && (
            <button
              onClick={handleMarkCompleted}
              className="app-btn-primary flex items-center gap-2"
            >
              <Check size={18} className="shrink-0" />
              <span>Mark Finished</span>
            </button>
          )}
          <button
            onClick={() => navigate('/jobs')}
            className="app-btn-secondary"
          >
            Explore More Opportunities
          </button>
        </div>
        {/* Full Screen Theater Lightbox Modal */}
        {activeLightboxVideo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 sm:p-8 animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl rounded-panel border border-hairline bg-surface-overlay shadow-soft-xl overflow-hidden flex flex-col aspect-video animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setActiveLightboxVideo(null)}
                className="absolute top-4 right-4 z-10 p-2 rounded-card bg-surface-sunken text-ink-muted hover:text-ink border border-hairline hover:border-hairline-strong transition-all"
              >
                <X size={20} />
              </button>
              <iframe
                src={`https://www.youtube.com/embed/${activeLightboxVideo.video_id}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title={activeLightboxVideo.title}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        )}
        <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      </div>
    </div>
  )
}

export default LearningPathPage
