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
      {/* Responsive: sur mobile = colonne, desktop = 2 colonnes */}
      <style>{`
        @media (max-width:768px) {
          .login-brand { display: none !important; }
          .login-form-panel {
            flex: 1 !important;
            padding: 24px 20px !important;
            justify-content: flex-start !important;
          }
          .login-mobile-header {
            display: flex !important;
          }
        }
        @media (min-width:769px) {
          .login-mobile-header { display: none !important; }
        }
      `}</style>

      {/* En-tête mobile uniquement */}
      <div className="login-mobile-header" style={{
        display:'none', position:'fixed', top:0, left:0, right:0, zIndex:100,
        background:'linear-gradient(135deg,#060d1f,#0c1a38)',
        padding:'12px 20px', alignItems:'center', gap:12,
        borderBottom:'1px solid rgba(240,165,0,.2)',
      }}>
        <div style={{width:36,height:36,background:'#fff',borderRadius:8,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <img src="/roxgold-logo.png" alt="" style={{width:'100%',height:'100%',objectFit:'contain',padding:3}}/>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:800,color:'#fff',letterSpacing:1}}>RZI CAMP ERP</div>
          <div style={{fontSize:10,color:'#f0a500',fontWeight:600}}>ROXGOLD · SANGO</div>
        </div>
      </div>

      {/* Panel gauche - branding desktop */}
      <div className="login-brand" style={{
        flex:'0 0 50%', display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center',
        background:'linear-gradient(145deg, #060d1f 0%, #0c1a38 40%, #0f2447 100%)',
        position:'relative', overflow:'hidden', padding:40,
      }}>
        <div style={{ position:'absolute', inset:0, opacity:.07,
          backgroundImage:'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
          backgroundSize:'40px 40px' }}/>
        <div style={{ position:'absolute', top:-100, right:-100, width:420, height:400,
          borderRadius:'50%', background:'radial-gradient(circle, rgba(240,165,0,.15) 0%, transparent 70%)' }}/>
        <div style={{ position:'absolute', bottom:-80, left:-80, width:320, height:300,
          borderRadius:'50%', background:'radial-gradient(circle, rgba(37,99,235,.2) 0%, transparent 70%)' }}/>
        <div style={{ position:'relative', textAlign:'center', maxWidth:400 }}>
          <div style={{ height:90, margin:'0 auto 28px', borderRadius:18,
            background:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 16px 48px rgba(240,165,0,.5)', border:'3px solid #f0a500', padding:8 }}>
            <img src="/roxgold-logo.png" alt="Roxgold Sango" style={{height:'100%',objectFit:'contain'}}/>
          </div>
          <div style={{ fontSize:11, letterSpacing:4, color:'#f0a500', fontWeight:700,
            textTransform:'uppercase', marginBottom:12 }}>
            ROXGOLD · SANGO MINE - CÔTE D'IVOIRE
          </div>
          <div style={{ fontSize:28, fontWeight:900, color:'#fff', lineHeight:1.2, marginBottom:16 }}>
            RZI Camp ERP
          </div>
          <div style={{ fontSize:14, color:'rgba(255,255,255,.6)', lineHeight:1.7 }}>
            Gestion intégrée de la résidence<br/>
            minière Roxgold Sango
          </div>
          <div style={{ marginTop:32, display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
            {['🏠 Résidences','👤 Personnel','🎓 Induction','🛠️ Maintenance'].map(f=>(
              <span key={f} style={{ fontSize:12, color:'rgba(255,255,255,.5)',
                background:'rgba(255,255,255,.07)', padding:'6px 12px', borderRadius:20 }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Panel droit - formulaire */}
      <div className="login-form-panel" style={{
        flex:'0 0 50%', display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center',
        background:'#080f20', padding:'40px 32px',
        overflowY:'auto',
        paddingTop: 80, // espace pour header mobile
      }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <div style={{ marginBottom:32, textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#fff', marginBottom:6 }}>
              Connexion
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.45)' }}>
              Bienvenue — entrez vos identifiants
            </div>
          </div>

          {error && (
            <div style={{ background:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.3)',
              borderRadius:10, padding:'12px 16px', marginBottom:20,
              fontSize:13, color:'#fca5a5', fontWeight:600 }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700,
                color:'rgba(255,255,255,.5)', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>
                Identifiant
              </label>
              <input
                value={username} onChange={e=>setUsername(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&handleLogin()}
                placeholder="Votre identifiant"
                autoComplete="username"
                style={{ width:'100%', background:'rgba(255,255,255,.06)',
                  border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10,
                  padding:'13px 16px', fontSize:14, color:'#fff', outline:'none',
                  boxSizing:'border-box', transition:'border-color .2s',
                }}
                onFocus={e=>e.target.style.borderColor='#f0a500'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'}
              />
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700,
                color:'rgba(255,255,255,.5)', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>
                Mot de passe
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password} onChange={e=>setPassword(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleLogin()}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ width:'100%', background:'rgba(255,255,255,.06)',
                    border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10,
                    padding:'13px 48px 13px 16px', fontSize:14, color:'#fff', outline:'none',
                    boxSizing:'border-box', transition:'border-color .2s',
                  }}
                  onFocus={e=>e.target.style.borderColor='#f0a500'}
                  onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.12)'}
                />
                <button type="button" onClick={()=>setShowPwd(p=>!p)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                    background:'none', border:'none', color:'rgba(255,255,255,.4)',
                    cursor:'pointer', fontSize:18, padding:4 }}>
                  {showPwd ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading}
              style={{ width:'100%', background: loading ? 'rgba(240,165,0,.5)' : '#f0a500',
                color:'#000', border:'none', borderRadius:10, padding:14,
                fontSize:15, fontWeight:800, cursor: loading ? 'not-allowed' : 'pointer',
                transition:'all .2s', marginTop:4,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(240,165,0,.3)',
              }}>
              {loading ? '⏳ Connexion...' : 'Se connecter →'}
            </button>

            <button type="button" onClick={()=>setShowForgot(true)}
              style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)',
                cursor:'pointer', fontSize:12, padding:'4px 0', textDecoration:'underline' }}>
              Mot de passe oublié ?
            </button>
          </div>

          <div style={{ marginTop:32, textAlign:'center', fontSize:11,
            color:'rgba(255,255,255,.25)', lineHeight:1.8 }}>
            RZI Camp ERP · Roxgold Mining Sango<br/>
            © {new Date().getFullYear()} — Usage interne uniquement
          </div>
        </div>
      </div>

      {showForgot && <ForgotModal onClose={()=>setShowForgot(false)}/>}
    </div>
  )
}