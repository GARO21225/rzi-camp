/**
 * InductionPage — Workflow QHSE Séquentiel
 * Chaque étape doit être validée pour débloquer la suivante
 * Inspiré des formations en ligne avec QCM
 */
import React, { useState, useEffect, useCallback } from 'react'
import { personnel as personnelAPI } from '../api'

const LS_KEY = 'rzi_induction_v3'

// ─── Définition des étapes ────────────────────────────────────────
const ETAPES = [
  {
    key: 'accueil',
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
    icon: '📋',
    titre: 'Quiz QHSE',
    desc: 'Score minimum: 80% — 3 tentatives maximum',
    couleur: '#f59e0b',
    type: 'quiz',
    score_min: 80,
    questions: [
      { id:1, q:'Que faire en cas d\'accident sur le site?', options:['Continuer à travailler','Alerter l\'infirmerie et ne pas déplacer la victime','Rentrer chez soi','Appeler la famille'], correct:1 },
      { id:2, q:'Le port du casque est obligatoire:', options:['Uniquement dans les zones dangereuses','En toutes circonstances sur le site','Seulement dans les mines souterraines','Jamais pour les visiteurs'], correct:1 },
      { id:3, q:'Que signifie "Stop Work Authority"?', options:['Arrêter la production','Le droit de tout agent d\'arrêter un travail dangereux','Interdire les heures supplémentaires','Fermer le chantier'], correct:1 },
      { id:4, q:'Les EPI (Équipements de Protection Individuelle) sont:', options:['Optionnels selon l\'humeur','Obligatoires uniquement pour les techniciens','Obligatoires pour tous sur site','Réservés aux responsables'], correct:2 },
      { id:5, q:'Le point de rassemblement en cas d\'évacuation est:', options:['La cafétéria','Le parking principal','Zone A — Entrée principale','La direction'], correct:2 },
    ]
  },
  {
    key: 'medical',
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
function EtapeQuiz({ etape, wf, onValider, onEchec }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)
  const tentatives = wf.tentatives_quiz || 0

  const submitQuiz = () => {
    let correct = 0
    etape.questions.forEach(q => {
      if (answers[q.id] === q.correct) correct++
    })
    const s = Math.round(correct / etape.questions.length * 100)
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
          {Object.keys(answers).length}/{etape.questions.length} réponses
        </span>
        <span style={{fontSize:12,color:'#f59e0b',fontWeight:700}}>
          Tentative {tentatives+1}/3 · Min: {etape.score_min}%
        </span>
      </div>
      {etape.questions.map((q,qi)=>(
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
        disabled={Object.keys(answers).length < etape.questions.length}
        style={{width:'100%',padding:13,borderRadius:10,border:'none',cursor:'pointer',
          fontFamily:'inherit',fontWeight:700,fontSize:14,
          background: Object.keys(answers).length < etape.questions.length ? '#94a3b8' : '#f59e0b',
          color:'#fff'}}>
        {Object.keys(answers).length < etape.questions.length
          ? `Répondre à toutes les questions (${etape.questions.length-Object.keys(answers).length} restantes)`
          : '📋 Soumettre le Quiz'}
      </button>
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────
export default function InductionPage() {
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

  const load = useCallback(() => {
    setLoading(true)
    personnelAPI.list({page_size:500})
      .then(r => {
        const list = r.data.results || r.data || []
        setPersonnel(list)
        const wf = {}
        list.forEach(p => { wf[p.id] = getWF(p.id) })
        setWfState(wf)
      })
      .catch(()=>setPersonnel([]))
      .finally(()=>setLoading(false))
  },[])

  useEffect(()=>{ load() },[load])

  const wf = (p) => wfState[p?.id] || {}
  const getEtapeDone = (pid, key) => !!(wf({id:pid}).etapes?.[key]?.done)

  const etapeDebloquee = (pid, etapeKey) => {
    const idx = ETAPES.findIndex(e=>e.key===etapeKey)
    if (idx===0) return true  // première étape toujours débloquée
    const prev = ETAPES[idx-1]
    return getEtapeDone(pid, prev.key)
  }

  const validerEtape = (key, extraData={}) => {
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
    setSavedMsg('✅ Étape validée !')
    setTimeout(()=>setSavedMsg(''), 2000)

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
    const q = search.toLowerCase()
    if (q && ![p.nom,p.prenom,p.societe].some(v=>(v||'').toLowerCase().includes(q))) return false
    if (typeFilter && p.type_personnel !== typeFilter) return false
    return true
  })

  const TYPES = [{v:'roxgold',l:'Roxgold'},{v:'sous_traitant',l:'Sous-traitant'},{v:'visiteur',l:'Visiteur'}]
  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'9px 12px',
    fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}

  return (
    <InductionBoundary>
    <div style={{maxWidth:1100,margin:'0 auto',padding:20}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
        borderRadius:16,padding:'18px 24px',marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:900,margin:0}}>🎓 Induction QHSE — Roxgold Sango</h1>
        <p style={{fontSize:12,color:'rgba(255,255,255,.7)',margin:'4px 0 0'}}>
          Workflow séquentiel en 6 étapes — Chaque étape débloque la suivante
        </p>
      </div>

      {/* Filtres */}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher personnel..."
          style={{...inp,maxWidth:260}}/>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{...inp,maxWidth:160}}>
          <option value="">Tous les types</option>
          {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>

      {loading ? <div style={{textAlign:'center',padding:60,fontSize:32}}>⏳</div> : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(p => {
            const prog = progression(p)
            const w = wf(p)
            return (
              <div key={p.id} onClick={()=>{setSelected(p);setEtapeActive(null)}}
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
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4,marginTop:8}}>
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
                </div>

                {/* Étapes navigation */}
                {!etapeActive && (
                  <div style={{padding:20}}>
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
                          {debloque && !done && (
                            <div style={{color:e.couleur,fontSize:18}}>→</div>
                          )}
                        </div>
                      )
                    })}
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
                        </div>
                      </div>

                      {/* FORM */}
                      {etape.type==='form' && (
                        <div>
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
                              ) : (
                                <input type={c.type} value={formData[c.key]||''}
                                  onChange={e=>setFormData(f=>({...f,[c.key]:e.target.value}))}
                                  placeholder={c.placeholder} style={inp}/>
                              )}
                            </div>
                          ))}
                          <button onClick={()=>{
                            const missing = etape.champs.filter(c=>c.required&&!formData[c.key])
                            if(missing.length) { alert('Champs requis: '+missing.map(c=>c.label).join(', ')); return }
                            validerEtape(etape.key, {form:formData})
                          }}
                            style={{width:'100%',padding:12,borderRadius:10,border:'none',
                              background:etape.couleur,color:'#fff',fontWeight:700,
                              fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                            ✅ Valider et continuer
                          </button>
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
                          <button onClick={()=>{
                            const manquants = etape.docs.filter(d=>d.required&&!docUploads[d.key])
                            if(manquants.length){alert('Documents requis: '+manquants.map(d=>d.label).join(', '));return}
                            validerEtape(etape.key, {docs:Object.keys(docUploads)})
                          }}
                            style={{width:'100%',padding:12,borderRadius:10,border:'none',marginTop:8,
                              background:etape.couleur,color:'#fff',fontWeight:700,
                              fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                            📄 Documents soumis — Continuer
                          </button>
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
                          <button onClick={()=>{
                            const missing=etape.champs.filter(c=>c.required&&!medData[c.key])
                            if(missing.length){alert('Champs requis: '+missing.map(c=>c.label).join(', '));return}
                            if(medData.alcool==='Positif'||medData.drogues==='Positif'){alert('⛔ Tests positifs — Accès refusé. Contacter le médecin.');return}
                            if(!medData.resultat?.startsWith('FIT')){alert('⛔ Résultat médecin non FIT — Accès refusé.');return}
                            validerEtape(etape.key,{medical:medData})
                          }}
                            style={{width:'100%',padding:12,borderRadius:10,border:'none',
                              background:etape.couleur,color:'#fff',fontWeight:700,
                              fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
                            🏥 Valider la visite médicale
                          </button>
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
