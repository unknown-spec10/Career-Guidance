import React from 'react'

export function CardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start space-x-4">
        <div className="w-12 h-12 bg-dark-700 rounded-lg"></div>
        <div className="flex-1 space-y-3">
          <div className="h-6 bg-dark-700 rounded w-3/4"></div>
          <div className="h-4 bg-dark-700 rounded w-1/2"></div>
          <div className="flex space-x-2">
            <div className="h-6 bg-dark-700 rounded w-16"></div>
            <div className="h-6 bg-dark-700 rounded w-16"></div>
            <div className="h-6 bg-dark-700 rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center space-x-4 p-4 border-b border-dark-700 animate-pulse">
      <div className="w-10 h-10 bg-dark-700 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-dark-700 rounded w-1/3"></div>
        <div className="h-3 bg-dark-700 rounded w-1/4"></div>
      </div>
      <div className="h-8 bg-dark-700 rounded w-20"></div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-dark-700 rounded w-24"></div>
          <div className="h-8 bg-dark-700 rounded w-16"></div>
        </div>
        <div className="w-12 h-12 bg-dark-700 rounded-full"></div>
      </div>
    </div>
  )
}

export function GridSkeleton({ count = 6, columns = 3 }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns} gap-6`}>
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  )
}
