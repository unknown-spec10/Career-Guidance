import React, { useEffect, useRef } from 'react'

export default function VoiceWaveform({ stream, width = 300, height = 80 }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)

  useEffect(() => {
    if (!stream || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Set device pixel ratio scaling for crisp rendering on retina displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    try {
      // 1. Initialize Web Audio API nodes
      const AudioContext = window.AudioContext || window.webkitAudioContext
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      sourceRef.current = source

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      let phase = 0

      // 2. Continuous draw loop
      const draw = () => {
        analyser.getByteFrequencyData(dataArray)
        
        // Calculate average amplitude (volume) to scale wave height
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const average = sum / bufferLength
        // Normalize amplitude (0 to 1)
        const amplitude = Math.min(average / 128, 1)

        ctx.clearRect(0, 0, width, height)

        // Draw multiple beautiful layered translucent sine waves
        const waveCount = 3
        const colors = [
          'rgba(79, 70, 229, 0.6)', // Primary 600
          'rgba(99, 102, 241, 0.4)', // Primary 500
          'rgba(165, 180, 252, 0.25)', // Primary 300
        ]

        phase += 0.15 // Speed of horizontal wave scrolling

        for (let w = 0; w < waveCount; w++) {
          ctx.beginPath()
          ctx.strokeStyle = colors[w]
          ctx.lineWidth = w === 0 ? 3 : 1.5

          // Higher index waves scroll in different directions/speeds
          const speedFactor = w === 0 ? 1 : w === 1 ? -0.8 : 1.3
          const currentPhase = phase * speedFactor
          
          // Outer waves are wider/lower frequency
          const frequency = 0.03 - (w * 0.005)
          const baseHeight = height / 2

          for (let x = 0; x < width; x++) {
            // Dynamic scale: waves are clamped to 0 at the edges so they look self-contained and elegant
            const edgeClamping = Math.sin((x / width) * Math.PI)
            
            // Generate sine wave coordinate
            const y = baseHeight + 
              Math.sin(x * frequency + currentPhase) * 
              (15 + amplitude * 35) * 
              edgeClamping * 
              (1 - w * 0.25) // Layer waves shrink in size

            if (x === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          }
          ctx.stroke()
        }

        animationRef.current = requestAnimationFrame(draw)
      }

      draw()
    } catch (err) {
      console.error('Failed to initialize Web Audio Visualizer:', err)
      
      // Fallback simple CSS animation loop if Web Audio context creation fails
      const drawFallback = () => {
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = 'rgba(79, 70, 229, 0.35)'
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, 20 + Math.sin(Date.now() * 0.01) * 8, 0, 2 * Math.PI)
        ctx.fill()
        animationRef.current = requestAnimationFrame(drawFallback)
      }
      drawFallback()
    }

    return () => {
      // 3. Robust teardown on unmount or stream change
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
    }
  }, [stream, width, height])

  return (
    <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-inner w-full min-h-[90px]">
      <canvas
        ref={canvasRef}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="block"
      />
    </div>
  )
}
