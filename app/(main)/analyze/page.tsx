'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AnalyzeInputSection } from '@/components/analyze-input-section'
import { KPICard } from '@/components/kpi-card'
import { Zap, Eye, TrendingUp, Search, Download, Share2, AlertTriangle, CheckCircle } from 'lucide-react'
import { analyzeUrl, ApiError } from '@/lib/api'
import type { AnalysisResult } from '@/lib/api'
import { downloadReportPdf } from '@/lib/db-api'
import { useAuth } from '@/contexts/auth-context'

// ─── Lazy-loaded heavy components ────────────────────────────────────────────

const CircularProgress = dynamic(
  () => import('@/components/circular-progress').then((m) => ({ default: m.CircularProgress })),
  { loading: () => <div className="h-64 bg-card/50 rounded-xl animate-pulse" /> },
)

const AIInsights = dynamic(
  () => import('@/components/ai-insights').then((m) => ({ default: m.AIInsights })),
  { loading: () => <div className="h-80 bg-card/50 rounded-xl animate-pulse" /> },
)

const HeatmapVisualization = dynamic(
  () =>
    import('@/components/heatmap-visualization').then((m) => ({
      default: m.HeatmapVisualization,
    })),
  { loading: () => <div className="h-80 bg-card/50 rounded-xl animate-pulse" /> },
)

// ─── Score label helpers ──────────────────────────────────────────────────────

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Good'
  if (score >= 60) return 'Fair'
  if (score >= 40) return 'Needs Work'
  return 'Poor'
}

function scoreSublabel(score: number): string {
  if (score >= 90) return 'Outstanding user experience!'
  if (score >= 75) return 'Good UX with room to grow.'
  if (score >= 60) return 'Several improvements needed.'
  if (score >= 40) return 'Significant issues found.'
  return 'Major overhaul recommended.'
}

function scoreColor(score: number): 'primary' | 'accent' | 'emerald' {
  if (score >= 75) return 'emerald'
  if (score >= 50) return 'primary'
  return 'accent'
}

