import { useState, useCallback } from 'react'

/**
 * Hook for optimistic updates with automatic rollback on error
 */
export const useOptimistic = (initialData) => {
  const [data, setData] = useState(initialData)
  const [previousData, setPreviousData] = useState(null)
  const [isOptimistic, setIsOptimistic] = useState(false)

  /**
   * Perform optimistic update
   * @param {Function} updateFn - Function to update data optimistically
   * @param {Function} apiCall - Async function to make API call
   * @returns {Promise} - Resolves with API response or rejects with error
   */
  const performOptimisticUpdate = useCallback(async (updateFn, apiCall) => {
    // Save current state
    setPreviousData(data)
    setIsOptimistic(true)

    // Apply optimistic update
    const optimisticData = updateFn(data)
    setData(optimisticData)

    try {
      // Make API call
      const result = await apiCall()
      
      // Success - commit the update
      setIsOptimistic(false)
      setPreviousData(null)
      
      // Update with server response if provided
      if (result && result.data) {
        setData(result.data)
      }
      
      return result
    } catch (error) {
      // Failure - rollback to previous state
      console.error('Optimistic update failed, rolling back:', error)
      setData(previousData)
      setIsOptimistic(false)
      setPreviousData(null)
      
      throw error
    }
  }, [data, previousData])

  /**
   * Manually rollback to previous state
   */
  const rollback = useCallback(() => {
    if (previousData !== null) {
      setData(previousData)
      setIsOptimistic(false)
      setPreviousData(null)
    }
  }, [previousData])

  /**
   * Manually commit the optimistic update
   */
  const commit = useCallback(() => {
    setIsOptimistic(false)
    setPreviousData(null)
  }, [])

  /**
   * Reset data to new value
   */
  const reset = useCallback((newData) => {
    setData(newData)
    setIsOptimistic(false)
    setPreviousData(null)
  }, [])

  return {
    data,
    isOptimistic,
    performOptimisticUpdate,
    rollback,
    commit,
    reset,
    setData
  }
}

export default useOptimistic
