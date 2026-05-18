import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import LoadingButton from '../LoadingButton'

const NavigationControls = React.memo(({
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
  onComplete,
  completing = false,
  disabled = false
}) => {
  const isLastQuestion = currentIndex >= totalQuestions - 1
  const isFirstQuestion = currentIndex === 0

  return (
    <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-gray-200">
      {/* Previous Button */}
      <button
        onClick={onPrevious}
        disabled={isFirstQuestion || disabled}
        className="flex items-center px-4 py-2 text-gray-700 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors font-medium rounded-lg hover:bg-gray-100 disabled:bg-transparent"
      >
        <ChevronLeft className="w-5 h-5 mr-1" />
        Previous
      </button>

      {/* Question Counter */}
      <div className="text-sm text-gray-600 font-medium">
        {currentIndex + 1} of {totalQuestions}
      </div>

      {/* Next or Complete Button */}
      {isLastQuestion ? (
        <LoadingButton
          onClick={onComplete}
          loading={completing}
          disabled={completing || disabled}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Complete Interview
        </LoadingButton>
      ) : (
        <button
          onClick={onNext}
          disabled={disabled}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-5 h-5 ml-1" />
        </button>
      )}
    </div>
  )
})

NavigationControls.displayName = 'NavigationControls'

export default NavigationControls
