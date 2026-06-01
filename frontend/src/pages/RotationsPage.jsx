import React, { useState, useEffect, useCallback } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('access_token')||''}`
})

const STATUTS = {
  planifie:  { l:'Planifié',        c:'#3b82f6' },
  en_voyage: { l:'En voyage',       c:'#f97316' },
  retour:    { l:'Retour au camp',  c:'#16a34a' },
  annule:    { l:'Annulé',          c:'#94a3b8' },
}

const inp = {
  width:'100%', border:'2px solid #e2e8f0', borderRadius:9,
  padding:'10px 12px', fontSize:13, outline:'none',
  boxSizing:'border-box', fontFamily:'inherit'
}

export default function RotationsPage() {
  const [voyages,   setVoyages]   = useState([])
  const [personnel, setPersonnel] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [search,    setSearch]    = useState('')
  const [statFilter,setStatFilter]= useState('')
  const [form,      setForm]      = useState({
    personnel:'', destination:'', motif:'',
    date_depart:'', date_retour_prevue:'', vehicule_suggere:''
  })
  const [vehiculesDispo, setVehiculesDispo] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/voyages/?page_size=200`, { headers: hdrs() })
      const d = await r.json()
      setVoyages(d.results || d || [])
    } catch(e) { console.error(e) }
    setLoading(false)
  }, [])

  // Suggestions véhicules disponibles quand la date change
  useEffect(() => {
    if (!form.date_depart) { setVehiculesDispo([]); return }
    try {
      const fleet = JSON.parse(localStorage.getItem('rzi_fleet_v1')||'{}')
      const reservations = JSON.parse(localStorage.getItem('rzi_reservations_v3')||'[]')
      const vehicules = Object.entries(fleet)
        .filter(([cat])=>cat.startsWith('vehicules'))
        .flatMap(([,items])=>items)
      const dispos = vehicules.filter(v => {
        const occupe = reservations.some(r =>
          r.ressource_id===v.id && r.date===form.date_depart && r.statut!=='annulé'
        )
        return !occupe
      })
      setVehiculesDispo(dispos)
    } catch(e) { setVehiculesDispo([]) }
  }, [form.date_depart])

  useEffect(() => {
    load()
    fetch(`${BASE}/api/personnel/?page_size=200`, { headers: hdrs() })
      .then(r=>r.json()).then(d=>setPersonnel(d.results||d||[])).catch(()=>{})
  }, [load])

  const filtered = voyages.filter(v => {
    const q = search.toLowerCase()
    const matchS = !statFilter || v.statut === statFilter
    const matchQ = !q || [v.destination,v.personnel_nom,v.motif].some(x=>(x||'').toLowerCase().includes(q))
    return matchS && matchQ
  })

  const setStatut = async (id, statut) => {
    await fetch(`${BASE}/api/voyages/${id}/`, {
      method:'PATCH', headers:hdrs(), body:JSON.stringify({statut})
    })
    load()
  }

  const counts = st => voyages.filter(v=>v.statut===st).length

  return (
    <div style={{padding:16}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
        marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>🔄 Rotations du Personnel</h1>
          <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
            Sorties et retours au camp · {voyages.length} mouvement(s)
          </div>
        </div>
        <button onClick={()=>setModal(true)}
          style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:10,
            padding:'10px 20px',cursor:'pointer',fontSize:13,fontWeight:700}}>
          + Déclarer une rotation
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:20}}>
        {Object.entries(STATUTS).map(([k,{l,c}])=>(
          <div key={k} onClick={()=>setStatFilter(statFilter===k?'':k)} style={{
            background:'#fff',borderRadius:12,padding:'14px 16px',
            boxShadow:'0 1px 4px rgba(0,0,0,.06)',borderLeft:`4px solid ${c}`,
            cursor:'pointer',opacity:statFilter&&statFilter!==k?.5:1,
            transition:'opacity .2s'}}>
            <div style={{fontSize:24,fontWeight:900,color:c}}>{counts(k)}</div>
            <div style={{fontSize:12,color:'#64748b',fontWeight:600}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher..." style={{...inp,maxWidth:300}}/>
        <select value={statFilter} onChange={e=>setStatFilter(e.target.value)} style={{...inp,maxWidth:180}}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([k,{l}])=><option key={k} value={k}>{l}</option>)}
        </select>
        {statFilter && (
          <button onClick={()=>setStatFilter('')}
            style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'8px 14px',
              cursor:'pointer',fontSize:12,color:'#64748b',fontWeight:700}}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,.06)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
              {['Personnel','Destination','Départ','Retour prévu','Statut','Actions'].map(h=>(
                <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:11,
                  fontWeight:700,color:'#64748b',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>
                Aucune rotation{statFilter?` avec statut "${STATUTS[statFilter]?.l}"`:''}</td></tr>
            ) : filtered.map((v,i)=>{
              const st = STATUTS[v.statut] || {l:v.statut,c:'#64748b'}
              return (
                <tr key={v.id} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'#fff':'#fafafa'}}>
                  <td style={{padding:'12px 16px',fontWeight:600}}>
                    {v.personnel_nom || v.personnel_prenom || v.agent_nom || '—'}
                  </td>
                  <td style={{padding:'12px 16px'}}>{v.destination||'—'}</td>
                  <td style={{padding:'12px 16px'}}>{v.date_depart||'—'}</td>
                  <td style={{padding:'12px 16px'}}>{v.date_retour_prevue||'—'}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{background:st.c+'22',color:st.c,
                      padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>
                      {st.l}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {v.statut==='planifie' && (
                        <button onClick={()=>setStatut(v.id,'en_voyage')}
                          style={{background:'#fff7ed',color:'#ea580c',border:'1px solid #fed7aa',
                            borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          🚌 Partir
                        </button>
                      )}
                      {v.statut==='en_voyage' && (
                        <button onClick={()=>setStatut(v.id,'retour')}
                          style={{background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',
                            borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          ✅ Retour camp
                        </button>
                      )}
                      {v.statut==='planifie' && (
                        <button onClick={()=>setStatut(v.id,'annule')}
                          style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',
                            borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          ✕ Annuler
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal création */}
      {modal && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(false)}
          style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:520,
            boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:20,color:'#1e3a8a'}}>
              🔄 Nouvelle rotation
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>PERSONNEL *</label>
                <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                  <option value="">-- Sélectionner --</option>
                  {personnel.map(p=>(
                    <option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe||'—'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DESTINATION *</label>
                <input value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}
                  placeholder="Ex: Abidjan, Yamoussoukro..." style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>MOTIF</label>
                <input value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})}
                  placeholder="Raison du déplacement..." style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DATE DÉPART *</label>
                  <input type="date" value={form.date_depart} onChange={e=>setForm({...form,date_depart:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>RETOUR PRÉVU *</label>
                  <input type="date" value={form.date_retour_prevue} onChange={e=>setForm({...form,date_retour_prevue:e.target.value})} style={inp}/>
                </div>
              </div>
              {/* Suggestion véhicule disponible */}
              {vehiculesDispo.length > 0 && (
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 14px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:'#16a34a',marginBottom:8}}>
                    🚙 Véhicules disponibles le {form.date_depart}
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {vehiculesDispo.map(v=>(
                      <button key={v.id}
                        onClick={()=>setForm(f=>({...f,vehicule_suggere:`${v.label}${v.immat?` (${v.immat})`:''}`}))}
                        style={{
                          background:form.vehicule_suggere?.includes(v.label)?'#16a34a':'#fff',
                          color:form.vehicule_suggere?.includes(v.label)?'#fff':'#16a34a',
                          border:'1.5px solid #86efac',borderRadius:8,padding:'6px 12px',
                          cursor:'pointer',fontSize:12,fontWeight:700,transition:'all .15s'
                        }}>
                        {v.label}{v.immat&&` · ${v.immat}`}
                      </button>
                    ))}
                  </div>
                  {form.vehicule_suggere && (
                    <div style={{fontSize:11,color:'#16a34a',marginTop:8,fontWeight:600}}>
                      ✅ Véhicule sélectionné: {form.vehicule_suggere}
                    </div>
                  )}
                </div>
              )}
              {vehiculesDispo.length === 0 && form.date_depart && (
                <div style={{background:'#fef3c7',border:'1px solid #fcd34d',borderRadius:10,
                  padding:'10px 14px',fontSize:12,color:'#92400e',fontWeight:600}}>
                  ⚠️ Aucun véhicule disponible pour cette date
                </div>
              )}

              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                <button onClick={()=>setModal(false)}
                  style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',
                    cursor:'pointer',fontSize:13}}>Annuler</button>
                <button onClick={async()=>{
                  if (!form.personnel||!form.destination||!form.date_depart||!form.date_retour_prevue) {
                    alert('Remplissez tous les champs obligatoires (*)')
                    return
                  }
                  const r = await fetch(`${BASE}/api/voyages/`, {
                    method:'POST', headers:hdrs(),
                    body:JSON.stringify({
                      personnel: parseInt(form.personnel),
                      destination: form.destination,
                      motif: `${form.motif}${form.vehicule_suggere?` | Véhicule: ${form.vehicule_suggere}`:''}`,
                      date_depart: form.date_depart,
                      date_retour_prevue: form.date_retour_prevue,
                      statut:'planifie'
                    })
                  })
                  if (r.ok) {
                    setModal(false)
                    setForm({personnel:'',destination:'',motif:'',date_depart:'',date_retour_prevue:''})
                    load()
                  } else {
                    const err = await r.json()
                    alert('Erreur: ' + JSON.stringify(err))
                  }
                }} style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
                  padding:'10px 24px',cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ✅ Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Planning Croisé Rotations × Véhicules ─────── */}
      <div style={{marginTop:24,background:'#fff',borderRadius:16,padding:20,
        boxShadow:'0 2px 8px rgba(0,0,0,.06)',border:'1px solid #e2e8f0'}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1e3a8a',marginBottom:4}}>
          🚙 Planning Croisé — Rotations × Véhicules
        </div>
        <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>
          Disponibilité des véhicules vs rotations planifiées
        </div>
        {(() => {
          const fleet = (() => { try { return Object.values(JSON.parse(localStorage.getItem('rzi_fleet_v1')||'{}')).flat() } catch(e){return[]} })()
          const reservations = (() => { try { return JSON.parse(localStorage.getItem('rzi_reservations_v3')||'[]') } catch(e){return[]} })()
          const today = new Date()
          const days = Array.from({length:7}, (_,i) => {
            const d = new Date(today); d.setDate(today.getDate()+i)
            return d.toISOString().slice(0,10)
          })
          const vehicules = fleet.filter(v=>v.id)
          if (!vehicules.length) return (
            <div style={{textAlign:'center',padding:30,color:'#94a3b8',fontSize:13}}>
              Aucun véhicule dans le catalogue · <button onClick={()=>window.location.href='/reservations'}
                style={{color:'#1e3a8a',background:'none',border:'none',cursor:'pointer',fontWeight:700,textDecoration:'underline'}}>
                Gérer le catalogue →
              </button>
            </div>
          )
          return (
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:600}}>
                <thead>
                  <tr>
                    <th style={{padding:'8px 12px',textAlign:'left',background:'#f8fafc',
                      fontWeight:700,color:'#64748b',fontSize:11,borderBottom:'2px solid #e2e8f0',
                      position:'sticky',left:0,zIndex:1,minWidth:120}}>
                      Véhicule
                    </th>
                    {days.map(d=>(
                      <th key={d} style={{padding:'8px 10px',textAlign:'center',
                        background: d===today.toISOString().slice(0,10)?'#eff6ff':'#f8fafc',
                        fontWeight:700,color: d===today.toISOString().slice(0,10)?'#1e3a8a':'#64748b',
                        fontSize:11,borderBottom:'2px solid #e2e8f0',minWidth:90,borderLeft:'1px solid #e2e8f0'}}>
                        {new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehicules.slice(0,8).map(v=>(
                    <tr key={v.id}>
                      <td style={{padding:'8px 12px',fontWeight:600,color:'#1e293b',
                        background:'#fff',borderBottom:'1px solid #f1f5f9',
                        position:'sticky',left:0,zIndex:1}}>
                        <div>{v.label}</div>
                        {v.immat&&<div style={{fontSize:10,color:'#94a3b8'}}>{v.immat}</div>}
                      </td>
                      {days.map(d=>{
                        const res = reservations.filter(r=>r.ressource_id===v.id&&r.date===d&&r.statut!=='annulé')
                        const rot_day = voyages.filter(voy=>voy.date_depart?.slice(0,10)===d)
                        const isOccupe = res.length > 0
                        return (
                          <td key={d} style={{padding:4,borderBottom:'1px solid #f1f5f9',
                            borderLeft:'1px solid #f1f5f9',background:
                              d===today.toISOString().slice(0,10)?'#fafcff':'#fff'}}>
                            {isOccupe ? (
                              <div style={{background:'#fee2e2',color:'#dc2626',borderRadius:6,
                                padding:'3px 6px',fontSize:10,fontWeight:700,textAlign:'center'}}>
                                🔴 Réservé
                              </div>
                            ) : (
                              <div style={{background:'#dcfce7',color:'#16a34a',borderRadius:6,
                                padding:'3px 6px',fontSize:10,fontWeight:700,textAlign:'center'}}>
                                ✅ Libre
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:8}}>
                Affiche les 8 premiers véhicules · 7 prochains jours
              </div>
            </div>
          )
        })()}
      </div>

    </div>
  )
}
