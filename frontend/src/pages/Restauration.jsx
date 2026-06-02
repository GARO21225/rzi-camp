import React from 'react'
import { Camera, AlertCircle, CheckCircle2, Coffee, UtensilsCrossed, Moon } from 'lucide-react'
import BarChart from '../components/BarChart'

export default function Restauration() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Restauration & QR Anti-Fraude</h1>
          <p className="page-sub">Service du soir · 1 247 repas prévus · Menu : Riz sauce arachide</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost">Historique</button>
          <button className="btn btn-primary">Générer QR repas</button>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="card card-pad-lg text-center">
          <div className="section-title" style={{ justifyContent: 'center' }}>Scanner QR</div>
          <div className="qr-scanner">
            <div className="qr-grid" />
            <div className="qr-corners"><div className="bl" /><div className="br" /></div>
            <div className="qr-line" />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 12 }}>Pointe la caméra vers le QR</div>
        </div>

        <div className="card card-pad-lg">
          <div className="section-title">🍽️ Services du jour</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: <Coffee size={16} />, label: 'Petit-déjeuner', time: '06:00 — 08:30', val: 412, trend: '+3%', color: 'var(--bg-2)', trendColor: 'var(--emerald-600)' },
              { icon: <UtensilsCrossed size={16} />, label: 'Déjeuner', time: '12:00 — 14:00', val: 628, trend: 'en cours', color: 'var(--copper-50)', trendColor: 'var(--copper-700)', live: true },
              { icon: <Moon size={16} />, label: 'Dîner', time: '19:00 — 21:30', val: null, trend: 'à venir', color: 'var(--bg-2)', trendColor: 'var(--text-3)' },
            ].map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: s.color, borderRadius: 10, border: s.live ? '1px solid var(--copper-200)' : 'none' }}>
                <div className="flex gap-2 items-center">
                  <span style={{ color: 'var(--copper-600)' }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label} {s.live && <span className="dot dot-pulse dot-info" style={{ display: 'inline-block', marginLeft: 4 }} />}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.time}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{s.val ?? '—'}</div>
                  <div style={{ fontSize: 10, color: s.trendColor, fontWeight: 600 }}>{s.trend}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad-lg">
          <div className="section-title">🛡️ Anti-fraude</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 10, display: 'flex', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--status-alert)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800 }}>!</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Doublon B12 · 14:32</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>3 scans même ID en 5min</div>
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.18)', borderRadius: 10, display: 'flex', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--status-warn)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>⚠</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>QR expiré · 14:18</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Tentative bloquée</div>
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--emerald-50)', border: '1px solid var(--emerald-100)', borderRadius: 10, display: 'flex', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--emerald-600)', color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>✓</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Audit OK · 14:00</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>142 scans validés</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad-lg mt-4">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Consommation repas · 7 jours</h3>
        <BarChart
          data={[
            { label: 'Lundi', value: 1380, color: 'var(--emerald-500)' },
            { label: 'Mardi', value: 1421, color: 'var(--emerald-500)' },
            { label: 'Mercredi', value: 1395, color: 'var(--emerald-500)' },
            { label: 'Jeudi', value: 1450, color: 'var(--emerald-500)' },
            { label: 'Vendredi', value: 1467, color: 'var(--emerald-500)' },
            { label: 'Samedi', value: 1240, color: 'var(--emerald-500)' },
            { label: 'Dimanche', value: 1210, color: 'var(--emerald-500)' },
          ]}
          unit=" repas"
        />
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .text-center { text-align: center; }
        .mt-4 { margin-top: 16px; }
        .qr-scanner { aspect-ratio: 1; max-width: 280px; margin: 0 auto; background: var(--ink-900); border-radius: var(--radius-lg); position: relative; overflow: hidden; border: 2px solid var(--gold-500); box-shadow: 0 0 0 6px rgba(255,205,0,.10), 0 20px 50px rgba(0,0,0,.3); }
        .qr-corners::before, .qr-corners > div { position: absolute; width: 32px; height: 32px; border-color: var(--gold-500); }
        .qr-corners::before { content: ""; top: 24px; left: 24px; border-top: 3px solid; border-left: 3px solid; border-top-left-radius: 6px; }
        .qr-corners::after { content: ""; top: 24px; right: 24px; border-top: 3px solid; border-right: 3px solid; border-top-right-radius: 6px; }
        .qr-corners .bl { position: absolute; bottom: 24px; left: 24px; border-bottom: 3px solid var(--gold-500); border-left: 3px solid var(--gold-500); width: 32px; height: 32px; border-bottom-left-radius: 6px; }
        .qr-corners .br { position: absolute; bottom: 24px; right: 24px; border-bottom: 3px solid var(--gold-500); border-right: 3px solid var(--gold-500); width: 32px; height: 32px; border-bottom-right-radius: 6px; }
        .qr-line { position: absolute; left: 24px; right: 24px; height: 2px; background: linear-gradient(90deg, transparent, var(--gold-500), transparent); box-shadow: 0 0 12px var(--gold-500); animation: scan 2s ease-in-out infinite; }
        .qr-grid { position: absolute; inset: 24px; background-image: linear-gradient(to right, rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 8px 8px; }
        @keyframes scan { 0% { top: 24px; } 50% { top: calc(100% - 26px); } 100% { top: 24px; } }
        @media (max-width: 900px) { div[style*="1fr 1fr 1fr"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
