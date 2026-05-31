/**
 * InductionPage — Workflow QHSE Séquentiel
 * Chaque étape doit être validée pour débloquer la suivante
 * Inspiré des formations en ligne avec QCM
 */
import React, { useState, useEffect, useCallback } from 'react'
import { personnel as personnelAPI, inductionAPI } from '../api'

class InductionErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('InductionPage crash:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:40,textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:16}}>⚠️</div>
          <div style={{fontSize:18,fontWeight:700,color:'#dc2626',marginBottom:8}}>Erreur dans la page Induction</div>
          <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>{this.state.error.message}</div>
          <button onClick={()=>this.setState({error:null})}
            style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer'}}>
            🔄 Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const LS_KEY = 'rzi_induction_v3'
const OFFLINE_QUEUE_KEY = 'rzi_induction_offline_queue'

// ─── Gestion de la file d'attente hors-ligne ──────────────────────
function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') }
  catch { return [] }
}
function addToOfflineQueue(item) {
  const queue = getOfflineQueue()
  queue.push({ ...item, timestamp: new Date().toISOString() })
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}
function clearOfflineQueue() {
  localStorage.setItem(OFFLINE_QUEUE_KEY, '[]')
}

// ─── Synchronisation avec le backend ──────────────────────────────
async function syncOfflineQueue() {
  const queue = getOfflineQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }
  
  let synced = 0, failed = 0
  const failedItems = []
  
  for (const item of queue) {
    try {
      await inductionAPI.updateEtape(item.data)
      synced++
    } catch (e) {
      failed++
      failedItems.push(item)
    }
  }
  
  // Garder seulement les items qui ont echoue
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedItems))
  return { synced, failed }
}

// ─── Définition des étapes ────────────────────────────────────────
const ETAPES = [
  {
    key: 'accueil',
    assignRole: 'accueil',
    assignLabel: "👋 Agent d'accueil",
    icon: '👋',
    titre: 'Accueil & Enregistrement',
    desc: 'Informations personnelles complètes',
    couleur: '#1e3a8a',
    type: 'form',
    champs: [
      { key:'photo', label:'Photo d\'identité', type:'photo', required:true },
      { key:'nationalite', label:'Nationalité', type:'text', placeholder:'Ex: Ivoirienne', required:true },
      { key:'urgence_nom', label:'Contact urgence (Nom)', type:'text', placeholder:'Nom complet', required:true },
      { key:'urgence_tel', label:'Contact urgence (Tél)', type:'tel', placeholder:'+225 XX XX XX XX', required:true },
      { key:'date_arrivee', label:'Date d\'arrivée prévue', type:'date', required:true },



    ]
  },
  {
    key: 'documents',
    assignRole: 'accueil',
    assignLabel: "👋 Agent d'accueil",
    icon: '📄',
    titre: 'Documents obligatoires',
    desc: 'Tous les documents doivent être soumis',
    couleur: '#7c3aed',
    type: 'documents',
    docs: [
      { key:'cni', label:'Pièce d\'identité (CNI / Passeport)', required:true },
      { key:'contrat', label:'Contrat ou lettre de mission', required:true },
      { key:'assurance', label:'Attestation d\'assurance', required:false },
      { key:'cv', label:'CV / Curriculum Vitae', required:false },
    ]
  },
  {
    key: 'formation',
    assignRole: 'qhse',
    assignLabel: '🛡️ Formateur QHSE',
    icon: '🎓',
    titre: 'Formation QHSE Obligatoire',
    desc: 'Lire et confirmer avoir suivi la formation',
    couleur: '#0891b2',
    type: 'formation',
    modules: [
      { id:1, titre:'Règles d\'or de la sécurité', duree:'15 min', contenu:'1. Travailler avec une autorisation de travail valide\n2. Tester avant de toucher les équipements électriques\n3. Valider les isolations avant travaux\n4. Travailler selon les hauteurs autorisées\n5. Ne jamais désactiver les systèmes de sécurité' },
      { id:2, titre:'Procédures d\'urgence', duree:'10 min', contenu:'En cas d\'urgence:\n• STOP WORK: Arrêter immédiatement tout travail dangereux\n• EVACUATION: Point de rassemblement Zone A (entrée principale)\n• INCENDIE: Alarme → Extinguisher → Évacuation\n• PREMIERS SECOURS: Infirmerie 24h/7j — Ext. 100' },
      { id:3, titre:'Équipements de Protection Individuelle', duree:'10 min', contenu:'EPI Obligatoires sur site:\n✓ Casque de chantier (jaune = visiteur, blanc = encadrement)\n✓ Chaussures de sécurité (coque acier)\n✓ Gilet de visibilité haute (en toutes circonstances)\n✓ Lunettes de protection (zones de poussière)\n✓ Masque FFP2 (zones poussiéreuses)' },
    ]
  },
  {
    key: 'quiz',
    assignRole: 'qhse',
    assignLabel: '🛡️ Formateur QHSE',
    icon: '📋',
    titre: 'Quiz QHSE',
    desc: 'Score minimum: 80% — 3 tentatives maximum',
    couleur: '#f59e0b',
    type: 'quiz',
    score_min: 80,
    questions: [
      { id:1,  q:'Que faire en cas d\'accident sur le site?', options:['Continuer à travailler','Alerter l\'infirmerie et ne pas déplacer la victime','Rentrer chez soi','Appeler la famille'], correct:1 },
      { id:2,  q:'Le port du casque est obligatoire:', options:['Uniquement dans les zones dangereuses','En toutes circonstances sur le site','Seulement dans les mines souterraines','Jamais pour les visiteurs'], correct:1 },
      { id:3,  q:'Que signifie "Stop Work Authority"?', options:['Arrêter la production','Le droit de tout agent d\'arrêter un travail dangereux','Interdire les heures supplémentaires','Fermer le chantier'], correct:1 },
      { id:4,  q:'Les EPI (Équipements de Protection Individuelle) sont:', options:['Optionnels selon l\'humeur','Obligatoires uniquement pour les techniciens','Obligatoires pour tous sur site','Réservés aux responsables'], correct:2 },
      { id:5,  q:'Le point de rassemblement en cas d\'évacuation est:', options:['La cafétéria','Le parking principal','Zone A — Entrée principale','La direction'], correct:2 },
      { id:6,  q:'Que doit-on faire avant de commencer un travail en hauteur?', options:['Commencer directement','Vérifier le harnais et obtenir un permis de travail','Informer sa famille','Rien de spécial'], correct:1 },
      { id:7,  q:'En cas d\'incendie, que faut-il faire EN PREMIER?', options:['Éteindre soi-même','Récupérer ses affaires','Déclencher l\'alarme et évacuer','Appeler ses collègues'], correct:2 },
      { id:8,  q:'Le port des chaussures de sécurité est obligatoire:', options:['Seulement pour les techniciens','Seulement en zone de production','Pour toute personne sur le site','Uniquement en cas de pluie'], correct:2 },
      { id:9,  q:'Un permis de travail à chaud est requis pour:', options:['Travaux de peinture','Soudure et découpe','Nettoyage à sec','Travail administratif'], correct:1 },
      { id:10, q:'La signalisation rouge sur site signifie:', options:['Attention — ralentir','Danger — zone interdite sans autorisation','Information générale','Chemin autorisé'], correct:1 },
      { id:11, q:'Que faire si vous observez une situation dangereuse?', options:['L\'ignorer','La signaler immédiatement au superviseur','Attendre la fin du poste','En parler à un ami'], correct:1 },
      { id:12, q:'Le gilet de visibilité haute doit être porté:', options:['Uniquement la nuit','En toutes circonstances sur le site','Seulement près des véhicules','Jamais en intérieur'], correct:1 },
      { id:13, q:'Le Lock-Out / Tag-Out (LOTO) sert à:', options:['Fermer les portes','Consigner une énergie dangereuse avant intervention','Bloquer les accès visiteurs','Protéger les données informatiques'], correct:1 },
      { id:14, q:'En cas de déversement accidentel d\'un produit chimique, il faut:', options:['Laisser évaporer','Alerter et utiliser le kit anti-déversement','Nettoyer avec de l\'eau directement','Couvrir avec du sable et partir'], correct:1 },
      { id:15, q:'Les lunettes de protection sont obligatoires:', options:['Jamais','Seulement en laboratoire','Dans les zones de poussières et de projections','Uniquement pour les soudeurs'], correct:2 },
      { id:16, q:'La vitesse maximale des véhicules sur le site est:', options:['50 km/h','Libre','20 km/h','40 km/h'], correct:2 },
      { id:17, q:'Un espace confiné nécessite:', options:['Aucune précaution','Un permis d\'entrée et surveillance gaz','Juste une lampe de poche','Un simple masque'], correct:1 },
      { id:18, q:'Les incidents de sécurité doivent être déclarés:', options:['Uniquement si grave','Jamais — mauvaise image','Systématiquement, même les presqu\'accidents','Seulement si témoin'], correct:2 },
      { id:19, q:'Le masque FFP2 protège contre:', options:['Les chocs','La chaleur','Les poussières fines et aérosols','L\'eau'], correct:2 },
      { id:20, q:'La règle des 5S sur site signifie:', options:['5 superviseurs','Sécurité, Surveillance, Santé, Soin, Suivi','Trier, Ranger, Nettoyer, Standardiser, Sustainer','5 équipes de sécurité'], correct:2 },
    ]
  },
  {
    key: 'medical',
    assignRole: 'medical',
    assignLabel: '🩺 Médecin du camp',
    icon: '🏥',
    titre: 'Visite Médicale',
    desc: 'Résultat médical requis: FIT',
    couleur: '#ef4444',
    type: 'medical',
    champs: [
      { key:'temperature', label:'Température (°C)', type:'number', placeholder:'37.0', required:true },
      { key:'tension', label:'Tension artérielle', type:'text', placeholder:'120/80', required:true },
      { key:'alcool', label:'Test alcool', type:'select', options:['Négatif','Positif'], required:true },
      { key:'drogues', label:'Test drogues', type:'select', options:['Négatif','Positif'], required:true },
      { key:'resultat', label:'Résultat médecin', type:'select', options:['FIT — Apte','UNFIT — Inapte','PENDING — En attente'], required:true },
      { key:'medecin', label:'Nom du médecin', type:'text', placeholder:'Dr. ...', required:true },
      { key:'observations', label:'Observations', type:'textarea', placeholder:'Observations médicales...', required:false },
    ]
  },
  {
    key: 'badge',
    icon: '🎫',
    titre: 'Badge & Accès',
    desc: 'Génération du badge QR code d\'accès',
    couleur: '#16a34a',
    type: 'badge',
  },
]

