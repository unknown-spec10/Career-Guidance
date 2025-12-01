/**
 * API Retry Utility with exponential backoff
 */

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNABORTED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT']
}

/**
 * Calculate exponential backoff delay
 */
const calculateDelay = (attempt, config) => {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt)
  return Math.min(delay, config.maxDelay)
}

/**
 * Determine if error is retryable
 */
const isRetryable = (error, config) => {
  // Network errors
  if (!error.response && error.code) {
    return config.retryableErrors.includes(error.code)
  }

  // HTTP status codes
  if (error.response) {
    return config.retryableStatuses.includes(error.response.status)
  }

  return false
}

/**
 * Wait for specified duration
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Retry a request with exponential backoff
 * @param {Function} requestFn - Async function that makes the request
 * @param {Object} config - Retry configuration
 * @returns {Promise} - Response or throws error after max retries
 */
export const retryRequest = async (requestFn, config = {}) => {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError = null

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // First attempt or retry
      const response = await requestFn()
      return response
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt < retryConfig.maxRetries && isRetryable(error, retryConfig)) {
        const delay = calculateDelay(attempt, retryConfig)
        console.warn(
          `Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}). ` +
          `Retrying in ${delay}ms...`,
          error.message
        )
        await wait(delay)
        continue
      }

      // Max retries reached or error not retryable
      throw error
    }
  }

  // Should never reach here, but just in case
  throw lastError
}

/**
 * Create a retryable version of an axios instance
 */
export const makeRetryable = (axiosInstance, config = {}) => {
  // Intercept requests and add retry logic
  axiosInstance.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config

      // Avoid infinite retry loops
      if (originalRequest._retry) {
        return Promise.reject(error)
      }

      // Check if retryable
      if (isRetryable(error, { ...DEFAULT_RETRY_CONFIG, ...config })) {
        originalRequest._retry = true
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1

        if (originalRequest._retryCount <= (config.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries)) {
          const delay = calculateDelay(originalRequest._retryCount - 1, { ...DEFAULT_RETRY_CONFIG, ...config })
          
          console.warn(
            `Request failed (attempt ${originalRequest._retryCount}). ` +
            `Retrying in ${delay}ms...`
          )

          await wait(delay)
          return axiosInstance(originalRequest)
        }
      }

      return Promise.reject(error)
    }
  )

  return axiosInstance
}

export default retryRequest
