import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { parametres as paramAPI } from '../api'
import { useStore } from '../store'

const CHAMPS = [
  { section: 'Maintenance — Délais SLA', items: [
    { cle: 'sla_critique_h', label: 'Priorité Critique', suffix: 'heures', type: 'number' },
    { cle: 'sla_haute_h',    label: 'Priorité Haute',    suffix: 'heures', type: 'number' },
    { cle: 'sla_moyenne_h',  label: 'Priorité Moyenne',  suffix: 'heures', type: 'number' },
    { cle: 'sla_basse_h',    label: 'Priorité Basse',    suffix: 'heures', type: 'number' },
  ]},
  { section: 'Général', items: [
    { cle: 'societe_defaut', label: 'Société par défaut', suffix: '', type: 'text', hint: 'Utilisée pour l\'auto-remplissage "Employé Roxgold" dans Personnel' },
    { cle: 'nom_camp',       label: 'Nom du camp',        suffix: '', type: 'text' },
  ]},
]

const LIENS_RAPIDES = [
  { to: '/induction-admin', label: 'Contenu Induction QHSE', icon: '🎓', desc: 'Modules, quiz, séquence d\'accueil' },
  { to: '/boutique',        label: 'Menu du jour & Boutique', icon: '🍽️', desc: 'Articles, prix, stock' },
  { to: '/mon-compte',      label: 'Mon compte', icon: '👤', desc: 'Mot de passe, informations personnelles' },
]

export default function Parametrage() {
  const navigate = useNavigate()
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser)

  const [valeurs, setValeurs] = useState({})
  const [descriptions, setDescriptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    paramAPI.list()
      .then(r => {
        const v = {}, d = {}
        for (const p of r.data) { v[p.cle] = p.valeur; d[p.cle] = p.description }
        setValeurs(v); setDescriptions(d)
      })
      .catch(() => setMsg({ type:'error', text:'Impossible de charger les paramètres.' }))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (cle, val) => setValeurs(v => ({ ...v, [cle]: val }))

  const sauvegarder = async () => {
    setSaving(true); setMsg(null)
    try {
      const liste = Object.entries(valeurs).map(([cle, valeur]) => ({
        cle, valeur, description: descriptions[cle] || ''
      }))
      await paramAPI.save(liste)
      setMsg({ type:'success', text:'✅ Paramètres enregistrés.' })
    } catch (e) {
      setMsg({ type:'error', text: e?.response?.data?.error || 'Échec de l\'enregistrement.' })
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement...</div>

  return (
    <div style={{ padding:20, maxWidth:760 }}>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>⚙️ Paramétrage</h2>
      <p style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>
        Réglages centraux de l'application. {!isAdmin && "Lecture seule — réservé aux administrateurs pour la modification."}
      </p>

      {msg && (
        <div style={{
          padding:'10px 14px', borderRadius:9, marginBottom:16, fontSize:13, fontWeight:600,
          background: msg.type==='success' ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
          color: msg.type==='success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${msg.type==='success' ? 'rgba(22,163,74,.25)' : 'rgba(220,38,38,.25)'}`
        }}>{msg.text}</div>
      )}

      {CHAMPS.map(sec => (
        <div key={sec.section} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:14 }}>{sec.section}</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {sec.items.map(champ => (
              <div key={champ.cle}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>
                  {champ.label.toUpperCase()}
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type={champ.type}
                    value={valeurs[champ.cle] ?? ''}
                    disabled={!isAdmin}
                    onChange={e => handleChange(champ.cle, e.target.value)}
                    style={{
                      width:'100%', border:'1px solid #e2e8f0', borderRadius:9,
                      padding:'9px 12px', fontSize:13, outline:'none',
                      background: isAdmin ? '#fff' : '#f8fafc',
                      color: isAdmin ? '#1e293b' : '#94a3b8'
                    }}
                  />
                  {champ.suffix && <span style={{ fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>{champ.suffix}</span>}
                </div>
                {champ.hint && <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{champ.hint}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}

      {isAdmin && (
        <button onClick={sauvegarder} disabled={saving}
          style={{
            background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none',
            padding:'11px 22px', borderRadius:9, cursor: saving ? 'not-allowed' : 'pointer',
            fontSize:13, fontWeight:700, opacity: saving ? .6 : 1, marginBottom:24
          }}>
          {saving ? '⏳ Enregistrement...' : '💾 Enregistrer les paramètres'}
        </button>
      )}

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:12 }}>Autres réglages</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {LIENS_RAPIDES.map(l => (
            <a key={l.to} href={l.to} onClick={(e)=>{e.preventDefault(); navigate(l.to)}}
              style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                borderRadius:9, textDecoration:'none', background:'#f8fafc',
                border:'1px solid #e2e8f0', color:'#1e293b', cursor:'pointer'
              }}>
              <span style={{ fontSize:18 }}>{l.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{l.label}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{l.desc}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
