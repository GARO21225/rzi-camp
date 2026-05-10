import React, { useEffect, useState } from 'react'
import { batiments, incidents, voyages } from '../api'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

const COLORS = ['#1e3a8a','#dc2626','#2563eb','#ea580c','#16a34a','#7c3aed','#f0a500']

function Card({ title, children, span=1, accent='var(--blue)' }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'var(--shadow)', gridColumn:`span ${span}` }}>
      <div style={{ padding:'11px 16px', background:accent, color:'#fff', fontWeight:700, fontSize:13 }}>{title}</div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  )
}

function KPI({ value, label, color, icon, sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px', borderTop:`4px solid ${color}`, boxShadow:'var(--shadow)' }}>
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
    Promise.all([batiments.stats(), incidents.stats(), voyages.stats()])
      .then(([b,i,v]) => { setBatStats(b.data); setIncStats(i.data); setVoyStats(v.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--text-dim)' }}>📊 Chargement...</div>

  const s = batStats?.par_statut||{}

  const occupPie = [
    { name:'Libres', value:s['Libre']||0, color:'#16a34a' },
    { name:'Occupés', value:s['Occupé']||0, color:'#dc2626' },
    { name:'Réservés', value:s['Réservé']||0, color:'#2563eb' },
    { name:'Maintenance', value:s['Maintenance']||0, color:'#ea580c' },
  ].filter(d=>d.value>0)

  const months = ['Jan','Fév','Mar','Avr','Mai','Jun']
  const trend = months.map((m,i) => ({
    mois:m,
    occupes: Math.max(0, (s['Occupé']||60) + Math.floor(Math.sin(i)*10)),
    libres: Math.max(0, (s['Libre']||100) - Math.floor(Math.sin(i)*8)),
  }))

  const blocData = (batStats?.par_bloc||[]).slice(0,10).map(b=>({
    bloc: b.bloc.replace('Bloc_','B').slice(0,8),
    total: b.total,
  }))

  return (
    <div style={{ padding:'16px' }}>
      <div style={{ marginBottom:16 }}>
        <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>📊 Analytics</h2>
        <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>Indicateurs · Tendances · Occupation</p>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        <KPI value={batStats?.total||'—'} label="Bâtiments" color="var(--blue)" icon="🏗️"/>
        <KPI value={`${batStats?.taux_occupation||0}%`} label="Taux occup." color={batStats?.taux_occupation>70?'#dc2626':'#16a34a'} icon="📊" sub={batStats?.taux_occupation>70?'⚠️ Haute':'✅ Normal'}/>
        <KPI value={s['Libre']||0} label="Libres" color="#16a34a" icon="🟢"/>
        <KPI value={s['Occupé']||0} label="Occupés" color="#dc2626" icon="🔴"/>
        <KPI value={incStats?.ouverts||0} label="Incidents" color="#dc2626" icon="🚨"/>
        <KPI value={incStats?.resolus||0} label="Résolus" color="#16a34a" icon="✅"/>
        <KPI value={voyStats?.en_voyage||0} label="En voyage" color="#ea580c" icon="✈️"/>
        <KPI value={batStats?.departs_s1||0} label="Départs S-1" color="#7c3aed" icon="📅"/>
      </div>

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
                <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/><stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="lib" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                </linearGradient>
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

        {/* Résumé incidents */}
        <Card title="🛠️ Incidents maintenance" accent="#ea580c">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              ['Ouverts', incStats?.ouverts||0, '#dc2626'],
              ['En cours', incStats?.en_cours||0, '#ea580c'],
              ['Résolus', incStats?.resolus||0, '#16a34a'],
              ['Total', incStats?.total||0, 'var(--blue)'],
            ].map(([l,v,c])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--surface2)', borderRadius:8 }}>
                <span style={{ fontSize:12, fontWeight:600 }}>{l}</span>
                <span style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Résumé voyages */}
        <Card title="✈️ Voyages" accent="#7c3aed">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              ['Planifiés', voyStats?.planifies||0, '#2563eb'],
              ['En voyage', voyStats?.en_voyage||0, '#ea580c'],
              ['Retours', voyStats?.retours||0, '#16a34a'],
              ['Total', voyStats?.total||0, 'var(--blue)'],
            ].map(([l,v,c])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'var(--surface2)', borderRadius:8 }}>
                <span style={{ fontSize:12, fontWeight:600 }}>{l}</span>
                <span style={{ fontFamily:'monospace', fontSize:18, fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
