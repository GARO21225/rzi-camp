import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

// Page de contrôle en LECTURE SEULE : chaque valeur vient du serveur (/api/diagnostic/), rien n'est inventé,
// rien n'est modifié (plus de bouton d'initialisation de données).
const Ligne = ({ label, ok, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rzc-charcoal)', padding: '10px 14px', borderRadius: 8, gap: 10 }}>
    <span style={{ color: 'var(--rzc-text-3)', fontWeight: 600, fontSize: 13 }}>{label}</span>
    <span style={{ fontWeight: 800, fontSize: 13, color: ok === false ? '#dc2626' : ok === true ? '#166534' : 'var(--rzc-navy)' }}>{children}</span>
  </div>
)

export default function StatusPage() {
  const [diag, setDiag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [maj, setMaj] = useState(null)

  const charger = useCallback(() => {
    setLoading(true)
    api.get('/api/diagnostic/')
      .then(r => { setDiag(r.data); setMaj(new Date()) })
      .catch(e => setDiag({ error: e?.response?.data?.detail || e.message || 'Serveur injoignable' }))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { charger() }, [charger])

  const ok = diag && !diag.error && diag.status === 'ok'
  const c = diag?.compteurs || {}
  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <h2 style={{ fontWeight: 800, color: 'var(--rzc-navy)', marginBottom: 6 }}>🔧 Diagnostic Système</h2>
      <p style={{ fontSize: 12, color: 'var(--rzc-text-3)', marginBottom: 20 }}>
        Lecture seule — état réel du serveur{maj ? ` · mesuré à ${maj.toLocaleTimeString('fr-FR')}` : ''}
      </p>

      {loading && <div style={{ textAlign: 'center', padding: 40, fontSize: 32 }}>⏳</div>}

      {diag && !loading && (
        <>
          <div style={{ background: ok ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${ok ? '#86efac' : '#fca5a5'}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: ok ? '#166534' : '#991b1b' }}>
              {diag.error ? `❌ ${diag.error}` : ok ? '✅ Système opérationnel' : '⚠️ Système dégradé — voir les lignes en rouge'}
            </div>
          </div>

          {!diag.error && (
            <div style={{ background: 'var(--rzc-white)', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '11px 18px', borderBottom: '1px solid #e2e8f0', background: 'var(--rzc-charcoal)', fontWeight: 700, fontSize: 13, color: 'var(--rzc-navy)' }}>Services</div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Ligne label="🗄️ Base de données" ok={diag.database === 'connected'}>{diag.database === 'connected' ? `connectée (${diag.db_engine || '?'})` : 'déconnectée'}</Ligne>
                {diag.cache !== undefined && <Ligne label="⚡ Cache / Redis" ok={diag.cache === 'ok'}>{diag.cache === 'ok' ? 'opérationnel' : 'en panne'}</Ligne>}
                {diag.migrations_appliquees !== undefined && (
                  <Ligne label="📋 Migrations" ok={!diag.migrations_en_attente}>
                    {diag.migrations_appliquees} appliquées{diag.migrations_en_attente ? ` · ${diag.migrations_en_attente} EN ATTENTE` : ' · à jour'}
                  </Ligne>
                )}
                {diag.migrations_erreur && <Ligne label="📋 Migrations" ok={false}>{diag.migrations_erreur}</Ligne>}
                {diag.debug !== undefined && <Ligne label="🔒 Mode DEBUG" ok={!diag.debug}>{diag.debug ? 'ACTIF (à désactiver en production)' : 'désactivé'}</Ligne>}
                {diag.python && <Ligne label="🐍 Python / Django">{diag.python} / {diag.django}</Ligne>}
              </div>
            </div>
          )}

          {diag.compteurs && (
            <div style={{ background: 'var(--rzc-white)', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '11px 18px', borderBottom: '1px solid #e2e8f0', background: 'var(--rzc-charcoal)', fontWeight: 700, fontSize: 13, color: 'var(--rzc-navy)' }}>Données (comptes réels)</div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Ligne label="🔑 Utilisateurs">{c.utilisateurs}</Ligne>
                <Ligne label="👤 Personnel">{c.personnel}</Ligne>
                <Ligne label="🏗️ Bâtiments / chambres">{c.batiments}</Ligne>
                <Ligne label="🔧 Incidents">{c.incidents}</Ligne>
              </div>
            </div>
          )}

          <button onClick={charger} style={{ width: '100%', background: 'var(--rzc-navy)', color: 'var(--rzc-white)', border: 'none', padding: 12, borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            🔄 Actualiser
          </button>
        </>
      )}
    </div>
  )
}
