import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, User, Sparkles, BookOpen, Briefcase, LogOut,
  Menu, X, Bell, Sun, Moon, Coins, ChevronRight, ChevronLeft, Shield,
  ShieldCheck, Users, ClipboardList
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'

const HEADER_TITLES = {
  '/student/dashboard': 'Dashboard',
  '/student/applications': 'My Applications',
  '/student/intelligence': 'AI Guru',
  '/student/profile': 'Profile Settings',
  '/dashboard/interview': 'Interview Prep',
  '/dashboard/learning-paths': 'Learning Paths',
  '/dashboard/upgrade': 'Upgrade',
  '/dashboard/credits/transactions': 'Credit History',
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/users': 'Users',
  '/admin/jobs': 'Jobs',
  '/jobs': 'Jobs',
}

function headerTitleFor(pathname) {
  if (HEADER_TITLES[pathname]) return HEADER_TITLES[pathname]
  if (pathname.startsWith('/dashboard/interview/results/')) return 'Interview Results'
  if (pathname.startsWith('/dashboard/interview/')) return 'Interview Session'
  if (pathname.startsWith('/dashboard/learning-path/')) return 'Learning Path'
  if (pathname.startsWith('/results/')) return 'Resume Results'
  if (pathname.startsWith('/job/')) return 'Job Details'
  return pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Dashboard'
}

