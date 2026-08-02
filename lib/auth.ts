import { BACKEND_URL } from './api'

export interface AuthUser {
  id: number
  name: string
  email: string
  profile_image?: string | null
  created_at: string
}

const TOKEN_KEY = 'ux_auth_token'
const USER_KEY  = 'ux_auth_user'

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function cacheUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

// ─── Auth API calls ───────────────────────────────────────────────────────────

async function authFetch(path: string, body: unknown) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? data.detail ?? 'Request failed')
  return data
}

export async function apiRegister(name: string, email: string, password: string): Promise<AuthUser> {
  const data = await authFetch('/auth/register', { name, email, password })
  setToken(data.access_token)
  cacheUser(data.user)
  return data.user
}

export async function apiLogin(email: string, password: string): Promise<AuthUser> {
  const data = await authFetch('/auth/login', { email, password })
  setToken(data.access_token)
  cacheUser(data.user)
  return data.user
}

export async function apiSocialLogin(name: string, email: string, googleId?: string, profileImage?: string): Promise<AuthUser> {
  const data = await authFetch('/auth/social-login', {
    name, email, google_id: googleId, profile_image: profileImage,
  })
  setToken(data.access_token)
  cacheUser(data.user)
  return data.user
}

export async function apiGetMe(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const user = await res.json()
    cacheUser(user)
    return user
  } catch {
    return null
  }
}

export async function apiForgotPassword(email: string): Promise<string> {
  const data = await authFetch('/auth/forgot-password', { email })
  return data.message
}

export async function apiResetPassword(token: string, newPassword: string): Promise<string> {
  const data = await authFetch('/auth/reset-password', { token, new_password: newPassword })
  return data.message
}
