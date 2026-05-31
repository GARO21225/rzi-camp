import React, { useState, useEffect, useCallback } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const token = () => localStorage.getItem('access_token') || ''
const headers = () => ({ 'Content-Type':'application/json', 'Authorization':`Bearer ${token()}` })

export default function RotationsPage() {
  const [rotations, setRotations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [form,      setForm]      = useState({
    personnel_id:'', date_depart:'', date_retour:'',
    site_depart:'Camp Roxgold Sango', site_arrivee:'',
    type_rotation:'depart', notes:''
  })
  const [personnel, setPersonnel] = useState([])
  const [search,    setSearch]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Rotations = voyages avec type rotation
      const r = await fetch(`${BASE}/api/voyages/?page_size=200`, { headers: headers() })
      const d = await r.json()
      setRotations(d.results || d || [])
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch(`${BASE}/api/personnel/?page_size=200`, { headers: headers() })
      .then(r=>r.json()).then(d=>setPersonnel(d.results||d||[])).catch(()=>{})
  }, [load])

  const filtered = rotations.filter(r => {
    const q = search.toLowerCase()
    return !q || [r.destination, r.agent_nom, r.personnel_nom].some(v=>(v||'').toLowerCase().includes(q))
  })

  const statColor = s => ({
    'prevu':'#3b82f6','en_route':'#f97316','arrive':'#16a34a','annule':'#94a3b8'
  }[s]||'#64748b')

  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9,
    padding:'10px 12px', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }

  return (
    <div style={{padding:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>🔄 Gestion des Rotations</h1>
          <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
            Entrées et sorties du camp · {rotations.length} mouvement(s)
          </div>
        </div>
        <button onClick={()=>setModal(true)}
          style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:10,
            padding:'10px 20px',cursor:'pointer',fontSize:13,fontWeight:700}}>
          + Déclarer une rotation
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:12,marginBottom:20}}>
        {[
          ['🚀 Départs',   rotations.filter(r=>r.statut==='prevu').length,   '#3b82f6'],
          ['🚌 En route',  rotations.filter(r=>r.statut==='en_route').length, '#f97316'],
          ['✅ Arrivés',   rotations.filter(r=>r.statut==='arrive').length,   '#16a34a'],
          ['❌ Annulés',   rotations.filter(r=>r.statut==='annule').length,   '#94a3b8'],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:'#fff',borderRadius:12,padding:'14px 16px',
            boxShadow:'0 1px 4px rgba(0,0,0,.06)',borderLeft:`4px solid ${c}`}}>
            <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
            <div style={{fontSize:11,color:'#64748b',fontWeight:600}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div style={{marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher par nom, destination..."
          style={{...inp,maxWidth:360}}/>
      </div>

      {/* Liste */}
      <div style={{background:'#fff',borderRadius:12,boxShadow:'0 1px 4px rgba(0,0,0,.06)',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
              {['Personnel','Départ','Retour','Destination','Statut','Actions'].map(h=>(
                <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:11,
                  fontWeight:700,color:'#64748b',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Aucune rotation</td></tr>
            ) : filtered.map((r,i)=>(
              <tr key={r.id} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'#fff':'#fafafa'}}>
                <td style={{padding:'12px 16px',fontWeight:600}}>{r.agent_nom||r.personnel_nom||'—'}</td>
                <td style={{padding:'12px 16px'}}>{r.date_depart?.slice(0,10)||'—'}</td>
                <td style={{padding:'12px 16px'}}>{r.date_retour?.slice(0,10)||'—'}</td>
                <td style={{padding:'12px 16px'}}>{r.destination||'—'}</td>
                <td style={{padding:'12px 16px'}}>
                  <span style={{background:statColor(r.statut)+'22',color:statColor(r.statut),
                    padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>
                    {r.statut||'prévu'}
                  </span>
                </td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:6}}>
                    {['en_route','arrive'].includes(r.statut) ? null : (
                      <button onClick={async()=>{
                        await fetch(`${BASE}/api/voyages/${r.id}/`,{
                          method:'PATCH',headers:headers(),
                          body:JSON.stringify({statut:'en_route'})
                        })
                        load()
                      }} style={{background:'#fff7ed',color:'#ea580c',border:'1px solid #fed7aa',
                        borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                        🚌 En route
                      </button>
                    )}
                    {r.statut==='en_route' && (
                      <button onClick={async()=>{
                        await fetch(`${BASE}/api/voyages/${r.id}/`,{
                          method:'PATCH',headers:headers(),
                          body:JSON.stringify({statut:'arrive'})
                        })
                        load()
                      }} style={{background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',
                        borderRadius:7,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                        ✅ Arrivé
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal création */}
      {modal && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(false)}
          style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:500,
            boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:20,color:'#1e3a8a'}}>
              🔄 Nouvelle rotation
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>
                  PERSONNEL *
                </label>
                <select value={form.personnel_id} onChange={e=>setForm({...form,personnel_id:e.target.value})} style={inp}>
                  <option value="">-- Sélectionner --</option>
                  {personnel.map(p=>(
                    <option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe||'—'}</option>
                  ))}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DATE DÉPART *</label>
                  <input type="date" value={form.date_depart} onChange={e=>setForm({...form,date_depart:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DATE RETOUR</label>
                  <input type="date" value={form.date_retour} onChange={e=>setForm({...form,date_retour:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DESTINATION *</label>
                <input value={form.site_arrivee} onChange={e=>setForm({...form,site_arrivee:e.target.value})}
                  placeholder="Ex: Abidjan, Dakar, Site principal..." style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>NOTES</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}
                  rows={2} style={{...inp,resize:'vertical'}} placeholder="Motif, détails..."/>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                <button onClick={()=>setModal(false)}
                  style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={async()=>{
                  if (!form.personnel_id||!form.date_depart||!form.site_arrivee) {
                    alert('Remplissez les champs obligatoires')
                    return
                  }
                  await fetch(`${BASE}/api/voyages/`,{
                    method:'POST', headers:headers(),
                    body:JSON.stringify({
                      personnel: form.personnel_id,
                      date_depart: form.date_depart,
                      date_retour: form.date_retour||null,
                      destination: form.site_arrivee,
                      notes: form.notes,
                      statut:'prevu'
                    })
                  })
                  setModal(false)
                  setForm({personnel_id:'',date_depart:'',date_retour:'',site_depart:'Camp Roxgold Sango',site_arrivee:'',type_rotation:'depart',notes:''})
                  load()
                }} style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
                  padding:'10px 24px',cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ✅ Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
