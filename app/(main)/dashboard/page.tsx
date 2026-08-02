'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { KPICard } from '@/components/kpi-card'
import { ParticleBackground } from '@/components/particle-background'
import { Zap, Eye, Target, TrendingUp, Sparkles, ExternalLink, ArrowRight, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchReports } from '@/lib/db-api'
import { useAuth } from '@/contexts/auth-context'
import type { AnalysisResult } from '@/lib/api'

// Lazy load heavy components
const CircularProgress = dynamic(
  () => import('@/components/circular-progress').then(mod => ({ default: mod.CircularProgress })),
  { loading: () => <div className="h-80 bg-card/50 rounded-xl animate-pulse" /> }
)

const HeatmapVisualization = dynamic(
  () => import('@/components/heatmap-visualization').then(mod => ({ default: mod.HeatmapVisualization })),
  { loading: () => <div className="h-96 bg-card/50 rounded-xl animate-pulse" /> }
)

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Recently'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 2) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  } catch {
    return dateStr
  }
}

function getCategoryFromUrl(urlStr: string): string {
  try {
    const hostname = new URL(urlStr).hostname.replace('www.', '')
    if (hostname.includes('shop') || hostname.includes('store')) return 'E-commerce'
    if (hostname.includes('blog') || hostname.includes('news')) return 'Blog'
    if (hostname.includes('docs') || hostname.includes('help')) return 'Documentation'
    if (hostname.includes('app') || hostname.includes('dashboard')) return 'Web App'
    return 'Website'
  } catch {
    return 'Website'
  }
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Needs Work'
  return 'Poor'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [ctaUrl, setCtaUrl] = useState('')
  const [reports, setReports] = useState<AnalysisResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const userId = user ? String(user.id) : undefined
      const data = await fetchReports(userId)
      setReports(data)
      setLoading(false)
    }
    loadData()
  }, [user])

  const handleCtaAnalyze = () => {
    const trimmed = ctaUrl.trim()
    if (!trimmed) return
    const encoded = encodeURIComponent(trimmed)
    router.push(`/analyze?url=${encoded}`)
  }

  // Calculate real average stats from reports
  const total = reports.length
  const avgUx = total > 0 ? Math.round(reports.reduce((acc, r) => acc + r.ux_score, 0) / total) : 0
  const avgAcc = total > 0 ? Math.round(reports.reduce((acc, r) => acc + r.accessibility, 0) / total) : 0
  const avgPerf = total > 0 ? Math.round(reports.reduce((acc, r) => acc + r.performance, 0) / total) : 0
  const avgSeo = total > 0 ? Math.round(reports.reduce((acc, r) => acc + r.seo, 0) / total) : 0

  const latestReport = reports.length > 0 ? reports[0] : null

  return (
    <div className="p-8 space-y-8">
      {/* Hero Section with Particle Background */}
      <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 glass-premium glow-border">
        <ParticleBackground />

        <div className="relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-primary">
                Welcome back, {user?.name || 'User'}!
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="gradient-text">Optimize Your UX</span>
              <br />
              <span className="text-foreground">with AI Insights</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl">
              Analyze, improve, and perfect your website&apos;s user experience with cutting-edge AI technology
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid — Powered by Real Database Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="UX Score"
          value={total > 0 ? `${avgUx}` : '--'}
          unit={total > 0 ? '/100' : ''}
          icon={Zap}
          trend={total > 0 ? `${total} real analyses` : 'No data yet'}
          color="primary"
          chartData={reports.length > 0 ? reports.slice(0, 7).map(r => r.ux_score).reverse() : [65, 70, 75, 82, 87, 85, 92]}
        />
        <KPICard
          title="Accessibility Score"
          value={total > 0 ? `${avgAcc}` : '--'}
          unit={total > 0 ? '/100' : ''}
          icon={Eye}
          trend={total > 0 ? `Avg across ${total} reports` : 'No data yet'}
          color="accent"
          chartData={reports.length > 0 ? reports.slice(0, 7).map(r => r.accessibility).reverse() : [78, 82, 85, 88, 90, 91, 92]}
        />
        <KPICard
          title="SEO Score"
          value={total > 0 ? `${avgSeo}` : '--'}
          unit={total > 0 ? '/100' : ''}
          icon={Target}
          trend={total > 0 ? `Avg across ${total} reports` : 'No data yet'}
          color="emerald"
          chartData={reports.length > 0 ? reports.slice(0, 7).map(r => r.seo).reverse() : [55, 62, 68, 72, 75, 77, 78]}
        />
        <KPICard
          title="Performance Index"
          value={total > 0 ? `${avgPerf}` : '--'}
          unit={total > 0 ? '/100' : ''}
          icon={TrendingUp}
          trend={total > 0 ? `Avg across ${total} reports` : 'No data yet'}
          color="amber"
          chartData={reports.length > 0 ? reports.slice(0, 7).map(r => r.performance).reverse() : [70, 74, 76, 80, 82, 83, 84]}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Real Recent Analyses Table */}
        <div className="lg:col-span-2 glass-premium rounded-xl border border-border/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between bg-gradient-to-r from-card/80 to-card/40">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Recent Analyses</h2>
              <p className="text-xs text-muted-foreground mt-1">Real analysis results from SQLite database</p>
            </div>
            <Link href="/reports">
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white text-sm">
                View All ({reports.length}) →
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-card/40 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-4">
                <Sparkles className="w-10 h-10 mx-auto text-primary/40 animate-pulse" />
                <div>
                  <p className="text-sm font-semibold text-foreground">No analyses performed yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Run your first analysis to see real-time SQLite data here.</p>
                </div>
                <Link href="/analyze" className="inline-block">
                  <Button className="bg-gradient-to-r from-primary to-accent text-white text-xs font-semibold">
                    Analyze a Site Now <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/20 bg-card/50">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Website</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.slice(0, 5).map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push('/reports')}
                      className="border-b border-border/10 hover:bg-primary/5 transition-all duration-300 card-hover cursor-pointer"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <td className="px-6 py-4 text-sm text-foreground font-medium max-w-[200px] truncate">
                        {item.url}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {getCategoryFromUrl(item.url)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            {item.ux_score}
                          </span>
                          <div className="w-16 h-2 bg-border/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                              style={{ width: `${item.ux_score}%` }}
                            />
                          </div>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="inline-block px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                          Analyzed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column — Overall Real UX Score */}
        <Suspense fallback={<div className="h-80 bg-card/50 rounded-xl animate-pulse" />}>
          <div className="glass-premium rounded-xl border border-border/40 overflow-hidden p-6 flex flex-col items-center justify-center">
            <h3 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Overall UX Score
            </h3>
            <CircularProgress
              value={latestReport ? latestReport.ux_score : (avgUx || 0)}
              label={latestReport ? scoreLabel(latestReport.ux_score) : (avgUx > 0 ? scoreLabel(avgUx) : 'No Data')}
              sublabel={latestReport ? `Latest analysis for ${latestReport.url}` : 'Run an analysis to get real scores'}
              color="primary"
            />
            <div className="w-full mt-6 pt-6 border-t border-border/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Reports Saved</span>
                <span className="text-emerald-400 font-semibold">{total}</span>
              </div>
              <Button
                onClick={() => router.push('/reports')}
                className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-semibold"
              >
                View detailed reports ({total}) →
              </Button>
            </div>
          </div>
        </Suspense>
      </div>

      {/* AI Insights & Attention Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real AI-Powered Suggestions from Latest Report */}
        <Suspense fallback={<div className="h-96 bg-card/50 rounded-xl animate-pulse" />}>
          <div className="glass-premium rounded-xl border border-border/40 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                AI-Powered Suggestions
              </h3>
              {latestReport && (
                <span className="text-xs text-muted-foreground">From {latestReport.url}</span>
              )}
            </div>

            {latestReport && latestReport.suggestions && latestReport.suggestions.length > 0 ? (
              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {latestReport.suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-card/40 border border-border/30 space-y-1 hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        {s.title}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          s.priority === 'High'
                            ? 'bg-red-500/20 text-red-300 border-red-500/30'
                            : s.priority === 'Medium'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {s.priority} Priority
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-6">{s.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground space-y-3">
                <Zap className="w-10 h-10 opacity-30" />
                <p className="text-sm font-medium">No analysis yet</p>
                <p className="text-xs opacity-70 max-w-xs">
                  Run an analysis from the Analyze page to see real AI-powered suggestions here.
                </p>
                <Button
                  onClick={() => router.push('/analyze')}
                  className="mt-2 bg-gradient-to-r from-primary to-accent text-white text-xs font-semibold"
                >
                  Analyze a Site →
                </Button>
              </div>
            )}
          </div>
        </Suspense>

        {/* Real Attention Heatmap visualization */}
        <Suspense fallback={<div className="h-96 bg-card/50 rounded-xl animate-pulse" />}>
          <div className="glass-premium rounded-xl border border-border/40 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">User Attention Heatmap</h3>
              <Link href="/reports" className="text-xs text-primary hover:text-primary/80 transition-colors">
                View Full Analysis →
              </Link>
            </div>
            <HeatmapVisualization uxScore={latestReport ? latestReport.ux_score : (avgUx || 75)} />
          </div>
        </Suspense>
      </div>

      {/* CTA Section */}
      <div className="glass-premium rounded-xl border border-border/40 overflow-hidden p-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 mx-auto">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-primary">Analyze any website in seconds</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold gradient-text mb-2">Ready to Improve Your UX?</h2>
        <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
          Get AI-powered insights to improve your website&apos;s user experience and boost conversions
        </p>
        <input
          id="dashboard-url-input"
          type="url"
          value={ctaUrl}
          onChange={(e) => setCtaUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCtaAnalyze()}
          placeholder="https://example.com"
          className="w-full max-w-xl px-6 py-3 rounded-lg bg-input border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
        />
        <div className="flex gap-3 justify-center">
          <button
            id="dashboard-analyze-btn"
            onClick={handleCtaAnalyze}
            className="relative px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/40 transition-all duration-200 transform hover:scale-105"
          >
            <Zap className="w-4 h-4 inline mr-2" />
            Analyze Now
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center justify-center gap-4 py-8 text-center text-xs text-muted-foreground">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-medium">Powered by Advanced AI</span>
        </div>
        <p>© 2025 Smart UX Analyzer. All rights reserved.</p>
      </div>
    </div>
  )
}
