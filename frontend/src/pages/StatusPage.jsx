import React, { useState, useEffect } from 'react'
import { auth, batiments } from '../api'

export default function StatusPage() {
  const [backend, setBackend] = useState('checking...')
  const [ping, setPing] = useState(null)

  useEffect(() => {
    const start = Date.now()
    batiments.stats()
      .then(r => { setPing(Date.now()-start); setBackend('✅ En ligne') })
      .catch(() => setBackend('❌ Hors ligne'))
  }, [])

  const apiBase = window.__API_BASE__ || import.meta.env.VITE_API_URL || 'auto-détecté'
  const buildId = (typeof __BUILD_ID__ !== 'undefined') ? __BUILD_ID__ : 'N/A'

  return (
    <div style={{ padding:24, maxWidth:600, margin:'0 auto' }}>
      <h2 style={{ fontWeight:800, color:'#1e3a8a', marginBottom:20 }}>🔧 Diagnostic Système</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {[
          ['🌐 Backend URL', apiBase],
          ['🔌 Connexion backend', `${backend}${ping ? ' ('+ping+'ms)' : ''}`],
          ['📅 Date système', new Date().toLocaleString('fr-FR')],
          ['🌍 Hostname', window.location.hostname],
          ['📦 Build ID', buildId],
        ].map(([label, value]) => (
          <div key={label} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
            <span style={{ fontWeight:600, color:'#64748b', fontSize:13 }}>{label}</span>
            <span style={{ fontWeight:700, color:'#1e293b', fontSize:13, textAlign:'right', wordBreak:'break-all' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
