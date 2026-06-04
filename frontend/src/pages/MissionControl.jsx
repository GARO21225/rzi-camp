import { useState, useEffect, useCallback, useRef } from 'react'

const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const tok  = () => localStorage.getItem('access_token') || ''
const hdrs = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' })
const api  = (path, opts) => fetch(`${BASE}${path}`, { headers: hdrs(), ...opts })

// ── Palette & Config ────────────────────────────────────────────────
const C = {
  bg:     '#060d1f',
  panel:  '#0b1628',
  border: 'rgba(96,165,250,.14)',
  glow:   'rgba(96,165,250,.35)',
  text:   '#e2eaf6',
  muted:  '#4b6080',
  accent: '#60a5fa',
  green:  '#34d399',
  amber:  '#fbbf24',
  red:    '#f87171',
  purple: '#a78bfa',
  cyan:   '#22d3ee',
}

const ST_CFG = {
  planifie:  { l:'Planifié',     c:C.accent,  dot:'#3b82f6' },
  en_voyage: { l:'En transit',   c:C.amber,   dot:C.amber   },
  retour:    { l:'Retour camp',  c:C.green,   dot:C.green   },
  annule:    { l:'Annulé',       c:C.red,     dot:C.red     },
}

const TYPE_VEH = [
  { id:'BUS',    ic:'🚌', label:'Bus' },
  { id:'4WD',    ic:'🚙', label:'4×4' },
  { id:'AVION',  ic:'✈️', label:'Vol' },
  { id:'HELICO', ic:'🚁', label:'Hélico' },
  { id:'BATEAU', ic:'⛵', label:'Bateau' },
]

function fmt(iso, opts={day:'2-digit',month:'short'}) {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', opts) : '—'
}
function toISO(d) { return d.toISOString().slice(0,10) }
function addDays(d, n) { const r=new Date(d); r.setDate(r.getDate()+n); return r }

