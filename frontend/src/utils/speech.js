/**
 * Web Speech API - Text-to-Speech (TTS) Helper
 * Provides instant, offline, zero-latency speech synthesis.
 */

let selectedVoice = null

// Select an English voice preferring high-quality natural or Google variants
const selectBestVoice = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  if (selectedVoice) return selectedVoice

  const voices = window.speechSynthesis.getVoices()
  // Order of preference: Google US English, Natural, Microsoft English, any English
  const preferred = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
                    voices.find(v => v.lang === 'en-US' && v.name.includes('Natural')) ||
                    voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                    voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) ||
                    voices.find(v => v.lang.startsWith('en') && v.name.includes('Microsoft')) ||
                    voices.find(v => v.lang.startsWith('en')) ||
                    voices[0]

  if (preferred) {
    selectedVoice = preferred
  }
  return selectedVoice
}

// Bind to onvoiceschanged to ensure voices are loaded
if (typeof window !== 'undefined' && window.speechSynthesis) {
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = selectBestVoice
  }
  // Try immediate load
  selectBestVoice()
}

/**
 * Read the given text aloud.
 * @param {string} text - The question or text to speak.
 * @param {Object} options - Override options (rate, pitch, volume, onEnd).
 */
export const speakQuestion = (text, options = {}) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('Speech synthesis not supported in this browser.')
    return
  }

  // Cancel any ongoing speech first (crucial to prevent queuing lock-ups)
  window.speechSynthesis.cancel()

  if (!text) return

  // Strip markdown or HTML elements for a cleaner reading experience
  const cleanText = text.replace(/[*_`#\-]/g, ' ').replace(/\s+/g, ' ').trim()

  const utterance = new SpeechSynthesisUtterance(cleanText)
  
  // Set parameters
  utterance.rate = options.rate || 0.92 // slightly slower for maximum comprehension
  utterance.pitch = options.pitch || 1.0
  utterance.volume = options.volume !== undefined ? options.volume : 1.0

  const voice = selectBestVoice()
  if (voice) {
    utterance.voice = voice
  }

  if (options.onStart) utterance.onstart = options.onStart
  if (options.onEnd) utterance.onend = options.onEnd
  if (options.onError) utterance.onerror = options.onError

  window.speechSynthesis.speak(utterance)
}

/**
 * Instantly cancel and silence any ongoing speech.
 */
export const stopSpeech = () => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}
