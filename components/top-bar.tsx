'use client'

import { Search, Bell, Settings, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'

export function TopBar() {
  const { isDarkMode, toggleTheme } = useTheme()

  return (
    <div className="h-16 border-b border-border bg-card/50 backdrop-blur-sm px-6 flex items-center justify-between glass">
      {/* Search Bar */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search analyses..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground hover:bg-sidebar-accent w-10 h-10 relative transition-all hover:scale-110"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-foreground hover:bg-sidebar-accent w-10 h-10 transition-all hover:scale-110"
          title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
          id="theme-toggle-btn"
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </Button>

        {/* Settings */}
        <Link href="/settings">
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-sidebar-accent w-10 h-10 transition-all hover:scale-110"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  )
}
