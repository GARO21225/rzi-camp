import React, { useState, useEffect } from 'react'
import { demandes as demandesAPI, batiments as batAPI, personnel as personnelAPI, voyages as voyagesAPI, inductionAPI, incidents as incidentsAPI, itinerairesModeles as itinerairesAPI } from '../api'
import { useStore } from '../store'
import { toast, confirmDialog } from '../toast'
import { useIsMobile } from '../hooks/useIsMobile'

const TYPE_COLORS = {
  reservation_residence:{ bg:'rgba(37,99,235,.1)', color:'var(--rzc-blue)', icon:'🏠', label:'Réservation résidence' },
  voyage:{ bg:'rgba(234,88,12,.1)', color:'#ea580c', icon:'✈️', label:'Voyage' },
  maintenance:{ bg:'rgba(220,38,38,.1)', color:'#dc2626', icon:'🛠️', label:'Maintenance' },
  induction:{ bg:'rgba(124,58,237,.1)', color:'#7c3aed', icon:'🎓', label:'Induction' },
}
const STATUT_STYLES = {
  en_attente:{ bg:'rgba(240,165,0,.12)', color:'#d08800', label:'⏳ En attente' },
  validee:{ bg:'rgba(22,163,74,.12)', color:'#16a34a', label:'✅ Validée' },
  rejetee:{ bg:'rgba(220,38,38,.12)', color:'#dc2626', label:'❌ Rejetée' },
  proposition:{ bg:'rgba(124,58,237,.12)', color:'#7c3aed', label:'💬 Proposition admin' },
  acceptee:{ bg:'rgba(22,163,74,.12)', color:'#16a34a', label:'✅ Acceptée' },
  annulee:{ bg:'rgba(100,116,139,.12)', color:'var(--rzc-text-3)', label:'🚫 Annulée' },
}

const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }
const today = new Date().toISOString().slice(0,10)

