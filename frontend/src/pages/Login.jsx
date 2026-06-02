import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { auth } from '../api'
import { Eye, EyeOff, LogIn, Lock, User, Globe2 } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { setUser, setToken } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const handleLogin = async () => {
    if (!username || !password) return setError('Identifiant et mot de passe requis')
    setLoading(true)
    setError('')
    try {
      const r = await auth.login(username.trim(), password)
      setToken(r.access)
      localStorage.setItem('refresh_token', r.refresh)
      const me = await auth.me()
      setUser(me.data)
      sessionStorage.setItem('just_logged_in', '1')
      navigate('/')
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.non_field_errors?.[0] || 'Identifiant ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Brand panel — left */}
      <div className="login-brand">
        <div className="login-brand-bg">
          <div className="login-brand-content">
            <img src="/roxgold-logo.png" alt="Roxgold" className="brand-mark-lg" />
            <h1 className="font-display" style={{ fontSize: 42, lineHeight: 1.1, color: 'white', marginTop: 24, letterSpacing: '-0.02em' }}>
              RZI <span style={{ color: 'var(--gold-400)' }}>Camp</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 15, marginTop: 12, maxWidth: 360, lineHeight: 1.6 }}>
              ERP Industriel pour Roxgold · Côte d'Ivoire<br />
              Jumeau numérique · Maintenance prédictive · QR anti-fraude
            </p>

            <div className="brand-features">
              {[
                { icon: '🛰️', label: '204 bâtiments en temps réel' },
                { icon: '🤖', label: 'Copilote IA proactif' },
                { icon: '🔒', label: 'Conformité ISO 27001' },
                { icon: '📡', label: 'Multi-capteurs IoT' },
              ].map((f) => (
                <div key={f.label} className="brand-feature">
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form panel — right */}
      <div className="login-form">
        <div className="login-form-inner">
          <div className="login-mobile-header">
            <img src="/roxgold-logo.png" alt="Roxgold" className="brand-img-sm" />
            <div className="brand-name">RZI CAMP</div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Connexion
            </h2>
            <p style={{ color: 'var(--text-3)', fontSize: 14, marginTop: 6 }}>
              Bienvenue — entrez vos identifiants
            </p>
          </div>

          {error && (
            <div className="login-error">❌ {error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="login-label">Identifiant</label>
              <div className="login-input-wrap">
                <User size={16} />
                <input
                  className="input"
                  style={{ paddingLeft: 38 }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Votre identifiant"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="login-label">Mot de passe</label>
              <div className="login-input-wrap">
                <Lock size={16} />
                <input
                  className="input"
                  style={{ paddingLeft: 38, paddingRight: 40 }}
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button className="login-eye" type="button" onClick={() => setShowPwd(!showPwd)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', height: 46, fontSize: 15, marginTop: 4 }}
            >
              {loading ? <span className="anim-spin">⏳</span> : <LogIn size={16} />}
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" /> Rester connecté
              </label>
              <a href="#" style={{ color: 'var(--copper-600)', textDecoration: 'none', fontWeight: 600 }}>
                Mot de passe oublié ?
              </a>
            </div>
          </div>

          <div style={{ marginTop: 32, padding: 14, background: 'var(--bg-2)', borderRadius: 12, fontSize: 12, color: 'var(--text-3)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>🔑 Comptes démo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div><span className="font-mono">admin</span> / admin123</div>
              <div><span className="font-mono">manager</span> / manager123</div>
              <div><span className="font-mono">agent</span> / agent123</div>
              <div><span className="font-mono">resto</span> / resto123</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .login-page { min-height: 100dvh; display: grid; grid-template-columns: 1.1fr 1fr; }
        .login-brand { position: relative; overflow: hidden; }
        .login-brand-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(circle at 20% 30%, rgba(255,205,0,.15), transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(12,78,162,.4), transparent 50%),
            linear-gradient(135deg, var(--ink-900), var(--copper-700));
        }
        .login-brand-content {
          position: relative; height: 100%;
          display: flex; flex-direction: column; justify-content: center;
          padding: 60px;
        }
        .brand-mark-lg {
          width: 72px; height: 72px;
          background: white;
          border-radius: 18px;
          display: grid; place-items: center;
          padding: 10px;
          box-shadow: 0 10px 40px rgba(0,0,0,.3);
          object-fit: contain;
        }
        .brand-img-sm {
          width: 32px; height: 32px;
          background: white;
          border-radius: 6px;
          padding: 3px;
          object-fit: contain;
        }
        .brand-features { display: flex; flex-direction: column; gap: 12px; margin-top: 36px; }
        .brand-feature {
          display: flex; align-items: center; gap: 12px;
          color: rgba(255,255,255,.85);
          font-size: 14px;
          padding: 10px 14px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          width: fit-content;
        }
        .login-form {
          display: flex; align-items: center; justify-content: center;
          padding: 40px;
          background: var(--bg);
        }
        .login-form-inner { width: 100%; max-width: 420px; }
        .login-mobile-header { display: none; align-items: center; gap: 12px; margin-bottom: 24px; }
        .login-mobile-header .brand-name { color: var(--text); font-weight: 700; font-size: 16px; }
        .login-label { display: block; font-size: 11px; font-weight: 700; color: var(--text-3); margin-bottom: 6px; letter-spacing: .08em; text-transform: uppercase; }
        .login-input-wrap { position: relative; }
        .login-input-wrap > svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-3); }
        .login-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-3); cursor: pointer; padding: 6px; border-radius: 6px; }
        .login-eye:hover { background: var(--bg-2); color: var(--text); }
        .login-error {
          background: #fee2e2; border: 1px solid #fca5a5; color: #b91c1c;
          padding: 12px 14px; border-radius: 10px; margin-bottom: 20px;
          font-size: 13px; font-weight: 600;
        }
        [data-theme="dark"] .login-error { background: rgba(220,38,38,.15); color: #fca5a5; border-color: rgba(220,38,38,.3); }
        @media (max-width: 900px) {
          .login-page { grid-template-columns: 1fr; }
          .login-brand { display: none; }
          .login-mobile-header { display: flex; }
        }
      `}</style>
    </div>
  )
}
