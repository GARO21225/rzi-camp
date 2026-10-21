import React, { useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { auth } from '../api'
import { useAppName } from '../hooks/useAppName'
import ChoixLangue from '../components/ChoixLangue'

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
      if (r.message) setMsg({ type:'success', text: r.message })
      else if (r.error) { setMsg({ type:'error', text: r.error }); return }
      setStep('confirm')
    } catch { setMsg({ type:'error', text:'Erreur réseau' }) }
    finally { setLoading(false) }
  }

  const confirmReset = async () => {
    if (!token.trim() || !newPwd) return setMsg({ type:'error', text:'Code et mot de passe requis' })
    if (newPwd.length < 6) return setMsg({ type:'error', text:'Minimum 6 caractères' })
    setLoading(true); setMsg(null)
    try {
      const r = await apiCall('/reset-password-confirm/', { token: token.trim(), password: newPwd })
      if (r.message) { setMsg({ type:'success', text: r.message }); setTimeout(onClose, 2500) }
      else setMsg({ type:'error', text: r.error || 'Code invalide' })
    } catch { setMsg({ type:'error', text:'Erreur réseau' }) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(5,15,35,.85)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
      <div style={{ background:'#0d1b2e', border:'1px solid rgba(240,165,0,.3)', borderRadius:20, width:'100%', maxWidth:420, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.6)' }}>
        <div style={{ background:'linear-gradient(135deg,#0f2447,#1a3560)', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(240,165,0,.2)' }}>
          <span style={{ color:'#f0a500', fontWeight:800, fontSize:15, letterSpacing:'.5px' }}>🔐 RÉINITIALISATION</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', color:'var(--rzc-text-4)', width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          {msg && <div style={{ padding:'10px 14px', borderRadius:10, fontSize:13, fontWeight:600, background: msg.type==='error'?'rgba(220,38,38,.15)':msg.type==='success'?'rgba(22,163,74,.15)':'rgba(37,99,235,.15)', color: msg.type==='error'?'#fca5a5':msg.type==='success'?'#86efac':'#93c5fd', border:`1px solid ${msg.type==='error'?'rgba(220,38,38,.3)':msg.type==='success'?'rgba(22,163,74,.3)':'rgba(37,99,235,.3)'}` }}>{msg.text}</div>}
          {step === 'request' ? <>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Identifiant de connexion" className="lg-input" style={{ background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none', color:'var(--rzc-white)', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }}/>
            <button onClick={requestReset} disabled={loading} style={{ background:'linear-gradient(135deg,#f0a500,#d09400)', color:'#1a0e00', border:'none', padding:'12px', borderRadius:10, cursor:loading?'wait':'pointer', fontSize:14, fontWeight:800, fontFamily:'inherit' }}>{loading?'⏳ Envoi...':'Recevoir le code par email'}</button>
          </> : <>
            <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Code reçu par email" autoCapitalize="characters" className="lg-input" style={{ background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none', color:'var(--rzc-white)', fontFamily:'monospace', width:'100%', boxSizing:'border-box' }}/>
            <input value={newPwd} onChange={e=>setNewPwd(e.target.value)} type="password" placeholder="Nouveau mot de passe (min. 6 car.)" className="lg-input" style={{ background:'rgba(255,255,255,.06)', border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10, padding:'11px 14px', fontSize:14, outline:'none', color:'var(--rzc-white)', fontFamily:'inherit', width:'100%', boxSizing:'border-box' }}/>
            <button onClick={confirmReset} disabled={loading} style={{ background:'linear-gradient(135deg,#16a34a,#15803d)', color:'var(--rzc-white)', border:'none', padding:'12px', borderRadius:10, cursor:loading?'wait':'pointer', fontSize:14, fontWeight:800, fontFamily:'inherit' }}>{loading?'⏳ Confirmation...':'Confirmer la réinitialisation'}</button>
          </>}
        </div>
      </div>
    </div>
  )
}

/** Fond « filon d'or » : courbes de niveau tracées une à une + deux halos qui dérivent. */
function LoginFond() {
  const gid = 'lgFilon' + useId().replace(/:/g, '')   // id unique : la copie cachée (display:none) casserait sinon la référence du dégradé
  return (
    <div aria-hidden="true" style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
      <span className="lg-orbe lg-orbe-a"/>
      <span className="lg-orbe lg-orbe-b"/>
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" className="lg-derive"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.5 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0a500" stopOpacity=".05"/>
            <stop offset=".55" stopColor="#f0a500" stopOpacity=".55"/>
            <stop offset="1" stopColor="#f0a500" stopOpacity=".08"/>
          </linearGradient>
        </defs>
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} pathLength="1" className="lg-trace" style={{ '--i': i }} fill="none" stroke={`url(#${gid})`} strokeWidth={i === 4 ? 1.6 : .8}
            d={`M -40 ${40 + i * 26} C 60 ${10 + i * 24}, 140 ${90 + i * 22}, 230 ${50 + i * 25} S 380 ${20 + i * 27}, 460 ${70 + i * 23}`}/>
        ))}
      </svg>
    </div>
  )
}

