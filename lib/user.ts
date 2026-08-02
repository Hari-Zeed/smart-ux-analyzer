// ─────────────────────────────────────────────
// Local User Management Helper
// Stores user ID and profile data in localStorage
// ─────────────────────────────────────────────

export interface UserProfileData {
  id: string
  name: string
  email: string
  phone: string
}

const USER_KEY = 'smart_ux_user_profile'

export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'guest'
  
  let profileStr = localStorage.getItem(USER_KEY)
  if (profileStr) {
    try {
      const parsed = JSON.parse(profileStr)
      if (parsed.id) return parsed.id
    } catch {
      // ignore
    }
  }

  // Create new user profile ID
  const newId = 'usr_' + Math.random().toString(36).substring(2, 11)
  const defaultProfile: UserProfileData = {
    id: newId,
    name: 'Hari Kumar',
    email: 'hari@example.com',
    phone: '+1 (555) 234-5678',
  }
  localStorage.setItem(USER_KEY, JSON.stringify(defaultProfile))
  return newId
}

export function getUserProfile(): UserProfileData {
  if (typeof window === 'undefined') {
    return { id: 'guest', name: 'Guest User', email: 'guest@example.com', phone: '' }
  }

  const profileStr = localStorage.getItem(USER_KEY)
  if (profileStr) {
    try {
      return JSON.parse(profileStr)
    } catch {
      // ignore
    }
  }

  const id = getOrCreateUserId()
  const defaultProfile: UserProfileData = {
    id,
    name: 'Hari Kumar',
    email: 'hari@example.com',
    phone: '+1 (555) 234-5678',
  }
  localStorage.setItem(USER_KEY, JSON.stringify(defaultProfile))
  return defaultProfile
}

export function saveUserProfile(data: Partial<UserProfileData>): UserProfileData {
  const current = getUserProfile()
  const updated: UserProfileData = {
    ...current,
    ...data,
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
    // Dispatch custom event so Sidebar/TopBar can react if needed
    window.dispatchEvent(new Event('user-profile-updated'))
  }
  return updated
}
