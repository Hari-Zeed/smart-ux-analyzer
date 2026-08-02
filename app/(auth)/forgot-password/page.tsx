'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BACKEND_URL } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetDone, setResetDone] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Please enter your email address.')
    setIsLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      setSent(true)
      // In dev mode, the backend returns the reset_token so we can demo the flow
      if (data.reset_token) setResetToken(data.reset_token)
    } catch {
      setError('Failed to send reset email. Please check your connection.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetError('')
    if (newPassword.length < 6) return setResetError('Password must be at least 6 characters.')
    if (newPassword !== confirmPassword) return setResetError('Passwords do not match.')
    setResetLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail ?? 'Reset failed.')
      }
      setResetDone(true)
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Reset failed.')
    } finally {
      setResetLoading(false)
    }
  }

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
            <path d="M14 2L25 8v12L14 26 3 20V8L14 2z" fill="url(#fpgrad)" />
            <path d="M10 14l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="fpgrad" x1="3" y1="2" x2="25" y2="26" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818cf8" /><stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          <span className="auth-logo-text">Smart UX</span>
        </div>

        {/* ── Step 1: Enter email ── */}
        {!sent && (
          <>
            <div className="auth-header">
              <div className="icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="auth-title">Forgot password?</h1>
              <p className="auth-subtitle">No worries! Enter your email and we&apos;ll send you a reset link.</p>
            </div>

            {error && (
              <div className="auth-error">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5" />
                  <path d="M8 5v3.5M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSendReset} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="fp-email" className="form-label">Email address</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12v8H2V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input id="fp-email" type="email" className="form-input" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </div>
              </div>
              <button id="fp-submit" type="submit" className="auth-btn-primary" disabled={isLoading}>
                {isLoading ? <span className="btn-spinner" /> : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8h12M8 2l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Send reset link
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Check inbox / enter token ── */}
        {sent && !resetDone && (
          <>
            <div className="auth-header">
              <div className="icon-circle success">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L20 7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="auth-title">Check your email</h1>
              <p className="auth-subtitle">
                We&apos;ve sent a reset link to <strong className="email-highlight">{email}</strong>.
              </p>
            </div>

            {/* Dev-mode token hint */}
            {resetToken && (
              <div className="dev-hint">
                <span className="dev-badge">DEV</span>
                <span>Token auto-filled for demo. In production, sent via email.</span>
              </div>
            )}

            {resetError && (
              <div className="auth-error">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5" />
                  <path d="M8 5v3.5M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {resetError}
              </div>
            )}

            <form onSubmit={handleReset} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="fp-token" className="form-label">Reset token</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input id="fp-token" type="text" className="form-input"
                    placeholder="Paste your reset token"
                    value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fp-newpw" className="form-label">New password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input id="fp-newpw" type="password" className="form-input"
                    placeholder="New password (min. 6 chars)"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="fp-confirm" className="form-label">Confirm new password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 8l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                  <input id="fp-confirm" type="password" className="form-input"
                    placeholder="Confirm new password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
              </div>

              <button id="fp-reset-submit" type="submit" className="auth-btn-primary" disabled={resetLoading}>
                {resetLoading ? <span className="btn-spinner" /> : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 8l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Reset password
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* ── Step 3: Done ── */}
        {resetDone && (
          <div className="success-state">
            <div className="success-icon">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="17" stroke="#22c55e" strokeWidth="2" />
                <path d="M11 18l5 5 9-9" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="auth-title" style={{ textAlign: 'center' }}>Password reset!</h1>
            <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              Your password has been updated. You can now sign in with your new password.
            </p>
            <Link href="/login" className="auth-btn-primary" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to sign in
            </Link>
          </div>
        )}

        <p className="auth-footer">
          Remembered it?{' '}
          <Link href="/login" className="form-link">Sign in</Link>
        </p>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          background: radial-gradient(ellipse at 50% 30%, #1a0533 0%, #080012 45%, #020008 100%);
          position: relative; overflow: hidden; padding: 1.5rem;
        }
        .blob { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.32;
          animation: floatBlob 12s ease-in-out infinite alternate; }
        .blob-1 { width: 400px; height: 400px;
          background: radial-gradient(circle, #7c3aed, transparent 70%); top: -80px; left: -80px; }
        .blob-2 { width: 350px; height: 350px;
          background: radial-gradient(circle, #4f46e5, transparent 70%); bottom: -60px; right: -60px; animation-delay: -4s; }
        .blob-3 { width: 250px; height: 250px;
          background: radial-gradient(circle, #a855f7, transparent 70%); top: 50%; right: 25%; animation-delay: -7s; }
        @keyframes floatBlob {
          from { transform: translate(0,0) scale(1); } to { transform: translate(20px,-20px) scale(1.08); }
        }
        .grid-overlay {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }
        .auth-card {
          position: relative; z-index: 10;
          width: 100%; max-width: 420px;
          background: rgba(15,10,30,0.75);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(139,92,246,0.2); border-radius: 20px;
          padding: 2.5rem 2rem;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(124,58,237,0.1);
          animation: slideUp 0.45s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .auth-logo { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.75rem; }
        .auth-logo-text { font-size: 1.1rem; font-weight: 700; color: #c4b5fd; }
        .icon-circle {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.25);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 1rem;
        }
        .icon-circle.success { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.25); }
        .auth-header { margin-bottom: 1.5rem; }
        .auth-title { font-size: 1.65rem; font-weight: 700; color: #f5f3ff; margin: 0 0 0.3rem; letter-spacing: -0.02em; }
        .auth-subtitle { font-size: 0.875rem; color: #9ca3af; margin: 0; line-height: 1.5; }
        .email-highlight { color: #c4b5fd; }
        .auth-error {
          display: flex; align-items: center; gap: 0.5rem;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5; border-radius: 10px;
          padding: 0.65rem 0.85rem; font-size: 0.85rem; margin-bottom: 1.25rem;
        }
        .dev-hint {
          display: flex; align-items: flex-start; gap: 0.5rem;
          background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.2);
          border-radius: 10px; padding: 0.6rem 0.8rem; font-size: 0.78rem;
          color: #fde68a; margin-bottom: 1.25rem; line-height: 1.4;
        }
        .dev-badge {
          background: rgba(234,179,8,0.2); color: #fde68a;
          border: 1px solid rgba(234,179,8,0.3);
          border-radius: 4px; padding: 1px 5px; font-size: 0.7rem; font-weight: 700;
          flex-shrink: 0; margin-top: 1px;
        }
        .auth-form { display: flex; flex-direction: column; gap: 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .form-label { font-size: 0.82rem; font-weight: 500; color: #d1d5db; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 0.85rem; color: #6b7280; pointer-events: none; z-index: 1; }
        .form-input {
          width: 100%; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(139,92,246,0.15); border-radius: 10px;
          padding: 0.7rem 0.85rem 0.7rem 2.5rem;
          font-size: 0.9rem; color: #f5f3ff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .form-input::placeholder { color: #4b5563; }
        .form-input:focus {
          border-color: #7c3aed;
          background: rgba(139,92,246,0.06);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
        }
        .input-wrapper:focus-within .input-icon { color: #a78bfa; }
        .auth-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          width: 100%; padding: 0.8rem;
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          border: none; border-radius: 10px;
          color: white; font-size: 0.92rem; font-weight: 600; cursor: pointer;
          margin-top: 0.25rem;
          transition: transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.4);
        }
        .auth-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 30px rgba(124,58,237,0.5); }
        .auth-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .success-state { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
        .success-icon { margin-bottom: 0.5rem; }
        .auth-footer { margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: #6b7280; }
        .form-link { color: #a78bfa; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .form-link:hover { color: #c4b5fd; }
      `}</style>
    </div>
  )
}
