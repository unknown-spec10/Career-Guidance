import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import secureStorage from '../utils/secureStorage'
import {
  buildAudioEvent,
  buildControlEvent,
  parseServerEvent,
  validateClientEventShape,
} from '../utils/liveEventSchema'

function getWebSocketBaseUrl() {
  const envBase = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const parsed = new URL(envBase, window.location.origin)
  const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${parsed.host}`
}

function pcm16ToBase64(float32Array) {
  const pcm16 = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i += 1) {
    const value = Math.max(-1, Math.min(1, float32Array[i]))
    pcm16[i] = value < 0 ? value * 0x8000 : value * 0x7fff
  }

  const bytes = new Uint8Array(pcm16.buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export default function useLiveInterviewSocket(sessionId) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [connected, setConnected] = useState(false)

  const wsRef = useRef(null)
  const audioContextRef = useRef(null)
  const playbackContextRef = useRef(null)
  const playbackCursorRef = useRef(0)
  const sourceRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef = useRef(null)
  const sequenceRef = useRef(0)

  const playAudioChunk = useCallback((chunkBase64) => {
    try {
      if (!playbackContextRef.current) {
        playbackContextRef.current = new window.AudioContext({ sampleRate: 24000 })
        playbackCursorRef.current = playbackContextRef.current.currentTime
      }

      const playbackContext = playbackContextRef.current
      const binary = atob(chunkBase64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
      }

      const pcm16 = new Int16Array(bytes.buffer)
      const frameCount = pcm16.length
      const audioBuffer = playbackContext.createBuffer(1, frameCount, 24000)
      const channel = audioBuffer.getChannelData(0)
      for (let i = 0; i < frameCount; i += 1) {
        channel[i] = pcm16[i] / 32768
      }

      const sourceNode = playbackContext.createBufferSource()
      sourceNode.buffer = audioBuffer
      sourceNode.connect(playbackContext.destination)

      const startAt = Math.max(playbackContext.currentTime, playbackCursorRef.current)
      sourceNode.start(startAt)
      playbackCursorRef.current = startAt + audioBuffer.duration
    } catch (err) {
      console.error('Failed to play model audio chunk', err)
    }
  }, [])

  const wsUrl = useMemo(() => {
    if (!sessionId) return null
    const token = secureStorage.getItem('token')
    if (!token) return null
    const base = getWebSocketBaseUrl()
    return `${base}/ws/interviews/live/${sessionId}?token=${encodeURIComponent(token)}`
  }, [sessionId])

  const sendEvent = useCallback((event) => {
    if (!validateClientEventShape(event)) {
      throw new Error('Invalid client event shape')
    }

    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(JSON.stringify(event))
  }, [])

  const sendPing = useCallback(() => {
    try {
      sendEvent(buildControlEvent('ping'))
    } catch (err) {
      console.error('Ping failed', err)
    }
  }, [sendEvent])

  const startAudioCapture = useCallback(async () => {
    if (!connected) return

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    })

    streamRef.current = stream
    const audioContext = new window.AudioContext({ sampleRate: 16000 })
    audioContextRef.current = audioContext

    const source = audioContext.createMediaStreamSource(stream)
    sourceRef.current = source

    const processor = audioContext.createScriptProcessor(2048, 1, 1)
    processorRef.current = processor

    processor.onaudioprocess = (event) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      const inputData = event.inputBuffer.getChannelData(0)
      const chunkBase64 = pcm16ToBase64(inputData)
      const seq = sequenceRef.current
      sequenceRef.current += 1

      try {
        sendEvent(buildAudioEvent(chunkBase64, seq))
      } catch (err) {
        console.error('Failed to send audio event', err)
      }
    }

    source.connect(processor)
    processor.connect(audioContext.destination)

    sendEvent(buildControlEvent('start_turn'))
    setStatus('recording')
  }, [connected, sendEvent])

  const stopAudioCapture = useCallback(() => {
    try {
      sendEvent(buildControlEvent('end_turn'))
    } catch (err) {
      console.error(err)
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current.onaudioprocess = null
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setStatus('connected')
  }, [sendEvent])

  const disconnect = useCallback(() => {
    stopAudioCapture()

    const socket = wsRef.current
    if (!socket) {
      setConnected(false)
      setStatus('closed')
      return
    }

    try {
      sendEvent(buildControlEvent('disconnect'))
    } catch (err) {
      console.error(err)
    }

    const detachSocketListeners = () => {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
    }

    // Avoid closing during CONNECTING to prevent noisy browser warnings in StrictMode.
    if (socket.readyState === WebSocket.CONNECTING) {
      socket.onopen = () => {
        detachSocketListeners()
        socket.close(1000, 'Component cleanup')
      }
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
    } else {
      detachSocketListeners()
      socket.close(1000, 'Component cleanup')
    }

    wsRef.current = null
    setConnected(false)
    setStatus('closed')
  }, [sendEvent, stopAudioCapture])

  const connect = useCallback(() => {
    if (!wsUrl) {
      setError('Missing websocket URL or auth token')
      return
    }

    const existingSocket = wsRef.current
    if (
      existingSocket &&
      (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    const socket = new WebSocket(wsUrl)
    wsRef.current = socket
    setStatus('connecting')

    socket.onopen = () => {
      if (wsRef.current !== socket) return
      setConnected(true)
      setStatus('connected')
      setError(null)
    }

    socket.onmessage = (event) => {
      if (wsRef.current !== socket) return
      try {
        const parsedRaw = JSON.parse(event.data)
        const parsed = parseServerEvent(parsedRaw)

        if (parsed.type === 'control') {
          if (parsed.action === 'connected') {
            setStatus('connected')
          }
          return
        }

        if (parsed.type === 'transcription') {
          setTranscript((prev) => [...prev, parsed])
          return
        }

        if (parsed.type === 'audio') {
          playAudioChunk(parsed.chunkBase64)
          return
        }

        if (parsed.type === 'error') {
          setError(parsed.message)
          return
        }
      } catch (err) {
        console.error('Failed to parse websocket event', err)
      }
    }

    socket.onerror = () => {
      if (wsRef.current !== socket) return
      setError('WebSocket connection error')
    }

    socket.onclose = () => {
      if (wsRef.current === socket) {
        wsRef.current = null
      }
      setConnected(false)
      setStatus('closed')
    }
  }, [wsUrl, playAudioChunk])

  useEffect(() => {
    return () => {
      if (playbackContextRef.current) {
        playbackContextRef.current.close()
        playbackContextRef.current = null
      }
      disconnect()
    }
  }, [disconnect])

  return {
    status,
    error,
    transcript,
    connected,
    connect,
    disconnect,
    sendPing,
    startAudioCapture,
    stopAudioCapture,
  }
}
