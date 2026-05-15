/**
 * RESTAURATION — Scanner QR
 * Stack: React 18 + Vite + html5-qrcode + Django REST
 * API: POST /api/qr/scanner/ {qr_data, type_repas}
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { qr as qrAPI } from '../api'

// Appels API — utilise le client axios partagé (même BASE URL que toute l'app)
async function apiScanQR(qr_data, type_repas) {
  try {
    const r = await qrAPI.scanner({ qr_data: qr_data.trim(), type_repas })
    return r.data
  } catch(e) {
    const msg = e.response?.data?.erreur || e.response?.data?.detail || e.message || 'Erreur'
    throw new Error(msg)
  }
}

async function apiGetRepas(type_repas) {
  try {
    const r = await qrAPI.repas({ type_repas, page_size: 100 })
    return r.data.results || r.data || []
  } catch { return [] }
}

// ── Configuration repas ───────────────────────────────────────────
const REPAS = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner', emoji: '🌅', color: '#f97316' },
  { key: 'dejeuner',       label: 'Déjeuner',       emoji: '☀️',  color: '#2563eb' },
  { key: 'diner',          label: 'Dîner',           emoji: '🌙',  color: '#7c3aed' },
]

// ══════════════════════════════════════════════════════════════════
// COMPOSANT SCANNER QR
// - Démarre caméra automatiquement
// - Scanne en continu (fps=12)
// - Cooldown 3s après chaque scan (évite les doublons)
// - Flash vert ✅ / orange ⛔ / rouge ❌
// ══════════════════════════════════════════════════════════════════
function QRScanner({ typeRepas, color, onSuccess }) {
  const [phase, setPhase]   = useState('init')   // init|scan|ok|already|error|nocam
  const [message, setMsg]   = useState('')
  const [agent, setAgent]   = useState(null)
  const scannerRef = useRef(null)
  const cooldown   = useRef(false)
  const alive      = useRef(true)

  useEffect(() => {
    alive.current = true
    startCamera()
    return () => { alive.current = false; stopCamera() }
  }, [typeRepas])

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop()  } catch {}
      try { scannerRef.current.clear()       } catch {}
      scannerRef.current = null
    }
  }

  async function startCamera() {
    await stopCamera()
    if (!alive.current) return
    setPhase('init'); setAgent(null); setMsg('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!alive.current) return
      const s = new Html5Qrcode('__qr_viewport__')
      scannerRef.current = s
      await s.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 260, height: 260 } },
        async (decoded) => {
          if (cooldown.current || !alive.current) return
          cooldown.current = true
          setPhase('loading')
          try {
            const data = await apiScanQR(decoded, typeRepas)
            if (!alive.current) return
            setPhase('ok'); setAgent(data)
            onSuccess && onSuccess(data)
          } catch (e) {
            if (!alive.current) return
            const msg = e.message || ''
            setMsg(msg)
            setPhase(msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('deja') ? 'already' : 'error')
          }
          setTimeout(() => {
            if (!alive.current) return
            cooldown.current = false
            setPhase('scan'); setAgent(null); setMsg('')
          }, 3000)
        },
        () => {}
      )
      setPhase('scan')
    } catch {
      if (!alive.current) return
      setPhase('nocam')
    }
  }

  // Couleurs par état
  const STATE = {
    init:    { bg: '#0f172a', border: color,      icon: '📡', text: 'Démarrage caméra...',           sub: '' },
    scan:    { bg: '#0f172a', border: color,      icon: '🔵', text: 'Présentez le QR code',          sub: 'Pointez vers le code du résident' },
    loading: { bg: '#78350f', border: '#f97316',  icon: '⏳', text: 'Validation en cours...',        sub: '' },
    ok:      { bg: '#14532d', border: '#16a34a',  icon: '✅', text: agent?.resident || 'Validé',     sub: agent?.societe || '' },
    already: { bg: '#7c2d12', border: '#ea580c',  icon: '⛔', text: message || 'Déjà consommé',      sub: 'Réessayez dans 3 secondes' },
    error:   { bg: '#450a0a', border: '#dc2626',  icon: '❌', text: message || 'QR non reconnu',     sub: 'Réessayez dans 3 secondes' },
    nocam:   { bg: '#1e1e2e', border: '#dc2626',  icon: '📵', text: 'Caméra inaccessible',           sub: 'Vérifiez les permissions' },
  }
  const s = STATE[phase] || STATE.scan

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: `2px solid ${s.border}`, transition: 'border-color .3s' }}>
      {/* Barre statut */}
      <div style={{ background: s.bg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, transition: 'background .3s' }}>
        <span style={{ fontSize: 30, flexShrink: 0 }}>{s.icon}</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{s.text}</div>
          {s.sub && <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11, marginTop: 2 }}>{s.sub}</div>}
        </div>
      </div>

      {/* Vue caméra */}
      <div style={{ background: '#000', position: 'relative', minHeight: 300 }}>
        <div id="__qr_viewport__" style={{ width: '100%' }} />

        {/* Viseur animé */}
        {phase === 'scan' && (
          <div style={{ position: 'absolute', inset: '40px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 220, height: 220, position: 'relative' }}>
              {[[0,0,1,1],[0,1,1,0],[1,0,0,1],[1,1,0,0]].map(([t,r,b,l],i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: t ? 'auto' : -2, bottom: b ? -2 : 'auto',
                  left: l ? 'auto' : -2, right: r ? -2 : 'auto',
                  width: 24, height: 24,
                  borderTop: !t ? `3px solid ${color}` : 'none',
                  borderBottom: !b ? 'none' : `3px solid ${color}`,
                  borderLeft: !l ? `3px solid ${color}` : 'none',
                  borderRight: !r ? 'none' : `3px solid ${color}`,
                  borderBottom: b ? `3px solid ${color}` : 'none',
                  borderTop: t ? 'none' : `3px solid ${color}`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Flash résultat */}
        {phase === 'ok' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(22,163,74,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 80 }}>✅</span>
          </div>
        )}
        {phase === 'already' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(234,88,12,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 80 }}>⛔</span>
          </div>
        )}
        {phase === 'error' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,38,38,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 80 }}>❌</span>
          </div>
        )}
        {phase === 'nocam' && (
          <div style={{ position: 'absolute', inset: 0, background: '#1e1e2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 52 }}>📵</span>
            <div style={{ color: '#f87171', fontSize: 13, fontWeight: 600 }}>Caméra inaccessible</div>
            <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', maxWidth: 200 }}>Autorisez l'accès dans les paramètres</div>
            <button onClick={startCamera} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              🔄 Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// PAGE RESTAURATION
// ══════════════════════════════════════════════════════════════════
export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const canScan = ['admin', 'restauration'].includes(role) || user?.is_staff || user?.is_superuser

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [tab, setTab]             = useState(canScan ? 'scanner' : 'mon_qr')
  const [todayList, setTodayList] = useState([])
  const [allRepas, setAllRepas]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [myQR, setMyQR]           = useState(null)
  const today = new Date().toISOString().slice(0, 10)

  const loadRepas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGetRepas(typeRepas)
      setAllRepas(data)
      setTodayList(data.filter(r => r.date_validation?.startsWith(today)))
    } catch {}
    finally { setLoading(false) }
  }, [typeRepas])

  useEffect(() => {
    if (canScan) loadRepas()
    else {
      import('../api').then(({ personnel: personnelAPI }) => {
        personnelAPI.monProfil()
          .then(r => setMyQR(r.data))
          .catch(() => {
            // Fallback: chercher par login_genere ou nom dans la liste
            personnelAPI.list({ page_size: 500 }).then(r => {
              const items = r.data.results || r.data || []
              // Essayer de trouver via le token décodé (username)
              const token = localStorage.getItem('access_token') || ''
              let username = ''
              try {
                username = JSON.parse(atob(token.split('.')[1])).username || ''
              } catch {}
              const me = items.find(p =>
                p.login_genere === username ||
                (username && p.nom && p.nom.toUpperCase().includes(username.toUpperCase()))
              ) || (items.length > 0 ? null : null)
              if (me) setMyQR(me)
            }).catch(() => {})
          })
      })
    }
  }, [typeRepas])

  const repas = REPAS.find(r => r.key === typeRepas)

  return (
    <div style={{ padding: 16 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)', margin: 0 }}>🍽️ Restauration</h2>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '3px 0 0' }}>
            {canScan ? 'Scannez le QR code du résident pour valider son repas' : 'Mon QR de repas · Historique'}
          </p>
        </div>
        {canScan && (
          <button onClick={loadRepas} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
            🔄 Actualiser
          </button>
        )}
      </div>

      {/* Sélecteur service */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {REPAS.map(r => (
          <button key={r.key} onClick={() => setTypeRepas(r.key)}
            style={{ flex: 1, padding: '9px 4px', borderRadius: 10, border: `2px solid ${typeRepas === r.key ? r.color : 'var(--border)'}`, background: typeRepas === r.key ? `${r.color}12` : 'var(--surface)', color: typeRepas === r.key ? r.color : 'var(--text-dim)', cursor: 'pointer', fontWeight: 600, fontSize: 11, transition: '.15s' }}>
            <div style={{ fontSize: 20 }}>{r.emoji}</div>
            <div>{r.label}</div>
          </button>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14, background: 'var(--surface2)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
        {(canScan
          ? [['scanner', '📷 Scanner'], ['auj', "Aujourd'hui"], ['hist', 'Historique']]
          : [['mon_qr', '📱 Mon QR'], ['mes_repas', '🍽️ Mes repas']]
        ).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); if (['auj', 'hist', 'mes_repas'].includes(k)) loadRepas() }}
            style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: tab === k ? 'var(--surface)' : 'transparent', color: tab === k ? 'var(--blue)' : 'var(--text-dim)', boxShadow: tab === k ? 'var(--shadow)' : 'none', transition: '.15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── SCANNER (restaurant/admin) ── */}
      {tab === 'scanner' && canScan && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, alignItems: 'start' }}>
          <QRScanner key={typeRepas} typeRepas={typeRepas} color={repas?.color || '#2563eb'}
            onSuccess={() => loadRepas()} />

          {/* Compteur + derniers */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 52, fontWeight: 900, color: repas?.color, lineHeight: 1 }}>{todayList.length}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Aujourd'hui</div>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {todayList.length === 0
                ? <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11 }}>Aucun scan</div>
                : todayList.map((r, i) => (
                  <div key={r.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: i === 0 ? `${repas?.color}08` : 'transparent' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--blue)' }}>{r.resident || '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {r.date_validation ? new Date(r.date_validation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── AUJOURD'HUI / HISTORIQUE ── */}
      {(tab === 'auj' || tab === 'hist') && (
        <RepasTable
          data={tab === 'auj' ? todayList : allRepas}
          title={tab === 'auj' ? `Aujourd'hui — ${repas?.emoji} ${repas?.label}` : `Historique — ${repas?.emoji} ${repas?.label}`}
          loading={loading}
          showDate={tab === 'hist'}
          repas={repas}
        />
      )}

      {/* ── MON QR (agent) ── */}
      {tab === 'mon_qr' && (
        <div style={{ maxWidth: 360, margin: '0 auto' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--blue)', marginBottom: 6 }}>📱 Mon QR de repas</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 18 }}>Présentez ce code au restaurant</div>
            {myQR?.qr_code_data
              ? <>
                  <div style={{ background: '#fff', padding: 10, borderRadius: 12, border: '3px solid var(--blue)', display: 'inline-block', marginBottom: 14 }}>
                    <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                      style={{ width: 220, height: 220, display: 'block', imageRendering: 'pixelated' }} />
                  </div>
                  <div style={{ background: 'var(--blue)', borderRadius: 10, padding: '10px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{myQR.nom} {myQR.prenom}</div>
                    <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 2 }}>{myQR.societe}</div>
                  </div>
                </>
              : <div style={{ padding: 32, color: 'var(--text-dim)' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>QR non disponible</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Contactez l'administrateur</div>
                </div>
            }
          </div>
          <button onClick={() => { setTab('mes_repas'); loadRepas() }}
            style={{ width: '100%', marginTop: 12, background: 'var(--blue)', color: '#fff', border: 'none', padding: 12, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            🍽️ Voir mes repas →
          </button>
        </div>
      )}

      {/* ── MES REPAS (agent) ── */}
      {tab === 'mes_repas' && (
        <RepasTable data={allRepas} title={`Mes repas — ${repas?.emoji} ${repas?.label}`} loading={loading} showDate repas={repas} />
      )}
    </div>
  )
}

// ── Tableau historique ────────────────────────────────────────────
function RepasTable({ data, title, loading, showDate, repas }) {
  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>⏳ Chargement...</div>
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 16px', background: 'var(--blue)', color: '#fff', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <span style={{ background: 'rgba(255,255,255,.2)', padding: '2px 10px', borderRadius: 20 }}>{data.length}</span>
      </div>
      {data.length === 0
        ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>Aucun repas
          </div>
        : <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--surface2)' }}>
                {[showDate && 'Date', 'Heure', 'Résident', 'Résidence'].filter(Boolean).map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{data.map((r, i) => {
                const dt = r.date_validation ? new Date(r.date_validation) : null
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--surface2)' : 'var(--surface)' }}>
                    {showDate && <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{dt?.toLocaleDateString('fr-FR') || '—'}</td>}
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)' }}>{dt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--blue)' }}>{r.resident || '—'}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-dim)' }}>{r.residence || '—'}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>
      }
    </div>
  )
}
