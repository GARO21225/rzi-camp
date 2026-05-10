import React, { useState, useEffect, useRef, useCallback } from 'react'
import { qr as qrAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'Petit-déjeuner', emoji:'🌅', color:'#f97316', code:'ROXGOLD-PETIT-DEJEUNER' },
  { key:'dejeuner',       label:'Déjeuner',       emoji:'☀️',  color:'#2563eb', code:'ROXGOLD-DEJEUNER' },
  { key:'diner',          label:'Dîner',           emoji:'🌙', color:'#7c3aed', code:'ROXGOLD-DINER' },
]

/* ══════════════════════════════════════════════════════════════════
   SCANNER QR GÉNÉRIQUE - lit n'importe quel QR code
   Utilisé par l'agent pour scanner le QR statique du restaurant
══════════════════════════════════════════════════════════════════ */
function QRCamScanner({ onResult, color, label }) {
  const [phase, setPhase] = useState('idle')
  const [err, setErr] = useState('')
  const scanRef = useRef(null)
  const live = useRef(true)

  useEffect(() => { live.current=true; return()=>{ live.current=false; cleanup() } }, [])

  const cleanup = async () => {
    if(scanRef.current){
      try{await scanRef.current.stop()}catch{}
      try{scanRef.current.clear()}catch{}
      scanRef.current=null
    }
  }

  const start = async () => {
    setErr(''); setPhase('loading')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if(!live.current) return
      const s = new Html5Qrcode('_resto_qr_')
      scanRef.current=s; setPhase('scanning')
      await s.start(
        {facingMode:'environment'},
        {fps:10, qrbox:{width:250,height:250}},
        async txt => {
          await cleanup()
          if(!live.current) return
          setPhase('done'); onResult(txt)
        }, ()=>{}
      )
    } catch { if(!live.current) return; setPhase('error'); setErr('Caméra inaccessible — vérifiez les permissions') }
  }

  const stop = async () => { await cleanup(); setPhase('idle') }

  return (
    <div>
      {(phase==='idle'||phase==='done') && (
        <button onClick={start} style={{width:'100%',padding:'20px 16px',borderRadius:14,background:`${color}08`,border:`2px solid ${color}`,color,cursor:'pointer',fontWeight:700,fontSize:14,display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
          <span style={{fontSize:52}}>📷</span>
          {phase==='done' ? '🔄 Scanner à nouveau' : `Scanner le QR "${label}" du restaurant`}
          <span style={{fontSize:11,fontWeight:400,color:'#64748b'}}>Pointez votre caméra vers le QR code affiché au restaurant</span>
        </button>
      )}
      {phase==='loading' && <div style={{padding:28,textAlign:'center',background:'#f8fafc',borderRadius:12,color:'#64748b'}}><div style={{fontSize:30,marginBottom:8}}>📡</div>Démarrage caméra...</div>}
      <div id="_resto_qr_" style={{display:phase==='scanning'?'block':'none',borderRadius:12,overflow:'hidden',border:`3px solid ${color}`}}/>
      {phase==='scanning' && <button onClick={stop} style={{width:'100%',marginTop:8,background:'rgba(220,38,38,.1)',color:'#dc2626',border:'1px solid rgba(220,38,38,.3)',padding:'9px',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700}}>✕ Arrêter</button>}
      {phase==='error' && (
        <div style={{background:'rgba(220,38,38,.06)',border:'1px solid rgba(220,38,38,.2)',borderRadius:12,padding:16,textAlign:'center'}}>
          <div style={{fontSize:28,marginBottom:8}}>📵</div>
          <div style={{fontSize:13,color:'#dc2626',fontWeight:600,marginBottom:8}}>{err}</div>
          <button onClick={()=>setPhase('idle')} style={{background:'#dc2626',color:'#fff',border:'none',padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>Réessayer</button>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   BORNE RESTAURANT - scanner continu pour valider les agents
   La caméra du restaurant scanne le QR de l'agent (papier ou écran)
══════════════════════════════════════════════════════════════════ */
function BorneRestaurant({ typeRepas, color, onValidated }) {
  const [phase, setPhase] = useState('ready')
  const [lastResult, setLastResult] = useState(null)
  const [scanKey, setScanKey] = useState(0)
  const [debugText, setDebugText] = useState('')

  const handleScan = async (decoded) => {
    setDebugText(decoded)
    setPhase('processing')
    try {
      const r = await qrAPI.scanner({ qr_data: decoded.trim(), type_repas: typeRepas })
      setLastResult({ ok:true, data:r.data })
      setPhase('ok')
      onValidated(r.data)
    } catch(e) {
      setLastResult({ ok:false, msg: e.response?.data?.erreur||'Non reconnu' })
      setPhase('error')
    }
    setTimeout(() => { setPhase('ready'); setScanKey(k=>k+1) }, 3000)
  }

  const repas = REPAS.find(r=>r.key===typeRepas)

  return (
    <div style={{border:'2px solid #1e3a8a',borderRadius:16,overflow:'hidden',boxShadow:'0 4px 20px rgba(30,58,138,.2)'}}>
      {/* Header borne */}
      <div style={{background:phase==='ok'?'#16a34a':phase==='error'?'#dc2626':phase==='processing'?'#f97316':'#1e3a8a',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',transition:'background .3s'}}>
        <div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.6)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1}}>Borne Restauration</div>
          <div style={{fontSize:15,fontWeight:700,color:'#fff',marginTop:2}}>{repas?.emoji} {repas?.label}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:22}}>{phase==='ok'?'✅':phase==='error'?'❌':phase==='processing'?'⏳':'🔵'}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.6)',fontFamily:'monospace'}}>
            {new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
      </div>
      {/* Résultat */}
      <div style={{background:phase==='ok'?'rgba(22,163,74,.08)':phase==='error'?'rgba(220,38,38,.08)':'rgba(30,58,138,.03)',padding:'12px 20px',borderBottom:'1px solid #e2e8f0',minHeight:60,display:'flex',alignItems:'center',gap:12,transition:'background .3s'}}>
        {phase==='ready' && <div style={{color:'#64748b',fontSize:13}}>🔵 En attente — présentez le QR de l'agent</div>}
        {phase==='processing' && <div style={{color:'#f97316',fontSize:13,fontWeight:600}}>⏳ Validation en cours...</div>}
        {phase==='ok' && <div><div style={{color:'#16a34a',fontSize:15,fontWeight:700}}>✅ {lastResult?.data?.resident}</div><div style={{color:'#64748b',fontSize:11}}>{lastResult?.data?.societe}</div></div>}
        {phase==='error' && <div><div style={{color:'#dc2626',fontSize:14,fontWeight:700}}>❌ {lastResult?.msg}</div><div style={{color:'#94a3b8',fontSize:10,fontFamily:'monospace'}}>Lu: {debugText}</div></div>}
      </div>
      {/* Scanner caméra */}
      <div style={{background:'#000',minHeight:300,position:'relative'}}>
        <QRCamScanner
          key={`borne-${scanKey}-${typeRepas}`}
          onResult={handleScan}
          color={color}
          label={repas?.label||''}
        />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   QR DU RESTAURANT (à imprimer/afficher)
══════════════════════════════════════════════════════════════════ */
function QRRestaurant() {
  const [qrCodes, setQrCodes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    qrAPI.qrRestaurant()
      .then(r => setQrCodes(r.data.qr_codes||[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{padding:32,textAlign:'center',color:'#94a3b8'}}>Génération des QR...</div>

  return (
    <div>
      <div style={{background:'rgba(37,99,235,.06)',border:'1px solid rgba(37,99,235,.2)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#2563eb'}}>
        💡 <b>Imprimez ces QR codes</b> et affichez-les au restaurant.<br/>
        Les agents scannent ces QR avec leur téléphone pour valider leur repas.
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        {qrCodes.map(q => (
          <div key={q.code} style={{background:'#fff',border:'2px solid #1e3a8a',borderRadius:14,padding:20,textAlign:'center',boxShadow:'0 2px 12px rgba(30,58,138,.1)'}}>
            <div style={{fontSize:24,marginBottom:8}}>{q.emoji} {q.label}</div>
            <img src={`data:image/png;base64,${q.qr_image}`} alt={q.label}
              style={{width:180,height:180,display:'block',margin:'0 auto 12px',imageRendering:'pixelated'}}/>
            <div style={{fontFamily:'monospace',fontSize:11,color:'#94a3b8',wordBreak:'break-all'}}>{q.code}</div>
            <button onClick={()=>{
              const w=window.open()
              w.document.write(`<img src="data:image/png;base64,${q.qr_image}" style="width:400px"/>
              <p style="font-family:monospace;font-size:18px;text-align:center">${q.emoji} ${q.label}</p>`)
              setTimeout(()=>w.print(),500)
            }} style={{marginTop:8,background:'#1e3a8a',color:'#fff',border:'none',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>
              🖨️ Imprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   MON REPAS (côté agent) - scanne le QR du restaurant
══════════════════════════════════════════════════════════════════ */
function MonRepas({ user }) {
  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [result, setResult] = useState(null)
  const [phase, setPhase] = useState('choose') // choose|scan|done
  const [scanKey, setScanKey] = useState(0)

  const handleScan = async (decoded) => {
    setResult(null)
    try {
      // Valider avec le QR restaurant + identité de l'agent (token JWT)
      const r = await qrAPI.validerMonRepas({ qr_data: decoded.trim(), type_repas: typeRepas })
      setResult({ ok:true, data:r.data })
      setPhase('done')
    } catch(e) {
      setResult({ ok:false, msg: e.response?.data?.erreur||'Erreur de validation' })
      setPhase('choose')
    }
  }

  const repas = REPAS.find(r=>r.key===typeRepas)

  if (phase==='done' && result?.ok) return (
    <div style={{maxWidth:380,margin:'0 auto',textAlign:'center'}}>
      <div style={{background:'#fff',border:'2px solid #16a34a',borderRadius:14,padding:32,boxShadow:'0 4px 20px rgba(22,163,74,.2)'}}>
        <div style={{fontSize:72,marginBottom:12}}>✅</div>
        <div style={{fontSize:18,fontWeight:700,color:'#16a34a',marginBottom:6}}>{result.data.type_repas_label} validé!</div>
        <div style={{fontSize:14,color:'#1e3a8a',fontWeight:600}}>{result.data.resident}</div>
        <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{result.data.societe}</div>
        <div style={{marginTop:16,fontSize:12,color:'#94a3b8'}}>
          {new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · {new Date().toLocaleDateString('fr-FR')}
        </div>
        <button onClick={()=>{setPhase('choose');setResult(null);setScanKey(k=>k+1)}}
          style={{marginTop:16,background:'#1e3a8a',color:'#fff',border:'none',padding:'10px 24px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700}}>
          ← Retour
        </button>
      </div>
    </div>
  )

  return (
    <div style={{maxWidth:420,margin:'0 auto'}}>
      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:20,boxShadow:'0 2px 12px rgba(30,58,138,.08)'}}>
        <h3 style={{fontSize:15,fontWeight:700,color:'#1e3a8a',marginBottom:14,textAlign:'center'}}>
          🍽️ Valider mon repas
        </h3>

        {/* Sélection repas */}
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          {REPAS.map(r=>(
            <button key={r.key} onClick={()=>setTypeRepas(r.key)}
              style={{flex:1,padding:'10px 4px',borderRadius:10,border:`2px solid ${typeRepas===r.key?r.color:'#e2e8f0'}`,background:typeRepas===r.key?`${r.color}0d`:'#fff',color:typeRepas===r.key?r.color:'#64748b',cursor:'pointer',fontWeight:600,fontSize:11}}>
              <div style={{fontSize:20}}>{r.emoji}</div>
              <div style={{fontSize:10}}>{r.label}</div>
            </button>
          ))}
        </div>

        {phase==='choose' && (
          <div>
            {result?.ok===false && (
              <div style={{background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.25)',borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:13,color:'#dc2626',fontWeight:600,textAlign:'center'}}>
                ❌ {result.msg}
              </div>
            )}
            <div style={{background:'rgba(37,99,235,.06)',border:'1px solid rgba(37,99,235,.2)',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#2563eb'}}>
              📱 Scannez le QR code <b>{repas?.label}</b> affiché au restaurant pour valider votre repas
            </div>
            <button onClick={()=>setPhase('scan')}
              style={{width:'100%',padding:'18px 16px',borderRadius:14,background:`${repas?.color}08`,border:`2px solid ${repas?.color}`,color:repas?.color,cursor:'pointer',fontWeight:700,fontSize:14,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
              <span style={{fontSize:48}}>📷</span>
              Scanner le QR restaurant
            </button>
          </div>
        )}

        {phase==='scan' && (
          <div>
            <QRCamScanner
              key={`agent-${scanKey}-${typeRepas}`}
              onResult={handleScan}
              color={repas?.color||'#2563eb'}
              label={repas?.label||''}
            />
            <button onClick={()=>setPhase('choose')} style={{width:'100%',marginTop:10,background:'#f8fafc',border:'1px solid #e2e8f0',color:'#64748b',padding:'8px',borderRadius:8,cursor:'pointer',fontSize:12}}>← Retour</button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════════════════ */
export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const isResto = role === 'restauration'
  const canValidate = isAdmin || isResto

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [todayValidated, setTodayValidated] = useState([])
  const today = new Date().toISOString().slice(0,10)

  // Tabs différents selon le rôle
  const TABS_ADMIN = [['borne','🏧 Borne scan'],['qr_resto','📋 QR Restaurant'],["auj","Aujourd'hui"],['hist','Historique']]
  const TABS_AGENT = [['valider','✅ Valider mon repas'],['mon_historique','📊 Mes repas']]
  const [tab, setTab] = useState(canValidate ? 'borne' : 'valider')

  const loadRepas = useCallback(() => {
    setLoading(true)
    qrAPI.repas({ page_size:200, type_repas:typeRepas })
      .then(r => {
        const data = r.data.results||r.data||[]
        setRepasLog(data)
        setTodayValidated(data.filter(x=>x.date_validation?.startsWith(today)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [typeRepas])

  useEffect(() => { if(canValidate) loadRepas() }, [typeRepas])

  const repas = REPAS.find(r=>r.key===typeRepas)

  return (
    <div style={{padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:700,color:'#1e3a8a',margin:0}}>🍽️ Restauration</h2>
          <p style={{fontSize:11,color:'#64748b',margin:'4px 0 0'}}>
            {canValidate
              ? 'Borne de validation · QR Restaurant à imprimer · Historique'
              : 'Scannez le QR restaurant avec votre téléphone pour valider votre repas'}
          </p>
        </div>
      </div>

      {/* Sélecteur repas (admin/resto seulement) */}
      {canValidate && (
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          {REPAS.map(r=>(
            <button key={r.key} onClick={()=>setTypeRepas(r.key)}
              style={{flex:1,padding:'9px 4px',borderRadius:11,border:`2px solid ${typeRepas===r.key?r.color:'#e2e8f0'}`,background:typeRepas===r.key?`${r.color}0d`:'#fff',color:typeRepas===r.key?r.color:'#64748b',cursor:'pointer',fontWeight:600,fontSize:11}}>
              <div style={{fontSize:20}}>{r.emoji}</div><div>{r.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:3,marginBottom:14,background:'#f8fafc',padding:4,borderRadius:10,border:'1px solid #e2e8f0'}}>
        {(canValidate ? TABS_ADMIN : TABS_AGENT).map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);if(['auj','hist','mon_historique'].includes(k))loadRepas()}}
            style={{flex:1,padding:'8px 0',border:'none',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600,background:tab===k?'#fff':'transparent',color:tab===k?'#1e3a8a':'#64748b',boxShadow:tab===k?'0 1px 4px rgba(0,0,0,.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── BORNE SCAN (restaurant/admin) ── */}
      {tab==='borne' && canValidate && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14,alignItems:'start'}}>
          <BorneRestaurant key={typeRepas} typeRepas={typeRepas} color={repas?.color||'#2563eb'} onValidated={d=>{ setTodayValidated(p=>[d,...p]); loadRepas() }}/>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:16}}>
            <div style={{fontWeight:600,color:'#1e3a8a',fontSize:13,marginBottom:8}}>Validés aujourd'hui</div>
            <div style={{fontFamily:'monospace',fontSize:52,fontWeight:700,color:repas?.color,textAlign:'center',lineHeight:1,marginBottom:8}}>{todayValidated.length}</div>
            <div style={{maxHeight:280,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
              {todayValidated.map((v,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',background:i===0?'rgba(22,163,74,.06)':'#f8fafc',borderRadius:8,fontSize:12}}>
                  <span style={{fontWeight:700}}>{v.resident||'—'}</span>
                  <span style={{color:'#94a3b8',fontFamily:'monospace',fontSize:10}}>{v.date_validation&&new Date(v.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
              {todayValidated.length===0&&<div style={{textAlign:'center',color:'#94a3b8',padding:16,fontSize:12}}>Aucun repas validé</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── QR RESTAURANT À IMPRIMER ── */}
      {tab==='qr_resto' && <QRRestaurant/>}

      {/* ── HISTORIQUE ADMIN ── */}
      {tab==='auj' && (
        <RepasTable data={todayValidated} title={`Aujourd'hui — ${repas?.label}`} loading={loading}/>
      )}
      {tab==='hist' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button onClick={loadRepas} style={{background:'#f8fafc',border:'1px solid #e2e8f0',color:'#1e3a8a',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}}>🔄 Actualiser</button>
          </div>
          <RepasTable data={repasLog} title={`Historique — ${repas?.label}`} loading={loading} showDate/>
        </div>
      )}

      {/* ── AGENT: Valider son repas ── */}
      {tab==='valider' && !canValidate && <MonRepas user={user}/>}

      {/* ── AGENT: Ses repas ── */}
      {tab==='mon_historique' && !canValidate && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button onClick={loadRepas} style={{background:'#f8fafc',border:'1px solid #e2e8f0',color:'#1e3a8a',padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600}}>🔄 Actualiser</button>
          </div>
          <RepasTable data={repasLog} title={`Mes repas`} loading={loading} showDate/>
        </div>
      )}
    </div>
  )
}

function RepasTable({ data, title, loading, showDate }) {
  const C={petit_dejeuner:{e:'🌅',c:'#f97316'},dejeuner:{e:'☀️',c:'#2563eb'},diner:{e:'🌙',c:'#7c3aed'}}
  if(loading) return <div style={{padding:32,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</div>
  return (
    <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'11px 16px',background:'#1e3a8a',color:'#fff',fontWeight:600,fontSize:13,display:'flex',justifyContent:'space-between'}}>
        <span>{title}</span><span style={{background:'rgba(255,255,255,.2)',padding:'2px 10px',borderRadius:20}}>{data.length}</span>
      </div>
      {data.length===0
        ? <div style={{padding:32,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:32,marginBottom:8}}>🍽️</div>Aucun repas</div>
        : <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
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
