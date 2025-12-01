import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Progressive list component with skeleton loading and pagination
 * Loads data in batches for better UX with large datasets
 */
export default function ProgressiveList({
  items = [],
  loading = false,
  renderItem,
  skeletonCount = 5,
  SkeletonComponent,
  pageSize = 10,
  emptyMessage = 'No items found',
  className = '',
  listClassName = '',
}) {
  const [displayedItems, setDisplayedItems] = useState([])
  const [page, setPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  useEffect(() => {
    // Reset when items change
    setDisplayedItems(items.slice(0, pageSize))
    setPage(1)
  }, [items, pageSize])

  const loadMore = () => {
    if (isLoadingMore) return
    
    setIsLoadingMore(true)
    setTimeout(() => {
      const nextPage = page + 1
      const start = page * pageSize
      const end = start + pageSize
      const newItems = items.slice(start, end)
      
      setDisplayedItems(prev => [...prev, ...newItems])
      setPage(nextPage)
      setIsLoadingMore(false)
    }, 300) // Small delay for smooth UX
  }

  const hasMore = displayedItems.length < items.length

  if (loading) {
    return (
      <div className={className}>
        {SkeletonComponent ? (
          <SkeletonComponent count={skeletonCount} />
        ) : (
          <div className="space-y-3">
            {Array.from({ length: skeletonCount }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 bg-gray-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!items.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`text-center py-12 ${className}`}
      >
        <p className="text-gray-500 text-lg">{emptyMessage}</p>
      </motion.div>
    )
  }

  return (
    <div className={className}>
      <div className={listClassName}>
        <AnimatePresence mode="popLayout">
          {displayedItems.map((item, idx) => (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.02 }}
            >
              {renderItem(item, idx)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {hasMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center mt-8"
        >
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all
                     flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            {isLoadingMore ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading...
              </>
            ) : (
              <>
                Load More
                <span className="text-sm opacity-80">
                  ({items.length - displayedItems.length} remaining)
                </span>
              </>
            )}
          </button>
        </motion.div>
      )}

      {!hasMore && items.length > pageSize && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-gray-500 mt-6"
        >
          All {items.length} items loaded
        </motion.p>
      )}
    </div>
  )
}
