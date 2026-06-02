import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { password as pwdAPI, personnel as personnelAPI } from '../api'

// ─── Config rôles ────────────────────────────────────────────────
const ROLES = {
  admin:        { icon:'👑', label:'Administrateur',   gradient:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#1e3a8a' },
  agent:        { icon:'🏗️',  label:'Agent Terrain',    gradient:'linear-gradient(135deg,#92400e,#d97706)', color:'#92400e' },
  restauration: { icon:'🍽️', label:'Restaurant',       gradient:'linear-gradient(135deg,#6b21a8,#9333ea)', color:'#6b21a8' },
  technicien:   { icon:'🔧', label:'Technicien',        gradient:'linear-gradient(135deg,#14532d,#16a34a)', color:'#14532d' },
  menage:       { icon:'🧹', label:'Service Ménage',    gradient:'linear-gradient(135deg,#713f12,#ca8a04)', color:'#713f12' },
}

// ─── Indicateur force mot de passe ───────────────────────────────
function calcStrength(pwd) {
  let s = 0
  if (pwd.length >= 6)  s++
  if (pwd.length >= 10) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd))  s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  return s
}
const STRENGTH = [
  null,
  { label:'Très faible', color:'#dc2626', emoji:'😟' },
  { label:'Faible',      color:'#f97316', emoji:'😕' },
  { label:'Moyen',       color:'#eab308', emoji:'😐' },
  { label:'Bon',         color:'#22c55e', emoji:'😊' },
  { label:'Excellent',   color:'#16a34a', emoji:'💪' },
]

