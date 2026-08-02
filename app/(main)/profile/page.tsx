'use client'

import { useEffect, useState } from 'react'
import { User, Mail, Phone, Save, CheckCircle, Shield, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getUserProfile, saveUserProfile } from '@/lib/user'
import { syncUserProfileToBackend, fetchUserStats, type UserStats } from '@/lib/db-api'

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
  })
  const [stats, setStats] = useState<UserStats>({
    total_analyses: 0,
    avg_ux: 0,
    avg_accessibility: 0,
    avg_performance: 0,
    avg_seo: 0,
  })
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      const local = getUserProfile()
      setProfile(local)

      const s = await fetchUserStats(local.id)
      setStats(s)
      setLoading(false)
    }
    loadProfile()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    saveUserProfile({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    })
    
    await syncUserProfileToBackend(profile.id, {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    })

    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">User Profile</h1>
        <p className="text-muted-foreground">Manage your account details and view analysis statistics</p>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold fade-in-up">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          Profile updated successfully in SQLite database!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="glass-premium rounded-xl border border-border/40 p-6 flex flex-col items-center text-center space-y-4 md:col-span-1">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-purple-500 to-accent flex items-center justify-center text-white text-3xl font-bold shadow-xl border-2 border-white/20">
            {profile.name ? profile.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
          </div>
          <div>
            <h3 className="font-bold text-lg">{profile.name || 'User Profile'}</h3>
            <p className="text-xs text-muted-foreground">{profile.email || 'No email set'}</p>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
            <Shield className="w-3.5 h-3.5" /> User ID: {profile.id.substring(0, 12)}
          </span>
        </div>

        {/* User Stats Card */}
        <div className="glass-premium rounded-xl border border-border/40 p-6 md:col-span-2 space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
            <BarChart2 className="w-4 h-4 text-primary" /> Analysis Stats Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-card/40 p-4 rounded-lg border border-border/30 text-center">
              <p className="text-2xl font-bold text-primary">{stats.total_analyses}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Total Runs</p>
            </div>
            <div className="bg-card/40 p-4 rounded-lg border border-border/30 text-center">
              <p className="text-2xl font-bold text-accent">{stats.avg_ux}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Avg UX</p>
            </div>
            <div className="bg-card/40 p-4 rounded-lg border border-border/30 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.avg_performance}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Avg Perf</p>
            </div>
            <div className="bg-card/40 p-4 rounded-lg border border-border/30 text-center">
              <p className="text-2xl font-bold text-amber-400">{stats.avg_seo}</p>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-1">Avg SEO</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="glass-premium rounded-xl border border-border/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 bg-gradient-to-r from-card/50 to-card/30">
          <h2 className="text-lg font-semibold text-foreground">Edit Profile Information</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Hari Kumar"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="hari@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border/50 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="+1 (555) 234-5678"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="submit" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white">
              <Save className="w-4 h-4 mr-2" /> Save Profile
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
