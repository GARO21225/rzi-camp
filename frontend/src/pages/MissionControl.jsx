import { useState, useEffect, useCallback, useRef } from 'react'
import { toast, confirmDialog } from '../toast'
import LieuInput from '../components/LieuInput'
import { useIsMobile } from '../hooks/useIsMobile'
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
  glow:   'rgba(201,151,43,.28)',
  text:   '#0F1A2E',
  muted:  '#5B6472',
  accent: '#C9972B',
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
  planifie:  { l:'Planifié',     c:C.accent,  dot:'#C9972B' },
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
                  🧳 {v.personnel_nom||v.destination}
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
          <filter id="glow-gold"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glow-green"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Villes */}
        {/* Abidjan */}
        <circle cx="40" cy="90" r="12" fill="rgba(201,151,43,.12)" stroke="#e0b04d" strokeWidth="1.5" filter="url(#glow-gold)"/>
        <circle cx="40" cy="90" r="4" fill="#e0b04d"/>
        <text x="40" y="114" textAnchor="middle" fontSize="8" fill={C.muted} fontFamily="JetBrains Mono" letterSpacing="0.5">ABIDJAN</text>

        {/* Camp */}
        <circle cx="200" cy="70" r="16" fill="rgba(201,151,43,.2)" stroke="#e0b04d" strokeWidth="2" filter="url(#glow-gold)"/>
        <circle cx="200" cy="70" r="5" fill="#e0b04d"/>
        <circle cx="200" cy="70" r="20" fill="none" stroke="rgba(201,151,43,.25)" strokeWidth="1">
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
        <path d="M 52 90 Q 120 55 188 70" stroke="rgba(201,151,43,.2)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
        {dep > 0 && <>
          <circle r="3.5" fill={C.accent} opacity=".9" filter="url(#glow-gold)">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 52 90 Q 120 55 188 70"/>
          </circle>
          <circle r="3.5" fill={C.accent} opacity=".5">
            <animateMotion dur="2.8s" begin="1.4s" repeatCount="indefinite" path="M 52 90 Q 120 55 188 70"/>
          </circle>
        </>}
        {/* Badge départs */}
        <rect x="88" y="56" width="36" height="14" rx="3" fill="rgba(201,151,43,.15)" stroke="rgba(201,151,43,.3)" strokeWidth="0.5"/>
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
      onMouseEnter={e=>e.currentTarget.style.background='rgba(201,151,43,.04)'}
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
            background:isTod?'rgba(201,151,43,.06)':'transparent',
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
  const isMobile = useIsMobile()
  const [view,       setView]      = useState('command')
  const [voyages,    setVoyages]   = useState([])
  const [rotations,  setRotations] = useState([])
  const [personnel,  setPersonnel] = useState([])
  const [stats,      setStats]     = useState({})
  const [loading,    setLoading]   = useState(true)
  const [weekOff,    setWeekOff]   = useState(0)
  const [selVoyage,  setSelVoyage] = useState(null)
  const [selRot,     setSelRot]    = useState(null)
  const [manifFiltreConvoi, setManifFiltreConvoi] = useState('tous')
  const [manifFiltreDestination, setManifFiltreDestination] = useState('')
  const [manifFiltreDateDebut, setManifFiltreDateDebut] = useState('')
  const [manifFiltreDateFin, setManifFiltreDateFin] = useState('')
  const [showCreate, setShowCreate]= useState(false) // 'rotation' | 'individuel' | null
  const [msg,        setMsg]       = useState(null)
  const [saving,     setSaving]    = useState(false)

  // Formulaires
  const [formRot, setFormRot] = useState({
    destination:'Abidjan', origine:'Camp Roxgold Sango', vehicule:'',
    vehicule_matricule:'', vehicule_photo:'', conducteur:'', conducteur_secondaire:'', vehicule_flotte_id:'',
    niveau_alerte: 1,
    trajet_aller_seul: false,
    villesIntermediaires: [],
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
        if (data.exclus && data.exclus.length > 0) {
          setTimeout(() => toast.warning(`⚠️ ${data.exclus.length} personne(s) retirée(s) automatiquement (déjà en voyage) : ${data.exclus.join(' | ')}`, 8000), 400)
        }
        // Villes intermediaires saisies a la creation -> sauvegardees comme
        // etapes du voyage de reference (le premier cree), pour que le
        // tableau "Cote de securite de route" du JMP soit rempli sans
        // repasser une par une par le detail de chaque voyage apres coup.
        if (formRot.villesIntermediaires.length > 0 && data.ids?.length > 0) {
          const refId = data.ids[0]
          for (let i = 0; i < formRot.villesIntermediaires.length; i++) {
            const ville = formRot.villesIntermediaires[i]
            const precedente = i === 0 ? formRot.origine : formRot.villesIntermediaires[i-1].nom
            try {
              await api('/api/etapes-voyage/', {
                method:'POST',
                body: JSON.stringify({
                  voyage: refId, ordre: i+1, sens:'aller',
                  origine: precedente, destination: ville.nom,
                  mode_transport: formRot.mode_transport||'bus',
                  date_etape: formRot.date_depart,
                  heure_depart: ville.heure_depart||'', heure_arrivee_prevue: ville.heure_arrivee||'',
                  distance_km: ville.distance_km||null, pause_fatigue: ville.pause||'',
                })
              })
            } catch { /* etape individuelle en echec - rotation deja creee, non bloquant */ }
          }
        }
        setShowCreate(null)
        setFormRot({destination:'Abidjan',origine:'Camp Roxgold Sango',vehicule:'',
          vehicule_matricule:'',vehicule_photo:'',conducteur:'',vehicule_flotte_id:'',mode_transport:'bus',
          date_depart:'',date_retour_prevue:'',nb_places_total:15,niveau_alerte:1,villesIntermediaires:[],
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
          // Capacite du vrai vehicule si choisi, sinon 4 par defaut (pas 1) -
          // laisse la place a des passagers express qui se presentent au
          // depart, sans devoir tout re-creer.
          nb_places_total: formIndiv.nb_places_total || 4,
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
      const res = await api(`/api/voyages/${id}/${action}/`, {method:'POST'})
      const d = await res.json()
      flash(`Statut mis à jour`)
      if (d.alerte_chambre) toast.warning(`🏠 ${d.alerte_chambre}`, 10000)
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
    heure_depart:'', heure_arrivee_prevue:'', distance_km:'', pause_fatigue:'', point_rdv:'', reference:'',
  })

  const importerEtapesEnMasse = async (sens) => {
    if (!detailVoyage) return
    const exemple = "Camp, Seguela, 36, 06:30, 07:20, N/A\nSeguela, Mankono, 54, 07:20, 08:20, N/A"
    const saisie = prompt(
      `Coller un itinéraire, une étape par ligne :\nDe, À, Distance(km), Heure départ, Heure arrivée, Pause\n\nExemple :\n${exemple}`
    )
    if (!saisie) return
    const lignes = saisie.split('\n').map(l=>l.trim()).filter(Boolean)
    let ordreDepart = etapesDetail.length + 1
    let reussies = 0
    const echecs = []
    for (const ligne of lignes) {
      const parts = ligne.split(/[,;\t]/).map(p=>p.trim())
      const [origine, destination, distance, heure_depart, heure_arrivee, pause] = parts
      if (!origine || !destination) { echecs.push(ligne); continue }
      try {
        const res = await api('/api/etapes-voyage/', {
          method:'POST',
          body: JSON.stringify({
            voyage: detailVoyage.id, ordre: ordreDepart++, sens,
            origine, destination,
            distance_km: distance || null,
            heure_depart: heure_depart || null,
            heure_arrivee_prevue: heure_arrivee || null,
            pause_fatigue: pause || '',
            mode_transport: 'bus',
            date_etape: sens==='retour' ? (detailVoyage.date_retour_prevue||detailVoyage.date_depart) : detailVoyage.date_depart,
          })
        })
        if (res.ok) reussies++
        else echecs.push(ligne)
      } catch { echecs.push(ligne) }
    }
    const r = await api(`/api/etapes-voyage/?voyage=${detailVoyage.id}`).then(r=>r.json())
    setEtapesDetail(r.results || r || [])
    load()
    if (reussies) toast.success(`${reussies} étape(s) ajoutée(s).`)
    if (echecs.length) toast.error(`${echecs.length} ligne(s) non reconnue(s) : ${echecs.join(' | ')}`)
  }

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

  const genererJMP = async (rotation) => {
    // Voyage de reference pour ce convoi (vehicule/chauffeur/dates communs) -
    // le premier passager confirme, ou a defaut n'importe lequel.
    const refVoyageId = rotation.passagers?.[0]?.id
    const refVoyage = refVoyageId ? voyages.find(v=>v.id===refVoyageId) : null
    if (!refVoyage) { toast.error("Impossible de trouver un voyage de référence pour ce convoi."); return }

    let etapes = []
    try {
      etapes = await api(`/api/etapes-voyage/?voyage=${refVoyage.id}`).then(r=>r.json())
      etapes = (etapes.results || etapes || []).filter(e=>e.sens!=='retour').sort((a,b)=>a.ordre-b.ordre)
    } catch { /* pas d'etapes detaillees - on se contente du trajet global */ }

    if (etapes.length === 0) {
      const continuer = await confirmDialog(
        "Aucune ville intermédiaire ni distance n'a encore été renseignée pour ce convoi.\n\n" +
        "Pour les faire apparaître sur le JMP : ouvrez le voyage (clic sur une ligne du Manifeste), " +
        "puis « + Étape aller » pour chaque ville du trajet (avec distance et horaires).\n\n" +
        "Générer quand même le JMP sans le détail des étapes ?"
      )
      if (!continuer) return
    }

    let param = {}
    try {
      const liste = await api('/api/parametres/').then(r=>r.json())
      liste.forEach(p => { param[p.cle] = p.valeur })
    } catch { /* champs urgence vides si echec */ }

    const passagersDetail = (rotation.passagers||[]).map(p => voyages.find(v=>v.id===p.id)).filter(Boolean)
    const niveauCourant = refVoyage.niveau_alerte || 1
    const niveaux = [
      "Aucune restriction de voyage<br>No restrictions",
      "Prudence Coordination entre CCTV<br>Caution Coordination between CCTV",
      "Minimum de 2 convois de véhicules<br>Min. of 2 vehicles convoys",
      "Escorte gendarme/policière requise.<br>Gendarme/police escort required",
      "Aucun voyage n'est autorisé<br>No travel is authorized",
    ]

    const ligneManifeste = passagersDetail.map((v,i) => `
      <tr>
        <td class="ord">${i}</td>
        <td class="pass">${v.personnel_nom||''}</td>
        <td>${v.personnel_departement||v.personnel_societe||''}</td>
        <td>${v.personnel_telephone||''}</td>
        <td>${v.origine||'—'}</td>
        <td>${v.destination||''}</td>
      </tr>`).join('')

    const ligneEtapes = etapes.length ? etapes.map(e => `
      <tr>
        <td>${e.ordre}</td><td>${e.origine}</td><td>${e.destination}</td>
        <td>${e.distance_km ? e.distance_km+' Kms' : '—'}</td>
        <td>${e.heure_depart||'—'}</td><td>${e.heure_arrivee_prevue||'—'}</td>
        <td>${e.pause_fatigue||'N/A'}</td>
      </tr>`).join('') : `<tr><td colspan="7" style="text-align:center;color:#888">Aucune étape détaillée renseignée pour ce voyage</td></tr>`

    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>JMP ${rotation.rotation_id}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11.5px;margin:20px;color:#111}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        td,th{border:1px solid #333;padding:5px 8px}
        .hdr td{border:1px solid #333;padding:6px 10px;font-size:11px}
        .hdr .lbl{font-style:italic;color:#333;background:#f3f3f3;width:1%;white-space:nowrap}
        .hdr .chk{text-align:center;font-size:15px;width:1%}
        .trajet{background:#111;color:#fff;text-align:center;font-weight:800;font-size:14px;padding:10px;text-transform:uppercase}
        thead td{background:#f0d020;font-weight:800;text-align:center;text-transform:uppercase;font-size:10.5px}
        .ord{text-align:center;font-weight:800;color:#c00}
        .urgence{background:#111;color:#fff;text-align:center;padding:8px;font-weight:700;font-size:12px;margin-bottom:10px}
        .niveaux td{text-align:center;font-size:10px;font-weight:700}
        .niveaux .actif{background:#111;color:#fff}
        .print-btn{background:#1e3a8a;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;margin-bottom:16px}
        @media print{.print-btn{display:none}}
        h3{font-size:13px;margin:16px 0 4px}
        ul{font-size:11px;margin:4px 0}
      </style></head><body>
      <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Sauvegarder PDF</button>
      ${param.jmp_logo_base64 ? `<img src="data:${param.jmp_logo_mime||'image/jpeg'};base64,${param.jmp_logo_base64}" style="max-height:60px;display:block;margin:0 auto 8px"/>` : ''}
      <h2 style="text-align:center">Plan de gestion de voyage</h2>
      <div class="urgence">URGENCE/EMERGENCY : Sat Téléphone : ${param.jmp_tel_satellite||'—'} · MTN : ${param.jmp_tel_mtn||'—'} · Orange : ${param.jmp_tel_orange||'—'}</div>

      <table class="hdr"><tr>
        <td class="lbl">Nom de l'entreprise</td><td>ROXGOLD SANGO</td>
        <td class="lbl">Date de la demande</td><td>${new Date().toLocaleDateString('fr-FR')}</td>
        <td class="lbl">Type de véhicule</td><td>${refVoyage.vehicule||''}</td>
      </tr><tr>
        <td class="lbl">Voyager à partir de</td><td>${refVoyage.origine||''}</td>
        <td class="lbl">Destination finale</td><td>${refVoyage.destination||''}</td>
        <td class="lbl">Numéro de véhicule</td><td>${refVoyage.vehicule||''}</td>
      </tr><tr>
        <td class="lbl">Date de début du voyage</td><td>${fmt(refVoyage.date_depart)}</td>
        <td class="lbl">Date de fin de voyage</td><td>${fmt(refVoyage.date_retour_prevue)}</td>
        <td class="lbl">Immatriculation</td><td>${refVoyage.vehicule_matricule||''}</td>
      </tr></table>

      <table class="hdr equip">
        <tr><td class="lbl">Bouton de panique in véhicule ?</td><td class="chk">☐</td><td class="lbl">Eau</td><td class="chk">☐</td></tr>
        <tr><td class="lbl">Emplacement du bouton connu ?</td><td class="chk">☐</td><td class="lbl">Carte</td><td class="chk">☐</td></tr>
        <tr><td class="lbl">Téléphone satellite</td><td class="chk">☐</td><td class="lbl">Lire et comprendre JMP ?</td><td class="chk">☐</td></tr>
        <tr><td class="lbl">Numéro de téléphone satellite :</td><td style="font-size:10px">${param.jmp_tel_satellite||''}</td><td class="lbl">Trousse de premiers soins ?</td><td class="chk">☐</td></tr>
      </table>

      <div class="trajet">${rotation.rotation_id} — ${refVoyage.origine||''} → ${refVoyage.destination||''}</div>

      <table><thead><tr><td>Ordre</td><td>Passagers</td><td>Société / Département</td><td>N° MTN / Orange</td><td>Lieu de montée</td><td>Lieu de descente</td></tr></thead>
        <tbody>
          <tr><td class="ord">—</td><td class="pass">${refVoyage.conducteur||''}</td><td colspan="4" style="font-weight:700;background:#fafafa">CHAUFFEUR</td></tr>
          ${refVoyage.conducteur_secondaire?`<tr><td class="ord">—</td><td class="pass">${refVoyage.conducteur_secondaire}</td><td colspan="4" style="font-weight:700;background:#fafafa">SECOND DRIVER</td></tr>`:''}
          ${ligneManifeste}
        </tbody>
      </table>

      <h3>Côte de sécurité de route</h3>
      <table><thead><tr><td>Étape</td><td>De</td><td>À</td><td>Distance (km)</td><td>Heure de départ</td><td>Heure d'arrivée</td><td>Gestion fatigue</td></tr></thead>
        <tbody>${ligneEtapes}</tbody>
      </table>

      <table style="margin-top:14px"><tr>
        <td style="width:25%">Chauffeur : <b>${refVoyage.conducteur||''}</b></td>
        <td style="width:25%">Fonction : <b>${(personnel.find(p=>`${p.nom} ${p.prenom}`===refVoyage.conducteur)?.departement) || (personnel.find(p=>`${p.nom} ${p.prenom}`===refVoyage.conducteur)?.profil_label) || '—'}</b></td>
        <td style="width:20%">Date : <b>${new Date().toLocaleDateString('fr-FR')}</b></td>
        <td style="width:30%">Signature : ______________________</td>
      </tr><tr>
        <td>Approbation sécurité : <b>${param.jmp_securite_nom||'—'}</b></td>
        <td>Fonction : <b>${param.jmp_securite_fonction||'—'}</b></td>
        <td>Date : <b>${new Date().toLocaleDateString('fr-FR')}</b></td>
        <td>Signature : ______________________</td>
      </tr></table>

      <h3>Niveaux d'alerte sur l'itinéraire</h3>
      <div style="display:flex;width:100%;margin-top:22px">
        ${['#8dc63f','#ffe600','#c86a1e','#e2231a','#5b3a8e'].map((couleur,i) => `
          <div style="flex:1;position:relative;margin-left:${i>0?'-14px':'0'};
            transform:${i+1===niveauCourant?'scale(1.12)':'scale(1)'};z-index:${i+1===niveauCourant?10:1};transition:none">
            ${i+1===niveauCourant?'<div style="position:absolute;top:-20px;left:0;right:0;text-align:center;font-size:16px;color:#111">▼</div>':''}
            <div style="background:${couleur};color:${i===1?'#000':'#fff'};text-align:center;
              padding:10px 6px;font-size:9.5px;font-weight:800;
              border:${i+1===niveauCourant?'3px solid #111':'none'};
              clip-path:${i<4?'polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%, 15% 50%)':'polygon(0 0, 100% 0, 100% 100%, 0 100%, 15% 50%)'}">
              ${niveaux[i]}
            </div>
          </div>`).join('')}
      </div>
      <div style="font-size:10px;color:#555;margin-top:4px">Niveau retenu pour ce voyage : agrandi, marqué ▼ et encadré en noir.</div>

      <h3>REGLES DE CONDUITE/DRIVING RULES</h3>
      <ul>
        <li>Maximum de 8hrs de conduite par jour. / Maximum of 8 hours of driving per day</li>
        <li>Minimum de 10 heures de repos avant le voyage /Minimum of 8 hours of rest before the trip</li>
        <li>Pause minimale de 15 minutes pour chaque 2-3 heures de conduite à des endroits sécurisés / Minimum break of 15 minutes for every 2 hours of driving in a safe area</li>
        <li>Après 2 jours de voyage successif un repos de 24 H Obligatoire est soumis au conducteur/ After 2 days of successive travel a mandatory 24-hour rest is submitted to the driver</li>
        <li><b>RESPECT Strict des limites de vitesse/ STRICT observance of speed limits</b></li>
        <li>Adapter votre conduite aux situations routières (Météo, visibilité, trafic routier, jour de marché, etc) / Adapt your driving to the road situation (weather, visibility, traffic, market day, etc)</li>
      </ul>

      <h3>Comment utiliser ce JMP (Journey Management Plan) :</h3>
      <ul>
        <li>Remplissez ce document et obtenez une signature ou un email d'autorisation du service de sécurité de Roxgold.</li>
        <li>Assurez-vous que toutes les instructions de sécurité et de sûreté sont suivies et que vous respectez les niveaux d'alerte d'itinéraire (comme expliqué ci-dessous).</li>
        <li>Téléphonez au centre d'urgence aux numéros suivant avant le départ : <b>${param.jmp_tel_orange||'A renseigner'} (N° Orange)/${param.jmp_tel_mtn||'A renseigner'} (N° MTN)</b></li>
        <li>Pendant votre voyage, au moindre incident informez le service de sécurité.</li>
        <li>À votre arrivée à destination, contactez le service de sécurité.</li>
      </ul>
    </body></html>`)
    w.document.close()
  }

  const partirRotation = async (rotId) => {
    try {
      const res = await api('/api/voyages/partir_rotation/',{method:'POST',body:JSON.stringify({rotation_id:rotId})})
      const d = await res.json()
      flash(`Rotation en transit 🧳 (${d.partis} parti(s))`)
      if (d.echecs && d.echecs.length > 0) {
        toast.warning(`⚠️ ${d.echecs.length} n'ont pas pu partir : ${d.echecs.join(' | ')}`, 8000)
      }
      load()
    } catch(e) { flash('Erreur',false) }
  }

  const retourRotation = async (rotId) => {
    try {
      const res = await api('/api/voyages/retour_rotation/',{method:'POST',body:JSON.stringify({rotation_id:rotId})})
      const d = await res.json()
      flash(`Rotation revenue 🏠 (${d.rentres} rentré(s))`)
      if (d.echecs && d.echecs.length > 0) {
        toast.warning(`⚠️ ${d.echecs.length} n'ont pas pu revenir : ${d.echecs.join(' | ')}`, 8000)
      }
      if (d.alertes_chambre && d.alertes_chambre.length > 0) {
        // Conflit resident principal / occupant temporaire au retour
        // (sections 8/10/13 du document hebergement) - affiche
        // immediatement ici, en plus de la notification deja envoyee
        // aux admins et au resident.
        d.alertes_chambre.forEach(a => toast.warning(`🏠 ${a}`, 10000))
      }
      load()
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
    .mc-root::before { content:''; position:fixed; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(201,151,43,.018) 2px,rgba(201,151,43,.018) 4px); pointer-events:none; z-index:0; }
    .mc-inner { position:relative; z-index:1; padding:14px 18px; }
    .mc-tab { padding:7px 18px; border-radius:7px; border:none; cursor:pointer; font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:600; transition:all .15s; }
    .mc-tab.active { background:${C.accent}; color:${C.bg}; box-shadow:0 0 12px ${C.accent}50; }
    .mc-tab:not(.active) { background:rgba(201,151,43,.07); color:${C.muted}; }
    .mc-tab:not(.active):hover { background:rgba(201,151,43,.13); color:${C.text}; }
    .mc-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:700; transition:all .15s; }
    .mc-btn-primary { background:${C.accent}; color:${C.bg}; box-shadow:0 0 12px ${C.accent}40; }
    .mc-btn-primary:hover { background:#93c5fd; }
    .mc-btn-ghost { background:rgba(201,151,43,.08); color:${C.accent}; border:0.5px solid ${C.border}; }
    .mc-btn-ghost:hover { background:rgba(201,151,43,.15); }
    .mc-btn-danger { background:rgba(248,113,113,.12); color:${C.red}; border:0.5px solid rgba(248,113,113,.3); }
    .mc-btn-success { background:rgba(52,211,153,.12); color:${C.green}; border:0.5px solid rgba(52,211,153,.3); }
    .mc-input { background:rgba(255,255,255,.05); border:0.5px solid ${C.border}; borderRadius:8px; padding:8px 12px; fontSize:13px; color:${C.text}; fontFamily:'Space Grotesk',sans-serif; outline:none; width:100%; }
    .mc-input:focus { border-color:${C.accent}60; }
    @keyframes mcPulse { 0%,100%{opacity:1} 50%{opacity:.2} }
    @keyframes mcFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .mc-fade { animation:mcFadeIn .25s ease; }
    .mc-row:hover { background:rgba(201,151,43,.04) !important; }
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
        <div style={{display:'flex',justifyContent:'space-between',alignItems:isMobile?'flex-start':'center',
          flexDirection:isMobile?'column':'row',gap:isMobile?12:0,
          marginBottom:14,paddingBottom:12,
          borderBottom:`0.5px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            {/* Logo */}
            {!isMobile && <div style={{width:38,height:38,border:`1px solid ${C.accent}`,
              borderRadius:9,display:'flex',alignItems:'center',
              justifyContent:'center',position:'relative',flexShrink:0}}>
              <div style={{position:'absolute',inset:4,border:`1px solid ${C.accent}40`,
                borderRadius:5,animation:'mcPulse 2.5s ease-in-out infinite'}}/>
              <span style={{fontSize:18}}>⛏️</span>
            </div>}
            <div>
              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:isMobile?11:12,fontWeight:600,
                letterSpacing:2,textTransform:'uppercase',color:C.accent}}>
                Centre de Mobilité · Roxgold SiteLife
              </div>
              <div style={{fontSize:10,color:C.muted,letterSpacing:.5,marginTop:1}}>
                Rotations · Voyages · Itinéraires · Validations
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:4,background:`rgba(201,151,43,.05)`,
            borderRadius:10,padding:4,
            flexWrap:isMobile?'nowrap':'wrap',
            overflowX:isMobile?'auto':'visible',
            width:isMobile?'100%':'auto',
            WebkitOverflowScrolling:'touch'}}>
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
                  onClick={()=>setView(v)} style={{position:'relative',flexShrink:0}}>
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
              <Kpi icon="🧳" label="En transit" value={stats.en_voyage||0} color={C.amber}
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
                    <div style={{padding:'14px 18px',display:'flex',gap:14,flexWrap:isMobile?'wrap':'nowrap',
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
                      <div style={{width:isMobile?'100%':130,flexShrink:0,order:isMobile?3:0}}>
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
                        {r.statut==='planifie'&&<button className="mc-btn"
                          style={{padding:'6px 12px',fontSize:11,background:'#7c3aed20',color:'#7c3aed',border:'1px solid #7c3aed40'}}
                          onClick={async e=>{
                            e.stopPropagation()
                            await genererJMP(r)
                          }}>
                          🛡️ JMP
                        </button>}
                        {r.statut==='planifie'&&<button className="mc-btn mc-btn-primary"
                          style={{padding:'6px 12px',fontSize:11}}
                          onClick={e=>{e.stopPropagation();partirRotation(r.rotation_id)}}>
                          🧳 Partir
                        </button>}
                        {r.statut==='en_voyage'&&<button className="mc-btn mc-btn-success"
                          style={{padding:'6px 12px',fontSize:11}}
                          onClick={e=>{e.stopPropagation();retourRotation(r.rotation_id)}}>
                          {r.trajet_aller_seul ? '✅ Terminer' : '🏠 Retour'}
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
                                <button type="button" className="mc-btn" style={{width:'100%',fontSize:12,padding:'8px 12px',
                                    background:C.accent,color:'#000',fontWeight:800,marginBottom:8,border:'none',borderRadius:8}}
                                    onClick={async ()=>{
                                      const saisie = prompt(`Coller une liste de numéros de téléphone à ajouter à ${r.vehicule||r.rotation_id} (un par ligne, ou séparés par des virgules) :`)
                                      if (!saisie) return
                                      const normTel = (v) => (v||'').replace(/\D/g,'').replace(/^225/,'').slice(-9)
                                      const numeros = saisie.split(/[\n,;]+/).map(s=>normTel(s)).filter(Boolean)
                                      const dejaPresents = (r.passagers||[]).map(pp=>`${pp.personnel__nom} ${pp.personnel__prenom}`.toLowerCase())
                                      let placesRestantes = libres
                                      const trouves = []
                                      const introuvables = []
                                      const complets = []
                                      for (const tel of numeros) {
                                        const p = personnel.find(pp => normTel(pp.telephone)===tel || normTel(pp.numero_whatsapp)===tel)
                                        if (!p) { introuvables.push(tel); continue }
                                        if (dejaPresents.includes(`${p.nom} ${p.prenom}`.toLowerCase())) continue
                                        if (placesRestantes <= 0) { complets.push(tel); continue }
                                        trouves.push(p)
                                        placesRestantes--
                                      }
                                      setSaving(true)
                                      let ok = 0, echoues = []
                                      for (const p of trouves) {
                                        try {
                                          const res = await api('/api/voyages/rejoindre_rotation/', {method:'POST', body: JSON.stringify({rotation_id:r.rotation_id, personnel_id:p.id})})
                                          if (res.ok) ok++
                                          else { const d = await res.json(); echoues.push(`${p.nom} ${p.prenom} (${d.error||'erreur'})`) }
                                        } catch { echoues.push(`${p.nom} ${p.prenom} (réseau)`) }
                                      }
                                      setSaving(false)
                                      let msg = `${ok} passager(s) ajouté(s) à ${r.vehicule||r.rotation_id}.`
                                      if (introuvables.length) msg += ` ${introuvables.length} numéro(s) introuvable(s).`
                                      if (complets.length) msg += ` ${complets.length} refusé(s) — convoi complet.`
                                      if (echoues.length) msg += ` ${echoues.length} échec(s) : ${echoues.join(', ')}.`
                                      flash(msg, echoues.length===0 && introuvables.length===0 && complets.length===0)
                                      load()
                                    }}>
                                  📋 Importer une liste dans ce convoi
                                </button>
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
                              {(r.passagers||[]).map((p,i)=>{
                                const voyageComplet = voyages.find(v=>v.id===p.id)
                                const destinationDiffere = voyageComplet && r.destination && voyageComplet.destination && voyageComplet.destination !== r.destination
                                return (
                                <div key={p.id||i} onClick={()=>{
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
                                    <div style={{fontSize:12,fontWeight:600,color:C.text,display:'flex',alignItems:'center',gap:6}}>
                                      {p.personnel__nom} {p.personnel__prenom}
                                      {destinationDiffere && (
                                        <span title={`Descend/monte à un autre point : ${voyageComplet.destination} (au lieu de ${r.destination})`}
                                          style={{fontSize:9,fontWeight:700,color:C.purple,background:`${C.purple}20`,
                                            padding:'1px 6px',borderRadius:20,whiteSpace:'nowrap'}}>
                                          🔀 Trajet différent
                                        </span>
                                      )}
                                    </div>
                                    <div style={{fontSize:10,color:C.muted}}>
                                      {p.personnel__societe||'—'}{destinationDiffere && ` · → ${voyageComplet.destination}`}
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
                              )})}
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
                  <div style={{fontSize:40,marginBottom:12}}>🧳</div>
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
                      🧳 Partir
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

            {/* Tableau complet — format manifeste papier (Ordre / Passager /
                Société / Téléphone / Lieu de montée / Lieu de descente) */}
            <Panel style={{marginTop:14,padding:'14px 16px'}}>
              <Label>Manifeste — Export</Label>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>
                💡 Cliquer sur une ligne du tableau pour modifier son point de montée / descente (aller et retour).
              </div>
              {(() => {
                const convoisDisponibles = [...new Set(voyages.filter(v=>v.rotation_id).map(v=>v.rotation_id))]
                let filtres = voyages.filter(v => {
                  if (manifFiltreConvoi !== 'tous' && v.rotation_id !== manifFiltreConvoi) return false
                  if (manifFiltreDestination && !(v.destination||'').toLowerCase().includes(manifFiltreDestination.toLowerCase())) return false
                  if (manifFiltreDateDebut && v.date_depart < manifFiltreDateDebut) return false
                  if (manifFiltreDateFin && v.date_depart > manifFiltreDateFin) return false
                  return true
                })
                // Groupe par convoi (rotation_id||'INDIVIDUEL') pour calculer
                // l'ordre EXACTEMENT comme sur le manifeste papier - 0,1,2...
                // au sein d'un meme convoi, pas un numero global sans sens.
                const groupes = {}
                filtres.forEach(v => { const k = v.rotation_id || `IND-${v.id}`; (groupes[k]=groupes[k]||[]).push(v) })
                const lignes = []
                Object.entries(groupes).sort(([a],[b])=>a.localeCompare(b)).forEach(([convoi,liste])=>{
                  liste.forEach((v,i)=>lignes.push({...v, _ordre:i, _convoi: v.rotation_id ? convoi : 'Individuel'}))
                })

                const exporterCSV = () => {
                  const csv = ['Convoi,Date,Ordre,Passager,Société,Téléphone,Lieu de montée,Lieu de descente,Statut,Chauffeur,Second chauffeur,Immatriculation',
                    ...lignes.map(l=>`"${l._convoi}",${l.date_depart},${l._ordre},"${l.personnel_nom||''}","${l.personnel_departement||l.personnel_societe||''}","${l.personnel_telephone||''}","${l.origine||'—'}","${l.destination||''}",${l.statut},"${l.conducteur||''}","${l.conducteur_secondaire||''}","${l.vehicule_matricule||''}"`)
                  ].join('\n')
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}))
                  a.download = `manifeste_${today}.csv`; a.click()
                }

                const imprimerManifeste = () => {
                  const ref = lignes[0] || {}
                  const lignesTable = lignes.map((l,i) => `
                    <tr>
                      <td class="ord">${l._ordre}</td>
                      <td class="pass">${l.personnel_nom||''}${l.a_un_vol ? ` <span style="color:#7c3aed;font-weight:800;font-size:10px">✈️ VOL ${l.a_un_vol.heure_depart?l.a_un_vol.heure_depart.slice(0,5):''} ${l.a_un_vol.numero_vol||''}</span>` : ''}</td>
                      <td>${l.personnel_departement||l.personnel_societe||''}</td>
                      <td>${l.personnel_telephone||''}</td>
                      <td>${l.origine||'—'}</td>
                      <td>${l.destination||''}</td>
                    </tr>`).join('')
                  const w = window.open('', '_blank')
                  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Manifeste ${manifFiltreConvoi!=='tous'?manifFiltreConvoi:''}</title>
                    <style>
                      body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}
                      table{width:100%;border-collapse:collapse;margin-top:10px}
                      td,th{border:1px solid #333;padding:5px 8px}
                      .hdr{width:100%;margin-bottom:10px}
                      .hdr td{border:1px solid #333;padding:6px 10px;font-size:11px}
                      .hdr .lbl{font-style:italic;color:#333;background:#f3f3f3;width:1%;white-space:nowrap}
                      .hdr .chk{text-align:center;font-size:15px;width:1%}
                      .trajet{background:#111;color:#fff;text-align:center;font-weight:800;font-size:15px;padding:10px;text-transform:uppercase}
                      thead td{background:#f0d020;font-weight:800;text-align:center;text-transform:uppercase;font-size:11px}
                      .ord{text-align:center;font-weight:800;color:#c00}
                      .pass{height:22px}
                      .print-btn{background:#1e3a8a;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;margin-bottom:16px}
                      @media print{.print-btn{display:none}}
                    </style></head><body>
                    <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Sauvegarder PDF</button>
                    <table class="hdr"><tr>
                      <td class="lbl">Date de début du voyage</td><td>${fmt(ref.date_depart)||''}</td>
                      <td class="lbl">Date de fin de voyage</td><td>${fmt(ref.date_retour_prevue)||''}</td>
                      <td class="lbl">Immatriculation du véhicule</td><td>${ref.vehicule_matricule||''}</td>
                    </tr></table>
                    <table class="hdr equip">
                      <tr><td class="lbl">Bouton de panique in véhicule ?</td><td class="chk">☐</td>
                          <td class="lbl">Eau</td><td class="chk">☐</td></tr>
                      <tr><td class="lbl">Emplacement du bouton connu ?</td><td class="chk">☐</td>
                          <td class="lbl">Carte</td><td class="chk">☐</td></tr>
                      <tr><td class="lbl">Téléphone satellite</td><td class="chk">☐</td>
                          <td class="lbl">Lire et comprendre JMP ?</td><td class="chk">☐</td></tr>
                      <tr><td class="lbl">Numéro de téléphone satellite :</td><td colspan="1" style="font-size:11px">&nbsp;</td>
                          <td class="lbl">Trousse de premiers soins ?</td><td class="chk">☐</td></tr>
                    </table>
                    <div class="trajet">${manifFiltreConvoi!=='tous'?`Convoi ${manifFiltreConvoi}`:'Manifeste'} — ${ref.origine||''} → ${ref.destination||''}</div>
                    <table style="margin-top:14px">
                      <thead><tr><td>Ordre</td><td>Passagers</td><td>Société / Département</td><td>N° MTN / Orange</td><td>Lieu de montée</td><td>Lieu de descente</td></tr></thead>
                      <tbody>
                        <tr><td class="ord">—</td><td class="pass">${ref.conducteur||''}</td><td colspan="4" style="font-weight:700;background:#fafafa">CHAUFFEUR</td></tr>
                        ${ref.conducteur_secondaire?`<tr><td class="ord">—</td><td class="pass">${ref.conducteur_secondaire}</td><td colspan="4" style="font-weight:700;background:#fafafa">SECOND DRIVER</td></tr>`:''}
                        ${lignesTable}
                      </tbody>
                    </table>
                  </body></html>`)
                  w.document.close()
                }

                return (<>
                {manifFiltreConvoi !== 'tous' && lignes.length > 0 && (() => {
                  const ref = lignes[0]
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,
                      background:`${C.accent}0d`,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 16px',marginBottom:12}}>
                      <div><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Date de début</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{fmt(ref.date_depart)}</div></div>
                      <div><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Date de fin</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{fmt(ref.date_retour_prevue)}</div></div>
                      <div><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Immatriculation</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{ref.vehicule_matricule||'—'}</div></div>
                      <div><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Chauffeur</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{ref.conducteur||'—'}</div></div>
                      <div><div style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>Second chauffeur</div>
                        <div style={{fontSize:13,fontWeight:700,color:C.text}}>{ref.conducteur_secondaire||'—'}</div></div>
                    </div>
                  )
                })()}
                <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
                  <select value={manifFiltreConvoi} onChange={e=>setManifFiltreConvoi(e.target.value)}
                    style={{background:C.bg,color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 10px',fontSize:12}}>
                    <option value="tous">Tous les convois</option>
                    {convoisDisponibles.map(id=><option key={id} value={id}>Convoi {id}</option>)}
                  </select>
                  <input value={manifFiltreDestination} onChange={e=>setManifFiltreDestination(e.target.value)}
                    placeholder="Filtrer par destination..."
                    style={{background:C.bg,color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 10px',fontSize:12,minWidth:160}}/>
                  <input type="date" value={manifFiltreDateDebut} onChange={e=>setManifFiltreDateDebut(e.target.value)}
                    style={{background:C.bg,color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 10px',fontSize:12}}/>
                  <span style={{color:C.muted,fontSize:11}}>à</span>
                  <input type="date" value={manifFiltreDateFin} onChange={e=>setManifFiltreDateFin(e.target.value)}
                    style={{background:C.bg,color:C.text,border:`1px solid ${C.border}`,borderRadius:8,padding:'7px 10px',fontSize:12}}/>
                  {(manifFiltreConvoi!=='tous'||manifFiltreDestination||manifFiltreDateDebut||manifFiltreDateFin) && (
                    <button className="mc-btn mc-btn-ghost" onClick={()=>{setManifFiltreConvoi('tous');setManifFiltreDestination('');setManifFiltreDateDebut('');setManifFiltreDateFin('')}}>
                      ✕ Réinitialiser
                    </button>
                  )}
                  <button className="mc-btn mc-btn-ghost" onClick={imprimerManifeste} style={{marginLeft:'auto'}}>
                    🖨️ Imprimer
                  </button>
                  <button className="mc-btn mc-btn-ghost" onClick={exporterCSV}>
                    ⬇ Export CSV ({lignes.length})
                  </button>
                </div>
                <div style={{overflowX:'auto',maxHeight:400}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead style={{position:'sticky',top:0}}>
                      <tr style={{background:`${C.accent}10`}}>
                        {['Convoi','Date','Ordre','Passager','CIE / Département','Téléphone','Lieu de montée','Lieu de descente','Statut'].map(h=>(
                          <th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:10,
                            fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:.5,
                            borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map(v=>(
                        <tr key={v.id} className="mc-row" onClick={()=>ouvrirDetail(v)} style={{borderBottom:`0.5px solid rgba(255,255,255,.03)`,cursor:'pointer'}}>
                          <td style={{padding:'7px 10px',fontFamily:'JetBrains Mono,monospace',fontSize:10,color:v.rotation_id?C.accent:C.muted}}>{v._convoi}</td>
                          <td style={{padding:'7px 10px',color:C.muted,whiteSpace:'nowrap'}}>{fmt(v.date_depart)}</td>
                          <td style={{padding:'7px 10px',color:C.muted,fontFamily:'JetBrains Mono,monospace'}}>{v._ordre}</td>
                          <td style={{padding:'7px 10px',fontWeight:600,color:C.text}}>
                            {v.personnel_nom||'—'}
                            {v.a_un_vol && (
                              <span title={`Vol ${v.a_un_vol.numero_vol||''} — ${v.a_un_vol.heure_depart||'heure non renseignée'}`}
                                style={{marginLeft:6,fontSize:10,fontWeight:700,color:'#7c3aed',background:'#7c3aed20',padding:'1px 6px',borderRadius:20,whiteSpace:'nowrap'}}>
                                ✈️ {v.a_un_vol.heure_depart?.slice(0,5)||'Vol'}
                              </span>
                            )}
                          </td>
                          <td style={{padding:'7px 10px',color:C.muted}}>{v.personnel_departement || v.personnel_societe || '—'}</td>
                          <td style={{padding:'7px 10px',color:C.muted,fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{v.personnel_telephone||'—'}</td>
                          <td style={{padding:'7px 10px',color:C.text}}>{v.origine||'—'} <span style={{opacity:.4,fontSize:10}} title="Cliquer la ligne pour modifier montée/descente">✏️</span></td>
                          <td style={{padding:'7px 10px',color:C.text}}>{v.destination||'—'}</td>
                          <td style={{padding:'7px 10px'}}><StatusBadge statut={v.statut}/></td>
                        </tr>
                      ))}
                      {lignes.length===0 && (
                        <tr><td colSpan={9} style={{padding:'20px 10px',textAlign:'center',color:C.muted}}>Aucun résultat pour ces filtres</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </>)
              })()}
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
                            {v.personnel_societe} · 🧳 {v.destination} · {fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}
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
                            <span style={{position:'absolute',right:0,top:-9,fontSize:12}}>🧳</span>
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
                  <span style={{position:'absolute',right:'50%',top:-9,fontSize:12}}>🧳</span>
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

              {/* Montée / Descente en cours de route — edition DIRECTE et
                  simple des points de prise en charge, sans passer par le
                  systeme d'etapes complet (reserve aux vrais trajets
                  multi-tronçons). S'applique a l'aller (origine/destination
                  du voyage) ET au retour (champs dedies). */}
              <div style={{marginBottom:16,background:C.bg,borderRadius:10,padding:12,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:4}}>📍 Montée / Descente en cours de route</div>
                <div style={{fontSize:11,color:C.muted,marginBottom:10}}>
                  Si ce passager ne fait pas exactement le même trajet que le reste du convoi — pris en route ou déposé avant l'arrivée, à l'aller ou au retour.
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <div>
                    <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:3}}>Lieu de montée (aller)</label>
                    <input defaultValue={detailVoyage.origine||''} id="mc-lieu-montee-aller"
                      style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:'6px 8px',fontSize:12,color:C.text,boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:3}}>Lieu de descente (aller)</label>
                    <input defaultValue={detailVoyage.destination||''} id="mc-lieu-descente-aller"
                      style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:'6px 8px',fontSize:12,color:C.text,boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:3}}>Lieu de montée (retour)</label>
                    <input defaultValue={detailVoyage.lieu_montee_retour||''} placeholder={detailVoyage.destination||'Même point que le convoi'} id="mc-lieu-montee-retour"
                      style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:'6px 8px',fontSize:12,color:C.text,boxSizing:'border-box'}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:C.muted,display:'block',marginBottom:3}}>Lieu de descente (retour)</label>
                    <input defaultValue={detailVoyage.lieu_descente_retour||''} placeholder={detailVoyage.origine||'Destination normale'} id="mc-lieu-descente-retour"
                      style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:'6px 8px',fontSize:12,color:C.text,boxSizing:'border-box'}}/>
                  </div>
                </div>
                <button className="mc-btn" style={{fontSize:11,padding:'6px 14px',background:C.accent,color:'#000',fontWeight:700}}
                  onClick={async()=>{
                    const payload = {
                      origine: document.getElementById('mc-lieu-montee-aller').value,
                      destination: document.getElementById('mc-lieu-descente-aller').value,
                      lieu_montee_retour: document.getElementById('mc-lieu-montee-retour').value,
                      lieu_descente_retour: document.getElementById('mc-lieu-descente-retour').value,
                    }
                    try {
                      const res = await api(`/api/voyages/${detailVoyage.id}/`, {method:'PATCH', body:JSON.stringify(payload)})
                      if (res.ok) { toast.success('Montée/descente enregistrées'); const updated = await res.json(); setDetailVoyage(updated); load() }
                      else { const d = await res.json(); toast.error(d.error||d.detail||'Erreur') }
                    } catch { toast.error('Erreur réseau') }
                  }}>
                  💾 Enregistrer
                </button>
              </div>

              {/* Grille d'infos complètes */}
              {(() => {
                const rotationParente = detailVoyage.rotation_id ? rotations.find(r => r.rotation_id === detailVoyage.rotation_id) : null
                const trajetDiffere = rotationParente && rotationParente.destination && detailVoyage.destination && detailVoyage.destination !== rotationParente.destination
                return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                {[
                  ['📍 Destination', detailVoyage.destination||'—'],
                  ...(trajetDiffere ? [['🔀 Trajet vs convoi', `Diffère du convoi (${rotationParente.destination})`]] : []),
                  ['📅 Date de départ (prévue)', fmt(detailVoyage.date_depart,{day:'numeric',month:'long',year:'numeric'})],
                  ['🧳 Départ effectif', detailVoyage.date_depart_effective?fmt(detailVoyage.date_depart_effective,{day:'numeric',month:'long',year:'numeric'}):'—'],
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
                )
              })()}

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
                    <button className="mc-btn" style={{fontSize:10,padding:'4px 8px',background:'#7c3aed20',color:'#7c3aed'}} onClick={()=>importerEtapesEnMasse('aller')}>📋 Coller un itinéraire</button>
                  </div>
                  )}
                </div>
                <CarteItineraire origine={detailVoyage.origine} destination={detailVoyage.destination} etapes={etapesDetail}
                  trajetDiffereDuConvoi={(() => {
                    const rotationParente = detailVoyage.rotation_id ? rotations.find(r => r.rotation_id === detailVoyage.rotation_id) : null
                    if (rotationParente && rotationParente.destination && detailVoyage.destination && detailVoyage.destination !== rotationParente.destination) {
                      return `le convoi va jusqu'à ${rotationParente.destination}`
                    }
                    return null
                  })()}/>
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
                    <input type="time" value={nouvelleEtape.heure_depart} onChange={e=>setNouvelleEtape(p=>({...p,heure_depart:e.target.value}))} placeholder="Heure départ" style={inputStyle}/>
                    <input type="time" value={nouvelleEtape.heure_arrivee_prevue} onChange={e=>setNouvelleEtape(p=>({...p,heure_arrivee_prevue:e.target.value}))} placeholder="Heure arrivée" style={inputStyle}/>
                    <input value={nouvelleEtape.point_rdv} onChange={e=>setNouvelleEtape(p=>({...p,point_rdv:e.target.value}))} placeholder="Point de RDV" style={inputStyle}/>
                    <input value={nouvelleEtape.reference} onChange={e=>setNouvelleEtape(p=>({...p,reference:e.target.value}))} placeholder="Référence" style={inputStyle}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:6,marginBottom:8}}>
                    <input type="number" step="0.1" value={nouvelleEtape.distance_km} onChange={e=>setNouvelleEtape(p=>({...p,distance_km:e.target.value}))} placeholder="Distance (km) — JMP" style={inputStyle}/>
                    <input value={nouvelleEtape.pause_fatigue} onChange={e=>setNouvelleEtape(p=>({...p,pause_fatigue:e.target.value}))} placeholder="Gestion fatigue (ex: 15 MIN DE PAUSE) — JMP" style={{...inputStyle,gridColumn:'span 2'}}/>
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
                    {showCreate==='rotation' ? '✦ Nouvelle rotation groupe' : '🧳 Voyage individuel'}
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
                    {/* Adresse de départ — pas toujours le camp (ex: convoi de retour d'un site externe) */}
                    <div>
                      <label style={labelStyle}>Adresse de départ</label>
                      <LieuInput value={formRot.origine}
                        onChange={v=>setFormRot(p=>({...p,origine:v}))}
                        onValidChange={v=>setFormRot(p=>({...p,_origineValide:v}))}
                        placeholder="Camp Roxgold Sango" style={inputStyle}/>
                    </div>
                    {/* Destination */}
                    <div>
                      <label style={labelStyle}>Adresse d'arrivée *</label>
                      <LieuInput value={formRot.destination}
                        onChange={v=>setFormRot(p=>({...p,destination:v}))}
                        onValidChange={v=>setFormRot(p=>({...p,_destinationValide:v}))}
                        placeholder="Abidjan" style={inputStyle}/>
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
                      <div>
                        <label style={labelStyle}>Second chauffeur <span style={{fontWeight:400,color:C.muted}}>(relève, optionnel)</span></label>
                        <select value={formRot.conducteur_secondaire||''}
                          onChange={e=>setFormRot(p=>({...p,conducteur_secondaire:e.target.value}))}
                          style={inputStyle}>
                          <option value="">— Aucun —</option>
                          {personnel.map(p=><option key={p.id} value={`${p.nom} ${p.prenom}`}>{p.nom} {p.prenom} — {p.societe||'—'}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label style={labelStyle}>🛡️ Niveau d'alerte sécurité (pour le JMP)</label>
                      <select value={formRot.niveau_alerte} onChange={e=>setFormRot(p=>({...p,niveau_alerte:Number(e.target.value)}))} style={inputStyle}>
                        <option value={1}>1 — Aucune restriction de voyage</option>
                        <option value={2}>2 — Prudence, coordination CCTV</option>
                        <option value={3}>3 — Minimum de 2 convois de véhicules</option>
                        <option value={4}>4 — Escorte gendarme/policière requise</option>
                        <option value={5}>5 — Aucun voyage n'est autorisé</option>
                      </select>
                    </div>
                    <div style={{marginBottom:14,display:'flex',alignItems:'center',gap:10,background:C.bg,padding:'10px 12px',borderRadius:8}}>
                      <input type="checkbox" id="trajet-aller-seul" checked={formRot.trajet_aller_seul}
                        onChange={e=>setFormRot(p=>({...p,trajet_aller_seul:e.target.checked}))}
                        style={{width:16,height:16}}/>
                      <label htmlFor="trajet-aller-seul" style={{fontSize:12,cursor:'pointer'}}>
                        🧭 Trajet aller uniquement (convoi multi-villes) — <span style={{color:C.muted}}>pas de retour couplé au camp. Un éventuel retour se crée comme une nouvelle rotation séparée.</span>
                      </label>
                    </div>
                    <div style={{marginBottom:14}}>
                      <label style={labelStyle}>🗺️ Villes intermédiaires <span style={{fontWeight:400,color:C.muted}}>(optionnel — trajet {formRot.origine||'origine'} → {formRot.villesIntermediaires.length ? formRot.villesIntermediaires.map(v=>v.nom).join(' → ')+' → ' : ''}{formRot.destination||'destination'}, pour le tableau "Côte de sécurité de route" du JMP)</span></label>
                      {formRot.villesIntermediaires.map((v,i) => (
                        <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:6,marginBottom:6}}>
                          <input value={v.nom} onChange={e=>setFormRot(p=>({...p,villesIntermediaires:p.villesIntermediaires.map((vv,ii)=>ii===i?{...vv,nom:e.target.value}:vv)}))}
                            placeholder={`Ville ${i+1}`} style={{...inputStyle,fontSize:12}}/>
                          <input type="number" step="0.1" value={v.distance_km} onChange={e=>setFormRot(p=>({...p,villesIntermediaires:p.villesIntermediaires.map((vv,ii)=>ii===i?{...vv,distance_km:e.target.value}:vv)}))}
                            placeholder="Km" style={{...inputStyle,fontSize:12}}/>
                          <input type="time" value={v.heure_arrivee} onChange={e=>setFormRot(p=>({...p,villesIntermediaires:p.villesIntermediaires.map((vv,ii)=>ii===i?{...vv,heure_arrivee:e.target.value}:vv)}))}
                            style={{...inputStyle,fontSize:12}}/>
                          <input value={v.pause} onChange={e=>setFormRot(p=>({...p,villesIntermediaires:p.villesIntermediaires.map((vv,ii)=>ii===i?{...vv,pause:e.target.value}:vv)}))}
                            placeholder="Pause" style={{...inputStyle,fontSize:12}}/>
                          <button type="button" onClick={()=>setFormRot(p=>({...p,villesIntermediaires:p.villesIntermediaires.filter((_,ii)=>ii!==i)}))}
                            style={{background:'none',border:'none',color:C.red,cursor:'pointer',fontSize:16}}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="mc-btn" style={{fontSize:11,padding:'5px 10px',background:C.bg}}
                        onClick={()=>setFormRot(p=>({...p,villesIntermediaires:[...p.villesIntermediaires,{nom:'',distance_km:'',heure_depart:'',heure_arrivee:'',pause:''}]}))}>
                        + Ajouter une ville
                      </button>
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
                      <label style={labelStyle}>{formRot.trajet_aller_seul ? 'Date de fin du trajet *' : 'Date de retour *'}</label>
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
                      <select value={formRot.motif}
                        onChange={e=>setFormRot(p=>({...p,motif:e.target.value}))}
                        style={inputStyle}>
                        <option value="">— Choisir un motif —</option>
                        {['repos','medical','formation','conge','familial','administratif','autre'].map(m=>(
                          <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sélection passagers */}
                  <div>
                    <button type="button" className="mc-btn" style={{width:'100%',fontSize:12,padding:'9px 12px',
                        background:C.accent,color:'#000',fontWeight:800,marginBottom:8,border:'none',borderRadius:8}}
                        onClick={()=>{
                          const saisie = prompt("Coller une liste de numéros de téléphone (un par ligne, ou séparés par des virgules) :")
                          if (!saisie) return
                          const normTel = (v) => (v||'').replace(/\D/g,'').replace(/^225/,'').slice(-9)
                          const numeros = saisie.split(/[\n,;]+/).map(s=>normTel(s)).filter(Boolean)
                          const dejaPresents = new Set(formRot.passagers)
                          const trouves = []
                          const introuvables = []
                          const complets = []
                          for (const tel of numeros) {
                            const p = personnel.find(pp => normTel(pp.telephone)===tel || normTel(pp.numero_whatsapp)===tel)
                            if (!p) { introuvables.push(tel); continue }
                            if (dejaPresents.has(p.id)) continue
                            if (dejaPresents.size + trouves.length >= formRot.nb_places_total) { complets.push(tel); continue }
                            trouves.push(p.id)
                          }
                          if (trouves.length) setFormRot(prev=>({...prev, passagers:[...prev.passagers, ...trouves]}))
                          let msg = `${trouves.length} passager(s) ajouté(s).`
                          if (introuvables.length) msg += ` ${introuvables.length} numéro(s) introuvable(s) : ${introuvables.join(', ')}.`
                          if (complets.length) msg += ` ${complets.length} non ajouté(s) — rotation déjà complète.`
                          toast[introuvables.length||complets.length ? 'error' : 'success'](msg)
                        }}>
                      📋 Importer une liste de numéros
                    </button>
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
                    disabled={saving||!formRot.date_depart||!formRot.date_retour_prevue||formRot._origineValide===false||formRot._destinationValide===false}
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
                      <LieuInput value={formIndiv.origine}
                        onChange={v=>setFormIndiv(p=>({...p,origine:v}))}
                        onValidChange={v=>setFormIndiv(p=>({...p,_origineValide:v}))}
                        placeholder="Camp Roxgold Sango" style={inputStyle}/>
                    </div>
                    <div>
                      <label style={labelStyle}>Destination *</label>
                      <LieuInput value={formIndiv.destination}
                        onChange={v=>setFormIndiv(p=>({...p,destination:v}))}
                        onValidChange={v=>setFormIndiv(p=>({...p,_destinationValide:v}))}
                        placeholder="Abidjan" style={inputStyle}/>
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
                      <label style={labelStyle}>Motif / Objet</label>
                      <select value={formIndiv.motif||''}
                        onChange={e=>setFormIndiv(p=>({...p,motif:e.target.value}))} style={inputStyle}>
                        <option value="">— Choisir un motif —</option>
                        {['repos','medical','formation','conge','familial','administratif','autre'].map(m=>(
                          <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Véhicule du parc <span style={{fontWeight:400,color:C.muted}}>(matricule/photo auto-remplis)</span></label>
                      <select value={formIndiv.vehicule_flotte_id||''}
                        onChange={e=>{
                          const id = e.target.value
                          const v = flotte.find(f=>String(f.id)===id)
                          if (v) setFormIndiv(p=>({...p, vehicule_flotte_id:id, vehicule:v.nom,
                            vehicule_matricule:v.matricule, vehicule_photo:v.photo, nb_places_total:v.capacite}))
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
                    disabled={saving||!formIndiv.personnel_id||!formIndiv.date_depart||!formIndiv.date_retour_prevue||formIndiv._origineValide===false||formIndiv._destinationValide===false}
                    onClick={creerIndividuel}>
                    {saving ? '⏳ Création...' : '🧳 Créer le voyage individuel'}
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
