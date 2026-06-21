import React, { useState, useEffect, useCallback } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('access_token')||''}`})
const STORAGE_KEY = 'rzi_reservations_v3'
const FLEET_KEY   = 'rzi_fleet_v1'

// ── Catalogue initial (modifiable) ─────────────────────────────
const DEFAULT_FLEET = {
  salles: [
    { id:'salle_reunion',        cat:'salles',    label:'Salle de réunion',      capacite:20, detail:'Vidéoprojecteur, tableau blanc, climatisée', couleur:'#1e3a8a', photo:'' },
    { id:'bureau_communautaire', cat:'salles',    label:'Bureau communautaire',  capacite:10, detail:'Espace de travail partagé, imprimante',       couleur:'#2563eb', photo:'' },
  ],
  vehicules_4x4: [
    { id:'4x4_a', cat:'vehicules_4x4', label:'Land Cruiser A', capacite:7,  immat:'CI-1234-AB', km:45230, carburant:'Diesel', couleur:'#f97316', photo:'' },
    { id:'4x4_b', cat:'vehicules_4x4', label:'Land Cruiser B', capacite:7,  immat:'CI-5678-CD', km:38100, carburant:'Diesel', couleur:'#ea580c', photo:'' },
  ],
  vehicules_pickup: [
    { id:'pickup_a', cat:'vehicules_pickup', label:'Hilux A', capacite:4, immat:'CI-9012-EF', km:62400, carburant:'Diesel', couleur:'#dc2626', photo:'' },
    { id:'pickup_b', cat:'vehicules_pickup', label:'Hilux B', capacite:4, immat:'CI-3456-GH', km:57800, carburant:'Diesel', couleur:'#b91c1c', photo:'' },
  ],
  vehicules_minibus: [
    { id:'minibus', cat:'vehicules_minibus', label:'Toyota Hiace', capacite:15, immat:'CI-7890-IJ', km:31200, carburant:'Diesel', couleur:'#7c3aed', photo:'' },
  ],
  materiels_hse: [
    { id:'epi_complet',  cat:'materiels_hse',  label:'Kit EPI complet',          detail:'Casque, gilet, gants, lunettes, chaussures sécu', couleur:'#16a34a', photo:'' },
    { id:'epi_hauteur',  cat:'materiels_hse',  label:'EPI Travail en hauteur',   detail:'Harnais, longe, casque avec jugulaire',           couleur:'#15803d', photo:'' },
  ],
  materiels_engins: [
    { id:'nacelle',      cat:'materiels_engins', label:'Nacelle élévatrice',  detail:'Hauteur max 12m, homologuée, 2 pers.',  couleur:'#ca8a04', photo:'' },
    { id:'tractopelle',  cat:'materiels_engins', label:'Tractopelle',         detail:'Godet + chargeur frontal, diesel',      couleur:'#d97706', photo:'' },
    { id:'generateur',   cat:'materiels_engins', label:'Groupe électrogène',  detail:'50kVA, diesel, silencieux',             couleur:'#92400e', photo:'' },
  ],
}

const CAT_META = {
  salles:           { label:'🏢 Salles',        group:'Salles' },
  vehicules_4x4:    { label:'🚙 4x4',           group:'Véhicules' },
  vehicules_pickup:  { label:'🛻 Pick-up',      group:'Véhicules' },
  vehicules_minibus: { label:'🚌 Mini-Bus',     group:'Véhicules' },
  materiels_hse:    { label:'🦺 Équip. HSE',    group:'Matériels' },
  materiels_engins: { label:'⚙️ Engins',        group:'Matériels' },
}

const TABS = [
  { id:'salles',           label:'🏢 Salles' },
  { id:'vehicules',        label:'🚙 Véhicules' },
  { id:'materiels',        label:'⚙️ Matériels' },
]

const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}
const today = new Date().toISOString().slice(0,10)

// ── Fiche ressource (éditable) ──────────────────────────────────
function ResourceFiche({ item, onSave, onClose }) {
  const [data, setData] = useState({...item})
  const s = v => setData(d=>({...d,...v}))

  const isVehicule = item.cat?.startsWith('vehicules')
  const isMatériel = item.cat?.startsWith('materiels')

  const handlePhoto = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => s({photo: ev.target.result})
    reader.readAsDataURL(file)
  }

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
        display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000,padding:20}}>
      <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480,
        boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{fontWeight:800,fontSize:16,color:'#1e3a8a',marginBottom:20}}>
          ✏️ Fiche — {data.label}
        </div>

        {/* Photo */}
        <div style={{marginBottom:16,textAlign:'center'}}>
          {data.photo ? (
            <div style={{position:'relative',display:'inline-block'}}>
              <img src={data.photo} alt="" style={{width:'100%',maxHeight:200,objectFit:'cover',borderRadius:12}}/>
              <button onClick={()=>s({photo:''})}
                style={{position:'absolute',top:8,right:8,background:'#dc2626',color:'#fff',border:'none',
                  borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:14}}>✕</button>
            </div>
          ) : (
            <label style={{display:'block',border:'2px dashed #e2e8f0',borderRadius:12,
              padding:24,cursor:'pointer',color:'#94a3b8',fontSize:13}}>
              📷 Ajouter une photo
              <input type="file" accept="image/*" onChange={handlePhoto} style={{display:'none'}}/>
            </label>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>NOM</label>
            <input value={data.label} onChange={e=>s({label:e.target.value})} style={inp}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DESCRIPTION / DÉTAILS</label>
            <input value={data.detail||''} onChange={e=>s({detail:e.target.value})} style={inp}/>
          </div>
          {(isVehicule) && (<>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>IMMATRICULATION</label>
                <input value={data.immat||''} onChange={e=>s({immat:e.target.value})} placeholder="CI-XXXX-XX" style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>KILOMÉTRAGE</label>
                <input type="number" value={data.km||0} onChange={e=>s({km:parseInt(e.target.value)||0})} style={inp}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>CAPACITÉ (pers.)</label>
                <input type="number" value={data.capacite||0} onChange={e=>s({capacite:parseInt(e.target.value)||0})} style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>CARBURANT</label>
                <select value={data.carburant||'Diesel'} onChange={e=>s({carburant:e.target.value})} style={inp}>
                  {['Diesel','Essence','Hybride','Électrique'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>ASSURANCE (expiration)</label>
              <input type="date" value={data.assurance||''} onChange={e=>s({assurance:e.target.value})} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>PROCHAIN ENTRETIEN (km)</label>
              <input type="number" value={data.entretien_km||''} onChange={e=>s({entretien_km:parseInt(e.target.value)||0})} style={inp}/>
            </div>
          </>)}
          {isMatériel && (
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>N° SÉRIE / MATRICULE</label>
              <input value={data.immat||''} onChange={e=>s({immat:e.target.value})} placeholder="SN-XXXX" style={inp}/>
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:20}}>
          <button onClick={onClose}
            style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
            Annuler
          </button>
          <button onClick={()=>{onSave(data);onClose()}}
            style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
              padding:'10px 24px',cursor:'pointer',fontSize:13,fontWeight:700}}>
            💾 Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Carte ressource ─────────────────────────────────────────────
function ResourceCard({ item, reservations, onReserver, onEdit }) {
  const occupied = reservations.some(r => r.ressource_id===item.id && r.date===today && r.statut!=='annulé')
  return (
    <div style={{background:'#fff',borderRadius:14,overflow:'hidden',
      border:`2px solid ${occupied?'#fecaca':'#e2e8f0'}`,
      boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
      {/* Photo */}
      {item.photo ? (
        <img src={item.photo} alt="" style={{width:'100%',height:120,objectFit:'cover'}}/>
      ) : (
        <div style={{height:80,background:`linear-gradient(135deg,${item.couleur}22,${item.couleur}44)`,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>
          {item.cat?.startsWith('vehicules_4x4')?'🚙':item.cat?.startsWith('vehicules_pickup')?'🛻':
           item.cat?.startsWith('vehicules_minibus')?'🚌':item.cat?.startsWith('materiels_hse')?'🦺':
           item.cat?.startsWith('materiels_engins')?'⚙️':'🏢'}
        </div>
      )}
      <div style={{padding:'12px 14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
          <div style={{fontWeight:700,fontSize:13,color:'#1e293b',flex:1}}>{item.label}</div>
          <span style={{background:occupied?'#fee2e2':'#dcfce7',color:occupied?'#dc2626':'#16a34a',
            padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700,flexShrink:0,marginLeft:6}}>
            {occupied?'🔴 Réservé':'✅ Libre'}
          </span>
        </div>
        {item.immat && <div style={{fontSize:11,color:'#64748b',marginBottom:2}}>🪪 {item.immat}</div>}
        {item.km > 0 && <div style={{fontSize:11,color:'#64748b',marginBottom:2}}>📍 {item.km.toLocaleString()} km</div>}
        {item.capacite > 1 && <div style={{fontSize:11,color:'#64748b',marginBottom:2}}>👥 {item.capacite} pers. max</div>}
        {item.detail && <div style={{fontSize:10,color:'#94a3b8',marginBottom:10,lineHeight:1.4}}>{item.detail}</div>}
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>onEdit(item)}
            style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'7px 10px',
              cursor:'pointer',fontSize:11,fontWeight:600,color:'#64748b'}}>
            ✏️
          </button>
          <button onClick={()=>onReserver(item)}
            style={{flex:1,background:item.couleur,color:'#fff',border:'none',borderRadius:8,
              padding:'8px',cursor:'pointer',fontSize:12,fontWeight:700}}>
            + Réserver
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ─────────────────────────────────────────────
export default function ReservationsPage() {
  const [fleet,        setFleet]       = useState(DEFAULT_FLEET)
  const [reservations, setReservations]= useState([])
  const [personnel,    setPersonnel]   = useState([])
  const [modal,        setModal]       = useState(null)
  const [ficheEdit,    setFicheEdit]   = useState(null)
  const [qrModal,      setQrModal]      = useState(null)   // réservation dont afficher le QR
  const [showCatalogue,setShowCatalogue]= useState(false)
  const [newResource,  setNewResource]  = useState({cat:'vehicules_4x4',label:'',immat:'',km:0,capacite:4,detail:'',carburant:'Diesel',couleur:'#1e3a8a',photo:'',id:''})
  const [activeTab,    setActiveTab]   = useState('salles')
  const [filterDate,   setFilterDate]  = useState('')
  const [msg,          setMsg]         = useState(null)
  const [form, setForm] = useState({date:'',heure_debut:'',heure_fin:'',motif:'',demandeur:''})

  // Charger données persistées
  useEffect(() => {
    try { setReservations(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')) } catch(e) {}
    try {
      const saved = JSON.parse(localStorage.getItem(FLEET_KEY)||'{}')
      if (Object.keys(saved).length) setFleet(saved)
    } catch(e) {}
    // Charger personnel
    fetch(`${BASE}/api/personnel/?page_size=500`, {headers:hdrs()})
      .then(r=>r.json()).then(d=>setPersonnel(d.results||d||[])).catch(()=>{})
  }, [])

  const saveFleet = (newFleet) => {
    setFleet(newFleet)
    localStorage.setItem(FLEET_KEY, JSON.stringify(newFleet))
  }

  const saveReservation = () => {
    if (!form.demandeur||!form.date||!form.heure_debut||!form.heure_fin) {
      setMsg({ok:false,text:'Remplissez tous les champs obligatoires'}); return
    }
    const conflict = reservations.some(r =>
      r.ressource_id===modal.id && r.date===form.date && r.statut!=='annulé' &&
      !(form.heure_fin<=r.heure_debut || form.heure_debut>=r.heure_fin))
    if (conflict) { setMsg({ok:false,text:'⚠️ Conflit sur ce créneau'}); return }
    const stored = [...reservations, {
      id:Date.now(), ressource_id:modal.id, ressource_label:modal.label,
      immat:modal.immat||'', cat:modal.cat||'',
      ...form, statut:'confirmé', cree_le:new Date().toISOString()
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setReservations(stored)
    setModal(null); setMsg(null)
    // Proposer le QR pour les véhicules
    if (modal.cat?.startsWith('vehicules')) {
      const newRes = stored[stored.length-1]
      setQrModal(newRes)
    }
    setForm({date:'',heure_debut:'',heure_fin:'',motif:'',demandeur:''})
  }

  const cancel = id => {
    const updated = reservations.map(r=>r.id===id?{...r,statut:'annulé'}:r)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setReservations(updated)
  }

  const updateItem = (updatedItem) => {
    const newFleet = {}
    Object.entries(fleet).forEach(([cat, items]) => {
      newFleet[cat] = items.map(i => i.id===updatedItem.id ? updatedItem : i)
    })
    saveFleet(newFleet)
  }

  // Items à afficher selon l'onglet actif
  const getTabItems = () => {
    if (activeTab==='salles') return fleet.salles||[]
    if (activeTab==='vehicules') return [
      ...(fleet.vehicules_4x4||[]),
      ...(fleet.vehicules_pickup||[]),
      ...(fleet.vehicules_minibus||[]),
    ]
    if (activeTab==='materiels') return [
      ...(fleet.materiels_hse||[]),
      ...(fleet.materiels_engins||[]),
    ]
    return []
  }

  const getCatLabel = (cat) => CAT_META[cat]?.label || cat

  const filtered = reservations
    .filter(r => !filterDate || r.date===filterDate)
    .sort((a,b)=>(a.date+a.heure_debut).localeCompare(b.date+b.heure_debut))

  const tabItems = getTabItems()

  // Grouper les véhicules et matériels par catégorie
  const groupedItems = {}
  tabItems.forEach(item => {
    const g = getCatLabel(item.cat)
    if (!groupedItems[g]) groupedItems[g] = []
    groupedItems[g].push(item)
  })

  const allItems = Object.values(fleet).flat()

  return (
    <div style={{padding:16}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>📅 Réservations de Ressources</h1>
          <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
            Salles · Véhicules · Matériels · {reservations.filter(r=>r.date===today&&r.statut!=='annulé').length} réservation(s) aujourd'hui
          </div>
        </div>
        <button onClick={()=>setShowCatalogue(true)}
          style={{background:'#f1f5f9',border:'2px solid #e2e8f0',borderRadius:10,
            padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:700,color:'#1e3a8a'}}>
          ⚙️ Gérer le catalogue
        </button>
      </div>

      {/* KPIs */}
      {(() => {
        const todayRes  = reservations.filter(r=>r.date===today&&r.statut!=='annulé')
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-6)
        const weekStr   = weekStart.toISOString().slice(0,10)
        const weekRes   = reservations.filter(r=>r.date>=weekStr&&r.statut!=='annulé')
        const cancelled = reservations.filter(r=>r.statut==='annulé').length
        return (
          <div style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:12,marginBottom:20}}>
            {[
              {l:"Aujourd'hui",  v:todayRes.length,  c:'#1e3a8a', bg:'#eff6ff', icon:'📅'},
              {l:'Cette semaine',v:weekRes.length,    c:'#7c3aed', bg:'#f5f3ff', icon:'📊'},
              {l:'Total',        v:reservations.filter(r=>r.statut!=='annulé').length, c:'#16a34a', bg:'#f0fdf4', icon:'✅'},
              {l:'Annulées',     v:cancelled,         c:'#dc2626', bg:'#fef2f2', icon:'❌'},
            ].map(({l,v,c,bg,icon})=>(
              <div key={l} style={{background:bg,borderRadius:12,padding:'14px 16px',
                borderLeft:`4px solid ${c}`,boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                <div style={{fontSize:24,fontWeight:900,color:c}}>{icon} {v}</div>
                <div style={{fontSize:11,color:'#64748b',fontWeight:600,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Onglets */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:'9px 20px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,
              background:activeTab===t.id?'#1e3a8a':'#f1f5f9',
              color:activeTab===t.id?'#fff':'#64748b',transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Grille par sous-catégorie */}
      {activeTab==='salles' ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:14,marginBottom:24}}>
          {tabItems.map(item=>(
            <ResourceCard key={item.id} item={item} reservations={reservations}
              onReserver={i=>{setModal(i);setMsg(null)}}
              onEdit={i=>setFicheEdit(i)}/>
          ))}
        </div>
      ) : (
        Object.entries(groupedItems).map(([groupLabel, items])=>(
          <div key={groupLabel} style={{marginBottom:24}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e3a8a',marginBottom:12,
              display:'flex',alignItems:'center',gap:8}}>
              <span style={{background:'#eff6ff',padding:'4px 14px',borderRadius:20}}>{groupLabel}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
              {items.map(item=>(
                <ResourceCard key={item.id} item={item} reservations={reservations}
                  onReserver={i=>{setModal(i);setMsg(null)}}
                  onEdit={i=>setFicheEdit(i)}/>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Planning */}
      <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <div style={{fontWeight:800,fontSize:16,color:'#1e3a8a'}}>📋 Historique des réservations</div>
          <div style={{display:'flex',gap:8}}>
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{...inp,maxWidth:180}}/>
            {filterDate&&<button onClick={()=>setFilterDate('')}
              style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'8px 12px',cursor:'pointer',color:'#64748b'}}>✕</button>}
          </div>
        </div>
        {filtered.length===0 ? (
          <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>
            <div style={{fontSize:36,marginBottom:8}}>📅</div>Aucune réservation
          </div>
        ) : filtered.map(r=>{
          const item = allItems.find(i=>i.id===r.ressource_id)||{couleur:'#64748b'}
          return (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',
              borderRadius:10,marginBottom:8,background:'#fff',
              border:`1.5px solid ${r.statut==='annulé'?'#e2e8f0':item.couleur+'40'}`,
              opacity:r.statut==='annulé'?.5:1}}>
              <div style={{width:5,height:44,borderRadius:99,background:r.statut==='annulé'?'#e2e8f0':item.couleur,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13}}>{r.ressource_label}{r.immat&&` · ${r.immat}`}</div>
                <div style={{fontSize:12,color:'#64748b'}}>📅 {r.date} · 🕐 {r.heure_debut}–{r.heure_fin} · 👤 {r.demandeur}</div>
                {r.motif&&<div style={{fontSize:11,color:'#94a3b8'}}>{r.motif}</div>}
              </div>
              <span style={{background:r.statut==='annulé'?'#f1f5f9':'#dcfce7',
                color:r.statut==='annulé'?'#94a3b8':'#16a34a',
                padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,flexShrink:0}}>
                {r.statut}
              </span>
              {r.statut!=='annulé'&&(<>
                {r.cat?.startsWith('vehicules') && (
                  <button onClick={()=>setQrModal(r)}
                    style={{background:'#eff6ff',color:'#1e3a8a',border:'1px solid #bfdbfe',
                      borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                    📱 QR
                  </button>
                )}
                <button onClick={()=>{if(confirm('Annuler?'))cancel(r.id)}}
                  style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',
                    borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>✕</button>
              </>)}
            </div>
          )
        })}
      </div>

      {/* Modal réservation */}
      {modal&&(
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)}
          style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:500,
            boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
            {/* En-tête avec photo si dispo */}
            <div style={{background:`linear-gradient(135deg,${modal.couleur},${modal.couleur}cc)`,
              borderRadius:12,marginBottom:20,overflow:'hidden'}}>
              {modal.photo&&<img src={modal.photo} alt="" style={{width:'100%',height:120,objectFit:'cover',opacity:.7}}/>}
              <div style={{padding:'14px 18px',color:'#fff'}}>
                <div style={{fontWeight:800,fontSize:16}}>{modal.label}</div>
                {modal.immat&&<div style={{fontSize:12,opacity:.9}}>🪪 {modal.immat}</div>}
                {modal.km>0&&<div style={{fontSize:12,opacity:.9}}>📍 {modal.km?.toLocaleString()} km</div>}
                {modal.capacite>1&&<div style={{fontSize:12,opacity:.9}}>👥 Max {modal.capacite} personnes</div>}
                {modal.detail&&<div style={{fontSize:11,opacity:.8,marginTop:4}}>{modal.detail}</div>}
              </div>
            </div>

            {msg&&(
              <div style={{background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,
                borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:13,color:msg.ok?'#16a34a':'#dc2626',fontWeight:600}}>
                {msg.text}
              </div>
            )}

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DEMANDEUR *</label>
                <input
                  value={form.demandeur}
                  onChange={e=>setForm({...form,demandeur:e.target.value})}
                  list="personnel-list-demandeur"
                  placeholder="Saisir ou sélectionner un nom..."
                  style={inp}/>
                <datalist id="personnel-list-demandeur">
                  {personnel.map(p=>(
                    <option key={p.id} value={`${p.nom} ${p.prenom}`}/>
                  ))}
                </datalist>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DATE *</label>
                <input type="date" value={form.date} min={today}
                  onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DÉBUT *</label>
                  <input type="time" value={form.heure_debut} onChange={e=>setForm({...form,heure_debut:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>FIN *</label>
                  <input type="time" value={form.heure_fin} onChange={e=>setForm({...form,heure_fin:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>MOTIF / OBJET</label>
                <input value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})}
                  placeholder="Réunion de chantier, transport équipe..." style={inp}/>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                <button onClick={()=>{setModal(null);setMsg(null)}}
                  style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={saveReservation}
                  style={{background:modal.couleur,color:'#fff',border:'none',borderRadius:9,
                    padding:'10px 24px',cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ✅ Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal fiche édition */}
      {ficheEdit&&(
        <ResourceFiche item={ficheEdit}
          onSave={updated=>updateItem(updated)}
          onClose={()=>setFicheEdit(null)}/>
      )}
      {/* Modal Catalogue - Gestion des ressources */}
      {showCatalogue && (
        <div onClick={e=>e.target===e.currentTarget&&setShowCatalogue(false)}
          style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2500,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:700,
            maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{padding:'20px 24px',borderBottom:'2px solid #f1f5f9',display:'flex',
              justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:800,fontSize:17,color:'#1e3a8a'}}>⚙️ Catalogue des ressources</div>
              <button onClick={()=>setShowCatalogue(false)}
                style={{background:'#f1f5f9',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:24}}>
              {/* Liste par catégorie */}
              {Object.entries(fleet).map(([cat, items])=>(
                <div key={cat} style={{marginBottom:20}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#1e3a8a',marginBottom:8,
                    background:'#eff6ff',padding:'6px 12px',borderRadius:8}}>
                    {CAT_META[cat]?.label||cat}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {items.map(item=>(
                      <div key={item.id} style={{display:'flex',alignItems:'center',gap:12,
                        padding:'8px 12px',background:'#f8fafc',borderRadius:8}}>
                        {item.photo && <img src={item.photo} style={{width:40,height:40,objectFit:'cover',borderRadius:6}}/>}
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13}}>{item.label}</div>
                          <div style={{fontSize:11,color:'#64748b'}}>
                            {item.immat&&`🪪 ${item.immat} · `}{item.km>0&&`📍 ${item.km?.toLocaleString()} km · `}{item.detail}
                          </div>
                        </div>
                        <button onClick={()=>setFicheEdit(item)}
                          style={{background:'#eff6ff',color:'#1e3a8a',border:'none',borderRadius:7,
                            padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          ✏️ Modifier
                        </button>
                        <button onClick={()=>{
                          if(!confirm(`Supprimer ${item.label} ?`)) return
                          const nf={...fleet,[cat]:items.filter(i=>i.id!==item.id)}
                          saveFleet(nf)
                        }} style={{background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:7,
                          padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Formulaire ajout */}
              <div style={{background:'#f0fdf4',border:'2px solid #bbf7d0',borderRadius:12,padding:18,marginTop:12}}>
                <div style={{fontWeight:700,fontSize:14,color:'#16a34a',marginBottom:14}}>➕ Ajouter une ressource</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>CATÉGORIE</label>
                    <select value={newResource.cat} onChange={e=>setNewResource(n=>({...n,cat:e.target.value}))} style={inp}>
                      {Object.entries(CAT_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>NOM *</label>
                    <input value={newResource.label} onChange={e=>setNewResource(n=>({...n,label:e.target.value}))}
                      placeholder="Ex: Land Cruiser C" style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>IMMAT / N° SÉRIE</label>
                    <input value={newResource.immat} onChange={e=>setNewResource(n=>({...n,immat:e.target.value}))}
                      placeholder="CI-XXXX-XX" style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>CAPACITÉ (pers.)</label>
                    <input type="number" value={newResource.capacite} onChange={e=>setNewResource(n=>({...n,capacite:parseInt(e.target.value)||1}))} style={inp}/>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DESCRIPTION</label>
                    <input value={newResource.detail} onChange={e=>setNewResource(n=>({...n,detail:e.target.value}))}
                      placeholder="Caractéristiques..." style={inp}/>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>PHOTO</label>
                    <label style={{display:'block',border:'2px dashed #bbf7d0',borderRadius:9,padding:12,cursor:'pointer',
                      color:'#16a34a',fontSize:12,textAlign:'center'}}>
                      {newResource.photo ? '✅ Photo ajoutée' : '📷 Cliquer pour ajouter une photo'}
                      <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                        const file=e.target.files?.[0]
                        if(!file) return
                        const r=new FileReader()
                        r.onload=ev=>setNewResource(n=>({...n,photo:ev.target.result}))
                        r.readAsDataURL(file)
                      }}/>
                    </label>
                  </div>
                </div>
                <button onClick={()=>{
                  if(!newResource.label) return
                  const id=`custom_${Date.now()}`
                  const item={...newResource,id,couleur:newResource.couleur||'#1e3a8a'}
                  const nf={...fleet,[newResource.cat]:[...(fleet[newResource.cat]||[]),item]}
                  saveFleet(nf)
                  setNewResource({cat:'vehicules_4x4',label:'',immat:'',km:0,capacite:4,detail:'',carburant:'Diesel',couleur:'#1e3a8a',photo:'',id:''})
                }} style={{width:'100%',background:'#16a34a',color:'#fff',border:'none',borderRadius:9,
                  padding:'11px',cursor:'pointer',fontSize:13,fontWeight:700,marginTop:12}}>
                  ✅ Ajouter au catalogue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code véhicule */}
      {qrModal && (
        <div onClick={e=>e.target===e.currentTarget&&setQrModal(null)}
          style={{position:'fixed',inset:0,background:'rgba(15,36,71,.8)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:3500,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:28,maxWidth:380,width:'100%',
            textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,.4)'}}>
            <div style={{fontWeight:800,fontSize:16,color:'#1e3a8a',marginBottom:4}}>
              📱 QR Code — {qrModal.ressource_label}
            </div>
            <div style={{fontSize:12,color:'#64748b',marginBottom:16}}>
              {qrModal.date} · {qrModal.heure_debut}–{qrModal.heure_fin} · {qrModal.demandeur}
            </div>
            {/* QR généré via API publique */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                JSON.stringify({
                  type:'rzi_vehicule_depart',
                  reservation_id: qrModal.id,
                  vehicule: qrModal.ressource_label,
                  immat: qrModal.immat||'',
                  chauffeur: qrModal.demandeur,
                  date: qrModal.date,
                  heure_depart: qrModal.heure_debut,
                  heure_retour: qrModal.heure_fin,
                })
              )}`}
              alt="QR Code"
              style={{width:200,height:200,borderRadius:12,marginBottom:16,border:'3px solid #e2e8f0'}}
            />
            <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,
              padding:'10px 14px',marginBottom:16,fontSize:12,color:'#0369a1',textAlign:'left'}}>
              <b>Instructions chauffeur :</b><br/>
              📸 Scanner au départ pour confirmer la prise en charge<br/>
              📸 Scanner au retour pour clôturer la réservation<br/>
              📍 Renseigner le kilométrage au retour
            </div>
            {/* Mise à jour kilométrage */}
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <input
                id="km-retour-input"
                type="number"
                placeholder="Kilométrage retour (km)"
                style={{flex:1,border:'2px solid #e2e8f0',borderRadius:9,padding:'8px 12px',fontSize:13,outline:'none'}}
              />
              <button onClick={()=>{
                const km = parseInt(document.getElementById('km-retour-input')?.value)
                if (!km || km < 1) { alert('Entrez le kilométrage'); return }
                // Mettre à jour le fleet
                const saved = JSON.parse(localStorage.getItem('rzi_fleet_v1')||'{}')
                Object.keys(saved).forEach(cat => {
                  saved[cat] = saved[cat].map(v =>
                    v.id===qrModal.ressource_id ? {...v, km} : v
                  )
                })
                localStorage.setItem('rzi_fleet_v1', JSON.stringify(saved))
                // Clôturer la réservation
                const stored = JSON.parse(localStorage.getItem('rzi_reservations_v3')||'[]')
                localStorage.setItem('rzi_reservations_v3', JSON.stringify(
                  stored.map(r=>r.id===qrModal.id?{...r,statut:'clôturé',km_retour:km}:r)
                ))
                setReservations(stored.map(r=>r.id===qrModal.id?{...r,statut:'clôturé',km_retour:km}:r))
                alert(`✅ Kilométrage enregistré: ${km.toLocaleString()} km`)
                setQrModal(null)
              }} style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
                padding:'8px 14px',cursor:'pointer',fontSize:12,fontWeight:700}}>
                ✅ Retour
              </button>
            </div>
            <button onClick={()=>setQrModal(null)}
              style={{width:'100%',background:'#f1f5f9',border:'none',borderRadius:9,
                padding:'10px',cursor:'pointer',fontSize:13}}>
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
