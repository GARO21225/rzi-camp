import React from 'react'

/**
 * BarChart — Barres horizontales stylées (le "bar" qui manquait)
 *
 * Props:
 *  - data: [{ label, value, max?, color?, sublabel? }]
 *  - height: par défaut 8px par bar
 */
export default function BarChart({ data = [], showValues = true, color = 'var(--copper-500)', height = 8, unit = '' }) {
  const max = Math.max(...data.map((d) => d.max || d.value), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => {
        const fill = d.color || color
        const pct = Math.min(100, (d.value / max) * 100)
        return (
          <div key={i} className="barchart-row">
            <div className="flex items-center justify-between mb-1" style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{d.label}</span>
              {showValues && (
                <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {d.value.toLocaleString('fr-FR')}{unit}
                </strong>
              )}
            </div>
            <div style={{ width: '100%', height, borderRadius: height, background: 'var(--bg-2)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`, height: '100%',
                  background: fill, borderRadius: height,
                  transition: 'width .8s cubic-bezier(.16,1,.3,1) .1s',
                }}
              />
            </div>
            {d.sublabel && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{d.sublabel}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
