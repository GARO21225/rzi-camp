import React from 'react'
import { Activity, Server, Wifi, Cpu, HardDrive, Zap, AlertCircle, CheckCircle2 } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'

const SERVICES = [
  { name: 'API Gateway', status: 'operational', uptime: '99.98%', latency: '142ms', cpu: 28, mem: 45 },
  { name: 'PostgreSQL', status: 'operational', uptime: '99.99%', latency: '8ms', cpu: 42, mem: 67 },
  { name: 'Redis Cache', status: 'operational', uptime: '99.95%', latency: '2ms', cpu: 18, mem: 32 },
  { name: 'WebSocket Hub', status: 'operational', uptime: '99.92%', latency: '24ms', cpu: 56, mem: 71 },
  { name: 'Storage S3', status: 'operational', uptime: '99.99%', latency: '88ms', cpu: 12, mem: 28 },
  { name: 'Worker Queue', status: 'degraded', uptime: '99.78%', latency: '340ms', cpu: 89, mem: 92 },
  { name: 'Email Service', status: 'operational', uptime: '99.96%', latency: '210ms', cpu: 8, mem: 22 },
  { name: 'Map Tile Server', status: 'operational', uptime: '99.94%', latency: '67ms', cpu: 34, mem: 58 },
]

const STATUS_INFO = {
  operational: { label: 'Opérationnel', color: 'ok', icon: CheckCircle2 },
  degraded: { label: 'Dégradé', color: 'warn', icon: AlertCircle },
  down: { label: 'Hors service', color: 'alert', icon: AlertCircle },
}

export default function CentreOperationnel() {
  const ops = SERVICES.filter((s) => s.status === 'operational').length
  const total = SERVICES.length
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Centre Opérationnel</h1>
          <p className="page-sub">État temps réel des services · {ops}/{total} opérationnels · dernière vérif 30s</p>
        </div>
        <span className="badge badge-ok"><span className="dot dot-pulse dot-ok" />Live</span>
      </div>

      <div className="grid gap-4 mb-4" style={{   gridTemplateColumns: 'repeat(4 }}>
        {[
          { label: 'Uptime moyen', val: '99.94%', sub: '30j', color: 'emerald' },
          { label: 'Latence P95', val: '142ms', sub: 'API', color: 'emerald' },
          { label: 'Erreurs 5xx', val: '0.02%', sub: 'dernière heure', color: 'emerald' },
          { label: 'CPU cluster', val: '36%', sub: '8 services', color: 'copper' },
        ].map((k) => (
          <div key={k.label} className="card kpi hover-lift">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.val}</div>
            <div className={`kpi-delta ${k.color === 'alert' ? 'down' : 'up'}`}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{   overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Service</th>
              <th>Statut</th>
              <th>Uptime</th>
              <th>Latence</th>
              <th style={{   minWidth: 200 }}>CPU</th>
              <th style={{   minWidth: 200 }}>Mémoire</th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((s) => {
              const Icon = STATUS_INFO[s.status].icon
              return (
                <tr key={s.name}>
                  <td><strong>{s.name}</strong></td>
                  <td>
                    <span className={`badge badge-${STATUS_INFO[s.status].color}`}>
                      <Icon size={12} /> {STATUS_INFO[s.status].label}
                    </span>
                  </td>
                  <td style={{   fontFamily: 'var(--font-mono)' }}>{s.uptime}</td>
                  <td style={{   fontFamily: 'var(--font-mono)' }}>{s.latency}</td>
                  <td>
                    <ProgressBar value={s.cpu} color={s.cpu > 80 ? 'alert' : s.cpu > 60 ? 'warn' : 'emerald'} size="sm" showLabel />
                  </td>
                  <td>
                    <ProgressBar value={s.mem} color={s.mem > 80 ? 'alert' : s.mem > 60 ? 'warn' : 'emerald'} size="sm" showLabel />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        .grid { display: grid; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; }
        @media (max-width: 900px) { .grid[style*="repeat(4"] { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
    </div>
  )
}
