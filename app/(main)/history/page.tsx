'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, Search, RotateCcw, ExternalLink, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchReports, deleteReport } from '@/lib/db-api'
import { useAuth } from '@/contexts/auth-context'
import type { AnalysisResult } from '@/lib/api'

export default function HistoryPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [historyData, setHistoryData] = useState<AnalysisResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<number[]>([])

  const loadData = async () => {
    setLoading(true)
    const userId = user ? String(user.id) : undefined
    const data = await fetchReports(userId)
    setHistoryData(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const toggleItem = (id: number) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedItems.length === filteredData.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(filteredData.map(item => item.id))
    }
  }

  const handleDeleteSelected = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} selected report(s)?`)) return
    
    for (const id of selectedItems) {
      await deleteReport(id)
    }
    setSelectedItems([])
    loadData()
  }

  const handleDeleteSingle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this analysis report?')) return
    await deleteReport(id)
    loadData()
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400'
    if (score >= 70) return 'text-amber-400'
    return 'text-red-400'
  }

  const filteredData = historyData.filter(item =>
    item.url.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">History</h1>
          <p className="text-muted-foreground">Your persistent analysis history and log from SQLite database</p>
        </div>
        {selectedItems.length > 0 && (
          <Button
            onClick={handleDeleteSelected}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedItems.length})
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search analysis history by URL..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-input border border-border/50 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
        />
      </div>

      {/* History Table */}
      {loading ? (
        <div className="h-64 bg-card/50 rounded-xl animate-pulse" />
      ) : filteredData.length === 0 ? (
        <div className="glass-premium rounded-xl p-12 text-center max-w-lg mx-auto space-y-4">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <h3 className="text-xl font-bold">No History Found</h3>
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'No results matched your search.' : 'You haven\'t analyzed any websites yet.'}
          </p>
        </div>
      ) : (
        <div className="glass-premium rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20 bg-card/50">
                  <th className="px-6 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredData.length && filteredData.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-border bg-input cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Website URL</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">UX Score</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date Analyzed</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border/10 hover:bg-primary/5 transition-all duration-300 ${
                      selectedItems.includes(item.id) ? 'bg-primary/10' : ''
                    }`}
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="w-4 h-4 rounded border-border bg-input cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-muted-foreground">#{item.id}</td>
                    <td className="px-6 py-4 text-sm text-foreground font-medium max-w-xs truncate">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors inline-flex items-center gap-1">
                        {item.url} <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`font-bold ${getScoreColor(item.ux_score)}`}>{item.ux_score}/100</span>
                      <div className="w-20 h-1.5 bg-border/50 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full ${
                            item.ux_score >= 85
                              ? 'bg-emerald-500'
                              : item.ux_score >= 70
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${item.ux_score}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{item.created_at}</td>
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <button
                        onClick={() => router.push(`/analyze?url=${encodeURIComponent(item.url)}`)}
                        className="px-2.5 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors inline-flex items-center gap-1"
                        title="Re-analyze website"
                      >
                        <RotateCcw className="w-3 h-3" /> Re-analyze
                      </button>
                      <Link href={`/reports/${item.id}`}>
                        <button className="px-2.5 py-1.5 rounded bg-card/60 hover:bg-card border border-border/40 text-foreground text-xs font-semibold transition-colors">
                          View
                        </button>
                      </Link>
                      <button
                        onClick={(e) => handleDeleteSingle(item.id, e)}
                        className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