export default function DashboardLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const notificationRef = useRef(null)

  // State
  const [user, setUser] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [credits, setCredits] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [hasNewNotifications, setHasNewNotifications] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  // Initialize theme
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  // Load User and Credit Quota
  useEffect(() => {
    const storedUser = secureStorage.getItem('user')
    if (storedUser) {
      setUser(storedUser)
    } else {
      navigate('/login')
    }

    const fetchCredits = async () => {
      // Credit wallet is a student surface; admin sessions have no account.
      if (storedUser?.role !== 'student') return
      try {
        const response = await api.get('/api/credits/balance')
        setCredits(response.data)
      } catch (err) {
        console.error('Error fetching credits in layout:', err)
      }
    }

    const refreshUserDetails = async () => {
      try {
        const response = await api.get('/api/auth/me')
        if (response.data) {
          secureStorage.setItem('user', response.data)
          setUser(response.data)
        }
      } catch (err) {
        console.warn('Failed to refresh user details from server:', err)
      }
    }

    fetchCredits()
    refreshUserDetails()
    const interval = storedUser?.role === 'student' ? setInterval(fetchCredits, 30000) : null

    const handleProfileUpdate = () => {
      const updatedUser = secureStorage.getItem('user')
      if (updatedUser) {
        setUser(updatedUser)
      }
    }
    window.addEventListener('userProfileUpdated', handleProfileUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('userProfileUpdated', handleProfileUpdate)
    }
  }, [navigate])

  // Generate dynamic notifications based on user data
  useEffect(() => {
    if (!user) return
    // Admin notifications are not modelled yet; keep the bell empty rather
    // than calling student-only endpoints with an admin session.
    if (user.role !== 'student') {
      setNotifications([])
      setHasNewNotifications(false)
      return
    }

    const generateNotifications = async () => {
      const list = []

      // Welcome Notification
      list.push({
        id: 'welcome',
        title: `Welcome to CareerSync`,
        body: `Ready to accelerate your career? Upload your resume to begin!`,
        time: 'Just now',
        type: 'info'
      })

      // Credits Notification
      if (credits) {
        const pct = credits.weekly_limit > 0 ? (credits.current_credits / credits.weekly_limit) * 100 : 0
        if (pct < 25) {
          list.push({
            id: 'credits-low',
            title: 'Low Credits Warning',
            body: `Only ${credits.current_credits} credits left. Refill to avoid mock practice interruptions.`,
            time: '1h ago',
            type: 'warning'
          })
        } else {
          list.push({
            id: 'credits-good',
            title: 'Quota Available',
            body: `You have ${credits.current_credits} credits available for mock practice.`,
            time: '2h ago',
            type: 'success'
          })
        }
      }

      // Fetch Applications
      try {
        const appRes = await api.get('/api/student/applications/jobs')
        const apps = appRes.data?.applications || []
        if (apps.length > 0) {
          list.push({
            id: 'apps-count',
            title: 'Application Pipeline Active',
            body: `You are currently tracking ${apps.length} active job applications.`,
            time: '3h ago',
            type: 'info'
          })

          const interviewing = apps.find(a => a.status?.toLowerCase() === 'interviewing')
          if (interviewing) {
            list.push({
              id: 'interviewing-status',
              title: 'Interview Scheduled',
              body: `Status updated to "Interviewing" for ${interviewing.job_title || interviewing.job?.title || 'Job'}.`,
              time: '1d ago',
              type: 'interview'
            })
          }
        }
      } catch (e) {
        // Silently swallow
      }

      setNotifications(list)
      setHasNewNotifications(list.length > 0)
    }

    generateNotifications()
  }, [user, credits])

  // Close notification popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleLogout = () => {
    secureStorage.clear()
    delete api.defaults.headers.common['Authorization']
    navigate('/login')
  }

  // Get navigation links based on user role
  const getNavLinks = () => {
    if (!user) return []

    switch (user.role) {
      case 'student':
        return [
          { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/jobs', label: 'Recommended Jobs', icon: Briefcase },
          { to: '/student/applications', label: 'My Applications', icon: ClipboardList },
          { to: '/dashboard/interview', label: 'Interview Prep', icon: Sparkles },
          { to: '/dashboard/learning-paths', label: 'Learning Paths', icon: BookOpen },
          { to: '/student/intelligence', label: 'AI Guru', icon: Shield },
          { to: '/student/profile', label: 'Profile Settings', icon: User }
        ]
      case 'admin':
        return [
          { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/admin/users', label: 'Users', icon: Users },
          { to: '/admin/jobs', label: 'Jobs', icon: ShieldCheck }
        ]
      default:
        return []
    }
  }

  const navLinks = getNavLinks()

  // Dynamic styling variables for credit wallet
  const currentCredits = credits?.current_credits ?? 0
  const limitCredits = credits?.weekly_limit ?? 100
  const rawPct = limitCredits > 0 ? (currentCredits / limitCredits) * 100 : 0
  const creditPct = Math.min(Math.max(rawPct, 0), 100)
  const walletColor = creditPct >= 50 ? 'bg-success' : creditPct >= 25 ? 'bg-warning' : 'bg-error'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink font-body transition-colors duration-200">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className={`hidden md:flex flex-col h-screen bg-surface-raised border-r border-hairline flex-shrink-0 z-30 transition-all duration-300 ${collapsed ? 'w-20 p-md' : 'w-64 p-lg'}`}>
        
        {/* Brand Header */}
        <div className={`mb-xl flex items-center px-xs ${collapsed ? 'flex-col gap-3 justify-center' : 'gap-1'}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src="/logo.png" alt="CareerSync Logo" className="h-7 w-7 object-contain shrink-0" />
            <span title="CareerSync AI" className={`font-display text-title font-bold tracking-[-0.02em] text-ink whitespace-nowrap transition-all duration-300 origin-left overflow-hidden ${collapsed ? 'max-w-0 opacity-0 scale-x-0 pointer-events-none' : 'opacity-100 scale-x-100'}`}>
              CareerSync AI
            </span>
          </div>
          <button
            onClick={toggleCollapse}
 className="relative group/toggle p-1 rounded-card text-ink-muted hover:bg-surface-sunken hover:text-ink transition-all active:scale-95 duration-150 shrink-0"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm rounded-card border border-hairline bg-surface-overlay text-ink text-caption shadow-soft opacity-0 group-hover/toggle:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Expand Sidebar
              </div>
            )}
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className={`flex items-center mb-lg bg-surface-sunken rounded-card border border-hairline transition-all duration-300 ${collapsed ? 'justify-center p-2' : 'p-sm'}`}>
            {user.profile_picture_url ? (
              <img
                src={user.profile_picture_url.startsWith("http") ? user.profile_picture_url : `${api.defaults.baseURL || ""}${user.profile_picture_url}`}
                alt="User Avatar"
                className="w-10 h-10 rounded-card object-cover shadow-soft-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-card bg-primary-600 text-white dark:bg-primary-500 flex items-center justify-center font-display font-bold uppercase shadow-soft-xs shrink-0">
                {user.name ? user.name[0] : (user.email ? user.email[0] : 'U')}
              </div>
            )}
            <div className={`min-w-0 transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-sm'}`}>
              <p className="font-body text-caption font-semibold text-ink truncate">{user.name || 'Alex Chen'}</p>
              <p className="text-overline text-ink-subtle truncate">{user.role}</p>
            </div>
          </div>
        )}

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar min-h-0">
          {navLinks.map((link) => {
            const Icon = link.icon
            const active = (location.pathname + location.search) === link.to || 
                           (link.to.includes('?tab=') && location.pathname === link.to.split('?')[0] && location.search.includes(link.to.split('?')[1])) ||
                           (!link.to.includes('?tab=') && (location.pathname === link.to || (link.to !== '/student/dashboard' && location.pathname.startsWith(link.to))))
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative group flex items-center py-3 rounded-card transition-colors duration-200 active:translate-x-1 min-w-0 ${
                  active
                    ? 'bg-primary-600 text-white dark:bg-primary-500 font-body font-semibold shadow-soft-xs'
 : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                } ${collapsed ? 'justify-center px-0' : 'px-md'}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`font-body text-sm transition-all duration-300 overflow-hidden whitespace-nowrap truncate ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-none opacity-100 ml-md'}`}>
                  {link.label}
                </span>
                {collapsed && (
                  <div className="absolute left-full ml-sm px-md py-sm rounded-card border border-hairline bg-surface-overlay text-ink text-caption shadow-soft opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {link.label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Wallet */}
        {user?.role === 'student' && credits && (
          <div className={`relative group/wallet rounded-card border border-hairline bg-surface-sunken mb-sm mt-md shadow-soft-xs transition-all duration-300 ${collapsed ? 'p-2 flex flex-col items-center gap-1.5' : 'p-md'}`}>
            <div className="flex justify-between items-center mb-xs w-full">
              {!collapsed && <span className="text-overline text-ink-subtle">AI Credits</span>}
              <Coins className={`h-4 w-4 text-warning ${collapsed ? 'mx-auto' : ''}`} />
            </div>
            {collapsed ? (
              <div className="text-[11px] font-bold text-ink text-center">
                {currentCredits}
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-xs mb-xs">
                  <span className="font-display text-title font-bold text-ink">{currentCredits}</span>
                  <span className="font-body text-[11px] text-ink-subtle">/ {limitCredits}</span>
                </div>
                <div className="w-full bg-hairline rounded-pill h-1.5 mb-sm overflow-hidden">
                  <div className={`${walletColor} h-1.5 rounded-pill`} style={{ width: `${creditPct}%` }} />
                </div>
                <Link
                  to="/dashboard/upgrade"
                  className="app-btn-secondary app-btn-sm w-full cursor-pointer"
                >
                  Refill Quota
                </Link>
              </>
            )}
            
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm rounded-card border border-hairline bg-surface-overlay text-ink text-caption shadow-soft opacity-0 group-hover/wallet:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Credits: {currentCredits} / {limitCredits}
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-md border-t border-hairline space-y-1">
          <button
            onClick={toggleTheme}
 className={`relative group/theme w-full flex items-center py-2.5 text-ink-muted hover:bg-surface-sunken hover:text-ink rounded-card transition-colors text-left ${collapsed ? 'justify-center px-0' : 'px-md'}`}
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-5 h-5 shrink-0" />
                <span className={`font-body text-sm transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-md'}`}>
                  Dark Theme
                </span>
              </>
            ) : (
              <>
                <Sun className="w-5 h-5 text-amber-500 shrink-0" />
                <span className={`font-body text-sm transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-md'}`}>
                  Light Theme
                </span>
              </>
            )}
            
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm rounded-card border border-hairline bg-surface-overlay text-ink text-caption shadow-soft opacity-0 group-hover/theme:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {theme === 'light' ? 'Dark Theme' : 'Light Theme'}
              </div>
            )}
          </button>
          
          <button
            onClick={handleLogout}
 className={`relative group/logout w-full flex items-center py-2.5 text-rose-600 dark:text-rose-400 rounded-card transition-colors text-left hover:bg-rose-50 dark:hover:bg-rose-500/10 ${collapsed ? 'justify-center px-0' : 'px-md'}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`font-body text-sm font-semibold transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-md'}`}>
              Logout
            </span>
            
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm rounded-card border border-hairline bg-surface-overlay text-ink text-caption shadow-soft opacity-0 group-hover/logout:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Logout
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* --- MAIN PORT --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-canvas">
        
        {/* --- TOP HEADER --- */}
        {/* sticky top-0 pins the header above the scrolling main portal;
            solid opaque bg + z-30 keep page content from showing through
            behind it. Notification dropdown (z-50) still floats above. */}
        <header className="sticky top-0 bg-canvas border-b border-hairline h-16 flex-shrink-0 flex items-center px-margin-desktop z-30 shadow-soft-xs transition-all duration-300">
          <div className="w-full max-w-container-max mx-auto flex justify-between items-center">
            
            {/* Left Header - Mobile menu trigger */}
            <div className="flex min-w-0 flex-1 items-center gap-md">
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
 className="md:hidden p-sm rounded-pill text-ink-muted hover:bg-surface-sunken hover:text-ink active:scale-95 transition-all"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="truncate font-display text-title font-bold capitalize tracking-[-0.02em] text-ink">
                {headerTitleFor(location.pathname)}
              </h2>
            </div>

            {/* Right Header Controls */}
            <div className="flex shrink-0 items-center gap-md">
              
              {/* Upgrade Trigger */}
              {user?.role === 'student' && (
                <Link
                  to="/dashboard/upgrade"
                  className="hidden sm:inline-flex app-btn-primary app-btn-sm"
                >
                  Upgrade Pro
                </Link>
              )}

              {/* Theme toggle (Top navigation fallback for mobile) */}
              <button
                onClick={toggleTheme}
 className="p-sm text-ink-muted hover:text-ink transition-colors rounded-pill hover:bg-surface-sunken active:scale-95 md:hidden"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-500" />}
              </button>

              {/* Dynamic Notification Bell */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen)
                    setHasNewNotifications(false)
                  }}
                  aria-label={`Notifications${hasNewNotifications ? ' (new)' : ''}`}
                  aria-expanded={notificationsOpen}
 className="p-sm text-ink-muted hover:text-ink transition-colors rounded-pill hover:bg-surface-sunken active:scale-95 relative"
                >
                  <Bell className="w-5 h-5" />
                  {hasNewNotifications && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-error border-2 border-canvas rounded-pill"></span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 rounded-panel border border-hairline bg-surface-overlay shadow-soft-lg p-sm z-50 max-h-96 overflow-y-auto"
                    >
                      <div className="px-sm py-xs border-b border-hairline mb-xs flex justify-between items-center">
                        <span className="font-body text-caption font-semibold text-ink">Notifications</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifications([])
                            setHasNewNotifications(false)
                          }}
                          className="text-[10px] text-primary-600 dark:text-primary-400 cursor-pointer font-semibold hover:underline bg-transparent border-0 p-0"
                        >
                          Mark read
                        </button>
                      </div>
                      
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-caption text-ink-muted">No new notifications.</div>
                      ) : (
                        <div className="space-y-1">
                          {notifications.map((notif) => {
                            let typeColor = 'bg-primary-500/10 text-primary'
                            if (notif.type === 'warning') typeColor = 'bg-warning/10 text-warning'
                            if (notif.type === 'success') typeColor = 'bg-success/10 text-success'
                            if (notif.type === 'interview') typeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400'

                            return (
 <div key={notif.id} className="p-2 hov-surface rounded-card flex items-start gap-sm transition-colors cursor-pointer">
                                <div className={`w-2 h-2 mt-1.5 rounded-pill shrink-0 ${typeColor.split(' ')[1]}`} />
                                <div className="min-w-0">
                                  <h4 className="font-body text-caption font-semibold text-ink truncate">{notif.title}</h4>
                                  <p className="text-[11px] text-ink-muted leading-tight mt-0.5">{notif.body}</p>
                                  <span className="text-[9px] text-ink-subtle block mt-1">{notif.time}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile Avatar Trigger */}
              {user && (
                <div
                  className="flex items-center gap-xs cursor-pointer select-none group"
                  onClick={() => navigate(user.role === 'admin' ? '/admin/dashboard' : '/student/profile')}
                >
                  {user.profile_picture_url ? (
                    <img
                      src={user.profile_picture_url.startsWith("http") ? user.profile_picture_url : `${api.defaults.baseURL || ""}${user.profile_picture_url}`}
                      alt="User Avatar"
                      className="w-8 h-8 rounded-card object-cover shadow-soft-xs ring-1 ring-hairline group-hover:ring-hairline-strong transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-card bg-surface-sunken border border-hairline text-ink flex items-center justify-center font-display font-bold text-xs uppercase shadow-soft-xs group-hover:border-hairline-strong transition-all">
                      {user.name ? user.name[0] : (user.email ? user.email[0] : 'U')}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </header>

        {/* --- MAIN PAGE PORTAL VIEW --- */}
        <main className="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop relative">
          <div className="max-w-container-max mx-auto h-full">
            {children}
          </div>
        </main>
      </div>

      {/* --- MOBILE DRAWER BACKDROP & DRAWER --- */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black z-40 md:hidden"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 bottom-0 left-0 w-64 bg-surface-overlay border-r border-hairline p-lg z-50 flex flex-col md:hidden shadow-soft-xl"
            >
              <div className="flex justify-between items-center mb-xl">
                <div className="flex items-center">
                  <img src="/logo.png" alt="CareerSync Logo" className="h-7 w-7 object-contain mr-sm" />
                  <span className="font-display text-title font-bold tracking-[-0.02em] text-ink">
                    CareerSync AI
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
 className="p-xs text-ink-muted hover:text-ink rounded-pill hover:bg-surface-sunken"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar min-h-0">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  const active = (location.pathname + location.search) === link.to || 
                                 (link.to.includes('?tab=') && location.pathname === link.to.split('?')[0] && location.search.includes(link.to.split('?')[1])) ||
                                 (!link.to.includes('?tab=') && (location.pathname === link.to || (link.to !== '/student/dashboard' && location.pathname.startsWith(link.to))))
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-md px-md py-3 rounded-card transition-colors duration-200 ${
                        active
                          ? 'bg-primary-600 text-white dark:bg-primary-500 font-body font-semibold shadow-soft-xs'
 : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="font-body text-sm">{link.label}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Wallet (Mobile) */}
              {user?.role === 'student' && credits && (
                <div className="rounded-card p-md mb-sm mt-md border border-hairline bg-surface-sunken">
                  <div className="flex justify-between items-center mb-xs">
                    <span className="text-overline text-ink-subtle">Credits</span>
                    <Coins className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex items-baseline gap-xs mb-xs">
                    <span className="font-display text-title font-bold text-ink">{currentCredits}</span>
                    <span className="font-body text-[11px] text-ink-subtle">/ {limitCredits}</span>
                  </div>
                  <div className="w-full bg-hairline rounded-pill h-1.5 overflow-hidden">
                    <div className={`${walletColor} h-1.5 rounded-pill`} style={{ width: `${creditPct}%` }} />
                  </div>
                </div>
              )}

              {/* Footer (Mobile) */}
              <div className="pt-md border-t border-hairline space-y-1">
                <button
                  onClick={toggleTheme}
 className="w-full flex items-center gap-md px-md py-2.5 text-ink-muted hover:bg-surface-sunken hover:text-ink rounded-card text-left"
                >
                  {theme === 'light' ? (
                    <>
                      <Moon className="w-5 h-5" />
                      <span className="font-body text-sm">Dark Theme</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-5 h-5 text-amber-500" />
                      <span className="font-body text-sm">Light Theme</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
 className="w-full flex items-center gap-md px-md py-2.5 text-rose-600 dark:text-rose-400 rounded-card text-left hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span className="font-body text-sm font-semibold">Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
