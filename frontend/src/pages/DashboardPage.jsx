import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, GraduationCap, Briefcase, TrendingUp, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../config/api'
import { ANIMATION_DELAYS } from '../config/constants'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setError(null)
      const response = await api.get('/api/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching stats:', error)
      setError(error.response?.data?.detail || 'Failed to load statistics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500 text-red-400 px-6 py-4 rounded-lg max-w-md mx-4">
          <div className="flex items-center space-x-2 mb-3">
            <AlertCircle className="w-6 h-6" />
            <h3 className="font-semibold">Error Loading Dashboard</h3>
          </div>
          <p className="mb-4">{error}</p>
          <button onClick={fetchStats} className="btn-primary w-full">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Applicants',
      value: stats?.total_applicants || 0,
      icon: Users,
      color: 'primary',
      link: '/applicants'
    },
    {
      title: 'Colleges',
      value: stats?.total_colleges || 0,
      icon: GraduationCap,
      color: 'blue',
      link: '/colleges'
    },
    {
      title: 'Job Listings',
      value: stats?.total_jobs || 0,
      icon: Briefcase,
      color: 'green',
      link: '/jobs'
    },
    {
      title: 'Needs Review',
      value: stats?.applicants_needing_review || 0,
      icon: AlertCircle,
      color: 'yellow',
      link: '/applicants?review=true'
    }
  ]

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">Overview of the career guidance system</p>
          </div>
          <Link 
            to="/admin/reviews"
            className="flex items-center space-x-2 px-4 py-2 bg-yellow-900/20 border border-yellow-500/30 rounded-lg hover:bg-yellow-900/30 transition-colors text-yellow-400"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="hidden sm:inline">Pending Reviews</span>
            {stats?.applicants_needing_review > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500 text-dark-900 text-xs font-bold rounded-full">
                {stats.applicants_needing_review}
              </span>
            )}
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link to={stat.link}>
                <div className="card hover:border-primary-500/50 transition-all duration-300 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-white">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-12 h-12 text-${stat.color}-400`} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Recommendation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-6 h-6 text-primary-400" />
              <h2 className="text-xl font-semibold">College Recommendations</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Total Recommendations</p>
                <p className="text-2xl font-bold">{stats?.total_college_recommendations || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Average Match Score</p>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-dark-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-primary-500 to-primary-400 h-full rounded-full"
                      style={{ width: `${stats?.avg_college_match || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xl font-bold text-primary-400">
                    {(stats?.avg_college_match || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="card"
          >
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-semibold">Job Recommendations</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Total Recommendations</p>
                <p className="text-2xl font-bold">{stats?.total_job_recommendations || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">Average Match Score</p>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-dark-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-green-500 to-green-400 h-full rounded-full"
                      style={{ width: `${stats?.avg_job_match || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xl font-bold text-green-400">
                    {(stats?.avg_job_match || 0).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
