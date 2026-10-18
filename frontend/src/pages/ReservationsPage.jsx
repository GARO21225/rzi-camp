import React, { useState, useEffect, useCallback } from 'react'
import { toast } from '../toast'
import { vehiculesFlotte, typesVehicule } from '../api'
import { useStore } from '../store'
import ComboLibre from '../components/ComboLibre'

const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
const hdrs = () => ({'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('access_token')||''}`})
const STORAGE_KEY = 'rzi_reservations_v3'
const FLEET_KEY   = 'rzi_fleet_v1'

// ── Catalogue initial (modifiable) ─────────────────────────────
const DEFAULT_FLEET = {
  salles: [
    { id:'salle_reunion',        cat:'salles',    label:'Salle de réunion',      capacite:20, detail:'Vidéoprojecteur, tableau blanc, climatisée', couleur:'#0F2A5C', photo:'' },
    { id:'bureau_communautaire', cat:'salles',    label:'Bureau communautaire',  capacite:10, detail:'Espace de travail partagé, imprimante',       couleur:'#2563EB', photo:'' },
  ],
  // Véhicules : source de vérité = parc serveur (VehiculeFlotte), partagé avec le Centre de mobilité
  vehicules_4x4: [], vehicules_pickup: [], vehicules_minibus: [],
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

// Parc serveur <-> catégories de cette page
// Véhicules : catégorie locale = "vehicules_<code du type>" (le type vient du serveur : 4x4, bus, ambulance...)
const estVehiculeCat = cat => String(cat || '').startsWith('vehicules_')
const codeDeCat = cat => String(cat || '').replace(/^vehicules_/, '')
const COULEURS_VEH = { vehicules_4x4:'#f97316', vehicules_pickup:'#dc2626', vehicules_minibus:'#7c3aed', vehicules_bus:'#0F2A5C' }
const couleurVeh = cat => COULEURS_VEH[cat] || '#D4A017'
const depuisServeur = (v, kmLocal) => {
  const cat = 'vehicules_' + (v.categorie || 'autre')
  return { id:`veh_${v.id}`, serveur_id:v.id, cat, label:v.nom, immat:v.matricule||'', capacite:v.capacite,
    photo:v.photo||'', km:kmLocal||0, carburant:'Diesel', couleur:couleurVeh(cat) }
}
const versServeur = (it) => ({ nom:it.label, categorie:codeDeCat(it.cat)||'autre', matricule:it.immat||'', capacite:it.capacite||4, photo:it.photo||'' })

const CAT_META_BASE = {
  salles:           { label:'🏢 Salles',        group:'Salles' },
  materiels_hse:    { label:'🦺 Équip. HSE',    group:'Matériels' },
  materiels_engins: { label:'⚙️ Engins',        group:'Matériels' },
}

// ── Conflits de créneau : expliquer et proposer ─────────────────
const _min = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const _hhmm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const _chevauche = (r, date, debut, fin) => r.date === date && r.statut !== 'annulé' && !(fin <= r.heure_debut || debut >= r.heure_fin)
const _fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
// Créneaux libres proches de l'horaire demandé (même durée), sinon même horaire les jours suivants
function proposerCreneaux(reservations, ressourceId, date, debut, fin) {
  const duree = Math.max(15, _min(fin) - _min(debut))
  const pour = d => reservations.filter(r => r.ressource_id === ressourceId && r.date === d && r.statut !== 'annulé')
    .map(r => [_min(r.heure_debut), _min(r.heure_fin)]).sort((a, b) => a[0] - b[0])
  const occ = pour(date)
  const bornes = [7 * 60, 19 * 60]
  const fenetres = []
  let cur = bornes[0]
  for (const [d, f] of occ) { if (d - cur >= duree) fenetres.push([cur, d]); cur = Math.max(cur, f) }
  if (bornes[1] - cur >= duree) fenetres.push([cur, bornes[1]])
  const voulu = _min(debut)
  const memeJour = fenetres
    .map(([a, b]) => { const d = Math.min(Math.max(voulu, a), b - duree); return { date, debut:_hhmm(d), fin:_hhmm(d + duree) } })
    .sort((x, y) => Math.abs(_min(x.debut) - voulu) - Math.abs(_min(y.debut) - voulu)).slice(0, 3)
  if (memeJour.length) return memeJour
  const autres = []
  for (let i = 1; i <= 14 && autres.length < 3; i++) {
    const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    if (!pour(iso).some(([a, b]) => !(_min(fin) <= a || _min(debut) >= b))) autres.push({ date: iso, debut, fin })
  }
  return autres
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
      <div style={{background:'var(--rzc-white)',borderRadius:16,padding:24,width:'100%',maxWidth:480,
        boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{fontWeight:800,fontSize:16,color:'var(--rzc-navy)',marginBottom:20}}>
          ✏️ Fiche — {data.label}
        </div>

        {/* Photo */}
        <div style={{marginBottom:16,textAlign:'center'}}>
          {data.photo ? (
            <div style={{position:'relative',display:'inline-block'}}>
              <img src={data.photo} alt="" style={{width:'100%',maxHeight:200,objectFit:'cover',borderRadius:12}}/>
              <button onClick={()=>s({photo:''})}
                style={{position:'absolute',top:8,right:8,background:'#dc2626',color:'var(--rzc-white)',border:'none',
                  borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:14}}>✕</button>
            </div>
          ) : (
            <label style={{display:'block',border:'2px dashed #e2e8f0',borderRadius:12,
              padding:24,cursor:'pointer',color:'var(--rzc-text-4)',fontSize:13}}>
              📷 Ajouter une photo
              <input type="file" accept="image/*" onChange={handlePhoto} style={{display:'none'}}/>
            </label>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>NOM</label>
            <input value={data.label} onChange={e=>s({label:e.target.value})} style={inp}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>DESCRIPTION / DÉTAILS</label>
            <input value={data.detail||''} onChange={e=>s({detail:e.target.value})} style={inp}/>
          </div>
          {(isVehicule) && (<>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>IMMATRICULATION</label>
                <input value={data.immat||''} onChange={e=>s({immat:e.target.value})} placeholder="CI-XXXX-XX" style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>KILOMÉTRAGE</label>
                <input type="number" value={data.km||0} onChange={e=>s({km:parseInt(e.target.value)||0})} style={inp}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>CAPACITÉ (pers.)</label>
                <input type="number" value={data.capacite||0} onChange={e=>s({capacite:parseInt(e.target.value)||0})} style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>CARBURANT</label>
                <select value={data.carburant||'Diesel'} onChange={e=>s({carburant:e.target.value})} style={inp}>
                  {['Diesel','Essence','Hybride','Électrique'].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>ASSURANCE (expiration)</label>
              <input type="date" value={data.assurance||''} onChange={e=>s({assurance:e.target.value})} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>PROCHAIN ENTRETIEN (km)</label>
              <input type="number" value={data.entretien_km||''} onChange={e=>s({entretien_km:parseInt(e.target.value)||0})} style={inp}/>
            </div>
          </>)}
          {isMatériel && (
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>N° SÉRIE / MATRICULE</label>
              <input value={data.immat||''} onChange={e=>s({immat:e.target.value})} placeholder="SN-XXXX" style={inp}/>
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:20}}>
          <button onClick={onClose}
            style={{background:'var(--rzc-charcoal)',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
            Annuler
          </button>
          <button onClick={()=>{onSave(data);onClose()}}
            style={{background:'var(--rzc-navy)',color:'var(--rzc-white)',border:'none',borderRadius:9,
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
    <div style={{background:'var(--rzc-white)',borderRadius:14,overflow:'hidden',
      border:`2px solid ${occupied?'#fecaca':'var(--rzc-border-light)'}`,
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
        {item.immat && <div style={{fontSize:11,color:'var(--rzc-text-3)',marginBottom:2}}>🪪 {item.immat}</div>}
        {item.km > 0 && <div style={{fontSize:11,color:'var(--rzc-text-3)',marginBottom:2}}>📍 {item.km.toLocaleString()} km</div>}
        {item.capacite > 1 && <div style={{fontSize:11,color:'var(--rzc-text-3)',marginBottom:2}}>👥 {item.capacite} pers. max</div>}
        {item.detail && <div style={{fontSize:10,color:'var(--rzc-text-4)',marginBottom:10,lineHeight:1.4}}>{item.detail}</div>}
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>onEdit(item)}
            style={{background:'var(--rzc-charcoal)',border:'none',borderRadius:8,padding:'7px 10px',
              cursor:'pointer',fontSize:11,fontWeight:600,color:'var(--rzc-text-3)'}}>
            ✏️
          </button>
          <button onClick={()=>onReserver(item)}
            style={{flex:1,background:item.couleur,color:'var(--rzc-white)',border:'none',borderRadius:8,
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
  const user = useStore(st => st.user)
  const estAdmin = !!(user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin')
  const [fleet,        setFleet]       = useState(DEFAULT_FLEET)
  const [types,        setTypes]       = useState([])   // types de véhicule (serveur)
  const [nouveauType,  setNouveauType]  = useState(null) // {label, icone} en cours de création
  const CAT_META = { ...CAT_META_BASE, ...Object.fromEntries(types.map(t => [`vehicules_${t.code}`, { label:`${t.icone} ${t.label}`, group:'Véhicules' }])) }
  const [reservations, setReservations]= useState([])
  const [personnel,    setPersonnel]   = useState([])
  const [modal,        setModal]       = useState(null)
  const [ficheEdit,    setFicheEdit]   = useState(null)
  const [qrModal,      setQrModal]      = useState(null)   // réservation dont afficher le QR
  const [showCatalogue,setShowCatalogue]= useState(false)
  const [newResource,  setNewResource]  = useState({cat:'vehicules_4x4',label:'',immat:'',km:0,capacite:4,detail:'',carburant:'Diesel',couleur:'#0F2A5C',photo:'',id:''})
  const [activeTab,    setActiveTab]   = useState('salles')
  const [filterDate,   setFilterDate]  = useState('')
  const [msg,          setMsg]         = useState(null)
  const [conflit,      setConflit]     = useState(null)   // {raisons:[...], propositions:[...]}
  const [form, setForm] = useState({date:'',heure_debut:'',heure_fin:'',motif:'',demandeur:''})

  // Charger données persistées
  useEffect(() => {
    try { setReservations(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')) } catch(e) {}
    chargerFlotte()
    // Charger personnel
    fetch(`${BASE}/api/personnel/?page_size=500`, {headers:hdrs()})
      .then(r=>r.json()).then(d=>setPersonnel(d.results||d||[])).catch(()=>{})
  }, [])

  // Charge le parc serveur et le fusionne avec le reste du catalogue local (salles, matériels).
  // Les véhicules saisis AVANT cette correction (uniquement dans ce navigateur) sont envoyés
  // au serveur (admin) pour apparaître aussi dans le Centre de mobilité.
  const chargerFlotte = async () => {
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem(FLEET_KEY)||'{}') } catch(e) {}
    let typesServeur = []
    try { const rt = await typesVehicule.list(); typesServeur = rt.data?.results || rt.data || [] } catch(e) {}
    setTypes(typesServeur)
    const VCATS = [...new Set([...typesServeur.map(t => `vehicules_${t.code}`), ...Object.keys(saved).filter(estVehiculeCat)])]
    const kmLocal = {}
    VCATS.forEach(c => (saved[c]||[]).forEach(v => { kmLocal[v.id] = v.km }))
    try {
      if (estAdmin) {
        for (const c of VCATS) {
          for (const v of (saved[c]||[]).filter(x => String(x.id).startsWith('custom_'))) {
            try { await vehiculesFlotte.create(versServeur(v)) } catch(e) { /* doublon ou refus : on garde en local */ continue }
            saved[c] = saved[c].filter(x => x.id !== v.id)
          }
        }
      }
      const r = await vehiculesFlotte.list()
      const liste = r.data?.results || r.data || []
      const base = { ...DEFAULT_FLEET, ...saved }
      VCATS.forEach(c => { base[c] = (saved[c]||[]).filter(x => String(x.id).startsWith('custom_')) })
      VCATS.forEach(c => { base[c] = base[c] || [] })   // un type sans véhicule reste visible dans le catalogue
      liste.forEach(v => { const it = depuisServeur(v, kmLocal[`veh_${v.id}`]); base[it.cat] = [...(base[it.cat]||[]), it] })
      setFleet(base)
      localStorage.setItem(FLEET_KEY, JSON.stringify(base))
    } catch(e) {
      if (Object.keys(saved).length) setFleet({ ...DEFAULT_FLEET, ...saved })
    }
  }

  // Crée un type de véhicule (ex : Bus) : il apparaît aussitôt ici ET dans le Centre de mobilité
  const creerTypeVehicule = async () => {
    const label = (nouveauType?.label || '').trim()
    if (!label) { toast.error('Donnez un nom au type de véhicule.'); return }
    const code = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
    if (!code) { toast.error('Nom invalide.'); return }
    try {
      await typesVehicule.create({ code, label, icone: (nouveauType.icone || '🚗').trim() || '🚗', ordre: 60 })
      toast.success(`Type « ${label} » créé`)
      setNouveauType(null)
      await chargerFlotte()
      setNewResource(n => ({ ...n, cat: `vehicules_${code}` }))
    } catch (e) { toast.error(e.response?.data?.code?.[0] ? 'Ce type existe déjà.' : (e.response?.data?.error || 'Création impossible (admin requis).')) }
  }

  const saveFleet = (newFleet) => {
    setFleet(newFleet)
    localStorage.setItem(FLEET_KEY, JSON.stringify(newFleet))
  }

  const saveReservation = () => {
    if (!form.demandeur||!form.date||!form.heure_debut||!form.heure_fin) {
      setMsg({ok:false,text:'Remplissez tous les champs obligatoires'}); return
    }
    if (form.heure_fin <= form.heure_debut) { setConflit(null); setMsg({ok:false,text:"L'heure de fin doit être après l'heure de début."}); return }
    const enConflit = reservations.filter(r => r.ressource_id===modal.id && _chevauche(r, form.date, form.heure_debut, form.heure_fin))
    if (enConflit.length) {
      setMsg(null)
      setConflit({
        raisons: enConflit.map(r => `${r.heure_debut}–${r.heure_fin} · réservé par ${r.demandeur || '—'}${r.motif ? ` (${r.motif})` : ''}`),
        propositions: proposerCreneaux(reservations, modal.id, form.date, form.heure_debut, form.heure_fin),
      })
      return
    }
    setConflit(null)
    const stored = [...reservations, {
      id:Date.now(), ressource_id:modal.id, ressource_label:modal.label,
      immat:modal.immat||'', cat:modal.cat||'',
      ...form, statut:'confirmé', cree_le:new Date().toISOString()
    }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    setReservations(stored)
    setModal(null); setMsg(null); setConflit(null)
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
    if (updatedItem.serveur_id) vehiculesFlotte.update(updatedItem.serveur_id, versServeur(updatedItem)).catch(() => toast.error('Modification non enregistrée sur le serveur (admin requis)'))
    const newFleet = {}
    Object.entries(fleet).forEach(([cat, items]) => {
      newFleet[cat] = items.map(i => i.id===updatedItem.id ? updatedItem : i)
    })
    saveFleet(newFleet)
  }

  // Items à afficher selon l'onglet actif
  const getTabItems = () => {
    if (activeTab==='salles') return fleet.salles||[]
    if (activeTab==='vehicules') return Object.keys(fleet).filter(estVehiculeCat).flatMap(c => fleet[c] || [])
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
          <h1 style={{fontSize:22,fontWeight:800,color:'var(--rzc-navy)',margin:0}}>📅 Réservations de Ressources</h1>
          <div style={{fontSize:13,color:'var(--rzc-text-3)',marginTop:4}}>
            Salles · Véhicules · Matériels · {reservations.filter(r=>r.date===today&&r.statut!=='annulé').length} réservation(s) aujourd'hui
          </div>
        </div>
        <button onClick={()=>setShowCatalogue(true)}
          style={{background:'var(--rzc-charcoal)',border:'2px solid #e2e8f0',borderRadius:10,
            padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:700,color:'var(--rzc-navy)'}}>
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
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20}}>
            {[
              {l:"Aujourd'hui",  v:todayRes.length,  c:'var(--rzc-navy)', bg:'#eff6ff', icon:'📅'},
              {l:'Cette semaine',v:weekRes.length,    c:'#7c3aed', bg:'#f5f3ff', icon:'📊'},
              {l:'Total',        v:reservations.filter(r=>r.statut!=='annulé').length, c:'#16a34a', bg:'#f0fdf4', icon:'✅'},
              {l:'Annulées',     v:cancelled,         c:'#dc2626', bg:'#fef2f2', icon:'❌'},
            ].map(({l,v,c,bg,icon})=>(
              <div key={l} style={{background:bg,borderRadius:12,padding:'14px 16px',
                borderLeft:`4px solid ${c}`,boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                <div style={{fontSize:24,fontWeight:900,color:c}}>{icon} {v}</div>
                <div style={{fontSize:11,color:'var(--rzc-text-3)',fontWeight:600,marginTop:2}}>{l}</div>
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
              background:activeTab===t.id?'var(--rzc-navy)':'var(--rzc-charcoal)',
              color:activeTab===t.id?'var(--rzc-white)':'var(--rzc-text-3)',transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Grille par sous-catégorie */}
      {activeTab==='salles' ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:14,marginBottom:24}}>
          {tabItems.map(item=>(
            <ResourceCard key={item.id} item={item} reservations={reservations}
              onReserver={i=>{setModal(i);setMsg(null);setConflit(null)}}
              onEdit={i=>setFicheEdit(i)}/>
          ))}
        </div>
      ) : (
        Object.entries(groupedItems).map(([groupLabel, items])=>(
          <div key={groupLabel} style={{marginBottom:24}}>
            <div style={{fontWeight:800,fontSize:14,color:'var(--rzc-navy)',marginBottom:12,
              display:'flex',alignItems:'center',gap:8}}>
              <span style={{background:'#eff6ff',padding:'4px 14px',borderRadius:20}}>{groupLabel}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
              {items.map(item=>(
                <ResourceCard key={item.id} item={item} reservations={reservations}
                  onReserver={i=>{setModal(i);setMsg(null);setConflit(null)}}
                  onEdit={i=>setFicheEdit(i)}/>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Planning */}
      <div style={{background:'var(--rzc-white)',borderRadius:14,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <div style={{fontWeight:800,fontSize:16,color:'var(--rzc-navy)'}}>📋 Historique des réservations</div>
          <div style={{display:'flex',gap:8}}>
            <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} style={{...inp,maxWidth:180}}/>
            {filterDate&&<button onClick={()=>setFilterDate('')}
              style={{background:'var(--rzc-charcoal)',border:'none',borderRadius:8,padding:'8px 12px',cursor:'pointer',color:'var(--rzc-text-3)'}}>✕</button>}
          </div>
        </div>
        {filtered.length===0 ? (
          <div style={{textAlign:'center',padding:40,color:'var(--rzc-text-4)'}}>
            <div style={{fontSize:36,marginBottom:8}}>📅</div>Aucune réservation
          </div>
        ) : filtered.map(r=>{
          const item = allItems.find(i=>i.id===r.ressource_id)||{couleur:'#5B6B86'}
          return (
            <div key={r.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',
              borderRadius:10,marginBottom:8,background:'var(--rzc-white)',
              border:`1.5px solid ${r.statut==='annulé'?'var(--rzc-border-light)':item.couleur+'40'}`,
              opacity:r.statut==='annulé'?.5:1}}>
              <div style={{width:5,height:44,borderRadius:99,background:r.statut==='annulé'?'var(--rzc-border-light)':item.couleur,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13}}>{r.ressource_label}{r.immat&&` · ${r.immat}`}</div>
                <div style={{fontSize:12,color:'var(--rzc-text-3)'}}>📅 {r.date} · 🕐 {r.heure_debut}–{r.heure_fin} · 👤 {r.demandeur}</div>
                {r.motif&&<div style={{fontSize:11,color:'var(--rzc-text-4)'}}>{r.motif}</div>}
              </div>
              <span style={{background:r.statut==='annulé'?'var(--rzc-charcoal)':'#dcfce7',
                color:r.statut==='annulé'?'var(--rzc-text-4)':'#16a34a',
                padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,flexShrink:0}}>
                {r.statut}
              </span>
              {r.statut!=='annulé'&&(<>
                {r.cat?.startsWith('vehicules') && (
                  <button onClick={()=>setQrModal(r)}
                    style={{background:'#eff6ff',color:'var(--rzc-navy)',border:'1px solid #bfdbfe',
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
          <div style={{background:'var(--rzc-white)',borderRadius:16,padding:24,width:'100%',maxWidth:500,
            boxShadow:'0 20px 60px rgba(0,0,0,.3)',maxHeight:'90vh',overflowY:'auto'}}>
            {/* En-tête avec photo si dispo */}
            <div style={{background:`linear-gradient(135deg,${modal.couleur},${modal.couleur}cc)`,
              borderRadius:12,marginBottom:20,overflow:'hidden'}}>
              {modal.photo&&<img src={modal.photo} alt="" style={{width:'100%',height:120,objectFit:'cover',opacity:.7}}/>}
              <div style={{padding:'14px 18px',color:'var(--rzc-white)'}}>
                <div style={{fontWeight:800,fontSize:16}}>{modal.label}</div>
                {modal.immat&&<div style={{fontSize:12,opacity:.9}}>🪪 {modal.immat}</div>}
                {modal.km>0&&<div style={{fontSize:12,opacity:.9}}>📍 {modal.km?.toLocaleString()} km</div>}
                {modal.capacite>1&&<div style={{fontSize:12,opacity:.9}}>👥 Max {modal.capacite} personnes</div>}
                {modal.detail&&<div style={{fontSize:11,opacity:.8,marginTop:4}}>{modal.detail}</div>}
              </div>
            </div>

            {conflit&&(
              <div role="alert" style={{background:'#fef2f2',border:'1px solid #fecaca',borderLeft:'4px solid #B91C1C',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:'#7f1d1d'}}>
                <div style={{fontWeight:800,marginBottom:6}}>⚠️ Ce créneau n'est pas libre — {modal?.label}</div>
                <div style={{marginBottom:8}}>Déjà réservé le {_fmtDate(form.date)} :</div>
                <ul style={{margin:'0 0 10px',paddingLeft:18}}>{conflit.raisons.map((r,i)=><li key={i}>{r}</li>)}</ul>
                {conflit.propositions.length>0 ? (
                  <>
                    <div style={{fontWeight:700,marginBottom:6}}>Horaires disponibles — touchez pour choisir :</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {conflit.propositions.map((p,i)=>(
                        <button key={i} type="button" onClick={()=>{setForm(f=>({...f,date:p.date,heure_debut:p.debut,heure_fin:p.fin}));setConflit(null)}}
                          style={{background:'#fff',border:'1.5px solid #0F2A5C',color:'#0F2A5C',borderRadius:9,padding:'8px 12px',fontWeight:700,cursor:'pointer',fontSize:12.5,minHeight:40}}>
                          {p.date!==form.date?`${_fmtDate(p.date)} · `:''}{p.debut}–{p.fin}
                        </button>
                      ))}
                    </div>
                  </>
                ) : <div style={{fontWeight:600}}>Aucun créneau libre de cette durée dans les 14 prochains jours.</div>}
              </div>
            )}
            {msg&&(
              <div style={{background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,
                borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:13,color:msg.ok?'#16a34a':'#dc2626',fontWeight:600}}>
                {msg.text}
              </div>
            )}

            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>DEMANDEUR *</label>
                <ComboLibre value={form.demandeur} onChange={v=>setForm(f=>({...f,demandeur:v}))}
                  options={personnel.map(p=>`${p.nom} ${p.prenom||''}`.trim())} placeholder="Saisir ou sélectionner un nom..."
                  connuLabel="Personne connue" vide="Aucune personne trouvée — la saisie libre sera utilisée" style={inp}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>DATE *</label>
                <input type="date" value={form.date} min={today}
                  onChange={e=>setForm({...form,date:e.target.value})} style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>DÉBUT *</label>
                  <input type="time" value={form.heure_debut} onChange={e=>setForm({...form,heure_debut:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>FIN *</label>
                  <input type="time" value={form.heure_fin} onChange={e=>setForm({...form,heure_fin:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>MOTIF / OBJET</label>
                <input value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})}
                  placeholder="Réunion de chantier, transport équipe..." style={inp}/>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
                <button onClick={()=>{setModal(null);setMsg(null);setConflit(null)}}
                  style={{background:'var(--rzc-charcoal)',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={saveReservation}
                  style={{background:modal.couleur,color:'var(--rzc-white)',border:'none',borderRadius:9,
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
          <div style={{background:'var(--rzc-white)',borderRadius:16,width:'100%',maxWidth:700,
            maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{padding:'20px 24px',borderBottom:'2px solid #f1f5f9',display:'flex',
              justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:800,fontSize:17,color:'var(--rzc-navy)'}}>⚙️ Catalogue des ressources</div>
              <button onClick={()=>setShowCatalogue(false)}
                style={{background:'var(--rzc-charcoal)',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:24}}>
              {/* Liste par catégorie */}
              {Object.entries(fleet).map(([cat, items])=>(
                <div key={cat} style={{marginBottom:20}}>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--rzc-navy)',marginBottom:8,
                    background:'#eff6ff',padding:'6px 12px',borderRadius:8}}>
                    {CAT_META[cat]?.label||cat}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {items.map(item=>(
                      <div key={item.id} style={{display:'flex',alignItems:'center',gap:12,
                        padding:'8px 12px',background:'var(--rzc-charcoal)',borderRadius:8}}>
                        {item.photo && <img src={item.photo} style={{width:40,height:40,objectFit:'cover',borderRadius:6}}/>}
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:13}}>{item.label}</div>
                          <div style={{fontSize:11,color:'var(--rzc-text-3)'}}>
                            {item.immat&&`🪪 ${item.immat} · `}{item.km>0&&`📍 ${item.km?.toLocaleString()} km · `}{item.detail}
                          </div>
                        </div>
                        <button onClick={()=>setFicheEdit(item)}
                          style={{background:'#eff6ff',color:'var(--rzc-navy)',border:'none',borderRadius:7,
                            padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                          ✏️ Modifier
                        </button>
                        <button onClick={()=>{
                          if(!confirm(`Supprimer ${item.label} ?`)) return
                          if (item.serveur_id) vehiculesFlotte.update(item.serveur_id, { actif:false }).catch(() => toast.error('Suppression refusée par le serveur (admin requis)'))
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
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>CATÉGORIE</label>
                    <select value={newResource.cat} onChange={e=>setNewResource(n=>({...n,cat:e.target.value}))} style={inp}>
                      {Object.entries(CAT_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select>
                    {estAdmin && (nouveauType ? (
                      <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
                        <input value={nouveauType.icone} onChange={e=>setNouveauType(t=>({...t,icone:e.target.value}))} maxLength={4} aria-label="Icône" style={{...inp,width:60,textAlign:'center'}}/>
                        <input autoFocus value={nouveauType.label} onChange={e=>setNouveauType(t=>({...t,label:e.target.value}))} placeholder="Ex : Bus, Ambulance…" maxLength={60} style={{...inp,flex:1,minWidth:140}}/>
                        <button type="button" onClick={creerTypeVehicule} style={{background:'#D4A017',color:'#0F2A5C',border:'none',borderRadius:9,padding:'0 14px',fontWeight:700,cursor:'pointer'}}>Créer</button>
                        <button type="button" onClick={()=>setNouveauType(null)} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:9,padding:'0 12px',cursor:'pointer'}}>✕</button>
                      </div>
                    ) : (
                      <button type="button" onClick={()=>setNouveauType({label:'',icone:'🚗'})}
                        style={{marginTop:8,background:'none',border:'none',color:'#0F2A5C',fontWeight:700,fontSize:12,cursor:'pointer',textDecoration:'underline',padding:0}}>
                        ➕ Créer un type de véhicule
                      </button>
                    ))}
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>NOM *</label>
                    <input value={newResource.label} onChange={e=>setNewResource(n=>({...n,label:e.target.value}))}
                      placeholder="Ex: Land Cruiser C" style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>IMMAT / N° SÉRIE</label>
                    <input value={newResource.immat} onChange={e=>setNewResource(n=>({...n,immat:e.target.value}))}
                      placeholder="CI-XXXX-XX" style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>CAPACITÉ (pers.)</label>
                    <input type="number" value={newResource.capacite} onChange={e=>setNewResource(n=>({...n,capacite:parseInt(e.target.value)||1}))} style={inp}/>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>DESCRIPTION</label>
                    <input value={newResource.detail} onChange={e=>setNewResource(n=>({...n,detail:e.target.value}))}
                      placeholder="Caractéristiques..." style={inp}/>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label style={{fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',display:'block',marginBottom:4}}>PHOTO</label>
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
                  if (estVehiculeCat(newResource.cat)) {
                    // Véhicule : créé sur le serveur => visible aussi dans le Centre de mobilité
                    vehiculesFlotte.create(versServeur(newResource)).then(() => {
                      toast.success('Véhicule ajouté — visible dans le Centre de mobilité')
                      chargerFlotte()
                    }).catch(e => toast.error(e.response?.status === 403 ? 'Seul un administrateur peut ajouter un véhicule au parc' : 'Ajout impossible'))
                    setNewResource({cat:'vehicules_4x4',label:'',immat:'',km:0,capacite:4,detail:'',carburant:'Diesel',couleur:'#0F2A5C',photo:'',id:''})
                    return
                  }
                  const id=`custom_${Date.now()}`
                  const item={...newResource,id,couleur:newResource.couleur||'#0F2A5C'}
                  const nf={...fleet,[newResource.cat]:[...(fleet[newResource.cat]||[]),item]}
                  saveFleet(nf)
                  setNewResource({cat:'vehicules_4x4',label:'',immat:'',km:0,capacite:4,detail:'',carburant:'Diesel',couleur:'#0F2A5C',photo:'',id:''})
                }} style={{width:'100%',background:'#16a34a',color:'var(--rzc-white)',border:'none',borderRadius:9,
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
          <div style={{background:'var(--rzc-white)',borderRadius:16,padding:28,maxWidth:380,width:'100%',
            textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,.4)'}}>
            <div style={{fontWeight:800,fontSize:16,color:'var(--rzc-navy)',marginBottom:4}}>
              📱 QR Code — {qrModal.ressource_label}
            </div>
            <div style={{fontSize:12,color:'var(--rzc-text-3)',marginBottom:16}}>
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
                if (!km || km < 1) { toast.success('Entrez le kilométrage'); return }
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
                toast.success(`✅ Kilométrage enregistré: ${km.toLocaleString()} km`)
                setQrModal(null)
              }} style={{background:'var(--rzc-navy)',color:'var(--rzc-white)',border:'none',borderRadius:9,
                padding:'8px 14px',cursor:'pointer',fontSize:12,fontWeight:700}}>
                ✅ Retour
              </button>
            </div>
            <button onClick={()=>setQrModal(null)}
              style={{width:'100%',background:'var(--rzc-charcoal)',border:'none',borderRadius:9,
                padding:'10px',cursor:'pointer',fontSize:13}}>
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