// ── Micro composants UI ─────────────────────────────────────────────
function Panel({ children, style={}, glow=false }) {
  return (
    <div style={{
      background: C.panel,
      border: `0.5px solid ${glow ? C.glow : C.border}`,
      borderRadius: 12,
      position: 'relative',
      overflow: 'hidden',
      ...style
    }}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent,${glow?C.glow:C.border},transparent)`}}/>
      {children}
    </div>
  )
}

function Label({ children, style={} }) {
  return (
    <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,fontWeight:600,
      letterSpacing:1.5,textTransform:'uppercase',color:C.muted,
      marginBottom:8,display:'flex',alignItems:'center',gap:6,...style}}>
      <span style={{display:'inline-block',width:3,height:10,
        background:C.accent,borderRadius:2,flexShrink:0}}/>
      {children}
    </div>
  )
}

function Kpi({ icon, label, value, color=C.accent, sub, glow=false }) {
  return (
    <Panel glow={glow} style={{padding:'14px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <Label>{label}</Label>
          <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:30,
            fontWeight:700,color,lineHeight:1}}>{value}</div>
          {sub && <div style={{fontSize:10,color:C.muted,marginTop:4}}>{sub}</div>}
        </div>
        <div style={{fontSize:22,opacity:.6}}>{icon}</div>
      </div>
    </Panel>
  )
}

function Badge({ children, color=C.accent, small=false }) {
  return (
    <span style={{
      background: color + '18', color,
      border: `0.5px solid ${color}40`,
      padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 99,
      fontSize: small ? 9 : 10,
      fontWeight: 700,
      letterSpacing: .3,
      display:'inline-flex', alignItems:'center', gap:3,
      whiteSpace:'nowrap',
    }}>{children}</span>
  )
}

function StatusBadge({ statut }) {
  const cfg = ST_CFG[statut] || ST_CFG.planifie
  return <Badge color={cfg.c}>{cfg.l}</Badge>
}

function LiveDot({ color=C.green }) {
  return (
    <span style={{width:6,height:6,borderRadius:'50%',background:color,
      display:'inline-block',flexShrink:0,
      boxShadow:`0 0 6px ${color}`,
      animation:'mcPulse 1.4s ease-in-out infinite'}}/>
  )
}

// ── Clock ───────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const day = n.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})
      const time = [n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':')
      setT(`${day} · ${time}`)
    }
    tick(); const iv = setInterval(tick,1000); return ()=>clearInterval(iv)
  },[])
  return <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:12,color:C.text,letterSpacing:1}}>{t}</span>
}

// ── Flow SVG animé ──────────────────────────────────────────────────
function FlowMap({ stats }) {
  const dep = stats.planifies || 0
  const en  = stats.en_voyage || 0
  const ret = stats.retours   || 0
  return (
    <div style={{position:'relative',height:180}}>
      <svg viewBox="0 0 320 180" style={{width:'100%',height:'100%'}} aria-label="Carte flux rotations">
        <defs>
          <filter id="glow-blue"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glow-green"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Villes */}
        {/* Abidjan */}
        <circle cx="40" cy="90" r="12" fill="rgba(96,165,250,.12)" stroke="#60a5fa" strokeWidth="1.5" filter="url(#glow-blue)"/>
        <circle cx="40" cy="90" r="4" fill="#60a5fa"/>
        <text x="40" y="114" textAnchor="middle" fontSize="8" fill={C.muted} fontFamily="JetBrains Mono" letterSpacing="0.5">ABIDJAN</text>

        {/* Camp */}
        <circle cx="200" cy="70" r="16" fill="rgba(96,165,250,.2)" stroke="#60a5fa" strokeWidth="2" filter="url(#glow-blue)"/>
        <circle cx="200" cy="70" r="5" fill="#60a5fa"/>
        <circle cx="200" cy="70" r="20" fill="none" stroke="rgba(96,165,250,.25)" strokeWidth="1">
          <animate attributeName="r" values="16;24;16" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".5;0;.5" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <text x="200" y="54" textAnchor="middle" fontSize="9" fill={C.accent} fontFamily="JetBrains Mono" fontWeight="700">CAMP</text>

        {/* Mine */}
        <circle cx="280" cy="130" r="10" fill="rgba(251,191,36,.12)" stroke={C.amber} strokeWidth="1.5"/>
        <circle cx="280" cy="130" r="3" fill={C.amber}/>
        <text x="280" y="150" textAnchor="middle" fontSize="8" fill={C.muted} fontFamily="JetBrains Mono" letterSpacing="0.5">MINE</text>

        {/* Aéroport */}
        <circle cx="60" cy="30" r="8" fill="rgba(34,211,238,.1)" stroke={C.cyan} strokeWidth="1.2"/>
        <circle cx="60" cy="30" r="2.5" fill={C.cyan}/>
        <text x="60" y="18" textAnchor="middle" fontSize="7" fill={C.muted} fontFamily="JetBrains Mono">AÉROPORT</text>

        {/* Flux Abidjan → Camp */}
        <path d="M 52 90 Q 120 55 188 70" stroke="rgba(96,165,250,.2)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
        {dep > 0 && <>
          <circle r="3.5" fill={C.accent} opacity=".9" filter="url(#glow-blue)">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 52 90 Q 120 55 188 70"/>
          </circle>
          <circle r="3.5" fill={C.accent} opacity=".5">
            <animateMotion dur="2.8s" begin="1.4s" repeatCount="indefinite" path="M 52 90 Q 120 55 188 70"/>
          </circle>
        </>}
        {/* Badge départs */}
        <rect x="88" y="56" width="36" height="14" rx="3" fill="rgba(96,165,250,.15)" stroke="rgba(96,165,250,.3)" strokeWidth="0.5"/>
        <text x="106" y="66" textAnchor="middle" fontSize="8" fill={C.accent} fontFamily="JetBrains Mono" fontWeight="700">{dep} dép.</text>

        {/* Flux Camp → Mine */}
        <path d="M 210 78 Q 250 90 272 128" stroke="rgba(251,191,36,.15)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
        {en > 0 && <circle r="3" fill={C.amber} opacity=".85">
          <animateMotion dur="3.5s" repeatCount="indefinite" path="M 210 78 Q 250 90 272 128"/>
        </circle>}

        {/* Flux Retour Camp → Abidjan */}
        <path d="M 188 76 Q 120 80 52 96" stroke="rgba(52,211,153,.12)" strokeWidth="1" fill="none" strokeDasharray="3 4"/>
        {ret > 0 && <circle r="2.5" fill={C.green} opacity=".8">
          <animateMotion dur="3.8s" begin="1.5s" repeatCount="indefinite" path="M 188 76 Q 120 80 52 96"/>
        </circle>}

        {/* Aéroport → Camp */}
        <path d="M 66 32 Q 130 28 188 65" stroke="rgba(34,211,238,.12)" strokeWidth="1" fill="none" strokeDasharray="3 5"/>
        <circle r="2.5" fill={C.cyan} opacity=".7">
          <animateMotion dur="4.5s" begin="2s" repeatCount="indefinite" path="M 66 32 Q 130 28 188 65"/>
        </circle>
      </svg>

      {/* Stats overlay */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,
        display:'flex',gap:8,justifyContent:'center'}}>
        {[{l:'Départs',v:dep,c:C.accent},{l:'En route',v:en,c:C.amber},{l:'Retours',v:ret,c:C.green}].map(k=>(
          <div key={k.l} style={{background:`${k.c}12`,border:`0.5px solid ${k.c}30`,
            borderRadius:6,padding:'5px 10px',textAlign:'center',minWidth:60}}>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:16,fontWeight:700,color:k.c}}>{k.v}</div>
            <div style={{fontSize:8,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>{k.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Seat Map ────────────────────────────────────────────────────────
function SeatMap({ total=15, passagers=[], onBook, canBook=true }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
      {Array.from({length:total},(_,i)=>{
        const p = passagers[i]
        return (
          <div key={i}
            onClick={()=>!p && canBook && onBook && onBook(i)}
            title={p ? `${p.personnel__nom||''} ${p.personnel__prenom||''}` : 'Siège libre'}
            style={{
              width:24,height:24,borderRadius:5,
              background: p ? `${C.accent}22` : 'transparent',
              border: `1.5px solid ${p ? C.accent : C.border}`,
              cursor: !p && canBook ? 'pointer' : 'default',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:8,fontWeight:700,
              color: p ? C.accent : C.muted,
              transition:'all .15s',
            }}
            onMouseEnter={e=>!p&&canBook&&(e.currentTarget.style.borderColor=C.green,e.currentTarget.style.background=`${C.green}15`)}
            onMouseLeave={e=>!p&&(e.currentTarget.style.borderColor=C.border,e.currentTarget.style.background='transparent')}>
            {p ? '●' : '○'}
          </div>
        )
      })}
    </div>
  )
}

// ── Gantt Bar ───────────────────────────────────────────────────────
function GanttBar({ voyage, days, onClick }) {
  const cfg = ST_CFG[voyage.statut] || ST_CFG.planifie
  const dep = voyage.date_depart || ''
  const ret = voyage.date_retour_prevue || dep
  return (
    <tr style={{borderBottom:`1px solid ${C.border}`}}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(96,165,250,.04)'}
      onMouseLeave={e=>e.currentTarget.style.background=''}>
      <td style={{padding:'7px 12px',minWidth:160,maxWidth:180,
        position:'sticky',left:0,background:C.panel,zIndex:1}}>
        <div style={{fontWeight:600,fontSize:12,color:C.text,
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {voyage.personnel_nom || voyage.personnel__nom || '—'}
        </div>
        <div style={{fontSize:9,color:C.muted,marginTop:1}}>
          {voyage.vehicule || voyage.destination || '—'}
        </div>
      </td>
      {days.map((day,i)=>{
        const iso = toISO(day)
        const isOn = iso >= dep && iso <= ret
        const isDep = iso === dep
        const isRet = iso === ret
        const isTod = iso === toISO(new Date())
        return (
          <td key={i} style={{padding:0,width:32,minWidth:32,
            background:isTod?'rgba(96,165,250,.06)':'transparent',
            borderLeft:`1px solid ${isTod?C.accent+'40':C.border}`}}>
            {isOn ? (
              <div onClick={()=>onClick(voyage)}
                style={{
                  height:26,margin:'2px 1px',
                  background: isDep||isRet ? cfg.c : cfg.c+'20',
                  borderRadius: isDep ? '5px 0 0 5px' : isRet ? '0 5px 5px 0' : 0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  cursor:'pointer',fontSize:11,fontWeight:700,
                  color: isDep||isRet ? '#fff' : cfg.c,
                  boxShadow: isDep ? `0 0 6px ${cfg.c}60` : 'none',
                }}>
                {isDep ? '↗' : isRet ? '↙' : ''}
              </div>
            ) : <div style={{height:26,margin:'2px 1px'}}/>}
          </td>
        )
      })}
      <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>
        <StatusBadge statut={voyage.statut}/>
      </td>
    </tr>
  )
}

// ════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════════════
export default function MissionControl() {
  const [view,       setView]      = useState('command')
  const [voyages,    setVoyages]   = useState([])
  const [rotations,  setRotations] = useState([])
  const [personnel,  setPersonnel] = useState([])
  const [stats,      setStats]     = useState({})
  const [loading,    setLoading]   = useState(true)
  const [weekOff,    setWeekOff]   = useState(0)
  const [selVoyage,  setSelVoyage] = useState(null)
  const [selRot,     setSelRot]    = useState(null)
  const [showCreate, setShowCreate]= useState(false) // 'rotation' | 'individuel' | null
  const [msg,        setMsg]       = useState(null)
  const [saving,     setSaving]    = useState(false)

  // Formulaires
  const [formRot, setFormRot] = useState({
    destination:'Abidjan', vehicule:'BUS', numero_veh:'01',
    date_depart:'', date_retour_prevue:'', nb_places_total:15,
    heure_depart:'06:00', point_rdv:'Entrée camp', motif:'', type_voyage:'rotation',
    passagers:[],
  })
  const [formJoin, setFormJoin] = useState({ personnel_id:'', rotation_id:'' })

  // ── Load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rv, rs, rp, rr] = await Promise.allSettled([
        api('/api/voyages/?page_size=200').then(r=>r.json()),
        api('/api/voyages/stats/').then(r=>r.json()),
        api('/api/personnel/?page_size=500&actif=true').then(r=>r.json()),
        api('/api/voyages/rotations/').then(r=>r.json()),
      ])
      if (rv.status==='fulfilled') setVoyages(rv.value?.results||rv.value||[])
      if (rs.status==='fulfilled') setStats(rs.value||{})
      if (rp.status==='fulfilled') setPersonnel(rp.value?.results||rp.value||[])
      if (rr.status==='fulfilled') setRotations(rr.value?.rotations||[])
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(()=>{ load() },[load])
  useEffect(()=>{ const iv=setInterval(load,30000); return()=>clearInterval(iv) },[load])

  // ── Actions ───────────────────────────────────────────────────────
  const flash = (text, ok=true) => {
    setMsg({text,ok})
    setTimeout(()=>setMsg(null),3000)
  }

  const creerRotation = async () => {
    if (!formRot.date_depart || !formRot.date_retour_prevue) return flash('Dates requises',false)
    setSaving(true)
    try {
      const vehicule = `${formRot.vehicule}-${formRot.numero_veh}`
      const res = await api('/api/voyages/creer_rotation/', {
        method:'POST',
        body: JSON.stringify({
          ...formRot, vehicule,
          passagers: formRot.passagers,
        })
      })
      const data = await res.json()
      if (res.ok) {
        flash(`Rotation ${data.rotation_id} créée · ${data.voyages_crees} passager(s)`)
        setShowCreate(null)
        setFormRot({destination:'Abidjan',vehicule:'BUS',numero_veh:'01',
          date_depart:'',date_retour_prevue:'',nb_places_total:15,
          heure_depart:'06:00',point_rdv:'Entrée camp',motif:'',type_voyage:'rotation',passagers:[]})
        load()
      } else flash(data.error||'Erreur',false)
    } catch(e) { flash('Erreur réseau',false) }
    setSaving(false)
  }

  const rejoindreRotation = async (rotationId, personnelId) => {
    if (!personnelId) return flash('Sélectionner un passager',false)
    setSaving(true)
    try {
      const res = await api('/api/voyages/rejoindre_rotation/', {
        method:'POST',
        body: JSON.stringify({rotation_id:rotationId, personnel_id:personnelId})
      })
      const data = await res.json()
      if (res.ok) { flash('Siège réservé ✓'); load() }
      else flash(data.error||'Erreur',false)
    } catch(e) { flash('Erreur réseau',false) }
    setSaving(false)
  }

  const changerStatut = async (id, action) => {
    try {
      await api(`/api/voyages/${id}/${action}/`, {method:'POST'})
      flash(`Statut mis à jour`)
      load()
    } catch(e) { flash('Erreur',false) }
  }

  const partirRotation = async (rotId) => {
    try {
      await api('/api/voyages/partir_rotation/',{method:'POST',body:JSON.stringify({rotation_id:rotId})})
      flash('Rotation en transit ✈️'); load()
    } catch(e) { flash('Erreur',false) }
  }

  const retourRotation = async (rotId) => {
    try {
      await api('/api/voyages/retour_rotation/',{method:'POST',body:JSON.stringify({rotation_id:rotId})})
      flash('Rotation revenue 🏠'); load()
    } catch(e) { flash('Erreur',false) }
  }

  // Gantt
  const today = toISO(new Date())
  const ganttStart = addDays(new Date(), weekOff*14)
  ganttStart.setDate(ganttStart.getDate() - ganttStart.getDay() + 1)
  const days = Array.from({length:14},(_,i)=>addDays(ganttStart,i))

  const fmtW = d => d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})

  // Voyages visibles dans la fenêtre gantt
  const ganttVoyages = voyages.filter(v=>{
    const dep = v.date_depart||'', ret = v.date_retour_prevue||dep
    return dep <= toISO(days[13]) && ret >= toISO(days[0])
  })

  // Stats today
  const todayStr = today
  const departs  = voyages.filter(v=>v.date_depart===todayStr)
  const retours  = voyages.filter(v=>v.date_retour_prevue===todayStr && v.statut==='en_voyage')
  const absents  = voyages.filter(v=>v.statut==='en_voyage')

  // CSS global
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .mc-root { background:${C.bg}; color:${C.text}; font-family:'Space Grotesk',system-ui,sans-serif; min-height:100vh; }
    .mc-root::before { content:''; position:fixed; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(96,165,250,.018) 2px,rgba(96,165,250,.018) 4px); pointer-events:none; z-index:0; }
    .mc-inner { position:relative; z-index:1; padding:14px 18px; }
    .mc-tab { padding:7px 18px; border-radius:7px; border:none; cursor:pointer; font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:600; transition:all .15s; }
    .mc-tab.active { background:${C.accent}; color:${C.bg}; box-shadow:0 0 12px ${C.accent}50; }
    .mc-tab:not(.active) { background:rgba(96,165,250,.07); color:${C.muted}; }
    .mc-tab:not(.active):hover { background:rgba(96,165,250,.13); color:${C.text}; }
    .mc-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:700; transition:all .15s; }
    .mc-btn-primary { background:${C.accent}; color:${C.bg}; box-shadow:0 0 12px ${C.accent}40; }
    .mc-btn-primary:hover { background:#93c5fd; }
    .mc-btn-ghost { background:rgba(96,165,250,.08); color:${C.accent}; border:0.5px solid ${C.border}; }
    .mc-btn-ghost:hover { background:rgba(96,165,250,.15); }
    .mc-btn-danger { background:rgba(248,113,113,.12); color:${C.red}; border:0.5px solid rgba(248,113,113,.3); }
    .mc-btn-success { background:rgba(52,211,153,.12); color:${C.green}; border:0.5px solid rgba(52,211,153,.3); }
    .mc-input { background:rgba(255,255,255,.05); border:0.5px solid ${C.border}; borderRadius:8px; padding:8px 12px; fontSize:13px; color:${C.text}; fontFamily:'Space Grotesk',sans-serif; outline:none; width:100%; }
    .mc-input:focus { border-color:${C.accent}60; }
    @keyframes mcPulse { 0%,100%{opacity:1} 50%{opacity:.2} }
    @keyframes mcFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .mc-fade { animation:mcFadeIn .25s ease; }
    .mc-row:hover { background:rgba(96,165,250,.04) !important; }
    select.mc-input option { background:#0b1628; color:#e2eaf6; }
  `

  const inputStyle = {
    background:'rgba(255,255,255,.05)',border:`0.5px solid ${C.border}`,
    borderRadius:8,padding:'8px 12px',fontSize:13,color:C.text,
    fontFamily:'Space Grotesk,sans-serif',outline:'none',width:'100%',
    boxSizing:'border-box',
  }
  const labelStyle = {
    fontSize:10,fontWeight:600,color:C.muted,display:'block',
    marginBottom:4,textTransform:'uppercase',letterSpacing:.5,
  }

  return (
    <div className="mc-root">
      <style>{css}</style>

      {/* TOAST */}
      {msg && (
        <div className="mc-fade" style={{position:'fixed',top:20,right:20,zIndex:9999,
          padding:'10px 20px',borderRadius:10,fontWeight:700,fontSize:13,
          background:msg.ok?'rgba(52,211,153,.15)':'rgba(248,113,113,.15)',
          color:msg.ok?C.green:C.red,
          border:`1px solid ${msg.ok?C.green:C.red}40`,
          boxShadow:`0 8px 24px ${msg.ok?C.green:C.red}20`}}>
          {msg.ok?'✓':'✗'} {msg.text}
        </div>
      )}

      <div className="mc-inner">

        {/* ── TOPBAR ─────────────────────────────────────────────── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          marginBottom:14,paddingBottom:12,
          borderBottom:`0.5px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            {/* Logo */}
            <div style={{width:38,height:38,border:`1px solid ${C.accent}`,
              borderRadius:9,display:'flex',alignItems:'center',
              justifyContent:'center',position:'relative',flexShrink:0}}>
              <div style={{position:'absolute',inset:4,border:`1px solid ${C.accent}40`,
                borderRadius:5,animation:'mcPulse 2.5s ease-in-out infinite'}}/>
              <span style={{fontSize:18}}>⛏️</span>
            </div>
            <div>
              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:12,fontWeight:600,
                letterSpacing:2,textTransform:'uppercase',color:C.accent}}>
                Mission Control · RZI Camp
              </div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:.5,marginTop:1}}>
                Rotations · Voyages · Fleet Operations
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:4,background:`rgba(96,165,250,.05)`,
            borderRadius:10,padding:4}}>
            {[
              ['command','🛰️ Command'],
              ['rotations','🚀 Rotations'],
              ['gantt','📅 Gantt'],
              ['manifest','📋 Manifest'],
            ].map(([v,l])=>(
              <button key={v} className={`mc-tab ${view===v?'active':''}`}
                onClick={()=>setView(v)}>{l}</button>
            ))}
          </div>

          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,
              color:C.green,letterSpacing:1,textTransform:'uppercase'}}>
              <LiveDot/>LIVE
            </div>
            <Clock/>
            <button className="mc-btn mc-btn-primary" onClick={()=>setShowCreate('rotation')}>
              ✦ Nouvelle rotation
            </button>
          </div>
        </div>

        {/* ══ VUE COMMAND CENTER ══════════════════════════════════ */}
        {view==='command' && (
          <div className="mc-fade">
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:14}}>
              <Kpi icon="📅" label="Planifiés" value={stats.planifies||0} color={C.accent} glow/>
              <Kpi icon="✈️" label="En transit" value={stats.en_voyage||0} color={C.amber}
                sub={absents.length>0?`${absents.length} hors camp`:''}/>
              <Kpi icon="🏠" label="Retours" value={stats.retours||0} color={C.green}/>
              <Kpi icon="🔄" label="Rotations" value={rotations.length} color={C.purple}/>
              <Kpi icon="⚠️" label="Alertes" value={rotations.filter(r=>r.places_libres===0).length}
                color={C.red} glow={rotations.filter(r=>r.places_libres===0).length>0}
                sub="Rotations complètes"/>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1.8fr 1fr',gap:12,marginBottom:14}}>

              {/* Flight Board */}
              <Panel style={{padding:'14px 16px'}}>
                <Label>Flight Board — Aujourd'hui</Label>
                <div style={{display:'grid',gridTemplateColumns:'50px 90px 1fr 70px 100px',gap:8,
                  padding:'5px 6px',borderBottom:`0.5px solid ${C.accent}30`,marginBottom:4}}>
                  {['Heure','Véhicule','Destination','Passagers','Statut'].map(h=>(
                    <div key={h} style={{fontFamily:'JetBrains Mono,monospace',fontSize:8,
                      fontWeight:600,letterSpacing:1,textTransform:'uppercase',color:C.muted}}>{h}</div>
                  ))}
                </div>
                {rotations.slice(0,6).map(r=>{
                  const cfg = ST_CFG[r.statut]||ST_CFG.planifie
                  const heure = r.heure_depart ? r.heure_depart.slice(0,5) : '—'
                  const pct = Math.round(r.nb_passagers/(r.nb_places_total||15)*100)
                  return (
                    <div key={r.rotation_id}
                      className="mc-row"
                      style={{display:'grid',gridTemplateColumns:'50px 90px 1fr 70px 100px',
                        gap:8,padding:'7px 6px',borderBottom:`0.5px solid rgba(255,255,255,.03)`,
                        alignItems:'center',cursor:'pointer',borderRadius:5}}
                      onClick={()=>{setSelRot(r);setView('rotations')}}>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:13,fontWeight:700,
                        color:r.statut==='en_voyage'?C.amber:C.text}}>{heure}</div>
                      <div style={{fontSize:11,fontWeight:600,color:C.accent,
                        fontFamily:'JetBrains Mono,monospace'}}>
                        {r.vehicule||'—'}
                      </div>
                      <div style={{fontSize:12,color:C.text,overflow:'hidden',
                        textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.destination}</div>
                      <div style={{fontSize:11,color:C.muted,
                        fontFamily:'JetBrains Mono,monospace',textAlign:'center'}}>
                        {r.nb_passagers}/{r.nb_places_total||15}
                      </div>
                      <Badge color={cfg.c}>{cfg.l}</Badge>
                    </div>
                  )
                })}
                {rotations.length===0&&(
                  <div style={{textAlign:'center',padding:'20px 0',color:C.muted,fontSize:12}}>
                    Aucune rotation · <button className="mc-btn mc-btn-ghost"
                      style={{marginLeft:8}} onClick={()=>setShowCreate('rotation')}>
                      + Créer
                    </button>
                  </div>
                )}
              </Panel>

              {/* Flow Map */}
              <Panel style={{padding:'14px 16px'}}>
                <Label>Personnel Flow Map</Label>
                <FlowMap stats={stats}/>
              </Panel>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

              {/* Absents du camp */}
              <Panel style={{padding:'14px 16px'}}>
                <Label>Absents du camp ({absents.length})</Label>
                <div style={{maxHeight:200,overflowY:'auto'}}>
                  {absents.slice(0,8).map(v=>(
                    <div key={v.id} style={{display:'flex',gap:10,padding:'8px 0',
                      borderBottom:`0.5px solid rgba(255,255,255,.04)`,alignItems:'center'}}>
                      <div style={{width:28,height:28,borderRadius:'50%',
                        background:`${C.accent}20`,border:`1px solid ${C.accent}40`,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:10,fontWeight:700,color:C.accent,flexShrink:0}}>
                        {(v.personnel_nom||'?').split(' ').map(n=>n[0]).join('').slice(0,2)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text}}>{v.personnel_nom||'—'}</div>
                        <div style={{fontSize:10,color:C.muted}}>
                          → {v.destination} · Retour {fmt(v.date_retour_prevue)}
                        </div>
                      </div>
                      <button className="mc-btn mc-btn-success" style={{padding:'4px 10px',fontSize:10}}
                        onClick={()=>changerStatut(v.id,'revenir')}>⬇ Retour</button>
                    </div>
                  ))}
                  {absents.length===0&&(
                    <div style={{textAlign:'center',padding:'16px 0',color:C.green,fontSize:12}}>
                      ✦ Tout le personnel est au camp
                    </div>
                  )}
                </div>
              </Panel>

              {/* AI Recommendations */}
              <Panel style={{padding:'14px 16px',borderColor:'rgba(167,139,250,.2)'}}>
                <Label style={{color:C.purple}}>AI · Recommandations Opérationnelles</Label>
                {[
                  {icon:'✦',
                   text: absents.length>0
                    ? `${absents.length} personne(s) hors camp. Taux d'occupation flotte: ${rotations.length>0?Math.round(rotations.reduce((s,r)=>s+r.nb_passagers,0)/rotations.reduce((s,r)=>s+(r.nb_places_total||15),0)*100):0}%.`
                    : 'Tout le personnel est présent au camp. Aucun déplacement actif.',
                   conf:'Données temps réel'},
                  {icon:'✦',
                   text: rotations.filter(r=>r.places_libres>0).length > 0
                    ? `${rotations.filter(r=>r.places_libres>0).reduce((s,r)=>s+r.places_libres,0)} siège(s) disponible(s) sur ${rotations.filter(r=>r.places_libres>0).length} rotation(s). Optimisez le remplissage.`
                    : 'Toutes les rotations planifiées sont complètes.',
                   conf:'Analyse occupation'},
                  {icon:'✦',
                   text: departs.length>0
                    ? `${departs.length} départ(s) prévu(s) aujourd'hui. Vérifiez la disponibilité véhicule et confirmez les embarquements.`
                    : 'Aucun départ planifié pour aujourd\'hui.',
                   conf:'Planning J'},
                  {icon:'✦',
                   text: retours.length>0
                    ? `${retours.length} retour(s) attendu(s) aujourd'hui. Préparez la réaffectation des chambres.`
                    : 'Aucun retour prévu aujourd\'hui.',
                   conf:'Hébergement'},
                ].map((a,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'8px 0',
                    borderBottom:i<3?`0.5px solid rgba(255,255,255,.04)`:'none'}}>
                    <div style={{width:24,height:24,borderRadius:'50%',
                      background:'rgba(167,139,250,.15)',border:`0.5px solid rgba(167,139,250,.3)`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      flexShrink:0,fontSize:12,color:C.purple}}>{a.icon}</div>
                    <div>
                      <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{a.text}</div>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,
                        color:C.purple,marginTop:2}}>{a.conf}</div>
                    </div>
                  </div>
                ))}
              </Panel>
            </div>
          </div>
        )}

        {/* ══ VUE ROTATIONS ══════════════════════════════════════ */}
        {view==='rotations' && (
          <div className="mc-fade">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:C.text}}>Rotations & Convois</div>
                <div style={{fontSize:12,color:C.muted}}>{rotations.length} rotation(s) · gestion des convois groupe</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="mc-btn mc-btn-ghost" onClick={()=>setShowCreate('individuel')}>
                  + Voyage individuel
                </button>
                <button className="mc-btn mc-btn-primary" onClick={()=>setShowCreate('rotation')}>
                  ✦ Nouvelle rotation
                </button>
              </div>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {rotations.map(r=>{
                const total   = r.nb_places_total || 15
                const prises  = r.nb_passagers
                const libres  = r.places_libres
                const pct     = Math.round(prises/total*100)
                const cfg     = ST_CFG[r.statut]||ST_CFG.planifie
                const isOpen  = selRot?.rotation_id===r.rotation_id

                return (
                  <Panel key={r.rotation_id} glow={isOpen}
                    style={{overflow:'visible'}}>
                    {/* Header rotation */}
                    <div style={{padding:'14px 18px',display:'flex',gap:14,
                      alignItems:'center',cursor:'pointer'}}
                      onClick={()=>setSelRot(isOpen?null:r)}>
                      {/* Icône véhicule */}
                      <div style={{width:44,height:44,borderRadius:10,flexShrink:0,
                        background:`${C.accent}15`,border:`1px solid ${C.accent}30`,
                        display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
                        {TYPE_VEH.find(t=>r.vehicule?.startsWith(t.id))?.ic||'🚌'}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:14,
                            fontWeight:700,color:C.accent}}>
                            {r.vehicule||'VEH'}
                          </span>
                          <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,
                            color:C.muted}}>#{r.rotation_id}</span>
                          <Badge color={cfg.c} small>{cfg.l}</Badge>
                          {libres===0&&<Badge color={C.red} small>COMPLET</Badge>}
                        </div>
                        <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
                          <span style={{fontSize:13,fontWeight:600,color:C.text}}>
                            📍 {r.destination}
                          </span>
                          <span style={{fontSize:12,color:C.muted}}>
                            📅 {fmt(r.date_depart)} → {fmt(r.date_retour_prevue)}
                          </span>
                          {r.heure_depart&&<span style={{fontSize:12,color:C.muted}}>
                            ⏰ {r.heure_depart?.slice(0,5)||'—'}
                          </span>}
                          {r.point_rdv&&<span style={{fontSize:12,color:C.muted}}>
                            📌 {r.point_rdv}
                          </span>}
                        </div>
                      </div>
                      {/* Jauge remplissage */}
                      <div style={{width:120,flexShrink:0}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:11,color:C.muted}}>{prises}/{total}</span>
                          <span style={{fontSize:11,fontWeight:700,
                            color:pct>=90?C.red:pct>=70?C.amber:C.green}}>{pct}%</span>
                        </div>
                        <div style={{height:4,background:`rgba(255,255,255,.08)`,borderRadius:99,overflow:'hidden'}}>
                          <div style={{width:`${pct}%`,height:'100%',borderRadius:99,
                            background:pct>=90?C.red:pct>=70?C.amber:C.green,
                            transition:'width .6s ease',
                            boxShadow:`0 0 6px ${pct>=90?C.red:pct>=70?C.amber:C.green}60`}}/>
                        </div>
                        <div style={{fontSize:9,color:C.muted,marginTop:3}}>
                          {libres} siège(s) libre(s)
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        {r.statut==='planifie'&&<button className="mc-btn mc-btn-primary"
                          style={{padding:'6px 12px',fontSize:11}}
                          onClick={e=>{e.stopPropagation();partirRotation(r.rotation_id)}}>
                          ✈️ Partir
                        </button>}
                        {r.statut==='en_voyage'&&<button className="mc-btn mc-btn-success"
                          style={{padding:'6px 12px',fontSize:11}}
                          onClick={e=>{e.stopPropagation();retourRotation(r.rotation_id)}}>
                          🏠 Retour
                        </button>}
                        <button className="mc-btn mc-btn-ghost"
                          style={{padding:'6px 10px',fontSize:11}}
                          onClick={e=>{e.stopPropagation();setSelRot(isOpen?null:r)}}>
                          {isOpen?'▲':'▼'}
                        </button>
                      </div>
                    </div>

                    {/* DÉTAIL ROTATION */}
                    {isOpen && (
                      <div style={{padding:'0 18px 16px',borderTop:`0.5px solid ${C.border}`}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:14}}>

                          {/* Plan de cabine */}
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:C.muted,
                              textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>
                              Plan de cabine
                            </div>
                            <SeatMap
                              total={total}
                              passagers={r.passagers||[]}
                              canBook={libres>0 && r.statut==='planifie'}
                              onBook={()=>{}}
                            />
                            {libres>0 && r.statut==='planifie' && (
                              <div style={{marginTop:12}}>
                                <div style={{fontSize:11,color:C.muted,marginBottom:6}}>
                                  Ajouter un passager
                                </div>
                                <div style={{display:'flex',gap:8}}>
                                  <select
                                    onChange={e=>setFormJoin({personnel_id:e.target.value,rotation_id:r.rotation_id})}
                                    style={{...inputStyle,flex:1}}>
                                    <option value="">Sélectionner...</option>
                                    {personnel
                                      .filter(p=>!(r.passagers||[]).some(pp=>pp.personnel__nom===p.nom&&pp.personnel__prenom===p.prenom))
                                      .map(p=>(
                                        <option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe||'—'}</option>
                                      ))}
                                  </select>
                                  <button className="mc-btn mc-btn-primary"
                                    disabled={saving||!formJoin.personnel_id||formJoin.rotation_id!==r.rotation_id}
                                    onClick={()=>rejoindreRotation(r.rotation_id, parseInt(formJoin.personnel_id))}>
                                    + Ajouter
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Liste passagers */}
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:C.muted,
                              textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>
                              Manifeste ({prises} passager(s))
                            </div>
                            <div style={{maxHeight:180,overflowY:'auto'}}>
                              {(r.passagers||[]).map((p,i)=>(
                                <div key={p.id||i} style={{display:'flex',gap:8,
                                  padding:'6px 0',borderBottom:`0.5px solid rgba(255,255,255,.04)`,
                                  alignItems:'center'}}>
                                  <div style={{width:24,height:24,borderRadius:'50%',
                                    background:`${C.accent}20`,
                                    display:'flex',alignItems:'center',justifyContent:'center',
                                    fontSize:9,fontWeight:700,color:C.accent,flexShrink:0}}>
                                    {i+1}
                                  </div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontSize:12,fontWeight:600,color:C.text}}>
                                      {p.personnel__nom} {p.personnel__prenom}
                                    </div>
                                    <div style={{fontSize:10,color:C.muted}}>
                                      {p.personnel__societe||'—'}
                                    </div>
                                  </div>
                                  <StatusBadge statut={p.statut}/>
                                </div>
                              ))}
                              {(r.passagers||[]).length===0&&(
                                <div style={{color:C.muted,fontSize:12,padding:'8px 0'}}>
                                  Aucun passager inscrit
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Panel>
                )
              })}

              {rotations.length===0&&(
                <Panel style={{padding:40,textAlign:'center'}}>
                  <div style={{fontSize:40,marginBottom:12}}>✈️</div>
                  <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:8}}>
                    Aucune rotation planifiée
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:20}}>
                    Créez votre première rotation pour commencer
                  </div>
                  <button className="mc-btn mc-btn-primary"
                    onClick={()=>setShowCreate('rotation')}>
                    ✦ Créer une rotation
                  </button>
                </Panel>
              )}
            </div>
          </div>
        )}

        {/* ══ VUE GANTT ══════════════════════════════════════════ */}
        {view==='gantt' && (
          <div className="mc-fade">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button className="mc-btn mc-btn-ghost" style={{padding:'6px 14px'}}
                  onClick={()=>setWeekOff(w=>w-1)}>← Préc.</button>
                <div style={{fontSize:13,fontWeight:700,color:C.text,
                  fontFamily:'JetBrains Mono,monospace',minWidth:220,textAlign:'center'}}>
                  {fmtW(days[0])} — {fmtW(days[13])}
                  {weekOff===0&&<span style={{color:C.green,fontSize:10,
                    display:'block',marginTop:2}}>● Période courante</span>}
                </div>
                <button className="mc-btn mc-btn-ghost" style={{padding:'6px 14px'}}
                  onClick={()=>setWeekOff(w=>w+1)}>Suiv. →</button>
              </div>
              <div style={{display:'flex',gap:12}}>
                {[{l:'Départ ↗',c:C.accent},{l:'Retour ↙',c:C.green},{l:'En voyage',c:`${C.amber}40`}].map(({l,c})=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:C.muted}}>
                    <span style={{width:16,height:10,borderRadius:2,background:c,display:'inline-block'}}/>
                    {l}
                  </div>
                ))}
              </div>
            </div>

            <Panel style={{overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:800,
                  background:C.panel}}>
                  <thead>
                    <tr style={{background:`${C.accent}08`}}>
                      <th style={{padding:'8px 12px',textAlign:'left',fontSize:10,fontWeight:700,
                        color:C.muted,textTransform:'uppercase',letterSpacing:.5,
                        borderBottom:`1px solid ${C.border}`,minWidth:160,
                        position:'sticky',left:0,background:`${C.panel}`,zIndex:2}}>
                        Personnel
                      </th>
                      {days.map((d,i)=>{
                        const isTod = toISO(d)===today
                        const isWE  = d.getDay()===0||d.getDay()===6
                        return (
                          <th key={i} style={{padding:'5px 2px',textAlign:'center',fontSize:10,
                            fontWeight:700,borderBottom:`1px solid ${C.border}`,
                            width:32,minWidth:32,
                            background:isTod?`${C.accent}12`:isWE?`rgba(255,255,255,.02)`:C.panel,
                            color:isTod?C.accent:isWE?C.border:C.muted,
                            borderLeft:`1px solid ${isTod?C.accent+'50':C.border}`}}>
                            <div style={{fontSize:8}}>{['D','L','M','M','J','V','S'][d.getDay()]}</div>
                            <div style={{fontSize:13,fontWeight:900,color:isTod?C.accent:C.text}}>
                              {d.getDate()}
                            </div>
                          </th>
                        )
                      })}
                      <th style={{padding:'8px 10px',borderBottom:`1px solid ${C.border}`,
                        fontSize:10,fontWeight:700,color:C.muted,minWidth:100}}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ganttVoyages.length===0?(
                      <tr><td colSpan={17} style={{padding:30,textAlign:'center',
                        color:C.muted,fontSize:13}}>
                        Aucun voyage sur cette période
                      </td></tr>
                    ):ganttVoyages.map(v=>(
                      <GanttBar key={v.id} voyage={v} days={days}
                        onClick={setSelVoyage}/>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Détail voyage sélectionné */}
            {selVoyage && (
              <div className="mc-fade" style={{position:'fixed',right:20,bottom:20,
                zIndex:1500,width:300}}>
                <Panel glow style={{padding:18}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                    <span style={{fontSize:14,fontWeight:800,color:C.text}}>Voyage #{selVoyage.id}</span>
                    <button onClick={()=>setSelVoyage(null)}
                      style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:18}}>×</button>
                  </div>
                  {[['Personnel',selVoyage.personnel_nom||'—'],
                    ['Destination',selVoyage.destination||'—'],
                    ['Départ',fmt(selVoyage.date_depart,{day:'numeric',month:'long'})],
                    ['Retour',fmt(selVoyage.date_retour_prevue,{day:'numeric',month:'long'})],
                    ['Véhicule',selVoyage.vehicule||'—'],
                    ['Motif',selVoyage.motif||'—'],
                  ].map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',
                      padding:'5px 0',borderBottom:`0.5px solid ${C.border}`,fontSize:12}}>
                      <span style={{color:C.muted}}>{l}</span>
                      <span style={{fontWeight:600,color:C.text,textAlign:'right',maxWidth:160,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v}</span>
                    </div>
                  ))}
                  <div style={{marginTop:10,display:'flex',gap:6}}>
                    {selVoyage.statut==='planifie'&&<button className="mc-btn mc-btn-primary"
                      style={{flex:1,fontSize:11}}
                      onClick={()=>{changerStatut(selVoyage.id,'partir');setSelVoyage(null)}}>
                      ✈️ Partir
                    </button>}
                    {selVoyage.statut==='en_voyage'&&<button className="mc-btn mc-btn-success"
                      style={{flex:1,fontSize:11}}
                      onClick={()=>{changerStatut(selVoyage.id,'revenir');setSelVoyage(null)}}>
                      🏠 Retour
                    </button>}
                    <button className="mc-btn mc-btn-danger" style={{fontSize:11}}
                      onClick={()=>{changerStatut(selVoyage.id,'annuler');setSelVoyage(null)}}>
                      Annuler
                    </button>
                  </div>
                </Panel>
              </div>
            )}
          </div>
        )}

        {/* ══ VUE MANIFEST ══════════════════════════════════════= */}
        {view==='manifest' && (
          <div className="mc-fade">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              {[
                {titre:`🛫 Départs aujourd'hui`,list:departs,c:C.accent},
                {titre:`🛬 Retours prévus`,list:retours,c:C.green},
                {titre:`🌍 Absents (${absents.length})`,list:absents,c:C.amber},
              ].map(({titre,list,c})=>(
                <Panel key={titre} style={{padding:'14px 16px'}}>
                  <div style={{fontSize:13,fontWeight:700,color:c,marginBottom:12}}>{titre}</div>
                  {list.length===0
                    ?<div style={{color:C.muted,fontSize:12,padding:'10px 0'}}>Aucun</div>
                    :list.map(v=>(
                      <div key={v.id} style={{display:'flex',gap:10,padding:'8px 0',
                        borderBottom:`0.5px solid rgba(255,255,255,.04)`,alignItems:'center'}}>
                        <div style={{width:26,height:26,borderRadius:'50%',
                          background:`${c}20`,display:'flex',alignItems:'center',
                          justifyContent:'center',fontSize:9,fontWeight:700,
                          color:c,flexShrink:0}}>
                          {(v.personnel_nom||'?').split(' ').map(n=>n[0]).join('').slice(0,2)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.text,
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {v.personnel_nom||'—'}
                          </div>
                          <div style={{fontSize:10,color:C.muted}}>
                            {v.destination} · {fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </Panel>
              ))}
            </div>

            {/* Tableau complet */}
            <Panel style={{marginTop:14,padding:'14px 16px'}}>
              <Label>Toutes les rotations — Export</Label>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <button className="mc-btn mc-btn-ghost"
                  onClick={()=>{
                    const csv = ['ID,Personnel,Destination,Départ,Retour,Statut,Rotation,Véhicule',
                      ...voyages.map(v=>`${v.id},"${v.personnel_nom||''}","${v.destination||''}",${v.date_depart},${v.date_retour_prevue},${v.statut},${v.rotation_id||''},${v.vehicule||''}`)
                    ].join('\n')
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}))
                    a.download = `rotations_${today}.csv`; a.click()
                  }}>
                  ⬇ Export CSV
                </button>
              </div>
              <div style={{overflowX:'auto',maxHeight:300}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead style={{position:'sticky',top:0}}>
                    <tr style={{background:`${C.accent}10`}}>
                      {['#','Personnel','Destination','Départ','Retour','Statut','Rotation'].map(h=>(
                        <th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:10,
                          fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5,
                          borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {voyages.map(v=>(
                      <tr key={v.id} className="mc-row"
                        style={{borderBottom:`0.5px solid rgba(255,255,255,.03)`}}>
                        <td style={{padding:'7px 10px',color:C.muted,fontFamily:'JetBrains Mono,monospace',fontSize:10}}>{v.id}</td>
                        <td style={{padding:'7px 10px',fontWeight:600,color:C.text}}>{v.personnel_nom||'—'}</td>
                        <td style={{padding:'7px 10px',color:C.text}}>{v.destination||'—'}</td>
                        <td style={{padding:'7px 10px',color:C.muted,whiteSpace:'nowrap'}}>{fmt(v.date_depart)}</td>
                        <td style={{padding:'7px 10px',color:C.muted,whiteSpace:'nowrap'}}>{fmt(v.date_retour_prevue)}</td>
                        <td style={{padding:'7px 10px'}}><StatusBadge statut={v.statut}/></td>
                        <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono,monospace',
                          fontSize:10,color:v.rotation_id?C.accent:C.muted}}>
                          {v.rotation_id||'—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

      </div>

      {/* ══ MODAL CRÉATION ROTATION ════════════════════════════════ */}
      {showCreate && (
        <div style={{position:'fixed',inset:0,background:'rgba(6,13,31,.85)',
          backdropFilter:'blur(4px)',zIndex:3000,display:'flex',
          alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>e.target===e.currentTarget&&setShowCreate(null)}>
          <div className="mc-fade" style={{width:'100%',maxWidth:560}}>
            <Panel glow style={{padding:24,maxHeight:'90vh',overflowY:'auto'}}>
              <div style={{display:'flex',justifyContent:'space-between',
                alignItems:'center',marginBottom:20}}>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.text}}>
                    {showCreate==='rotation' ? '✦ Nouvelle rotation groupe' : '✈️ Voyage individuel'}
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                    {showCreate==='rotation'
                      ? 'Un convoi avec plusieurs passagers — plan de cabine automatique'
                      : 'Un déplacement pour un seul membre du personnel'}
                  </div>
                </div>
                <button onClick={()=>setShowCreate(null)}
                  style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:22}}>×</button>
              </div>

              {showCreate==='rotation' && (
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    {/* Destination */}
                    <div style={{gridColumn:'span 2'}}>
                      <label style={labelStyle}>Destination *</label>
                      <select value={formRot.destination}
                        onChange={e=>setFormRot(p=>({...p,destination:e.target.value}))}
                        style={inputStyle}>
                        {['Abidjan','Yamoussoukro','San Pédro','Bouaké','Aéroport FHB',
                          'Mine Agbaou','Mine Yaouré','Autre'].map(d=>(
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    {/* Véhicule */}
                    <div>
                      <label style={labelStyle}>Type véhicule</label>
                      <select value={formRot.vehicule}
                        onChange={e=>setFormRot(p=>({...p,vehicule:e.target.value}))}
                        style={inputStyle}>
                        {TYPE_VEH.map(t=><option key={t.id} value={t.id}>{t.ic} {t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>N° véhicule</label>
                      <input value={formRot.numero_veh}
                        onChange={e=>setFormRot(p=>({...p,numero_veh:e.target.value}))}
                        placeholder="01" style={inputStyle}/>
                    </div>
                    {/* Capacité */}
                    <div>
                      <label style={labelStyle}>Capacité (sièges)</label>
                      <input type="number" min="1" max="60" value={formRot.nb_places_total}
                        onChange={e=>setFormRot(p=>({...p,nb_places_total:parseInt(e.target.value)||15}))}
                        style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Heure départ</label>
                      <input type="time" value={formRot.heure_depart}
                        onChange={e=>setFormRot(p=>({...p,heure_depart:e.target.value}))}
                        style={inputStyle}/>
                    </div>
                    {/* Dates */}
                    <div>
                      <label style={labelStyle}>Date de départ *</label>
                      <input type="date" value={formRot.date_depart}
                        onChange={e=>setFormRot(p=>({...p,date_depart:e.target.value}))}
                        style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Date de retour *</label>
                      <input type="date" value={formRot.date_retour_prevue}
                        onChange={e=>setFormRot(p=>({...p,date_retour_prevue:e.target.value}))}
                        style={inputStyle}/>
                    </div>
                    <div style={{gridColumn:'span 2'}}>
                      <label style={labelStyle}>Point de rendez-vous</label>
                      <input value={formRot.point_rdv}
                        onChange={e=>setFormRot(p=>({...p,point_rdv:e.target.value}))}
                        placeholder="Entrée principale, Parking A..." style={inputStyle}/>
                    </div>
                    <div style={{gridColumn:'span 2'}}>
                      <label style={labelStyle}>Motif / Objet</label>
                      <input value={formRot.motif}
                        onChange={e=>setFormRot(p=>({...p,motif:e.target.value}))}
                        placeholder="Congé, Mission, Rotation site, Formation..."
                        style={inputStyle}/>
                    </div>
                  </div>

                  {/* Sélection passagers */}
                  <div>
                    <label style={labelStyle}>
                      Passagers ({formRot.passagers.length}/{formRot.nb_places_total})
                    </label>
                    <div style={{border:`0.5px solid ${C.border}`,borderRadius:8,
                      maxHeight:200,overflowY:'auto',background:'rgba(0,0,0,.2)'}}>
                      {personnel.map(p=>{
                        const checked = formRot.passagers.includes(p.id)
                        const full = !checked && formRot.passagers.length >= formRot.nb_places_total
                        return (
                          <label key={p.id} style={{display:'flex',gap:10,alignItems:'center',
                            padding:'8px 12px',cursor:full?'not-allowed':'pointer',
                            borderBottom:`0.5px solid rgba(255,255,255,.04)`,
                            background:checked?`${C.accent}10`:'transparent',
                            opacity:full?0.4:1}}>
                            <input type="checkbox" checked={checked} disabled={full}
                              onChange={e=>{
                                if(e.target.checked) setFormRot(f=>({...f,passagers:[...f.passagers,p.id]}))
                                else setFormRot(f=>({...f,passagers:f.passagers.filter(x=>x!==p.id)}))
                              }}
                              style={{accentColor:C.accent}}/>
                            <div>
                              <div style={{fontSize:13,fontWeight:500,color:checked?C.accent:C.text}}>
                                {p.nom} {p.prenom}
                              </div>
                              <div style={{fontSize:10,color:C.muted}}>{p.societe||'—'}</div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                    {/* Plan cabine preview */}
                    {formRot.nb_places_total > 0 && (
                      <div style={{marginTop:10,padding:10,background:'rgba(0,0,0,.2)',
                        borderRadius:8,border:`0.5px solid ${C.border}`}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:8}}>
                          Aperçu cabine — {formRot.passagers.length}/{formRot.nb_places_total}
                        </div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                          {Array.from({length:formRot.nb_places_total},(_,i)=>(
                            <div key={i} style={{
                              width:20,height:20,borderRadius:4,
                              background: i<formRot.passagers.length ? `${C.accent}25` : 'transparent',
                              border: `1.5px solid ${i<formRot.passagers.length ? C.accent : C.border}`,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:8,color: i<formRot.passagers.length ? C.accent : C.muted,
                            }}>
                              {i<formRot.passagers.length ? '●' : '○'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button className="mc-btn mc-btn-primary"
                    style={{width:'100%',justifyContent:'center',padding:13,fontSize:14}}
                    disabled={saving||!formRot.date_depart||!formRot.date_retour_prevue}
                    onClick={creerRotation}>
                    {saving ? '⏳ Création...' : `✦ Créer rotation ${formRot.vehicule}-${formRot.numero_veh} · ${formRot.passagers.length} passager(s)`}
                  </button>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
