import React from 'react'
import { motion } from 'framer-motion'
import { Inbox, Upload, Search, Briefcase, Building2, FileText } from 'lucide-react'

const iconMap = {
  inbox: Inbox,
  upload: Upload,
  search: Search,
  briefcase: Briefcase,
  building: Building2,
  file: FileText
}

export default function EmptyState({ 
  icon = 'inbox', 
  title, 
  message, 
  actionLabel, 
  onAction,
  showAnimation = true 
}) {
  const Icon = iconMap[icon] || Inbox

  return (
    <motion.div
      initial={showAnimation ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <motion.div
        animate={showAnimation ? {
          y: [0, -10, 0],
        } : {}}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="mb-6"
      >
        <div className="p-6 rounded-full bg-gray-200 border border-gray-300">
          <Icon className="w-16 h-16 text-gray-500" />
        </div>
      </motion.div>

      <h3 className="text-xl font-semibold mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-500 text-center max-w-md mb-6">{message}</p>

      {actionLabel && onAction && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          className="btn-primary"
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  )
}