function getAll() { try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}') } catch { return {} } }
function getWF(id) {
  const all = getAll()
  if (!all[id]) {
    all[id] = { etapes:{}, data:{}, tentatives_quiz:0, created: new Date().toISOString() }
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  }
  return all[id]
}
function saveWF(id, wf) {
  const all = getAll()
  all[id] = { ...all[id], ...wf }
  localStorage.setItem(LS_KEY, JSON.stringify(all))
  return all[id]
}

class InductionBoundary extends React.Component {
  constructor(p) { super(p); this.state = {err:null} }
  static getDerivedStateFromError(e) { return {err:e.message||'Erreur'} }
  render() {
    if (this.state.err) return (
      <div style={{padding:40,textAlign:'center'}}>
        <div style={{fontSize:48}}>⚠️</div>
        <div style={{fontWeight:700,color:'#dc2626',marginBottom:8}}>{this.state.err}</div>
        <button onClick={()=>this.setState({err:null})}
          style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'10px 24px',borderRadius:10,cursor:'pointer'}}>
          Réessayer
        </button>
      </div>
    )
    return this.props.children
  }
}

// ─── Composant étape formation ─────────────────────────────────────
function EtapeFormation({ etape, wf, onValider }) {
  const [moduleActif, setModuleActif] = useState(0)
  const [lus, setLus] = useState(wf.data?.modules_lus || [])

  const marquerLu = (id) => {
    if (!lus.includes(id)) {
      const newLus = [...lus, id]
      setLus(newLus)
      saveWF(wf.id, { data: { ...(wf.data||{}), modules_lus: newLus } })
    }
    if (moduleActif < etape.modules.length-1) setModuleActif(moduleActif+1)
  }

  const tousLus = etape.modules.every(m => lus.includes(m.id))
  const mod = etape.modules[moduleActif]

  const exportInductionCSV = (list, dateFrom, dateTo) => {
    const filtered = list.filter(p => {
      if (!dateFrom && !dateTo) return true
      const rec = p.inductionrecord
      if (!rec?.date_debut) return !dateFrom
      const d = new Date(rec.date_debut)
      if (dateFrom && d < new Date(dateFrom)) return false
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
    const headers = ['Matricule','Nom','Prénom','Société','Statut Induction','Date Début','Date Fin','Score Quiz','Badge Émis','Badge Expire']
    const rows = filtered.map(p => {
      const rec = p.inductionrecord
      return [
        p.matricule || '',
        p.nom || '',
        p.prenom || '',
        p.societe || p.entreprise || '',
        rec ? rec.statut : 'non_commencé',
        rec?.date_debut ? new Date(rec.date_debut).toLocaleDateString('fr-FR') : '',
        rec?.date_fin ? new Date(rec.date_fin).toLocaleDateString('fr-FR') : '',
        rec?.quiz_score != null ? rec.quiz_score + '%' : '',
        rec?.badge_emis ? 'OUI' : 'NON',
        rec?.badge_expire || ''
      ]
    })
    const csv = [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inductions_' + new Date().toISOString().slice(0,10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto'}}>
        {etape.modules.map((m,i)=>(
          <button key={m.id} onClick={()=>setModuleActif(i)}
            style={{padding:'6px 14px',borderRadius:99,fontSize:11,fontWeight:700,border:'none',cursor:'pointer',
              background: lus.includes(m.id) ? '#16a34a' : i===moduleActif ? etape.couleur : '#f1f5f9',
              color: lus.includes(m.id)||i===moduleActif ? '#fff' : '#64748b',
              flexShrink:0}}>
            {lus.includes(m.id) ? '✓' : i+1}. {m.titre}
          </button>
        ))}
      </div>

      <div style={{background:'#f8fafc',borderRadius:12,padding:'16px 20px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <h3 style={{fontWeight:700,fontSize:15,color:etape.couleur,margin:0}}>{mod.titre}</h3>
          <span style={{fontSize:11,color:'#94a3b8'}}>⏱️ {mod.duree}</span>
        </div>
        <pre style={{fontFamily:'inherit',fontSize:13,color:'#1e293b',whiteSpace:'pre-wrap',
          lineHeight:1.7,margin:0}}>{mod.contenu}</pre>
      </div>

      <button onClick={()=>marquerLu(mod.id)} disabled={lus.includes(mod.id)}
        style={{width:'100%',padding:12,borderRadius:10,border:'none',cursor:'pointer',fontFamily:'inherit',
          background: lus.includes(mod.id) ? '#f0fdf4' : etape.couleur,
          color: lus.includes(mod.id) ? '#16a34a' : '#fff',
          fontWeight:700,fontSize:13,marginBottom:12}}>
        {lus.includes(mod.id) ? '✅ Module lu et confirmé' : '✓ Marquer comme lu et continuer'}
      </button>

      {tousLus && (
        <button onClick={onValider}
          style={{width:'100%',padding:12,borderRadius:10,border:'none',cursor:'pointer',fontFamily:'inherit',
            background:'#16a34a',color:'#fff',fontWeight:700,fontSize:14}}>
          🎓 Formation complétée — Continuer vers le Quiz
        </button>
      )}
    </div>
  )
}

// ─── Composant Quiz ────────────────────────────────────────────────
// Shuffle déterministe basé sur l'ID du personnel → chaque agent a son propre ordre
function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function EtapeQuiz({ etape, wf, onValider, onEchec }) {
  // Sélection et ordre des questions unique par personnel (seed = id du personnel)
  const personnelSeed = wf.id || 1
  const questionsForPersonnel = React.useMemo(() => {
    const shuffled = seededShuffle(etape.questions, personnelSeed)
    return shuffled.slice(0, 5) // 5 questions tirées parmi les 20
  }, [wf.id])

  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)
  const tentatives = wf.tentatives_quiz || 0

  const submitQuiz = () => {
    let correct = 0
    questionsForPersonnel.forEach(q => {
      if (answers[q.id] === q.correct) correct++
    })
    const s = Math.round(correct / questionsForPersonnel.length * 100)
    setScore(s)
    setSubmitted(true)
    saveWF(wf.id, { tentatives_quiz: tentatives + 1 })
    if (s >= etape.score_min) {
      setTimeout(() => onValider(), 2000)
    }
  }

  if (tentatives >= 3 && !submitted) {
    return (
      <div style={{textAlign:'center',padding:20}}>
        <div style={{fontSize:48,marginBottom:12}}>🚫</div>
        <div style={{fontWeight:700,color:'#dc2626',fontSize:16}}>3 tentatives épuisées</div>
        <div style={{color:'#64748b',marginTop:8}}>Contacter le responsable QHSE pour débloquer</div>
      </div>
    )
  }

  if (submitted && score !== null) {
    return (
      <div style={{textAlign:'center',padding:20}}>
        <div style={{fontSize:64,marginBottom:12}}>{score>=etape.score_min?'🎉':'😔'}</div>
        <div style={{fontFamily:'monospace',fontSize:48,fontWeight:900,
          color:score>=etape.score_min?'#16a34a':'#dc2626'}}>
          {score}%
        </div>
        <div style={{fontWeight:700,fontSize:16,marginTop:8,
          color:score>=etape.score_min?'#16a34a':'#dc2626'}}>
          {score>=etape.score_min ? 'Quiz réussi ! 🎊' : `Score insuffisant (minimum ${etape.score_min}%)`}
        </div>
        {score < etape.score_min && tentatives < 3 && (
          <button onClick={()=>{setSubmitted(false);setAnswers({});setScore(null)}}
            style={{marginTop:16,background:'#f59e0b',color:'#fff',border:'none',
              padding:'10px 24px',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700}}>
            🔄 Réessayer ({3-tentatives-1} tentative(s) restante(s))
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
        <span style={{fontSize:12,color:'#64748b'}}>
          {Object.keys(answers).length}/{questionsForPersonnel.length} réponses
        </span>
        <span style={{fontSize:12,color:'#f59e0b',fontWeight:700}}>
          Tentative {tentatives+1}/3 · Min: {etape.score_min}%
        </span>
      </div>
      {questionsForPersonnel.map((q,qi)=>(
        <div key={q.id} style={{marginBottom:16,background:'#f8fafc',borderRadius:12,padding:'14px 16px'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:'#1e293b'}}>
            {qi+1}. {q.q}
          </div>
          {q.options.map((opt,oi)=>(
            <label key={oi} style={{display:'flex',alignItems:'center',gap:10,
              padding:'8px 12px',borderRadius:8,marginBottom:6,cursor:'pointer',
              background: answers[q.id]===oi ? '#1e3a8a10' : '#fff',
              border: `1.5px solid ${answers[q.id]===oi ? '#1e3a8a' : '#e2e8f0'}`}}>
              <input type="radio" name={`q_${q.id}`} value={oi}
                checked={answers[q.id]===oi}
                onChange={()=>setAnswers(a=>({...a,[q.id]:oi}))}
                style={{accentColor:'#1e3a8a'}}/>
              <span style={{fontSize:13,color:'#1e293b'}}>{opt}</span>
            </label>
          ))}
        </div>
      ))}
      <button onClick={submitQuiz}
        disabled={Object.keys(answers).length < questionsForPersonnel.length}
        style={{width:'100%',padding:13,borderRadius:10,border:'none',cursor:'pointer',
          fontFamily:'inherit',fontWeight:700,fontSize:14,
          background: Object.keys(answers).length < etape.questions.length ? '#94a3b8' : '#f59e0b',
          color:'#fff'}}>
        {Object.keys(answers).length < questionsForPersonnel.length
          ? `Répondre à toutes les questions (${questionsForPersonnel.length-Object.keys(answers).length} restantes)`
          : '📋 Soumettre le Quiz'}
      </button>
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────
function InductionPageInner() {
  const [personnel,   setPersonnel]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState('')
  const [selected,    setSelected]    = useState(null)
  const [etapeActive, setEtapeActive] = useState(null)
  const [wfState,     setWfState]     = useState({})
  const [formData,    setFormData]    = useState({})
  const [docUploads,  setDocUploads]  = useState({})
  const [medData,     setMedData]     = useState({})
  const [savedMsg,    setSavedMsg]    = useState('')
  const [slideTab,    setSlideTab]    = useState('etapes')
  const [isOnline,    setIsOnline]    = useState(navigator.onLine)
  const [syncStatus,  setSyncStatus]  = useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [hideNoInduction, setHideNoInduction] = useState(false)
  const [staffMap,      setStaffMap]      = useState({accueil:[],qhse:[],medical:[]})
  const [statutFilter,setStatutFilter] = useState('')

  // Detecter le statut en ligne/hors-ligne
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      setSyncStatus('Synchronisation...')
      const result = await syncOfflineQueue()
      if (result.synced > 0) {
        setSyncStatus(`${result.synced} element(s) synchronise(s)`)
        load() // Recharger les donnees
      } else {
        setSyncStatus('')
      }
      setTimeout(() => setSyncStatus(''), 3000)
    }
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Charger le personnel par profil pour les assignations
  useEffect(() => {
    const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
    const token = localStorage.getItem('access_token') || ''
    fetch(`${BASE}/api/personnel/?page_size=500`, {headers:{'Authorization':`Bearer ${token}`}})
      .then(r=>r.json()).then(d=>{
        const list = d.results || d || []
        const byProfil = (profils) => {
          const found = list.filter(p => profils.includes(p.profil))
          return found.length > 0 ? found : list
        }
        setStaffMap({
          accueil: byProfil(['accueil', 'admin', 'agent', 'securite']),
          qhse:    byProfil(['hse', 'admin', 'technicien', 'manager']),
          medical: byProfil(['medical', 'admin']),
        })
      }).catch(()=>{})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Charger le personnel
      const r = await personnelAPI.list({page_size:500})
      const list = r.data.results || r.data || []
      setPersonnel(list)
      
      // 2. Charger les donnees d'induction depuis le backend
      let backendRecords = {}
      try {
        const inductionResp = await inductionAPI.list({page_size:500})
        const records = inductionResp.data.results || inductionResp.data || []
        records.forEach(rec => {
          backendRecords[rec.personnel] = {
            id: rec.personnel,
            etapes: rec.etapes_data || {},
            data: {
              form: rec.form_data || {},
              docs: rec.docs_data || {},
              medical: rec.medical_data || {},
            },
            tentatives_quiz: rec.quiz_tentatives || 0,
            quiz_score: rec.quiz_score,
            statut: rec.statut,
            badge_emis: rec.badge_emis,
            fromBackend: true,
          }
        })
      } catch (e) {
        console.warn('Impossible de charger les donnees d\'induction depuis le backend:', e)
      }
      
      // 3. Fusionner avec localStorage (backend prioritaire si plus recent)
      const wf = {}
      list.forEach(p => {
        const localWf = getWF(p.id)
        const backendWf = backendRecords[p.id]
        
        if (backendWf && backendWf.fromBackend) {
          // Utiliser les donnees du backend, mais garder les brouillons locaux
          wf[p.id] = {
            ...backendWf,
            drafts: localWf.drafts || {},
            id: p.id,
          }
          // Mettre a jour localStorage avec les donnees du backend
          saveWF(p.id, wf[p.id])
        } else {
          // Pas de donnees backend, utiliser localStorage
          wf[p.id] = localWf
        }
      })
      setWfState(wf)
      
      // 4. Tenter de synchroniser la file hors-ligne
      if (navigator.onLine) {
        const result = await syncOfflineQueue()
        if (result.synced > 0) {
          setSyncStatus(`${result.synced} element(s) synchronise(s)`)
          setTimeout(() => setSyncStatus(''), 3000)
        }
      }
    } catch (e) {
      console.error('Erreur de chargement:', e)
      setPersonnel([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(()=>{ load() },[load])

  // Charger les brouillons quand on sélectionne un personnel
  useEffect(()=>{
    if (!selected) { setFormData({}); setDocUploads({}); setMedData({}); return }
    const w = getWF(selected.id)
    const drafts = w.drafts || {}
    setFormData(drafts.form || w.etapes?.accueil?.form || {})
    setDocUploads(drafts.docs || {})
    setMedData(drafts.medical || w.etapes?.medical?.medical || {})
  },[selected])

  // Sauvegarde brouillon (sans valider l'étape)
  const saveDraft = (kind, data) => {
    if (!selected) return
    const curr = getWF(selected.id)
    const newWf = { ...curr, drafts: { ...(curr.drafts||{}), [kind]: data } }
    saveWF(selected.id, newWf)
    setWfState(prev => ({...prev, [selected.id]: newWf}))
    setSavedMsg('💾 Brouillon enregistré')
    setTimeout(()=>setSavedMsg(''), 2000)
  }

  // Téléchargement du dossier complet (HTML imprimable → PDF via navigateur)
  const telechargerDossier = (p) => {
    const w = wf(p)
    const dateFr = (d) => d ? new Date(d).toLocaleString('fr-FR') : '—'
    const photo = w.etapes?.accueil?.form?.photo || w.drafts?.form?.photo || ''
    const rows = ETAPES.map((e,i) => {
      const info = w.etapes?.[e.key]
      const statut = info?.done
        ? `<span style="color:#16a34a;font-weight:700">✓ Validé le ${dateFr(info.date)}</span>`
        : `<span style="color:#94a3b8">En attente</span>`
      let details = ''
      if (e.key==='accueil' && info?.form) {
        details = '<table style="width:100%;font-size:12px;margin-top:6px">'
          + Object.entries(info.form).filter(([k])=>k!=='photo')
              .map(([k,v])=>`<tr><td style="color:#64748b;padding:2px 8px 2px 0">${k.replace(/_/g,' ')}</td><td>${String(v||'')}</td></tr>`).join('')
          + '</table>'
      }
      if (e.key==='medical' && info?.medical) {
        details = '<table style="width:100%;font-size:12px;margin-top:6px">'
          + Object.entries(info.medical)
              .map(([k,v])=>`<tr><td style="color:#64748b;padding:2px 8px 2px 0">${k}</td><td>${String(v||'')}</td></tr>`).join('')
          + '</table>'
      }
      if (e.key==='quiz' && info?.score!=null) {
        details = `<div style="font-size:13px;margin-top:4px">Score quiz QHSE : <b>${info.score}%</b></div>`
      }
      if (e.key==='documents' && info?.docs) {
        const docs = Array.isArray(info.docs)?info.docs:Object.keys(info.docs)
        details = `<div style="font-size:12px;margin-top:4px">Documents soumis : ${docs.join(', ')||'—'}</div>`
      }
      if (e.key==='badge' && info?.badge_emis) {
        details = `<div style="font-size:12px;margin-top:4px">Badge émis le ${dateFr(info.badge_emis)}</div>`
      }
      return `<tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;width:30px">${i+1}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top">
          <div style="font-weight:700">${e.icon} ${e.titre}</div>
          <div style="font-size:11px;color:#94a3b8">${e.desc}</div>
          ${details}
        </td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top;text-align:right">${statut}</td>
      </tr>`
    }).join('')
    const prog = progression(p)
    const html = `<!doctype html><html><head><meta charset="utf-8">
      <title>Dossier Induction — ${p.nom} ${p.prenom}</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:800px;margin:30px auto;padding:0 20px}
        h1{margin:0;font-size:22px}
        .header{background:linear-gradient(135deg,#0f2447,#1e3a8a);color:#fff;padding:20px;border-radius:12px;display:flex;gap:20px;align-items:center}
        .header img{width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #fff;background:#fff}
        .meta{font-size:13px;margin-top:18px;background:#f8fafc;padding:12px 16px;border-radius:10px}
        table{width:100%;border-collapse:collapse;margin-top:18px}
        .prog{font-family:monospace;font-size:24px;font-weight:900;color:${prog===100?'#16a34a':'#f59e0b'}}
        @media print { .noprint{display:none} }
      </style></head><body>
      <div class="header">
        ${photo?`<img src="${photo}" alt="photo"/>`:'<div style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:32px">👤</div>'}
        <div style="flex:1">
          <h1>${p.nom||''} ${p.prenom||''}</h1>
          <div style="opacity:.85;font-size:13px;margin-top:4px">${p.societe||'—'} · ${p.type_personnel||''}</div>
          <div style="opacity:.85;font-size:12px;margin-top:2px">Matricule : ${p.matricule||'—'} · Email : ${p.email||'—'}</div>
        </div>
        <div class="prog" style="color:#fff">${prog}%</div>
      </div>
      <div class="meta">
        <b>Dossier d'induction QHSE — Roxgold Sango</b><br/>
        Édité le ${new Date().toLocaleString('fr-FR')}
      </div>
      <table>
        <thead><tr style="background:#f1f5f9">
          <th style="padding:10px;text-align:left">#</th>
          <th style="padding:10px;text-align:left">Étape</th>
          <th style="padding:10px;text-align:right">Statut</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="noprint" style="margin-top:24px;text-align:center">
        <button onclick="window.print()" style="background:#1e3a8a;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px">🖨️ Imprimer / Enregistrer en PDF</button>
      </div>
      <script>setTimeout(()=>window.print(),400)</script>
      </body></html>`
    const blob = new Blob([html], {type:'text/html'})
    const url = URL.createObjectURL(blob)
    const w2 = window.open(url, '_blank')
    if (!w2) {
      // fallback: téléchargement direct
      const a = document.createElement('a')
      a.href = url
      a.download = `dossier_induction_${p.nom}_${p.prenom}.html`
      a.click()
    }
    setTimeout(()=>URL.revokeObjectURL(url), 60000)
  }

  const wf = (p) => wfState[p?.id] || {}
  const getEtapeDone = (pid, key) => !!(wf({id:pid}).etapes?.[key]?.done)

  const etapeDebloquee = (pid, etapeKey) => {
    const idx = ETAPES.findIndex(e=>e.key===etapeKey)
    try {
      if (idx<=0) return true
      const prev = ETAPES[idx-1]
      return getEtapeDone(pid, prev.key)
    } catch(e) { return idx===0 }
  }

  // Réinitialiser une étape (modifier ou supprimer)
  const resetEtape = async (key) => {
    if (!selected) return
    if (!window.confirm(`Réinitialiser l'étape "${ETAPES.find(e=>e.key===key)?.titre}" ? Les données seront effacées.`)) return
    const curr = getWF(selected.id)
    const newEtapes = { ...(curr.etapes||{}) }
    delete newEtapes[key]
    // Si on reset quiz, reset aussi le compteur de tentatives
    const newWf = { ...curr, etapes: newEtapes }
    if (key === 'quiz') newWf.tentatives_quiz = 0
    saveWF(selected.id, newWf)
    setWfState(prev => ({...prev, [selected.id]: newWf}))
    // Sync backend
    try {
      await inductionAPI.updateEtape({ personnel_id: selected.id, etape: key, done: false, data: {} })
    } catch(e) { console.warn('Backend sync failed:', e) }
    setSavedMsg('🔄 Étape réinitialisée')
    setTimeout(()=>setSavedMsg(''), 2000)
  }

  const validerEtape = async (key, extraData={}) => {
    if (!selected) return
    const curr = getWF(selected.id)
    const newWf = {
      ...curr,
      etapes: {
        ...(curr.etapes||{}),
        [key]: { done:true, date:new Date().toISOString(), ...extraData }
      }
    }
    saveWF(selected.id, newWf)
    setWfState(prev => ({...prev, [selected.id]: newWf}))
    
    // Preparer les donnees pour le backend
    const fieldMap = {accueil:'form_data', documents:'docs_data', medical:'medical_data', quiz:'quiz_score'}
    const backendData = {
      personnel_id: selected.id,
      etape: key,
      done: true,
      data: extraData,
      field: fieldMap[key] || null,
    }
    
    // Sauvegarder sur le backend (ou mettre en file d'attente si hors-ligne)
    setSavedMsg('Synchronisation...')
    
    console.log('[v0] Tentative sync backend:', { isOnline: navigator.onLine, backendData })
    
    if (navigator.onLine) {
      try {
        const response = await inductionAPI.updateEtape(backendData)
        console.log('[v0] Backend response:', response.data)
        setSavedMsg('Etape validee et enregistree dans la base de donnees !')
      } catch(e) {
        // Echec de la sync backend -> ajouter a la file hors-ligne
        console.error('[v0] Backend sync error:', e?.response?.status, e?.response?.data || e.message)
        addToOfflineQueue({ type: 'update_etape', data: backendData })
        setSavedMsg(`Erreur backend: ${e?.response?.data?.error || e.message} - Sauvegarde locale`)
      }
    } else {
      // Mode hors-ligne -> ajouter a la file d'attente
      addToOfflineQueue({ type: 'update_etape', data: backendData })
      setSavedMsg('Mode hors-ligne: sauvegarde locale (synchronisation automatique au retour en ligne)')
    }
    setTimeout(()=>setSavedMsg(''), 4000)

    // Vérifier si tout est terminé
    const allDone = ETAPES.every(e => e.key==='badge' || newWf.etapes?.[e.key]?.done)
    if (allDone) setEtapeActive('celebration')
    else {
      const nextIdx = ETAPES.findIndex(e=>e.key===key)+1
      if (nextIdx < ETAPES.length) {
        setTimeout(()=>setEtapeActive(ETAPES[nextIdx].key), 500)
      }
    }
  }

  const progression = (p) => {
    const w = wf(p)
    const done = ETAPES.filter(e=>w.etapes?.[e.key]?.done).length
    return Math.round(done/ETAPES.length*100)
  }

  const filtered = personnel.filter(p => {
    if (hideNoInduction && p.induction_requise === false) return false
    if (statutFilter) {
      const rec = p.inductionrecord
      if (statutFilter === 'non_commence') {
        if (rec) return false
      } else if (statutFilter === 'valide') {
        if (rec?.statut !== 'valide' && progression(p) !== 100) return false
      } else {
        if (!rec || rec.statut !== statutFilter) return false
      }
    }
    const q = search.toLowerCase()
    if (q && ![p.nom,p.prenom,p.societe].some(v=>(v||'').toLowerCase().includes(q))) return false
    if (typeFilter && p.type_personnel !== typeFilter) return false
    if (dateFrom || dateTo) {
      const rec = p.inductionrecord
      const d = rec?.date_debut ? new Date(rec.date_debut) : null
      if (dateFrom && (!d || d < new Date(dateFrom))) return false
      if (dateTo && (!d || d > new Date(dateTo + 'T23:59:59'))) return false
    }
    return true
  })

  const TYPES = [{v:'roxgold',l:'Roxgold'},{v:'sous_traitant',l:'Sous-traitant'},{v:'visiteur',l:'Visiteur'}]
  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'9px 12px',
    fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}

  return (
    <InductionBoundary>
    <div style={{padding:20}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
        borderRadius:16,padding:'18px 24px',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:900,margin:0}}>Induction QHSE - Roxgold Sango</h1>
            <p style={{fontSize:12,color:'rgba(255,255,255,.7)',margin:'4px 0 0'}}>
              Workflow sequentiel en 6 etapes - Chaque etape debloque la suivante
            </p>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
            <div style={{
              display:'flex',alignItems:'center',gap:6,
              background: isOnline ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.2)',
              padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:600
            }}>
              <span style={{
                width:8,height:8,borderRadius:'50%',
                background: isOnline ? '#16a34a' : '#ef4444'
              }}/>
              {isOnline ? 'En ligne' : 'Hors-ligne'}
            </div>
            {syncStatus && (
              <div style={{fontSize:10,color:'rgba(255,255,255,0.8)',textAlign:'right'}}>
                {syncStatus}
              </div>
            )}
            {getOfflineQueue().length > 0 && (
              <div style={{fontSize:10,color:'#f59e0b',textAlign:'right'}}>
                {getOfflineQueue().length} element(s) en attente de sync
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs Induction */}
      {!loading && (() => {
        const total = personnel.length
        const induits = personnel.filter(p => {
          if (p.inductionrecord?.statut==='valide') return true
          return progression(p) === 100
        }).length
        const enCours = personnel.filter(p => {
          const pr = progression(p)
          return pr > 0 && pr < 100 && p.inductionrecord?.statut !== 'valide'
        }).length
        const aDemarrer = total - induits - enCours
        return (
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
            {[
              {l:'Total',v:total,c:'#1e3a8a',bg:'#eff6ff',i:'👥'},
              {l:'Induits',v:induits,c:'#16a34a',bg:'#f0fdf4',i:'✅'},
              {l:'En cours',v:enCours,c:'#d97706',bg:'#fffbeb',i:'⚙️'},
              {l:'À démarrer',v:aDemarrer,c:'#dc2626',bg:'#fef2f2',i:'⏳'},
            ].map(k=>(
              <div key={k.l} style={{background:k.bg,borderRadius:12,padding:'10px 16px',
                display:'flex',alignItems:'center',gap:8,flex:1,minWidth:110,
                boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
                <span style={{fontSize:20}}>{k.i}</span>
                <div>
                  <div style={{fontSize:22,fontWeight:900,color:k.c,lineHeight:1}}>{k.v}</div>
                  <div style={{fontSize:10,color:'#64748b',fontWeight:600}}>{k.l}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Filtres */}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher personnel..."
          style={{...inp,maxWidth:260}}/>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{...inp,maxWidth:160}}>
          <option value="">Tous les types</option>
          {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <select value={statutFilter} onChange={e=>setStatutFilter(e.target.value)} style={{...inp,maxWidth:180}}>
          <option value="">Tous les statuts</option>
          <option value="non_commence">Sans induction</option>
          <option value="en_cours">En cours</option>
          <option value="valide">Validé ✅</option>
          <option value="refuse">Refusé</option>
          <option value="expire">Expiré</option>
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          style={{...inp,maxWidth:140}} title="Date début (de)"/>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          style={{...inp,maxWidth:140}} title="Date début (à)"/>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#64748b',cursor:'pointer',userSelect:'none'}}>
          <input type="checkbox" checked={hideNoInduction} onChange={e=>setHideNoInduction(e.target.checked)}/>
          Masquer "pas d'induction"
        </label>
        <button onClick={()=>exportInductionCSV(personnel,dateFrom,dateTo)}
          style={{background:'#16a34a',color:'#fff',border:'none',padding:'8px 14px',
            borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit'}}>
          📥 Export CSV
        </button>
      </div>

      {loading ? <div style={{textAlign:'center',padding:60,fontSize:32}}>⏳</div> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(p => {
            const prog = progression(p)
            const w = wf(p)
            return (
              <div key={p.id} onClick={()=>{setSelected(p);setEtapeActive(null);setSlideTab('etapes')}}
                style={{background:'#fff',borderRadius:12,padding:'14px 16px',
                  boxShadow:'0 1px 4px rgba(0,0,0,.07)',cursor:'pointer',
                  borderLeft:`4px solid ${prog===100?'#16a34a':prog>0?'#f59e0b':'#e2e8f0'}`,
                  outline: selected?.id===p.id ? '2px solid #1e3a8a' : 'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}>{p.nom} {p.prenom}</div>
                    <div style={{fontSize:11,color:'#64748b'}}>
                      {TYPES.find(t=>t.v===p.type_personnel)?.l} · {p.societe||'—'}
                    </div>
                    {(() => {
                      const wfData = wf(p)
                      const fd = wfData?.formData || {}
                      const assigns = [
                        fd.agent_accueil && {icon:'👋',label:'Accueil',val:fd.agent_accueil},
                        fd.formateur_qhse && {icon:'🛡️',label:'QHSE',val:fd.formateur_qhse},
                        fd.medecin_camp && {icon:'🩺',label:'Médecin',val:fd.medecin_camp},
                      ].filter(Boolean)
                      if (!assigns.length) return null
                      return (
                        <div style={{marginTop:4,display:'flex',flexWrap:'wrap',gap:4}}>
                          {assigns.map(a=>(
                            <span key={a.icon} style={{fontSize:10,background:'#eff6ff',color:'#1e3a8a',
                              padding:'2px 6px',borderRadius:99,fontWeight:600}}>
                              {a.icon} {a.val.split('·')[0].trim()}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontFamily:'monospace',fontSize:18,fontWeight:900,
                      color:prog===100?'#16a34a':prog>0?'#f59e0b':'#94a3b8'}}>
                      {prog}%
                    </div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>
                      {prog===100?'Induit ✅':prog>0?'En cours':'À démarrer'}
                    </div>
                  </div>
                  <button onClick={(ev)=>{ev.stopPropagation();telechargerDossier(p)}}
                    title="Télécharger le dossier complet"
                    style={{background:'#f8fafc',border:'1px solid #e2e8f0',
                      borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:14,
                      color:'#1e3a8a',fontWeight:700}}>
                    📥
                  </button>
                  <button onClick={async(ev)=>{
                    ev.stopPropagation()
                    if(!window.confirm(`Supprimer tout le parcours d'induction de ${p.nom} ${p.prenom} ?`)) return
                    try {
                      const recId = p.inductionrecord?.id || p.induction_record_id
                        const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
                        const token = localStorage.getItem('access_token') || ''
                    if(recId) {
                        const resp = await fetch(`${BASE}/api/induction-records/${recId}/`, {
                          method:'DELETE', headers:{'Authorization':`Bearer ${token}`}
                        })
                        if(!resp.ok && resp.status !== 404) {
                          const err = await resp.text()
                          throw new Error(`HTTP ${resp.status}: ${err.slice(0,100)}`)
                        }
                      }
                      // Nettoyer toutes les clés localStorage de cet agent
                      Object.keys(localStorage).filter(k=>k.includes(`_${p.id}`)||k.includes(`${p.id}_`)).forEach(k=>localStorage.removeItem(k))
                      localStorage.removeItem(`rzi_induction_v3_${p.id}`)
                      alert(`✅ Parcours de ${p.nom} ${p.prenom} supprimé`)
                      load()
                    } catch(e) { alert('Erreur: '+e.message) }
                  }} title="Supprimer le parcours d'induction"
                  style={{background:'#fef2f2',border:'1px solid #fecaca',
                    borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:14,color:'#dc2626'}}>
                    🗑️
                  </button>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4,marginTop:8}}>
                  {/* Résumé assignations */}
              {(() => {
                const assigns = [
                  {icon:'👋',label:"Agent d'accueil", val:formData['assign_accueil']||formData['assign_documents']||''},
                  {icon:'🛡️',label:'Formateur QHSE',   val:formData['assign_formation']||formData['assign_quiz']||''},
                  {icon:'🩺',label:'Médecin',            val:formData['assign_medical']||''},
                ].filter(a=>a.val)
                if (!assigns.length) return null
                return (
                  <div style={{padding:'8px 12px',marginBottom:8,background:'#f0f9ff',borderRadius:10,
                    display:'flex',flexWrap:'wrap',gap:6}}>
                    {assigns.map(a=>(
                      <span key={a.icon} style={{fontSize:11,background:'#fff',border:'1px solid #bae6fd',
                        color:'#0369a1',padding:'3px 10px',borderRadius:99,fontWeight:600}}>
                        {a.icon} {a.label}: <b>{a.val.split('·')[0].trim()}</b>
                      </span>
                    ))}
                  </div>
                )
              })()}
              {ETAPES.map(e => (
                    <div key={e.key}
                      title={e.titre}
                      style={{flex:1,height:6,borderRadius:99,
                        background: w.etapes?.[e.key]?.done ? e.couleur : '#e2e8f0',
                        transition:'background .3s'}}/>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ PANEL WORKFLOW INDIVIDUEL ══ */}
      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
          display:'flex',alignItems:'center',justifyContent:'flex-end',zIndex:1000}}
          onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div style={{background:'#fff',width:'100%',maxWidth:560,height:'100%',
            overflow:'auto',boxShadow:'-4px 0 30px rgba(0,0,0,.2)'}}>

            {/* Célébration finale */}
            {etapeActive==='celebration' ? (
              <div style={{padding:40,textAlign:'center',background:'linear-gradient(135deg,#16a34a,#15803d)',
                minHeight:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <div style={{fontSize:80,marginBottom:20}}>🎉</div>
                <div style={{color:'#fff',fontSize:28,fontWeight:900,marginBottom:12}}>
                  Bienvenue au Camp Minier<br/>de ROXGOLD Sango !
                </div>
                <div style={{color:'rgba(255,255,255,.9)',fontSize:16,marginBottom:30}}>
                  {selected.prenom} {selected.nom}<br/>
                  Induction QHSE complétée avec succès
                </div>
                <div style={{background:'rgba(255,255,255,.2)',borderRadius:16,padding:'20px 30px',
                  color:'#fff',fontSize:13,textAlign:'left',maxWidth:360}}>
                  <div style={{fontWeight:700,marginBottom:8}}>🎫 Badge d\'accès activé</div>
                  <div>Date: {new Date().toLocaleDateString('fr-FR')}</div>
                  <div>Valide 12 mois — Présentez votre QR à chaque accès</div>
                </div>
                <button onClick={()=>{setSelected(null);setEtapeActive(null)}}
                  style={{marginTop:24,background:'#fff',color:'#16a34a',border:'none',
                    padding:'12px 30px',borderRadius:12,cursor:'pointer',fontSize:15,fontWeight:700}}>
                  Fermer
                </button>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',
                  color:'#fff',padding:'16px 20px',position:'sticky',top:0,zIndex:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:16}}>{selected.nom} {selected.prenom}</div>
                      <div style={{fontSize:11,opacity:.8}}>{selected.societe}</div>
                    </div>
                    <button onClick={()=>setSelected(null)}
                      style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                        width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18}}>✕</button>
                  </div>
                  {savedMsg && (
                    <div style={{marginTop:8,background:'#16a34a',borderRadius:8,
                      padding:'4px 12px',fontSize:12,fontWeight:700}}>
                      {savedMsg}
                    </div>
                  )}
                  {/* ─ Barre workflow progression ─ */}
                  <div style={{marginTop:10,display:'flex',alignItems:'center',gap:0}}>
                    {ETAPES.map((etapeItem,i) => {
                      const w2 = (selected && wf(selected)) || {}
                      const isDone    = !!(w2.etapes?.[etapeItem.key]?.done)
                      const isCurrent = !isDone && selected && etapeDebloquee(selected.id, etapeItem.key)
                      return (
                        <React.Fragment key={etapeItem.key}>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:50}}>
                            <div style={{width:26,height:26,borderRadius:'50%',
                              background: isDone?'rgba(255,255,255,.95)':isCurrent?'rgba(255,255,255,.5)':'rgba(255,255,255,.15)',
                              color: isDone?'#16a34a':isCurrent?'#fff':'rgba(255,255,255,.3)',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:12,fontWeight:700,
                              border: isCurrent?'2px solid rgba(255,255,255,.6)':'none'}}>
                              {isDone?'✓':isCurrent?etapeItem.icon:i+1}
                            </div>
                            <div style={{fontSize:7,color:'rgba(255,255,255,.5)',marginTop:2}}>
                              {etapeItem.titre.split(' ')[0]}
                            </div>
                          </div>
                          {i<ETAPES.length-1&&(
                            <div style={{flex:1,height:2,minWidth:6,marginBottom:16,
                              background:isDone?'rgba(255,255,255,.6)':'rgba(255,255,255,.2)'}}/>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </div>
                </div>

                {/* Navigation tabs du slide-over */}
                {!etapeActive && (
                  <div style={{borderBottom:'1px solid #e2e8f0',display:'flex'}}>
                    {['etapes','parcours'].map(t=>(
                      <button key={t} onClick={()=>setSlideTab(t)}
                        style={{flex:1,padding:'12px 8px',border:'none',cursor:'pointer',
                          fontFamily:'inherit',fontSize:12,fontWeight:700,
                          background:slideTab===t?'#fff':'#f8fafc',
                          color:slideTab===t?'#1e3a8a':'#94a3b8',
                          borderBottom:slideTab===t?'2px solid #1e3a8a':'none'}}>
                        {t==='etapes'?'📋 Étapes':'📖 Parcours'}
                      </button>
                    ))}
                  </div>
                )}

                {!etapeActive && slideTab==='etapes' && (
                  <div style={{padding:20}}>
                    {/* ── Section Assignations ── */}
                    <div style={{background:'#f8fafc',borderRadius:12,padding:16,marginBottom:20,border:'1px solid #e2e8f0'}}>
                      <div style={{fontWeight:700,fontSize:13,color:'#1e3a8a',marginBottom:12}}>
                        👥 Assignations du parcours
                      </div>
                      {[
                        {key:'agent_accueil', label:"👋 Agent d'accueil", icon:'👋', profil:'accueil'},
                        {key:'formateur_qhse', label:'🛡️ Formateur QHSE', icon:'🛡️', profil:'qhse'},
                        {key:'medecin_camp', label:'🩺 Médecin du camp', icon:'🩺', profil:'medical'},
                      ].map(field => {
                        const currentVal = getWF(selected.id)?.formData?.[field.key] || ''
                        return (
                          <div key={field.key} style={{marginBottom:10}}>
                            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>
                              {field.label}
                            </label>
                            <select
                              value={currentVal}
                              onChange={e => {
                                const val = e.target.value
                                const wfData = getWF(selected.id) || {etapes:{},formData:{}}
                                const updated = {...wfData, formData:{...wfData.formData, [field.key]: val}}
                                saveWF(selected.id, updated)
                              }}
                              style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,
                                padding:'8px 10px',fontSize:12,outline:'none',background:'#fff'}}>
                              <option value="">-- Sélectionner --</option>
                              {(staffMap[field.profil]||[]).map(p => (
                                <option key={p.id} value={`${p.nom} ${p.prenom}`}>
                                  {p.nom} {p.prenom} {p.numero?`· ${p.numero}`:''}
                                </option>
                              ))}
                            </select>
                            {currentVal && (
                              <div style={{fontSize:11,color:'#16a34a',marginTop:3,fontWeight:600}}>
                                ✓ {currentVal}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <h3 style={{fontSize:14,fontWeight:700,color:'#1e3a8a',marginBottom:16}}>
                      Sélectionner une étape
                    </h3>
                    {ETAPES.map((e,i) => {
                      const done = getEtapeDone(selected.id, e.key)
                      const debloque = etapeDebloquee(selected.id, e.key)
                      return (
                        <div key={e.key}
                          onClick={()=>debloque&&setEtapeActive(e.key)}
                          style={{
                            background: done?'#f0fdf4':debloque?'#f8fafc':'#fafafa',
                            border: `1.5px solid ${done?'#86efac':debloque?e.couleur+'40':'#e2e8f0'}`,
                            borderRadius:12,padding:'14px 16px',marginBottom:8,
                            cursor:debloque?'pointer':'not-allowed',
                            opacity:debloque?1:0.5,
                            display:'flex',alignItems:'center',gap:12}}>
                          <div style={{width:40,height:40,borderRadius:'50%',
                            background:done?'#16a34a':debloque?e.couleur:'#94a3b8',
                            color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:18,flexShrink:0}}>
                            {done?'✓':e.icon}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:13,
                              color:done?'#16a34a':debloque?'#1e293b':'#94a3b8'}}>
                              {i+1}. {e.titre}
                            </div>
                            <div style={{fontSize:11,color:'#94a3b8',marginTop:1}}>
                              {done?'✅ Complété':debloque?e.desc:'🔒 Compléter l\'étape précédente'}
                            </div>
                          </div>
                          {done && (
                            <div style={{display:'flex',gap:4}} onClick={ev=>ev.stopPropagation()}>
                              <button onClick={ev=>{ev.stopPropagation();setEtapeActive(e.key)}}
                                title="Modifier cette étape"
                                style={{background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',
                                  padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>
                                ✏️
                              </button>
                              <button onClick={ev=>{ev.stopPropagation();resetEtape(e.key)}}
                                title="Réinitialiser cette étape"
                                style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',
                                  padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>
                                🗑️
                              </button>
                            </div>
                          )}
                          {debloque && !done && (
                            <div style={{color:e.couleur,fontSize:18}}>→</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ─ Onglet Parcours ─ */}
                {!etapeActive && slideTab==='parcours' && (
                  <div style={{padding:16}}>
                    <h3 style={{fontSize:13,fontWeight:700,color:'#1e3a8a',marginBottom:14}}>
                      📖 Parcours d'induction — {selected.nom} {selected.prenom}
                    </h3>
                    {(() => {
                      const w = wf(selected)
                      const completedEtapes = ETAPES.filter(e=>w.etapes?.[e.key]?.done)
                      if (completedEtapes.length===0) return (
                        <div style={{textAlign:'center',padding:30,color:'#94a3b8'}}>
                          <div style={{fontSize:32,marginBottom:8}}>📋</div>
                          <div>Aucune étape validée pour le moment</div>
                          <div style={{fontSize:11,marginTop:4}}>Commencer par l'étape 1</div>
                        </div>
                      )
                      return (
                        <div>
                          {ETAPES.map((e,i) => {
                            const info = w.etapes?.[e.key]
                            if (!info?.done) return null
                            return (
                              <div key={e.key} style={{marginBottom:12,
                                background:'#f0fdf4',border:'1.5px solid #86efac',
                                borderRadius:12,overflow:'hidden'}}>
                                {/* Header de l'étape */}
                                <div style={{background:e.couleur,color:'#fff',
                                  padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
                                  <span style={{fontSize:20}}>{e.icon}</span>
                                  <div style={{flex:1}}>
                                    <div style={{fontWeight:700,fontSize:13}}>{i+1}. {e.titre}</div>
                                    <div style={{fontSize:10,opacity:.8}}>
                                      ✅ Validé le {new Date(info.date).toLocaleDateString('fr-FR')} à {new Date(info.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                                    </div>
                                  </div>
                                  <div style={{display:'flex',gap:4}}>
                                    <button onClick={ev=>{ev.stopPropagation();setEtapeActive(e.key)}}
                                      title="Modifier cette étape"
                                      style={{background:'rgba(255,255,255,0.25)',color:'#fff',border:'none',
                                        padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>
                                      ✏️ Modifier
                                    </button>
                                    <button onClick={ev=>{ev.stopPropagation();resetEtape(e.key)}}
                                      title="Supprimer / réinitialiser cette étape"
                                      style={{background:'rgba(220,38,38,0.7)',color:'#fff',border:'none',
                                        padding:'4px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                                {/* Données saisies */}
                                <div style={{padding:'10px 14px'}}>
                                  {/* Accueil */}
                                  {e.key==='accueil' && info.form && (
                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                                      {Object.entries(info.form||{}).filter(([k])=>k!=='photo').map(([k,v])=>(
                                        <div key={k} style={{fontSize:11}}>
                                          <span style={{color:'#94a3b8',fontWeight:600}}>{k.replace(/_/g,' ')}: </span>
                                          <span style={{color:'#1e293b'}}>{v}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Documents */}
                                  {e.key==='documents' && info.docs && (
                                    <div style={{fontSize:12,color:'#16a34a'}}>
                                      ✅ Documents soumis: {Array.isArray(info.docs)?info.docs.join(', '):JSON.stringify(info.docs)}
                                    </div>
                                  )}
                                  {/* Quiz */}
                                  {e.key==='quiz' && (
                                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                                      <div style={{fontFamily:'monospace',fontSize:24,fontWeight:900,
                                        color:'#16a34a'}}>{info.score||'—'}%</div>
                                      <div style={{fontSize:12,color:'#64748b'}}>Score quiz QHSE</div>
                                    </div>
                                  )}
                                  {/* Médical */}
                                  {e.key==='medical' && info.medical && (
                                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                                      {Object.entries(info.medical||{}).map(([k,v])=>(
                                        <div key={k} style={{fontSize:11}}>
                                          <span style={{color:'#94a3b8',fontWeight:600}}>{k}: </span>
                                          <span style={{color:v==='Positif'?'#dc2626':'#1e293b',fontWeight:v==='Positif'?700:400}}>{v}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Badge */}
                                  {e.key==='badge' && (
                                    <div style={{fontSize:12,color:'#16a34a',fontWeight:600}}>
                                      🎫 Badge émis — Accès site autorisé
                                    </div>
                                  )}
                                  {/* Formation */}
                                  {e.key==='formation' && (
                                    <div style={{fontSize:12,color:'#0891b2'}}>✅ 3 modules de formation QHSE complétés</div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {/* Rapport export */}
                          <button onClick={()=>{
                            const w2 = wf(selected)
                            const lignes = ETAPES.map((e,i)=>{
                              const info = w2.etapes?.[e.key]
                              return `${i+1}. ${e.titre}: ${info?.done?'✅ Validé le '+new Date(info.date).toLocaleDateString('fr-FR'):'⏳ En attente'}`
                            })
                            const txt = `PARCOURS INDUCTION QHSE\n${selected.nom} ${selected.prenom}\n${'='.repeat(40)}\n${lignes.join('\n')}`
                            navigator.clipboard.writeText(txt).then(()=>alert('Parcours copié dans le presse-papier !'))
                          }}
                            style={{width:'100%',padding:10,borderRadius:9,border:'1px solid #e2e8f0',
                              background:'#f8fafc',color:'#1e3a8a',cursor:'pointer',fontFamily:'inherit',
                              fontSize:12,fontWeight:700,marginTop:8}}>
                            📋 Copier le rapport
                          </button>
                          <button onClick={()=>telechargerDossier(selected)}
                            style={{width:'100%',padding:12,borderRadius:9,border:'none',
                              background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
                              cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,marginTop:8}}>
                            📥 Télécharger le dossier complet (PDF)
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Contenu de l'étape active */}
                {etapeActive && etapeActive!=='celebration' && (() => {
                  const etape = ETAPES.find(e=>e.key===etapeActive)
                  if (!etape) return null
                  return (
                    <div style={{padding:20}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                        <button onClick={()=>setEtapeActive(null)}
                          style={{background:'#f8fafc',border:'1px solid #e2e8f0',
                            padding:'5px 10px',borderRadius:8,cursor:'pointer',fontSize:12}}>
                          ← Retour
                        </button>
                        <div>
                          <div style={{fontWeight:700,fontSize:15,color:etape.couleur}}>
                            {etape.icon} {etape.titre}
                          </div>
                          <div style={{fontSize:11,color:'#94a3b8'}}>{etape.desc}</div>
                          {etape.assignRole && formData[`assign_${etape.key}`] && (
                            <div style={{fontSize:11,background:'#eff6ff',color:'#1e3a8a',
                              padding:'3px 10px',borderRadius:99,marginTop:4,display:'inline-flex',alignItems:'center',gap:4}}>
                              👤 <b>{formData[`assign_${etape.key}`]}</b>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* FORM */}
                      {etape.type==='form' && (
                        <div>
                          {/* Sélecteur d'assignation pour cette étape */}
                          {etape.assignRole && (
                            <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',
                              borderRadius:10,padding:'10px 14px',marginBottom:16}}>
                              <div style={{fontSize:11,fontWeight:700,color:'#0369a1',marginBottom:6}}>
                                {etape.assignLabel}
                              </div>
                              <select
                                value={formData[`assign_${etape.key}`]||''}
                                onChange={e=>setFormData(f=>({...f,[`assign_${etape.key}`]:e.target.value}))}
                                style={{width:'100%',border:'1.5px solid #bae6fd',borderRadius:8,
                                  padding:'8px 12px',fontSize:13,outline:'none',background:'#fff'}}>
                                <option value="">-- Sélectionner --</option>
                                {(staffMap[etape.assignRole]||[]).map(p=>(
                                  <option key={p.id} value={`${p.nom} ${p.prenom}`}>
                                    {p.nom} {p.prenom} {p.numero?`· ${p.numero}`:''}
                                  </option>
                                ))}
                              </select>
                              {formData[`assign_${etape.key}`] && (
                                <div style={{fontSize:11,color:'#0369a1',marginTop:4}}>
                                  ✅ Assigné: <b>{formData[`assign_${etape.key}`]}</b>
                                </div>
                              )}
                            </div>
                          )}
                          {etape.champs.map(c=>(
                            <div key={c.key} style={{marginBottom:12}}>
                              <label style={{display:'block',fontSize:11,fontWeight:700,
                                color:'#64748b',marginBottom:4}}>
                                {c.label}{c.required&&' *'}
                              </label>
                              {c.type==='photo' ? (
                                <label style={{display:'flex',alignItems:'center',gap:8,
                                  padding:'10px 14px',background:formData[c.key]?'#f0fdf4':'#f8fafc',
                                  border:`2px dashed ${formData[c.key]?'#16a34a':'#e2e8f0'}`,
                                  borderRadius:10,cursor:'pointer',fontSize:12,
                                  color:formData[c.key]?'#16a34a':'#64748b'}}>
                                  <input type="file" accept="image/*" style={{display:'none'}}
                                    onChange={e=>{
                                      const file=e.target.files?.[0]
                                      if(!file) return
                                      const r=new FileReader()
                                      r.onload=ev=>setFormData(f=>({...f,[c.key]:ev.target.result}))
                                      r.readAsDataURL(file)
                                    }}/>
                                  {formData[c.key]?'✅ Photo chargée':'📷 Charger une photo'}
                                </label>
                              ) : c.type==='select_staff' ? (
                                <select value={formData[c.key]||''} style={inp}
                                  onChange={e=>setFormData(f=>({...f,[c.key]:e.target.value}))}>
                                  <option value="">-- Sélectionner --</option>
                                  {(staffMap[c.profil]||[]).map(p=>(
                                    <option key={p.id} value={`${p.nom} ${p.prenom} · ${p.numero||p.email||''}`}>
                                      {p.nom} {p.prenom} {p.numero?`· ${p.numero}`:''}
                                    </option>
                                  ))}
                                  {(staffMap[c.profil]||[]).length===0 && (
                                    <option disabled>Aucun personnel disponible</option>
                                  )}
                                </select>
                              ) : (
                                <input type={c.type} value={formData[c.key]||''}
                                  onChange={e=>setFormData(f=>({...f,[c.key]:e.target.value}))}
                                  placeholder={c.placeholder} style={inp}/>
                              )}
                            </div>
                          ))}
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>saveDraft('form', formData)}
                              style={{flex:1,padding:12,borderRadius:10,border:'1.5px solid '+etape.couleur,
                                background:'#fff',color:etape.couleur,fontWeight:700,
                                fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                              💾 Enregistrer
                            </button>
                            <button onClick={()=>{
                              const missing = etape.champs.filter(c=>c.required&&!formData[c.key])
                              if(missing.length) { alert('Champs requis: '+missing.map(c=>c.label).join(', ')); return }
                              validerEtape(etape.key, {form:formData})
                            }}
                              style={{flex:2,padding:12,borderRadius:10,border:'none',
                                background:etape.couleur,color:'#fff',fontWeight:700,
                                fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                              ✅ Valider et continuer
                            </button>
                          </div>
                        </div>
                      )}

                      {/* DOCUMENTS */}
                      {etape.type==='documents' && (
                        <div>
                          {etape.docs.map(d=>(
                            <div key={d.key} style={{marginBottom:12,background:'#f8fafc',
                              borderRadius:12,padding:'12px 14px',
                              border:`1.5px solid ${docUploads[d.key]?'#86efac':'#e2e8f0'}`}}>
                              <div style={{display:'flex',alignItems:'center',gap:10}}>
                                <div style={{flex:1}}>
                                  <div style={{fontWeight:600,fontSize:13}}>
                                    {d.label}
                                    {d.required&&<span style={{color:'#dc2626'}}> *</span>}
                                  </div>
                                  {docUploads[d.key] && (
                                    <div style={{fontSize:11,color:'#16a34a',marginTop:2}}>
                                      ✅ {docUploads[d.key]}
                                    </div>
                                  )}
                                </div>
                                <label style={{background:docUploads[d.key]?'#f0fdf4':'#1e3a8a',
                                  color:docUploads[d.key]?'#16a34a':'#fff',border:'none',
                                  padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700}}>
                                  <input type="file" style={{display:'none'}}
                                    onChange={e=>{
                                      const file=e.target.files?.[0]
                                      if(file) setDocUploads(prev=>({...prev,[d.key]:file.name}))
                                    }}/>
                                  {docUploads[d.key]?'✓ Chargé':'📎 Charger'}
                                </label>
                              </div>
                            </div>
                          ))}
                          <div style={{display:'flex',gap:8,marginTop:8}}>
                            <button onClick={()=>saveDraft('docs', docUploads)}
                              style={{flex:1,padding:12,borderRadius:10,border:'1.5px solid '+etape.couleur,
                                background:'#fff',color:etape.couleur,fontWeight:700,
                                fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                              💾 Enregistrer
                            </button>
                            <button onClick={()=>{
                              const manquants = etape.docs.filter(d=>d.required&&!docUploads[d.key])
                              if(manquants.length){alert('Documents requis: '+manquants.map(d=>d.label).join(', '));return}
                              validerEtape(etape.key, {docs:Object.keys(docUploads)})
                            }}
                              style={{flex:2,padding:12,borderRadius:10,border:'none',
                                background:etape.couleur,color:'#fff',fontWeight:700,
                                fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                              📄 Documents soumis — Continuer
                            </button>
                          </div>
                        </div>
                      )}

                      {/* FORMATION */}
                      {etape.type==='formation' && (
                        <EtapeFormation etape={etape}
                          wf={{id:selected.id,...(wfState[selected.id]||{})}}
                          onValider={()=>validerEtape(etape.key)}/>
                      )}

                      {/* QUIZ */}
                      {etape.type==='quiz' && (
                        <EtapeQuiz etape={etape}
                          wf={{id:selected.id,...(wfState[selected.id]||{})}}
                          onValider={()=>validerEtape(etape.key,{score:80})}
                          onEchec={()=>{}}/>
                      )}

                      {/* MÉDICAL */}
                      {etape.type==='medical' && (
                        <div>
                          {etape.champs.map(c=>(
                            <div key={c.key} style={{marginBottom:12}}>
                              <label style={{display:'block',fontSize:11,fontWeight:700,
                                color:'#64748b',marginBottom:4}}>
                                {c.label}{c.required&&' *'}
                              </label>
                              {c.type==='select' ? (
                                <select value={medData[c.key]||''} onChange={e=>setMedData(m=>({...m,[c.key]:e.target.value}))} style={inp}>
                                  <option value="">Sélectionner...</option>
                                  {c.options.map(o=><option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : c.type==='textarea' ? (
                                <textarea value={medData[c.key]||''} onChange={e=>setMedData(m=>({...m,[c.key]:e.target.value}))}
                                  placeholder={c.placeholder} rows={3} style={{...inp,resize:'vertical'}}/>
                              ) : (
                                <input type={c.type} value={medData[c.key]||''} onChange={e=>setMedData(m=>({...m,[c.key]:e.target.value}))}
                                  placeholder={c.placeholder} style={inp}/>
                              )}
                            </div>
                          ))}
                          <div style={{display:'flex',gap:8}}>
                            <button onClick={()=>saveDraft('medical', medData)}
                              style={{flex:1,padding:12,borderRadius:10,border:'1.5px solid '+etape.couleur,
                                background:'#fff',color:etape.couleur,fontWeight:700,
                                fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                              💾 Enregistrer
                            </button>
                            <button onClick={()=>{
                              const missing=etape.champs.filter(c=>c.required&&!medData[c.key])
                              if(missing.length){alert('Champs requis: '+missing.map(c=>c.label).join(', '));return}
                              if(medData.alcool==='Positif'||medData.drogues==='Positif'){alert('⛔ Tests positifs — Accès refusé. Contacter le médecin.');return}
                              if(!medData.resultat?.startsWith('FIT')){alert('⛔ Résultat médecin non FIT — Accès refusé.');return}
                              validerEtape(etape.key,{medical:medData})
                            }}
                              style={{flex:2,padding:12,borderRadius:10,border:'none',
                                background:etape.couleur,color:'#fff',fontWeight:700,
                                fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                              🏥 Valider la visite médicale
                            </button>
                          </div>
                        </div>
                      )}

                      {/* BADGE */}
                      {etape.type==='badge' && (
                        <div style={{textAlign:'center',padding:20}}>
                          <div style={{fontSize:60,marginBottom:16}}>🎫</div>
                          <div style={{fontWeight:700,fontSize:18,color:'#16a34a',marginBottom:8}}>
                            Badge QR Prêt !
                          </div>
                          <div style={{background:'#f0fdf4',border:'2px solid #86efac',
                            borderRadius:14,padding:'16px 20px',marginBottom:20,textAlign:'left'}}>
                            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>
                              🏷️ Badge d\'accès — Roxgold Sango
                            </div>
                            <div style={{fontSize:12,color:'#64748b',lineHeight:1.8}}>
                              <div>👤 {selected.nom} {selected.prenom}</div>
                              <div>🏢 {selected.societe||'Roxgold'}</div>
                              <div>📅 Émis le {new Date().toLocaleDateString('fr-FR')}</div>
                              <div>⏱️ Valide 12 mois</div>
                            </div>
                          </div>
                          <button onClick={()=>{
                            validerEtape(etape.key,{badge_emis:new Date().toISOString()})
                            setEtapeActive('celebration')
                          }}
                            style={{width:'100%',padding:13,borderRadius:10,border:'none',
                              background:'#16a34a',color:'#fff',fontWeight:700,
                              fontSize:15,cursor:'pointer',fontFamily:'inherit'}}>
                            🎉 Émettre le badge et terminer l'induction
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      )}

    </div>
    </InductionBoundary>
  )
}

export default function InductionPage() {
  return (
    <InductionErrorBoundary>
      <InductionPageInner />
    </InductionErrorBoundary>
  )
}
