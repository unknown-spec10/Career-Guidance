import React, { useState } from 'react'
import { Search, Plus, Minus, Gift, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import api from '../config/api'
import LoadingButton from '../components/LoadingButton'

const AdminCreditManagement = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const searchUsers = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      // Search applicants by name or email
      const response = await api.get(`/api/applicants?search=${encodeURIComponent(searchQuery)}`)
      setSearchResults(response.data || [])
    } catch (error) {
      console.error('Error searching users:', error)
      setMessage({ type: 'error', text: 'Failed to search users' })
    } finally {
      setSearching(false)
    }
  }

  const fetchUserCredits = async (userId) => {
    try {
      const response = await api.get(`/api/credits/balance?user_id=${userId}`)
      setSelectedUser({ ...selectedUser, credits: response.data })
    } catch (error) {
      console.error('Error fetching credits:', error)
    }
  }

  const handleSelectUser = async (user) => {
    setSelectedUser(user)
    setAdjustAmount('')
    setAdjustReason('')
    setMessage(null)
    // Fetch their credit details
    await fetchUserCredits(user.id)
  }

  const handleAdjustCredits = async () => {
    if (!selectedUser || !adjustAmount || !adjustReason.trim()) {
      setMessage({ type: 'error', text: 'Please fill in amount and reason' })
      return
    }

    const amount = parseInt(adjustAmount)
    if (isNaN(amount) || amount === 0) {
      setMessage({ type: 'error', text: 'Invalid amount' })
      return
    }

    if (amount < -1000 || amount > 1000) {
      setMessage({ type: 'error', text: 'Amount must be between -1000 and +1000' })
      return
    }

    setLoading(true)
    try {
      await api.post('/api/admin/credits/adjust', {
        applicant_id: selectedUser.id,
        amount: amount,
        reason: adjustReason
      })

      setMessage({ type: 'success', text: `Successfully adjusted credits by ${amount}` })
      setAdjustAmount('')
      setAdjustReason('')
      
      // Refresh user credits
      await fetchUserCredits(selectedUser.id)
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to adjust credits'
      setMessage({ type: 'error', text: errorMsg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Credit Management (Admin)</h1>
        <p className="text-gray-600">Search users and adjust their credit balance</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Search Users</h2>
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <LoadingButton
            onClick={searchUsers}
            loading={searching}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Search
          </LoadingButton>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Results:</h3>
            {searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`w-full p-3 border rounded-lg text-left transition-all ${
                  selectedUser?.id === user.id
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="font-semibold text-gray-900">{user.display_name || 'Unnamed User'}</div>
                <div className="text-sm text-gray-600">{user.email || `ID: ${user.id}`}</div>
              </button>
            ))}
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !searching && (
          <div className="mt-4 text-center text-gray-500 py-4">
            No users found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Selected User & Adjustment */}
      {selectedUser && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Adjust Credits</h2>

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-gray-900 text-lg">
                  {selectedUser.display_name || 'Unnamed User'}
                </div>
                <div className="text-sm text-gray-600">{selectedUser.email || `ID: ${selectedUser.id}`}</div>
              </div>
              {selectedUser.credits && (
                <div className="text-right">
                  <div className="text-sm text-gray-600">Current Balance</div>
                  <div className="text-3xl font-bold text-indigo-600">
                    {selectedUser.credits.current_credits}
                  </div>
                </div>
              )}
            </div>

            {selectedUser.credits && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Weekly Limit</div>
                  <div className="font-semibold">{selectedUser.credits.weekly_limit}</div>
                </div>
                <div>
                  <div className="text-gray-600">Used Today</div>
                  <div className="font-semibold">{selectedUser.credits.usage_today.credits}</div>
                </div>
                <div>
                  <div className="text-gray-600">Used This Week</div>
                  <div className="font-semibold">{selectedUser.credits.usage_this_week.credits}</div>
                </div>
              </div>
            )}
          </div>

          {/* Adjustment Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adjustment Amount
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setAdjustAmount('-10')}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors flex items-center space-x-1"
                >
                  <Minus className="w-4 h-4" />
                  <span>10</span>
                </button>
                <button
                  onClick={() => setAdjustAmount('-5')}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors flex items-center space-x-1"
                >
                  <Minus className="w-4 h-4" />
                  <span>5</span>
                </button>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Enter amount (+ or -)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={() => setAdjustAmount('5')}
                  className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>5</span>
                </button>
                <button
                  onClick={() => setAdjustAmount('10')}
                  className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition-colors flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>10</span>
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">Range: -1000 to +1000</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Required)
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Explain why you're adjusting this user's credits..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {message && (
              <div
                className={`p-4 rounded-lg flex items-start space-x-2 ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                  {message.text}
                </p>
              </div>
            )}

            <LoadingButton
              onClick={handleAdjustCredits}
              loading={loading}
              disabled={!adjustAmount || !adjustReason.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <Gift className="w-5 h-5" />
              <span>Apply Adjustment</span>
            </LoadingButton>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminCreditManagement
