import React, { useEffect, useState } from 'react'
import { batiments, personnel as personnelAPI } from '../api'

const bcolor = { Libre:'#22c55e', 'Occupé':'#ef4444', 'Réservé':'#3b82f6', Maintenance:'#f97316' }

export default function Residences() {
  const [data, setData] = useState([])
  const [personnelList, setPersonnelList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [bloc, setBloc] = useState('')
  const [blocs, setBlocs] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ statut:'Libre', personnel: '', occupant:'', societe:'', date_affectation:'' })

  const load = () => {
    setLoading(true)
    const p = {}
    if (search) p.search = search
    if (statut) p.statut = statut
    if (bloc) p.bloc = bloc
    batiments.list(p).then(r => {
      const items = r.data.results||r.data
      setData(items)
      const b = [...new Set(items.map(x=>x.bloc))].sort()
      setBlocs(b)
    }).finally(()=>setLoading(false))
    personnelAPI.list({page_size:500}).then(r=>setPersonnelList(r.data.results||r.data))
  }

  useEffect(()=>{load()},[search,statut,bloc])

  const openEdit = (b) => {
    setModal(b)
    setForm({ statut:b.statut, personnel:b.personnel||'', occupant:b.occupant||'', societe:b.societe||'', date_affectation:b.date_affectation||'' })
  }

  const save = async () => {
    const payload = { statut: form.statut }
    if (form.personnel) {
      payload.personnel = form.personnel
      const p = personnelList.find(x=>x.id==form.personnel)
      if (p) { payload.occupant = `${p.nom} ${p.prenom}`; payload.societe = p.societe }
    } else {
      payload.personnel = null
      payload.occupant = form.occupant
      payload.societe = form.societe
    }
    if (form.date_affectation) payload.date_affectation = form.date_affectation
    await batiments.update(modal.id, payload)
    setModal(null); load()
  }

  const handleExportCsv = () => {
    const p = {}
    if (statut) p.statut = statut
    if (bloc) p.bloc = bloc
    window.open(batiments.exportCsv(p), '_blank')
  }
  const handleExportBlocs = () => window.open(batiments.exportBlocs(), '_blank')

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700 }}>🏠 Gestion des Résidences</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>204 bâtiments · 19 blocs · Camp RZI</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={handleExportCsv} style={{ background:'rgba(34,197,94,.12)', color:'var(--libre)', border:'1px solid rgba(34,197,94,.3)', padding:'7px 14px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            ⬇ Export CSV
          </button>
          <button onClick={handleExportBlocs} style={{ background:'rgba(59,130,246,.12)', color:'var(--reserve)', border:'1px solid rgba(59,130,246,.3)', padding:'7px 14px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            ⬇ Rapport Blocs
          </button>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Résidence, occupant..."
          style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:7, fontSize:13, outline:'none', width:200 }}/>
        <select value={statut} onChange={e=>setStatut(e.target.value)}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:7, fontSize:12, outline:'none' }}>
          <option value="">Tous statuts</option>
          <option value="Libre">🟢 Libre</option>
          <option value="Occupé">🔴 Occupé</option>
          <option value="Réservé">🔵 Réservé</option>
          <option value="Maintenance">🟠 Maintenance</option>
        </select>
        <select value={bloc} onChange={e=>setBloc(e.target.value)}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:7, fontSize:12, outline:'none' }}>
          <option value="">Tous blocs</option>
          {blocs.map(b=><option key={b}>{b}</option>)}
        </select>
        <div style={{ marginLeft:'auto', fontSize:12, color:'var(--text-dim)', display:'flex', alignItems:'center' }}>
          {data.length} résidences
        </div>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'var(--surface2)' }}>
              {['Résidence','Bloc','Statut','Occupant','Société','Date affectation','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</td></tr>
            : data.map(b=>(
              <tr key={b.id} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700 }}>{b.residence}</td>
                <td style={{ padding:'10px 14px' }}>{b.bloc}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:`${bcolor[b.statut]}22`, color:bcolor[b.statut], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>{b.statut}</span>
                </td>
                <td style={{ padding:'10px 14px', color:b.occupant?'var(--text)':'var(--text-dim)' }}>
                  {b.personnel_detail ? `${b.personnel_detail.nom} ${b.personnel_detail.prenom}` : (b.occupant||'—')}
                </td>
                <td style={{ padding:'10px 14px', color:b.societe?'var(--text)':'var(--text-dim)' }}>
                  {b.personnel_detail?.societe || b.societe || '—'}
                </td>
                <td style={{ padding:'10px 14px', fontSize:11, color:'var(--text-dim)' }}>{b.date_affectation||'—'}</td>
                <td style={{ padding:'10px 14px' }}>
                  <button onClick={()=>openEdit(b)} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'4px 10px', borderRadius:5, cursor:'pointer', fontSize:11, fontFamily:'inherit', fontWeight:600 }}>Modifier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:460, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3>Modifier — Résidence {modal.residence}</h3>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'none', color:'var(--text-dim)', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Statut</label>
                <div style={{ display:'flex', gap:8 }}>
                  {['Libre','Occupé','Réservé','Maintenance'].map(s=>(
                    <button key={s} onClick={()=>setForm({...form,statut:s})}
                      style={{ flex:1, padding:'7px 4px', borderRadius:7, border:`2px solid ${form.statut===s?bcolor[s]:'var(--border)'}`,
                        background:form.statut===s?`${bcolor[s]}22`:'var(--surface2)',
                        color:form.statut===s?bcolor[s]:'var(--text-dim)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>
                  Affecter au personnel déclaré
                </label>
                <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})}
                  style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none' }}>
                  <option value="">— Sélectionner un membre —</option>
                  {personnelList.map(p=>(
                    <option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe} ({p.type_label})</option>
                  ))}
                </select>
              </div>

              {!form.personnel && (
                <>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Occupant (manuel)</label>
                    <input value={form.occupant} onChange={e=>setForm({...form,occupant:e.target.value})}
                      style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Société</label>
                    <input value={form.societe} onChange={e=>setForm({...form,societe:e.target.value})}
                      style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
                  </div>
                </>
              )}

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Date d'affectation</label>
                <input type="date" value={form.date_affectation} onChange={e=>setForm({...form,date_affectation:e.target.value})}
                  style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
              </div>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={save} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:600 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
