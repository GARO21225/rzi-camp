/**
 * RESTAURATION — Scanner QR Personnel
 * Interface simplifiée pour le restaurant : scan QR + historique
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { qr as qrAPI } from '../api'

// ── Configuration repas ───────────────────────────────────────────
const REPAS = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner', emoji: '🌅', color: '#f97316' },
  { key: 'dejeuner',       label: 'Déjeuner',       emoji: '☀️',  color: '#2563eb' },
  { key: 'diner',          label: 'Dîner',           emoji: '🌙',  color: '#7c3aed' },
]

// ── Appels API ─────────────────────────────────────────────────────
async function apiScanPersonnel(qr_data, type_repas) {
  try {
    const r = await qrAPI.scannerPersonnel({ qr_data: qr_data.trim(), type_repas })
    return r.data
  } catch(e) {
    const msg = e.response?.data?.erreur || e.response?.data?.detail || e.message || 'Erreur réseau'
    throw new Error(msg)
  }
}

async function apiGetHistorique(type_repas) {
  try {
    const r = await qrAPI.historiqueScans({ type_repas, page_size: 200 })
    return r.data.results || r.data || []
  } catch { return [] }
}

// ── Scanner QR ─────────────────────────────────────────────────────
function QRScanner({ typeRepas, onSuccess, onError }) {
  const [phase, setPhase] = useState('init')
  const [message, setMsg] = useState('')
  const [result, setResult] = useState(null)
  const scannerRef = useRef(null)
  const cooldown = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    startCamera()
    return () => { alive.current = false; stopCamera() }
  }, [typeRepas])

  async function stopCamera() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
  }

  async function startCamera() {
    await stopCamera()
    if (!alive.current) return
    setPhase('init'); setResult(null); setMsg('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!alive.current) return
      const s = new Html5Qrcode('qr_viewport')
      scannerRef.current = s
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          if (cooldown.current || !alive.current) return
          cooldown.current = true
          setPhase('loading')
          try {
            const data = await apiScanPersonnel(decoded, typeRepas)
            if (!alive.current) return
            setPhase('ok'); setResult(data)
            onSuccess && onSuccess(data)
          } catch (e) {
            if (!alive.current) return
            const msg = e.message || ''
            setMsg(msg)
            setPhase(msg.toLowerCase().includes('déjà') ? 'already' : 'error')
            onError && onError(msg)
          }
          setTimeout(() => {
            if (!alive.current) return
            cooldown.current = false
            setPhase('scan'); setResult(null); setMsg('')
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

  const PHASE_CONFIG = {
    init:    { bg: '#1e293b', icon: '📡', text: 'Démarrage caméra...', sub: '' },
    scan:    { bg: '#1e293b', icon: '📷', text: 'Scannez le QR', sub: 'Pointez vers le code du personnel' },
    loading: { bg: '#78350f', icon: '⏳', text: 'Validation...', sub: '' },
    ok:      { bg: '#14532d', icon: '✅', text: result?.resident || 'Validé', sub: result?.societe || '' },
    already: { bg: '#7c2d12', icon: '⛔', text: message || 'Déjà pris', sub: 'Réessayez dans 3s' },
    error:   { bg: '#450a0a', icon: '❌', text: 'Erreur', sub: message || 'Réessayez dans 3s' },
    nocam:   { bg: '#1e1e2e', icon: '📵', text: 'Caméra indisponible', sub: '' },
  }
  const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG.scan

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `3px solid ${cfg.bg}`, background: '#0f172a' }}>
      {/* Status bar */}
      <div style={{ background: cfg.bg, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }}>{cfg.icon}</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{cfg.text}</div>
          {cfg.sub && <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, marginTop: 2 }}>{cfg.sub}</div>}
        </div>
      </div>

      {/* Camera view */}
      <div style={{ background: '#000', position: 'relative', minHeight: 280 }}>
        <div id="qr_viewport" style={{ width: '100%' }} />

        {/* Crosshair */}
        {phase === 'scan' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 200, height: 200, border: '3px solid rgba(124,58,237,.6)', borderRadius: 12 }} />
          </div>
        )}

        {/* Flash overlay */}
        {phase === 'ok' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(22,163,74,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 72 }}>✅</span>
          </div>
        )}
        {phase === 'already' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(234,88,12,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 72 }}>⛔</span>
          </div>
        )}
        {phase === 'error' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,38,38,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 72 }}>❌</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Carte stats ────────────────────────────────────────────────────
function StatsCard({ count, title, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: `2px solid ${color}`, borderRadius: 14, padding: 20, textAlign: 'center' }}>
      <div style={{ fontFamily: 'monospace', fontSize: 48, fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
    </div>
  )
}

