/**
 * useStreamingText — reusable SSE (Server-Sent Events) consumer.
 * Connects to an SSE endpoint and accumulates streamed tokens.
 *
 * Usage:
 *   const { text, isStreaming, isDone, startStream, resetStream } = useStreamingText()
 *   await startStream('/api/interview/study-plan/SESSION_ID')
 */
import { useState, useRef, useCallback } from 'react'
import secureStorage from '../utils/secureStorage'

export default function useStreamingText() {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState(null)
  const readerRef = useRef(null)

  const resetStream = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel()
      readerRef.current = null
    }
    setText('')
    setIsStreaming(false)
    setIsDone(false)
    setError(null)
  }, [])

  const startStream = useCallback(async (url) => {
    resetStream()
    setIsStreaming(true)

    try {
      const token = secureStorage.getItem('token') || ''
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.replace('data: ', '').trim()
            if (raw === '[DONE]') {
              setIsDone(true)
              setIsStreaming(false)
              return
            }
            try {
              const data = JSON.parse(raw)
              if (data.token) {
                setText(prev => prev + data.token)
              }
            } catch {
              // skip malformed SSE chunks
            }
          }
        }
      }

      setIsDone(true)
    } catch (err) {
      console.error('Stream error:', err)
      setError(err.message || 'Streaming failed.')
    } finally {
      setIsStreaming(false)
      readerRef.current = null
    }
  }, [resetStream])

  return { text, isStreaming, isDone, error, startStream, resetStream }
}
