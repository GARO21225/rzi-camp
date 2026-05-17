
// ── Composant: Modal mot de passe oublié ─────────────
function ForgotModal({ onClose }) {
  const [step,    setStep]    = useState('request')  // request | confirm
  const [username, setUsername] = useState('')
  const [token,   setToken]   = useState('')
  const [newPwd,  setNewPwd]  = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [msg,     setMsg]     = useState(null)
  const api = (path, data) => fetch(`${window.__API_BASE__ || ''}/api${path}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
  }).then(r => r.json())

  const requestReset = async () => {
    if (!username) return setMsg({type:'error', text:'Saisissez votre identifiant'})
    setLoading(true); setMsg(null)
    try {
      const r = await api('/forgot-password/', { username })
      if (r.token) {
        // Pas d'email configuré → afficher le token pour l'admin
        setMsg({ type:'info', text: `Token de reset : ${r.token} (transmettez-le à l'utilisateur)` })
        setToken(r.token)
        setStep('confirm')
      } else {
        setMsg({ type:'success', text: r.message || 'Email envoyé si le compte existe.' })
        setStep('confirm')
      }
    } catch { setMsg({type:'error', text:'Erreur de connexion'}) }
    finally { setLoading(false) }
  }

  const confirmReset = async () => {
    if (!token || !newPwd) return setMsg({type:'error', text:'Token et nouveau mot de passe requis'})
    if (newPwd.length < 6) return setMsg({type:'error', text:'Minimum 6 caractères'})
    setLoading(true); setMsg(null)
    try {
      const r = await api('/reset-password-confirm/', { token, password: newPwd })
      if (r.message) {
        setMsg({ type:'success', text: r.message })
        setTimeout(onClose, 2500)
      } else {
        setMsg({ type:'error', text: r.error || 'Erreur' })
      }
    } catch { setMsg({type:'error', text:'Erreur'}) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:400, overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ background:'#1e3a8a', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>🔐 Mot de passe oublié</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:20 }}>
          {msg && (
            <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:13, fontWeight:600,
              background: msg.type==='success'?'#f0fdf4': msg.type==='info'?'#eff6ff':'#fef2f2',
              color:      msg.type==='success'?'#166534': msg.type==='info'?'#1e40af':'#991b1b',
              border:     `1px solid ${msg.type==='success'?'#bbf7d0': msg.type==='info'?'#bfdbfe':'#fecaca'}`,
              wordBreak:'break-all'
            }}>
              {msg.text}
            </div>
          )}

          {step === 'request' ? (
            <>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
                Saisissez votre identifiant de connexion. Un lien de réinitialisation vous sera envoyé.
              </p>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
                  Identifiant
                </label>
                <input value={username} onChange={e=>setUsername(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&requestReset()}
                  placeholder="votre_login"
                  style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:10, padding:'11px 14px', fontSize:15, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }} />
              </div>
              <button onClick={requestReset} disabled={loading}
                style={{ width:'100%', background:loading?'#94a3b8':'#1e3a8a', color:'#fff', border:'none', padding:13, borderRadius:10, cursor:loading?'wait':'pointer', fontSize:14, fontWeight:700 }}>
                {loading ? '⏳ Envoi...' : '📨 Envoyer le lien'}
              </button>
              {showForgot && <ForgotModal onClose={() => setShowForgot(false)} />}
    </>
          ) : (
            <>
              <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
                Saisissez le token reçu et votre nouveau mot de passe.
              </p>
              {[
                ['Token de réinitialisation', token, setToken, 'text', 'token reçu par email...'],
                ['Nouveau mot de passe', newPwd, setNewPwd, 'password', '6 caractères minimum'],
              ].map(([label, val, setter, type, ph]) => (
                <div key={label} style={{ marginBottom:14 }}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>{label}</label>
                  <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                    onKeyDown={e=>e.key==='Enter'&&confirmReset()}
                    style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:10, padding:'11px 14px', fontSize:15, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }} />
                </div>
              ))}
              <button onClick={confirmReset} disabled={loading}
                style={{ width:'100%', background:loading?'#94a3b8':'#1e3a8a', color:'#fff', border:'none', padding:13, borderRadius:10, cursor:loading?'wait':'pointer', fontSize:14, fontWeight:700 }}>
                {loading ? '⏳...' : '🔐 Réinitialiser'}
              </button>
              <button onClick={()=>setStep('request')}
                style={{ width:'100%', background:'none', color:'#2563eb', border:'none', cursor:'pointer', fontSize:13, marginTop:10, textDecoration:'underline' }}>
                ← Retour
              </button>
              {showForgot && <ForgotModal onClose={() => setShowForgot(false)} />}
    </>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { auth } from '../api'

