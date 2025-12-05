import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import UploadSection from './components/UploadSection'
import ResultsPage from './pages/ResultsPage'
import DashboardPage from './pages/DashboardPage'
import DashboardRouter from './pages/DashboardRouter'
import ApplicantsPage from './pages/ApplicantsPage'
import ApplicantDetailsPage from './pages/ApplicantDetailsPage'
import CollegesPage from './pages/CollegesPage'
import CollegeDetailsPage from './pages/CollegeDetailsPage'
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
import InterviewPage from './pages/InterviewPage'
import InterviewSessionPage from './pages/InterviewSessionPage'
import InterviewResultsPage from './pages/InterviewResultsPage'
import LearningPathPage from './pages/LearningPathPage'
import TransactionHistoryPage from './pages/TransactionHistoryPage'
import AdminCreditManagement from './pages/AdminCreditManagement'
import EmployerDashboard from './pages/EmployerDashboard'
import EmployerProfile from './pages/EmployerProfile'
import EmployerPostJob from './pages/EmployerPostJob'
import EmployerJobDetails from './pages/EmployerJobDetails'
import CollegeDashboard from './pages/CollegeDashboard'
import CollegeProfile from './pages/CollegeProfile'
import AdminReviewsPage from './pages/AdminDashboard'
import ProtectedRoute from './components/ProtectedRoute'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import api from './config/api'
import secureStorage from './utils/secureStorage'

function HomePage() {
  return (
    <>
      <Hero />
      <Features />
    </>
  )
}

function AppContent() {
  const location = useLocation()
  const hideNavbarPaths = ['/login', '/register', '/verify-email', '/verify-code', '/resend-verification', '/forgot-password', '/reset-password']
  const showNavbar = !hideNavbarPaths.includes(location.pathname)

  return (
    <div className="min-h-screen flex flex-col">
      {showNavbar && <Navbar />}
      <main className="flex-grow">
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
            <Route path="/colleges" element={<CollegesPage />} />
            <Route path="/college/:collegeId" element={<CollegeDetailsPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/job/:jobId" element={<JobDetailsPage />} />

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
              path="/student/profile" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/results/:applicantId" 
              element={
                <ProtectedRoute allowedRoles={['student', 'admin']}>
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
              path="/dashboard/credits/transactions" 
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <TransactionHistoryPage />
                </ProtectedRoute>
              } 
            />

            {/* Employer Routes */}
            <Route 
              path="/employer/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['employer']}>
                  <EmployerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employer/profile" 
              element={
                <ProtectedRoute allowedRoles={['employer']}>
                  <EmployerProfile />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employer/post-job" 
              element={
                <ProtectedRoute allowedRoles={['employer']}>
                  <EmployerPostJob />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employer/jobs/:jobId" 
              element={
                <ProtectedRoute allowedRoles={['employer']}>
                  <EmployerJobDetails />
                </ProtectedRoute>
              } 
            />

            {/* College Routes */}
            <Route 
              path="/college/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['college']}>
                  <CollegeDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/college/profile" 
              element={
                <ProtectedRoute allowedRoles={['college']}>
                  <CollegeProfile />
                </ProtectedRoute>
              } 
            />

            {/* Admin Routes */}
            <Route 
              path="/admin/dashboard" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/reviews" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminReviewsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/credits" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminCreditManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/applicants" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ApplicantsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/applicant/:applicantId" 
              element={<ApplicantDetailsPage />} 
            />

            {/* Smart Dashboard Router - redirects to role-specific dashboard */}
            <Route path="/dashboard" element={<DashboardRouter />} />
          </Routes>
        </main>
        <Footer />
      </div>
  )
}

function App() {
  useEffect(() => {
    // Migrate from localStorage to secureStorage on first load
    secureStorage.migrateFromLocalStorage()
    
    // Set authorization header if token exists
    const token = secureStorage.getItem('token')
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
