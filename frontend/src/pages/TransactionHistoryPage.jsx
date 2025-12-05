import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown, Gift, Clock, Filter, RefreshCw } from 'lucide-react'
import api from '../config/api'

const TransactionHistoryPage = () => {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'spend', 'refill', 'bonus'

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/credits/transactions')
      setTransactions(response.data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true
    return tx.transaction_type === filter
  })

  const getTypeIcon = (type) => {
    switch (type) {
      case 'spend':
        return <ArrowDown className="w-5 h-5 text-red-500" />
      case 'refill':
        return <RefreshCw className="w-5 h-5 text-green-500" />
      case 'bonus':
        return <Gift className="w-5 h-5 text-yellow-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'spend':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'refill':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'bonus':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getActivityLabel = (activityType) => {
    const labels = {
      full_interview: 'Full Interview',
      micro_session: 'Micro Practice',
      coding_question: 'Coding Question',
      project_idea: 'Project Idea',
      weekly_refill: 'Weekly Refill',
      improvement_bonus: 'Improvement Bonus',
      admin_adjustment: 'Admin Adjustment',
      initial_credit: 'Initial Credits'
    }
    return labels[activityType] || activityType
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Credit Transaction History</h1>
        <p className="text-gray-600">Track your credit usage, refills, and bonuses</p>
      </div>

      {/* Filter Buttons */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <div className="flex space-x-2">
            {['all', 'spend', 'refill', 'bonus'].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === type
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredTransactions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`p-2 rounded-lg border ${getTypeColor(tx.transaction_type)}`}>
                      {getTypeIcon(tx.transaction_type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {getActivityLabel(tx.activity_type)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(tx.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                      {tx.notes && (
                        <div className="text-sm text-gray-600 mt-1">{tx.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        tx.transaction_type === 'spend'
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {tx.transaction_type === 'spend' ? '-' : '+'}
                      {Math.abs(tx.amount)}
                    </div>
                    <div className="text-sm text-gray-500">
                      Balance: {tx.balance_after}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No transactions found</p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-2 text-indigo-600 hover:text-indigo-700"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary Card */}
      {transactions.length > 0 && (
        <div className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-4">Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm opacity-80">Total Spent</div>
              <div className="text-2xl font-bold">
                {transactions
                  .filter(tx => tx.transaction_type === 'spend')
                  .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-80">Total Refilled</div>
              <div className="text-2xl font-bold">
                {transactions
                  .filter(tx => tx.transaction_type === 'refill')
                  .reduce((sum, tx) => sum + tx.amount, 0)}
              </div>
            </div>
            <div>
              <div className="text-sm opacity-80">Total Bonuses</div>
              <div className="text-2xl font-bold">
                {transactions
                  .filter(tx => tx.transaction_type === 'bonus')
                  .reduce((sum, tx) => sum + tx.amount, 0)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionHistoryPage
