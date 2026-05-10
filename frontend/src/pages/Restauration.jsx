import React, { useState, useEffect, useRef, useCallback } from 'react'
import { qr, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'🌅 Petit-déjeuner', color:'#f97316', time:'06:00–09:00' },
  { key:'dejeuner', label:'☀️ Déjeuner', color:'#2563eb', time:'12:00–14:00' },
  { key:'diner', label:'🌙 Dîner', color:'#7c3aed', time:'18:00–20:00' },
]

/* ════════════════════════════════════════════════
   SCANNER QR — composant isolé, cycle de vie propre
   ════════════════════════════════════════════════ */
function QRScanner({ onResult, color, repasLabel }) {
  const [phase, setPhase] = useState('idle') // idle|loading|scanning|done|error
  const [errMsg, setErrMsg] = useState('')
  const [lastRaw, setLastRaw] = useState('')
  const scanner = useRef(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; cleanup() }
  }, [])

  const cleanup = async () => {
    if (scanner.current) {
      try { await scanner.current.stop() } catch {}
      try { scanner.current.clear() } catch {}
      scanner.current = null
    }
  }

  const start = async () => {
    setErrMsg(''); setLastRaw('')
    setPhase('loading')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!alive.current) return
      const s = new Html5Qrcode('qr-video-box')
      scanner.current = s
      setPhase('scanning')
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          setLastRaw(decoded)
          await cleanup()
          if (!alive.current) return
          setPhase('done')
          onResult(decoded)
        },
        () => {}
      )
    } catch (e) {
      if (!alive.current) return
      setPhase('error')
      setErrMsg('Impossible d\'accéder à la caméra')
    }
  }

  const stop = async () => { await cleanup(); setPhase('idle') }

  return (
    <div>
      {/* Bouton démarrer */}
      {(phase === 'idle' || phase === 'done') && (
        <button onClick={start} style={{
          width:'100%', padding:'22px 16px', borderRadius:12,
          background: `${color}0d`, border: `2px solid ${color}`,
          color, cursor:'pointer', fontWeight:700, fontSize:14,
          display:'flex', flexDirection:'column', alignItems:'center', gap:10
        }}>
          <span style={{ fontSize:52 }}>📷</span>
          {phase === 'done' ? '🔄 Scanner un autre QR' : 'Activer la caméra'}
          <span style={{ fontSize:11, fontWeight:400, color:'#64748b' }}>
            Le résident présente son QR depuis l'onglet "Mon QR"
          </span>
        </button>
      )}

      {/* Chargement */}
      {phase === 'loading' && (
        <div style={{ padding:'32px', textAlign:'center', background:'#f8fafc', borderRadius:12 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📡</div>
          <div style={{ color:'#64748b', fontSize:13 }}>Démarrage caméra...</div>
        </div>
      )}

      {/* Zone vidéo — TOUJOURS dans le DOM pendant scanning */}
      <div id="qr-video-box" style={{
        display: phase === 'scanning' ? 'block' : 'none',
        borderRadius: 10, overflow:'hidden',
        border: `2px solid ${color}`
      }}/>

      {phase === 'scanning' && (
        <div style={{ marginTop:10 }}>
          <div style={{ background:`${color}0d`, border:`1px solid ${color}30`, borderRadius:8, padding:'8px 14px', fontSize:12, color, marginBottom:8, textAlign:'center' }}>
            📱 Pointez la caméra vers le QR du résident · {repasLabel}
          </div>
          <button onClick={stop} style={{
            width:'100%', background:'rgba(220,38,38,.1)', color:'#dc2626',
            border:'1px solid rgba(220,38,38,.3)', padding:'9px', borderRadius:8,
            cursor:'pointer', fontSize:12, fontWeight:700
          }}>✕ Arrêter le scanner</button>
        </div>
      )}

      {/* Erreur caméra */}
      {phase === 'error' && (
        <div style={{ background:'rgba(220,38,38,.06)', border:'1px solid rgba(220,38,38,.2)', borderRadius:10, padding:16, textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📵</div>
          <div style={{ fontSize:13, color:'#dc2626', fontWeight:600, marginBottom:4 }}>{errMsg}</div>
          <div style={{ fontSize:11, color:'#64748b', marginBottom:10 }}>
            Vérifiez les permissions caméra du navigateur,<br/>ou utilisez la sélection manuelle ci-dessous.
          </div>
          <button onClick={()=>setPhase('idle')} style={{
            background:'#dc2626', color:'#fff', border:'none',
            padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700
          }}>Réessayer</button>
        </div>
      )}

      {/* Debug: afficher le contenu brut lu */}
      {lastRaw && (
        <div style={{ marginTop:8, background:'#f8fafc', borderRadius:8, padding:'6px 10px', fontSize:10, color:'#94a3b8', fontFamily:'monospace', wordBreak:'break-all' }}>
          QR lu: {lastRaw}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   SÉLECTION MANUELLE — fallback fiable
   ════════════════════════════════════════════════ */
function SelectionManuelle({ list, typeRepas, color, onSuccess, onError }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [loading, setLoading] = useState(false)

  const filtered = list.filter(p =>
    !q || `${p.nom} ${p.prenom} ${p.societe} ${p.numero}`.toLowerCase().includes(q.toLowerCase())
  )

  const valider = async () => {
    if (!sel) return
    setLoading(true)
    try {
      const r = await qr.validerParPersonnel({ personnel_id: sel.id, type_repas: typeRepas })
      onSuccess(r.data)
      setSel(null); setQ('')
    } catch(e) {
      onError(e.response?.data?.erreur || 'Erreur de validation')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <input value={q} onChange={e=>setQ(e.target.value)}
        placeholder="🔍  Nom, prénom, société, numéro..."
        style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'9px 12px',
          fontSize:13, outline:'none', marginBottom:8, background:'#f8fafc' }}
        onFocus={e=>e.target.style.borderColor=color}
        onBlur={e=>e.target.style.borderColor='#e2e8f0'}
      />

      <div style={{ maxHeight:210, overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:10, marginBottom:10 }}>
        {filtered.length === 0
          ? <div style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:12 }}>
              {list.length === 0 ? 'Aucun personnel déclaré — Créez du personnel depuis le menu Personnel' : 'Aucun résultat'}
            </div>
          : filtered.map(p => {
              const active = sel?.id === p.id
              return (
                <div key={p.id} onClick={()=>setSel(p)}
                  style={{
                    padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:12,
                    background: active ? `${color}0f` : '#fff',
                    borderBottom:'1px solid #f1f5f9',
                    borderLeft: `3px solid ${active ? color : 'transparent'}`,
                    transition:'all .1s'
                  }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${color}15`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {p.type_personnel === 'roxgold' ? '👷' : p.type_personnel === 'visiteur' ? '🧑‍💼' : '👤'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:'#1e3a8a' }}>{p.nom} {p.prenom}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{p.societe} · {p.numero}</div>
                  </div>
                  {active && <span style={{ color, fontSize:18 }}>✓</span>}
                </div>
              )
            })
        }
      </div>

      <button onClick={valider} disabled={!sel || loading}
        style={{ width:'100%', background: sel ? color : '#e2e8f0',
          color: sel ? '#fff' : '#94a3b8', border:'none', padding:'12px',
          borderRadius:10, cursor: sel ? 'pointer' : 'default',
          fontSize:14, fontWeight:700, transition:'.2s' }}>
        {loading ? '⏳ Validation...' : sel ? `✅ Valider — ${sel.nom} ${sel.prenom}` : 'Sélectionner un résident'}
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════════
   PAGE PRINCIPALE
   ════════════════════════════════════════════════ */
export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const isResto = role === 'restauration'
  const canValidate = isAdmin || isResto

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [loadingLog, setLoadingLog] = useState(false)
  const [tab, setTab] = useState(canValidate ? 'valider' : 'mon_qr')
  const [mode, setMode] = useState('qr') // 'qr' | 'manuel'
  const [scanKey, setScanKey] = useState(0)
  const [scanMsg, setScanMsg] = useState(null)
  const [myQR, setMyQR] = useState(null)
  const [allPersonnel, setAllPersonnel] = useState([])
  const today = new Date().toISOString().slice(0,10)

  const loadRepas = useCallback(() => {
    setLoadingLog(true)
    qr.repas({ page_size:300, type_repas:typeRepas })
      .then(r => setRepasLog(r.data.results||r.data||[]))
      .catch(() => setRepasLog([]))
      .finally(() => setLoadingLog(false))
  }, [typeRepas])

  useEffect(() => {
    loadRepas()
    personnelAPI.list({ page_size:500 }).then(r => {
      const items = r.data.results||r.data||[]
      setAllPersonnel(items)
      // Trouver le QR de l'utilisateur connecté
      if (!canValidate) {
        const me = items.find(p =>
          p.login_genere === user?.username ||
          (p.nom?.toLowerCase() === (user?.last_name||'').toLowerCase() &&
           p.prenom?.toLowerCase() === (user?.first_name||'').toLowerCase())
        )
        setMyQR(me || (items.length ? items[0] : null))
      }
    }).catch(()=>{})
  }, [typeRepas])

  const showMsg = (ok, msg, sub='') => {
    setScanMsg({ ok, msg, sub })
    setTimeout(() => setScanMsg(null), 8000)
  }

  const handleQRResult = async (decoded) => {
    showMsg(null, '⏳ Validation en cours...')
    try {
      const r = await qr.scanner({ qr_data: decoded, type_repas: typeRepas })
      showMsg(true, `✅ ${r.data.resident}`,
        `${r.data.type_repas_label} validé · ${r.data.societe||''}`)
      loadRepas()
    } catch(e) {
      const err = e.response?.data?.erreur || 'QR non reconnu'
      showMsg(false, `❌ ${err}`, 'Essayez la sélection manuelle')
    }
  }

  const handleManualOk = (data) => {
    showMsg(true, `✅ ${data.resident}`, `${data.type_repas_label} validé · ${data.societe||''}`)
    loadRepas()
  }

  const repas = REPAS.find(r=>r.key===typeRepas)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:16 }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a8a', marginBottom:4 }}>🍽️ Restauration</h2>
      <p style={{ fontSize:11, color:'#64748b', marginBottom:14 }}>
        {canValidate ? 'Scanner le QR du personnel déclaré · Sélection manuelle · Historique' : 'Mon QR · Mes repas'}
      </p>

      {/* Sélecteur repas */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {REPAS.map(r => (
          <button key={r.key}
            onClick={()=>{ setTypeRepas(r.key); setScanKey(k=>k+1) }}
            style={{ flex:1, padding:'9px 4px', borderRadius:10,
              border:`2px solid ${typeRepas===r.key ? r.color : '#e2e8f0'}`,
              background: typeRepas===r.key ? `${r.color}0f` : '#fff',
              color: typeRepas===r.key ? r.color : '#64748b',
              cursor:'pointer', fontWeight:600, fontSize:11 }}>
            {r.label}<br/>
            <span style={{ fontSize:9, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:14, background:'#f8fafc', padding:4, borderRadius:10, border:'1px solid #e2e8f0' }}>
        {canValidate
          ? [['valider','✅ Valider'],['aujourd_hui','📋 Aujourd\'hui'],['historique','📊 Historique']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{ flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer',
                  fontSize:11, fontWeight:600,
                  background:tab===k?'#fff':'transparent',
                  color:tab===k?'#1e3a8a':'#64748b',
                  boxShadow:tab===k?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
                {l}
              </button>
            ))
          : [['mon_qr','📱 Mon QR'],['mes_repas','🍽️ Mes repas']].map(([k,l])=>(
              <button key={k} onClick={()=>{ setTab(k); if(k==='mes_repas') loadRepas() }}
                style={{ flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer',
                  fontSize:11, fontWeight:600,
                  background:tab===k?'#fff':'transparent',
                  color:tab===k?'#1e3a8a':'#64748b',
                  boxShadow:tab===k?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
                {l}
              </button>
            ))
        }
      </div>

      {/* ── VALIDER ── */}
      {tab==='valider' && canValidate && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

          {/* Colonne gauche: scanner + mode */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, boxShadow:'0 1px 6px rgba(30,58,138,.07)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:12 }}>
              Validation — {repas?.label}
            </div>

            {/* Switch QR / Manuel */}
            <div style={{ display:'flex', gap:3, marginBottom:14, background:'#f8fafc', borderRadius:9, padding:3, border:'1px solid #e2e8f0' }}>
              <button onClick={()=>{ setMode('qr'); setScanKey(k=>k+1) }}
                style={{ flex:1, padding:'8px', border:'none', borderRadius:7, cursor:'pointer',
                  fontSize:12, fontWeight:mode==='qr'?700:500,
                  background:mode==='qr'?repas?.color:'transparent',
                  color:mode==='qr'?'#fff':'#64748b', transition:'.15s' }}>
                📷 Scanner QR
              </button>
              <button onClick={()=>setMode('manuel')}
                style={{ flex:1, padding:'8px', border:'none', borderRadius:7, cursor:'pointer',
                  fontSize:12, fontWeight:mode==='manuel'?700:500,
                  background:mode==='manuel'?repas?.color:'transparent',
                  color:mode==='manuel'?'#fff':'#64748b', transition:'.15s' }}>
                👆 Liste manuelle
              </button>
            </div>

            {/* Mode QR — scanner caméra */}
            {mode==='qr' && (
              <QRScanner
                key={`qs-${scanKey}-${typeRepas}`}
                onResult={handleQRResult}
                color={repas?.color||'#2563eb'}
                repasLabel={repas?.label||''}
              />
            )}

            {/* Mode Manuel — liste déroulante */}
            {mode==='manuel' && (
              <SelectionManuelle
                list={allPersonnel}
                typeRepas={typeRepas}
                color={repas?.color||'#2563eb'}
                onSuccess={handleManualOk}
                onError={msg=>showMsg(false, `❌ ${msg}`)}
              />
            )}

            {/* Message résultat */}
            {scanMsg && (
              <div style={{ marginTop:12,
                background: scanMsg.ok===true?'rgba(22,163,74,.08)':scanMsg.ok===false?'rgba(220,38,38,.08)':'rgba(37,99,235,.06)',
                border:`1px solid ${scanMsg.ok===true?'rgba(22,163,74,.3)':scanMsg.ok===false?'rgba(220,38,38,.3)':'rgba(37,99,235,.2)'}`,
                borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                <div style={{ fontSize:28, marginBottom:6 }}>
                  {scanMsg.ok===true?'✅':scanMsg.ok===false?'❌':'⏳'}
                </div>
                <div style={{ fontSize:14, fontWeight:700,
                  color:scanMsg.ok===true?'#16a34a':scanMsg.ok===false?'#dc2626':'#2563eb' }}>
                  {scanMsg.msg}
                </div>
                {scanMsg.sub && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{scanMsg.sub}</div>}
              </div>
            )}
          </div>

          {/* Colonne droite: compteur du jour */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, boxShadow:'0 1px 6px rgba(30,58,138,.07)' }}>
            <div style={{ fontWeight:600, color:'#1e3a8a', fontSize:13, marginBottom:8 }}>
              Validés aujourd'hui — {repas?.label}
            </div>
            <div style={{ fontFamily:'monospace', fontSize:56, fontWeight:700, color:repas?.color, textAlign:'center', marginBottom:4, lineHeight:1 }}>
              {todayLog.length}
            </div>
            <div style={{ textAlign:'center', fontSize:11, color:'#64748b', marginBottom:14 }}>
              {todayLog.length === 0 ? 'Aucun repas validé' : `repas validé${todayLog.length>1?'s':''}`}
            </div>
            <div style={{ maxHeight:240, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
              {todayLog.map(r => (
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'8px 12px', background:'#f8fafc', borderRadius:8, fontSize:12 }}>
                  <div>
                    <div style={{ fontWeight:700, color:'#1e3a8a' }}>{r.resident||'—'}</div>
                    <div style={{ fontSize:10, color:'#94a3b8' }}>{r.residence||''}</div>
                  </div>
                  <span style={{ color:'#94a3b8', fontFamily:'monospace', fontSize:11 }}>
                    {r.date_validation&&new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              ))}
              {todayLog.length===0 && (
                <div style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:12 }}>
                  Aucun repas validé pour ce service
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AUJOURD'HUI ── */}
      {tab==='aujourd_hui' && (
        <RepasTable data={todayLog} title={`Repas du ${new Date().toLocaleDateString('fr-FR')} — ${repas?.label}`} loading={loadingLog}/>
      )}

      {/* ── HISTORIQUE ── */}
      {tab==='historique' && (
        <RepasTable data={repasLog} title={`Historique — ${repas?.label}`} loading={loadingLog} showDate/>
      )}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:380, margin:'0 auto' }}>
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:24, textAlign:'center', boxShadow:'0 2px 12px rgba(30,58,138,.08)' }}>
            <div style={{ fontWeight:700, fontSize:16, color:'#1e3a8a', marginBottom:4 }}>📱 Mon QR de repas</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>
              Présentez ce QR au restaurant · Il sera scanné pour valider votre repas
            </div>

            {myQR?.qr_code_data
              ? <>
                  <img
                    src={`data:image/png;base64,${myQR.qr_code_data}`}
                    alt="QR code"
                    style={{ width:230, height:230, borderRadius:12, border:'3px solid #e2e8f0', margin:'0 auto 16px', display:'block', imageRendering:'pixelated' }}
                  />
                  <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px', marginBottom:8 }}>
                    <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:14 }}>{myQR.nom} {myQR.prenom}</div>
                    <div style={{ color:'#64748b', fontSize:12, marginTop:2 }}>{myQR.societe} · {myQR.type_personnel}</div>
                  </div>
                  <div style={{ background:'#f1f5f9', borderRadius:8, padding:'6px 10px', fontSize:9, color:'#94a3b8', fontFamily:'monospace', wordBreak:'break-all', textAlign:'left' }}>
                    {myQR.qr_code_string}
                  </div>
                </>
              : <div style={{ padding:40, color:'#94a3b8' }}>
                  <div style={{ fontSize:52, marginBottom:12 }}>📱</div>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>QR non disponible</div>
                  <div style={{ fontSize:12 }}>Votre profil n'est pas encore déclaré.<br/>Contactez l'administrateur.</div>
                </div>
            }
          </div>
          <button onClick={()=>{ setTab('mes_repas'); loadRepas() }}
            style={{ width:'100%', marginTop:12, background:'#1e3a8a', color:'#fff', border:'none', padding:'12px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            📋 Voir mes repas →
          </button>
        </div>
      )}

      {/* ── MES REPAS ── */}
      {tab==='mes_repas' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            <button onClick={loadRepas}
              style={{ background:'#f8fafc', border:'1px solid #e2e8f0', color:'#1e3a8a', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🔄 Actualiser
            </button>
          </div>
          <RepasTable data={repasLog} title={`Mes repas — ${repas?.label}`} loading={loadingLog} showDate/>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   TABLEAU D'HISTORIQUE
   ════════════════════════════════════════════════ */
function RepasTable({ data, title, loading, showDate }) {
  const C = {
    petit_dejeuner:{ label:'🌅 Petit-déj', color:'#f97316' },
    dejeuner:{ label:'☀️ Déjeuner', color:'#2563eb' },
    diner:{ label:'🌙 Dîner', color:'#7c3aed' }
  }
  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>🔄 Chargement...</div>
  )
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 6px rgba(30,58,138,.07)' }}>
      <div style={{ padding:'11px 16px', background:'#1e3a8a', color:'#fff', fontWeight:600, fontSize:13, display:'flex', justifyContent:'space-between' }}>
        <span>{title}</span>
        <span style={{ background:'rgba(255,255,255,.2)', padding:'2px 10px', borderRadius:20, fontSize:12 }}>{data.length}</span>
      </div>
      {data.length === 0
        ? <div style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🍽️</div>Aucune donnée
          </div>
        : <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:360 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {[showDate&&'Date','Heure','Résident','Résidence','Repas'].filter(Boolean).map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'#64748b', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r,i) => {
                const col = C[r.type_repas]
                const dt = r.date_validation ? new Date(r.date_validation) : null
                return (
                  <tr key={r.id} style={{ borderTop:'1px solid #f1f5f9', background: i%2?'#f8fafc':'#fff' }}>
                    {showDate && <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{dt?.toLocaleDateString('fr-FR')||'—'}</td>}
                    <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>
                      {dt?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}
                    </td>
                    <td style={{ padding:'8px 12px', fontWeight:700, color:'#1e3a8a' }}>{r.resident||'—'}</td>
                    <td style={{ padding:'8px 12px', fontSize:11, color:'#64748b' }}>{r.residence||'—'}</td>
                    <td style={{ padding:'8px 12px' }}>
                      {col
                        ? <span style={{ background:`${col.color}18`, color:col.color, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600 }}>{col.label}</span>
                        : <span style={{ color:'#94a3b8', fontSize:11 }}>{r.type_repas_label||r.type_repas||'—'}</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      }
    </div>
  )
}
