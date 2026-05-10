/**
 * RESTAURATION — Stack: React 18 + Vite + Django REST Framework
 * 
 * Flux restaurant:
 *   Caméra scanne QR code agent → POST /api/qr/scanner/ → succès / déjà consommé
 * 
 * Flux agent:
 *   Affiche son QR code (depuis /api/personnel/mon_profil/)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'

// ── Appel direct fetch pour éviter toute dépendance externe ──
const API = () => (window.__BACKEND_URL_USED__ || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`, 'Content-Type': 'application/json' })

async function callScanner(qr_data, type_repas) {
  const r = await fetch(`${API()}/api/qr/scanner/`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ qr_data: qr_data.trim(), type_repas })
  })
  const json = await r.json()
  if (!r.ok) throw { status: r.status, msg: json.erreur || json.detail || 'Erreur inconnue' }
  return json
}

async function loadHistorique(type_repas) {
  const r = await fetch(`${API()}/api/qr/repas/?type_repas=${type_repas}&page_size=200`, {
    headers: authHeader()
  })
  const json = await r.json()
  return json.results || json || []
}

async function loadMonProfil() {
  const r = await fetch(`${API()}/api/personnel/mon_profil/`, { headers: authHeader() })
  if (!r.ok) return null
  return r.json()
}

const REPAS = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner', emoji: '🌅', color: '#f97316' },
  { key: 'dejeuner',       label: 'Déjeuner',       emoji: '☀️',  color: '#2563eb' },
  { key: 'diner',          label: 'Dîner',           emoji: '🌙', color: '#7c3aed' },
]

/* ═══════════════════════════════════════════════════════
   COMPOSANT SCANNER QR
   - Démarre automatiquement la caméra
   - Scanne en boucle continue
   - Cooldown 3s après chaque scan (évite les doublons)
   - Flash visuel vert/rouge selon résultat
═══════════════════════════════════════════════════════ */
function QRScanner({ typeRepas, color, onValidated }) {
  const [status, setStatus]     = useState('starting')  // starting|ready|hit|ok|already|error|nocam
  const [result, setResult]     = useState(null)
  const scannerRef = useRef(null)
  const cooldown   = useRef(false)
  const alive      = useRef(true)

  useEffect(() => {
    alive.current = true
    init()
    return () => { alive.current = false; destroy() }
  }, [typeRepas])

  async function destroy() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
  }

  async function init() {
    await destroy()
    if (!alive.current) return
    setStatus('starting')
    setResult(null)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!alive.current) return
      const s = new Html5Qrcode('__scanner__')
      scannerRef.current = s
      setStatus('ready')
      await s.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 260, height: 260 } },
        onQRDecoded,
        () => {} // ignore les non-décodages
      )
    } catch {
      if (!alive.current) return
      setStatus('nocam')
    }
  }

  async function onQRDecoded(decoded) {
    if (cooldown.current || !alive.current) return
    cooldown.current = true
    setStatus('hit')

    try {
      const data = await callScanner(decoded, typeRepas)
      if (!alive.current) return
      setResult(data)
      setStatus('ok')
      onValidated && onValidated(data)
    } catch (e) {
      if (!alive.current) return
      const msg = e.msg || ''
      setResult({ msg })
      setStatus(msg.toLowerCase().includes('déjà') || msg.toLowerCase().includes('deja') ? 'already' : 'error')
    }

    // Reset après 3s → prêt pour le prochain scan
    setTimeout(() => {
      if (!alive.current) return
      cooldown.current = false
      setResult(null)
      setStatus('ready')
    }, 3000)
  }

  // Couleurs selon statut
  const themes = {
    starting: { top: '#0f172a', icon: '📡', text: 'Démarrage caméra...', textColor: '#64748b' },
    ready:    { top: '#0f172a', icon: '🔵', text: 'Prêt — présentez le QR code', textColor: '#93c5fd' },
    hit:      { top: '#78350f', icon: '⏳', text: 'Validation...', textColor: '#fcd34d' },
    ok:       { top: '#14532d', icon: '✅', text: result ? `${result.resident}` : 'Validé', textColor: '#86efac', sub: result?.societe },
    already:  { top: '#7c2d12', icon: '⛔', text: result?.msg || 'Déjà consommé', textColor: '#fca5a5' },
    error:    { top: '#450a0a', icon: '❌', text: result?.msg || 'Non reconnu', textColor: '#f87171' },
    nocam:    { top: '#1e1e2e', icon: '📵', text: 'Caméra inaccessible', textColor: '#f87171' },
  }
  const t = themes[status] || themes.ready

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: '#000', position: 'relative', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
      {/* Barre de statut */}
      <div style={{ background: t.top, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, transition: 'background .25s' }}>
        <span style={{ fontSize: 28 }}>{t.icon}</span>
        <div>
          <div style={{ color: t.textColor, fontSize: 14, fontWeight: 700, transition: 'color .25s' }}>{t.text}</div>
          {t.sub && <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 2 }}>{t.sub}</div>}
        </div>
      </div>

      {/* Caméra */}
      <div id="__scanner__" style={{ flex: 1 }} />

      {/* Viseur quand ready */}
      {status === 'ready' && (
        <div style={{ position: 'absolute', top: 60, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 230, height: 230, position: 'relative' }}>
            {/* 4 coins */}
            {[{t:0,l:0,bt:'none',bb:'none',bl:'none'},{t:0,r:0,bt:'none',bb:'none',br:'none'},
              {b:0,l:0,bt:'none',bb:'none',bl:'none'},{b:0,r:0,bt:'none',bb:'none',br:'none'}].map((s,i)=>{
              const isTop = i < 2, isLeft = i % 2 === 0
              return <div key={i} style={{
                position:'absolute', width:22, height:22,
                top:isTop?-1:'auto', bottom:!isTop?-1:'auto',
                left:isLeft?-1:'auto', right:!isLeft?-1:'auto',
                borderTop: isTop ? `3px solid ${color}` : 'none',
                borderBottom: !isTop ? `3px solid ${color}` : 'none',
                borderLeft: isLeft ? `3px solid ${color}` : 'none',
                borderRight: !isLeft ? `3px solid ${color}` : 'none',
              }}/>
            })}
          </div>
        </div>
      )}

      {/* Flash succès */}
      {status === 'ok' && (
        <div style={{ position:'absolute',inset:'54px 0 0 0',background:'rgba(22,163,74,.45)',display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity .3s' }}>
          <span style={{ fontSize: 88 }}>✅</span>
        </div>
      )}

      {/* Flash déjà consommé */}
      {status === 'already' && (
        <div style={{ position:'absolute',inset:'54px 0 0 0',background:'rgba(234,88,12,.45)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <span style={{ fontSize: 88 }}>⛔</span>
        </div>
      )}

      {/* Flash erreur */}
      {(status === 'error') && (
        <div style={{ position:'absolute',inset:'54px 0 0 0',background:'rgba(220,38,38,.35)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <span style={{ fontSize: 88 }}>❌</span>
        </div>
      )}

      {/* Bouton retry si pas de caméra */}
      {status === 'nocam' && (
        <div style={{ position:'absolute',inset:'54px 0 0 0',background:'#0f172a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16 }}>
          <span style={{ fontSize:64 }}>📵</span>
          <div style={{ color:'#f87171',fontSize:13,fontWeight:600 }}>Caméra inaccessible</div>
          <div style={{ color:'#64748b',fontSize:11,textAlign:'center',maxWidth:220 }}>Autorisez l'accès à la caméra dans les paramètres du navigateur</div>
          <button onClick={init} style={{ background:'#dc2626',color:'#fff',border:'none',padding:'9px 20px',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700 }}>
            🔄 Réessayer
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   PAGE PRINCIPALE RESTAURATION
═══════════════════════════════════════════════════════ */
export default function Restauration() {
  const { user } = useStore()
  const role       = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin    = user?.is_staff || user?.is_superuser || role === 'admin'
  const canScan    = isAdmin || role === 'restauration'

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [tab,       setTab]       = useState(canScan ? 'scanner' : 'mon_qr')
  const [history,   setHistory]   = useState([])
  const [todayList, setTodayList] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [myProfile, setMyProfile] = useState(null)
  const today = new Date().toISOString().slice(0, 10)

  const refreshHistory = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadHistorique(typeRepas)
      setHistory(data)
      setTodayList(data.filter(r => r.date_validation?.startsWith(today)))
    } catch {}
    finally { setLoading(false) }
  }, [typeRepas])

  useEffect(() => {
    if (canScan) refreshHistory()
    else loadMonProfil().then(d => d && setMyProfile(d))
  }, [typeRepas])

  const repas = REPAS.find(r => r.key === typeRepas)

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e3a8a', margin: 0 }}>🍽️ Restauration</h2>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '3px 0 0' }}>
            {canScan ? 'Scanner le QR code du résident · Historique' : 'Mon QR · Mes repas'}
          </p>
        </div>
        {canScan && <button onClick={refreshHistory} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>🔄</button>}
      </div>

      {/* Sélecteur service */}
      <div style={{ display: 'flex', gap: 8 }}>
        {REPAS.map(r => (
          <button key={r.key} onClick={() => setTypeRepas(r.key)}
            style={{ flex: 1, padding: '9px 4px', borderRadius: 10, border: `2px solid ${typeRepas === r.key ? r.color : '#e2e8f0'}`, background: typeRepas === r.key ? `${r.color}12` : '#fff', color: typeRepas === r.key ? r.color : '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: 11, transition: '.15s' }}>
            <div style={{ fontSize: 20 }}>{r.emoji}</div>
            <div style={{ marginTop: 2 }}>{r.label}</div>
          </button>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', background: '#f8fafc', borderRadius: 10, padding: 4, border: '1px solid #e2e8f0', gap: 3 }}>
        {(canScan
          ? [['scanner', '📷 Scanner'], ['historique', '📋 Historique']]
          : [['mon_qr', '📱 Mon QR'], ['mes_repas', '🍽️ Mes repas']]
        ).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); if (k === 'historique') refreshHistory() }}
            style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600, background: tab === k ? '#fff' : 'transparent', color: tab === k ? '#1e3a8a' : '#64748b', boxShadow: tab === k ? '0 1px 4px rgba(0,0,0,.08)' : 'none', transition: '.15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* ── SCANNER ── */}
        {tab === 'scanner' && canScan && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, alignItems: 'start' }}>
            <QRScanner key={typeRepas} typeRepas={typeRepas} color={repas?.color || '#2563eb'} onValidated={refreshHistory} />

            {/* Compteur + liste du jour */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '14px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 52, fontWeight: 900, color: repas?.color, lineHeight: 1 }}>{todayList.length}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Aujourd'hui</div>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {todayList.length === 0
                  ? <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>Aucun scan</div>
                  : todayList.map((r, i) => (
                    <div key={r.id} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', background: i === 0 ? `${repas?.color}08` : '#fff' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#1e3a8a' }}>{r.resident || '—'}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {r.date_validation ? new Date(r.date_validation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORIQUE ── */}
        {tab === 'historique' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#1e3a8a', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{repas?.emoji} {repas?.label} — Historique</span>
              <span style={{ background: 'rgba(255,255,255,.2)', padding: '2px 10px', borderRadius: 20 }}>{history.length}</span>
            </div>
            {loading ? <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>⏳ Chargement...</div>
              : history.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Aucun repas enregistré</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#f8fafc' }}>
                    {['Date', 'Heure', 'Résident', 'Résidence'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{history.map((r, i) => {
                    const dt = r.date_validation ? new Date(r.date_validation) : null
                    return <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{dt?.toLocaleDateString('fr-FR') || '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{dt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '—'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#1e3a8a' }}>{r.resident || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: 11, color: '#64748b' }}>{r.residence || '—'}</td>
                    </tr>
                  })}</tbody>
                </table>
            }
          </div>
        )}

        {/* ── MON QR (agent) ── */}
        {tab === 'mon_qr' && (
          <div style={{ maxWidth: 340, margin: '0 auto', paddingTop: 8 }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, textAlign: 'center', boxShadow: '0 4px 20px rgba(30,58,138,.08)' }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a', marginBottom: 4 }}>📱 Mon QR de repas</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 18 }}>Présentez ce code au restaurant</div>
              {myProfile?.qr_code_data
                ? <>
                    <div style={{ background: '#fff', padding: 10, borderRadius: 12, border: '3px solid #1e3a8a', display: 'inline-block', marginBottom: 14, boxShadow: '0 2px 8px rgba(30,58,138,.12)' }}>
                      <img src={`data:image/png;base64,${myProfile.qr_code_data}`} alt="QR"
                        style={{ width: 220, height: 220, display: 'block', imageRendering: 'pixelated' }} />
                    </div>
                    <div style={{ background: '#1e3a8a', borderRadius: 10, padding: '10px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{myProfile.nom} {myProfile.prenom}</div>
                      <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 2 }}>{myProfile.societe}</div>
                    </div>
                  </>
                : <div style={{ padding: 32, color: '#94a3b8' }}>
                    <div style={{ fontSize: 52, marginBottom: 12 }}>📱</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>QR non disponible</div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>Contactez l'administrateur</div>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── MES REPAS (agent) ── */}
        {tab === 'mes_repas' && (
          <div>
            <button onClick={refreshHistory} style={{ marginBottom: 10, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e3a8a', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🔄 Actualiser</button>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🍽️</div>
              <div>Historique de vos repas</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