export default function Demandes() {
  const isMobile = useIsMobile()
  const { user } = useStore()
  const role = (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
  const isAdmin = ['admin'].includes(role) || user?.is_staff || user?.is_superuser

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

  const load = () => {
    setLoading(true)
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
    } else {
      setVoyagesEnAttente([]); setInductionsEnAttente([]); setIncidentsEnAttente([])
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

  useEffect(()=>{ load() }, [tab])

  const submitDemande = async (type) => {
    try {
      await demandesAPI.create({ type_demande:type, ...form })
      setCreateModal(null)
      setForm({ message_demandeur:'', residence_souhaitee:'', date_debut_souhaitee:today, date_fin_souhaitee:'', donnees:{} })
      load()
    } catch(e) { toast.error(e.response?.data?JSON.stringify(e.response.data):e.message) }
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
    if (!isAdmin && tab === 'proposition_recue') return data.filter(d=>d.statut==='proposition')
    if (isAdmin && tab === 'pending') {
      // Fusionne demandes classiques + voyages + inductions + incidents en attente, tries par date
      return [...data, ...voyagesEnAttente, ...inductionsEnAttente, ...incidentsEnAttente].sort((a,b)=>new Date(b.date_creation||0)-new Date(a.date_creation||0))
    }
    return data
  }

  return (
    <div style={{ padding:'16px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>📋 Demandes & Workflow</h2>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>
            {isAdmin ? 'Validation admin · Suivi complet des demandes' : 'Soumettez vos demandes · Suivez leur statut'}
          </p>
        </div>
        {!isAdmin && !isMobile && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setCreateModal('reservation_residence')}
              style={{ background:'rgba(37,99,235,.1)', color:'var(--rzc-blue)', border:'1px solid rgba(37,99,235,.25)', padding:'8px 14px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              🏠 Réserver résidence
            </button>
            <button onClick={()=>setCreateModal('voyage')}
              style={{ background:'rgba(234,88,12,.1)', color:'#ea580c', border:'1px solid rgba(234,88,12,.25)', padding:'8px 14px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              ✈️ Planifier voyage
            </button>
          </div>
        )}
      </div>

      {/* FABs mobile — remplacent les 2 boutons d'action agent, cachés dans le header exigu */}
      {!isAdmin && isMobile && (
        <div style={{ position:'fixed', right:16, bottom:'calc(98px + env(safe-area-inset-bottom, 0px))', display:'flex', flexDirection:'column', gap:10, zIndex:80 }}>
          <button onClick={()=>setCreateModal('reservation_residence')} aria-label="Réserver résidence"
            style={{ width:46, height:46, borderRadius:23, background:'#2563EB', border:'none', boxShadow:'0 6px 16px rgba(37,99,235,.4)', fontSize:19, cursor:'pointer' }}>
            🏠
          </button>
          <button onClick={()=>setCreateModal('voyage')} aria-label="Planifier voyage"
            style={{ width:54, height:54, borderRadius:27, background:'#C9972B', border:'none', boxShadow:'0 6px 16px rgba(201,151,43,.4)', fontSize:22, cursor:'pointer' }}>
            ✈️
          </button>
        </div>
      )}

      {/* Admin KPIs */}
      {isAdmin && stats && (
        <div style={isMobile
          ? { display:'flex', gap:8, overflowX:'auto', marginBottom:16, paddingBottom:4 }
          : { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
          {[
            [(stats.en_attente||0) + voyagesEnAttente.length + inductionsEnAttente.length + incidentsEnAttente.length,'En attente','#d08800','⏳'],
            [stats.propositions,'Propositions','#7c3aed','💬'],
            [stats.validees,'Validées','#16a34a','✅'],
            [stats.rejetees,'Rejetées','#dc2626','❌'],
            [stats.total,'Total','var(--blue)','📋'],
          ].map(([v,l,c,ic])=>(
            <div key={l} style={isMobile
              ? { flexShrink:0, minWidth:88, background:'var(--rzc-white)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }
              : { background:'var(--rzc-white)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }}>
              <div style={{ fontFamily:'monospace', fontSize:isMobile?18:24, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1, whiteSpace:'nowrap' }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={isMobile
        ? { display:'flex', gap:8, marginBottom:14, overflowX:'auto', paddingBottom:4 }
        : { display:'flex', gap:2, marginBottom:14, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {(isAdmin ? ADMIN_TABS : AGENT_TABS).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={isMobile
              ? { flexShrink:0, padding:'7px 14px', borderRadius:99, border:tab===k?'1px solid #0F2A5C':'1px solid rgba(15,26,46,.14)', cursor:'pointer', fontSize:12, fontWeight:600, background:tab===k?'#0F2A5C':'#fff', color:tab===k?'#fff':'#2D3B52' }
              : { flex:1, padding:'8px 4px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:tab===k?'var(--rzc-white)':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
                  boxShadow:tab===k?'var(--shadow)':'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? <div style={{padding:32,textAlign:'center',color:'var(--text-dim)'}}>Chargement...</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filterData().length === 0 && (
            <div style={{ background:'var(--rzc-white)', border:'1px solid var(--border)', borderRadius:12, padding:40, textAlign:'center', color:'var(--text-dim)', boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
              <div style={{ fontSize:14 }}>{isAdmin ? "Aucune demande en attente" : "Aucune demande soumise"}</div>
              {!isAdmin && <div style={{ fontSize:12, marginTop:6 }}>Utilisez les boutons ci-dessus pour soumettre une demande</div>}
            </div>
          )}
          {filterData().map(d => {
            const tc = TYPE_COLORS[d.type_demande] || TYPE_COLORS.maintenance
            const sc = STATUT_STYLES[d.statut] || STATUT_STYLES.en_attente
            return (
              <div key={d.id} style={{ background:'var(--rzc-white)', border:`1px solid ${d.statut==='en_attente'?'rgba(240,165,0,.3)':'var(--border)'}`, borderRadius:12, padding:isMobile?13:16, boxShadow:'var(--shadow)', display:'flex', gap:isMobile?12:14, alignItems:'flex-start', flexWrap:isMobile?'wrap':'nowrap' }}>
                <div style={{ width:isMobile?44:50, height:isMobile?44:50, borderRadius:12, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:isMobile?20:22, flexShrink:0 }}>
                  {tc.icon}
                </div>
                <div style={{ flex:1, minWidth:isMobile?'70%':0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:'var(--blue)' }}>{tc.label}</span>
                    <span style={{ background:sc.bg, color:sc.color, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{sc.label}</span>
                    {isAdmin && <span style={{ fontSize:12, color:'var(--text-dim)' }}>par {d.demandeur_nom}</span>}
                  </div>
                  {d.message_demandeur && <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.message_demandeur}</div>}
                  <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text-dim)', flexWrap:'wrap' }}>
                    {d.residence_souhaitee && <span>🏠 {d.residence_souhaitee}</span>}
                    {d.date_debut_souhaitee && <span>📅 {d.date_debut_souhaitee}</span>}
                    {d.date_fin_souhaitee && <span>→ {d.date_fin_souhaitee}</span>}
                    <span>🕐 {new Date(d.date_creation).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {d.commentaire_admin && (
                    <div style={{ marginTop:8, background:d.statut==='proposition'?'rgba(124,58,237,.06)':'rgba(22,163,74,.06)', border:`1px solid ${d.statut==='proposition'?'rgba(124,58,237,.15)':'rgba(22,163,74,.15)'}`, borderRadius:8, padding:'8px 12px', fontSize:12 }}>
                      {d.statut==='proposition' && <b style={{color:'#7c3aed'}}>💬 Proposition : </b>}
                      {d.statut==='validee' && <b style={{color:'#16a34a'}}>✅ Admin : </b>}
                      {d.statut==='rejetee' && <b style={{color:'#dc2626'}}>❌ Rejet : </b>}
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

                {/* Actions */}
                <div style={isMobile
                  ? { display:'flex', gap:8, width:'100%', marginTop:2 }
                  : { display:'flex', flexDirection:'column', gap:6, flexShrink:0, minWidth:120 }}>
                  {isAdmin && d.statut === 'en_attente' && (
                    <>
                      <button onClick={()=>{ setActionModal({demande:d,action:'valider'}); setActionForm({commentaire:'',proposition:{residence:d.residence_souhaitee}}) }}
                        style={isMobile
                          ? { flex:1, background:'#16a34a', color:'#fff', border:'none', borderRadius:8, padding:8, fontSize:11.5, fontWeight:700, cursor:'pointer' }
                          : { background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>✅ Valider</button>
                      {!['induction','incident'].includes(d._source) && (
                        <button onClick={()=>{ setActionModal({demande:d,action:'proposer'}); setActionForm({commentaire:'',proposition:{residence:d.residence_souhaitee}}) }}
                          style={isMobile
                            ? { flex:1, background:'rgba(124,58,237,.10)', color:'#7c3aed', border:'1px solid rgba(124,58,237,.25)', borderRadius:8, padding:8, fontSize:11.5, fontWeight:700, cursor:'pointer' }
                            : { background:'rgba(124,58,237,.1)', color:'#7c3aed', border:'1px solid rgba(124,58,237,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>💬 Proposer</button>
                      )}
                      <button onClick={()=>{ setActionModal({demande:d,action:'rejeter'}); setActionForm({commentaire:'',proposition:{}}) }}
                        style={isMobile
                          ? { background:'rgba(220,38,38,.08)', color:'#DC2626', border:'1px solid rgba(220,38,38,.2)', borderRadius:8, padding:'8px 10px', fontSize:11.5, cursor:'pointer' }
                          : { background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>❌{isMobile?'':' Rejeter'}</button>
                    </>
                  )}
                  {isAdmin && d.statut === 'proposition' && (
                    <span style={{ fontSize:11, color:'#7c3aed', fontStyle:'italic' }}>Réponse attendue...</span>
                  )}
                  {!isAdmin && d.statut === 'proposition' && (
                    <>
                      <button onClick={()=>doAgentAction(d,'accepter')}
                        style={isMobile
                          ? { flex:1, background:'#16a34a', color:'#fff', border:'none', borderRadius:8, padding:8, fontSize:11.5, fontWeight:700, cursor:'pointer' }
                          : { background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>✅ Accepter</button>
                      <button onClick={()=>doAgentAction(d,'refuser')}
                        style={isMobile
                          ? { flex:1, background:'rgba(220,38,38,.08)', color:'#DC2626', border:'1px solid rgba(220,38,38,.2)', borderRadius:8, padding:8, fontSize:11.5, fontWeight:700, cursor:'pointer' }
                          : { background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>❌ Refuser</button>
                    </>
                  )}
                  {!isAdmin && d.statut === 'en_attente' && (
                    <button onClick={()=>doAgentAction(d,'annuler')}
                      style={isMobile
                        ? { flex:1, background:'rgba(100,116,139,.1)', color:'var(--rzc-text-3)', border:'1px solid rgba(100,116,139,.2)', borderRadius:8, padding:8, fontSize:11.5, cursor:'pointer' }
                        : { background:'rgba(100,116,139,.1)', color:'var(--rzc-text-3)', border:'1px solid rgba(100,116,139,.2)', padding:'5px 8px', borderRadius:7, cursor:'pointer', fontSize:10 }}>Annuler</button>
                  )}
                  {isAdmin && (
                    <button onClick={()=>deleteDemande(d)}
                      style={isMobile
                        ? { background:'rgba(220,38,38,.06)', color:'#dc2626', border:'1px solid rgba(220,38,38,.15)', borderRadius:8, padding:'8px 10px', fontSize:11.5, cursor:'pointer' }
                        : { background:'rgba(220,38,38,.08)', color:'#dc2626', border:'1px solid rgba(220,38,38,.15)', padding:'4px 8px', borderRadius:7, cursor:'pointer', fontSize:10 }}>🗑</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      {createModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'var(--rzc-white)', borderRadius:16, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'16px 20px', background:TYPE_COLORS[createModal]?.color||'var(--blue)', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'var(--rzc-white)', fontSize:15 }}>{TYPE_COLORS[createModal]?.icon} {TYPE_COLORS[createModal]?.label}</h3>
              <button onClick={()=>setCreateModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'var(--rzc-white)', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
                📋 Votre demande sera envoyée à l'admin pour validation. Vous serez notifié de la décision.
              </div>

              {createModal === 'reservation_residence' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence souhaitée</label>
                  <select value={form.residence_souhaitee} onChange={e=>setForm({...form,residence_souhaitee:e.target.value})} style={inp}>
                    <option value="">— Sélectionner une résidence libre —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              {createModal === 'voyage' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Itinéraire</label>
                  <select value={form.donnees?.itineraire_modele||''} onChange={e=>{
                    const it = itineraires.find(i=>String(i.id)===e.target.value)
                    setForm({...form, donnees:{...form.donnees, itineraire_modele:e.target.value, destination:it?.destination||'', origine:it?.origine||''}})
                  }} style={inp}>
                    <option value="">— Sélectionner un itinéraire —</option>
                    {itineraires.map(i=><option key={i.id} value={i.id}>{i.nom} ({i.origine} → {i.destination})</option>)}
                  </select>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{createModal==='voyage'?'Date départ':'Date arrivée'}</label>
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
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{createModal==='voyage'?'Retour prévu':'Date départ'}</label>
                  <input type="date" value={form.date_fin_souhaitee} min={form.date_debut_souhaitee||today} onChange={e=>setForm({...form,date_fin_souhaitee:e.target.value})} style={inp}/>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Message / Justification *</label>
                <textarea value={form.message_demandeur} onChange={e=>setForm({...form,message_demandeur:e.target.value})} rows={4}
                  style={{ ...inp, resize:'vertical' }} placeholder="Expliquez votre demande..."/>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setCreateModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={()=>submitDemande(createModal)} style={{ background:TYPE_COLORS[createModal]?.color||'var(--blue)', color:'var(--rzc-white)', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                📤 Soumettre la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION MODAL (Admin) ── */}
      {actionModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16 }}>
          <div style={{ background:'var(--rzc-white)', borderRadius:14, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding:'16px 20px', background:actionModal.action==='valider'?'#16a34a':actionModal.action==='rejeter'?'#dc2626':'#7c3aed', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'var(--rzc-white)', fontSize:15 }}>
                {actionModal.action==='valider'?'✅ Valider':actionModal.action==='rejeter'?'❌ Rejeter':'💬 Contre-proposition'}
              </h3>
              <button onClick={()=>setActionModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'var(--rzc-white)', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ background:'var(--surface2)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
                <b>Demande de :</b> {actionModal.demande.demandeur_nom}<br/>
                <b>Type :</b> {TYPE_COLORS[actionModal.demande.type_demande]?.label}<br/>
                {actionModal.demande.residence_souhaitee && <><b>Résidence souhaitée :</b> {actionModal.demande.residence_souhaitee}<br/></>}
                {actionModal.demande.message_demandeur && <><b>Message :</b> {actionModal.demande.message_demandeur}</>}
              </div>

              {actionModal.action === 'valider' && actionModal.demande.type_demande === 'reservation_residence' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence attribuée</label>
                  <select value={actionForm.proposition?.residence||''} onChange={e=>setActionForm({...actionForm,proposition:{...actionForm.proposition,residence:e.target.value}})} style={inp}>
                    <option value="">— Confirmer résidence —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              {actionModal.action === 'proposer' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence proposée (alternative)</label>
                  <select value={actionForm.proposition?.residence||''} onChange={e=>setActionForm({...actionForm,proposition:{...actionForm.proposition,residence:e.target.value}})} style={inp}>
                    <option value="">— Proposer une résidence —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>
                  {actionModal.action==='rejeter'?'Motif du rejet *':'Commentaire / Message'}
                </label>
                <textarea value={actionForm.commentaire} onChange={e=>setActionForm({...actionForm,commentaire:e.target.value})} rows={3}
                  style={{ ...inp, resize:'vertical' }} placeholder={actionModal.action==='rejeter'?'Expliquez le motif...':'Message au demandeur...'}/>
              </div>

              {actionModal.action==='rejeter' && !['induction','incident'].includes(actionModal.demande._source) && (
                <button onClick={()=>setActionModal(m=>({...m,action:'proposer'}))}
                  style={{ marginTop:10, background:'none', border:'none', color:'#7c3aed', fontSize:12, fontWeight:700, cursor:'pointer', textDecoration:'underline', padding:0 }}>
                  💬 Proposer une alternative à la place d'un rejet sec
                </button>
              )}
              {actionModal.action==='proposer' && (
                <button onClick={()=>setActionModal(m=>({...m,action:'rejeter'}))}
                  style={{ marginTop:10, background:'none', border:'none', color:'#dc2626', fontSize:12, fontWeight:700, cursor:'pointer', textDecoration:'underline', padding:0 }}>
                  ← Revenir à un rejet simple
                </button>
              )}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setActionModal(null)} disabled={actionSaving} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:actionSaving?'not-allowed':'pointer', fontSize:13, opacity:actionSaving?.5:1 }}>Annuler</button>
              <button onClick={doAction} disabled={actionSaving}
                style={{ background:actionModal.action==='valider'?'#16a34a':actionModal.action==='rejeter'?'#dc2626':'#7c3aed', color:'var(--rzc-white)', border:'none', padding:'8px 18px', borderRadius:8, cursor:actionSaving?'not-allowed':'pointer', fontSize:13, fontWeight:700, opacity:actionSaving?.6:1 }}>
                {actionSaving ? '⏳ Traitement...' : (actionModal.action==='valider'?'✅ Confirmer validation':actionModal.action==='rejeter'?'❌ Confirmer rejet':'💬 Envoyer proposition')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
