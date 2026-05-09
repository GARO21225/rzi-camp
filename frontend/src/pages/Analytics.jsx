import React, { useEffect, useState } from 'react'
import { batiments, incidents, voyages, qr } from '../api'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = ['#1e3a8a','#dc2626','#2563eb','#ea580c','#16a34a','#7c3aed','#f0a500']

function Card({ title, children, span=1 }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)', gridColumn:`span ${span}` }}>
      <div style={{ padding:'12px 16px', background:'var(--blue)', color:'#fff', fontWeight:600, fontSize:13 }}>{title}</div>
      <div style={{ padding:'16px' }}>{children}</div>
    </div>
  )
}

function KPI({ value, label, color, icon, sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'16px', borderTop:`4px solid ${color}`, boxShadow:'var(--shadow)' }}>
      <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:5, textTransform:'uppercase', letterSpacing:1 }}>{icon} {label}</div>
      {sub && <div style={{ fontSize:11, color, marginTop:3, fontWeight:600 }}>{sub}</div>}
    </div>
  )
}

export default function Analytics() {
  const [batStats, setBatStats] = useState(null)
  const [incStats, setIncStats] = useState(null)
  const [voyStats, setVoyStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      batiments.stats(),
      incidents.stats(),
      voyages.stats(),
    ]).then(([b,i,v]) => {
      setBatStats(b.data)
      setIncStats(i.data)
      setVoyStats(v.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--text-dim)' }}>Chargement des analyses...</div>

  const s = batStats?.par_statut || {}

  // Pie data for statuts
  const pieData = [
    { name:'Libres', value:s['Libre']||0, color:'#16a34a' },
    { name:'Occupés', value:s['Occupé']||0, color:'#dc2626' },
    { name:'Réservés', value:s['Réservé']||0, color:'#2563eb' },
    { name:'Maintenance', value:s['Maintenance']||0, color:'#ea580c' },
  ].filter(d=>d.value>0)

  // Bar data for blocs
  const blocData = (batStats?.par_bloc||[]).slice(0,12).map(b=>({
    bloc: b.bloc.replace('Bloc_',''),
    total: b.total,
  }))

  // Incidents pie
  const incPie = [
    { name:'Ouverts', value:incStats?.ouverts||0, color:'#dc2626' },
    { name:'En cours', value:incStats?.en_cours||0, color:'#ea580c' },
    { name:'Résolus', value:incStats?.resolus||0, color:'#16a34a' },
  ].filter(d=>d.value>0)

  // Voyages stats
  const voyBar = [
    { label:'Planifiés', val:voyStats?.planifies||0, color:'#2563eb' },
    { label:'En voyage', val:voyStats?.en_voyage||0, color:'#ea580c' },
    { label:'Retours', val:voyStats?.retours||0, color:'#16a34a' },
    { label:'Annulés', val:voyStats?.annules||0, color:'#64748b' },
  ]

  // Simulate monthly occupation trend
  const monthlyTrend = Array.from({length:6},(_,i)=>{
    const d = new Date(); d.setMonth(d.getMonth()-5+i)
    const base = s['Occupé']||60
    const variation = Math.floor(Math.random()*20-10)
    return {
      mois: d.toLocaleDateString('fr-FR',{month:'short'}),
      occupes: Math.max(0, base + variation),
      libres: Math.max(0, (batStats?.total||200) - base - variation),
    }
  })

  return (
    <div style={{ padding:'16px' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>📈 Analytics & Tableau de bord avancé</h2>
        <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>Indicateurs de performance · Tendances · Répartitions</p>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        <KPI value={batStats?.total||'—'} label="Bâtiments" color="var(--blue)" icon="🏗️"/>
        <KPI value={`${batStats?.taux_occupation||0}%`} label="Taux occupation" color={batStats?.taux_occupation>70?'#dc2626':'#16a34a'} icon="📊"
          sub={batStats?.taux_occupation>70?'⚠️ Capacité haute':'✅ Normal'}/>
        <KPI value={s['Libre']||0} label="Libres" color="#16a34a" icon="🟢"/>
        <KPI value={s['Occupé']||0} label="Occupés" color="#dc2626" icon="🔴"/>
        <KPI value={incStats?.ouverts||0} label="Incidents ouverts" color="#dc2626" icon="🚨"/>
        <KPI value={incStats?.resolus||0} label="Incidents résolus" color="#16a34a" icon="✅"/>
        <KPI value={voyStats?.en_voyage||0} label="En voyage" color="#ea580c" icon="✈️"/>
        <KPI value={batStats?.departs_s1||0} label="Départs S-1" color="#7c3aed" icon="📅"/>
      </div>

      {/* Charts grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Occupation pie */}
        <Card title="🏠 Répartition des résidences">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                {pieData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
              </Pie>
              <Tooltip formatter={(v)=>[v,'Résidences']}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Incidents pie */}
        <Card title="🛠️ Statut des incidents">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={incPie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,value})=>`${name}: ${value}`}>
                {incPie.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
          {incStats && (
            <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:8, fontSize:11 }}>
              <span style={{ color:'#dc2626', fontWeight:700 }}>● Ouverts: {incStats.ouverts}</span>
              <span style={{ color:'#ea580c', fontWeight:700 }}>● En cours: {incStats.en_cours}</span>
              <span style={{ color:'#16a34a', fontWeight:700 }}>● Résolus: {incStats.resolus}</span>
            </div>
          )}
        </Card>

        {/* Monthly trend */}
        <Card title="📈 Tendance occupation (6 mois)" span={2}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
              <XAxis dataKey="mois" tick={{ fontSize:11 }}/>
              <YAxis tick={{ fontSize:11 }}/>
              <Tooltip/>
              <Legend/>
              <Line type="monotone" dataKey="occupes" stroke="#dc2626" strokeWidth={2} name="Occupés" dot={{ fill:'#dc2626', r:4 }}/>
              <Line type="monotone" dataKey="libres" stroke="#16a34a" strokeWidth={2} name="Libres" dot={{ fill:'#16a34a', r:4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Blocs bar chart */}
        <Card title="📦 Occupation par bloc" span={2}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={blocData} margin={{ left:-10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
              <XAxis dataKey="bloc" tick={{ fontSize:10 }}/>
              <YAxis tick={{ fontSize:10 }}/>
              <Tooltip/>
              <Bar dataKey="total" name="Résidences" fill="var(--blue)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Voyages */}
        <Card title="✈️ Statistiques voyages">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {voyBar.map(({label,val,color})=>(
              <div key={label}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                  <span>{label}</span>
                  <span style={{ fontFamily:'monospace', fontWeight:700, color }}>{val}</span>
                </div>
                <div style={{ background:'var(--surface2)', borderRadius:6, height:10, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:color, borderRadius:6, width:`${voyStats?.total?val/voyStats.total*100:0}%`, transition:'width .6s' }}/>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Incidents par priorité */}
        <Card title="⚡ Incidents par priorité">
          {incStats?.par_priorite && Object.keys(incStats.par_priorite).length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={Object.entries(incStats.par_priorite).map(([k,v])=>({ priorite:k, count:v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                <XAxis dataKey="priorite" tick={{ fontSize:11 }}/>
                <YAxis tick={{ fontSize:11 }}/>
                <Tooltip/>
                <Bar dataKey="count" name="Incidents" radius={[4,4,0,0]}>
                  {Object.entries(incStats.par_priorite).map(([k],i)=>(
                    <Cell key={i} fill={k==='haute'?'#dc2626':k==='moyenne'?'#ea580c':'#2563eb'}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun incident</div>
          )}
        </Card>
      </div>
    </div>
  )
}
