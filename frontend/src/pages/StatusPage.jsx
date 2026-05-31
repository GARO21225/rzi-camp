
function VersionCheck() {
  const [ver, setVer] = React.useState(null)
  const BACKEND = (() => {
    const h = window.location.hostname
    if (h.includes('onrender')) return 'https://' + h.replace('frontend', 'backend')
    return import.meta.env.VITE_API_URL || 'http://localhost:8000'
  })()
  
  React.useEffect(() => {
    fetch(`${BACKEND}/api/version/`)
      .then(r => r.json())
      .then(d => setVer(d))
      .catch(() => setVer({error: 'Impossible de contacter le backend'}))
  }, [])

  if (!ver) return null
  
  const isLatest = ver.version === '1779680747'
  
  return (
    <div style={{background: isLatest ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${isLatest ? '#86efac' : '#fca5a5'}`,
      borderRadius: 12, padding: '12px 16px', marginBottom: 16}}>
      <div style={{fontWeight: 700, color: isLatest ? '#166534' : '#991b1b', marginBottom: 4}}>
        {isLatest ? '✅ Backend à jour (v1779680747)' : `⚠️ Backend version ${ver.version || 'inconnue'} — redéployez sur Render`}
      </div>
      {ver.fixes && (
        <div style={{fontSize: 11, color: '#64748b'}}>
          Fixes: {ver.fixes?.join(' · ')}
        </div>
      )}
      {ver.error && <div style={{fontSize: 11, color: '#dc2626'}}>{ver.error}</div>}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useStore } from '../store'

export default function StatusPage() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser
  const [diag,      setDiag]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [seeding,   setSeeding]   = useState(false)
  const [seedResult,setSeedResult]= useState(null)

  const base = (() => {
    const v = import.meta.env.VITE_API_URL
    if (v) return v.replace(/\/+$/, '')
    const h = window.location.hostname
    if (h.includes('frontend')) return 'https://' + h.replace('frontend','backend')
    return 'http://localhost:8000'
  })()

  const loadDiag = () => {
    setLoading(true)
    fetch(`${base}/api/diagnostic/`)
      .then(r => r.json())
      .then(d => { setDiag(d); setLoading(false) })
      .catch(e => { setDiag({ error: e.message }); setLoading(false) })
  }

  useEffect(() => { loadDiag() }, [])

  const seed = async () => {
    setSeeding(true); setSeedResult(null)
    try {
      const r = await fetch(`${base}/api/force-seed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'roxgold2026' })
      })
      const d = await r.json()
      setSeedResult(d)
      setTimeout(loadDiag, 1500)
    } catch(e) { setSeedResult({ error: e.message, ok: false }) }
    setSeeding(false)
  }

  const diagPersonnel = diag?.personnel ?? diag?.tables?.personnel ?? 0
  const diagBatiments = diag?.batiments ?? diag?.tables?.batiments ?? 0
  const isOk    = diag && diag.database !== 'disconnected' && !diag.error && (diagPersonnel >= 0 || diagBatiments >= 0)
  const isEmpty = diag && !diag.error && diag.database === 'connected' && diagPersonnel === 0

  return (
    <div style={{ padding:24, maxWidth:680, margin:'0 auto' }}>
      <h2 style={{ fontWeight:800, color:'#1e3a8a', marginBottom:6 }}>🔧 Diagnostic Système</h2>
      <p style={{ fontSize:12, color:'#64748b', marginBottom:20 }}>État de la base de données · Initialisation des données</p>

      {loading && <div style={{ textAlign:'center', padding:40, fontSize:32 }}>⏳</div>}

      {diag && !loading && (
        <>
          {/* Status card */}
          <div style={{ background: isOk?'#f0fdf4':'#fef3c7', border:`1.5px solid ${isOk?'#86efac':'#fde68a'}`, borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:16, color: isOk?'#166534':'#92400e', marginBottom: isEmpty?10:0 }}>
              {isOk ? '✅ Système opérationnel' : isEmpty ? '⚠️ Données incomplètes — initialisation requise' : '❌ Erreur système'}
            </div>
            {isEmpty && (
              <div style={{ fontSize:13, color:'#92400e' }}>
                Les articles boutique, personnel de démo ou autres données manquent.
              </div>
            )}
          </div>

          {/* Tableau diagnostic */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'11px 18px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc', fontWeight:700, fontSize:13, color:'#1e3a8a' }}>
              État de la base de données
            </div>
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
              {diag.error ? (
                <div style={{ color:'#dc2626', fontWeight:600 }}>❌ {diag.error}</div>
              ) : [
                ['🏗️ Bâtiments',    diagBatiments, 100],
                ['👤 Personnel',    diagPersonnel, 5],
                ['🔑 Utilisateurs', diag.users,     5],
                ['📋 Migrations',   diag.migrations, 30],
                ['🗄️ Base',        diag.db_engine,  null],
              ].map(([label, value, min]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', padding:'10px 14px', borderRadius:8 }}>
                  <span style={{ color:'#64748b', fontWeight:600, fontSize:13 }}>{label}</span>
                  <span style={{ fontWeight:800, fontSize:13,
                    color: min && value < min ? '#dc2626' : '#1e3a8a' }}>
                    {value}
                    {min && value < min && <span style={{ fontSize:10, color:'#dc2626', marginLeft:6 }}>⚠️ Insuffisant</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bouton reseed — TOUJOURS visible pour admin */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:6 }}>
              🌱 Initialisation des données
            </div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
              Crée ou met à jour les utilisateurs de démonstration, le personnel et les articles boutique.
              Les données existantes ne sont PAS supprimées.
            </div>
            <button onClick={seed} disabled={seeding}
              style={{ width:'100%', background:seeding?'#94a3b8':'#1e3a8a', color:'#fff', border:'none',
                padding:'13px', borderRadius:10, cursor:seeding?'wait':'pointer', fontSize:14, fontWeight:700 }}>
              {seeding ? '⏳ Initialisation en cours...' : '🌱 Initialiser les données maintenant'}
            </button>

            {seedResult && (
              <div style={{ marginTop:12, padding:'12px 16px', borderRadius:10, fontSize:12,
                background: seedResult.ok?'#f0fdf4':'#fef2f2',
                border: `1px solid ${seedResult.ok?'#bbf7d0':'#fecaca'}` }}>
                <div style={{ fontWeight:700, marginBottom:8, color: seedResult.ok?'#166534':'#991b1b' }}>
                  {seedResult.ok ? '✅ ' : '⚠️ '}{seedResult.summary}
                </div>
                {(seedResult.results||[]).map((r,i) => (
                  <div key={i} style={{ color:'#166534', marginBottom:3 }}>{r}</div>
                ))}
                {(seedResult.errors||[]).map((e,i) => (
                  <div key={i} style={{ color:'#dc2626', marginBottom:3 }}>{e}</div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop:14, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 14px', fontSize:11, color:'#94a3b8' }}>
            Backend: <code style={{ color:'#2563eb' }}>{base}</code>
          </div>
        </>
      )}
    </div>
  )
}
