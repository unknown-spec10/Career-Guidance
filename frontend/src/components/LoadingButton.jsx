import React from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export default function LoadingButton({
  loading,
  children,
  disabled,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon: Icon,
  className,
  ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'bg-red-600 hover:bg-red-700 text-white border border-red-600',
    success: 'bg-green-600 hover:bg-green-700 text-white border border-green-600',
    ghost: 'border border-gray-300 hover:bg-gray-100 text-gray-900'
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  }

  const baseClass = variants[variant] || variants.primary
  const sizeClass = sizes[size] || sizes.md

  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseClass}
        ${sizeClass}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-75 cursor-wait' : ''}
        flex items-center justify-center gap-2 rounded-lg font-medium 
        transition-all duration-200 relative overflow-hidden
        ${className}
      `}
      {...props}
    >
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="absolute left-4"
        >
          <Loader2 className="w-5 h-5" />
        </motion.div>
      )}

      {!loading && Icon && <Icon className="w-4 h-4" />}

      <span className={loading ? 'opacity-0' : 'opacity-100'}>{children}</span>
      {loading && <span className="absolute inset-0 flex items-center justify-center">Processing...</span>}

      {/* Ripple effect on hover */}
      {!disabled && !loading && (
        <motion.div
          className="absolute inset-0 bg-white/10"
          initial={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 2, opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.button>
  )
}
