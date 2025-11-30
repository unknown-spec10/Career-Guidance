// Animation constants
export const ANIMATION_DELAYS = {
  CARD_STAGGER: 0.05, // Delay between cards in a grid (seconds)
  CARD_STAGGER_FAST: 0.03, // Faster stagger for lists
  SECTION_DELAY: 0.1, // Delay between major sections
  PAGE_INITIAL: 0.2, // Initial page load delay
}

export const ANIMATION_DURATIONS = {
  FAST: 0.2, // Quick transitions
  NORMAL: 0.3, // Standard transitions
  SLOW: 0.5, // Slow, deliberate animations
}

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  APPLICANTS_PAGE_SIZE: 20,
  COLLEGES_PAGE_SIZE: 20,
  JOBS_PAGE_SIZE: 20,
}

// Debounce delays (milliseconds)
export const DEBOUNCE_DELAYS = {
  SEARCH: 500,
  FILTER: 500,
  INPUT: 300,
}

// API Timeouts (milliseconds)
export const API_TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  UPLOAD: 120000, // 2 minutes for file uploads
  PARSE: 180000, // 3 minutes for AI parsing
}

// UI Constants
export const UI = {
  MAX_FILE_SIZE_MB: 10,
  SUPPORTED_FILE_TYPES: ['.pdf', '.docx', '.doc', '.txt'],
  SUPPORTED_MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ],
}

// Status colors
export const STATUS_COLORS = {
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  info: 'text-blue-400',
  pending: 'text-gray-400',
}
