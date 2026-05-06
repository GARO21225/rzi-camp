import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { auth } from '../api'

const s = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' },
  box: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:40, width:380, maxWidth:'95vw' },
  logo: { fontFamily:'monospace', fontSize:22, fontWeight:700, color:'var(--accent)', textAlign:'center', letterSpacing:3, marginBottom:4 },
  sub: { textAlign:'center', fontSize:12, color:'var(--text-dim)', marginBottom:32, fontFamily:'monospace', letterSpacing:1 },
  label: { display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 },
  input: { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:7, fontSize:13, outline:'none', marginBottom:14, fontFamily:'inherit' },
  btn: { width:'100%', background:'var(--accent)', color:'#000', border:'none', padding:12, borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', letterSpacing:1, marginTop:8 },
  roles: { display:'flex', gap:6, marginTop:20, flexWrap:'wrap' },
  roleBtn: { flex:1, minWidth:80, background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'6px 8px', borderRadius:6, fontSize:11, cursor:'pointer', fontFamily:'monospace', textAlign:'center' },
  err: { background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#ef4444', marginTop:10 }
}

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

  const doLogin = async (u = username, p = password) => {
    setLoading(true); setError('')
    try {
      const r = await auth.login(u, p)
      setToken(r.data.access)
      localStorage.setItem('refresh_token', r.data.refresh)
      const me = await auth.me()
      setUser(me.data)
      navigate('/')
    } catch (e) {
      setError('Identifiants incorrects. Essayez: admin / admin123')
    } finally { setLoading(false) }
  }

  return (
    <div style={s.wrap}>
      <div style={s.box}>
        <div style={s.logo}>🏔 RZI CAMP</div>
        <div style={s.sub}>ERP GIS INDUSTRIEL · SYSTÈME MINIER</div>
        <label style={s.label}>Identifiant</label>
        <input style={s.input} value={username} onChange={e=>setUsername(e.target.value)} placeholder="admin"/>
        <label style={s.label}>Mot de passe</label>
        <input style={s.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"
          onKeyDown={e => e.key==='Enter' && doLogin()}/>
        <button style={s.btn} onClick={()=>doLogin()} disabled={loading}>
          {loading ? 'CONNEXION...' : 'CONNEXION SÉCURISÉE'}
        </button>
        {error && <div style={s.err}>{error}</div>}
        <div style={{...s.sub, marginTop:16, marginBottom:8}}>Accès rapide par rôle ↓</div>
        <div style={s.roles}>
          {ROLES.map(r => (
            <button key={r.label} style={s.roleBtn}
              onClick={() => { setUsername(r.user); setPassword(r.pass); doLogin(r.user, r.pass) }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
