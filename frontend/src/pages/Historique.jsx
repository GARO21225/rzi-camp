
import React, { useState, useEffect } from 'react'
import { occupationHistory, personnel as personnelAPI, batiments } from '../api'

const today = new Date().toISOString().slice(0,10)
const monthAgo = new Date(Date.now()-30*86400000).toISOString().slice(0,10)

const inp = {
  background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)',
  padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%'
}

function DureeLabel({ jours }) {
  if (jours < 1) return <span>1 j</span>
  if (jours < 7) return <span style={{color:'#16a34a'}}>{jours}j</span>
  if (jours < 30) return <span style={{color:'#2563eb'}}>{jours}j</span>
  return <span style={{color:'#7c3aed', fontWeight:700}}>{jours}j</span>
}

export default function Historique() {
  const [tab, setTab] = useState('chambre')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [personnelList, setPersonnelList] = useState([])
  const [batsList, setBatsList] = useState([])
  const [voyageData, setVoyageData] = useState(null)
  const [voyageLoading, setVoyageLoading] = useState(false)

  // Chambre search params
  const [chambreQuery, setChambreQuery] = useState({ batiment:'', nom:'', date_debut:monthAgo, date_fin:today })
  // Personne search params
  const [personneQuery, setPersonneQuery] = useState({ personnel:'', date_debut:monthAgo, date_fin:today })
  // Voyage search
  const [selectedPersonnel, setSelectedPersonnel] = useState('')

  useEffect(() => {
    personnelAPI.list({page_size:500}).then(r => setPersonnelList(r.data.results||r.data))
    batiments.list({page_size:300}).then(r => {
      const items = r.data.results||r.data
      const sorted = [...items].sort((a,b) => a.residence.localeCompare(b.residence,undefined,{numeric:true}))
      setBatsList(sorted)
    })
  }, [])

  const searchChambre = async () => {
    if (!chambreQuery.batiment && !chambreQuery.nom) return alert('Saisissez une résidence ou un nom')
    setLoading(true)
    try {
      const r = await occupationHistory.recherche(chambreQuery)
      setResults(r.data.results||r.data)
    } finally { setLoading(false) }
  }

  const searchPersonne = async () => {
    if (!personneQuery.personnel) return alert('Sélectionner un membre du personnel')
    setLoading(true)
    try {
      const r = await occupationHistory.recherche(personneQuery)
      setResults(r.data.results||r.data)
    } finally { setLoading(false) }
  }

  const searchVoyages = async () => {
    if (!selectedPersonnel) return alert('Sélectionner un membre')
    setVoyageLoading(true)
    try {
      const { historiqueVoyages } = await import('../api').then(m => m.personnel)
      // Use fetch directly
      const { personnel: personnelAPI2 } = await import('../api')
      const r = await personnelAPI2.historiqueVoyages(selectedPersonnel)
      setVoyageData(r.data)
    } catch(e) { alert('Erreur: '+e.message) }
    finally { setVoyageLoading(false) }
  }

  const TABS = [
    ['chambre','🏠 Qui a occupé cette chambre ?'],
    ['personne','👤 Où a dormi cette personne ?'],
    ['voyages','✈️ Voyages d\'un personnel'],
  ]

  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)', marginBottom:4 }}>📋 Historisation & Recherche</h2>
      <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:20 }}>
        Qui a occupé quoi · Où a dormi qui · Combien de voyages
      </p>

      {/* TABS */}
      <div style={{ display:'flex', gap:2, marginBottom:20, background:'var(--surface2)', borderRadius:12, padding:4, border:'1px solid var(--border)' }}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>{ setTab(k); setResults([]); setVoyageData(null) }}
            style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none', transition:'.2s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── CHAMBRE QUERY ── */}
      {tab==='chambre' && (
        <div>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:600, color:'var(--blue)', marginBottom:14, fontSize:15 }}>🏠 Qui a occupé cette chambre ?</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr auto', gap:12, alignItems:'end' }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence</label>
                <select value={chambreQuery.batiment} onChange={e=>setChambreQuery({...chambreQuery,batiment:e.target.value})} style={inp}>
                  <option value="">— Toutes —</option>
                  {batsList.map(b=><option key={b.id} value={b.residence}>{b.residence}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Nom occupant</label>
                <input value={chambreQuery.nom} onChange={e=>setChambreQuery({...chambreQuery,nom:e.target.value})} style={inp} placeholder="Recherche par nom..."/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Du</label>
                <input type="date" value={chambreQuery.date_debut} onChange={e=>setChambreQuery({...chambreQuery,date_debut:e.target.value})} style={inp}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Au</label>
                <input type="date" value={chambreQuery.date_fin} onChange={e=>setChambreQuery({...chambreQuery,date_fin:e.target.value})} style={inp}/>
              </div>
              <button onClick={searchChambre} disabled={loading}
                style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>
                🔍 Rechercher
              </button>
            </div>
          </div>
          <ResultTable results={results} loading={loading} type="chambre"/>
        </div>
      )}

      {/* ── PERSONNE QUERY ── */}
      {tab==='personne' && (
        <div>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:600, color:'var(--blue)', marginBottom:14, fontSize:15 }}>👤 Où a dormi cette personne ?</div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:12, alignItems:'end' }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Personnel *</label>
                <select value={personneQuery.personnel} onChange={e=>setPersonneQuery({...personneQuery,personnel:e.target.value})} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Du</label>
                <input type="date" value={personneQuery.date_debut} onChange={e=>setPersonneQuery({...personneQuery,date_debut:e.target.value})} style={inp}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Au</label>
                <input type="date" value={personneQuery.date_fin} onChange={e=>setPersonneQuery({...personneQuery,date_fin:e.target.value})} style={inp}/>
              </div>
              <button onClick={searchPersonne} disabled={loading}
                style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'9px 20px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                🔍 Rechercher
              </button>
            </div>
          </div>
          <ResultTable results={results} loading={loading} type="personne"/>
        </div>
      )}

      {/* ── VOYAGES QUERY ── */}
      {tab==='voyages' && (
        <div>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:20, marginBottom:16, boxShadow:'var(--shadow)' }}>
            <div style={{ fontWeight:600, color:'var(--blue)', marginBottom:14, fontSize:15 }}>✈️ Historique voyages d'un personnel</div>
            <div style={{ display:'grid', gridTemplateColumns:'3fr auto', gap:12, alignItems:'end' }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Personnel *</label>
                <select value={selectedPersonnel} onChange={e=>setSelectedPersonnel(e.target.value)} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </div>
              <button onClick={searchVoyages} disabled={voyageLoading}
                style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'9px 24px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                🔍 Voir
              </button>
            </div>
          </div>

          {voyageData && (
            <div>
              {/* Résumé */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
                <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:18, borderTop:'4px solid var(--blue)', boxShadow:'var(--shadow)' }}>
                  <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:700, color:'var(--blue)' }}>{voyageData.total_voyages}</div>
                  <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>Total voyages</div>
                </div>
                <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:18, borderTop:'4px solid #ea580c', boxShadow:'var(--shadow)' }}>
                  <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:700, color:'#ea580c' }}>
                    {voyageData.voyages.filter(v=>v.statut==='en_voyage').length}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>En voyage</div>
                </div>
                <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:18, borderTop:'4px solid #16a34a', boxShadow:'var(--shadow)' }}>
                  <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:700, color:'#16a34a' }}>
                    {new Set(voyageData.voyages.filter(v=>v.destination).map(v=>v.destination)).size}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>Destinations</div>
                </div>
              </div>

              {/* Liste voyages */}
              <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
                <div style={{ padding:'12px 18px', background:'var(--blue)', color:'#fff', fontWeight:600 }}>
                  ✈️ Voyages de {voyageData.personnel}
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead><tr style={{ background:'var(--surface2)' }}>
                    {['N°','Destination','Chambre','Départ','Retour prévu','Retour effectif','Statut'].map(h=>(
                      <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {voyageData.voyages.map((v,i)=>{
                      const sColor = {planifie:'#2563eb',en_voyage:'#ea580c',retour:'#16a34a',annule:'#64748b'}
                      return (
                        <tr key={v.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontWeight:700, color:'var(--blue)' }}>#{i+1}</td>
                          <td style={{ padding:'9px 14px', fontWeight:600 }}>{v.destination||<span style={{color:'var(--text-dim)'}}>—</span>}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', color:'var(--blue)' }}>{v.chambre||'—'}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{v.date_depart}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{v.date_retour_prevue}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{v.date_retour_effective||<span style={{color:'var(--text-dim)'}}>En cours</span>}</td>
                          <td style={{ padding:'9px 14px' }}>
                            <span style={{ background:`${sColor[v.statut]}18`, color:sColor[v.statut], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                              {v.statut?.replace('_',' ')}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {voyageData.voyages.length===0 && (
                      <tr><td colSpan={7} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun voyage enregistré</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultTable({ results, loading, type }) {
  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--text-dim)' }}>🔍 Recherche...</div>
  if (results.length === 0) return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:40, textAlign:'center', color:'var(--text-dim)', boxShadow:'var(--shadow)' }}>
      Lance une recherche pour voir les résultats
    </div>
  )

  const totalJours = results.reduce((s,r) => s + (r.duree_jours||0), 0)

  return (
    <div>
      {/* Stats summary */}
      <div style={{ display:'flex', gap:12, marginBottom:12 }}>
        <div style={{ background:'var(--blue)', color:'#fff', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:700 }}>
          {results.length} résultat{results.length>1?'s':''}
        </div>
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:8, padding:'8px 16px', fontSize:13, color:'var(--text-dim)' }}>
          Durée totale : <b style={{color:'var(--blue)'}}>{totalJours} jours</b>
        </div>
        {results.filter(r=>r.en_cours).length > 0 && (
          <div style={{ background:'rgba(22,163,74,.1)', border:'1px solid rgba(22,163,74,.3)', borderRadius:8, padding:'8px 16px', fontSize:13, color:'#16a34a', fontWeight:700 }}>
            {results.filter(r=>r.en_cours).length} en cours
          </div>
        )}
      </div>

      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr style={{ background:'var(--blue)' }}>
            {type==='chambre'
              ? ['Résidence','Bloc','Occupant','Société','Arrivée','Départ','Durée','Statut'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.85)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))
              : ['Résidence','Bloc','Arrivée','Départ','Durée','Motif départ','Statut'].map(h=>(
                  <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.85)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))
            }
          </tr></thead>
          <tbody>
            {results.map((r,i)=>(
              <tr key={r.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'var(--blue)' }}>{r.residence}</td>
                <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-dim)' }}>{r.bloc}</td>
                {type==='chambre' && <>
                  <td style={{ padding:'10px 14px', fontWeight:600 }}>{r.occupant}</td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}>{r.societe||'—'}</td>
                </>}
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11 }}>{r.date_arrivee}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11 }}>{r.date_depart||<span style={{color:'#16a34a',fontWeight:600}}>En cours</span>}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700 }}>
                  <DureeLabel jours={r.duree_jours}/>
                </td>
                {type==='personne' && <td style={{ padding:'10px 14px', fontSize:11, color:'var(--text-dim)' }}>{r.motif_depart||'—'}</td>}
                <td style={{ padding:'10px 14px' }}>
                  {r.en_cours
                    ? <span style={{ background:'rgba(22,163,74,.12)', color:'#16a34a', padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>✅ En cours</span>
                    : <span style={{ background:'var(--surface2)', color:'var(--text-dim)', padding:'3px 8px', borderRadius:20, fontSize:11 }}>Terminé</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
