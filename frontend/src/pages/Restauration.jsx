/**
 * RESTAURATION — Scanner QR Personnel
 * Interface complète pour le restaurant : scan QR + historique + statistiques
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useStore } from '../store'
import { qr as qrAPI, menu as menuAPI, avisRestauration as avisAPI, questionsAvis as questionsAvisAPI, parametres as parametresAPI } from '../api'
import { useIsMobile } from '../hooks/useIsMobile'
import { toast, confirmDialog } from '../toast'

// ── Configuration repas ───────────────────────────────────────────
// Valeurs par défaut (repli si le paramétrage n'a pas pu être chargé) —
// les horaires réels affichés viennent de /api/parametres/ (clés
// repas_xxx_debut/fin, modifiables dans Paramétrage), via heureRepas()
// ci-dessous plutôt que ces chaînes figées.
const REPAS = [
  { key: 'petit_dejeuner', label: 'Petit-déjeuner', emoji: '🌅', color: '#f97316', heure: '06:00 - 10:00', cleDebut: 'repas_petit_dej_debut', cleFin: 'repas_petit_dej_fin' },
  { key: 'dejeuner',        label: 'Déjeuner',       emoji: '☀️',  color: '#2563eb', heure: '11:00 - 14:30', cleDebut: 'repas_dejeuner_debut', cleFin: 'repas_dejeuner_fin' },
  { key: 'diner',           label: 'Dîner',          emoji: '🌙',  color: '#7c3aed', heure: '18:30 - 21:00', cleDebut: 'repas_diner_debut', cleFin: 'repas_diner_fin' },
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

async function apiGetStats() {
  try {
    // Appel direct API avec filtre date côté backend
    const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
    const token = localStorage.getItem('access_token') || ''
    const today = new Date().toISOString().slice(0, 10)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-6)
    const weekStr = weekAgo.toISOString().slice(0,10)

    // Essayer l'endpoint stats_jour
    try {
      const r = await fetch(`${BASE}/api/repas/stats_jour/`, {headers:{'Authorization':`Bearer ${token}`}})
      if (r.ok) {
        const d = await r.json()
        if (!d.error) {
          return {
            today: d.total_jour || 0,
            semaine: d.semaine || 0,
            byType: {
              petit_dejeuner: d.petit_dejeuner || 0,
              dejeuner: d.dejeuner || 0,
              diner: d.diner || 0,
            }
          }
        }
      }
    } catch(e) {}

    // Fallback: charger tous les repas et filtrer JS
    const all = await fetch(`${BASE}/api/repas/?page_size=2000`, {headers:{'Authorization':`Bearer ${token}`}})
    const data_raw = await all.json()
    const data = data_raw.results || data_raw || []
    const todayItems = data.filter(r => (r.date_validation||r.cree_le||'').slice(0,10) === today)
    const weekItems  = data.filter(r => (r.date_validation||r.cree_le||'').slice(0,10) >= weekStr)
    return {
      today:   todayItems.length,
      semaine: weekItems.length,
      byType: {
        petit_dejeuner: todayItems.filter(r => r.type_repas==='petit_dejeuner').length,
        dejeuner:       todayItems.filter(r => r.type_repas==='dejeuner').length,
        diner:          todayItems.filter(r => r.type_repas==='diner').length,
      }
    }
  } catch(e) {
    return { today:0, semaine:0, byType:{petit_dejeuner:0,dejeuner:0,diner:0} }
  }
}

async function apiViderHistorique(type_repas) {
  try {
    await qrAPI.viderHistorique(type_repas)
    return true
  } catch { return false }
}

// ── Scanner QR ─────────────────────────────────────────────────────
// ── Mini-sondage post-scan : amélioration continue ──
// Affiché brièvement après chaque repas validé — l'agent qui vient de
// scanner peut demander à la personne comment était son repas (submission
// anonyme, l'app ne demande pas à chaque employé d'avoir son propre compte).
function AvisRapide({ typeRepas, onDone }) {
  const [questions, setQuestions] = useState(null)   // null = chargement, [] = aucune configurée
  const [reponses, setReponses] = useState({})        // { questionId: valeur }
  const [commentaireGlobal, setCommentaireGlobal] = useState('')
  const [noteGlobale, setNoteGlobale] = useState(0)    // repli si aucune question configurée
  const [envoye, setEnvoye] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    questionsAvisAPI.list(true).then(r => setQuestions(r.data.results || r.data || []))
      .catch(() => setQuestions([]))
  }, [])

  const setReponse = (qid, val) => setReponses(r => ({ ...r, [qid]: val }))

  const peutEnvoyer = () => {
    if (!questions || questions.length === 0) return noteGlobale > 0
    return questions.filter(q => q.obligatoire).every(q => {
      const v = reponses[q.id]
      return v !== undefined && v !== null && v !== ''
    })
  }

  const envoyer = async () => {
    setEnvoi(true)
    try {
      if (!questions || questions.length === 0) {
        // Repli : aucune question personnalisée configurée, note globale simple
        await avisAPI.create({ repas: typeRepas, note: noteGlobale, commentaire: commentaireGlobal })
      } else {
        const reponsesPayload = questions.map(q => {
          const v = reponses[q.id]
          const base = { question: q.id }
          if (q.type_question === 'etoiles') base.valeur_etoiles = v || null
          else if (q.type_question === 'oui_non') base.valeur_oui_non = v ?? null
          else if (q.type_question === 'choix') base.valeur_choix = v || ''
          else if (q.type_question === 'texte') base.valeur_texte = v || ''
          return base
        }).filter(r => {
          const hasVal = r.valeur_etoiles || r.valeur_oui_non !== null || r.valeur_choix || r.valeur_texte
          return hasVal
        })
        await avisAPI.create({ repas: typeRepas, reponses: reponsesPayload })
      }
    } catch {}
    setEnvoye(true)
    setTimeout(onDone, 1200)
  }

  if (envoye) {
    return (
      <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:14,textAlign:'center',marginTop:10}}>
        <div style={{fontSize:22}}>🙏</div>
        <div style={{fontSize:12,color:'#166534',fontWeight:700}}>Merci pour votre avis !</div>
      </div>
    )
  }

  if (questions === null) {
    return <div style={{textAlign:'center',padding:14,color:'#94a3b8',fontSize:12}}>⏳ Chargement du sondage...</div>
  }

  // ── Aucune question configurée : repli sur une note globale simple ──
  if (questions.length === 0) {
    return (
      <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontSize:12,fontWeight:700,color:'#92400e',marginBottom:8,textAlign:'center'}}>
          🍽️ Comment était le repas ?
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:8}}>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={()=>setNoteGlobale(n)}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:28,padding:2,
                filter: n<=noteGlobale ? 'none' : 'grayscale(1) opacity(.4)'}}>
              ⭐
            </button>
          ))}
        </div>
        <input value={commentaireGlobal} onChange={e=>setCommentaireGlobal(e.target.value)}
          placeholder="Un commentaire ? (optionnel)"
          style={{width:'100%',border:'1px solid #fde68a',borderRadius:8,padding:'6px 10px',
            fontSize:12,outline:'none',boxSizing:'border-box',marginBottom:8}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={onDone}
            style={{flex:1,background:'none',border:'none',color:'#92400e',fontSize:11,cursor:'pointer',textDecoration:'underline'}}>
            Passer
          </button>
          <button onClick={envoyer} disabled={!peutEnvoyer()||envoi}
            style={{flex:2,background:peutEnvoyer()?'#f0a500':'#e2d8c3',color:'#000',border:'none',padding:'8px',
              borderRadius:8,cursor:peutEnvoyer()?'pointer':'not-allowed',fontSize:12,fontWeight:700}}>
            {envoi?'⏳...':'Envoyer'}
          </button>
        </div>
      </div>
    )
  }

  // ── Questions personnalisées configurées dans Paramétrage ──
  return (
    <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:14,marginTop:10}}>
      <div style={{fontSize:12,fontWeight:700,color:'#92400e',marginBottom:10,textAlign:'center'}}>
        🍽️ Donnez votre avis sur le repas
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:10}}>
        {questions.map(q => (
          <div key={q.id}>
            <div style={{fontSize:12,fontWeight:600,color:'#78350f',marginBottom:5}}>
              {q.label}{q.obligatoire && <span style={{color:'#dc2626'}}> *</span>}
            </div>
            {q.type_question === 'etoiles' && (
              <div style={{display:'flex',gap:4}}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={()=>setReponse(q.id,n)}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:24,padding:1,
                      filter: n<=(reponses[q.id]||0) ? 'none' : 'grayscale(1) opacity(.4)'}}>
                    ⭐
                  </button>
                ))}
              </div>
            )}
            {q.type_question === 'oui_non' && (
              <div style={{display:'flex',gap:8}}>
                {[['Oui',true],['Non',false]].map(([label,val]) => (
                  <button key={label} onClick={()=>setReponse(q.id,val)}
                    style={{flex:1,padding:'7px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,
                      border:`2px solid ${reponses[q.id]===val?'#f0a500':'#fde68a'}`,
                      background:reponses[q.id]===val?'#fef3c7':'#fff',
                      color:reponses[q.id]===val?'#92400e':'#78350f'}}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {q.type_question === 'choix' && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {(q.options||[]).map(opt => (
                  <button key={opt} onClick={()=>setReponse(q.id,opt)}
                    style={{padding:'6px 12px',borderRadius:20,cursor:'pointer',fontSize:11,fontWeight:600,
                      border:`2px solid ${reponses[q.id]===opt?'#f0a500':'#fde68a'}`,
                      background:reponses[q.id]===opt?'#fef3c7':'#fff',
                      color:reponses[q.id]===opt?'#92400e':'#78350f'}}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {q.type_question === 'texte' && (
              <input value={reponses[q.id]||''} onChange={e=>setReponse(q.id,e.target.value)}
                placeholder="Votre réponse..."
                style={{width:'100%',border:'1px solid #fde68a',borderRadius:8,padding:'6px 10px',
                  fontSize:12,outline:'none',boxSizing:'border-box'}}/>
            )}
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={onDone}
          style={{flex:1,background:'none',border:'none',color:'#92400e',fontSize:11,cursor:'pointer',textDecoration:'underline'}}>
          Passer
        </button>
        <button onClick={envoyer} disabled={!peutEnvoyer()||envoi}
          style={{flex:2,background:peutEnvoyer()?'#f0a500':'#e2d8c3',color:'#000',border:'none',padding:'8px',
            borderRadius:8,cursor:peutEnvoyer()?'pointer':'not-allowed',fontSize:12,fontWeight:700}}>
          {envoi?'⏳...':'Envoyer'}
        </button>
      </div>
    </div>
  )
}

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
      <div style={{ background: '#000', position: 'relative', minHeight: 200, maxHeight: 260 }}>
        <div id="qr_viewport" style={{ width: '100%', minHeight: 200, maxHeight: 260 }} />

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
    <div style={{ background: 'var(--rzc-charcoal-l1)', border: `2px solid ${color}`, borderRadius: 14, padding: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 18, opacity: 0.3 }}>{icon}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 10, color: 'var(--rzc-text-3)', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
    </div>
  )
}

// ── Dernier scan ──────────────────────────────────────────────────
function LastScanCard({ scan, isMobile, repasLabel }) {
  if (!scan) return null
  const dt = scan.date_validation ? new Date(scan.date_validation) : new Date(scan.cree_le)
  if (isMobile) {
    const secs = Math.max(0, Math.round((Date.now() - dt.getTime())/1000))
    const relatif = secs < 60 ? `il y a ${secs} sec` : secs < 3600 ? `il y a ${Math.round(secs/60)} min` : dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
    return (
      <div style={{ background:'rgba(22,163,74,.08)', border:'1px solid rgba(22,163,74,.25)', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
        <div style={{ width:36, height:36, borderRadius:'50%', background:'#16A34A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>✓</div>
        <div style={{ minWidth:0 }}>
          <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#0F1A2E' }}>{scan.resident} — {repasLabel} validé</p>
          <p style={{ margin:'2px 0 0', fontSize:11.5, color:'#5B6472' }}>{scan.societe} · {relatif}</p>
        </div>
      </div>
    )
  }
  return (
    <div style={{ background: 'rgba(22,163,74,.1)', border: '2px solid #16a34a', borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#16a34a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Dernier scan</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#16a34a' }}>{scan.resident}</div>
      <div style={{ fontSize: 12, color: 'var(--rzc-text-3)', marginTop: 2 }}>{scan.societe}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#7c3aed', marginTop: 6 }}>
        {dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}

// ── Liste historique ────────────────────────────────────────────────
function HistoriqueList({ data, onRefresh, loading, isMobile }) {
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

  if (isMobile) {
    return (
      <section style={{ background:'#fff', border:'1px solid rgba(15,26,46,.12)', borderRadius:14, padding:14, display:'flex', flexDirection:'column', gap:10 }}>
        <h2 style={{ margin:0, fontSize:14.5, fontWeight:600, color:'#0F1A2E' }}>Historique</h2>
        <div style={{ display:'flex', gap:8 }}>
          {[{ key:'today', label:'Aujourd\'hui' }, { key:'hier', label:'Hier' }].map(f=>(
            <button key={f.key} onClick={()=>setFilterJour(f.key)}
              style={{ flexShrink:0, border:'1px solid rgba(15,26,46,.14)', background: filterJour===f.key ? '#0F2A5C' : '#fff',
                color: filterJour===f.key ? '#fff' : '#2D3B52', borderRadius:99, padding:'6px 13px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {f.label} ({f.key==='today'?countByDay.today:countByDay.hier})
            </button>
          ))}
        </div>
        {loading ? (
          <div style={{ padding:20, textAlign:'center', color:'#8B95A1' }}>⏳ Chargement...</div>
        ) : filteredData.length===0 ? (
          <div style={{ padding:20, textAlign:'center', color:'#8B95A1', fontSize:12 }}>Aucun scan</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' }}>
            {filteredData.slice(0,30).map((r,i)=>{
              const dt = r.date_validation ? new Date(r.date_validation) : (r.cree_le ? new Date(r.cree_le) : null)
              return (
                <div key={r.id||i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'8px 0', borderBottom: i<filteredData.length-1 ? '1px solid rgba(15,26,46,.08)' : 'none' }}>
                  <div style={{ minWidth:0 }}>
                    <p style={{ margin:0, fontSize:12.5, fontWeight:600, color:'#0F1A2E' }}>{r.resident||'—'}</p>
                    <p style={{ margin:'1px 0 0', fontSize:11, color:'#8B95A1' }}>{r.societe||'—'}</p>
                  </div>
                  <span style={{ fontSize:11, color:'#8B95A1', flexShrink:0 }}>{dt?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    )
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
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--rzc-border-light)', fontSize: 12, background: 'var(--rzc-charcoal-l2)', color: 'var(--rzc-text)' }}
        />
      </div>

      {/* Filtres jour */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { key: 'today', label: 'Aujourd\'hui' },
          { key: 'hier', label: 'Hier' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterJour(f.key)}
            style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: `1px solid ${filterJour === f.key ? '#7c3aed' : 'var(--rzc-border-light)'}`, background: filterJour === f.key ? 'rgba(124,58,237,.1)' : 'transparent', color: filterJour === f.key ? '#7c3aed' : 'var(--rzc-text-3)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            {f.label} ({f.key === 'today' ? countByDay.today : countByDay.hier})
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ background: 'var(--rzc-charcoal-l1)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--rzc-border-light)' }}>
        <div style={{ padding: '12px 14px', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>👥 Personnel ({filteredData.length})</span>

        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--rzc-text-3)' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            <div>Chargement...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--rzc-text-3)' }}>
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
                  borderBottom: '1px solid var(--rzc-border-light)',
                  background: isNew ? 'rgba(124,58,237,.08)' : 'transparent',
                  borderLeft: isNew ? '3px solid #7c3aed' : '3px solid transparent'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--rzc-navy)' }}>{r.resident || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--rzc-text-3)', marginTop: 2 }}>{r.societe || ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: 8 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                        {dt?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--rzc-text-3)' }}>{itemDate === today ? 'Auj.' : itemDate === hier ? 'Hier' : ''}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button onClick={onRefresh} disabled={loading} style={{ width: '100%', marginTop: 10, background: 'var(--rzc-charcoal-l2)', border: '1px solid var(--rzc-border-light)', color: loading ? 'var(--rzc-text-3)' : 'var(--rzc-text)', padding: 10, borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12 }}>
        {loading ? '⏳ Chargement...' : '🔄 Actualiser'}
      </button>
    </div>
  )
}

