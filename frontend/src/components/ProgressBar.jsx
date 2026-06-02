import React from 'react'

/**
 * ProgressBar — Barre de progression stylée
 *
 * Props:
 *  - value (0-100)
 *  - max (default 100)
 *  - color: 'copper' | 'gold' | 'emerald' | 'warn' | 'alert' | 'info'
 *  - size: 'sm' | 'md' | 'lg'
 *  - showLabel (bool)
 *  - label (string)
 *  - striped (bool)
 *  - animated (bool)
 */
export default function ProgressBar({
  value = 0,
  max = 100,
  color = 'copper',
  size = 'md',
  showLabel = false,
  label = '',
  striped = false,
  animated = false,
  className = '',
}) {
  const pctVal = Math.min(100, Math.max(0, (value / max) * 100))
  const colorMap = {
    copper: 'var(--copper-500)',
    gold: 'var(--gold-500)',
    emerald: 'var(--emerald-500)',
    warn: 'var(--status-warn)',
    alert: 'var(--status-alert)',
    info: 'var(--status-info)',
  }
  const heightMap = { sm: 4, md: 8, lg: 12 }
  const fill = colorMap[color] || colorMap.copper
  const h = heightMap[size] || heightMap.md

  return (
    <div className={`progressbar ${className}`}>
      {(label || showLabel) && (
        <div className="flex items-center justify-between mb-1" style={{ fontSize: 12 }}>
          {label && <span style={{ color: 'var(--text-3)' }}>{label}</span>}
          {showLabel && <strong style={{ color: 'var(--text-2)' }}>{pctVal.toFixed(0)}%</strong>}
        </div>
      )}
      <div
        style={{
          width: '100%', height: h, borderRadius: h,
          background: 'var(--bg-2)', overflow: 'hidden', position: 'relative',
        }}
      >
        <div
          style={{
            width: `${pctVal}%`, height: '100%',
            background: fill, borderRadius: h,
            transition: 'width .5s cubic-bezier(.16,1,.3,1)',
            backgroundImage: striped
              ? 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)'
              : 'none',
            backgroundSize: striped ? '12px 12px' : 'auto',
            animation: animated && striped ? 'shimmer 1s linear infinite' : 'none',
          }}
        />
      </div>
    </div>
  )
}