const PROFILES = [
  { label:'Admin',      user:'admin',      pass:'admin123',  color:'#1e3a8a', icon:'👑' },
  { label:'Agent',      user:'agent',      pass:'agent123',  color:'#16a34a', icon:'🏗️' },
  { label:'Restaurant', user:'resto',      pass:'resto123',  color:'#7c3aed', icon:'🍽️' },
  { label:'Technicien', user:'technicien', pass:'tech123',   color:'#ea580c', icon:'🔧' },
  { label:'Ménage',   user:'menage',     pass:'menage123', color:'#be185d', icon:'🧹' },
]

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [error, setError] = useState('')
  const { setToken, setUser } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isInactivity = params.get('reason') === 'inactivity'

  const doLogin = async (u = username, p = password) => {
    if (!u) return setError('Identifiant requis')
    setLoading(true); setError('')
    try {
      const r = await auth.login(u, p)
      setToken(r.data.access)
      localStorage.setItem('refresh_token', r.data.refresh)
      const me = await auth.me()
      setUser(me.data)
      // Marquer qu'on vient de se connecter pour afficher le toast
      sessionStorage.setItem('just_logged_in', '1')
      navigate('/')
    } catch { setError('Identifiants incorrects') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#ffffff',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
      }}>
        {/* Logo centré */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/roxgold-logo.png" alt="Roxgold" style={{ height: 48, marginBottom: 8 }} />
          <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1 }}>RÉSIDENCE ROXGOLD SANGO</div>
        </div>

        {/* Formulaire — fond bleu ciel léger */}
        <div style={{
          background: '#e0f7ff',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 4px 20px rgba(14, 165, 233, 0.15)',
          border: '1px solid #bae6fd',
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 20px', textAlign: 'center' }}>
            Connexion
          </h1>

          {isInactivity && (
            <div style={{
              background: '#fef3c7',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: '#b45309',
              marginBottom: 14,
              textAlign: 'center',
            }}>
              ⏱️ Session expirée — Veuillez vous reconnecter
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>Identifiant</label>
            <input
              value={username}
              onChange={e=>setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Entrez votre identifiant"
              style={{
                width: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 14,
                outline: 'none',
                color: '#1e293b',
                background: '#f8fafc',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 }}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&doLogin()}
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: '100%',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 14,
                outline: 'none',
                color: '#1e293b',
                background: '#f8fafc',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={()=>doLogin()}
            disabled={loading}
            style={{
              width: '100%',
              background: '#1e3a8a',
              color: '#fff',
              border: 'none',
              padding: 14,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: '.2s',
            }}>
            {loading ? '⏳ Connexion...' : '→ Se connecter'}
          </button>

          {error && (
            <div style={{
              background: '#fef2f2',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: '#dc2626',
              marginTop: 12,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Accès rapide */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 10 }}>
            Accès rapide (démo)
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {PROFILES.map(p => (
              <button
                key={p.label}
                onClick={()=>doLogin(p.user, p.pass)}
                style={{
                  background: '#fff',
                  border: `1px solid ${p.color}30`,
                  color: p.color,
                  padding: '8px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}