
import React, { useState, useEffect, useRef } from 'react'
import { qr, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'🌅 Petit-déjeuner', color:'#f97316', time:'06:00–09:00' },
  { key:'dejeuner', label:'☀️ Déjeuner', color:'#2563eb', time:'12:00–14:00' },
  { key:'diner', label:'🌙 Dîner', color:'#7c3aed', time:'18:00–20:00' },
]

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
  const scanRef = useRef(null)

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

  // Quand le restaurant est en mode scan, le champ invisible capte le QR scanner hardware
  const [hiddenInput, setHiddenInput] = useState('')

  const activerScan = () => {
    scanRef.current?.focus()
    setScanMsg({ ok:null, msg:'📱 Prêt — Présentez le QR du personnel au lecteur' })
  }

  const handleScanInput = async (e) => {
    if (e.key === 'Enter' && hiddenInput.trim()) {
      const data = hiddenInput.trim()
      setHiddenInput('')
      try {
        const r = await qr.scanner({ qr_data: data, type_repas: typeRepas })
        setScanMsg({ ok:true, msg:`✅ ${r.data.resident}`, sub:`${r.data.type_repas} · ${r.data.societe||''}`, data:r.data })
        loadRepas()
      } catch(e) {
        setScanMsg({ ok:false, msg:`❌ ${e.response?.data?.erreur||'QR invalide'}`, sub:'Veuillez réessayer' })
      }
      setTimeout(() => setScanMsg(null), 5000)
    }
  }

  const repas_selected = REPAS.find(r=>r.key===typeRepas)
  const today = new Date().toISOString().slice(0,10)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)', marginBottom:4 }}>🍽️ Module Restauration</h2>
      <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:16 }}>
        {canSeeAll ? '3 repas · Scan QR déclaration · Historisation' : 'Mon espace · QR de déclaration'}
      </p>

      {/* Sélection repas */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        {REPAS.map(r=>(
          <button key={r.key} onClick={()=>setTypeRepas(r.key)}
            style={{ flex:1, padding:'12px 8px', borderRadius:10, border:`2px solid ${typeRepas===r.key?r.color:'var(--border)'}`,
              background:typeRepas===r.key?`${r.color}15`:'#fff', cursor:'pointer',
              color:typeRepas===r.key?r.color:'var(--text-dim)', fontWeight:600, fontSize:13, boxShadow:'var(--shadow)' }}>
            {r.label}<br/><span style={{ fontSize:11, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:16, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {canSeeAll
          ? [['scanner','📱 Scanner'],['vue_ensemble','📋 Vue ensemble'],['historique','📊 Historique']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
                  boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
          : [['mon_qr','📱 Mon QR'],['mon_historique','📋 Mes repas']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
                  boxShadow:tab===k?'var(--shadow)':'none' }}>
                {l}
              </button>
            ))
        }
      </div>

      {/* ── SCANNER (Resto/Admin) ── */}
      {tab==='scanner' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Zone scan */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:24, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)', marginBottom:4 }}>📱 Scanner QR — {repas_selected?.label}</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:20 }}>Cliquer puis présenter le QR du personnel au lecteur de code-barre</div>

            {/* Champ invisible capte le scanner HW */}
            <input ref={scanRef} value={hiddenInput} onChange={e=>setHiddenInput(e.target.value)}
              onKeyDown={handleScanInput} style={{ position:'absolute', left:'-9999px', opacity:0 }} autoComplete="off"/>

            {/* Bouton scan */}
            <button onClick={activerScan}
              style={{ width:'100%', height:140, background:`${repas_selected?.color}10`, border:`3px dashed ${repas_selected?.color}`,
                borderRadius:12, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', gap:8, transition:'.2s' }}>
              <div style={{ fontSize:48 }}>📷</div>
              <div style={{ fontSize:14, fontWeight:700, color:repas_selected?.color }}>Activer le scanner</div>
              <div style={{ fontSize:11, color:'var(--text-dim)' }}>Cliquez puis scannez le QR</div>
            </button>

            {/* Message résultat */}
            {scanMsg && (
              <div style={{ marginTop:16, background:scanMsg.ok===true?'rgba(22,163,74,.1)':scanMsg.ok===false?'rgba(220,38,38,.1)':'rgba(37,99,235,.08)',
                border:`1px solid ${scanMsg.ok===true?'rgba(22,163,74,.3)':scanMsg.ok===false?'rgba(220,38,38,.3)':'rgba(37,99,235,.2)'}`,
                borderRadius:10, padding:'14px 18px', textAlign:'center' }}>
                <div style={{ fontSize:15, fontWeight:700, color:scanMsg.ok===true?'#16a34a':scanMsg.ok===false?'#dc2626':'#2563eb', marginBottom:4 }}>{scanMsg.msg}</div>
                {scanMsg.sub && <div style={{ fontSize:12, color:'var(--text-dim)' }}>{scanMsg.sub}</div>}
              </div>
            )}

            <div style={{ marginTop:16, background:'var(--surface2)', borderRadius:8, padding:12, fontSize:11, color:'var(--text-dim)' }}>
              <b>Comment ça marche :</b> Chaque personnel possède un QR unique généré lors de sa déclaration. Le restaurant scanne ce QR pour valider le repas.
            </div>
          </div>

          {/* Repas du jour */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:24, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)', marginBottom:6 }}>Aujourd'hui — {new Date().toLocaleDateString('fr-FR')}</div>
            <div style={{ fontFamily:'monospace', fontSize:44, fontWeight:700, color:repas_selected?.color, marginBottom:4, textAlign:'center' }}>
              {todayLog.length}
            </div>
            <div style={{ textAlign:'center', fontSize:13, color:'var(--text-dim)', marginBottom:16 }}>repas validés</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:250, overflowY:'auto' }}>
              {todayLog.map(r=>(
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface2)', borderRadius:8, fontSize:12 }}>
                  <span style={{ fontWeight:600 }}>{r.resident}</span>
                  <span style={{ color:'var(--text-dim)', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
              {todayLog.length===0 && <div style={{ textAlign:'center', color:'var(--text-dim)', fontSize:13, padding:20 }}>Aucun repas encore</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── VUE D'ENSEMBLE ── */}
      {tab==='vue_ensemble' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            {REPAS.map(r=>{
              const n = repasLog.filter(x=>x.type_repas===r.key&&x.date_validation?.startsWith(today)).length
              return (
                <div key={r.key} style={{ background:'#fff', border:`2px solid ${r.color}`, borderRadius:12, padding:16, textAlign:'center', boxShadow:'var(--shadow)' }}>
                  <div style={{ fontSize:28, marginBottom:4 }}>{r.label.split(' ')[0]}</div>
                  <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:700, color:r.color }}>{n}</div>
                  <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:2 }}>{r.label.replace(r.label.split(' ')[0]+' ','')}</div>
                </div>
              )
            })}
          </div>
          <TableRepas data={todayLog} title={`Repas du jour — ${new Date().toLocaleDateString('fr-FR')}`}/>
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {tab==='historique' && <TableRepas data={repasLog} title={`Historique — ${repas_selected?.label}`} showDate/>}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:360, margin:'0 auto', background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:28, textAlign:'center', boxShadow:'var(--shadow)' }}>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--blue)', marginBottom:4 }}>📱 Mon QR de déclaration</div>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:16 }}>Présentez ce QR au restaurant pour valider votre repas</div>
          {myQR?.qr_code_data
            ? <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                style={{ width:220, height:220, borderRadius:10, border:'3px solid var(--border)', margin:'0 auto 14px', display:'block' }}/>
            : <div style={{ width:220, height:220, background:'var(--surface2)', borderRadius:10, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:40 }}>📱</div>
                <div style={{ fontSize:12 }}>QR non disponible</div>
                <div style={{ fontSize:11 }}>Contactez l'admin</div>
              </div>
          }
          <div style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 14px', fontSize:11, fontFamily:'monospace', color:'var(--text-dim)' }}>
            {myQR?.nom} {myQR?.prenom} · {myQR?.societe}
          </div>
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
      <div style={{ padding:'12px 18px', background:'var(--blue)', color:'#fff', fontWeight:600, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span>{title}</span>
        <span style={{ background:'rgba(255,255,255,.2)', padding:'2px 10px', borderRadius:20, fontSize:12 }}>{data.length}</span>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
        <thead><tr style={{ background:'var(--surface2)' }}>
          {[showDate&&'Date','Heure','Résident','Résidence','Repas','Validé par'].filter(Boolean).map(h=>(
            <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {data.length===0
            ? <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucune donnée</td></tr>
            : data.map((r,i)=>(
              <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                {showDate && <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleDateString('fr-FR')}</td>}
                <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                <td style={{ padding:'9px 14px', fontWeight:600 }}>{r.resident}</td>
                <td style={{ padding:'9px 14px' }}>{r.residence||'—'}</td>
                <td style={{ padding:'9px 14px' }}>
                  {(() => { const rep=REPAS.find(x=>x.key===r.type_repas); return rep?<span style={{ background:`${rep.color}20`,color:rep.color,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600 }}>{rep.label}</span>:r.type_repas_label })()}
                </td>
                <td style={{ padding:'9px 14px', fontSize:11, color:'var(--text-dim)' }}>{r.valide_par_nom}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}
