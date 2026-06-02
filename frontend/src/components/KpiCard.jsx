import React from 'react'
import ProgressBar from './ProgressBar'

/**
 * KpiCard — Carte KPI avec valeur, delta, sparkline, et progress bar optionnelle
 */
export default function KpiCard({
  label,
  value,
  delta,
  deltaDir = 'up',  // 'up' | 'down'
  sparkData,        // array of numbers
  progress,         // 0-100
  progressColor = 'copper',
  progressLabel,
  icon,             // SVG
  trend,
}) {
  return (
    <div className="card kpi hover-lift">
      <div className="flex items-center justify-between">
        <div className="kpi-label">{label}</div>
        {icon && <div style={{   color: 'var(--text-3)' }}>{icon}</div>}
      </div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <span className={`kpi-delta ${deltaDir}`}>
          {deltaDir === 'up' ? '↑' : '↓'} {delta}
        </span>
      )}
      {progress != null && (
        <div className="mt-3">
          <ProgressBar
            value={progress}
            color={progressColor}
            size="sm"
            showLabel={!!progressLabel}
            label={progressLabel}
          />
        </div>
      )}
      {sparkData && (
        <svg
          className="kpi-spark"
          viewBox="0 0 100 36"
          preserveAspectRatio="none"
          style={{   width: 80,   height: 28,   position: 'absolute',   right: 14,   bottom: 14,   opacity: 0.7 }}
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            points={sparkData.map((v, i) => `${(i / (sparkData.length - 1)) * 100},${36 - (v / Math.max(...sparkData)) * 30}`).join(' ')}
            style={{   color: progressColor === 'emerald' ? 'var(--emerald-500)' : 'var(--copper-500)' }}
          />
        </svg>
      )}
    </div>
  )
}
