
import React, { useState, useEffect } from 'react'
import { occupationHistory, personnel as personnelAPI, batiments, voyages as voyagesAPI } from '../api'

const todayStr = new Date().toISOString().slice(0,10)
const yearAgoStr = new Date(Date.now()-365*86400000).toISOString().slice(0,10)

const inp = {background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'8px 12px',borderRadius:8,fontSize:13,outline:'none',fontFamily:'inherit',width:'100%'}

const STATUT_V = {
  planifie:{bg:'rgba(37,99,235,.12)',color:'#2563eb',label:'Planifié'},
  en_voyage:{bg:'rgba(234,88,12,.12)',color:'#ea580c',label:'En voyage'},
  retour:{bg:'rgba(22,163,74,.12)',color:'#16a34a',label:'Retour'},
  annule:{bg:'rgba(100,116,139,.12)',color:'#64748b',label:'Annulé'},
}

function Chip({ jours }) {
  const c = jours < 7 ? '#16a34a' : jours < 30 ? '#2563eb' : '#7c3aed'
  return <span style={{background:`${c}15`,color:c,padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,fontFamily:'monospace'}}>{jours}j</span>
}

function Fld({ label, children }) {
  return <div><label style={{display:'block',fontSize:11,color:'var(--text-dim)',marginBottom:4,fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1}}>{label}</label>{children}</div>
}

function Card({ title, color, children }) {
  return (
    <div style={{background:'#fff',border:`1px solid ${color}25`,borderRadius:12,marginBottom:16,overflow:'hidden',boxShadow:'var(--shadow)'}}>
      <div style={{padding:'12px 18px',background:color,color:'#fff',fontWeight:600,fontSize:14}}>{title}</div>
      <div style={{padding:18}}>{children}</div>
    </div>
  )
}

