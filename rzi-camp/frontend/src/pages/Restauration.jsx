
import React, { useState, useEffect, useRef } from 'react'
import { qr, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'🌅 Petit-déjeuner', color:'#f97316', time:'06:00–09:00' },
  { key:'dejeuner', label:'☀️ Déjeuner', color:'#2563eb', time:'12:00–14:00' },
  { key:'diner', label:'🌙 Dîner', color:'#7c3aed', time:'18:00–20:00' },
]

function QRScanner({ onScan, active, onStop }) {
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)

  useEffect(() => {
    if (!active) return
    let scanner = null

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        scanner = new Html5Qrcode('qr-reader')
        html5QrRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            onScan(decodedText)
            scanner.stop().catch(() => {})
          },
          () => {}
        )
      } catch (err) {
        console.error('QR Scanner error:', err)
        onStop('error')
      }
    }
    startScanner()

    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {})
        html5QrRef.current = null
      }
    }
  }, [active])

  if (!active) return null

  return (
    <div>
      <div id="qr-reader" style={{ width:'100%', borderRadius:10, overflow:'hidden' }}/>
      <button onClick={onStop} style={{ width:'100%', marginTop:10, background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.3)', padding:'8px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
        ✕ Arrêter le scanner
      </button>
    </div>
  )
}

