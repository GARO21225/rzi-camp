import React, { useState, useEffect, useRef, useCallback } from 'react'
import { qr, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'Petit-déjeuner', emoji:'🌅', color:'#f97316', time:'06h–09h' },
  { key:'dejeuner',       label:'Déjeuner',       emoji:'☀️',  color:'#2563eb', time:'12h–14h' },
  { key:'diner',          label:'Dîner',           emoji:'🌙', color:'#7c3aed', time:'18h–20h' },
]

/* ── Scanner QR caméra ── */
function QRScanner({ onResult, color }) {
  const [phase, setPhase] = useState('idle')
  const [errMsg, setErrMsg] = useState('')
  const scanRef = useRef(null)
  const live = useRef(true)

  useEffect(() => { live.current = true; return () => { live.current = false; cleanup() } }, [])

  const cleanup = async () => {
    if (scanRef.current) {
      try { await scanRef.current.stop() } catch {}
      try { scanRef.current.clear() } catch {}
      scanRef.current = null
    }
  }

  const start = async () => {
    setErrMsg(''); setPhase('loading')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!live.current) return
      const s = new Html5Qrcode('__qr_scan__')
      scanRef.current = s
      setPhase('scanning')
      await s.start({ facingMode:'environment' }, { fps:10, qrbox:240 },
        async txt => {
          await cleanup()
          if (!live.current) return
          setPhase('done'); onResult(txt)
        }, ()=>{})
    } catch {
      if (!live.current) return
      setPhase('error'); setErrMsg('Accès caméra refusé')
    }
  }

  const stop = async () => { await cleanup(); setPhase('idle') }

  return (
    <div>
      {(phase==='idle'||phase==='done') && (
        <button onClick={start} style={{ width:'100%', padding:'20px 16px', borderRadius:12, background:`${color}0d`, border:`2px solid ${color}`, color, cursor:'pointer', fontWeight:700, fontSize:14, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:44 }}>📷</span>
          {phase==='done' ? '🔄 Scanner un autre QR' : 'Activer la caméra'}
          <span style={{ fontSize:11, fontWeight:400, color:'#64748b' }}>Le résident présente son QR code</span>
        </button>
      )}
      {phase==='loading' && <div style={{ padding:28, textAlign:'center', background:'#f8fafc', borderRadius:12 }}><div style={{ fontSize:30, marginBottom:8 }}>📡</div>Démarrage...</div>}
      <div id="__qr_scan__" style={{ display:phase==='scanning'?'block':'none', borderRadius:10, overflow:'hidden', border:`2px solid ${color}` }}/>
      {phase==='scanning' && (
        <button onClick={stop} style={{ width:'100%', marginTop:8, background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.3)', padding:'8px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>✕ Arrêter</button>
      )}
      {phase==='error' && (
        <div style={{ background:'rgba(220,38,38,.06)', border:'1px solid rgba(220,38,38,.2)', borderRadius:10, padding:16, textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:6 }}>📵</div>
          <div style={{ fontSize:12, color:'#dc2626', fontWeight:600, marginBottom:8 }}>{errMsg}</div>
          <button onClick={()=>setPhase('idle')} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'7px 16px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:700 }}>Réessayer</button>
        </div>
      )}
    </div>
  )
}

