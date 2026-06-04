import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'

// ── Données du camp ──────────────────────────────────────────
const INFOS_CAMP = {
  nom:       'Camp Résidentiel Roxgold Sango',
  site:      'Mine d\'or de Sango, Côte d\'Ivoire',
  capacite:  '247 résidents',
  superficie:'12 hectares',
  altitude:  '347m',
  contact:   '+225 07 XX XX XX',
}

const INFRASTRUCTURES = [
  { id:'residences', icon:'🏠', titre:'Résidences', desc:'5 blocs résidentiels (A-E) + VIP. Chaque chambre individuelle avec climatisation, salle de bain privée, Wi-Fi.', color:'#1e3a8a', bg:'#eff6ff' },
  { id:'restauration', icon:'🍽️', titre:'Restauration', desc:'Cafétéria principale ouverte 06h-21h. Petit-déjeuner, déjeuner, dîner servis. Régimes spéciaux disponibles sur demande.', color:'#059669', bg:'#f0fdf4' },
  { id:'medical', icon:'🏥', titre:'Infirmerie', desc:'Infirmière présente 24h/24. Médecin visite 3x/semaine. Évacuation médicale disponible en urgence.', color:'#dc2626', bg:'#fee2e2' },
  { id:'sport', icon:'⚽', titre:'Zone sportive', desc:'Terrain de foot, salle de musculation, terrain de basket. Horaires: 06h-08h et 17h-20h.', color:'#7c3aed', bg:'#f5f3ff' },
  { id:'loisirs', icon:'📺', titre:'Salle de loisirs', desc:'TV, bibliothèque, jeux de société, connexion internet haut débit. Ouverte tous les jours.', color:'#0891b2', bg:'#ecfeff' },
  { id:'laverie', icon:'👕', titre:'Laverie', desc:'Machines disponibles 24h/24. Service blanchisserie disponible (délai 24h). Chaque résident dispose d\'un casier.', color:'#ca8a04', bg:'#fefce8' },
  { id:'mosque', icon:'🕌', titre:'Lieu de culte', desc:'Espace de prière disponible dans le bloc C. Moment de silence respecté.', color:'#64748b', bg:'#f8fafc' },
  { id:'securite', icon:'🔒', titre:'Sécurité', desc:'Badge obligatoire 24h/24. Ronde de sécurité toutes les 2h. Caméras dans les espaces communs.', color:'#374151', bg:'#f9fafb' },
]

const REGLES = [
  { id:'alcool',   icon:'🚫', titre:'Zéro alcool', texte:'Toute consommation d\'alcool est strictement interdite dans l\'enceinte du camp. Violation = rapatriement immédiat.', niveau:'critique' },
  { id:'bruit',    icon:'🔇', titre:'Couvre-feu sonore', texte:'Silence obligatoire de 22h à 06h dans toutes les résidences. Musique avec écouteurs uniquement.', niveau:'important' },
  { id:'visiteurs',icon:'👤', titre:'Visiteurs', texte:'Aucun visiteur extérieur sans autorisation écrite préalable de la direction du camp.', niveau:'important' },
  { id:'tenue',    icon:'👔', titre:'Tenue de travail', texte:'EPI complet obligatoire dans les zones opérationnelles. Tenue correcte exigée dans les espaces communs.', niveau:'standard' },
  { id:'dechet',   icon:'♻️', titre:'Gestion des déchets', texte:'Tri sélectif obligatoire. Bacs colorés : vert (organique), bleu (plastique/verre), noir (ordures).', niveau:'standard' },
  { id:'energie',  icon:'⚡', titre:'Économie d\'énergie', texte:'Climatisation entre 22°C et 26°C uniquement. Lumières éteintes en quittant la chambre. Appareils énergivores à déclarer.', niveau:'important' },
  { id:'internet', icon:'📶', titre:'Usage internet', texte:'Wi-Fi fourni pour usage personnel. Téléchargements massifs et streaming HD sont limités. Usage professionnel prioritaire.', niveau:'standard' },
  { id:'vehicule', icon:'🚗', titre:'Véhicules du camp', texte:'Conduite strictement réservée aux personnes autorisées. Permis de conduire + autorisation camp obligatoires.', niveau:'important' },
]

