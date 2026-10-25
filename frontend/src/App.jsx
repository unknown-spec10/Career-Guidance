import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import ResultsPage from './pages/ResultsPage'
import DashboardRouter from './pages/DashboardRouter'
import JobsPage from './pages/JobsPage'
import JobDetailsPage from './pages/JobDetailsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import EmailVerificationPage from './pages/EmailVerificationPage'
import ResendVerificationPage from './pages/ResendVerificationPage'
import VerifyCodePage from './pages/VerifyCodePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import StudentDashboard from './pages/StudentDashboard'
import StudentProfile from './pages/StudentProfile'
import CandidateIntelligencePage from './pages/CandidateIntelligencePage'
import InterviewPage from './pages/InterviewPage'
import InterviewSessionPage from './pages/InterviewSessionPage'
import InterviewResultsPage from './pages/InterviewResultsPage'
import LearningPathPage from './pages/LearningPathPage'
import MyLearningPathsPage from './pages/MyLearningPathsPage'
import TransactionHistoryPage from './pages/TransactionHistoryPage'
import UpgradePage from './pages/UpgradePage'
import MyApplicationsPage from './pages/MyApplicationsPage'
import AskPage from './pages/AskPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminJobsPage from './pages/AdminJobsPage'
import ProtectedRoute from './components/ProtectedRoute'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import api from './config/api'
import secureStorage from './utils/secureStorage'
import { getAuthToken } from './utils/authToken'
import { Sparkles } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import { useTheme } from './hooks/useTheme'

function HomePage() {
  return (
    <>
      <Hero />
    </>
  )
}

function AppContent() {
  const location = useLocation()
  const user = secureStorage.getItem('user')
  const isDashboardPath = location.pathname.startsWith('/student') || 
                          location.pathname.startsWith('/admin') ||
                          location.pathname.startsWith('/dashboard') || 
                          location.pathname.startsWith('/results') || 
                          (user && (location.pathname === '/jobs' || location.pathname.startsWith('/job/')))
  
  const hideNavbarPaths = ['/login', '/register', '/verify-email', '/verify-code', '/resend-verification', '/forgot-password', '/reset-password']
  const showNavbar = !hideNavbarPaths.includes(location.pathname) && !isDashboardPath
  const showAssistantLauncher = location.pathname === '/'

  const mainRoutes = (
    <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<EmailVerificationPage />} />
          <Route path="/verify-code" element={<VerifyCodePage />} />
          <Route path="/resend-verification" element={<ResendVerificationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/job/:jobId" element={<JobDetailsPage />} />
          <Route path="/ask" element={<AskPage />} />

          {/* Student Routes */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/intelligence"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <CandidateIntelligencePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/applications"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <MyApplicationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results/:applicantId"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <ResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/interview"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <InterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/interview/:sessionId"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <InterviewSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/interview/results/:sessionId"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <InterviewResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/learning-path/:pathId"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <LearningPathPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/learning-paths"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <MyLearningPathsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/credits/transactions"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <TransactionHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/upgrade"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <UpgradePage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/jobs"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminJobsPage />
              </ProtectedRoute>
            }
          />
          {/* Unknown /admin paths: admins land on their dashboard, any other
              role is bounced to its own dashboard by ProtectedRoute. */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Navigate to="/admin/dashboard" replace />
              </ProtectedRoute>
            }
          />

          {/* Smart Dashboard Router - redirects to role-specific dashboard */}
          <Route path="/dashboard" element={<DashboardRouter />} />
        </Routes>
  )

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {showNavbar && <Navbar />}
      <main className="flex-grow">
        {isDashboardPath ? (
          <DashboardLayout>
            {mainRoutes}
          </DashboardLayout>
        ) : (
          mainRoutes
        )}
      </main>
      {showAssistantLauncher && (
        <Link
          to="/ask"
          aria-label="Open AI assistant"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/25 transition-transform duration-200 hover:scale-105 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
        >
          <Sparkles className="h-6 w-6" />
        </Link>
      )}
      {!isDashboardPath && <Footer />}
    </div>
  )
}

function App() {
  // Global theme initialisation: applies the persisted light/dark choice on
  // every route (auth screens included), not only pages with their own toggle.
  useTheme()

  useEffect(() => {
    // Migrate from localStorage to secureStorage on first load
    secureStorage.migrateFromLocalStorage()

    // Set authorization header if a restored session exists
    // (warms the in-memory holder; useAuth re-validates right after).
    const token = getAuthToken()
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }, [])

  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  )
}

export default App
