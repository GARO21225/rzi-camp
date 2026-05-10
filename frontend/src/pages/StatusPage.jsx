import React, { useState, useEffect } from 'react'

export default function StatusPage() {
  const [checks, setChecks] = useState({})
  const backendUrl = window.__BACKEND_URL_USED__ || 'Non défini'

  useEffect(() => {
    const run = async () => {
      const results = {}
      
      // Test 1: Backend ping
      try {
        const r = await fetch(`${backendUrl}/api/auth/login/`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({username:'x',password:'x'})
        })
        results.backend = { ok: r.status < 500, status: r.status, msg: r.status === 400 ? 'Accessible ✅' : `HTTP ${r.status}` }
      } catch(e) {
        results.backend = { ok: false, msg: `❌ Inaccessible: ${e.message}` }
      }

      // Test 2: Token en mémoire
      const token = localStorage.getItem('access_token')
      results.token = { ok: !!token, msg: token ? `✅ Token présent (${token.slice(0,20)}...)` : '❌ Pas de token — non connecté' }

      // Test 3: API auth/me
      if (token) {
        try {
          const r = await fetch(`${backendUrl}/api/auth/me/`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const d = await r.json()
          results.me = { ok: r.ok, msg: r.ok ? `✅ Connecté en tant que: ${d.username}` : `❌ HTTP ${r.status}` }
        } catch(e) {
          results.me = { ok: false, msg: `❌ ${e.message}` }
        }
      }

      // Test 4: Batiments endpoint
      if (token) {
        try {
          const r = await fetch(`${backendUrl}/api/batiments/?page_size=1`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const d = await r.json()
          const count = d.count || d.length || 0
          results.data = { ok: r.ok, msg: r.ok ? `✅ ${count} bâtiments chargés` : `❌ HTTP ${r.status}: ${JSON.stringify(d).slice(0,100)}` }
        } catch(e) {
          results.data = { ok: false, msg: `❌ ${e.message}` }
        }
      }

      setChecks(results)
    }
    run()
  }, [])

  const Item = ({label, result}) => (
    <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',background:result?.ok?'rgba(22,163,74,.06)':'rgba(220,38,38,.06)',borderRadius:8,marginBottom:6,border:`1px solid ${result?.ok?'rgba(22,163,74,.2)':'rgba(220,38,38,.2)'}`}}>
      <span style={{fontSize:18,flexShrink:0}}>{result ? (result.ok?'✅':'❌') : '⏳'}</span>
      <div>
        <div style={{fontWeight:600,fontSize:13,color:'#1e3a8a'}}>{label}</div>
        <div style={{fontSize:12,color:'#64748b',marginTop:2}}>{result?.msg || 'Vérification...'}</div>
      </div>
    </div>
  )

  return (
    <div style={{padding:20,maxWidth:600,margin:'0 auto'}}>
      <h2 style={{fontSize:18,fontWeight:700,color:'#1e3a8a',marginBottom:4}}>🔧 Diagnostic système</h2>
      <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,fontFamily:'monospace'}}>
        <div>Frontend: <b>{window.location.origin}</b></div>
        <div>Backend: <b>{backendUrl}</b></div>
      </div>
      <Item label="Connexion backend" result={checks.backend}/>
      <Item label="Token d'authentification" result={checks.token}/>
      {checks.token?.ok && <Item label="Profil utilisateur" result={checks.me}/>}
      {checks.token?.ok && <Item label="Chargement des données" result={checks.data}/>}
      
      {checks.backend?.ok === false && (
        <div style={{background:'rgba(220,38,38,.08)',border:'1px solid rgba(220,38,38,.25)',borderRadius:10,padding:14,marginTop:12}}>
          <div style={{fontWeight:700,color:'#dc2626',marginBottom:8}}>⚠️ Backend inaccessible</div>
          <div style={{fontSize:12,color:'#64748b',lineHeight:1.8}}>
            Solutions:<br/>
            1. Sur Render → Frontend → <b>Environment</b> → Ajouter:<br/>
            &nbsp;&nbsp;<code>VITE_API_URL = https://rzi-camp-backend.onrender.com</code><br/>
            2. Redéployer le frontend<br/>
            3. Vérifier que le backend est actif sur Render
          </div>
        </div>
      )}
      
      <button onClick={()=>window.location.reload()} style={{marginTop:14,background:'#1e3a8a',color:'#fff',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
        🔄 Relancer les tests
      </button>
    </div>
  )
}
