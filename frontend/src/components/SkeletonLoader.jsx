import React from 'react'
import { motion } from 'framer-motion'

/**
 * Reusable skeleton loader component for better loading UX
 * Replaces spinners with content-shaped placeholders
 */

export const SkeletonCard = ({ count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, idx) => (
      <motion.div
        key={idx}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-dark-800 rounded-lg border border-dark-700 p-6 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-dark-700 rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-dark-700 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-dark-700 rounded animate-pulse w-1/2" />
          </div>
        </div>
        
        {/* Content */}
        <div className="space-y-2">
          <div className="h-3 bg-dark-700 rounded animate-pulse w-full" />
          <div className="h-3 bg-dark-700 rounded animate-pulse w-5/6" />
          <div className="h-3 bg-dark-700 rounded animate-pulse w-4/6" />
        </div>
        
        {/* Footer */}
        <div className="flex gap-2 pt-2">
          <div className="h-6 bg-dark-700 rounded-full animate-pulse w-16" />
          <div className="h-6 bg-dark-700 rounded-full animate-pulse w-20" />
        </div>
      </motion.div>
    ))}
  </>
)

export const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
    {/* Table Header */}
    <div className="border-b border-dark-700 bg-dark-900 px-6 py-4">
      <div className="flex gap-4">
        {Array.from({ length: columns }).map((_, idx) => (
          <div
            key={idx}
            className="h-4 bg-dark-700 rounded animate-pulse"
            style={{ width: `${100 / columns}%` }}
          />
        ))}
      </div>
    </div>
    
    {/* Table Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="border-b border-dark-700 px-6 py-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="h-4 bg-dark-700 rounded animate-pulse"
              style={{ width: `${100 / columns}%` }}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
)

export const SkeletonList = ({ items = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: items }).map((_, idx) => (
      <motion.div
        key={idx}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: idx * 0.05 }}
        className="bg-dark-800 rounded-lg border border-dark-700 p-4 flex items-center gap-4"
      >
        <div className="w-10 h-10 bg-dark-700 rounded animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-dark-700 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-dark-700 rounded animate-pulse w-1/2" />
        </div>
        <div className="w-20 h-8 bg-dark-700 rounded animate-pulse" />
      </motion.div>
    ))}
  </div>
)

export const SkeletonStats = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {Array.from({ length: 4 }).map((_, idx) => (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.1 }}
        className="bg-dark-800 rounded-lg border border-dark-700 p-6 space-y-3"
      >
        <div className="flex justify-between items-center">
          <div className="w-12 h-12 bg-dark-700 rounded-lg animate-pulse" />
          <div className="w-16 h-6 bg-dark-700 rounded animate-pulse" />
        </div>
        <div className="h-8 bg-dark-700 rounded animate-pulse w-20" />
        <div className="h-4 bg-dark-700 rounded animate-pulse w-32" />
      </motion.div>
    ))}
  </div>
)

export const SkeletonProfile = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-dark-800 rounded-lg border border-dark-700 p-6 space-y-6"
  >
    {/* Avatar and Name */}
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 bg-dark-700 rounded-full animate-pulse" />
      <div className="flex-1 space-y-3">
        <div className="h-6 bg-dark-700 rounded animate-pulse w-48" />
        <div className="h-4 bg-dark-700 rounded animate-pulse w-32" />
        <div className="h-4 bg-dark-700 rounded animate-pulse w-40" />
      </div>
    </div>
    
    {/* Info Sections */}
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <div className="h-5 bg-dark-700 rounded animate-pulse w-32" />
          <div className="h-4 bg-dark-700 rounded animate-pulse w-full" />
          <div className="h-4 bg-dark-700 rounded animate-pulse w-5/6" />
        </div>
      ))}
    </div>
  </motion.div>
)

export const SkeletonDashboard = () => (
  <div className="space-y-8">
    <SkeletonStats />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SkeletonCard count={2} />
    </div>
  </div>
)

export default {
  Card: SkeletonCard,
  Table: SkeletonTable,
  List: SkeletonList,
  Stats: SkeletonStats,
  Profile: SkeletonProfile,
  Dashboard: SkeletonDashboard,
}
