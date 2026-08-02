'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, ArrowLeft, Zap, Eye, TrendingUp, Search, Calendar, Globe } from 'lucide-react'
import { CircularProgress } from '@/components/circular-progress'
import { KPICard } from '@/components/kpi-card'
import { AIInsights } from '@/components/ai-insights'
import { HeatmapVisualization } from '@/components/heatmap-visualization'
import { fetchReportById, downloadReportPdf } from '@/lib/db-api'
import type { AnalysisResult } from '@/lib/api'

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const reportId = resolvedParams.id
  const router = useRouter()
  
  const [report, setReport] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    async function loadReport() {
      setLoading(true)
      const data = await fetchReportById(reportId)
      setReport(data)
      setLoading(false)
    }
    loadReport()
  }, [reportId])

  const handleDownload = async () => {
    if (!report) return
    setIsDownloading(true)
    await downloadReportPdf(report.id)
    setIsDownloading(false)
  }

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-card/50 rounded-lg" />
        <div className="h-64 bg-card/50 rounded-xl" />
        <div className="h-96 bg-card/50 rounded-xl" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">Report Not Found</h2>
        <p className="text-muted-foreground text-sm">The requested report #{reportId} does not exist in the database.</p>
        <Link href="/reports">
          <button className="px-4 py-2 bg-primary/20 text-primary rounded-lg font-semibold text-sm">
            ← Back to Reports
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Navigation Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-card/50 hover:bg-card border border-border/40 text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Report #{report.id}</h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <a href={report.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-foreground font-semibold">
                  {report.url}
                </a>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {report.created_at}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all text-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? 'Downloading...' : 'Download PDF Report'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="UX Score"
          value={report.ux_score}
          unit="/100"
          icon={Zap}
          color="primary"
          chartData={[report.ux_score - 15, report.ux_score - 10, report.ux_score - 5, report.ux_score]}
        />
        <KPICard
          title="Accessibility"
          value={report.accessibility}
          unit="/100"
          icon={Eye}
          color="accent"
          chartData={[report.accessibility - 12, report.accessibility - 8, report.accessibility - 3, report.accessibility]}
        />
        <KPICard
          title="Performance"
          value={report.performance}
          unit="/100"
          icon={TrendingUp}
          color="emerald"
          chartData={[report.performance - 10, report.performance - 6, report.performance - 2, report.performance]}
        />
        <KPICard
          title="SEO"
          value={report.seo}
          unit="/100"
          icon={Search}
          color="amber"
          chartData={[report.seo - 14, report.seo - 9, report.seo - 4, report.seo]}
        />
      </div>

      {/* Circle + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-premium rounded-xl border border-border/40 p-8 flex flex-col items-center justify-center">
          <h3 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Overall UX Score
          </h3>
          <CircularProgress
            value={report.ux_score}
            label={report.ux_score >= 75 ? 'Good' : 'Needs Work'}
            sublabel="Saved analysis snapshot"
            color="primary"
            size={200}
          />
        </div>

        <div className="glass-premium rounded-xl border border-border/40 p-8 lg:col-span-2">
          <HeatmapVisualization uxScore={report.ux_score} />
        </div>
      </div>

      {/* AI Insights */}
      <div className="glass-premium rounded-xl border border-border/40 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            AI-Powered Suggestions ({report.suggestions.length})
          </h2>
        </div>
        <AIInsights suggestions={report.suggestions} />
      </div>
    </div>
  )
}
