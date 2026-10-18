import React, { useState, useEffect } from 'react'
import { useSurPulse } from '../hooks/useSurPulse'
import { useNavigate } from 'react-router-dom'
import { villesDescente, joursPour, libelleJours, messageJour } from '../utils/itineraires'
import { demandes as demandesAPI, batiments as batAPI, personnel as personnelAPI, voyages as voyagesAPI, inductionAPI, incidents as incidentsAPI, itinerairesModeles as itinerairesAPI, plaintes as plaintesAPI } from '../api'
import { useStore } from '../store'
import { toast, confirmDialog } from '../toast'
import { useIsMobile } from '../hooks/useIsMobile'
import { useMotifsMobilite, libelleMotif } from '../hooks/useMotifsMobilite'

const NAVY = '#0F2A5C', GOLD = '#D4A017', INK = '#5B6B86', LIGNE = '#D8DEE9'
const TYPE_COLORS = {
  reservation_residence:{ bg:'rgba(15,42,92,.08)', color:NAVY, icon:'🏠', label:'Réservation résidence' },
  voyage:{ bg:'rgba(212,160,23,.16)', color:'#8A6200', icon:'✈️', label:'Voyage' },
  maintenance:{ bg:'rgba(185,28,28,.08)', color:'#B91C1C', icon:'🛠️', label:'Maintenance' },
  plainte:{ bg:'rgba(185,28,28,.08)', color:'#B91C1C', icon:'🧹', label:'Plainte' },
  induction:{ bg:'rgba(30,58,138,.09)', color:'#1E3A8A', icon:'🎓', label:'Induction' },
}
const STATUT_STYLES = {
  en_attente:{ bg:'rgba(212,160,23,.16)', color:'#7A5200', label:'⏳ En attente' },
  validee:{ bg:'rgba(21,128,61,.11)', color:'#166534', label:'✅ Validée' },
  rejetee:{ bg:'rgba(185,28,28,.10)', color:'#B91C1C', label:'❌ Rejetée' },
  proposition:{ bg:'rgba(30,58,138,.10)', color:'#1E3A8A', label:'💬 Proposition admin' },
  acceptee:{ bg:'rgba(21,128,61,.11)', color:'#166534', label:'✅ Acceptée' },
  annulee:{ bg:'rgba(91,107,134,.12)', color:'#475569', label:'🚫 Annulée' },
}
const IC = {
  check:'M20 6 9 17l-5-5', croix:'M18 6 6 18M6 6l12 12', fleche:'M5 12h14M13 6l6 6-6 6',
  bulle:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  corbeille:'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6', annuler:'M3 7v6h6M3 13a9 9 0 1 0 3-7',
}
const Ico = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink:0 }}><path d={d}/></svg>
)
const LBL = { display:'block', fontSize:11.5, color:INK, marginBottom:5, fontFamily:"'IBM Plex Sans', sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:.8 }
const TITRE = { fontFamily:"'Barlow Condensed', 'IBM Plex Sans', sans-serif", letterSpacing:'.01em' }
const MONO = { fontFamily:"'JetBrains Mono', ui-monospace, monospace" }

// Mouvement : courbe forte, < 250 ms, uniquement transform/opacity, atténué si reduced-motion
const CSS_DEMANDES = `
.dm-card{animation:dmIn 240ms var(--ease-out,cubic-bezier(.23,1,.32,1)) both}
.dm-overlay{animation:dmFade 160ms ease-out both}
.dm-modal{animation:dmPop 200ms var(--ease-out,cubic-bezier(.23,1,.32,1)) both}
.dm-row{transition:background-color 120ms ease}
.dm-pill,.dm-btn{transition:transform 140ms var(--ease-out,cubic-bezier(.23,1,.32,1)),background-color 140ms ease,border-color 140ms ease,color 140ms ease}
.dm-pill:active,.dm-btn:active{transform:scale(.97)}
.dm-btn:focus-visible,.dm-pill:focus-visible{outline:2px solid ${GOLD};outline-offset:2px}
@media (hover:hover) and (pointer:fine){.dm-row:hover{background:#F3F5F9 !important}.dm-pill:hover{border-color:${NAVY} !important}.dm-btn:hover{filter:brightness(.96)}}
@media (max-width:768px){.dm-modal input,.dm-modal select,.dm-modal textarea{font-size:16px !important}}
@keyframes dmIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes dmFade{from{opacity:0}to{opacity:1}}
@keyframes dmPop{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.dm-card,.dm-modal{animation:dmFade 120ms ease both}.dm-pill:active,.dm-btn:active{transform:none}}
`

const inp = { background:'#fff', border:`1px solid ${LIGNE}`, color:'#0F1A2E', padding:'10px 12px', borderRadius:10, fontSize:14, minHeight:40, outline:'none', fontFamily:'inherit', width:'100%' }
const today = new Date().toISOString().slice(0,10)

export default function Demandes() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const motifsMobilite = useMotifsMobilite()
  const { user } = useStore()
  const role = (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
  const isAdmin = ['admin'].includes(role) || user?.is_staff || user?.is_superuser
  // Seuls les admins et les personnes ayant le droit Centre de mobilité peuvent demander un voyage
  const peutVoyager = !!isAdmin || user?.profile?.droit_mobilite !== false

  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(isAdmin ? 'pending' : 'mes_demandes')

  // Filet de securite contre une condition de course: si le profil
  // utilisateur (role admin) se charge APRES le tout premier rendu de
  // cette page (ex: navigation directe vers /demandes avant que le
  // store Zustand ait fini de recuperer /api/auth/me/), le useState
  // ci-dessus figeait "tab" sur 'mes_demandes' (vue agent) POUR
  // TOUJOURS, meme une fois isAdmin devenu vrai - la fusion
  // voyages/inductions/incidents ne s'activait alors jamais, de facon
  // totalement dependante du timing reseau (parfois ca marchait,
  // parfois non, sans rapport avec le code de l'action elle-meme).
  useEffect(() => {
    if (isAdmin && tab === 'mes_demandes') setTab('pending')
  }, [isAdmin])
  const [createModal, setCreateModal] = useState(null) // 'reservation'|'voyage'|'maintenance'
  const [detailModal, setDetailModal] = useState(null)
  const [actionModal, setActionModal] = useState(null) // {demande, action:'valider'|'rejeter'|'proposer'}
  const [actionSaving, setActionSaving] = useState(false)
  const [bats, setBats] = useState([])
  const [batsLoading, setBatsLoading] = useState(false)
  const [itineraires, setItineraires] = useState([])
  const dansAuMoins48h = new Date(Date.now()+48*3600*1000).toISOString().slice(0,10)
  const [form, setForm] = useState({
    message_demandeur:'', residence_souhaitee:'',
    date_debut_souhaitee:today, date_fin_souhaitee:'',
    donnees:{}
  })
  const [actionForm, setActionForm] = useState({ commentaire:'', proposition:{} })

  const [voyagesEnAttente, setVoyagesEnAttente] = useState([])
  const [inductionsEnAttente, setInductionsEnAttente] = useState([])
  const [incidentsEnAttente, setIncidentsEnAttente] = useState([])
  const [plaintesEnAttente, setPlaintesEnAttente] = useState([])
  // Boutons de filtre par type (demande d'Edgar : "quand je clique sur
  // voyage je ne vois que les demandes de voyage") - Maintenance et
  // Plaintes regroupes sous un seul bouton (meme nature : signalement a
  // router vers son propre module, pas une validation admin classique).
  const [typeFilter, setTypeFilter] = useState('')
  const TYPE_FILTER_BTNS = [
    ['reservation_residence','🏠 Résidence'],
    ['voyage','✈️ Voyage'],
    ['maintenance_plaintes','🛠️🧹 Maintenance & Plaintes'],
  ]

  const load = (silencieux) => {
    if (silencieux !== true) setLoading(true)
    const p = {}
    if (tab === 'pending') p.statut = 'en_attente'
    else if (tab === 'propositions') p.statut = 'proposition'
    else if (tab === 'archive') {} // all
    demandesAPI.list(p).then(r => setData(r.data.results||r.data)).finally(()=>setLoading(false))
    if (isAdmin) demandesAPI.stats().then(r => setStats(r.data)).catch(()=>{})
    // Vue unifiee : sur l'onglet 'en attente', agrege aussi les voyages
    // en attente de validation (Centre de Mobilite), les inductions
    // terminees en attente de validation, et les incidents non assignes
    // — un seul endroit pour tout ce qui necessite une action admin,
    // plutot que des files d'attente eparpillees dans differents modules.
    if (isAdmin && tab === 'pending') {
      voyagesAPI.list({statut_validation:'en_attente', page_size:100}).then(r => {
        setVoyagesEnAttente((r.data.results||r.data||[]).map(v=>({..._v_to_demande(v)})))
      }).catch(()=>setVoyagesEnAttente([]))
      inductionAPI.list({statut:'en_cours', page_size:100}).then(r => {
        const recs = (r.data.results||r.data||[]).filter(rec => rec.quiz_score != null)
        setInductionsEnAttente(recs.map(rec=>({..._i_to_demande(rec)})))
      }).catch(()=>setInductionsEnAttente([]))
      incidentsAPI.list({statut:'declare', page_size:100}).then(r => {
        setIncidentsEnAttente((r.data.results||r.data||[]).map(inc=>({..._m_to_demande(inc)})))
      }).catch(()=>setIncidentsEnAttente([]))
      // Plaintes pas encore closes - mêmes données que le bouton de filtre
      // "Maintenance & Plaintes" doit pouvoir montrer (bouton demandé par
      // Edgar, sinon il ne montrerait que la maintenance, pas les plaintes).
      plaintesAPI.list({page_size:200}).then(r => {
        const items = (r.data.results||r.data||[]).filter(p=>!['cloturee','rejetee'].includes(p.statut))
        setPlaintesEnAttente(items.map(p=>({..._p_to_demande(p)})))
      }).catch(()=>setPlaintesEnAttente([]))
    } else {
      setVoyagesEnAttente([]); setInductionsEnAttente([]); setIncidentsEnAttente([]); setPlaintesEnAttente([])
    }
    // BUG REEL CORRIGE ICI : batAPI.list() (BatimentViewSet.list) est
    // volontairement restreint côté backend pour qu'un non-admin ne voie
    // QUE sa propre chambre (règle ajoutée pour empêcher un agent de lister
    // l'occupation de tout le camp) — ce qui, par effet de bord, vidait
    // aussi cette liste de "résidences libres" du formulaire de demande
    // pour tout le monde sauf l'admin. chambres_disponibles est l'endpoint
    // dédié à cet usage précis (section 12), ouvert à tout utilisateur
    // connecté, donc on l'utilise ici à la place.
    batAPI.chambresDisponibles(today).then(r => {
      const items = r.data.compatibles||[]
      setBats([...items].sort((a,b)=>a.residence.localeCompare(b.residence,undefined,{numeric:true})))
    }).catch(()=>setBats([]))
    itinerairesAPI.list().then(r => {
      const items = r.data.results||r.data||[]
      setItineraires(items.filter(i=>i.actif))
    }).catch(()=>setItineraires([]))
  }

  // Adapte un Voyage au meme "gabarit" visuel qu'une Demande, pour
  // pouvoir les afficher cote a cote dans la meme liste unifiee.
  const _v_to_demande = (v) => ({
    id: `voyage-${v.id}`, _voyageId: v.id, _source: 'voyage',
    type_demande: 'voyage', statut: 'en_attente',
    demandeur_nom: v.personnel_nom, date_creation: v.created_at,
    date_debut_souhaitee: v.date_depart, date_fin_souhaitee: v.date_retour_prevue,
    donnees: { destination: v.destination, motif: v.motif, origine: v.origine },
    message_demandeur: v.motif ? `${v.motif} — vers ${v.destination||'—'}` : `Voyage vers ${v.destination||'—'}`,
  })

  // Induction terminee (toutes etapes + quiz fait) mais pas encore
  // validee par un admin - meme logique de fusion que les voyages.
  const _i_to_demande = (rec) => ({
    id: `induction-${rec.id}`, _inductionId: rec.id, _source: 'induction',
    type_demande: 'induction', statut: 'en_attente',
    demandeur_nom: rec.personnel_detail ? `${rec.personnel_detail.nom} ${rec.personnel_detail.prenom}` : '—',
    date_creation: rec.date_debut,
    message_demandeur: `Induction terminée — quiz ${rec.quiz_score ?? '—'}%, à valider`,
  })

  // Incident non assigne (declare, personne ne l'a encore pris en
  // charge) - traite comme une "demande" a router: prendre en charge
  // (valider) ou annuler (rejeter, avec raison).
  const _m_to_demande = (inc) => ({
    id: `incident-${inc.id}`, _incidentId: inc.id, _source: 'incident',
    type_demande: 'maintenance', statut: 'en_attente',
    demandeur_nom: inc.auteur_nom || '—',
    date_creation: inc.date_creation,
    message_demandeur: `${inc.titre} — ${inc.categorie||''} (${inc.priorite||'moyenne'})`,
  })

  // Plainte pas encore close - affichee ici pour le filtre groupe
  // "Maintenance & Plaintes", mais PAS de Valider/Rejeter generique : le
  // workflow d'une plainte (qualifier/affecter/prendre en charge/resoudre)
  // est deja entierement gere par la page Plaintes (reutiliser, pas
  // reinventer un 2e circuit ici) - un lien y renvoie directement.
  const _p_to_demande = (p) => ({
    id: `plainte-${p.id}`, _plainteId: p.id, _source: 'plainte',
    type_demande: 'plainte', statut: 'en_attente',
    demandeur_nom: p.occupant_nom || '—',
    date_creation: p.date_creation,
    message_demandeur: `${p.categorie_label || p.categorie}${p.sous_categorie ? ' — '+p.sous_categorie : ''} (${p.statut_label || p.statut})`,
  })

  useEffect(()=>{ load() }, [tab])
  useSurPulse(['demandes'], () => load(true))

  const submitDemande = async (type, forcer=false) => {
    if (type === 'voyage' && !form.donnees?.motif) { toast.error('Choisissez un motif.'); return }
    try {
      const message_demandeur = type === 'voyage'
        ? [libelleMotif(form.donnees.motif), (form.message_demandeur||'').trim()].filter(Boolean).join(' — ')
        : form.message_demandeur
      await demandesAPI.create({ type_demande:type, ...form, message_demandeur, ...(forcer?{forcer_jour:true}:{}) })
      setCreateModal(null)
      setForm({ message_demandeur:'', residence_souhaitee:'', date_debut_souhaitee:today, date_fin_souhaitee:'', donnees:{} })
      load()
    } catch(e) {
      const d = e.response?.data
      if (d?.code === 'jour_non_autorise') {
        if (d.forcable && isAdmin && await confirmDialog(`${d.error}\n\nCréer quand même ?`)) return submitDemande(type, true)
        if (!(d.forcable && isAdmin)) toast.error(d.error)
        return
      }
      toast.error(d?.error || d?.detail || (d?JSON.stringify(d):e.message))
    }
  }

  const doAction = async () => {
    const { demande, action } = actionModal
    // Un refus doit toujours etre justifie - sans ca, impossible de
    // comprendre pourquoi une demande a ete refusee, ni pour le demandeur
    // ni pour un audit ulterieur.
    if (action === 'rejeter' && !actionForm.commentaire?.trim()) {
      toast.error('Vous devez justifier le refus avant de continuer.')
      return
    }
    setActionSaving(true)
    try {
      if (demande._source === 'voyage') {
        if (action === 'valider') await voyagesAPI.valider(demande._voyageId)
        else if (action === 'rejeter') await voyagesAPI.refuser(demande._voyageId, actionForm.commentaire)
        else if (action === 'proposer') {
          // Le modele Voyage n'a pas d'etat "proposition" separe (contrairement
          // a Demande) - la contre-proposition se traduit par un refus dont le
          // motif porte l'alternative suggeree, pour que ce soit trace et
          // visible par l'agent qui a fait la demande initiale.
          if (!actionForm.commentaire?.trim()) { toast.error('Précisez votre proposition.'); setActionSaving(false); return }
          await voyagesAPI.refuser(demande._voyageId, `Proposition : ${actionForm.commentaire}`)
        }
        else { toast.error("Cette action n'est pas disponible pour un voyage."); setActionSaving(false); return }
      } else if (demande._source === 'induction') {
        if (action === 'valider') await inductionAPI.valider(demande._inductionId)
        else if (action === 'rejeter') await inductionAPI.refuser(demande._inductionId, actionForm.commentaire)
        else { toast.error("Cette action n'est pas disponible pour une induction."); setActionSaving(false); return }
      } else if (demande._source === 'incident') {
        if (action === 'valider') await incidentsAPI.assigner(demande._incidentId, { technicien_id: user?.id })
        else if (action === 'rejeter') await incidentsAPI.annuler(demande._incidentId, { raison: actionForm.commentaire })
        else { toast.error("Cette action n'est pas disponible pour un incident."); setActionSaving(false); return }
      } else {
        if (action === 'valider') await demandesAPI.valider(demande.id, actionForm)
        else if (action === 'rejeter') await demandesAPI.rejeter(demande.id, actionForm)
        else if (action === 'proposer') await demandesAPI.proposer(demande.id, actionForm)
      }
      setActionModal(null)
      setActionForm({ commentaire:'', proposition:{} })
      setDetailModal(null)
      // Retire IMMEDIATEMENT l'element traite de la liste locale, sans
      // attendre le prochain load() (qui peut prendre un instant reseau) -
      // pendant lequel les boutons Valider/Refuser restaient sinon
      // cliquables sur un element deja traite, donnant l'impression que
      // "la main" n'avait jamais ete retiree.
      if (demande._source === 'voyage') setVoyagesEnAttente(prev => prev.filter(v => v._voyageId !== demande._voyageId))
      else if (demande._source === 'induction') setInductionsEnAttente(prev => prev.filter(v => v._inductionId !== demande._inductionId))
      else if (demande._source === 'incident') setIncidentsEnAttente(prev => prev.filter(v => v._incidentId !== demande._incidentId))
      else setData(prev => prev.filter(dd => dd.id !== demande.id))
      load()
    } catch(e) { toast.error(e.response?.data?JSON.stringify(e.response.data):e.message) }
    finally { setActionSaving(false) }
  }

  const doAgentAction = async (demande, action) => {
    try {
      if (action === 'accepter') await demandesAPI.accepterProposition(demande.id)
      else if (action === 'refuser') await demandesAPI.refuserProposition(demande.id)
      else if (action === 'annuler') await demandesAPI.annuler(demande.id)
      load()
    } catch(e) { toast.error(e.response?.data?.error||e.message) }
  }

  const deleteDemande = async (d) => {
    if (!await confirmDialog('Supprimer définitivement cette demande ?')) return
    if (d._source === 'voyage') await voyagesAPI.supprimer(d._voyageId)
    else if (d._source === 'induction' || d._source === 'incident') { toast.error("Utilisez Valider/Rejeter pour traiter cet élément — la suppression n'est pas disponible ici."); return }
    else await demandesAPI.delete(d.id)
    if (d._source === 'voyage') setVoyagesEnAttente(prev => prev.filter(v => v._voyageId !== d._voyageId))
    else setData(prev => prev.filter(dd => dd.id !== d.id))
    load()
  }

  const ADMIN_TABS = [['pending','⏳ En attente'],['propositions','💬 Propositions'],['archive','📋 Toutes']]
  const AGENT_TABS = [['mes_demandes','📋 Mes demandes'],['proposition_recue','💬 Propositions reçues']]

  const filterData = () => {
    let base
    if (!isAdmin && tab === 'proposition_recue') base = data.filter(d=>d.statut==='proposition')
    else if (isAdmin && tab === 'pending') {
      // Fusionne demandes classiques + voyages + inductions + incidents + plaintes en attente, tries par date
      base = [...data, ...voyagesEnAttente, ...inductionsEnAttente, ...incidentsEnAttente, ...plaintesEnAttente].sort((a,b)=>new Date(b.date_creation||0)-new Date(a.date_creation||0))
    }
    else base = data
    if (!typeFilter) return base
    if (typeFilter === 'maintenance_plaintes') return base.filter(d=>['maintenance','plainte'].includes(d.type_demande))
    return base.filter(d=>d.type_demande===typeFilter)
  }

  // Boutons d'action d'une demande (carte mobile et ligne de tableau PC)
  // Hiérarchie : Valider = plein vert (action principale), Proposer = plein navy,
  // Rejeter = contour rouge, Annuler/Supprimer = discrets. Icônes SVG (nettes à toute taille).
  const bt = (ton) => {
    const base = {
      display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
      flex: isMobile ? 1 : 'none', minHeight: isMobile ? 42 : 36, padding: isMobile ? '8px 12px' : '7px 14px',
      borderRadius:10, cursor:'pointer', fontSize: isMobile ? 13 : 12.5, fontWeight:700, fontFamily:'inherit', letterSpacing:.1,
      whiteSpace:'nowrap', border:'1px solid transparent',
    }
    const T = {
      ok:    { background:'linear-gradient(180deg,#1b7f45,#166534)', color:'#fff', borderColor:'#14532d', boxShadow:'inset 0 1px 0 rgba(255,255,255,.18), 0 2px 6px rgba(22,101,52,.28)' },
      alt:   { background:`linear-gradient(180deg,#183a78,${NAVY})`, color:'#fff', borderColor:'#081B3D', boxShadow:'inset 0 1px 0 rgba(255,255,255,.14), 0 2px 6px rgba(15,42,92,.28)' },
      ko:    { background:'#fff', color:'#B91C1C', borderColor:'rgba(185,28,28,.45)' },
      lien:  { background:'#fff', color:NAVY, borderColor:NAVY },
      neutre:{ background:'#fff', color:'#475569', borderColor:LIGNE },
    }[ton]
    return { ...base, ...T }
  }
  const actionsDe = (d, compact) => (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8, width:'100%', marginTop: isMobile ? 4 : 0,
        ...(!isMobile && !compact ? { paddingTop:10, borderTop:'1px solid '+LIGNE } : {}) }}>
      {/* Plainte : son workflow vit déjà dans la page Plaintes, on y renvoie */}
      {isAdmin && d._source === 'plainte' && (
        <button className="dm-btn" onClick={()=>navigate('/plaintes')} style={bt('lien')}>Plaintes <Ico d={IC.fleche}/></button>
      )}
      {isAdmin && d._source !== 'plainte' && d.statut === 'en_attente' && (
        <>
          <button className="dm-btn" onClick={()=>{ setActionModal({demande:d,action:'valider'}); setActionForm({commentaire:'',proposition:{residence:d.residence_souhaitee}}) }}
            style={bt('ok')}><Ico d={IC.check}/> Valider</button>
          {!['induction','incident'].includes(d._source) && (
            <button className="dm-btn" onClick={()=>{ setActionModal({demande:d,action:'proposer'}); setActionForm({commentaire:'',proposition:{residence:d.residence_souhaitee}}) }}
              style={bt('alt')}><Ico d={IC.bulle}/> Proposer</button>
          )}
          <button className="dm-btn" onClick={()=>{ setActionModal({demande:d,action:'rejeter'}); setActionForm({commentaire:'',proposition:{}}) }}
            style={bt('ko')}><Ico d={IC.croix}/> Rejeter</button>
        </>
      )}
      {isAdmin && d.statut === 'proposition' && (
        <span style={{ fontSize:12, color:'#1E3A8A', fontStyle:'italic', alignSelf:'center' }}>Réponse attendue…</span>
      )}
      {!isAdmin && d.statut === 'proposition' && (
        <>
          <button className="dm-btn" onClick={()=>doAgentAction(d,'accepter')} style={bt('ok')}><Ico d={IC.check}/> Accepter</button>
          <button className="dm-btn" onClick={()=>doAgentAction(d,'refuser')} style={bt('ko')}><Ico d={IC.croix}/> Refuser</button>
        </>
      )}
      {!isAdmin && d.statut === 'en_attente' && (
        <button className="dm-btn" onClick={()=>doAgentAction(d,'annuler')} style={bt('neutre')}><Ico d={IC.annuler}/> Annuler la demande</button>
      )}
      {isAdmin && d._source !== 'plainte' && (
        <button className="dm-btn" aria-label="Supprimer" title="Supprimer" onClick={()=>deleteDemande(d)}
          style={{ ...bt('neutre'), flex:'none', minWidth: isMobile ? 44 : 36, padding:'7px 10px', color:'#B91C1C', marginLeft: isMobile ? 0 : 'auto' }}><Ico d={IC.corbeille}/></button>
      )}
    </div>
  )

  return (
    <div style={{ padding: isMobile ? '16px' : '20px 28px', width:'100%', boxSizing:'border-box' }}>
      <style>{CSS_DEMANDES}</style>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ ...TITRE, fontSize:isMobile?26:32, fontWeight:700, color:NAVY, margin:0, lineHeight:1.1, textTransform:'uppercase' }}>Demandes & Workflow</h2>
          <div style={{ width:44, height:3, background:GOLD, borderRadius:2, marginTop:6 }}/>
          <p style={{ fontSize:13, color:INK, marginTop:8, marginBottom:0 }}>
            {isAdmin ? 'Validation admin · Suivi complet des demandes' : 'Soumettez vos demandes · Suivez leur statut'}
          </p>
        </div>
        {!isAdmin && !isMobile && (
          <div style={{ display:'flex', gap:8 }}>
            <button className="dm-btn" onClick={()=>setCreateModal('reservation_residence')}
              style={{ background:NAVY, color:'#fff', border:'1px solid '+NAVY, minHeight:40, padding:'8px 16px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>
              🏠 Réserver résidence
            </button>
            {peutVoyager && <button className="dm-btn" onClick={()=>setCreateModal('voyage')}
              style={{ background:GOLD, color:NAVY, border:'1px solid '+GOLD, minHeight:40, padding:'8px 16px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>
              ✈️ Planifier voyage
            </button>}
          </div>
        )}
      </div>

      {/* Filtre par type (demande d'Edgar : cliquer sur "Voyage" ne montre
          plus que les demandes de voyage) - place au-dessus des KPI/onglets
          (Propositions, etc.) pour filtrer tout ce qui suit. */}
      <div style={isMobile
        ? { display:'flex', gap:8, marginBottom:14, overflowX:'auto', paddingBottom:4 }
        : { display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {TYPE_FILTER_BTNS.map(([v,l])=>(
          <button key={v} className="dm-pill" onClick={()=>setTypeFilter(f=>f===v?'':v)} aria-pressed={typeFilter===v}
            style={{flexShrink:0, minHeight:isMobile?40:36, padding:'7px 16px', borderRadius:99, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              border:`1px solid ${typeFilter===v?NAVY:LIGNE}`,
              background:typeFilter===v?NAVY:'#fff',
              color:typeFilter===v?'#fff':'#334155'}}>
            {l}
          </button>
        ))}
        {typeFilter && (
          <button className="dm-pill" onClick={()=>setTypeFilter('')}
            style={{flexShrink:0, minHeight:isMobile?40:36, padding:'7px 14px', borderRadius:99, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              border:'1px solid '+LIGNE, background:'transparent', color:INK}}>
            ✕ Tous types
          </button>
        )}
      </div>

      {/* FABs mobile — remplacent les 2 boutons d'action agent, cachés dans le header exigu */}
      {!isAdmin && isMobile && (
        <div style={{ position:'fixed', right:16, bottom:'calc(98px + env(safe-area-inset-bottom, 0px))', display:'flex', flexDirection:'column', gap:10, zIndex:80 }}>
          <button onClick={()=>setCreateModal('reservation_residence')} aria-label="Réserver résidence"
            style={{ width:46, height:46, borderRadius:23, background:NAVY, border:'none', boxShadow:'0 6px 16px rgba(15,42,92,.4)', fontSize:19, cursor:'pointer' }} className="dm-btn">
            🏠
          </button>
          {peutVoyager && <button onClick={()=>setCreateModal('voyage')} aria-label="Planifier voyage"
            style={{ width:54, height:54, borderRadius:27, background:GOLD, border:'none', boxShadow:'0 6px 16px rgba(212,160,23,.45)', fontSize:22, cursor:'pointer' }} className="dm-btn">
            ✈️
          </button>}
        </div>
      )}

      {/* Admin KPIs */}
      {isAdmin && stats && (
        <div style={isMobile
          ? { display:'flex', gap:8, overflowX:'auto', marginBottom:16, paddingBottom:4 }
          : { display:'grid', gridTemplateColumns:'repeat(5, minmax(0,1fr))', gap:14, marginBottom:18 }}>
          {[
            [(stats.en_attente||0) + voyagesEnAttente.length + inductionsEnAttente.length + incidentsEnAttente.length,'En attente','#7A5200','⏳'],
            [stats.propositions,'Propositions','#1E3A8A','💬'],
            [stats.validees,'Validées','#166534','✅'],
            [stats.rejetees,'Rejetées','#B91C1C','❌'],
            [stats.total,'Total',NAVY,'📋'],
          ].map(([v,l,c,ic])=>(
            <div key={l} style={isMobile
              ? { flexShrink:0, minWidth:88, background:'#fff', border:'1px solid '+LIGNE, borderRadius:12, padding:'10px 14px', borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }
              : { background:'#fff', border:'1px solid '+LIGNE, borderRadius:14, padding:'16px 18px', borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }}>
              <div style={{ ...MONO, fontSize:isMobile?20:32, fontWeight:700, color:c, lineHeight:1.1 }}>{v}</div>
              <div style={{ fontSize:11, fontWeight:600, color:INK, marginTop:6, textTransform:'uppercase', letterSpacing:.8, whiteSpace:'nowrap' }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={isMobile
        ? { display:'flex', gap:8, marginBottom:14, overflowX:'auto', paddingBottom:4 }
        : { display:'flex', gap:2, marginBottom:16, background:'#F3F5F9', borderRadius:12, padding:4, border:'1px solid '+LIGNE, maxWidth:900 }}>
        {(isAdmin ? ADMIN_TABS : AGENT_TABS).map(([k,l])=>(
          <button key={k} className="dm-pill" onClick={()=>setTab(k)} aria-pressed={tab===k}
            style={isMobile
              ? { flexShrink:0, minHeight:40, padding:'7px 16px', borderRadius:99, border:tab===k?'1px solid '+NAVY:'1px solid '+LIGNE, cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit', background:tab===k?NAVY:'#fff', color:tab===k?'#fff':'#334155' }
              : { flex:1, minHeight:38, padding:'8px 4px', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit',
                  background:tab===k?'#fff':'transparent', color:tab===k?NAVY:INK,
                  boxShadow:tab===k?`inset 0 -2px 0 ${GOLD}, var(--shadow)`:'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? <div style={{padding:32,textAlign:'center',color:INK}}>Chargement…</div> : (
        <div style={isMobile ? { display:'flex', flexDirection:'column', gap:10 } : { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%,560px), 1fr))', gap:14, alignItems:'start' }}>
          {filterData().length === 0 && (
            <div style={{ gridColumn:'1 / -1', background:'#fff', border:'1px solid '+LIGNE, borderRadius:14, padding:40, textAlign:'center', color:INK, boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
              <div style={{ ...TITRE, fontSize:20, fontWeight:600, color:NAVY }}>{isAdmin ? "Aucune demande en attente" : "Aucune demande soumise"}</div>
              {!isAdmin && <div style={{ fontSize:12, marginTop:6 }}>Utilisez les boutons pour soumettre une demande</div>}
            </div>
          )}
          {!isMobile && filterData().length > 0 && (
            <div style={{ gridColumn:'1 / -1', background:'#fff', border:'1px solid '+LIGNE, borderRadius:14, boxShadow:'var(--shadow)', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#F3F5F9', textAlign:'left' }}>
                    {['Type', ...(isAdmin ? ['Demandeur'] : []), 'Détail', 'Date', 'Statut', 'Actions'].map(h => (
                      <th key={h} style={{ padding:'11px 16px', fontSize:11.5, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:INK, whiteSpace:'nowrap' }}>{h}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {filterData().map(d => {
                    const tc = TYPE_COLORS[d.type_demande] || TYPE_COLORS.maintenance
                    const sc = STATUT_STYLES[d.statut] || STATUT_STYLES.en_attente
                    return (
                      <tr key={d.id} className="dm-row" style={{ borderTop:'1px solid '+LIGNE, background: d.statut==='en_attente' ? 'rgba(212,160,23,.07)' : 'transparent', verticalAlign:'top' }}>
                        <td style={{ padding:'14px 16px', whiteSpace:'nowrap' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:8, fontWeight:700, color:NAVY }}>
                            <span style={{ width:32, height:32, borderRadius:9, background:tc.bg, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{tc.icon}</span>{tc.label}
                          </span>
                        </td>
                        {isAdmin && <td style={{ padding:'14px 16px', fontWeight:600 }}>{d.demandeur_nom}</td>}
                        <td style={{ padding:'14px 16px', minWidth:200, maxWidth:380 }}>
                          {d.message_demandeur && <div style={{ lineHeight:1.45, marginBottom:4 }}>{d.message_demandeur}</div>}
                          <div style={{ display:'flex', gap:12, fontSize:12, color:INK, flexWrap:'wrap' }}>
                            {d.residence_souhaitee && <span>🏠 {d.residence_souhaitee}</span>}
                            {d.date_debut_souhaitee && <span>📅 {d.date_debut_souhaitee}{d.date_fin_souhaitee ? ` → ${d.date_fin_souhaitee}` : ''}</span>}
                          </div>
                          {d.commentaire_admin && (
                            <div style={{ marginTop:6, fontSize:12, background:d.statut==='proposition'?'rgba(30,58,138,.06)':'rgba(22,163,74,.06)', borderRadius:8, padding:'6px 10px' }}>
                              {d.statut==='proposition' && <b style={{color:'#1E3A8A'}}>💬 Proposition : </b>}
                              {d.statut==='validee' && <b style={{color:'#166534'}}>✅ Admin : </b>}
                              {d.statut==='rejetee' && <b style={{color:'#B91C1C'}}>❌ Rejet : </b>}
                              {d.commentaire_admin}
                              {d.proposition_admin && Object.entries(d.proposition_admin).map(([k,v]) => <span key={k}> · <b>{k} :</b> {v}</span>)}
                            </div>)}
                        </td>
                        <td style={{ padding:'14px 16px', whiteSpace:'nowrap', color:INK }}>{new Date(d.date_creation).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding:'14px 16px', whiteSpace:'nowrap' }}><span style={{ background:sc.bg, color:sc.color, padding:'4px 11px', borderRadius:20, fontSize:12, fontWeight:700 }}>{sc.label}</span></td>
                        <td style={{ padding:'14px 12px', minWidth:150 }}>{actionsDe(d, true)}</td>
                      </tr>)
                  })}
                </tbody>
              </table>
            </div>)}
          {isMobile && filterData().map((d, i) => {
            const tc = TYPE_COLORS[d.type_demande] || TYPE_COLORS.maintenance
            const sc = STATUT_STYLES[d.statut] || STATUT_STYLES.en_attente
            return (
              <div key={d.id} className="dm-card" style={{ animationDelay:`${Math.min(i,8)*35}ms`, background:'#fff', border:`1px solid ${d.statut==='en_attente'?'rgba(212,160,23,.45)':LIGNE}`, borderLeft:`3px solid ${d.statut==='en_attente'?GOLD:LIGNE}`, borderRadius:14, padding:isMobile?13:16, boxShadow:'var(--shadow)', display:'flex', gap:isMobile?12:14, alignItems:'flex-start', flexWrap:'wrap' }}>
                <div style={{ width:isMobile?44:50, height:isMobile?44:50, borderRadius:12, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:isMobile?20:22, flexShrink:0 }}>
                  {tc.icon}
                </div>
                <div style={{ flex:1, minWidth:isMobile?'70%':'calc(100% - 70px)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:15, color:NAVY }}>{tc.label}</span>
                    <span style={{ background:sc.bg, color:sc.color, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{sc.label}</span>
                    {isAdmin && <span style={{ fontSize:12.5, color:INK }}>par {d.demandeur_nom}</span>}
                  </div>
                  {d.message_demandeur && <div style={{ fontSize:13, color:'#334155', marginBottom:6, lineHeight:1.4, ...(isMobile ? { display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' } : {}) }}>{d.message_demandeur}</div>}
                  <div style={{ display:'flex', gap:12, fontSize:12, color:INK, flexWrap:'wrap' }}>
                    {d.residence_souhaitee && <span>🏠 {d.residence_souhaitee}</span>}
                    {d.date_debut_souhaitee && <span>📅 {d.date_debut_souhaitee}</span>}
                    {d.date_fin_souhaitee && <span>→ {d.date_fin_souhaitee}</span>}
                    <span>🕐 {new Date(d.date_creation).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {d.commentaire_admin && (
                    <div style={{ marginTop:8, background:d.statut==='proposition'?'rgba(30,58,138,.06)':'rgba(22,163,74,.06)', border:`1px solid ${d.statut==='proposition'?'rgba(30,58,138,.15)':'rgba(22,163,74,.15)'}`, borderRadius:8, padding:'8px 12px', fontSize:12 }}>
                      {d.statut==='proposition' && <b style={{color:'#1E3A8A'}}>💬 Proposition : </b>}
                      {d.statut==='validee' && <b style={{color:'#166534'}}>✅ Admin : </b>}
                      {d.statut==='rejetee' && <b style={{color:'#B91C1C'}}>❌ Rejet : </b>}
                      {d.commentaire_admin}
                      {d.proposition_admin && Object.keys(d.proposition_admin).length>0 && (
                        <div style={{marginTop:6}}>
                          {Object.entries(d.proposition_admin).map(([k,v])=>(
                            <div key={k}><b>{k} :</b> {v}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {actionsDe(d, false)}
              </div>
            )
          })}
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      {createModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }} className="dm-overlay">
          <div className="dm-modal" style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'16px 20px', background:`linear-gradient(135deg, ${NAVY}, #081B3D)`, borderBottom:`3px solid ${GOLD}`, borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ ...TITRE, color:'#fff', fontSize:20, fontWeight:600, margin:0, textTransform:'uppercase' }}>{TYPE_COLORS[createModal]?.icon} {TYPE_COLORS[createModal]?.label}</h3>
              <button className="dm-btn" aria-label="Fermer" onClick={()=>setCreateModal(null)} style={{ background:'rgba(255,255,255,.16)', border:'none', color:'#fff', borderRadius:8, cursor:'pointer', width:36, height:36, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ background:'rgba(15,42,92,.05)', border:'1px solid '+LIGNE, borderLeft:`3px solid ${GOLD}`, borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#334155' }}>
                📋 Votre demande sera envoyée à l'admin pour validation. Vous serez notifié de la décision.
              </div>

              {createModal === 'reservation_residence' && (
                <div style={{ marginBottom:12 }}>
                  <label style={LBL}>Résidence souhaitée</label>
                  <select value={form.residence_souhaitee} onChange={e=>setForm({...form,residence_souhaitee:e.target.value})} style={inp}>
                    <option value="">— Sélectionner une résidence libre —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              {createModal === 'voyage' && (
                <div style={{ marginBottom:12 }}>
                  <label style={LBL}>Itinéraire</label>
                  <select value={form.donnees?.itineraire_modele||''} onChange={e=>{
                    const it = itineraires.find(i=>String(i.id)===e.target.value)
                    setForm({...form, donnees:{...form.donnees, itineraire_modele:e.target.value, destination:it?.destination||'', origine:it?.origine||''}})
                  }} style={inp}>
                    <option value="">— Sélectionner un itinéraire —</option>
                    {itineraires.map(i=><option key={i.id} value={i.id}>{i.nom} ({i.origine} → {i.destination})</option>)}
                  </select>
                  {(() => {
                    const it = itineraires.find(i=>String(i.id)===String(form.donnees?.itineraire_modele))
                    if (!it) return null
                    const arrets = [it.origine, ...villesDescente(it)]
                    const monte = form.donnees?.origine || it.origine
                    const idx = Math.max(0, arrets.findIndex(a=>a.toLowerCase()===String(monte).toLowerCase()))
                    const montees = arrets.slice(0, -1)
                    const descentes = arrets.slice(idx + 1)
                    const desc = form.donnees?.destination || it.destination
                    const lbl = LBL
                    const jours = joursPour(itineraires, monte, desc)
                    const alerte = messageJour(itineraires, monte, desc, form.date_debut_souhaitee)
                    return (
                      <>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                          <div>
                            <label style={lbl}>Je monte à</label>
                            <select value={monte} style={inp} onChange={e=>{
                              const m = e.target.value
                              const i = arrets.findIndex(a=>a.toLowerCase()===m.toLowerCase())
                              const suivants = arrets.slice(i + 1)
                              const d = suivants.some(a=>a.toLowerCase()===String(desc).toLowerCase()) ? desc : (suivants[suivants.length-1] || '')
                              setForm({...form, donnees:{...form.donnees, origine:m, destination:d}})
                            }}>
                              {montees.map(a=><option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={lbl}>Je descends à</label>
                            <select value={desc} style={inp} onChange={e=>setForm({...form, donnees:{...form.donnees, destination:e.target.value}})}>
                              {descentes.map(a=><option key={a} value={a}>{a}</option>)}
                            </select>
                          </div>
                        </div>
                        {jours && !alerte && <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>📅 Ce trajet circule : {libelleJours(jours)}.</div>}
                        {alerte && <div style={{fontSize:11,color:'#b45309',marginTop:4,fontWeight:600}}>⚠️ {alerte}</div>}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Résidents qui font leurs rotations avec LEUR véhicule (pas le
                  car du camp) : voyage individuel, jamais mis dans un convoi
                  ni proposé dans « À organiser » au Centre de Mobilité. */}
              {createModal === 'voyage' && (
                <div style={{ marginBottom:12 }}>
                  <label style={LBL}>Moyen de transport</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[[false,'🚌 Car du camp (convoi)'],[true,'🚗 Mon véhicule personnel']].map(([perso,l])=>{
                      const actif = !!form.donnees?.vehicule_personnel === perso
                      return (
                        <button key={l} type="button" onClick={()=>setForm({...form, donnees:{...form.donnees, vehicule_personnel:perso}})}
                          style={{ ...inp, cursor:'pointer', fontWeight:700, textAlign:'center',
                            border: actif ? `2px solid ${GOLD}` : inp.border, background: actif ? '#FFF8E6' : inp.background, color:NAVY, minHeight:44 }}>
                          {l}
                        </button>
                      )
                    })}
                  </div>
                  {form.donnees?.vehicule_personnel && (
                    <input value={form.donnees?.immatriculation||''} placeholder="Immatriculation (facultatif)"
                      onChange={e=>setForm({...form, donnees:{...form.donnees, immatriculation:e.target.value}})}
                      style={{ ...inp, marginTop:8 }}/>
                  )}
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, marginBottom:12 }}>
                <div>
                  <label style={LBL}>{createModal==='voyage'?'Date départ':'Date arrivée'}</label>
                  {/* Une demande de voyage doit arriver au moins 48h avant le
                      départ (même règle que la création directe d'un Voyage,
                      maintenant le seul chemin restant depuis que "Déclarer
                      mon voyage" a été retiré de la vue agent — sans ce
                      min, la contrainte aurait disparu avec lui plutôt que
                      d'être déplacée ici). */}
                  <input type="date" value={form.date_debut_souhaitee} min={createModal==='voyage' && !isAdmin ? dansAuMoins48h : today} onChange={e=>setForm({...form,date_debut_souhaitee:e.target.value})} style={inp}/>
                  {createModal==='voyage' && !isAdmin && (
                    <div style={{fontSize:10,color:'var(--text-dim)',marginTop:3}}>Au moins 48h à l'avance — pour un départ plus proche, contactez l'admin directement.</div>
                  )}
                </div>
                <div>
                  <label style={LBL}>{createModal==='voyage' ? (/camp/i.test(form.donnees?.destination||'') ? 'Je repars du camp le' : 'Je reviens au camp le') : 'Date départ'}</label>
                  <input type="date" value={form.date_fin_souhaitee} min={form.date_debut_souhaitee||today} onChange={e=>setForm({...form,date_fin_souhaitee:e.target.value})} style={inp}/>
                  {/* Trajets en aller simple : la 2e date n'a pas le même sens selon le sens du trajet */}
                  {createModal==='voyage' && (
                    <div style={{fontSize:10,color:'var(--text-dim)',marginTop:3}}>
                      {/camp/i.test(form.donnees?.destination||'')
                        ? 'Date de départ de votre hébergement — vous serez relancé la veille.'
                        : 'Votre chambre est libérée jusque-là ; le trajet retour vers le camp sera planifié automatiquement.'}
                    </div>
                  )}
                </div>
              </div>

              {createModal === 'voyage' ? (
                <div>
                  {/* Même liste que la création d'un convoi (Paramétrage → Motif / Objet) */}
                  <label style={LBL}>Motif / Objet *</label>
                  <select value={form.donnees?.motif||''} onChange={e=>setForm({...form, donnees:{...form.donnees, motif:e.target.value}})} style={inp}>
                    <option value="">— Choisir un motif —</option>
                    {motifsMobilite.map(m=><option key={m} value={m}>{libelleMotif(m)}</option>)}
                  </select>
                  <label style={{...LBL, marginTop:10}}>Précisions (facultatif)</label>
                  <textarea value={form.message_demandeur} onChange={e=>setForm({...form,message_demandeur:e.target.value})} rows={3}
                    style={{ ...inp, resize:'vertical' }} placeholder="Précisions éventuelles..."/>
                </div>
              ) : (
              <div>
                <label style={LBL}>Message / Justification *</label>
                <textarea value={form.message_demandeur} onChange={e=>setForm({...form,message_demandeur:e.target.value})} rows={4}
                  style={{ ...inp, resize:'vertical' }} placeholder="Expliquez votre demande..."/>
              </div>
              )}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid '+LIGNE, display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="dm-btn" onClick={()=>setCreateModal(null)} style={{ background:'#fff', border:'1px solid '+LIGNE, color:'#334155', minHeight:40, padding:'8px 18px', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'inherit' }}>Annuler</button>
              <button className="dm-btn" onClick={()=>submitDemande(createModal)} style={{ background:GOLD, color:NAVY, border:'none', minHeight:40, padding:'8px 20px', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'inherit' }}>
                📤 Soumettre la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION MODAL (Admin) ── */}
      {actionModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16 }} className="dm-overlay">
          <div className="dm-modal" style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding:'16px 20px', background:actionModal.action==='valider'?'#166534':actionModal.action==='rejeter'?'#B91C1C':NAVY, borderBottom:`3px solid ${GOLD}`, borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ ...TITRE, color:'#fff', fontSize:20, fontWeight:600, margin:0, textTransform:'uppercase' }}>
                {actionModal.action==='valider'?'✅ Valider':actionModal.action==='rejeter'?'❌ Rejeter':'💬 Contre-proposition'}
              </h3>
              <button className="dm-btn" aria-label="Fermer" onClick={()=>setActionModal(null)} style={{ background:'rgba(255,255,255,.16)', border:'none', color:'#fff', borderRadius:8, cursor:'pointer', width:36, height:36, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ background:'#F3F5F9', borderRadius:10, padding:'12px 14px', marginBottom:14, fontSize:13, lineHeight:1.6, color:'#334155' }}>
                <b>Demande de :</b> {actionModal.demande.demandeur_nom}<br/>
                <b>Type :</b> {TYPE_COLORS[actionModal.demande.type_demande]?.label}<br/>
                {actionModal.demande.residence_souhaitee && <><b>Résidence souhaitée :</b> {actionModal.demande.residence_souhaitee}<br/></>}
                {actionModal.demande.message_demandeur && <><b>Message :</b> {actionModal.demande.message_demandeur}</>}
              </div>

              {actionModal.action === 'valider' && actionModal.demande.type_demande === 'reservation_residence' && (
                <div style={{ marginBottom:12 }}>
                  <label style={LBL}>Résidence attribuée</label>
                  <select value={actionForm.proposition?.residence||''} onChange={e=>setActionForm({...actionForm,proposition:{...actionForm.proposition,residence:e.target.value}})} style={inp}>
                    <option value="">— Confirmer résidence —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              {actionModal.action === 'proposer' && (
                <div style={{ marginBottom:12 }}>
                  <label style={LBL}>Résidence proposée (alternative)</label>
                  <select value={actionForm.proposition?.residence||''} onChange={e=>setActionForm({...actionForm,proposition:{...actionForm.proposition,residence:e.target.value}})} style={inp}>
                    <option value="">— Proposer une résidence —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={LBL}>
                  {actionModal.action==='rejeter'?'Motif du rejet *':'Commentaire / Message'}
                </label>
                <textarea value={actionForm.commentaire} onChange={e=>setActionForm({...actionForm,commentaire:e.target.value})} rows={3}
                  style={{ ...inp, resize:'vertical' }} placeholder={actionModal.action==='rejeter'?'Expliquez le motif...':'Message au demandeur...'}/>
              </div>

              {actionModal.action==='rejeter' && !['induction','incident'].includes(actionModal.demande._source) && (
                <button onClick={()=>setActionModal(m=>({...m,action:'proposer'}))}
                  style={{ marginTop:10, background:'none', border:'none', color:'#1E3A8A', fontSize:12, fontWeight:700, cursor:'pointer', textDecoration:'underline', padding:0 }}>
                  💬 Proposer une alternative à la place d'un rejet sec
                </button>
              )}
              {actionModal.action==='proposer' && (
                <button onClick={()=>setActionModal(m=>({...m,action:'rejeter'}))}
                  style={{ marginTop:10, background:'none', border:'none', color:'#B91C1C', fontSize:12, fontWeight:700, cursor:'pointer', textDecoration:'underline', padding:0 }}>
                  ← Revenir à un rejet simple
                </button>
              )}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid '+LIGNE, display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="dm-btn" onClick={()=>setActionModal(null)} disabled={actionSaving} style={{ background:'#fff', border:'1px solid '+LIGNE, color:'#334155', minHeight:40, fontFamily:'inherit', fontWeight:600, padding:'8px 18px', borderRadius:10, cursor:actionSaving?'not-allowed':'pointer', fontSize:13, opacity:actionSaving?.5:1 }}>Annuler</button>
              <button className="dm-btn" onClick={doAction} disabled={actionSaving}
                style={{ background:actionModal.action==='valider'?'#166534':actionModal.action==='rejeter'?'#B91C1C':NAVY, color:'#fff', border:'none', minHeight:40, fontFamily:'inherit', padding:'8px 20px', borderRadius:10, cursor:actionSaving?'not-allowed':'pointer', fontSize:13, fontWeight:700, opacity:actionSaving?.6:1 }}>
                {actionSaving ? '⏳ Traitement...' : (actionModal.action==='valider'?'✅ Confirmer validation':actionModal.action==='rejeter'?'❌ Confirmer rejet':'💬 Envoyer proposition')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
