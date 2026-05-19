import React, { useState, useEffect } from 'react'

export default function StatusPage() {
  const [diag, setDiag] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState(null)

  const base = (() => {
    const v = import.meta.env.VITE_API_URL
    if (v) return v.replace(/\/+$/, '')
    const h = window.location.hostname
    if (h.includes('frontend')) return 'https://' + h.replace('frontend','backend')
    return 'http://localhost:8000'
  })()

  useEffect(() => {
    fetch(`${base}/api/diagnostic/`)
      .then(r => r.json())
      .then(d => { setDiag(d); setLoading(false) })
      .catch(e => { setDiag({ error: e.message }); setLoading(false) })
  }, [])

  const seed = async () => {
    setSeeding(true); setSeedResult(null)
    try {
      const r = await fetch(`${base}/api/force-seed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'roxgold2026' })
      })
      setSeedResult(await r.json())
    } catch(e) { setSeedResult({ error: e.message }) }
    setSeeding(false)
    // Recharger le diagnostic
    setTimeout(() => fetch(`${base}/api/diagnostic/`).then(r=>r.json()).then(setDiag).catch(()=>{}), 1000)
  }

  const isEmpty = diag && !diag.error && (diag.personnel < 5 || diag.batiments < 100)
  const isOk    = diag && !diag.error && diag.batiments >= 100 && diag.personnel >= 5

  return (
    <div style={{ padding:24, maxWidth:640, margin:'0 auto' }}>
      <h2 style={{ fontWeight:800, color:'#1e3a8a', marginBottom:20 }}>🔧 Diagnostic Système</h2>

      {loading && <div style={{ textAlign:'center', padding:40, fontSize:32 }}>⏳</div>}

      {diag && (
        <>
          {/* Statut général */}
          <div style={{ background: isOk?'#f0fdf4':'#fef3c7', border:`1px solid ${isOk?'#86efac':'#fde68a'}`, borderRadius:14, padding:'16px 20px', marginBottom:16 }}>
            <div style={{ fontWeight:800, fontSize:16, color: isOk?'#166534':'#92400e', marginBottom:8 }}>
              {isOk ? '✅ Système opérationnel' : '⚠️ Base de données incomplète'}
            </div>
            {isEmpty && (
              <div style={{ fontSize:13, color:'#92400e', marginBottom:12 }}>
                Le personnel et/ou les données ne sont pas encore initialisés sur ce serveur.
                Cliquez sur le bouton ci-dessous pour initialiser.
              </div>
            )}

            {/* Bouton seed si données manquantes */}
            {(isEmpty || !isOk) && (
              <button onClick={seed} disabled={seeding}
                style={{ background:seeding?'#94a3b8':'#1e3a8a', color:'#fff', border:'none', padding:'12px 24px', borderRadius:10, cursor:seeding?'wait':'pointer', fontSize:14, fontWeight:700, width:'100%' }}>
                {seeding ? '⏳ Initialisation en cours...' : '🌱 Initialiser les données maintenant'}
              </button>
            )}

            {seedResult && (
              <div style={{ marginTop:12, padding:'10px 14px', borderRadius:10, fontSize:12,
                background: seedResult.ok?'#f0fdf4':'#fef2f2',
                color: seedResult.ok?'#166534':'#991b1b',
                border: `1px solid ${seedResult.ok?'#bbf7d0':'#fecaca'}`}}>
                <div style={{ fontWeight:700, marginBottom:6 }}>{seedResult.summary}</div>
                {(seedResult.results||[]).map((r,i) => <div key={i}>{r}</div>)}
                {(seedResult.errors||[]).map((e,i) => <div key={i} style={{ color:'#dc2626' }}>{e}</div>)}
              </div>
            )}
          </div>

          {/* Tableau des infos */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'12px 18px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc' }}>
              <span style={{ fontWeight:700, color:'#1e3a8a' }}>État de la base de données</span>
            </div>
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
              {diag.error ? (
                <div style={{ color:'#dc2626', fontWeight:600 }}>❌ {diag.error}</div>
              ) : (
                [
                  ['🏗️ Bâtiments',    diag.batiments, 203],
                  ['👤 Personnel',    diag.personnel, 6],
                  ['🔑 Utilisateurs', diag.users,     5],
                  ['📋 Migrations',   diag.migrations, 30],
                  ['🗄️ Base',        diag.db_engine, null],
                ].map(([label, value, expected]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', background:'#f8fafc', padding:'10px 14px', borderRadius:8 }}>
                    <span style={{ color:'#64748b', fontWeight:600, fontSize:13 }}>{label}</span>
                    <span style={{ fontWeight:800, color: expected && value < expected ? '#dc2626' : '#1e3a8a', fontSize:13 }}>{value}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ marginTop:14, background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 16px', fontSize:12, color:'#64748b' }}>
            Backend: <code>{base}</code>
          </div>
        </>
      )}
    </div>
  )
}