/** Logo dans sa carte : anneaux dorés qui pulsent, légère flottaison. */
function LogoAnime({ taille }) {
  return (
    <div className="lg-logo-wrap" style={{ position:'relative', width:taille, height:taille, margin:'0 auto' }}>
      <span className="lg-anneau"/><span className="lg-anneau" style={{ animationDelay:'1.2s' }}/>
      <div className="lg-logo" style={{ position:'relative', width:'100%', height:'100%', borderRadius:Math.round(taille*.2),
        background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', padding:8, boxSizing:'border-box',
        boxShadow:'0 16px 48px rgba(240,165,0,.45)', border:'3px solid #f0a500' }}>
        <img src="/roxgold-logo.png" alt="Roxgold Sango" style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
      </div>
    </div>
  )
}

/** Texte révélé lettre par lettre (par mots, pour que les retours à la ligne restent naturels). */
function Lettres({ texte, debut = 0 }) {
  let n = 0
  return (
    <>
      {String(texte).split(' ').map((mot, w, tous) => (
        <React.Fragment key={w}>
          <span className="lg-mot">
            {Array.from(mot).map((c, k) => <span key={k} className="lg-lettre" style={{ '--i': debut + n++ }}>{c}</span>)}
          </span>{w < tous.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </>
  )
}

export default function Login() {
  const nomApp = useAppName()
  const navigate   = useNavigate()
  const { setUser, setToken } = useStore()
  const [mode, setMode] = useState('password') // 'password' | 'otp'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [forgot,   setForgot]   = useState(false)
  const [otpStep, setOtpStep] = useState('telephone') // 'telephone' | 'code'
  const [telephone, setTelephone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [otpMessage, setOtpMessage] = useState('') // message exact renvoyé par le backend (canal-aware : SMS/WhatsApp/Email)

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

  const doDemanderOtp = async () => {
    if (!telephone.trim()) return setError('Numéro de téléphone requis')
    setLoading(true); setError(''); setInfoMsg('')
    try {
      const r = await auth.demanderOtp(telephone.trim())
      setOtpStep('code')
      setOtpMessage(r.data?.message || `Code envoyé au ${telephone.trim()}.`)
      if (r.data?.code_test) setInfoMsg(`🧪 Mode test — code : ${r.data.code_test}`)
    } catch(e) {
      setError(e.response?.data?.error || "Impossible d'envoyer le code")
    } finally { setLoading(false) }
  }

  const doVerifierOtp = async () => {
    if (!otpCode.trim()) return setError('Code requis')
    setLoading(true); setError('')
    try {
      const r = await auth.verifierOtp(telephone.trim(), otpCode.trim())
      setToken(r.data.access)
      localStorage.setItem('refresh_token', r.data.refresh)
      const me = await auth.me()
      setUser(me.data)
      sessionStorage.setItem('just_logged_in', '1')
      navigate('/')
    } catch(e) {
      setError(e.response?.data?.error || 'Code incorrect')
    } finally { setLoading(false) }
  }

  const onKey = e => { if (e.key === 'Enter') doLogin() }

  const inp = {
    width:'100%', background:'rgba(255,255,255,.07)', border:'1.5px solid rgba(255,255,255,.14)',
    borderRadius:12, padding:'13px 16px', fontSize:15, outline:'none', color:'var(--rzc-white)',
    fontFamily:'inherit', boxSizing:'border-box', transition:'border-color .15s',
  }

  return (
    <div style={{
      minHeight:'100dvh', display:'flex', alignItems:'stretch', position:'relative', overflow:'hidden',
      background:'#050f23',
      fontFamily:'"DM Sans", "Inter", system-ui, sans-serif',
    }}>
      {/* Responsive: sur mobile = colonne, desktop = 2 colonnes */}
      <style>{`
        @media (max-width:768px) {
          .login-brand { display: none !important; }
          .login-form-panel {
            flex: 1 !important;
            padding: 28px 20px 24px !important;
            justify-content: flex-start !important;
            background: transparent !important;
            position: relative; z-index: 1;
          }
          .login-mobile-hero { display: block !important; }
          .lg-fond-mobile { display: block !important; }
        }
        @media (min-width:769px) {
          .login-mobile-hero { display: none !important; }
        }
        .lg-fond-mobile { display: none; }
        .lg-orbe { position: absolute; border-radius: 50%; filter: blur(8px); }
        .lg-orbe-a { width: 320px; height: 320px; right: -110px; top: -110px;
          background: radial-gradient(circle, rgba(240,165,0,.28), transparent 70%); animation: lgDerive1 14s ease-in-out infinite alternate; }
        .lg-orbe-b { width: 280px; height: 280px; left: -100px; bottom: -90px;
          background: radial-gradient(circle, rgba(37,99,235,.28), transparent 70%); animation: lgDerive2 17s ease-in-out infinite alternate; }
        @keyframes lgDerive1 { to { transform: translate(-36px, 46px) scale(1.12) } }
        @keyframes lgDerive2 { to { transform: translate(40px, -36px) scale(1.1) } }
        @keyframes lgTrace { to { stroke-dashoffset: 0 } }
        .lg-trace { stroke-dasharray: 1; stroke-dashoffset: 1; animation: lgTrace 1.6s cubic-bezier(.23, 1, .32, 1) calc(var(--i) * 90ms) forwards; }
        @keyframes lgDeriveSvg { from { transform: translateX(0) scale(1.04) } to { transform: translateX(-16px) scale(1.04) } }
        .lg-derive { animation: lgDeriveSvg 22s ease-in-out infinite alternate; }
        /* Logo : entrée, flottaison, anneaux */
        @keyframes lgLogoIn { from { opacity: 0; transform: scale(.82) translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes lgFlotte { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        .lg-logo-wrap { animation: lgFlotte 5.5s ease-in-out 1s infinite; }
        .lg-logo { animation: lgLogoIn .7s cubic-bezier(.23, 1, .32, 1) both; }
        @keyframes lgAnneau { 0% { transform: scale(1); opacity: .55 } 100% { transform: scale(1.7); opacity: 0 } }
        .lg-anneau { position: absolute; inset: 0; border-radius: 22%; border: 2px solid #f0a500; opacity: 0;
          animation: lgAnneau 2.4s cubic-bezier(.23, 1, .32, 1) .6s infinite; }
        /* Titre lettre par lettre */
        .lg-mot { display: inline-block; white-space: nowrap; overflow: hidden; vertical-align: bottom; }
        .lg-lettre { display: inline-block; transform: translateY(110%); animation: lgLettre .6s cubic-bezier(.23, 1, .32, 1) calc(280ms + var(--i) * 30ms) forwards; }
        @keyframes lgLettre { to { transform: translateY(0) } }
        /* Montée en cascade des blocs */
        @keyframes lgMonte { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        .lg-monte { animation: lgMonte .5s cubic-bezier(.23, 1, .32, 1) both; animation-delay: calc(var(--d, 0) * 70ms + 450ms); }
        .lg-echange { animation: lgMonte .28s cubic-bezier(.23, 1, .32, 1) both; }
        /* Champs : halo doré au focus */
        .lg-champ { transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease; }
        .lg-champ:focus { box-shadow: 0 0 0 4px rgba(240,165,0,.16); background-color: rgba(255,255,255,.09) !important; }
        /* Bouton : reflet qui balaie */
        .lg-btn { position: relative; overflow: hidden; transition: background-color .2s ease, box-shadow .2s ease, transform .16s cubic-bezier(.23, 1, .32, 1); }
        .lg-btn:active:not(:disabled) { transform: scale(.97); }
        .lg-btn::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 45%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,.55), transparent);
          transform: translateX(-130%) skewX(-18deg); animation: lgReflet 3.8s cubic-bezier(.23, 1, .32, 1) 1.6s infinite; }
        .lg-btn:disabled::after { animation: none; opacity: 0; }
        @keyframes lgReflet { 0% { transform: translateX(-130%) skewX(-18deg) } 38%, 100% { transform: translateX(330%) skewX(-18deg) } }
        /* Erreur : secousse */
        @keyframes lgSecousse { 0%, 100% { transform: translateX(0) } 20% { transform: translateX(-7px) } 40% { transform: translateX(6px) } 60% { transform: translateX(-4px) } 80% { transform: translateX(2px) } }
        .lg-erreur { animation: lgSecousse .4s cubic-bezier(.23, 1, .32, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .lg-orbe, .lg-derive, .lg-logo-wrap, .lg-anneau, .lg-btn::after, .lg-erreur { animation: none !important }
          .lg-trace { animation: none; stroke-dashoffset: 0 }
          .lg-lettre { animation: none; transform: none }
          .lg-logo, .lg-monte, .lg-echange { animation: lgFondu .3s ease both !important; animation-delay: 0s !important }
        }
        @keyframes lgFondu { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* Fond animé : mobile (le panneau marque, lui, porte le sien sur desktop) */}
      <div className="lg-fond-mobile" style={{ position:'absolute', inset:0 }}><LoginFond/></div>

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
        <LoginFond/>
        <div style={{ position:'relative', textAlign:'center', maxWidth:400 }}>
          <div style={{ marginBottom:28 }}><LogoAnime taille={96}/></div>
          <div className="lg-monte" style={{ '--d':1, fontSize:11, letterSpacing:4, color:'#f0a500', fontWeight:700,
            textTransform:'uppercase', marginBottom:12 }}>
            ROXGOLD · SANGO MINE - CÔTE D'IVOIRE
          </div>
          <div style={{ fontSize:28, fontWeight:900, color:'var(--rzc-white)', lineHeight:1.2, marginBottom:16 }}>
            <Lettres texte={nomApp}/>
          </div>
          <div className="lg-monte" style={{ '--d':3, fontSize:14, color:'rgba(255,255,255,.6)', lineHeight:1.7 }}>
            Gestion intégrée de la résidence<br/>
            minière Roxgold Sango
          </div>
          <div style={{ marginTop:32, display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
            {['🏠 Résidences','👤 Personnel','🎓 Induction','🛠️ Maintenance'].map((f,i)=>(
              <span key={f} className="lg-monte" style={{ '--d':4+i, fontSize:12, color:'rgba(255,255,255,.5)',
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
      }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}><ChoixLangue sombre /></div>
          {/* Hero mobile : remplace le petit bandeau fixe */}
          <div className="login-mobile-hero" style={{ display:'none', textAlign:'center', marginBottom:26 }}>
            <LogoAnime taille={84}/>
            <div className="lg-monte" style={{ '--d':0, fontSize:10.5, letterSpacing:3, color:'#f0a500', fontWeight:700, textTransform:'uppercase', margin:'18px 0 8px' }}>
              ROXGOLD · SANGO
            </div>
            <div style={{ fontSize:25, fontWeight:900, color:'var(--rzc-white)', lineHeight:1.15 }}>
              <Lettres texte={nomApp}/>
            </div>
          </div>
          <div className="lg-monte" style={{ '--d':1, marginBottom:28, textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--rzc-white)', marginBottom:6 }}>
              Connexion
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.45)' }}>
              Bienvenue — entrez vos identifiants
            </div>
          </div>

          {error && (
            <div key={error} className="lg-erreur" role="alert" style={{ background:'rgba(220,38,38,.15)', border:'1px solid rgba(220,38,38,.3)',
              borderRadius:10, padding:'12px 16px', marginBottom:20,
              fontSize:13, color:'#fca5a5', fontWeight:600 }}>
              ❌ {error}
            </div>
          )}

          {infoMsg && (
            <div style={{ background:'rgba(59,130,246,.15)', border:'1px solid rgba(59,130,246,.3)',
              borderRadius:10, padding:'12px 16px', marginBottom:20,
              fontSize:13, color:'#93c5fd', fontWeight:600 }}>
              {infoMsg}
            </div>
          )}

          <div className="lg-monte" style={{ '--d':2, display:'flex', gap:8, marginBottom:20 }}>
            <button type="button" onClick={()=>{setMode('password');setError('');setInfoMsg('')}}
              style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:12, fontWeight:700, background: mode==='password' ? '#f0a500' : 'rgba(255,255,255,.08)',
                color: mode==='password' ? '#000' : 'rgba(255,255,255,.6)' }}>
              🔑 Mot de passe
            </button>
            <button type="button" onClick={()=>{setMode('otp');setError('');setInfoMsg('');setOtpStep('telephone')}}
              style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:12, fontWeight:700, background: mode==='otp' ? '#f0a500' : 'rgba(255,255,255,.08)',
                color: mode==='otp' ? '#000' : 'rgba(255,255,255,.6)' }}>
              📱 Code SMS
            </button>
          </div>

          {mode === 'password' && (
          <div key="pwd" className="lg-monte lg-echange" style={{ '--d':3, display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700,
                color:'rgba(255,255,255,.5)', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>
                Identifiant
              </label>
              <input
                value={username} onChange={e=>setUsername(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&doLogin()}
                placeholder="Votre identifiant"
                autoComplete="username"
                style={{ width:'100%', background:'rgba(255,255,255,.06)',
                  border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10,
                  padding:'13px 16px', fontSize:14, color:'var(--rzc-white)', outline:'none',
                  boxSizing:'border-box', transition:'border-color .2s',
                }}
                className="lg-champ lg-input"
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
                  onKeyDown={e=>e.key==='Enter'&&doLogin()}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ width:'100%', background:'rgba(255,255,255,.06)',
                    border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10,
                    padding:'13px 48px 13px 16px', fontSize:14, color:'var(--rzc-white)', outline:'none',
                    boxSizing:'border-box', transition:'border-color .2s',
                  }}
                  className="lg-champ lg-input"
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

            <button onClick={doLogin} disabled={loading} className="lg-btn"
              style={{ width:'100%', background: loading ? 'rgba(240,165,0,.5)' : '#f0a500',
                color:'#000', border:'none', borderRadius:10, padding:14,
                fontSize:15, fontWeight:800, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop:4,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(240,165,0,.3)',
              }}>
              {loading ? '⏳ Connexion...' : 'Se connecter →'}
            </button>

            <button type="button" onClick={()=>setForgot(true)}
              style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)',
                cursor:'pointer', fontSize:12, padding:'4px 0', textDecoration:'underline' }}>
              Mot de passe oublié ?
            </button>
          </div>
          )}

          {mode === 'otp' && (
          <div key="otp" className="lg-echange" style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {otpStep === 'telephone' ? (
              <>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700,
                    color:'rgba(255,255,255,.5)', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>
                    Numéro de téléphone
                  </label>
                  <input
                    value={telephone} onChange={e=>setTelephone(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&doDemanderOtp()}
                    placeholder="07 00 00 00 00" autoComplete="tel"
                    className="lg-input"
                    style={{ width:'100%', background:'rgba(255,255,255,.06)',
                      border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10,
                      padding:'13px 16px', fontSize:14, color:'var(--rzc-white)', outline:'none',
                      boxSizing:'border-box' }}
                  />
                </div>
                <button onClick={doDemanderOtp} disabled={loading} className="lg-btn"
                  style={{ width:'100%', background: loading ? 'rgba(240,165,0,.5)' : '#f0a500',
                    color:'#000', border:'none', borderRadius:10, padding:14,
                    fontSize:15, fontWeight:800, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? '⏳ Envoi...' : 'Recevoir un code →'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize:12.5, color:'rgba(255,255,255,.6)' }}>
                  {otpMessage || `Code envoyé au ${telephone}.`} <button type="button" onClick={()=>{setOtpStep('telephone');setInfoMsg('');setOtpMessage('')}}
                    style={{background:'none',border:'none',color:'#f0a500',cursor:'pointer',fontSize:12.5,textDecoration:'underline',padding:0}}>Changer de numéro</button>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700,
                    color:'rgba(255,255,255,.5)', marginBottom:8, letterSpacing:1, textTransform:'uppercase' }}>
                    Code reçu
                  </label>
                  <input
                    value={otpCode} onChange={e=>setOtpCode(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&doVerifierOtp()}
                    placeholder="123456" maxLength={6} inputMode="numeric"
                    className="lg-input"
                    style={{ width:'100%', background:'rgba(255,255,255,.06)',
                      border:'1.5px solid rgba(255,255,255,.12)', borderRadius:10,
                      padding:'13px 16px', fontSize:20, letterSpacing:6, textAlign:'center',
                      color:'var(--rzc-white)', outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <button onClick={doVerifierOtp} disabled={loading} className="lg-btn"
                  style={{ width:'100%', background: loading ? 'rgba(240,165,0,.5)' : '#f0a500',
                    color:'#000', border:'none', borderRadius:10, padding:14,
                    fontSize:15, fontWeight:800, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  {loading ? '⏳ Vérification...' : 'Se connecter →'}
                </button>
              </>
            )}
          </div>
          )}

          <div style={{ marginTop:32, textAlign:'center', fontSize:11,
            color:'rgba(255,255,255,.25)', lineHeight:1.8 }}>
            {nomApp} · Roxgold Mining Sango<br/>
            © {new Date().getFullYear()} — Usage interne uniquement
          </div>
        </div>
      </div>

      {forgot && <ForgotModal onClose={()=>setForgot(false)}/>}
    </div>
  )
}