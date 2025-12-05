import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../config/api'
import { Award, TrendingUp, TrendingDown, Target, BookOpen, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

const SkillGapChart = ({ skillScores }) => {
  if (!skillScores || Object.keys(skillScores).length === 0) {
    return <p className="text-gray-500">No skill data available</p>
  }

  const getScoreColor = (score) => {
    if (score >= 70) return 'bg-green-500'
    if (score >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTextColor = (score) => {
    if (score >= 70) return 'text-green-700'
    if (score >= 40) return 'text-yellow-700'
    return 'text-red-700'
  }

  return (
    <div className="space-y-4">
      {Object.entries(skillScores).map(([skill, score]) => (
        <div key={skill}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{skill}</span>
            <span className={`text-sm font-bold ${getTextColor(score)}`}>
              {score.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${getScoreColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const InterviewResultsPage = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [learningPath, setLearningPath] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchResults()
  }, [sessionId])

  const fetchResults = async () => {
    try {
      // Fetch session details
      const sessionResponse = await api.get(`/api/interviews/${sessionId}/questions`)
      setSession(sessionResponse.data.session)

      // Fetch learning path if available
      if (sessionResponse.data.session.learning_path_id) {
        try {
          const learningResponse = await api.get(`/api/learning-paths/${sessionResponse.data.session.learning_path_id}`)
          setLearningPath(learningResponse.data)
        } catch (error) {
          console.error('Error fetching learning path:', error)
        }
      }
    } catch (error) {
      console.error('Error fetching results:', error)
      alert('Failed to load interview results')
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

  const getScoreBadge = (score) => {
    if (score >= 80) return { text: 'Excellent', bg: 'bg-green-100', textColor: 'text-green-800', border: 'border-green-300' }
    if (score >= 60) return { text: 'Good', bg: 'bg-blue-100', textColor: 'text-blue-800', border: 'border-blue-300' }
    if (score >= 40) return { text: 'Average', bg: 'bg-yellow-100', textColor: 'text-yellow-800', border: 'border-yellow-300' }
    return { text: 'Needs Improvement', bg: 'bg-red-100', textColor: 'text-red-800', border: 'border-red-300' }
  }

  const badge = session?.overall_score ? getScoreBadge(session.overall_score) : null

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
        <h1 className="text-3xl font-bold text-gray-900">Interview Results</h1>
        <p className="text-gray-600 mt-2">
          {session?.session_type} • {session?.difficulty_level} • {new Date(session?.started_at).toLocaleDateString()}
        </p>
      </div>

      {/* Overall Score Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-8 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90 mb-2">Overall Score</div>
            <div className="text-6xl font-bold">{session?.overall_score?.toFixed(1)}%</div>
            {badge && (
              <div className={`inline-block mt-4 px-4 py-2 ${badge.bg} ${badge.textColor} rounded-full font-medium`}>
                {badge.text}
              </div>
            )}
          </div>
          <Award className="w-24 h-24 opacity-50" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Skill Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Target className="mr-2 text-indigo-600" />
            Skill Breakdown
          </h2>
          {session?.skill_scores ? (
            <SkillGapChart skillScores={session.skill_scores} />
          ) : (
            <p className="text-gray-500">No skill data available</p>
          )}
        </div>

        {/* AI Feedback */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <BookOpen className="mr-2 text-indigo-600" />
            AI Feedback
          </h2>
          {session?.ai_feedback ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Strengths
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {session.ai_feedback.strengths || 'No specific strengths identified'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center">
                  <XCircle className="w-4 h-4 mr-1" />
                  Areas for Improvement
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {session.ai_feedback.weaknesses || 'No specific weaknesses identified'}
                </p>
              </div>
              {session.ai_feedback.recommendations && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Recommendations
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {session.ai_feedback.recommendations}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No AI feedback available</p>
          )}
        </div>
      </div>

      {/* Skill Gap Analysis */}
      {session?.skill_gap_analysis && Object.keys(session.skill_gap_analysis).length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <TrendingDown className="mr-2 text-indigo-600" />
            Skill Gap Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Weak Skills */}
            {session.skill_gap_analysis.weak?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-3">
                  Needs Attention ({session.skill_gap_analysis.weak.length})
                </h3>
                <div className="space-y-2">
                  {session.skill_gap_analysis.weak.map((skill, idx) => (
                    <div key={idx} className="text-sm text-red-700 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Moderate Skills */}
            {session.skill_gap_analysis.moderate?.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-800 mb-3">
                  Can Improve ({session.skill_gap_analysis.moderate.length})
                </h3>
                <div className="space-y-2">
                  {session.skill_gap_analysis.moderate.map((skill, idx) => (
                    <div key={idx} className="text-sm text-yellow-700 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strong Skills */}
            {session.skill_gap_analysis.strong?.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-800 mb-3">
                  Strong Skills ({session.skill_gap_analysis.strong.length})
                </h3>
                <div className="space-y-2">
                  {session.skill_gap_analysis.strong.map((skill, idx) => (
                    <div key={idx} className="text-sm text-green-700 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Learning Path Preview */}
      {learningPath && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <BookOpen className="mr-2 text-indigo-600" />
            Personalized Learning Path
          </h2>
          <p className="text-gray-600 mb-6">
            Based on your performance, we've created a customized learning path to help you improve.
          </p>

          {/* Quick Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {learningPath.recommended_courses?.length || 0}
              </div>
              <div className="text-sm text-blue-800">Recommended Courses</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {learningPath.recommended_projects?.length || 0}
              </div>
              <div className="text-sm text-purple-800">Suggested Projects</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {learningPath.practice_problems?.length || 0}
              </div>
              <div className="text-sm text-green-800">Practice Problems</div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/dashboard/learning-path/${learningPath.id}`)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors"
          >
            View Full Learning Path
          </button>
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

      {/* Impact Notice */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <AlertCircle className="w-5 h-5 text-blue-600 inline mr-2" />
        <span className="text-sm text-blue-800">
          This interview score will boost your recommendation rankings! Scores remain valid for 6 months.
        </span>
      </div>
    </div>
  )
}

export default InterviewResultsPage
