/**
 * Centre Opérationnel Temps Réel — Vue 360° du camp
 * Rafraîchissement automatique toutes les 60 secondes
 */
import React, { useState, useEffect, useCallback } from 'react'
import api from '../api'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const h = () => ({ Authorization:`Bearer ${localStorage.getItem('access_token')||''}` })

function KpiCard({ icon, value, label, sub, color='#1e3a8a', bg='#eff6ff', trend, onClick }) {
  return (
    <div onClick={onClick} style={{ background:bg, borderRadius:14, padding:'16px 18px',
      borderLeft:`4px solid ${color}`, cursor:onClick?'pointer':'default',
      boxShadow:'0 2px 8px rgba(0,0,0,.05)', transition:'transform .15s',
      position:'relative' }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:28, marginBottom:2 }}>{icon}</div>
          <div style={{ fontSize:26, fontWeight:900, color, lineHeight:1 }}>{value}</div>
          <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginTop:4 }}>{label}</div>
          {sub && <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{sub}</div>}
        </div>
        {trend !== undefined && (
          <span style={{ fontSize:11, fontWeight:700,
            color: trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#64748b',
            background: trend > 0 ? '#dcfce7' : trend < 0 ? '#fee2e2' : '#f1f5f9',
            padding:'2px 8px', borderRadius:99 }}>
            {trend > 0 ? `↑${trend}%` : trend < 0 ? `↓${Math.abs(trend)}%` : '→'}
          </span>
        )}
      </div>
    </div>
  )
}

function AlerteCard({ type, titre, desc, temps, urgent }) {
  const colors = { incident:'#dc2626', sla:'#d97706', voyage:'#3b82f6', induction:'#7c3aed', stock:'#16a34a' }
  const icons  = { incident:'🚨', sla:'⏰', voyage:'✈️', induction:'🎓', stock:'📦' }
  const c = colors[type] || '#64748b'
  return (
    <div style={{ display:'flex', gap:10, padding:'10px 12px', borderRadius:10,
      background: urgent ? '#fef2f2' : '#f8fafc',
      border:`1.5px solid ${urgent ? '#fecaca' : '#e2e8f0'}`,
      marginBottom:6 }}>
      <span style={{ fontSize:18, flexShrink:0 }}>{icons[type]||'📋'}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:12, color: urgent ? '#dc2626' : '#1e293b' }}>{titre}</div>
        <div style={{ fontSize:11, color:'#64748b', marginTop:1 }}>{desc}</div>
      </div>
      <div style={{ fontSize:10, color:'#94a3b8', flexShrink:0 }}>{temps}</div>
    </div>
  )
}

