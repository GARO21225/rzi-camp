import React, { useEffect, useState } from 'react'
import { incidents, batiments as batAPI } from '../api'

const pColor = { haute:'var(--occupe)', moyenne:'var(--maintenance)', basse:'var(--reserve)' }
const sColor = { 'Ouvert':'var(--occupe)', 'En cours':'var(--maintenance)', 'Résolu':'var(--libre)' }

export default function Maintenance() {
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [modal, setModal] = useState(false)
  const [bats, setBats] = useState([])
  const [form, setForm] = useState({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'' })

  const load = () => {
    incidents.list().then(r => setData(r.data.results || r.data))
    incidents.stats().then(r => setStats(r.data))
    batAPI.list({ page_size:300 }).then(r => setBats(r.data.results || r.data))
  }
  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.titre || !form.description || !form.residence) return alert('Champs obligatoires manquants')
    await incidents.create(form)
    setModal(false); load()
  }

  const resoudre = async (id) => {
    await incidents.resoudre(id); load()
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700 }}>🛠️ Maintenance Industrielle</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>Photo GPS obligatoire · Traçabilité complète</p>
        </div>
        <button onClick={()=>setModal(true)} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:500 }}>
          + Signaler incident
        </button>
      </div>

      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[['Total',stats.total,'var(--accent)'],['Ouverts',stats.ouverts,'var(--occupe)'],['En cours',stats.en_cours,'var(--maintenance)'],['Résolus',stats.resolus,'var(--libre)']].map(([l,v,c]) => (
            <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:14, borderTop:`3px solid ${c}` }}>
              <div style={{ fontFamily:'monospace', fontSize:24, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {data.map(inc => (
        <div key={inc.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:12, display:'flex', gap:14 }}>
          <div style={{ width:40, height:40, borderRadius:8, background:`${pColor[inc.priorite]}22`,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
            {inc.categorie === 'Plomberie' ? '🚿' : inc.categorie === 'Électricité' ? '⚡' : '🔧'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, fontSize:13 }}>{inc.titre}</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:2 }}>{inc.description}</div>
            <div style={{ display:'flex', gap:12, marginTop:6, fontSize:11, color:'var(--text-dim)', flexWrap:'wrap' }}>
              <span>📍 {inc.residence}</span>
              <span>👤 {inc.auteur_nom}</span>
              <span>🕐 {new Date(inc.date_creation).toLocaleString('fr-FR')}</span>
              <span style={{ color:'var(--accent)' }}>📸 Photo obligatoire</span>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }}>
            <span style={{ background:`${sColor[inc.statut]}22`, color:sColor[inc.statut], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>{inc.statut}</span>
            <span style={{ fontSize:10, color:pColor[inc.priorite], fontFamily:'monospace', letterSpacing:1 }}>{inc.priorite?.toUpperCase()}</span>
            {inc.statut !== 'Résolu' && (
              <button onClick={() => resoudre(inc.id)} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'4px 10px', borderRadius:5, cursor:'pointer', fontSize:11 }}>Résoudre</button>
            )}
          </div>
        </div>
      ))}

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:460, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontSize:16 }}>🛠️ Signaler un incident</h3>
              <button onClick={()=>setModal(false)} style={{ background:'var(--surface2)', border:'none', color:'var(--text-dim)', borderRadius:6, cursor:'pointer', width:28, height:28 }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'10px 12px', fontSize:12, marginBottom:16 }}>
                📸 Photo obligatoire · 📍 GPS automatique · ⏱️ Horodatage système
              </div>
              {[['Titre','titre','text'],['Résidence','residence','select-bat'],['Catégorie','categorie','select-cat'],['Priorité','priorite','select-prio'],['Description','description','textarea']].map(([l,k,t]) => (
                <div key={k} style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                  {t === 'textarea'
                    ? <textarea value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} rows={3}
                        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit', resize:'vertical' }}/>
                    : t === 'select-bat'
                    ? <select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none' }}>
                        <option value="">Choisir...</option>
                        {bats.map(b => <option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                      </select>
                    : t === 'select-cat'
                    ? <select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none' }}>
                        {['Plomberie','Électricité','Serrurerie','Climatisation','Toiture','Autre'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    : t === 'select-prio'
                    ? <select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none' }}>
                        <option value="haute">🔴 Haute</option><option value="moyenne">🟠 Moyenne</option><option value="basse">🔵 Basse</option>
                      </select>
                    : <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
                  }
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(false)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={submit} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:500 }}>Signaler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
