/**
 * MON COMPTE — Profil + Modifier le mot de passe
 */
import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { password as pwdAPI, personnel as personnelAPI } from '../api'

const ROLE_INFO = {
  admin:        { icon:'👑', label:'Administrateur',   color:'#1e3a8a', bg:'#dbeafe' },
  agent:        { icon:'🏗️',  label:'Agent Terrain',    color:'#7c2d12', bg:'#ffedd5' },
  restauration: { icon:'🍽️', label:'Restaurant',       color:'#6b21a8', bg:'#f3e8ff' },
  technicien:   { icon:'🔧', label:'Technicien',        color:'#166534', bg:'#dcfce7' },
  menage:       { icon:'🧹', label:'Ménage',            color:'#92400e', bg:'#fef3c7' },
}

export default function MonCompte() {
  const { user, logout } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const info = ROLE_INFO[role] || ROLE_INFO.agent

  const [myPersonnel, setMyPersonnel] = useState(null)
  const [tab, setTab] = useState('profil')

  // Changer mot de passe
  const [form, setForm] = useState({ ancien:'', nouveau:'', confirmer:'' })
  const [showPwd, setShowPwd] = useState({ ancien:false, nouveau:false, confirmer:false })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [strength, setStrength] = useState(0)

  useEffect(() => {
    personnelAPI.monProfil()
      .then(r => setMyPersonnel(r.data))
      .catch(() => {})
  }, [])

  const calcStrength = (pwd) => {
    let s = 0
    if (pwd.length >= 6) s++
    if (pwd.length >= 10) s++
    if (/[A-Z]/.test(pwd)) s++
    if (/[0-9]/.test(pwd)) s++
    if (/[^A-Za-z0-9]/.test(pwd)) s++
    return s
  }

  const handleNewPwd = (v) => {
    setForm(f => ({...f, nouveau:v}))
    setStrength(calcStrength(v))
  }

  const strengthLabel = ['', '😟 Très faible', '😕 Faible', '😐 Moyen', '😊 Bon', '💪 Excellent'][strength]
  const strengthColor = ['', '#dc2626','#f97316','#eab308','#22c55e','#16a34a'][strength]

  const submitPwd = async () => {
    if (!form.ancien) return setMsg({ type:'error', text:'Saisissez votre ancien mot de passe' })
    if (form.nouveau.length < 6) return setMsg({ type:'error', text:'Le nouveau mot de passe doit faire au moins 6 caractères' })
    if (form.nouveau !== form.confirmer) return setMsg({ type:'error', text:'Les deux mots de passe ne correspondent pas' })
    setLoading(true); setMsg(null)
    try {
      const r = await pwdAPI.change({
        ancien_mot_de_passe: form.ancien,
        nouveau_mot_de_passe: form.nouveau,
        confirmer_mot_de_passe: form.confirmer
      })
      setMsg({ type:'success', text: r.data.message || '✅ Mot de passe modifié ! Reconnexion dans 3s...' })
      setForm({ ancien:'', nouveau:'', confirmer:'' })
      setStrength(0)
      setTimeout(() => { logout(); window.location.replace('/login') }, 3000)
    } catch(e) {
      setMsg({ type:'error', text: e.response?.data?.error || 'Erreur. Vérifiez votre ancien mot de passe.' })
    } finally { setLoading(false) }
  }

  const TABS = [
    { key:'profil', label:'👤 Profil' },
    { key:'securite', label:'🔐 Sécurité' },
  ]

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: '0 auto' }}>
      {/* ── Carte profil ── */}
      <div style={{ background:`linear-gradient(135deg, ${info.color}, ${info.color}cc)`, borderRadius: 20, padding: 24, marginBottom: 20, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, background:'rgba(255,255,255,.08)', borderRadius:'50%' }} />
        <div style={{ position:'absolute', bottom:-20, left:-20, width:80, height:80, background:'rgba(255,255,255,.06)', borderRadius:'50%' }} />
        <div style={{ display:'flex', alignItems:'center', gap:16, position:'relative' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, flexShrink:0 }}>
            {info.icon}
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:20 }}>{user?.first_name} {user?.last_name}</div>
            <div style={{ opacity:.8, fontSize:13, marginTop:2 }}>@{user?.username}</div>
            <span style={{ background:'rgba(255,255,255,.25)', padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:700, display:'inline-block', marginTop:6 }}>
              {info.label}
            </span>
          </div>
        </div>
        {myPersonnel && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid rgba(255,255,255,.2)', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, position:'relative' }}>
            {myPersonnel.societe && <div><div style={{ opacity:.65, fontSize:10, textTransform:'uppercase' }}>Société</div><div style={{ fontWeight:600, fontSize:13 }}>{myPersonnel.societe}</div></div>}
            {myPersonnel.numero  && <div><div style={{ opacity:.65, fontSize:10, textTransform:'uppercase' }}>Téléphone</div><div style={{ fontWeight:600, fontSize:13 }}>{myPersonnel.numero}</div></div>}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:4, marginBottom:20, gap:4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(null) }}
            style={{ flex:1, padding:'10px 0', border:'none', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:600, background:tab===t.key?info.color:'transparent', color:tab===t.key?'#fff':'var(--text-dim)', transition:'.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROFIL ── */}
      {tab === 'profil' && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:20 }}>
          <h3 style={{ fontWeight:700, fontSize:15, color:'var(--blue)', margin:'0 0 16px' }}>Informations du compte</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              ['👤 Identifiant', user?.username],
              ['📧 Email', user?.email || '—'],
              ['🏷️ Rôle', info.label],
              ...(myPersonnel ? [
                ['🏢 Société', myPersonnel.societe || '—'],
                ['📞 Téléphone', myPersonnel.numero || '—'],
                ['🏠 Résidence', myPersonnel.batiment_actuel || '—'],
              ] : []),
              ['📅 Dernière connexion', user?.last_login ? new Date(user.last_login).toLocaleString('fr-FR') : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'var(--bg)', borderRadius:9 }}>
                <span style={{ fontSize:12, color:'var(--text-dim)', fontWeight:600 }}>{label}</span>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{value || '—'}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setTab('securite')}
            style={{ width:'100%', marginTop:16, background:'var(--blue)', color:'#fff', border:'none', padding:'11px', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700 }}>
            🔐 Modifier le mot de passe →
          </button>
        </div>
      )}

      {/* ── SÉCURITÉ ── */}
      {tab === 'securite' && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:20 }}>
          <h3 style={{ fontWeight:700, fontSize:15, color:'var(--blue)', margin:'0 0 4px' }}>🔐 Modifier le mot de passe</h3>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginBottom:20 }}>Vous serez déconnecté après la modification.</p>

          {msg && (
            <div style={{ background:msg.type==='success'?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.type==='success'?'#86efac':'#fca5a5'}`, borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:msg.type==='success'?'#16a34a':'#dc2626', fontWeight:600 }}>
              {msg.text}
            </div>
          )}

          {[
            ['🔑 Ancien mot de passe', 'ancien'],
            ['🆕 Nouveau mot de passe', 'nouveau'],
            ['✅ Confirmer le nouveau', 'confirmer'],
          ].map(([label, field]) => (
            <div key={field} style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-dim)', marginBottom:6, textTransform:'uppercase', letterSpacing:.5 }}>{label}</label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPwd[field]?'text':'password'}
                  value={form[field]}
                  onChange={e => field==='nouveau' ? handleNewPwd(e.target.value) : setForm(f=>({...f,[field]:e.target.value}))}
                  onKeyDown={e => e.key==='Enter' && submitPwd()}
                  placeholder={field==='ancien'?'Votre mot de passe actuel':'••••••••'}
                  style={{ width:'100%', border:'2px solid var(--border)', borderRadius:10, padding:'11px 44px 11px 14px', fontSize:15, outline:'none', boxSizing:'border-box', background:'var(--surface)' }}
                />
                <button type="button" onClick={() => setShowPwd(s=>({...s,[field]:!s[field]}))}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--text-dim)' }}>
                  {showPwd[field]?'🙈':'👁️'}
                </button>
              </div>
              {field==='nouveau' && form.nouveau && (
                <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:4, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ width:`${strength*20}%`, height:'100%', background:strengthColor, borderRadius:4, transition:'.3s' }} />
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color:strengthColor }}>{strengthLabel}</span>
                </div>
              )}
            </div>
          ))}

          <button onClick={submitPwd} disabled={loading || !form.ancien || !form.nouveau || !form.confirmer}
            style={{ width:'100%', background:loading?'#94a3b8':info.color, color:'#fff', border:'none', padding:'13px', borderRadius:10, cursor:loading?'not-allowed':'pointer', fontSize:15, fontWeight:700, marginTop:6, transition:'.15s' }}>
            {loading ? '⏳ Modification en cours...' : '🔐 Modifier le mot de passe'}
          </button>

          <div style={{ marginTop:16, padding:'12px 14px', background:'var(--bg)', borderRadius:10, fontSize:12, color:'var(--text-dim)' }}>
            <b>Conseils :</b> Utilisez au moins 8 caractères, mélangez majuscules, chiffres et symboles.
          </div>
        </div>
      )}
    </div>
  )
}