/* ── Sélection manuelle dans la liste du personnel ── */
function SelectManuel({ list, typeRepas, color, onOk, onErr }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)

  const filtered = list.filter(p => !q || `${p.nom} ${p.prenom} ${p.societe} ${p.numero}`.toLowerCase().includes(q.toLowerCase()))

  const valider = async () => {
    if (!sel) return
    setBusy(true)
    try {
      const r = await qr.validerParPersonnel({ personnel_id:sel.id, type_repas:typeRepas })
      onOk(r.data); setSel(null); setQ('')
    } catch(e) { onErr(e.response?.data?.erreur||'Erreur') }
    finally { setBusy(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher nom, prénom, société..."
        style={{ border:'2px solid #e2e8f0', borderRadius:9, padding:'9px 12px', fontSize:13, outline:'none', width:'100%', background:'#f8fafc' }}
        onFocus={e=>e.target.style.borderColor=color} onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
      <div style={{ maxHeight:200, overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:10 }}>
        {filtered.length===0
          ? <div style={{ padding:16, textAlign:'center', color:'#94a3b8', fontSize:12 }}>
              {list.length===0 ? 'Aucun personnel déclaré' : 'Aucun résultat'}
            </div>
          : filtered.map(p=>(
            <div key={p.id} onClick={()=>setSel(p)}
              style={{ padding:'9px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, background:sel?.id===p.id?`${color}0f`:'#fff', borderBottom:'1px solid #f1f5f9', borderLeft:`3px solid ${sel?.id===p.id?color:'transparent'}` }}>
              <div style={{ width:36, height:36, borderRadius:9, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                {p.type_personnel==='roxgold'?'👷':'👤'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#1e3a8a' }}>{p.nom} {p.prenom}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{p.societe} · {p.numero}</div>
              </div>
              {sel?.id===p.id && <span style={{ color, fontSize:18, fontWeight:700 }}>✓</span>}
            </div>
          ))
        }
      </div>
      <button onClick={valider} disabled={!sel||busy}
        style={{ background:sel?color:'#e2e8f0', color:sel?'#fff':'#94a3b8', border:'none', padding:'11px', borderRadius:10, cursor:sel?'pointer':'default', fontSize:14, fontWeight:700, transition:'.2s' }}>
        {busy ? '⏳ Validation...' : sel ? `✅ Valider — ${sel.nom} ${sel.prenom}` : 'Sélectionner un résident'}
      </button>
    </div>
  )
}

/* ── Tableau historique ── */
function RepasTable({ data, title, loading, showDate }) {
  const C = { petit_dejeuner:{e:'🌅',c:'#f97316'}, dejeuner:{e:'☀️',c:'#2563eb'}, diner:{e:'🌙',c:'#7c3aed'} }
  if (loading) return <div style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>🔄 Chargement...</div>
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ padding:'11px 16px', background:'#1e3a8a', color:'#fff', fontWeight:600, fontSize:13, display:'flex', justifyContent:'space-between' }}>
        <span>{title}</span>
        <span style={{ background:'rgba(255,255,255,.2)', padding:'2px 10px', borderRadius:20, fontSize:12 }}>{data.length}</span>
      </div>
      {data.length===0
        ? <div style={{ padding:32, textAlign:'center', color:'#94a3b8' }}><div style={{ fontSize:32, marginBottom:8 }}>🍽️</div>Aucune donnée</div>
        : <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:360 }}>
          <thead><tr style={{ background:'#f8fafc' }}>
            {[showDate&&'Date','Heure','Résident','Résidence','Repas'].filter(Boolean).map(h=>(
              <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'#64748b', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.map((r,i)=>{
              const col=C[r.type_repas], dt=r.date_validation?new Date(r.date_validation):null
              return (
                <tr key={r.id} style={{ borderTop:'1px solid #f1f5f9', background:i%2?'#f8fafc':'#fff' }}>
                  {showDate&&<td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{dt?.toLocaleDateString('fr-FR')||'—'}</td>}
                  <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>{dt?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}</td>
                  <td style={{ padding:'8px 12px', fontWeight:700, color:'#1e3a8a' }}>{r.resident||'—'}</td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'#64748b' }}>{r.residence||'—'}</td>
                  <td style={{ padding:'8px 12px' }}>
                    {col?<span style={{ background:`${col.c}18`, color:col.c, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600 }}>{col.e} {r.type_repas_label||r.type_repas}</span>:r.type_repas||'—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      }
    </div>
  )
}

/* ══════════════════════════════
   PAGE PRINCIPALE
   ══════════════════════════════ */
export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const isResto = role === 'restauration'
  const canValidate = isAdmin || isResto

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [tab, setTab]             = useState(canValidate ? 'valider' : 'mon_qr')
  const [mode, setMode]           = useState('qr')
  const [scanKey, setScanKey]     = useState(0)
  const [scanMsg, setScanMsg]     = useState(null)
  const [myQR, setMyQR]           = useState(null)          // Personnel de l'utilisateur connecté
  const [myQRLoading, setMyQRL]   = useState(!canValidate)  // Cherche le QR uniquement pour non-admin
  const [allPersonnel, setAll]    = useState([])
  const today = new Date().toISOString().slice(0,10)

  const loadRepas = useCallback(() => {
    setLoading(true)
    qr.repas({ page_size:300, type_repas:typeRepas })
      .then(r => setRepasLog(r.data.results||r.data||[]))
      .catch(() => setRepasLog([]))
      .finally(() => setLoading(false))
  }, [typeRepas])

  useEffect(() => {
    loadRepas()
    // Charger le personnel pour la sélection manuelle
    personnelAPI.list({ page_size:500 }).then(r => {
      setAll(r.data.results||r.data||[])
    }).catch(()=>{})

    // Pour les non-admin: chercher UNIQUEMENT le profil personnel de l'utilisateur connecté
    if (!canValidate) {
      setMyQL(true)
      // Utiliser l'endpoint dédié /mon_profil/
      personnelAPI.monProfil()
        .then(r => setMyQR(r.data))
        .catch(() => {
          // Fallback: chercher dans la liste par username/login
          personnelAPI.list({ page_size:500 }).then(r => {
            const items = r.data.results||r.data||[]
            const me = items.find(p =>
              p.login_genere === user?.username ||
              (p.nom?.toLowerCase() === (user?.last_name||'').toLowerCase() &&
               p.prenom?.toLowerCase() === (user?.first_name||'').toLowerCase())
            )
            setMyQR(me || null) // null si pas trouvé — ne pas afficher le QR de quelqu'un d'autre
          })
        })
        .finally(() => setMyQL(false))
    }
  }, [typeRepas])

  // Fixer la faute de frappe dans le setter
  const setMyQL = setMyQRL

  const showMsg = (ok, msg, sub='') => {
    setScanMsg({ ok, msg, sub })
    setTimeout(() => setScanMsg(null), 8000)
  }

  const handleQR = async (decoded) => {
    showMsg(null, '⏳ Validation...')
    try {
      const r = await qr.scanner({ qr_data:decoded, type_repas:typeRepas })
      showMsg(true, `✅ ${r.data.resident}`, `${r.data.type_repas_label} · ${r.data.societe||''}`)
      loadRepas()
    } catch(e) {
      const err = e.response?.data?.erreur||'QR non reconnu'
      showMsg(false, `❌ ${err}`, 'Utilisez la sélection manuelle si besoin')
    }
  }

  const repas = REPAS.find(r=>r.key===typeRepas)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:16 }}>
      <h2 style={{ fontSize:19, fontWeight:700, color:'#1e3a8a', marginBottom:4 }}>🍽️ Restauration</h2>
      <p style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
        {canValidate ? 'Scanner QR · Sélection manuelle · Historique des repas' : 'Mon QR · Historique de mes repas'}
      </p>

      {/* Sélecteur service */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {REPAS.map(r => (
          <button key={r.key} onClick={()=>{ setTypeRepas(r.key); setScanKey(k=>k+1) }}
            style={{ flex:1, padding:'10px 6px', borderRadius:11, border:`2px solid ${typeRepas===r.key?r.color:'#e2e8f0'}`, background:typeRepas===r.key?`${r.color}0d`:'#fff', color:typeRepas===r.key?r.color:'#64748b', cursor:'pointer', fontWeight:600, fontSize:11, transition:'.15s' }}>
            <div style={{ fontSize:22 }}>{r.emoji}</div>
            <div>{r.label}</div>
            <div style={{ fontSize:9, fontWeight:400, opacity:.7 }}>{r.time}</div>
          </button>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:3, marginBottom:14, background:'#f8fafc', padding:4, borderRadius:10, border:'1px solid #e2e8f0' }}>
        {(canValidate
          ? [['valider','✅ Valider'],["aujourd_hui","📋 Aujourd'hui"],['historique','📊 Historique']]
          : [['mon_qr','📱 Mon QR'],['mes_repas','🍽️ Mes repas']]
        ).map(([k,l]) => (
          <button key={k} onClick={()=>{ setTab(k); if(k==='mes_repas'||k==='aujourd_hui'||k==='historique') loadRepas() }}
            style={{ flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, background:tab===k?'#fff':'transparent', color:tab===k?'#1e3a8a':'#64748b', boxShadow:tab===k?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── VALIDER ── */}
      {tab==='valider' && canValidate && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:18, boxShadow:'0 1px 6px rgba(30,58,138,.07)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:12 }}>
              {repas?.emoji} Valider un repas — {repas?.label}
            </div>
            {/* Switch mode */}
            <div style={{ display:'flex', gap:3, marginBottom:14, background:'#f8fafc', borderRadius:9, padding:3, border:'1px solid #e2e8f0' }}>
              {[['qr','📷 Scanner QR'],['manuel','👆 Liste']].map(([m,l]) => (
                <button key={m} onClick={()=>{ setMode(m); if(m==='qr') setScanKey(k=>k+1) }}
                  style={{ flex:1, padding:'8px', border:'none', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:mode===m?700:500, background:mode===m?repas?.color:'transparent', color:mode===m?'#fff':'#64748b', transition:'.15s' }}>
                  {l}
                </button>
              ))}
            </div>
            {mode==='qr' && (
              <QRScanner key={`qr-${scanKey}-${typeRepas}`} onResult={handleQR} color={repas?.color||'#2563eb'}/>
            )}
            {mode==='manuel' && (
              <SelectManuel list={allPersonnel} typeRepas={typeRepas} color={repas?.color||'#2563eb'}
                onOk={d=>{ showMsg(true, `✅ ${d.resident}`, `${d.type_repas_label} · ${d.societe||''}`); loadRepas() }}
                onErr={msg=>showMsg(false, `❌ ${msg}`)}/>
            )}
            {scanMsg && (
              <div style={{ marginTop:12, background:scanMsg.ok===true?'rgba(22,163,74,.08)':scanMsg.ok===false?'rgba(220,38,38,.08)':'rgba(37,99,235,.06)', border:`1px solid ${scanMsg.ok===true?'rgba(22,163,74,.3)':scanMsg.ok===false?'rgba(220,38,38,.3)':'rgba(37,99,235,.2)'}`, borderRadius:10, padding:'14px', textAlign:'center' }}>
                <div style={{ fontSize:26, marginBottom:6 }}>{scanMsg.ok===true?'✅':scanMsg.ok===false?'❌':'⏳'}</div>
                <div style={{ fontSize:14, fontWeight:700, color:scanMsg.ok===true?'#16a34a':scanMsg.ok===false?'#dc2626':'#2563eb' }}>{scanMsg.msg}</div>
                {scanMsg.sub && <div style={{ fontSize:12, color:'#64748b', marginTop:3 }}>{scanMsg.sub}</div>}
              </div>
            )}
          </div>
          {/* Compteur du jour */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:18, boxShadow:'0 1px 6px rgba(30,58,138,.07)' }}>
            <div style={{ fontWeight:600, color:'#1e3a8a', fontSize:13, marginBottom:10 }}>Validés aujourd'hui</div>
            <div style={{ fontFamily:'monospace', fontSize:60, fontWeight:700, color:repas?.color, textAlign:'center', lineHeight:1, marginBottom:6 }}>{todayLog.length}</div>
            <div style={{ textAlign:'center', fontSize:11, color:'#64748b', marginBottom:14 }}>{repas?.label}</div>
            <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
              {todayLog.map(r => (
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px', background:'#f8fafc', borderRadius:8, fontSize:12 }}>
                  <div><div style={{ fontWeight:700, color:'#1e3a8a' }}>{r.resident||'—'}</div><div style={{ fontSize:10, color:'#94a3b8' }}>{r.residence}</div></div>
                  <span style={{ color:'#94a3b8', fontFamily:'monospace', fontSize:11 }}>{r.date_validation&&new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
              {todayLog.length===0&&<div style={{ textAlign:'center', color:'#94a3b8', fontSize:12, padding:16 }}>Aucun repas validé</div>}
            </div>
          </div>
        </div>
      )}

      {tab==='aujourd_hui' && <RepasTable data={todayLog} title={`Repas du jour — ${repas?.label}`} loading={loading}/>}
      {tab==='historique' && <RepasTable data={repasLog} title={`Historique — ${repas?.label}`} loading={loading} showDate/>}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:380, margin:'0 auto' }}>
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:24, textAlign:'center', boxShadow:'0 2px 12px rgba(30,58,138,.08)' }}>
            <div style={{ fontWeight:700, fontSize:16, color:'#1e3a8a', marginBottom:4 }}>📱 Mon QR de repas</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:16 }}>
              Présentez ce QR au restaurant pour valider votre repas
            </div>
            {myQRLoading ? (
              <div style={{ padding:40, color:'#94a3b8' }}><div style={{ fontSize:32 }}>⏳</div><div style={{ marginTop:8 }}>Chargement...</div></div>
            ) : myQR?.qr_code_data ? (
              <>
                <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                  style={{ width:230, height:230, borderRadius:12, border:'3px solid #e2e8f0', margin:'0 auto 16px', display:'block', imageRendering:'pixelated' }}/>
                <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px' }}>
                  <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:14 }}>{myQR.nom} {myQR.prenom}</div>
                  <div style={{ color:'#64748b', fontSize:12, marginTop:2 }}>{myQR.societe}</div>
                </div>
              </>
            ) : (
              <div style={{ padding:40, color:'#94a3b8' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📱</div>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Aucun QR disponible</div>
                <div style={{ fontSize:12 }}>Votre profil n'est pas encore déclaré dans le système. Contactez l'administrateur.</div>
              </div>
            )}
          </div>
          <button onClick={()=>{ setTab('mes_repas'); loadRepas() }}
            style={{ width:'100%', marginTop:12, background:'#1e3a8a', color:'#fff', border:'none', padding:'12px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            🍽️ Voir mes repas →
          </button>
        </div>
      )}

      {tab==='mes_repas' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
            <button onClick={loadRepas} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', color:'#1e3a8a', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>🔄 Actualiser</button>
          </div>
          <RepasTable data={repasLog} title={`Mes repas — ${repas?.label}`} loading={loading} showDate/>
        </div>
      )}
    </div>
  )
}
