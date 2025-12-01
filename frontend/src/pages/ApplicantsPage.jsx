import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, MapPin, Calendar, AlertTriangle, Eye } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../config/api'
import { GridSkeleton } from '../components/Skeleton'
import { PAGINATION, ANIMATION_DELAYS } from '../config/constants'

export default function ApplicantsPage() {
  const [applicants, setApplicants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(PAGINATION.APPLICANTS_PAGE_SIZE)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reviewFilter = searchParams.get('review') === 'true'

  useEffect(() => {
    fetchApplicants()
  }, [reviewFilter, page])

  const fetchApplicants = async () => {
    try {
      setError(null)
      setLoading(true)
      const response = await api.get('/api/applicants', {
        params: { skip: (page - 1) * pageSize, limit: pageSize }
      })
      let data = response.data?.applicants || []
      
      if (reviewFilter) {
        data = data.filter(a => a.needs_review)
      }
      
      setApplicants(data)
      setTotal(response.data?.total || 0)
    } catch (error) {
      console.error('Error fetching applicants:', error)
      setError(error.response?.data?.detail || 'Failed to load applicants. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const viewApplicantDetails = (applicantId) => {
    navigate(`/applicant/${applicantId}`)
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading && applicants.length === 0) {
    return (
      <div className="min-h-screen bg-dark-900 pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-10 bg-dark-800 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-6 bg-dark-800 rounded w-96 animate-pulse"></div>
          </div>
          <GridSkeleton count={9} columns={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 pt-24 pb-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {reviewFilter ? 'Applicants Needing Review' : 'All Applicants'}
          </h1>
          <p className="text-gray-400">Total: {total} applicants | Page {page} of {totalPages}</p>
        </motion.div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applicants.map((applicant, idx) => (
            <motion.div
              key={applicant.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * ANIMATION_DELAYS.CARD_STAGGER }}
              className="card hover:border-primary-500/50 transition-all duration-300 cursor-pointer"
              onClick={() => viewApplicantDetails(applicant.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{applicant.display_name || applicant.applicant_id}</h3>
                    <p className="text-sm text-gray-400">{applicant.applicant_id}</p>
                  </div>
                </div>
                {applicant.needs_review && (
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                )}
              </div>

              <div className="space-y-2">
                {applicant.location_city && (
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <MapPin className="w-4 h-4" />
                    <span>{applicant.location_city}, {applicant.country}</span>
                  </div>
                )}
                {applicant.created_at && (
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(applicant.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-dark-700 flex items-center justify-between">
                <span className={`text-sm ${applicant.has_parsed_data ? 'text-green-400' : 'text-gray-400'}`}>
                  {applicant.has_parsed_data ? '✓ Parsed' : 'Not Parsed'}
                </span>
                <button className="text-primary-400 hover:text-primary-300 flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">View Details</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {applicants.length === 0 && !loading && (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No applicants found</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center space-x-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
