/**
 * Role -> dashboard path mapping.
 * Dedupe of role redirect logic in DashboardRouter,
 * ProtectedRoute, DashboardLayout and Navbar.
 */

export const getDashboardPath = (role, fallback = '/login') => {
  switch (role) {
    case 'student':
      return '/student/dashboard'
    case 'admin':
      return '/admin/dashboard'
    default:
      return fallback
  }
}

export default getDashboardPath
