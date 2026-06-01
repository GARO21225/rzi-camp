import React, { useState, useEffect, useCallback } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('access_token')||''}`})

// ── Catalogue des ressources ────────────────────────────────────
const CATALOGUE = {
  salles: {
    label:'🏢 Salles', icon:'🏢',
    items: [
      { id:'salle_reunion',   label:'Salle de réunion',      capacite:20, detail:'Vidéoprojecteur, tableau blanc', couleur:'#1e3a8a' },
      { id:'bureau_communautaire', label:'Bureau communautaire', capacite:10, detail:'Espace de travail partagé',  couleur:'#2563eb' },
    ]
  },
  vehicules: {
    label:'🚙 Véhicules', icon:'🚙',
    items: [
      { id:'4x4_a',    label:'4x4 — Land Cruiser A',  capacite:7,  immat:'CI-1234-AB', detail:'Tout-terrain, climatisé', couleur:'#f97316' },
      { id:'4x4_b',    label:'4x4 — Land Cruiser B',  capacite:7,  immat:'CI-5678-CD', detail:'Tout-terrain, climatisé', couleur:'#ea580c' },
      { id:'pickup_a', label:'Pick-up — Hilux A',      capacite:4,  immat:'CI-9012-EF', detail:'Benne, diesel',           couleur:'#dc2626' },
      { id:'pickup_b', label:'Pick-up — Hilux B',      capacite:4,  immat:'CI-3456-GH', detail:'Benne, diesel',           couleur:'#b91c1c' },
      { id:'minibus',  label:'Mini-Bus — Toyota Hiace',capacite:15, immat:'CI-7890-IJ', detail:'Navette camp/ville',      couleur:'#7c3aed' },
    ]
  },
  materiels: {
    label:'⚙️ Matériels', icon:'⚙️',
    items: [
      { id:'epi_kit',     label:'Kit EPI complet',     capacite:1, detail:'Casque, gilet, gants, lunettes, chaussures de sécurité', couleur:'#16a34a' },
      { id:'epi_hauteur', label:'EPI Travail en hauteur', capacite:1, detail:'Harnais, longe, casque avec jugulaire', couleur:'#15803d' },
      { id:'nacelle',     label:'Nacelle élévatrice',  capacite:2, detail:'Hauteur max 12m, homologuée', couleur:'#ca8a04' },
      { id:'tractopelle', label:'Tractopelle',          capacite:1, detail:'Godet + chargeur frontal, diesel', couleur:'#d97706' },
      { id:'generateur',  label:'Groupe électrogène',  capacite:1, detail:'50kVA, diesel, silencieux',  couleur:'#92400e' },
    ]
  }
}

const ALL_ITEMS = Object.values(CATALOGUE).flatMap(cat => cat.items)
const STORAGE_KEY = 'rzi_reservations_v2'

const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}

function ResourceCard({ item, onReserver, reservations }) {
  const today = new Date().toISOString().slice(0,10)
  const active = reservations.filter(r => r.ressource_id === item.id && r.date === today && r.statut !== 'annulé').length
  const dispo = active === 0

  return (
    <div style={{background:'#fff',borderRadius:14,padding:16,
      border:`2px solid ${dispo ? '#e2e8f0' : '#fecaca'}`,
      boxShadow:'0 2px 8px rgba(0,0,0,.06)',transition:'all .2s'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div style={{fontWeight:700,fontSize:14,color:'#1e293b'}}>{item.label}</div>
        <span style={{background:dispo?'#dcfce7':'#fee2e2',color:dispo?'#16a34a':'#dc2626',
          padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>
          {dispo ? '✅ Libre' : '🔴 Réservé'}
        </span>
      </div>
      {item.immat && <div style={{fontSize:11,color:'#64748b',marginBottom:4}}>🪪 {item.immat}</div>}
      {item.capacite > 1 && <div style={{fontSize:11,color:'#64748b',marginBottom:4}}>👥 {item.capacite} pers. max</div>}
      <div style={{fontSize:11,color:'#94a3b8',marginBottom:12}}>{item.detail}</div>
      <button onClick={()=>onReserver(item)}
        style={{width:'100%',background:item.couleur,color:'#fff',border:'none',borderRadius:9,
          padding:'9px',cursor:'pointer',fontSize:13,fontWeight:700}}>
        + Réserver
      </button>
    </div>
  )
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [modal,        setModal]        = useState(null)  // item sélectionné
  const [activeTab,    setActiveTab]    = useState('salles')
  const [filterDate,   setFilterDate]   = useState('')
  const [form, setForm] = useState({date:'',heure_debut:'',heure_fin:'',motif:'',demandeur:''})
  const [msg, setMsg] = useState(null)
  const today = new Date().toISOString().slice(0,10)

  const load = useCallback(() => {
    try {
      setReservations(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'))
    } catch(e) { setReservations([]) }
  }, [])

  useEffect(() => { load() }, [load])

  const checkConflict = (item, f) =>
    reservations.some(r =>
      r.ressource_id === item.id && r.date === f.date && r.statut !== 'annulé' &&
      !(f.heure_fin <= r.heure_debut || f.heure_debut >= r.heure_fin)
    )

  const submit = () => {
    if (!form.demandeur||!form.date||!form.heure_debut||!form.heure_fin) {
      setMsg({ok:false,text:'Remplissez tous les champs obligatoires'}); return
    }
    if (checkConflict(modal, form)) {
      setMsg({ok:false,text:'⚠️ Conflit: déjà réservé sur ce créneau'}); return
    }
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')
    stored.push({
      id: Date.now(), ressource_id: modal.id,
      ressource_label: modal.label, immat: modal.immat||'',
      ...form, statut:'confirmé', cree_le: new Date().toISOString()
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setModal(null); setMsg(null)
    setForm({date:'',heure_debut:'',heure_fin:'',motif:'',demandeur:''})
    load()
  }

  const cancel = (id) => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.map(r=>r.id===id?{...r,statut:'annulé'}:r)))
    load()
  }

  const filtered = reservations.filter(r => !filterDate || r.date === filterDate)
    .sort((a,b)=>(a.date+a.heure_debut).localeCompare(b.date+b.heure_debut))

  const catItems = CATALOGUE[activeTab].items

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
      </div>

      {/* Tabs catégories */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {Object.entries(CATALOGUE).map(([k,cat])=>(
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{padding:'8px 18px',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:700,
              background:activeTab===k?'#1e3a8a':'#f1f5f9',
              color:activeTab===k?'#fff':'#64748b',transition:'all .15s'}}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grille ressources */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14,marginBottom:28}}>
        {catItems.map(item=>(
          <ResourceCard key={item.id} item={item} reservations={reservations} onReserver={i=>{setModal(i);setMsg(null)}}/>
        ))}
      </div>

      {/* Planning du jour */}
      <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <div style={{fontWeight:800,fontSize:16,color:'#1e3a8a'}}>📋 Planning des réservations</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}
              style={{...inp,maxWidth:180}}/>
            {filterDate && <button onClick={()=>setFilterDate('')}
              style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:12,color:'#64748b'}}>✕</button>}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:40,color:'#94a3b8'}}>
            <div style={{fontSize:36,marginBottom:8}}>📅</div>
            Aucune réservation{filterDate?` le ${filterDate}`:''}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(r=>{
              const item = ALL_ITEMS.find(i=>i.id===r.ressource_id)||{couleur:'#64748b'}
              return (
                <div key={r.id} style={{display:'flex',alignItems:'center',gap:14,
                  padding:'12px 16px',borderRadius:10,
                  background:r.statut==='annulé'?'#f8fafc':'#fff',
                  border:`1.5px solid ${r.statut==='annulé'?'#e2e8f0':item.couleur+'40'}`,
                  opacity:r.statut==='annulé'?.5:1}}>
                  <div style={{width:5,height:40,borderRadius:99,background:r.statut==='annulé'?'#e2e8f0':item.couleur,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13}}>{r.ressource_label} {r.immat&&`· ${r.immat}`}</div>
                    <div style={{fontSize:12,color:'#64748b'}}>
                      📅 {r.date} · 🕐 {r.heure_debut}–{r.heure_fin} · 👤 {r.demandeur}
                    </div>
                    {r.motif && <div style={{fontSize:11,color:'#94a3b8'}}>{r.motif}</div>}
                  </div>
                  <span style={{background:r.statut==='annulé'?'#f1f5f9':'#dcfce7',
                    color:r.statut==='annulé'?'#94a3b8':'#16a34a',
                    padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,flexShrink:0}}>
                    {r.statut}
                  </span>
                  {r.statut!=='annulé' && (
                    <button onClick={()=>{if(confirm('Annuler?'))cancel(r.id)}}
                      style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',
                        borderRadius:8,padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700,flexShrink:0}}>
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal réservation */}
      {modal && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)}
          style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:500,
            boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
            {/* En-tête */}
            <div style={{background:`linear-gradient(135deg,${modal.couleur},${modal.couleur}cc)`,
              borderRadius:12,padding:'16px 20px',marginBottom:20,color:'#fff'}}>
              <div style={{fontWeight:800,fontSize:17}}>{modal.label}</div>
              {modal.immat && <div style={{fontSize:12,opacity:.9}}>🪪 {modal.immat}</div>}
              {modal.capacite > 1 && <div style={{fontSize:12,opacity:.9}}>👥 Max {modal.capacite} personnes</div>}
              <div style={{fontSize:12,opacity:.8,marginTop:4}}>{modal.detail}</div>
            </div>

            {msg && (
              <div style={{background:msg.ok?'#f0fdf4':'#fef2f2',
                border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,
                borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:13,
                color:msg.ok?'#16a34a':'#dc2626',fontWeight:600}}>
                {msg.text}
              </div>
            )}

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DEMANDEUR *</label>
                <input value={form.demandeur} onChange={e=>setForm({...form,demandeur:e.target.value})}
                  placeholder="Votre nom..." style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>DATE *</label>
                <input type="date" value={form.date} min={today}
                  onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>HEURE DÉBUT *</label>
                  <input type="time" value={form.heure_debut}
                    onChange={e=>setForm({...form,heure_debut:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>HEURE FIN *</label>
                  <input type="time" value={form.heure_fin}
                    onChange={e=>setForm({...form,heure_fin:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>MOTIF / OBJET</label>
                <input value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})}
                  placeholder="Réunion de chantier, transport équipe..." style={inp}/>
              </div>

              {form.date && form.heure_debut && form.heure_fin && checkConflict(modal, form) && (
                <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:9,
                  padding:'10px 14px',color:'#dc2626',fontSize:13,fontWeight:600}}>
                  ⚠️ Conflit détecté — déjà réservé sur ce créneau
                </div>
              )}

              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                <button onClick={()=>{setModal(null);setMsg(null)}}
                  style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={submit}
                  style={{background:modal.couleur,color:'#fff',border:'none',borderRadius:9,
                    padding:'10px 24px',cursor:'pointer',fontSize:13,fontWeight:700}}>
                  ✅ Confirmer la réservation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
