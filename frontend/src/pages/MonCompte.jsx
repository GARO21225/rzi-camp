/**
 * MON COMPTE — Modifier le mot de passe
 */
import React, { useState } from 'react'
import { useStore } from '../store'
import { password as pwdAPI } from '../api'

export default function MonCompte() {
  const { user, logout } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')

  const [form, setForm] = useState({ ancien_mot_de_passe:'', nouveau_mot_de_passe:'', confirmer_mot_de_passe:'' })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const ROLE_LABELS = { admin:'👑 Administrateur', agent:'🏗️ Agent Terrain', restauration:'🍽️ Restaurant', technicien:'🔧 Technicien', menage:'🧹 Ménage' }

  const submit = async () => {
    if (!form.nouveau_mot_de_passe || form.nouveau_mot_de_passe.length < 6)
      return setMsg({ type:'error', text:'Le nouveau mot de passe doit faire au moins 6 caractères' })
    if (form.nouveau_mot_de_passe !== form.confirmer_mot_de_passe)
      return setMsg({ type:'error', text:'Les mots de passe ne correspondent pas' })

    setLoading(true); setMsg(null)
    try {
      const r = await pwdAPI.change(form)
      setMsg({ type:'success', text: r.data.message || 'Mot de passe modifié ✅ Reconnectez-vous.' })
      setForm({ ancien_mot_de_passe:'', nouveau_mot_de_passe:'', confirmer_mot_de_passe:'' })
      // Déconnecter après changement mdp (bonne pratique)
      setTimeout(() => { logout(); window.location.replace('/login') }, 2500)
    } catch(e) {
      setMsg({ type:'error', text: e.response?.data?.error || 'Erreur' })
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding:20, maxWidth:480, margin:'0 auto' }}>
      {/* Profil */}
      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:16, padding:24, marginBottom:20, textAlign:'center', boxShadow:'0 4px 20px rgba(30,58,138,.08)' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--blue)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:32, marginBottom:12 }}>
          {({ admin:'👑', restauration:'🍽️', technicien:'🔧', menage:'🧹' }[role] || '👤')}
        </div>
        <div style={{ fontWeight:700, fontSize:18, color:'var(--blue)' }}>{user?.first_name} {user?.last_name}</div>
        <div style={{ fontSize:12, color:'var(--text-dim)', margin:'4px 0 0' }}>@{user?.username}</div>
        <div style={{ marginTop:10, display:'inline-block', background:'rgba(30,58,138,.1)', color:'var(--blue)', padding:'4px 14px', borderRadius:20, fontSize:12, fontWeight:700 }}>
          {ROLE_LABELS[role] || role}
        </div>
      </div>

      {/* Changer mot de passe */}
      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:16, padding:24, boxShadow:'0 4px 20px rgba(30,58,138,.08)' }}>
        <h3 style={{ fontWeight:700, fontSize:16, color:'var(--blue)', margin:'0 0 18px' }}>🔐 Modifier le mot de passe</h3>

        {msg && (
          <div style={{ background: msg.type==='success'?'#f0fdf4':'#fef2f2', border:`1px solid ${msg.type==='success'?'#86efac':'#fca5a5'}`, borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:13, color:msg.type==='success'?'#16a34a':'#dc2626', fontWeight:600 }}>
            {msg.type==='success'?'✅':'❌'} {msg.text}
          </div>
        )}

        {[
          ['Ancien mot de passe','ancien_mot_de_passe','🔑'],
          ['Nouveau mot de passe','nouveau_mot_de_passe','🆕'],
          ['Confirmer le nouveau','confirmer_mot_de_passe','✅'],
        ].map(([label, field, icon]) => (
          <div key={field} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-dim)', marginBottom:6, textTransform:'uppercase', letterSpacing:.5 }}>
              {icon} {label}
            </label>
            <input
              type="password"
              value={form[field]}
              onChange={e => setForm({...form, [field]:e.target.value})}
              onKeyDown={e => e.key==='Enter' && submit()}
              autoComplete="new-password"
              style={{ width:'100%', border:'2px solid var(--border)', borderRadius:10, padding:'11px 14px', fontSize:15, outline:'none', boxSizing:'border-box' }}
            />
          </div>
        ))}

        <button onClick={submit} disabled={loading}
          style={{ width:'100%', background:loading?'#94a3b8':'var(--blue)', color:'#fff', border:'none', padding:'13px', borderRadius:10, cursor:loading?'not-allowed':'pointer', fontSize:15, fontWeight:700, marginTop:6 }}>
          {loading ? '⏳ Modification...' : '🔐 Modifier le mot de passe'}
        </button>

        <p style={{ fontSize:11, color:'var(--text-dim)', textAlign:'center', marginTop:12 }}>
          Vous serez déconnecté après modification pour des raisons de sécurité.
        </p>
      </div>
    </div>
  )
}
