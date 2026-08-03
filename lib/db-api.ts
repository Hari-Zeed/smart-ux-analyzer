import { getBackendUrl, ApiError, AnalysisResult } from './api'

export interface UserProfileResponse {
  id: string
  name: string
  email: string
  phone: string
  created_at: string
}

export interface UserStats {
  total_analyses: number
  avg_ux: number
  avg_accessibility: number
  avg_performance: number
  avg_seo: number
}

// ─────────────────────────────────────────────
// Reports API
// ─────────────────────────────────────────────

export async function fetchReports(userId?: string): Promise<AnalysisResult[]> {
  const baseUrl = getBackendUrl()
  const url = new URL(`${baseUrl}/reports`)
  if (userId) {
    url.searchParams.append('user_id', userId)
  }

  console.log(`[DB API Debug] Fetching reports from: ${url.toString()}`)
  try {
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to fetch reports:', err)
    return []
  }
}

export async function fetchReportById(id: number | string): Promise<AnalysisResult | null> {
  const url = `${getBackendUrl()}/reports/${id}`
  console.log(`[DB API Debug] Fetching report #${id} from ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error(`Failed to fetch report ${id}:`, err)
    return null
  }
}

export async function deleteReport(id: number): Promise<boolean> {
  const url = `${getBackendUrl()}/reports/${id}`
  console.log(`[DB API Debug] Deleting report #${id} at ${url}`)
  try {
    const res = await fetch(url, {
      method: 'DELETE',
    })
    return res.ok
  } catch (err) {
    console.error(`Failed to delete report ${id}:`, err)
    return false
  }
}

export function getReportPdfUrl(id: number): string {
  return `${getBackendUrl()}/reports/${id}/pdf`
}

export async function downloadReportPdf(id: number, filename?: string): Promise<void> {
  const pdfUrl = getReportPdfUrl(id)
  console.log(`[DB API Debug] Downloading PDF from ${pdfUrl}`)
  try {
    const res = await fetch(pdfUrl)
    if (!res.ok) throw new Error(`PDF download failed (HTTP ${res.status})`)

    const blob = await res.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = filename || `ux-report-${id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(downloadUrl)
  } catch (err) {
    console.error('PDF download error:', err)
    throw new ApiError('Failed to download PDF report.')
  }
}

// ─────────────────────────────────────────────
// Profile & Stats API
// ─────────────────────────────────────────────

export async function syncUserProfileToBackend(
  userId: string,
  data: { name: string; email: string; phone: string }
): Promise<UserProfileResponse | null> {
  const url = `${getBackendUrl()}/profile/${userId}`
  console.log(`[DB API Debug] Syncing profile to ${url}`, data)
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    console.error('Failed to sync profile to backend:', err)
    return null
  }
}

export async function fetchUserStats(userId: string): Promise<UserStats> {
  const url = `${getBackendUrl()}/stats/${userId}`
  console.log(`[DB API Debug] Fetching stats from ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error()
    return await res.json()
  } catch {
    return {
      total_analyses: 0,
      avg_ux: 0,
      avg_accessibility: 0,
      avg_performance: 0,
      avg_seo: 0,
    }
  }
}

// ─────────────────────────────────────────────
// User Settings API (Backend DB Driven)
// ─────────────────────────────────────────────

export interface UserSettingsResponse {
  user_id: string
  dark_mode: boolean
  auto_analysis: boolean
  data_sharing: boolean
}

export async function fetchBackendSettings(userId: string): Promise<UserSettingsResponse> {
  const url = `${getBackendUrl()}/settings/${userId}`
  console.log(`[DB API Debug] Fetching settings from ${url}`)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to fetch settings from backend:', err)
    return { user_id: userId, dark_mode: true, auto_analysis: false, data_sharing: false }
  }
}

export async function updateBackendSettings(
  userId: string,
  settings: { dark_mode?: boolean; auto_analysis?: boolean; data_sharing?: boolean }
): Promise<UserSettingsResponse> {
  const url = `${getBackendUrl()}/settings/update`
  try {
    const current = await fetchBackendSettings(userId)
    const payload = {
      user_id: userId,
      dark_mode: settings.dark_mode ?? current.dark_mode,
      auto_analysis: settings.auto_analysis ?? current.auto_analysis,
      data_sharing: settings.data_sharing ?? current.data_sharing,
    }

    console.log(`[DB API Debug] Updating settings at ${url}`, payload)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to update settings on backend:', err)
    return {
      user_id: userId,
      dark_mode: settings.dark_mode ?? true,
      auto_analysis: settings.auto_analysis ?? false,
      data_sharing: settings.data_sharing ?? false,
    }
  }
}