const QUIZ = [
  { q:'À quelle heure commence le couvre-feu sonore ?', opts:['20h00','21h00','22h00','23h00'], rep:2 },
  { q:'Que doit-on faire avec un appareil énergivore ?', opts:['L\'utiliser discrètement','Le déclarer à l\'administration','L\'interdire totalement','Ne rien faire'], rep:1 },
  { q:'En cas d\'urgence médicale la nuit, qui appeler ?', opts:['Le chef de bloc','L\'infirmerie (24h/24)','Le médecin','La sécurité'], rep:1 },
  { q:'Le tri sélectif est-il obligatoire ?', opts:['Non, optionnel','Oui, absolument','Seulement pour le plastique','Uniquement en journée'], rep:1 },
  { q:'Peut-on inviter des visiteurs sans autorisation ?', opts:['Oui si c\'est la famille','Oui le week-end','Non, jamais','Oui si discrets'], rep:2 },
]

const APPAREILS_TYPES = [
  'Climatiseur personnel','Réfrigérateur','Micro-ondes','Fer à repasser',
  'Machine à café','Chargeur rapide (>65W)','Ordinateur de bureau','Console de jeux',
  'Bouilloire électrique','Autre (préciser)',
]

const NIVEAUX_COLOR = { critique:'#dc2626', important:'#ea580c', standard:'#1e3a8a' }
const NIVEAUX_BG    = { critique:'#fee2e2', important:'#fff7ed', standard:'#eff6ff' }