// ── Liste historique ────────────────────────────────────────────────
function HistoriqueList({ data, onRefresh }) {
  const today = new Date().toISOString().slice(0, 10)
  const todayItems = data.filter(r => r.date_validation?.startsWith(today))
  const todayCount = todayItems.length
  const totalCount = data.length

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatsCard count={todayCount} title="Aujourd'hui" color="#16a34a" />
        <StatsCard count={totalCount} title="Total scans" color="#2563eb" />
      </div>

      {/* Liste */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 16px', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>👥 Personnel scanné</span>
          <span style={{ background: 'rgba(255,255,255,.2)', padding: '2px 10px', borderRadius: 20 }}>{todayItems.length}</span>
        </div>

        {todayItems.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍽️</div>
            <div>Aucun scan aujourd'hui</div>
          </div>
        ) : (
          <div style={{ maxHeight: 350, overflowY: 'auto' }}>
            {todayItems.map((r, i) => {
              const dt = r.date_validation ? new Date(r.date_validation) : null
              return (
                <div key={r.id || i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: i === 0 ? 'rgba(124,58,237,.06)' : 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--blue)' }}>{r.resident || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                        {r.societe || ''}
                        {r.type_repas_label && ` • ${r.type_repas_label}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>
                        {dt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.valide_par_nom || '—'}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button onClick={onRefresh} style={{ width: '100%', marginTop: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', padding: 10, borderRadius: 10, cursor: 'pointer', fontSize: 12 }}>
        🔄 Actualiser
      </button>
    </div>
  )
}

// ── PAGE PRINCIPALE ────────────────────────────────────────────────
export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isResto = ['admin', 'restauration'].includes(role) || user?.is_staff || user?.is_superuser

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [historique, setHistorique] = useState([])
  const [loading, setLoading] = useState(false)
  const [myQR, setMyQR] = useState(null)

  const repas = REPAS.find(r => r.key === typeRepas)
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = historique.filter(r => r.date_validation?.startsWith(today)).length

  const loadHistorique = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGetHistorique(typeRepas)
      setHistorique(data)
    } catch { setHistorique([]) }
    finally { setLoading(false) }
  }, [typeRepas])

  useEffect(() => {
    if (isResto) {
      loadHistorique()
    } else {
      // Agents: voir leur propre QR
      import('../api').then(({ personnel: personnelAPI }) => {
        personnelAPI.monProfil()
          .then(r => setMyQR(r.data))
          .catch(() => {})
      })
    }
  }, [typeRepas])

  // ── Interface Restaurant (scan personnel) ──
  if (isResto) {
    return (
      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed', margin: 0 }}>🍽️ Restaurant</h2>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Scan QR du personnel</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={loadHistorique} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
              🔄
            </button>
          </div>
        </div>

        {/* Sélecteur repas */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {REPAS.map(r => (
            <button key={r.key} onClick={() => setTypeRepas(r.key)}
              style={{ flex: 1, padding: '10px 4px', borderRadius: 12, border: `2px solid ${typeRepas === r.key ? r.color : 'var(--border)'}`, background: typeRepas === r.key ? `${r.color}15` : 'var(--surface)', color: typeRepas === r.key ? r.color : 'var(--text-dim)', cursor: 'pointer', fontWeight: 700, fontSize: 11, transition: '.15s' }}>
              <div style={{ fontSize: 22 }}>{r.emoji}</div>
              <div>{r.label}</div>
            </button>
          ))}
        </div>

        {/* Layout : Scanner + Historique */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
          {/* Scanner */}
          <div>
            <QRScanner
              key={typeRepas}
              typeRepas={typeRepas}
              onSuccess={() => loadHistorique()}
            />
          </div>

          {/* Historique */}
          <HistoriqueList data={historique} onRefresh={loadHistorique} />
        </div>
      </div>
    )
  }

  // ── Interface Agent (mon QR) ──
  return (
    <div style={{ padding: 16 }}>
      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <div style={{ background: 'var(--surface)', border: '2px solid #7c3aed', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#7c3aed', marginBottom: 6 }}>📱 Mon QR Restaurant</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16 }}>Présentez ce code au restaurant</div>

          {myQR?.qr_code_data ? (
            <>
              <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '3px solid #7c3aed', display: 'inline-block', marginBottom: 14 }}>
                <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR" style={{ width: 200, height: 200, display: 'block' }} />
              </div>
              <div style={{ background: '#7c3aed', borderRadius: 10, padding: '10px 16px' }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{myQR.nom} {myQR.prenom}</div>
                <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11, marginTop: 2 }}>{myQR.societe}</div>
              </div>
            </>
          ) : (
            <div style={{ padding: 32, color: 'var(--text-dim)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>QR non disponible</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}