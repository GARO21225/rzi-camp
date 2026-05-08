import React, { useEffect, useState } from 'react'
import { batiments, personnel as personnelAPI } from '../api'

const bcolor = { Libre:'#16a34a', 'Occupé':'#dc2626', 'Réservé':'#2563eb', Maintenance:'#ea580c' }
const today = new Date().toISOString().slice(0,10)

export default function Residences() {
  const [data, setData] = useState([])
  const [personnelList, setPersonnelList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [bloc, setBloc] = useState('')
  const [blocs, setBlocs] = useState([])
  const [futurDepart, setFuturDepart] = useState(false)
  const [modal, setModal] = useState(null)
  const [histModal, setHistModal] = useState(null)
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({ statut:'Libre', personnel:'', occupant:'', societe:'', date_arrivee:'', date_depart:'' })

  const load = () => {
    setLoading(true)
    const p = {}
    if (search) p.search = search
    if (statut) p.statut = statut
    if (bloc) p.bloc = bloc
    if (futurDepart) p.futur_depart = 's1'
    batiments.list(p).then(r=>{
      const items = r.data.results||r.data
      setData(items)
      const b=[...new Set(items.map(x=>x.bloc))].sort()
      setBlocs(b)
    }).finally(()=>setLoading(false))
    personnelAPI.list({page_size:500}).then(r=>setPersonnelList(r.data.results||r.data))
  }

  useEffect(()=>{load()},[search,statut,bloc,futurDepart])

  const openEdit = (b) => {
    setModal(b)
    setForm({ statut:b.statut, personnel:b.personnel||'', occupant:b.occupant||'', societe:b.societe||'',
      date_arrivee:b.date_arrivee||today, date_depart:b.date_depart||'' })
  }

  const openHistory = async (b) => {
    setHistModal(b)
    const r = await batiments.history(b.residence)
    setHistory(r.data.results||r.data)
  }

  const save = async () => {
    try {
      const payload = {
        statut: form.statut,
        date_arrivee: form.date_arrivee || null,
        date_depart: form.date_depart || null,
      }
      if (form.personnel && form.personnel !== '') {
        payload.personnel = parseInt(form.personnel)
        const p = personnelList.find(x => x.id == form.personnel)
        if (p) {
          payload.occupant = `${p.nom} ${p.prenom}`
          payload.societe = p.societe
        }
      } else {
        payload.personnel = null
        payload.occupant = form.occupant || null
        payload.societe = form.societe || null
      }
      await batiments.update(modal.id, payload)
      setModal(null)
      load()
    } catch(e) {
      alert('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    }
  }

  const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%', transition:'.2s' }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)' }}>🏠 Gestion des Résidences</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>204 bâtiments · 19 blocs · Camp RZI</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <a href={batiments.exportCsv({})} style={{ background:'#16a34a', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
            ⬇ Export CSV
          </a>
          <a href={batiments.exportBlocs()} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
            ⬇ Rapport Blocs
          </a>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Résidence, occupant..."
          style={{ ...inp, width:200 }}/>
        <select value={statut} onChange={e=>setStatut(e.target.value)} style={{ ...inp, width:'auto' }}>
          <option value="">Tous statuts</option>
          <option value="Libre">🟢 Libre</option>
          <option value="Occupé">🔴 Occupé</option>
          <option value="Réservé">🔵 Réservé</option>
          <option value="Maintenance">🟠 Maintenance</option>
        </select>
        <select value={bloc} onChange={e=>setBloc(e.target.value)} style={{ ...inp, width:'auto' }}>
          <option value="">Tous blocs</option>
          {blocs.map(b=><option key={b}>{b}</option>)}
        </select>
        <button onClick={()=>setFuturDepart(!futurDepart)}
          style={{ padding:'7px 14px', borderRadius:8, border:`1px solid ${futurDepart?'#dc2626':'var(--border)'}`,
            background:futurDepart?'rgba(220,38,38,.1)':'var(--surface2)', color:futurDepart?'#dc2626':'var(--text-dim)',
            cursor:'pointer', fontSize:12, fontWeight:futurDepart?700:400 }}>
          ✈️ Futur départ S-1{futurDepart?' ✓':''}
        </button>
        <div style={{ fontSize:12, color:'var(--text-dim)', display:'flex', alignItems:'center', background:'var(--surface2)', padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)' }}>
          {data.length} résidences
        </div>
      </div>

      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'var(--blue)' }}>
              {['Résidence','Bloc','Statut','Occupant','Société','Arrivée','Départ','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.85)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading?<tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</td></tr>
            :data.map((b,i)=>(
              <tr key={b.id} style={{ borderTop:'1px solid var(--border)', background:i%2===0?'#fff':'var(--surface2)' }}>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'var(--blue)' }}>{b.residence}</td>
                <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-dim)' }}>{b.bloc}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:`${bcolor[b.statut]}18`, color:bcolor[b.statut], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{b.statut}</span>
                </td>
                <td style={{ padding:'10px 14px', color:b.occupant?'var(--text)':'var(--text-dim)' }}>
                  {b.personnel_detail?`${b.personnel_detail.nom} ${b.personnel_detail.prenom}`:(b.occupant||'—')}
                </td>
                <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-dim)' }}>{b.personnel_detail?.societe||b.societe||'—'}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'var(--text-dim)' }}>{b.date_arrivee||'—'}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'var(--text-dim)' }}>{b.date_depart||'—'}</td>
                <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                  <button onClick={()=>openEdit(b)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>Modifier</button>
                  <button onClick={()=>openHistory(b)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}>📋</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL EDIT */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:500, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--shadow-md)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff' }}>🏠 Résidence {modal.residence} — {modal.bloc}</h3>
              <button onClick={()=>setModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Statut</label>
                <div style={{ display:'flex', gap:8 }}>
                  {['Libre','Occupé','Réservé','Maintenance'].map(s=>(
                    <button key={s} onClick={()=>setForm({...form,statut:s})}
                      style={{ flex:1, padding:'8px 4px', borderRadius:8, border:`2px solid ${form.statut===s?bcolor[s]:'var(--border)'}`,
                        background:form.statut===s?`${bcolor[s]}15`:'var(--surface2)', color:form.statut===s?bcolor[s]:'var(--text-dim)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Affecter au personnel déclaré</label>
                <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                  <option value="">— Saisie manuelle —</option>
                  {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe} ({p.type_label})</option>)}
                </select>
              </div>

              {!form.personnel && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Occupant</label>
                    <input value={form.occupant} onChange={e=>setForm({...form,occupant:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Société</label>
                    <input value={form.societe} onChange={e=>setForm({...form,societe:e.target.value})} style={inp}/>
                  </div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[['Date d\'arrivée','date_arrivee'],['Date de départ prévue','date_depart']].map(([l,k])=>(
                  <div key={k}>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                    <input type="date" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={save} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORIQUE */}
      {histModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:580, maxWidth:'95vw', maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-md)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff' }}>📋 Historique — Résidence {histModal.residence}</h3>
              <button onClick={()=>setHistModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', flex:1 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                <thead>
                  <tr style={{ background:'var(--surface2)', position:'sticky', top:0 }}>
                    {['Occupant','Société','Arrivée','Départ','Durée','Motif départ'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length===0
                    ? <tr><td colSpan={6} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun historique</td></tr>
                    : history.map(h=>{
                      const d1 = new Date(h.date_arrivee), d2 = h.date_depart?new Date(h.date_depart):new Date()
                      const days = Math.round((d2-d1)/(1000*60*60*24))
                      return (
                        <tr key={h.id} style={{ borderTop:'1px solid var(--border)' }}>
                          <td style={{ padding:'9px 14px', fontWeight:600 }}>{h.occupant_nom}</td>
                          <td style={{ padding:'9px 14px', fontSize:12, color:'var(--text-dim)' }}>{h.societe||'—'}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{h.date_arrivee}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{h.date_depart||<span style={{ color:'var(--libre)', fontWeight:600 }}>En cours</span>}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11, color:'var(--blue)', fontWeight:600 }}>{days}j</td>
                          <td style={{ padding:'9px 14px', fontSize:11, color:'var(--text-dim)' }}>{h.motif_depart||'—'}</td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