// ── Composant principal ──────────────────────────────────────
export default function InductionCamp() {
  const { user } = useStore()
  const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
  const tok  = () => localStorage.getItem('access_token') || ''

  const [etape,       setEtape]       = useState(0)   // 0-5
  const [quizRep,     setQuizRep]     = useState({})
  const [quizOk,      setQuizOk]      = useState(false)
  const [showQuizErr, setShowQuizErr] = useState(false)
  const [signature,   setSignature]   = useState('')
  const [appareils,   setAppareils]   = useState([])
  const [formApp,     setFormApp]     = useState({type:'',marque:'',modele:'',puissance:'',chambre:''})
  const [showFormApp, setShowFormApp] = useState(false)
  const [validated,   setValidated]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [infraSel,    setInfraSel]    = useState(null)
  const canvasRef = useRef(null)
  const drawing   = useRef(false)

  // Charger appareils existants
  useEffect(() => {
    fetch(`${BASE}/api/appareils-camp/?personnel=${user?.profile?.id||''}`, {
      headers:{Authorization:`Bearer ${tok()}`}
    }).then(r=>r.json()).then(d=>setAppareils(d.results||d||[])).catch(()=>{})
  }, [])

  // Canvas signature
  useEffect(() => {
    if (etape !== 4) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 2; ctx.lineCap = 'round'

    const pos = (e) => {
      const r = canvas.getBoundingClientRect()
      const src = e.touches?.[0] || e
      return [src.clientX - r.left, src.clientY - r.top]
    }
    const start = (e) => { drawing.current = true; ctx.beginPath(); const [x,y]=pos(e); ctx.moveTo(x,y) }
    const move  = (e) => {
      if (!drawing.current) return
      e.preventDefault()
      const [x,y] = pos(e); ctx.lineTo(x,y); ctx.stroke()
      setSignature(canvas.toDataURL())
    }
    const stop = () => { drawing.current = false }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup',   stop)
    canvas.addEventListener('touchstart', start, {passive:false})
    canvas.addEventListener('touchmove',  move,  {passive:false})
    canvas.addEventListener('touchend',   stop)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup',   stop)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove',  move)
      canvas.removeEventListener('touchend',   stop)
    }
  }, [etape])

  const ETAPES = ['Bienvenue','Infrastructures','Règles','Quiz','Appareils','Signature']

  // Valider le quiz
  const validerQuiz = () => {
    const ok = QUIZ.every((q,i) => quizRep[i] === q.rep)
    if (ok) { setQuizOk(true); setShowQuizErr(false) }
    else { setShowQuizErr(true) }
  }

  // Soumettre
  const soumettre = async () => {
    if (!signature) return
    setSaving(true)
    try {
      await fetch(`${BASE}/api/induction-camp/`, {
        method: 'POST',
        headers: {'Content-Type':'application/json', Authorization:`Bearer ${tok()}`},
        body: JSON.stringify({
          personnel: user?.profile?.id,
          signature_base64: signature,
          appareils_declares: appareils.length,
          date_completion: new Date().toISOString(),
        })
      })
      setValidated(true)
      setEtape(5)
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  // Ajouter appareil
  const ajouterAppareil = async () => {
    if (!formApp.type) return
    const app = { ...formApp, id: Date.now() }
    setAppareils(prev => [...prev, app])
    // Tentative de sauvegarde API
    try {
      await fetch(`${BASE}/api/appareils-camp/`, {
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`},
        body: JSON.stringify({...formApp, personnel: user?.profile?.id})
      })
    } catch(e) {}
    setFormApp({type:'',marque:'',modele:'',puissance:'',chambre:''})
    setShowFormApp(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)
    setSignature('')
  }

  // ── RENDU ─────────────────────────────────────────────────────
  const nomUser = user?.profile?.nom || user?.username || 'Résident'

  // Étape finale — Badge
  if (etape === 5 && validated) {
    return (
      <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e3a8a)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div style={{background:'#fff',borderRadius:24,padding:40,maxWidth:480,
          width:'100%',textAlign:'center',boxShadow:'0 25px 60px rgba(0,0,0,.4)'}}>
          <div style={{fontSize:72,marginBottom:16}}>🏅</div>
          <div style={{background:'linear-gradient(135deg,#1e3a8a,#059669)',
            borderRadius:16,padding:'20px 24px',marginBottom:24}}>
            <p style={{color:'rgba(255,255,255,.7)',fontSize:12,margin:0}}>CERTIFICAT D'INDUCTION DU CAMP</p>
            <h1 style={{color:'#fff',fontSize:22,fontWeight:900,margin:'8px 0 4px'}}>{nomUser}</h1>
            <p style={{color:'rgba(255,255,255,.8)',fontSize:13,margin:0}}>
              {new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}
            </p>
          </div>
          <p style={{fontSize:14,color:'#374151',marginBottom:8}}>
            ✅ Règles du camp lues et acceptées<br/>
            ✅ Quiz de validation réussi<br/>
            ✅ {appareils.length} appareil(s) déclaré(s)<br/>
            ✅ Signature électronique apposée
          </p>
          <div style={{background:'#f0fdf4',border:'2px solid #16a34a',borderRadius:12,
            padding:'12px 20px',marginTop:16}}>
            <p style={{color:'#166534',fontWeight:700,fontSize:13,margin:0}}>
              🎉 Bienvenue au camp Roxgold Sango !
            </p>
            <p style={{color:'#16a34a',fontSize:12,margin:'4px 0 0'}}>
              Votre induction camp est maintenant complète.
            </p>
          </div>
          <button onClick={()=>window.location.href='/'}
            style={{marginTop:20,background:'#1e3a8a',color:'#fff',border:'none',
              borderRadius:10,padding:'12px 32px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            Aller au Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc'}}>

      {/* Header progress */}
      <div style={{background:'linear-gradient(135deg,#0f172a,#1e3a8a)',padding:'20px 24px 0'}}>
        <div style={{maxWidth:800,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <span style={{fontSize:24}}>🏕️</span>
            <div>
              <h1 style={{color:'#fff',fontSize:18,fontWeight:800,margin:0}}>Induction du Camp</h1>
              <p style={{color:'rgba(255,255,255,.7)',fontSize:12,margin:0}}>
                Camp Roxgold Sango · Bienvenue, {nomUser}
              </p>
            </div>
          </div>
          {/* Stepper */}
          <div style={{display:'flex',gap:0}}>
            {ETAPES.map((e,i)=>(
              <div key={i} style={{flex:1,textAlign:'center',paddingBottom:12,cursor:i<etape?'pointer':'default'}}
                onClick={()=>i<etape&&setEtape(i)}>
                <div style={{width:28,height:28,borderRadius:'50%',margin:'0 auto 4px',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,
                  background:i===etape?'#FFD400':i<etape?'#16a34a':'rgba(255,255,255,.2)',
                  color:i===etape?'#0f172a':i<etape?'#fff':'rgba(255,255,255,.6)',
                  border:i===etape?'2px solid #FFD400':'none',
                  boxShadow:i===etape?'0 0 0 4px rgba(255,212,0,.3)':'none'}}>
                  {i<etape ? '✓' : i+1}
                </div>
                <p style={{fontSize:9,color:i===etape?'#FFD400':i<etape?'rgba(255,255,255,.8)':'rgba(255,255,255,.4)',
                  margin:0,textTransform:'uppercase',letterSpacing:.5,whiteSpace:'nowrap',overflow:'hidden'}}>
                  {e}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div style={{maxWidth:800,margin:'0 auto',padding:24}}>

        {/* ── ÉTAPE 0: Bienvenue ── */}
        {etape===0&&(
          <div>
            <div style={{background:'#fff',borderRadius:16,padding:28,marginBottom:16,
              border:'1px solid #e2e8f0',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
              <h2 style={{fontSize:20,fontWeight:800,color:'#0f172a',marginBottom:4}}>
                👋 Bienvenue au {INFOS_CAMP.nom}
              </h2>
              <p style={{color:'#64748b',fontSize:14,marginBottom:20}}>
                Cette induction vous prend environ <b>10 minutes</b>. 
                Elle couvre les infrastructures, les règles de vie et vous permet de déclarer vos appareils électriques.
              </p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,marginBottom:20}}>
                {[
                  ['📍',INFOS_CAMP.site],['👥',INFOS_CAMP.capacite],
                  ['📐',INFOS_CAMP.superficie],['⛰️',INFOS_CAMP.altitude],
                  ['📞',INFOS_CAMP.contact],['🕐','Ouvert 24h/24'],
                ].map(([ic,v],i)=>(
                  <div key={i} style={{background:'#f8fafc',borderRadius:10,padding:'10px 14px',
                    display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:20}}>{ic}</span>
                    <span style={{fontSize:12,color:'#374151',fontWeight:500}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:'#eff6ff',borderRadius:12,padding:'14px 18px',
                borderLeft:'4px solid #1e3a8a'}}>
                <p style={{fontSize:13,color:'#1e3a8a',fontWeight:600,margin:0}}>
                  📋 Ce que vous allez faire :
                </p>
                <ul style={{margin:'8px 0 0',paddingLeft:20,color:'#374151',fontSize:13,lineHeight:1.8}}>
                  <li>Découvrir les infrastructures du camp</li>
                  <li>Lire et accepter les règles de vie</li>
                  <li>Passer un quiz de validation (5 questions)</li>
                  <li>Déclarer vos appareils énergivores</li>
                  <li>Signer électroniquement votre engagement</li>
                </ul>
              </div>
            </div>
            <button onClick={()=>setEtape(1)}
              style={{width:'100%',background:'linear-gradient(135deg,#1e3a8a,#2563eb)',
                color:'#fff',border:'none',borderRadius:12,padding:'16px',
                fontSize:15,fontWeight:700,cursor:'pointer',
                boxShadow:'0 4px 16px rgba(30,58,138,.35)'}}>
              Commencer l'induction → 
            </button>
          </div>
        )}

        {/* ── ÉTAPE 1: Infrastructures ── */}
        {etape===1&&(
          <div>
            <h2 style={{fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:4}}>
              🏗️ Infrastructures du camp
            </h2>
            <p style={{color:'#64748b',fontSize:13,marginBottom:16}}>
              Cliquez sur chaque infrastructure pour en savoir plus.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:20}}>
              {INFRASTRUCTURES.map(inf=>(
                <div key={inf.id}
                  onClick={()=>setInfraSel(infraSel?.id===inf.id?null:inf)}
                  style={{background:infraSel?.id===inf.id?inf.bg:'#fff',
                    borderRadius:12,padding:'16px',cursor:'pointer',
                    border:`2px solid ${infraSel?.id===inf.id?inf.color:'#e2e8f0'}`,
                    boxShadow:infraSel?.id===inf.id?`0 4px 16px ${inf.color}22`:'0 1px 4px rgba(0,0,0,.05)',
                    transition:'all .2s'}}>
                  <div style={{fontSize:28,marginBottom:8}}>{inf.icon}</div>
                  <p style={{fontSize:13,fontWeight:700,color:inf.color,margin:0}}>{inf.titre}</p>
                </div>
              ))}
            </div>
            {infraSel&&(
              <div style={{background:infraSel.bg,borderRadius:12,padding:'16px 20px',
                marginBottom:20,border:`1.5px solid ${infraSel.color}`,
                animation:'fadeIn .2s ease'}}>
                <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                  <span style={{fontSize:32}}>{infraSel.icon}</span>
                  <div>
                    <h3 style={{fontSize:15,fontWeight:800,color:infraSel.color,margin:'0 0 6px'}}>{infraSel.titre}</h3>
                    <p style={{fontSize:13,color:'#374151',margin:0,lineHeight:1.6}}>{infraSel.desc}</p>
                  </div>
                </div>
              </div>
            )}
            <button onClick={()=>setEtape(2)}
              style={{width:'100%',background:'#1e3a8a',color:'#fff',border:'none',
                borderRadius:12,padding:'14px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
              Continuer → Règles du camp
            </button>
          </div>
        )}

        {/* ── ÉTAPE 2: Règles ── */}
        {etape===2&&(
          <div>
            <h2 style={{fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:4}}>
              📜 Règles de vie du camp
            </h2>
            <p style={{color:'#64748b',fontSize:13,marginBottom:16}}>
              Lisez attentivement chaque règle. Un quiz vous sera posé ensuite.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
              {REGLES.map((r,i)=>(
                <div key={r.id} style={{background:NIVEAUX_BG[r.niveau],
                  borderRadius:12,padding:'14px 18px',
                  borderLeft:`4px solid ${NIVEAUX_COLOR[r.niveau]}`,
                  display:'flex',gap:14,alignItems:'flex-start'}}>
                  <span style={{fontSize:24,flexShrink:0}}>{r.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:800,color:NIVEAUX_COLOR[r.niveau]}}>{r.titre}</span>
                      <span style={{background:NIVEAUX_COLOR[r.niveau],color:'#fff',
                        fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99,
                        textTransform:'uppercase'}}>
                        {r.niveau}
                      </span>
                    </div>
                    <p style={{fontSize:13,color:'#374151',margin:0,lineHeight:1.5}}>{r.texte}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={()=>setEtape(3)}
              style={{width:'100%',background:'#1e3a8a',color:'#fff',border:'none',
                borderRadius:12,padding:'14px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
              J'ai lu les règles → Quiz de validation
            </button>
          </div>
        )}

        {/* ── ÉTAPE 3: Quiz ── */}
        {etape===3&&(
          <div>
            <h2 style={{fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:4}}>
              📝 Quiz de validation
            </h2>
            <p style={{color:'#64748b',fontSize:13,marginBottom:20}}>
              {QUIZ.length} questions — Toutes les bonnes réponses sont requises.
            </p>
            {quizOk?(
              <div style={{background:'#f0fdf4',border:'2px solid #16a34a',borderRadius:16,
                padding:'24px',textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:48,marginBottom:8}}>🎉</div>
                <h3 style={{color:'#166534',fontSize:16,fontWeight:800,margin:'0 0 8px'}}>
                  Quiz réussi !
                </h3>
                <p style={{color:'#16a34a',fontSize:13,margin:0}}>
                  Vous avez répondu correctement à toutes les questions.
                </p>
              </div>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:16,marginBottom:20}}>
                {QUIZ.map((q,qi)=>(
                  <div key={qi} style={{background:'#fff',borderRadius:12,padding:'16px 18px',
                    border:`1.5px solid ${quizRep[qi]!==undefined?
                      (showQuizErr&&quizRep[qi]!==q.rep?'#dc2626':'#e2e8f0'):'#e2e8f0'}`}}>
                    <p style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:12}}>
                      {qi+1}. {q.q}
                    </p>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {q.opts.map((opt,oi)=>(
                        <label key={oi} style={{display:'flex',alignItems:'center',gap:10,
                          cursor:'pointer',padding:'8px 12px',borderRadius:8,
                          background:quizRep[qi]===oi?'#eff6ff':'transparent',
                          border:`1px solid ${quizRep[qi]===oi?'#1e3a8a':'transparent'}`,
                          transition:'all .1s'}}>
                          <input type="radio" name={`q${qi}`} checked={quizRep[qi]===oi}
                            onChange={()=>setQuizRep(prev=>({...prev,[qi]:oi}))}
                            style={{accentColor:'#1e3a8a'}}/>
                          <span style={{fontSize:13,color:'#374151'}}>{opt}</span>
                        </label>
                      ))}
                    </div>
                    {showQuizErr&&quizRep[qi]!==undefined&&quizRep[qi]!==q.rep&&(
                      <p style={{color:'#dc2626',fontSize:11,margin:'8px 0 0',fontWeight:600}}>
                        ❌ Réponse incorrecte — relisez les règles
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!quizOk&&<button onClick={validerQuiz}
              style={{width:'100%',background:'#059669',color:'#fff',border:'none',
                borderRadius:12,padding:'14px',fontSize:14,fontWeight:700,cursor:'pointer',marginBottom:10}}>
              Valider le quiz ✓
            </button>}
            {quizOk&&<button onClick={()=>setEtape(4)}
              style={{width:'100%',background:'#1e3a8a',color:'#fff',border:'none',
                borderRadius:12,padding:'14px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
              Continuer → Déclaration d'appareils
            </button>}
            {showQuizErr&&!quizOk&&<button onClick={()=>{setEtape(2);setQuizRep({});setShowQuizErr(false)}}
              style={{width:'100%',background:'transparent',color:'#dc2626',
                border:'1px solid #dc2626',borderRadius:12,padding:'12px',
                fontSize:13,fontWeight:700,cursor:'pointer',marginTop:8}}>
              ← Revoir les règles
            </button>}
          </div>
        )}

        {/* ── ÉTAPE 4: Appareils énergivores ── */}
        {etape===4&&(
          <div>
            <h2 style={{fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:4}}>
              ⚡ Déclaration d'appareils énergivores
            </h2>
            <p style={{color:'#64748b',fontSize:13,marginBottom:4}}>
              Tout appareil de plus de <b>100W</b> doit être déclaré. C'est obligatoire pour la gestion énergétique du camp.
            </p>
            <div style={{background:'#fefce8',borderRadius:10,padding:'10px 14px',marginBottom:16,
              border:'1px solid #ca8a04',fontSize:12,color:'#713f12'}}>
              ⚠️ Les appareils non déclarés seront confisqués. La déclaration est gratuite et immédiate.
            </div>

            {/* Liste appareils */}
            {appareils.length > 0 && (
              <div style={{marginBottom:16}}>
                {appareils.map((a,i)=>(
                  <div key={a.id||i} style={{background:'#fff',borderRadius:10,padding:'12px 14px',
                    marginBottom:8,border:'1px solid #e2e8f0',
                    display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:22}}>🔌</span>
                    <div style={{flex:1}}>
                      <p style={{fontSize:13,fontWeight:700,color:'#0f172a',margin:0}}>{a.type}</p>
                      <p style={{fontSize:11,color:'#64748b',margin:'2px 0 0'}}>
                        {[a.marque,a.modele,a.puissance?a.puissance+'W':'',a.chambre?'Chambre '+a.chambre:''].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span style={{background:'#d1fae5',color:'#065f46',fontSize:10,fontWeight:700,
                      padding:'2px 8px',borderRadius:99}}>Déclaré</span>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire ajout */}
            {showFormApp?(
              <div style={{background:'#fff',borderRadius:12,padding:'18px',marginBottom:16,
                border:'1.5px solid #1e3a8a'}}>
                <h3 style={{fontSize:14,fontWeight:700,color:'#1e3a8a',marginBottom:14}}>
                  Nouvel appareil
                </h3>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div style={{gridColumn:'span 2'}}>
                    <label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>
                      TYPE D'APPAREIL *
                    </label>
                    <select value={formApp.type} onChange={e=>setFormApp(p=>({...p,type:e.target.value}))}
                      style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                        padding:'0 10px',fontSize:13,outline:'none',color:'#0f172a'}}>
                      <option value="">Sélectionner...</option>
                      {APPAREILS_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {[
                    ['MARQUE','marque','Philips, Samsung...'],
                    ['MODÈLE','modele','AC-1200...'],
                    ['PUISSANCE (W)','puissance','ex: 1500'],
                    ['N° CHAMBRE','chambre','ex: A-204'],
                  ].map(([lbl,key,ph])=>(
                    <div key={key}>
                      <label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>
                        {lbl}
                      </label>
                      <input value={formApp[key]} placeholder={ph}
                        onChange={e=>setFormApp(p=>({...p,[key]:e.target.value}))}
                        style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                          padding:'0 10px',fontSize:13,outline:'none',color:'#0f172a'}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:8,marginTop:14}}>
                  <button onClick={ajouterAppareil}
                    style={{flex:1,background:'#059669',color:'#fff',border:'none',borderRadius:9,
                      padding:'10px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                    ✓ Ajouter
                  </button>
                  <button onClick={()=>setShowFormApp(false)}
                    style={{background:'#f1f5f9',color:'#374151',border:'none',borderRadius:9,
                      padding:'10px 16px',fontSize:13,cursor:'pointer'}}>
                    Annuler
                  </button>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowFormApp(true)}
                style={{width:'100%',background:'#f8fafc',color:'#1e3a8a',
                  border:'2px dashed #bfdbfe',borderRadius:12,padding:'14px',
                  fontSize:13,fontWeight:700,cursor:'pointer',marginBottom:16}}>
                + Déclarer un appareil
              </button>
            )}

            <div style={{display:'flex',gap:8}}>
              {appareils.length === 0 && (
                <button onClick={()=>setEtape(5)}
                  style={{flex:1,background:'#f1f5f9',color:'#64748b',border:'none',borderRadius:12,
                    padding:'14px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  Je n'ai pas d'appareil → Continuer
                </button>
              )}
              <button onClick={()=>setEtape(5)}
                style={{flex:2,background:'#1e3a8a',color:'#fff',border:'none',borderRadius:12,
                  padding:'14px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                {appareils.length > 0 ? `${appareils.length} appareil(s) déclaré(s) → Continuer` : 'Passer →'}
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 5: Signature ── */}
        {etape===5&&!validated&&(
          <div>
            <h2 style={{fontSize:18,fontWeight:800,color:'#0f172a',marginBottom:4}}>
              ✍️ Signature d'engagement
            </h2>
            <p style={{color:'#64748b',fontSize:13,marginBottom:16}}>
              En signant, vous attestez avoir lu et accepté l'ensemble des règles du camp Roxgold Sango.
            </p>
            <div style={{background:'#fff',borderRadius:12,padding:'16px',marginBottom:16,
              border:'1px solid #e2e8f0'}}>
              <div style={{background:'#f8fafc',borderRadius:8,padding:'10px 14px',marginBottom:12,
                fontSize:12,color:'#374151',lineHeight:1.7}}>
                <b>Je soussigné(e), {nomUser}</b>, certifie avoir pris connaissance des règles de vie 
                du camp résidentiel Roxgold Sango, m'engage à les respecter et à signaler tout 
                manquement. Je déclare que les informations fournies sont exactes.
              </div>
              {/* Canvas signature */}
              <div style={{border:'2px solid #e2e8f0',borderRadius:8,background:'#fafafa',
                overflow:'hidden',marginBottom:8}}>
                <canvas ref={canvasRef} width={720} height={160}
                  style={{width:'100%',height:160,touchAction:'none',display:'block'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'#94a3b8'}}>Signez dans le cadre ci-dessus</span>
                <button onClick={clearCanvas}
                  style={{background:'transparent',color:'#dc2626',border:'1px solid #dc2626',
                    borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>
                  Effacer
                </button>
              </div>
            </div>
            <button onClick={soumettre} disabled={!signature||saving}
              style={{width:'100%',
                background:signature?'linear-gradient(135deg,#059669,#16a34a)':'#e2e8f0',
                color:signature?'#fff':'#94a3b8',border:'none',borderRadius:12,padding:'16px',
                fontSize:15,fontWeight:700,cursor:signature?'pointer':'not-allowed',
                boxShadow:signature?'0 4px 16px rgba(5,150,105,.35)':'none'}}>
              {saving ? '⏳ Enregistrement...' : '🎉 Finaliser l\'induction →'}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
