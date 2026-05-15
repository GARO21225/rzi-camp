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
            {loading ? 'Connexion...' : 'Se connecter'}
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