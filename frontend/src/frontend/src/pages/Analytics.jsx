/**
 * ANALYTICS v2 — Tableau de bord intelligence métier
 * Statistiques avancées pour la direction du camp
 */
import React, { useState, useEffect } from 'react'
import { batiments, incidents, voyages as voyAPI, personnel as personnelAPI } from '../api'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts'

const C = { blue:'#1e3a8a', orange:'#f97316', green:'#16a34a', red:'#dc2626', purple:'#7c3aed', gold:'#f0a500', teal:'#0891b2' }

function StatBlock({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'16px 18px', borderTop:`3px solid ${color}`, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ fontFamily:'monospace', fontSize:34, fontWeight:900, color }}>{value ?? '—'}</div>
        <span style={{ fontSize:24, opacity:.5 }}>{icon}</span>
      </div>
      <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1.2, marginTop:5, fontWeight:700 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

export default function Analytics() {
  const [bats,  setBats]  = useState(null)
  const [inc,   setInc]   = useState(null)
  const [voy,   setVoy]   = useState(null)
  const [perso, setPerso] = useState([])
  const [tab,   setTab]   = useState('residence')

  useEffect(() => {
    batiments.stats().then(r => {
      const d = r.data, ps = d.par_statut || {}
      setBats({
        total:       d.total || 203,
        libres:      ps['Libre'] || 0,
        occupes:     ps['Occupé'] || 0,
        reserves:    ps['Réservé'] || 0,
        maintenance: ps['Maintenance'] || 0,
        taux:        d.taux_occupation || 0,
        par_bloc:    d.par_bloc || [],
        departs_s1:  d.departs_s1 || 0,
      })
    }).catch(() => {})
    incidents.stats().then(r => setInc(r.data)).catch(() => {})
    voyAPI.stats().then(r => setVoy(r.data)).catch(() => {})
    personnelAPI.list({ page_size:500 }).then(r => setPerso(r.data.results || r.data || [])).catch(() => {})
  }, [])

  // Données calculées
  const occupancyPie = bats ? [
    { name:'Libres',      v:bats.libres,      fill:C.green },
    { name:'Occupés',     v:bats.occupes,     fill:C.blue },
    { name:'Réservés',    v:bats.reserves,    fill:C.orange },
    { name:'Maintenance', v:bats.maintenance, fill:C.red },
  ] : []

  const typePersonnel = Object.entries(
    perso.reduce((a,p) => { a[p.type_personnel||'roxgold'] = (a[p.type_personnel||'roxgold']||0)+1; return a }, {})
  ).map(([name,v]) => ({ name:{roxgold:'Roxgold',sous_traitant:'Sous-traitant',visiteur:'Visiteur'}[name]||name, v }))

  const blocData = (bats?.par_bloc || []).slice(0,10).map(b => ({
    name: b.bloc?.replace('Bloc_','') || '',
    total: b.total,
    occupes: Math.round(b.total * (bats?.taux||0) / 100)
  }))

  const TABS = [
    ['residence','🏠 Résidences'],
    ['personnel','👤 Personnel'],
    ['incidents','🔧 Incidents'],
    ['voyages',  '✈️ Voyages'],
  ]

  return (
    <div style={{ padding:20 }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:22, fontWeight:800, color:'#1e3a8a', margin:0 }}>📈 Analytics & Rapports</h2>
        <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>
          Tableau de bord intelligence métier · Camp Roxgold Sango
        </p>
      </div>

      {/* KPIs globaux */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
        <StatBlock label="Bâtiments" value={bats?.total} icon="🏗️" color={C.blue} sub={`${bats?.taux?.toFixed(1)||0}% occupé`} />
        <StatBlock label="Libres" value={bats?.libres} icon="✅" color={C.green} sub={`${bats?.total?Math.round(bats.libres/bats.total*100):0}% du parc`} />
        <StatBlock label="Incidents" value={inc?.total||0} icon="🚨" color={C.red} sub={`${inc?.ouverts||0} ouverts`} />
        <StatBlock label="Voyages" value={voy?.total||0} icon="✈️" color={C.orange} sub={`${voy?.en_voyage||0} en voyage`} />
        <StatBlock label="Personnel" value={perso.length} icon="👤" color={C.purple} sub="Total enregistrés" />
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding:'8px 16px', borderRadius:10, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit',
              background: tab===k ? '#1e3a8a' : '#fff',
              color:      tab===k ? '#fff'    : '#475569',
              borderColor:tab===k ? '#1e3a8a' : '#e2e8f0' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Résidences ── */}
      {tab === 'residence' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Donut */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:16 }}>📊 Répartition occupation</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={occupancyPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="v" paddingAngle={3}>
                  {occupancyPie.map((e,i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={(v,n) => [v+' chambres', n]} contentStyle={{ borderRadius:10, fontSize:12 }} />
                <Legend iconType="circle" iconSize={10} formatter={(v,e) => `${v}: ${e.payload.v}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Barres par bloc */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:16 }}>🏗️ Chambres par bloc (top 10)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={blocData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius:10, fontSize:12 }} />
                <Bar dataKey="total" fill={C.blue} radius={[4,4,0,0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Barres de statut */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,0,0,.06)', gridColumn:'span 2' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:16 }}>📈 Taux par statut</div>
            {occupancyPie.map(s => (
              <div key={s.name} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:12 }}>
                  <span style={{ fontWeight:600, color:'#334155' }}>{s.name}</span>
                  <span style={{ fontWeight:700, color:s.fill }}>{s.v} chambres · {bats?.total ? Math.round(s.v/bats.total*100) : 0}%</span>
                </div>
                <div style={{ height:8, background:'#f1f5f9', borderRadius:20, overflow:'hidden' }}>
                  <div style={{ width:`${bats?.total ? Math.round(s.v/bats.total*100) : 0}%`, height:'100%', background:s.fill, borderRadius:20, transition:'width .5s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Personnel ── */}
      {tab === 'personnel' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:16 }}>👥 Type de personnel</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typePersonnel} cx="50%" cy="50%" outerRadius={85} dataKey="v" paddingAngle={4}>
                  {typePersonnel.map((_,i) => <Cell key={i} fill={[C.blue,C.orange,C.purple][i%3]} />)}
                </Pie>
                <Tooltip formatter={(v,n) => [v+' agents', n]} contentStyle={{ borderRadius:10, fontSize:12 }} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:16 }}>🏢 Par société (top 5)</div>
            {Object.entries(
              perso.reduce((a,p) => { const s=p.societe||'N/A'; a[s]=(a[s]||0)+1; return a }, {})
            ).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([soc,cnt]) => (
              <div key={soc} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ fontWeight:600 }}>{soc}</span>
                  <span style={{ fontWeight:700, color:C.blue }}>{cnt}</span>
                </div>
                <div style={{ height:6, background:'#f1f5f9', borderRadius:20, overflow:'hidden' }}>
                  <div style={{ width:`${Math.round(cnt/perso.length*100)}%`, height:'100%', background:C.blue, borderRadius:20 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Incidents ── */}
      {tab === 'incidents' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
          {[
            ['Total incidents',    inc?.total||0,    '📋', C.blue,   'Tous statuts confondus'],
            ['Ouverts',           inc?.ouverts||0,   '🔴', C.red,    'À traiter en priorité'],
            ['En cours',          inc?.en_cours||0,  '🟡', C.orange, 'En cours de résolution'],
            ['Résolus',           inc?.resolus||0,   '✅', C.green,  'Traités avec succès'],
          ].map(([label,value,icon,color,sub]) => (
            <StatBlock key={label} label={label} value={value} icon={icon} color={color} sub={sub} />
          ))}
        </div>
      )}

      {/* ── Voyages ── */}
      {tab === 'voyages' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:14 }}>
          {[
            ['Total voyages',    voy?.total||0,    '✈️', C.blue,   'Tous statuts'],
            ['Planifiés',        voy?.planifies||0,'📅', C.gold,   'Départs à venir'],
            ['En voyage',        voy?.en_voyage||0,'🚀', C.orange, 'Actuellement hors camp'],
            ['Retours',          voy?.retours||0,  '🏠', C.green,  'Rentrés au camp'],
            ['Annulés',          voy?.annules||0,  '❌', C.red,    'Voyages annulés'],
          ].map(([label,value,icon,color,sub]) => (
            <StatBlock key={label} label={label} value={value} icon={icon} color={color} sub={sub} />
          ))}
        </div>
      )}
    </div>
  )
}
