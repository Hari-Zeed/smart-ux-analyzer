'use client'

import { useState } from 'react'
import { Zap, Upload, AlertCircle, Loader2 } from 'lucide-react'

interface AnalyzeInputSectionProps {
  onAnalyze: (url: string) => void
  isLoading?: boolean
  error?: string | null
}

export function AnalyzeInputSection({
  onAnalyze,
  isLoading = false,
  error = null,
}: AnalyzeInputSectionProps) {
  const [url, setUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleSubmit = () => {
    onAnalyze(url)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit()
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 glass-premium glow-border slide-up">
      {/* Background gradient blob */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">AI-Powered Analysis</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
            Analyze Any Website in Seconds
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get AI-powered insights to improve your website&apos;s user experience and boost
            conversions
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* URL Input */}
          <div className="relative group md:col-span-1">
            <label className="block text-sm font-semibold text-foreground mb-3">
              Enter Website URL
            </label>
            <div className="relative">
              <input
                id="analyze-url-input"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className={`w-full px-4 py-3 rounded-lg bg-input border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                  error
                    ? 'border-red-500/60 focus:ring-red-500/30'
                    : 'border-border/50 focus:border-primary/50'
                }`}
              />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
            {/* Inline error */}
            {error && (
              <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs font-medium fade-in-up">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div
            className={`relative group md:col-span-1 transition-all duration-300 ${isDragging ? 'opacity-100' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <label className="block text-sm font-semibold text-foreground mb-3">
              Or Upload Screenshot
            </label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 ${
                isDragging
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border/40 bg-card/30 hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <Upload
                className={`w-6 h-6 mx-auto mb-2 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`}
              />
              <p className="text-xs font-medium text-muted-foreground">Drag & drop or click</p>
              <input type="file" className="hidden" accept="image/*" />
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex justify-center mt-8">
          <button
            id="analyze-now-btn"
            onClick={handleSubmit}
            disabled={isLoading}
            className="relative px-8 py-4 rounded-lg font-semibold text-white text-lg group overflow-hidden transition-all duration-300 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-size-200 group-hover:bg-right transition-all duration-500" style={{ backgroundSize: '200% 100%' }} />
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-accent/40 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            {/* Content */}
            <div className="relative flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing…</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Analyze Now</span>
                </>
              )}
            </div>
            {/* Bottom glow */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary/80 to-primary/0 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500" />
          </button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-10 pt-8 border-t border-border/20">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">5K+</div>
            <p className="text-xs text-muted-foreground">Sites Analyzed</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">98%</div>
            <p className="text-xs text-muted-foreground">Accuracy Rate</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">2s</div>
            <p className="text-xs text-muted-foreground">Average Analysis</p>
          </div>
        </div>
      </div>
    </div>
  )
}
