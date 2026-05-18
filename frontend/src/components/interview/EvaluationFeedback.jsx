import React from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'

// Utility to safely render evaluation text
const renderEvaluationText = (data) => {
  if (!data) return null
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.join(', ')
  if (typeof data === 'object') return JSON.stringify(data)
  return String(data)
}

const EvaluationFeedback = React.memo(({ evaluation, questionType, maxScore = 10 }) => {
  if (!evaluation) return null

  const score = evaluation.score || 0
  const scorePercentage = (score / (evaluation.max_score || maxScore)) * 100
  const isCorrect = evaluation.is_correct
  const isHighScore = scorePercentage >= 70
  const isMediumScore = scorePercentage >= 40

  // Get styling based on question type and score
  const getStatusStyles = () => {
    if (questionType === 'mcq') {
      return isCorrect
        ? { container: 'bg-green-50 border-green-500', text: 'text-green-700', icon: 'text-green-700', label: "That's right!" }
        : { container: 'bg-red-50 border-red-500', text: 'text-red-700', icon: 'text-red-700', label: 'Not quite' }
    }
    // Short answer
    return isHighScore
      ? { container: 'bg-green-50 border-green-500', text: 'text-green-700', icon: 'text-green-700', label: 'Great!' }
      : isMediumScore
      ? { container: 'bg-yellow-50 border-yellow-500', text: 'text-yellow-700', icon: 'text-yellow-700', label: 'Good attempt' }
      : { container: 'bg-red-50 border-red-500', text: 'text-red-700', icon: 'text-red-700', label: 'Keep practicing' }
  }

  const styles = getStatusStyles()

  return (
    <div className={`mt-4 p-4 rounded-lg border-2 ${styles.container}`}>
      {/* Header with status */}
      <div className="flex items-start gap-2 mb-3">
        <div className={`flex items-center ${styles.icon}`}>
          {isCorrect ? (
            <>
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="font-semibold">{styles.label}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="font-semibold">{styles.label}</span>
            </>
          )}
        </div>
      </div>

      {/* Main evaluation text */}
      {evaluation.ai_evaluation && (
        <div className={`text-sm ${styles.text} mb-3`}>
          <p className="whitespace-pre-wrap">{renderEvaluationText(evaluation.ai_evaluation)}</p>
        </div>
      )}

      {/* Strengths section */}
      {evaluation.strengths && (
        <div className="mt-3 p-3 bg-white rounded-lg border-l-4 border-green-500">
          <p className="text-xs font-semibold text-green-700 mb-1">✓ Strengths:</p>
          <p className="text-sm text-gray-700">{renderEvaluationText(evaluation.strengths)}</p>
        </div>
      )}

      {/* Weaknesses section (for short answers) */}
      {evaluation.weaknesses && (
        <div className="mt-3 p-3 bg-white rounded-lg border-l-4 border-red-500">
          <p className="text-xs font-semibold text-red-700 mb-1">✗ Areas to improve:</p>
          <p className="text-sm text-gray-700">{renderEvaluationText(evaluation.weaknesses)}</p>
        </div>
      )}

      {/* Suggestions section */}
      {evaluation.improvement_suggestions && (
        <div className="mt-3 p-3 bg-white rounded-lg border-l-4 border-blue-500">
          <p className="text-xs font-semibold text-blue-700 mb-1">💡 Suggestions:</p>
          <p className="text-sm text-gray-700">{renderEvaluationText(evaluation.improvement_suggestions)}</p>
        </div>
      )}

      {/* Score display */}
      <div className="mt-3 pt-3 border-t border-gray-300">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">Score:</p>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  isHighScore ? 'bg-green-500' : isMediumScore ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(scorePercentage, 100)}%` }}
              />
            </div>
            <span className="text-sm font-bold text-gray-700">
              {score?.toFixed(1) || 0}/{evaluation.max_score || maxScore}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

EvaluationFeedback.displayName = 'EvaluationFeedback'

export default EvaluationFeedback
