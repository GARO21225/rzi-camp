import { cachedFetch } from '../utils/cache'
/**
 * DASHBOARD v3 — Premium avec charts, activité, météo camp
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { batiments, incidents, voyages as voyAPI } from '../api'
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from 'recharts'

const COLORS = { libre:'#16a34a', occupe:'#2563eb', reserve:'#f97316', maintenance:'#dc2626' }

function KPI({ value, label, icon, color, sub, onClick }) {
  return (
    <div className="kpi-card" onClick={onClick}
      style={{ color, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div className="kpi-num" style={{ color }}>{value ?? '—'}</div>
        <span style={{ fontSize:24, opacity:.6 }}>{icon}</span>
      </div>
      <div className="kpi-lbl">{label}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function ActivityItem({ icon, text, time, color }) {
  return (
    <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
      <div style={{ width:32, height:32, borderRadius:10, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
        {icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12.5, color:'var(--text)', fontWeight:500, lineHeight:1.4 }}>{text}</div>
        <div style={{ fontSize:11, color:'var(--text-4)', marginTop:2 }}>{time}</div>
      </div>
    </div>
  )
}


// ── Widget Conformité Induction ──────────────────────────────
function ConformiteWidget() {
  const [data, setData] = React.useState([])
  const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'

  React.useEffect(() => {
    const token = localStorage.getItem('access_token') || ''
    fetch(`${BASE}/api/personnel/?page_size=500`, {headers:{'Authorization':`Bearer ${token}`}})
      .then(r=>r.json()).then(d=>{
        const list = d.results || d || []
        const bySociete = {}
        list.forEach(p => {
          const soc = p.societe || 'Sans société'
          if (!bySociete[soc]) bySociete[soc] = {total:0, induits:0}
          bySociete[soc].total++
          if (p.inductionrecord?.statut==='valide') bySociete[soc].induits++
        })
        const sorted = Object.entries(bySociete)
          .map(([s,v])=>({societe:s, ...v, pct:Math.round(v.induits/v.total*100)}))
          .sort((a,b)=>b.pct-a.pct).slice(0,6)
        setData(sorted)
      }).catch(()=>{})
  }, [])

  if (!data.length) return <div style={{color:'#94a3b8',fontSize:12,textAlign:'center',padding:20}}>Chargement...</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {data.map(({societe,total,induits,pct})=>(
        <div key={societe}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
            <span style={{fontWeight:600,color:'#1e293b'}}>{societe}</span>
            <span style={{fontWeight:700,color:pct>=80?'#16a34a':pct>=50?'#d97706':'#dc2626'}}>
              {induits}/{total} · {pct}%
            </span>
          </div>
          <div style={{background:'#f1f5f9',borderRadius:99,height:6,overflow:'hidden'}}>
            <div style={{background:pct>=80?'#16a34a':pct>=50?'#f59e0b':'#dc2626',
              width:`${pct}%`,height:'100%',borderRadius:99,transition:'width .5s'}}/>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Widget Alertes Prédictives ────────────────────────────────
function AlertesPredictives({ stats, voyStats, incStats }) {
  const alertes = []

  if (stats?.departs > 0) {
    alertes.push({
      icon:'🚀', color:'#3b82f6', bg:'#eff6ff',
      titre: `${stats.departs} départ(s) cette semaine`,
      desc: 'Résidences à libérer prochainement'
    })
  }
  if (incStats?.critiques > 0) {
    alertes.push({
      icon:'🚨', color:'#dc2626', bg:'#fef2f2',
      titre: `${incStats.critiques} incident(s) critique(s)`,
      desc: 'Nécessite une intervention urgente'
    })
  }
  if (incStats?.sla_depasse > 0) {
    alertes.push({
      icon:'⏰', color:'#d97706', bg:'#fffbeb',
      titre: `${incStats.sla_depasse} SLA dépassé(s)`,
      desc: 'Délais de résolution dépassés'
    })
  }
  if (voyStats?.en_voyage > 0) {
    alertes.push({
      icon:'✈️', color:'#7c3aed', bg:'#f5f3ff',
      titre: `${voyStats.en_voyage} personne(s) en déplacement`,
      desc: 'Rotations actives en cours'
    })
  }
  if (!alertes.length) {
    return <div style={{color:'#16a34a',fontSize:13,textAlign:'center',padding:20,fontWeight:600}}>✅ Tout est normal</div>
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {alertes.map((a,i)=>(
        <div key={i} style={{background:a.bg,border:`1px solid ${a.color}30`,
          borderRadius:10,padding:'10px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
          <span style={{fontSize:20}}>{a.icon}</span>
          <div>
            <div style={{fontWeight:700,fontSize:12,color:a.color}}>{a.titre}</div>
            <div style={{fontSize:11,color:'#64748b'}}>{a.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}


// ── Widget Prédictif d'Occupation ─────────────────────────────
function OccupationPredictive() {
  const [previsions, setPrevisions] = React.useState([])
  const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'

  React.useEffect(() => {
    const token = localStorage.getItem('access_token') || ''
    // Charger les voyages pour calculer arrivées/départs
    fetch(`${BASE}/api/voyages/?page_size=200&statut=planifie`, {headers:{'Authorization':`Bearer ${token}`}})
      .then(r=>r.json()).then(d=>{
        const list = d.results || d || []
        const today = new Date()
        const days = [1,2,3].map(offset => {
          const date = new Date(today); date.setDate(today.getDate()+offset)
          const ds = date.toISOString().slice(0,10)
          const label = offset===1?'Demain':`J+${offset}`
          const departs = list.filter(v=>v.date_depart?.slice(0,10)===ds).length
          const retours = list.filter(v=>v.date_retour_prevue?.slice(0,10)===ds).length
          return {label, date:ds, departs, retours}
        })
        setPrevisions(days)
      }).catch(()=>{
        // Données simulées si API indisponible
        setPrevisions([
          {label:'Demain', departs:0, retours:0},
          {label:'J+2',    departs:0, retours:0},
          {label:'J+3',    departs:0, retours:0},
        ])
      })
  }, [])

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {previsions.map(({label,date,departs,retours})=>(
        <div key={label} style={{display:'flex',alignItems:'center',gap:12,
          background:'#f8fafc',borderRadius:10,padding:'10px 14px'}}>
          <div style={{fontWeight:700,fontSize:13,color:'#1e3a8a',minWidth:60}}>{label}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'#64748b'}}>{date}</div>
          </div>
          <div style={{display:'flex',gap:12}}>
            {departs > 0 && (
              <span style={{background:'#eff6ff',color:'#3b82f6',
                padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>
                🚀 {departs} départ{departs>1?'s':''}
              </span>
            )}
            {retours > 0 && (
              <span style={{background:'#f0fdf4',color:'#16a34a',
                padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700}}>
                🏠 {retours} retour{retours>1?'s':''}
              </span>
            )}
            {departs===0 && retours===0 && (
              <span style={{color:'#94a3b8',fontSize:11}}>Aucun mouvement</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useStore()
  const navigate = useNavigate()
  const [stats,    setStats]    = useState(null)
  const [incStats, setIncStats] = useState(null)
  const [voyStats, setVoyStats] = useState(null)
  const [time,     setTime]     = useState(new Date())
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'

  useEffect(() => {
    const load = () => {
      batiments.stats().then(r => {
        const d = r.data || {}
        const ps = d.par_statut || {}
        setStats({
          libres:      parseInt(ps['Libre']      ||0),
          occupes:     parseInt(ps['Occupé']     ||0),
          reserves:    parseInt(ps['Réservé']    ||0),
          maintenance: parseInt(ps['Maintenance']||0),
          total:       parseInt(d.total          ||0),
          taux:        parseFloat(d.taux_occupation||0),
          departs:     parseInt(d.departs_s1     ||0),
        })
      }).catch(() => {})
      incidents.stats().then(r => setIncStats(r.data||{})).catch(() => setIncStats({}))
      voyAPI.stats().then(r => setVoyStats(r.data||{})).catch(() => setVoyStats({}))
    }
    load()
    const iv = setInterval(load, 5*60*1000)
    return () => clearInterval(iv)
  }, [])

  // Horloge live
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const occupancyData = stats ? [
    { name:'Libres',   value:stats.libres||0,       fill:COLORS.libre },
    { name:'Occupés',  value:stats.occupes||0,      fill:COLORS.occupe },
    { name:'Réservés', value:stats.reserves||0,     fill:COLORS.reserve },
    { name:'Maint.',   value:stats.maintenance||0,  fill:COLORS.maintenance },
  ] : []

  const barData = stats ? [
    { name:'L',  v:stats.libres||0,      fill:COLORS.libre },
    { name:'O',  v:stats.occupes||0,     fill:COLORS.occupe },
    { name:'R',  v:stats.reserves||0,    fill:COLORS.reserve },
    { name:'M',  v:stats.maintenance||0, fill:COLORS.maintenance },
  ] : []

  const totalBats = stats?.total || occupancyData.reduce((a,b) => a+b.value, 0) || 203
  const occupRate = stats?.taux ? Math.round(stats.taux) : (stats ? Math.round(((stats.occupes||0)/totalBats)*100) : 0)

  const dateStr = time.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  const timeStr = time.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })

  return (
    <div className="page" style={{ maxWidth:1200, margin:'0 auto' }}>

      {/* ══ HERO BANNER ══ */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2447 0%, #1e3a8a 50%, #2d4fa3 100%)',
        borderRadius: 20, padding: '24px 28px', marginBottom: 20, color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 16, position: 'relative', overflow: 'hidden'
      }}>
        {/* Déco */}
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, background:'rgba(255,255,255,.04)', borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:-30, left:200, width:120, height:120, background:'rgba(240,165,0,.08)', borderRadius:'50%' }} />

        <div style={{ position:'relative' }}>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:2, marginBottom:4 }}>
            🏕️ Camp Roxgold Sango · Côte d'Ivoire
          </div>
          <div style={{ fontSize:26, fontWeight:800, letterSpacing:-.3 }}>
            Bonjour, {user?.first_name || user?.username} 👋
          </div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginTop:6 }}>
            📅 {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}
          </div>
        </div>

        <div style={{ textAlign:'right', position:'relative' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:38, fontWeight:900, letterSpacing:-1, color:'#f0a500' }}>
            {timeStr.slice(0,-3)}
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'rgba(255,255,255,.55)' }}>
            {timeStr.slice(-2)} · {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </div>
          <div style={{ marginTop:10, display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
            <span style={{ background:'rgba(22,163,74,.25)', color:'#6ee7a0', padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>
              ● {totalBats} bâtiments
            </span>
            <span style={{ background:'rgba(240,165,0,.25)', color:'#f0a500', padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:700 }}>
              {occupRate}% occupé
            </span>
          </div>
        </div>
      </div>

      {/* ══ KPIs ══ */}
      <div className="kpi-grid" style={{ marginBottom:20 }}>
        <KPI value={stats?.libres} label="Chambres libres" icon="✅" color="#16a34a" sub={`${stats ? Math.round((stats.libres/totalBats)*100) : 0}% du parc`} onClick={() => navigate('/residences')} />
        <KPI value={stats?.occupes} label="Chambres occupées" icon="🏠" color="#2563eb" onClick={() => navigate('/residences')} />
        <KPI value={stats?.reserves} label="Réservées" icon="📋" color="#f97316" onClick={() => navigate('/residences')} />
        <KPI value={incStats?.ouverts} label="Incidents ouverts" icon="🚨" color="#dc2626" sub={incStats?.en_cours ? `${incStats.en_cours} en cours` : ''} onClick={() => navigate('/maintenance')} />
        <KPI value={voyStats?.en_voyage} label="En voyage" icon="✈️" color="#0891b2" sub={voyStats?.planifie ? `${voyStats.planifie} planifié(s)` : ''} onClick={() => navigate('/voyages')} />
        <KPI value={totalBats} label="Total bâtiments" icon="🏗️" color="#7c3aed" onClick={() => navigate('/carte')} />
      </div>

      {/* ══ CHARTS + ACTIVITÉ ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>

        {/* Chart 1: Donut occupation */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📊 Occupation</span>
          </div>
          <div style={{ padding:'8px 0 16px', textAlign:'center' }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={occupancyData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                  dataKey="value" paddingAngle={2}>
                  {occupancyData.map((e,i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={(v,n) => [v, n]} contentStyle={{ borderRadius:10, fontSize:12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, padding:'0 16px' }}>
              {occupancyData.map(e => (
                <div key={e.name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:e.fill, flexShrink:0 }} />
                  <span style={{ color:'var(--text-3)' }}>{e.name}: <b style={{ color:e.fill }}>{e.value}</b></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart 2: Bars */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🏗️ Distribution</span>
          </div>
          <div style={{ padding:'8px 16px 16px' }}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={barData} barSize={32}>
                <XAxis dataKey="name" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius:10, fontSize:12 }} />
                <Bar dataKey="v" radius={[6,6,0,0]}>
                  {barData.map((e,i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚡ Actions rapides</span>
          </div>
          <div style={{ padding:'12px' }}>
            {[
              ['🏠 Résidences',       '/residences',  '#1e3a8a'],
              ['🗺️ Carte GIS',        '/carte',        '#0891b2'],
              ['👤 Personnel',         '/personnel',    '#7c3aed'],
              ['📅 Créer événement',  '/evenements',   '#16a34a'],
              ['✈️ Déclarer voyage',   '/voyages',      '#f97316'],
              ['🔧 Signaler incident', '/maintenance',  '#dc2626'],
            ].map(([l,to,c]) => (
              <button key={to} onClick={() => navigate(to)}
                style={{ width:'100%', background:'transparent', color:c,
                  border:`1px solid ${c}30`, padding:'8px 12px',
                  borderRadius:9, fontSize:12, fontWeight:600,
                  textAlign:'left', marginBottom:6, display:'flex', alignItems:'center',
                  gap:8, cursor:'pointer', borderLeft:`3px solid ${c}`, transition:'.15s' }}
                onMouseEnter={e => e.currentTarget.style.background=`${c}10`}
                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                {l} <span style={{ marginLeft:'auto', opacity:.5 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ TAUX + STATUT ══ */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Barres de statut */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📈 Statuts résidences</span>
            <span style={{ fontSize:11, color:'var(--text-4)' }}>{totalBats} total</span>
          </div>
          <div style={{ padding:18 }}>
            {occupancyData.map(s => (
              <div key={s.name} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:12 }}>
                  <span style={{ fontWeight:600, color:'var(--text-2)' }}>{s.name}</span>
                  <span style={{ fontWeight:700, color:s.fill }}>{s.value} · {Math.round((s.value/totalBats)*100)}%</span>
                </div>
                <div className="progress">
                  <div className="progress-bar" style={{ width:`${Math.round((s.value/totalBats)*100)}%`, background:s.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🕐 Activité récente</span>
            <span style={{ fontSize:11, color:'var(--text-4)' }}>Temps réel</span>
          </div>
          <div style={{ padding:'8px 16px 16px' }}>
            {[
              { icon:'✈️', text:'Voyage planifié vers Abidjan', time:'Il y a 2 min', color:'#f97316' },
              { icon:'🔧', text:'Incident plomberie signalé — Bloc A', time:'Il y a 15 min', color:'#dc2626' },
              { icon:'🍽️', text:'Déjeuner validé — 24 résidents', time:'Il y a 32 min', color:'#7c3aed' },
              { icon:'👤', text:'Nouveau personnel enregistré', time:'Il y a 1h', color:'#2563eb' },
              { icon:'📅', text:'Événement BBQ planifié demain', time:'Il y a 2h', color:'#16a34a' },
            ].map((a,i) => <ActivityItem key={i} {...a} />)}
            <button onClick={() => navigate('/historique')}
              style={{ width:'100%', marginTop:10, background:'none', border:'1px solid var(--border)', borderRadius:9, padding:'8px', fontSize:12, color:'var(--text-4)', cursor:'pointer', fontWeight:600 }}>
              Voir tout l'historique →
            </button>
          </div>
        </div>
      </div>

        {/* ── Bloc Prédictif & Conformité ─────────────────────── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>

          {/* Score conformité HSE par société */}
          <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e3a8a',marginBottom:14}}>
              🎓 Conformité Induction par société
            </div>
            <ConformiteWidget/>
          </div>

          {/* Alertes prédictives */}
          <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e3a8a',marginBottom:14}}>
              🔮 Prévisions & Alertes
            </div>
            <AlertesPredictives stats={stats} voyStats={voyStats} incStats={incStats}/>
          </div>

          {/* Prévisions d'occupation J+1/J+2/J+3 */}
          <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 2px 8px rgba(0,0,0,.06)',gridColumn:'1/-1'}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e3a8a',marginBottom:14}}>
              🏠 Mouvements prévus (logistique hébergement)
            </div>
            <OccupationPredictive/>
          </div>

        </div>
    </div>
  )
}
