import React from 'react'
import { QrCode, ShieldCheck, Clock, Repeat, FileCheck } from 'lucide-react'

export default function QRScan() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">QR Code Anti-Fraude</h1>
          <p className="page-sub">Tokens rotatifs · cryptographie AES-256 · validation hors-ligne</p>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad-lg text-center">
          <div className="section-title" style={{ justifyContent: 'center' }}>Mon QR · rotation 30s</div>
          <div style={{ display: 'inline-block', padding: 16, background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-2)' }}>
            <svg width="200" height="200" viewBox="0 0 100 100">
              <rect x="0" y="0" width="100" height="100" fill="white" />
              <g fill="#001e42">
                <rect x="5" y="5" width="20" height="20" /><rect x="9" y="9" width="12" height="12" fill="white" /><rect x="12" y="12" width="6" height="6" fill="#001e42" />
                <rect x="75" y="5" width="20" height="20" /><rect x="79" y="9" width="12" height="12" fill="white" /><rect x="82" y="12" width="6" height="6" fill="#001e42" />
                <rect x="5" y="75" width="20" height="20" /><rect x="9" y="79" width="12" height="12" fill="white" /><rect x="12" y="82" width="6" height="6" fill="#001e42" />
                <rect x="30" y="8" width="3" height="3" /><rect x="35" y="8" width="3" height="3" /><rect x="40" y="10" width="3" height="3" />
                <rect x="45" y="6" width="3" height="3" /><rect x="50" y="12" width="3" height="3" /><rect x="55" y="8" width="3" height="3" />
                <rect x="60" y="10" width="3" height="3" /><rect x="30" y="15" width="3" height="3" /><rect x="38" y="18" width="3" height="3" />
                <rect x="48" y="20" width="3" height="3" /><rect x="58" y="15" width="3" height="3" /><rect x="68" y="18" width="3" height="3" />
                <rect x="8" y="30" width="3" height="3" /><rect x="14" y="35" width="3" height="3" /><rect x="20" y="32" width="3" height="3" />
                <rect x="26" y="38" width="3" height="3" /><rect x="32" y="35" width="3" height="3" /><rect x="40" y="30" width="3" height="3" />
                <rect x="48" y="35" width="3" height="3" /><rect x="55" y="32" width="3" height="3" /><rect x="62" y="38" width="3" height="3" />
                <rect x="70" y="35" width="3" height="3" /><rect x="78" y="32" width="3" height="3" /><rect x="85" y="35" width="3" height="3" />
                <rect x="90" y="30" width="3" height="3" />
                <rect x="30" y="72" width="3" height="3" /><rect x="38" y="78" width="3" height="3" /><rect x="45" y="75" width="3" height="3" />
                <rect x="52" y="78" width="3" height="3" /><rect x="58" y="72" width="3" height="3" /><rect x="65" y="78" width="3" height="3" />
              </g>
            </svg>
          </div>
          <div style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.1em' }}>
            TOKEN: 8F2A · 9C1D · 4E7B · 6A3F
          </div>
          <div className="flex items-center justify-center gap-2 mt-2" style={{ fontSize: 12 }}>
            <span className="dot dot-pulse dot-ok" />
            <span>Renouvellement dans <strong>24s</strong></span>
          </div>
        </div>

        <div className="card card-pad-lg">
          <div className="section-title">Comment ça marche</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { n: 1, t: 'QR unique toutes les 30s', d: 'Basé sur HMAC-SHA256 + timestamp + user_id. Impossible à dupliquer.' },
              { n: 2, t: 'Validation hors-ligne', d: 'Le scanner vérifie la signature localement avant de sync. Pas de dépendance réseau.' },
              { n: 3, t: "Détection d'anomalies", d: 'Doublons, scans multiples rapides, QR expirés → alerte instantanée.' },
              { n: 4, t: 'Audit immuable', d: 'Chaque scan signé et horodaté est inscrit dans le registre de conformité.' },
            ].map((s) => (
              <div key={s.n} className="flex gap-3">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gold-100)', color: 'var(--gold-800)', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.t}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-center { justify-content: center; }
        .text-center { text-align: center; }
        .mt-2 { margin-top: 8px; }
        @media (max-width: 768px) { .grid[style*="1fr 1fr"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
