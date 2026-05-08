
import React, { useState, useEffect } from 'react'
import { occupationHistory, personnel as personnelAPI, batiments } from '../api'

const today = new Date().toISOString().slice(0,10)
const monthAgo = new Date(Date.now()-30*86400000).toISOString().slice(0,10)
const yearAgo = new Date(Date.now()-365*86400000).toISOString().slice(0,10)

const inp = {
  background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)',
  padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%'
}

const STATUT_COLORS = {
  planifie:{bg:'rgba(37,99,235,.12)',color:'#2563eb',label:'Planifié'},
  en_voyage:{bg:'rgba(234,88,12,.12)',color:'#ea580c',label:'En voyage'},
  retour:{bg:'rgba(22,163,74,.12)',color:'#16a34a',label:'Retour'},
  annule:{bg:'rgba(100,116,139,.12)',color:'#64748b',label:'Annulé'},
}

function DureeChip({ jours }) {
  const color = jours < 7 ? '#16a34a' : jours < 30 ? '#2563eb' : '#7c3aed'
  return <span style={{background:`${color}15`,color,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700,fontFamily:'monospace'}}>{jours}j</span>
}

export default function Historique() {
  const [tab, setTab] = useState('chambre')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [personnelList, setPersonnelList] = useState([])
  const [batsList, setBatsList] = useState([])
  const [voyageData, setVoyageData] = useState(null)
  const [voyageLoading, setVoyageLoading] = useState(false)
  const [chambreQ, setChambreQ] = useState({ batiment:'', nom:'', date_debut:yearAgo, date_fin:today })
  const [personneQ, setPersonneQ] = useState({ personnel:'', date_debut:yearAgo, date_fin:today })
  const [selectedPers, setSelectedPers] = useState('')

  useEffect(() => {
    personnelAPI.list({page_size:500}).then(r => setPersonnelList(r.data.results||r.data))
    batiments.list({page_size:300}).then(r => {
      const items = r.data.results||r.data
      setBatsList([...items].sort((a,b)=>a.residence.localeCompare(b.residence,undefined,{numeric:true})))
    })
  }, [])

  const searchChambre = async () => {
    if (!chambreQ.batiment && !chambreQ.nom) return alert('Saisissez une résidence ou un nom')
    setLoading(true); setResults([])
    try {
      const r = await occupationHistory.recherche({
        batiment: chambreQ.batiment,
        nom: chambreQ.nom,
        date_debut: chambreQ.date_debut,
        date_fin: chambreQ.date_fin,
      })
      setResults(r.data.results||[])
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setLoading(false) }
  }

  const searchPersonne = async () => {
    if (!personneQ.personnel) return alert('Sélectionner un membre du personnel')
    setLoading(true); setResults([])
    try {
      const r = await occupationHistory.recherche({
        personnel: personneQ.personnel,
        date_debut: personneQ.date_debut,
        date_fin: personneQ.date_fin,
      })
      setResults(r.data.results||[])
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setLoading(false) }
  }

  const searchVoyages = async () => {
    if (!selectedPers) return alert('Sélectionner un membre')
    setVoyageLoading(true); setVoyageData(null)
    try {
      const r = await personnelAPI.historiqueVoyages(selectedPers)
      setVoyageData(r.data)
    } catch(e) { alert('Erreur voyages: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setVoyageLoading(false) }
  }

  const TABS = [
    ['chambre','🏠 Qui a occupé cette chambre ?'],
    ['personne','👤 Où a dormi cette personne ?'],
    ['voyages','✈️ Voyages d\'un personnel'],
  ]

  return (
    <div style={{padding:20}}>
      <h2 style={{fontSize:20,fontWeight:700,color:'var(--blue)',marginBottom:4}}>📋 Historisation & Recherche</h2>
      <p style={{fontSize:13,color:'var(--text-dim)',marginBottom:20}}>Traçabilité complète · Qui a occupé quoi · Où a dormi qui · Voyages</p>

      {/* TABS */}
      <div style={{display:'flex',gap:2,marginBottom:20,background:'var(--surface2)',borderRadius:12,padding:4,border:'1px solid var(--border)'}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setResults([]);setVoyageData(null)}}
            style={{flex:1,padding:'10px 8px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
              background:tab===k?'#fff':'transparent',color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none',transition:'.2s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── CHAMBRE ── */}
      {tab==='chambre' && (
        <div>
          <SearchCard title="🏠 Qui a occupé cette chambre ?" color="var(--blue)">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr auto',gap:12,alignItems:'end'}}>
              <Fld label="Résidence">
                <select value={chambreQ.batiment} onChange={e=>setChambreQ({...chambreQ,batiment:e.target.value})} style={inp}>
                  <option value="">— Toutes —</option>
                  {batsList.map(b=><option key={b.id} value={b.residence}>{b.residence}</option>)}
                </select>
              </Fld>
              <Fld label="Nom occupant"><input value={chambreQ.nom} onChange={e=>setChambreQ({...chambreQ,nom:e.target.value})} style={inp} placeholder="Recherche..."/></Fld>
              <Fld label="Du"><input type="date" value={chambreQ.date_debut} onChange={e=>setChambreQ({...chambreQ,date_debut:e.target.value})} style={inp}/></Fld>
              <Fld label="Au"><input type="date" value={chambreQ.date_fin} onChange={e=>setChambreQ({...chambreQ,date_fin:e.target.value})} style={inp}/></Fld>
              <button onClick={searchChambre} disabled={loading} style={{background:'var(--blue)',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,whiteSpace:'nowrap'}}>🔍 Rechercher</button>
            </div>
          </SearchCard>
          <ResultsTable results={results} loading={loading} type="chambre"/>
        </div>
      )}

      {/* ── PERSONNE ── */}
      {tab==='personne' && (
        <div>
          <SearchCard title="👤 Où a dormi cette personne ?" color="#7c3aed">
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:12,alignItems:'end'}}>
              <Fld label="Personnel *">
                <select value={personneQ.personnel} onChange={e=>setPersonneQ({...personneQ,personnel:e.target.value})} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </Fld>
              <Fld label="Du"><input type="date" value={personneQ.date_debut} onChange={e=>setPersonneQ({...personneQ,date_debut:e.target.value})} style={inp}/></Fld>
              <Fld label="Au"><input type="date" value={personneQ.date_fin} onChange={e=>setPersonneQ({...personneQ,date_fin:e.target.value})} style={inp}/></Fld>
              <button onClick={searchPersonne} disabled={loading} style={{background:'#7c3aed',color:'#fff',border:'none',padding:'9px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>🔍 Rechercher</button>
            </div>
          </SearchCard>
          <ResultsTable results={results} loading={loading} type="personne"/>
        </div>
      )}

      {/* ── VOYAGES ── */}
      {tab==='voyages' && (
        <div>
          <SearchCard title="✈️ Historique voyages" color="#ea580c">
            <div style={{display:'grid',gridTemplateColumns:'3fr auto',gap:12,alignItems:'end'}}>
              <Fld label="Personnel *">
                <select value={selectedPers} onChange={e=>setSelectedPers(e.target.value)} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </Fld>
              <button onClick={searchVoyages} disabled={voyageLoading} style={{background:'#ea580c',color:'#fff',border:'none',padding:'9px 24px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                {voyageLoading?'Chargement...':'🔍 Voir les voyages'}
              </button>
            </div>
          </SearchCard>

          {voyageData && (
            <div>
              {/* Stats */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                {[
                  [voyageData.total_voyages,'Total voyages','var(--blue)','✈️'],
                  [voyageData.en_voyage,'En voyage','#ea580c','🚀'],
                  [voyageData.destinations_uniques?.length||0,'Destinations','#7c3aed','📍'],
                  [voyageData.voyages?.filter(v=>v.statut?.includes('Retour')).length||0,'Retours','#16a34a','🏠'],
                ].map(([v,l,c,ic])=>(
                  <div key={l} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:16,borderTop:`4px solid ${c}`,boxShadow:'var(--shadow)'}}>
                    <div style={{fontFamily:'monospace',fontSize:26,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4,textTransform:'uppercase',letterSpacing:1}}>{ic} {l}</div>
                  </div>
                ))}
              </div>

              {/* Destinations badge list */}
              {voyageData.destinations_uniques?.length > 0 && (
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:16,boxShadow:'var(--shadow)'}}>
                  <div style={{fontSize:12,color:'var(--text-dim)',marginBottom:10,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1}}>📍 Destinations visitées</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {voyageData.destinations_uniques.map(d=>(
                      <span key={d} style={{background:'rgba(234,88,12,.1)',color:'#ea580c',border:'1px solid rgba(234,88,12,.2)',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tableau voyages */}
              <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
                <div style={{padding:'12px 18px',background:'var(--blue)',color:'#fff',fontWeight:600}}>
                  ✈️ {voyageData.total_voyages} voyage(s) de {voyageData.personnel} · {voyageData.societe}
                </div>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                  <thead><tr style={{background:'var(--surface2)'}}>
                    {['#','Destination','Chambre','Départ','Retour prévu','Retour effectif','Statut'].map(h=>(
                      <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'var(--text-dim)',letterSpacing:1,textTransform:'uppercase',fontWeight:500}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(!voyageData.voyages||voyageData.voyages.length===0)
                      ? <tr><td colSpan={7} style={{padding:24,textAlign:'center',color:'var(--text-dim)'}}>Aucun voyage enregistré pour ce personnel</td></tr>
                      : voyageData.voyages.map((v,i)=>{
                        const sc = Object.values(STATUT_COLORS).find(x=>x.label===v.statut)||STATUT_COLORS.retour
                        return (
                          <tr key={v.id} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                            <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'var(--blue)'}}>#{i+1}</td>
                            <td style={{padding:'9px 14px',fontWeight:600}}>{v.destination||<span style={{color:'var(--text-dim)'}}>—</span>}</td>
                            <td style={{padding:'9px 14px',fontFamily:'monospace',color:'var(--blue)',fontWeight:700}}>{v.chambre||'—'}</td>
                            <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:11}}>{v.date_depart}</td>
                            <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:11}}>{v.date_retour_prevue}</td>
                            <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:11}}>{v.date_retour_effective||<span style={{color:'#ea580c',fontWeight:600}}>En cours</span>}</td>
                            <td style={{padding:'9px 14px'}}>
                              <span style={{background:sc.bg,color:sc.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{v.statut}</span>
                            </td>
                          </tr>
                        )
                      })
                    }
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

// Helpers
function SearchCard({ title, color, children }) {
  return (
    <div style={{background:'#fff',border:`1px solid ${color}30`,borderRadius:12,marginBottom:16,overflow:'hidden',boxShadow:'var(--shadow)'}}>
      <div style={{padding:'12px 18px',background:color,color:'#fff',fontWeight:600,fontSize:14}}>{title}</div>
      <div style={{padding:18}}>{children}</div>
    </div>
  )
}
function Fld({ label, children }) {
  return (
    <div>
      <label style={{display:'block',fontSize:11,color:'var(--text-dim)',marginBottom:4,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1}}>{label}</label>
      {children}
    </div>
  )
}

function ResultsTable({ results, loading, type }) {
  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-dim)',fontSize:14}}>🔍 Recherche en cours...</div>
  if (results.length===0) return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:40,textAlign:'center',color:'var(--text-dim)',boxShadow:'var(--shadow)'}}>
      <div style={{fontSize:40,marginBottom:12}}>🔍</div>
      <div style={{fontSize:14}}>Lancez une recherche pour voir les résultats</div>
      <div style={{fontSize:12,marginTop:4}}>Les données actuelles des chambres et l'historique apparaîtront ici</div>
    </div>
  )

  const totalJours = results.reduce((s,r)=>s+(r.duree_jours||0),0)

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap'}}>
        <div style={{background:'var(--blue)',color:'#fff',borderRadius:8,padding:'7px 16px',fontSize:13,fontWeight:700}}>{results.length} résultat{results.length>1?'s':''}</div>
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:8,padding:'7px 16px',fontSize:13,color:'var(--text-dim)'}}>Durée totale : <b style={{color:'var(--blue)'}}>{totalJours} jours</b></div>
        {results.filter(r=>r.en_cours).length>0 && (
          <div style={{background:'rgba(22,163,74,.1)',border:'1px solid rgba(22,163,74,.3)',borderRadius:8,padding:'7px 16px',fontSize:13,color:'#16a34a',fontWeight:700}}>
            {results.filter(r=>r.en_cours).length} occupation{results.filter(r=>r.en_cours).length>1?'s':''} en cours
          </div>
        )}
      </div>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:'var(--blue)'}}>
            {(type==='chambre'
              ? ['Résidence','Bloc','Occupant','Société','Arrivée','Départ','Durée','Statut']
              : ['Résidence','Bloc','Arrivée','Départ','Durée','Motif','Statut']
            ).map(h=>(
              <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'rgba(255,255,255,.85)',letterSpacing:1,textTransform:'uppercase',fontWeight:500}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {results.map((r,i)=>(
              <tr key={r.id} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                <td style={{padding:'10px 14px',fontFamily:'monospace',fontWeight:700,color:'var(--blue)'}}>{r.residence}</td>
                <td style={{padding:'10px 14px',fontSize:12,color:'var(--text-dim)'}}>{r.bloc}</td>
                {type==='chambre' && <>
                  <td style={{padding:'10px 14px',fontWeight:600}}>{r.occupant}</td>
                  <td style={{padding:'10px 14px',fontSize:12}}>{r.societe||'—'}</td>
                </>}
                <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:11}}>{r.date_arrivee}</td>
                <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:11}}>{r.date_depart||<span style={{color:'#16a34a',fontWeight:700}}>En cours</span>}</td>
                <td style={{padding:'10px 14px'}}><DureeChip jours={r.duree_jours}/></td>
                {type==='personne' && <td style={{padding:'10px 14px',fontSize:11,color:'var(--text-dim)'}}>{r.motif_depart||'—'}</td>}
                <td style={{padding:'10px 14px'}}>
                  {r.en_cours
                    ? <span style={{background:'rgba(22,163,74,.12)',color:'#16a34a',padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>✅ En cours</span>
                    : <span style={{background:'var(--surface2)',color:'var(--text-dim)',padding:'3px 8px',borderRadius:20,fontSize:11}}>Terminé</span>
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
