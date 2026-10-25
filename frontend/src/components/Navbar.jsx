import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  Menu, X, LayoutDashboard, Briefcase, LogOut, 
  User, Sparkles, BookOpen, Sun, Moon 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useTheme } from '../hooks/useTheme'

const iconButton = 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-surface-raised text-ink-muted shadow-soft-xs transition-colors duration-200 hover:border-hairline-strong hover:text-ink'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [navbarVisible, setNavbarVisible] = useState(true)
  const [prevScrollY, setPrevScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const { theme, toggleTheme } = useTheme()
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

  // Theme Sync (shared useTheme hook owns documentElement + localStorage)

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
    <nav className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
      navbarVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className={`nav-glass border-b transition-[border-color,box-shadow] duration-300 ${
        scrolled ? 'border-hairline shadow-soft-xs' : 'border-transparent'
      }`}>
        <div className="landing-shell">
          <div className="flex h-16 items-center justify-between gap-6 md:h-20">
            {/* Logo */}
            <Link to="/" className="group flex items-center gap-2.5">
              <img
                src="/logo.png"
                alt="CareerSync Logo"
                className="h-8 w-8 rounded-[10px] object-contain transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <span className="font-display text-[1.0625rem] font-bold tracking-[-0.02em] text-ink transition-colors">
                CareerSync AI
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden flex-grow items-center justify-center gap-1 md:flex">
              {user ? (
                navLinks.map((link) => {
                  const Icon = link.icon
                  const active = isActive(link.to)
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-caption font-semibold transition-colors duration-200 ${
                        active
                          ? 'bg-primary-600 text-white shadow-soft-xs dark:bg-primary-500 dark:text-white'
                          : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-primary-500 dark:text-primary-400'}`} />
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
                    className="rounded-full px-3.5 py-2 text-caption font-semibold text-ink-muted transition-colors duration-200 hover:bg-surface-sunken hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))
              )}
            </div>

            {/* Right Area: Theme Toggle & Login/Signup */}
            <div className="hidden items-center gap-2.5 md:flex">
              <button onClick={toggleTheme} className={iconButton} aria-label="Toggle Theme">
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
              </button>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full border border-hairline bg-transparent px-4 py-2.5 text-caption font-semibold text-ink-muted transition-colors duration-200 hover:border-hairline-strong hover:text-ink"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    className="rounded-full px-3.5 py-2.5 text-caption font-semibold text-ink-muted transition-colors duration-200 hover:text-ink"
                  >
                    Log In
                  </Link>
                  <Link 
                    to="/register" 
                    className="inline-flex items-center rounded-full bg-primary-600 px-5 py-2.5 text-caption font-semibold text-white shadow-soft-xs transition-[background-color,box-shadow] duration-200 hover:bg-primary-700 hover:shadow-soft-sm dark:bg-primary-500 dark:hover:bg-primary-400"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <button onClick={toggleTheme} className={iconButton} aria-label="Toggle Theme">
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={iconButton}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden border-t border-hairline bg-surface-overlay md:hidden"
            >
              <div className="landing-shell space-y-1 py-4">
                {user ? (
                  navLinks.map((link) => {
                    const Icon = link.icon
                    const active = isActive(link.to)
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 rounded-card px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                          active
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                            : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
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
                      className="block rounded-card px-3 py-2.5 text-sm font-semibold text-ink-muted transition-colors duration-200 hover:bg-surface-sunken hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  ))
                )}

                {/* Mobile Logout/Login */}
                {user ? (
                  <div className="mt-3 border-t border-hairline pt-3">
                    <button
                      onClick={() => {
                        handleLogout()
                        setMobileMenuOpen(false)
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-3 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:border-hairline-strong hover:text-ink"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-3">
                    <Link
                      to="/login"
                      className="flex justify-center rounded-full px-3 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Log In
                    </Link>
                    <Link
                      to="/register"
                      className="flex justify-center rounded-full bg-primary-600 px-3 py-2.5 text-sm font-semibold text-white shadow-soft-xs dark:bg-primary-500"
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
