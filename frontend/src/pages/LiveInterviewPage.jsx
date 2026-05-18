import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Mic, MicOff, PhoneOff, RefreshCcw, Activity } from 'lucide-react'
import api from '../config/api'
import SessionTimer from '../components/interview/SessionTimer'
import useLiveInterviewSocket from '../hooks/useLiveInterviewSocket'

function TranscriptRow({ item }) {
  const isModel = item.role === 'model'
  return (
    <div className={`rounded-lg p-3 ${isModel ? 'bg-blue-50 border border-blue-100' : 'bg-gray-100 border border-gray-200'}`}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {isModel ? 'Interviewer' : 'You'}
      </div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap">{item.text}</div>
    </div>
  )
}

export default function LiveInterviewPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ending, setEnding] = useState(false)
  const [micOn, setMicOn] = useState(false)

  const {
    status,
    error,
    transcript,
    connected,
    connect,
    disconnect,
    sendPing,
    startAudioCapture,
    stopAudioCapture,
  } = useLiveInterviewSocket(sessionId)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await api.get(`/api/interviews/live/session/${sessionId}`)
        setSession(response.data)
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to load live interview session')
        navigate('/dashboard/interview')
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [navigate, sessionId])

  useEffect(() => {
    if (!loading) {
      connect()
    }
  }, [loading, connect])

  useEffect(() => {
    const timer = setInterval(() => {
      if (connected) {
        sendPing()
      }
    }, 15000)

    return () => clearInterval(timer)
  }, [connected, sendPing])

  const userTranscript = useMemo(() => transcript.filter((x) => x.role === 'user').map((x) => x.text).join('\n'), [transcript])
  const modelTranscript = useMemo(() => transcript.filter((x) => x.role === 'model').map((x) => x.text).join('\n'), [transcript])
  const sessionModeLabel = session?.session_mode === 'micro' ? 'Micro Practice' : 'Full Interview'

  const toggleMicrophone = async () => {
    try {
      if (!micOn) {
        await startAudioCapture()
      } else {
        stopAudioCapture()
      }
      setMicOn((prev) => !prev)
    } catch (err) {
      console.error(err)
      alert('Unable to access microphone. Check browser permissions.')
    }
  }

  const endInterview = async () => {
    setEnding(true)
    try {
      if (micOn) {
        stopAudioCapture()
        setMicOn(false)
      }
      disconnect()

      await api.post(`/api/interviews/live/${sessionId}/end`, {
        user_transcript: userTranscript || null,
        model_transcript: modelTranscript || null,
        notes: {
          ended_from: 'live_page',
          status,
          transcript_events: transcript.length,
        },
      })

      navigate('/dashboard/interview')
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to end live interview')
    } finally {
      setEnding(false)
    }
  }

  const handleTimeout = () => {
    endInterview()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pt-20 pb-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-cyan-300">Live Interview</p>
              <h1 className="mt-1 text-3xl font-semibold">{session?.session_type || 'technical'} session</h1>
              <p className="mt-1 text-sm text-gray-300">Difficulty: {session?.difficulty_level || 'medium'}</p>
              <p className="mt-1 text-sm text-cyan-200">Mode: {sessionModeLabel}</p>
            </div>
            <SessionTimer endTime={session?.ends_at} onTimeout={handleTimeout} />
          </div>

          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="inline-flex items-center rounded-full bg-gray-800 px-3 py-1">
              <Activity className="mr-2 h-4 w-4 text-cyan-300" />
              Connection: {status}
            </span>
            {error ? <span className="text-red-300">{error}</span> : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <h2 className="mb-4 text-lg font-semibold">Live Transcript</h2>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
              {transcript.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-400">
                  Start microphone capture to begin the live interview conversation.
                </div>
              ) : (
                transcript.map((item, idx) => <TranscriptRow key={`${item.role}-${idx}`} item={item} />)
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5">
            <h2 className="mb-4 text-lg font-semibold">Controls</h2>

            <button
              type="button"
              onClick={toggleMicrophone}
              className={`mb-3 flex w-full items-center justify-center rounded-lg px-4 py-3 font-medium transition ${
                micOn ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'
              }`}
            >
              {micOn ? <MicOff className="mr-2 h-5 w-5" /> : <Mic className="mr-2 h-5 w-5" />}
              {micOn ? 'Stop Microphone' : 'Start Microphone'}
            </button>

            <button
              type="button"
              onClick={connect}
              className="mb-3 flex w-full items-center justify-center rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 font-medium hover:bg-gray-700"
            >
              <RefreshCcw className="mr-2 h-5 w-5" />
              Reconnect
            </button>

            <button
              type="button"
              disabled={ending}
              onClick={endInterview}
              className="flex w-full items-center justify-center rounded-lg bg-rose-600 px-4 py-3 font-medium hover:bg-rose-700 disabled:opacity-60"
            >
              <PhoneOff className="mr-2 h-5 w-5" />
              End Interview
            </button>

            <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs text-gray-400">
              Transcript events: {transcript.length}
              <br />
              WebSocket: {connected ? 'connected' : 'disconnected'}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