export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = ['admin','manager'].includes(role) || user?.is_staff || user?.is_superuser
  const isResto = role === 'restauration'
  const canSeeAll = isAdmin || isResto

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [tab, setTab] = useState(canSeeAll ? 'scanner' : 'mon_qr')
  const [scanMsg, setScanMsg] = useState(null)
  const [myQR, setMyQR] = useState(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerError, setScannerError] = useState(null)

  const today = new Date().toISOString().slice(0,10)

  const loadRepas = () => {
    const p = { page_size:200, type_repas:typeRepas }
    qr.repas(p).then(r => setRepasLog(r.data.results||r.data))
    if (!canSeeAll) {
      personnelAPI.list({ page_size:500 }).then(r => {
        const items = r.data.results||r.data
        const me = items.find(p => p.login_genere === user?.username || p.email === user?.email)
        if (me) setMyQR(me)
        else if (items.length > 0 && !isAdmin) setMyQR(items[0])
      })
    }
  }

  useEffect(() => { loadRepas() }, [typeRepas])

  const handleScan = async (qrData) => {
    setScannerActive(false)
    try {
      const r = await qr.scanner({ qr_data: qrData, type_repas: typeRepas })
      setScanMsg({ ok:true, msg:`✅ ${r.data.resident}`, sub:`${r.data.type_repas} · ${r.data.societe||''}` })
      loadRepas()
    } catch(e) {
      setScanMsg({ ok:false, msg:`❌ ${e.response?.data?.erreur||'QR non reconnu'}`, sub:'Veuillez réessayer' })
    }
    setTimeout(() => setScanMsg(null), 6000)
  }

  const startScanner = () => {
    setScannerError(null)
    setScanMsg(null)
    setScannerActive(true)
  }

  const stopScanner = (reason) => {
    setScannerActive(false)
    if (reason === 'error') setScannerError('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
  }

  const repas_selected = REPAS.find(r=>r.key===typeRepas)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)', marginBottom:4 }}>🍽️ Module Restauration</h2>
      <p style={{ fontSize:12, color:'var(--text-dim)', marginBottom:16 }}>
        {canSeeAll ? '3 repas · Scan QR déclaration · Historisation' : 'Mon QR · Mes repas'}
      </p>

      {/* Sélection repas */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {REPAS.map(r=>(
          <button key={r.key} onClick={()=>setTypeRepas(r.key)}
            style={{ flex:1, padding:'10px 6px', borderRadius:10, border:`2px solid ${typeRepas===r.key?r.color:'var(--border)'}`,
              background:typeRepas===r.key?`${r.color}15`:'#fff', cursor:'pointer',
              color:typeRepas===r.key?r.color:'var(--text-dim)', fontWeight:600, fontSize:12, boxShadow:'var(--shadow)' }}>
            {r.label}<br/><span style={{ fontSize:10, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:16, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {canSeeAll
          ? [['scanner','📷 Scanner QR'],['vue_ensemble','📋 Vue ensemble'],['historique','📊 Historique']].map(([k,l])=>(
              <button key={k} onClick={()=>{setTab(k);setScannerActive(false)}}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
                  boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
          : [['mon_qr','📱 Mon QR'],['mon_historique','📋 Mes repas']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
                  boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
        }
      </div>

      {/* ── SCANNER (camera) ── */}
      {tab==='scanner' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:20, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)', marginBottom:4 }}>📷 Scanner le QR du personnel</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:16 }}>Pointez la caméra sur le QR de déclaration du résident</div>

            {!scannerActive && (
              <button onClick={startScanner}
                style={{ width:'100%', background:`${repas_selected?.color}15`, border:`2px solid ${repas_selected?.color}`,
                  borderRadius:10, padding:'20px', cursor:'pointer', color:repas_selected?.color, fontWeight:700, fontSize:14,
                  display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:40 }}>📷</span>
                Ouvrir la caméra
                <span style={{ fontSize:11, fontWeight:400, color:'var(--text-dim)' }}>Cliquez pour activer le scanner</span>
              </button>
            )}

            <QRScanner active={scannerActive} onScan={handleScan} onStop={stopScanner}/>

            {scannerError && (
              <div style={{ background:'rgba(220,38,38,.1)', border:'1px solid rgba(220,38,38,.3)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#dc2626', marginTop:12 }}>
                ⚠️ {scannerError}
              </div>
            )}

            {scanMsg && (
              <div style={{ marginTop:14, background:scanMsg.ok?'rgba(22,163,74,.1)':'rgba(220,38,38,.1)',
                border:`1px solid ${scanMsg.ok?'rgba(22,163,74,.3)':'rgba(220,38,38,.3)'}`,
                borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
                <div style={{ fontSize:15, fontWeight:700, color:scanMsg.ok?'#16a34a':'#dc2626', marginBottom:4 }}>{scanMsg.msg}</div>
                {scanMsg.sub && <div style={{ fontSize:12, color:'var(--text-dim)' }}>{scanMsg.sub}</div>}
              </div>
            )}

            <div style={{ marginTop:14, background:'var(--surface2)', borderRadius:8, padding:'10px 12px', fontSize:11, color:'var(--text-dim)' }}>
              💡 Chaque personnel a un QR unique généré à sa déclaration. Un seul repas par type par jour.
            </div>
          </div>

          {/* Compteur journée */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:20, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)', marginBottom:6 }}>Aujourd'hui — {new Date().toLocaleDateString('fr-FR')}</div>
            <div style={{ fontFamily:'monospace', fontSize:44, fontWeight:700, color:repas_selected?.color, marginBottom:4, textAlign:'center' }}>
              {todayLog.length}
            </div>
            <div style={{ textAlign:'center', fontSize:12, color:'var(--text-dim)', marginBottom:14 }}>repas {repas_selected?.label} validés</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:240, overflowY:'auto' }}>
              {todayLog.map(r=>(
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px', background:'var(--surface2)', borderRadius:8, fontSize:12 }}>
                  <span style={{ fontWeight:600 }}>{r.resident}</span>
                  <span style={{ color:'var(--text-dim)', fontFamily:'monospace', fontSize:11 }}>
                    {new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              ))}
              {todayLog.length===0 && <div style={{ textAlign:'center', color:'var(--text-dim)', fontSize:13, padding:16 }}>Aucun repas validé</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── VUE D'ENSEMBLE ── */}
      {tab==='vue_ensemble' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {REPAS.map(r=>{
              const n = repasLog.filter(x=>x.type_repas===r.key&&x.date_validation?.startsWith(today)).length
              return (
                <div key={r.key} style={{ background:'#fff', border:`2px solid ${r.color}`, borderRadius:12, padding:14, textAlign:'center', boxShadow:'var(--shadow)' }}>
                  <div style={{ fontSize:24, marginBottom:4 }}>{r.label.split(' ')[0]}</div>
                  <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:700, color:r.color }}>{n}</div>
                  <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>{r.label.replace(r.label.split(' ')[0]+' ','')}</div>
                </div>
              )
            })}
          </div>
          <TableRepas data={repasLog.filter(r=>r.date_validation?.startsWith(today))} title={`Repas du jour — ${new Date().toLocaleDateString('fr-FR')}`}/>
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {tab==='historique' && <TableRepas data={repasLog} title={`Historique — ${repas_selected?.label}`} showDate/>}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:360, margin:'0 auto', background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:24, textAlign:'center', boxShadow:'var(--shadow)' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)', marginBottom:4 }}>📱 Mon QR de déclaration</div>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:14 }}>Présentez ce QR au restaurant pour valider votre repas</div>
          {myQR?.qr_code_data
            ? <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                style={{ width:220, height:220, borderRadius:10, border:'3px solid var(--border)', margin:'0 auto 14px', display:'block' }}/>
            : <div style={{ width:220, height:220, background:'var(--surface2)', borderRadius:10, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:40 }}>📱</div><div style={{ fontSize:12 }}>QR non disponible<br/>Contactez l'admin</div>
              </div>
          }
          {myQR && <div style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 12px', fontSize:11, fontFamily:'monospace', color:'var(--text-dim)' }}>{myQR.nom} {myQR.prenom} · {myQR.societe}</div>}
        </div>
      )}

      {/* ── MES REPAS ── */}
      {tab==='mon_historique' && <TableRepas data={repasLog} title={`Mes repas — ${repas_selected?.label}`} showDate/>}
    </div>
  )
}

function TableRepas({ data, title, showDate }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
      <div style={{ padding:'11px 16px', background:'var(--blue)', color:'#fff', fontWeight:600, fontSize:13, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>{title}</span>
        <span style={{ background:'rgba(255,255,255,.2)', padding:'2px 10px', borderRadius:20, fontSize:12 }}>{data.length}</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:400 }}>
          <thead><tr style={{ background:'var(--surface2)' }}>
            {[showDate&&'Date','Heure','Résident','Résidence','Repas','Validé par'].filter(Boolean).map(h=>(
              <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.length===0
              ? <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucune donnée</td></tr>
              : data.map((r,i)=>(
                <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                  {showDate&&<td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleDateString('fr-FR')}</td>}
                  <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.resident}</td>
                  <td style={{ padding:'8px 12px' }}>{r.residence||'—'}</td>
                  <td style={{ padding:'8px 12px' }}>
                    {(() => { const rep=REPAS.find(x=>x.key===r.type_repas); return rep?<span style={{ background:`${rep.color}20`,color:rep.color,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600 }}>{rep.label}</span>:r.type_repas_label })()}
                  </td>
                  <td style={{ padding:'8px 12px', fontSize:11, color:'var(--text-dim)' }}>{r.valide_par_nom}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
