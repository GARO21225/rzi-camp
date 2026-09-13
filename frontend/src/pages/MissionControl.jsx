import { useState, useEffect, useCallback, useRef } from 'react'
import { toast, confirmDialog } from '../toast'
import CarteItineraire from '../components/CarteItineraire'

const BASE = import.meta.env.VITE_API_URL || window.location.origin
const tok  = () => localStorage.getItem('access_token') || ''
const hdrs = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' })
const api  = (path, opts) => fetch(`${BASE}${path}`, { headers: hdrs(), ...opts })

// ── Palette & Config ────────────────────────────────────────────────
// Palette Roxgold (bleu marine / blanc / gris industriel + touches or) —
// remplace l'ancien thème "mission control" sombre quasi-noir. Toutes les
// 200 références C.xxx du fichier basculent automatiquement via cet objet
// unique, sans toucher au reste du code.
const C = {
  bg:     '#F4F6F9',
  panel:  '#FFFFFF',
  border: 'rgba(15,26,46,.10)',
  glow:   'rgba(37,99,235,.25)',
  text:   '#0F1A2E',
  muted:  '#5B6472',
  accent: '#2563EB',
  green:  '#16A34A',
  amber:  '#D4A017',
  red:    '#DC2626',
  purple: '#7C3AED',
  cyan:   '#0891B2',
}

// Filtre le catalogue "véhicule du parc" selon le mode de transport choisi
const CATEGORIES_PAR_MODE = {
  bus: ['bus','minibus'], '4x4': ['4x4','pickup'], avion: ['avion'],
  bateau: ['bateau'], a_pied: [], autre: ['autre'],
}
const filtrerFlotteParMode = (flotte, mode) => {
  if (mode === 'a_pied') return []
  const cats = CATEGORIES_PAR_MODE[mode]
  if (!cats || cats.length === 0) return flotte
  return flotte.filter(v => cats.includes(v.categorie))
}

const ST_CFG = {
  planifie:  { l:'Planifié',     c:C.accent,  dot:'#3b82f6' },
  en_voyage: { l:'En transit',   c:C.amber,   dot:C.amber   },
  retour:    { l:'Retour camp',  c:C.green,   dot:C.green   },
  annule:    { l:'Annulé',       c:C.red,     dot:C.red     },
}

// Modes de déplacement scindés: Terrestre / Aérien
const MODES_DEPLACEMENT = {
  terrestre: {
    label: '🚗 Terrestre',
    vehicules: [
      { id:'BUS',    ic:'🚌', label:'Bus (Minibus)',    nums:['01','02','03','04','05','06','07','08'] },
      { id:'4WD',    ic:'🚙', label:'4×4 / Pickup',    nums:['01','02','03','04','05'] },
      { id:'CAMION', ic:'🚛', label:'Camion / Navette', nums:['01','02','03'] },
      { id:'MOTO',   ic:'🏍️', label:'Moto / Scooter',  nums:['01','02','03','04'] },
    ]
  },
  aerien: {
    label: '✈️ Aérien',
    vehicules: [
      { id:'AVION',  ic:'✈️', label:'Vol charter',      nums:['001','002','003'] },
      { id:'HELICO', ic:'🚁', label:'Hélicoptère',      nums:['01','02'] },
      { id:'ULM',    ic:'🛩️', label:'ULM / Petit avion',nums:['01','02'] },
    ]
  }
}

// Liste à plat pour usage dans les sélecteurs
const VEHICULES_LIST = Object.entries(MODES_DEPLACEMENT).flatMap(([mode, cat]) =>
  cat.vehicules.flatMap(t =>
    t.nums.map(n => ({
      code: `${t.id}-${n}`,
      ic: t.ic,
      label: `${t.ic} ${t.id}-${n}`,
      labelFull: `${t.ic} ${t.id}-${n} (${t.label})`,
      mode,
      type: t.id,
    }))
  )
)
const TYPE_VEH = Object.values(MODES_DEPLACEMENT).flatMap(cat => cat.vehicules)

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

