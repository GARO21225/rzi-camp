import { useState, useEffect, useCallback } from 'react'
import { plaintes as plaintesAPI, controlesChambre as controlesAPI } from '../api'
import { useStore } from '../store'
import { toast, confirmDialog } from '../toast'
import { usePlainteCategories } from '../constants/plaintes'
import { useIsMobile } from '../hooks/useIsMobile'
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
  const isMobile = useIsMobile()
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser) || user?.profile?.role === 'admin' || user?.profile?.role === 'manager' || user?.profile?.role === 'superviseur'
  const CATEGORIES = usePlainteCategories()

  // "tab" réutilisé comme bascule Actives/Historique (demande d'Edgar :
  // les dossiers clôturés/rejetés ne doivent plus encombrer la vue
  // courante) — il n'avait jamais été câblé à quoi que ce soit avant.
  const [tab, setTab] = useState('actives')
  const [liste, setListe] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filtreStatut, setFiltreStatut] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [detailModal, setDetailModal] = useState(null)
  const [nouvelleModal, setNouvelleModal] = useState(false)
  const [nouvelleForm, setNouvelleForm] = useState({categorie:'Proprete', sous_categorie:'poubelle', description:'', commentaire:''})
  const [controleModal, setControleModal] = useState(false)
  const [notesProprete, setNotesProprete] = useState({})
  const [actionForm, setActionForm] = useState({})
  const [selection, setSelection] = useState(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({categorie:'', sous_categorie:'', description:'', commentaire:''})
  const STATUTS_CLOTURES = ['cloturee','rejetee']

  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filtreStatut) params.statut = filtreStatut
      if (filtreCategorie) params.categorie = filtreCategorie
      const r = await plaintesAPI.list(params)
      setListe(r.data?.results || r.data || [])
      if (isAdmin) {
        const rd = await plaintesAPI.dashboard()
        setDashboard(rd.data)
      }
    } catch(e) { toast.error("Erreur de chargement") }
    setLoading(false)
  }, [filtreStatut, filtreCategorie, isAdmin])

  useEffect(() => { charger() }, [charger])

  const creerPlainte = async () => {
    if (!nouvelleForm.description.trim()) return toast.error('Description requise')
    try {
      await plaintesAPI.creer(nouvelleForm)
      toast.success('Plainte déposée')
      setNouvelleModal(false)
      setNouvelleForm({categorie:'Proprete', sous_categorie:'poubelle', description:'', commentaire:''})
      charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const soumettreControle = async () => {
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
  }

  const confirmerResolution = async (id, resolu) => {
    if (resolu && !await confirmDialog('Confirmer que le problème est bien résolu ?')) return
    const motif = resolu ? '' : prompt('Le problème persiste — précisez ce qui ne va pas encore :') || ''
    if (!resolu && !motif) return
    try {
      await plaintesAPI.confirmer(id, resolu, motif)
      toast.success(resolu ? 'Plainte clôturée' : 'Plainte réouverte')
      setDetailModal(null); charger()
      // Clôturer fait sortir le dossier de la vue Actives (demande
      // d'Edgar) - bascule sur Historique pour qu'il ne semble pas
      // avoir disparu.
      if (resolu) setTab('historique')
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const actionAdmin = async (id, action, data, successMsg) => {
    try {
      await plaintesAPI[action](id, data)
      toast.success(successMsg)
      setActionForm({}); charger()
      if (detailModal) setDetailModal(null)
      // Meme logique que la cloture (ci-dessus) : un rejet sort aussi
      // le dossier de la vue Actives.
      if (action === 'rejeter') setTab('historique')
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
        <div style={isMobile
          ? {display:'flex', gap:10, marginBottom:16, overflowX:'auto', paddingBottom:4}
          : {display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:16}}>
          {Object.entries(dashboard.par_statut || {}).map(([s,n]) => (
            <div key={s} style={{flexShrink:0, minWidth: isMobile?90:'auto', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 12px', borderTop:`3px solid ${STATUT_COLORS[s]}`}}>
              <div style={{fontSize:20, fontWeight:800, color:STATUT_COLORS[s]}}>{n}</div>
              <div style={{fontSize:10, color:'#64748b', textTransform:'uppercase', fontWeight:700}}>{STATUT_LABELS[s]}</div>
            </div>
          ))}
          <div style={{flexShrink:0, minWidth: isMobile?90:'auto', background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 12px', borderTop:'3px solid #dc2626'}}>
            <div style={{fontSize:20, fontWeight:800, color:'#dc2626'}}>{dashboard.en_retard}</div>
            <div style={{fontSize:10, color:'#64748b', textTransform:'uppercase', fontWeight:700}}>En retard</div>
          </div>
        </div>
      )}

      {/* Actives / Historique : les dossiers clôturés/rejetés n'encombrent
          plus la vue par défaut (demande d'Edgar) — ils restent accessibles
          dans Historique plutôt que disparaître. */}
      <div style={{display:'flex', gap:8, marginBottom:14}}>
        {[['actives','📋 Actives'],['historique','🗄️ Historique']].map(([v,l])=>(
          <button key={v} onClick={()=>{setTab(v); setSelection(new Set())}}
            style={{padding:'7px 16px',borderRadius:9,fontSize:12.5,fontWeight:700,border:'none',cursor:'pointer',
              background:tab===v?'#0F2A5C':'#f1f5f9', color:tab===v?'#fff':'#475569'}}>
            {l}
          </button>
        ))}
      </div>

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
      {isAdmin && tab==='actives' && selection.size > 0 && (
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
      ) : liste.filter(p => tab==='historique' ? STATUTS_CLOTURES.includes(p.statut) : !STATUTS_CLOTURES.includes(p.statut)).length === 0 ? (
        <div style={{padding:40, textAlign:'center', color:'#94a3b8', background:'#fff', borderRadius:10}}>
          {tab==='historique' ? 'Aucun dossier clôturé/rejeté.' : 'Aucune plainte.'}
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {liste.filter(p => tab==='historique' ? STATUTS_CLOTURES.includes(p.statut) : !STATUTS_CLOTURES.includes(p.statut)).map(p => (
            <div key={p.id} onClick={()=>setDetailModal(p)}
              style={{background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:14, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                {isAdmin && tab==='actives' && (
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
            <div style={{fontSize:11, color:'#94a3b8', marginBottom:10}}>Votre chambre actuelle sera associée automatiquement.</div>
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
            <button onClick={creerPlainte} style={{width:'100%', background:'#dc2626', color:'#fff', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontWeight:700}}>
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
            <button onClick={soumettreControle} style={{width:'100%', background:'#f59e0b', color:'#fff', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontWeight:700, marginTop:16}}>
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
            {isAdmin && ['a_qualifier','affectee'].includes(detailModal.statut) && (
              <div style={{background:'#f8fafc', borderRadius:10, padding:12, marginBottom:12}}>
                <div style={{fontSize:12, fontWeight:700, marginBottom:8}}>Affecter / Prendre en charge</div>
                {/* BUG REEL CORRIGE ICI : envoyait actionForm.affecte_a, qui
                    n'est JAMAIS renseigné nulle part dans ce formulaire (aucun
                    champ ne l'alimente) — le bouton envoyait donc toujours
                    affecte_a:null, et le backend (qui l'exige) répondait
                    systématiquement "affecte_a requis." Pour "Affecter à moi",
                    la bonne valeur est l'id de l'utilisateur CONNECTÉ. */}
                <button onClick={()=>actionAdmin(detailModal.id, 'affecter', {affecte_a: user.id}, 'Affectée')} style={{background:'#06b6d4', color:'#fff', border:'none', padding:'8px 12px', borderRadius:7, cursor:'pointer', fontWeight:700, marginRight:6}}>Affecter à moi</button>
                <button onClick={()=>actionAdmin(detailModal.id, 'prendreEnCharge', {}, 'Prise en charge')} style={{background:'#f97316', color:'#fff', border:'none', padding:'8px 12px', borderRadius:7, cursor:'pointer', fontWeight:700}}>Prendre en charge</button>
              </div>
            )}
            {isAdmin && ['prise_en_charge','en_cours','en_attente'].includes(detailModal.statut) && (
              <div style={{background:'#f8fafc', borderRadius:10, padding:12, marginBottom:12}}>
                <div style={{fontSize:12, fontWeight:700, marginBottom:8}}>Traitement</div>
                <textarea placeholder="Résultat / action réalisée" onChange={e=>setActionForm(f=>({...f, resultat_resolution:e.target.value, action_resolution:e.target.value}))} rows={2} style={{width:'100%', padding:8, borderRadius:7, border:'1px solid #e2e8f0', marginBottom:6}}/>
                <div style={{display:'flex', gap:6}}>
                  <button onClick={()=>{
                      const motif = prompt('Motif de mise en attente (obligatoire) :')
                      if (motif) actionAdmin(detailModal.id, 'mettreEnAttente', motif, 'Mise en attente')
                    }} style={{background:'#94a3b8', color:'#fff', border:'none', padding:'8px 12px', borderRadius:7, cursor:'pointer', fontWeight:700}}>En attente</button>
                  <button onClick={()=>actionAdmin(detailModal.id, 'resoudre', actionForm, 'Résolue')} style={{background:'#22c55e', color:'#fff', border:'none', padding:'8px 12px', borderRadius:7, cursor:'pointer', fontWeight:700}}>Résoudre</button>
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
