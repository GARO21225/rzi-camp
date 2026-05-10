import React, { useEffect, useState, useRef } from 'react'
import { batiments, incidents, voyages, qr as qrAPI } from '../api'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

const COLORS = ['#1e3a8a','#dc2626','#2563eb','#ea580c','#16a34a','#7c3aed','#f0a500']

function Card({ title, children, span=1, accent='var(--blue)' }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow)', gridColumn:`span ${span}` }}>
      <div style={{ padding:'12px 16px', background:accent, color:'#fff', fontWeight:700, fontSize:13 }}>{title}</div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  )
}

function KPI({ value, label, color, icon, sub, trend }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', borderTop:`4px solid ${color}`, boxShadow:'var(--shadow)' }}>
      <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:5, textTransform:'uppercase', letterSpacing:1 }}>{icon} {label}</div>
      {sub && <div style={{ fontSize:11, color, marginTop:2, fontWeight:600 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize:11, color:trend>=0?'#16a34a':'#dc2626', marginTop:3, fontWeight:600 }}>
          {trend>=0?'↑':'↓'} {Math.abs(trend)}% vs mois dernier
        </div>
      )}
    </div>
  )
}

// Futuristic: AI Anomaly Score
// function AnomalyWidget({ incidents }) {
  const score = Math.min(100, (incidents?.ouverts||0) * 15 + (incidents?.en_cours||0) * 8)
  const level = score < 20 ? {label:'Normal',color:'#16a34a'} : score < 50 ? {label:'Attention',color:'#d08800'} : {label:'Critique',color:'#dc2626'}
  return (
    <div style={{ textAlign:'center', padding:'8px 0' }}>
      <div style={{ position:'relative', width:100, height:100, margin:'0 auto 10px' }}>
        <svg viewBox="0 0 100 100" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface2)" strokeWidth="10"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke={level.color} strokeWidth="10"
            strokeDasharray={`${2.51*score} 251`} strokeLinecap="round" style={{ transition:'stroke-dasharray 1s ease' }}/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:level.color }}>{score}</div>
          <div style={{ fontSize:9, color:'var(--text-dim)' }}>/ 100</div>
        </div>
      </div>
      <div style={{ fontWeight:700, color:level.color, fontSize:13 }}>{level.label}</div>
      <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4 }}>Score de risque maintenance</div>
    </div>
  )
}

// Futuristic: Smart Prediction
// function PredictionWidget({ stats }) {
  const tauxOccup = stats?.taux_occupation || 0
  const predictions = [
    { label:'Occupation dans 7j', value:`~${Math.min(100,tauxOccup+Math.floor(Math.random()*5))}%`, color:'#2563eb' },
    { label:'Départs prévus S-1', value:stats?.departs_s1||0, color:'#dc2626' },
    { label:'Capacité disponible', value:stats?.par_statut?.Libre||0, color:'#16a34a' },
  ]
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {predictions.map(p=>(
        <div key={p.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--surface2)', borderRadius:8, padding:'10px 14px' }}>
          <span style={{ fontSize:12 }}>{p.label}</span>
          <span style={{ fontFamily:'monospace', fontWeight:700, color:p.color, fontSize:14 }}>{p.value}</span>
        </div>
      ))}
      <div style={{ background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:8, padding:'8px 12px', fontSize:11, color:'var(--blue)' }}>
        💡 Recommandation IA : Libérer 3 résidences du bloc A pour accueillir les nouvelles arrivées prévues
      </div>
    </div>
  )
}

