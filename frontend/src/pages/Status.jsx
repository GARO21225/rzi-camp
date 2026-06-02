import React, { useEffect, useState } from 'react'
import { Server, Database, Cloud, Zap, CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'

const COMPONENTS = [
  { name: 'API Production', status: 'operational', desc: 'Tous les endpoints fonctionnent' },
  { name: 'Base de données', status: 'operational', desc: 'PostgreSQL · répliqué' },
  { name: 'Stockage fichiers', status: 'operational', desc: 'S3 · 4.2 TB utilisés' },
  { name: 'WebSocket Hub', status: 'operational', desc: 'Notifications temps réel' },
  { name: 'CDN', status: 'operational', desc: 'Cloudflare · edge 12' },
  { name: 'Email Transactionnel', status: 'degraded', desc: 'Latence élevée · 1.2s' },
  { name: 'SMS Gateway', status: 'operational', desc: 'Twilio · multi-pays' },
  { name: 'Tâches planifiées', status: 'operational', desc: 'Celery · 24 workers' },
]

const INCIDENTS = [
  { date: '28 mai 2026', title: 'Latence email', status: 'resolved', desc: 'Latence SMTP revenue à la normale. Aucun email perdu.' },
  { date: '15 mai 2026', title: 'Maintenance S3', status: 'completed', desc: 'Migration vers le nouveau bucket terminée sans interruption.' },
  { date: '02 mai 2026', title: 'Pic de charge WebSocket', status: 'resolved', desc: 'Auto-scaling déclenché. 5min de latence sur les notifs.' },
]

const STATUS_META = {
  operational: { label: 'Opérationnel', color: 'ok', icon: CheckCircle2 },
  degraded: { label: 'Dégradé', color: 'warn', icon: AlertTriangle },
  down: { label: 'Hors service', color: 'alert', icon: XCircle },
}

export default function Status() {
  const [lastCheck, setLastCheck] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setLastCheck(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const overall = COMPONENTS.every((c) => c.status === 'operational') ? 'operational' :
    COMPONENTS.some((c) => c.status === 'down') ? 'down' : 'degraded'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Status Système</h1>
          <p className="page-sub">Santé de l'infrastructure · dernière vérif {lastCheck.toLocaleTimeString('fr-FR')}</p>
        </div>
        <span className={`badge badge-${STATUS_META[overall].color}`}>
          <span className={`dot dot-pulse dot-${overall === 'operational' ? 'ok' : overall === 'degraded' ? 'warn' : 'alert'}`} />
          {STATUS_META[overall].label}
        </span>
      </div>

      <div className="card card-pad-lg mb-4" style={{   textAlign: 'center',   background: overall === 'operational' ? 'var(--emerald-50)' : 'rgba(245,   borderColor: overall === 'operational' ? 'var(--emerald-100)' : 'rgba(245 }}>
        <div style={{   fontSize: 48,   marginBottom: 12 }}>
          {overall === 'operational' ? '✅' : overall === 'degraded' ? '⚠️' : '🚨'}
        </div>
        <h2 style={{   fontSize: 22,   fontWeight: 700,   color: 'var(--text)' }}>
          {overall === 'operational' ? 'Tous les systèmes fonctionnent' : overall === 'degraded' ? 'Système dégradé' : 'Incident en cours'}
        </h2>
        <p style={{   fontSize: 14,   color: 'var(--text-3)',   marginTop: 8 }}>
          Dernière vérif automatique il y a {Math.floor((new Date() - lastCheck) / 1000)}s
        </p>
      </div>

      <div className="grid gap-4 mb-4" style={{   gridTemplateColumns: '1fr 1fr' }}>
        {COMPONENTS.map((c) => {
          const Icon = STATUS_META[c.status].icon
          return (
            <div key={c.name} className="card card-pad flex items-center gap-3 hover-lift">
              <div style={{   width: 44,   height: 44,   borderRadius: 10,   background: c.status === 'operational' ? 'var(--emerald-100)' : c.status === 'degraded' ? 'rgba(245,   .15)': 'rgba(220,   color: c.status === 'operational' ? 'var(--emerald-700)' : c.status === 'degraded' ? 'var(--status-warn)' : 'var(--status-alert)',   display: 'grid',   placeItems: 'center',   flexShrink: 0 }}>
                <Icon size={20} />
              </div>
              <div style={{   flex: 1,   minWidth: 0 }}>
                <div style={{   fontSize: 14,   fontWeight: 600 }}>{c.name}</div>
                <div style={{   fontSize: 12,   color: 'var(--text-3)',   marginTop: 2 }}>{c.desc}</div>
              </div>
              <span className={`badge badge-${STATUS_META[c.status].color}`}>{STATUS_META[c.status].label}</span>
            </div>
          )
        })}
      </div>

      <div className="card card-pad-lg">
        <h3 style={{   fontSize: 15,   fontWeight: 700,   marginBottom: 16 }}>📋 Historique des incidents</h3>
        <div style={{   display: 'flex',   flexDirection: 'column',   gap: 12 }}>
          {INCIDENTS.map((inc, i) => (
            <div key={i} style={{   padding: 14,   background: 'var(--bg-2)',   borderRadius: 10,   borderLeft: '3px solid var(--emerald-500)' }}>
              <div className="flex items-center gap-2">
                <strong style={{   fontSize: 13 }}>{inc.title}</strong>
                <span className="badge badge-ok" style={{   marginLeft: 'auto' }}>Résolu</span>
              </div>
              <div style={{   fontSize: 12,   color: 'var(--text-3)',   marginTop: 4 }}>{inc.date} · {inc.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .text-center { text-align: center; }
        @media (max-width: 768px) { .grid[style*="1fr 1fr"], .grid[style*="repeat(4"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
