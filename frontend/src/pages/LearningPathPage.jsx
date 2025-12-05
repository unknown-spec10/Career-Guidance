import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../config/api'
import { BookOpen, ExternalLink, Code, Video, FileText, Award, Target } from 'lucide-react'

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

  const getPriorityColor = (priority) => {
    if (priority === 'high') return 'bg-red-100 text-red-800 border-red-300'
    if (priority === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-green-100 text-green-800 border-green-300'
  }

  const getDifficultyColor = (difficulty) => {
    if (difficulty === 'hard') return 'bg-red-100 text-red-800'
    if (difficulty === 'medium') return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard/interview')}
          className="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center"
        >
          ← Back to Interviews
        </button>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <BookOpen className="mr-3 text-indigo-600" />
          Personalized Learning Path
        </h1>
        <p className="text-gray-600 mt-2">
          Curated resources based on your interview performance and skill gaps
        </p>
      </div>

      {/* Skill Gaps Overview */}
      {learningPath?.skill_gaps && learningPath.skill_gaps.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
            <Target className="mr-2 text-orange-600" />
            Focus Areas
          </h2>
          <div className="flex flex-wrap gap-2">
            {learningPath.skill_gaps.map((skill, idx) => {
              const priority = learningPath.recommended_courses?.find(c => 
                c.focus_skills?.includes(skill)
              )?.priority || 'medium'
              
              return (
                <span
                  key={idx}
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(priority)}`}
                >
                  {skill}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Recommended Courses */}
      {learningPath?.recommended_courses && learningPath.recommended_courses.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <Video className="mr-2 text-indigo-600" />
            Recommended Courses
          </h2>
          <div className="space-y-4">
            {learningPath.recommended_courses.map((course, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {course.provider}
                      </span>
                      <span className={`px-3 py-1 text-xs rounded-full border ${getPriorityColor(course.priority)}`}>
                        {course.priority} priority
                      </span>
                    </div>
                  </div>
                  {course.url && (
                    <a
                      href={course.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 ml-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors flex items-center"
                    >
                      Open Course
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  )}
                </div>
                {course.focus_skills && course.focus_skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-sm text-gray-600">Skills covered:</span>
                    {course.focus_skills.map((skill, skillIdx) => (
                      <span
                        key={skillIdx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Projects */}
      {learningPath?.recommended_projects && learningPath.recommended_projects.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <Code className="mr-2 text-indigo-600" />
            Suggested Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {learningPath.recommended_projects.map((project, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {project.title}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {project.description}
                </p>
                {project.skills && project.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {project.skills.map((skill, skillIdx) => (
                      <span
                        key={skillIdx}
                        className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practice Problems */}
      {learningPath?.practice_problems && learningPath.practice_problems.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <FileText className="mr-2 text-indigo-600" />
            Practice Problems
          </h2>
          <div className="space-y-3">
            {learningPath.practice_problems.map((problem, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                      {problem.title}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{problem.platform}</span>
                      <span className={`px-2 py-1 text-xs rounded ${getDifficultyColor(problem.difficulty)}`}>
                        {problem.difficulty}
                      </span>
                      {problem.skill && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded">
                          {problem.skill}
                        </span>
                      )}
                    </div>
                  </div>
                  {problem.url && (
                    <a
                      href={problem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 ml-4 px-3 py-2 border border-gray-300 hover:border-indigo-600 text-gray-700 hover:text-indigo-600 text-sm rounded-lg transition-colors flex items-center"
                    >
                      Solve
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!learningPath?.recommended_courses || learningPath.recommended_courses.length === 0) &&
       (!learningPath?.recommended_projects || learningPath.recommended_projects.length === 0) &&
       (!learningPath?.practice_problems || learningPath.practice_problems.length === 0) && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Great Performance!
          </h3>
          <p className="text-gray-600">
            You're doing well across all evaluated skills. Keep practicing to maintain your level!
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/dashboard/interview')}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors"
        >
          Take Another Interview
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 py-3 rounded-lg font-medium transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Progress Tip */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-800">
          <strong>💡 Tip:</strong> Focus on high-priority resources first, then work through medium and low priority items. 
          Revisit this page after completing courses to track your improvement!
        </p>
      </div>
    </div>
  )
}

export default LearningPathPage
