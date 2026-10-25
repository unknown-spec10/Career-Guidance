import { useState, useEffect, useCallback } from 'react'

/**
 * Shared light/dark theme state synced with localStorage + documentElement.
 * Dedupe of 4 identical theme blocks in LoginPage, RegisterPage, Navbar
 * and DashboardLayout (~15 lines each).
 */
export const useTheme = (defaultTheme = 'light') => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || defaultTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, setTheme, toggleTheme }
}

export default useTheme
