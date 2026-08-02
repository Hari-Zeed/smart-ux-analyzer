'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getOrCreateUserId } from '@/lib/user'
import { fetchBackendSettings, updateBackendSettings } from '@/lib/db-api'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  isDarkMode: boolean
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  const applyThemeClass = (newTheme: Theme) => {
    const html = document.documentElement
    if (newTheme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  useEffect(() => {
    async function loadBackendSettings() {
      const userId = getOrCreateUserId()
      const settings = await fetchBackendSettings(userId)
      const initialTheme: Theme = settings.dark_mode ? 'dark' : 'light'
      setThemeState(initialTheme)
      applyThemeClass(initialTheme)
    }
    loadBackendSettings()
  }, [])

  const setTheme = (newTheme: Theme) => {
    const userId = getOrCreateUserId()
    const isDark = newTheme === 'dark'
    setThemeState(newTheme)
    applyThemeClass(newTheme)
    updateBackendSettings(userId, { dark_mode: isDark })
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }

  const isDarkMode = theme === 'dark'

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
