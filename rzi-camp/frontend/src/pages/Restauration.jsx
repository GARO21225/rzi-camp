
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { qr, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'🌅 Petit-déjeuner', color:'#f97316', time:'06:00–09:00' },
  { key:'dejeuner', label:'☀️ Déjeuner', color:'#2563eb', time:'12:00–14:00' },
  { key:'diner', label:'🌙 Dîner', color:'#7c3aed', time:'18:00–20:00' },
]

// Isolated QR scanner component that mounts/unmounts cleanly
function QRScannerWidget({ onResult, color }) {
  const [state, setState] = useState('idle') // idle | loading | scanning | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const scannerRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [])

  const cleanup = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
  }

  const start = async () => {
    setState('loading')
    setErrorMsg('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mountedRef.current) return
      const scanner = new Html5Qrcode('qr-scan-box')
      scannerRef.current = scanner
      setState('scanning')
      await scanner.start(
        { facingMode:'environment' },
        { fps:10, qrbox:{ width:240, height:240 } },
        async (text) => {
          await cleanup()
          if (!mountedRef.current) return
          setState('done')
          onResult(text)
        },
        () => {}
      )
    } catch(e) {
      if (!mountedRef.current) return
      setState('error')
      setErrorMsg('Accès caméra refusé. Vérifiez les permissions du navigateur.')
    }
  }

  const stop = async () => {
    await cleanup()
    setState('idle')
  }

  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:18, boxShadow:'var(--shadow)' }}>
      <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)', marginBottom:4 }}>📷 Scanner QR du personnel</div>
      <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:14 }}>Pointez la caméra vers le QR de déclaration du résident</div>

      {(state === 'idle' || state === 'done') && (
        <button onClick={start}
          style={{ width:'100%', background:`${color}12`, border:`2px solid ${color}`,
            borderRadius:12, padding:'24px 16px', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:10,
            color, fontWeight:700, fontSize:14, transition:'.2s' }}>
          <span style={{ fontSize:52 }}>📷</span>
          {state === 'done' ? '🔄 Scanner un autre QR' : 'Activer la caméra'}
          <span style={{ fontSize:11, fontWeight:400, color:'var(--text-dim)' }}>
            Cliquez pour démarrer le scanner
          </span>
        </button>
      )}

      {state === 'loading' && (
        <div style={{ width:'100%', background:'var(--surface2)', borderRadius:12, padding:'32px 16px', textAlign:'center', color:'var(--text-dim)' }}>
          <div style={{ fontSize:32, marginBottom:8, animation:'pulse 1s infinite' }}>📡</div>
          Démarrage de la caméra...
        </div>
      )}

      {/* Scanner box - always in DOM when scanning */}
      <div id="qr-scan-box"
        style={{ display: state === 'scanning' ? 'block' : 'none',
          borderRadius:12, overflow:'hidden', border:`2px solid ${color}` }}/>

      {state === 'scanning' && (
        <button onClick={stop}
          style={{ width:'100%', marginTop:10, background:'rgba(220,38,38,.1)', color:'#dc2626',
            border:'1px solid rgba(220,38,38,.3)', padding:'9px', borderRadius:8,
            cursor:'pointer', fontSize:12, fontWeight:700 }}>
          ✕ Arrêter
        </button>
      )}

      {state === 'error' && (
        <div style={{ background:'rgba(220,38,38,.06)', border:'1px solid rgba(220,38,38,.2)', borderRadius:10, padding:14, textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📵</div>
          <div style={{ fontSize:12, color:'#dc2626', fontWeight:600, marginBottom:8 }}>{errorMsg}</div>
          <button onClick={()=>setState('idle')} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'7px 16px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>Réessayer</button>
        </div>
      )}
    </div>
  )
}

