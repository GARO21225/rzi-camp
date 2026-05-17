/**
 * RESTAURATION — Scanner QR Personnel
 * Interface complète pour le restaurant : scan QR + historique + statistiques
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { qr as qrAPI } from '../api'

// ── Configuration repas ───────────────────────────────────────────
const REPAS = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner', emoji: '🌅', color: '#f97316', heure: '06:00 - 10:00' },
  { key: 'dejeuner',        label: 'Déjeuner',       emoji: '☀️',  color: '#2563eb', heure: '11:00 - 14:30' },
  { key: 'diner',           label: 'Dîner',          emoji: '🌙',  color: '#7c3aed', heure: '18:30 - 21:00' },
]

// ── Sons feedback ─────────────────────────────────────────────────
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = 0.15
    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    } else if (type === 'error') {
      osc.frequency.setValueAtTime(300, ctx.currentTime)
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15)
    } else if (type === 'already') {
      osc.frequency.setValueAtTime(400, ctx.currentTime)
      osc.frequency.setValueAtTime(350, ctx.currentTime + 0.2)
    }
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
  } catch {}
}

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

async function apiGetHistorique(type_repas, jours = 7) {
  try {
    const r = await qrAPI.repas({ page_size: 500, type_repas })
    const all = r.data.results || r.data || []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - jours)
    return all.filter(item => {
      const itemDate = new Date(item.date_validation || item.cree_le)
      return itemDate >= cutoff && item.type_repas === type_repas
    })
  } catch { return [] }
}

async function apiGetStats(type_repas) {
  try {
    const all = await qrAPI.repas({ page_size: 500, type_repas })
    const data = all.data.results || all.data || []
    const today = new Date().toISOString().slice(0, 10)
    const todayItems = data.filter(r => (r.date_validation || r.cree_le || '').slice(0, 10) === today)
    return {
      today: todayItems.length,
      semaine: data.length,
      lastScan: data[0] || null
    }
  } catch { return { today: 0, semaine: 0, lastScan: null } }
}

async function apiViderHistorique(type_repas) {
  try {
    await qrAPI.viderHistorique(type_repas)
    return true
  } catch { return false }
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
        { fps: 10, qrbox: { width: 200, height: 200 } },
        async (decoded) => {
          if (cooldown.current || !alive.current) return
          cooldown.current = true
          setPhase('loading')
          setMsg('')
          try {
            const data = await apiScanPersonnel(decoded, typeRepas)
            if (!alive.current) return
            setPhase('ok'); setResult(data)
            setMsg(data.resident || 'Validé')
            playSound('success')
            onSuccess && onSuccess(data)
          } catch (e) {
            if (!alive.current) return
            const msg = e.message || ''
            setMsg(msg)
            const isAlready = msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('déja')
            setPhase(isAlready ? 'already' : 'error')
            playSound(isAlready ? 'already' : 'error')
            onError && onError(msg)
          }
          setTimeout(() => {
            if (!alive.current) return
            cooldown.current = false
            setPhase('scan'); setResult(null); setMsg('')
          }, 3500)
        },
        () => {}
      )
      setPhase('scan')
    } catch {
      if (!alive.current) return
      setPhase('nocam')
      setMsg('Caméra indisponible - Veuillez autoriser l\'accès')
    }
  }

  const PHASE_CONFIG = {
    init:    { bg: '#1e293b', icon: '📡', text: 'Démarrage...', sub: 'Veuillez autoriser la caméra' },
    scan:    { bg: '#1e293b', icon: '📷', text: 'Scanner actif', sub: 'Approchez un QR code' },
    loading: { bg: '#78350f', icon: '⏳', text: 'Validation...', sub: 'Veuillez patienter' },
    ok:      { bg: '#14532d', icon: '✅', text: message || 'Validé', sub: result?.societe || '' },
    already: { bg: '#7c2d12', icon: '⛔', text: 'Déjà pris', sub: message || 'Repas déjà validé aujourd\'hui' },
    error:   { bg: '#450a0a', icon: '❌', text: 'QR non reconnu', sub: message || 'Vérifiez le code QR' },
    nocam:   { bg: '#1e1e2e', icon: '📵', text: 'Caméra indisponible', sub: 'Veuillez autoriser l\'accès à la caméra' },
  }
  const cfg = PHASE_CONFIG[phase] || PHASE_CONFIG.scan

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `3px solid ${cfg.bg}`, background: '#0f172a' }}>
      {/* Status bar */}
      <div style={{ background: cfg.bg, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>{cfg.icon}</span>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{cfg.text}</div>
          {cfg.sub && <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, marginTop: 3 }}>{cfg.sub}</div>}
        </div>
      </div>

      {/* Camera view */}
      <div style={{ background: '#000', position: 'relative', minHeight: 260 }}>
        <div id="qr_viewport" style={{ width: '100%', minHeight: 280 }} />

        {/* Crosshair guide */}
        {phase === 'scan' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 180, height: 180, border: '2px solid rgba(124,58,237,.7)', borderRadius: 16, position: 'relative' }}>
              {/* Corner accents */}
              <div style={{ position: 'absolute', top: -3, left: -3, width: 30, height: 30, borderTop: '4px solid #7c3aed', borderLeft: '4px solid #7c3aed', borderRadius: '8px 0 0 0' }} />
              <div style={{ position: 'absolute', top: -3, right: -3, width: 30, height: 30, borderTop: '4px solid #7c3aed', borderRight: '4px solid #7c3aed', borderRadius: '0 8px 0 0' }} />
              <div style={{ position: 'absolute', bottom: -3, left: -3, width: 30, height: 30, borderBottom: '4px solid #7c3aed', borderLeft: '4px solid #7c3aed', borderRadius: '0 0 0 8px' }} />
              <div style={{ position: 'absolute', bottom: -3, right: -3, width: 30, height: 30, borderBottom: '4px solid #7c3aed', borderRight: '4px solid #7c3aed', borderRadius: '0 0 8px 0' }} />
            </div>
          </div>
        )}

        {/* Flash overlays */}
        {phase === 'ok' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(22,163,74,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 60 }}>✅</span>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginTop: 10 }}>{result?.resident}</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 4 }}>{result?.societe}</div>
          </div>
        )}
        {phase === 'already' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(234,88,12,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 60 }}>⛔</span>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginTop: 10 }}>Déja pris</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 4, textAlign: 'center', padding: '0 20px' }}>{message}</div>
          </div>
        )}
        {phase === 'error' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(220,38,38,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 80 }}>❌</span>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginTop: 10 }}>Non reconnu</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 4, textAlign: 'center', padding: '0 20px' }}>{message}</div>
          </div>
        )}
        {phase === 'nocam' && (
          <div style={{ position: 'absolute', inset: 0, background: '#1e1e2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <span style={{ fontSize: 64 }}>📵</span>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 16, textAlign: 'center' }}>Caméra indisponible</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
              Pour scanner les codes QR, veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur.
            </div>
            <button onClick={() => startCamera()} style={{ marginTop: 20, background: '#7c3aed', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
              🔄 Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Retry hint */}
      {(phase === 'ok' || phase === 'already' || phase === 'error') && (
        <div style={{ background: 'rgba(0,0,0,.4)', padding: '8px 12px', textAlign: 'center', color: 'rgba(255,255,255,.6)', fontSize: 11 }}>
          Prochain scan disponible dans 3.5s...
        </div>
      )}
    </div>
  )
}

// ── Carte stats ────────────────────────────────────────────────────
function StatsCard({ count, title, color, icon }) {
  return (
    <div style={{ background: 'var(--surface)', border: `2px solid ${color}`, borderRadius: 14, padding: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 18, opacity: 0.3 }}>{icon}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
    </div>
  )
}

// ── Dernier scan ──────────────────────────────────────────────────
function LastScanCard({ scan }) {
  if (!scan) return null
  const dt = scan.date_validation ? new Date(scan.date_validation) : new Date(scan.cree_le)
  return (
    <div style={{ background: 'rgba(22,163,74,.1)', border: '2px solid #16a34a', borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Dernier scan</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#16a34a' }}>{scan.resident}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{scan.societe}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#7c3aed', marginTop: 6 }}>
        {dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

// ── Liste historique ────────────────────────────────────────────────
function HistoriqueList({ data, onRefresh, onClear, loading }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterJour, setFilterJour] = useState('today')

  const today = new Date().toISOString().slice(0, 10)
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const filteredData = data.filter(r => {
    const itemDate = (r.date_validation || r.cree_le || '').slice(0, 10)
    if (filterJour === 'today' && itemDate !== today) return false
    if (filterJour === 'hier' && itemDate !== hier) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (r.resident || '').toLowerCase().includes(term) || (r.societe || '').toLowerCase().includes(term)
    }
    return true
  })

  const countByDay = {
    today: data.filter(r => (r.date_validation || r.cree_le || '').slice(0, 10) === today).length,
    hier: data.filter(r => (r.date_validation || r.cree_le || '').slice(0, 10) === hier).length,
    total: data.length
  }

  return (
    <div>
      {/* Recherche */}
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--surface2)', color: 'var(--text)' }}
        />
      </div>

      {/* Filtres jour */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { key: 'today', label: 'Aujourd\'hui' },
          { key: 'hier', label: 'Hier' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterJour(f.key)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: `1px solid ${filterJour === f.key ? '#7c3aed' : 'var(--border)'}`, background: filterJour === f.key ? 'rgba(124,58,237,.1)' : 'transparent', color: filterJour === f.key ? '#7c3aed' : 'var(--text-dim)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            {f.label} ({f.key === 'today' ? countByDay.today : countByDay.hier})
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 14px', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>👥 Personnel ({filteredData.length})</span>
          {onClear && (
            <button onClick={onClear} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
              🗑 Vider
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div>Chargement...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🍽️</div>
            <div style={{ fontSize: 13 }}>Aucun scan</div>
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredData.map((r, i) => {
              const dt = r.date_validation ? new Date(r.date_validation) : (r.cree_le ? new Date(r.cree_le) : null)
              const itemDate = dt ? dt.toISOString().slice(0, 10) : ''
              const isNew = itemDate === today && i === 0
              return (
                <div key={r.id || i} style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  background: isNew ? 'rgba(124,58,237,.08)' : 'transparent',
                  borderLeft: isNew ? '3px solid #7c3aed' : '3px solid transparent'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue)' }}>{r.resident || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{r.societe || ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 8 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                        {dt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{itemDate === today ? 'Auj.' : itemDate === hier ? 'Hier' : ''}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button onClick={onRefresh} disabled={loading} style={{ width: '100%', marginTop: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: loading ? 'var(--text-dim)' : 'var(--text)', padding: 10, borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12 }}>
        {loading ? '⏳ Chargement...' : '🔄 Actualiser'}
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
  const [stats, setStats] = useState({ today: 0, semaine: 0, lastScan: null })
  const [loading, setLoading] = useState(false)
  const [myQR, setMyQR] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const repas = REPAS.find(r => r.key === typeRepas)

  const loadHistorique = useCallback(async () => {
    setLoading(true)
    try {
      const [histData, statsData] = await Promise.all([
        apiGetHistorique(typeRepas, 7),
        apiGetStats(typeRepas)
      ])
      setHistorique(histData)
      setStats(statsData)
    } catch { setHistorique([]) }
    finally { setLoading(false) }
  }, [typeRepas])

  useEffect(() => {
    if (isResto) {
      loadHistorique()
    } else {
      import('../api').then(({ personnel: personnelAPI }) => {
        personnelAPI.monProfil()
          .then(r => setMyQR(r.data))
          .catch(() => {})
      })
    }
  }, [typeRepas])

  const handleClearHistorique = async () => {
    if (!window.confirm('Vider tout l\'historique de ce repas ?')) return
    const ok = await apiViderHistorique(typeRepas)
    if (ok) {
      setHistorique([])
      setStats({ today: 0, semaine: 0, lastScan: null })
    } else {
      alert('Erreur lors du vidage')
    }
  }

  // ── Interface Restaurant (scan personnel) ──
  if (isResto) {
    return (
      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed', margin: 0 }}>🍽️ Restaurant</h2>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              {repas?.heure || 'Heures de service'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setTypeRepas('petit_dejeuner') }} style={{ background: typeRepas === 'petit_dejeuner' ? 'rgba(249,115,22,.1)' : 'var(--surface2)', border: `1px solid ${typeRepas === 'petit_dejeuner' ? '#f97316' : 'var(--border)'}`, color: typeRepas === 'petit_dejeuner' ? '#f97316' : 'var(--text-dim)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              🌅
            </button>
            <button onClick={() => { setTypeRepas('dejeuner') }} style={{ background: typeRepas === 'dejeuner' ? 'rgba(37,99,235,.1)' : 'var(--surface2)', border: `1px solid ${typeRepas === 'dejeuner' ? '#2563eb' : 'var(--border)'}`, color: typeRepas === 'dejeuner' ? '#2563eb' : 'var(--text-dim)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              ☀️
            </button>
            <button onClick={() => { setTypeRepas('diner') }} style={{ background: typeRepas === 'diner' ? 'rgba(124,58,237,.1)' : 'var(--surface2)', border: `1px solid ${typeRepas === 'diner' ? '#7c3aed' : 'var(--border)'}`, color: typeRepas === 'diner' ? '#7c3aed' : 'var(--text-dim)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              🌙
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <StatsCard count={stats.today} title="Aujourd'hui" color="#16a34a" icon="📅" />
          <StatsCard count={stats.semaine} title="Semaine" color="#2563eb" icon="📊" />
        </div>

        {/* Dernier scan */}
        <LastScanCard scan={stats.lastScan} />

        {/* Layout : Scanner + Historique */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, alignItems: 'start' }}>
          {/* Scanner */}
          <div>
            <QRScanner
              key={typeRepas}
              typeRepas={typeRepas}
              onSuccess={() => {
                setTimeout(() => loadHistorique(), 1500)
              }}
            />
          </div>

          {/* Historique */}
          <HistoriqueList
            data={historique}
            onRefresh={loadHistorique}
            onClear={handleClearHistorique}
            loading={loading}
          />
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
              <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '3px solid #7c3aed', display: 'inline-block', marginBottom: 14 }}>
                <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR" style={{ width: 220, height: 220, display: 'block' }} />
              </div>
              <div style={{ background: '#7c3aed', borderRadius: 10, padding: '12px 18px' }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{myQR.nom} {myQR.prenom}</div>
                <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11, marginTop: 2 }}>{myQR.societe}</div>
              </div>
            </>
          ) : (
            <div style={{ padding: 32, color: 'var(--text-dim)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>QR non disponible</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Contactez l'administrateur</div>
            </div>
          )}
        </div>

        {/* Horaires repas */}
        <div style={{ marginTop: 16, background: 'var(--surface)', borderRadius: 12, padding: 14, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Horaires des repas</div>
          {REPAS.map(r => (
            <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{r.emoji}</span>
                <span style={{ fontSize: 13 }}>{r.label}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)' }}>{r.heure}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}