import React, { useEffect, useState } from 'react'
import { batiments, incidents } from '../api'

const KPI = ({ value, label, color, icon }) => (
  <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10,
    padding:16, position:'relative', overflow:'hidden', borderTop:`3px solid ${color}` }}>
    <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:700, color, lineHeight:1 }}>{value}</div>
    <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:6, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
    <div style={{ position:'absolute', top:14, right:14, fontSize:20, opacity:.4 }}>{icon}</div>
  </div>
)

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [incStats, setIncStats] = useState(null)

  useEffect(() => {
    batiments.stats().then(r => setStats(r.data)).catch(console.error)
    incidents.stats().then(r => setIncStats(r.data)).catch(console.error)
  }, [])

  const s = stats?.par_statut || {}

  return (
    <div style={{ padding:20 }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700 }}>📊 Tableau de bord opérationnel</h2>
        <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>
          Camp RZI · {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px,1fr))', gap:12, marginBottom:24 }}>
        <KPI value={stats?.total ?? '—'} label="Total bâtiments" color="var(--accent)" icon="🏗️"/>
        <KPI value={s['Libre'] ?? '—'} label="Libres" color="var(--libre)" icon="🟢"/>
        <KPI value={s['Occupé'] ?? '—'} label="Occupés" color="var(--occupe)" icon="🔴"/>
        <KPI value={s['Réservé'] ?? '—'} label="Réservés" color="var(--reserve)" icon="🔵"/>
        <KPI value={s['Maintenance'] ?? '—'} label="Maintenance" color="var(--maintenance)" icon="🟠"/>
        <KPI value={stats?.taux_occupation ? `${stats.taux_occupation}%` : '—'} label="Taux occupation" color="#a855f7" icon="📈"/>
        <KPI value={incStats?.ouverts ?? '—'} label="Incidents ouverts" color="var(--occupe)" icon="🚨"/>
        <KPI value={incStats?.resolus ?? '—'} label="Incidents résolus" color="var(--libre)" icon="✅"/>
      </div>

      {stats?.par_bloc && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>📦 Occupation par Bloc</div>
          {stats.par_bloc.map(b => (
            <div key={b.bloc} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, fontSize:12 }}>
              <div style={{ width:80, color:'var(--text-dim)', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.bloc}</div>
              <div style={{ flex:1, background:'var(--surface2)', borderRadius:4, height:8, overflow:'hidden' }}>
                <div style={{ height:'100%', background:'var(--accent)', borderRadius:4,
                  width:`${(b.total / (stats.total||1))*100*4}%`, maxWidth:'100%', transition:'width .6s' }}/>
              </div>
              <div style={{ width:24, textAlign:'right', fontFamily:'monospace', fontSize:11, color:'var(--text-dim)' }}>{b.total}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
