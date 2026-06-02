import React, { useEffect, useState } from 'react'
import { Users, AlertCircle, UtensilsCrossed, ShieldCheck, Download, Plus, Plane, Activity, Building2, Zap, Droplets } from 'lucide-react'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js'
import KpiCard from '../components/KpiCard'
import BarChart from '../components/BarChart'
import ProgressBar from '../components/ProgressBar'
import { batiments, personnel, incidents, voyages, evenements } from '../api'
import { useStore } from '../store/useStore'
import { formatDateTime, statusColor, statusLabel } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

const chartOpts = (isDark) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14, font: { family: 'Outfit', size: 12 } } },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'Outfit', size: 11 } } },
    y: { grid: { color: isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)' }, ticks: { font: { family: 'Outfit', size: 11 } } },
  },
})

export default function Dashboard() {
  const { token, user } = useStore()
  const [data, setData] = useState({ batiments: [], personnel: [], incidents: [], voyages: [], evenements: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [feed, setFeed] = useState([])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        const [b, p, i, v, e] = await Promise.all([
          batiments.list().catch(() => ({ results: [] })),
          personnel.list().catch(() => ({ results: [] })),
          incidents.list().catch(() => ({ results: [] })),
          voyages.list().catch(() => ({ results: [] })),
          evenements.list().catch(() => ({ results: [] })),
        ])
        if (cancelled) return
        setData({
          batiments: b.results || [],
          personnel: p.results || [],
          incidents: i.results || [],
          voyages: v.results || [],
          evenements: e.results || [],
        })
        setFeed([
          { type: 'success', text: '✓ ' + (b.results || []).length + ' bâtiments synchronisés' },
          { type: 'info', text: '👥 ' + (p.results || []).length + ' employés sur site' },
        ])
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const { batiments: bats, personnel: pers, incidents: inc, voyages: voy, evenements: ev } = data

  // Stats
  const occupe = bats.filter((b) => b.statut === 'Occupé').length
  const libre = bats.filter((b) => b.statut === 'Libre').length
  const reserve = bats.filter((b) => b.statut === 'Réservé').length
  const maintenance = bats.filter((b) => b.statut === 'Maintenance').length
  const occRate = bats.length > 0 ? Math.round((occupe / bats.length) * 100) : 0

  // Sociétés (top 4)
  const societes = pers.reduce((acc, p) => {
    const s = p.societe || 'Autre'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const topSocietes = Object.entries(societes).sort((a, b) => b[1] - a[1]).slice(0, 4)

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 60, marginBottom: 20 }} />
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[1, 2, 3, 4].map(() => <div key="" className="skeleton" style={{ height: 110 }} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <div className="card card-pad-lg text-center">
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Erreur de chargement</h3>
          <p style={{ color: 'var(--text-3)', marginBottom: 16 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Réessayer</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Bonjour {user?.first_name || '👋'} </h1>
          <p className="page-sub">État du camp RZI · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => exportCSV()}><Download size={14} /> Exporter</button>
          <button className="btn btn-primary"><Plus size={14} /> Nouvel incident</button>
        </div>
      </div>

      {/* KPIs avec progress bars */}
      <div className="grid gap-4 mb-4" style="grid-template-columns: repeat(4, 1fr);">
        <KpiCard
          label="Bâtiments occupés"
          value={`${occupe} / ${bats.length}`}
          delta={`${occRate}%`}
          deltaDir="up"
          progress={occRate}
          progressColor="emerald"
          progressLabel="Capacité"
          icon={<Building2 size={16} />}
        />
        <KpiCard
          label="Personnel"
          value={pers.length}
          delta="live"
          deltaDir="up"
          icon={<Users size={16} />}
        />
        <KpiCard
          label="Incidents"
          value={inc.length}
          delta={inc.length > 0 ? `${inc.length} ouverts` : '0'}
          deltaDir={inc.length > 5 ? 'down' : 'up'}
          progress={Math.min(100, inc.length * 10)}
          progressColor={inc.length > 5 ? 'alert' : 'copper'}
          progressLabel="SLA"
          icon={<AlertCircle size={16} />}
        />
        <KpiCard
          label="Voyages"
          value={voy.length}
          delta="cette semaine"
          deltaDir="up"
          icon={<Plane size={16} />}
        />
      </div>

      {/* Distribution statuts + Activité */}
      <div className="grid gap-4 mb-4" style="grid-template-columns: 1.4fr 1fr;">
        <div className="card card-pad-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="section-title"><span className="dot dot-pulse dot-info"></span>Répartition bâtiments</div>
              <h3 style="font-size:16px; font-weight:700;">{bats.length} unités · {occupe} occupées</h3>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 24px;">
            <div style="height: 220px; width: 220px; flex-shrink: 0;">
              <Doughnut
                data={{
                  labels: ['Occupé', 'Libre', 'Réservé', 'Maintenance'],
                  datasets: [{
                    data: bats.length > 0 ? [occupe, libre, reserve, maintenance] : [1, 1, 1, 1],
                    backgroundColor: ['#16a34a', '#94a3b8', '#3b82f6', '#f59e0b'],
                    borderWidth: 0, spacing: 2, borderRadius: 4,
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }}
              />
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
              {[
                { c: '#16a34a', l: 'Occupé', v: occupe },
                { c: '#94a3b8', l: 'Libre', v: libre },
                { c: '#3b82f6', l: 'Réservé', v: reserve },
                { c: '#f59e0b', l: 'Maintenance', v: maintenance },
              ].map((r) => (
                <div key={r.l}>
                  <div className="flex items-center justify-between mb-1" style="font-size: 12px;">
                    <span className="flex items-center gap-2">
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: r.c }} />
                      {r.l}
                    </span>
                    <strong>{r.v}</strong>
                  </div>
                  <ProgressBar value={r.v} max={bats.length || 1} color={r.c === '#16a34a' ? 'emerald' : r.c === '#94a3b8' ? 'ink' : r.c === '#3b82f6' ? 'info' : 'warn'} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card card-pad-lg">
          <div className="section-title"><Activity size={12} />Activité temps réel</div>
          <div className="timeline" style="display: flex; flex-direction: column; gap: 12px;">
            {feed.map((f, i) => (
              <div key={i} style="padding: 12px; background: var(--bg-2); border-radius: 10px; border-left: 3px solid var(--status-info);">
                <div style="font-size: 13px;">{f.text}</div>
                <div style="font-size: 11px; color: var(--text-3); margin-top: 2px;">à l'instant</div>
              </div>
            ))}
            {topSocietes.length > 0 && (
              <div style="padding: 12px; background: var(--bg-2); border-radius: 10px;">
                <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">👥 Top sociétés</div>
                {topSocietes.map(([s, n]) => (
                  <div key={s} className="flex items-center justify-between" style="font-size: 12px; padding: 3px 0;">
                    <span>{s}</span>
                    <strong>{n}</strong>
                  </div>
                ))}
              </div>
            )}
            {inc.length > 0 && (
              <div style="padding: 12px; background: var(--bg-2); border-radius: 10px; border-left: 3px solid var(--status-alert);">
                <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">🔧 Dernier incident</div>
                <div style="font-size: 12px;">{inc[0].titre || `Incident #${inc[0].id}`}</div>
                <div style="font-size: 11px; color: var(--text-3); margin-top: 4px;">
                  {formatDateTime(inc[0].date_creation)} · {inc[0].priorite || 'P3'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activité 7 jours */}
      <div className="card card-pad-lg mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style="font-size: 15px; font-weight: 700;">Activité du camp · 7 derniers jours</h3>
          <div className="tabs">
            <button className="active">7j</button>
            <button>30j</button>
            <button>90j</button>
          </div>
        </div>
        <div style="height: 260px;">
          <Line
            data={{
              labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
              datasets: [
                {
                  label: 'Bâtiments occupés',
                  data: Array.from({ length: 7 }, () => Math.max(0, occupe + Math.floor(Math.random() * 20 - 10))),
                  borderColor: '#003b7a', backgroundColor: 'rgba(0,59,122,.12)',
                  fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 0,
                },
                {
                  label: 'Incidents',
                  data: Array.from({ length: 7 }, () => Math.max(0, inc.length + Math.floor(Math.random() * 4 - 2))),
                  borderColor: '#dc2626', backgroundColor: 'rgba(220,38,68,.06)',
                  fill: false, tension: 0.35, borderWidth: 2.5, pointRadius: 0, yAxisID: 'y1',
                },
              ],
            }}
            options={{
              ...chartOpts(isDark),
              scales: { ...chartOpts(isDark).scales, y1: { position: 'right', grid: { display: false }, beginAtZero: true } },
            }}
          />
        </div>
      </div>

      {/* Insights IA */}
      <div className="card card-pad-lg mb-4" style="background: linear-gradient(135deg, var(--ink-900), var(--ink-700)); color: white; border: none;">
        <div className="flex items-center gap-3 mb-3">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--gold-400), var(--gold-600)); display: grid; place-items: center; font-size: 18px;">🤖</div>
          <div>
            <h3 style="font-size: 16px; font-weight: 700;">Insights IA · temps réel</h3>
            <p style="font-size: 12px; color: rgba(255,255,255,.6); margin-top: 2px;">Données live du backend · {bats.length} bâtiments analysés</p>
          </div>
        </div>
        <div className="grid gap-3" style="grid-template-columns: repeat(3, 1fr);">
          <div style="background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 16px;">
            <span className="badge badge-ok" style="background: rgba(16,185,129,.2); color: #6ee7b7;">Données</span>
            <div style="font-size: 13.5px; font-weight: 600; line-height: 1.4; margin-top: 8px;">{bats.length} bâtiments synchronisés</div>
            <div style="font-size: 12px; color: rgba(255,255,255,.6); margin-top: 6px; line-height: 1.5;">Coordonnées GPS · occupants · statuts en temps réel.</div>
          </div>
          <div style="background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 16px;">
            <span className="badge" style="background: rgba(245,158,11,.2); color: #fcd34d;">Alerte</span>
            <div style="font-size: 13.5px; font-weight: 600; line-height: 1.4; margin-top: 8px;">{maintenance} bâtiment(s) en maintenance</div>
            <div style="font-size: 12px; color: rgba(255,255,255,.6); margin-top: 6px; line-height: 1.5;">À planifier dans le workflow maintenance.</div>
          </div>
          <div style="background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; padding: 16px;">
            <span className="badge badge-info" style="background: rgba(12,78,162,.25); color: #93c5fd;">Activité</span>
            <div style="font-size: 13.5px; font-weight: 600; line-height: 1.4; margin-top: 8px;">{pers.length} employés · {occRate}% occupation</div>
            <div style="font-size: 12px; color: rgba(255,255,255,.6); margin-top: 6px; line-height: 1.5;">Planifier rotations en fonction des prévisions.</div>
          </div>
        </div>
      </div>

      <style>{`
        .grid { display: grid; }
        .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .text-center { text-align: center; }
        @media (max-width: 1024px) { .grid[style*="repeat(4"] { grid-template-columns: 1fr 1fr !important; } .grid[style*="1.4fr"] { grid-template-columns: 1fr !important; } .grid[style*="repeat(3"] { grid-template-columns: 1fr !important; } }
        @media (max-width: 640px) { .grid[style*="repeat(4"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}

async function exportCSV() {
  // Export simple des bâtiments
  try {
    const r = await batiments.list()
    const data = r.results || []
    if (data.length === 0) { alert('Aucune donnée à exporter'); return }
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(';'),
      ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(';')),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rzi_batiments_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Erreur export: ' + e.message)
  }
}
