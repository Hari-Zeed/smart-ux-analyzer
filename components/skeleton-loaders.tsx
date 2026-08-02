'use client'

export function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8">
      {/* Hero Section Skeleton */}
      <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 glass-premium h-48 bg-card/50 animate-pulse" />

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-48 bg-card/50 rounded-xl animate-pulse" />
        ))}
      </div>

      {/* Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card/50 rounded-xl h-80 animate-pulse" />
        <div className="bg-card/50 rounded-xl h-80 animate-pulse" />
      </div>

      {/* Insights & Heatmap Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card/50 rounded-xl h-96 animate-pulse" />
        <div className="bg-card/50 rounded-xl h-96 animate-pulse" />
      </div>
    </div>
  )
}

export function KPICardSkeleton() {
  return <div className="h-48 bg-card/50 rounded-xl animate-pulse" />
}

export function AnalyzeSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="text-center space-y-4">
        <div className="h-16 bg-card/50 rounded-lg mx-auto w-3/4 animate-pulse" />
        <div className="h-6 bg-card/50 rounded-lg mx-auto w-2/3 animate-pulse" />
      </div>
      <div className="space-y-4">
        <div className="h-32 bg-card/50 rounded-xl animate-pulse" />
        <div className="h-32 bg-card/50 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

export function ReportsSkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="h-12 bg-card/50 rounded-lg w-1/3 animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 bg-card/50 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}

export function HistorySkeleton() {
  return (
    <div className="p-8 space-y-8">
      <div className="h-12 bg-card/50 rounded-lg w-1/3 animate-pulse mb-6" />
      <div className="bg-card/50 rounded-xl h-96 animate-pulse" />
    </div>
  )
}
