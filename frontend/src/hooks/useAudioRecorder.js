import { useState, useRef, useCallback, useEffect } from 'react'
import api from '../config/api'

export default function useAudioRecorder() {
  const [status, setStatus] = useState('idle') // 'idle' | 'recording' | 'transcribing'
  const [error, setError] = useState(null)
  const [recordTime, setRecordTime] = useState(0)
  const [micStream, setMicStream] = useState(null)
  const [isSpeechSupported, setIsSpeechSupported] = useState(false)

  const mediaRecorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const streamRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

  // Check browser SpeechRecognition support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSpeechSupported(!!SpeechRecognition)
  }, [])

  // Clear timer and recordTime counter
  const cleanupTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setRecordTime(0)
  }, [])

  // Stop active microphone streams
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setMicStream(null)
  }, [])

  /**
   * Start recording.
   * @param {function} onLiveTextChange - Callback to receive real-time Web Speech transcriptions
   */
  const startRecording = useCallback(async (onLiveTextChange) => {
    setError(null)
    cleanupTimer()
    audioChunksRef.current = []

    try {
      // 1. Setup MediaRecorder for background Groq Whisper capture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setMicStream(stream)

      let options = {}
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' }
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        options = { mimeType: 'audio/ogg' }
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' }
      }

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstart = () => {
        setStatus('recording')
        timerRef.current = setInterval(() => {
          setRecordTime(t => t + 1)
        }, 1000)
      }

      // 2. Setup browser-native SpeechRecognition for live feedback
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition && onLiveTextChange) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('')
          onLiveTextChange(transcript)
        }

        recognition.onerror = (e) => {
          console.error('Speech recognition runtime error:', e)
        }

        recognition.start()
        recognitionRef.current = recognition
      }

      mediaRecorder.start(250) // collect audio chunks in intervals
    } catch (err) {
      console.error('Error starting audio recording:', err)
      setError('Microphone access denied or unavailable.')
      setStatus('idle')
      stopStream()
    }
  }, [cleanupTimer, stopStream])

  /**
   * Stop recording.
   * Compiles audio and sends it asynchronously to Groq Whisper for correction.
   * @returns {Promise<Object>} Object containing transcription results
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current
      const recognition = recognitionRef.current

      if (!mediaRecorder || status !== 'recording') {
        resolve({ success: false, error: 'Not recording' })
        return
      }

      // Stop SpeechRecognition immediately for clean exit UI
      if (recognition) {
        try {
          recognition.stop()
        } catch (e) {
          console.warn('SpeechRecognition stop error:', e)
        }
        recognitionRef.current = null
      }

      mediaRecorder.onstop = async () => {
        cleanupTimer()
        setStatus('transcribing')

        try {
          const mimeType = mediaRecorder.mimeType || 'audio/webm'
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          
          if (audioBlob.size === 0) {
            throw new Error('Recorded audio blob is empty.')
          }

          // Build multipart form payload (using parameter name 'audio' matching design spec)
          const formData = new FormData()
          const rawExt = mimeType.split('/')[1] || 'webm'
          const fileExtension = rawExt.split(';')[0].trim()
          formData.append('audio', audioBlob, `answer.${fileExtension}`)

          const res = await api.post('/api/interview/transcribe', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })

          setStatus('idle')
          stopStream()
          resolve({ success: true, text: res.data.transcript })
        } catch (err) {
          console.error('STT Transcription error:', err)
          const errMsg = err.response?.data?.detail || err.message || 'Transcription failed.'
          setError(errMsg)
          setStatus('idle')
          stopStream()
          resolve({ success: false, error: errMsg })
        }
      }

      mediaRecorder.stop()
    })
  }, [status, cleanupTimer, stopStream])

  // Reset recorder states and free mic stream
  const clearRecorder = useCallback(() => {
    cleanupTimer()
    stopStream()
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {}
      recognitionRef.current = null
    }
    setStatus('idle')
    setError(null)
  }, [cleanupTimer, stopStream])

  // Clean resources on component teardown
  useEffect(() => {
    return () => {
      cleanupTimer()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {}
      }
    }
  }, [cleanupTimer])

  return {
    status,
    error,
    recordTime,
    micStream,
    isSpeechSupported,
    startRecording,
    stopRecording,
    clearRecorder,
  }
}
