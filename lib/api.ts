// ─────────────────────────────────────────────
// API types — mirror the FastAPI response models
// ─────────────────────────────────────────────

import { getOrCreateUserId } from './user'

export interface Suggestion {
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low'
}

export interface AnalysisResult {
  id: number
  user_id?: string
  url: string
  ux_score: number        // 0-100
  accessibility: number   // 0-100
  performance: number     // 0-100
  seo: number             // 0-100
  suggestions: Suggestion[]
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
// analyzeUrl — POST /analyze
// ─────────────────────────────────────────────

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

export async function analyzeUrl(url: string, userId?: string): Promise<AnalysisResult> {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new ApiError('Please enter a URL to analyze.')
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new ApiError('URL must start with http:// or https://')
  }

  const effectiveUserId = userId || getOrCreateUserId()

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmed, user_id: effectiveUserId }),
      signal: AbortSignal.timeout(30_000), // 30 s hard timeout
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError('Request timed out. The site may be slow or unreachable.')
    }
    throw new ApiError(
      'Cannot reach the analyzer backend. Make sure it is running on port 8000.',
    )
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new ApiError(`Server returned an unexpected response (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    const detail =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : `HTTP ${response.status}`
    throw new ApiError(detail, response.status)
  }

  return body as AnalysisResult
}
