'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Share2, Sparkles, FileText, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchReports, downloadReportPdf } from '@/lib/db-api'
import { useAuth } from '@/contexts/auth-context'
import type { AnalysisResult } from '@/lib/api'

export default function ReportsPage() {
  const [reports, setReports] = useState<AnalysisResult[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const loadData = async () => {
    setLoading(true)
    const userId = user ? String(user.id) : undefined
    const data = await fetchReports(userId)
    setReports(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleDownload = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    e.preventDefault()
    await downloadReportPdf(id)
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Reports</h1>
          <p className="text-muted-foreground">Generated UX analysis reports saved in database</p>
        </div>
        <Link href="/analyze">
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white">
            <Sparkles className="w-4 h-4 mr-2" /> New Report
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-card/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-premium rounded-xl p-12 text-center max-w-lg mx-auto space-y-4">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <h3 className="text-xl font-bold">No Reports Found</h3>
          <p className="text-sm text-muted-foreground">
            You haven&apos;t generated any UX reports yet. Enter a website URL on the Analyze page to get started.
          </p>
          <Link href="/analyze" className="inline-block pt-2">
            <Button className="bg-gradient-to-r from-primary to-accent text-white">
              Analyze a Website Now <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      ) : (
        /* Reports Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, idx) => (
            <div
              key={report.id}
              className="glass-premium rounded-xl border border-border/40 overflow-hidden card-hover fade-in-up flex flex-col justify-between"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Report Top Preview */}
              <div>
                <div className="h-36 bg-gradient-to-br from-primary/20 via-accent/10 to-background relative overflow-hidden flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto mb-1 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-xl">{report.ux_score}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-semibold">UX Score</p>
                  </div>
                </div>

                {/* Report Info */}
                <div className="p-6 space-y-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm line-clamp-1">
                      Report #{report.id}
                    </h3>
                    <a
                      href={report.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors line-clamp-1 underline mt-0.5"
                    >
                      {report.url}
                    </a>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center py-2 bg-card/40 rounded-lg border border-border/30">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Access.</p>
                      <p className="text-xs font-bold text-accent">{report.accessibility}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Perf.</p>
                      <p className="text-xs font-bold text-emerald-400">{report.performance}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">SEO</p>
                      <p className="text-xs font-bold text-amber-400">{report.seo}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">{report.created_at}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 pt-0 flex gap-2">
                <Link href={`/reports/${report.id}`} className="flex-1">
                  <button className="w-full px-3 py-2 rounded-lg bg-card/60 hover:bg-card border border-border/30 text-foreground text-xs font-semibold transition-colors duration-200">
                    View Report
                  </button>
                </Link>
                <button
                  onClick={(e) => handleDownload(e, report.id)}
                  className="px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors duration-200 flex items-center justify-center gap-1"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
