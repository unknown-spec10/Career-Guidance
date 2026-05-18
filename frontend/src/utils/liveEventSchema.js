const CLIENT_EVENT_TYPES = new Set(['audio', 'text', 'control'])
const CONTROL_ACTIONS = new Set(['start_turn', 'end_turn', 'pause', 'resume', 'ping', 'disconnect'])
const SERVER_EVENT_TYPES = new Set(['audio', 'transcription', 'control', 'error'])

export function buildAudioEvent(chunkBase64, sequence = 0, mimeType = 'audio/pcm') {
  if (typeof chunkBase64 !== 'string' || !chunkBase64.length) {
    throw new Error('Invalid audio payload')
  }

  return {
    type: 'audio',
    chunk_base64: chunkBase64,
    sequence,
    mime_type: mimeType,
  }
}

export function buildTextEvent(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Invalid text payload')
  }

  return {
    type: 'text',
    text: text.trim(),
  }
}

export function buildControlEvent(action) {
  if (!CONTROL_ACTIONS.has(action)) {
    throw new Error(`Invalid control action: ${action}`)
  }

  return {
    type: 'control',
    action,
  }
}

export function parseServerEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('Server event must be an object')
  }

  if (!SERVER_EVENT_TYPES.has(event.type)) {
    throw new Error(`Unknown server event type: ${event.type}`)
  }

  if (event.type === 'audio') {
    if (typeof event.chunk_base64 !== 'string' || !event.chunk_base64.length) {
      throw new Error('Audio event missing chunk_base64')
    }

    return {
      type: 'audio',
      chunkBase64: event.chunk_base64,
      mimeType: event.mime_type || 'audio/pcm',
    }
  }

  if (event.type === 'transcription') {
    const role = event.role === 'model' ? 'model' : 'user'
    return {
      type: 'transcription',
      role,
      text: String(event.text || ''),
      isFinal: Boolean(event.is_final),
    }
  }

  if (event.type === 'control') {
    return {
      type: 'control',
      action: String(event.action || 'ack'),
    }
  }

  return {
    type: 'error',
    code: String(event.code || 'UNKNOWN'),
    message: String(event.message || 'Unknown server error'),
    recoverable: Boolean(event.recoverable),
  }
}

export function validateClientEventShape(event) {
  if (!event || typeof event !== 'object') return false
  if (!CLIENT_EVENT_TYPES.has(event.type)) return false

  if (event.type === 'audio') {
    return typeof event.chunk_base64 === 'string' && event.chunk_base64.length > 0
  }

  if (event.type === 'text') {
    return typeof event.text === 'string' && event.text.trim().length > 0
  }

  if (event.type === 'control') {
    return CONTROL_ACTIONS.has(event.action)
  }

  return false
}
