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
  const [err, setErr] = useState('')
  const scanRef = useRef(null)
  const live = useRef(true)
  useEffect(() => { live.current=true; return ()=>{ live.current=false; cleanup() } }, [])
  const cleanup = async () => {
    if(scanRef.current){ try{await scanRef.current.stop()}catch{} try{scanRef.current.clear()}catch{} scanRef.current=null }
  }
  const start = async () => {
    setErr(''); setPhase('loading')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if(!live.current) return
      const s = new Html5Qrcode('_qr_')
      scanRef.current = s; setPhase('scanning')
      await s.start({facingMode:'environment'},{fps:10,qrbox:250},
        async txt=>{ await cleanup(); if(!live.current) return; setPhase('done'); onResult(txt) },()=>{})
    } catch { if(!live.current) return; setPhase('error'); setErr('Caméra non accessible') }
  }
  const stop = async () => { await cleanup(); setPhase('idle') }
  return (
    <div>
      {(phase==='idle'||phase==='done')&&(
        <button onClick={start} style={{width:'100%',padding:'20px 16px',borderRadius:14,background:`${color}08`,border:`2px solid ${color}`,color,cursor:'pointer',fontWeight:700,fontSize:14,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
          <span style={{fontSize:48}}>📷</span>
          {phase==='done'?'🔄 Scanner un autre':'Activer la caméra pour scanner'}
          <span style={{fontSize:11,fontWeight:400,color:'#64748b'}}>L'agent présente son QR code</span>
        </button>
      )}
      {phase==='loading'&&<div style={{padding:28,textAlign:'center',background:'#f8fafc',borderRadius:12,color:'#64748b'}}><div style={{fontSize:30,marginBottom:8}}>📡</div>Démarrage...</div>}
      <div id="_qr_" style={{display:phase==='scanning'?'block':'none',borderRadius:12,overflow:'hidden',border:`3px solid ${color}`}}/>
      {phase==='scanning'&&<button onClick={stop} style={{width:'100%',marginTop:8,background:'rgba(220,38,38,.1)',color:'#dc2626',border:'1px solid rgba(220,38,38,.3)',padding:'9px',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700}}>✕ Arrêter</button>}
      {phase==='error'&&<div style={{background:'rgba(220,38,38,.06)',border:'1px solid rgba(220,38,38,.2)',borderRadius:12,padding:16,textAlign:'center'}}>
        <div style={{fontSize:28,marginBottom:6}}>📵</div>
        <div style={{fontSize:13,color:'#dc2626',fontWeight:600,marginBottom:8}}>{err}</div>
        <button onClick={()=>setPhase('idle')} style={{background:'#dc2626',color:'#fff',border:'none',padding:'8px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>Réessayer</button>
      </div>}
    </div>
  )
}

/* ── Saisie par numéro de téléphone ── */
function SaisieNumero({ typeRepas, color, onOk, onErr }) {
  const [num, setNum] = useState('')
  const [busy, setBusy] = useState(false)
  const valider = async () => {
    if(!num.trim()) return
    setBusy(true)
    try {
      const r = await qr.validerParNumero({numero:num.trim(), type_repas:typeRepas})
      onOk(r.data); setNum('')
    } catch(e) { onErr(e.response?.data?.erreur||'Numéro non trouvé') }
    finally { setBusy(false) }
  }
  return (
    <div style={{marginTop:14,padding:'14px 16px',background:'#f8fafc',borderRadius:12,border:'1px solid #e2e8f0'}}>
      <div style={{fontSize:12,color:'#64748b',fontWeight:600,marginBottom:10}}>
        📱 Saisir le numéro de téléphone de l'agent
      </div>
      <div style={{display:'flex',gap:8}}>
        <input value={num} onChange={e=>setNum(e.target.value)} onKeyDown={e=>e.key==='Enter'&&valider()}
          placeholder="Ex: 0701234567" type="tel"
          style={{flex:1,border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:14,outline:'none',fontFamily:'monospace'}}
          onFocus={e=>e.target.style.borderColor=color}
          onBlur={e=>e.target.style.borderColor='#e2e8f0'}/>
        <button onClick={valider} disabled={!num.trim()||busy}
          style={{background:num.trim()?color:'#e2e8f0',color:num.trim()?'#fff':'#94a3b8',border:'none',padding:'10px 16px',borderRadius:9,cursor:num.trim()?'pointer':'default',fontWeight:700,fontSize:13,transition:'.15s'}}>
          {busy?'...':'✅'}
        </button>
      </div>
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

export default function Restauration() {
  const {user} = useStore()
  const role = user?.profile?.role||(user?.is_superuser?'admin':'agent')
  const isAdmin = user?.is_staff||user?.is_superuser||role==='admin'
  const canValidate = isAdmin||role==='restauration'

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(canValidate?'scanner':'mon_qr')
  const [scanKey, setScanKey] = useState(0)
  const [result, setResult] = useState(null)
  const [myQR, setMyQR] = useState(null)
  const [myQRLoading, setMyQRLoading] = useState(false)
  const today = new Date().toISOString().slice(0,10)

  const loadRepas = useCallback(()=>{
    setLoading(true)
    qr.repas({page_size:200,type_repas:typeRepas})
      .then(r=>setRepasLog(r.data.results||r.data||[]))
      .catch(()=>setRepasLog([]))
      .finally(()=>setLoading(false))
  },[typeRepas])

  useEffect(()=>{
    loadRepas()
    if(!canValidate){
      setMyQRLoading(true)
      personnelAPI.monProfil()
        .then(r=>setMyQR(r.data))
        .catch(()=>{
          personnelAPI.list({page_size:500}).then(r=>{
            const items=r.data.results||r.data||[]
            const me=items.find(p=>p.login_genere===user?.username||(p.nom?.toLowerCase()===(user?.last_name||'').toLowerCase()&&p.prenom?.toLowerCase()===(user?.first_name||'').toLowerCase()))
            setMyQR(me||null)
          }).catch(()=>{})
        })
        .finally(()=>setMyQRLoading(false))
    }
  },[typeRepas])

  const showResult = (ok,msg,sub='')=>{ setResult({ok,msg,sub}); setTimeout(()=>setResult(null),8000) }

  const handleScan = async (decoded)=>{
    showResult(null,'⏳ Validation...')
    try {
      const r = await qr.scanner({qr_data:decoded,type_repas:typeRepas})
      showResult(true,`✅ ${r.data.resident}`,`${r.data.type_repas_label} validé`)
      loadRepas()
    } catch(e) { showResult(false,`❌ ${e.response?.data?.erreur||'QR non reconnu'}`) }
  }

  const handleNumero = (data)=>{ showResult(true,`✅ ${data.resident}`,`${data.type_repas_label} validé`); loadRepas() }

  const repas = REPAS.find(r=>r.key===typeRepas)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{padding:16}}>
      <h2 style={{fontSize:18,fontWeight:700,color:'#1e3a8a',marginBottom:4}}>🍽️ Restauration</h2>
      <p style={{fontSize:11,color:'#64748b',marginBottom:14}}>{canValidate?'Scanner QR · Numéro téléphone · Historique':'Mon QR · Mes repas'}</p>

      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {REPAS.map(r=>(
          <button key={r.key} onClick={()=>{setTypeRepas(r.key);setScanKey(k=>k+1);setResult(null)}}
            style={{flex:1,padding:'10px 4px',borderRadius:11,border:`2px solid ${typeRepas===r.key?r.color:'#e2e8f0'}`,background:typeRepas===r.key?`${r.color}0d`:'#fff',color:typeRepas===r.key?r.color:'#64748b',cursor:'pointer',fontWeight:600,fontSize:11}}>
            <div style={{fontSize:20}}>{r.emoji}</div><div>{r.label}</div><div style={{fontSize:9,opacity:.7}}>{r.time}</div>
          </button>
        ))}
      </div>

      <div style={{display:'flex',gap:3,marginBottom:14,background:'#f8fafc',padding:4,borderRadius:10,border:'1px solid #e2e8f0'}}>
        {(canValidate?[['scanner','📷 Scanner'],['auj',"Auj."],['hist','Hist.']]:[['mon_qr','📱 Mon QR'],['mes_repas','🍽️ Mes repas']]).map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);if(k!=='scanner')loadRepas()}}
            style={{flex:1,padding:'8px 0',border:'none',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600,background:tab===k?'#fff':'transparent',color:tab===k?'#1e3a8a':'#64748b',boxShadow:tab===k?'0 1px 4px rgba(0,0,0,.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='scanner'&&canValidate&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:18}}>
            <div style={{fontWeight:700,fontSize:14,color:'#1e3a8a',marginBottom:12}}>{repas?.emoji} {repas?.label}</div>
            <QRScanner key={`qs-${scanKey}-${typeRepas}`} onResult={handleScan} color={repas?.color||'#2563eb'}/>
            <SaisieNumero typeRepas={typeRepas} color={repas?.color||'#2563eb'} onOk={handleNumero} onErr={msg=>showResult(false,`❌ ${msg}`)}/>
            {result&&(
              <div style={{marginTop:14,background:result.ok===true?'rgba(22,163,74,.08)':result.ok===false?'rgba(220,38,38,.08)':'rgba(37,99,235,.06)',border:`1px solid ${result.ok===true?'rgba(22,163,74,.3)':result.ok===false?'rgba(220,38,38,.3)':'rgba(37,99,235,.2)'}`,borderRadius:12,padding:'16px',textAlign:'center'}}>
                <div style={{fontSize:28,marginBottom:6}}>{result.ok===true?'✅':result.ok===false?'❌':'⏳'}</div>
                <div style={{fontSize:15,fontWeight:700,color:result.ok===true?'#16a34a':result.ok===false?'#dc2626':'#2563eb'}}>{result.msg}</div>
                {result.sub&&<div style={{fontSize:12,color:'#64748b',marginTop:4}}>{result.sub}</div>}
              </div>
            )}
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:18}}>
            <div style={{fontWeight:600,color:'#1e3a8a',fontSize:13,marginBottom:10}}>Validés aujourd'hui</div>
            <div style={{fontFamily:'monospace',fontSize:56,fontWeight:700,color:repas?.color,textAlign:'center',lineHeight:1,marginBottom:8}}>{todayLog.length}</div>
            <div style={{maxHeight:260,overflowY:'auto',display:'flex',flexDirection:'column',gap:5}}>
              {todayLog.map(r=>(
                <div key={r.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'#f8fafc',borderRadius:8,fontSize:12}}>
                  <span style={{fontWeight:700}}>{r.resident}</span>
                  <span style={{color:'#94a3b8',fontFamily:'monospace',fontSize:11}}>{r.date_validation&&new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
              {todayLog.length===0&&<div style={{textAlign:'center',color:'#94a3b8',padding:16,fontSize:12}}>Aucun repas validé</div>}
            </div>
          </div>
        </div>
      )}
      {tab==='auj'&&<RepasTable data={todayLog} title={`Repas du jour — ${repas?.label}`} loading={loading}/>}
      {tab==='hist'&&<RepasTable data={repasLog} title={`Historique — ${repas?.label}`} loading={loading} showDate/>}
      {tab==='mon_qr'&&(
        <div style={{maxWidth:360,margin:'0 auto'}}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,padding:24,textAlign:'center',boxShadow:'0 2px 12px rgba(30,58,138,.08)'}}>
            <div style={{fontWeight:700,fontSize:16,color:'#1e3a8a',marginBottom:6}}>📱 Mon QR de repas</div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>Présentez ce QR au restaurant</div>
            {myQRLoading
              ? <div style={{padding:40,color:'#94a3b8'}}><div style={{fontSize:36,marginBottom:10}}>⏳</div>Chargement...</div>
              : myQR?.qr_code_data
                ? <>
                    <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="QR"
                      style={{width:240,height:240,borderRadius:12,border:'3px solid #e2e8f0',margin:'0 auto 16px',display:'block',imageRendering:'pixelated'}}/>
                    <div style={{background:'#f8fafc',borderRadius:10,padding:'10px 14px',marginBottom:8}}>
                      <div style={{fontWeight:700,color:'#1e3a8a',fontSize:14}}>{myQR.nom} {myQR.prenom}</div>
                      <div style={{color:'#64748b',fontSize:12}}>{myQR.societe}</div>
                    </div>
                    <div style={{background:'#1e3a8a',borderRadius:8,padding:'8px 12px',fontSize:11,color:'rgba(255,255,255,.8)',fontFamily:'monospace'}}>
                      Code: <b style={{color:'#f0a500'}}>{myQR.numero}</b> (si QR non lisible)
                    </div>
                  </>
                : <div style={{padding:40,color:'#94a3b8'}}><div style={{fontSize:48,marginBottom:12}}>📱</div>
                    <div style={{fontSize:14,fontWeight:600}}>QR non disponible</div>
                    <div style={{fontSize:12,marginTop:6}}>Contactez l'administrateur</div>
                  </div>
            }
          </div>
          <button onClick={()=>{setTab('mes_repas');loadRepas()}}
            style={{width:'100%',marginTop:12,background:'#1e3a8a',color:'#fff',border:'none',padding:'12px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700}}>
            🍽️ Voir mes repas →
          </button>
        </div>
      )}
      {tab==='mes_repas'&&(
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
