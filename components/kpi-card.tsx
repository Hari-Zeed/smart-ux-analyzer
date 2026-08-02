'use client'

import { LucideIcon } from 'lucide-react'
import { memo } from 'react'

interface KPICardProps {
  title: string
  value: string | number
  unit?: string
  icon: LucideIcon
  trend?: string
  color?: 'primary' | 'accent' | 'emerald' | 'amber'
  chartData?: number[]
}

function KPICardComponent({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  color = 'primary',
  chartData = [65, 70, 75, 82, 87, 85, 92],
}: KPICardProps) {
  const colorMap = {
    primary: 'from-primary to-purple-500',
    accent: 'from-accent to-blue-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500',
  }

  const colorClasses = {
    primary: 'text-primary',
    accent: 'text-accent',
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
  }

  const maxValue = Math.max(...chartData)
  const trendColor = trend?.includes('↑') ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="group glass-premium rounded-xl p-6 glow-border relative overflow-hidden slide-up">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10 flex items-start justify-between mb-6">
        <div className="flex-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-3">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold bg-gradient-to-r ${colorMap[color]} bg-clip-text text-transparent`}>
              {value}
            </span>
            {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          </div>
          {trend && (
            <p className={`text-xs font-semibold mt-3 ${trendColor}`}>
              {trend}
            </p>
          )}
        </div>
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
      </div>

      {/* Mini line chart */}
      <div className="h-12 flex items-end justify-between gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-300">
        {chartData.map((point, idx) => (
          <div
            key={idx}
            className={`flex-1 rounded-t-sm transition-all duration-300 group-hover:opacity-100 ${colorClasses[color]}`}
            style={{
              height: `${(point / maxValue) * 100}%`,
              background: `linear-gradient(180deg, rgba(124, 92, 255, 0.8), rgba(124, 92, 255, 0.3))`,
              opacity: 0.6 + (point / maxValue) * 0.4,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export const KPICard = memo(KPICardComponent)
