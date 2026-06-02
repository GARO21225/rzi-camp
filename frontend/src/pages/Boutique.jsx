import React, { useState } from 'react'
import { ShoppingCart, Plus, Package, AlertCircle, TrendingUp, DollarSign } from 'lucide-react'
import BarChart from '../components/BarChart'
import ProgressBar from '../components/ProgressBar'

const ARTICLES = [
  { id: 1, name: 'Café 250g', cat: 'Boissons', stock: 42, min: 20, prix: 2500, vendus: 38 },
  { id: 2, name: 'Eau 1.5L', cat: 'Boissons', stock: 8, min: 30, prix: 800, vendus: 124 },
  { id: 3, name: 'Sandwich poulet', cat: 'Snacking', stock: 12, min: 15, prix: 3500, vendus: 56 },
  { id: 4, name: 'Cigarettes Marlboro', cat: 'Tabac', stock: 28, min: 10, prix: 1500, vendus: 89 },
  { id: 5, name: 'Chargeur USB-C', cat: 'Électronique', stock: 5, min: 8, prix: 4500, vendus: 12 },
  { id: 6, name: 'Coca-Cola 33cl', cat: 'Boissons', stock: 96, min: 30, prix: 1200, vendus: 78 },
  { id: 7, name: 'Biscuits Prince', cat: 'Snacking', stock: 18, min: 25, prix: 800, vendus: 32 },
]

export default function Boutique() {
  const [filter, setFilter] = useState('all')
  const alerts = ARTICLES.filter((a) => a.stock < a.min)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Boutique</h1>
          <p className="page-sub">{ARTICLES.length} articles · {alerts.length} en alerte stock · CA jour 247 800 FCFA</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost">Export</button>
          <button className="btn btn-primary"><Plus size={14} /> Nouvel article</button>
        </div>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'CA jour', val: '247K', sub: 'FCFA', color: 'emerald' },
          { label: 'Articles vendus', val: 429, sub: '↑ 12%', color: 'emerald' },
          { label: 'Stock faible', val: alerts.length, sub: 'à réapprovisionner', color: alerts.length > 0 ? 'alert' : 'emerald' },
          { label: 'Crédits actifs', val: 84, sub: 'soldes à jour', color: 'copper' },
        ].map((k) => (
          <div key={k.label} className="card kpi hover-lift">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.val}</div>
            <div className={`kpi-delta ${k.color === 'alert' ? 'down' : 'up'}`}>{k.sub}</div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="card card-pad mb-4" style={{ background: 'rgba(220,38,38,.04)', borderColor: 'rgba(220,38,38,.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} color="var(--status-alert)" />
            <strong style={{ color: 'var(--status-alert)' }}>{alerts.length} articles en stock critique</strong>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {alerts.map((a) => (
              <span key={a.id} className="badge badge-alert">{a.name} · {a.stock}/{a.min}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Article</th>
              <th>Catégorie</th>
              <th>Stock</th>
              <th>Vendus</th>
              <th>Prix</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {ARTICLES.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong></td>
                <td>{a.cat}</td>
                <td style={{ minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <ProgressBar value={a.stock} max={a.min * 2} color={a.stock < a.min ? 'alert' : a.stock < a.min * 1.5 ? 'warn' : 'emerald'} size="sm" />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{a.stock}</span>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{a.vendus}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{a.prix.toLocaleString('fr-FR')} F</td>
                <td>
                  <span className={`badge badge-${a.stock < a.min ? 'alert' : a.stock < a.min * 1.5 ? 'warn' : 'ok'}`}>
                    {a.stock < a.min ? 'Critique' : a.stock < a.min * 1.5 ? 'Faible' : 'OK'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`.grid { display: grid; } .gap-2 { gap: 8px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; } .flex { display: flex; } .items-center { align-items: center; } @media (max-width: 900px) { .grid[style*="repeat(4"] { grid-template-columns: 1fr 1fr !important; } }`}</style>
    </div>
  )
}
