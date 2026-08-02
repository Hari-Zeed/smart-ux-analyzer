'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, LayoutDashboard, Sparkles, BarChart3, Clock, Settings, LogOut, User } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  // Derive initials from user name
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/analyze',   label: 'Analyze',   icon: Sparkles },
    { href: '/reports',   label: 'Reports',   icon: BarChart3 },
    { href: '/history',   label: 'History',   icon: Clock },
    { href: '/profile',   label: 'Profile',   icon: User },
    { href: '/settings',  label: 'Settings',  icon: Settings },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <aside
      className={`h-screen flex flex-col transition-all duration-300 flex-shrink-0 ${
        isOpen ? 'w-64' : 'w-20'
      } bg-sidebar border-r border-border z-30`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-6 border-b border-border">
        {isOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-white">UX</span>
            </div>
            <span className="font-semibold text-sm text-foreground truncate">Smart Analyzer</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 w-8 ml-auto text-foreground hover:bg-sidebar-accent flex-shrink-0"
        >
          {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                active
                  ? 'bg-sidebar-accent text-primary font-semibold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span className="text-sm font-medium truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-border space-y-2">
        <Link
          href="/profile"
          className="flex items-center gap-3 px-3 py-2 text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors"
        >
          {user?.profile_image ? (
            <img
              src={user.profile_image}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-primary/30"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow">
              {initials}
            </div>
          )}
          {isOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-foreground">
                {user?.name ?? 'Loading…'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user?.email ?? ''}
              </p>
            </div>
          )}
        </Link>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-sidebar-foreground hover:bg-red-500/10 hover:text-red-400"
          size="sm"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {isOpen && <span className="ml-2 text-xs">Logout</span>}
        </Button>
      </div>
    </aside>
  )
}
