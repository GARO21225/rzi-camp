import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parametres as paramAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'
import InductionAdmin from './InductionAdmin'
import Boutique from './Boutique'

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
  { to: '/boutique',        label: 'Menu du jour & Boutique', icon: '🍽️', desc: 'Articles, prix, stock' },
  { to: '/mon-compte',      label: 'Mon compte', icon: '👤', desc: 'Mot de passe, informations personnelles' },
]

const TABS = [
  ['general',    '⚙️ Général & SLA'],
  ['apparence',  '🎨 Apparence'],
  ['badges',     '🪪 Badges QR — Personnel'],
  ['induction',  '🎓 Induction QHSE'],
  ['catalogue',  '📦 Catalogue Boutique'],
]

const inputStyle = (isAdmin) => ({
  width:'100%', border:'1px solid #e2e8f0', borderRadius:9,
  padding:'9px 12px', fontSize:13, outline:'none',
  background: isAdmin ? '#fff' : '#f8fafc',
  color: isAdmin ? '#1e293b' : '#94a3b8'
})

export default function Parametrage() {
  const navigate = useNavigate()
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser)

  const [tab, setTab] = useState('general')
  const [valeurs, setValeurs] = useState({})
  const [descriptions, setDescriptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const charger = () => {
    setLoading(true)
    paramAPI.list()
      .then(r => {
        const v = {}, d = {}
        for (const p of r.data) { v[p.cle] = p.valeur; d[p.cle] = p.description }
        setValeurs(v); setDescriptions(d)
      })
      .catch(() => setMsg({ type:'error', text:'Impossible de charger les paramètres.' }))
      .finally(() => setLoading(false))
  }

  useEffect(charger, [])

  const handleChange = (cle, val) => setValeurs(v => ({ ...v, [cle]: val }))

  const sauvegarder = async (extra = {}) => {
    setSaving(true); setMsg(null)
    try {
      const fusion = { ...valeurs, ...extra }
      const liste = Object.entries(fusion).map(([cle, valeur]) => ({
        cle, valeur, description: descriptions[cle] || ''
      }))
      await paramAPI.save(liste)
      setValeurs(fusion)
      // Application immédiate (sans attendre un rechargement de page)
      if (fusion.theme_primaire) document.documentElement.style.setProperty('--rzc-navy', fusion.theme_primaire)
      if (fusion.theme_accent)   document.documentElement.style.setProperty('--rzc-ore-gold', fusion.theme_accent)
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
    <div style={{ padding:20, maxWidth:820 }}>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>⚙️ Paramétrage</h2>
      <p style={{ fontSize:13, color:'#64748b', marginBottom:16 }}>
        Réglages centraux de l'application. {!isAdmin && "Lecture seule — réservé aux administrateurs pour la modification."}
      </p>

      <div style={{ display:'flex', gap:6, marginBottom:18, flexWrap:'wrap' }}>
        {TABS.map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            style={{
              padding:'8px 16px', borderRadius:9, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:700,
              background: tab===k ? 'var(--rzc-navy, #1E3A8A)' : '#e2e8f0',
              color: tab===k ? '#fff' : '#475569'
            }}>{l}</button>
        ))}
      </div>

      {msg && (
        <div style={{
          padding:'10px 14px', borderRadius:9, marginBottom:16, fontSize:13, fontWeight:600,
          background: msg.type==='success' ? 'rgba(22,163,74,.1)' : 'rgba(220,38,38,.1)',
          color: msg.type==='success' ? '#16a34a' : '#dc2626',
          border: `1px solid ${msg.type==='success' ? 'rgba(22,163,74,.25)' : 'rgba(220,38,38,.25)'}`
        }}>{msg.text}</div>
      )}

      {tab === 'general' && (
        <GeneralTab
          isAdmin={isAdmin} valeurs={valeurs} handleChange={handleChange}
          saving={saving} sauvegarder={sauvegarder} navigate={navigate}
        />
      )}

      {tab === 'apparence' && (
        <ApparenceTab isAdmin={isAdmin} valeurs={valeurs} sauvegarder={sauvegarder} saving={saving} />
      )}

      {tab === 'badges' && (
        <BadgesTab valeurs={valeurs} />
      )}

      {tab === 'induction' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
          <InductionAdmin />
        </div>
      )}

      {tab === 'catalogue' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
          <Boutique embedded />
        </div>
      )}
    </div>
  )
}

function GeneralTab({ isAdmin, valeurs, handleChange, saving, sauvegarder, navigate }) {
  return (
    <>
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
                    style={inputStyle(isAdmin)}
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
        <button onClick={()=>sauvegarder()} disabled={saving}
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
    </>
  )
}

