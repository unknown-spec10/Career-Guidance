import React, { useState, useEffect, useRef } from 'react'
import { Clock } from 'lucide-react'

const SessionTimer = React.memo(({ endTime, onTimeout }) => {
  const [timeLeft, setTimeLeft] = useState(0)
  const timeoutCalled = useRef(false)

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!endTime) return

      const now = new Date().getTime()
      const end = new Date(endTime).getTime()

      if (isNaN(end)) {
        console.error('Timer: Invalid end time', endTime)
        return
      }

      const diff = Math.max(0, Math.floor((end - now) / 1000))
      setTimeLeft(diff)

      if (diff === 0 && onTimeout && !timeoutCalled.current) {
        timeoutCalled.current = true
        onTimeout()
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [endTime, onTimeout])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isWarning = timeLeft < 60
  const isCritical = timeLeft < 30
  const isLow = timeLeft < 300

  const getStyles = () => {
    if (isCritical) {
      return {
        container: 'bg-red-50 border-red-500 animate-pulse',
        text: 'text-red-700',
        icon: 'animate-pulse',
        message: 'text-red-600'
      }
    }
    if (isWarning) {
      return {
        container: 'bg-red-50 border-red-400',
        text: 'text-red-600',
        icon: '',
        message: 'text-red-500'
      }
    }
    if (isLow) {
      return {
        container: 'bg-yellow-50 border-yellow-400',
        text: 'text-yellow-700',
        icon: '',
        message: 'text-yellow-600'
      }
    }
    return {
      container: 'bg-blue-50 border-blue-400',
      text: 'text-blue-700',
      icon: '',
      message: 'text-blue-600'
    }
  }

  const styles = getStyles()
  const MESSAGE = isCritical ? 'Time almost up!' : isWarning ? 'Hurry up!' : isLow ? 'Running low' : 'Time remaining'

  return (
    <div className={`flex flex-col items-end p-3 rounded-lg border-2 ${styles.container}`}>
      <div className={`flex items-center ${styles.text}`}>
        <Clock className={`w-6 h-6 mr-2 ${styles.icon}`} />
        <span className="text-2xl font-mono font-bold">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <span className={`text-xs mt-1 font-medium ${styles.message}`}>
        {MESSAGE}
      </span>
    </div>
  )
})

SessionTimer.displayName = 'SessionTimer'

export default SessionTimer
