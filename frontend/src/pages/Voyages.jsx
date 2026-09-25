/**
 * VOYAGES v3 — Gestion des voyages du camp
 * Chargement instantané + delete visible + nouvelles actions
 */
import React, { useEffect, useState, useCallback } from 'react'
import { voyages, personnel as personnelAPI, batiments as batsAPI, etapesVoyage, vehiculesFlotte } from '../api'
import { useStore } from '../store'
import { toast, confirmDialog } from '../toast'
import { useIsMobile } from '../hooks/useIsMobile'
import CarteItineraire from '../components/CarteItineraire'
import LieuInput from '../components/LieuInput'

const STATUT_STYLES = {
  planifie:  { bg:'rgba(201,151,43,.14)',  color:'#a67d1f',  label:'Planifié'    },
  en_voyage: { bg:'rgba(249,115,22,.12)', color:'#c2410c',  label:'En voyage'   },
  retour:    { bg:'rgba(22,163,74,.12)',  color:'#15803d',  label:'Retour camp' },
  annule:    { bg:'rgba(100,116,139,.1)', color:'var(--rzc-text-2)',  label:'Annulé'      },
}
const STATUT_LABELS = { planifie:'Planifié', en_voyage:'En voyage', retour:'Retour camp', annule:'Annulé' }
const fmtFR = (iso) => iso ? new Date(iso+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '—'

function exportVoyagesCSV(liste) {
  const headers = ['ID','Personnel','Société','Destination','Motif','Départ prévu','Départ réel','Retour prévu','Retour réel','Statut']
  const rows = liste.map(v => [
    v.id,
    '"' + (v.personnel_nom||'').replace(/"/g,'""') + '"',
    v.personnel_societe||'',
    '"' + (v.destination||'').replace(/"/g,'""') + '"',
    v.motif||'',
    v.date_depart||'',
    v.date_depart_effective||'',
    v.date_retour_prevue||'',
    v.date_retour_effective||'',
    STATUT_LABELS[v.statut]||v.statut||'',
  ])
  const csv = [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'voyages_' + new Date().toISOString().slice(0,10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Vue calendrier — départs/retours du mois affichés jour par jour ──
function VueCalendrier({ voyages: data, mois, setMois, onSelectVoyage }) {
  const annee = mois.getFullYear(), moisIdx = mois.getMonth()
  const premierJour = new Date(annee, moisIdx, 1)
  const nbJours = new Date(annee, moisIdx + 1, 0).getDate()
  const decalage = (premierJour.getDay() + 6) % 7 // lundi = 0

  const parJour = {}
  data.forEach(v => {
    if (v.date_depart) {
      const d = v.date_depart
      parJour[d] = parJour[d] || { departs: [], retours: [] }
      parJour[d].departs.push(v)
    }
    if (v.date_retour_prevue) {
      const d = v.date_retour_prevue
      parJour[d] = parJour[d] || { departs: [], retours: [] }
      parJour[d].retours.push(v)
    }
  })

  const cases = []
  for (let i = 0; i < decalage; i++) cases.push(null)
  for (let j = 1; j <= nbJours; j++) cases.push(j)

  const fmt = (j) => `${annee}-${String(moisIdx+1).padStart(2,'0')}-${String(j).padStart(2,'0')}`

  return (
    <div style={{ background:'var(--rzc-white)', border:'1px solid #e2e8f0', borderRadius:14, padding:16, boxShadow:'0 2px 12px rgba(30,58,138,.07)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <button onClick={()=>setMois(new Date(annee, moisIdx-1, 1))} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontWeight:700}}>←</button>
        <div style={{fontWeight:800,fontSize:15,color:'var(--rzc-navy)',textTransform:'capitalize'}}>
          {mois.toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}
        </div>
        <button onClick={()=>setMois(new Date(annee, moisIdx+1, 1))} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontWeight:700}}>→</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,fontSize:10,fontWeight:700,color:'var(--rzc-text-4)',textTransform:'uppercase',marginBottom:6}}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(j=><div key={j} style={{textAlign:'center'}}>{j}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {cases.map((j,i) => {
          if (!j) return <div key={i}/>
          const dateStr = fmt(j)
          const info = parJour[dateStr]
          const isToday = dateStr === new Date().toISOString().slice(0,10)
          return (
            <div key={i} style={{minHeight:64,border:`1px solid ${isToday?'#C9972B':'#f1f5f9'}`,borderRadius:8,padding:4,fontSize:10,background:isToday?'#fffbeb':'#fff'}}>
              <div style={{fontWeight:700,color:isToday?'#C9972B':'var(--rzc-text-3)',marginBottom:2}}>{j}</div>
              {info?.departs.slice(0,2).map(v=>(
                <div key={'d'+v.id} onClick={()=>onSelectVoyage(v)} title={`Départ — ${v.personnel_detail?.nom||''}`}
                  style={{background:'#fff7ed',color:'#c2410c',borderRadius:4,padding:'1px 4px',marginBottom:2,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  🧳 {v.personnel_detail?.nom||v.destination}
                </div>
              ))}
              {info?.retours.slice(0,2).map(v=>(
                <div key={'r'+v.id} onClick={()=>onSelectVoyage(v)} title={`Retour — ${v.personnel_detail?.nom||''}`}
                  style={{background:'#f0fdf4',color:'#15803d',borderRadius:4,padding:'1px 4px',marginBottom:2,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  🏠 {v.personnel_detail?.nom||v.destination}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <div style={{display:'flex',gap:14,marginTop:10,fontSize:11,color:'var(--rzc-text-3)'}}>
        <span>🧳 <span style={{color:'#c2410c'}}>Départ</span></span>
        <span>🏠 <span style={{color:'#15803d'}}>Retour prévu</span></span>
      </div>
    </div>
  )
}

const S_BTN = (bg, color, border) => ({
  background: bg, color, border: `1.5px solid ${border}`,
  padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
  transition: '.15s', fontFamily: 'inherit'
})


const DESTINATIONS = [
  // Côte d'Ivoire - villes principales
  'Abidjan', 'Yamoussoukro', 'Bouaké', 'San Pedro', 'Korhogo', 'Man',
  'Daloa', 'Gagnoa', 'Abengourou', 'Bondoukou', 'Odienné', 'Touba',
  'Divo', 'Agboville', 'Dimbokro', 'Séguéla', 'Mankono', 'Ferkessédougou',
  'Bouna', 'Tabou', 'Katiola', 'Boundiali', 'Sinématiali', 'Niakaramandougou',
  // Aéroports / Hubs domestiques
  'Aéroport FÉLIX HOUPHOUËT-BOIGNY (ABJ)',
  'Aéroport BOUAKÉ', 'Aéroport SAN PEDRO', 'Aéroport KORHOGO',
  // Burkina Faso (site minier proche)
  'Ouagadougou', 'Bobo-Dioulasso', 'Dédougou', 'Koudougou', 'Banfora',
  // Afrique de l'Ouest / régional
  'Accra (Ghana)', 'Bamako (Mali)', 'Dakar (Sénégal)', 'Lomé (Togo)',
  'Cotonou (Bénin)', 'Conakry (Guinée)', 'Niamey (Niger)', 'Freetown (Sierra Leone)',
  'Monrovia (Libéria)', 'Lagos (Nigéria)',
  // Hubs miniers / corporate internationaux
  'Johannesburg (Afrique du Sud)', 'Perth (Australie)', 'Toronto (Canada)',
  'Vancouver (Canada)', 'Londres (Royaume-Uni)', 'Dubaï (Émirats Arabes Unis)',
  // Europe (siège, formations, congés)
  'Paris (France)', 'Bruxelles (Belgique)', 'Genève (Suisse)',
  // Évacuation médicale
  'Clinique internationale d\'Abidjan', 'Centre médical (évacuation Afrique du Sud)',
  // Destinations mines / terrain
  'Sango Mine Site', 'Camp de base', 'Site d\'exploration', 'Autre site minier',
]

// Filtre le catalogue "véhicule du parc" selon le mode de transport choisi —
// evite de proposer un avion pour un trajet en bus, etc. À pied ne nécessite
// aucun véhicule.
const CATEGORIES_PAR_MODE = {
  bus: ['bus','minibus'], '4x4': ['4x4','pickup'], avion: ['avion'],
  bateau: ['bateau'], a_pied: [], autre: ['autre'],
}
const filtrerFlotteParMode = (flotte, mode) => {
  const cats = CATEGORIES_PAR_MODE[mode]
  if (mode === 'a_pied') return []
  if (!cats || cats.length === 0) return flotte
  return flotte.filter(v => cats.includes(v.categorie))
}

export default function Voyages() {
  const isMobile = useIsMobile()
  const { user } = useStore()
  const role = (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
  const isAdmin = user?.is_staff === true || user?.is_superuser === true || role === 'admin'

  const [data,          setData]          = useState([])
  const [stats,         setStats]         = useState({total:0,planifies:0,en_voyage:0,retours:0,annules:0})
  const [loading,       setLoading]       = useState(true)
  const [filterStatut,  setFilterStatut]  = useState('')
  const [search,        setSearch]        = useState('')       // nom personnel / destination
  const [filterSociete, setFilterSociete] = useState('')
  const [dateDebut,     setDateDebut]     = useState('')
  const [dateFin,       setDateFin]       = useState('')
  const [modal,         setModal]         = useState(false)
  const [editModal,     setEditModal]     = useState(null)
  const [personnelList, setPersonnelList] = useState([])
  const [flotte, setFlotte] = useState([])
  useEffect(() => { vehiculesFlotte.list().then(r => setFlotte(r.data.results||r.data||[])).catch(()=>{}) }, [])
  const [batsList,      setBatsList]      = useState([])
  const [myPersonnel,   setMyPersonnel]   = useState(null)
  const [form, setForm] = useState({ personnel:'', origine:'Camp Roxgold Sango', destination:'', date_depart:'', date_retour_prevue:'', motif:'repos', heure_depart:'', notes:'' })
  const [etapesForm, setEtapesForm] = useState([])
  const [submitting, setSubmitting] = useState(false)

  // Charger voyages IMMÉDIATEMENT
  const loadVoyages = useCallback(() => {
    setLoading(true)
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (!isAdmin && myPersonnel) p.personnel = myPersonnel.id
    Promise.all([
      voyages.list(p),
      voyages.stats()
    ]).then(([rv, rs]) => {
      setData(rv.data.results || rv.data || [])
      setStats(rs.data || {})
    }).catch(() => {})
    .finally(() => setLoading(false))
  }, [filterStatut, myPersonnel, isAdmin])

  // Charger liste personnel en arrière-plan (pour modal)
  useEffect(() => {
    setLoading(true)
    loadVoyages()
    // Charger personnel/bâtiments en parallèle sans bloquer
    Promise.all([
      personnelAPI.list({ page_size:200, droit_mobilite:true }),
      batsAPI.list({ page_size:200 })
    ]).then(([rp, rb]) => {
      const items = rp.data.results || rp.data || []
      setPersonnelList(items)
      setBatsList(rb.data.results || rb.data || [])
      if (!isAdmin) {
        const me = items.find(p =>
          p.login_genere === user?.username ||
          (p.nom?.toLowerCase() === (user?.last_name||'').toLowerCase() &&
           p.prenom?.toLowerCase() === (user?.first_name||'').toLowerCase())
        )
        if (me) {
          setMyPersonnel(me)
          setForm(f => ({...f, personnel: me.id.toString()}))
        }
      }
    }).catch(() => {})
  }, [user?.username])

  useEffect(() => { loadVoyages() }, [loadVoyages])

  // Actions
  const partir = async (id) => {
    try { await voyages.partir(id); loadVoyages() }
    catch(e) { toast.error(e.response?.data?.error||'Erreur') }
  }
  const revenir = async (v) => {
    try { await voyages.revenir(v.id); loadVoyages() }
    catch(e) { toast.error(e.response?.data?.error||'Erreur') }
  }
  const annulerVoyage = async (v) => {
    if (!await confirmDialog(`Annuler le voyage de ${v.personnel_detail?.nom||''} ?`)) return
    try { await voyages.annuler(v.id); loadVoyages() }
    catch(e) { toast.error(e.response?.data?.error||'Erreur') }
  }
  const supprimerVoyage = async (v) => {
    if (!await confirmDialog(`🗑️ Supprimer définitivement le voyage de ${v.personnel_detail?.nom||'?'} vers ${v.destination||'?'} ?\n\nCette action est irréversible.`)) return
    try { await voyages.supprimer(v.id); loadVoyages() }
    catch(e) { toast.error(e.response?.data?.error || 'Impossible de supprimer ce voyage') }
  }

  const createVoyage = async () => {
    if (!form.personnel || !form.destination || !form.date_depart) return toast.success('Personnel, destination et date de départ requis')
    if (form._origineValide===false || form._destinationValide===false) return toast.error('Origine ou destination invalide — sélectionnez un lieu dans la liste proposée')
    setSubmitting(true)
    try {
      const r = await voyages.create(form)
      const nouveauVoyageId = r.data.id
      // Créer les étapes d'itinéraire détaillées, si renseignées
      for (const etape of etapesForm) {
        if (!etape.origine || !etape.destination) continue
        try {
          await etapesVoyage.create({ ...etape, voyage: nouveauVoyageId })
        } catch { toast.warning(`Voyage créé, mais une étape n'a pas pu être enregistrée`) }
      }
      setModal(false)
      setForm({ personnel:'', origine:'Camp Roxgold Sango', destination:'', date_depart:'', date_retour_prevue:'', motif:'repos', heure_depart:'', notes:'' })
      setEtapesForm([])
      loadVoyages()
    } catch(e) {
      const d = e.response?.data
      const msg = d?.detail
        || (Array.isArray(d?.non_field_errors) ? d.non_field_errors[0] : null)
        || (typeof d === 'string' ? d : null)
        || JSON.stringify(d)
        || 'Erreur lors de la création du voyage'
      toast.success(msg)
    }
    finally { setSubmitting(false) }
  }

  const ajouterEtape = (sens='aller') => setEtapesForm(prev => [...prev, {
    ordre: prev.length + 1, sens,
    origine: sens==='retour' ? (prev.find(e=>e.sens==='aller')?.destination || form.destination || '') : (prev.length ? prev[prev.length-1].destination : (form.origine||'')),
    destination: sens==='retour' ? (form.origine||'Camp Roxgold Sango') : (form.destination||''),
    mode_transport: 'bus', vehicule_flotte:'', conducteur:'',
    date_etape: sens==='retour' ? (form.date_retour_prevue||'') : (form.date_depart||''),
    heure_depart: '', point_rdv: '', reference: '',
  }])
  const majEtape = (idx, champ, val) => setEtapesForm(prev => prev.map((e,i) => i===idx ? {...e, [champ]: val} : e))
  const supprimerEtapeForm = (idx) => setEtapesForm(prev => prev.filter((_,i) => i!==idx).map((e,i) => ({...e, ordre: i+1})))

  const openEdit = (v) => setEditModal(v)
  const saveEdit = async () => {
    if (!editModal) return
    setSubmitting(true)
    try {
      await voyages.update(editModal.id, editModal)
      setEditModal(null)
      loadVoyages()
    } catch(e) { toast.error(e.response?.data?.detail || 'Erreur') }
    finally { setSubmitting(false) }
  }

  const [refusModal, setRefusModal] = useState(null)
  const [motifRefus, setMotifRefus] = useState('')
  const [vue, setVue] = useState('liste') // 'liste' | 'calendrier'
  const [moisCalendrier, setMoisCalendrier] = useState(new Date())
  const [rotationsDispo, setRotationsDispo] = useState([])
  const [showRotations, setShowRotations] = useState(false)
  const [retoursAnticipes, setRetoursAnticipes] = useState([])

  useEffect(() => { voyages.retoursAnticipes().then(r => setRetoursAnticipes(r.data||[])).catch(()=>{}) }, [])

  const chargerRotationsDispo = useCallback(() => {
    voyages.rotationsDisponibles().then(r => {
      const today = new Date().toISOString().slice(0,10)
      setRotationsDispo((r.data.rotations||[]).filter(rot => rot.date_depart >= today && rot.places_libres > 0))
    }).catch(() => {})
  }, [])
  useEffect(() => { chargerRotationsDispo() }, [chargerRotationsDispo])

  const rejoindre = async (rotationId) => {
    const persoId = isAdmin ? null : myPersonnel?.id
    if (!persoId) return toast.error('Profil personnel introuvable pour rejoindre automatiquement')
    try {
      await voyages.rejoindreRotation(rotationId, persoId)
      toast.success('Vous avez rejoint la rotation !')
      loadVoyages(); chargerRotationsDispo()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const validerVoyage = async (v) => {
    try { await voyages.valider(v.id); toast.success('Voyage validé'); loadVoyages() }
    catch(e) { toast.error(e.response?.data?.error||'Erreur') }
  }
  const confirmerRefus = async () => {
    if (!refusModal) return
    try { await voyages.refuser(refusModal.id, motifRefus); toast.success('Voyage refusé'); setRefusModal(null); setMotifRefus(''); loadVoyages() }
    catch(e) { toast.error(e.response?.data?.error||'Erreur') }
  }

  const filtered = data.filter(v => {
    if (filterStatut && v.statut !== filterStatut) return false
    if (filterSociete && v.personnel_detail?.societe !== filterSociete) return false
    if (dateDebut && v.date_depart < dateDebut) return false
    if (dateFin && v.date_depart > dateFin) return false
    if (search) {
      const s = search.toLowerCase()
      const nom = `${v.personnel_detail?.nom||''} ${v.personnel_detail?.prenom||''}`.toLowerCase()
      const dest = (v.destination||'').toLowerCase()
      const orig = (v.origine||'').toLowerCase()
      if (!nom.includes(s) && !dest.includes(s) && !orig.includes(s)) return false
    }
    return true
  })
  const societesDisponibles = [...new Set(data.map(v=>v.personnel_detail?.societe).filter(Boolean))].sort()
  const filtresActifs = !!(filterSociete || dateDebut || dateFin || search)

  // Styles
  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'9px 12px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }
  const filterBtns = [
    ['', '📋 Tous', data.length],
    ['planifie', '📅 Planifié', stats.planifies||0],
    ['en_voyage', '🧳 En voyage', stats.en_voyage||0],
    ['retour', '🏠 Retour', stats.retours||0],
    ['annule', '❌ Annulé', stats.annules||0],
  ]

  return (
    <div className="rzc-page-scope" style={{ padding:16 }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:isMobile?18:22, fontWeight:800, color:'var(--rzc-navy)', margin:0 }}>🧳 Gestion des Voyages</h2>
          <p style={{ fontSize:12, color:'var(--rzc-text-3)', margin:'4px 0 0' }}>
            {isAdmin ? 'Tous les voyages · Modification · Suivi' : `Mes voyages${myPersonnel?' — '+myPersonnel.nom+' '+myPersonnel.prenom:''}`}
          </p>
        </div>
        <div style={{display:'flex',gap:8,width:isMobile?'100%':'auto',flexDirection:isMobile?'column':'row'}}>
          {rotationsDispo.length > 0 && (
            <button onClick={() => setShowRotations(v=>!v)}
              style={{ background:showRotations?'#f0a500':'#fffbeb', color:showRotations?'#000':'#92400e', border:'1.5px solid #fde68a', padding:'10px 16px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, width:isMobile?'100%':'auto' }}>
              🚌 {rotationsDispo.length} rotation(s) disponible(s)
            </button>
          )}
          <button onClick={() => exportVoyagesCSV(filtered)}
            style={{ background:'#16a34a', color:'#fff', border:'none', padding:'10px 16px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, width:isMobile?'100%':'auto' }}>
            📥 Export CSV ({filtered.length})
          </button>
          <button onClick={() => setModal(true)}
            style={{ background:'var(--rzc-navy)', color:'var(--rzc-white)', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700, width:isMobile?'100%':'auto' }}>
            + {isAdmin ? 'Nouveau voyage' : 'Déclarer mon voyage'}
          </button>
        </div>
      </div>

      {/* ── Retours anticipés — signalés pour information (places potentiellement liberees plus tot) ── */}
      {retoursAnticipes.length > 0 && (
        <div style={{marginBottom:14,background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'10px 14px'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#166534',marginBottom:4}}>
            ⚡ {retoursAnticipes.length} personne(s) rentrée(s) plus tôt que prévu récemment
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {retoursAnticipes.slice(0,6).map(r=>(
              <span key={r.id} style={{fontSize:11,color:'#166534',background:'#dcfce7',padding:'3px 9px',borderRadius:20}}>
                {r.personnel_nom} — {r.jours_avance}j d'avance ({r.destination})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Rotations disponibles à rejoindre — places visibles, façon agence ── */}
      {showRotations && rotationsDispo.length > 0 && (
        <div style={{marginBottom:18,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
          {rotationsDispo.map(rot => {
            const total = rot.nb_places_total || 15
            const occ = rot.places_occupees || 0
            const res = rot.places_reservees || 0
            const lib = rot.places_libres || 0
            // Grille de sieges : ● occupe (confirme) — ◐ reserve (en attente) — ○ disponible
            const sieges = [
              ...Array(occ).fill('occupe'),
              ...Array(res).fill('reserve'),
              ...Array(lib).fill('dispo'),
            ]
            return (
              <div key={rot.rotation_id} style={{background:'#fff',border:'1px solid #fde68a',borderRadius:12,padding:14,boxShadow:'0 2px 8px rgba(0,0,0,.05)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:14,color:'var(--rzc-navy)'}}>🧳 {rot.destination}</div>
                    <div style={{fontSize:11,color:'var(--rzc-text-3)'}}>{rot.vehicule} · Convoi {rot.rotation_id}</div>
                  </div>
                  <span style={{background:'#fffbeb',color:'#92400e',padding:'3px 9px',borderRadius:20,fontSize:11,fontWeight:700}}>
                    {lib} place(s) libre(s)
                  </span>
                </div>
                <div style={{fontSize:11,color:'var(--rzc-text-3)',marginBottom:8}}>
                  Départ {fmtFR(rot.date_depart)}{rot.heure_depart?` à ${rot.heure_depart}`:''} · Retour prévu {fmtFR(rot.date_retour_prevue)}
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:8}}>
                  {sieges.map((s,i)=>(
                    <span key={i} title={s==='occupe'?'Occupé (confirmé)':s==='reserve'?'Réservé (en attente de validation)':'Disponible'}
                      style={{
                        width:16,height:16,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,
                        background: s==='occupe'?'var(--rzc-navy)':s==='reserve'?'#fef3c7':'#f0fdf4',
                        color: s==='occupe'?'#fff':s==='reserve'?'#92400e':'#16a34a',
                        border: s==='dispo'?'1px dashed #86efac':'none',
                      }}>
                      {s==='occupe'?'●':s==='reserve'?'◐':'○'}
                    </span>
                  ))}
                </div>
                <div style={{display:'flex',gap:10,fontSize:10,color:'var(--rzc-text-4)',marginBottom:10}}>
                  <span>● {occ} occupé{occ>1?'s':''}</span>
                  <span>◐ {res} réservé{res>1?'s':''}</span>
                  <span>○ {lib} libre{lib>1?'s':''}</span>
                </div>
                {!isAdmin && (
                  <button onClick={()=>rejoindre(rot.rotation_id)}
                    style={{width:'100%',background:'var(--rzc-navy)',color:'#fff',border:'none',padding:9,borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}>
                    Rejoindre cette rotation
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:16 }}>
        {[
          ['Total',     '📋', stats.total||data.length, '#2563eb'],
          ['Planifiés', '📅', stats.planifies||0,        '#f59e0b'],
          ['En voyage', '🧳', stats.en_voyage||0,        '#f97316'],
          ['Retours',   '🏠', stats.retours||0,          '#16a34a'],
        ].map(([l,ic,v,c]) => (
          <div key={l} style={{ background:'var(--rzc-white)', border:`2px solid ${c}30`, borderTop:`3px solid ${c}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:'var(--rzc-text-4)', textTransform:'uppercase', letterSpacing:1, marginTop:3 }}>{ic} {l}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {filterBtns.map(([val, label, count]) => (
          <button key={val} onClick={() => setFilterStatut(val)}
            style={{ ...S_BTN(filterStatut===val?'var(--rzc-navy)':'var(--rzc-white)', filterStatut===val?'var(--rzc-white)':'var(--rzc-text-2)', filterStatut===val?'var(--rzc-navy)':'var(--rzc-border-light)'), fontSize:12 }}>
            {label} <span style={{ background: filterStatut===val?'rgba(255,255,255,.25)':'var(--rzc-charcoal)', borderRadius:99, padding:'1px 7px', marginLeft:4, fontSize:11, fontWeight:700 }}>{count}</span>
          </button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:4,background:'#f1f5f9',borderRadius:9,padding:3}}>
          <button onClick={()=>setVue('liste')} style={{background:vue==='liste'?'#fff':'transparent',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,color:vue==='liste'?'var(--rzc-navy)':'var(--rzc-text-3)',boxShadow:vue==='liste'?'0 1px 3px rgba(0,0,0,.1)':'none'}}>📋 Liste</button>
          <button onClick={()=>setVue('calendrier')} style={{background:vue==='calendrier'?'#fff':'transparent',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:700,color:vue==='calendrier'?'var(--rzc-navy)':'var(--rzc-text-3)',boxShadow:vue==='calendrier'?'0 1px 3px rgba(0,0,0,.1)':'none'}}>📅 Calendrier</button>
        </div>
      </div>

      {/* ── Recherche + filtres avancés ── */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher un nom, une destination…"
          style={{...inp, maxWidth:isMobile?'100%':260, width:isMobile?'100%':'auto', padding:'8px 12px', fontSize:13}}/>
        <select value={filterSociete} onChange={e=>setFilterSociete(e.target.value)}
          style={{...inp, maxWidth:170, padding:'8px 12px', fontSize:13}}>
          <option value="">Toutes sociétés</option>
          {societesDisponibles.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <input type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)} title="Départ à partir du" style={{...inp,maxWidth:145,padding:'8px 10px',fontSize:12}}/>
          <span style={{fontSize:11,color:'var(--rzc-text-4)'}}>→</span>
          <input type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)} title="Départ jusqu'au" style={{...inp,maxWidth:145,padding:'8px 10px',fontSize:12}}/>
        </div>
        {filtresActifs && (
          <button onClick={()=>{setSearch('');setFilterSociete('');setDateDebut('');setDateFin('')}}
            style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fecaca',borderRadius:8,padding:'8px 12px',cursor:'pointer',fontSize:12,fontWeight:700}}>
            ✕ Effacer les filtres
          </button>
        )}
        <span style={{fontSize:11,color:'var(--rzc-text-4)',marginLeft:'auto'}}>{filtered.length} résultat(s)</span>
      </div>

      {vue === 'calendrier' ? (
        <VueCalendrier voyages={filtered} mois={moisCalendrier} setMois={setMoisCalendrier} onSelectVoyage={openEdit} />
      ) : (
      <>
      {/* ── Tableau ── */}
      <div style={{ background:'var(--rzc-white)', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 12px rgba(30,58,138,.07)' }}>
        {loading ? (
          <div style={{ padding:48, textAlign:'center', fontSize:32 }}>⏳</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:56, textAlign:'center', color:'var(--rzc-text-4)' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🧳</div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--rzc-text-3)' }}>Aucun voyage</div>
            <div style={{ fontSize:12, marginTop:5 }}>Cliquez sur "+ Nouveau voyage" pour commencer</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg, #0f2447, #1e3a8a)' }}>
                  {['Personnel','Motif','Départ','Heure','Retour prévu','Statut','Validation','Actions'].map(h => (
                    <th key={h} style={{ padding:'11px 13px', textAlign:'left', fontSize:10.5, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:'rgba(255,255,255,.85)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => {
                  const sc = STATUT_STYLES[v.statut] || STATUT_STYLES.planifie
                  const p  = v.personnel_detail
                  const autresDuConvoi = v.rotation_id ? filtered.filter(x => x.rotation_id === v.rotation_id && x.id !== v.id) : []
                  const trajetDiffere = autresDuConvoi.some(x => x.destination && v.destination && x.destination !== v.destination)
                  return (
                    <tr key={v.id} style={{ borderTop:'1px solid #f1f5f9', background: i%2 ? '#fafafa':'var(--rzc-white)', transition:'.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = i%2?'#fafafa':'var(--rzc-white)'}>
                      <td style={{ padding:'11px 13px' }}>
                        <div style={{ fontWeight:700, color:'var(--rzc-navy)', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                          {p ? `${p.nom} ${p.prenom}` : v.destination || '—'}
                          {trajetDiffere && (
                            <span title="Ce trajet diffère des autres passagers du même convoi"
                              style={{fontSize:9,fontWeight:700,color:'#7c3aed',background:'rgba(124,58,237,.12)',
                                padding:'1px 6px',borderRadius:20,whiteSpace:'nowrap'}}>
                              🔀 Trajet différent
                            </span>
                          )}
                        </div>
                        {p?.societe && <div style={{ fontSize:10.5, color:'var(--rzc-text-4)', marginTop:1 }}>{p.societe}</div>}
                        <div style={{ fontSize:10, color:'var(--rzc-text-4)', marginTop:2 }}>
                          {(v.origine||'Camp')} → {v.destination||'—'}
                        </div>
                      </td>
                      <td style={{ padding:'11px 13px', fontSize:12, color:'var(--rzc-text-2)' }}>
                        <span style={{ background:'var(--rzc-charcoal)', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                          {v.motif || 'repos'}
                        </span>
                      </td>
                      <td style={{ padding:'11px 13px', fontFamily:'monospace', fontSize:12, color:'#334155' }}>{v.date_depart}</td>
                      <td style={{ padding:'11px 13px', fontFamily:'monospace', fontSize:12, color:'#7c3aed' }}>{v.heure_depart || '—'}</td>
                      <td style={{ padding:'11px 13px', fontFamily:'monospace', fontSize:12 }}>{v.date_retour_prevue}</td>
                      <td style={{ padding:'11px 13px' }}>
                        <span style={{ background:sc.bg, color:sc.color, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding:'11px 13px' }}>
                        {v.statut_validation === 'en_attente' && (
                          <span style={{background:'#fef3c7',color:'#92400e',padding:'4px 10px',borderRadius:20,fontSize:10.5,fontWeight:700,whiteSpace:'nowrap'}}>⏳ En attente</span>
                        )}
                        {v.statut_validation === 'valide' && (
                          <span style={{background:'#dcfce7',color:'#166534',padding:'4px 10px',borderRadius:20,fontSize:10.5,fontWeight:700,whiteSpace:'nowrap'}}>✅ Validé</span>
                        )}
                        {v.statut_validation === 'refuse' && (
                          <span style={{background:'#fee2e2',color:'#991b1b',padding:'4px 10px',borderRadius:20,fontSize:10.5,fontWeight:700,whiteSpace:'nowrap'}} title={v.motif_refus}>❌ Refusé</span>
                        )}
                      </td>
                      <td style={{ padding:'11px 13px' }}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {/* Billet imprimable — accessible à tous */}
                          <a href={voyages.billetUrl(v.id)} target="_blank" rel="noreferrer"
                            style={{...S_BTN('#f5f3ff','#7c3aed','#ddd6fe'), textDecoration:'none', display:'inline-flex', alignItems:'center'}} title="Billet imprimable">
                            🎫
                          </a>
                          {/* Valider / Refuser — admin uniquement, tant qu'en attente */}
                          {isAdmin && v.statut_validation === 'en_attente' && (
                            <>
                              <button onClick={()=>validerVoyage(v)}
                                style={S_BTN('#f0fdf4','#16a34a','#86efac')} title="Valider">✅</button>
                              <button onClick={()=>setRefusModal(v)}
                                style={S_BTN('#fef2f2','#dc2626','#fca5a5')} title="Refuser">❌</button>
                            </>
                          )}
                          {/* Modifier */}
                          <button onClick={()=>openEdit(v)}
                            style={S_BTN('#eff6ff','#2563eb','#bfdbfe')} title="Modifier">
                            ✏️
                          </button>
                          {/* Partir */}
                          {v.statut==='planifie' && (
                            <button onClick={()=>partir(v.id)}
                              style={S_BTN('#fff7ed','#f97316','#fed7aa')} title="Marquer en voyage">
                              🚀 Partir
                            </button>
                          )}
                          {/* Retour */}
                          {v.statut==='en_voyage' && (
                            <button onClick={()=>revenir(v)}
                              style={S_BTN('#f0fdf4','#16a34a','#86efac')} title="Retour au camp">
                              🏠 Retour
                            </button>
                          )}
                          {/* Annuler */}
                          {v.statut==='planifie' && (
                            <button onClick={()=>annulerVoyage(v)}
                              style={S_BTN('#f8fafc','var(--rzc-text-3)','var(--rzc-border-light)')} title="Annuler">
                              ✕
                            </button>
                          )}
                          {/* 🗑️ SUPPRIMER — TOUJOURS VISIBLE */}
                          <button onClick={()=>supprimerVoyage(v)}
                            style={{ ...S_BTN('#fef2f2','#dc2626','#fca5a5'), minWidth:80 }}
                            title="Supprimer ce voyage">
                            🗑️ Suppr.
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* ═══ MODAL CRÉER ═══ */}
      {modal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{ background:'var(--rzc-white)',width:'100%',maxWidth:540,maxHeight:'92dvh',overflow:'auto',borderRadius:'18px 18px 0 0',boxShadow:'0 -8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ position:'sticky',top:0,background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'var(--rzc-white)',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'18px 18px 0 0',zIndex:10 }}>
              <span style={{ fontWeight:700,fontSize:15 }}>🧳 {isAdmin?'Nouveau voyage':'Déclarer mon voyage'}</span>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'var(--rzc-white)',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:14 }}>
              {isAdmin && (
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>Personnel *</label>
                  <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                    <option value="">Sélectionner un agent…</option>
                    {personnelList.map(p => {
                      // Vérifier si cet agent a déjà un voyage actif dans la liste chargée
                      const enVoyage = data.find(v =>
                        String(v.personnel) === String(p.id) &&
                        ['planifie','en_voyage'].includes(v.statut)
                      )
                      return (
                        <option key={p.id} value={p.id}
                          style={enVoyage ? {color:'#DC2626',fontWeight:700} : {}}>
                          {enVoyage ? '⚠️ ' : ''}{p.nom} {p.prenom} — {p.societe||''}
                          {enVoyage ? ` (déjà en voyage: ${enVoyage.statut})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12 }}>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>
                    Point de départ <span style={{fontWeight:400,textTransform:'none',color:'var(--rzc-text-4)'}}>(pas forcément le camp — ex: 1er voyage d'un nouvel arrivant)</span>
                  </label>
                  <LieuInput value={form.origine} onChange={v=>setForm({...form,origine:v})}
                    onValidChange={v=>setForm(f=>({...f,_origineValide:v}))}
                    placeholder="Camp Roxgold Sango" style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>Destination *</label>
                  <LieuInput value={form.destination} onChange={v=>setForm({...form,destination:v})}
                    onValidChange={v=>setForm(f=>({...f,_destinationValide:v}))}
                    placeholder="Abidjan" style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>Motif</label>
                  <select value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})} style={inp}>
                    {['repos','medical','formation','conge','familial','administratif','autre'].map(m=>(
                      <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12 }}>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>Date départ *</label>
                  <input type="date" value={form.date_depart} onChange={e=>setForm({...form,date_depart:e.target.value})}
                    min={isAdmin ? undefined : new Date(Date.now()+48*3600*1000).toISOString().slice(0,10)} style={inp}/>
                  {!isAdmin && (
                    <div style={{ fontSize:10.5,color:'var(--rzc-text-4)',marginTop:4 }}>
                      Départ dans moins de 48h ? Contactez directement l'administrateur.
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>Heure</label>
                  <input type="time" value={form.heure_depart} onChange={e=>setForm({...form,heure_depart:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>Retour prévu</label>
                  <input type="date" value={form.date_retour_prevue} onChange={e=>setForm({...form,date_retour_prevue:e.target.value})} style={inp}/>
                </div>
              </div>

              {/* ── Itinéraire détaillé (optionnel, comme une agence de voyage) ── */}
              <div style={{border:'1px dashed #cbd5e1',borderRadius:10,padding:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:etapesForm.length?10:0,flexWrap:'wrap',gap:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:'var(--rzc-navy)'}}>🗺️ Itinéraire détaillé (optionnel) — véhicule/conducteur peuvent différer aller/retour</span>
                  <div style={{display:'flex',gap:6}}>
                    <button type="button" onClick={()=>ajouterEtape('aller')}
                      style={{background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',padding:'4px 10px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
                      ➡️ Étape ALLER
                    </button>
                    <button type="button" onClick={()=>ajouterEtape('retour')}
                      style={{background:'#f0fdf4',color:'#16a34a',border:'1px solid #bbf7d0',padding:'4px 10px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
                      ⬅️ Étape RETOUR
                    </button>
                  </div>
                </div>
                {etapesForm.map((e, idx) => (
                  <div key={idx} style={{background:e.sens==='retour'?'#f0fdf4':'#f8fafc',borderRadius:9,padding:10,marginBottom:8,border:e.sens==='retour'?'1px solid #bbf7d0':'none'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:e.sens==='retour'?'#16a34a':'var(--rzc-text-3)'}}>
                        {e.sens==='retour'?'⬅️':'➡️'} Étape {idx+1} — {e.sens==='retour'?'RETOUR':'ALLER'}
                      </span>
                      <button type="button" onClick={()=>supprimerEtapeForm(idx)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:11}}>🗑️ Retirer</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginBottom:6}}>
                      <input value={e.origine} onChange={ev=>majEtape(idx,'origine',ev.target.value)} placeholder="Origine" style={{...inp,fontSize:12,padding:'7px 9px'}}/>
                      <input value={e.destination} onChange={ev=>majEtape(idx,'destination',ev.target.value)} placeholder="Destination" style={{...inp,fontSize:12,padding:'7px 9px'}}/>
                      <select value={e.mode_transport} onChange={ev=>{
                          const nv = ev.target.value
                          setEtapesForm(prev => prev.map((etp,i) => i===idx ? {...etp, mode_transport:nv, vehicule_flotte:''} : etp))
                        }} style={{...inp,fontSize:12,padding:'7px 9px'}}>
                        {[['bus','🚌 Bus'],['4x4','🚙 4x4'],['avion','✈️ Avion'],['bateau','⛴️ Bateau'],['a_pied','🚶 À pied'],['autre','🚐 Autre']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    {e.mode_transport !== 'a_pied' && (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginBottom:6}}>
                      <select value={e.vehicule_flotte||''} onChange={ev=>majEtape(idx,'vehicule_flotte',ev.target.value)} style={{...inp,fontSize:12,padding:'7px 9px'}}>
                        <option value="">— Véhicule du parc ({e.mode_transport}) —</option>
                        {filtrerFlotteParMode(flotte, e.mode_transport).map(v=><option key={v.id} value={v.id}>{v.categorie_label} {v.nom} — {v.matricule}</option>)}
                      </select>
                      <select value={e.conducteur||''} onChange={ev=>majEtape(idx,'conducteur',ev.target.value)} style={{...inp,fontSize:12,padding:'7px 9px'}}>
                        <option value="">— Conducteur —</option>
                        {personnelList.map(p=><option key={p.id} value={`${p.nom} ${p.prenom}`}>{p.nom} {p.prenom}</option>)}
                      </select>
                    </div>
                    )}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:6}}>
                      <input type="date" value={e.date_etape} onChange={ev=>majEtape(idx,'date_etape',ev.target.value)} style={{...inp,fontSize:12,padding:'7px 9px'}}/>
                      <input type="time" value={e.heure_depart} onChange={ev=>majEtape(idx,'heure_depart',ev.target.value)} style={{...inp,fontSize:12,padding:'7px 9px'}}/>
                      <input value={e.point_rdv} onChange={ev=>majEtape(idx,'point_rdv',ev.target.value)} placeholder="Point de RDV" style={{...inp,fontSize:12,padding:'7px 9px'}}/>
                      <input value={e.reference} onChange={ev=>majEtape(idx,'reference',ev.target.value)} placeholder="Réf. (vol, plaque...)" style={{...inp,fontSize:12,padding:'7px 9px'}}/>
                    </div>
                    {e.mode_transport==='avion' && (
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginTop:6,padding:8,background:'#eff6ff',borderRadius:8}}>
                        <div>
                          <label style={{display:'block',fontSize:10,color:'var(--rzc-text-3)',marginBottom:3}}>🎫 Billet d'avion (justificatif)</label>
                          <input type="file" accept="image/*,.pdf"
                            onChange={ev=>{
                              const f = ev.target.files?.[0]
                              if (!f) return
                              if (f.size > 3*1024*1024) return toast.error("Fichier trop lourd (max 3 Mo)")
                              const reader = new FileReader()
                              reader.onload = () => majEtape(idx,'billet_fichier',reader.result)
                              reader.readAsDataURL(f)
                            }}
                            style={{...inp,fontSize:11,padding:'5px 6px'}}/>
                          {e.billet_fichier && <div style={{fontSize:10,color:'#16a34a',marginTop:3}}>✅ Fichier joint</div>}
                        </div>
                        <div>
                          <label style={{display:'block',fontSize:10,color:'var(--rzc-text-3)',marginBottom:3}}>Coût du billet (optionnel)</label>
                          <input type="number" value={e.billet_cout||''} onChange={ev=>majEtape(idx,'billet_cout',ev.target.value)}
                            placeholder="ex: 850000" style={{...inp,fontSize:12,padding:'7px 9px'}}/>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>Notes (optionnel)</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Informations complémentaires…" rows={3} style={{...inp,resize:'vertical'}}/>
              </div>
              <div style={{ display:'flex',gap:10,paddingTop:4 }}>
                <button onClick={()=>setModal(false)} style={{ flex:1,background:'#f8fafc',color:'var(--rzc-text-3)',border:'1px solid #e2e8f0',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600 }}>Annuler</button>
                <button onClick={createVoyage} disabled={submitting||form._origineValide===false||form._destinationValide===false}
                  style={{ flex:2,background:submitting?'var(--rzc-text-4)':'var(--rzc-navy)',color:'var(--rzc-white)',border:'none',padding:12,borderRadius:10,cursor:submitting?'not-allowed':'pointer',fontSize:14,fontWeight:700 }}>
                  {submitting?'⏳ Enregistrement…':'🧳 Déclarer le voyage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ÉDITER ═══ */}
      {editModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&setEditModal(null)}>
          <div style={{ background:'var(--rzc-white)',width:'100%',maxWidth:480,maxHeight:'92dvh',overflow:'auto',borderRadius:'18px 18px 0 0',boxShadow:'0 -8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ position:'sticky',top:0,background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'var(--rzc-white)',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'18px 18px 0 0',zIndex:10 }}>
              <span style={{ fontWeight:700,fontSize:15 }}>✏️ Modifier le voyage</span>
              <button onClick={()=>setEditModal(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'var(--rzc-white)',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:14 }}>
              {[
                ['Origine','origine','text','Camp Roxgold Sango'],
                ['Destination','destination','text','Abidjan…'],
                ['Date départ','date_depart','date',''],
                ['Heure départ','heure_depart','time',''],
                ['Retour prévu','date_retour_prevue','date',''],
              ].map(([label,field,type,ph]) => (
                <div key={field}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>{label}</label>
                  <input type={type} value={editModal[field]||''} placeholder={ph}
                    onChange={e=>setEditModal({...editModal,[field]:e.target.value})} style={inp}/>
                </div>
              ))}

              {/* Trajet retour — peut differer de l'aller (vehicule/conducteur/equipage) */}
              <div style={{border:'1px dashed #cbd5e1',borderRadius:10,padding:12}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--rzc-navy)',marginBottom:8}}>
                  🔄 Trajet retour <span style={{fontWeight:400,color:'var(--rzc-text-4)'}}>(si différent de l'aller)</span>
                </div>
                {[
                  ['Véhicule retour','vehicule_retour','text','ex: 4X4-03'],
                  ['Matricule retour','vehicule_matricule_retour','text','ex: CI-9999-ZZ'],
                  ['Conducteur retour','conducteur_retour','text','Nom du conducteur'],
                ].map(([label,field,type,ph])=>(
                  <div key={field} style={{marginBottom:8}}>
                    <label style={{ display:'block',fontSize:10,fontWeight:700,color:'var(--rzc-text-4)',marginBottom:4,textTransform:'uppercase' }}>{label}</label>
                    <input type={type} value={editModal[field]||''} placeholder={ph}
                      onChange={e=>setEditModal({...editModal,[field]:e.target.value})} style={{...inp,fontSize:13,padding:'8px 10px'}}/>
                  </div>
                ))}
              </div>

              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--rzc-text-3)',marginBottom:6,textTransform:'uppercase' }}>🗺️ Trajet</label>
                <CarteItineraire origine={editModal.origine} destination={editModal.destination}/>
              </div>
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>setEditModal(null)} style={{ flex:1,background:'#f8fafc',color:'var(--rzc-text-3)',border:'1px solid #e2e8f0',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600 }}>Annuler</button>
                <button onClick={saveEdit} disabled={submitting}
                  style={{ flex:2,background:submitting?'var(--rzc-text-4)':'var(--rzc-navy)',color:'var(--rzc-white)',border:'none',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700 }}>
                  {submitting?'⏳…':'💾 Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL REFUS ═══ */}
      {refusModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setRefusModal(null)}>
          <div style={{ background:'var(--rzc-white)',width:'100%',maxWidth:380,borderRadius:16,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ background:'#dc2626',color:'#fff',padding:'14px 20px' }}>
              <span style={{ fontWeight:700,fontSize:15 }}>❌ Refuser ce voyage</span>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:12 }}>
              <p style={{fontSize:13,color:'var(--rzc-text-2)',margin:0}}>
                Voyage de <b>{refusModal.personnel_detail?.nom} {refusModal.personnel_detail?.prenom}</b> vers {refusModal.destination}.
              </p>
              <textarea value={motifRefus} onChange={e=>setMotifRefus(e.target.value)}
                placeholder="Motif du refus (optionnel)…" rows={3} style={{...inp,resize:'vertical'}}/>
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>{setRefusModal(null);setMotifRefus('')}} style={{ flex:1,background:'#f8fafc',color:'var(--rzc-text-3)',border:'1px solid #e2e8f0',padding:11,borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:600 }}>Annuler</button>
                <button onClick={confirmerRefus} style={{ flex:2,background:'#dc2626',color:'#fff',border:'none',padding:11,borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700 }}>Confirmer le refus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
