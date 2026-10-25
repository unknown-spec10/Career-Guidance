import api from '../config/api'

/**
 * Admin API service.
 *
 * One place for every /api/admin/* request so pages stay focused on state and
 * presentation. All functions return the response body (no axios envelope).
 */

const withSearch = (params, search) => {
  if (search && search.trim()) {
    params.search = search.trim()
  }
  return params
}

export const getAdminOverview = async () => {
  const response = await api.get('/api/admin/overview')
  return response.data
}

export const getAdminUsers = async ({ skip = 0, limit = 20, search = '' } = {}) => {
  const response = await api.get('/api/admin/users', {
    params: withSearch({ skip, limit }, search),
  })
  return response.data
}

export const updateAdminUser = async (userId, payload) => {
  const response = await api.patch(`/api/admin/users/${userId}`, payload)
  return response.data
}

export const getAdminJobs = async ({ status = 'pending', skip = 0, limit = 20 } = {}) => {
  const response = await api.get('/api/admin/jobs', {
    params: { status, skip, limit },
  })
  return response.data
}

export const approveAdminJob = async (jobId) => {
  const response = await api.post(`/api/admin/jobs/${jobId}/approve`)
  return response.data
}

export const rejectAdminJob = async (jobId, reason) => {
  const response = reason
    ? await api.post(`/api/admin/jobs/${jobId}/reject`, { reason })
    : await api.post(`/api/admin/jobs/${jobId}/reject`)
  return response.data
}

export const getAdminCreditTransactions = async ({ skip = 0, limit = 20, search = '' } = {}) => {
  const response = await api.get('/api/admin/credits/transactions', {
    params: withSearch({ skip, limit }, search),
  })
  return response.data
}

export const adjustAdminCredits = async ({ applicantId, amount, reason }) => {
  const response = await api.post('/api/admin/credits/adjust', {
    applicant_id: applicantId,
    amount,
    reason,
  })
  return response.data
}

export const getAdminConfig = async () => {
  const response = await api.get('/api/admin/config')
  return response.data
}

export const getAdminAuditLogs = async ({ skip = 0, limit = 20 } = {}) => {
  const response = await api.get('/api/admin/audit-logs', {
    params: { skip, limit },
  })
  return response.data
}
