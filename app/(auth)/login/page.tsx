'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWithGoogle, isAuthenticated, isLoading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!authLoading && isAuthenticated) router.replace('/dashboard')
  }, [authLoading, isAuthenticated, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Please enter your email address.')
    if (!password) return setError('Please enter your password.')
    setIsLoading(true)
    try {
      await login(email.trim(), password)
      router.replace('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setIsLoading(true)
    try {
      const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      // If configured, use Google OAuth Client ID
      await loginWithGoogle(
        'Demo User',
        'demo@gmail.com',
        googleClientId ?? 'google_demo_id',
        'https://ui-avatars.com/api/?name=Demo+User&background=7c3aed&color=fff',
      )
      router.replace('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google login failed.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="auth-page">
      {/* Animated background blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="blob blob-4" />

      {/* Grid overlay */}
      <div className="grid-overlay" />

      {/* Card */}
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L25 8v12L14 26 3 20V8L14 2z" fill="url(#lgrad)" />
            <path d="M10 14l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="lgrad" x1="3" y1="2" x2="25" y2="26" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818cf8" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          <span className="auth-logo-text">Smart UX</span>
        </div>

        <div className="auth-header">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to continue analyzing your UX</p>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5" />
              <path d="M8 5v3.5M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">Email address</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12v8H2V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="login-password" className="form-label">Password</label>
              <Link href="/forgot-password" className="form-link-small">Forgot password?</Link>
            </div>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                className="form-input pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((p) => !p)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M1 1l14 14M6.5 6.7A2 2 0 0110 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M4.2 4.5C2.7 5.6 1.5 7 1.5 8s2 4.5 6.5 4.5c1.4 0 2.6-.4 3.6-1M7 3.6A6.6 6.6 0 0114.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M1.5 8C1.5 8 4 3.5 8 3.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="auth-btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="btn-spinner" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sign in
              </>
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span className="divider-line" />
          <span className="divider-text">or continue with</span>
          <span className="divider-line" />
        </div>

        <button
          id="google-login"
          type="button"
          className="auth-btn-google"
          onClick={handleGoogleLogin}
          disabled={isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2a10.34 10.34 0 00-.16-1.84H9v3.48h4.84A4.14 4.14 0 0112.07 13v2.22h2.77C16.4 13.67 17.64 11.6 17.64 9.2z" fill="#4285F4" />
            <path d="M9 18c2.43 0 4.47-.8 5.96-2.18L12.19 13a5.43 5.43 0 01-3.19.89 5.4 5.4 0 01-5.08-3.72H.89v2.3A9 9 0 009 18z" fill="#34A853" />
            <path d="M3.92 10.17A5.4 5.4 0 013.63 9a5.4 5.4 0 01.29-1.17V5.53H.89A9 9 0 000 9a9 9 0 00.89 3.47l3.03-2.3z" fill="#FBBC05" />
            <path d="M9 3.58a4.86 4.86 0 013.44 1.35l2.58-2.58A8.63 8.63 0 009 0 9 9 0 00.89 5.53L3.92 7.83A5.4 5.4 0 019 3.58z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <p className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="form-link">Create account</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 20% 50%, #1a0533 0%, #080012 40%, #020008 100%);
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
        }

        /* Animated blobs */
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.35;
          animation: floatBlob 12s ease-in-out infinite alternate;
        }
        .blob-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #7c3aed, transparent 70%);
          top: -120px; left: -100px;
          animation-delay: 0s;
        }
        .blob-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #4f46e5, transparent 70%);
          bottom: -100px; right: -80px;
          animation-delay: -4s;
        }
        .blob-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #a855f7, transparent 70%);
          top: 30%; right: 20%;
          animation-delay: -7s;
        }
        .blob-4 {
          width: 200px; height: 200px;
          background: radial-gradient(circle, #3b82f6, transparent 70%);
          bottom: 20%; left: 15%;
          animation-delay: -2s;
        }
        @keyframes floatBlob {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(30px, -30px) scale(1.1); }
        }

        /* Grid overlay */
        .grid-overlay {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(139, 92, 246, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        /* Card */
        .auth-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          background: rgba(15, 10, 30, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 20px;
          padding: 2.5rem 2rem;
          box-shadow:
            0 0 0 1px rgba(139, 92, 246, 0.08),
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 80px rgba(124, 58, 237, 0.1);
          animation: slideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Logo */
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1.75rem;
        }
        .auth-logo-text {
          font-size: 1.1rem;
          font-weight: 700;
          color: #c4b5fd;
          letter-spacing: -0.01em;
        }

        /* Header */
        .auth-header { margin-bottom: 1.5rem; }
        .auth-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #f5f3ff;
          margin: 0 0 0.3rem;
          letter-spacing: -0.02em;
        }
        .auth-subtitle {
          font-size: 0.9rem;
          color: #9ca3af;
          margin: 0;
        }

        /* Error */
        .auth-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          border-radius: 10px;
          padding: 0.65rem 0.85rem;
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }

        /* Form */
        .auth-form { display: flex; flex-direction: column; gap: 1.1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.45rem; }
        .form-label-row {
          display: flex; justify-content: space-between; align-items: center;
        }
        .form-label {
          font-size: 0.82rem;
          font-weight: 500;
          color: #d1d5db;
        }
        .form-link-small {
          font-size: 0.78rem;
          color: #a78bfa;
          text-decoration: none;
          transition: color 0.2s;
        }
        .form-link-small:hover { color: #c4b5fd; }

        /* Input */
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-icon {
          position: absolute;
          left: 0.85rem;
          color: #6b7280;
          pointer-events: none;
          transition: color 0.2s;
          z-index: 1;
        }
        .form-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 10px;
          padding: 0.7rem 0.85rem 0.7rem 2.5rem;
          font-size: 0.9rem;
          color: #f5f3ff;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          -webkit-appearance: none;
        }
        .form-input::placeholder { color: #4b5563; }
        .form-input:focus {
          border-color: #7c3aed;
          background: rgba(139, 92, 246, 0.06);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }
        .form-input:focus ~ .input-icon { color: #a78bfa; }
        .input-wrapper:focus-within .input-icon { color: #a78bfa; }
        .pr-10 { padding-right: 2.8rem; }

        /* Password toggle */
        .pw-toggle {
          position: absolute; right: 0.75rem;
          background: none; border: none; cursor: pointer;
          color: #6b7280; padding: 0.2rem;
          display: flex; align-items: center;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: #a78bfa; }

        /* Primary button */
        .auth-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          width: 100%; padding: 0.8rem;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          border: none; border-radius: 10px;
          color: white; font-size: 0.92rem; font-weight: 600;
          cursor: pointer;
          margin-top: 0.25rem;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(124, 58, 237, 0.4);
          position: relative; overflow: hidden;
        }
        .auth-btn-primary::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .auth-btn-primary:hover::before { opacity: 1; }
        .auth-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 30px rgba(124, 58, 237, 0.5); }
        .auth-btn-primary:active { transform: translateY(0); }
        .auth-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* Spinner */
        .btn-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Divider */
        .auth-divider {
          display: flex; align-items: center; gap: 0.75rem;
          margin: 1.25rem 0;
        }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
        .divider-text { font-size: 0.78rem; color: #6b7280; white-space: nowrap; }

        /* Google button */
        .auth-btn-google {
          display: flex; align-items: center; justify-content: center; gap: 0.65rem;
          width: 100%; padding: 0.75rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #d1d5db; font-size: 0.9rem; font-weight: 500;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s, transform 0.15s;
        }
        .auth-btn-google:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
        }
        .auth-btn-google:active { transform: translateY(0); }
        .auth-btn-google:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* Footer */
        .auth-footer {
          margin-top: 1.5rem; text-align: center;
          font-size: 0.85rem; color: #6b7280;
        }
        .form-link { color: #a78bfa; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .form-link:hover { color: #c4b5fd; }
      `}</style>
    </div>
  )
}
