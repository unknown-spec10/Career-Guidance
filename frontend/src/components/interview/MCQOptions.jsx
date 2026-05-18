import React from 'react'
import EvaluationFeedback from './EvaluationFeedback'

const MCQOptions = React.memo(({ 
  question, 
  selectedIndex, 
  evaluation, 
  onSelectOption, 
  disabled = false 
}) => {
  if (!question?.options || question.question_type !== 'mcq') {
    return null
  }

  const isSubmitted = !!question?.submitted_answer || !!evaluation
  const isCorrect = evaluation?.is_correct

  return (
    <>
      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isSelected = selectedIndex === idx

          // Determine styling based on state
          let borderColor = 'border-gray-200'
          let bgColor = ''

          if (isSubmitted && isSelected) {
            if (isCorrect) {
              borderColor = 'border-green-500'
              bgColor = 'bg-green-50'
            } else {
              borderColor = 'border-red-500'
              bgColor = 'bg-red-50'
            }
          } else if (!isSubmitted && isSelected) {
            borderColor = 'border-indigo-600'
            bgColor = 'bg-indigo-50'
          }

          return (
            <label
              key={idx}
              className={`flex items-center p-4 border-2 rounded-lg transition-all ${borderColor} ${bgColor} ${
                isSubmitted ? 'cursor-default opacity-90' : 'cursor-pointer hover:border-indigo-300'
              }`}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={idx}
                checked={isSelected}
                onChange={() => !isSubmitted && onSelectOption(idx)}
                disabled={isSubmitted || disabled}
                className="w-5 h-5 text-indigo-600"
              />
              <span className="ml-3 text-gray-900">{option}</span>
            </label>
          )
        })}
      </div>

      {/* Evaluation Feedback */}
      {evaluation && (
        <EvaluationFeedback evaluation={evaluation} questionType="mcq" />
      )}
    </>
  )
})

MCQOptions.displayName = 'MCQOptions'

export default MCQOptions
