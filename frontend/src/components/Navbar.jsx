import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Menu, X, LayoutDashboard, Users, Briefcase, LogOut, Shield, 
  FileText, User, Sparkles, BookOpen, Sun, Moon 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [navbarVisible, setNavbarVisible] = useState(true)
  const [prevScrollY, setPrevScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
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

  // Theme Sync
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  const handleLogout = () => {
    secureStorage.clear()
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    navigate('/login')
  }

  const handleNavClick = (e, targetId) => {
    if (location.pathname === '/') {
      e.preventDefault()
      const element = document.getElementById(targetId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // Define navigation links based on user role
  const getNavLinks = () => {
    if (!user) {
      // Public landing page links
      return [
        { to: '#features', label: 'Features', targetId: 'features' },
        { to: '#how-it-works', label: 'How It Works', targetId: 'how-it-works' },
        { to: '#testimonials', label: 'Testimonials', targetId: 'testimonials' },
        { to: '#pricing', label: 'Pricing', targetId: 'pricing' }
      ]
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
          { to: '/employer/post-job', label: 'Post Job', icon: Sparkles },
          { to: '/employer/profile', label: 'Profile', icon: User },
        ]
      case 'admin':
        return [
          { to: '/admin/dashboard?tab=overview', label: 'Admin Hub', icon: LayoutDashboard },
          { to: '/admin/dashboard?tab=all-jobs', label: 'Jobs', icon: Briefcase },
          { to: '/admin/dashboard?tab=resume-reviews', label: 'Resume Reviews', icon: FileText },
          { to: '/admin/dashboard?tab=users', label: 'User Management', icon: Users },
          { to: '/admin/dashboard?tab=system-health', label: 'System Health', icon: Shield },
        ]
      default:
        return []
    }
  }

  const navLinks = getNavLinks()
  const isActive = (path) => {
    const [pathname, search = ''] = path.split('?')
    return location.pathname === pathname && location.search === (search ? `?${search}` : '')
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      navbarVisible ? 'translate-y-0' : '-translate-y-full'
    } ${
      scrolled 
        ? 'bg-white/95 dark:bg-slate-900/95 shadow-md backdrop-blur border-b border-transparent' 
        : 'bg-white border-b border-gray-200 dark:bg-slate-900 dark:border-slate-800'
    }`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <img src="/logo.png" alt="CareerSync Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-gray-900 dark:text-white transition-colors">
              CareerSync AI
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex flex-grow items-center justify-center space-x-1.5 px-6">
            {user ? (
              navLinks.map((link) => {
                const Icon = link.icon
                const active = isActive(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                      active
                        ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white border-transparent shadow-md shadow-primary-500/15'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-primary-500'}`} />
                    <span>{link.label}</span>
                  </Link>
                )
              })
            ) : (
              // Public Landing Navigation links
              navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={(e) => handleNavClick(e, link.targetId)}
                  className="px-4 py-2 text-sm font-semibold text-slate-650 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))
            )}
          </div>

          {/* Right Area: Theme Toggle & Login/Signup */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </button>

            {user ? (
              <button
                onClick={handleLogout}
                className="nav-button inline-flex items-center gap-1.5 px-4 py-2 border rounded-xl text-sm font-semibold text-slate-650 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="px-4 py-2 text-sm font-semibold text-slate-750 hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-400 transition-colors"
                >
                  Log In
                </Link>
                <Link 
                  to="/register" 
                  className="bg-primary-600 hover:bg-primary-750 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-md shadow-primary-500/10 transition-all hover:scale-102"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors duration-200 text-gray-700 dark:text-gray-300"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
            >
              <div className="py-4 space-y-1">
                {user ? (
                  navLinks.map((link) => {
                    const Icon = link.icon
                    const active = isActive(link.to)
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-base font-medium transition-colors duration-200 ${
                          active
                            ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{link.label}</span>
                      </Link>
                    )
                  })
                ) : (
                  navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={(e) => {
                        setMobileMenuOpen(false)
                        handleNavClick(e, link.targetId)
                      }}
                      className="block px-3 py-2.5 rounded-xl text-base font-medium text-gray-600 dark:text-slate-350 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))
                )}

                {/* Mobile Logout/Login */}
                {user ? (
                  <div className="pt-4 border-t border-gray-200 dark:border-slate-850 space-y-2">
                    <button
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-medium text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-gray-200 dark:border-slate-850 flex flex-col gap-2">
                    <Link
                      to="/login"
                      className="flex justify-center py-2.5 text-base font-semibold text-slate-750 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log In
                    </Link>
                    <Link
                      to="/register"
                      className="flex justify-center py-2.5 bg-primary-600 text-white rounded-xl text-base font-semibold shadow-md shadow-primary-500/10"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
