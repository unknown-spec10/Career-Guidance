import React from 'react'
import { Send } from 'lucide-react'
import LoadingButton from '../LoadingButton'
import EvaluationFeedback from './EvaluationFeedback'

const ShortAnswerSection = React.memo(({
  question,
  answerText,
  evaluation,
  loading = false,
  onAnswerChange,
  onSubmit,
  disabled = false
}) => {
  if (question?.question_type !== 'short_answer') {
    return null
  }

  const isSubmitted = !!question?.submitted_answer || !!evaluation
  const isAnswerEmpty = !answerText?.trim()

  return (
    <>
      {/* Text Area */}
      <div className="mb-4">
        <textarea
          value={answerText || ''}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type your answer here..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          rows={6}
          disabled={isSubmitted || disabled}
        />
        <p className="text-sm text-gray-500 mt-2">
          Tip: Be concise and focus on key points
        </p>
      </div>

      {/* Submit Button */}
      {!isSubmitted && (
        <LoadingButton
          onClick={() => onSubmit(answerText)}
          loading={loading}
          disabled={isAnswerEmpty || loading || disabled}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4 mr-2" />
          Submit Answer
        </LoadingButton>
      )}

      {/* Evaluation Feedback */}
      {evaluation && (
        <EvaluationFeedback evaluation={evaluation} questionType="short_answer" />
      )}
    </>
  )
})

ShortAnswerSection.displayName = 'ShortAnswerSection'

export default ShortAnswerSection
