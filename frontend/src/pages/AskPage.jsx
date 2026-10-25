import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Send, 
  Sparkles, 
  Loader2,
  ArrowUp
} from 'lucide-react'
import api from '../config/api'
import SafeMarkdown from '../components/SafeMarkdown'
import { getApiError } from '../utils/apiError'

export default function AskPage() {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState(null)
  const [displayedQuery, setDisplayedQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)
  const answerRef = useRef(null)

  // Load suggestions on mount
  useEffect(() => {
    fetchSuggestions()
  }, [])

  // Scroll to answer when it appears
  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [answer])

  const fetchSuggestions = async () => {
    try {
      const response = await api.get('/api/rag/suggestions')
      setSuggestions(response.data.suggestions || [])
    } catch (err) {
      setSuggestions([
        "How do I set up the app locally?",
        "What is the dual-database architecture?",
        "How do I deploy to Google Cloud?",
        "What are the main features?"
      ])
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!query.trim() || loading) return
    
    await askQuestion(query.trim())
  }

  const askQuestion = async (questionText) => {
    setError(null)
    setDisplayedQuery(questionText)
    setAnswer(null)
    setLoading(true)
    
    try {
      const response = await api.post('/api/rag/ask', { query: questionText })
      setAnswer(response.data.answer)
      setQuery('')
    } catch (err) {
      console.error('Error asking question:', err)
      setError(getApiError(err, 'Failed to get answer. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (question) => {
    if (loading) return
    setQuery(question)
    askQuestion(question)
  }

  return (
    <div className="min-h-screen bg-canvas pt-20 transition-colors duration-300">
      <div className="container mx-auto px-4 max-w-4xl py-8">
        
        {/* Question Display (when answered) */}
        {displayedQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="font-display text-title-lg text-ink leading-relaxed">
              {displayedQuery}
            </h1>
          </motion.div>
        )}

        {/* Answer Section */}
        {(loading || answer || error) && (
          <motion.div
            ref={answerRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            {loading ? (
              <div className="flex items-center gap-3 text-ink-muted py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                <span>Getting answer...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-card p-4 text-red-700 dark:text-red-400">
                {error}
              </div>
            ) : answer && (
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <SafeMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="text-body text-ink-muted leading-relaxed mb-4">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="space-y-2 mb-4 ml-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="space-y-2 mb-4 ml-0 list-decimal list-inside text-ink-muted">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-ink-muted leading-relaxed flex items-start gap-2">
                        <span className="text-primary-500 mt-1.5">•</span>
                        <span>{children}</span>
                      </li>
                    ),
                    code: ({ node, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '')
                      const text = String(children).replace(/\n$/, '')
                      const hasNewlines = text.includes('\n')
                      
                      if (!hasNewlines && !match) {
                        return (
                          <code className="bg-surface-sunken text-ink px-1.5 py-0.5 rounded-card text-caption font-mono whitespace-nowrap">
                            {text}
                          </code>
                        )
                      }
                      return (
                        <pre className="bg-gray-900 dark:bg-gray-900/80 text-gray-100 p-4 rounded-card overflow-x-auto text-caption mb-4 border border-gray-800/20 font-mono">
                          <code className={className}>{children}</code>
                        </pre>
                      )
                    },
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline"
                      >
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-ink">{children}</strong>
                    ),
                    h1: ({ children }) => (
                      <h1 className="font-display text-title-lg text-ink mt-6 mb-3">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="font-display text-title text-ink mt-5 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-body-lg font-semibold text-ink mt-4 mb-2">{children}</h3>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-4">
                        <table className="min-w-full border border-hairline rounded-card">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="bg-surface-sunken px-4 py-2 text-left text-caption font-semibold text-ink border-b border-hairline">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-2 text-caption text-ink-muted border-b border-hairline">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {answer}
                </SafeMarkdown>
              </div>
            )}
          </motion.div>
        )}

        {/* Divider */}
        {answer && <hr className="border-hairline mb-8" />}

        {/* Search Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: answer ? 0 : 0.1 }}
          className={`${!displayedQuery ? 'pt-12' : ''}`}
        >
          {/* Title (only show when no answer yet) */}
          {!displayedQuery && (
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-4">
                <Sparkles className="w-5 h-5" />
                <span className="text-caption font-medium">Powered by DeepSeek</span>
              </div>
              <h1 className="app-page-title mb-3">
                Ask anything about CareerSync AI
              </h1>
              <p className="app-page-subtitle mx-auto max-w-lg">
                Get instant answers about setup, features, deployment, and more
              </p>
            </div>
          )}

          {/* Search Box */}
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="relative w-full">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything about CareerSync AI"
                disabled={loading}
                className="app-input pl-5 pr-16 disabled:bg-surface-sunken disabled:cursor-not-allowed"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-primary-500 text-white rounded-pill hover:bg-primary-600 disabled:bg-surface-sunken disabled:text-ink-subtle disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                style={{ right: '8px' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
            </form>
            {/* Character count below input */}
            <div className="text-right mt-1 mr-4">
              <span className="text-caption text-ink-subtle">{query.length}/500</span>
            </div>
          </div>

          {/* Suggestions */}
          {!displayedQuery && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 max-w-2xl mx-auto"
            >
              <p className="eyebrow mb-3 text-center">
                Try asking
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.slice(0, 6).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={loading}
                    className="app-btn-secondary app-btn-sm max-w-full rounded-pill"
                  >
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <p className="text-caption text-ink-subtle text-center mt-6">
            Built with <span className="text-primary-500">DeepSeek</span>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
