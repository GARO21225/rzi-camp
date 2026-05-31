import React, { useState, useEffect, useCallback } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({ 'Content-Type':'application/json', 'Authorization':`Bearer ${localStorage.getItem('access_token')||''}` })

const RESSOURCES = [
  { id:'salle_reunion',   label:'🏢 Salle de réunion',     capacite:20, couleur:'#1e3a8a' },
  { id:'salle_formation', label:'🎓 Salle de formation',   capacite:30, couleur:'#7c3aed' },
  { id:'vehicule_a',      label:'🚙 Véhicule A (4x4)',     capacite:7,  couleur:'#f97316' },
  { id:'vehicule_b',      label:'🚙 Véhicule B (Minibus)', capacite:15, couleur:'#ea580c' },
  { id:'vehicule_c',      label:'🚙 Véhicule C (Pick-up)', capacite:4,  couleur:'#dc2626' },
  { id:'groupe_electro',  label:'⚡ Groupe électrogène',   capacite:1,  couleur:'#ca8a04' },
  { id:'equipement_forage',label:'⛏️ Équip. forage',      capacite:1,  couleur:'#64748b' },
  { id:'materiel_hse',    label:'🦺 Matériel HSE',         capacite:1,  couleur:'#16a34a' },
]

const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'10px 12px', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [loading,      setLoading]      = useState(false)
  const [modal,        setModal]        = useState(false)
  const [filter,       setFilter]       = useState('')
  const [filterDate,   setFilterDate]   = useState('')
  const [form, setForm] = useState({
    ressource: '', date: '', heure_debut: '', heure_fin: '',
    motif: '', demandeur: ''
  })

  // Utiliser localStorage pour les réservations (pas de modèle backend dédié)
  const STORAGE_KEY = 'rzi_reservations_v1'

  const load = useCallback(() => {
    setLoading(true)
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setReservations(stored.sort((a,b) => (a.date+a.heure_debut).localeCompare(b.date+b.heure_debut)))
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = (newRes) => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    stored.push({ ...newRes, id: Date.now(), statut: 'confirmé', cree_le: new Date().toISOString() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    load()
  }

  const cancel = (id) => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const updated = stored.map(r => r.id === id ? {...r, statut:'annulé'} : r)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    load()
  }

  const today = new Date().toISOString().slice(0,10)
  const filtered = reservations.filter(r => {
    const matchRes = !filter || r.ressource === filter
    const matchDate = !filterDate || r.date === filterDate
    return matchRes && matchDate
  })

  // Grouper par date
  const byDate = {}
  filtered.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = []
    byDate[r.date].push(r)
  })

  const getRessource = (id) => RESSOURCES.find(r=>r.id===id) || {label:id, couleur:'#64748b'}

  const checkConflict = (f) => {
    return reservations.some(r =>
      r.ressource === f.ressource && r.date === f.date && r.statut !== 'annulé' &&
      !(f.heure_fin <= r.heure_debut || f.heure_debut >= r.heure_fin)
    )
  }

  return (
    <div style={{padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>📅 Réservation de Ressources</h1>
          <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
            Salles · Véhicules · Équipements partagés
          </div>
        </div>
        <button onClick={()=>setModal(true)}
          style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:10,
            padding:'10px 20px',cursor:'pointer',fontSize:13,fontWeight:700}}>
          + Nouvelle réservation
        </button>
      </div>

      {/* Grille ressources */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10,marginBottom:20}}>
        {RESSOURCES.map(r => {
          const today_res = reservations.filter(rv=>rv.ressource===r.id&&rv.date===today&&rv.statut!=='annulé').length
          return (
            <div key={r.id} onClick={()=>setFilter(filter===r.id?'':r.id)}
              style={{background:filter===r.id?r.couleur+'15':'#fff',
                border:`2px solid ${filter===r.id?r.couleur:'#e2e8f0'}`,
                borderRadius:12,padding:'12px 14px',cursor:'pointer',transition:'all .15s'}}>
              <div style={{fontSize:14,fontWeight:700,color:r.couleur}}>{r.label}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:4}}>
                {today_res > 0 ? `🔴 ${today_res} résa aujourd'hui` : '🟢 Disponible'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Filtres */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{...inp,maxWidth:180}}/>
        {(filter||filterDate) && (
          <button onClick={()=>{setFilter('');setFilterDate('')}}
            style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'8px 14px',cursor:'pointer',fontSize:12,color:'#64748b',fontWeight:700}}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Calendrier/liste */}
      {Object.keys(byDate).length === 0 ? (
        <div style={{textAlign:'center',padding:60,color:'#94a3b8',background:'#fff',borderRadius:12}}>
          <div style={{fontSize:40,marginBottom:12}}>📅</div>
          <div>Aucune réservation{filter?` pour ${getRessource(filter).label}`:''}</div>
        </div>
      ) : Object.entries(byDate).sort().map(([date, items]) => (
        <div key={date} style={{marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:14,color:'#1e3a8a',marginBottom:8,
            padding:'6px 12px',background:'#eff6ff',borderRadius:8,display:'inline-block'}}>
            📅 {date === today ? 'Aujourd\'hui' : new Date(date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {items.map(r => {
              const res = getRessource(r.ressource)
              return (
                <div key={r.id} style={{background:'#fff',borderRadius:12,padding:'14px 16px',
                  border:`2px solid ${r.statut==='annulé'?'#e2e8f0':res.couleur+'40'}`,
                  display:'flex',alignItems:'center',gap:16,opacity:r.statut==='annulé'?.5:1}}>
                  <div style={{width:6,height:50,borderRadius:99,background:r.statut==='annulé'?'#e2e8f0':res.couleur,flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{res.label}</div>
                    <div style={{fontSize:12,color:'#64748b'}}>
                      🕐 {r.heure_debut} – {r.heure_fin} · 👤 {r.demandeur}
                    </div>
                    {r.motif && <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{r.motif}</div>}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{background:r.statut==='annulé'?'#f1f5f9':'#dcfce7',
                      color:r.statut==='annulé'?'#94a3b8':'#16a34a',
                      padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>
                      {r.statut}
                    </span>
                    {r.statut !== 'annulé' && (
                      <button onClick={()=>{if(window.confirm('Annuler cette réservation ?')) cancel(r.id)}}
                        style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',
                          borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                        ✕ Annuler
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Modal création */}
      {modal && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(false)}
          style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:520,
            boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:20,color:'#1e3a8a'}}>
              📅 Nouvelle réservation
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>RESSOURCE *</label>
                <select value={form.ressource} onChange={e=>setForm({...form,ressource:e.target.value})} style={inp}>
                  <option value="">-- Sélectionner --</option>
                  {RESSOURCES.map(r=><option key={r.id} value={r.id}>{r.label} (max {r.capacite} pers.)</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DEMANDEUR *</label>
                <input value={form.demandeur} onChange={e=>setForm({...form,demandeur:e.target.value})}
                  placeholder="Votre nom..." style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DATE *</label>
                  <input type="date" value={form.date} min={today}
                    onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DÉBUT *</label>
                  <input type="time" value={form.heure_debut}
                    onChange={e=>setForm({...form,heure_debut:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>FIN *</label>
                  <input type="time" value={form.heure_fin}
                    onChange={e=>setForm({...form,heure_fin:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>MOTIF</label>
                <input value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})}
                  placeholder="Objet de la réservation..." style={inp}/>
              </div>
              {form.ressource && form.date && form.heure_debut && form.heure_fin && checkConflict(form) && (
                <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:9,
                  padding:'10px 14px',color:'#dc2626',fontSize:13,fontWeight:600}}>
                  ⚠️ Conflit détecté — cette ressource est déjà réservée sur ce créneau
                </div>
              )}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                <button onClick={()=>setModal(false)}
                  style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={()=>{
                  if (!form.ressource||!form.demandeur||!form.date||!form.heure_debut||!form.heure_fin) {
                    alert('Remplissez tous les champs obligatoires'); return
                  }
                  if (checkConflict(form)) { alert('Conflit de réservation!'); return }
                  save(form)
                  setModal(false)
                  setForm({ressource:'',date:'',heure_debut:'',heure_fin:'',motif:'',demandeur:''})
                }} style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
                  padding:'10px 24px',cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ✅ Réserver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
