
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
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'
  const isResto = user?.profile?.role === 'restauration'
  const canSeeAll = isAdmin || isResto

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [tab, setTab] = useState(canSeeAll ? 'scanner' : 'mon_historique')
  const [scanInput, setScanInput] = useState('')
  const [scanMsg, setScanMsg] = useState(null)
  const [myQR, setMyQR] = useState(null)
  const [stats, setStats] = useState({ petit_dejeuner:0, dejeuner:0, diner:0 })

  const loadRepas = () => {
    const p = { page_size:100 }
    if (!canSeeAll && user?.profile?.role) {
      // non-admin/resto: filtered by backend
    }
    p.type_repas = typeRepas
    qr.repas(p).then(r => {
      const items = r.data.results||r.data
      setRepasLog(items)
      // Count today
      const today = new Date().toISOString().slice(0,10)
      const todayItems = items.filter(x => x.date_validation?.startsWith(today))
      setStats(prev => ({ ...prev, [typeRepas]: todayItems.length }))
    })
    // Get my QR if I'm regular user
    if (!canSeeAll) {
      personnelAPI.list({ page_size:1 }).then(r => {
        const me = (r.data.results||r.data).find(p => p.login_genere === user?.username)
        if (me) setMyQR(me)
      })
    }
  }

  useEffect(() => { loadRepas() }, [typeRepas])

  const scanner = async () => {
    const input = scanInput.trim()
    if (!input) return
    try {
      const r = await qr.scanner({ qr_data: input, type_repas: typeRepas })
      setScanMsg({ ok:true, msg:`✅ ${r.data.resident} — ${r.data.type_repas} validé`, data:r.data })
      setScanInput('')
      loadRepas()
    } catch(e) {
      setScanMsg({ ok:false, msg:`❌ ${e.response?.data?.erreur||'Erreur'}` })
      setScanInput('')
    }
    setTimeout(() => setScanMsg(null), 5000)
  }

  const repas_selected = REPAS.find(r=>r.key===typeRepas)
  const today = new Date().toISOString().slice(0,10)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)', marginBottom:4 }}>🍽️ Module Restauration</h2>
      <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:16 }}>
        {canSeeAll ? 'Vue globale · 3 repas · Historisation complète' : 'Mon espace repas · QR de déclaration'}
      </p>

      {/* Sélection repas */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        {REPAS.map(r=>(
          <button key={r.key} onClick={()=>setTypeRepas(r.key)}
            style={{ flex:1, padding:'12px 8px', borderRadius:10, border:`2px solid ${typeRepas===r.key?r.color:'var(--border)'}`,
              background:typeRepas===r.key?`${r.color}15`:'#fff', cursor:'pointer', boxShadow:'var(--shadow)',
              color:typeRepas===r.key?r.color:'var(--text-dim)', fontWeight:600, fontSize:13, transition:'.2s' }}>
            {r.label}<br/><span style={{ fontSize:11, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs selon rôle */}
      <div style={{ display:'flex', gap:2, marginBottom:16, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {canSeeAll && [['scanner','📱 Scanner QR'],['vue_ensemble','📋 Vue d\'ensemble'],['historique','📊 Historique']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none', transition:'.2s' }}>
            {l}
          </button>
        ))}
        {!canSeeAll && [['mon_qr','📱 Mon QR'],['mon_historique','📋 Mes repas']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none', transition:'.2s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* SCANNER (Resto/Admin) */}
      {tab==='scanner' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:24, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)', marginBottom:16 }}>
              📱 Scanner QR {repas_selected?.label}
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Contenu QR du mangeur</label>
              <input value={scanInput} onChange={e=>setScanInput(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&scanner()} autoFocus
                placeholder="Scanner ou coller le contenu QR..."
                style={{ width:'100%', background:'var(--surface2)', border:'2px solid var(--border)', color:'var(--text)', padding:'10px 14px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'monospace' }}/>
            </div>
            <button onClick={scanner} style={{ width:'100%', background:'var(--blue)', color:'#fff', border:'none', padding:'11px', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:700 }}>
              ✅ Valider le repas
            </button>
            {scanMsg && (
              <div style={{ marginTop:12, background:scanMsg.ok?'rgba(22,163,74,.1)':'rgba(220,38,38,.1)',
                border:`1px solid ${scanMsg.ok?'rgba(22,163,74,.3)':'rgba(220,38,38,.3)'}`,
                borderRadius:10, padding:'12px 16px', fontSize:13, fontWeight:700,
                color:scanMsg.ok?'#16a34a':'#dc2626' }}>
                {scanMsg.msg}
                {scanMsg.ok && scanMsg.data && (
                  <div style={{ fontSize:11, fontWeight:400, marginTop:4, color:'var(--text-dim)' }}>
                    {scanMsg.data.societe} · {scanMsg.data.type_personnel}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop:16, background:'var(--surface2)', borderRadius:8, padding:12, fontSize:11 }}>
              <b>Comment ça marche :</b><br/>
              L'agent montre son QR de déclaration · Le restaurant scanne · Validation automatique
            </div>
          </div>

          {/* Today stats */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:24, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)', marginBottom:16 }}>📊 Aujourd'hui</div>
            <div style={{ fontFamily:'monospace', fontSize:48, fontWeight:700, color:repas_selected?.color, textAlign:'center', marginBottom:8 }}>
              {todayLog.length}
            </div>
            <div style={{ textAlign:'center', fontSize:13, color:'var(--text-dim)', marginBottom:20 }}>repas {repas_selected?.label} validés</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {todayLog.slice(0,6).map(r=>(
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'var(--surface2)', borderRadius:8, fontSize:12 }}>
                  <span style={{ fontWeight:600 }}>{r.resident}</span>
                  <span style={{ color:'var(--text-dim)', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
              {todayLog.length > 6 && <div style={{ textAlign:'center', fontSize:11, color:'var(--text-dim)' }}>+{todayLog.length-6} autres</div>}
            </div>
          </div>
        </div>
      )}

      {/* VUE D'ENSEMBLE (Admin/Resto) */}
      {tab==='vue_ensemble' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
            {REPAS.map(r=>(
              <div key={r.key} style={{ background:'#fff', border:`2px solid ${r.color}`, borderRadius:12, padding:16, textAlign:'center', boxShadow:'var(--shadow)' }}>
                <div style={{ fontSize:24, marginBottom:4 }}>{r.label.split(' ')[0]}</div>
                <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:700, color:r.color }}>
                  {repasLog.filter(x=>x.type_repas===r.key&&x.date_validation?.startsWith(today)).length}
                </div>
                <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>{r.label.split(' ')[1]}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
            <div style={{ padding:'14px 18px', background:'var(--blue)', color:'#fff', fontWeight:600 }}>
              Tous les repas — {new Date().toLocaleDateString('fr-FR')}
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:'var(--surface2)' }}>
                {['Heure','Résident','Résidence','Repas','Validé par'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {repasLog.filter(r=>r.date_validation?.startsWith(today)).map((r,i)=>(
                  <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                    <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{ padding:'9px 14px', fontWeight:600 }}>{r.resident}</td>
                    <td style={{ padding:'9px 14px' }}>{r.residence||'—'}</td>
                    <td style={{ padding:'9px 14px' }}><span style={{ background:`${REPAS.find(x=>x.key===r.type_repas)?.color||'#666'}20`, color:REPAS.find(x=>x.key===r.type_repas)?.color||'#666', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{r.type_repas_label}</span></td>
                    <td style={{ padding:'9px 14px', fontSize:11, color:'var(--text-dim)' }}>{r.valide_par_nom}</td>
                  </tr>
                ))}
                {repasLog.filter(r=>r.date_validation?.startsWith(today)).length===0 && (
                  <tr><td colSpan={5} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun repas aujourd'hui</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HISTORIQUE GLOBAL */}
      {tab==='historique' && (
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <div style={{ padding:'14px 18px', background:'var(--blue)', color:'#fff', fontWeight:600 }}>Historique complet — {repas_selected?.label}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr style={{ background:'var(--surface2)' }}>
              {['Date','Heure','Résident','Résidence','Validé par'].map(h=>(
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {repasLog.map((r,i)=>(
                <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleDateString('fr-FR')}</td>
                  <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{ padding:'9px 14px', fontWeight:600 }}>{r.resident}</td>
                  <td style={{ padding:'9px 14px' }}>{r.residence||'—'}</td>
                  <td style={{ padding:'9px 14px', fontSize:11, color:'var(--text-dim)' }}>{r.valide_par_nom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MON QR (utilisateur normal) */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:360, margin:'0 auto', background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:28, textAlign:'center', boxShadow:'var(--shadow)' }}>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--blue)', marginBottom:4 }}>Mon QR de déclaration</div>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:16 }}>Présentez ce QR au restaurant pour valider votre repas</div>
          {myQR?.qr_code_data
            ? <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                style={{ width:200, height:200, borderRadius:8, border:'3px solid var(--border)', margin:'0 auto 16px', display:'block' }}/>
            : <div style={{ width:200, height:200, background:'var(--surface2)', borderRadius:8, margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)', fontSize:13 }}>QR non disponible</div>
          }
          <div style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 12px', fontSize:11, fontFamily:'monospace', color:'var(--text-dim)', marginBottom:14 }}>
            {myQR?.qr_code_string}
          </div>
        </div>
      )}

      {/* MON HISTORIQUE (utilisateur normal) */}
      {tab==='mon_historique' && (
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <div style={{ padding:'14px 18px', background:'var(--blue)', color:'#fff', fontWeight:600 }}>Mes repas — {repas_selected?.label}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr style={{ background:'var(--surface2)' }}>
              {['Date','Heure','Repas'].map(h=>(
                <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {repasLog.length===0
                ? <tr><td colSpan={3} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun repas enregistré</td></tr>
                : repasLog.map((r,i)=>(
                  <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                    <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleDateString('fr-FR')}</td>
                    <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{ padding:'9px 14px' }}><span style={{ background:`${REPAS.find(x=>x.key===r.type_repas)?.color||'#666'}20`, color:REPAS.find(x=>x.key===r.type_repas)?.color||'#666', padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>{r.type_repas_label}</span></td>
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
