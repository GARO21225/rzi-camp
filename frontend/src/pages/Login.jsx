import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { auth } from '../api'

/* REFONTE: logo migré du base64 inline vers le fichier PNG du design system */

const PROFILES = [
  { label:'Admin',      user:'admin',      pass:'admin123',  color:'#1e3a8a', icon:'👑', desc:'Accès complet' },
  { label:'Agent',      user:'agent',      pass:'agent123',  color:'#16a34a', icon:'🏗️', desc:'Terrain & Demandes' },
  { label:'Restaurant', user:'resto',      pass:'resto123',  color:'#7c3aed', icon:'🍽️', desc:'Scanner QR repas' },
  { label:'Technicien', user:'technicien', pass:'tech123',   color:'#ea580c', icon:'🔧', desc:'Clôture incidents' },
  { label:'Ménagère',   user:'menage',     pass:'menage123', color:'#be185d', icon:'🧹', desc:'Signalement' },
]

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
      navigate('/')
    } catch { setError('Identifiants incorrects') }
    finally { setLoading(false) }
  }

  const inp = {
    width: '100%',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '11px 14px',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    color: 'var(--text)',
    background: 'var(--surface)',
    transition: 'border-color .2s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--rzi-blue) 0%, var(--rzi-blue-light) 60%, #7c3aed 100%)',
      padding: 16,
      overflowY: 'auto',
    }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
      `}</style>

      <div style={{
        background: 'var(--surface)',
        borderRadius: 20,
        padding: '28px 22px',
        width: '100%',
        maxWidth: 440,
        boxShadow: '0 20px 60px rgba(30,58,138,.4)',
        animation: 'fadeIn .4s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src="/roxgold-logo.png" alt="Roxgold Sango" style={{ height: 58, objectFit: 'contain', marginBottom: 10 }} />
          <div style={{
            background: 'linear-gradient(135deg, var(--rzi-blue), var(--rzi-blue-light))',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            letterSpacing: 1,
            display: 'inline-block',
          }}>
            SYSTÈME DE GESTION — RÉSIDENCE ROXGOLD SANGO
          </div>
        </div>

        {isInactivity && (
          <div style={{
            background: 'rgba(234,88,12,.08)',
            border: '1px solid rgba(234,88,12,.25)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            fontSize: 12,
            color: '#ea580c',
            marginBottom: 14,
            textAlign: 'center',
            fontWeight: 600,
          }}>
            ⏱️ Session expirée après 10 min d'inactivité
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--text-dim)', marginBottom: 5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1 }}>Identifiant</label>
          <input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"
            placeholder="Votre identifiant" style={inp}
            onFocus={e=>e.target.style.borderColor='var(--rzi-blue)'}
            onBlur={e=>e.target.style.borderColor='var(--border)'} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--text-dim)', marginBottom: 5, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1 }}>Mot de passe</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&doLogin()} autoComplete="current-password"
            placeholder="••••••••" style={inp}
            onFocus={e=>e.target.style.borderColor='var(--rzi-blue)'}
            onBlur={e=>e.target.style.borderColor='var(--border)'} />
        </div>

        <button onClick={()=>doLogin()} disabled={loading} style={{
          width: '100%',
          background: 'linear-gradient(135deg, var(--rzi-gold), #d08800)',
          color: '#000',
          border: 'none',
          padding: 14,
          borderRadius: 'var(--radius)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(240,165,0,.35)',
          transition: '.2s',
        }}>
          {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
        </button>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12,
            color: '#dc2626',
            marginTop: 10,
            textAlign: 'center',
          }}>
            ❌ {error}
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginBottom: 10, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
            4 GROUPES — ACCÈS RAPIDE
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {PROFILES.map(p => (
              <button key={p.label} onClick={()=>doLogin(p.user, p.pass)}
                style={{
                  background: 'var(--surface-2, #f8fafc)',
                  border: `2px solid ${p.color}20`,
                  color: p.color,
                  padding: '8px 4px',
                  borderRadius: 'var(--radius)',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontWeight: 700,
                  transition: '.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                }}
                onMouseEnter={e=>{e.currentTarget.style.background=`${p.color}12`;e.currentTarget.style.borderColor=p.color}}
                onMouseLeave={e=>{e.currentTarget.style.background='var(--surface-2, #f8fafc)';e.currentTarget.style.borderColor=`${p.color}20`}}>
                <span style={{ fontSize: 22 }}>{p.icon}</span>
                <span>{p.label}</span>
                <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400, textAlign: 'center', lineHeight: 1.2 }}>{p.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