export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = ['admin'].includes(role) || user?.is_staff || user?.is_superuser
  const isResto = role === 'restauration'
  const canSeeAll = isAdmin || isResto

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState(canSeeAll ? 'scanner' : 'mon_qr')
  const [scanMsg, setScanMsg] = useState(null)
  const [myQR, setMyQR] = useState(null)
  const [scanKey, setScanKey] = useState(0) // Force remount scanner
  const today = new Date().toISOString().slice(0,10)

  const loadRepas = useCallback(() => {
    setLoading(true)
    qr.repas({ page_size:200, type_repas:typeRepas })
      .then(r => setRepasLog(r.data.results||r.data||[]))
      .catch(() => setRepasLog([]))
      .finally(() => setLoading(false))
  }, [typeRepas])

  useEffect(() => {
    loadRepas()
    if (!canSeeAll) {
      personnelAPI.list({ page_size:500 }).then(r => {
        const items = r.data.results||r.data||[]
        const uname = user?.username || ''
        const uname2 = (user?.last_name || '') + ' ' + (user?.first_name || '')
        const me = items.find(p =>
          p.login_genere === uname ||
          `${p.nom} ${p.prenom}`.toLowerCase().trim() === uname2.toLowerCase().trim()
        ) || items[0]
        if (me) setMyQR(me)
      }).catch(()=>{})
    }
  }, [typeRepas])

  const handleScan = async (qrData) => {
    setScanMsg({ ok:null, msg:'⏳ Validation en cours...' })
    try {
      const r = await qr.scanner({ qr_data: qrData, type_repas: typeRepas })
      setScanMsg({
        ok:true,
        msg:`✅ ${r.data.resident}`,
        sub:`${r.data.type_repas_label} validé · ${r.data.societe||''}`,
        details: r.data
      })
      loadRepas() // Refresh history immediately
    } catch(e) {
      setScanMsg({ ok:false, msg:`❌ ${e.response?.data?.erreur||'QR non reconnu'}`, sub:'Veuillez réessayer' })
    }
    // Auto-clear after 8s
    setTimeout(() => setScanMsg(null), 8000)
  }

  const repas = REPAS.find(r=>r.key===typeRepas)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:'16px' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'var(--blue)', marginBottom:4 }}>🍽️ Restauration</h2>
      <p style={{ fontSize:11, color:'var(--text-dim)', marginBottom:14 }}>
        {canSeeAll ? 'Scanner QR · Validation repas · Historique' : 'Mon QR · Mes repas'}
      </p>

      {/* Repas selector */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {REPAS.map(r=>(
          <button key={r.key} onClick={()=>{ setTypeRepas(r.key); setScanKey(k=>k+1) }}
            style={{ flex:1, padding:'10px 4px', borderRadius:10, border:`2px solid ${typeRepas===r.key?r.color:'var(--border)'}`,
              background:typeRepas===r.key?`${r.color}12`:'#fff', cursor:'pointer',
              color:typeRepas===r.key?r.color:'var(--text-dim)', fontWeight:600, fontSize:11 }}>
            {r.label}<br/><span style={{ fontSize:9, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:14, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {canSeeAll
          ? [['scanner','📷 Scanner'],['aujourd_hui','📋 Aujourd\'hui'],['historique','📊 Historique']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)', boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
          : [['mon_qr','📱 Mon QR'],['mes_repas','🍽️ Mes repas']].map(([k,l])=>(
              <button key={k} onClick={()=>{ setTab(k); if(k==='mes_repas') loadRepas() }}
                style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)', boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
        }
      </div>

      {/* ── SCANNER ── */}
      {tab==='scanner' && canSeeAll && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Scanner widget - key forces full remount on repas change */}
          <QRScannerWidget key={`scanner-${scanKey}`} onResult={handleScan} color={repas?.color||'var(--blue)'}/>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Result message */}
            {scanMsg && (
              <div style={{ background:scanMsg.ok===true?'rgba(22,163,74,.08)':scanMsg.ok===false?'rgba(220,38,38,.08)':'rgba(37,99,235,.06)',
                border:`1px solid ${scanMsg.ok===true?'rgba(22,163,74,.25)':scanMsg.ok===false?'rgba(220,38,38,.25)':'rgba(37,99,235,.2)'}`,
                borderRadius:12, padding:'16px', textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{scanMsg.ok===true?'✅':scanMsg.ok===false?'❌':'⏳'}</div>
                <div style={{ fontSize:14, fontWeight:700, color:scanMsg.ok===true?'#16a34a':scanMsg.ok===false?'#dc2626':'#2563eb', marginBottom:4 }}>{scanMsg.msg}</div>
                {scanMsg.sub && <div style={{ fontSize:12, color:'var(--text-dim)' }}>{scanMsg.sub}</div>}
              </div>
            )}

            {/* Today's counter */}
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:16, boxShadow:'var(--shadow)' }}>
              <div style={{ fontWeight:600, color:'var(--blue)', marginBottom:6, fontSize:13 }}>Aujourd'hui — {repas?.label}</div>
              <div style={{ fontFamily:'monospace', fontSize:44, fontWeight:700, color:repas?.color, textAlign:'center', marginBottom:4 }}>{todayLog.length}</div>
              <div style={{ textAlign:'center', fontSize:11, color:'var(--text-dim)', marginBottom:10 }}>repas validés</div>
              <div style={{ maxHeight:180, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
                {todayLog.map(r=>(
                  <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--surface2)', borderRadius:7, fontSize:11 }}>
                    <span style={{ fontWeight:600 }}>{r.resident||'—'}</span>
                    <span style={{ color:'var(--text-dim)', fontFamily:'monospace' }}>{r.date_validation&&new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                ))}
                {todayLog.length===0&&<div style={{textAlign:'center',color:'var(--text-dim)',fontSize:12,padding:12}}>Aucun repas validé</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AUJOURD'HUI ── */}
      {tab==='aujourd_hui' && <RepasTable data={todayLog} title={`Repas du ${new Date().toLocaleDateString('fr-FR')} · ${repas?.label}`} loading={loading}/>}

      {/* ── HISTORIQUE ── */}
      {tab==='historique' && <RepasTable data={repasLog} title={`Historique · ${repas?.label}`} loading={loading} showDate/>}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:360, margin:'0 auto' }}>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:24, textAlign:'center', boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)', marginBottom:4 }}>📱 Mon QR de déclaration</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:16 }}>Présentez ce QR au restaurant pour valider votre repas</div>
            {myQR?.qr_code_data
              ? <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                  style={{ width:220, height:220, borderRadius:12, border:'3px solid var(--border)', margin:'0 auto 14px', display:'block', boxShadow:'var(--shadow)' }}/>
              : <div style={{ width:220, height:220, background:'var(--surface2)', borderRadius:12, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)', flexDirection:'column', gap:10 }}>
                  <div style={{ fontSize:44 }}>📱</div>
                  <div style={{ fontSize:12, textAlign:'center' }}>QR non disponible<br/>Contactez l'administrateur</div>
                </div>
            }
            {myQR && (
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
                <div style={{ fontWeight:700, color:'var(--blue)' }}>{myQR.nom} {myQR.prenom}</div>
                <div style={{ color:'var(--text-dim)', fontSize:11 }}>{myQR.societe} · {myQR.type_personnel}</div>
              </div>
            )}
          </div>
          <button onClick={()=>setTab('mes_repas')}
            style={{ width:'100%', marginTop:12, background:'var(--blue)', color:'#fff', border:'none', padding:'12px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            📋 Voir mes repas →
          </button>
        </div>
      )}

      {/* ── MES REPAS ── */}
      {tab==='mes_repas' && (
        <div>
          <div style={{ marginBottom:10, display:'flex', justifyContent:'flex-end' }}>
            <button onClick={loadRepas} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--blue)', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🔄 Actualiser
            </button>
          </div>
          <RepasTable data={repasLog} title={`Mes repas · ${repas?.label}`} loading={loading} showDate/>
        </div>
      )}
    </div>
  )
}

function RepasTable({ data, title, loading, showDate }) {
  const COLS = { petit_dejeuner:{label:'🌅',color:'#f97316'}, dejeuner:{label:'☀️',color:'#2563eb'}, diner:{label:'🌙',color:'#7c3aed'} }
  if (loading) return <div style={{ padding:32, textAlign:'center', color:'var(--text-dim)', fontSize:13 }}>🔄 Chargement...</div>
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
      <div style={{ padding:'11px 16px', background:'var(--blue)', color:'#fff', fontWeight:600, fontSize:13, display:'flex', justifyContent:'space-between' }}>
        <span>{title}</span>
        <span style={{ background:'rgba(255,255,255,.2)', padding:'2px 10px', borderRadius:20, fontSize:12 }}>{data.length}</span>
      </div>
      {data.length===0
        ? <div style={{ padding:32, textAlign:'center', color:'var(--text-dim)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🍽️</div>
            <div>Aucun repas enregistré</div>
          </div>
        : <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:380 }}>
              <thead><tr style={{ background:'var(--surface2)' }}>
                {[showDate&&'Date','Heure','Résident','Résidence','Repas'].filter(Boolean).map(h=>(
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.map((r,i)=>{
                  const col=COLS[r.type_repas]
                  const dt=r.date_validation?new Date(r.date_validation):null
                  return (
                    <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                      {showDate&&<td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{dt?.toLocaleDateString('fr-FR')||'—'}</td>}
                      <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{dt?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}</td>
                      <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.resident||'—'}</td>
                      <td style={{ padding:'8px 12px', fontSize:11, color:'var(--text-dim)' }}>{r.residence||'—'}</td>
                      <td style={{ padding:'8px 12px' }}>
                        <span style={{ background:`${col?.color||'#666'}20`,color:col?.color||'#666',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:600 }}>
                          {col?.label} {r.type_repas_label||r.type_repas}
                        </span>
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