// ─── Results skeleton ─────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 bg-card/50 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-80 bg-card/50 rounded-xl" />
        <div className="h-80 bg-card/50 rounded-xl lg:col-span-2" />
      </div>
      <div className="h-96 bg-card/50 rounded-xl" />
    </div>
  )
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 fade-in-up">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-sm">Analysis Failed</p>
        <p className="text-xs mt-1 text-red-300/80">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-300 transition-colors text-xs font-semibold"
      >
        Dismiss
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [analyzedUrl, setAnalyzedUrl] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleAnalyze = useCallback(async (url: string) => {
    setError(null)

    if (!url.trim()) {
      setError('Please enter a URL to analyze.')
      return
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      setError('URL must start with http:// or https://')
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const userId = user ? String(user.id) : 'guest'
      const data = await analyzeUrl(url, userId)
      setResult(data)
      setAnalyzedUrl(url)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    const urlParam = searchParams.get('url')
    if (urlParam) {
      handleAnalyze(urlParam)
    }
  }, [searchParams, handleAnalyze])

  const handleReset = () => {
    setResult(null)
    setError(null)
    setAnalyzedUrl('')
  }

  const handleDownloadPdf = async () => {
    if (!result) return
    setIsDownloading(true)
    try {
      await downloadReportPdf(result.id)
    } catch (e) {
      console.error(e)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="p-8 space-y-8">
      {/* ── Input + Error banner ── */}
      {!result && (
        <>
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              <span className="gradient-text">Analyze Any Website</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get AI-powered insights to improve your website&apos;s user experience and boost
              conversions
            </p>
          </div>

          {error && (
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          )}

          <AnalyzeInputSection
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            error={error}
          />
        </>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && <ResultsSkeleton />}

      {/* ── Results ── */}
      {result && !isLoading && (
        <>
          {/* Results header */}
          <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-4xl font-bold gradient-text">Analysis Results</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Saved to DB (Report #{result.id})
                </span>
              </div>
              <p className="text-muted-foreground text-sm">
                Insights for{' '}
                <a
                  href={analyzedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-semibold hover:text-primary transition-colors underline underline-offset-2"
                >
                  {analyzedUrl}
                </a>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/reports/${result.id}`)}
                className="px-4 py-2.5 rounded-lg font-semibold text-foreground bg-card border border-border/50 hover:bg-card/80 transition-all duration-200 text-sm"
              >
                View Saved Report →
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/40 transition-all duration-200 text-sm"
              >
                New Analysis
              </button>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard
              title="UX Score"
              value={result.ux_score}
              unit="/100"
              icon={Zap}
              trend={result.ux_score >= 75 ? '↑ Good overall' : '↓ Needs improvement'}
              color="primary"
              chartData={[result.ux_score - 15, result.ux_score - 10, result.ux_score - 5, result.ux_score]}
            />
            <KPICard
              title="Accessibility"
              value={result.accessibility}
              unit="/100"
              icon={Eye}
              trend={result.accessibility >= 75 ? '↑ Accessible' : '↓ Needs work'}
              color="accent"
              chartData={[result.accessibility - 12, result.accessibility - 8, result.accessibility - 3, result.accessibility]}
            />
            <KPICard
              title="Performance"
              value={result.performance}
              unit="/100"
              icon={TrendingUp}
              trend={result.performance >= 75 ? '↑ Fast' : '↓ Slow response'}
              color="emerald"
              chartData={[result.performance - 10, result.performance - 6, result.performance - 2, result.performance]}
            />
            <KPICard
              title="SEO"
              value={result.seo}
              unit="/100"
              icon={Search}
              trend={result.seo >= 75 ? '↑ Well optimized' : '↓ Improve SEO'}
              color="amber"
              chartData={[result.seo - 14, result.seo - 9, result.seo - 4, result.seo]}
            />
          </div>

          {/* ── Score + Heatmap row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Suspense fallback={<div className="h-80 bg-card/50 rounded-xl animate-pulse" />}>
              <div className="glass-premium rounded-xl border border-border/40 p-8 flex flex-col items-center justify-center card-hover slide-up">
                <h3 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Overall UX Score
                </h3>
                <CircularProgress
                  value={result.ux_score}
                  label={scoreLabel(result.ux_score)}
                  sublabel={scoreSublabel(result.ux_score)}
                  color={scoreColor(result.ux_score)}
                  size={200}
                />
                <div className="w-full mt-6 pt-6 border-t border-border/30">
                  <div className="flex justify-between text-xs mb-3">
                    <span className="text-muted-foreground">Score breakdown</span>
                    <span className="font-semibold text-foreground">{result.ux_score}/100</span>
                  </div>
                  {[
                    { label: 'Accessibility', value: result.accessibility, color: 'from-accent to-blue-500' },
                    { label: 'Performance', value: result.performance, color: 'from-emerald-500 to-teal-500' },
                    { label: 'SEO', value: result.seo, color: 'from-amber-500 to-orange-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-700`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-8 text-right">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Suspense>

            <Suspense fallback={<div className="h-80 bg-card/50 rounded-xl animate-pulse" />}>
              <div className="glass-premium rounded-xl border border-border/40 p-8 lg:col-span-2 card-hover slide-up" style={{ animationDelay: '100ms' }}>
                <HeatmapVisualization uxScore={result.ux_score} />
              </div>
            </Suspense>
          </div>

          {/* ── AI Insights ── */}
          <Suspense fallback={<div className="h-96 bg-card/50 rounded-xl animate-pulse" />}>
            <div className="glass-premium rounded-xl border border-border/40 p-8 card-hover slide-up" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  AI-Powered Suggestions
                </h2>
                <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-bold">
                  {result.suggestions.length}
                </span>
              </div>
              <AIInsights suggestions={result.suggestions} />
            </div>
          </Suspense>

          {/* ── Action buttons ── */}
          <div className="flex flex-wrap items-center gap-4 slide-up" style={{ animationDelay: '300ms' }}>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:shadow-primary/40 transition-all duration-200 transform hover:scale-105 text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Downloading PDF...' : 'Download PDF Report'}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'UX Analysis', text: analyzedUrl })
                } else {
                  navigator.clipboard?.writeText(analyzedUrl)
                }
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-foreground bg-card border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-sm"
            >
              <Share2 className="w-4 h-4" />
              Share Analysis
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              Analyze another site →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