export default function Historique() {
  const [tab, setTab] = useState('chambre')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [pers, setPers] = useState([])
  const [bats, setBats] = useState([])
  const [voyData, setVoyData] = useState(null)
  const [voyEnsemble, setVoyEnsemble] = useState(null)
  const [voyLoading, setVoyLoading] = useState(false)
  const [chambreQ, setChambreQ] = useState({batiment:'',nom:'',date_debut:yearAgoStr,date_fin:todayStr})
  const [personneQ, setPersonneQ] = useState({personnel:'',date_debut:yearAgoStr,date_fin:todayStr})
  const [selPers, setSelPers] = useState('')

  useEffect(() => {
    personnelAPI.list({page_size:500}).then(r => setPers(r.data.results||r.data))
    batiments.list({page_size:300}).then(r => {
      const items = r.data.results||r.data
      setBats([...items].sort((a,b)=>a.residence.localeCompare(b.residence,undefined,{numeric:true})))
    })
    // Load global voyages view immediately for the ensemble tab
    voyagesAPI.vueEnsemble().then(r => setVoyEnsemble(r.data)).catch(()=>{})
  }, [])

  const searchChambre = async () => {
    if (!chambreQ.batiment && !chambreQ.nom) return alert('Saisissez une résidence ou un nom d\'occupant')
    setLoading(true); setResults([])
    try {
      const p = {}
      if (chambreQ.batiment) p.batiment = chambreQ.batiment
      if (chambreQ.nom) p.nom = chambreQ.nom
      if (chambreQ.date_debut) p.date_debut = chambreQ.date_debut
      if (chambreQ.date_fin) p.date_fin = chambreQ.date_fin
      const r = await occupationHistory.recherche(p)
      setResults(r.data.results||r.data||[])
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setLoading(false) }
  }

  const searchPersonne = async () => {
    if (!personneQ.personnel) return alert('Sélectionner un membre du personnel')
    setLoading(true); setResults([])
    try {
      const p = {personnel: personneQ.personnel}
      if (personneQ.date_debut) p.date_debut = personneQ.date_debut
      if (personneQ.date_fin) p.date_fin = personneQ.date_fin
      const r = await occupationHistory.recherche(p)
      setResults(r.data.results||r.data||[])
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setLoading(false) }
  }

  const searchVoyages = async () => {
    if (!selPers) return alert('Sélectionner un membre')
    setVoyLoading(true); setVoyData(null)
    try {
      const r = await personnelAPI.historiqueVoyages(selPers)
      setVoyData(r.data)
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setVoyLoading(false) }
  }

  const TABS = [
    ['chambre','🏠 Qui a occupé ?'],
    ['personne','👤 Où a dormi ?'],
    ['voyages_pers','✈️ Voyages d\'un personnel'],
    ['ensemble','🌍 Tous les voyages'],
  ]

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,color:'var(--blue)',marginBottom:4}}>📋 Historisation & Recherche</h2>
          <p style={{fontSize:13,color:'var(--text-dim)'}}>Qui a occupé quoi · Où a dormi qui · Voyages complets · Extractions CSV</p>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:2,marginBottom:20,background:'var(--surface2)',borderRadius:12,padding:4,border:'1px solid var(--border)'}}>
        {TABS.map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setResults([]);setVoyData(null)}}
            style={{flex:1,padding:'10px 4px',borderRadius:10,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
              background:tab===k?'#fff':'transparent',color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none',transition:'.2s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── CHAMBRE ── */}
      {tab==='chambre' && (
        <div>
          <Card title="🏠 Qui a occupé cette chambre ?" color="var(--blue)">
            <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr auto',gap:10,alignItems:'end'}}>
              <Fld label="Résidence">
                <select value={chambreQ.batiment} onChange={e=>setChambreQ({...chambreQ,batiment:e.target.value})} style={inp}>
                  <option value="">— Toutes —</option>
                  {bats.map(b=><option key={b.id} value={b.residence}>{b.residence}</option>)}
                </select>
              </Fld>
              <Fld label="Nom occupant"><input value={chambreQ.nom} onChange={e=>setChambreQ({...chambreQ,nom:e.target.value})} style={inp} placeholder="Filtrer par nom..."/></Fld>
              <Fld label="Du"><input type="date" value={chambreQ.date_debut} onChange={e=>setChambreQ({...chambreQ,date_debut:e.target.value})} style={inp}/></Fld>
              <Fld label="Au"><input type="date" value={chambreQ.date_fin} onChange={e=>setChambreQ({...chambreQ,date_fin:e.target.value})} style={inp}/></Fld>
              <button onClick={searchChambre} disabled={loading} style={{background:'var(--blue)',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,whiteSpace:'nowrap'}}>🔍 Rechercher</button>
            </div>
          </Card>
          {results.length > 0 && (
            <div style={{marginBottom:10,display:'flex',justifyContent:'flex-end'}}>
              <a href={occupationHistory.exportCsv({batiment:chambreQ.batiment,nom:chambreQ.nom})}
                style={{background:'#16a34a',color:'#fff',padding:'7px 16px',borderRadius:8,textDecoration:'none',fontSize:12,fontWeight:700}}>
                ⬇ Export CSV
              </a>
            </div>
          )}
          <OccTable results={results} loading={loading} type="chambre"/>
        </div>
      )}

      {/* ── PERSONNE ── */}
      {tab==='personne' && (
        <div>
          <Card title="👤 Où a dormi cette personne ?" color="#7c3aed">
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:10,alignItems:'end'}}>
              <Fld label="Personnel *">
                <select value={personneQ.personnel} onChange={e=>setPersonneQ({...personneQ,personnel:e.target.value})} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {pers.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </Fld>
              <Fld label="Du"><input type="date" value={personneQ.date_debut} onChange={e=>setPersonneQ({...personneQ,date_debut:e.target.value})} style={inp}/></Fld>
              <Fld label="Au"><input type="date" value={personneQ.date_fin} onChange={e=>setPersonneQ({...personneQ,date_fin:e.target.value})} style={inp}/></Fld>
              <button onClick={searchPersonne} disabled={loading} style={{background:'#7c3aed',color:'#fff',border:'none',padding:'9px 18px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>🔍 Rechercher</button>
            </div>
          </Card>
          {results.length > 0 && (
            <div style={{marginBottom:10,display:'flex',justifyContent:'flex-end'}}>
              <a href={occupationHistory.exportCsv({personnel:personneQ.personnel})}
                style={{background:'#16a34a',color:'#fff',padding:'7px 16px',borderRadius:8,textDecoration:'none',fontSize:12,fontWeight:700}}>
                ⬇ Export CSV
              </a>
            </div>
          )}
          <OccTable results={results} loading={loading} type="personne"/>
        </div>
      )}

      {/* ── VOYAGES PERSONNEL ── */}
      {tab==='voyages_pers' && (
        <div>
          <Card title="✈️ Voyages d'un personnel" color="#ea580c">
            <div style={{display:'grid',gridTemplateColumns:'3fr auto',gap:10,alignItems:'end'}}>
              <Fld label="Personnel *">
                <select value={selPers} onChange={e=>setSelPers(e.target.value)} style={inp}>
                  <option value="">— Sélectionner —</option>
                  {pers.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                </select>
              </Fld>
              <button onClick={searchVoyages} disabled={voyLoading} style={{background:'#ea580c',color:'#fff',border:'none',padding:'9px 22px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                {voyLoading?'Chargement...':'🔍 Voir voyages'}
              </button>
            </div>
          </Card>

          {voyData && (
            <div>
              {/* KPIs */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                {[
                  [voyData.total_voyages,'Total voyages','var(--blue)','✈️'],
                  [voyData.en_voyage||0,'En voyage','#ea580c','🚀'],
                  [voyData.destinations_uniques?.length||0,'Destinations','#7c3aed','📍'],
                  [(voyData.voyages||[]).filter(v=>v.statut?.includes('Retour')||v.statut==='retour').length,'Retours','#16a34a','🏠'],
                ].map(([v,l,c,ic])=>(
                  <div key={l} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:16,borderTop:`4px solid ${c}`,boxShadow:'var(--shadow)'}}>
                    <div style={{fontFamily:'monospace',fontSize:28,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4,textTransform:'uppercase',letterSpacing:1}}>{ic} {l}</div>
                  </div>
                ))}
              </div>

              {/* Destinations */}
              {voyData.destinations_uniques?.length > 0 && (
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:14,marginBottom:14,boxShadow:'var(--shadow)'}}>
                  <div style={{fontSize:11,color:'var(--text-dim)',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>📍 Destinations visitées</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {voyData.destinations_uniques.map(d=>(
                      <span key={d} style={{background:'rgba(234,88,12,.1)',color:'#ea580c',border:'1px solid rgba(234,88,12,.2)',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Export + Table */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:600,color:'var(--blue)'}}>✈️ {voyData.total_voyages} voyage(s) de {voyData.personnel}</div>
                <a href={voyagesAPI.exportCsv({personnel:selPers})}
                  style={{background:'#16a34a',color:'#fff',padding:'7px 16px',borderRadius:8,textDecoration:'none',fontSize:12,fontWeight:700}}>
                  ⬇ Export CSV
                </a>
              </div>
              <VoyageTable voyages={voyData.voyages||[]}/>
            </div>
          )}
          {!voyData && !voyLoading && (
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:40,textAlign:'center',color:'var(--text-dim)',boxShadow:'var(--shadow)'}}>
              <div style={{fontSize:40,marginBottom:12}}>✈️</div>
              <div>Sélectionner un membre du personnel et cliquer Voir voyages</div>
            </div>
          )}
        </div>
      )}

      {/* ── ENSEMBLE ── */}
      {tab==='ensemble' && (
        <div>
          {voyEnsemble ? (
            <div>
              {/* Stats globales */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
                {[
                  [voyEnsemble.total,'Total voyages','var(--blue)','✈️'],
                  [voyEnsemble.en_voyage,'En voyage','#ea580c','🚀'],
                  [voyEnsemble.destinations_uniques?.length||0,'Destinations','#7c3aed','📍'],
                  [voyEnsemble.top_voyageurs?.[0]?.nb||0,'Max voyages/pers','#16a34a','🏆'],
                ].map(([v,l,c,ic])=>(
                  <div key={l} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:16,borderTop:`4px solid ${c}`,boxShadow:'var(--shadow)'}}>
                    <div style={{fontFamily:'monospace',fontSize:28,fontWeight:700,color:c}}>{v}</div>
                    <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4,textTransform:'uppercase',letterSpacing:1}}>{ic} {l}</div>
                  </div>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                {/* Top voyageurs */}
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
                  <div style={{padding:'12px 18px',background:'var(--blue)',color:'#fff',fontWeight:600}}>🏆 Top voyageurs</div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                    <thead><tr style={{background:'var(--surface2)'}}>
                      {['Personnel','Société','Nb voyages'].map(h=>(
                        <th key={h} style={{padding:'8px 14px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'var(--text-dim)',letterSpacing:1,textTransform:'uppercase',fontWeight:500}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {(voyEnsemble.top_voyageurs||[]).map((t,i)=>(
                        <tr key={i} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                          <td style={{padding:'8px 14px',fontWeight:600}}>{t.personnel__nom} {t.personnel__prenom}</td>
                          <td style={{padding:'8px 14px',fontSize:12,color:'var(--text-dim)'}}>{t.personnel__societe}</td>
                          <td style={{padding:'8px 14px',fontFamily:'monospace',fontWeight:700,color:'var(--blue)'}}>{t.nb}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Destinations */}
                <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:16,boxShadow:'var(--shadow)'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--blue)',marginBottom:10}}>📍 Toutes les destinations</div>
                  {voyEnsemble.destinations_uniques?.length > 0
                    ? <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                        {voyEnsemble.destinations_uniques.map(d=>(
                          <span key={d} style={{background:'rgba(234,88,12,.1)',color:'#ea580c',border:'1px solid rgba(234,88,12,.2)',padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600}}>{d}</span>
                        ))}
                      </div>
                    : <div style={{color:'var(--text-dim)',fontSize:13}}>Aucune destination enregistrée</div>
                  }
                </div>
              </div>

              {/* Tous les voyages */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:600,color:'var(--blue)'}}>Liste de tous les voyages ({voyEnsemble.total})</div>
                <a href={voyagesAPI.exportCsv({})}
                  style={{background:'#16a34a',color:'#fff',padding:'7px 16px',borderRadius:8,textDecoration:'none',fontSize:12,fontWeight:700}}>
                  ⬇ Export CSV complet
                </a>
              </div>
              <VoyageTable voyages={voyEnsemble.voyages||[]} showPersonnel/>
            </div>
          ) : (
            <div style={{padding:40,textAlign:'center',color:'var(--text-dim)'}}>Chargement...</div>
          )}
        </div>
      )}
    </div>
  )
}

function OccTable({ results, loading, type }) {
  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--text-dim)',fontSize:14}}>🔍 Recherche en cours...</div>
  if (results.length===0) return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:40,textAlign:'center',color:'var(--text-dim)',boxShadow:'var(--shadow)'}}>
      <div style={{fontSize:36,marginBottom:10}}>🔍</div>
      <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Aucun résultat</div>
      <div style={{fontSize:12}}>Vérifiez les critères de recherche ou élargissez la période</div>
    </div>
  )
  const totalJ = results.reduce((s,r)=>s+(r.duree_jours||0),0)
  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:12}}>
        <div style={{background:'var(--blue)',color:'#fff',borderRadius:8,padding:'6px 16px',fontSize:13,fontWeight:700}}>{results.length} résultat{results.length>1?'s':''}</div>
        <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:8,padding:'6px 16px',fontSize:13}}>Durée totale : <b style={{color:'var(--blue)'}}>{totalJ} jours</b></div>
        {results.filter(r=>r.en_cours).length>0 && (
          <div style={{background:'rgba(22,163,74,.1)',border:'1px solid rgba(22,163,74,.3)',borderRadius:8,padding:'6px 16px',fontSize:13,color:'#16a34a',fontWeight:700}}>
            {results.filter(r=>r.en_cours).length} en cours
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
                <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:11,color:!r.date_depart?'#16a34a':'inherit',fontWeight:!r.date_depart?700:'normal'}}>{r.date_depart||'En cours'}</td>
                <td style={{padding:'10px 14px'}}><Chip jours={r.duree_jours||0}/></td>
                {type==='personne' && <td style={{padding:'10px 14px',fontSize:11,color:'var(--text-dim)'}}>{r.motif_depart||'—'}</td>}
                <td style={{padding:'10px 14px'}}>
                  <span style={{background:r.en_cours?'rgba(22,163,74,.12)':'var(--surface2)',color:r.en_cours?'#16a34a':'var(--text-dim)',padding:'3px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>
                    {r.en_cours?'✅ En cours':'Terminé'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VoyageTable({ voyages, showPersonnel }) {
  if (!voyages || voyages.length===0) return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:32,textAlign:'center',color:'var(--text-dim)',boxShadow:'var(--shadow)'}}>
      <div style={{fontSize:32,marginBottom:8}}>✈️</div>Aucun voyage enregistré
    </div>
  )
  const cols = showPersonnel
    ? ['Personnel','Société','Chambre','Destination','Départ','Retour prévu','Retour réel','Statut']
    : ['#','Chambre','Destination','Départ','Retour prévu','Retour réel','Statut']
  return (
    <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow)'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
        <thead><tr style={{background:'var(--blue)'}}>
          {cols.map(h=>(
            <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontFamily:'monospace',color:'rgba(255,255,255,.85)',letterSpacing:1,textTransform:'uppercase',fontWeight:500}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {voyages.map((v,i)=>{
            const sc = Object.values(STATUT_V).find(x=>x.label===v.statut_label)||STATUT_V.retour
            return (
              <tr key={v.id||i} style={{borderTop:'1px solid var(--border)',background:i%2?'var(--surface2)':'#fff'}}>
                {showPersonnel ? (
                  <>
                    <td style={{padding:'9px 14px',fontWeight:600}}>{v.personnel}</td>
                    <td style={{padding:'9px 14px',fontSize:12,color:'var(--text-dim)'}}>{v.societe}</td>
                  </>
                ) : <td style={{padding:'9px 14px',fontFamily:'monospace',fontWeight:700,color:'var(--blue)'}}>#{i+1}</td>}
                <td style={{padding:'9px 14px',fontFamily:'monospace',color:'var(--blue)',fontWeight:700}}>{v.chambre||'—'}</td>
                <td style={{padding:'9px 14px',fontWeight:600}}>{v.destination||<span style={{color:'var(--text-dim)'}}>—</span>}</td>
                <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:11}}>{v.date_depart}</td>
                <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:11}}>{v.date_retour_prevue}</td>
                <td style={{padding:'9px 14px',fontFamily:'monospace',fontSize:11,color:!v.date_retour_effective?'#ea580c':'inherit'}}>
                  {v.date_retour_effective||'En cours'}
                </td>
                <td style={{padding:'9px 14px'}}>
                  <span style={{background:sc.bg,color:sc.color,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{v.statut_label||v.statut}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