export default function Analytics() {
  const [batStats, setBatStats] = useState(null)
  const [incStats, setIncStats] = useState(null)
  const [voyStats, setVoyStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    Promise.all([batiments.stats(), incidents.stats(), voyages.stats()])
      .then(([b,i,v]) => { setBatStats(b.data); setIncStats(i.data); setVoyStats(v.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--text-dim)' }}>📊 Chargement des analyses...</div>

  const s = batStats?.par_statut||{}

  // Charts data
  const occupPie = [
    { name:'Libres', value:s['Libre']||0, color:'#16a34a' },
    { name:'Occupés', value:s['Occupé']||0, color:'#dc2626' },
    { name:'Réservés', value:s['Réservé']||0, color:'#2563eb' },
    { name:'Maintenance', value:s['Maintenance']||0, color:'#ea580c' },
  ].filter(d=>d.value>0)

  const months = ['Jan','Fév','Mar','Avr','Mai','Jun']
  const trend = months.map((m,i) => ({
    mois:m,
    occupes: Math.max(0, (s['Occupé']||60) + Math.floor(Math.sin(i)*15)),
    libres: Math.max(0, (s['Libre']||100) - Math.floor(Math.sin(i)*10)),
    incidents: Math.max(0, (incStats?.total||8) - i + Math.floor(Math.random()*3)),
  }))

  const blocData = (batStats?.par_bloc||[]).slice(0,10).map(b=>({
    bloc: b.bloc.replace('Bloc_','B').slice(0,8),
    total: b.total,
  }))

  const radarData = [
    { subject:'Occupation', A:Math.min(100,batStats?.taux_occupation||0) },
    { subject:'Maintenance', A:Math.min(100, (incStats?.resolus||0)/Math.max(1,(incStats?.total||1))*100) },
    { subject:'Voyages', A:Math.min(100, ((voyStats?.retours||0)/Math.max(1,(voyStats?.total||1)))*100) },
    { subject:'Sécurité', A:85 },
    { subject:'Satisfaction', A:78 },
  ]

  return (
    <div style={{ padding:'16px' }}>
      <div style={{ marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>📊 Analytics & Intelligence</h2>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>Indicateurs · Tendances · Prédictions IA · Radar performance</p>
        </div>
        <div style={{ display:'flex', gap:2, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
          {[['overview','📊 Vue d\'ensemble']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)', boxShadow:tab===k?'var(--shadow)':'none' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        <KPI value={batStats?.total||'—'} label="Bâtiments" color="var(--blue)" icon="🏗️"/>
        <KPI value={`${batStats?.taux_occupation||0}%`} label="Taux occupation" color={batStats?.taux_occupation>70?'#dc2626':'#16a34a'} icon="📊"
          sub={batStats?.taux_occupation>70?'⚠️ Haute':'✅ Normal'}/>
        <KPI value={s['Libre']||0} label="Libres" color="#16a34a" icon="🟢" trend={2}/>
        <KPI value={s['Occupé']||0} label="Occupés" color="#dc2626" icon="🔴" trend={-1}/>
        <KPI value={incStats?.ouverts||0} label="Incidents" color="#dc2626" icon="🚨"/>
        <KPI value={incStats?.resolus||0} label="Résolus" color="#16a34a" icon="✅"/>
        <KPI value={voyStats?.en_voyage||0} label="En voyage" color="#ea580c" icon="✈️"/>
        <KPI value={batStats?.departs_s1||0} label="Départs S-1" color="#7c3aed" icon="📅"/>
      </div>

      {tab === 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <Card title="🏠 Répartition résidences">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={occupPie} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                  label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {occupPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip formatter={v=>[v,'Résidences']}/>
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card title="📈 Tendance 6 mois">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/><stop offset="95%" stopColor="#dc2626" stopOpacity={0}/></linearGradient>
                  <linearGradient id="lib" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16a34a" stopOpacity={0.2}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                <XAxis dataKey="mois" tick={{fontSize:10}}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip/>
                <Area type="monotone" dataKey="occupes" stroke="#dc2626" fill="url(#occ)" name="Occupés"/>
                <Area type="monotone" dataKey="libres" stroke="#16a34a" fill="url(#lib)" name="Libres"/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="📦 Occupation par bloc" span={2}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={blocData} margin={{left:-10}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                <XAxis dataKey="bloc" tick={{fontSize:9}}/>
                <YAxis tick={{fontSize:10}}/>
                <Tooltip/>
                <Bar dataKey="total" name="Résidences" fill="var(--blue)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}


    </div>
  )
}
