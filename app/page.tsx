'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export default function RootPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  // Brief splash while auth resolves
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% 50%, #1a0533 0%, #080012 50%, #020008 100%)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #818cf8, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(124,58,237,0.4)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L25 8v12L14 26 3 20V8L14 2z" fill="rgba(255,255,255,0.9)" />
            <path d="M10 14l3 3 5-6" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Loading Smart UX…</p>
      </div>
    </div>
  )
}
