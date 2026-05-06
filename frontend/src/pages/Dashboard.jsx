import React, { useEffect, useState } from 'react'
import { batiments, incidents, voyages } from '../api'

const KPI = ({ value, label, color, icon, sub }) => (
  <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
    padding:18, position:'relative', overflow:'hidden', borderTop:`4px solid ${color}`, boxShadow:'var(--shadow)' }}>
    <div style={{ fontFamily:'monospace', fontSize:30, fontWeight:700, color, lineHeight:1 }}>{value}</div>
    <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:6, textTransform:'uppercase', letterSpacing:1 }}>{label}</div>
    {sub && <div style={{ fontSize:11, color, marginTop:4, fontWeight:600 }}>{sub}</div>}
    <div style={{ position:'absolute', top:14, right:14, fontSize:22, opacity:.3 }}>{icon}</div>
  </div>
)

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [incStats, setIncStats] = useState(null)
  const [voyStats, setVoyStats] = useState(null)

  useEffect(() => {
    batiments.stats().then(r=>setStats(r.data)).catch(console.error)
    incidents.stats().then(r=>setIncStats(r.data)).catch(console.error)
    voyages.stats().then(r=>setVoyStats(r.data)).catch(console.error)
  }, [])

  const s = stats?.par_statut || {}

  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:22, fontWeight:700, color:'var(--blue)' }}>📊 Tableau de bord opérationnel</h2>
        <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>
          Résidence Roxgold Sango · {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
        <KPI value={stats?.total??'—'} label="Total bâtiments" color="#1e3a8a" icon="🏗️"/>
        <KPI value={s['Libre']??'—'} label="Libres" color="var(--libre)" icon="🟢"/>
        <KPI value={s['Occupé']??'—'} label="Occupés" color="var(--occupe)" icon="🔴"/>
        <KPI value={s['Réservé']??'—'} label="Réservés" color="var(--reserve)" icon="🔵"/>
        <KPI value={s['Maintenance']??'—'} label="Maintenance" color="var(--maintenance)" icon="🟠"/>
        <KPI value={stats?.taux_occupation?`${stats.taux_occupation}%`:'—'} label="Taux occupation" color="#7c3aed" icon="📈"/>
        <KPI value={incStats?.ouverts??'—'} label="Incidents ouverts" color="var(--occupe)" icon="🚨"/>
        <KPI value={voyStats?.en_voyage??'—'} label="En voyage" color="var(--maintenance)" icon="✈️"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Occupation par bloc */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <div style={{ padding:'14px 18px', background:'var(--blue)', color:'#fff', fontWeight:600, fontSize:14 }}>📦 Occupation par Bloc</div>
          <div style={{ padding:16 }}>
            {stats?.par_bloc?.slice(0,10).map(b=>(
              <div key={b.bloc} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, fontSize:12 }}>
                <div style={{ width:72, color:'var(--text-dim)', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.bloc}</div>
                <div style={{ flex:1, background:'var(--surface2)', borderRadius:4, height:10, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:'var(--blue)', borderRadius:4,
                    width:`${Math.min((b.total/(stats?.total||1))*100*5, 100)}%`, transition:'width .6s' }}/>
                </div>
                <div style={{ width:24, textAlign:'right', fontFamily:'monospace', fontSize:11, color:'var(--text-dim)', fontWeight:700 }}>{b.total}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Statuts */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <div style={{ padding:'14px 18px', background:'var(--blue)', color:'#fff', fontWeight:600, fontSize:14 }}>📊 Répartition des statuts</div>
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
            {[['Libres','Libre','var(--libre)'],['Occupés','Occupé','var(--occupe)'],['Réservés','Réservé','var(--reserve)'],['Maintenance','Maintenance','var(--maintenance)']].map(([l,k,c])=>{
              const val = s[k]||0; const pct = stats?.total ? Math.round(val/stats.total*100) : 0
              return (
                <div key={k}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ fontWeight:600, color:'var(--text)' }}>{l}</span>
                    <span style={{ fontFamily:'monospace', color:c, fontWeight:700 }}>{val} <span style={{ color:'var(--text-dim)', fontWeight:400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ background:'var(--surface2)', borderRadius:6, height:12, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:c, borderRadius:6, width:`${pct}%`, transition:'width .8s' }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
