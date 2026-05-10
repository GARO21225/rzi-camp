import React, { useEffect, useState } from 'react'
import { batiments, incidents, voyages } from '../api'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend
} from 'recharts'

function KPI({ value, label, color, icon, sub, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:'#fff', border:'1px solid #e2e8f0', borderRadius:12,
      padding:'14px 16px', borderLeft:`4px solid ${color}`,
      boxShadow:'0 1px 4px rgba(0,0,0,.06)', cursor:onClick?'pointer':'default',
      display:'flex', alignItems:'center', gap:14, transition:'.2s'
    }}
    onMouseEnter={e=>onClick&&(e.currentTarget.style.boxShadow='0 4px 16px rgba(30,58,138,.12)')}
    onMouseLeave={e=>onClick&&(e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)')}>
      <div style={{ fontSize:28 }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:'monospace', fontSize:24, fontWeight:700, color, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:11, color:'#64748b', marginTop:3, textTransform:'uppercase', letterSpacing:.5 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color, marginTop:2, fontWeight:600 }}>{sub}</div>}
      </div>
    </div>
  )
}

const TOOLTIP_STYLE = {
  background:'#1e3a8a', border:'none', borderRadius:10, color:'#fff',
  fontSize:12, padding:'8px 14px', boxShadow:'0 4px 16px rgba(30,58,138,.3)'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontWeight:700, marginBottom:4 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color||'#f0a500' }}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [batStats, setBatStats] = useState(null)
  const [incStats, setIncStats] = useState(null)
  const [voyStats, setVoyStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([batiments.stats(), incidents.stats(), voyages.stats()])
      .then(([b,i,v]) => { setBatStats(b.data); setIncStats(i.data); setVoyStats(v.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding:60, textAlign:'center', color:'#94a3b8' }}>
      <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
      <div style={{ fontSize:14 }}>Chargement des données...</div>
    </div>
  )

  const s = batStats?.par_statut || {}

  // Donut data
  const occupPie = [
    { name:'Libres',      value:s['Libre']||0,       color:'#16a34a' },
    { name:'Occupés',     value:s['Occupé']||0,      color:'#dc2626' },
    { name:'Réservés',    value:s['Réservé']||0,     color:'#2563eb' },
    { name:'Maintenance', value:s['Maintenance']||0, color:'#ea580c' },
  ].filter(d=>d.value>0)

  // Trend data (6 mois simulés)
  const months = ['Jan','Fév','Mar','Avr','Mai','Jun']
  const trend = months.map((m,i) => ({
    mois:m,
    Occupés: Math.max(0, (s['Occupé']||60) + Math.round(Math.sin(i+1)*12)),
    Libres:  Math.max(0, (s['Libre']||100) - Math.round(Math.sin(i+1)*8)),
  }))

  // Incident bar data
  const incData = [
    { name:'Ouverts',   valeur:incStats?.ouverts||0,   color:'#dc2626' },
    { name:'En cours',  valeur:incStats?.en_cours||0,  color:'#ea580c' },
    { name:'Résolus',   valeur:incStats?.resolus||0,   color:'#16a34a' },
  ]

  // Voyage bar data
  const voyData = [
    { name:'Planifiés', valeur:voyStats?.planifies||0,  color:'#2563eb' },
    { name:'En voyage', valeur:voyStats?.en_voyage||0,  color:'#ea580c' },
    { name:'Retours',   valeur:voyStats?.retours||0,    color:'#16a34a' },
  ]

  const taux = batStats?.taux_occupation || 0

  return (
    <div style={{ padding:16 }}>
      {/* Titre */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:19, fontWeight:700, color:'#1e3a8a', margin:0 }}>📊 Analytics</h2>
        <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>
          Vue d'ensemble · Occupation · Incidents · Voyages
        </p>
      </div>

      {/* KPIs — 2 lignes */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginBottom:20 }}>
        <KPI value={batStats?.total||'—'} label="Total bâtiments" color="#1e3a8a" icon="🏗️"/>
        <KPI value={`${taux}%`} label="Taux d'occupation" color={taux>80?'#dc2626':taux>60?'#ea580c':'#16a34a'} icon="📊"
          sub={taux>80?'⚠️ Capacité élevée':taux>60?'Charge modérée':'✅ Bonne disponibilité'}/>
        <KPI value={s['Libre']||0} label="Résidences libres" color="#16a34a" icon="🟢"/>
        <KPI value={s['Occupé']||0} label="Résidences occupées" color="#dc2626" icon="🔴"/>
        <KPI value={incStats?.ouverts||0} label="Incidents ouverts" color="#dc2626" icon="🚨"/>
        <KPI value={incStats?.resolus||0} label="Incidents résolus" color="#16a34a" icon="✅"/>
        <KPI value={voyStats?.en_voyage||0} label="Agents en voyage" color="#ea580c" icon="✈️"/>
        <KPI value={batStats?.departs_s1||0} label="Départs cette semaine" color="#7c3aed" icon="📅"/>
      </div>

      {/* Grille graphiques */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* ── Occupation Donut ── */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:14, marginBottom:4 }}>🏠 Répartition résidences</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:14 }}>Par statut d'occupation</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={occupPie} cx="50%" cy="50%"
                innerRadius={55} outerRadius={90}
                dataKey="value" paddingAngle={3}>
                {occupPie.map((e,i) => <Cell key={i} fill={e.color} stroke="none"/>)}
              </Pie>
              <Tooltip content={<CustomTooltip/>}/>
              <Legend iconType="circle" iconSize={10} wrapperStyle={{fontSize:12}}/>
            </PieChart>
          </ResponsiveContainer>
          {/* Légende inline avec chiffres */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
            {occupPie.map(p => (
              <div key={p.name} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:10, height:10, borderRadius:3, background:p.color, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:'#64748b' }}>{p.name}</span>
                <span style={{ fontFamily:'monospace', fontWeight:700, color:p.color, marginLeft:'auto' }}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tendance 6 mois ── */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:14, marginBottom:4 }}>📈 Tendance 6 mois</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:14 }}>Évolution occupation vs disponibilité</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend} margin={{top:5,right:10,left:-20,bottom:0}}>
              <defs>
                <linearGradient id="gOcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="gLib" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="mois" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="Occupés" stroke="#dc2626" strokeWidth={2} fill="url(#gOcc)"/>
              <Area type="monotone" dataKey="Libres" stroke="#16a34a" strokeWidth={2} fill="url(#gLib)"/>
              <Legend iconType="circle" iconSize={10} wrapperStyle={{fontSize:12}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Incidents ── */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:14, marginBottom:4 }}>🛠️ Incidents maintenance</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:14 }}>Statut des signalements</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={incData} margin={{top:5,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:12,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="valeur" name="Incidents" radius={[6,6,0,0]}>
                {incData.map((d,i) => <Cell key={i} fill={d.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:10, marginTop:10, justifyContent:'center' }}>
            {incData.map(d=>(
              <div key={d.name} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:d.color }}>{d.valeur}</div>
                <div style={{ fontSize:10, color:'#94a3b8' }}>{d.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Voyages ── */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:14, marginBottom:4 }}>✈️ Voyages</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginBottom:14 }}>État des déplacements</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={voyData} margin={{top:5,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="name" tick={{fontSize:12,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="valeur" name="Voyages" radius={[6,6,0,0]}>
                {voyData.map((d,i) => <Cell key={i} fill={d.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display:'flex', gap:10, marginTop:10, justifyContent:'center' }}>
            {voyData.map(d=>(
              <div key={d.name} style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:d.color }}>{d.valeur}</div>
                <div style={{ fontSize:10, color:'#94a3b8' }}>{d.name}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
