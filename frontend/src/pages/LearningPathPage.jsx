import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../config/api'
import { BookOpen, ExternalLink, Code, Video, FileText, Award, Target, ArrowRight } from 'lucide-react'

const LearningPathPage = () => {
  const { pathId } = useParams()
  const navigate = useNavigate()
  const [learningPath, setLearningPath] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLearningPath()
  }, [pathId])

  const fetchLearningPath = async () => {
    try {
      const response = await api.get(`/api/learning-paths/${pathId}`)
      setLearningPath(response.data)
    } catch (error) {
      console.error('Error fetching learning path:', error)
      alert('Failed to load learning path')
      navigate('/dashboard/interview')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const colors = [
    { circle: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-700' },
    { circle: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700' },
    { circle: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700' },
    { circle: 'bg-pink-500', light: 'bg-pink-50', text: 'text-pink-700' },
    { circle: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700' },
    { circle: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700' }
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
    }))
  ].slice(0, 6) // Limit to 6 items for the circular layout

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => navigate(-1)}
            className="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center text-sm font-medium"
          >
            ← Go Back
          </button>
          <h1 className="text-4xl font-bold text-gray-900 flex items-center mb-2">
            <BookOpen className="mr-3 text-indigo-600" size={36} />
            Learning Pathway
          </h1>
          <p className="text-gray-600 text-lg">
            Follow this structured learning path to build skills and close knowledge gaps
          </p>
        </div>

        {/* Main Learning Pathway */}
        <div className="bg-white rounded-2xl shadow-lg p-12 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">Your Personalized Learning Journey</h2>
          
          <div className="relative">
            {/* SVG for connecting lines */}
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="#d1d5db" />
                </marker>
              </defs>
              {/* Connecting paths between items */}
              {allItems.length > 1 && (
                <>
                  {/* Top row connections */}
                  {allItems.length > 1 && (
                    <line x1="25%" y1="200" x2="75%" y2="200" stroke="#e5e7eb" strokeWidth="3" markerEnd="url(#arrowhead)" />
                  )}
                  {/* Middle connections */}
                  {allItems.length > 3 && (
                    <>
                      <line x1="75%" y1="200" x2="75%" y2="400" stroke="#e5e7eb" strokeWidth="3" markerEnd="url(#arrowhead)" />
                      <line x1="75%" y1="400" x2="25%" y2="400" stroke="#e5e7eb" strokeWidth="3" markerEnd="url(#arrowhead)" />
                    </>
                  )}
                  {/* Bottom connections */}
                  {allItems.length > 5 && (
                    <>
                      <line x1="25%" y1="400" x2="25%" y2="600" stroke="#e5e7eb" strokeWidth="3" markerEnd="url(#arrowhead)" />
                      <line x1="25%" y1="600" x2="75%" y2="600" stroke="#e5e7eb" strokeWidth="3" markerEnd="url(#arrowhead)" />
                    </>
                  )}
                </>
              )}
            </svg>

            {/* Items Grid */}
            <div className="relative z-10 grid grid-cols-3 gap-12" style={{ minHeight: allItems.length > 3 ? '700px' : '300px' }}>
              {allItems.map((item, idx) => {
                const colorScheme = colors[idx % colors.length]
                const isOdd = idx % 2 === 1
                const row = Math.floor(idx / 3)
                const col = idx % 3
                
                return (
                  <div key={idx} className={`flex flex-col items-center ${row > 0 ? 'mt-32' : ''}`}>
                    {/* Number Circle */}
                    <div className={`${colorScheme.circle} text-white rounded-full w-20 h-20 flex items-center justify-center text-2xl font-bold mb-4 shadow-lg hover:shadow-xl transition-shadow`}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>

                    {/* Content Card */}
                    <div className={`${colorScheme.light} rounded-xl p-6 text-center max-w-xs w-full`}>
                      <h3 className={`${colorScheme.text} font-bold text-sm mb-2 uppercase tracking-wide`}>
                        {item.type === 'course' ? 'Learn' : item.type === 'project' ? 'Build' : 'Practice'}
                      </h3>
                      <h4 className="text-gray-900 font-bold text-lg mb-2 line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {item.description}
                      </p>

                      {/* Action Button */}
                      {(item.url || item.platform) && (
                        <a
                          href={item.url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center px-4 py-2 ${colorScheme.circle} text-white rounded-lg text-sm font-medium hover:shadow-lg transition-shadow`}
                        >
                          {item.type === 'course' ? 'Start Course' : item.type === 'project' ? 'View Project' : 'Solve Problem'}
                          <ExternalLink size={14} className="ml-2" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Focus Areas */}
        {learningPath?.skill_gaps && learningPath.skill_gaps.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <Target size={28} className="mr-3 text-orange-600" />
              Key Focus Areas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {learningPath.skill_gaps.map((skill, idx) => (
                <div key={idx} className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-4 text-center">
                  <p className="text-gray-900 font-semibold">{skill}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Tips */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8">
          <h3 className="text-lg font-bold text-green-900 mb-4">📚 Learning Tips</h3>
          <ul className="space-y-3 text-green-800">
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-3">→</span>
              <span>Follow the pathway in order. Each step builds on the previous one</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-3">→</span>
              <span>Complete courses first, then build projects to apply what you've learned</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-3">→</span>
              <span>Use practice problems to test your knowledge and identify weak areas</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 font-bold mr-3">→</span>
              <span>Spend 2-4 weeks on each module before moving to the next</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => navigate('/jobs')}
            className="px-8 py-3 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium rounded-lg transition-colors"
          >
            Explore More Opportunities
          </button>
        </div>
      </div>
    </div>
  )
}

export default LearningPathPage
