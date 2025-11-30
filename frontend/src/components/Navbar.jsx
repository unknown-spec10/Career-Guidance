import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GraduationCap, Menu, X, LayoutDashboard, Users, Building2, Briefcase, LogOut, Shield, PlusCircle, FileText } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../config/api'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    
    // Check if user is logged in
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [location])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    navigate('/login')
  }

  // Define navigation links based on user role
  const getNavLinks = () => {
    if (!user) {
      // Public navigation - empty before login
      return []
    }

    switch (user.role) {
      case 'student':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/colleges', label: 'Explore Colleges', icon: Building2 },
          { to: '/jobs', label: 'Browse Jobs', icon: Briefcase },
        ]
      case 'employer':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/employer/post-job', label: 'Post Job', icon: PlusCircle },
        ]
      case 'college':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/college/add-program', label: 'Add Program', icon: PlusCircle },
          { to: '/colleges', label: 'All Colleges', icon: Building2 },
        ]
      case 'admin':
        return [
          { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/admin/reviews', label: 'Reviews', icon: Shield },
          { to: '/applicants', label: 'Applicants', icon: Users },
          { to: '/colleges', label: 'Colleges', icon: Building2 },
          { to: '/jobs', label: 'Jobs', icon: Briefcase },
        ]
      default:
        return []
    }
  }

  const navLinks = getNavLinks()
  const isActive = (path) => location.pathname === path

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-dark-900/95 backdrop-blur-lg shadow-lg' : 'bg-dark-900/80 backdrop-blur-lg border-b border-dark-700/50'
    }`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-2 rounded-lg group-hover:scale-110 transition-transform duration-200">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              Career AI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive(link.to)
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-gray-300 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
            {user ? (
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-sm text-gray-400">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-primary ml-4">
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-dark-800 transition-colors duration-200"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="py-4 space-y-2">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                        isActive(link.to)
                          ? 'bg-primary-500/20 text-primary-400'
                          : 'text-gray-300 hover:text-white hover:bg-dark-800'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  )
                })}
                {user ? (
                  <div className="pt-4 border-t border-dark-700">
                    <p className="text-sm text-gray-400 px-4 mb-2">{user.email}</p>
                    <button
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/30 transition-colors text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="block btn-primary text-center mt-4"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
