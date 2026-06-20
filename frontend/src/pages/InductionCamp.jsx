import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'

// ─────────────────────────────────────────────
//  DONNÉES CAMP
// ─────────────────────────────────────────────
// CAMP/INFRAS/REGLES/QUIZ sont désormais chargés dynamiquement depuis l'API
// (voir useEffect de chargement dans le composant principal) — administrables
// via /induction-admin. Ces constantes sont gardées comme fallback minimal au
// cas où l'API serait inaccessible (pas d'écran blanc en réseau terrain faible).
const CAMP_FALLBACK = {
  nom: 'Camp Résidentiel', site: '', capacite: 0, superficie: '', altitude: '',
}
const INFRAS_FALLBACK = []
const REGLES_FALLBACK = []
const QUIZ_FALLBACK = []


const APPAREILS_TYPES = [
  'Climatiseur personnel','Réfrigérateur','Micro-ondes','Fer à repasser',
  'Machine à café','Chargeur rapide >65W','Ordinateur fixe','Console de jeux',
  'Bouilloire électrique','Radiateur électrique','Autre',
]

const NIVEAUX = {
  critique:  { c:'#ef4444', bg:'#fef2f2', label:'CRITIQUE',  ring:'rgba(239,68,68,.3)' },
  important: { c:'#f97316', bg:'#fff7ed', label:'IMPORTANT', ring:'rgba(249,115,22,.3)' },
  standard:  { c:'#3b82f6', bg:'#eff6ff', label:'STANDARD',  ring:'rgba(59,130,246,.3)' },
}

// ─────────────────────────────────────────────
//  COMPOSANTS
// ─────────────────────────────────────────────

function ProgressRing({ pct, size=80, stroke=6, color='#3b82f6', children }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div style={{position:'relative',width:size,height:size,display:'inline-flex',
      alignItems:'center',justifyContent:'center'}}>
      <svg width={size} height={size} style={{position:'absolute',transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,.1)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{transition:'stroke-dasharray .6s ease'}}/>
      </svg>
      <div style={{position:'relative',zIndex:1,textAlign:'center'}}>
        {children}
      </div>
    </div>
  )
}

function Particle({ x, y, color, size, delay }) {
  return (
    <div style={{
      position:'absolute', left:`${x}%`, top:`${y}%`,
      width:size, height:size, borderRadius:'50%',
      background:color, opacity:.4,
      animation:`float ${2+delay}s ease-in-out ${delay}s infinite alternate`,
    }}/>
  )
}

