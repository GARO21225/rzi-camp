/**
 * LOGIN — Authentification + Mot de passe oublié
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { auth } from '../api'

// ── Composant: Reset mot de passe ─────────────────────
function ForgotModal({ onClose }) {
  const [step,    setStep]    = useState('request')
  const [username, setUsername] = useState('')
  const [token,   setToken]   = useState('')
  const [newPwd,  setNewPwd]  = useState('')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState(null)

  const apiCall = async (path, data) => {
    const baseUrl = window.__API_BASE__ || import.meta.env.VITE_API_URL || ''
    const r = await fetch(`${baseUrl}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return r.json()
  }

  const requestReset = async () => {
    if (!username.trim()) return setMsg({ type:'error', text:'Saisissez votre identifiant' })
    setLoading(true); setMsg(null)
    try {
      const r = await apiCall('/forgot-password/', { username: username.trim() })
      if (r.token) {
        // Email non configuré → afficher le token pour l'admin
        setToken(r.token)
        setMsg({
          type: 'info',
          text: `✅ Token généré. Copiez-le ci-dessous et transmettez-le à l'utilisateur par tout moyen (SMS, WhatsApp…).`
        })
      } else if (r.message) {
        setMsg({ type:'success', text: `📧 ${r.message}` })
      } else if (r.error) {
        setMsg({ type:'error', text: r.error })
        return
      }
      setStep('confirm')
    } catch { setMsg({ type:'error', text:'Erreur réseau' }) }
    finally { setLoading(false) }
  }

  const confirmReset = async () => {
    if (!token.trim() || !newPwd) return setMsg({ type:'error', text:'Token et nouveau mot de passe requis' })
    if (newPwd.length < 6) return setMsg({ type:'error', text:'Minimum 6 caractères' })
    setLoading(true); setMsg(null)
    try {
      const r = await apiCall('/reset-password-confirm/', { token: token.trim(), password: newPwd })
      if (r.message) {
        setMsg({ type:'success', text: `✅ ${r.message}` })
        setTimeout(onClose, 2500)
      } else {
        setMsg({ type:'error', text: r.error || 'Token invalide ou expiré' })
      }
    } catch { setMsg({ type:'error', text:'Erreur réseau' }) }
    finally { setLoading(false) }
  }

  const inp = {
    width: '100%', border: '2px solid #e2e8f0', borderRadius: 10,
    padding: '11px 14px', fontSize: 15, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a'
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:420, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg, #0f2447, #1e3a8a)', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>🔐 Réinitialisation</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>

        <div style={{ padding:20 }}>
          {/* Message */}
          {msg && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, marginBottom: 16,
              fontSize: 13, fontWeight: 600, wordBreak:'break-all',
              background: msg.type==='success'?'#f0fdf4': msg.type==='info'?'#eff6ff':'#fef2f2',
              color:      msg.type==='success'?'#166534': msg.type==='info'?'#1e40af':'#991b1b',
              border:     `1px solid ${msg.type==='success'?'#bbf7d0': msg.type==='info'?'#bfdbfe':'#fecaca'}`,
            }}>
              {msg.text}
            </div>
          )}

          {/* Token affiché si généré sans email */}
          {token && step === 'confirm' && (
            <div style={{ background:'#fef3c7', border:'2px solid #f0a500', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#92400e', marginBottom:6, textTransform:'uppercase' }}>
                🔑 Token de réinitialisation (valide 1h)
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <code style={{ flex:1, fontSize:12, color:'#92400e', wordBreak:'break-all', background:'rgba(255,255,255,.6)', padding:'6px 10px', borderRadius:6 }}>
                  {token}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(token) }}
                  style={{ background:'#f0a500', border:'none', color:'#fff', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, flexShrink:0 }}>
                  📋 Copier
                </button>
              </div>
            </div>
          )}

          {step === 'request' ? (
            <>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:16, lineHeight:1.6 }}>
                Saisissez votre identifiant de connexion. Un token de réinitialisation sera généré.
              </p>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                  Identifiant
                </label>
                <input value={username} onChange={e=>setUsername(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&requestReset()}
                  placeholder="votre_login" style={inp} />
              </div>
              <button onClick={requestReset} disabled={loading || !username.trim()}
                style={{ width:'100%', background:loading?'#94a3b8':'#1e3a8a', color:'#fff', border:'none', padding:13, borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700 }}>
                {loading ? '⏳ Génération...' : '🔑 Générer le token'}
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                  Token reçu
                </label>
                <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Collez le token ici..." style={inp} />
              </div>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                  Nouveau mot de passe
                </label>
                <input type="password" value={newPwd} onChange={e=>setNewPwd(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&confirmReset()}
                  placeholder="6 caractères minimum" style={inp} />
              </div>
              <button onClick={confirmReset} disabled={loading}
                style={{ width:'100%', background:loading?'#94a3b8':'#1e3a8a', color:'#fff', border:'none', padding:13, borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700, marginBottom:10 }}>
                {loading ? '⏳...' : '✅ Réinitialiser le mot de passe'}
              </button>
              <button onClick={()=>setStep('request')}
                style={{ width:'100%', background:'none', border:'none', color:'#2563eb', cursor:'pointer', fontSize:13, textDecoration:'underline' }}>
                ← Retour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Composant principal Login ──────────────────────────
export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const { setUser, setToken } = useStore()
  const navigate = useNavigate()

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

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f2447 0%, #1e3a8a 50%, #1e3a8a 100%)',
      padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Décorations */}
      <div style={{ position:'absolute', top:-100, left:-100, width:400, height:400, background:'rgba(255,255,255,.03)', borderRadius:'50%' }} />
      <div style={{ position:'absolute', bottom:-80, right:-80, width:300, height:300, background:'rgba(240,165,0,.06)', borderRadius:'50%' }} />

      <div style={{ width:'100%', maxWidth:380, position:'relative' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'rgba(255,255,255,.12)', display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:16, border:'2px solid rgba(255,255,255,.2)' }}>
            <img src="/roxgold-logo.png" alt="Roxgold" style={{ width:50, height:50, objectFit:'contain' }}
              onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='🏕️' }} />
          </div>
          <div style={{ color:'rgba(255,255,255,.9)', fontSize:18, fontWeight:800, letterSpacing:-.3 }}>Résidence Roxgold Sango</div>
          <div style={{ color:'rgba(255,255,255,.45)', fontSize:12, marginTop:4, letterSpacing:1 }}>ERP de Gestion de Camp · Connexion</div>
        </div>

        {/* Formulaire */}
        <div style={{ background:'#fff', borderRadius:20, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,.35)' }}>
          {error && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#991b1b', fontWeight:600 }}>
              ❌ {error}
            </div>
          )}

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>
              Identifiant
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key==='Enter' && doLogin()}
              placeholder="votre_login"
              autoComplete="username"
              style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:10, padding:'11px 14px', fontSize:15, outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s' }}
              onFocus={e => e.target.style.borderColor='#2563eb'}
              onBlur={e => e.target.style.borderColor='#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>
              Mot de passe
            </label>
            <div style={{ position:'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key==='Enter' && doLogin()}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:10, padding:'11px 44px 11px 14px', fontSize:15, outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s' }}
                onFocus={e => e.target.style.borderColor='#2563eb'}
                onBlur={e => e.target.style.borderColor='#e2e8f0'}
              />
              <button type="button" onClick={() => setShowPwd(s=>!s)}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#94a3b8' }}>
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button onClick={doLogin} disabled={loading || !username || !password}
            style={{ width:'100%', background:loading?'#94a3b8':'linear-gradient(135deg, #1e3a8a, #2563eb)', color:'#fff', border:'none', padding:'13px', borderRadius:12, cursor:loading?'not-allowed':'pointer', fontSize:15, fontWeight:700, marginBottom:14, boxShadow:loading?'none':'0 4px 15px rgba(30,58,138,.4)', transition:'all .15s' }}>
            {loading ? '⏳ Connexion en cours…' : '→ Se connecter'}
          </button>

          <div style={{ textAlign:'center' }}>
            <button onClick={() => setShowForgot(true)}
              style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:12.5, textDecoration:'underline', textDecorationColor:'rgba(100,116,139,.4)' }}>
              Mot de passe oublié ?
            </button>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:20, color:'rgba(255,255,255,.35)', fontSize:11 }}>
          © 2026 Roxgold Sango · ERP GIS v7
        </div>
      </div>

      {showForgot && <ForgotModal onClose={() => setShowForgot(false)} />}
    </div>
  )
}
