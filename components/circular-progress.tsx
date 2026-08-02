'use client'

interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  label?: string
  sublabel?: string
  color?: 'primary' | 'accent' | 'emerald'
}

export function CircularProgress({
  value,
  max = 100,
  size = 240,
  strokeWidth = 8,
  label,
  sublabel,
  color = 'primary',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (value / max) * circumference

  const colorMap = {
    primary: '#7c5cff',
    accent: '#6366f1',
    emerald: '#10b981',
  }

  const gradientId = `gradient-${Math.random()}`

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 drop-shadow-lg"
          style={{
            filter: `drop-shadow(0 0 20px ${colorMap[color]}33)`,
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colorMap[color]} stopOpacity="0.8" />
              <stop offset="100%" stopColor={colorMap[color]} stopOpacity="0.4" />
            </linearGradient>
          </defs>
          
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
          />
          
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 10px ${colorMap[color]}80)`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold gradient-text">{Math.round(value)}</div>
          {label && <div className="text-sm text-muted-foreground font-medium mt-2">{label}</div>}
          {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
        </div>
      </div>
    </div>
  )
}