// ── Vue calendrier — départs/retours du mois, façon agence de voyage ──
function VueCalendrierMC({ voyages, mois, setMois, onSelect }) {
  const annee = mois.getFullYear(), moisIdx = mois.getMonth()
  const premierJour = new Date(annee, moisIdx, 1)
  const nbJours = new Date(annee, moisIdx + 1, 0).getDate()
  const decalage = (premierJour.getDay() + 6) % 7

  const parJour = {}
  voyages.forEach(v => {
    if (v.date_depart) { parJour[v.date_depart] = parJour[v.date_depart] || { departs: [], retours: [] }; parJour[v.date_depart].departs.push(v) }
    if (v.date_retour_prevue) { parJour[v.date_retour_prevue] = parJour[v.date_retour_prevue] || { departs: [], retours: [] }; parJour[v.date_retour_prevue].retours.push(v) }
  })

  const cases = []
  for (let i = 0; i < decalage; i++) cases.push(null)
  for (let j = 1; j <= nbJours; j++) cases.push(j)
  const fmtDate = (j) => `${annee}-${String(moisIdx+1).padStart(2,'0')}-${String(j).padStart(2,'0')}`

  return (
    <Panel style={{padding:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <button className="mc-btn" onClick={()=>setMois(new Date(annee,moisIdx-1,1))}>←</button>
        <div style={{fontFamily:'JetBrains Mono,monospace',fontWeight:700,fontSize:14,color:C.accent,textTransform:'capitalize'}}>
          {mois.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}
        </div>
        <button className="mc-btn" onClick={()=>setMois(new Date(annee,moisIdx+1,1))}>→</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',marginBottom:6}}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(j=><div key={j} style={{textAlign:'center'}}>{j}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {cases.map((j,i) => {
          if (!j) return <div key={i}/>
          const dateStr = fmtDate(j)
          const info = parJour[dateStr]
          const isToday = dateStr === toISO(new Date())
          return (
            <div key={i} style={{minHeight:68,border:`1px solid ${isToday?C.accent:C.border}`,borderRadius:8,padding:4,fontSize:10,background:isToday?`${C.accent}0a`:C.panel}}>
              <div style={{fontWeight:700,color:isToday?C.accent:C.muted,marginBottom:2}}>{j}</div>
              {info?.departs.slice(0,2).map(v=>(
                <div key={'d'+v.id} onClick={()=>onSelect(v)} title={`Départ — ${v.personnel_nom||''}`}
                  style={{background:`${C.orange||'#f97316'}18`,color:C.orange||'#c2410c',borderRadius:4,padding:'1px 4px',marginBottom:2,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  ✈️ {v.personnel_nom||v.destination}
                </div>
              ))}
              {info?.retours.slice(0,2).map(v=>(
                <div key={'r'+v.id} onClick={()=>onSelect(v)} title={`Retour — ${v.personnel_nom||''}`}
                  style={{background:`${C.green}18`,color:C.green,borderRadius:4,padding:'1px 4px',marginBottom:2,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  🏠 {v.personnel_nom||v.destination}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Panel>
  )
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
    destination:'Abidjan', vehicule:'',
    vehicule_matricule:'', vehicule_photo:'', conducteur:'', vehicule_flotte_id:'',
    mode_transport:'bus',
    date_depart:'', date_retour_prevue:'', nb_places_total:15,
    heure_depart:'06:00', point_rdv:'Entrée camp', motif:'', type_voyage:'rotation',
    passagers:[],
  })
  const [formJoin, setFormJoin] = useState({ personnel_id:'', rotation_id:'' })
  const [formIndiv, setFormIndiv] = useState({
    personnel_id:'', destination:'Abidjan', origine:'Camp Roxgold Sango',
    date_depart:'', date_retour_prevue:'', heure_depart:'06:00',
    vehicule:'', vehicule_matricule:'', vehicule_photo:'', conducteur:'',
    point_rdv:'Entrée camp', motif:'',
  })
  const [rappels, setRappels] = useState([])
  const [moisCal, setMoisCal] = useState(new Date())
  const [detailVoyage, setDetailVoyage] = useState(null)
  const [etapesDetail, setEtapesDetail] = useState([])
  const [rechercheListe, setRechercheListe] = useState('')
  const [selectionListe, setSelectionListe] = useState(new Set())
  const [flotte, setFlotte] = useState([])
  const [retoursAnticipes, setRetoursAnticipes] = useState([])
  const [nouvelleEtape, setNouvelleEtape] = useState(null)
  const [changerVehiculeForm, setChangerVehiculeForm] = useState(null)
  const [changerConvoiForm, setChangerConvoiForm] = useState(null)

  // ── Load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rv, rs, rp, rr, rrap, rvf, rra] = await Promise.allSettled([
        api('/api/voyages/?page_size=200').then(r=>r.json()),
        api('/api/voyages/stats/').then(r=>r.json()),
        api('/api/personnel/?page_size=500&actif=true&droit_mobilite=true').then(r=>r.json()),
        api('/api/voyages/rotations/').then(r=>r.json()),
        api('/api/voyages/rappels_rotation/').then(r=>r.json()),
        api('/api/vehicules-flotte/').then(r=>r.json()),
        api('/api/voyages/retours_anticipes/').then(r=>r.json()),
      ])
      if (rv.status==='fulfilled') setVoyages(rv.value?.results||rv.value||[])
      if (rs.status==='fulfilled') setStats(rs.value||{})
      if (rp.status==='fulfilled') setPersonnel(rp.value?.results||rp.value||[])
      if (rr.status==='fulfilled') setRotations(rr.value?.rotations||[])
      if (rrap.status==='fulfilled') setRappels(Array.isArray(rrap.value) ? rrap.value : [])
      if (rvf.status==='fulfilled') setFlotte(rvf.value?.results||rvf.value||[])
      if (rra.status==='fulfilled') setRetoursAnticipes(Array.isArray(rra.value) ? rra.value : [])
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
    if (formRot.mode_transport !== 'a_pied' && !formRot.vehicule) return flash('Véhicule requis (du parc ou saisi librement)',false)
    setSaving(true)
    try {
      const res = await api('/api/voyages/creer_rotation/', {
        method:'POST',
        body: JSON.stringify({
          ...formRot,
          passagers: formRot.passagers,
        })
      })
      const data = await res.json()
      if (res.ok) {
        flash(`Rotation ${data.rotation_id} créée · ${data.voyages_crees} passager(s)`)
        setShowCreate(null)
        setFormRot({destination:'Abidjan',vehicule:'',
          vehicule_matricule:'',vehicule_photo:'',conducteur:'',vehicule_flotte_id:'',mode_transport:'bus',
          date_depart:'',date_retour_prevue:'',nb_places_total:15,
          heure_depart:'06:00',point_rdv:'Entrée camp',motif:'',type_voyage:'rotation',passagers:[]})
        load()
      } else flash(data.error||'Erreur',false)
    } catch(e) { flash('Erreur réseau',false) }
    setSaving(false)
  }

  const creerIndividuel = async () => {
    if (!formIndiv.personnel_id || !formIndiv.date_depart || !formIndiv.date_retour_prevue) {
      return flash('Personnel et dates requis', false)
    }
    setSaving(true)
    try {
      // Traite le voyage individuel comme une rotation a 1 passager -
      // reutilise EXACTEMENT le meme mecanisme que 'Nouvelle rotation'
      // (rotation_id genere, visible dans l'onglet Rotations, meme
      // validation/conflits/notifications), plutot qu'un chemin separe
      // et incomplet.
      const res = await api('/api/voyages/creer_rotation/', {
        method:'POST',
        body: JSON.stringify({
          ...formIndiv,
          nb_places_total: 1,
          type_voyage: 'individuel',
          passagers: [formIndiv.personnel_id],
        })
      })
      const data = await res.json()
      if (res.ok) {
        flash('Voyage individuel créé')
        setShowCreate(null)
        setFormIndiv({personnel_id:'',destination:'Abidjan',origine:'Camp Roxgold Sango',
          date_depart:'',date_retour_prevue:'',heure_depart:'06:00',
          vehicule:'',vehicule_matricule:'',vehicule_photo:'',conducteur:'',
          point_rdv:'Entrée camp',motif:''})
        load()
      } else flash(data.error || data.detail || Object.values(data)[0]?.[0] || 'Erreur', false)
    } catch(e) { flash('Erreur réseau', false) }
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

  const ouvrirDetail = async (v) => {
    setDetailVoyage(v)
    setEtapesDetail(v.etapes || [])
    setNouvelleEtape(null)
    setChangerVehiculeForm(null)
    setChangerConvoiForm(null)
    try {
      const r = await api(`/api/etapes-voyage/?voyage=${v.id}`).then(r=>r.json())
      setEtapesDetail(r.results || r || [])
    } catch {}
  }

  const initNouvelleEtape = (sens) => setNouvelleEtape({
    sens, origine: sens==='retour' ? (detailVoyage?.destination||'') : (detailVoyage?.origine||'Camp Roxgold Sango'),
    destination: sens==='retour' ? (detailVoyage?.origine||'Camp Roxgold Sango') : (detailVoyage?.destination||''),
    mode_transport:'bus', vehicule_flotte:'', conducteur:'',
    date_etape: sens==='retour' ? (detailVoyage?.date_retour_prevue||'') : (detailVoyage?.date_depart||''),
    heure_depart:'', point_rdv:'', reference:'',
  })

  const soumettreEtape = async () => {
    if (!nouvelleEtape || !detailVoyage) return
    try {
      const res = await api('/api/etapes-voyage/', {
        method:'POST',
        body: JSON.stringify({ ...nouvelleEtape, voyage: detailVoyage.id, ordre: etapesDetail.length + 1 })
      })
      if (res.ok) {
        const r = await api(`/api/etapes-voyage/?voyage=${detailVoyage.id}`).then(r=>r.json())
        setEtapesDetail(r.results || r || [])
        setNouvelleEtape(null)
        toast.success('Étape ajoutée')
        load()
      } else {
        const d = await res.json()
        toast.error(d.error || d.detail || 'Erreur')
      }
    } catch { toast.error('Erreur réseau') }
  }

  const soumettreChangerVehicule = async () => {
    if (!changerVehiculeForm || !detailVoyage) return
    try {
      const res = await api(`/api/voyages/${detailVoyage.id}/changer_vehicule/`, {
        method:'POST', body: JSON.stringify(changerVehiculeForm)
      })
      const d = await res.json()
      if (res.ok) {
        setDetailVoyage(d)
        setChangerVehiculeForm(null)
        toast.success('Véhicule changé')
        load()
      } else toast.error(d.error || 'Erreur')
    } catch { toast.error('Erreur réseau') }
  }

  const soumettreChangerConvoi = async (rotationId) => {
    if (!detailVoyage) return
    const ok = await confirmDialog(`Déplacer ${detailVoyage.personnel_nom} vers le convoi ${rotationId} ? Le véhicule, les dates et la destination seront ceux du nouveau convoi.`)
    if (!ok) return
    try {
      const res = await api(`/api/voyages/${detailVoyage.id}/changer_convoi/`, {
        method:'POST', body: JSON.stringify({ rotation_id: rotationId })
      })
      const d = await res.json()
      if (res.ok) {
        setDetailVoyage(d)
        setChangerConvoiForm(null)
        toast.success('Convoi changé')
        load()
      } else toast.error(d.error || 'Erreur')
    } catch { toast.error('Erreur réseau') }
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
    .mc-root { background:${C.bg}; color:${C.text}; font-family:'Space Grotesk',system-ui,sans-serif; min-height:100%; }
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
                Centre de Mobilité · RZI Camp
              </div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:.5,marginTop:1}}>
                Rotations · Voyages · Itinéraires · Validations
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:4,background:`rgba(96,165,250,.05)`,
            borderRadius:10,padding:4,flexWrap:'wrap'}}>
            {[
              ['command','🛰️ Command'],
              ['rotations','🚀 Rotations'],
              ['gantt','📅 Gantt'],
              ['manifest','📋 Manifest'],
              ['calendrier','🗓️ Calendrier'],
              ['validations','✅ Validations'],
              ['liste','🎫 Tous les voyages'],
            ].map(([v,l])=>{
              const nbPending = v==='validations' ? voyages.filter(x=>x.statut_validation==='en_attente').length : 0
              return (
                <button key={v} className={`mc-tab ${view===v?'active':''}`}
                  onClick={()=>setView(v)} style={{position:'relative'}}>
                  {l}
                  {nbPending > 0 && (
                    <span style={{position:'absolute',top:-6,right:-6,background:C.red,color:'#fff',
                      borderRadius:99,fontSize:9,fontWeight:800,minWidth:16,height:16,display:'flex',
                      alignItems:'center',justifyContent:'center',padding:'0 3px'}}>{nbPending}</span>
                  )}
                </button>
              )
            })}
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

        {/* Retours anticipés — visible peu importe l'onglet actif */}
        {retoursAnticipes.length > 0 && (
          <div style={{margin:'0 0 14px',background:`${C.green}12`,border:`1px solid ${C.green}40`,borderRadius:10,padding:'10px 14px'}}>
            <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:4}}>
              ⚡ {retoursAnticipes.length} personne(s) rentrée(s) plus tôt que prévu récemment
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {retoursAnticipes.slice(0,6).map(r=>(
                <span key={r.id} style={{fontSize:11,color:C.green,background:`${C.green}18`,padding:'3px 9px',borderRadius:20}}>
                  {r.personnel_nom} — {r.jours_avance}j d'avance ({r.destination})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Rappels de fin de rotation ── */}
        {rappels.length > 0 && (
          <div style={{background:'rgba(248,113,113,.06)',border:`1px solid ${C.red}30`,
            borderRadius:12,padding:'12px 16px',marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:12,color:C.red,marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
              🔔 Rappels de fin de rotation
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {rappels.map(r => (
                <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,
                  background: r.en_retard ? 'rgba(248,113,113,.12)' : 'rgba(240,165,0,.1)',
                  border:`1px solid ${r.en_retard?C.red:C.amber}40`,
                  borderRadius:9,padding:'6px 12px',fontSize:11}}>
                  <span>{r.en_retard ? '⛔' : '⏰'}</span>
                  <b>{r.personnel_nom}</b>
                  <span style={{color:'var(--text-dim)'}}>{r.societe}</span>
                  <span style={{color: r.en_retard?C.red:C.amber, fontWeight:700}}>
                    {r.en_retard ? `Retour prévu il y a ${Math.abs(r.jours_restants)}j` : `Retour dans ${r.jours_restants}j`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>

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
                        onClick={async()=>{
                          const ok = await confirmDialog(`Confirmer le retour de ${v.personnel_nom} aujourd'hui ?\n\nRetour prévu initialement : ${fmt(v.date_retour_prevue)}.`)
                          if(ok) changerStatut(v.id,'revenir')
                        }}>⬇ Retour</button>
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
                    ? `${absents.length} personne(s) hors camp. Taux d'occupation flotte (convois actifs): ${rotations.filter(r=>r.statut!=='retour').length>0?Math.round(rotations.filter(r=>r.statut!=='retour').reduce((s,r)=>s+(r.places_occupees||0)+(r.places_reservees||0),0)/rotations.filter(r=>r.statut!=='retour').reduce((s,r)=>s+(r.nb_places_total||15),0)*100):0}%.`
                    : 'Tout le personnel est présent au camp. Aucun déplacement actif.',
                   conf:'Données temps réel'},
                  {icon:'✦',
                   text: rotations.filter(r=>r.places_libres>0 && r.statut!=='retour').length > 0
                    ? `${rotations.filter(r=>r.places_libres>0 && r.statut!=='retour').reduce((s,r)=>s+r.places_libres,0)} siège(s) disponible(s) sur ${rotations.filter(r=>r.places_libres>0 && r.statut!=='retour').length} convoi(s) actif(s). Optimisez le remplissage.`
                    : 'Aucun convoi actif avec des places libres actuellement.',
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
                const occ     = r.places_occupees ?? prises
                const res     = r.places_reservees ?? 0
                const actifs  = occ + res  // exclut les "retour" - eux ne bloquent plus de place
                const pct     = Math.round(actifs/total*100)
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
                      {/* Jauge remplissage — 3 etats : occupe (confirme) / reserve (en attente) / libre */}
                      <div style={{width:130,flexShrink:0}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:11,color:C.muted}}>{actifs}/{total}</span>
                          <span style={{fontSize:11,fontWeight:700,
                            color:pct>=90?C.red:pct>=70?C.amber:C.green}}>{pct}%</span>
                        </div>
                        <div style={{height:6,background:`rgba(255,255,255,.08)`,borderRadius:99,overflow:'hidden',display:'flex'}}>
                          <div style={{width:`${occ/total*100}%`,height:'100%',background:C.accent}} title={`${occ} occupé(s)`}/>
                          <div style={{width:`${res/total*100}%`,height:'100%',background:C.amber}} title={`${res} réservé(s)`}/>
                        </div>
                        <div style={{fontSize:9,color:C.muted,marginTop:3,display:'flex',gap:6}}>
                          <span>● {occ}</span><span style={{color:C.amber}}>◐ {res}</span><span>○ {libres}</span>
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
                        <button className="mc-btn"
                          style={{padding:'6px 10px',fontSize:11,background:`${C.red}18`,color:C.red}}
                          title="Supprimer tout le convoi"
                          onClick={async e=>{
                            e.stopPropagation()
                            const avert = r.statut!=='planifie' ? '\n\n⚠️ Ce convoi a déjà été effectué (en transit ou revenu) — les données de voyage seront perdues définitivement.' : ''
                            const ok = await confirmDialog(`Supprimer entièrement le convoi ${r.vehicule||r.rotation_id} et ses ${r.nb_passagers} passager(s) ?${avert}\n\nCette action est irréversible.`)
                            if (!ok) return
                            try {
                              const res = await api('/api/voyages/supprimer_rotation/', {method:'POST', body: JSON.stringify({rotation_id:r.rotation_id})})
                              const d = await res.json()
                              if (res.ok) { toast.success(`Convoi supprimé (${d.supprimes} passager(s))`); load() }
                              else toast.error(d.error||'Erreur')
                            } catch { toast.error('Erreur réseau') }
                          }}>
                          🗑️
                        </button>
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
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14,marginTop:14}}>

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
                                  ➕ Ajouter un passager <b style={{color:C.text}}>à CE convoi</b> ({r.vehicule||r.rotation_id}) — pour un voyage séparé, utilise plutôt « + Voyage individuel »
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
                                <div key={p.id||i} onClick={()=>{
                                    const voyageComplet = voyages.find(v=>v.id===p.id)
                                    if (voyageComplet) ouvrirDetail(voyageComplet)
                                  }}
                                  style={{display:'flex',gap:8,
                                  padding:'6px 4px',borderBottom:`0.5px solid rgba(255,255,255,.04)`,
                                  alignItems:'center',cursor:'pointer',borderRadius:6,transition:'background .15s'}}
                                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
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
                                  {p.statut==='planifie' && (
                                    <button onClick={async ev=>{
                                        ev.stopPropagation()
                                        const ok = await confirmDialog(`Retirer ${p.personnel__nom} ${p.personnel__prenom} de cette rotation ?`)
                                        if (!ok) return
                                        try {
                                          const res = await api(`/api/voyages/${p.id}/annuler/`, {method:'POST'})
                                          if (res.ok) { toast.success('Retiré de la rotation'); load() }
                                          else { const d = await res.json(); toast.error(d.error||'Erreur') }
                                        } catch { toast.error('Erreur réseau') }
                                      }}
                                      title="Retirer de la rotation"
                                      style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:13,padding:'2px 4px',flexShrink:0}}>
                                      🗑️
                                    </button>
                                  )}
                                  <span style={{fontSize:10,color:C.muted}} title="Cliquer la ligne pour modifier">⚙️</span>
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
                      onClick={async()=>{
                        const ok = await confirmDialog(`Confirmer le départ de ${selVoyage.personnel_nom} aujourd'hui ?`)
                        if(ok){ changerStatut(selVoyage.id,'partir'); setSelVoyage(null) }
                      }}>
                      ✈️ Partir
                    </button>}
                    {selVoyage.statut==='en_voyage'&&<button className="mc-btn mc-btn-success"
                      style={{flex:1,fontSize:11}}
                      onClick={async()=>{
                        const ok = await confirmDialog(`Confirmer le retour de ${selVoyage.personnel_nom} aujourd'hui ?\n\nRetour prévu initialement : ${fmt(selVoyage.date_retour_prevue)}.`)
                        if(ok){ changerStatut(selVoyage.id,'revenir'); setSelVoyage(null) }
                      }}>
                      🏠 Retour
                    </button>}
                    <button className="mc-btn mc-btn-danger" style={{fontSize:11}}
                      onClick={async()=>{
                        const ok = await confirmDialog(`Annuler le voyage de ${selVoyage.personnel_nom} vers ${selVoyage.destination} ?`)
                        if(ok){ changerStatut(selVoyage.id,'annuler'); setSelVoyage(null) }
                      }}>
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
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:12}}>
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

        {/* ══ VUE CALENDRIER ═══════════════════════════════════════ */}
        {view==='calendrier' && (
          <div className="mc-fade">
            <VueCalendrierMC voyages={voyages} mois={moisCal} setMois={setMoisCal} onSelect={ouvrirDetail}/>
          </div>
        )}

        {/* ══ VUE VALIDATIONS EN ATTENTE ═══════════════════════════ */}
        {view==='validations' && (
          <div className="mc-fade">
            {(() => {
              const enAttente = voyages.filter(v=>v.statut_validation==='en_attente')
              return enAttente.length===0 ? (
                <Panel style={{padding:40,textAlign:'center'}}>
                  <div style={{fontSize:40,marginBottom:10}}>✅</div>
                  <div style={{color:C.muted,fontSize:13}}>Aucune demande en attente de validation.</div>
                </Panel>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {enAttente.map(v=>(
                    <Panel key={v.id} style={{padding:16}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
                        <div>
                          <div style={{fontWeight:800,fontSize:14,color:C.text}}>{v.personnel_nom}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                            {v.personnel_societe} · ✈️ {v.destination} · {fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}
                          </div>
                          {v.motif && <div style={{fontSize:11,color:C.muted,marginTop:2}}>Motif : {v.motif}</div>}
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <button className="mc-btn" style={{background:C.green,color:'#fff'}}
                            onClick={async()=>{
                              try{ await api(`/api/voyages/${v.id}/valider/`,{method:'POST'}); toast.success('Voyage validé'); load() }
                              catch{ toast.error('Erreur') }
                            }}>✅ Valider</button>
                          <button className="mc-btn" style={{background:C.red,color:'#fff'}}
                            onClick={async()=>{
                              const ok = await confirmDialog(`Refuser le voyage de ${v.personnel_nom} vers ${v.destination} ?`)
                              if(!ok) return
                              try{ await api(`/api/voyages/${v.id}/refuser/`,{method:'POST',body:JSON.stringify({motif:''})}); toast.success('Voyage refusé'); load() }
                              catch{ toast.error('Erreur') }
                            }}>❌ Refuser</button>
                        </div>
                      </div>
                    </Panel>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* ══ VUE LISTE COMPLÈTE — façon billet d'agence de voyage ═══ */}
        {view==='liste' && (
          <div className="mc-fade">
            <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:14,flexWrap:'wrap'}}>
              <input value={rechercheListe} onChange={e=>setRechercheListe(e.target.value)}
                placeholder="🔍 Rechercher un nom, une destination…"
                style={{flex:1,minWidth:220,maxWidth:320,padding:'9px 14px',borderRadius:9,
                  border:`1px solid ${C.border}`,background:C.panel,color:C.text,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              {selectionListe.size > 0 && (
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:`${C.red}12`,borderRadius:9,border:`1px solid ${C.red}30`}}>
                  <span style={{fontSize:12,color:C.text,fontWeight:700}}>{selectionListe.size} sélectionné(s)</span>
                  <button className="mc-btn" style={{fontSize:11,background:C.red,color:'#fff',padding:'5px 10px'}}
                    onClick={async ()=>{
                      const ok = await confirmDialog(`Supprimer définitivement ${selectionListe.size} voyage(s) sélectionné(s) ? Cette action est irréversible, quel que soit leur statut.`)
                      if (!ok) return
                      try {
                        const res = await api('/api/voyages/supprimer_masse/', {method:'POST', body: JSON.stringify({ids:[...selectionListe]})})
                        const d = await res.json()
                        if (res.ok) { toast.success(`${d.supprimes} voyage(s) supprimé(s)`); setSelectionListe(new Set()); load() }
                        else toast.error(d.error||'Erreur')
                      } catch { toast.error('Erreur réseau') }
                    }}>
                    🗑️ Supprimer la sélection
                  </button>
                  <button className="mc-btn" style={{fontSize:11,background:C.border}} onClick={()=>setSelectionListe(new Set())}>Annuler</button>
                </div>
              )}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {voyages.filter(v=>{
                if (!rechercheListe) return true
                const s = rechercheListe.toLowerCase()
                return (v.personnel_nom||'').toLowerCase().includes(s) || (v.destination||'').toLowerCase().includes(s) || (v.origine||'').toLowerCase().includes(s)
              }).map(v=>{
                const valCfg = {
                  en_attente: {bg:'#fef3c722',color:'#f0a500',label:'⏳ En attente'},
                  valide:     {bg:`${C.green}18`,color:C.green,label:'✅ Validé'},
                  refuse:     {bg:`${C.red}18`,color:C.red,label:'❌ Refusé'},
                }[v.statut_validation] || {bg:C.border,color:C.muted,label:v.statut_validation}
                const estSelectionne = selectionListe.has(v.id)
                return (
                  <Panel key={v.id} style={{padding:0,overflow:'hidden',outline:estSelectionne?`2px solid ${C.red}`:'none'}}>
                    {/* Bandeau façon billet — talon perforé stylisé */}
                    <div style={{display:'flex',alignItems:'stretch'}}>
                      <div style={{display:'flex',alignItems:'center',padding:'0 4px 0 12px'}}>
                        <input type="checkbox" checked={estSelectionne}
                          onChange={()=>setSelectionListe(prev=>{
                            const next = new Set(prev)
                            if (next.has(v.id)) next.delete(v.id); else next.add(v.id)
                            return next
                          })}
                          style={{width:16,height:16,cursor:'pointer'}}/>
                      </div>
                      <div style={{flex:1,padding:16,borderRight:`1.5px dashed ${C.border}`}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                          <div>
                            <div style={{fontWeight:800,fontSize:15,color:C.text}}>{v.personnel_nom}</div>
                            <div style={{fontSize:11,color:C.muted}}>{v.personnel_societe}</div>
                          </div>
                          <span style={{background:valCfg.bg,color:valCfg.color,padding:'3px 10px',borderRadius:20,fontSize:10,fontWeight:700}}>{valCfg.label}</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:12,fontFamily:'JetBrains Mono,monospace',fontSize:13,color:C.text}}>
                          <span>🏕️ CAMP</span>
                          <span style={{flex:1,borderTop:`1px dashed ${C.border}`,position:'relative'}}>
                            <span style={{position:'absolute',right:0,top:-9,fontSize:12}}>✈️</span>
                          </span>
                          <span>{(v.destination||'—').toUpperCase()}</span>
                        </div>
                        <div style={{display:'flex',gap:16,marginTop:8,fontSize:11,color:C.muted}}>
                          <span>Départ : <b style={{color:C.text}}>{fmt(v.date_depart)}</b>{v.heure_depart?` à ${v.heure_depart}`:''}</span>
                          <span>Retour prévu : <b style={{color:C.text}}>{fmt(v.date_retour_prevue)}</b></span>
                          {v.rotation_id && <span>Convoi : <b style={{color:C.accent}}>{v.rotation_id}</b></span>}
                        </div>
                      </div>
                      <div style={{width:150,padding:16,display:'flex',flexDirection:'column',gap:6,justifyContent:'center',background:`${C.accent}06`}}>
                        <a href={`${BASE}/api/voyages/${v.id}/billet/?token=${tok()}`} target="_blank" rel="noreferrer"
                          className="mc-btn mc-btn-primary" style={{fontSize:11,textDecoration:'none',justifyContent:'center'}}>🎫 Billet</a>
                        <button className="mc-btn" style={{fontSize:11,background:C.border,color:C.text}} onClick={()=>ouvrirDetail(v)}>Détails</button>
                        <button className="mc-btn" style={{fontSize:11,background:`${C.red}18`,color:C.red}}
                          onClick={async ()=>{
                            const ok = await confirmDialog(`Supprimer définitivement le voyage de ${v.personnel_nom} vers ${v.destination} ? Cette action est irréversible.`)
                            if (!ok) return
                            try {
                              const res = await api(`/api/voyages/${v.id}/supprimer_planifie/`, {method:'DELETE'})
                              if (res.ok) { toast.success('Voyage supprimé'); load() }
                              else { const d = await res.json(); toast.error(d.error||'Erreur') }
                            } catch { toast.error('Erreur réseau') }
                          }}>
                          🗑️ Supprimer
                        </button>
                      </div>
                    </div>
                  </Panel>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* ══ MODAL DÉTAIL COMPLET — qui a validé, quand, véhicule, itinéraire ══ */}
      {detailVoyage && (
        <div style={{position:'fixed',inset:0,background:'rgba(6,13,31,.85)',zIndex:2000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e=>e.target===e.currentTarget&&setDetailVoyage(null)}>
          <div style={{background:C.panel,borderRadius:16,width:'100%',maxWidth:520,maxHeight:'88vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.5)'}}>
            <div style={{background:`linear-gradient(135deg,${C.accent},#93c5fd)`,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:900,fontSize:16,color:'#0f172a'}}>{detailVoyage.personnel_nom}</div>
                <div style={{fontSize:11,color:'#0f172a99'}}>{detailVoyage.personnel_societe} · Voyage #{detailVoyage.id}</div>
              </div>
              <button onClick={()=>setDetailVoyage(null)} style={{background:'rgba(0,0,0,.15)',border:'none',color:'#0f172a',width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20}}>
              {/* Trajet */}
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,fontFamily:'JetBrains Mono,monospace',fontSize:14,color:C.text}}>
                <span style={{fontWeight:700}}>{(detailVoyage.origine||'Camp Roxgold Sango').toUpperCase()}</span>
                <span style={{flex:1,borderTop:`1px dashed ${C.border}`,position:'relative'}}>
                  <span style={{position:'absolute',right:'50%',top:-9,fontSize:12}}>✈️</span>
                </span>
                <span style={{fontWeight:700,color:C.accent}}>{(detailVoyage.destination||'—').toUpperCase()}</span>
              </div>

              {/* Statut de validation — qui, quand */}
              <div style={{background:
                  detailVoyage.statut_validation==='valide' ? `${C.green}12` :
                  detailVoyage.statut_validation==='refuse' ? `${C.red}12` : '#f0a50012',
                border:`1px solid ${detailVoyage.statut_validation==='valide'?C.green:detailVoyage.statut_validation==='refuse'?C.red:'#f0a500'}30`,
                borderRadius:10,padding:12,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:12,
                  color:detailVoyage.statut_validation==='valide'?C.green:detailVoyage.statut_validation==='refuse'?C.red:'#f0a500'}}>
                  {detailVoyage.statut_validation==='valide' && '✅ Validé'}
                  {detailVoyage.statut_validation==='refuse' && '❌ Refusé'}
                  {detailVoyage.statut_validation==='en_attente' && '⏳ En attente de validation'}
                </div>
                {detailVoyage.valide_par_nom && (
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>
                    Par <b style={{color:C.text}}>{detailVoyage.valide_par_nom}</b>
                    {detailVoyage.date_validation && ` le ${new Date(detailVoyage.date_validation).toLocaleDateString('fr-FR')} à ${new Date(detailVoyage.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`}
                  </div>
                )}
                {detailVoyage.motif_refus && <div style={{fontSize:11,color:C.red,marginTop:4}}>Motif : {detailVoyage.motif_refus}</div>}
              </div>

              {/* Grille d'infos complètes */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                {[
                  ['📅 Date de départ', fmt(detailVoyage.date_depart,{day:'numeric',month:'long',year:'numeric'})],
                  ['🕐 Heure de départ', detailVoyage.heure_depart||'—'],
                  ['🏠 Retour prévu', fmt(detailVoyage.date_retour_prevue,{day:'numeric',month:'long',year:'numeric'})],
                  ['✅ Retour effectif', detailVoyage.date_retour_effective?fmt(detailVoyage.date_retour_effective,{day:'numeric',month:'long',year:'numeric'}):'—'],
                  [detailVoyage.statut_validation==='refuse' ? '🚗 Véhicule prévu (non confirmé)' : '🚗 Véhicule / Convoi', detailVoyage.vehicule||'—'],
                  ['🔖 Matricule', detailVoyage.vehicule_matricule||'—'],
                  ['🧑‍✈️ Conducteur (aller)', detailVoyage.conducteur||'—'],
                  ['📍 Point de RDV', detailVoyage.point_rdv||'—'],
                  ['🎫 Motif', detailVoyage.motif||'—'],
                  ['📊 Statut opérationnel', ST_CFG[detailVoyage.statut]?.l || detailVoyage.statut],
                ].map(([l,v])=>(
                  <div key={l} style={{background:C.bg,borderRadius:8,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.text}}>{v}</div>
                  </div>
                ))}
              </div>

              {detailVoyage.vehicule_photo && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>📸 Photo du véhicule</div>
                  <img src={detailVoyage.vehicule_photo} alt="Véhicule" style={{width:'100%',maxHeight:160,objectFit:'cover',borderRadius:10}}/>
                </div>
              )}

              {(detailVoyage.vehicule_retour || detailVoyage.conducteur_retour) && (
                <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:6}}>🔄 Trajet retour (différent de l'aller)</div>
                  <div style={{fontSize:12,color:C.text}}>
                    {detailVoyage.vehicule_retour && <div>Véhicule : <b>{detailVoyage.vehicule_retour}</b> {detailVoyage.vehicule_matricule_retour && `(${detailVoyage.vehicule_matricule_retour})`}</div>}
                    {detailVoyage.conducteur_retour && <div>Conducteur : <b>{detailVoyage.conducteur_retour}</b></div>}
                  </div>
                </div>
              )}

              {detailVoyage.notes_admin && (
                <div style={{fontSize:11,color:C.muted,marginBottom:16,fontStyle:'italic'}}>📝 {detailVoyage.notes_admin}</div>
              )}

              {/* Itinéraire détaillé */}
              {etapesDetail.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:8}}>🗺️ Itinéraire détaillé</div>
                  {etapesDetail.map(e=>(
                    <div key={e.id} style={{padding:'8px 10px',background:C.bg,borderRadius:8,marginBottom:6,fontSize:11}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{background:e.sens==='retour'?C.green:C.accent,color:'#0f172a',borderRadius:99,width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:10,flexShrink:0}}>{e.ordre}</span>
                        <span style={{fontWeight:700,color:e.sens==='retour'?C.green:C.accent}}>{e.sens==='retour'?'⬅️ RETOUR':'➡️ ALLER'}</span>
                        <span>{e.mode_transport_label}</span>
                        <span style={{color:C.muted}}>{e.origine} → {e.destination}</span>
                        <span style={{marginLeft:'auto',color:C.muted}}>{fmt(e.date_etape)}{e.heure_depart?` ${e.heure_depart}`:''}</span>
                      </div>
                      {(e.vehicule_nom || e.conducteur || e.reference) && (
                        <div style={{display:'flex',gap:10,marginTop:4,paddingLeft:26,color:C.muted,flexWrap:'wrap'}}>
                          {e.vehicule_nom && <span>🚗 <b style={{color:C.text}}>{e.vehicule_nom}</b>{e.vehicule_matricule?` (${e.vehicule_matricule})`:''}</span>}
                          {e.conducteur && <span>🧑‍✈️ {e.conducteur}</span>}
                          {e.reference && <span style={{fontFamily:'monospace'}}>{e.reference}</span>}
                          {e.billet_fichier && (
                            <a href={e.billet_fichier} download={`billet-${e.reference||e.id}.pdf`} onClick={ev=>ev.stopPropagation()}
                              style={{color:C.green,textDecoration:'underline'}}>🎫 Billet</a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions : changer de véhicule ou de convoi — verrouillé une fois le voyage termine */}
              {detailVoyage.statut !== 'retour' ? (
                <div style={{display:'flex',gap:8,marginBottom:16}}>
                  <button className="mc-btn" style={{flex:1,fontSize:11,background:C.bg}}
                    onClick={()=>setChangerVehiculeForm({vehicule:detailVoyage.vehicule||'', vehicule_matricule:detailVoyage.vehicule_matricule||'', vehicule_photo:detailVoyage.vehicule_photo||'', conducteur:detailVoyage.conducteur||'', vehicule_flotte_id:''})}>
                    🔄 Changer de véhicule
                  </button>
                  <button className="mc-btn" style={{flex:1,fontSize:11,background:C.bg}}
                    onClick={()=>setChangerConvoiForm(true)}>
                    🔀 Changer de convoi
                  </button>
                </div>
              ) : (
                <div style={{marginBottom:16,padding:'8px 12px',background:`${C.muted}12`,borderRadius:8,fontSize:11,color:C.muted,textAlign:'center'}}>
                  🔒 Voyage terminé (retour effectué) — itinéraire et véhicule figés, plus rien à modifier
                </div>
              )}

              {changerVehiculeForm && (
                <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:16,border:`1px solid ${C.accent}40`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.accent,marginBottom:8}}>🔄 Nouveau véhicule pour ce voyage</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:6,marginBottom:8}}>
                    <select value={changerVehiculeForm.vehicule_flotte_id} onChange={e=>{
                        const id = e.target.value
                        const v = flotte.find(f=>String(f.id)===id)
                        if (v) setChangerVehiculeForm(p=>({...p, vehicule_flotte_id:id, vehicule:v.nom, vehicule_matricule:v.matricule, vehicule_photo:v.photo}))
                        else setChangerVehiculeForm(p=>({...p, vehicule_flotte_id:''}))
                      }} style={inputStyle}>
                      <option value="">— Véhicule du parc —</option>
                      {flotte.map(v=><option key={v.id} value={v.id}>{v.categorie_label} {v.nom} — {v.matricule}</option>)}
                    </select>
                    <select value={changerVehiculeForm.conducteur} onChange={e=>setChangerVehiculeForm(p=>({...p,conducteur:e.target.value}))} style={inputStyle}>
                      <option value="">— Conducteur —</option>
                      {personnel.map(p=><option key={p.id} value={`${p.nom} ${p.prenom}`}>{p.nom} {p.prenom}</option>)}
                    </select>
                  </div>
                  {!changerVehiculeForm.vehicule_flotte_id && (
                    <input value={changerVehiculeForm.vehicule} onChange={e=>setChangerVehiculeForm(p=>({...p,vehicule:e.target.value}))}
                      placeholder="Ou nom libre" style={{...inputStyle,marginBottom:8}}/>
                  )}
                  <div style={{display:'flex',gap:8}}>
                    <button className="mc-btn" style={{flex:1,background:C.border}} onClick={()=>setChangerVehiculeForm(null)}>Annuler</button>
                    <button className="mc-btn mc-btn-primary" style={{flex:2}} onClick={soumettreChangerVehicule} disabled={!changerVehiculeForm.vehicule}>✓ Valider</button>
                  </div>
                </div>
              )}

              {changerConvoiForm && (
                <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:16,border:`1px solid ${C.green}40`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.green,marginBottom:8}}>🔀 Déplacer vers un autre convoi</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto'}}>
                    {rotations.filter(r=>r.rotation_id!==detailVoyage.rotation_id && r.places_libres>0 && r.statut!=='retour').length===0 && (
                      <div style={{fontSize:11,color:C.muted}}>Aucun autre convoi avec des places libres.</div>
                    )}
                    {rotations.filter(r=>r.rotation_id!==detailVoyage.rotation_id && r.places_libres>0 && r.statut!=='retour').map(r=>(
                      <div key={r.rotation_id} onClick={()=>soumettreChangerConvoi(r.rotation_id)}
                        style={{padding:'8px 10px',background:C.panel,borderRadius:8,cursor:'pointer',fontSize:11,display:'flex',justifyContent:'space-between'}}>
                        <span><b style={{color:C.text}}>{r.vehicule}</b> · {r.destination} · {fmt(r.date_depart)}</span>
                        <span style={{color:C.green}}>{r.places_libres} libre(s)</span>
                      </div>
                    ))}
                  </div>
                  <button className="mc-btn" style={{width:'100%',background:C.border,marginTop:8}} onClick={()=>setChangerConvoiForm(null)}>Annuler</button>
                </div>
              )}

              {/* Carte de l'itinéraire */}
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.accent}}>🗺️ Trajet sur la carte</div>
                  {detailVoyage.statut !== 'retour' && (
                  <div style={{display:'flex',gap:6}}>
                    <button className="mc-btn" style={{fontSize:10,padding:'4px 8px',background:C.bg}} onClick={()=>initNouvelleEtape('aller')}>➡️ + Étape aller</button>
                    <button className="mc-btn" style={{fontSize:10,padding:'4px 8px',background:C.bg}} onClick={()=>initNouvelleEtape('retour')}>⬅️ + Étape retour</button>
                  </div>
                  )}
                </div>
                <CarteItineraire origine={detailVoyage.origine} destination={detailVoyage.destination} etapes={etapesDetail}/>
              </div>

              {nouvelleEtape && (
                <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:16,border:`1px solid ${nouvelleEtape.sens==='retour'?C.green:C.accent}40`}}>
                  <div style={{fontSize:11,fontWeight:700,color:nouvelleEtape.sens==='retour'?C.green:C.accent,marginBottom:8}}>
                    {nouvelleEtape.sens==='retour'?'⬅️ Nouvelle étape RETOUR':'➡️ Nouvelle étape ALLER'}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginBottom:6}}>
                    <input value={nouvelleEtape.origine} onChange={e=>setNouvelleEtape(p=>({...p,origine:e.target.value}))} placeholder="Origine" style={inputStyle}/>
                    <input value={nouvelleEtape.destination} onChange={e=>setNouvelleEtape(p=>({...p,destination:e.target.value}))} placeholder="Destination" style={inputStyle}/>
                    <select value={nouvelleEtape.mode_transport} onChange={e=>setNouvelleEtape(p=>({...p,mode_transport:e.target.value,vehicule_flotte:''}))} style={inputStyle}>
                      {[['bus','🚌 Bus'],['4x4','🚙 4x4'],['avion','✈️ Avion'],['bateau','⛴️ Bateau'],['a_pied','🚶 À pied'],['autre','🚐 Autre']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  {nouvelleEtape.mode_transport !== 'a_pied' && (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginBottom:6}}>
                    <select value={nouvelleEtape.vehicule_flotte} onChange={e=>setNouvelleEtape(p=>({...p,vehicule_flotte:e.target.value}))} style={inputStyle}>
                      <option value="">— Véhicule du parc ({nouvelleEtape.mode_transport}) —</option>
                      {filtrerFlotteParMode(flotte, nouvelleEtape.mode_transport).map(v=><option key={v.id} value={v.id}>{v.categorie_label} {v.nom} — {v.matricule}</option>)}
                    </select>
                    <select value={nouvelleEtape.conducteur} onChange={e=>setNouvelleEtape(p=>({...p,conducteur:e.target.value}))} style={inputStyle}>
                      <option value="">— Conducteur —</option>
                      {personnel.map(p=><option key={p.id} value={`${p.nom} ${p.prenom}`}>{p.nom} {p.prenom}</option>)}
                    </select>
                  </div>
                  )}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:6,marginBottom:8}}>
                    <input type="date" value={nouvelleEtape.date_etape} onChange={e=>setNouvelleEtape(p=>({...p,date_etape:e.target.value}))} style={inputStyle}/>
                    <input type="time" value={nouvelleEtape.heure_depart} onChange={e=>setNouvelleEtape(p=>({...p,heure_depart:e.target.value}))} style={inputStyle}/>
                    <input value={nouvelleEtape.point_rdv} onChange={e=>setNouvelleEtape(p=>({...p,point_rdv:e.target.value}))} placeholder="Point de RDV" style={inputStyle}/>
                    <input value={nouvelleEtape.reference} onChange={e=>setNouvelleEtape(p=>({...p,reference:e.target.value}))} placeholder="Référence" style={inputStyle}/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button className="mc-btn" style={{flex:1,background:C.border}} onClick={()=>setNouvelleEtape(null)}>Annuler</button>
                    <button className="mc-btn mc-btn-primary" style={{flex:2}} onClick={soumettreEtape}
                      disabled={!nouvelleEtape.origine||!nouvelleEtape.destination||!nouvelleEtape.date_etape}>
                      ✓ Ajouter l'étape
                    </button>
                  </div>
                </div>
              )}

              <a href={`${BASE}/api/voyages/${detailVoyage.id}/billet/?token=${tok()}`} target="_blank" rel="noreferrer"
                className="mc-btn mc-btn-primary" style={{width:'100%',justifyContent:'center',textDecoration:'none',boxSizing:'border-box'}}>
                🎫 Voir / imprimer le billet complet
              </a>
            </div>
          </div>
        </div>
      )}

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
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
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
                    {/* Type de transport + Véhicule du parc — UN SEUL systeme coherent,
                        plus d'ancienne liste generique deconnectee du catalogue */}
                    <div style={{gridColumn:'span 2',display:'grid',
                      gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                      <div>
                        <label style={labelStyle}>Type de transport</label>
                        <select
                          value={formRot.mode_transport||'bus'}
                          onChange={e=>setFormRot(p=>({...p, mode_transport:e.target.value, vehicule_flotte_id:'', vehicule:'', vehicule_matricule:'', vehicule_photo:''}))}
                          style={inputStyle}>
                          {[['bus','🚌 Bus'],['4x4','🚙 4x4'],['avion','✈️ Avion'],['bateau','⛴️ Bateau'],['a_pied','🚶 À pied'],['autre','🚐 Autre']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      {formRot.mode_transport !== 'a_pied' && (
                      <div>
                        <label style={labelStyle}>Véhicule du parc <span style={{fontWeight:400,color:C.muted}}>(auto-remplit matricule/photo)</span></label>
                        <select value={formRot.vehicule_flotte_id}
                          onChange={e=>{
                            const id = e.target.value
                            const v = flotte.find(f=>String(f.id)===id)
                            if (v) setFormRot(p=>({...p, vehicule_flotte_id:id, vehicule:v.nom,
                              vehicule_matricule:v.matricule, vehicule_photo:v.photo,
                              nb_places_total:v.capacite}))
                            else setFormRot(p=>({...p, vehicule_flotte_id:'', vehicule:''}))
                          }} style={inputStyle}>
                          <option value="">— Sélectionner un véhicule du parc —</option>
                          {filtrerFlotteParMode(flotte, formRot.mode_transport||'bus').map(v=><option key={v.id} value={v.id}>{v.categorie_label} {v.nom} — {v.matricule} ({v.capacite} places)</option>)}
                        </select>
                        {formRot.vehicule_flotte_id ? (
                          <div style={{marginTop:6,display:'flex',alignItems:'center',gap:8,fontSize:11,color:C.muted}}>
                            {formRot.vehicule_photo && <img src={formRot.vehicule_photo} alt="Véhicule" style={{height:36,width:52,objectFit:'cover',borderRadius:6}}/>}
                            <span>Matricule : <b style={{color:C.text}}>{formRot.vehicule_matricule||'—'}</b></span>
                          </div>
                        ) : (
                          <input value={formRot.vehicule} onChange={e=>setFormRot(p=>({...p,vehicule:e.target.value}))}
                            placeholder="Ou nom libre si absent du catalogue (ex: Cessna 172)"
                            style={{...inputStyle,marginTop:6,fontSize:11}}/>
                        )}
                      </div>
                      )}
                      <div>
                        <label style={labelStyle}>Conducteur assigné</label>
                        <select value={formRot.conducteur}
                          onChange={e=>setFormRot(p=>({...p,conducteur:e.target.value}))}
                          style={inputStyle}>
                          <option value="">— Sélectionner dans le personnel —</option>
                          {personnel.map(p=><option key={p.id} value={`${p.nom} ${p.prenom}`}>{p.nom} {p.prenom} — {p.societe||'—'}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Capacité */}
                    <div>
                      <label style={labelStyle}>Capacité (sièges) {formRot.vehicule_flotte_id && <span style={{fontWeight:400,color:C.muted}}>(imposée par le véhicule du parc)</span>}</label>
                      <input type="number" min="1" max="60" value={formRot.nb_places_total}
                        disabled={!!formRot.vehicule_flotte_id}
                        onChange={e=>setFormRot(p=>({...p,nb_places_total:parseInt(e.target.value)||15}))}
                        style={{...inputStyle, background: formRot.vehicule_flotte_id ? C.bg : inputStyle.background, cursor: formRot.vehicule_flotte_id ? 'not-allowed' : 'text'}}/>
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
                    {saving ? '⏳ Création...' : `✦ Créer rotation ${formRot.vehicule||'—'} · ${formRot.passagers.length} passager(s)`}
                  </button>
                </div>
              )}

              {showCreate==='individuel' && (
                <div style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                    <div style={{gridColumn:'span 2'}}>
                      <label style={labelStyle}>Personnel *</label>
                      <select value={formIndiv.personnel_id}
                        onChange={e=>setFormIndiv(p=>({...p,personnel_id:e.target.value}))}
                        style={inputStyle}>
                        <option value="">Sélectionner...</option>
                        {personnel.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} — {p.societe||'—'}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Origine</label>
                      <input value={formIndiv.origine}
                        onChange={e=>setFormIndiv(p=>({...p,origine:e.target.value}))}
                        placeholder="Camp Roxgold Sango" style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Destination *</label>
                      <input value={formIndiv.destination}
                        onChange={e=>setFormIndiv(p=>({...p,destination:e.target.value}))}
                        placeholder="Abidjan..." style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Date départ *</label>
                      <input type="date" value={formIndiv.date_depart}
                        onChange={e=>setFormIndiv(p=>({...p,date_depart:e.target.value}))} style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Heure départ</label>
                      <input type="time" value={formIndiv.heure_depart}
                        onChange={e=>setFormIndiv(p=>({...p,heure_depart:e.target.value}))} style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Retour prévu *</label>
                      <input type="date" value={formIndiv.date_retour_prevue}
                        onChange={e=>setFormIndiv(p=>({...p,date_retour_prevue:e.target.value}))} style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Point de RDV</label>
                      <input value={formIndiv.point_rdv}
                        onChange={e=>setFormIndiv(p=>({...p,point_rdv:e.target.value}))} style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Véhicule du parc <span style={{fontWeight:400,color:C.muted}}>(matricule/photo auto-remplis)</span></label>
                      <select value={formIndiv.vehicule_flotte_id||''}
                        onChange={e=>{
                          const id = e.target.value
                          const v = flotte.find(f=>String(f.id)===id)
                          if (v) setFormIndiv(p=>({...p, vehicule_flotte_id:id, vehicule:v.nom,
                            vehicule_matricule:v.matricule, vehicule_photo:v.photo}))
                          else setFormIndiv(p=>({...p, vehicule_flotte_id:''}))
                        }} style={inputStyle}>
                        <option value="">— Sélectionner un véhicule du parc —</option>
                        {flotte.map(v=><option key={v.id} value={v.id}>{v.categorie_label} {v.nom} — {v.matricule}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Conducteur</label>
                      <select value={formIndiv.conducteur}
                        onChange={e=>setFormIndiv(p=>({...p,conducteur:e.target.value}))} style={inputStyle}>
                        <option value="">— Sélectionner dans le personnel —</option>
                        {personnel.map(p=><option key={p.id} value={`${p.nom} ${p.prenom}`}>{p.nom} {p.prenom} — {p.societe||'—'}</option>)}
                      </select>
                    </div>
                    <div style={{gridColumn:'span 2'}}>
                      <label style={labelStyle}>Motif</label>
                      <input value={formIndiv.motif}
                        onChange={e=>setFormIndiv(p=>({...p,motif:e.target.value}))}
                        placeholder="Congé, Mission, Formation..." style={inputStyle}/>
                    </div>
                  </div>
                  <button className="mc-btn mc-btn-primary"
                    style={{width:'100%',justifyContent:'center',padding:13,fontSize:14}}
                    disabled={saving||!formIndiv.personnel_id||!formIndiv.date_depart||!formIndiv.date_retour_prevue}
                    onClick={creerIndividuel}>
                    {saving ? '⏳ Création...' : '✈️ Créer le voyage individuel'}
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