// ─── Champ mot de passe avec œil ─────────────────────────────────
function PwdField({ label, value, onChange, onEnter }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:6 }}>
        {label}
      </label>
      <div style={{ position:'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onEnter?.()}
          style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:10, padding:'11px 44px 11px 14px', fontSize:15, outline:'none', fontFamily:'inherit', boxSizing:'border-box', background:'#fff', color:'#1e293b', transition:'border-color .15s' }}
          onFocus={e => e.target.style.borderColor = '#2563eb'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#94a3b8', padding:0, lineHeight:1 }}>
          {show ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────
export default function MonCompte() {
  const { user, logout } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const roleInfo = ROLES[role] || ROLES.agent

  const [tab, setTab]       = useState('profil')
  const [myPerso, setMyPerso] = useState(null)

  // Sécurité
  const [ancien,    setAncien]    = useState('')
  const [nouveau,   setNouveau]   = useState('')
  const [confirmer, setConfirmer] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [msg,       setMsg]       = useState(null)
  const strength = nouveau ? calcStrength(nouveau) : 0
  const strengthInfo = STRENGTH[strength]

  useEffect(() => {
    personnelAPI.monProfil()
      .then(r => setMyPerso(r.data))
      .catch(() => {})
  }, [])

  const submitPwd = async () => {
    if (!ancien)               return setMsg({ type:'error', text:'Saisissez votre ancien mot de passe.' })
    if (nouveau.length < 6)    return setMsg({ type:'error', text:'Le nouveau mot de passe doit faire au moins 6 caractères.' })
    if (nouveau !== confirmer) return setMsg({ type:'error', text:'Les deux mots de passe ne correspondent pas.' })
    setLoading(true); setMsg(null)
    try {
      const r = await pwdAPI.change({
        ancien_mot_de_passe:     ancien,
        nouveau_mot_de_passe:    nouveau,
        confirmer_mot_de_passe:  confirmer,
      })
      setMsg({ type:'success', text: r.data.message || '✅ Mot de passe modifié. Déconnexion dans 3 secondes…' })
      setAncien(''); setNouveau(''); setConfirmer('')
      setTimeout(() => { logout(); window.location.replace('/login') }, 3000)
    } catch(e) {
      setMsg({ type:'error', text: e.response?.data?.error || 'Erreur. Vérifiez votre ancien mot de passe.' })
    } finally { setLoading(false) }
  }

  // ── Styles utilitaires ──
  const pill = (bg, color, text) => (
    <span style={{ display:'inline-block', background:bg, color, padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:700 }}>{text}</span>
  )

  return (
    <div style={{ padding:20, maxWidth:540, margin:'0 auto' }}>

      {/* ══ Carte profil ══════════════════════════════════════════ */}
      <div style={{ background: roleInfo.gradient, borderRadius:20, padding:'28px 24px', marginBottom:20, color:'#fff', position:'relative', overflow:'hidden' }}>
        {/* Décorations */}
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, background:'rgba(255,255,255,.07)', borderRadius:'50%', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, left:-30, width:100, height:100, background:'rgba(255,255,255,.05)', borderRadius:'50%', pointerEvents:'none' }} />

        <div style={{ display:'flex', gap:18, alignItems:'center', position:'relative' }}>
          {/* Avatar rôle */}
          <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0, border:'3px solid rgba(255,255,255,.4)' }}>
            {roleInfo.icon}
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:22, letterSpacing:-.3 }}>{user?.first_name} {user?.last_name}</div>
            <div style={{ opacity:.75, fontSize:13, marginTop:2 }}>@{user?.username}</div>
            <div style={{ marginTop:8 }}>
              {pill('rgba(255,255,255,.25)', '#fff', roleInfo.label)}
            </div>
          </div>
        </div>

        {/* Infos extra personnel */}
        {myPerso && (
          <div style={{ marginTop:18, paddingTop:16, borderTop:'1px solid rgba(255,255,255,.2)', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:10, position:'relative' }}>
            {[
              ['🏢', 'Société',    myPerso.societe],
              ['📞', 'Téléphone',  myPerso.numero],
              ['📧', 'Email',      myPerso.email],
            ].filter(([,,v]) => v).map(([icon, label, value]) => (
              <div key={label}>
                <div style={{ fontSize:10, opacity:.6, textTransform:'uppercase', letterSpacing:1, marginBottom:2 }}>{icon} {label}</div>
                <div style={{ fontSize:12, fontWeight:600 }}>{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ Tabs ══════════════════════════════════════════════════ */}
      <div style={{ display:'flex', background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:5, marginBottom:20, gap:4 }}>
        {[['profil','👤 Profil'],['securite','🔐 Sécurité']].map(([k,l]) => (
          <button key={k} onClick={() => { setTab(k); setMsg(null) }}
            style={{ flex:1, padding:'10px 0', border:'none', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700, transition:'all .15s',
              background: tab===k ? roleInfo.color : 'transparent',
              color:      tab===k ? '#fff'         : '#64748b',
              boxShadow:  tab===k ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ ONGLET PROFIL ══════════════════════════════════════════ */}
      {tab === 'profil' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(30,58,138,.07)' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
            <h3 style={{ fontWeight:700, fontSize:15, color:'#1e3a8a', margin:0 }}>Informations du compte</h3>
          </div>
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:10 }}>
            {[
              ['👤 Identifiant',      user?.username],
              ['📧 Email',            user?.email || '—'],
              ['🏷️ Rôle',            roleInfo.label],
              ...(myPerso ? [
                ['🏢 Société',         myPerso.societe || '—'],
                ['📞 Téléphone',       myPerso.numero  || '—'],
                ['🔢 Code QR',         myPerso.qr_code_string || '—'],
              ] : []),
              ['📅 Dernière connexion', user?.last_login
                ? new Date(user.last_login).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'short' })
                : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#f8fafc', borderRadius:10, gap:12 }}>
                <span style={{ fontSize:12, color:'#64748b', fontWeight:600, flexShrink:0 }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#1e293b', textAlign:'right', wordBreak:'break-all' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
          <div style={{ padding:'0 20px 20px' }}>
            <button onClick={() => setTab('securite')}
              style={{ width:'100%', background: roleInfo.color, color:'#fff', border:'none', padding:13, borderRadius:12, cursor:'pointer', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              🔐 Modifier mon mot de passe →
            </button>
          </div>
        </div>
      )}

      {/* ══ ONGLET SÉCURITÉ ════════════════════════════════════════ */}
      {tab === 'securite' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(30,58,138,.07)' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #f1f5f9', background:'#f8fafc' }}>
            <h3 style={{ fontWeight:700, fontSize:15, color:'#1e3a8a', margin:0 }}>🔐 Modifier le mot de passe</h3>
            <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>Vous serez déconnecté automatiquement après la modification.</p>
          </div>
          <div style={{ padding:20 }}>

            {/* Message retour */}
            {msg && (
              <div style={{ background: msg.type==='success' ? '#f0fdf4' : '#fef2f2', border:`1px solid ${msg.type==='success' ? '#86efac' : '#fca5a5'}`, borderRadius:10, padding:'12px 16px', marginBottom:18, fontSize:13, fontWeight:600, color: msg.type==='success' ? '#16a34a' : '#dc2626' }}>
                {msg.text}
              </div>
            )}

            <PwdField label="🔑 Ancien mot de passe" value={ancien}    onChange={setAncien}    onEnter={submitPwd} />
            <PwdField label="🆕 Nouveau mot de passe" value={nouveau}   onChange={setNouveau}   onEnter={submitPwd} />

            {/* Indicateur de force */}
            {nouveau && (
              <div style={{ marginTop:-8, marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#64748b' }}>Force du mot de passe</span>
                  <span style={{ fontSize:11, fontWeight:700, color: strengthInfo?.color }}>
                    {strengthInfo?.emoji} {strengthInfo?.label}
                  </span>
                </div>
                <div style={{ height:5, background:'#f1f5f9', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ width:`${strength*20}%`, height:'100%', background: strengthInfo?.color, borderRadius:10, transition:'all .3s' }} />
                </div>
              </div>
            )}

            <PwdField label="✅ Confirmer le nouveau" value={confirmer} onChange={setConfirmer} onEnter={submitPwd} />

            {/* Avertissement correspondance */}
            {confirmer && nouveau !== confirmer && (
              <div style={{ marginTop:-8, marginBottom:12, fontSize:11, color:'#dc2626', fontWeight:600 }}>
                ❌ Les mots de passe ne correspondent pas
              </div>
            )}
            {confirmer && nouveau === confirmer && confirmer.length > 0 && (
              <div style={{ marginTop:-8, marginBottom:12, fontSize:11, color:'#16a34a', fontWeight:600 }}>
                ✅ Les mots de passe correspondent
              </div>
            )}

            <button
              onClick={submitPwd}
              disabled={loading || !ancien || !nouveau || !confirmer || nouveau !== confirmer}
              style={{ width:'100%', background: loading || !ancien || !nouveau || !confirmer || nouveau !== confirmer ? '#94a3b8' : roleInfo.color, color:'#fff', border:'none', padding:14, borderRadius:12, cursor: loading ? 'wait' : (!ancien || !nouveau || !confirmer ? 'not-allowed' : 'pointer'), fontSize:15, fontWeight:700, transition:'.15s', marginTop:4 }}>
              {loading ? '⏳ Modification en cours…' : '🔐 Modifier le mot de passe'}
            </button>

            <div style={{ marginTop:16, padding:'12px 14px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#0369a1', marginBottom:4 }}>💡 Conseils de sécurité</div>
              <ul style={{ margin:0, paddingLeft:16, fontSize:11, color:'#0369a1', lineHeight:1.8 }}>
                <li>Au moins 10 caractères</li>
                <li>Mélangez majuscules, chiffres et symboles</li>
                <li>N'utilisez pas votre nom ou date de naissance</li>
                <li>Changez-le tous les 3 mois</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
