import React, { useEffect, useState } from 'react'
import { batiments } from '../api'

const badge = { Libre:'libre', 'Occupé':'occupe', 'Réservé':'reserve', Maintenance:'maintenance' }
const bcolor = { Libre:'#22c55e', 'Occupé':'#ef4444', 'Réservé':'#3b82f6', Maintenance:'#f97316' }

export default function Residences() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [bloc, setBloc] = useState('')
  const [blocs, setBlocs] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ statut:'Libre', occupant:'', societe:'' })

  const load = () => {
    setLoading(true)
    const p = {}
    if (search) p.search = search
    if (statut) p.statut = statut
    if (bloc) p.bloc = bloc
    batiments.list(p).then(r => {
      setData(r.data.results || r.data)
      const b = [...new Set((r.data.results || r.data).map(x => x.bloc))].sort()
      setBlocs(b)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, statut, bloc])

  const openEdit = (b) => { setModal(b); setForm({ statut:b.statut, occupant:b.occupant||'', societe:b.societe||'' }) }
  const save = async () => {
    await batiments.update(modal.id, form)
    setModal(null); load()
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700 }}>🏠 Gestion des Résidences</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>204 bâtiments · 19 blocs · Camp RZI</p>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..."
          style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:7, fontSize:13, outline:'none', width:200 }}/>
        <select value={statut} onChange={e=>setStatut(e.target.value)}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:7, fontSize:12, outline:'none' }}>
          <option value="">Tous statuts</option>
          <option>Libre</option><option>Occupé</option><option>Réservé</option><option>Maintenance</option>
        </select>
        <select value={bloc} onChange={e=>setBloc(e.target.value)}
          style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:7, fontSize:12, outline:'none' }}>
          <option value="">Tous blocs</option>
          {blocs.map(b => <option key={b}>{b}</option>)}
        </select>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'var(--surface2)' }}>
              {['Résidence','Bloc','Statut','Occupant','Société','Actions'].map(h => (
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding:20, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</td></tr>
            ) : data.map(b => (
              <tr key={b.id} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 16px', fontFamily:'monospace', fontWeight:700 }}>{b.residence}</td>
                <td style={{ padding:'10px 16px' }}>{b.bloc}</td>
                <td style={{ padding:'10px 16px' }}>
                  <span style={{ background:`${bcolor[b.statut]}22`, color:bcolor[b.statut], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>{b.statut}</span>
                </td>
                <td style={{ padding:'10px 16px', color: b.occupant ? 'var(--text)' : 'var(--text-dim)' }}>{b.occupant || '—'}</td>
                <td style={{ padding:'10px 16px', color: b.societe ? 'var(--text)' : 'var(--text-dim)' }}>{b.societe || '—'}</td>
                <td style={{ padding:'10px 16px' }}>
                  <button onClick={() => openEdit(b)}
                    style={{ background:'var(--accent)', color:'#000', border:'none', padding:'4px 10px', borderRadius:5, cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:420, maxWidth:'95vw' }}>
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <h3 style={{ fontSize:16 }}>Modifier — {modal.residence}</h3>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'none', color:'var(--text-dim)', borderRadius:6, cursor:'pointer', width:28, height:28 }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              {[['Statut','statut','select',['Libre','Occupé','Réservé','Maintenance']],['Occupant','occupant','text'],['Société','societe','text']].map(([l,k,t,opts]) => (
                <div key={k} style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                  {t === 'select'
                    ? <select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none' }}>
                        {opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    : <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}
                        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
                  }
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={save} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'8px 16px', borderRadius:7, cursor:'pointer', fontSize:13, fontWeight:500 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
