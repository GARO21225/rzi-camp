import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { auth } from '../api'
import { LOGO_B64 } from '../logo_b64'

const ROLES = [
  { label:'Admin', user:'admin', pass:'admin123' },
  { label:'Manager', user:'manager', pass:'manager123' },
  { label:'Terrain', user:'agent', pass:'agent123' },
  { label:'Resto', user:'resto', pass:'resto123' },
]

export default function Login() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setToken, setUser } = useStore()
  const navigate = useNavigate()

  const doLogin = async (u=username, p=password) => {
    setLoading(true); setError('')
    try {
      const r = await auth.login(u,p)
      setToken(r.data.access)
      localStorage.setItem('refresh_token', r.data.refresh)
      const me = await auth.me()
      setUser(me.data)
      navigate('/')
    } catch { setError('Identifiants incorrects') }
    finally { setLoading(false) }
  }

  const inp = { width:'100%', background:'#181e2a', border:'1px solid #1e2736', color:'#e8edf5',
    padding:'9px 12px', borderRadius:7, fontSize:13, outline:'none', marginBottom:14, fontFamily:'inherit' }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0d12' }}>
      <div style={{ background:'#111620', border:'1px solid #1e2736', borderRadius:16, padding:40, width:380, maxWidth:'95vw' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <img src={LOGO_B64} alt="Roxgold Sango" style={{ height:60, objectFit:'contain', marginBottom:12 }}/>
          <div style={{ fontFamily:'monospace', fontSize:12, color:'#7a8ba0', letterSpacing:1 }}>
            SYSTÈME DE GESTION DES RÉSIDENCES
          </div>
        </div>
        <label style={{ display:'block', fontSize:11, color:'#7a8ba0', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Identifiant</label>
        <input style={inp} value={username} onChange={e=>setUsername(e.target.value)} placeholder="admin"/>
        <label style={{ display:'block', fontSize:11, color:'#7a8ba0', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Mot de passe</label>
        <input style={inp} type="password" value={password} onChange={e=>setPassword(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
        <button onClick={()=>doLogin()} disabled={loading}
          style={{ width:'100%', background:'#f0a500', color:'#000', border:'none', padding:12, borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:1, marginTop:4 }}>
          {loading ? 'CONNEXION...' : 'CONNEXION SÉCURISÉE'}
        </button>
        {error && <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#ef4444', marginTop:10 }}>{error}</div>}
        <div style={{ display:'flex', gap:6, marginTop:16, flexWrap:'wrap' }}>
          {ROLES.map(r => (
            <button key={r.label} onClick={()=>doLogin(r.user,r.pass)}
              style={{ flex:1, minWidth:80, background:'#181e2a', border:'1px solid #1e2736', color:'#7a8ba0',
                padding:'6px 8px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'monospace', textAlign:'center' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