// ── PAGE PRINCIPALE ────────────────────────────────────────────────
export default function Restauration() {
  const isMobile = useIsMobile()
  const { user } = useStore()
  const role = (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
  const isResto = ['admin', 'restauration'].includes(role) || user?.is_staff || user?.is_superuser
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const importMenuInputRef = useRef(null)
  const [importingMenu, setImportingMenu] = useState(false)
  const [menuSelMode, setMenuSelMode] = useState(false)
  const [menuSel, setMenuSel] = useState(new Set())
  const [menuBulkModal, setMenuBulkModal] = useState(false)
  const [menuBulkForm, setMenuBulkForm] = useState({ type_plat:'', repas:'', disponible:'', date_service:'' })
  const [dragPlat, setDragPlat] = useState(null)
  const [dropRepas, setDropRepas] = useState(null)
  const toggleMenuSel = (id) => setMenuSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const quitMenuSel = () => { setMenuSelMode(false); setMenuSel(new Set()) }
  const reloadMenu = async () => { try { const r = await menuAPI.list({date_service:menuDate, page_size:500}); setMenuItems(r.data.results||r.data||[]) } catch {} }
  const menuBulkDelete = async () => {
    const ids = [...menuSel]; if (!ids.length) return
    if (!await confirmDialog(`Supprimer ${ids.length} plat(s) ?`)) return
    try { const r = await menuAPI.bulk({ ids, action:'supprimer' }); toast.success(`${r.data.modifies} plat(s) supprimé(s)`); setMenuSel(new Set()); reloadMenu() }
    catch (e) { toast.error(e?.response?.data?.error || 'Erreur suppression') }
  }
  // Glisser-déposer : déplace le plat (ou toute la sélection) vers un autre repas
  const deplacerPlats = async (repasCible) => {
    const ids = dragPlat ? (menuSel.has(dragPlat) ? [...menuSel] : [dragPlat]) : []
    setDragPlat(null); setDropRepas(null)
    if (!ids.length) return
    const deja = menuItems.filter(m => ids.includes(m.id) && m.repas === repasCible).length
    if (deja === ids.length) return
    setMenuItems(prev => prev.map(m => ids.includes(m.id) ? { ...m, repas: repasCible } : m))
    try { await menuAPI.bulk({ ids, action:'modifier', repas: repasCible }); toast.success(`${ids.length} plat(s) déplacé(s)`); setMenuSel(new Set()) }
    catch (e) { toast.error(e?.response?.data?.error || 'Erreur déplacement'); reloadMenu() }
  }
  const menuBulkApply = async () => {
    const ids = [...menuSel]; if (!ids.length) return
    const d = { ids, action:'modifier' }
    if (menuBulkForm.type_plat) d.type_plat = menuBulkForm.type_plat
    if (menuBulkForm.repas) d.repas = menuBulkForm.repas
    if (menuBulkForm.disponible !== '') d.disponible = menuBulkForm.disponible === 'true'
    if (menuBulkForm.date_service) d.date_service = menuBulkForm.date_service
    try { const r = await menuAPI.bulk(d); toast.success(`${r.data.modifies} plat(s) modifié(s)`); setMenuBulkModal(false); setMenuSel(new Set()); reloadMenu() }
    catch (e) { toast.error(e?.response?.data?.error || 'Erreur modification') }
  }

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [showAvis, setShowAvis] = useState(false)
  const [avisStats, setAvisStats] = useState(null)
  const [avisEvolution, setAvisEvolution] = useState([])
  const [avisListe, setAvisListe] = useState([])
  const [showAvisListe, setShowAvisListe] = useState(false)
  const [menuItems,   setMenuItems]   = useState([])
  const [menuForm,    setMenuForm]    = useState(null)
  const [menuDate,    setMenuDate]    = useState(new Date().toISOString().slice(0,10))
  const [historique, setHistorique] = useState([])
  const [stats, setStats] = useState({ today: 0, semaine: 0, byType: { petit_dejeuner:0, dejeuner:0, diner:0 }, lastScan: null })
  const [loading, setLoading] = useState(false)
  const [myQR, setMyQR] = useState(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  // Bloc "Amélioration continue" (graphique + détail) : replié par défaut
  // sur mobile pour garder l'écran centré sur scan + historique — ouvert
  // par défaut sur desktop où la place ne manque pas.
  const [avisOpenMobile, setAvisOpenMobile] = useState(false)
  const [paramHoraires, setParamHoraires] = useState({})
  useEffect(() => {
    parametresAPI.list().then(r => {
      const liste = r.data.results || r.data || []
      const map = {}
      liste.forEach(p => { map[p.cle] = p.valeur })
      setParamHoraires(map)
    }).catch(() => {})
  }, [])
  // Heure réelle du repas — paramétrage (Paramétrage > Horaires Repas &
  // Boutique) si renseigné, sinon la valeur par défaut codée en dur.
  const heureRepas = (r) => {
    const debut = paramHoraires[r.cleDebut]
    const fin = paramHoraires[r.cleFin]
    return (debut && fin) ? `${debut} - ${fin}` : r.heure
  }

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
      // Charger le menu du jour
      menuAPI.list({date_service: new Date().toISOString().slice(0,10)})
        .then(r => setMenuItems(r.data.results || r.data || []))
        .catch(() => {})
      avisAPI.stats('30j').then(r => setAvisStats(r.data)).catch(() => {})
      avisAPI.evolution('90j').then(r => setAvisEvolution(r.data.points || [])).catch(() => {})
      avisAPI.list({page_size: 100}).then(r => setAvisListe(r.data.results || r.data || [])).catch(() => {})
    } else {
      import('../api').then(({ personnel: personnelAPI }) => {
        personnelAPI.monProfil()
          .then(r => setMyQR(r.data))
          .catch(() => {})
      })
      // Menu du jour — lecture seule, pour que n'importe quel agent voie
      // ce qui est servi (demande explicite : "voir les noms des repas").
      menuAPI.list({date_service: new Date().toISOString().slice(0,10), disponible: true})
        .then(r => setMenuItems(r.data.results || r.data || []))
        .catch(() => {})
    }
  }, [typeRepas])


  // ── Interface Restaurant (scan personnel) ──
  if (isResto) {
    return (
      <div className="rzc-page-scope" style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'baseline' : 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: isMobile ? 20 : 20, fontWeight: 700, color: isMobile ? '#0F1A2E' : '#7c3aed', margin: 0 }}>{isMobile ? 'Restauration' : '🍽️ Restaurant'}</h2>
            <p style={{ fontSize: isMobile ? 12.5 : 11, color: isMobile ? '#5B6472' : 'var(--rzc-text-3)', marginTop: isMobile ? 3 : 4 }}>
              {isMobile ? `${stats.today} repas servis aujourd'hui` : (repas ? heureRepas(repas) : 'Heures de service')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setTypeRepas('petit_dejeuner') }} style={{ background: typeRepas === 'petit_dejeuner' ? 'rgba(249,115,22,.1)' : 'var(--rzc-charcoal-l2)', border: `1px solid ${typeRepas === 'petit_dejeuner' ? '#f97316' : 'var(--rzc-border-light)'}`, color: typeRepas === 'petit_dejeuner' ? '#f97316' : 'var(--rzc-text-3)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              🌅
            </button>
            <button onClick={() => { setTypeRepas('dejeuner') }} style={{ background: typeRepas === 'dejeuner' ? 'rgba(37,99,235,.1)' : 'var(--rzc-charcoal-l2)', border: `1px solid ${typeRepas === 'dejeuner' ? '#2563eb' : 'var(--rzc-border-light)'}`, color: typeRepas === 'dejeuner' ? '#2563eb' : 'var(--rzc-text-3)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              ☀️
            </button>
            <button onClick={() => { setTypeRepas('diner') }} style={{ background: typeRepas === 'diner' ? 'rgba(124,58,237,.1)' : 'var(--rzc-charcoal-l2)', border: `1px solid ${typeRepas === 'diner' ? '#7c3aed' : 'var(--rzc-border-light)'}`, color: typeRepas === 'diner' ? '#7c3aed' : 'var(--rzc-text-3)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              🌙
            </button>
          </div>
        </div>

        {/* Stats redesign: TOTAL du jour + breakdown par type */}
        <div style={{ marginBottom: 16 }}>
          {/* Chiffre principal — masqué sur mobile (la maquette validée met le
              total dans le sous-titre de l'en-tête, pas dans un bandeau) */}
          {!isMobile && (
          <div style={{ background: 'linear-gradient(135deg, var(--rzc-navy), #1E3A8A)', borderRadius: 16, padding: '18px 24px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>📅 Aujourd'hui — Total</div>
              <div style={{ fontFamily: 'monospace', fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{stats.today}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 4 }}>repas validés ce jour</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Cette semaine</div>
              <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 800, color: 'rgba(255,255,255,.9)' }}>{stats.semaine}</div>
            </div>
          </div>
          )}
          {/* Sélecteur date + menu intégré dans les compteurs — desktop
              uniquement, cf. gestion du menu déjà réservée au desktop plus bas */}
          {!isMobile && (
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:11, color:'rgba(255,255,255,.7)', fontWeight:600 }}>🗓️ Menu du</span>
            <input type="date" value={menuDate}
              onChange={async e=>{
                setMenuDate(e.target.value)
                try{const r=await menuAPI.list({date_service:e.target.value});setMenuItems(r.data.results||r.data||[])}
                catch{ setMenuItems([]) }
              }}
              style={{ border:'1px solid rgba(255,255,255,.3)', borderRadius:6, padding:'3px 7px',
                fontSize:11, outline:'none', background:'rgba(255,255,255,.15)', color:'#fff',
                colorScheme:'dark' }}/>
            {isResto && (
              <>
                <input type="file" accept=".docx" ref={importMenuInputRef} style={{ display:'none' }}
                  onChange={async e=>{
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    if (!await confirmDialog(`Importer "${f.name}" ?\n\nTout menu déjà enregistré sur la semaine couverte par ce fichier sera remplacé.`)) return
                    setImportingMenu(true)
                    try {
                      const r = await menuAPI.importerSemaine(f)
                      toast.success(`Menu importé : ${r.data.crees} plat(s), période ${r.data.periode}`)
                      const rr = await menuAPI.list({date_service:menuDate}); setMenuItems(rr.data.results||rr.data||[])
                    } catch (err) {
                      toast.error(err?.response?.data?.error || "Erreur d'import")
                    } finally { setImportingMenu(false) }
                  }}/>
                <button onClick={()=>importMenuInputRef.current?.click()} disabled={importingMenu}
                  title="Importer le menu de la semaine depuis le fichier .docx du prestataire"
                  style={{ border:'1px solid rgba(255,255,255,.3)', borderRadius:6, padding:'3px 10px',
                    fontSize:11, fontWeight:600, background:'rgba(255,255,255,.15)', color:'#fff',
                    cursor: importingMenu ? 'wait' : 'pointer' }}>
                  {importingMenu ? '⏳ Import...' : '📥 Importer la semaine (.docx)'}
                </button>
                <button onClick={()=> menuSelMode ? quitMenuSel() : setMenuSelMode(true)}
                  style={{ border:'1px solid rgba(255,255,255,.3)', borderRadius:6, padding:'3px 10px',
                    fontSize:11, fontWeight:600, background: menuSelMode ? '#dc2626' : 'rgba(255,255,255,.15)', color:'#fff', cursor:'pointer' }}>
                  {menuSelMode ? '✕ Quitter la sélection' : '☑ Actions en masse'}
                </button>
              </>
            )}
          </div>
          )}
          {!isMobile && isResto && menuSelMode && (
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', background:'rgba(15,23,42,.85)', color:'#fff', borderRadius:8, padding:'6px 10px', marginBottom:8, fontSize:11.5 }}>
              <b>{menuSel.size} sélectionné(s)</b>
              <button onClick={()=>setMenuSel(menuSel.size===menuItems.length ? new Set() : new Set(menuItems.map(m=>m.id)))}
                style={{ background:'rgba(255,255,255,.15)', color:'#fff', border:'none', borderRadius:5, padding:'3px 9px', cursor:'pointer', fontSize:11 }}>
                {menuSel.size===menuItems.length && menuItems.length>0 ? 'Tout désélectionner' : `Tout sélectionner (${menuItems.length})`}</button>
              <span style={{ flex:1 }}/>
              <button disabled={!menuSel.size} onClick={()=>{ setMenuBulkForm({type_plat:'',repas:'',disponible:'',date_service:''}); setMenuBulkModal(true) }}
                style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:5, padding:'4px 10px', cursor:'pointer', fontSize:11, fontWeight:700, opacity:menuSel.size?1:.5 }}>✏️ Modifier / déplacer</button>
              <button disabled={!menuSel.size} onClick={menuBulkDelete}
                style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:5, padding:'4px 10px', cursor:'pointer', fontSize:11, fontWeight:700, opacity:menuSel.size?1:.5 }}>🗑️ Supprimer</button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0,1fr))' : 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { key:'petit_dejeuner', menuKey:'matin',  icon:'🌅', label:'Petit-déj.', color:'#f97316', bg:'rgba(249,115,22,.1)', border:'rgba(249,115,22,.25)' },
              { key:'dejeuner',       menuKey:'midi',   icon:'☀️',  label:'Déjeuner',  color:'#2563eb', bg:'rgba(37,99,235,.1)',  border:'rgba(37,99,235,.25)' },
              { key:'diner',          menuKey:'soir',   icon:'🌙', label:'Dîner',     color:'#7c3aed', bg:'rgba(124,58,237,.1)', border:'rgba(124,58,237,.25)' },
            ].map(t => {
              const platsRepas = menuItems.filter(m => m.repas === t.menuKey)
              const TYPE_ORDER_LOCAL = ['entree','plat','dessert','boisson','special']
              const TYPE_LABELS_LOCAL = { entree:'Entrée', plat:'Plat', dessert:'Dessert', boisson:'Boisson', special:'Spécial' }
              return (
                <div key={t.key}
                  onDragOver={isResto && !isMobile ? (e)=>{ if(dragPlat){ e.preventDefault(); setDropRepas(t.menuKey) } } : undefined}
                  onDragLeave={isResto && !isMobile ? ()=>setDropRepas(r=>r===t.menuKey?null:r) : undefined}
                  onDrop={isResto && !isMobile ? (e)=>{ e.preventDefault(); deplacerPlats(t.menuKey) } : undefined}
                  style={{ background: t.bg, border: dropRepas===t.menuKey ? `2px dashed ${t.color}` : `1.5px solid ${t.border}`, borderRadius: 12, overflow:'hidden', transition:'border .1s' }}>
                  {/* Compteur */}
                  <div style={{ padding: '10px 14px', textAlign: 'center', borderBottom: platsRepas.length>0 ? `1px solid ${t.border}` : 'none' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 900, color: t.color }}>{stats.byType?.[t.key] || 0}</div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: .8, marginTop: 2 }}>{t.label}</div>
                  </div>
                  {/* Plats du menu + gestion (ajout/modif/suppr) — réservés au
                      desktop : sur mobile le compteur seul suffit, la gestion
                      du menu du jour se fait depuis un écran plus large. */}
                  {!isMobile && platsRepas.length > 0 && (
                    <div style={{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:3 }}>
                      {TYPE_ORDER_LOCAL.map(type => {
                        const items = platsRepas.filter(m => m.type_plat === type)
                        if (items.length === 0) return null
                        return (
                          <div key={type}>
                            <div style={{ fontSize:9, fontWeight:700, color:t.color, textTransform:'uppercase',
                              letterSpacing:'.5px', marginBottom:2, opacity:.8 }}>
                              {TYPE_LABELS_LOCAL[type]}
                            </div>
                            {items.map(m => (
                              <div key={m.id} draggable={isResto}
                                onDragStart={isResto ? (e)=>{ setDragPlat(m.id); e.dataTransfer.effectAllowed='move'; try{e.dataTransfer.setData('text/plain', String(m.id))}catch{} } : undefined}
                                onDragEnd={()=>{ setDragPlat(null); setDropRepas(null) }}
                                title={isResto ? 'Glisser vers un autre repas pour le déplacer' : undefined}
                                style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                                background:'rgba(255,255,255,0.6)', borderRadius:5, padding:'3px 6px', marginBottom:2,
                                cursor: isResto ? 'grab' : 'default', opacity: dragPlat===m.id ? .4 : 1 }}>
                                {isResto && menuSelMode && <input type="checkbox" checked={menuSel.has(m.id)} onChange={()=>toggleMenuSel(m.id)} style={{ marginRight:5, flexShrink:0 }}/>}
                                {m.photo_base64 && (
                                  <img src={`data:image/jpeg;base64,${String(m.photo_base64).replace(/^data:[^;]+;base64,/,'')}`}
                                    alt="" style={{ width:16, height:16, objectFit:'cover', borderRadius:3, marginRight:4, flexShrink:0 }}/>
                                )}
                                <span title={m.description ? `${m.nom} — ${m.description}` : m.nom} style={{ fontSize:10, fontWeight:600, color:'#1e293b', flex:1,
                                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.nom}</span>
                                <div style={{ display:'flex', gap:2, marginLeft:4, flexShrink:0 }}>
                                  <button onClick={()=>setMenuForm(m)} title="Modifier"
                                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, padding:'1px 2px' }}>✏️</button>
                                  <button onClick={async()=>{
                                    if(!await confirmDialog('Supprimer ?'))return
                                    try{await menuAPI.delete(m.id);setMenuItems(p=>p.filter(x=>x.id!==m.id))}
                                    catch{toast.error('Erreur suppression')}
                                  }} title="Supprimer"
                                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, padding:'1px 2px' }}>🗑️</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {isMobile && platsRepas.length > 0 && (
                    <div style={{ padding:'6px 8px', textAlign:'center' }}>
                      <span style={{ fontSize:10, color:t.color, fontWeight:600 }}>{platsRepas.length} plat(s) au menu</span>
                    </div>
                  )}
                  {/* Bouton Ajouter plat — desktop uniquement (voir ci-dessus) */}
                  {!isMobile && (
                  <div style={{ padding:'4px 8px 8px' }}>
                    <button onClick={()=>setMenuForm({nom:'',type_plat:'plat',repas:t.menuKey,
                      date_service:menuDate,description:'',disponible:true})}
                      style={{ width:'100%', background:'rgba(255,255,255,0.5)', border:`1px dashed ${t.color}`,
                        color:t.color, borderRadius:6, padding:'4px 0', cursor:'pointer',
                        fontSize:10, fontWeight:700 }}>
                      ➕ Plat
                    </button>
                  </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ fontSize:10.5, color:'var(--rzc-text-3)', margin:'-4px 0 10px' }}>
          Symboles : <b>(H)</b> = Healthier choice, <b>(V)</b> = Vegetarian
        </div>
        {menuBulkModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16 }}
            onClick={()=>setMenuBulkModal(false)}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:380, padding:22, color:'#0f172a' }}>
              <h3 style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>✏️ Modifier {menuSel.size} plat(s)</h3>
              <p style={{ fontSize:12, color:'#64748b', marginBottom:12 }}>Laissez « — inchangé — » pour ne pas toucher à un champ.</p>
              {[
                ['Type', 'type_plat', [['','— inchangé —'],['entree','Entrée'],['plat','Plat principal'],['dessert','Dessert'],['boisson','Boisson'],['special','Spécial']]],
                ['Repas', 'repas', [['','— inchangé —'],['matin','Petit déjeuner'],['midi','Déjeuner'],['soir','Dîner']]],
                ['Disponibilité', 'disponible', [['','— inchangé —'],['true','Disponible'],['false','Indisponible']]],
              ].map(([lbl,key,opts]) => (
                <label key={key} style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', marginBottom:10 }}>{lbl}
                  <select value={menuBulkForm[key]} onChange={e=>setMenuBulkForm(f=>({...f,[key]:e.target.value}))}
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid #cbd5e1', borderRadius:8, fontSize:13, marginTop:4, background:'#fff', color:'#0f172a' }}>
                    {opts.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              ))}
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#475569', marginBottom:10 }}>Déplacer vers le jour
                <input type="date" value={menuBulkForm.date_service} onChange={e=>setMenuBulkForm(f=>({...f,date_service:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', border:'1px solid #cbd5e1', borderRadius:8, fontSize:13, marginTop:4, background:'#fff', color:'#0f172a', boxSizing:'border-box' }}/>
              </label>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button onClick={()=>setMenuBulkModal(false)} style={{ background:'#f1f5f9', color:'#334155', border:'none', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12.5, fontWeight:600 }}>Annuler</button>
                <button onClick={menuBulkApply} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:12.5, fontWeight:700 }}>Appliquer</button>
              </div>
            </div>
          </div>
        )}

        {/* Dernier scan */}
        <LastScanCard scan={stats.lastScan} isMobile={isMobile} repasLabel={repas?.label} />

        {/* Amélioration continue — avis du personnel sur les repas */}
        {avisStats && avisStats.count > 0 && (
          <div style={{background:'#fff',border:'1px solid var(--rzc-border-light)',borderRadius:12,padding:14,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:'#7c3aed'}}>📊 Amélioration continue — 30 derniers jours</div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontSize:11,color:'var(--rzc-text-3)'}}>{avisStats.count} avis</div>
                {!isMobile && (
                <a href={avisAPI.exportCsv('30j')} target="_blank" rel="noreferrer"
                  style={{fontSize:11,color:'#7c3aed',fontWeight:700,textDecoration:'none',border:'1px solid #ddd6fe',
                    padding:'4px 10px',borderRadius:20,background:'#f5f3ff'}}>
                  ⬇️ Export CSV
                </a>
                )}
                {isMobile && (
                  <button onClick={()=>setAvisOpenMobile(v=>!v)}
                    style={{background:'none',border:'1px solid #ddd6fe',color:'#7c3aed',borderRadius:20,
                      padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                    {avisOpenMobile ? '▲ Masquer' : '▼ Détail'}
                  </button>
                )}
              </div>
            </div>

            {/* Graphique de tendance — 90 derniers jours (masqué par défaut
                sur mobile, derrière le bouton "Détail" ci-dessus) */}
            {(!isMobile || avisOpenMobile) && avisEvolution.length > 1 && (
              <div style={{height:130,marginBottom:14}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={avisEvolution}>
                    <XAxis dataKey="date" tick={{fontSize:9}} tickFormatter={d=>d.slice(5)} />
                    <YAxis domain={[0,5]} tick={{fontSize:9}} width={22}/>
                    <Tooltip formatter={(v)=>[`${v}/5`,'Moyenne']} labelFormatter={l=>new Date(l).toLocaleDateString('fr-FR')}/>
                    <Line type="monotone" dataKey="moyenne" stroke="#7c3aed" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Détail par question, par plat et liste des avis — masqués par
                défaut sur mobile derrière le bouton "Détail" (voir plus haut) */}
            {(!isMobile || avisOpenMobile) && (
            <>
            {avisStats.par_question && avisStats.par_question.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {avisStats.par_question.map(q => (
                  <div key={q.id} style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--rzc-text-2)',minWidth:160}}>{q.label}</span>
                    {q.type === 'etoiles' && q.moyenne != null && (
                      <span style={{fontSize:13,fontWeight:800,color:'#7c3aed',fontFamily:'monospace'}}>{q.moyenne}/5 ⭐</span>
                    )}
                    {q.type === 'oui_non' && (
                      <span style={{fontSize:12,color:'var(--rzc-text-3)'}}>
                        ✅ {q.oui||0} <span style={{color:'var(--rzc-text-4)'}}>/</span> ❌ {q.non||0}
                      </span>
                    )}
                    {q.type === 'choix' && (
                      <span style={{fontSize:11,color:'var(--rzc-text-3)'}}>
                        {Object.entries(q.repartition||{}).map(([opt,c])=>`${opt} (${c})`).join(' · ')}
                      </span>
                    )}
                    {q.type === 'texte' && (
                      <span style={{fontSize:11,color:'var(--rzc-text-4)'}}>{q.count} réponse(s) texte</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                  <span style={{fontSize:28,fontWeight:900,color:'#7c3aed',fontFamily:'monospace'}}>{avisStats.moyenne}</span>
                  <span style={{fontSize:12,color:'var(--rzc-text-3)'}}>/5 ⭐</span>
                </div>
                <div style={{display:'flex',gap:10,fontSize:11,color:'var(--rzc-text-3)'}}>
                  {Object.entries(avisStats.par_repas||{}).map(([repas,d])=>(
                    <div key={repas}>
                      {{matin:'🌅',midi:'☀️',soir:'🌙'}[repas]||''} {d.moyenne}/5 <span style={{color:'var(--rzc-text-4)'}}>({d.count})</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:3,marginLeft:'auto'}}>
                  {[5,4,3,2,1].map(n=>(
                    <div key={n} title={`${avisStats.repartition?.[n]||0} avis à ${n}⭐`}
                      style={{width:8,height:Math.max(6,(avisStats.repartition?.[n]||0)*4),
                        background:n>=4?'#16a34a':n===3?'#eab308':'#dc2626',borderRadius:2,alignSelf:'flex-end'}}/>
                  ))}
                </div>
              </div>
            )}

            {/* Note moyenne par plat servi (lien avec le menu du jour) */}
            {avisStats.par_menu && avisStats.par_menu.length > 0 && (
              <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--rzc-border-light)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase'}}>
                  🍽️ Note moyenne par plat servi
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {avisStats.par_menu.slice(0,8).map(m => (
                    <div key={m.plat} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                      <span style={{flex:1,color:'var(--rzc-text-2)'}}>{m.plat}</span>
                      <span style={{fontWeight:800,fontFamily:'monospace',
                        color: m.moyenne>=4?'#16a34a':m.moyenne>=3?'#eab308':'#dc2626'}}>
                        {m.moyenne!=null ? `${m.moyenne}/5` : '—'}
                      </span>
                      <span style={{fontSize:10,color:'var(--rzc-text-4)',minWidth:60,textAlign:'right'}}>({m.nb_avis} avis)</span>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:9,color:'var(--rzc-text-4)',marginTop:6,fontStyle:'italic'}}>
                  Indicatif : moyenne des avis du jour où ce plat était servi, pas une note du plat en particulier.
                </div>
              </div>
            )}

            <button onClick={()=>setShowAvisListe(v=>!v)}
              style={{marginTop:12,background:'none',border:'none',color:'#7c3aed',fontSize:11,fontWeight:700,cursor:'pointer',textDecoration:'underline'}}>
              {showAvisListe ? '▲ Masquer' : `▼ Voir le détail (${avisListe.length} avis)`}
            </button>

            {showAvisListe && (
              <div style={{marginTop:10,maxHeight:400,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
                {avisListe.length === 0 ? (
                  <div style={{fontSize:12,color:'var(--rzc-text-4)',textAlign:'center',padding:10}}>Aucun avis pour le moment.</div>
                ) : avisListe.map(a => (
                  <div key={a.id} style={{background:'var(--rzc-charcoal)',borderRadius:9,padding:'10px 12px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--rzc-text-3)',marginBottom:6}}>
                      <span>{{matin:'🌅',midi:'☀️',soir:'🌙'}[a.repas]||''} {a.repas_label} — {a.personnel_nom}</span>
                      <span>{new Date(a.date_creation).toLocaleDateString('fr-FR')} {new Date(a.date_creation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    {a.menu_jour && a.menu_jour.length > 0 && (
                      <div style={{fontSize:10,color:'var(--rzc-text-4)',marginBottom:6,fontStyle:'italic'}}>
                        🍽️ Servi ce jour-là : {a.menu_jour.join(', ')}
                      </div>
                    )}
                    {a.reponses && a.reponses.length > 0 ? (
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        {a.reponses.map((r,i) => (
                          <div key={i} style={{fontSize:12,display:'flex',gap:6}}>
                            <span style={{color:'var(--rzc-text-3)',minWidth:140}}>{r.question_label} :</span>
                            <span style={{fontWeight:600,color:'var(--rzc-text)'}}>
                              {r.question_type==='etoiles' && r.valeur_etoiles && '⭐'.repeat(r.valeur_etoiles)}
                              {r.question_type==='oui_non' && (r.valeur_oui_non ? '✅ Oui' : '❌ Non')}
                              {r.question_type==='choix' && r.valeur_choix}
                              {r.question_type==='texte' && (r.valeur_texte || '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize:12,fontWeight:600}}>{'⭐'.repeat(a.note)} {a.commentaire && `— ${a.commentaire}`}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* Layout : Scanner + Historique */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, alignItems: 'start' }}>
          {/* Scanner */}
          <div>
            <QRScanner
              key={typeRepas}
              typeRepas={typeRepas}
              onSuccess={() => {
                setTimeout(() => loadHistorique(), 1500)
                setShowAvis(true)
              }}
            />
            {showAvis ? (
              <AvisRapide typeRepas={typeRepas} onDone={()=>setShowAvis(false)}/>
            ) : (
              <button onClick={()=>setShowAvis(true)}
                style={{width:'100%',marginTop:10,background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e',
                  padding:'8px 12px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700}}>
                💬 Donner un avis sur un repas
              </button>
            )}
          </div>

          {/* Historique */}
          <HistoriqueList
            data={historique}
            onRefresh={loadHistorique}
              loading={loading}
            isMobile={isMobile}
          />
        </div>

        <MenuFormModal
          menuForm={menuForm} setMenuForm={setMenuForm}
          menuDate={menuDate} setMenuItems={setMenuItems}
        />
      </div>
    )
  }

  // ── Interface Agent (mon QR) ──
  return (
    <div className="rzc-page-scope" style={{ padding: 16 }}>
      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        <div style={{ background: 'var(--rzc-charcoal-l1)', border: '2px solid #7c3aed', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#7c3aed', marginBottom: 6 }}>📱 Mon QR Restaurant</div>
          <div style={{ fontSize: 11, color: 'var(--rzc-text-3)', marginBottom: 16 }}>Présentez ce code au restaurant</div>

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
            <div style={{ padding: 32, color: 'var(--rzc-text-3)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>QR non disponible</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Contactez l'administrateur</div>
            </div>
          )}
        </div>

        {/* Menu du jour — lecture seule pour l'agent, avec photo si renseignée */}
        {menuItems.length > 0 && (
          <div style={{ marginTop: 16, background: 'var(--rzc-charcoal-l1)', borderRadius: 12, padding: 14, border: '1px solid var(--rzc-border-light)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rzc-text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>🍽️ Menu du jour</div>
            {REPAS.map(r => {
              const menuKey = { petit_dejeuner:'matin', dejeuner:'midi', diner:'soir' }[r.key]
              const plats = menuItems.filter(m => m.repas === menuKey)
              if (plats.length === 0) return null
              return (
                <div key={r.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: r.color, marginBottom: 5 }}>{r.emoji} {r.label}</div>
                  {plats.map(m => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
                      {m.photo_base64 ? (
                        <img src={`data:image/jpeg;base64,${String(m.photo_base64).replace(/^data:[^;]+;base64,/,'')}`}
                          alt={m.nom} style={{ width:36, height:36, objectFit:'cover', borderRadius:7, flexShrink:0 }}/>
                      ) : (
                        <span style={{ width:36, height:36, borderRadius:7, background:'var(--rzc-charcoal-l2)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>🍽️</span>
                      )}
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:600, color:'var(--rzc-text)' }}>{m.nom}</div>
                        {m.description && <div style={{ fontSize:10.5, color:'var(--rzc-text-4)' }}>{m.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* Horaires repas */}
        <div style={{ marginTop: 16, background: 'var(--rzc-charcoal-l1)', borderRadius: 12, padding: 14, border: '1px solid var(--rzc-border-light)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rzc-text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Horaires des repas</div>
          {REPAS.map(r => (
            <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--rzc-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{r.emoji}</span>
                <span style={{ fontSize: 13 }}>{r.label}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--rzc-text-3)' }}>{heureRepas(r)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Bloc Menu du jour — groupé par repas puis par type ──
const REPAS_CONFIG = [
  { key:'matin',  label:'🌅 Petit-déjeuner', color:'#f59e0b', bg:'#fffbeb' },
  { key:'midi',   label:'☀️ Déjeuner',        color:'#0891b2', bg:'#ecfeff' },
  { key:'soir',   label:'🌙 Dîner',           color:'#6d28d9', bg:'#f5f3ff' },
]
const TYPE_ORDER = ['entree','plat','dessert','boisson','special']
const TYPE_LABELS = { entree:'Entrée', plat:'Plat principal', dessert:'Dessert', boisson:'Boisson', special:'Spécial' }

function MenuDuJour({ menuItems, setMenuItems, menuDate, setMenuDate, menuForm, setMenuForm }) {
  return (
    <div style={{marginTop:16,borderTop:'1px solid var(--rzc-border-light)',paddingTop:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:13,color:'var(--rzc-navy)'}}>🍽️ Menu du jour</div>
        <button onClick={()=>setMenuForm({nom:'',type_plat:'plat',repas:'midi',
          date_service:menuDate,description:'',disponible:true})}
          style={{background:'var(--rzc-navy)',color:'#fff',border:'none',
            padding:'4px 10px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
          ➕ Plat
        </button>
      </div>
      <input type="date" value={menuDate}
        onChange={async e=>{
          setMenuDate(e.target.value)
          try{const r=await menuAPI.list({date_service:e.target.value});setMenuItems(r.data.results||r.data||[])}
          catch{ setMenuItems([]) }
        }}
        style={{border:'1px solid var(--rzc-border-light)',borderRadius:7,padding:'5px 8px',
          fontSize:11,outline:'none',marginBottom:10,width:'100%',boxSizing:'border-box'}}/>

      {menuItems.length===0 ? (
        <div style={{color:'var(--rzc-text-3)',fontSize:11,textAlign:'center',padding:12,
          background:'var(--rzc-charcoal-l1)',borderRadius:8,border:'1px dashed var(--rzc-border-light)'}}>
          Aucun plat pour cette date
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {REPAS_CONFIG.map(repas => {
            const plats = menuItems.filter(m => m.repas === repas.key)
            if (plats.length === 0) return null
            // Grouper par type_plat dans l'ordre défini
            const byType = TYPE_ORDER.reduce((acc, t) => {
              const items = plats.filter(m => m.type_plat === t)
              if (items.length > 0) acc[t] = items
              return acc
            }, {})
            return (
              <div key={repas.key} style={{borderRadius:10,overflow:'hidden',
                border:`1.5px solid ${repas.color}40`}}>
                {/* Header repas */}
                <div style={{background:repas.bg,padding:'8px 12px',
                  borderBottom:`1.5px solid ${repas.color}40`,
                  display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontWeight:700,fontSize:12,color:repas.color}}>{repas.label}</span>
                  <span style={{fontSize:10,color:repas.color,opacity:.7}}>{plats.length} plat{plats.length>1?'s':''}</span>
                </div>
                {/* Plats par type */}
                {Object.entries(byType).map(([type, items]) => (
                  <div key={type}>
                    <div style={{padding:'4px 12px',background:'var(--surface-alt,#f8fafc)',
                      fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',
                      letterSpacing:'0.5px',borderBottom:'1px solid var(--rzc-border-light)'}}>
                      {TYPE_LABELS[type]||type}
                    </div>
                    {items.map(m => (
                      <div key={m.id} style={{display:'flex',alignItems:'center',gap:8,
                        padding:'8px 12px',borderBottom:'1px solid var(--rzc-border-light)',
                        background:m.disponible?'transparent':'#fef9c3'}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:12,color:'var(--rzc-text)'}}>{m.nom}</div>
                          {m.description && (
                            <div style={{fontSize:10,color:'var(--rzc-text-3)',marginTop:1}}>{m.description}</div>
                          )}
                          {!m.disponible && (
                            <span style={{fontSize:9,color:'#d97706',fontWeight:700}}>⚠️ Indisponible</span>
                          )}
                        </div>
                        <button onClick={()=>setMenuForm(m)} title="Modifier"
                          style={{background:'#eff6ff',color:'#2563eb',border:'none',
                            padding:'3px 7px',borderRadius:5,cursor:'pointer',fontSize:11}}>✏️</button>
                        <button onClick={async()=>{
                          if(!await confirmDialog('Supprimer ce plat ?'))return
                          try{await menuAPI.delete(m.id);setMenuItems(p=>p.filter(x=>x.id!==m.id))}
                          catch{toast.error('Erreur suppression')}
                        }} title="Supprimer"
                          style={{background:'#fef2f2',color:'#dc2626',border:'none',
                            padding:'3px 7px',borderRadius:5,cursor:'pointer',fontSize:11}}>🗑️</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MenuFormModal({ menuForm, setMenuForm, menuDate, setMenuItems }) {
  const isMobile = useIsMobile()
  if (!menuForm) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000,padding:16}}
      onClick={e=>e.target===e.currentTarget&&setMenuForm(null)}>
      <div style={{background:'var(--rzc-charcoal-l1)',borderRadius:14,width:'100%',maxWidth:380,
        overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{background:'var(--rzc-navy)',color:'#fff',padding:'12px 16px',
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <b style={{fontSize:14}}>{menuForm.id?'Modifier':'Nouveau plat'}</b>
          <button onClick={()=>setMenuForm(null)}
            style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
              width:26,height:26,borderRadius:6,cursor:'pointer',fontSize:16}}>✕</button>
        </div>
        <div style={{padding:14,display:'flex',flexDirection:'column',gap:9}}>
          <input value={menuForm.nom||''} onChange={e=>setMenuForm(f=>({...f,nom:e.target.value}))}
            placeholder="Nom du plat *"
            style={{border:'2px solid var(--rzc-border-light)',borderRadius:8,padding:'8px 10px',
              fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}}/>
          <textarea value={menuForm.description||''} onChange={e=>setMenuForm(f=>({...f,description:e.target.value}))}
            placeholder="Description"
            style={{border:'2px solid var(--rzc-border-light)',borderRadius:8,padding:'8px 10px',
              fontSize:12,outline:'none',minHeight:50,resize:'vertical'}}/>
          <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:8}}>
            <select value={menuForm.repas||'midi'} onChange={e=>setMenuForm(f=>({...f,repas:e.target.value}))}
              style={{border:'2px solid var(--rzc-border-light)',borderRadius:8,padding:'7px 8px',fontSize:12,outline:'none'}}>
              <option value="matin">Petit-déj</option>
              <option value="midi">Déjeuner</option>
              <option value="soir">Dîner</option>
            </select>
            <select value={menuForm.type_plat||'plat'} onChange={e=>setMenuForm(f=>({...f,type_plat:e.target.value}))}
              style={{border:'2px solid var(--rzc-border-light)',borderRadius:8,padding:'7px 8px',fontSize:12,outline:'none'}}>
              <option value="entree">Entrée</option>
              <option value="plat">Plat</option>
              <option value="dessert">Dessert</option>
              <option value="boisson">Boisson</option>
            </select>
          </div>
          <input type="date" value={menuForm.date_service||menuDate}
            onChange={e=>setMenuForm(f=>({...f,date_service:e.target.value}))}
            style={{border:'2px solid var(--rzc-border-light)',borderRadius:8,padding:'8px 10px',
              fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}}/>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:'var(--rzc-text-3)',display:'block',marginBottom:5}}>📷 Photo du plat (optionnel)</label>
            {menuForm.photo_base64 ? (
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <img src={`data:image/jpeg;base64,${String(menuForm.photo_base64).replace(/^data:[^;]+;base64,/,'')}`}
                  alt="Photo du plat" style={{width:56,height:56,objectFit:'cover',borderRadius:8,border:'1px solid var(--rzc-border-light)'}}/>
                <button type="button" onClick={()=>setMenuForm(f=>({...f,photo_base64:''}))}
                  style={{background:'none',border:'1px solid var(--rzc-border-light)',borderRadius:7,padding:'5px 10px',cursor:'pointer',fontSize:11,color:'#dc2626'}}>
                  🗑️ Retirer
                </button>
              </div>
            ) : (
              <input type="file" accept="image/*" onChange={e=>{
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 3*1024*1024) { toast.error('Photo trop lourde (max 3 Mo)'); return }
                  const reader = new FileReader()
                  reader.onload = () => setMenuForm(ff=>({...ff, photo_base64: reader.result}))
                  reader.readAsDataURL(f)
                }}
                style={{fontSize:12,width:'100%'}}/>
            )}
          </div>
          <button onClick={async()=>{
            if(!menuForm.nom||!menuForm.date_service){toast.success('Nom et date requis');return}
            try{
              const res=await(menuForm.id?menuAPI.update(menuForm.id,menuForm):menuAPI.create(menuForm))
              const u=res.data
              setMenuItems(prev=>menuForm.id?prev.map(x=>x.id===u.id?u:x):(u.date_service===menuDate?[...prev,u]:prev))
              setMenuForm(null)
            }catch{toast.error('Erreur sauvegarde')}
          }} style={{background:'var(--rzc-navy)',color:'#fff',border:'none',padding:11,
            borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',
            width:'100%'}}>
            💾 Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
