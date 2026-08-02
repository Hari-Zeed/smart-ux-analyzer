'use client'

import { memo } from 'react'

function ParticleBackgroundComponent() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated gradient orbs */}
      <div className="absolute top-20 -left-20 w-96 h-96 bg-gradient-to-r from-primary/30 to-transparent rounded-full blur-3xl animate-pulse opacity-20" />
      <div className="absolute top-40 -right-32 w-80 h-80 bg-gradient-to-l from-accent/20 to-transparent rounded-full blur-3xl animate-pulse opacity-15 animation-delay-2000" />
      <div className="absolute -bottom-32 left-1/2 w-96 h-96 bg-gradient-to-t from-primary/20 to-transparent rounded-full blur-3xl animate-pulse opacity-10 animation-delay-4000" />
      
      {/* Floating particles */}
      <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-primary/40 rounded-full float-animation" />
      <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-accent/30 rounded-full float-animation" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-1/3 left-1/4 w-1 h-1 bg-primary/20 rounded-full float-animation" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 right-1/3 w-0.5 h-0.5 bg-accent/50 rounded-full float-animation" style={{ animationDelay: '1.5s' }} />
    </div>
  )
}

export const ParticleBackground = memo(ParticleBackgroundComponent)
