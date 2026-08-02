'use client'

import { Info } from 'lucide-react'
import { useMemo, useState } from 'react'

interface HeatmapVisualizationProps {
  /** UX score 0–100. Determines heatspot spread and intensity. */
  uxScore?: number
}

interface Heatspot {
  id: string
  x: string
  y: string
  size: string
  intensity: number
}

/** Generate realistic heatspots seeded by uxScore */
function generateHeatspots(uxScore: number): Heatspot[] {
  // High score → focused, intense blobs on hero + CTA
  // Low score  → diffuse, weak blobs scattered around
  const base: Array<{ id: string; x: string; y: string; baseSize: number }> = [
    { id: 'logo',       x: '15%', y: '12%', baseSize: 70 },
    { id: 'hero-text',  x: '50%', y: '35%', baseSize: 120 },
    { id: 'cta-button', x: '50%', y: '55%', baseSize: 100 },
    { id: 'image',      x: '72%', y: '42%', baseSize: 130 },
    { id: 'nav',        x: '62%', y: '10%', baseSize: 90 },
  ]

  const factor = uxScore / 100 // 0→1

  return base.map((b, i) => {
    // Hero and CTA get boosted by high score; nav and logo scale inversely
    const isCritical = b.id === 'hero-text' || b.id === 'cta-button'
    const intensity = isCritical
      ? Math.round(40 + factor * 55)
      : Math.round(20 + (1 - factor * 0.4) * 40 + i * 3)

    const size = Math.round(b.baseSize * (0.6 + factor * 0.5))

    return {
      id: b.id,
      x: b.x,
      y: b.y,
      size: `${size}px`,
      intensity: Math.min(95, intensity),
    }
  })
}

export function HeatmapVisualization({ uxScore = 50 }: HeatmapVisualizationProps) {
  const [activeTab, setActiveTab] = useState<'click' | 'move' | 'scroll'>('click')

  const heatspots = useMemo(() => generateHeatspots(uxScore), [uxScore])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">User Attention Heatmap</h3>
          <button
            className="p-1 hover:bg-primary/10 rounded-full transition-colors"
            title="Simulated heatmap based on UX score"
          >
            <Info className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Tab controls */}
        <div className="flex gap-2 p-1 bg-card/50 rounded-lg border border-border/30">
          {(['click', 'move', 'scroll'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap container */}
      <div className="relative rounded-xl overflow-hidden border border-primary/30 shadow-lg shadow-primary/20">
        <div className="relative w-full aspect-video bg-gradient-to-br from-purple-900/40 via-blue-900/30 to-slate-900/50 overflow-hidden">
          {/* Website mockup */}
          <div className="absolute inset-0 flex flex-col">
            {/* Header */}
            <div className="h-12 bg-gradient-to-r from-slate-900/80 to-slate-800/80 border-b border-white/10 px-4 flex items-center gap-8">
              <div className="w-6 h-6 bg-gradient-to-br from-primary to-accent rounded" />
              <div className="flex gap-6 flex-1">
                {['Home', 'Features', 'Pricing', 'About'].map((item) => (
                  <span key={item} className="text-xs text-white/60">{item}</span>
                ))}
              </div>
              <div className="w-16 h-6 bg-gradient-to-r from-primary to-accent rounded opacity-60" />
            </div>

            {/* Hero section */}
            <div className="flex-1 p-8 flex items-center justify-between">
              <div className="flex-1 space-y-4">
                <div className="h-3 w-40 bg-white/20 rounded" />
                <div className="h-3 w-32 bg-white/15 rounded" />
                <div className="h-8 w-48 bg-gradient-to-r from-primary/40 to-accent/40 rounded mt-6" />
              </div>
              <div className="w-40 h-32 bg-gradient-to-br from-primary/30 to-accent/20 rounded-lg border border-white/10" />
            </div>
          </div>

          {/* Dynamic heatmap overlay */}
          {heatspots.map((spot) => (
            <div
              key={spot.id}
              className="absolute rounded-full mix-blend-overlay pointer-events-none"
              style={{
                left: spot.x,
                top: spot.y,
                width: spot.size,
                height: spot.size,
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, ${
                  spot.intensity > 85
                    ? 'rgba(239, 68, 68, 0.85)'
                    : spot.intensity > 70
                    ? 'rgba(249, 115, 22, 0.75)'
                    : spot.intensity > 50
                    ? 'rgba(234, 179, 8, 0.65)'
                    : 'rgba(99, 102, 241, 0.45)'
                }, rgba(124, 92, 255, 0.05))`,
                filter: 'blur(18px)',
                animation: 'heatmap-pulse 3s ease-in-out infinite',
                boxShadow: `0 0 ${parseInt(spot.size) / 2}px ${
                  spot.intensity > 85
                    ? 'rgba(239, 68, 68, 0.5)'
                    : spot.intensity > 70
                    ? 'rgba(249, 115, 22, 0.4)'
                    : 'rgba(234, 179, 8, 0.3)'
                }`,
              }}
            />
          ))}

          {/* Click markers */}
          {activeTab === 'click' && (
            <>
              {[
                { x: '15%', y: '12%' },
                { x: '50%', y: '55%' },
                { x: '72%', y: '42%' },
              ].map((marker, idx) => (
                <div
                  key={idx}
                  className="absolute w-3 h-3 rounded-full border-2 border-red-400 animate-pulse"
                  style={{
                    left: marker.x,
                    top: marker.y,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.8)',
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Low Attention</span>
          <span>High Attention</span>
        </div>
        <div className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500 shadow-lg" />
      </div>

      {/* UX score badge */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          Heatmap intensity based on UX score: <strong className="text-foreground">{uxScore}/100</strong>
        </span>
        <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
          View Full Analysis <span className="ml-1">→</span>
        </button>
      </div>
    </div>
  )
}
