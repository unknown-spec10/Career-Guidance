import React from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  TrendingUp,
  Send,
  Eye
} from 'lucide-react'

const statusConfig = {
  // Job application statuses
  recommended: {
    icon: TrendingUp,
    label: 'Recommended',
    color: 'blue',
    bgClass: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    iconClass: 'text-blue-400',
    pulse: false
  },
  applied: {
    icon: Send,
    label: 'Applied',
    color: 'yellow',
    bgClass: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    iconClass: 'text-yellow-400',
    pulse: true
  },
  interviewing: {
    icon: Eye,
    label: 'Interviewing',
    color: 'purple',
    bgClass: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    iconClass: 'text-purple-400',
    pulse: true
  },
  offered: {
    icon: TrendingUp,
    label: 'Offered',
    color: 'green',
    bgClass: 'bg-green-500/10 border-green-500/30 text-green-400',
    iconClass: 'text-green-400',
    pulse: true
  },
  accepted: {
    icon: CheckCircle,
    label: 'Accepted',
    color: 'green',
    bgClass: 'bg-green-500/10 border-green-500/30 text-green-400',
    iconClass: 'text-green-400',
    pulse: false
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    color: 'red',
    bgClass: 'bg-red-500/10 border-red-500/30 text-red-400',
    iconClass: 'text-red-400',
    pulse: false
  },
  withdrawn: {
    icon: AlertTriangle,
    label: 'Withdrawn',
    color: 'gray',
    bgClass: 'bg-gray-100 border-gray-300 text-gray-700',
    iconClass: 'text-gray-600',
    pulse: false
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'yellow',
    bgClass: 'bg-yellow-100 border-yellow-300 text-yellow-700',
    iconClass: 'text-yellow-600',
    pulse: true
  },
  approved: {
    icon: CheckCircle,
    label: 'Approved',
    color: 'green',
    bgClass: 'bg-green-100 border-green-300 text-green-700',
    iconClass: 'text-green-600',
    pulse: false
  },
  loading: {
    icon: Loader2,
    label: 'Loading',
    color: 'gray',
    bgClass: 'bg-gray-100 border-gray-300 text-gray-700',
    iconClass: 'text-gray-600 animate-spin',
    pulse: false
  }
}

export default function StatusBadge({ status, size = 'md', showIcon = true, customLabel }) {
  const config = statusConfig[status?.toLowerCase()] || statusConfig.pending
  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center space-x-1.5 rounded-full border font-medium ${config.bgClass} ${sizeClasses[size]} relative overflow-hidden`}
    >
      {/* Pulse animation for active states */}
      {config.pulse && (
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute inset-0 rounded-full ${config.bgClass.split(' ')[0]}`}
        />
      )}

      {showIcon && <Icon className={`${iconSizes[size]} ${config.iconClass} relative z-10`} />}
      <span className="relative z-10">{customLabel || config.label}</span>
    </motion.div>
  )
}

export function NewBadge() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-500 text-white relative overflow-hidden"
    >
      <motion.span
        animate={{
          opacity: [1, 0.5, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
        }}
      >
        NEW
      </motion.span>
      
      {/* Shimmer effect */}
      <motion.div
        animate={{
          x: ['-100%', '200%']
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />
    </motion.span>
  )
}
