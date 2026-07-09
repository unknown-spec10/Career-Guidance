import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, User, Users, Sparkles, BookOpen, Briefcase, LogOut,
  Menu, X, Bell, Sun, Moon, Coins, ChevronRight, ChevronLeft, Shield, Activity,
  ClipboardList, Network, BarChart3, Search, UserCheck, FileCheck
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'

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
      try {
        const response = await api.get('/api/credits/balance')
        setCredits(response.data)
      } catch (err) {
        console.error('Error fetching credits in layout:', err)
      }
    }

    fetchCredits()
    const interval = setInterval(fetchCredits, 30000)
    return () => clearInterval(interval)
  }, [navigate])

  // Generate dynamic notifications based on user data
  useEffect(() => {
    if (!user) return

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
          { to: '/student/network', label: 'Mentorship Hub', icon: Network },
          { to: '/student/intelligence', label: 'AI Guru', icon: Shield },
          { to: '/student/profile', label: 'Profile Settings', icon: User }
        ]
      case 'employer':
        return [
          { to: '/employer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/employer/post-job', label: 'Post a New Job', icon: Sparkles },
          { to: '/employer/talent-pool', label: 'Talent Pool', icon: Search },
          { to: '/employer/analytics', label: 'Analytics', icon: BarChart3 },
          { to: '/employer/profile', label: 'Company Settings', icon: User }
        ]
      case 'admin':
        return [
          { to: '/admin/dashboard?tab=overview', label: 'Admin Hub', icon: LayoutDashboard },
          { to: '/admin/dashboard?tab=all-jobs', label: 'Manage Jobs', icon: Briefcase },
          { to: '/admin/moderation', label: 'Job Moderation', icon: FileCheck },
          { to: '/admin/users', label: 'User Management', icon: UserCheck },
          { to: '/admin/dashboard?tab=resume-reviews', label: 'Resume Reviews', icon: Shield },
          { to: '/admin/dashboard?tab=system-health', label: 'System Health', icon: Activity }
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
    <div className="flex h-screen w-screen overflow-hidden bg-surface-muted dark:bg-inverse-surface text-on-surface dark:text-inverse-on-surface font-body-base">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className={`hidden md:flex flex-col h-screen bg-surface-container dark:bg-inverse-surface border-r border-border-subtle dark:border-outline-variant flex-shrink-0 z-30 transition-all duration-300 ${collapsed ? 'w-20 p-md' : 'w-64 p-lg'}`}>
        
        {/* Brand Header */}
        <div className={`mb-xl flex items-center px-xs ${collapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
          <div className="flex items-center min-w-0">
            <img src="/logo.png" alt="CareerSync Logo" className="h-7 w-7 object-contain shrink-0" />
            <span className={`text-headline-md font-headline-md font-extrabold text-primary dark:text-primary-fixed-dim ml-sm truncate transition-all duration-300 origin-left overflow-hidden ${collapsed ? 'max-w-0 opacity-0 scale-x-0 ml-0 pointer-events-none' : 'max-w-[200px] opacity-100 scale-x-100'}`}>
              CareerSync AI
            </span>
          </div>
          <button
            onClick={toggleCollapse}
            className="relative group/toggle p-1 rounded-lg hover:bg-surface-container-high dark:hover:bg-surface-variant/20 text-on-surface-variant dark:text-surface-variant hover:text-on-surface transition-all active:scale-95 duration-150 shrink-0 mt-1"
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm bg-neutral-900 dark:bg-slate-800 text-white dark:text-inverse-on-surface text-metadata rounded-md shadow-xl opacity-0 group-hover/toggle:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Expand Sidebar
              </div>
            )}
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className={`flex items-center mb-lg bg-surface-container-low dark:bg-inverse-surface/10 rounded-xl border border-border-subtle dark:border-outline-variant/30 transition-all duration-300 ${collapsed ? 'justify-center p-2' : 'p-sm'}`}>
            <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold font-display-lg uppercase shadow-sm shrink-0">
              {user.name ? user.name[0] : (user.email ? user.email[0] : 'U')}
            </div>
            <div className={`min-w-0 transition-all duration-300 overflow-hidden ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-sm'}`}>
              <p className="font-body-bold text-[14px] text-on-surface dark:text-inverse-on-surface truncate">{user.name || 'Alex Chen'}</p>
              <p className="font-metadata text-[11px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider truncate">{user.role}</p>
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
                className={`relative group flex items-center py-3 rounded-xl transition-all duration-200 active:translate-x-1 min-w-0 ${
                  active
                    ? 'bg-primary-container dark:bg-primary-container text-white dark:text-on-primary-container font-body-bold shadow-md shadow-primary-500/10'
                    : 'text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant/20 hover:text-on-surface'
                } ${collapsed ? 'justify-center px-0' : 'px-md'}`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`text-[14px] transition-all duration-300 overflow-hidden whitespace-nowrap truncate ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-none opacity-100 ml-md'}`}>
                  {link.label}
                </span>
                {collapsed && (
                  <div className="absolute left-full ml-sm px-md py-sm bg-neutral-900 dark:bg-slate-800 text-white dark:text-inverse-on-surface text-metadata rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {link.label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Wallet */}
        {user?.role === 'student' && credits && (
          <div className={`relative group/wallet glass-panel dark:bg-surface-variant/10 rounded-xl mb-sm mt-md border border-border-subtle dark:border-outline-variant/30 shadow-[0_4px_12px_rgba(0,0,0,0.01)] transition-all duration-300 ${collapsed ? 'p-2 flex flex-col items-center gap-1.5' : 'p-md'}`}>
            <div className="flex justify-between items-center mb-xs w-full">
              {!collapsed && <span className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">AI Credits</span>}
              <Coins className={`h-4 w-4 text-warning ${collapsed ? 'mx-auto' : ''}`} />
            </div>
            {collapsed ? (
              <div className="text-[11px] font-bold text-on-surface dark:text-inverse-on-surface text-center">
                {currentCredits}
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-xs mb-xs">
                  <span className="font-label-caps text-headline-md text-on-surface dark:text-inverse-on-surface">{currentCredits}</span>
                  <span className="font-metadata text-[11px] text-on-surface-variant dark:text-surface-variant">/ {limitCredits}</span>
                </div>
                <div className="w-full bg-surface-container-highest dark:bg-surface-variant rounded-full h-1.5 mb-sm overflow-hidden">
                  <div className={`${walletColor} h-1.5 rounded-full`} style={{ width: `${creditPct}%` }} />
                </div>
                <Link
                  to="/dashboard/upgrade"
                  className="btn-secondary-sm block w-full py-1.5 text-center text-[11px] font-body-bold rounded-lg cursor-pointer"
                >
                  Refill Quota
                </Link>
              </>
            )}
            
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm bg-neutral-900 dark:bg-slate-800 text-white dark:text-inverse-on-surface text-metadata rounded-md shadow-xl opacity-0 group-hover/wallet:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Credits: {currentCredits} / {limitCredits}
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-md border-t border-border-subtle dark:border-outline-variant/40 space-y-1">
          <button
            onClick={toggleTheme}
            className={`relative group/theme w-full flex items-center py-2.5 text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant/20 hover:text-on-surface rounded-xl transition-all text-left ${collapsed ? 'justify-center px-0' : 'px-md'}`}
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-5 h-5 shrink-0" />
                <span className={`text-[14px] transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-md'}`}>
                  Dark Theme
                </span>
              </>
            ) : (
              <>
                <Sun className="w-5 h-5 text-amber-500 shrink-0" />
                <span className={`text-[14px] transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-md'}`}>
                  Light Theme
                </span>
              </>
            )}
            
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm bg-neutral-900 dark:bg-slate-800 text-white dark:text-inverse-on-surface text-metadata rounded-md shadow-xl opacity-0 group-hover/theme:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {theme === 'light' ? 'Dark Theme' : 'Light Theme'}
              </div>
            )}
          </button>
          
          <button
            onClick={handleLogout}
            className={`relative group/logout w-full flex items-center py-2.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all text-left ${collapsed ? 'justify-center px-0' : 'px-md'}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={`text-[14px] font-body-bold transition-all duration-300 overflow-hidden whitespace-nowrap ${collapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[150px] opacity-100 ml-md'}`}>
              Logout
            </span>
            
            {collapsed && (
              <div className="absolute left-full ml-sm px-md py-sm bg-neutral-900 dark:bg-slate-800 text-white dark:text-inverse-on-surface text-metadata rounded-md shadow-xl opacity-0 group-hover/logout:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                Logout
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* --- MAIN PORT --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background dark:bg-inverse-surface/30">
        
        {/* --- TOP HEADER --- */}
        <header className="bg-surface-container-lowest dark:bg-inverse-surface border-b border-border-subtle dark:border-outline-variant/40 h-16 flex-shrink-0 flex items-center px-margin-desktop z-20 shadow-sm transition-all duration-300">
          <div className="w-full max-w-container-max mx-auto flex justify-between items-center">
            
            {/* Left Header - Mobile menu trigger */}
            <div className="flex items-center gap-md">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-sm hover:bg-surface-container dark:hover:bg-surface-variant/40 rounded-full active:scale-95 text-on-surface transition-transform"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-body-bold font-body-bold text-on-surface dark:text-inverse-on-surface capitalize">
                {location.pathname.split('/').pop().replace('-', ' ')} Portal
              </h2>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-md">
              
              {/* Upgrade Trigger */}
              {user?.role === 'student' && (
                <Link
                  to="/dashboard/upgrade"
                  className="hidden sm:inline-flex items-center px-3 py-1.5 bg-primary-container text-white dark:text-on-primary-container rounded-lg font-body-bold text-xs hover:bg-primary shadow-sm active:scale-95 duration-150 transition-all"
                >
                  Upgrade Pro
                </Link>
              )}

              {/* Theme toggle (Top navigation fallback for mobile) */}
              <button
                onClick={toggleTheme}
                className="p-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim transition-colors rounded-full hover:bg-surface-container dark:hover:bg-surface-variant/30 active:scale-95 md:hidden"
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
                  className="p-sm text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim transition-colors rounded-full hover:bg-surface-container dark:hover:bg-surface-variant/30 active:scale-95 relative"
                >
                  <Bell className="w-5 h-5" />
                  {hasNewNotifications && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-error border-2 border-white dark:border-inverse-surface rounded-full"></span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 rounded-2xl border border-border-subtle dark:border-outline-variant bg-white dark:bg-inverse-surface shadow-2xl p-sm z-50 max-h-96 overflow-y-auto"
                    >
                      <div className="px-sm py-xs border-b border-border-subtle dark:border-outline-variant/40 mb-xs flex justify-between items-center">
                        <span className="font-body-bold text-[13px] text-on-surface dark:text-inverse-on-surface">Notifications</span>
                        <span className="text-[10px] text-primary dark:text-primary-fixed-dim cursor-pointer font-semibold hover:underline">Mark read</span>
                      </div>
                      
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-on-surface-variant">No new notifications.</div>
                      ) : (
                        <div className="space-y-1">
                          {notifications.map((notif) => {
                            let typeColor = 'bg-primary/10 text-primary dark:text-primary-fixed-dim'
                            if (notif.type === 'warning') typeColor = 'bg-warning/10 text-warning'
                            if (notif.type === 'success') typeColor = 'bg-success/10 text-success'
                            if (notif.type === 'interview') typeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400'

                            return (
                              <div key={notif.id} className="p-2 hover:bg-surface-container-low dark:hover:bg-surface-variant/20 rounded-lg flex items-start gap-sm transition-colors cursor-pointer">
                                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${typeColor.split(' ')[1]}`} />
                                <div className="min-w-0">
                                  <h4 className="font-body-bold text-[12px] text-on-surface dark:text-inverse-on-surface truncate">{notif.title}</h4>
                                  <p className="text-[11px] text-on-surface-variant dark:text-surface-variant leading-tight mt-0.5">{notif.body}</p>
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-1">{notif.time}</span>
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
                <div className="flex items-center gap-xs cursor-pointer select-none group" onClick={() => navigate(user.role === 'student' ? '/student/profile' : '/employer/profile')}>
                  <div className="w-8 h-8 rounded-lg bg-secondary-container dark:bg-surface-variant text-on-secondary-container dark:text-surface-variant flex items-center justify-center font-bold text-xs uppercase shadow-sm group-hover:ring-2 group-hover:ring-primary/20 transition-all">
                    {user.name ? user.name[0] : (user.email ? user.email[0] : 'U')}
                  </div>
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
              className="fixed top-0 bottom-0 left-0 w-64 bg-surface-container dark:bg-inverse-surface p-lg z-50 flex flex-col md:hidden shadow-2xl"
            >
              <div className="flex justify-between items-center mb-xl">
                <div className="flex items-center">
                  <img src="/logo.png" alt="CareerSync Logo" className="h-7 w-7 object-contain mr-sm" />
                  <span className="text-body-bold font-display-lg font-bold text-primary dark:text-primary-fixed-dim">
                    CareerSync AI
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-xs text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container-high"
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
                      className={`flex items-center gap-md px-md py-3 rounded-xl transition-all duration-200 ${
                        active
                          ? 'bg-primary-container dark:bg-primary-container text-white dark:text-on-primary-container font-body-bold shadow-md shadow-primary-500/10'
                          : 'text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant/20'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-[14px]">{link.label}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Wallet (Mobile) */}
              {user?.role === 'student' && credits && (
                <div className="glass-panel dark:bg-surface-variant/10 rounded-xl p-md mb-sm mt-md border border-border-subtle dark:border-outline-variant/30">
                  <div className="flex justify-between items-center mb-xs">
                    <span className="font-label-caps text-[10px] text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Credits</span>
                    <Coins className="h-4 w-4 text-warning" />
                  </div>
                  <div className="flex items-baseline gap-xs mb-xs">
                    <span className="font-label-caps text-headline-md text-on-surface dark:text-inverse-on-surface">{currentCredits}</span>
                    <span className="font-metadata text-[11px] text-on-surface-variant dark:text-surface-variant">/ {limitCredits}</span>
                  </div>
                  <div className="w-full bg-surface-container-highest dark:bg-surface-variant rounded-full h-1.5 overflow-hidden">
                    <div className={`${walletColor} h-1.5 rounded-full`} style={{ width: `${creditPct}%` }} />
                  </div>
                </div>
              )}

              {/* Footer (Mobile) */}
              <div className="pt-md border-t border-border-subtle dark:border-outline-variant/40 space-y-1">
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-md px-md py-2.5 text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-high rounded-xl text-left"
                >
                  {theme === 'light' ? (
                    <>
                      <Moon className="w-5 h-5" />
                      <span className="text-[14px]">Dark Theme</span>
                    </>
                  ) : (
                    <>
                      <Sun className="w-5 h-5 text-amber-500" />
                      <span className="text-[14px]">Light Theme</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                  className="w-full flex items-center gap-md px-md py-2.5 text-rose-500 dark:text-rose-400 hover:bg-rose-50 rounded-xl text-left"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span className="text-[14px] font-body-bold">Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}
