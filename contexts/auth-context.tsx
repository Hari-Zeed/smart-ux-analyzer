'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  AuthUser,
  apiGetMe,
  apiLogin,
  apiRegister,
  apiSocialLogin,
  clearAuth,
  getCachedUser,
  getToken,
} from '@/lib/auth'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (name: string, email: string, googleId?: string, profileImage?: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: verify token and hydrate user
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    // Use cached user immediately to avoid flicker
    const cached = getCachedUser()
    if (cached) setUser(cached)

    // Then validate with server
    apiGetMe()
      .then((freshUser) => {
        if (freshUser) {
          setUser(freshUser)
        } else {
          // Token invalid — clear
          clearAuth()
          setUser(null)
        }
      })
      .catch(() => {
        clearAuth()
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password)
    setUser(u)
  }, [])

  const loginWithGoogle = useCallback(
    async (name: string, email: string, googleId?: string, profileImage?: string) => {
      const u = await apiSocialLogin(name, email, googleId, profileImage)
      setUser(u)
    },
    [],
  )

  const register = useCallback(async (name: string, email: string, password: string) => {
    const u = await apiRegister(name, email, password)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const u = await apiGetMe()
    if (u) setUser(u)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
