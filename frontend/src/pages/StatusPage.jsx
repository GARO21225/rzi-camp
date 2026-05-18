import React, { useState, useEffect } from 'react'
import { auth } from '../api'

export default function StatusPage() {
  const [diag, setDiag] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState(null)

  const baseUrl = (() => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
    const h = window.location.hostname
    if (h.includes('onrender.com') && h.includes('frontend'))
      return 'https://' + h.replace('frontend', 'backend')
    return 'http://localhost:8000'
  })()

  useEffect(() => {
    fetch(`${baseUrl}/api/diagnostic/`)
      .then(r => r.json())
      .then(setDiag)
      .catch(e => setDiag({ error: e.message, status: 'error' }))
  }, [])

  const forceSeed = async () => {
    setSeeding(true); setSeedResult(null)
    try {
      const r = await fetch(`${baseUrl}/api/force-seed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'roxgold2026' })
      })
      const d = await r.json()
      setSeedResult(d)
    } catch(e) { setSeedResult({ error: e.message }) }
    finally { setSeeding(false) }
  }

  const statusColor = diag?.status === 'ok' ? '#16a34a' : diag?.status === 'error' ? '#dc2626' : '#f97316'

  return (
    <div style={{ padding:24, maxWidth:640, margin:'0 auto' }}>
      <h2 style={{ fontWeight:800, color:'#1e3a8a', marginBottom:20 }}>🔧 Diagnostic Système</h2>
      
      {/* État général */}
      {diag && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, marginBottom:16, overflow:'hidden' }}>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:700, color:'#1e3a8a' }}>État de la base de données</span>
            <span style={{ fontWeight:800, color:statusColor }}>
              {diag.status === 'ok' ? '✅ Opérationnel' : diag.status === 'empty_db' ? '⚠️ DB vide' : '❌ Erreur'}
            </span>
          </div>
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
            {diag.error ? (
              <div style={{ color:'#dc2626', fontWeight:600 }}>❌ {diag.error}</div>
            ) : (
              Object.entries({ 
                '🏗️ Bâtiments': diag.batiments,
                '👤 Personnel': diag.personnel,
                '🔑 Utilisateurs': diag.users,
                '📋 Migrations': diag.migrations,
                '🗄️ Base de données': diag.db_engine,
              }).map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', padding:'10px 14px', borderRadius:8 }}>
                  <span style={{ color:'#64748b', fontWeight:600, fontSize:13 }}>{label}</span>
                  <span style={{ fontWeight:800, color:'#1e3a8a', fontSize:13 }}>{value}</span>
                </div>
              ))
            )}
          </div>
          
          {/* Bouton reseed si DB vide */}
          {(diag.status === 'empty_db' || diag.batiments < 100) && (
            <div style={{ padding:'0 16px 16px' }}>
              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'12px 14px', marginBottom:12, fontSize:13, color:'#92400e' }}>
                ⚠️ La base de données est vide ou incomplète. Cliquez sur le bouton ci-dessous pour initialiser les données.
              </div>
              <button onClick={forceSeed} disabled={seeding}
                style={{ width:'100%', background:seeding?'#94a3b8':'#1e3a8a', color:'#fff', border:'none', padding:13, borderRadius:10, cursor:seeding?'wait':'pointer', fontSize:14, fontWeight:700 }}>
                {seeding ? '⏳ Initialisation en cours...' : '🌱 Initialiser la base de données'}
              </button>
              {seedResult && (
                <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, fontSize:12,
                  background: seedResult.ok ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${seedResult.ok ? '#bbf7d0' : '#fecaca'}`,
                  color: seedResult.ok ? '#166534' : '#991b1b' }}>
                  {seedResult.ok ? '✅ ' + (seedResult.output || 'Données initialisées') : '❌ ' + (seedResult.error || seedResult.output)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Infos système */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'12px 18px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc' }}>
          <span style={{ fontWeight:700, color:'#1e3a8a' }}>Informations système</span>
        </div>
        <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
          {[
            ['🌐 Backend URL', baseUrl],
            ['📅 Date système', new Date().toLocaleString('fr-FR')],
            ['🌍 Frontend', window.location.hostname],
          ].map(([label, value]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', padding:'10px 14px', borderRadius:8, gap:12 }}>
              <span style={{ color:'#64748b', fontWeight:600, fontSize:13, flexShrink:0 }}>{label}</span>
              <span style={{ fontWeight:700, color:'#1e293b', fontSize:13, textAlign:'right', wordBreak:'break-all' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
