'use client'

import { AlertCircle, Lightbulb, Zap, Eye, TrendingUp, Shield, Gauge, Search } from 'lucide-react'
import type { Suggestion } from '@/lib/api'

interface AIInsightsProps {
  suggestions: Suggestion[]
}

// Pick an icon based on suggestion title keywords
function pickIcon(title: string) {
  const lower = title.toLowerCase()
  if (lower.includes('color') || lower.includes('contrast') || lower.includes('accessible'))
    return AlertCircle
  if (lower.includes('image') || lower.includes('alt')) return Eye
  if (lower.includes('cta') || lower.includes('call') || lower.includes('button')) return Zap
  if (lower.includes('seo') || lower.includes('title') || lower.includes('meta') || lower.includes('heading'))
    return Search
  if (lower.includes('speed') || lower.includes('performance') || lower.includes('load') || lower.includes('server'))
    return Gauge
  if (lower.includes('viewport') || lower.includes('mobile') || lower.includes('responsive'))
    return Shield
  if (lower.includes('navigation') || lower.includes('link') || lower.includes('clutter'))
    return TrendingUp
  return Lightbulb
}

const priorityConfig = {
  High: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-300 border border-red-500/30',
    icon: 'text-red-400',
    label: 'High Impact',
  },
  Medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    icon: 'text-amber-400',
    label: 'Medium Impact',
  },
  Low: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    icon: 'text-blue-400',
    label: 'Low Impact',
  },
}

export function AIInsights({ suggestions }: AIInsightsProps) {
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Lightbulb className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">No suggestions — this site looks great!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion, idx) => {
        const Icon = pickIcon(suggestion.title)
        const config = priorityConfig[suggestion.priority]

        return (
          <div
            key={idx}
            className={`${config.bg} border ${config.border} rounded-lg p-4 transition-all duration-300 hover:shadow-lg fade-in-up`}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.icon}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-foreground">{suggestion.title}</h4>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {suggestion.description}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
