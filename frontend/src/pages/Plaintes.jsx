import { useState, useEffect, useCallback } from 'react'
import ChoixPersonne from '../components/ChoixPersonne'
import { useNavigate } from 'react-router-dom'
import { plaintes as plaintesAPI, controlesChambre as controlesAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'
import { toast, confirmDialog } from '../toast'
import { usePlainteCategories } from '../constants/plaintes'
import { useIsMobile } from '../hooks/useIsMobile'
import { useSurPulse } from '../hooks/useSurPulse'
import PhotoCapture from '../components/PhotoCapture'
import PlaintesDashboard from '../components/PlaintesDashboard'
import { fichePlainte } from '../utils/fichePlainte'
import { imprimerHtml } from '../utils/impression'
const PROPRETE_CRITERES = ["poubelle","sol","plafond","murs","fenetres","porte","mobilier","douche","wc","lavabo","miroir"]
const FOURNITURES_CRITERES = ["couverture","drap","serviette","savon","serpillere","insecticide","desodorisant","gel_lave_mains"]
const EQUIPEMENTS_CRITERES = ["ordinateur","lumieres","climatiseur","refrigerateur"]
const ETAT_GENERAL_CRITERES = ["serrure","poignee","porte","fenetres","peinture","humidite","fuite","plomberie"]

const STATUT_COLORS = {
  nouvelle: '#3b82f6', a_qualifier: '#f59e0b', affectee: '#8b5cf6', prise_en_charge: '#06b6d4',
  en_cours: '#f97316', en_attente: '#94a3b8', resolue: '#22c55e', confirmee: '#16a34a',
  reouverte: '#dc2626', cloturee: '#64748b', rejetee: '#ef4444',
}
const STATUT_LABELS = {
  nouvelle: 'Nouvelle', a_qualifier: 'À qualifier', affectee: 'Affectée', prise_en_charge: 'Prise en charge',
  en_cours: 'En cours', en_attente: 'En attente', resolue: 'Résolue', confirmee: 'Confirmée',
  reouverte: 'Réouverte', cloturee: 'Clôturée', rejetee: 'Rejetée',
}

function Etoiles({ value, onChange, readOnly }) {
  return (
    <div style={{display:'flex',gap:2}}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={()=>!readOnly && onChange(n)}
          style={{cursor:readOnly?'default':'pointer', fontSize:20, color: n<=(value||0) ? '#f59e0b' : '#e2e8f0'}}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function Plaintes() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser) || user?.profile?.role === 'admin' || user?.profile?.role === 'manager' || user?.profile?.role === 'superviseur'
  const CATEGORIES = usePlainteCategories()

  const [liste, setListe] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const FILTRES_VIDES = { du:'', au:'', categorie:'', priorite:'', responsable:'', residence:'', statut:'', retard:false }
  const [filtres, setFiltres] = useState(FILTRES_VIDES)
  const filtreStatut = filtres.statut, filtreCategorie = filtres.categorie
  const setFiltreStatut = (v) => setFiltres(x => ({ ...x, statut: v }))
  const setFiltreCategorie = (v) => setFiltres(x => ({ ...x, categorie: v }))
  const [photoResolution, setPhotoResolution] = useState('')
  const [detailModal, setDetailModal] = useState(null)
  const [nouvelleModal, setNouvelleModal] = useState(false)
  const [nouvelleForm, setNouvelleForm] = useState({categorie:'Proprete', sous_categorie:'poubelle', description:'', commentaire:'', photo_base64:''})
  const [controleModal, setControleModal] = useState(false)
  const [notesProprete, setNotesProprete] = useState({})
  const [actionForm, setActionForm] = useState({})
  const [selection, setSelection] = useState(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)   // anti double-clic (une plainte = une seule requête)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({categorie:'', sous_categorie:'', description:'', commentaire:''})
  const STATUTS_CLOTURES = ['cloturee','rejetee']
  const [agents, setAgents] = useState([])
  const [agentChoisi, setAgentChoisi] = useState('')
  const [frise, setFrise] = useState(null)
  // Admin / superuser : dépose une plainte AU NOM d'un occupant (choisi dans la liste du personnel)
  const [personnes, setPersonnes] = useState([])
  const [pourPersonne, setPourPersonne] = useState(null)
  useEffect(() => {
    if (isAdmin && nouvelleModal && personnes.length === 0)
      personnelAPI.list({ page_size: 3000 }).then(r => setPersonnes((r.data?.results || r.data || []).map(p => ({ id: p.id, nom: `${p.nom} ${p.prenom || ''}`.trim(), detail: p.societe || '' })))).catch(() => {})
  }, [isAdmin, nouvelleModal])
  const chargerFrise = useCallback(async (id) => {
    setFrise(null)
    try { const r = await plaintesAPI.chronologie(id); setFrise(r.data) } catch { setFrise({ etapes: [] }) }
  }, [])
  useEffect(() => {
    if (!detailModal) { setFrise(null); setAgentChoisi(''); return }
    chargerFrise(detailModal.id)
    setPhotoResolution('')
    // Seuls les comptes ménage / technicien sont proposés, selon la catégorie de la plainte
    if (isAdmin) plaintesAPI.agents({ categorie: detailModal.categorie }).then(r => setAgents(r.data || [])).catch(() => {})
  }, [detailModal?.id])
  const [tousAgents, setTousAgents] = useState([])
  useEffect(() => { if (isAdmin) plaintesAPI.agents().then(r => setTousAgents(r.data || [])).catch(() => {}) }, [isAdmin])

  const charger = useCallback(async (silencieux = false) => {
    if (!silencieux) setLoading(true)
    try {
      const params = {}
      if (filtres.statut) params.statut = filtres.statut
      if (filtres.categorie) params.categorie = filtres.categorie
      const r = await plaintesAPI.list(params)
      setListe(r.data?.results || r.data || [])
      if (isAdmin) {
        const dp = {}
        for (const k of ['du', 'au', 'categorie', 'priorite', 'responsable', 'residence']) if (filtres[k]) dp[k] = filtres[k]
        const rd = await plaintesAPI.dashboard(dp)
        setDashboard(rd.data)
      }
    } catch(e) { if (!silencieux) toast.error("Erreur de chargement") }
    setLoading(false)
  }, [filtres.statut, filtres.categorie, filtres.du, filtres.au, filtres.priorite, filtres.responsable, filtres.residence, isAdmin])

  useEffect(() => { charger() }, [charger])
  // Rafraîchissement automatique : la liste (et la frise du dossier ouvert)
  // se mettent à jour dès qu'une plainte change, sans recharger la page.
  useSurPulse(['plaintes'], () => {
    charger(true)
    if (detailModal?.id) plaintesAPI.chronologie(detailModal.id).then(r => setFrise(r.data)).catch(() => {})
  })

  const creerPlainte = async () => {
    if (envoiEnCours) return
    if (!nouvelleForm.description.trim()) return toast.error('Description requise')
    if (!nouvelleForm.photo_base64) return toast.error('Une photo du problème est obligatoire')
    if (isAdmin && !pourPersonne) return toast.error("Choisissez l'occupant concerné")
    setEnvoiEnCours(true)
    try {
      await plaintesAPI.creer(isAdmin ? { ...nouvelleForm, personnel: pourPersonne.id } : nouvelleForm)
      toast.success('Plainte déposée')
      setNouvelleModal(false); setPourPersonne(null)
      setNouvelleForm({categorie:'Proprete', sous_categorie:'poubelle', description:'', commentaire:'', photo_base64:''})
      charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
    setEnvoiEnCours(false)
  }

  const soumettreControle = async () => {
    if (envoiEnCours) return
    setEnvoiEnCours(true)
    try {
      const r = await controlesAPI.creer({notes_proprete: notesProprete})
      if (r.data.plainte_generee_ref) {
        toast.warning(`⚠️ Signal de mécontentement envoyé (${r.data.plainte_generee_ref}) — note(s) de propreté trop basse(s)`)
      } else {
        toast.success('Contrôle enregistré')
      }
      setControleModal(false); setNotesProprete({})
      charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
    setEnvoiEnCours(false)
  }

  const confirmerResolution = async (id, resolu) => {
    if (resolu && !await confirmDialog('Confirmer que le problème est bien résolu ?')) return
    const motif = resolu ? '' : prompt('Le problème persiste — précisez ce qui ne va pas encore :') || ''
    if (!resolu && !motif) return
    try {
      await plaintesAPI.confirmer(id, resolu, motif)
      toast.success(resolu ? 'Plainte clôturée' : 'Plainte réouverte')
      setDetailModal(null); charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const actionAdmin = async (id, action, data, successMsg) => {
    try {
      const r = await plaintesAPI[action](id, data)
      toast.success(successMsg)
      setActionForm({}); charger()
      if (detailModal) {
        if (['affecter','retirer'].includes(action) && r?.data?.id) { setDetailModal(r.data); setAgentChoisi(''); chargerFrise(id) }
        else setDetailModal(null)
      }
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const ouvrirEdition = (p) => {
    setEditForm({categorie: p.categorie, sous_categorie: p.sous_categorie || '', description: p.description || '', commentaire: p.commentaire || ''})
    setEditModal(true)
  }

  const enregistrerEdition = async () => {
    if (!editForm.description.trim()) return toast.error('Description requise')
    try {
      await plaintesAPI.modifier(detailModal.id, editForm)
      toast.success('Plainte modifiée')
      setEditModal(false)
      const maj = { ...detailModal, ...editForm }
      setDetailModal(maj); charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const supprimerPlainte = async (id) => {
    if (!await confirmDialog('Supprimer définitivement cette plainte ? Cette action est irréversible.')) return
    try {
      await plaintesAPI.supprimer(id)
      toast.success('Plainte supprimée')
      setDetailModal(null); charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const toggleSelection = (id) => setSelection(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  // Actions de masse : réutilise les mêmes endpoints que les actions à
  // l'unité (pas de route backend dédiée à inventer) — chaque plainte
  // sélectionnée reçoit l'action individuellement ; celles dont le statut
  // ne permet pas l'action échouent isolément sans bloquer les autres.
  const actionMasse = async (action, data, successMsg) => {
    if (selection.size === 0) return
    setBulkRunning(true)
    const ids = [...selection]
    const resultats = await Promise.allSettled(ids.map(id => plaintesAPI[action](id, data)))
    const ok = resultats.filter(r => r.status === 'fulfilled').length
    const echecs = resultats.length - ok
    toast[echecs ? 'warning' : 'success'](
      echecs ? `${successMsg} : ${ok} ok, ${echecs} échec(s) (statut incompatible)` : `${successMsg} (${ok})`
    )
    setSelection(new Set())
    setBulkRunning(false)
    charger()
  }

  // SLA : échéance, dépassement et temps restant
  const slaInfo = (p) => {
    if (!p.sla_echeance) return null
    const fini = ['resolue','confirmee','cloturee','rejetee'].includes(p.statut)
    if (p.statut === 'rejetee') return null
    const ms = new Date(p.sla_echeance) - Date.now()
    const h = Math.abs(ms) / 3600000
    const txt = h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1).replace('.', ',')} h` : `${Math.round(h / 24)} j`
    if (p.sla_depasse) return { c:'#dc2626', t: fini ? '⚠ SLA dépassé' : `⚠ En retard de ${txt}` }
    return fini ? { c:'#16a34a', t:'✓ SLA respecté' } : { c: ms < 4 * 3600000 ? '#f97316' : '#16a34a', t:`⏱ ${txt} restant` }
  }
  const imprimerFiche = async (p) => {
    let etapes = frise?.etapes
    if (!etapes || detailModal?.id !== p.id) { try { etapes = (await plaintesAPI.chronologie(p.id)).data?.etapes } catch { etapes = [] } }
    imprimerHtml(fichePlainte(p, etapes || []), `Fiche d'intervention plainte #${p.id}`)
  }
  const visibles = liste.filter(p => {
    if (STATUTS_CLOTURES.includes(p.statut)) return false
    const f = filtres
    if (f.priorite && p.priorite !== f.priorite) return false
    if (f.residence && !(p.batiment_residence || '').toLowerCase().includes(f.residence.toLowerCase())) return false
    if (f.responsable && String(p.affecte_a) !== String(f.responsable)) return false
    if (f.du && (p.date_creation || '').slice(0,10) < f.du) return false
    if (f.au && (p.date_creation || '').slice(0,10) > f.au) return false
    if (f.retard && !p.sla_depasse) return false
    return true
  })

  const badge = (statut) => (
    <span style={{background:`${STATUT_COLORS[statut]}20`, color:STATUT_COLORS[statut], padding:'3px 10px',
      borderRadius:20, fontSize:11, fontWeight:700}}>
      {STATUT_LABELS[statut] || statut}
    </span>
  )

  return (
    <div style={{padding: isMobile ? 16 : 20, position: isMobile ? 'relative' : 'static', minHeight: isMobile ? '100%' : 'auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <div>
          <h1 style={{fontSize:20, fontWeight:800, margin:0}}>🧹 Gestion des Plaintes</h1>
          <p style={{color:'#64748b', fontSize:12, margin:'4px 0 0'}}>
            {isAdmin ? 'Suivi, qualification et traitement des plaintes des occupants' : 'Ma chambre — contrôle et signalements'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={()=>setNouvelleModal(true)}
            style={{background:'#0F2A5C', color:'#fff', border:'none', padding:'9px 16px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:12.5, transition:'transform .16s cubic-bezier(.23,1,.32,1)'}}
            onMouseDown={e=>e.currentTarget.style.transform='scale(.97)'} onMouseUp={e=>e.currentTarget.style.transform=''} onMouseLeave={e=>e.currentTarget.style.transform=''}>
            + Déposer une plainte
          </button>
        )}
        {!isAdmin && !isMobile && (
          <div style={{display:'flex', gap:8}}>
            <button onClick={()=>setControleModal(true)}
              style={{background:'#f59e0b', color:'#fff', border:'none', padding:'9px 16px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:12.5}}>
              ⭐ Contrôle de chambre
            </button>
            <button onClick={()=>setNouvelleModal(true)}
              style={{background:'#dc2626', color:'#fff', border:'none', padding:'9px 16px', borderRadius:9, cursor:'pointer', fontWeight:700, fontSize:12.5}}>
              + Déposer une plainte
            </button>
          </div>
        )}
      </div>

      {isAdmin && dashboard && (
        <PlaintesDashboard data={dashboard} filtres={filtres} setFiltres={setFiltres} categories={CATEGORIES} agents={tousAgents}
          statutLabels={STATUT_LABELS} statutColors={STATUT_COLORS} isMobile={isMobile} />
      )}

      {/* Actives / Historique : l'onglet Historique vit maintenant dans la
          page Historique commune à tout le reste du module (demande
          d'Edgar), pas ici en doublon - cette page ne montre plus que les
          dossiers actifs, un simple lien renvoie vers l'historique. */}
      {isAdmin && (
        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:10}}>
          <a onClick={(e)=>{e.preventDefault(); navigate('/historique')}} href="/historique"
            style={{padding:'6px 12px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:700,
              background:'#e2e8f0', color:'#475569', display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
            🗂️ Voir les dossiers clôturés/rejetés (Historique)
          </a>
        </div>
      )}

      {isAdmin && (
        isMobile ? (
          <div style={{display:'flex', gap:8, marginBottom:14, overflowX:'auto', paddingBottom:4}}>
            {[['','Toutes'],['a_qualifier','À qualifier'],['en_cours','En cours'],['resolue','Résolues']].map(([v,l])=>(
              <button key={v||'toutes'} onClick={()=>setFiltreStatut(v)}
                style={{flexShrink:0,padding:'6px 14px',borderRadius:99,fontSize:12,fontWeight:700,
                  border:`1px solid ${filtreStatut===v?'#0F2A5C':'#e2e8f0'}`,
                  background:filtreStatut===v?'#0F2A5C':'#fff',
                  color:filtreStatut===v?'#fff':'#475569'}}>
                {l}
              </button>
            ))}
          </div>
        ) : (
        <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap'}}>
          <select value={filtreStatut} onChange={e=>setFiltreStatut(e.target.value)} style={{padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:12.5}}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABELS).map(([k,l])=><option key={k} value={k}>{l}</option>)}
          </select>
          <select value={filtreCategorie} onChange={e=>setFiltreCategorie(e.target.value)} style={{padding:'7px 10px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:12.5}}>
            <option value="">Toutes catégories</option>
            {Object.keys(CATEGORIES).map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
          </select>
          <a href={plaintesAPI.exportCsv({statut:filtreStatut, categorie:filtreCategorie})} target="_blank" rel="noreferrer"
            style={{background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', padding:'7px 14px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:700}}>
            ⬇ Export CSV
          </a>
        </div>
        )
      )}

      {/* Bouton de masse (demande d'Edgar) : apparaît dès qu'au moins une
          plainte est cochée, uniquement vue Actives (une plainte déjà
          clôturée/rejetée n'a plus d'action de masse pertinente). */}
      {isAdmin && selection.size > 0 && (
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'8px 12px', flexWrap:'wrap'}}>
          <span style={{fontSize:12.5, fontWeight:700, color:'#1e3a8a'}}>{selection.size} sélectionnée(s)</span>
          <button disabled={bulkRunning} onClick={()=>actionMasse('affecter', {affecte_a:user.id}, 'Affectées à moi')}
            style={{background:'#06b6d4', color:'#fff', border:'none', padding:'6px 12px', borderRadius:7, cursor:'pointer', fontSize:11.5, fontWeight:700}}>
            Affecter à moi
          </button>
          <button disabled={bulkRunning} onClick={()=>{
              const motif = prompt('Motif du rejet, appliqué à toute la sélection (obligatoire) :')
              if (motif) actionMasse('rejeter', motif, 'Rejetées')
            }}
            style={{background:'#fee2e2', color:'#dc2626', border:'1px solid #fecaca', padding:'6px 12px', borderRadius:7, cursor:'pointer', fontSize:11.5, fontWeight:700}}>
            Rejeter
          </button>
          <button onClick={()=>setSelection(new Set())} style={{background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:11.5, marginLeft:'auto'}}>✕ Annuler</button>
        </div>
      )}

      {loading ? (
        <div style={{padding:40, textAlign:'center', color:'#94a3b8'}}>⏳ Chargement...</div>
      ) : visibles.length === 0 ? (
        <div style={{padding:40, textAlign:'center', color:'#94a3b8', background:'#fff', borderRadius:10}}>
          Aucune plainte active.
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {visibles.map(p => (
            <div key={p.id} onClick={()=>setDetailModal(p)}
              style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:14, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                {isAdmin && (
                  <input type="checkbox" checked={selection.has(p.id)} onClick={e=>e.stopPropagation()}
                    onChange={()=>toggleSelection(p.id)} style={{marginTop:3, width:16, height:16, cursor:'pointer'}}/>
                )}
                <div>
                  <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:4}}>
                    <span style={{fontWeight:700, fontSize:13}}>{p.categorie_label || p.categorie}{p.sous_categorie ? ` — ${p.sous_categorie}` : ''}</span>
                    {badge(p.statut)}
                    {isAdmin && <span style={{fontSize:11, color:'#64748b'}}>📍 {p.batiment_residence}</span>}
                  </div>
                  <div style={{fontSize:12, color:'#64748b'}}>{p.description}</div>
                  {(() => { const sl = slaInfo(p); return sl && <span style={{display:'inline-block', marginTop:4, fontSize:10.5, fontWeight:800, color:sl.c, background:`${sl.c}14`, padding:'2px 8px', borderRadius:99}}>{sl.t}</span> })()}
                  {isAdmin && <div style={{fontSize:11, color:'#94a3b8', marginTop:2}}>{p.occupant_nom} · {new Date(p.date_creation).toLocaleDateString('fr-FR')}</div>}
                </div>
              </div>
              {!isAdmin && p.statut === 'resolue' && (
                <div style={{display:'flex', gap:6}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>confirmerResolution(p.id, true)} style={{background:'#16a34a', color:'#fff', border:'none', padding:'6px 12px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700}}>✅ Résolu</button>
                  <button onClick={()=>confirmerResolution(p.id, false)} style={{background:'#dc2626', color:'#fff', border:'none', padding:'6px 12px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700}}>❌ Persiste</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isAdmin && isMobile && (
        <div style={{position:'fixed', right:16, bottom:'calc(98px + env(safe-area-inset-bottom, 0px))', display:'flex', flexDirection:'column', gap:10, zIndex:80}}>
          <button onClick={()=>setControleModal(true)} aria-label="Contrôle de chambre"
            style={{width:48, height:48, borderRadius:24, background:'#f59e0b', border:'none', boxShadow:'0 6px 16px rgba(245,158,11,.4)', fontSize:20, cursor:'pointer'}}>
            ⭐
          </button>
          <button onClick={()=>setNouvelleModal(true)} aria-label="Déposer une plainte"
            style={{width:54, height:54, borderRadius:27, background:'#dc2626', border:'none', boxShadow:'0 6px 16px rgba(220,38,38,.4)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      )}

      {/* Modale : nouvelle plainte */}
      {nouvelleModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:1000, padding:16, overflowY:'auto'}}
          onClick={e=>e.target===e.currentTarget && setNouvelleModal(false)}>
          <div style={{background:'#fff', borderRadius:14, maxWidth:440, width:'100%', padding:20, marginTop:8, marginBottom:8, maxHeight:'92vh', overflowY:'auto'}}>
            <div style={{fontWeight:700, fontSize:15, marginBottom:14}}>🧹 Déposer une plainte</div>
            {isAdmin ? (
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', marginBottom:4}}>Occupant concerné <span style={{color:'#dc2626'}}>*</span></div>
                {pourPersonne
                  ? <div style={{display:'flex', alignItems:'center', gap:8, fontWeight:800, color:'#0F2A5C'}}>✔ {pourPersonne.nom} <button type="button" onClick={()=>setPourPersonne(null)} style={{border:'none', background:'none', color:'#dc2626', cursor:'pointer', fontWeight:700}}>×</button></div>
                  : <ChoixPersonne placeholder="Saisir un nom…" options={personnes} onChoisir={id => setPourPersonne(personnes.find(p => p.id === id) || null)} style={{maxWidth:'100%'}} />}
                <div style={{fontSize:11, color:'#94a3b8', marginTop:4}}>La chambre est celle de son hébergement actuel.</div>
              </div>
            ) : <div style={{fontSize:11, color:'#94a3b8', marginBottom:10}}>Votre chambre actuelle sera associée automatiquement.</div>}
            <label style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>Catégorie</label>
            <select value={nouvelleForm.categorie} onChange={e=>setNouvelleForm(f=>({...f, categorie:e.target.value, sous_categorie:CATEGORIES[e.target.value][0]}))}
              style={{width:'100%', padding:9, borderRadius:8, border:'1px solid #e2e8f0', marginBottom:10, marginTop:4}}>
              {Object.keys(CATEGORIES).map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
            </select>
            <label style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>Sous-catégorie</label>
            <select value={nouvelleForm.sous_categorie} onChange={e=>setNouvelleForm(f=>({...f, sous_categorie:e.target.value}))}
              style={{width:'100%', padding:9, borderRadius:8, border:'1px solid #e2e8f0', marginBottom:10, marginTop:4}}>
              {(CATEGORIES[nouvelleForm.categorie]||[]).map(sc=><option key={sc} value={sc}>{sc}</option>)}
            </select>
            <label style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>Description</label>
            <textarea value={nouvelleForm.description} onChange={e=>setNouvelleForm(f=>({...f, description:e.target.value}))}
              rows={3} style={{width:'100%', padding:9, borderRadius:8, border:'1px solid #e2e8f0', marginBottom:14, marginTop:4}}/>
            <PhotoCapture label="Photo du problème" requis value={nouvelleForm.photo_base64} onChange={v=>setNouvelleForm(f=>({...f, photo_base64:v}))} />
            <button onClick={creerPlainte} disabled={envoiEnCours} style={{opacity:envoiEnCours?.6:1, width:'100%', background:'#dc2626', color:'#fff', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontWeight:700}}>
              Envoyer
            </button>
          </div>
        </div>
      )}

      {/* Modale : contrôle de chambre (étoiles) */}
      {controleModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:1000, padding:16, overflowY:'auto'}}
          onClick={e=>e.target===e.currentTarget && setControleModal(false)}>
          {/* alignItems:'flex-start' (au lieu de 'center') : avec un
              contenu (11 criteres a noter) plus haut que l'ecran, un
              flex container centre verticalement coupe le debut du
              contenu de facon inaccessible au scroll sur mobile - bug
              CSS connu du couple align-items:center + overflow. C'est
              la cause reelle du "impossible de scroller pour donner les
              etoiles". */}
          <div style={{background:'#fff', borderRadius:14, maxWidth:480, width:'100%', padding:20, marginTop:8, marginBottom:8, maxHeight:'92vh', overflowY:'auto'}}>
            <div style={{fontWeight:700, fontSize:15, marginBottom:4}}>⭐ Contrôle de chambre — Propreté</div>
            <div style={{fontSize:11, color:'#94a3b8', marginBottom:14}}>Une note inférieure à 2 sur un critère envoie automatiquement un signal de mécontentement.</div>
            {PROPRETE_CRITERES.map(c => (
              <div key={c} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f1f5f9'}}>
                <span style={{fontSize:13, textTransform:'capitalize'}}>{c}</span>
                <Etoiles value={notesProprete[c]} onChange={n=>setNotesProprete(f=>({...f, [c]:n}))}/>
              </div>
            ))}
            <button onClick={soumettreControle} disabled={envoiEnCours} style={{opacity:envoiEnCours?.6:1, width:'100%', background:'#f59e0b', color:'#fff', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontWeight:700, marginTop:16}}>
              Enregistrer le contrôle
            </button>
          </div>
        </div>
      )}

      {/* Modale : modification d'une plainte existante */}
      {editModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:1100, padding:16, overflowY:'auto'}}
          onClick={e=>e.target===e.currentTarget && setEditModal(false)}>
          <div style={{background:'#fff', borderRadius:14, maxWidth:440, width:'100%', padding:20, marginTop:8, marginBottom:8, maxHeight:'92vh', overflowY:'auto'}}>
            <div style={{fontWeight:700, fontSize:15, marginBottom:14}}>✏️ Modifier la plainte</div>
            <label style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>Catégorie</label>
            <select value={editForm.categorie} onChange={e=>setEditForm(f=>({...f, categorie:e.target.value, sous_categorie:CATEGORIES[e.target.value]?.[0] || ''}))}
              style={{width:'100%', padding:9, borderRadius:8, border:'1px solid #e2e8f0', marginBottom:10, marginTop:4}}>
              {Object.keys(CATEGORIES).map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
            </select>
            <label style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>Sous-catégorie</label>
            <select value={editForm.sous_categorie} onChange={e=>setEditForm(f=>({...f, sous_categorie:e.target.value}))}
              style={{width:'100%', padding:9, borderRadius:8, border:'1px solid #e2e8f0', marginBottom:10, marginTop:4}}>
              {(CATEGORIES[editForm.categorie]||[]).map(sc=><option key={sc} value={sc}>{sc}</option>)}
            </select>
            <label style={{fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase'}}>Description</label>
            <textarea value={editForm.description} onChange={e=>setEditForm(f=>({...f, description:e.target.value}))}
              rows={3} style={{width:'100%', padding:9, borderRadius:8, border:'1px solid #e2e8f0', marginBottom:14, marginTop:4}}/>
            <div style={{display:'flex', gap:8}}>
              <button onClick={()=>setEditModal(false)} style={{flex:1, background:'#f1f5f9', color:'#475569', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontWeight:700}}>Annuler</button>
              <button onClick={enregistrerEdition} style={{flex:1, background:'#0F2A5C', color:'#fff', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontWeight:700}}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : détail + actions superviseur */}
      {detailModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:1000, padding:16, overflowY:'auto'}}
          onClick={e=>e.target===e.currentTarget && setDetailModal(null)}>
          <div style={{background:'#fff', borderRadius:14, maxWidth:520, width:'100%', padding:20, marginTop:8, marginBottom:8, maxHeight:'92vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
              <div style={{fontWeight:700, fontSize:15}}>{detailModal.categorie_label} — {detailModal.sous_categorie}</div>
              {badge(detailModal.statut)}
            </div>
            <div style={{fontSize:13, marginBottom:10}}>{detailModal.description}</div>
            <div style={{fontSize:11, color:'#94a3b8', marginBottom:14}}>
              {detailModal.occupant_nom} · {detailModal.batiment_residence} · {new Date(detailModal.date_creation).toLocaleString('fr-FR')}
            </div>
            {(() => { const sl = slaInfo(detailModal); return sl && (
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, background:`${sl.c}12`, border:`1px solid ${sl.c}55`, borderRadius:10, padding:'8px 12px', marginBottom:12}}>
                <span style={{fontWeight:800, fontSize:12.5, color:sl.c}}>{sl.t}</span>
                <span style={{fontSize:11, color:'#5B6B86'}}>Échéance : {new Date(detailModal.sla_echeance).toLocaleString('fr-FR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
              </div>) })()}
            {(detailModal.photo_base64 || detailModal.photo_resolution_base64) && (
              <div style={{display:'grid', gridTemplateColumns: detailModal.photo_base64 && detailModal.photo_resolution_base64 ? '1fr 1fr' : '1fr', gap:8, marginBottom:12}}>
                {detailModal.photo_base64 && <div><div style={{fontSize:10.5, fontWeight:800, color:'#7C3AED', textTransform:'uppercase', marginBottom:3}}>Avant</div><img src={`data:image/jpeg;base64,${detailModal.photo_base64}`} alt="Photo du dépôt" style={{width:'100%', maxHeight:200, objectFit:'cover', borderRadius:10, border:'1px solid #D8DEE9'}}/></div>}
                {detailModal.photo_resolution_base64 && <div><div style={{fontSize:10.5, fontWeight:800, color:'#16A34A', textTransform:'uppercase', marginBottom:3}}>Après</div><img src={`data:image/jpeg;base64,${detailModal.photo_resolution_base64}`} alt="Photo après intervention" style={{width:'100%', maxHeight:200, objectFit:'cover', borderRadius:10, border:'1px solid #D8DEE9'}}/></div>}
              </div>
            )}
            <button onClick={()=>imprimerFiche(detailModal)}
              style={{background:'#0F2A5C', color:'#fff', border:'none', padding:'7px 12px', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:12, marginBottom:12}}>
              🖨️ Fiche d'intervention
            </button>

            {/* Frise des étapes */}
            <div style={{margin:'0 0 14px', padding:'12px 14px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10}}>
              <div style={{fontSize:12, fontWeight:800, marginBottom:10, color:'#0f172a'}}>Suivi de la plainte</div>
              {!frise ? <div style={{fontSize:12, color:'#94a3b8'}}>Chargement…</div> :
               frise.etapes.length === 0 ? <div style={{fontSize:12, color:'#94a3b8'}}>Aucune étape enregistrée.</div> : (
                <div>
                  {frise.etapes.map((e, i) => {
                    const dernier = i === frise.etapes.length - 1
                    const c = {depose:'#3b82f6', retiree:'#ef4444', reaffectee:'#8b5cf6', affectee:'#8b5cf6', prise_en_charge:'#06b6d4', en_cours:'#f97316', en_attente:'#94a3b8', resolue:'#22c55e', confirmee:'#16a34a', cloturee:'#64748b', rejetee:'#ef4444', reouverte:'#dc2626', a_qualifier:'#f59e0b'}[e.cle] || '#64748b'
                    return (
                      <div key={i} style={{display:'flex', gap:12}}>
                        <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                          <div style={{width:14, height:14, borderRadius:7, background: dernier ? c : '#fff', border:`3px solid ${c}`, boxSizing:'border-box', flexShrink:0, boxShadow: dernier ? `0 0 0 4px ${c}25` : 'none'}}/>
                          {!dernier && <div style={{width:2, flex:1, minHeight:22, background:'#e2e8f0'}}/>}
                        </div>
                        <div style={{paddingBottom: dernier ? 0 : 12, minWidth:0}}>
                          <div style={{fontSize:12.5, fontWeight:800, color:c}}>{e.titre}</div>
                          {e.detail && <div style={{fontSize:12, color:'#334155'}}>{e.detail}</div>}
                          <div style={{fontSize:10.5, color:'#94a3b8'}}>{new Date(e.date).toLocaleString('fr-FR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}{e.par ? ` · ${e.par}` : ''}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modifier/Supprimer : admin toujours (correction d'une
                erreur de saisie, meme tardive) ; occupant uniquement tant
                que sa plainte n'a pas encore ete traitee ("nouvelle") -
                au-dela un traitement est deja engage, modifier le contenu
                sous le traitant n'a plus de sens. */}
            {(isAdmin || detailModal.statut === 'nouvelle') && (
              <div style={{display:'flex', gap:6, marginBottom:12}}>
                <button onClick={()=>ouvrirEdition(detailModal)}
                  style={{background:'#f1f5f9', color:'#334155', border:'1px solid #e2e8f0', padding:'7px 12px', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:12}}>
                  ✏️ Modifier
                </button>
                <button onClick={()=>supprimerPlainte(detailModal.id)}
                  style={{background:'#fee2e2', color:'#dc2626', border:'1px solid #fecaca', padding:'7px 12px', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:12}}>
                  🗑 Supprimer
                </button>
              </div>
            )}

            {isAdmin && detailModal.statut === 'nouvelle' && (
              <div style={{background:'#f8fafc', borderRadius:10, padding:12, marginBottom:12}}>
                <div style={{fontSize:12, fontWeight:700, marginBottom:8}}>Qualifier</div>
                <select onChange={e=>setActionForm(f=>({...f, priorite:e.target.value}))} style={{width:'100%', padding:8, borderRadius:7, border:'1px solid #e2e8f0', marginBottom:6}}>
                  <option value="">Priorité...</option>
                  <option value="critique">🔴 Critique</option><option value="haute">🟠 Haute</option>
                  <option value="moyenne">🟡 Moyenne</option><option value="basse">🟢 Basse</option>
                </select>
                <input placeholder="Service" onChange={e=>setActionForm(f=>({...f, service:e.target.value}))} style={{width:'100%', padding:8, borderRadius:7, border:'1px solid #e2e8f0', marginBottom:6}}/>
                <label style={{fontSize:11}}><input type="checkbox" onChange={e=>setActionForm(f=>({...f, maintenance_necessaire:e.target.checked}))}/> Maintenance nécessaire</label>
                <button onClick={()=>actionAdmin(detailModal.id, 'qualifier', actionForm, 'Plainte qualifiée')} style={{width:'100%', background:'#8b5cf6', color:'#fff', border:'none', padding:9, borderRadius:7, cursor:'pointer', fontWeight:700, marginTop:8}}>Qualifier</button>
              </div>
            )}
            {isAdmin && !['cloturee','rejetee','resolue','confirmee'].includes(detailModal.statut) && (
              <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:12, marginBottom:12}}>
                <div style={{fontSize:12, fontWeight:700, marginBottom:8}}>👤 Responsable</div>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap'}}>
                  {detailModal.affecte_a ? (
                    <>
                      <span style={{background:'#ede9fe', color:'#6d28d9', fontWeight:800, fontSize:12.5, padding:'5px 12px', borderRadius:99}}>{detailModal.affecte_a_nom}</span>
                      <button onClick={async()=>{ if (await confirmDialog(`Retirer ${detailModal.affecte_a_nom} de cette plainte ?`)) actionAdmin(detailModal.id, 'retirer', undefined, 'Affectation retirée') }}
                        style={{background:'#fff', color:'#dc2626', border:'1px solid #fecaca', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:11.5}}>✕ Retirer</button>
                    </>
                  ) : <span style={{fontSize:12, color:'#94a3b8'}}>Personne d'affecté pour le moment</span>}
                </div>
                <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                  <div style={{flex:'1 1 220px'}}>
                    {agentChoisi && (() => { const a = agents.find(x => String(x.id) === String(agentChoisi)); return a ? (
                      <div style={{marginBottom:6, fontSize:12.5, fontWeight:700, color:'#6d28d9'}}>
                        ✔ {a.nom} <button type="button" onClick={()=>setAgentChoisi('')} style={{border:'none', background:'none', color:'#dc2626', cursor:'pointer', fontWeight:700}}>×</button>
                      </div>) : null })()}
                    <ChoixPersonne placeholder={detailModal.affecte_a ? 'Réaffecter à… (saisir un nom)' : 'Affecter à… (saisir un nom)'}
                      options={agents.filter(a => a.id !== detailModal.affecte_a).map(a => ({ id:a.id, nom:a.nom, detail:`${a.role || 'compte'} · ${a.en_cours} en cours` }))}
                      onChoisir={id => setAgentChoisi(String(id))} />
                  </div>
                  <button disabled={!agentChoisi} onClick={()=>actionAdmin(detailModal.id, 'affecter', {affecte_a: Number(agentChoisi)}, detailModal.affecte_a ? 'Réaffectée' : 'Affectée')}
                    style={{background: agentChoisi ? '#7c3aed' : '#cbd5e1', color:'#fff', border:'none', padding:'8px 14px', borderRadius:7, cursor: agentChoisi ? 'pointer' : 'default', fontWeight:700, fontSize:12.5}}>
                    {detailModal.affecte_a ? '↻ Réaffecter' : 'Affecter'}
                  </button>
                  {detailModal.affecte_a !== user?.id && (
                    <button onClick={()=>actionAdmin(detailModal.id, 'affecter', {affecte_a: user.id}, 'Affectée à moi')}
                      style={{background:'#06b6d4', color:'#fff', border:'none', padding:'8px 12px', borderRadius:7, cursor:'pointer', fontWeight:700, fontSize:12.5}}>Moi</button>
                  )}
                </div>
              </div>
            )}
            {(isAdmin || detailModal.affecte_a === user?.id) && detailModal.statut === 'affectee' && (
              <button onClick={()=>actionAdmin(detailModal.id, 'prendreEnCharge', {}, 'Prise en charge')}
                style={{width:'100%', background:'#f97316', color:'#fff', border:'none', padding:10, borderRadius:8, cursor:'pointer', fontWeight:700, marginBottom:12}}>▶ Prendre en charge</button>
            )}
            {isAdmin && ['prise_en_charge','en_cours','en_attente'].includes(detailModal.statut) && (
              <div style={{background:'#f8fafc', borderRadius:10, padding:12, marginBottom:12}}>
                <div style={{fontSize:12, fontWeight:700, marginBottom:8}}>Traitement</div>
                <textarea placeholder="Résultat / action réalisée" onChange={e=>setActionForm(f=>({...f, resultat_resolution:e.target.value, action_resolution:e.target.value}))} rows={2} style={{width:'100%', padding:8, borderRadius:7, border:'1px solid #e2e8f0', marginBottom:6}}/>
                <PhotoCapture label="Photo après intervention" requis value={photoResolution} onChange={setPhotoResolution} />
                <div style={{display:'flex', gap:6}}>
                  <button onClick={()=>{
                      const motif = prompt('Motif de mise en attente (obligatoire) :')
                      if (motif) actionAdmin(detailModal.id, 'mettreEnAttente', motif, 'Mise en attente')
                    }} style={{background:'#94a3b8', color:'#fff', border:'none', padding:'8px 12px', borderRadius:7, cursor:'pointer', fontWeight:700}}>En attente</button>
                  <button disabled={!photoResolution} title={photoResolution ? '' : 'Photo après intervention obligatoire'} onClick={()=>actionAdmin(detailModal.id, 'resoudre', {...actionForm, photo_resolution_base64: photoResolution}, 'Résolue')} style={{opacity: photoResolution ? 1 : .5, background:'#22c55e', color:'#fff', border:'none', padding:'8px 12px', borderRadius:7, cursor:'pointer', fontWeight:700}}>Résoudre</button>
                </div>
              </div>
            )}
            {isAdmin && detailModal.statut === 'en_attente' && (
              <button onClick={()=>actionAdmin(detailModal.id, 'reprendre', {}, 'Reprise')} style={{width:'100%', background:'#f97316', color:'#fff', border:'none', padding:9, borderRadius:7, cursor:'pointer', fontWeight:700, marginBottom:12}}>▶ Reprendre</button>
            )}
            {isAdmin && !['cloturee','rejetee'].includes(detailModal.statut) && (
              <button onClick={()=>{
                  const motif = prompt('Motif du rejet (obligatoire) :')
                  if (motif) actionAdmin(detailModal.id, 'rejeter', motif, 'Rejetée')
                }} style={{width:'100%', background:'transparent', color:'#dc2626', border:'1px solid #fecaca', padding:9, borderRadius:7, cursor:'pointer', fontWeight:700}}>
                ✕ Rejeter
              </button>
            )}
            {!isAdmin && detailModal.statut === 'resolue' && (
              <div style={{display:'flex', gap:8}}>
                <button onClick={()=>confirmerResolution(detailModal.id, true)} style={{flex:1, background:'#16a34a', color:'#fff', border:'none', padding:10, borderRadius:8, cursor:'pointer', fontWeight:700}}>✅ Oui, résolu</button>
                <button onClick={()=>confirmerResolution(detailModal.id, false)} style={{flex:1, background:'#dc2626', color:'#fff', border:'none', padding:10, borderRadius:8, cursor:'pointer', fontWeight:700}}>❌ Persiste</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
