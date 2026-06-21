/**
 * WorkflowHub — Centre de commandement unifié
 * Tous les workflows actifs en un seul endroit
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { incidents, voyages as voyAPI, batiments, boutique as boutiqueAPI } from '../api'

const STATUS_COLORS = {
  // Maintenance
  declare:   {c:'#3b82f6',label:'Déclaré'},
  assigne:   {c:'#f97316',label:'Assigné'},
  en_cours:  {c:'#eab308',label:'En cours'},
  resolu:    {c:'#16a34a',label:'Résolu'},
  cloture:   {c:'#64748b',label:'Clôturé'},
  // Voyages
  planifie:  {c:'#8b5cf6',label:'Planifié'},
  en_voyage: {c:'#0891b2',label:'En voyage'},
  retour:    {c:'#16a34a',label:'Retour'},
}

function Dot({color}) {
  return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',
    background:color,marginRight:6,flexShrink:0}}/>
}

function WorkflowCard({icon,title,count,color,items,onViewAll,loading}) {
  return (
    <div style={{background:'#fff',borderRadius:16,overflow:'hidden',
      boxShadow:'0 1px 6px rgba(0,0,0,.08)',flex:1,minWidth:280}}>
      <div style={{background:color,color:'#fff',padding:'12px 16px',
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:20}}>{icon}</span>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>{title}</div>
            <div style={{fontSize:11,opacity:.8}}>{count} actifs</div>
          </div>
        </div>
        <button onClick={onViewAll}
          style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
            padding:'4px 10px',borderRadius:99,cursor:'pointer',fontSize:11,fontWeight:700}}>
          Voir tout →
        </button>
      </div>
      <div style={{maxHeight:240,overflowY:'auto'}}>
        {loading ? (
          <div style={{padding:20,textAlign:'center',color:'#94a3b8',fontSize:12}}>⏳ Chargement...</div>
        ) : items.length===0 ? (
          <div style={{padding:20,textAlign:'center',color:'#94a3b8',fontSize:12}}>
            ✅ Aucun élément actif
          </div>
        ) : items.map((item,i)=>(
          <div key={i} style={{padding:'10px 16px',borderBottom:'1px solid #f1f5f9',
            display:'flex',alignItems:'center',gap:10}}>
            <Dot color={STATUS_COLORS[item.status]?.c||'#64748b'}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:12,color:'#1e293b',
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {item.title}
              </div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>{item.subtitle}</div>
            </div>
            <div style={{fontSize:10,fontWeight:700,color:STATUS_COLORS[item.status]?.c||'#64748b',
              flexShrink:0,textAlign:'right'}}>
              {STATUS_COLORS[item.status]?.label||item.status}
              {item.sla_depasse && (
                <div style={{color:'#dc2626',fontSize:9}}>⚠️ SLA dépassé</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WorkflowHub() {
  const navigate = useNavigate()
  const [maintenance, setMaintenance] = useState([])
  const [voyagesData, setVoyagesData] = useState([])
  const [boutiqueData,setBoutiqueData]= useState([])
  const [stats,       setStats]       = useState({})
  const [loading,     setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rInc, rVoy, rStats, rBons] = await Promise.allSettled([
        incidents.list({page_size:20, statut__in:'declare,assigne,en_cours'}),
        voyAPI.list({page_size:20}),
        incidents.stats(),
        boutiqueAPI.bons({annee:new Date().getFullYear()}),
      ])

      if (rInc.status==='fulfilled') {
        const data = rInc.value.data.results || rInc.value.data || []
        setMaintenance(data
          .filter(i=>!['cloture','annule'].includes(i.statut))
          .map(i=>({
            title: i.titre,
            subtitle: `${i.residence} · ${i.categorie} · ${i.priorite}`,
            status: i.statut,
            sla_depasse: i.sla_depasse,
          })))
      }

      if (rVoy.status==='fulfilled') {
        const data = rVoy.value.data.results || rVoy.value.data || []
        setVoyagesData(data
          .filter(v=>['planifie','en_voyage'].includes(v.statut))
          .map(v=>({
            title: `${v.personnel_nom||'?'} → ${v.destination}`,
            subtitle: `${v.date_depart} · ${v.motif||'Voyage'}`,
            status: v.statut,
          })))
      }

      if (rStats.status==='fulfilled') setStats(rStats.value.data||{})

      if (rBons.status==='fulfilled') {
        const data = rBons.value.data.results || rBons.value.data || []
        // Bons avec crédit faible (<20%)
        setBoutiqueData(data
          .filter(b=>parseInt(b.credit_restant)/parseInt(b.credit_initial||1) < 0.2)
          .slice(0,10)
          .map(b=>({
            title: b.personnel_nom,
            subtitle: `Solde: ${parseInt(b.credit_restant).toLocaleString()} FCFA`,
            status: parseInt(b.credit_restant)===0 ? 'cloture' : 'en_cours',
          })))
      }
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(()=>{
    loadAll()
    const iv = setInterval(loadAll, 60*1000) // refresh toutes les minutes
    return ()=>clearInterval(iv)
  },[loadAll])

  const urgents = maintenance.filter(m=>m.sla_depasse || m.status==='declare').length

  return (
    <div style={{maxWidth:1200,margin:'0 auto',padding:24}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
        marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:900,color:'#0f2447',margin:0,
            display:'flex',alignItems:'center',gap:10}}>
            🎯 Centre de Commandement
          </h1>
          <p style={{fontSize:12,color:'#64748b',margin:'4px 0 0'}}>
            Tous les workflows actifs en temps réel ·{'  '}
            <span style={{color:'#94a3b8'}}>
              Actualisé à {lastRefresh.toLocaleTimeString('fr-FR')}
            </span>
          </p>
        </div>
        <button onClick={loadAll} disabled={loading}
          style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'9px 18px',
            borderRadius:10,cursor:'pointer',fontSize:12,fontWeight:700}}>
          {loading ? '⏳ Actualisation...' : '🔄 Actualiser'}
        </button>
      </div>

      {/* KPIs urgents */}
      {urgents > 0 && (
        <div style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',color:'#fff',
          borderRadius:14,padding:'14px 18px',marginBottom:20,
          display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:28}}>🚨</span>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>
              {urgents} incident{urgents>1?'s':''} urgent{urgents>1?'s':''}
            </div>
            <div style={{fontSize:12,opacity:.8}}>
              SLA dépassé ou déclaré sans assignation
            </div>
          </div>
          <button onClick={()=>navigate('/maintenance')}
            style={{marginLeft:'auto',background:'rgba(255,255,255,.2)',border:'none',
              color:'#fff',padding:'7px 16px',borderRadius:9,cursor:'pointer',
              fontSize:12,fontWeight:700}}>
            Traiter →
          </button>
        </div>
      )}

      {/* Stats globales */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5, minmax(0, 1fr))',
        gap:10,marginBottom:24}}>
        {[
          ['🔧 Incidents ouverts',   stats.declare||0,   '#3b82f6'],
          ['⚙️ En cours',           stats.en_cours||0,  '#eab308'],
          ['⚠️ SLA dépassés',       stats.sla_depasses||0, '#dc2626'],
          ['✈️ Voyages actifs',      voyagesData.filter(v=>v.status==='en_voyage').length, '#8b5cf6'],
          ['🛒 Bons faibles',        boutiqueData.length, '#f59e0b'],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:'#fff',borderRadius:12,padding:'12px 14px',
            borderTop:`3px solid ${c}`,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
            <div style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:c}}>{v}</div>
            <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Flux temps réel */}
      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
        <WorkflowCard
          icon="🔧" title="Maintenance" color="linear-gradient(135deg,#1e3a8a,#2563eb)"
          count={maintenance.length} items={maintenance} loading={loading}
          onViewAll={()=>navigate('/maintenance')}/>

        <WorkflowCard
          icon="✈️" title="Voyages" color="linear-gradient(135deg,#7c3aed,#6d28d9)"
          count={voyagesData.length} items={voyagesData} loading={loading}
          onViewAll={()=>navigate('/voyages')}/>

        <WorkflowCard
          icon="💳" title="Bons crédit faibles" color="linear-gradient(135deg,#f59e0b,#d97706)"
          count={boutiqueData.length} items={boutiqueData} loading={loading}
          onViewAll={()=>navigate('/boutique')}/>
      </div>
    </div>
  )
}
