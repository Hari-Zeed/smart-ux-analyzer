'use client'

import { Bell, Eye, Lock, Zap, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { getUserProfile, getOrCreateUserId } from '@/lib/user'
import { useTheme } from '@/components/theme-provider'
import { fetchBackendSettings, updateBackendSettings } from '@/lib/db-api'

export default function SettingsPage() {
  const { isDarkMode, toggleTheme } = useTheme()
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyReports: true,
    autoAnalysis: false,
    dataSharing: false,
  })
  const [userEmail, setUserEmail] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const user = getUserProfile()
      setUserEmail(user.email)

      const userId = getOrCreateUserId()
      const backendSettings = await fetchBackendSettings(userId)
      setSettings(prev => ({
        ...prev,
        autoAnalysis: backendSettings.auto_analysis,
        dataSharing: backendSettings.data_sharing,
      }))
    }
    loadSettings()
  }, [])

  const handleToggle = async (key: string) => {
    const userId = getOrCreateUserId()

    if (key === 'darkMode') {
      toggleTheme()
      return
    }

    const nextValue = !settings[key as keyof typeof settings]
    const newSettings = { ...settings, [key]: nextValue }
    setSettings(newSettings)

    // Save immediately to backend DB
    await updateBackendSettings(userId, {
      dark_mode: isDarkMode,
      auto_analysis: key === 'autoAnalysis' ? nextValue : settings.autoAnalysis,
      data_sharing: key === 'dataSharing' ? nextValue : settings.dataSharing,
    })

    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  const handleSave = async () => {
    const userId = getOrCreateUserId()
    await updateBackendSettings(userId, {
      dark_mode: isDarkMode,
      auto_analysis: settings.autoAnalysis,
      data_sharing: settings.dataSharing,
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  const settingsSections = [
    {
      title: 'Notifications',
      icon: Bell,
      settings: [
        {
          id: 'emailNotifications',
          label: 'Email Notifications',
          description: 'Receive analysis updates via email',
          checked: settings.emailNotifications,
        },
        {
          id: 'pushNotifications',
          label: 'Push Notifications',
          description: 'Get instant push notifications for important updates',
          checked: settings.pushNotifications,
        },
        {
          id: 'weeklyReports',
          label: 'Weekly Reports',
          description: 'Receive a weekly summary of your analyses',
          checked: settings.weeklyReports,
        },
      ],
    },
    {
      title: 'Display',
      icon: Eye,
      settings: [
        {
          id: 'darkMode',
          label: 'Dark Mode',
          description: 'Use dark theme by default',
          checked: isDarkMode,
        },
      ],
    },
    {
      title: 'Advanced',
      icon: Zap,
      settings: [
        {
          id: 'autoAnalysis',
          label: 'Auto-Analysis',
          description: 'Automatically analyze websites on schedule',
          checked: settings.autoAnalysis,
        },
      ],
    },
    {
      title: 'Security',
      icon: Lock,
      settings: [
        {
          id: 'dataSharing',
          label: 'Data Sharing',
          description: 'Allow data sharing with analytics partners',
          checked: settings.dataSharing,
        },
      ],
    },
  ]

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your app preferences and settings saved in database</p>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold fade-in-up">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          Settings updated in SQLite database!
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-6">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title} className="glass-premium rounded-xl border border-border/40 overflow-hidden">
              {/* Section Header */}
              <div className="px-6 py-4 border-b border-border/30 flex items-center gap-3 bg-gradient-to-r from-card/50 to-card/30">
                <Icon className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              </div>

              {/* Settings List */}
              <div className="divide-y divide-border/10">
                {section.settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-card/30 transition-colors duration-200"
                  >
                    <div>
                      <p className="font-medium text-foreground">{setting.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setting.checked}
                        onChange={() => handleToggle(setting.id)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-card border border-border/50 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Account Section */}
      <div className="glass-premium rounded-xl border border-border/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/30 bg-gradient-to-r from-card/50 to-card/30">
          <h2 className="text-lg font-semibold text-foreground">Account</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
            <input
              type="email"
              value={userEmail || 'hari@example.com'}
              disabled
              className="w-full px-4 py-2 rounded-lg bg-card border border-border/50 text-foreground cursor-not-allowed opacity-60 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => alert('Password reset link sent to ' + userEmail)}
              className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-semibold"
            >
              Reset Password
            </Button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <Button onClick={handleSave} className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white">
          Save Settings
        </Button>
      </div>
    </div>
  )
}