// ─────────────────────────────────────────────
//  COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────
export default function InductionCamp() {
  const { user } = useStore()
  const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
  const tok  = () => localStorage.getItem('access_token') || ''

  // Vérification induction existante
  const [dejaComplete, setDejaComplete] = useState(false)
  const [loadingCheck, setLoadingCheck] = useState(true)
  const [adminView,    setAdminView]    = useState(false)
  const [allInductions,setAllInductions]= useState([])
  const isAdmin = user?.is_superuser || user?.is_staff || user?.profile?.role === 'admin'

  // Contenu administrable — chargé depuis l'API, avec fallback si réseau indisponible
  const [CAMP,   setCAMP]   = useState(CAMP_FALLBACK)
  const [INFRAS, setINFRAS] = useState(INFRAS_FALLBACK)
  const [REGLES, setREGLES] = useState(REGLES_FALLBACK)
  const [QUIZ,   setQUIZ]   = useState(QUIZ_FALLBACK)
  const [quizResult, setQuizResult] = useState(null) // résultat de /induction-quiz/verifier/

  useEffect(() => {
    const loadContenu = async () => {
      try {
        const [rC, rI, rR, rQ] = await Promise.allSettled([
          fetch(`${BASE}/api/induction-config/actuelle/`, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json()),
          fetch(`${BASE}/api/induction-infras/?actives_only=1`, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json()),
          fetch(`${BASE}/api/induction-regles/?actives_only=1`, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json()),
          fetch(`${BASE}/api/induction-quiz/?actives_only=1`, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json()),
        ])
        if (rC.status === 'fulfilled' && rC.value?.nom) setCAMP(rC.value)
        if (rI.status === 'fulfilled') {
          const list = rI.value.results || rI.value || []
          if (list.length) setINFRAS(list.map(i => ({ ...i, desc: i.description })))
        }
        if (rR.status === 'fulfilled') {
          const list = rR.value.results || rR.value || []
          if (list.length) setREGLES(list)
        }
        if (rQ.status === 'fulfilled') {
          const list = rQ.value.results || rQ.value || []
          if (list.length) setQUIZ(list.map(q => ({ q: q.question, opts: q.options, id: q.id, explication: q.explication })))
        }
      } catch (e) { /* fallback déjà en place, pas d'écran blanc */ }
    }
    loadContenu()
  }, [])

  // Vérifier si induction déjà validée
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const r = await fetch(
          `${BASE}/api/induction-records/?personnel=${user?.profile?.id||''}`,
          { headers: { Authorization: `Bearer ${tok()}` } }
        )
        const d = await r.json()
        const records = d.results || d || []
        const myRecord = records.find(rec =>
          rec.personnel === user?.profile?.id ||
          rec.personnel_id === user?.profile?.id
        )
        if (myRecord?.statut === 'valide') setDejaComplete(true)
      } catch(e) {}
      setLoadingCheck(false)
    }
    checkExisting()
    // Si admin, charger toutes les inductions camp
    if (isAdmin) {
      fetch(`${BASE}/api/induction-records/?page_size=200`, {
        headers: { Authorization: `Bearer ${tok()}` }
      }).then(r=>r.json()).then(d => setAllInductions(d.results||d||[])).catch(()=>{})
    }
  }, [])

  // États globaux
  const [etape,        setEtape]        = useState(0)
  const [completed,    setCompleted]    = useState(new Set())
  const [infrasVues,   setInfrasVues]   = useState(new Set())
  const [reglesVues,   setReglesVues]   = useState(new Set())
  const [quizRep,      setQuizRep]      = useState({})
  const [quizOk,       setQuizOk]       = useState(false)
  const [quizErr,      setQuizErr]      = useState(false)
  const [quizScore,    setQuizScore]    = useState(0)
  const [appareils,    setAppareils]    = useState([])
  const [formApp,      setFormApp]      = useState({type:'',marque:'',modele:'',puissance:'',chambre:''})
  const [showFormApp,  setShowFormApp]  = useState(false)
  const [signature,    setSignature]    = useState('')
  const [validated,    setValidated]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [infraSel,     setInfraSel]     = useState(null)
  const [regleSel,     setRegleSel]     = useState(null)
  const canvasRef = useRef(null)
  const drawing   = useRef(false)

  const ETAPES = ['Bienvenue','Infrastructures','Règles','Quiz','Appareils','Engagement']
  const nomUser = user?.profile?.nom || user?.username || 'Résident'

  // Progression globale
  const progression = Math.round((etape / (ETAPES.length - 1)) * 100)

  // Canvas signature
  useEffect(() => {
    if (etape !== 5) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const pos = e => {
      const r = canvas.getBoundingClientRect()
      const s = e.touches?.[0] || e
      return [(s.clientX-r.left)*(canvas.width/r.width), (s.clientY-r.top)*(canvas.height/r.height)]
    }
    const start = e => { drawing.current=true; const [x,y]=pos(e); ctx.beginPath(); ctx.moveTo(x,y) }
    const move  = e => { if(!drawing.current) return; e.preventDefault(); const [x,y]=pos(e); ctx.lineTo(x,y); ctx.stroke(); setSignature(canvas.toDataURL()) }
    const stop  = () => { drawing.current=false }
    canvas.addEventListener('mousedown',start)
    canvas.addEventListener('mousemove',move)
    canvas.addEventListener('mouseup',stop)
    canvas.addEventListener('touchstart',start,{passive:false})
    canvas.addEventListener('touchmove',move,{passive:false})
    canvas.addEventListener('touchend',stop)
    return () => {
      canvas.removeEventListener('mousedown',start)
      canvas.removeEventListener('mousemove',move)
      canvas.removeEventListener('mouseup',stop)
      canvas.removeEventListener('touchstart',start)
      canvas.removeEventListener('touchmove',move)
      canvas.removeEventListener('touchend',stop)
    }
  }, [etape])

  // Marquer infra vue
  const voirInfra = (id) => {
    setInfrasVues(prev => new Set([...prev, id]))
    setInfraSel(id === infraSel ? null : id)
  }

  // Marquer règle vue
  const voirRegle = (id) => {
    setReglesVues(prev => new Set([...prev, id]))
    setRegleSel(id === regleSel ? null : id)
  }

  // Valider quiz
  const validerQuiz = async () => {
    // Vérification côté serveur — la bonne réponse n'est jamais transmise
    // au navigateur avant validation (voir InductionQuizQuestionViewSet.verifier).
    try {
      const reponses = {}
      QUIZ.forEach((q, i) => { if (q.id) reponses[q.id] = quizRep[i] })
      const r = await fetch(`${BASE}/api/induction-quiz/verifier/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ reponses })
      })
      const data = await r.json()
      setQuizResult(data)
      setQuizScore(data.correctes ?? 0)
      if (data.score === 100) { setQuizOk(true); setQuizErr(false) }
      else { setQuizErr(true) }
    } catch (e) {
      // Fallback local si l'API est inaccessible (réseau terrain faible) —
      // moins sûr mais évite de bloquer le parcours d'induction.
      let score = 0
      QUIZ.forEach((q, i) => { if (quizRep[i] === q.rep) score++ })
      setQuizScore(score)
      if (score === QUIZ.length) { setQuizOk(true); setQuizErr(false) }
      else { setQuizErr(true) }
    }
  }

  const ajouterAppareil = async () => {
    if (!formApp.type) return
    const app = { ...formApp, id: Date.now() }
    setAppareils(prev => [...prev, app])
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

  const soumettre = async () => {
    if (!signature) return
    setSaving(true)
    try {
      await fetch(`${BASE}/api/induction-camp/`, {
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`},
        body: JSON.stringify({
          personnel: user?.profile?.id,
          signature_base64: signature,
          appareils_declares: appareils.length,
          date_completion: new Date().toISOString(),
        })
      })
      setValidated(true)
    } catch(e) {}
    setSaving(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height)
    setSignature('')
  }

  const canNext = () => {
    if (etape===1) return infrasVues.size >= 4
    if (etape===2) return reglesVues.size >= REGLES.length
    if (etape===3) return quizOk
    if (etape===5) return !!signature
    return true
  }

  // CSS global
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .ic-root { font-family:'Space Grotesk',system-ui,sans-serif; }
    @keyframes float { from{transform:translateY(0) scale(1)} to{transform:translateY(-20px) scale(1.1)} }
    @keyframes icBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes icPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.05)} }
    @keyframes icSlideIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes icFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes icSpin { to{transform:rotate(360deg)} }
    @keyframes icBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(59,130,246,.3)} 50%{box-shadow:0 0 40px rgba(59,130,246,.6)} }
    .ic-slide { animation:icSlideIn .4s ease; }
    .ic-infra-card { transition:all .2s; cursor:pointer; }
    .ic-infra-card:hover { transform:translateY(-3px) scale(1.02); }
    .ic-regle-card { transition:all .2s; cursor:pointer; }
    .ic-regle-card:hover { transform:translateX(4px); }
    .ic-quiz-opt { transition:all .15s; cursor:pointer; }
    .ic-quiz-opt:hover { transform:scale(1.01); }
    .ic-btn { display:inline-flex;align-items:center;justify-content:center;gap:8px;
      font-family:'Space Grotesk',sans-serif;font-weight:700;border:none;cursor:pointer;
      border-radius:12px;transition:all .2s; }
    .ic-btn:active { transform:scale(.97); }
    .ic-btn-primary { background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;
      box-shadow:0 4px 20px rgba(59,130,246,.4); }
    .ic-btn-primary:hover { background:linear-gradient(135deg,#2563eb,#1e40af);
      box-shadow:0 6px 24px rgba(59,130,246,.6);transform:translateY(-1px); }
    .ic-btn-primary:disabled { background:#94a3b8;box-shadow:none;transform:none;cursor:not-allowed; }
    .ic-btn-ghost { background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2); }
    .ic-btn-ghost:hover { background:rgba(255,255,255,.15); }
    .ic-input { background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);
      border-radius:10px;padding:10px 14px;font-size:13px;color:#fff;
      font-family:'Space Grotesk',sans-serif;outline:none;width:100%;box-sizing:border-box; }
    .ic-input:focus { border-color:rgba(59,130,246,.6);background:rgba(255,255,255,.12); }
    .ic-input option { background:#1e293b;color:#fff; }
    select.ic-input option { background:#1e293b; }
  `

  // ── Écran certificat final ────────────────────────────────────────
  if (etape===5 && validated) {
    return (
      <div className="ic-root" style={{minHeight:'100vh',
        background:'linear-gradient(135deg,#0f172a,#1e3a8a,#0f172a)',
        display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <style>{css}</style>
        <div style={{maxWidth:520,width:'100%',textAlign:'center',animation:'icFadeIn .8s ease'}}>
          {/* Étoiles animées */}
          <div style={{fontSize:60,marginBottom:8,animation:'icBounce 2s ease infinite'}}>🏅</div>
          
          <div style={{background:'rgba(255,255,255,.05)',backdropFilter:'blur(20px)',
            border:'1px solid rgba(255,255,255,.15)',borderRadius:24,padding:40,
            boxShadow:'0 25px 60px rgba(0,0,0,.4)',animation:'glowPulse 3s ease infinite'}}>
            
            <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:'uppercase',
              color:'#94a3b8',marginBottom:16}}>CERTIFICAT D'INDUCTION CAMP</div>
            
            <div style={{fontSize:24,fontWeight:900,color:'#fff',marginBottom:6}}>{nomUser}</div>
            <div style={{fontSize:13,color:'#94a3b8',marginBottom:28}}>
              {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            </div>
            
            {/* Badge circulaire */}
            <div style={{display:'flex',justifyContent:'center',marginBottom:28}}>
              <ProgressRing pct={100} size={120} stroke={8} color='#10b981'>
                <div style={{fontSize:32}}>⛏️</div>
              </ProgressRing>
            </div>

            {/* Checklist */}
            <div style={{background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.3)',
              borderRadius:12,padding:16,textAlign:'left',marginBottom:24}}>
              {[
                '✅ 8 infrastructures du camp découvertes',
                '✅ 8 règles de vie lues et comprises',
                `✅ Quiz validé — ${quizScore}/${QUIZ.length} bonnes réponses`,
                `✅ ${appareils.length} appareil(s) énergivore(s) déclaré(s)`,
                '✅ Engagement signé électroniquement',
              ].map((l,i)=>(
                <div key={i} style={{fontSize:13,color:'#d1fae5',padding:'4px 0',
                  fontWeight:i===2?700:500}}>{l}</div>
              ))}
            </div>

            <div style={{background:'linear-gradient(135deg,#ffd400,#f59e0b)',
              borderRadius:12,padding:'14px 20px',marginBottom:24}}>
              <p style={{fontSize:14,fontWeight:800,color:'#1e3a8a',margin:0}}>
                🎉 Bienvenue au Camp Roxgold Sango !
              </p>
              <p style={{fontSize:12,color:'#1e3a8a',margin:'4px 0 0',fontWeight:500}}>
                Votre induction est complète. Bonne mission !
              </p>
            </div>

            <button className="ic-btn ic-btn-primary" style={{padding:'14px 32px',fontSize:15}}
              onClick={()=>window.location.href='/'}>
              Aller au Dashboard →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Écran chargement ─────────────────────────────────────────────
  if (loadingCheck) return (
    <div style={{minHeight:'100vh',background:'#0f172a',display:'flex',
      alignItems:'center',justifyContent:'center'}}>
      <div style={{textAlign:'center',color:'#94a3b8'}}>
        <div style={{fontSize:40,marginBottom:12}}>⏳</div>
        <div style={{fontSize:14}}>Vérification...</div>
      </div>
    </div>
  )

  // ── Vue Admin ─────────────────────────────────────────────────────
  if (isAdmin && adminView) return (
    <div style={{minHeight:'100vh',background:'#0f172a',color:'#fff',padding:24}}>
      <div style={{maxWidth:900,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
          <button onClick={()=>setAdminView(false)}
            style={{background:'rgba(255,255,255,.1)',border:'none',color:'#94a3b8',
              borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:13}}>
            ← Retour
          </button>
          <h1 style={{fontSize:20,fontWeight:800,margin:0}}>🏕️ Induction Camp — Vue Admin</h1>
          <span style={{marginLeft:'auto',background:'rgba(59,130,246,.2)',color:'#93c5fd',
            padding:'4px 12px',borderRadius:99,fontSize:12,fontWeight:600}}>
            {allInductions.length} dossier(s)
          </span>
        </div>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
          {[
            {l:'Total',v:allInductions.length,c:'#60a5fa'},
            {l:'Validés',v:allInductions.filter(r=>r.statut==='valide').length,c:'#34d399'},
            {l:'En cours',v:allInductions.filter(r=>r.statut==='en_cours').length,c:'#fbbf24'},
            {l:'Non commencé',v:allInductions.filter(r=>!r.statut||r.statut==='').length,c:'#f87171'},
          ].map(k=>(
            <div key={k.l} style={{background:'rgba(255,255,255,.05)',borderRadius:12,
              padding:'14px 16px',borderLeft:`3px solid ${k.c}`}}>
              <div style={{fontSize:24,fontWeight:900,color:k.c}}>{k.v}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:4,textTransform:'uppercase',letterSpacing:.5}}>{k.l}</div>
            </div>
          ))}
        </div>

        {/* Tableau */}
        <div style={{background:'rgba(255,255,255,.04)',borderRadius:12,overflow:'hidden',
          border:'1px solid rgba(255,255,255,.08)'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'rgba(255,255,255,.06)'}}>
                  {['Personnel','Statut','Progression','Appareils','Date','Actions'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:10,
                      fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:.5,
                      borderBottom:'1px solid rgba(255,255,255,.08)',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allInductions.map((r,i)=>{
                  const pct = r.progression || 0
                  const statusColor = r.statut==='valide'?'#34d399':r.statut==='en_cours'?'#fbbf24':'#64748b'
                  return (
                    <tr key={r.id} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                      <td style={{padding:'10px 14px',fontWeight:600,color:'#e2eaf6'}}>
                        {r.personnel_nom || `Personnel #${r.personnel}`}
                      </td>
                      <td style={{padding:'10px 14px'}}>
                        <span style={{background:`${statusColor}20`,color:statusColor,
                          padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>
                          {r.statut==='valide'?'✓ Validé':r.statut==='en_cours'?'En cours':'—'}
                        </span>
                      </td>
                      <td style={{padding:'10px 14px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{height:5,width:80,background:'rgba(255,255,255,.1)',
                            borderRadius:99,overflow:'hidden',flexShrink:0}}>
                            <div style={{height:'100%',width:`${pct}%`,borderRadius:99,
                              background:pct===100?'#34d399':pct>50?'#fbbf24':'#64748b'}}/>
                          </div>
                          <span style={{fontSize:11,color:'#94a3b8',fontFamily:'monospace'}}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{padding:'10px 14px',color:'#94a3b8',fontSize:12}}>
                        {r.etapes_data?.appareils?.length||0} déclaré(s)
                      </td>
                      <td style={{padding:'10px 14px',color:'#64748b',fontSize:11,whiteSpace:'nowrap'}}>
                        {r.date_validation
                          ? new Date(r.date_validation).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'})
                          : r.created_at
                          ? new Date(r.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
                          : '—'}
                      </td>
                      <td style={{padding:'10px 14px'}}>
                        {r.statut!=='valide' && (
                          <button onClick={async()=>{
                              await fetch(`${BASE}/api/induction-records/${r.id}/`, {
                                method:'PATCH',
                                headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok()}`},
                                body: JSON.stringify({statut:'valide'})
                              })
                              const d2 = await fetch(`${BASE}/api/induction-records/?page_size=200`,
                                {headers:{Authorization:`Bearer ${tok()}`}}).then(r=>r.json())
                              setAllInductions(d2.results||d2||[])
                            }}
                            style={{background:'rgba(52,211,153,.15)',color:'#10b981',
                              border:'1px solid rgba(52,211,153,.3)',borderRadius:7,
                              padding:'4px 10px',fontSize:11,cursor:'pointer',fontWeight:600}}>
                            ✓ Valider
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {allInductions.length===0 && (
                  <tr><td colSpan={6} style={{padding:30,textAlign:'center',color:'#64748b'}}>
                    Aucune induction enregistrée
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Déjà complété — afficher badge ───────────────────────────────
  if (dejaComplete) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e3a8a,#0f172a)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{maxWidth:500,width:'100%',textAlign:'center'}}>
        <div style={{fontSize:72,marginBottom:12,animation:'icBounce 2s ease infinite'}}>🏅</div>
        <div style={{background:'rgba(255,255,255,.06)',backdropFilter:'blur(20px)',
          border:'1px solid rgba(255,255,255,.12)',borderRadius:24,padding:36,
          boxShadow:'0 25px 60px rgba(0,0,0,.4)'}}>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:2,textTransform:'uppercase',
            color:'#64748b',marginBottom:14}}>CERTIFICAT D'INDUCTION CAMP</div>
          <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
            <div style={{width:80,height:80,borderRadius:'50%',
              background:'linear-gradient(135deg,#10b981,#059669)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,
              boxShadow:'0 0 30px rgba(16,185,129,.4)'}}>⛏️</div>
          </div>
          <div style={{fontSize:22,fontWeight:900,color:'#fff',marginBottom:6}}>{nomUser}</div>
          <div style={{fontSize:13,color:'#94a3b8',marginBottom:20}}>
            A complété l'induction du camp Roxgold Sango
          </div>
          <div style={{background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.25)',
            borderRadius:12,padding:'12px 16px',marginBottom:20,textAlign:'left'}}>
            {['✅ Infrastructures du camp découvertes',
              '✅ Règles de vie lues et acceptées',
              '✅ Quiz de validation réussi',
              '✅ Engagement signé électroniquement'
            ].map(l=>(
              <div key={l} style={{fontSize:12,color:'#6ee7b7',padding:'3px 0'}}>{l}</div>
            ))}
          </div>
          <div style={{background:'linear-gradient(135deg,#ffd400,#f59e0b)',
            borderRadius:10,padding:'10px 16px',marginBottom:20}}>
            <p style={{fontSize:13,fontWeight:800,color:'#1e3a8a',margin:0}}>
              🎉 Bienvenue — Induction validée !
            </p>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'center'}}>
            <button onClick={()=>window.location.href='/'}
              style={{background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',color:'#fff',
                border:'none',borderRadius:10,padding:'12px 24px',
                fontSize:14,fontWeight:700,cursor:'pointer'}}>
              Dashboard →
            </button>
            {isAdmin && (
              <button onClick={()=>setAdminView(true)}
                style={{background:'rgba(167,139,250,.2)',color:'#a78bfa',
                  border:'1px solid rgba(167,139,250,.3)',borderRadius:10,
                  padding:'12px 24px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                Vue Admin 👁️
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Layout principal ─────────────────────────────────────────────
  const bgGradients = [
    'linear-gradient(135deg,#0f172a 0%,#1e3a8a 50%,#0f172a 100%)',  // Bienvenue
    'linear-gradient(135deg,#0c1821 0%,#0f2942 50%,#0c1821 100%)',  // Infra
    'linear-gradient(135deg,#0f172a 0%,#1a0a2e 50%,#0f172a 100%)',  // Règles
    'linear-gradient(135deg,#0a1628 0%,#0f3460 50%,#0a1628 100%)',  // Quiz
    'linear-gradient(135deg,#0f172a 0%,#132a1f 50%,#0f172a 100%)',  // Appareils
    'linear-gradient(135deg,#0f172a 0%,#1a0f2a 50%,#0f172a 100%)',  // Signature
  ]

  return (
    <div className="ic-root" style={{minHeight:'100vh',
      background:bgGradients[etape],color:'#fff',
      transition:'background 0.6s ease'}}>
      <style>{css}</style>

      {/* Particules de fond */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',overflow:'hidden',zIndex:0}}>
        {Array.from({length:12},(_,i)=>(
          <Particle key={i} x={Math.random()*100} y={Math.random()*100}
            color={['#3b82f6','#8b5cf6','#10b981','#ffd400'][i%4]}
            size={3+Math.random()*4} delay={Math.random()*3}/>
        ))}
      </div>

      <div style={{position:'relative',zIndex:1,maxWidth:860,margin:'0 auto',padding:'20px 16px'}}>

        {/* ── HEADER ───────────────────────────────────────────── */}
        <div style={{marginBottom:24}}>
          {/* Logo & titre */}
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
            <div style={{width:42,height:42,borderRadius:12,
              background:'rgba(255,255,255,.1)',backdropFilter:'blur(10px)',
              border:'1px solid rgba(255,255,255,.2)',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
              🏕️
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:'#fff'}}>Induction du Camp</div>
              <div style={{fontSize:11,color:'#94a3b8'}}>Roxgold Sango · Bienvenue, {nomUser}</div>
            </div>
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
              {isAdmin && (
                <button onClick={()=>setAdminView(true)}
                  style={{background:'rgba(167,139,250,.2)',color:'#a78bfa',
                    border:'1px solid rgba(167,139,250,.3)',borderRadius:8,
                    padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                  👁️ Admin
                </button>
              )}
              <ProgressRing pct={progression} size={52} stroke={4} color='#3b82f6'>
                <span style={{fontSize:11,fontWeight:700,color:'#fff'}}>{progression}%</span>
              </ProgressRing>
            </div>
          </div>

          {/* Stepper */}
          <div style={{display:'flex',alignItems:'center',gap:0}}>
            {ETAPES.map((e,i)=>{
              const done  = i < etape
              const actif = i === etape
              return (
                <div key={i} style={{flex:1,display:'flex',alignItems:'center'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',
                    cursor:done?'pointer':'default',flex:'none'}}
                    onClick={()=>done&&setEtape(i)}>
                    <div style={{
                      width:32,height:32,borderRadius:'50%',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:12,fontWeight:700,
                      background: done?'#10b981':actif?'#3b82f6':'rgba(255,255,255,.1)',
                      color: '#fff',
                      border: actif?'2px solid rgba(59,130,246,.6)':'2px solid transparent',
                      boxShadow: actif?'0 0 0 4px rgba(59,130,246,.2)':done?'0 0 12px rgba(16,185,129,.4)':'none',
                      transition:'all .3s',
                    }}>
                      {done ? '✓' : i+1}
                    </div>
                    <div style={{fontSize:9,marginTop:4,fontWeight:600,
                      color:actif?'#93c5fd':done?'#6ee7b7':'#475569',
                      textAlign:'center',whiteSpace:'nowrap',
                      letterSpacing:.3,textTransform:'uppercase'}}>
                      {e}
                    </div>
                  </div>
                  {i < ETAPES.length-1 && (
                    <div style={{flex:1,height:2,margin:'0 4px 16px',
                      background:done?'#10b981':'rgba(255,255,255,.1)',
                      transition:'background .5s'}}/>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ══ ÉTAPE 0: BIENVENUE ═══════════════════════════════ */}
        {etape===0 && (
          <div className="ic-slide">
            {/* Hero */}
            <div style={{textAlign:'center',marginBottom:32,padding:'20px 0'}}>
              <div style={{fontSize:72,marginBottom:16,animation:'icBounce 3s ease infinite'}}>⛏️</div>
              <h1 style={{fontSize:28,fontWeight:900,margin:'0 0 8px',
                background:'linear-gradient(135deg,#fff,#93c5fd)',
                WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                Bienvenue au Camp
              </h1>
              <h2 style={{fontSize:14,color:'#94a3b8',fontWeight:400,margin:0}}>
                {CAMP.nom}
              </h2>
            </div>

            {/* Stats camp */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:28}}>
              {[
                {ic:'👥',val:CAMP.capacite,lbl:'Résidents'},
                {ic:'📐',val:CAMP.superficie,lbl:'Superficie'},
                {ic:'⛰️',val:CAMP.altitude,lbl:'Altitude'},
                {ic:'🔧',val:'8',lbl:'Services'},
              ].map(({ic,val,lbl})=>(
                <div key={lbl} style={{background:'rgba(255,255,255,.06)',
                  backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,.1)',
                  borderRadius:14,padding:'16px 12px',textAlign:'center'}}>
                  <div style={{fontSize:24,marginBottom:6}}>{ic}</div>
                  <div style={{fontSize:18,fontWeight:800,color:'#fff'}}>{val}</div>
                  <div style={{fontSize:10,color:'#64748b',textTransform:'uppercase',
                    letterSpacing:.5,marginTop:2}}>{lbl}</div>
                </div>
              ))}
            </div>

            {/* Parcours */}
            <div style={{background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.25)',
              borderRadius:16,padding:20,marginBottom:28}}>
              <div style={{fontSize:13,fontWeight:700,color:'#93c5fd',marginBottom:12}}>
                📋 Votre parcours d'induction — ~15 minutes
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[
                  {emoji:'🏗️',label:'Découvrir les 8 infrastructures'},
                  {emoji:'📜',label:'Lire les 8 règles de vie'},
                  {emoji:'🧠',label:'Passer le quiz (5 questions)'},
                  {emoji:'⚡',label:'Déclarer vos appareils {'>'}100W'},
                  {emoji:'✍️',label:'Signer votre engagement'},
                  {emoji:'🏅',label:'Obtenir votre certificat'},
                ].map(({emoji,label})=>(
                  <div key={label} style={{display:'flex',gap:8,alignItems:'center',
                    fontSize:12,color:'#cbd5e1'}}>
                    <span style={{fontSize:16}}>{emoji}</span>{label}
                  </div>
                ))}
              </div>
            </div>

            <button className="ic-btn ic-btn-primary"
              style={{width:'100%',padding:'16px',fontSize:16,borderRadius:14}}
              onClick={()=>setEtape(1)}>
              Commencer l'induction ✦
            </button>
          </div>
        )}

        {/* ══ ÉTAPE 1: INFRASTRUCTURES ════════════════════════ */}
        {etape===1 && (
          <div className="ic-slide">
            <div style={{textAlign:'center',marginBottom:20}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:'0 0 6px'}}>🏗️ Infrastructures du Camp</h2>
              <p style={{fontSize:13,color:'#94a3b8',margin:0}}>
                Explorez les 8 zones — cliquez pour en savoir plus
                <span style={{marginLeft:8,background:'rgba(59,130,246,.2)',padding:'2px 8px',
                  borderRadius:99,fontSize:11,color:'#93c5fd'}}>
                  {infrasVues.size}/{INFRAS.length} vues
                </span>
              </p>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {INFRAS.map(inf=>{
                const vue = infrasVues.has(inf.id)
                const sel = infraSel === inf.id
                return (
                  <div key={inf.id} className="ic-infra-card"
                    onClick={()=>voirInfra(inf.id)}
                    style={{
                      background: sel ? `${inf.couleur}22` : 'rgba(255,255,255,.05)',
                      border: `1.5px solid ${sel?inf.couleur:vue?`${inf.couleur}60`:'rgba(255,255,255,.1)'}`,
                      borderRadius:14,padding:'16px 12px',textAlign:'center',
                      boxShadow: sel ? `0 0 24px ${inf.couleur}40` : 'none',
                    }}>
                    <div style={{fontSize:28,marginBottom:8,
                      filter:!vue?'grayscale(0.5)':'none'}}>{inf.emoji}</div>
                    <div style={{fontSize:11,fontWeight:700,color:vue?inf.couleur:'#94a3b8'}}>
                      {inf.titre}
                    </div>
                    {vue && !sel && <div style={{fontSize:9,color:'#10b981',marginTop:4}}>✓ Vue</div>}
                  </div>
                )
              })}
            </div>

            {/* Détail infra sélectionnée */}
            {infraSel && (() => {
              const inf = INFRAS.find(i=>i.id===infraSel)
              return (
                <div className="ic-slide" style={{
                  background:`linear-gradient(135deg,${inf.couleur}18,${inf.couleur}08)`,
                  border:`1.5px solid ${inf.couleur}40`,borderRadius:16,
                  padding:20,marginBottom:16}}>
                  <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                    <div style={{fontSize:40,flexShrink:0}}>{inf.emoji}</div>
                    <div style={{flex:1}}>
                      <h3 style={{fontSize:17,fontWeight:800,color:inf.couleur,margin:'0 0 8px'}}>
                        {inf.titre}
                      </h3>
                      <p style={{fontSize:13,color:'#cbd5e1',margin:'0 0 12px',lineHeight:1.6}}>
                        {inf.desc}
                      </p>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {inf.details.map(d=>(
                          <span key={d} style={{background:`${inf.couleur}20`,color:inf.couleur,
                            padding:'4px 10px',borderRadius:99,fontSize:11,fontWeight:600}}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Progress & next */}
            <div style={{background:'rgba(255,255,255,.05)',borderRadius:12,
              padding:'12px 16px',marginBottom:16,display:'flex',
              alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:13,color:'#94a3b8'}}>
                {infrasVues.size < 4
                  ? `Visitez encore ${4-infrasVues.size} infrastructure(s) pour continuer`
                  : `${infrasVues.size}/${INFRAS.length} infrastructures visitées ✓`}
              </span>
              <div style={{height:6,width:120,background:'rgba(255,255,255,.1)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${infrasVues.size/INFRAS.length*100}%`,
                  background:'#10b981',borderRadius:99,transition:'width .4s'}}/>
              </div>
            </div>

            <button className="ic-btn ic-btn-primary"
              style={{width:'100%',padding:'14px',fontSize:15,borderRadius:14,
                opacity:canNext()?1:.5}}
              disabled={!canNext()}
              onClick={()=>setEtape(2)}>
              {canNext() ? 'Continuer → Règles du camp' : `Visitez encore ${Math.max(0,4-infrasVues.size)} zone(s)`}
            </button>
          </div>
        )}

        {/* ══ ÉTAPE 2: RÈGLES ══════════════════════════════════ */}
        {etape===2 && (
          <div className="ic-slide">
            <div style={{textAlign:'center',marginBottom:20}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:'0 0 6px'}}>📜 Règles de Vie du Camp</h2>
              <p style={{fontSize:13,color:'#94a3b8',margin:0}}>
                Cliquez sur chaque règle pour la lire — un quiz suivra
                <span style={{marginLeft:8,background:'rgba(139,92,246,.2)',padding:'2px 8px',
                  borderRadius:99,fontSize:11,color:'#c4b5fd'}}>
                  {reglesVues.size}/{REGLES.length} lues
                </span>
              </p>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
              {REGLES.map(r=>{
                const niv  = NIVEAUX[r.niveau]
                const lue  = reglesVues.has(r.id)
                const sel  = regleSel===r.id
                return (
                  <div key={r.id} className="ic-regle-card"
                    onClick={()=>voirRegle(r.id)}
                    style={{
                      background: sel ? `${niv.c}18` : 'rgba(255,255,255,.05)',
                      border: `1.5px solid ${sel?niv.c:lue?`${niv.c}50`:'rgba(255,255,255,.08)'}`,
                      borderRadius:12,padding:'12px 16px',
                      boxShadow: sel ? `0 0 20px ${niv.c}30` : 'none',
                    }}>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <span style={{fontSize:22,flexShrink:0}}>{r.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:13,fontWeight:700,color:lue?niv.c:'#e2e8f0'}}>
                            {r.titre}
                          </span>
                          <span style={{background:`${niv.c}25`,color:niv.c,
                            padding:'1px 7px',borderRadius:99,fontSize:9,fontWeight:700,
                            letterSpacing:.5,textTransform:'uppercase'}}>
                            {niv.label}
                          </span>
                          {lue && !sel && <span style={{color:'#10b981',fontSize:12}}>✓</span>}
                        </div>
                        {sel && (
                          <p style={{fontSize:12,color:'#cbd5e1',margin:'8px 0 0',lineHeight:1.6,
                            animation:'icFadeIn .2s ease'}}>
                            {r.texte}
                          </p>
                        )}
                      </div>
                      <div style={{fontSize:16,color:'#475569',flexShrink:0}}>
                        {sel?'▲':'▼'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="ic-btn ic-btn-primary"
              style={{width:'100%',padding:'14px',fontSize:15,borderRadius:14,
                opacity:canNext()?1:.5}}
              disabled={!canNext()}
              onClick={()=>setEtape(3)}>
              {canNext() ? 'J\'ai tout lu → Quiz de validation' : `Lisez encore ${REGLES.length-reglesVues.size} règle(s)`}
            </button>
          </div>
        )}

        {/* ══ ÉTAPE 3: QUIZ ════════════════════════════════════ */}
        {etape===3 && (
          <div className="ic-slide">
            <div style={{textAlign:'center',marginBottom:24}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:'0 0 6px'}}>🧠 Quiz de Validation</h2>
              <p style={{fontSize:13,color:'#94a3b8',margin:0}}>
                {QUIZ.length} questions · Toutes les bonnes réponses requises
              </p>
            </div>

            {quizOk ? (
              <div style={{textAlign:'center',padding:'32px 0',animation:'icFadeIn .5s ease'}}>
                <div style={{fontSize:64,marginBottom:16,animation:'icBounce 2s ease infinite'}}>🎉</div>
                <div style={{fontSize:20,fontWeight:800,color:'#10b981',marginBottom:8}}>
                  Quiz réussi ! {quizScore}/{QUIZ.length}
                </div>
                <div style={{fontSize:13,color:'#94a3b8',marginBottom:24}}>
                  Excellent ! Vous connaissez les règles du camp.
                </div>
                <button className="ic-btn ic-btn-primary"
                  style={{padding:'14px 32px',fontSize:15,borderRadius:14}}
                  onClick={()=>setEtape(4)}>
                  Continuer → Appareils énergivores
                </button>
              </div>
            ) : (
              <>
                <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:20}}>
                  {QUIZ.map((q,qi)=>{
                    const rep = quizRep[qi]
                    const correct = quizErr && rep!==undefined && rep===q.rep
                    const wrong   = quizErr && rep!==undefined && rep!==q.rep
                    return (
                      <div key={qi} style={{
                        background: wrong?'rgba(239,68,68,.08)':correct?'rgba(16,185,129,.08)':'rgba(255,255,255,.05)',
                        border: `1.5px solid ${wrong?'rgba(239,68,68,.4)':correct?'rgba(16,185,129,.4)':'rgba(255,255,255,.1)'}`,
                        borderRadius:14,padding:'16px',
                        boxShadow: wrong?'0 0 16px rgba(239,68,68,.15)':correct?'0 0 16px rgba(16,185,129,.15)':'none',
                      }}>
                        <div style={{fontSize:13,fontWeight:700,color:'#f1f5f9',marginBottom:12}}>
                          <span style={{color:'#64748b',fontFamily:'JetBrains Mono,monospace',
                            fontSize:11}}>{qi+1}/{QUIZ.length} </span>
                          {q.q}
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          {q.opts.map((opt,oi)=>{
                            const chosen = rep===oi
                            // bonne_reponse vient du résultat serveur (quizResult), jamais affiché avant validation
                            const detailQ = quizResult?.detail?.find(d => d.id === q.id)
                            const bonneReponseIdx = detailQ?.bonne_reponse ?? q.rep
                            const isRight = quizErr && oi===bonneReponseIdx
                            const isWrong = quizErr && chosen && oi!==bonneReponseIdx
                            return (
                              <label key={oi} className="ic-quiz-opt"
                                style={{
                                  display:'flex',alignItems:'center',gap:8,padding:'9px 12px',
                                  borderRadius:9,cursor:'pointer',
                                  background: isRight?'rgba(16,185,129,.2)':isWrong?'rgba(239,68,68,.2)':chosen?'rgba(59,130,246,.2)':'rgba(255,255,255,.04)',
                                  border: `1px solid ${isRight?'rgba(16,185,129,.5)':isWrong?'rgba(239,68,68,.5)':chosen?'rgba(59,130,246,.5)':'rgba(255,255,255,.08)'}`,
                                }}>
                                <input type="radio" name={`q${qi}`} checked={chosen}
                                  onChange={()=>setQuizRep(prev=>({...prev,[qi]:oi}))}
                                  style={{accentColor:'#3b82f6'}}/>
                                <span style={{fontSize:12,color: isRight?'#6ee7b7':isWrong?'#fca5a5':chosen?'#93c5fd':'#cbd5e1'}}>
                                  {opt}
                                </span>
                                {isRight && <span style={{marginLeft:'auto',color:'#10b981'}}>✓</span>}
                                {isWrong && <span style={{marginLeft:'auto',color:'#ef4444'}}>✗</span>}
                              </label>
                            )
                          })}
                        </div>
                        {quizErr && wrong && (
                          <div style={{marginTop:10,padding:'8px 12px',
                            background:'rgba(59,130,246,.1)',borderRadius:8,
                            fontSize:11,color:'#93c5fd'}}>
                            💡 {q.explication}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {quizErr && !quizOk && (
                  <div style={{background:'rgba(239,68,68,.12)',border:'1px solid rgba(239,68,68,.3)',
                    borderRadius:12,padding:'12px 16px',marginBottom:12,textAlign:'center'}}>
                    <div style={{fontSize:13,color:'#fca5a5',fontWeight:600}}>
                      {quizScore}/{QUIZ.length} correctes — Corrigez les réponses en rouge
                    </div>
                  </div>
                )}

                <div style={{display:'flex',gap:8}}>
                  <button className="ic-btn ic-btn-ghost"
                    style={{flex:'none',padding:'12px 20px',fontSize:13}}
                    onClick={()=>{setEtape(2);setQuizRep({});setQuizErr(false)}}>
                    ← Revoir les règles
                  </button>
                  <button className="ic-btn ic-btn-primary"
                    style={{flex:1,padding:'12px',fontSize:14,borderRadius:12}}
                    onClick={validerQuiz}>
                    {quizErr ? '🔄 Réessayer' : '✓ Valider le quiz'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ ÉTAPE 4: APPAREILS ═══════════════════════════════ */}
        {etape===4 && (
          <div className="ic-slide">
            <div style={{textAlign:'center',marginBottom:20}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:'0 0 6px'}}>⚡ Appareils Énergivores</h2>
              <p style={{fontSize:13,color:'#94a3b8',margin:0}}>
                Tout appareil de plus de 100W doit être déclaré
              </p>
            </div>

            {/* Alerte */}
            <div style={{background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.3)',
              borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',gap:10}}>
              <span style={{fontSize:20}}>⚠️</span>
              <div style={{fontSize:12,color:'#fcd34d',lineHeight:1.5}}>
                <strong>Obligatoire</strong> — Les appareils non déclarés seront confisqués.
                La déclaration est gratuite et protège votre équipement.
              </div>
            </div>

            {/* Liste appareils déclarés */}
            {appareils.length > 0 && (
              <div style={{marginBottom:14}}>
                {appareils.map((a,i)=>(
                  <div key={a.id||i} style={{display:'flex',gap:10,alignItems:'center',
                    background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.25)',
                    borderRadius:10,padding:'10px 14px',marginBottom:6}}>
                    <span style={{fontSize:20}}>🔌</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:'#6ee7b7'}}>{a.type}</div>
                      <div style={{fontSize:11,color:'#94a3b8'}}>
                        {[a.marque,a.modele,a.puissance?a.puissance+'W':'',a.chambre?'Ch.'+a.chambre:''].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span style={{background:'rgba(16,185,129,.2)',color:'#10b981',
                      padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700}}>
                      Déclaré ✓
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire */}
            {showFormApp ? (
              <div style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(59,130,246,.3)',
                borderRadius:14,padding:18,marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:700,color:'#93c5fd',marginBottom:14}}>
                  Nouvel appareil
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div style={{gridColumn:'span 2'}}>
                    <label style={{fontSize:10,fontWeight:700,color:'#64748b',
                      textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>
                      Type *
                    </label>
                    <select value={formApp.type} className="ic-input"
                      onChange={e=>setFormApp(p=>({...p,type:e.target.value}))}>
                      <option value="">Sélectionner...</option>
                      {APPAREILS_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {[['Marque','marque','Philips, Samsung...'],
                    ['Modèle','modele','AC-1200...'],
                    ['Puissance (W)','puissance','ex: 1500'],
                    ['N° Chambre','chambre','ex: A-204']].map(([l,k,ph])=>(
                    <div key={k}>
                      <label style={{fontSize:10,fontWeight:700,color:'#64748b',
                        textTransform:'uppercase',letterSpacing:.5,display:'block',marginBottom:4}}>
                        {l}
                      </label>
                      <input value={formApp[k]} placeholder={ph} className="ic-input"
                        onChange={e=>setFormApp(p=>({...p,[k]:e.target.value}))}/>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:8,marginTop:14}}>
                  <button className="ic-btn ic-btn-primary"
                    style={{flex:1,padding:'10px',fontSize:13}}
                    onClick={ajouterAppareil} disabled={!formApp.type}>
                    ✓ Déclarer
                  </button>
                  <button className="ic-btn ic-btn-ghost"
                    style={{padding:'10px 16px',fontSize:13}}
                    onClick={()=>setShowFormApp(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button className="ic-btn ic-btn-ghost"
                style={{width:'100%',padding:'14px',fontSize:13,borderRadius:12,
                  marginBottom:14,borderStyle:'dashed'}}
                onClick={()=>setShowFormApp(true)}>
                + Déclarer un appareil énergivore
              </button>
            )}

            <div style={{display:'flex',gap:8}}>
              {appareils.length===0 && (
                <button className="ic-btn ic-btn-ghost"
                  style={{flex:1,padding:'12px',fontSize:13,borderRadius:12}}
                  onClick={()=>setEtape(5)}>
                  Je n'ai pas d'appareil {'>'}100W →
                </button>
              )}
              {appareils.length>0 && (
                <button className="ic-btn ic-btn-primary"
                  style={{flex:1,padding:'12px',fontSize:14,borderRadius:12}}
                  onClick={()=>setEtape(5)}>
                  {appareils.length} appareil(s) déclaré(s) → Continuer
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ ÉTAPE 5: SIGNATURE ═══════════════════════════════ */}
        {etape===5 && !validated && (
          <div className="ic-slide">
            <div style={{textAlign:'center',marginBottom:24}}>
              <h2 style={{fontSize:22,fontWeight:800,margin:'0 0 6px'}}>✍️ Engagement & Signature</h2>
              <p style={{fontSize:13,color:'#94a3b8',margin:0}}>
                Signez pour finaliser votre induction
              </p>
            </div>

            {/* Récapitulatif */}
            <div style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',
              borderRadius:14,padding:18,marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:'#94a3b8',
                textTransform:'uppercase',letterSpacing:.5,marginBottom:12}}>
                Récapitulatif de votre induction
              </div>
              {[
                {ic:'🏗️',l:`${infrasVues.size}/${INFRAS.length} infrastructures visitées`,
                 ok:infrasVues.size>=4},
                {ic:'📜',l:`${reglesVues.size}/${REGLES.length} règles lues`,ok:reglesVues.size===REGLES.length},
                {ic:'🧠',l:`Quiz validé — ${quizScore}/${QUIZ.length}`,ok:quizOk},
                {ic:'⚡',l:`${appareils.length} appareil(s) déclaré(s)`,ok:true},
              ].map(({ic,l,ok})=>(
                <div key={l} style={{display:'flex',gap:8,alignItems:'center',
                  padding:'5px 0',fontSize:12,color:ok?'#e2e8f0':'#94a3b8'}}>
                  <span>{ic}</span>
                  <span style={{flex:1}}>{l}</span>
                  <span style={{color:ok?'#10b981':'#64748b'}}>{ok?'✓':'…'}</span>
                </div>
              ))}
            </div>

            {/* Texte engagement */}
            <div style={{background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.2)',
              borderRadius:12,padding:'14px 16px',marginBottom:16,
              fontSize:12,color:'#93c5fd',lineHeight:1.7}}>
              Je soussigné(e), <strong style={{color:'#fff'}}>{nomUser}</strong>, certifie avoir pris
              connaissance de l'ensemble des règles de vie du camp résidentiel Roxgold Sango,
              m'engage à les respecter et à signaler tout manquement à la direction.
            </div>

            {/* Canvas signature */}
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:700,color:'#64748b',
                textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>
                Votre signature
              </div>
              <div style={{border:'1.5px solid rgba(255,255,255,.2)',borderRadius:12,
                background:'rgba(255,255,255,.03)',overflow:'hidden',
                boxShadow:signature?'0 0 20px rgba(59,130,246,.2)':'none'}}>
                <canvas ref={canvasRef} width={800} height={180}
                  style={{width:'100%',height:180,touchAction:'none',display:'block',cursor:'crosshair'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                <span style={{fontSize:11,color:'#475569'}}>
                  {signature ? '✓ Signature enregistrée' : 'Signez dans la zone ci-dessus'}
                </span>
                <button onClick={clearCanvas}
                  style={{background:'transparent',color:'#ef4444',border:'1px solid rgba(239,68,68,.3)',
                    borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                  Effacer
                </button>
              </div>
            </div>

            <button className="ic-btn ic-btn-primary"
              style={{width:'100%',padding:'16px',fontSize:16,borderRadius:14,
                background:signature?'linear-gradient(135deg,#10b981,#059669)':'#334155',
                boxShadow:signature?'0 4px 24px rgba(16,185,129,.4)':'none',
                opacity:signature?1:.6}}
              disabled={!signature||saving}
              onClick={soumettre}>
              {saving ? '⏳ Finalisation...' : signature ? '🎉 Finaliser mon induction →' : 'Signez d\'abord pour continuer'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
