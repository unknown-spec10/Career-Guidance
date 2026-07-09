import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Send, 
  Sparkles, 
  Loader2,
  ArrowUp
} from 'lucide-react'
import api from '../config/api'
import ReactMarkdown from 'react-markdown'

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
      setError(err.response?.data?.detail || 'Failed to get answer. Please try again.')
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
    <div className="min-h-screen bg-white dark:bg-gray-950 pt-20 transition-colors duration-300">
      <div className="container mx-auto px-4 max-w-4xl py-8">
        
        {/* Question Display (when answered) */}
        {displayedQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl md:text-3xl font-medium text-gray-900 dark:text-white leading-relaxed">
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
              <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                <span>Getting answer...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4 text-red-700 dark:text-red-400">
                {error}
              </div>
            ) : answer && (
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 text-base">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="space-y-2 mb-4 ml-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="space-y-2 mb-4 ml-0 list-decimal list-inside text-gray-700 dark:text-gray-300">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-gray-700 dark:text-gray-300 leading-relaxed flex items-start gap-2">
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
                          <code className="bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono whitespace-nowrap">
                            {text}
                          </code>
                        )
                      }
                      return (
                        <pre className="bg-gray-900 dark:bg-gray-900/80 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm mb-4 border border-gray-800/20 font-mono">
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
                      <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
                    ),
                    h1: ({ children }) => (
                      <h1 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-5 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-2">{children}</h3>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-4">
                        <table className="min-w-full border border-gray-200 dark:border-gray-800 rounded-lg">
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="bg-gray-50 dark:bg-gray-900 px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-250 dark:border-gray-800">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
                        {children}
                      </td>
                    ),
                  }}
                >
                  {answer}
                </ReactMarkdown>
              </div>
            )}
          </motion.div>
        )}

        {/* Divider */}
        {answer && <hr className="border-gray-200 dark:border-gray-800 mb-8" />}

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
                <span className="text-sm font-medium">Powered by Gemini</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-medium text-gray-900 dark:text-white mb-3">
                Ask anything about CareerSync AI
              </h1>
              <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
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
                className="w-full pl-5 pr-16 py-4 text-base bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50 dark:disabled:bg-gray-950 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md placeholder-gray-400 dark:placeholder-gray-500"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-primary-500 text-white rounded-full hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
              <span className="text-xs text-gray-400 dark:text-gray-500">{query.length}/500</span>
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
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 text-center">
                Try asking
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.slice(0, 6).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={loading}
                    className="px-4 py-2 text-sm text-gray-650 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Footer */}
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            Built with <span className="text-primary-500">Gemini</span>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
