import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { auth } from '../api'

function ForgotModal({ onClose }) {
  const [step, setStep] = useState('request')
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const apiCall = async (path, data) => {
    const baseUrl = window.__API_BASE__ || import.meta.env.VITE_API_URL || ''
    const r = await fetch(`${baseUrl}/api${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) })
    return r.json()
  }

  const requestReset = async () => {
    if (!username.trim()) return setMsg({ type:'error', text:'Saisissez votre identifiant' })
    setLoading(true); setMsg(null)
    try {
      const r = await apiCall('/forgot-password/', { username: username.trim() })
      if (r.token) { setToken(r.token); setMsg({ type:'info', text:'Token généré — transmettez-le à l\'utilisateur' }) }
      else if (r.message) setMsg({ type:'success', text: r.message })
      else if (r.error) { setMsg({ type:'error', text: r.error }); return }
      setStep('confirm')
    } catch { setMsg({ type:'error', text:'Erreur réseau' }) }
    finally { setLoading(false) }
  }

  const confirmReset = async () => {
    if (!token.trim() || !newPwd) return setMsg({ type:'error', text:'Token et mot de passe requis' })
    if (newPwd.length < 6) return setMsg({ type:'error', text:'Minimum 6 caractères' })
    setLoading(true); setMsg(null)
    try {
      const r = await apiCall('/reset-password-confirm/', { token: token.trim(), password: newPwd })
      if (r.message) { setMsg({ type:'success', text: r.message }); setTimeout(onClose, 2500) }
      else setMsg({ type:'error', text: r.error || 'Token invalide' })
    } catch { setMsg({ type:'error', text:'Erreur réseau' }) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(5,15,35,.85)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
      <div style={{ background:'#0d1b2e', border:'1px solid rgba(240,165,0,.3)', borderRadius:20, width:'100%', maxWidth:420, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.6)' }}>
        <div style={{ background:'linear-gradient(135deg,#0f2447,#1a3560)', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(240,165,0,.2)' }}>
          <span style={{ color:'#f0a500', fontWeight:800, fontSize:15, letterSpacing:'.5px' }}>🔐 RÉINITIALISATION</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', color:'#94a3b8', width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          {msg && <div style={{ padding:'10px 14px', borderRadius:10, fontSize:13, fontWeight:600, background: msg.type==='error'?'rgba(220,38,38,.15)':msg.type==='success'?'rgba(22,163,74,.15)':'rgba(37,99,235,.15)', color: msg.type==='error'?'#fca5a5':msg.type==='success'?'#86efac':'#93c5fd', border:`1px solid ${msg.type==='error'?'rgba(220,38,38,.3)':msg.type==='success'?'rgba(22,163,74,.3)':'rgba(37,99,235,.3)'}` }}>{msg.text}</div>}
          {step === 'request' ? <>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Identifiant de connexion" style={{ background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none', color:'#fff', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }}/>
            {token && <div style={{ background:'rgba(240,165,0,.1)', border:'1px solid rgba(240,165,0,.3)', borderRadius:10, padding:'10px 14px' }}><div style={{ fontSize:11, color:'#f0a500', marginBottom:4, fontWeight:700 }}>TOKEN À TRANSMETTRE</div><div style={{ fontFamily:'monospace', fontSize:13, color:'#fef3c7', wordBreak:'break-all' }}>{token}</div></div>}
            <button onClick={requestReset} disabled={loading} style={{ background:'linear-gradient(135deg,#f0a500,#d09400)', color:'#1a0e00', border:'none', padding:'12px', borderRadius:10, cursor:loading?'wait':'pointer', fontSize:14, fontWeight:800, fontFamily:'inherit' }}>{loading?'⏳ Génération...':'Générer le token'}</button>
          </> : <>
            <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Coller le token ici" style={{ background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none', color:'#fff', fontFamily:'monospace', width:'100%', boxSizing:'border-box' }}/>
            <input value={newPwd} onChange={e=>setNewPwd(e.target.value)} type="password" placeholder="Nouveau mot de passe (min. 6 car.)" style={{ background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none', color:'#fff', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }}/>
            <button onClick={confirmReset} disabled={loading} style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'none', padding:'12px', borderRadius:10, cursor:loading?'wait':'pointer', fontSize:14, fontWeight:800, fontFamily:'inherit' }}>{loading?'⏳ Confirmation...':'Confirmer la réinitialisation'}</button>
          </>}
        </div>
      </div>
    </div>
  )
}

export default function Login() {
  const navigate   = useNavigate()
  const { setUser, setToken } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [forgot,   setForgot]   = useState(false)

  const doLogin = async () => {
    if (!username || !password) return setError('Identifiant et mot de passe requis')
    setLoading(true); setError('')
    try {
      const r  = await auth.login(username.trim(), password)
      setToken(r.data.access)
      localStorage.setItem('refresh_token', r.data.refresh)
      const me = await auth.me()
      setUser(me.data)
      sessionStorage.setItem('just_logged_in', '1')
      navigate('/')
    } catch(e) {
      setError(e.response?.data?.detail || e.response?.data?.non_field_errors?.[0] || 'Identifiant ou mot de passe incorrect')
    } finally { setLoading(false) }
  }

  const onKey = e => { if (e.key === 'Enter') doLogin() }

  const inp = {
    width:'100%', background:'rgba(255,255,255,.07)', border:'1.5px solid rgba(255,255,255,.14)',
    borderRadius:12, padding:'13px 16px', fontSize:15, outline:'none', color:'#fff',
    fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s',
  }

  return (
    <div style={{
      minHeight:'100dvh', display:'flex', alignItems:'stretch',
      background:'#050f23',
      fontFamily:'"DM Sans", "Inter", system-ui, sans-serif',
    }}>
      {/* Panel gauche - branding */}
      <div style={{
        flex:'0 0 50%', display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center',
        background:'linear-gradient(145deg, #060d1f 0%, #0c1a38 40%, #0f2447 100%)',
        position:'relative', overflow:'hidden', padding:40,
      }}>
        {/* Grille décorative */}
        <div style={{ position:'absolute', inset:0, opacity:.07, backgroundImage:'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)', backgroundSize:'40px 40px' }}/>
        {/* Cercles lumineux */}
        <div style={{ position:'absolute', top:-100, right:-100, width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle, rgba(240,165,0,.15) 0%, transparent 70%)' }}/>
        <div style={{ position:'absolute', bottom:-80, left:-80, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(37,99,235,.2) 0%, transparent 70%)' }}/>

        <div style={{ position:'relative', textAlign:'center', maxWidth:400 }}>
          {/* Logo / Icon */}
          <div style={{ width:88, height:88, margin:'0 auto 28px', borderRadius:24, background:'linear-gradient(135deg,#f0a500,#d09400)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, boxShadow:'0 16px 48px rgba(240,165,0,.4), 0 0 0 1px rgba(240,165,0,.3)' }}>
            <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCI+CiAgPCEtLSBCYWNrZ3JvdW5kIC0tPgogIDxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiByeD0iMzIiIGZpbGw9IiNmMGE1MDAiLz4KICA8IS0tIE1pbmUgcGljayBpY29uIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEwMCw5NSkiPgogICAgPCEtLSBQaWNrYXhlIGhhbmRsZSAtLT4KICAgIDxyZWN0IHg9Ii01IiB5PSItMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSI1NSIgcng9IjUiIGZpbGw9IiMxYTFhMWEiIHRyYW5zZm9ybT0icm90YXRlKC00NSkiLz4KICAgIDwhLS0gUGlja2F4ZSBoZWFkIC0tPgogICAgPHBhdGggZD0iTS0zNSwtMzUgTC0xNSwtMTUgUTAsLTUgMTUsLTE1IEwzNSwtMzUgUTIwLC01MCAwLC00NSBRLTIwLC01MCAtMzUsLTM1IFoiIGZpbGw9IiMxYTFhMWEiLz4KICAgIDwhLS0gR29sZCBzaGluZSAtLT4KICAgIDxlbGxpcHNlIGN4PSItMjAiIGN5PSItMjgiIHJ4PSI2IiByeT0iMyIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC4zIiB0cmFuc2Zvcm09InJvdGF0ZSgtNDUsLTIwLC0yOCkiLz4KICA8L2c+CiAgPCEtLSBUZXh0IFJPWEdPTEQgLS0+CiAgPHRleHQgeD0iMTAwIiB5PSIxNjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCBCbGFjayxzYW5zLXNlcmlmIiAKICAgIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiMxYTFhMWEiIGxldHRlci1zcGFjaW5nPSIyIj5ST1hHT0xEPC90ZXh0PgogIDx0ZXh0IHg9IjEwMCIgeT0iMTc4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgCiAgICBmb250LXNpemU9IjkiIGZpbGw9IiMxYTFhMWEiIGxldHRlci1zcGFjaW5nPSIzIiBvcGFjaXR5PSIwLjgiPlNBTkdPIMK3IEPDlFRFIEQnSVZPSVJFPC90ZXh0Pgo8L3N2Zz4=" alt="Roxgold"
              style={{width:54,height:54,objectFit:'contain'}}/>
          </div>
          <div style={{ fontSize:11, letterSpacing:4, color:'#f0a500', fontWeight:700, textTransform:'uppercase', marginBottom:12 }}>
            ROXGOLD · SANGO MINE - CÔTE D'IVOIRE
          </div>
          <h1 style={{ fontSize:36, fontWeight:900, color:'#fff', lineHeight:1.1, margin:'0 0 16px', letterSpacing:'-1px' }}>
            RZI Camp<br/>
            <span style={{ color:'#f0a500' }}>Management</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,.45)', fontSize:14, lineHeight:1.7, maxWidth:300, margin:'0 auto' }}>
            Plateforme de gestion intégrée du camp minier Roxgold Sango
          </p>

          {/* Stats décoratives */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginTop:48 }}>
            {[['🏠','Résidences','Gestion complète'],['🍽️','Restauration','QR & Caisse'],['✈️','Voyages','Gestion déplacements'],['🛡️','QHSE','Induction & Sécurité']].map(([icon,lbl,sub])=>(
              <div key={lbl} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:14, padding:'14px 10px' }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>{lbl}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:2 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel droit - formulaire */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center',
        padding:'40px 20px', background:'#080f20',
      }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <div style={{ marginBottom:36 }}>
            <div style={{ fontSize:11, letterSpacing:3, color:'#f0a500', fontWeight:700, textTransform:'uppercase', marginBottom:10 }}>ACCÈS SÉCURISÉ</div>
            <h2 style={{ fontSize:28, fontWeight:900, color:'#fff', margin:0, letterSpacing:'-0.5px' }}>Connexion</h2>
            <p style={{ color:'rgba(255,255,255,.4)', fontSize:13, marginTop:6 }}>Saisissez vos identifiants pour accéder à la plateforme</p>
          </div>

          {error && (
            <div style={{ background:'rgba(220,38,38,.12)', border:'1px solid rgba(220,38,38,.3)', borderRadius:12, padding:'11px 16px', marginBottom:20, color:'#fca5a5', fontSize:13, fontWeight:600 }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,.5)', letterSpacing:1, textTransform:'uppercase', marginBottom:7 }}>Identifiant</label>
              <input
                value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={onKey}
                placeholder="Votre login"
                autoComplete="username"
                style={inp}
                onFocus={e=>e.target.style.borderColor='rgba(240,165,0,.6)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.14)'}
              />
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'rgba(255,255,255,.5)', letterSpacing:1, textTransform:'uppercase', marginBottom:7 }}>Mot de passe</label>
              <div style={{ position:'relative' }}>
                <input
                  value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={onKey}
                  type={showPwd?'text':'password'} placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ ...inp, paddingRight:48 }}
                  onFocus={e=>e.target.style.borderColor='rgba(240,165,0,.6)'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.14)'}
                />
                <button onClick={()=>setShowPwd(s=>!s)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'rgba(255,255,255,.4)', cursor:'pointer', fontSize:18, padding:0 }}>
                  {showPwd?'🙈':'👁️'}
                </button>
              </div>
            </div>

            <button
              onClick={doLogin} disabled={loading}
              style={{ width:'100%', background: loading?'rgba(240,165,0,.5)':'linear-gradient(135deg,#f0a500,#d09400)', color:'#1a0e00', border:'none', padding:'14px', borderRadius:12, cursor:loading?'wait':'pointer', fontSize:15, fontWeight:900, fontFamily:'inherit', marginTop:6, letterSpacing:'.5px', boxShadow: loading?'none':'0 8px 24px rgba(240,165,0,.35)', transition:'all .2s' }}>
              {loading ? '⏳ Connexion...' : 'SE CONNECTER →'}
            </button>

            <button onClick={()=>setForgot(true)} style={{ background:'none', border:'none', color:'rgba(255,255,255,.35)', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:4, textAlign:'center', textDecoration:'underline', padding:0 }}>
              Mot de passe oublié ?
            </button>
          </div>

          <div style={{ marginTop:40, paddingTop:24, borderTop:'1px solid rgba(255,255,255,.08)', display:'flex', justifyContent:'center', gap:16 }}>
            {['🏭 Roxgold Mining','🌍 Côte d'Ivoire','🔒 Sécurisé'].map(t=>(
              <span key={t} style={{ fontSize:11, color:'rgba(255,255,255,.2)', fontWeight:500 }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive: cacher le panel gauche sur mobile */}
      <style>{`
        @media (max-width: 768px) {
          #login-left { display: none !important; }
        }
      `}</style>

      {forgot && <ForgotModal onClose={()=>setForgot(false)}/>}
    </div>
  )
}
