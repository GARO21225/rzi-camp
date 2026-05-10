import React, { useState, useEffect, useRef, useCallback } from 'react'
import { qr as qrAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'Petit-déjeuner', emoji:'🌅', color:'#f97316' },
  { key:'dejeuner',       label:'Déjeuner',       emoji:'☀️',  color:'#2563eb' },
  { key:'diner',          label:'Dîner',           emoji:'🌙', color:'#7c3aed' },
]

/* ══════════════════════════════════════════════════════
   SCANNER CONTINU — Style valideur de bus/métro
   Auto-démarre, scanne en boucle, flash visuel
══════════════════════════════════════════════════════ */
function BadgeScanner({ typeRepas, color, onValidated }) {
  const [status, setStatus] = useState('waiting') // waiting|scanning|ok|error|processing
  const [message, setMessage] = useState('')
  const [lastAgent, setLastAgent] = useState(null)
  const scannerRef = useRef(null)
  const live = useRef(true)
  const cooldown = useRef(false)

  useEffect(() => {
    live.current = true
    startScanner()
    return () => {
      live.current = false
      stopScanner()
    }
  }, [typeRepas])

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
  }

  const startScanner = async () => {
    await stopScanner()
    if (!live.current) return
    setStatus('waiting')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!live.current) return
      const s = new Html5Qrcode('_badge_reader_')
      scannerRef.current = s
      await s.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 300, height: 300 } },
        async (decoded) => {
          if (cooldown.current) return
          cooldown.current = true
          await handleBadge(decoded)
          // Attendre 3s puis relancer
          setTimeout(() => {
            cooldown.current = false
            if (live.current) setStatus('waiting')
          }, 3000)
        },
        () => {}
      )
      setStatus('scanning')
    } catch {
      if (!live.current) return
      setStatus('error')
      setMessage('Caméra inaccessible')
    }
  }

  const handleBadge = async (decoded) => {
    setStatus('processing')
    try {
      const r = await qrAPI.scanner({ qr_data: decoded.trim(), type_repas: typeRepas })
      setStatus('ok')
      setLastAgent(r.data)
      setMessage(r.data.resident)
      onValidated(r.data)
    } catch(e) {
      setStatus('error')
      setMessage(e.response?.data?.erreur || 'QR non reconnu')
    }
  }

  const COLORS = {
    waiting:   { bg:'#1e3a8a', text:'#fff',    border:'rgba(255,255,255,.2)' },
    scanning:  { bg:'#1e3a8a', text:'#fff',    border:'rgba(255,255,255,.2)' },
    processing:{ bg:'#f97316', text:'#fff',    border:'rgba(255,255,255,.3)' },
    ok:        { bg:'#16a34a', text:'#fff',    border:'rgba(255,255,255,.3)' },
    error:     { bg:'#dc2626', text:'#fff',    border:'rgba(255,255,255,.3)' },
  }
  const c = COLORS[status]

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:480 }}>
      {/* Écran statut — style borne de validation */}
      <div style={{
        background: c.bg, borderRadius: '14px 14px 0 0',
        padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', transition: 'background .3s ease'
      }}>
        <div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>
            Borne de restauration
          </div>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginTop:2 }}>
            {REPAS.find(r=>r.key===typeRepas)?.emoji} {REPAS.find(r=>r.key===typeRepas)?.label}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.6)' }}>
            {new Date().toLocaleDateString('fr-FR')}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.9)', fontFamily:'monospace' }}>
            {new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
      </div>

      {/* Résultat validation */}
      <div style={{
        background: c.bg, padding:'12px 20px',
        borderBottom: `1px solid ${c.border}`,
        transition: 'background .3s', minHeight: 64,
        display:'flex', alignItems:'center', gap:12
      }}>
        <span style={{ fontSize:32 }}>
          {status==='waiting'?'🔵':status==='scanning'?'🔵':status==='processing'?'⏳':status==='ok'?'✅':'❌'}
        </span>
        <div>
          {status==='waiting' && <div style={{color:'rgba(255,255,255,.8)',fontSize:14,fontWeight:600}}>En attente du QR code...</div>}
          {status==='scanning' && <div style={{color:'rgba(255,255,255,.8)',fontSize:14,fontWeight:600}}>Présentez votre QR code</div>}
          {status==='processing' && <div style={{color:'#fff',fontSize:14,fontWeight:600}}>Validation en cours...</div>}
          {status==='ok' && (
            <>
              <div style={{color:'#fff',fontSize:16,fontWeight:700}}>{message}</div>
              <div style={{color:'rgba(255,255,255,.8)',fontSize:11}}>{lastAgent?.societe} · Validé</div>
            </>
          )}
          {status==='error' && (
            <>
              <div style={{color:'#fff',fontSize:14,fontWeight:700}}>{message}</div>
              <div style={{color:'rgba(255,255,255,.7)',fontSize:11}}>Réessayez dans 3 secondes</div>
            </>
          )}
        </div>
      </div>

      {/* Zone de scan — caméra */}
      <div style={{ flex:1, position:'relative', background:'#000', borderRadius:'0 0 14px 14px', overflow:'hidden' }}>
        <div id="_badge_reader_" style={{ width:'100%', height:'100%' }}/>
        {/* Overlay de visée */}
        {(status==='waiting'||status==='scanning') && (
          <div style={{
            position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            pointerEvents:'none'
          }}>
            <div style={{
              width:240, height:240, border:'3px solid rgba(255,255,255,.6)',
              borderRadius:16, boxShadow:'0 0 0 4px rgba(0,0,0,.5)',
              position:'relative'
            }}>
              {/* Coins */}
              {[[0,0,'top left'],[0,'auto','top right'],['auto',0,'bottom left'],['auto','auto','bottom right']].map(([t,r,label],i)=>(
                <div key={i} style={{
                  position:'absolute', top:t, right:r, bottom:i>1?0:'auto', left:i%2===0&&i<2?0:'auto',
                  width:20, height:20,
                  borderTop: i<2 ? `3px solid ${color}` : 'none',
                  borderBottom: i>=2 ? `3px solid ${color}` : 'none',
                  borderLeft: i%2===0 ? `3px solid ${color}` : 'none',
                  borderRight: i%2===1 ? `3px solid ${color}` : 'none',
                }}/>
              ))}
            </div>
          </div>
        )}
        {/* Flash OK */}
        {status==='ok' && (
          <div style={{ position:'absolute', inset:0, background:'rgba(22,163,74,.4)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'0 0 14px 14px' }}>
            <div style={{ fontSize:80 }}>✅</div>
          </div>
        )}
        {/* Flash ERROR */}
        {status==='error' && (
          <div style={{ position:'absolute', inset:0, background:'rgba(220,38,38,.4)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'0 0 14px 14px' }}>
            <div style={{ fontSize:80 }}>❌</div>
          </div>
        )}
        {status==='processing' && (
          <div style={{ position:'absolute', inset:0, background:'rgba(249,115,22,.3)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'0 0 14px 14px' }}>
            <div style={{ fontSize:60 }}>⏳</div>
          </div>
        )}
        {/* Erreur caméra */}
        {status==='error' && message==='Caméra inaccessible' && (
          <div style={{ position:'absolute', inset:0, background:'#1a1a1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
            <div style={{ fontSize:48 }}>📵</div>
            <div style={{ color:'#dc2626', fontWeight:600, fontSize:14 }}>Caméra inaccessible</div>
            <button onClick={startScanner} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'8px 20px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              🔄 Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   TABLE REPAS
══════════════════════════════════════════════════════ */
function RepasTable({ data, title, loading, showDate, onDelete, isAdmin }) {
  const C = { petit_dejeuner:{e:'🌅',c:'#f97316'}, dejeuner:{e:'☀️',c:'#2563eb'}, diner:{e:'🌙',c:'#7c3aed'} }
  if (loading) return <div style={{padding:32,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</div>
  return (
    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'11px 16px',background:'#1e3a8a',color:'#fff',fontWeight:600,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span>{title}</span>
        <span style={{background:'rgba(255,255,255,.2)',padding:'2px 10px',borderRadius:20}}>{data.length}</span>
      </div>
      {data.length===0
        ? <div style={{padding:32,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:32,marginBottom:8}}>🍽️</div>Aucun repas</div>
        : <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13,minWidth:320}}>
          <thead><tr style={{background:'#f8fafc'}}>
            {[showDate&&'Date','Heure','Résident','Repas'].filter(Boolean).map(h=>(
              <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:1}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{data.map((r,i)=>{
            const col=C[r.type_repas],dt=r.date_validation?new Date(r.date_validation):null
            return <tr key={r.id} style={{borderTop:'1px solid #f1f5f9',background:i%2?'#f8fafc':'#fff'}}>
              {showDate&&<td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11}}>{dt?.toLocaleDateString('fr-FR')||'—'}</td>}
              <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:11,color:'#64748b'}}>{dt?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}</td>
              <td style={{padding:'8px 12px',fontWeight:700}}>{r.resident||'—'}</td>
              <td style={{padding:'8px 12px'}}>{col?<span style={{background:`${col.c}18`,color:col.c,padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:600}}>{col.e} {r.type_repas_label||r.type_repas}</span>:r.type_repas||'—'}</td>
            </tr>
          })}</tbody>
        </table></div>
      }
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════ */
export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const canValidate = isAdmin || role === 'restauration'

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(canValidate ? 'badge' : 'mon_qr')
  const [todayCount, setTodayCount] = useState(0)
  const [lastValidated, setLastValidated] = useState([])
  const today = new Date().toISOString().slice(0, 10)

  const loadRepas = useCallback(() => {
    setLoading(true)
    qrAPI.repas({ page_size:200, type_repas:typeRepas })
      .then(r => {
        const data = r.data.results||r.data||[]
        setRepasLog(data)
        setTodayCount(data.filter(x=>x.date_validation?.startsWith(today)).length)
      })
      .catch(() => setRepasLog([]))
      .finally(() => setLoading(false))
  }, [typeRepas])

  useEffect(() => { loadRepas() }, [typeRepas])

  const handleValidated = (data) => {
    setLastValidated(prev => [data, ...prev].slice(0, 20))
    setTodayCount(c => c + 1)
    loadRepas()
  }

  const viderHistorique = async () => {
    if (!window.confirm(`Vider tout l'historique ${REPAS.find(r=>r.key===typeRepas)?.label} ?`)) return
    try {
      await qrAPI.viderHistorique(typeRepas)
      setRepasLog([])
      setTodayCount(0)
      setLastValidated([])
    } catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  const repas = REPAS.find(r => r.key === typeRepas)

  return (
    <div style={{ padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a8a', margin:0 }}>🍽️ Restauration</h2>
          <p style={{ fontSize:11, color:'#64748b', margin:'4px 0 0' }}>
            {canValidate ? 'Borne de validation QR · Historique' : 'Mon QR · Mes repas'}
          </p>
        </div>
        {isAdmin && tab==='historique' && (
          <button onClick={viderHistorique}
            style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.25)', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
            🗑 Vider historique
          </button>
        )}
      </div>

      {/* Sélecteur service */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {REPAS.map(r => (
          <button key={r.key} onClick={() => setTypeRepas(r.key)}
            style={{ flex:1, padding:'10px 4px', borderRadius:11, border:`2px solid ${typeRepas===r.key?r.color:'#e2e8f0'}`, background:typeRepas===r.key?`${r.color}0d`:'#fff', color:typeRepas===r.key?r.color:'#64748b', cursor:'pointer', fontWeight:600, fontSize:11 }}>
            <div style={{ fontSize:20 }}>{r.emoji}</div>
            <div>{r.label}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:3, marginBottom:14, background:'#f8fafc', padding:4, borderRadius:10, border:'1px solid #e2e8f0' }}>
        {canValidate
          ? [['badge','🏧 Borne scan'],['auj',"📋 Aujourd'hui"],['historique','📊 Historique']].map(([k,l])=>(
              <button key={k} onClick={()=>{setTab(k);if(k!=='badge')loadRepas()}}
                style={{ flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, background:tab===k?'#fff':'transparent', color:tab===k?'#1e3a8a':'#64748b', boxShadow:tab===k?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
                {l}
              </button>
            ))
          : [['mon_qr','📱 Mon QR'],['mes_repas','🍽️ Mes repas']].map(([k,l])=>(
              <button key={k} onClick={()=>{setTab(k);if(k==='mes_repas')loadRepas()}}
                style={{ flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, background:tab===k?'#fff':'transparent', color:tab===k?'#1e3a8a':'#64748b', boxShadow:tab===k?'0 1px 4px rgba(0,0,0,.08)':'none' }}>
                {l}
              </button>
            ))
        }
      </div>

      {/* ── BORNE BADGE ── */}
      {tab==='badge' && canValidate && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14, alignItems:'start' }}>
          {/* Borne scanner */}
          <div style={{ border:'2px solid #1e3a8a', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 20px rgba(30,58,138,.2)', minHeight:500 }}>
            <BadgeScanner key={typeRepas} typeRepas={typeRepas} color={repas?.color||'#2563eb'} onValidated={handleValidated}/>
          </div>

          {/* Panneau droite: compteur + derniers validés */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Compteur */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, textAlign:'center' }}>
              <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Validés aujourd'hui</div>
              <div style={{ fontFamily:'monospace', fontSize:64, fontWeight:700, color:repas?.color, lineHeight:1 }}>{todayCount}</div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{repas?.label}</div>
            </div>

            {/* Derniers validés */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:'#1e3a8a', color:'#fff', fontSize:12, fontWeight:600 }}>
                Dernières validations
              </div>
              <div style={{ maxHeight:300, overflowY:'auto' }}>
                {lastValidated.length === 0
                  ? <div style={{ padding:20, textAlign:'center', color:'#94a3b8', fontSize:12 }}>En attente...</div>
                  : lastValidated.map((v, i) => (
                    <div key={i} style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:10, background:i===0?'rgba(22,163,74,.04)':'#fff' }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:i===0?'rgba(22,163,74,.15)':'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                        {i===0?'✅':'👤'}
                      </div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13, color:'#1e3a8a' }}>{v.resident}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{v.societe} · {new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==='auj' && <RepasTable data={repasLog.filter(r=>r.date_validation?.startsWith(today))} title={`Repas du jour — ${repas?.label}`} loading={loading}/>}
      {tab==='historique' && <RepasTable data={repasLog} title={`Historique — ${repas?.label}`} loading={loading} showDate isAdmin={isAdmin}/>}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && <MonQR user={user}/>}
      {tab==='mes_repas' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button onClick={loadRepas} style={{background:'#f8fafc',border:'1px solid #e2e8f0',color:'#1e3a8a',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}}>🔄 Actualiser</button>
          </div>
          <RepasTable data={repasLog} title={`Mes repas — ${repas?.label}`} loading={loading} showDate/>
        </div>
      )}
    </div>
  )
}

function MonQR({ user }) {
  const [myQR, setMyQR] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    import('../api').then(({ personnel: pAPI }) => {
      pAPI.monProfil()
        .then(r => setMyQR(r.data))
        .catch(() => {
          pAPI.list({ page_size:500 }).then(r => {
            const items = r.data.results||r.data||[]
            const me = items.find(p => p.login_genere===user?.username || (p.nom?.toUpperCase()===(user?.last_name||'').toUpperCase() && p.prenom?.toUpperCase()===(user?.first_name||'').toUpperCase()))
            setMyQR(me||null)
          })
        })
        .finally(() => setLoading(false))
    })
  }, [])

  if (loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:36}}>⏳</div></div>

  return (
    <div style={{maxWidth:380,margin:'0 auto'}}>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:24,textAlign:'center',boxShadow:'0 4px 20px rgba(30,58,138,.1)'}}>
        <div style={{fontWeight:700,fontSize:17,color:'#1e3a8a',marginBottom:6}}>📱 Mon QR de repas</div>
        <div style={{fontSize:12,color:'#64748b',marginBottom:18}}>Présentez ce QR à la borne de restauration</div>
        {myQR?.qr_code_data
          ? <>
              <div style={{background:'#fff',padding:12,borderRadius:14,border:'3px solid #1e3a8a',display:'inline-block',margin:'0 auto 16px'}}>
                <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                  style={{width:256,height:256,display:'block',imageRendering:'pixelated'}}/>
              </div>
              <div style={{background:'#1e3a8a',borderRadius:10,padding:'12px 16px'}}>
                <div style={{fontWeight:700,color:'#fff',fontSize:15}}>{myQR.nom} {myQR.prenom}</div>
                <div style={{color:'rgba(255,255,255,.7)',fontSize:12,marginTop:2}}>{myQR.societe}</div>
              </div>
            </>
          : <div style={{padding:40,color:'#94a3b8'}}>
              <div style={{fontSize:52,marginBottom:12}}>📱</div>
              <div style={{fontSize:14,fontWeight:600}}>QR non disponible</div>
              <div style={{fontSize:12,marginTop:6}}>Contactez l'administrateur</div>
            </div>
        }
      </div>
    </div>
  )
}
