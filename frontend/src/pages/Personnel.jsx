import React, { useEffect, useState } from 'react'
import { personnel as personnelAPI } from '../api'

const TYPE_COLORS = {
  roxgold: { bg:'rgba(240,165,0,.15)', color:'#f0a500' },
  sous_traitant: { bg:'rgba(59,130,246,.15)', color:'#3b82f6' },
  visiteur: { bg:'rgba(168,85,247,.15)', color:'#a855f7' },
}
const TYPE_LABELS = { roxgold:'Agent Roxgold', sous_traitant:'Sous-traitant', visiteur:'Visiteur' }

const inp = { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)',
  color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none',
  marginBottom:0, fontFamily:'inherit' }

export default function Personnel() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState(null) // null | 'create' | 'edit' | 'qr'
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ nom:'', prenom:'', societe:'ROXGOLD', numero:'', type_personnel:'roxgold', email:'' })

  const load = () => {
    setLoading(true)
    const p = {}
    if (search) p.search = search
    if (typeFilter) p.type_personnel = typeFilter
    personnelAPI.list(p).then(r => setData(r.data.results||r.data)).finally(()=>setLoading(false))
  }

  useEffect(()=>{ load() }, [search, typeFilter])

  const openCreate = () => {
    setForm({ nom:'', prenom:'', societe:'ROXGOLD', numero:'', type_personnel:'roxgold', email:'' })
    setModal('create')
  }
  const openEdit = (p) => { setSelected(p); setForm({nom:p.nom,prenom:p.prenom,societe:p.societe,numero:p.numero,type_personnel:p.type_personnel,email:p.email||''}); setModal('edit') }
  const openQR = (p) => { setSelected(p); setModal('qr') }

  const save = async () => {
    if (!form.nom||!form.prenom||!form.societe) return alert('Nom, Prénom et Société obligatoires')
    if (modal==='create') await personnelAPI.create(form)
    else await personnelAPI.update(selected.id, form)
    setModal(null); load()
  }

  const del = async (id) => {
    if (!window.confirm('Supprimer ce membre ?')) return
    await personnelAPI.delete(id); load()
  }

  const regenQR = async (id) => {
    const r = await personnelAPI.regenererQr(id)
    setSelected(r.data); load()
  }

  const typeCount = { roxgold:0, sous_traitant:0, visiteur:0 }
  data.forEach(p => typeCount[p.type_personnel] = (typeCount[p.type_personnel]||0)+1)

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700 }}>👤 Gestion du Personnel</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>Agents Roxgold · Sous-traitants · Visiteurs</p>
        </div>
        <button onClick={openCreate} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          + Déclarer un membre
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Agent Roxgold','roxgold',data.filter(p=>p.type_personnel==='roxgold').length],
          ['Sous-traitants','sous_traitant',data.filter(p=>p.type_personnel==='sous_traitant').length],
          ['Visiteurs','visiteur',data.filter(p=>p.type_personnel==='visiteur').length]].map(([l,t,n])=>(
          <div key={t} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:14,
            borderTop:`3px solid ${TYPE_COLORS[t].color}`, cursor:'pointer', transition:'.2s',
            outline: typeFilter===t?`2px solid ${TYPE_COLORS[t].color}`:'none' }}
            onClick={()=>setTypeFilter(typeFilter===t?'':t)}>
            <div style={{ fontFamily:'monospace', fontSize:26, fontWeight:700, color:TYPE_COLORS[t].color }}>{n}</div>
            <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher nom, société..."
          style={{ ...inp, marginBottom:0, width:220 }}/>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:7, fontSize:12, outline:'none' }}>
          <option value="">Tous types</option>
          <option value="roxgold">Agent Roxgold</option>
          <option value="sous_traitant">Sous-traitant</option>
          <option value="visiteur">Visiteur</option>
        </select>
        {(search||typeFilter) && <button onClick={()=>{setSearch('');setTypeFilter('')}}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'7px 12px', borderRadius:7, fontSize:12, cursor:'pointer' }}>✕ Reset</button>}
      </div>

      {/* Table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'var(--surface2)' }}>
              {['Nom & Prénom','Société','Type','Téléphone','QR Code','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</td></tr>
            ) : data.length===0 ? (
              <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun membre déclaré</td></tr>
            ) : data.map(p=>(
              <tr key={p.id} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ fontWeight:600 }}>{p.nom} {p.prenom}</div>
                  {p.email && <div style={{ fontSize:11, color:'var(--text-dim)' }}>{p.email}</div>}
                </td>
                <td style={{ padding:'10px 14px' }}>{p.societe}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:TYPE_COLORS[p.type_personnel]?.bg, color:TYPE_COLORS[p.type_personnel]?.color,
                    padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                    {TYPE_LABELS[p.type_personnel]||p.type_personnel}
                  </span>
                </td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12 }}>{p.numero||'—'}</td>
                <td style={{ padding:'10px 14px' }}>
                  <button onClick={()=>openQR(p)}
                    style={{ background:'rgba(240,165,0,.15)', color:'var(--accent)', border:'1px solid rgba(240,165,0,.3)',
                      padding:'3px 10px', borderRadius:5, cursor:'pointer', fontSize:11 }}>
                    📱 Voir QR
                  </button>
                </td>
                <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                  <button onClick={()=>openEdit(p)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'4px 10px', borderRadius:5, cursor:'pointer', fontSize:11 }}>✏️</button>
                  <button onClick={()=>del(p.id)} style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', color:'#ef4444', padding:'4px 10px', borderRadius:5, cursor:'pointer', fontSize:11 }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM */}
      {(modal==='create'||modal==='edit') && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:460, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3>{modal==='create'?'👤 Déclarer un membre':'✏️ Modifier le membre'}</h3>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'none', color:'var(--text-dim)', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Nom *','nom'],['Prénom *','prenom'],['Société *','societe'],['N° Téléphone','numero'],['Email','email']].map(([l,k])=>(
                <div key={k} style={{ gridColumn: k==='email'?'span 2':'auto' }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                  <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/>
                </div>
              ))}
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Type *</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[['roxgold','Agent Roxgold'],['sous_traitant','Sous-traitant'],['visiteur','Visiteur']].map(([v,l])=>(
                    <button key={v} onClick={()=>setForm({...form,type_personnel:v})}
                      style={{ flex:1, padding:'8px 6px', borderRadius:7, border:`2px solid ${form.type_personnel===v?TYPE_COLORS[v].color:'var(--border)'}`,
                        background: form.type_personnel===v?TYPE_COLORS[v].bg:'var(--surface2)',
                        color: form.type_personnel===v?TYPE_COLORS[v].color:'var(--text-dim)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding:'12px 24px 20px', background:'rgba(240,165,0,.05)', borderRadius:'0 0 8px 8px', fontSize:11, color:'var(--text-dim)' }}>
              📱 Un QR Code unique sera généré automatiquement : <b style={{color:'var(--text)'}}>Nom | Prénom | Société | Téléphone</b>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={save} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {modal==='create'?'Déclarer & Générer QR':'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR */}
      {modal==='qr' && selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:380, maxWidth:'95vw', padding:30, textAlign:'center' }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>{selected.nom} {selected.prenom}</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:16 }}>{selected.societe} · {TYPE_LABELS[selected.type_personnel]}</div>
            {selected.qr_code_data
              ? <img src={`data:image/png;base64,${selected.qr_code_data}`} alt="QR Code"
                  style={{ width:200, height:200, borderRadius:8, background:'#fff', padding:8, margin:'0 auto 16px', display:'block' }}/>
              : <div style={{ width:200, height:200, background:'var(--surface2)', borderRadius:8, margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)' }}>Pas de QR</div>
            }
            <div style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 12px', fontSize:11, fontFamily:'monospace', color:'var(--text-dim)', marginBottom:16, wordBreak:'break-all' }}>
              {selected.qr_code_string}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              <button onClick={()=>regenQR(selected.id)} style={{ background:'rgba(240,165,0,.15)', color:'var(--accent)', border:'1px solid rgba(240,165,0,.3)', padding:'7px 14px', borderRadius:7, cursor:'pointer', fontSize:12 }}>🔄 Régénérer QR</button>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 14px', borderRadius:7, cursor:'pointer', fontSize:12 }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
