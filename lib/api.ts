// ─────────────────────────────────────────────
// API types — mirror the FastAPI response models
// ─────────────────────────────────────────────

import { getOrCreateUserId } from './user'

export interface Suggestion {
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low'
}

export interface CoreWebVitals {
  lcp?: string | null
  fcp?: string | null
  cls?: string | null
  tbt?: string | null
  ttfb?: string | null
  speed_index?: string | null
}

export interface AnalysisResult {
  id: number
  user_id?: string
  url: string
  ux_score: number        // 0-100
  accessibility: number   // 0-100
  performance: number     // 0-100
  seo: number             // 0-100
  core_web_vitals?: CoreWebVitals
  suggestions: Suggestion[]
  data_source?: string
  created_at: string
}

// ─────────────────────────────────────────────
// Error class so callers can distinguish API
// errors from unexpected network failures
// ─────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─────────────────────────────────────────────
// Get dynamic backend URL strictly from NEXT_PUBLIC_API_URL
// ─────────────────────────────────────────────

export function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is not set")
  }
  return url.replace(/\/+$/, '')
}

export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')
  : ''

if (typeof window !== 'undefined') {
  console.log("Backend URL:", BACKEND_URL || "NOT SET (NEXT_PUBLIC_API_URL is missing)")
}

// ─────────────────────────────────────────────
// analyzeUrl — POST /analyze
// ─────────────────────────────────────────────

export async function analyzeUrl(url: string, userId?: string): Promise<AnalysisResult> {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new ApiError('Please enter a URL to analyze.')
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new ApiError('URL must start with http:// or https://')
  }

  const effectiveUserId = userId || getOrCreateUserId()
  const backendBase = getBackendUrl()
  const targetEndpoint = `${backendBase}/analyze`

  console.log(`[UX Analyzer API] Initiating POST request to: ${targetEndpoint}`, {
    url: trimmed,
    user_id: effectiveUserId,
  })

  // 45-second timeout controller (Render cold-starts + PageSpeed API)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45_000)

  let response: Response
  try {
    response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ url: trimmed, user_id: effectiveUserId }),
      signal: controller.signal,
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    console.error('[UX Analyzer API Error] Fetch request failed:', err)

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        'Request timed out (45s). The target website or Render backend server is taking too long to respond.',
      )
    }
    if (err instanceof Error && err.message === 'NEXT_PUBLIC_API_URL is not set') {
      throw new ApiError('NEXT_PUBLIC_API_URL is not configured in environment variables.')
    }
    throw new ApiError(
      `Cannot connect to analyzer backend (${backendBase}). Please verify the backend service is running and CORS is enabled.`,
    )
  } finally {
    clearTimeout(timeoutId)
  }

  console.log(`[UX Analyzer API Debug] Response Status: ${response.status} ${response.statusText}`)

  let body: unknown
  try {
    body = await response.json()
  } catch (parseErr) {
    console.error('[UX Analyzer API Error] Failed to parse JSON response:', parseErr)
    throw new ApiError(`Server returned an invalid non-JSON response (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    const detail =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : typeof body === 'object' && body !== null && 'detail' in body
        ? String((body as Record<string, unknown>).detail)
        : `HTTP ${response.status}`
    console.error(`[UX Analyzer API Error] Backend returned HTTP ${response.status}:`, detail)
    throw new ApiError(detail, response.status)
  }

  return body as AnalysisResult
}
