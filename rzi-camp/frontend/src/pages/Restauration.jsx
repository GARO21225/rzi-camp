
import React, { useState, useEffect, useRef } from 'react'
import { qr, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'🌅 Petit-déjeuner', color:'#f97316', time:'06:00–09:00' },
  { key:'dejeuner', label:'☀️ Déjeuner', color:'#2563eb', time:'12:00–14:00' },
  { key:'diner', label:'🌙 Dîner', color:'#7c3aed', time:'18:00–20:00' },
]
const REPAS_MAP = { petit_dejeuner:'🌅 Petit-déjeuner', dejeuner:'☀️ Déjeuner', diner:'🌙 Dîner' }

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
  const [scannerActive, setScannerActive] = useState(false)
  const [scanError, setScanError] = useState(null)
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)
  const today = new Date().toISOString().slice(0,10)

  const loadRepas = () => {
    setLoading(true)
    qr.repas({ page_size:200, type_repas:typeRepas })
      .then(r => setRepasLog(r.data.results||r.data||[]))
      .catch(() => setRepasLog([]))
      .finally(() => setLoading(false))

    if (!canSeeAll) {
      personnelAPI.list({ page_size:500 }).then(r => {
        const items = r.data.results||r.data||[]
        const me = items.find(p =>
          p.login_genere === user?.username ||
          p.email === user?.email ||
          `${p.nom} ${p.prenom}`.toLowerCase().includes((user?.last_name||'').toLowerCase())
        )
        if (me) setMyQR(me)
        else if (items.length > 0) setMyQR(items[0])
      }).catch(()=>{})
    }
  }

  useEffect(() => { loadRepas() }, [typeRepas, tab])

  // ── QR SCANNER ──
  const startScanner = async () => {
    setScanError(null); setScanMsg(null)
    if (!document.getElementById('qr-reader')) {
      setScannerActive(true)
      await new Promise(r => setTimeout(r, 100))
    } else {
      setScannerActive(true)
    }
  }

  useEffect(() => {
    if (!scannerActive) return
    let scanner = null

    const init = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const el = document.getElementById('qr-reader')
        if (!el) return
        scanner = new Html5Qrcode('qr-reader')
        html5QrRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 250, height: 250 } },
          (text) => {
            handleScan(text)
          },
          () => {} // ignore errors during scanning
        )
      } catch(err) {
        setScanError('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
        setScannerActive(false)
      }
    }

    init()

    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(()=>{})
        html5QrRef.current.clear()
        html5QrRef.current = null
      }
    }
  }, [scannerActive])

  const stopScanner = async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop() } catch {}
      try { html5QrRef.current.clear() } catch {}
      html5QrRef.current = null
    }
    setScannerActive(false)
  }

  const handleScan = async (qrData) => {
    await stopScanner()
    setScanMsg({ ok:null, msg:'⏳ Validation en cours...' })
    try {
      const r = await qr.scanner({ qr_data: qrData, type_repas: typeRepas })
      setScanMsg({ ok:true, msg:`✅ ${r.data.resident}`, sub:`${REPAS_MAP[typeRepas]} validé · ${r.data.societe||''}` })
      loadRepas()
    } catch(e) {
      setScanMsg({ ok:false, msg:`❌ ${e.response?.data?.erreur||'QR non reconnu'}`, sub:'Veuillez réessayer' })
    }
    setTimeout(() => setScanMsg(null), 6000)
  }

  const repas = REPAS.find(r=>r.key===typeRepas)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:'16px' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'var(--blue)', marginBottom:4 }}>🍽️ Restauration</h2>
      <p style={{ fontSize:11, color:'var(--text-dim)', marginBottom:14 }}>
        {canSeeAll ? '3 repas · Scan QR · Validation' : 'Mon QR · Mes repas'}
      </p>

      {/* Repas selector */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {REPAS.map(r=>(
          <button key={r.key} onClick={()=>{setTypeRepas(r.key);setScannerActive(false)}}
            style={{ flex:1, padding:'10px 6px', borderRadius:10, border:`2px solid ${typeRepas===r.key?r.color:'var(--border)'}`,
              background:typeRepas===r.key?`${r.color}15`:'#fff', cursor:'pointer', color:typeRepas===r.key?r.color:'var(--text-dim)',
              fontWeight:600, fontSize:11, boxShadow:'var(--shadow)' }}>
            {r.label}<br/><span style={{ fontSize:10, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:14, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {canSeeAll
          ? [['scanner','📷 Scanner'],['vue_ensemble','📋 Aujourd\'hui'],['historique','📊 Historique']].map(([k,l])=>(
              <button key={k} onClick={()=>{setTab(k); if(k!=='scanner')stopScanner()}}
                style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)', boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
          : [['mon_qr','📱 Mon QR'],['mon_historique','📋 Mes repas']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)', boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
        }
      </div>

      {/* ── SCANNER ── */}
      {tab==='scanner' && canSeeAll && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:18, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)', marginBottom:4 }}>📷 Scanner le QR du personnel</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:14 }}>Pointez la caméra vers le QR de déclaration</div>

            {!scannerActive && (
              <button onClick={startScanner}
                style={{ width:'100%', background:`${repas?.color}12`, border:`2px solid ${repas?.color}`,
                  borderRadius:10, padding:'20px', cursor:'pointer', display:'flex', flexDirection:'column',
                  alignItems:'center', gap:8, color:repas?.color, fontWeight:700, fontSize:14 }}>
                <span style={{ fontSize:44 }}>📷</span>
                Activer la caméra
                <span style={{ fontSize:11, fontWeight:400, color:'var(--text-dim)' }}>Cliquez pour scanner</span>
              </button>
            )}

            {/* QR Scanner container - always in DOM when active */}
            <div id="qr-reader" style={{ display:scannerActive?'block':'none', borderRadius:10, overflow:'hidden' }}/>

            {scannerActive && (
              <button onClick={stopScanner}
                style={{ width:'100%', marginTop:10, background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.3)', padding:'8px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                ✕ Arrêter le scanner
              </button>
            )}

            {scanError && (
              <div style={{ marginTop:10, background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.2)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#dc2626' }}>
                ⚠️ {scanError}
              </div>
            )}

            {scanMsg && (
              <div style={{ marginTop:14, background:scanMsg.ok===true?'rgba(22,163,74,.1)':scanMsg.ok===false?'rgba(220,38,38,.1)':'rgba(37,99,235,.06)',
                border:`1px solid ${scanMsg.ok===true?'rgba(22,163,74,.3)':scanMsg.ok===false?'rgba(220,38,38,.3)':'rgba(37,99,235,.2)'}`,
                borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:scanMsg.ok===true?'#16a34a':scanMsg.ok===false?'#dc2626':'#2563eb' }}>{scanMsg.msg}</div>
                {scanMsg.sub && <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>{scanMsg.sub}</div>}
              </div>
            )}
          </div>

          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:18, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, color:'var(--blue)', marginBottom:6 }}>Aujourd'hui · {new Date().toLocaleDateString('fr-FR')}</div>
            <div style={{ fontFamily:'monospace', fontSize:44, fontWeight:700, color:repas?.color, textAlign:'center', marginBottom:4 }}>{todayLog.length}</div>
            <div style={{ textAlign:'center', fontSize:12, color:'var(--text-dim)', marginBottom:12 }}>repas validés</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:220, overflowY:'auto' }}>
              {todayLog.map(r=>(
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px', background:'var(--surface2)', borderRadius:8, fontSize:12 }}>
                  <span style={{ fontWeight:600 }}>{r.resident}</span>
                  <span style={{ color:'var(--text-dim)', fontFamily:'monospace', fontSize:11 }}>{r.date_validation&&new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
              {todayLog.length===0&&<div style={{textAlign:'center',color:'var(--text-dim)',fontSize:13,padding:16}}>Aucun repas validé</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── VUE ENSEMBLE ── */}
      {tab==='vue_ensemble' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {REPAS.map(r=>{ const n=repasLog.filter(x=>x.type_repas===r.key&&x.date_validation?.startsWith(today)).length
              return <div key={r.key} style={{ background:'#fff', border:`2px solid ${r.color}`, borderRadius:12, padding:14, textAlign:'center', boxShadow:'var(--shadow)' }}>
                <div style={{ fontSize:24 }}>{r.label.split(' ')[0]}</div>
                <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:700, color:r.color }}>{n}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>{r.label.slice(3)}</div>
              </div>
            })}
          </div>
          <RepasTable data={todayLog} title={`Repas du ${new Date().toLocaleDateString('fr-FR')}`} loading={loading}/>
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {tab==='historique' && <RepasTable data={repasLog} title={`Historique · ${repas?.label}`} loading={loading} showDate/>}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:360, margin:'0 auto', background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:24, textAlign:'center', boxShadow:'var(--shadow)' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)', marginBottom:4 }}>📱 Mon QR de déclaration</div>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:14 }}>Présentez ce QR pour valider vos repas</div>
          {myQR?.qr_code_data
            ? <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                style={{ width:220, height:220, borderRadius:10, border:'3px solid var(--border)', margin:'0 auto 14px', display:'block' }}/>
            : <div style={{ width:220, height:220, background:'var(--surface2)', borderRadius:10, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:44 }}>📱</div><div style={{ fontSize:12 }}>QR non disponible — Contactez l'admin</div>
              </div>
          }
          {myQR && <div style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 12px', fontSize:11, fontFamily:'monospace', color:'var(--text-dim)' }}>{myQR.nom} {myQR.prenom} · {myQR.societe}</div>}
        </div>
      )}

      {/* ── MES REPAS ── */}
      {tab==='mon_historique' && <RepasTable data={repasLog} title={`Mes repas · ${repas?.label}`} loading={loading} showDate/>}
    </div>
  )
}

function RepasTable({ data, title, loading, showDate }) {
  const REPAS_MAP = { petit_dejeuner:{label:'🌅 Petit-déj',color:'#f97316'}, dejeuner:{label:'☀️ Déjeuner',color:'#2563eb'}, diner:{label:'🌙 Dîner',color:'#7c3aed'} }
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
      <div style={{ padding:'11px 16px', background:'var(--blue)', color:'#fff', fontWeight:600, fontSize:13, display:'flex', justifyContent:'space-between' }}>
        <span>{title}</span><span style={{ background:'rgba(255,255,255,.2)', padding:'2px 10px', borderRadius:20, fontSize:12 }}>{data.length}</span>
      </div>
      {loading
        ? <div style={{padding:24,textAlign:'center',color:'var(--text-dim)'}}>Chargement...</div>
        : <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:400 }}>
            <thead><tr style={{ background:'var(--surface2)' }}>
              {[showDate&&'Date','Heure','Résident','Résidence','Repas','Validé par'].filter(Boolean).map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.length===0
                ? <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucune donnée</td></tr>
                : data.map((r,i)=>{
                  const rep=REPAS_MAP[r.type_repas]
                  const dt=r.date_validation?new Date(r.date_validation):null
                  return (
                    <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                      {showDate&&<td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{dt?.toLocaleDateString('fr-FR')||'—'}</td>}
                      <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{dt?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}</td>
                      <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.resident||'—'}</td>
                      <td style={{ padding:'8px 12px' }}>{r.residence||'—'}</td>
                      <td style={{ padding:'8px 12px' }}>
                        {rep?<span style={{ background:`${rep.color}20`,color:rep.color,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600 }}>{rep.label}</span>:r.type_repas_label||r.type_repas||'—'}
                      </td>
                      <td style={{ padding:'8px 12px', fontSize:11, color:'var(--text-dim)' }}>{r.valide_par_nom||'—'}</td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  )
}
