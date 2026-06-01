import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GraduationCap, Menu, X, LayoutDashboard, Users, Building2, Briefcase, LogOut, Shield, PlusCircle, FileText, User, Sparkles, BookOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [navbarVisible, setNavbarVisible] = useState(true)
  const [prevScrollY, setPrevScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Show navbar when scrolling up or at the top
      if (currentScrollY < prevScrollY || currentScrollY < 20) {
        setNavbarVisible(true)
      } else if (currentScrollY > prevScrollY && currentScrollY > 100) {
        // Hide navbar when scrolling down (but only after scrolling past 100px)
        setNavbarVisible(false)
      }
      
      setScrolled(currentScrollY > 20)
      setPrevScrollY(currentScrollY)
      
      // Close mobile menu when scrolling
      setMobileMenuOpen(false)
    }
    
    window.addEventListener('scroll', handleScroll)
    
    // Check if user is logged in from secure storage
    const storedUser = secureStorage.getItem('user')
    if (storedUser) {
      setUser(storedUser)
    }
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [prevScrollY, location])

  const handleLogout = () => {
    secureStorage.clear()
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
          { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/student/profile', label: 'Profile', icon: User },
          { to: '/dashboard/interview', label: 'Practice', icon: Sparkles },
          { to: '/dashboard/learning-paths', label: 'Paths', icon: BookOpen },
          { to: '/jobs', label: 'Jobs', icon: Briefcase },
          { to: '/student/intelligence', label: 'AI Guru', icon: Sparkles },
        ]
      case 'employer':
        return [
          { to: '/employer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/employer/post-job', label: 'Post Job', icon: PlusCircle },
          { to: '/employer/profile', label: 'Profile', icon: User },
        ]
      case 'admin':
        return [
          { to: '/admin/dashboard?tab=overview', label: 'Admin Hub', icon: LayoutDashboard },
          { to: '/admin/dashboard?tab=all-jobs', label: 'Jobs', icon: Briefcase },
          { to: '/admin/dashboard?tab=resume-reviews', label: 'Resume Reviews', icon: FileText },
          { to: '/admin/dashboard?tab=applicants', label: 'Applicants', icon: Users },
          { to: '/admin/dashboard?tab=system-health', label: 'System Health', icon: Shield },
        ]
      default:
        return []
    }
  }

  const navLinks = getNavLinks()
  const isAdminHub = user?.role === 'admin' && location.pathname.startsWith('/admin/dashboard')
  const isActive = (path) => {
    const [pathname, search = ''] = path.split('?')
    return location.pathname === pathname && location.search === (search ? `?${search}` : '')
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      navbarVisible ? 'translate-y-0' : '-translate-y-full'
    } ${
      scrolled ? 'bg-white shadow-md' : 'bg-white border-b border-gray-200'
    }`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="bg-primary-500 p-2 rounded-lg group-hover:bg-primary-600 transition-colors duration-200">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">
              Career AI
            </span>
          </Link>

          {/* Desktop Nav Links */}
          {user && (
            <div className="hidden md:flex flex-1 items-center justify-center space-x-1.5 px-6">
              {navLinks.map((link) => {
                const Icon = link.icon
                const active = isActive(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                      active
                        ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white border-transparent shadow-md shadow-primary-500/15'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 hover:shadow-sm'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-primary-500'}`} />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Desktop Navigation: keep navbar minimal — only Logout for authenticated users */}
          <div className="hidden md:flex items-center space-x-1">
            {user ? (
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={handleLogout}
                  className="nav-button"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link to="/login" className="nav-button ml-4">
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-700"
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
              <div className="py-4 space-y-1">
                {user && (
                  <div className="space-y-1 pb-3">
                    {navLinks.map((link) => {
                      const Icon = link.icon
                      const active = isActive(link.to)
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-base font-medium transition-colors duration-200 ${
                            active
                              ? 'bg-primary-50 text-primary-600'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{link.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}

                {/* Mobile: only show Logout (or Login) — keep mobile menu minimal */}
                {user ? (
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <button
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full nav-button justify-center"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="block nav-button w-full justify-center mt-4"
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
