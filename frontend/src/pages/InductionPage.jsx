/**
 * InductionPage — Hub du module Induction QHSE
 * Tableau de bord centralisé pour la gestion des inductions
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useStore } from '../store'

const BACKEND = (() => {
  const v = import.meta?.env?.VITE_API_URL
  if (v) return v.replace(/\/+$/, '')
  const h = window.location.hostname
  if (h.includes('frontend')) return 'https://' + h.replace('frontend','backend')
  if (h.includes('localhost')) return 'http://localhost:8000'
  return window.location.origin
})()

export default function InductionPage() {
  const { user } = useStore()
  const navigate = useNavigate()
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/induction/dashboard/')
      .then(r => setStats(r.data))
      .catch(() => setStats({
        total_employes:0, badges_actifs:0, conformite_pct:0,
        badges_expirant_30j:0, quiz_echoues_7j:0, medicaux_expirés:0,
        statuts:{}
      }))
      .finally(() => setLoading(false))
  }, [])

  const C = '#1e3a8a'
  const MODULES = [
    { icon:'👤', label:'Employés & Dossiers', desc:'Gérer les dossiers, créer des inductions', color:'#1e3a8a', url:'/api/induction/employees/' },
    { icon:'📄', label:'Documents', desc:'Valider les documents', color:'#7c3aed', url:'/api/induction/employee-documents/' },
    { icon:'🎓', label:'Formations QHSE', desc:'Gérer les modules et la progression', color:'#16a34a', url:'/api/induction/trainings/' },
    { icon:'📋', label:'Quiz', desc:'Resultats et tentatives de quiz', color:'#f59e0b', url:'/api/induction/quiz-attempts/' },
    { icon:'🏥', label:'Visites Médicales', desc:'Saisir et suivre les visites médicales', color:'#ef4444', url:'/api/induction/medical-checks/' },
    { icon:'🔲', label:'Badges & Accès', desc:'Gerer les badges QR et acces', color:'#0891b2', url:'/api/induction/badges/' },
  ]

  return (
    <div style={{maxWidth:1100, margin:'0 auto', padding:24}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
        borderRadius:20,padding:'24px 28px',marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <h1 style={{fontSize:26,fontWeight:900,margin:0}}>🎓 Induction QHSE</h1>
            <p style={{fontSize:14,color:'rgba(255,255,255,.7)',margin:'6px 0 0'}}>
              Module de gestion des inductions — Sites miniers Roxgold Sango
            </p>
          </div>
          {stats && (
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:'monospace',fontSize:32,fontWeight:900,color:'#f0a500'}}>
                {stats.conformite_pct}%
              </div>
              <div style={{fontSize:12,color:'rgba(255,255,255,.6)'}}>Taux de conformité</div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div style={{textAlign:'center',padding:40,fontSize:32}}>⏳</div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',
          gap:12,marginBottom:24}}>
          {[
            ['👤 Employés',    stats?.total_employes||0,         '#1e3a8a'],
            ['🎫 Badges actifs',stats?.badges_actifs||0,         '#16a34a'],
            ['⏰ Expirent 30j',stats?.badges_expirant_30j||0,    '#f59e0b'],
            ['❌ Quiz échoués', stats?.quiz_echoues_7j||0,        '#dc2626'],
            ['🏥 Médicaux exp.',stats?.medicaux_expirés||0,       '#7c3aed'],
            ['🚫 Accès refusés',stats?.acces_refuses_24h||0,     '#ef4444'],
          ].map(([l,v,c])=>(
            <div key={l} style={{background:'#fff',borderRadius:12,padding:'14px 16px',
              borderTop:`3px solid ${c}`,boxShadow:'0 1px 6px rgba(0,0,0,.07)'}}>
              <div style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Modules */}
      <h2 style={{fontSize:16,fontWeight:800,color:C,marginBottom:16}}>Accès rapides</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14,marginBottom:24}}>
        {MODULES.map(m => (
          <a key={m.label} href={BACKEND+m.url}
            target="_blank" rel="noopener noreferrer"
            style={{background:'#fff',borderRadius:14,padding:'16px 18px',
              boxShadow:'0 1px 6px rgba(0,0,0,.07)',textDecoration:'none',
              borderLeft:`4px solid ${m.color}`,display:'block',
              transition:'transform .15s, box-shadow .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.12)'}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 1px 6px rgba(0,0,0,.07)'}}>
            <div style={{fontSize:24,marginBottom:8}}>{m.icon}</div>
            <div style={{fontWeight:700,fontSize:14,color:m.color}}>{m.label}</div>
            <div style={{fontSize:12,color:'#94a3b8',marginTop:4}}>{m.desc}</div>
            <div style={{fontSize:10,color:'#cbd5e1',marginTop:6,fontFamily:'monospace'}}>
              {m.url} →
            </div>
          </a>
        ))}
      </div>

      {/* Workflow */}
      <div style={{background:'#f8fafc',border:'2px solid #e2e8f0',borderRadius:16,padding:20}}>
        <h3 style={{fontSize:14,fontWeight:700,color:C,marginBottom:16}}>
          🔄 Workflow d'induction
        </h3>
        <div style={{display:'flex',alignItems:'center',gap:0,overflowX:'auto',paddingBottom:8}}>
          {[
            {step:'1', label:'Enregistrement', icon:'📝', color:'#1e3a8a'},
            {step:'2', label:'Documents',      icon:'📄', color:'#7c3aed'},
            {step:'3', label:'Formation QHSE', icon:'🎓', color:'#16a34a'},
            {step:'4', label:'Quiz',           icon:'📋', color:'#f59e0b'},
            {step:'5', label:'Visite médicale',icon:'🏥', color:'#ef4444'},
            {step:'✅', label:'Badge QR',       icon:'🎫', color:'#0891b2'},
          ].map((s,i,arr) => (
            <React.Fragment key={s.step}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',
                minWidth:90,textAlign:'center'}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:s.color,
                  color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:18,fontWeight:900,flexShrink:0}}>
                  {s.icon}
                </div>
                <div style={{fontSize:10,fontWeight:700,color:s.color,marginTop:4}}>{s.step}</div>
                <div style={{fontSize:9,color:'#64748b',maxWidth:70}}>{s.label}</div>
              </div>
              {i < arr.length-1 && (
                <div style={{flex:1,height:2,background:'linear-gradient(90deg,'+s.color+','+arr[i+1].color+')',
                  minWidth:20,marginBottom:20}}/>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Note API */}
      <div style={{marginTop:16,textAlign:'center',fontSize:11,color:'#94a3b8'}}>
        API REST disponible sur{' '}
        <a href={BACKEND+'/api/induction/'} target="_blank" rel="noopener noreferrer"
          style={{color:'#1e3a8a',fontWeight:700}}>
          {BACKEND}/api/induction/
        </a>
      </div>
    </div>
  )
}
