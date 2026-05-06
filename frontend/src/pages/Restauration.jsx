
import React, { useState, useEffect, useRef } from 'react'
import { qr, personnel as personnelAPI } from '../api'

const REPAS = [
  { key:'petit_dejeuner', label:'🌅 Petit-déjeuner', color:'#f97316', time:'06:00–09:00' },
  { key:'dejeuner', label:'☀️ Déjeuner', color:'#2563eb', time:'12:00–14:00' },
  { key:'diner', label:'🌙 Dîner', color:'#7c3aed', time:'18:00–20:00' },
]

export default function Restauration() {
  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [personnelList, setPersonnelList] = useState([])
  const [selectedPersonnel, setSelectedPersonnel] = useState('')
  const [qrData, setQrData] = useState(null)
  const [qrImage, setQrImage] = useState(null)
  const [seconds, setSeconds] = useState(300)
  const [repasLog, setRepasLog] = useState([])
  const [scanInput, setScanInput] = useState('')
  const [scanMsg, setScanMsg] = useState(null)
  const [tab, setTab] = useState('generer')
  const timerRef = useRef(null)

  useEffect(() => {
    personnelAPI.list({ page_size:500 }).then(r => setPersonnelList(r.data.results||r.data))
    loadRepas()
  }, [])

  const loadRepas = (type='') => {
    const p = { page_size:50 }
    if (type) p.type_repas = type
    qr.repas(p).then(r => setRepasLog(r.data.results||r.data))
  }

  const generer = async () => {
    clearInterval(timerRef.current)
    if (!selectedPersonnel) return alert('Sélectionner un membre du personnel')
    try {
      const r = await qr.generer({
        personnel_id: selectedPersonnel,
        type_repas: typeRepas,
        duree: 300
      })
      setQrData(r.data)
      setQrImage(r.data.qr_image)
      setSeconds(300)
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) { clearInterval(timerRef.current); setQrData(null); setQrImage(null); return 0 }
          return s - 1
        })
      }, 1000)
    } catch(e) {
      alert(e.response?.data?.error || 'Erreur génération QR')
    }
  }

  const scanner = async () => {
    if (!scanInput.trim()) return
    try {
      const r = await qr.scanner({ token: scanInput.trim() })
      setScanMsg({ ok:true, msg:`✅ Validé — ${r.data.resident} (${r.data.type_repas})` })
      loadRepas()
    } catch(e) {
      setScanMsg({ ok:false, msg:`❌ ${e.response?.data?.erreur || 'Erreur'}` })
    }
    setScanInput('')
    setTimeout(() => setScanMsg(null), 4000)
  }

  const repas_selected = REPAS.find(r => r.key === typeRepas)
  const mins = Math.floor(seconds/60), secs = seconds%60
  const secColor = seconds > 120 ? repas_selected?.color : seconds > 30 ? '#f97316' : '#dc2626'

  const inp = { background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }

  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)', marginBottom:4 }}>🍽️ Module Restauration</h2>
      <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:20 }}>3 repas · QR dynamique HMAC · Anti-fraude · Historisation complète</p>

      {/* Sélection repas */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        {REPAS.map(r => (
          <button key={r.key} onClick={()=>{ setTypeRepas(r.key); loadRepas(r.key) }}
            style={{ flex:1, padding:'12px 8px', borderRadius:10, border:`2px solid ${typeRepas===r.key?r.color:'var(--border)'}`,
              background:typeRepas===r.key?`${r.color}15`:'var(--surface)', cursor:'pointer',
              color:typeRepas===r.key?r.color:'var(--text-dim)', fontWeight:600, fontSize:13, transition:'.2s' }}>
            {r.label}<br/><span style={{ fontSize:11, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:16, background:'var(--surface2)', borderRadius:10, padding:4 }}>
        {[['generer','🔲 Générer QR'],['scanner','📱 Scanner'],['historique','📋 Historique']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background:tab===k?'var(--surface)':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none', transition:'.2s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* TAB: GÉNÉRER QR */}
      {tab==='generer' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Personnel *</label>
              <select value={selectedPersonnel} onChange={e=>setSelectedPersonnel(e.target.value)} style={inp}>
                <option value="">— Sélectionner —</option>
                {personnelList.map(p => <option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
              </select>
            </div>
            <button onClick={generer} style={{ width:'100%', background:'var(--blue)', color:'#fff', border:'none', padding:'10px', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600 }}>
              🔲 Générer QR {repas_selected?.label}
            </button>
            {/* Sécurité */}
            <div style={{ marginTop:14, background:'var(--surface2)', borderRadius:8, padding:12, fontSize:12 }}>
              <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-dim)', letterSpacing:2, marginBottom:6 }}>SÉCURITÉ</div>
              {['✅ Token HMAC-SHA256','✅ Anti double-scan','✅ 5 min expiration','✅ 1 repas/jour/type'].map(s=><div key={s} style={{ marginBottom:3 }}>{s}</div>)}
            </div>
          </div>

          {/* QR affiché */}
          <div style={{ background:'var(--surface)', border:`2px solid ${qrImage?repas_selected?.color:'var(--border)'}`, borderRadius:12, padding:20, textAlign:'center' }}>
            {qrImage ? (
              <>
                <div style={{ fontWeight:600, color:'var(--blue)', marginBottom:8 }}>{repas_selected?.label}</div>
                <img src={`data:image/png;base64,${qrImage}`} alt="QR Code"
                  style={{ width:180, height:180, borderRadius:8, margin:'0 auto 12px', display:'block', border:'2px solid var(--border)' }}/>
                <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:700, color:secColor }}>{mins}:{String(secs).padStart(2,'0')}</div>
                <div style={{ fontSize:11, color:'var(--text-dim)', marginBottom:8 }}>restantes</div>
                <div style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-dim)', background:'var(--surface2)', borderRadius:6, padding:'6px 10px', wordBreak:'break-all' }}>
                  {qrData?.token}
                </div>
              </>
            ) : (
              <div style={{ padding:40, color:'var(--text-dim)' }}>
                <div style={{ fontSize:60, marginBottom:12 }}>🍴</div>
                <div style={{ fontSize:13 }}>Sélectionner un personnel et générer le QR</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: SCANNER */}
      {tab==='scanner' && (
        <div style={{ maxWidth:480, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:24 }}>
          <div style={{ fontWeight:600, fontSize:15, color:'var(--blue)', marginBottom:14 }}>📱 Scanner un QR Code</div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Token QR</label>
            <input value={scanInput} onChange={e=>setScanInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&scanner()}
              placeholder="Coller ou taper le token ici..."
              style={{ ...inp, fontFamily:'monospace', fontSize:12 }}/>
          </div>
          <button onClick={scanner} style={{ width:'100%', background:'var(--blue)', color:'#fff', border:'none', padding:'10px', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600 }}>
            ✅ Valider repas
          </button>
          {scanMsg && (
            <div style={{ marginTop:12, background:scanMsg.ok?'rgba(22,163,74,.1)':'rgba(220,38,38,.1)',
              border:`1px solid ${scanMsg.ok?'rgba(22,163,74,.3)':'rgba(220,38,38,.3)'}`,
              borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:600,
              color:scanMsg.ok?'var(--libre)':'var(--occupe)' }}>
              {scanMsg.msg}
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTORIQUE */}
      {tab==='historique' && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:600, color:'var(--blue)' }}>Journal {repas_selected?.label} — {new Date().toLocaleDateString('fr-FR')}</div>
            <span style={{ background:repas_selected?.color, color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:700 }}>{repasLog.length} repas</span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr style={{ background:'var(--surface2)' }}>
                {['Heure','Résident','Résidence','Repas','Validé par'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repasLog.length===0
                ? <tr><td colSpan={5} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun repas enregistré</td></tr>
                : repasLog.map(r=>(
                  <tr key={r.id} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{ padding:'9px 14px', fontWeight:600 }}>{r.resident}</td>
                    <td style={{ padding:'9px 14px' }}>{r.residence||'—'}</td>
                    <td style={{ padding:'9px 14px' }}><span style={{ background:`${REPAS.find(x=>x.key===r.type_repas)?.color||'#666'}20`, color:REPAS.find(x=>x.key===r.type_repas)?.color||'#666', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{r.type_repas_label}</span></td>
                    <td style={{ padding:'9px 14px', fontSize:11, color:'var(--text-dim)' }}>{r.valide_par_nom}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
