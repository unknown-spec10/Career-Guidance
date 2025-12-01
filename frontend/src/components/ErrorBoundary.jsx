import React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

/**
 * Error Boundary component to catch and handle React errors gracefully
 * Provides fallback UI with error details and recovery options
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log error details to console (in production, send to error tracking service)
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }))

    // In production, send to error tracking service like Sentry
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleReportError = () => {
    // In production, open a bug report form or send to support
    const errorDetails = {
      error: this.state.error?.toString(),
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    }
    
    console.log('Error Report:', errorDetails)
    alert('Error details logged to console. In production, this would be sent to support.')
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI from props
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.handleReset,
        })
      }

      // Default fallback UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full bg-white rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8" />
                <div>
                  <h1 className="text-2xl font-bold">Oops! Something went wrong</h1>
                  <p className="text-red-100 mt-1">
                    Don't worry, we're here to help you get back on track
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Error Message */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Error Details:</h3>
                <p className="text-red-800 text-sm font-mono">
                  {this.state.error?.toString() || 'Unknown error occurred'}
                </p>
              </div>

              {/* Error Count Warning */}
              {this.state.errorCount > 1 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ This error has occurred {this.state.errorCount} times. 
                    Consider refreshing the page or going home.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 
                           bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                           shadow-md hover:shadow-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>

                <button
                  onClick={this.handleGoHome}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 
                           bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors
                           shadow-md hover:shadow-lg"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </button>

                <button
                  onClick={this.handleReportError}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 
                           bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors
                           shadow-md hover:shadow-lg"
                >
                  <Bug className="w-4 h-4" />
                  Report Bug
                </button>
              </div>

              {/* Stack Trace (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                    Show Technical Details
                  </summary>
                  <pre className="mt-3 text-xs text-gray-600 overflow-auto max-h-64 font-mono">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-3 text-xs text-gray-600 overflow-auto max-h-64 font-mono border-t pt-3">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </details>
              )}

              {/* Help Text */}
              <div className="text-sm text-gray-600 border-t pt-4">
                <p className="mb-2">If this problem persists, try:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Clearing your browser cache and cookies</li>
                  <li>Using a different browser</li>
                  <li>Checking your internet connection</li>
                  <li>Contacting support if the issue continues</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

/**
 * Higher-order component to wrap any component with error boundary
 */
export function withErrorBoundary(Component, errorBoundaryProps = {}) {
  return function WithErrorBoundaryComponent(props) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
