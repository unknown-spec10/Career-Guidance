import React from 'react'
import { motion } from 'framer-motion'

export default function SkillTag({ 
  skill, 
  matched = false, 
  size = 'md',
  removable = false,
  onRemove 
}) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  }

  const sizeClass = sizes[size] || sizes.md

  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      className={`
        inline-flex items-center gap-1.5 rounded-full border font-medium
        ${sizeClass}
        ${matched 
          ? 'bg-green-900/30 border-green-500/50 text-green-300' 
          : 'bg-dark-800 border-dark-600 text-gray-300'
        }
        ${removable ? 'pr-1' : ''}
        transition-all
      `}
    >
      <span>{typeof skill === 'string' ? skill : skill.name || skill}</span>
      
      {removable && (
        <motion.button
          whileHover={{ scale: 1.2, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation()
            onRemove && onRemove()
          }}
          className="p-0.5 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>
      )}
    </motion.span>
  )
}

export function SkillList({ skills, matchedSkills = [], size = 'md', maxDisplay = 6 }) {
  const matchedSet = new Set(
    matchedSkills.map(s => 
      (typeof s === 'string' ? s : s.name || s).toLowerCase()
    )
  )

  const skillsList = skills.slice(0, maxDisplay)
  const remaining = skills.length - maxDisplay

  return (
    <div className="flex flex-wrap gap-2">
      {skillsList.map((skill, idx) => {
        const skillName = typeof skill === 'string' ? skill : skill.name || skill
        const isMatched = matchedSet.has(skillName.toLowerCase())
        
        return (
          <SkillTag 
            key={idx} 
            skill={skill} 
            matched={isMatched}
            size={size}
          />
        )
      })}
      
      {remaining > 0 && (
        <span className={`
          inline-flex items-center rounded-full border border-dark-600
          bg-dark-900 text-gray-500 font-medium
          ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}
        `}>
          +{remaining} more
        </span>
      )}
    </div>
  )
}