export default function CentreOperationnel() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [alertes,  setAlertes]  = useState([])
  const [autoRefresh, setAutoRefresh] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bat, inc, voy, pers] = await Promise.allSettled([
        fetch(`${BASE}/api/batiments/stats/`, {headers:h()}).then(r=>r.json()),
        fetch(`${BASE}/api/incidents/stats-sql/`, {headers:h()}).then(r=>r.json()),
        fetch(`${BASE}/api/voyages/stats/`, {headers:h()}).then(r=>r.json()),
        fetch(`${BASE}/api/personnel/?page_size=1`, {headers:h()}).then(r=>r.json()),
      ])

      const batData = bat.status==='fulfilled' ? bat.value : {}
      const incData = inc.status==='fulfilled' ? inc.value : {}
      const voyData = voy.status==='fulfilled' ? voy.value : {}
      const persData = pers.status==='fulfilled' ? pers.value : {}

      setData({ bat:batData, inc:incData, voy:voyData, pers:persData })

      // Générer alertes automatiques
      const newAlertes = []
      if (incData.critiques > 0)
        newAlertes.push({ type:'incident', titre:`${incData.critiques} incident(s) critique(s)`, desc:'Nécessite intervention immédiate', temps:'Maintenant', urgent:true })
      if (incData.sla_depasse > 0)
        newAlertes.push({ type:'sla', titre:`${incData.sla_depasse} SLA dépassé(s)`, desc:'Délai de résolution expiré', temps:'Urgent', urgent:true })
      if (batData.departs_s1 > 0)
        newAlertes.push({ type:'voyage', titre:`${batData.departs_s1} départ(s) cette semaine`, desc:'Libérations de résidences prévues', temps:'7 jours', urgent:false })
      if (voyData.en_voyage > 5)
        newAlertes.push({ type:'voyage', titre:`${voyData.en_voyage} personnes en déplacement`, desc:'Rotations en cours', temps:'En cours', urgent:false })
      setAlertes(newAlertes)
      setLastSync(new Date())
    } catch(e) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    if (autoRefresh) {
      const iv = setInterval(load, 60*1000)
      return () => clearInterval(iv)
    }
  }, [load, autoRefresh])

  const bat = data?.bat || {}
  const inc = data?.inc || {}
  const voy = data?.voy || {}

  return (
    <div style={{ padding:16 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1e3a8a', margin:0 }}>
            🖥️ Centre Opérationnel Temps Réel
          </h1>
          <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>
            {lastSync ? `Sync: ${lastSync.toLocaleTimeString('fr-FR')}` : 'Chargement...'}
            {' · '}{autoRefresh ? '🔄 Auto-refresh 60s' : '⏸️ Pause'}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setAutoRefresh(a => !a)}
            style={{ background:autoRefresh?'#f0fdf4':'#fef2f2',
              border:`1px solid ${autoRefresh?'#bbf7d0':'#fecaca'}`,
              color:autoRefresh?'#16a34a':'#dc2626',
              borderRadius:9, padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            {autoRefresh ? '⏸️ Pause' : '▶️ Reprendre'}
          </button>
          <button onClick={load}
            style={{ background:'#1e3a8a', color:'#fff', border:'none',
              borderRadius:9, padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* KPIs principaux */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:12, marginBottom:20 }}>
        <KpiCard icon="🏠" value={bat.libres??'—'} label="Résidences libres" color="#16a34a" bg="#f0fdf4"/>
        <KpiCard icon="👥" value={bat.occupes??'—'} label="Résidences occupées" color="#1e3a8a" bg="#eff6ff"/>
        <KpiCard icon="📊" value={bat.taux_occupation!=null?`${bat.taux_occupation}%`:'—'} label="Taux occupation" color="#7c3aed" bg="#f5f3ff"/>
        <KpiCard icon="🚨" value={inc.declares??'—'} label="Incidents ouverts" color="#dc2626" bg="#fef2f2"/>
        <KpiCard icon="⏰" value={inc.sla_depasse??'—'} label="SLA dépassés" color="#d97706" bg="#fffbeb"/>
        <KpiCard icon="✈️" value={voy.en_voyage??'—'} label="En déplacement" color="#3b82f6" bg="#eff6ff"/>
        <KpiCard icon="🛠️" value={inc.en_cours??'—'} label="Interventions actives" color="#f97316" bg="#fff7ed"/>
        <KpiCard icon="🏗️" value={bat.maintenance??'—'} label="Résidences maintenance" color="#64748b" bg="#f8fafc"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Alertes temps réel */}
        <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:800, fontSize:14, color:'#1e3a8a', marginBottom:14, display:'flex', justifyContent:'space-between' }}>
            🚨 Alertes Actives
            <span style={{ background:'#fee2e2', color:'#dc2626', fontSize:11, padding:'2px 8px',
              borderRadius:99, fontWeight:700 }}>
              {alertes.filter(a=>a.urgent).length} urgentes
            </span>
          </div>
          {alertes.length === 0 ? (
            <div style={{ textAlign:'center', padding:30, color:'#16a34a', fontWeight:700 }}>
              ✅ Aucune alerte — Tout est normal
            </div>
          ) : alertes.map((a,i) => <AlerteCard key={i} {...a}/>)}
        </div>

        {/* Activité récente */}
        <div style={{ background:'#fff', borderRadius:14, padding:18, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ fontWeight:800, fontSize:14, color:'#1e3a8a', marginBottom:14 }}>
            📈 Métriques Opérationnelles
          </div>
          {[
            { label:'Résidences disponibles', value:`${bat.libres||0}/${(bat.libres||0)+(bat.occupes||0)}`, pct: bat.taux_occupation ? 100-bat.taux_occupation : 0, color:'#16a34a' },
            { label:'Taux résolution incidents', value:`${inc.resolus||0}/${(inc.declares||0)+(inc.resolus||0)}`, pct: inc.declares ? Math.round(inc.resolus/(inc.declares+inc.resolus)*100) : 100, color:'#1e3a8a' },
            { label:'Personnel en camp', value:`${(data?.pers?.count||0) - (voy.en_voyage||0)}`, pct: data?.pers?.count ? Math.round(((data.pers.count-(voy.en_voyage||0))/data.pers.count)*100) : 100, color:'#7c3aed' },
          ].map(({label,value,pct,color})=>(
            <div key={label} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                <span style={{ color:'#64748b', fontWeight:600 }}>{label}</span>
                <span style={{ fontWeight:700, color }}>{value}</span>
              </div>
              <div style={{ background:'#f1f5f9', borderRadius:99, height:8, overflow:'hidden' }}>
                <div style={{ background:`linear-gradient(90deg,${color},${color}88)`,
                  width:`${Math.min(100,Math.max(0,pct))}%`, height:'100%', borderRadius:99,
                  transition:'width 1s ease' }}/>
              </div>
            </div>
          ))}
          <div style={{ marginTop:16, padding:'12px 14px', background:'#f0fdf4', borderRadius:10,
            border:'1px solid #bbf7d0', fontSize:12, color:'#16a34a', fontWeight:600 }}>
            ⚡ Données actualisées automatiquement toutes les 60 secondes
          </div>
        </div>
      </div>
    </div>
  )
}
