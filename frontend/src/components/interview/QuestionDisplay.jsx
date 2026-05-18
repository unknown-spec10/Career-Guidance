import React from 'react'
import MCQOptions from './MCQOptions'
import ShortAnswerSection from './ShortAnswerSection'

const QuestionDisplay = React.memo(({
  question,
  currentIndex,
  totalQuestions,
  answerId,
  answers,
  evaluations,
  loading = false,
  onAnswerChange,
  onSubmitAnswer,
  disabled = false
}) => {
  if (!question) {
    return null
  }

  const currentAnswer = answers[answerId]
  const evaluation = evaluations[answerId]
  const selectedOptionIndex = currentAnswer?.selected_option

  return (
    <>
      {/* Question Card Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {/* Progress Header */}
        <div className="flex items-start mb-6 pb-4 border-b border-gray-200">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
            {currentIndex + 1}
          </span>
          <div className="ml-4 flex-1">
            <div className="flex items-center flex-wrap gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                {question.question_type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
              </span>
              {(question.skill || question.category) && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                  {question.skill || question.category || 'General'}
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500 font-medium">
                {currentIndex + 1} of {totalQuestions}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Text */}
        <p className="text-lg text-gray-900 whitespace-pre-wrap font-medium leading-relaxed">
          {question.question_text}
        </p>
      </div>

      {/* Answer Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {question.question_type === 'mcq' ? (
          <MCQOptions
            question={question}
            selectedIndex={selectedOptionIndex}
            evaluation={evaluation}
            onSelectOption={(idx) => onSubmitAnswer(question.id, idx, true)}
            disabled={disabled}
          />
        ) : (
          <ShortAnswerSection
            question={question}
            answerText={currentAnswer?.answer_text}
            evaluation={evaluation}
            loading={loading}
            onAnswerChange={(text) => onAnswerChange(question.id, text)}
            onSubmit={(text) => onSubmitAnswer(question.id, text, false)}
            disabled={disabled}
          />
        )}
      </div>
    </>
  )
})

QuestionDisplay.displayName = 'QuestionDisplay'

export default QuestionDisplay
