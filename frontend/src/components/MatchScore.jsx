import React from 'react'
import { motion } from 'framer-motion'
import { CircularProgress } from './ProgressBar'
import { Sparkles } from 'lucide-react'

export default function MatchScore({ score, size = 'md', showLabel = true }) {
  const sizes = {
    sm: { container: 60, stroke: 5, text: 'text-sm' },
    md: { container: 80, stroke: 6, text: 'text-base' },
    lg: { container: 100, stroke: 8, text: 'text-xl' }
  }

  const config = sizes[size] || sizes.md
  const percentage = Math.round(score * 100)
  
  // Determine color based on score
  const getColor = (score) => {
    if (score >= 0.8) return 'green'
    if (score >= 0.6) return 'blue'
    if (score >= 0.4) return 'yellow'
    return 'red'
  }

  const color = getColor(score)

  const getLabel = (score) => {
    if (score >= 0.8) return 'Excellent Match'
    if (score >= 0.6) return 'Good Match'
    if (score >= 0.4) return 'Fair Match'
    return 'Low Match'
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative">
        <CircularProgress 
          value={percentage} 
          size={config.container}
          strokeWidth={config.stroke}
          color={color}
          showValue={true}
          label=""
        />
        
        {score >= 0.8 && (
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          </motion.div>
        )}
      </div>
      
      {showLabel && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className={`${config.text} font-medium text-gray-300`}
        >
          {getLabel(score)}
        </motion.p>
      )}
    </div>
  )
}
