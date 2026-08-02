'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

export default function SignupPage() {
  const router = useRouter()
  const { register, isAuthenticated, isLoading: authLoading } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
    if (!name.trim()) return setError('Please enter your full name.')
    if (!email.trim()) return setError('Please enter your email address.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setIsLoading(true)
    try {
      await register(name.trim(), email.trim(), password)
      router.replace('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="auth-page">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="grid-overlay" />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L25 8v12L14 26 3 20V8L14 2z" fill="url(#sgrad)" />
            <path d="M10 14l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="sgrad" x1="3" y1="2" x2="25" y2="26" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818cf8" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          <span className="auth-logo-text">Smart UX</span>
        </div>

        <div className="auth-header">
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Start your UX analysis journey today</p>
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
            <label htmlFor="signup-name" className="form-label">Full name</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 13c0-3 2-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input id="signup-name" type="text" className="form-input" placeholder="John Smith"
                value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-email" className="form-label">Email address</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12v8H2V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input id="signup-email" type="email" className="form-input" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-password" className="form-label">Password</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input id="signup-password" type={showPw ? 'text' : 'password'} className="form-input pr-10"
                placeholder="At least 6 characters" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((p) => !p)}>
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
            {/* Password strength meter */}
            {password.length > 0 && (
              <div className="pw-strength">
                <div className={`pw-bar ${password.length >= 10 ? 'strong' : password.length >= 6 ? 'medium' : 'weak'}`} />
                <span className="pw-label">
                  {password.length >= 10 ? 'Strong' : password.length >= 6 ? 'Medium' : 'Weak'}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="signup-confirm" className="form-label">Confirm password</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              <input id="signup-confirm" type={showPw ? 'text' : 'password'} className="form-input"
                placeholder="Re-enter password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>
          </div>

          <button id="signup-submit" type="submit" className="auth-btn-primary" disabled={isLoading}>
            {isLoading ? <span className="btn-spinner" /> : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v12M2 8h12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Create account
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link href="/login" className="form-link">Sign in</Link>
        </p>

        <p className="auth-terms">
          By creating an account, you agree to our{' '}
          <span className="terms-link">Terms of Service</span> and{' '}
          <span className="terms-link">Privacy Policy</span>.
        </p>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 70% 20%, #1a0533 0%, #080012 40%, #020008 100%);
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
        }
        .blob {
          position: absolute; border-radius: 50%;
          filter: blur(80px); opacity: 0.35;
          animation: floatBlob 12s ease-in-out infinite alternate;
        }
        .blob-1 {
          width: 450px; height: 450px;
          background: radial-gradient(circle, #4f46e5, transparent 70%);
          top: -100px; right: -80px; animation-delay: 0s;
        }
        .blob-2 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, #7c3aed, transparent 70%);
          bottom: -80px; left: -60px; animation-delay: -5s;
        }
        .blob-3 {
          width: 250px; height: 250px;
          background: radial-gradient(circle, #a855f7, transparent 70%);
          top: 40%; left: 20%; animation-delay: -3s;
        }
        @keyframes floatBlob {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(25px, -25px) scale(1.08); }
        }
        .grid-overlay {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(139, 92, 246, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
        .auth-card {
          position: relative; z-index: 10;
          width: 100%; max-width: 420px;
          background: rgba(15, 10, 30, 0.75);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 20px;
          padding: 2.25rem 2rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 80px rgba(124, 58, 237, 0.1);
          animation: slideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .auth-logo { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.5rem; }
        .auth-logo-text { font-size: 1.1rem; font-weight: 700; color: #c4b5fd; }
        .auth-header { margin-bottom: 1.25rem; }
        .auth-title { font-size: 1.65rem; font-weight: 700; color: #f5f3ff; margin: 0 0 0.25rem; letter-spacing: -0.02em; }
        .auth-subtitle { font-size: 0.88rem; color: #9ca3af; margin: 0; }
        .auth-error {
          display: flex; align-items: center; gap: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5; border-radius: 10px;
          padding: 0.65rem 0.85rem; font-size: 0.85rem;
          margin-bottom: 1rem;
        }
        .auth-form { display: flex; flex-direction: column; gap: 0.9rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label { font-size: 0.82rem; font-weight: 500; color: #d1d5db; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 0.85rem; color: #6b7280; pointer-events: none; z-index: 1; transition: color 0.2s; }
        .form-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(139,92,246,0.15);
          border-radius: 10px;
          padding: 0.65rem 0.85rem 0.65rem 2.5rem;
          font-size: 0.88rem; color: #f5f3ff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .form-input::placeholder { color: #4b5563; }
        .form-input:focus {
          border-color: #7c3aed;
          background: rgba(139,92,246,0.06);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
        }
        .input-wrapper:focus-within .input-icon { color: #a78bfa; }
        .pr-10 { padding-right: 2.8rem; }
        .pw-toggle {
          position: absolute; right: 0.75rem;
          background: none; border: none; cursor: pointer;
          color: #6b7280; padding: 0.2rem;
          display: flex; align-items: center;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: #a78bfa; }
        /* Password strength */
        .pw-strength { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.3rem; }
        .pw-bar {
          height: 3px; border-radius: 99px; transition: width 0.3s, background 0.3s;
          background: #ef4444; width: 30%;
        }
        .pw-bar.medium { background: #f59e0b; width: 60%; }
        .pw-bar.strong { background: #22c55e; width: 100%; }
        .pw-label { font-size: 0.72rem; color: #6b7280; }
        /* Buttons */
        .auth-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          width: 100%; padding: 0.78rem;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          border: none; border-radius: 10px;
          color: white; font-size: 0.92rem; font-weight: 600; cursor: pointer;
          margin-top: 0.1rem;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.4);
        }
        .auth-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 30px rgba(124,58,237,0.5); }
        .auth-btn-primary:active { transform: translateY(0); }
        .auth-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-footer { margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: #6b7280; }
        .form-link { color: #a78bfa; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .form-link:hover { color: #c4b5fd; }
        .auth-terms { margin-top: 0.75rem; text-align: center; font-size: 0.75rem; color: #4b5563; }
        .terms-link { color: #7c3aed; cursor: pointer; }
        .terms-link:hover { color: #a78bfa; }
      `}</style>
    </div>
  )
}