function ApparenceTab({ isAdmin, valeurs, sauvegarder, saving }) {
  const setLogoUrl = useStore(s => s.setLogoUrl)
  const [primaire, setPrimaire] = useState(valeurs.theme_primaire || '#0F2A5C')
  const [accent,   setAccent]   = useState(valeurs.theme_accent   || '#C9972B')
  const [logoPreview, setLogoPreview] = useState(
    valeurs.logo_base64 ? `data:${valeurs.logo_mime||'image/png'};base64,${valeurs.logo_base64}` : null
  )
  const [logoBase64, setLogoBase64] = useState(valeurs.logo_base64 || '')
  const [logoMime, setLogoMime] = useState(valeurs.logo_mime || '')
  const fileRef = useRef(null)

  const onLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) {
      alert('Le logo doit faire moins de 1,5 Mo. Compressez l\'image avant de l\'importer.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]
      setLogoPreview(dataUrl)
      setLogoBase64(base64)
      setLogoMime(file.type)
    }
    reader.readAsDataURL(file)
  }

  const appliquerCouleurs = async () => {
    await sauvegarder({ theme_primaire: primaire, theme_accent: accent })
  }

  const appliquerLogo = async () => {
    await sauvegarder({ logo_base64: logoBase64, logo_mime: logoMime })
    if (logoBase64) setLogoUrl(`data:${logoMime};base64,${logoBase64}`)
  }

  const reinitialiserLogo = async () => {
    setLogoPreview(null); setLogoBase64(''); setLogoMime('')
    await sauvegarder({ logo_base64: '', logo_mime: '' })
    setLogoUrl(null)
  }

  return (
    <>
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4 }}>🎨 Couleurs de l'application</div>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
          S'applique immédiatement à toutes les pages (headers, boutons, accents actifs).
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>COULEUR PRIMAIRE</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={primaire} disabled={!isAdmin}
                onChange={e=>setPrimaire(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={primaire} disabled={!isAdmin}
                onChange={e=>setPrimaire(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6 }}>COULEUR ACCENT</label>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="color" value={accent} disabled={!isAdmin}
                onChange={e=>setAccent(e.target.value)}
                style={{ width:44, height:36, border:'1px solid #e2e8f0', borderRadius:8, cursor: isAdmin?'pointer':'default', padding:2 }}/>
              <input type="text" value={accent} disabled={!isAdmin}
                onChange={e=>setAccent(e.target.value)} style={{...inputStyle(isAdmin), fontFamily:'monospace'}}/>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:16, alignItems:'center' }}>
          <div style={{ padding:'10px 16px', borderRadius:9, background:primaire, color:'#fff', fontSize:12, fontWeight:700 }}>Aperçu primaire</div>
          <div style={{ padding:'10px 16px', borderRadius:9, background:accent, color:'#fff', fontSize:12, fontWeight:700 }}>Aperçu accent</div>
        </div>

        {isAdmin && (
          <button onClick={appliquerCouleurs} disabled={saving}
            style={{ marginTop:16, background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none',
              padding:'10px 20px', borderRadius:9, cursor: saving?'not-allowed':'pointer', fontSize:13, fontWeight:700, opacity: saving?.6:1 }}>
            {saving ? '⏳ Application...' : '🎨 Appliquer les couleurs'}
          </button>
        )}
      </div>

      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4 }}>🖼️ Logo</div>
        <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
          Remplace le logo affiché en haut à gauche de l'application. PNG/JPG recommandé, fond transparent, moins de 1,5 Mo.
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:100, height:70, borderRadius:10, background:'#f8fafc', border:'1px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            {logoPreview
              ? <img src={logoPreview} alt="Logo" style={{ maxWidth:'90%', maxHeight:'90%', objectFit:'contain' }}/>
              : <img src="/roxgold-logo.png" alt="Logo par défaut" style={{ maxWidth:'80%', maxHeight:'80%', objectFit:'contain' }}/>}
          </div>
          {isAdmin && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} style={{ fontSize:12 }}/>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={appliquerLogo} disabled={saving || !logoBase64}
                  style={{ background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none', padding:'8px 16px',
                    borderRadius:9, cursor: (saving||!logoBase64)?'not-allowed':'pointer', fontSize:12, fontWeight:700, opacity: (saving||!logoBase64)?.5:1 }}>
                  💾 Utiliser ce logo
                </button>
                <button onClick={reinitialiserLogo} disabled={saving}
                  style={{ background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0', padding:'8px 16px',
                    borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                  ↺ Logo par défaut
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function BadgesTab({ valeurs }) {
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState(new Set())

  useEffect(() => {
    personnelAPI.list({ page_size: 2000 })
      .then(r => setListe(r.data.results || r.data || []))
      .catch(() => setListe([]))
      .finally(() => setLoading(false))
  }, [])

  const filtres = liste.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return [p.nom, p.prenom, p.societe].some(v => (v||'').toLowerCase().includes(s))
  })

  const toggle = (id) => setSelection(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const toggleTout = () => {
    if (selection.size === filtres.length) setSelection(new Set())
    else setSelection(new Set(filtres.map(p => p.id)))
  }

  const genererBadges = () => {
    const gens = liste.filter(p => selection.has(p.id))
    if (!gens.length) return
    const primaire = valeurs.theme_primaire || '#0F2A5C'
    const accent    = valeurs.theme_accent   || '#C9972B'
    const logoSrc = valeurs.logo_base64 ? `data:${valeurs.logo_mime||'image/png'};base64,${valeurs.logo_base64}` : '/roxgold-logo.png'

    const badgeHtml = (p) => {
      // SECURITE : mêmes règles que le rapport d'intervention — un champ
      // personnel n'est pas garanti inoffensif, on échappe avant injection HTML.
      const esc = (v) => (v ?? '').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      return `
      <div class="badge">
        <div class="head" style="background:${primaire}">
          <img src="${logoSrc}" class="logo"/>
          <div class="camp">ROXGOLD SANGO</div>
        </div>
        <div class="corps">
          <div class="qr"><img src="data:image/png;base64,${p.qr_code_data||''}"/></div>
          <div class="infos">
            <div class="nom">${esc(p.prenom).toUpperCase()}</div>
            <div class="prenom">${esc(p.nom).toUpperCase()}</div>
            <div class="societe" style="color:${accent}">${esc(p.societe) || '—'}</div>
            <div class="type">${esc(p.type_label || p.type_personnel)}</div>
            <div class="matricule">N° ${esc(p.numero || p.matricule) || '—'}</div>
          </div>
        </div>
      </div>
    `}

    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(`
      <!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Badges Personnel — RZI Camp</title>
      <style>
        * { box-sizing:border-box; }
        body { font-family:Arial,sans-serif; margin:0; padding:20px; background:#f1f5f9; }
        .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        .badge {
          width:340px; height:214px; border-radius:14px; overflow:hidden;
          border:1px solid #cbd5e1; background:#fff; page-break-inside:avoid;
        }
        .head { padding:10px 14px; display:flex; align-items:center; gap:10px; }
        .head .logo { height:24px; background:#fff; border-radius:4px; padding:2px 6px; object-fit:contain; }
        .head .camp { color:#fff; font-size:11px; font-weight:700; letter-spacing:.5px; }
        .corps { display:flex; padding:14px; gap:14px; align-items:center; }
        .qr img { width:100px; height:100px; }
        .infos { flex:1; }
        .nom { font-size:16px; font-weight:800; color:#1e293b; line-height:1.1; }
        .prenom { font-size:13px; font-weight:600; color:#475569; margin-bottom:6px; }
        .societe { font-size:12px; font-weight:700; margin-bottom:2px; }
        .type { font-size:11px; color:#64748b; margin-bottom:6px; }
        .matricule { font-size:11px; font-family:monospace; color:#94a3b8; }
        @media print { body{background:#fff;padding:0} .grid{gap:8px} }
      </style></head>
      <body>
        <div class="grid">${gens.map(badgeHtml).join('')}</div>
      </body></html>
    `)
    w.document.close()
    w.onload = () => { w.focus(); w.print() }
  }

  if (loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>⏳ Chargement du personnel...</div>

  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#1e293b', marginBottom:4 }}>🪪 Badges QR — Personnel (Restauration)</div>
      <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
        Génère un badge imprimable par personne, avec le QR code déjà utilisé pour le pointage au restaurant —
        aucune donnée supplémentaire à saisir. Sélectionnez le personnel puis imprimez ; découpez au format carte.
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nom, société..."
          style={{ ...inputStyle(true), maxWidth:220 }} />
        <button onClick={toggleTout}
          style={{ background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', padding:'9px 14px',
            borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
          {selection.size === filtres.length && filtres.length>0 ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
        <button onClick={genererBadges} disabled={!selection.size}
          style={{ background: selection.size ? 'var(--rzc-navy, #1E3A8A)' : '#cbd5e1', color:'#fff', border:'none',
            padding:'9px 16px', borderRadius:9, cursor: selection.size?'pointer':'not-allowed', fontSize:12, fontWeight:700 }}>
          🖨️ Générer & imprimer ({selection.size})
        </button>
      </div>

      <div style={{ maxHeight:420, overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:9 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'#f8fafc' }}>
              <th style={{ padding:'8px 12px', width:30 }}></th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>NOM</th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>SOCIÉTÉ</th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>TYPE</th>
              <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#64748b' }}>QR</th>
            </tr>
          </thead>
          <tbody>
            {filtres.map((p,idx) => (
              <tr key={p.id} style={{ borderTop:'1px solid #e2e8f0', background: idx%2?'#f8fafc':'#fff' }}>
                <td style={{ padding:'7px 12px' }}>
                  <input type="checkbox" checked={selection.has(p.id)} onChange={()=>toggle(p.id)}
                    style={{ width:15, height:15, cursor:'pointer' }}/>
                </td>
                <td style={{ padding:'7px 12px', fontWeight:600 }}>{p.nom} {p.prenom}</td>
                <td style={{ padding:'7px 12px', color:'#64748b' }}>{p.societe||'—'}</td>
                <td style={{ padding:'7px 12px', color:'#64748b' }}>{p.type_label||p.type_personnel||'—'}</td>
                <td style={{ padding:'7px 12px' }}>{p.qr_code_data ? '✅' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
