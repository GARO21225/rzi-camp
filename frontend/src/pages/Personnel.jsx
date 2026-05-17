
import React, { useEffect, useState } from 'react'
import { personnel as personnelAPI, importCSV } from '../api'
import { useStore } from '../store'

const TYPE_COLORS = {
  roxgold:{ bg:'rgba(240,165,0,.12)', color:'#d08800', border:'rgba(240,165,0,.3)' },
  sous_traitant:{ bg:'rgba(37,99,235,.1)', color:'#2563eb', border:'rgba(37,99,235,.2)' },
  visiteur:{ bg:'rgba(124,58,237,.1)', color:'#7c3aed', border:'rgba(124,58,237,.2)' },
}
const TYPE_LABELS = { roxgold:'Agent Roxgold', sous_traitant:'Sous-traitant', visiteur:'Visiteur' }
const TYPE_PREFIX = { roxgold:'A', sous_traitant:'S', visiteur:'V' }

export default function Personnel() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'
  const [importModal, setImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [qrModal, setQrModal] = useState(null)
  const [credModal, setCredModal] = useState(null)
  const [editModal, setEditModal] = useState(null) // personnel en cours d'édition
  const [editForm, setEditForm] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [form, setForm] = useState({ nom:'', prenom:'', societe:'ROXGOLD', numero:'', type_personnel:'roxgold', email:'' })

  const load = () => {
    setLoading(true)
    const p = {}
    if (search) p.search = search
    if (typeFilter) p.type_personnel = typeFilter
    personnelAPI.list(p).then(r=>setData(r.data.results||r.data)).finally(()=>setLoading(false))
  }

  useEffect(()=>{load()},[search,typeFilter])

  const openCreate = () => {
    if (!isAdmin) return alert('Seul l\'admin peut créer du personnel')
    setForm({ nom:'', prenom:'', societe:'ROXGOLD', numero:'', type_personnel:'roxgold', email:'' })
    setModal('create')
  }

  const save = async () => {
    if (!form.nom||!form.prenom||!form.societe) return alert('Nom, Prénom, Société obligatoires')
    try {
      const r = await personnelAPI.create(form)
      // Show credentials if returned
      if (r.data.login_genere) {
        setCredModal({ nom:`${r.data.nom} ${r.data.prenom}`, login:r.data.login_genere, password:r.data.password_genere })
      }
      setModal(null); load()
    } catch(e) {
      alert(e.response?.data?.error || 'Erreur création')
    }
  }

  const regenQR = async (id) => {
    const r = await personnelAPI.regenererQr(id)
    setQrModal(r.data); load()
  }

  const handleRoleChange = async (p, newRole) => {
    if (!newRole) return
    try {
      await personnelAPI.assigRole(p.id, newRole)
      load()
    } catch(e) { alert(e.response?.data?.error || 'Erreur assignation rôle') }
  }

  const regenCompte = async (p) => {
    try {
      const r = await personnelAPI.regenererCompte(p.id)
      setCredModal({ nom:`${p.nom} ${p.prenom}`, login:r.data.login, password:r.data.password })
    } catch(e) { alert(e.response?.data?.error || 'Erreur') }
  }

  const handleToggleActive = async (p) => {
    try {
      const r = await personnelAPI.toggleActive(p.id)
      load()
      alert(r.data?.message || 'Compte mis à jour')
    } catch(e) { alert(e.response?.data?.error || 'Erreur') }
  }

  const del = async (id) => {
    if (!window.confirm('Supprimer ce membre ?')) return
    try {
      await personnelAPI.delete(id)
      load()
    } catch(e) {
      const errMsg = e.response?.data?.error || e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur suppression'
      alert('Suppression impossible: ' + errMsg)
    }
  }

  // Preview login/pass based on form
  const previewLogin = () => {
    if (!form.nom||!form.prenom) return { login:'—', password:'—' }
    const prefix = {roxgold:'a',sous_traitant:'s',visiteur:'v'}[form.type_personnel]||'u'
    const prenomSlug = form.prenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
    const nomInit = (form.nom[0]||'x').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')
    const login = `${prefix}_${nomInit}${prenomSlug}`
    const digits = (form.numero||'').replace(/\D/g,'').slice(-4)||'0000'
    const password = `${(form.nom[0]||'').toUpperCase()}${(form.prenom[0]||'').toUpperCase()}${digits}`
    return { login, password }
  }
  const preview = previewLogin()

  const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }


  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const r = await importCSV(file)
      setImportResult(r.data)
      load()
    } catch(err) {
      setImportResult({ error: err.response?.data?.error || 'Erreur import' })
    } finally { setImporting(false) }
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)' }}>👤 Gestion du Personnel</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>Agents Roxgold · Sous-traitants · Visiteurs · Comptes utilisateurs</p>
        </div>
        {isAdmin && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => setImportModal(true)}
              style={{ background:'rgba(30,58,138,.1)', color:'var(--blue)', border:'1px solid rgba(30,58,138,.3)', padding:'9px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
              📥 Importer CSV/Excel
            </button>
            <button onClick={openCreate}
              style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              + Déclarer un membre
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[['Agent Roxgold','roxgold'],['Sous-traitants','sous_traitant'],['Visiteurs','visiteur']].map(([l,t])=>{
          const n = data.filter(p=>p.type_personnel===t).length
          const c = TYPE_COLORS[t]
        

  return (
            <div key={t} onClick={()=>setTypeFilter(typeFilter===t?'':t)}
              style={{ background:'#fff', border:`2px solid ${typeFilter===t?c.color:'var(--border)'}`, borderRadius:12,
                padding:16, cursor:'pointer', transition:'.2s', boxShadow:'var(--shadow)',
                borderTop:`4px solid ${c.color}` }}>
              <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:700, color:c.color }}>{n}</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{TYPE_PREFIX[t]} — {l}</div>
            </div>
          )
        })}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..."
          style={{ ...inp, width:200 }}/>
        {(search||typeFilter) && <button onClick={()=>{setSearch('');setTypeFilter('')}}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'7px 12px', borderRadius:7, fontSize:12, cursor:'pointer' }}>✕ Reset</button>}
      </div>

      {/* TABLE */}
      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'var(--blue)' }}>
              {['Nom & Prénom','Société','Type','Téléphone','Login','QR Code','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.85)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading?<tr><td colSpan={7} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</td></tr>
            :data.length===0?<tr><td colSpan={7} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun membre</td></tr>
            :data.map((p,i)=>{
              const c=TYPE_COLORS[p.type_personnel]
            

  return (
                <tr key={p.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                  <td style={{ padding:'10px 14px' }}><div style={{ fontWeight:700, color:'var(--blue)' }}>{p.nom} {p.prenom}</div>{p.email&&<div style={{ fontSize:11, color:'var(--text-dim)' }}>{p.email}</div>}</td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}>{p.societe}</td>
                  <td style={{ padding:'10px 14px' }}><span style={{ background:c?.bg, color:c?.color, border:`1px solid ${c?.border}`, padding:'3px 8px', borderRadius:20, fontSize:11, fontWeight:700 }}>{TYPE_PREFIX[p.type_personnel]} — {TYPE_LABELS[p.type_personnel]}</span></td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12 }}>{p.numero||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    {p.login_genere
                      ? <div style={{ fontFamily:'monospace', fontSize:11, background:'var(--surface2)', padding:'4px 8px', borderRadius:6 }}>
                          <div style={{ color:'var(--blue)', fontWeight:700 }}>{p.login_genere}</div>
                          {isAdmin && <div style={{ color:'var(--text-dim)', fontSize:10 }}>••••••</div>}
                        </div>
                      : <span style={{ color:'var(--text-dim)', fontSize:11 }}>—</span>
                    }
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={()=>setQrModal(p)}
                      style={{ background:c?.bg, color:c?.color, border:`1px solid ${c?.border}`, padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                      📱 QR
                    </button>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      {isAdmin && (
                      <select
                        value={p.user_role || p.role_camp || ''}
                        onChange={e => handleRoleChange(p, e.target.value)}
                        style={{background:'rgba(37,99,235,.1)',color:'#2563eb',border:'1px solid rgba(37,99,235,.2)',padding:'4px 6px',borderRadius:5,cursor:'pointer',fontSize:10,fontWeight:600,maxWidth:90}}>
                        <option value="">⚙️ Rôle</option>
                        {[['admin','👑 Admin'],['agent','🏗️ Agent'],['restauration','🍽️ Resto'],['technicien','🔧 Tech'],['menage','🧹 Ménage']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleToggleActive(p)} style={{ background:p.user_active===false?'rgba(22,163,74,.1)':'rgba(100,116,139,.1)', color:p.user_active===false?'#16a34a':'#64748b', border:'1px solid currentColor', padding:'4px 7px', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600 }}>
                        {p.user_active===false?'✅ Activer':'⛔ Désact.'}
                      </button>
                    )}
                    {isAdmin && <button onClick={()=>openEdit(p)} style={{ background:'rgba(37,99,235,.1)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'4px 8px', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600 }}>✏️</button>}
                    {isAdmin && <button onClick={()=>regenCompte(p)} style={{ background:'rgba(240,165,0,.1)', color:'#d08800', border:'1px solid rgba(240,165,0,.3)', padding:'4px 8px', borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:600 }}>🔑</button>}
                      {isAdmin && <button onClick={()=>del(p.id)} style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'4px 8px', borderRadius:5, cursor:'pointer', fontSize:10 }}>🗑</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL CREATE */}
      {modal==='create' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#fff', borderRadius:16, width:520, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:16 }}>👤 Déclarer un membre du personnel</h3>
              <button onClick={()=>setModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Nom *','nom'],['Prénom *','prenom'],['Société *','societe'],['N° Téléphone','numero'],['Email','email']].map(([l,k])=>(
                <div key={k} style={{ gridColumn:k==='email'?'span 2':'auto' }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                  <input value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/>
                </div>
              ))}
              <div style={{ gridColumn:'span 2' }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Type *</label>
                <div style={{ display:'flex', gap:8 }}>
                  {[['roxgold','A — Agent Roxgold'],['sous_traitant','S — Sous-traitant'],['visiteur','V — Visiteur']].map(([v,l])=>{
                    const c=TYPE_COLORS[v]
                  

  const openEdit = (p) => {
    setEditForm({
      nom:           p.nom || '',
      prenom:        p.prenom || '',
      societe:       p.societe || '',
      numero:        p.numero || '',
      email:         p.email || '',
      type_personnel: p.type_personnel || 'roxgold',
    })
    setEditModal(p)
  }

  const saveEdit = async () => {
    if (!editForm.nom || !editForm.prenom) return alert('Nom et Prénom requis')
    setEditLoading(true)
    try {
      await personnelAPI.update(editModal.id, editForm)
      setEditModal(null)
      load()
    } catch(e) {
      alert(e.response?.data?.detail || 'Erreur lors de la modification')
    } finally { setEditLoading(false) }
  }


  return (
                      <button key={v} onClick={()=>setForm({...form,type_personnel:v})}
                        style={{ flex:1, padding:'9px 6px', borderRadius:8, border:`2px solid ${form.type_personnel===v?c.color:'var(--border)'}`,
                          background:form.type_personnel===v?c.bg:'#fff', color:form.type_personnel===v?c.color:'var(--text-dim)',
                          cursor:'pointer', fontSize:11, fontWeight:700 }}>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Compte preview */}
            <div style={{ margin:'0 24px 20px', background:'rgba(30,58,138,.06)', border:'1px solid rgba(30,58,138,.15)', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'monospace', letterSpacing:2, marginBottom:8, textTransform:'uppercase' }}>Compte qui sera créé automatiquement</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
                <div><span style={{ color:'var(--text-dim)', fontSize:11 }}>Login :</span><br/><b style={{ fontFamily:'monospace', color:'var(--blue)' }}>{preview.login}</b></div>
                <div><span style={{ color:'var(--text-dim)', fontSize:11 }}>Mot de passe :</span><br/><b style={{ fontFamily:'monospace', color:'var(--blue)' }}>{preview.password}</b></div>
              </div>
              <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:8 }}>Format : {'{type}_{initiale_nom}{prenom}'} / {'{Initiale_Nom}{Initiale_Prenom}{4 derniers chiffres}'}</div>
            </div>

            <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer' }}>Annuler</button>
              <button onClick={save} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontWeight:700 }}>Déclarer & Créer compte</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR */}
      {qrModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#fff', borderRadius:14, width:360, maxWidth:'95vw', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff' }}>📱 QR Code — {qrModal.nom} {qrModal.prenom}</h3>
              <button onClick={()=>setQrModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:24, textAlign:'center' }}>
              <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:12 }}>{qrModal.societe} · {TYPE_LABELS[qrModal.type_personnel]}</div>
              {qrModal.qr_code_data
                ? <img src={`data:image/png;base64,${qrModal.qr_code_data}`} alt="QR"
                    style={{ width:200, height:200, borderRadius:8, border:'3px solid var(--border)', margin:'0 auto 14px', display:'block' }}/>
                : <div style={{ width:200, height:200, background:'var(--surface2)', borderRadius:8, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-dim)' }}>Pas de QR</div>
              }
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:'8px 12px', fontSize:11, fontFamily:'monospace', color:'var(--text-dim)', wordBreak:'break-all', marginBottom:14 }}>
                {qrModal.qr_code_string}
              </div>
              {isAdmin && (
                <button onClick={()=>regenQR(qrModal.id)}
                  style={{ background:'rgba(37,99,235,.1)', color:'var(--blue)', border:'1px solid rgba(37,99,235,.2)', padding:'7px 16px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  🔄 Régénérer QR
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREDENTIALS */}
      {credModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 }}>
          <div style={{ background:'#fff', borderRadius:14, width:420, maxWidth:'95vw', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding:'18px 24px', background:'#16a34a', borderRadius:'14px 14px 0 0' }}>
              <h3 style={{ color:'#fff' }}>✅ Compte créé — Communiquer à {credModal.nom}</h3>
            </div>
            <div style={{ padding:24 }}>
              <div style={{ background:'rgba(22,163,74,.06)', border:'1px solid rgba(22,163,74,.2)', borderRadius:10, padding:18, marginBottom:16 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Login</div>
                    <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:'var(--blue)', background:'var(--surface2)', padding:'8px 12px', borderRadius:8 }}>{credModal.login}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Mot de passe</div>
                    <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:700, color:'var(--blue)', background:'var(--surface2)', padding:'8px 12px', borderRadius:8 }}>{credModal.password}</div>
                  </div>
                </div>
              </div>
              <div style={{ fontSize:12, color:'#dc2626', background:'rgba(220,38,38,.06)', border:'1px solid rgba(220,38,38,.2)', borderRadius:8, padding:'8px 12px', marginBottom:16 }}>
                ⚠️ Notez ces informations et communiquez-les au membre. Le mot de passe ne sera plus affiché.
              </div>
              <button onClick={()=>setCredModal(null)} style={{ width:'100%', background:'var(--blue)', color:'#fff', border:'none', padding:12, borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:700 }}>
                ✅ Compris — Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL IMPORT CSV ═══ */}
      {importModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
          onClick={e => e.target===e.currentTarget && setImportModal(false)}>
          <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:480,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ background:'var(--blue)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontWeight:700,fontSize:15 }}>📥 Importer une liste de personnel</span>
              <button onClick={()=>setImportModal(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:12,color:'#0369a1' }}>
                <b>Colonnes attendues (CSV ou Excel):</b><br/>
                <code>Nom, Prénom, Société, Poste, Téléphone, Email</code><br/>
                <span style={{ opacity:.7 }}>Première ligne = en-têtes. Les noms existants sont ignorés.</span>
              </div>
              <a href="#" onClick={e => {
                e.preventDefault()
                const csv = "Nom,Prénom,Société,Poste,Téléphone,Email\nDIALLO,Mamadou,ROXGOLD,Agent,0701020304,m.diallo@roxgold.com"
                const b = new Blob([csv], {type:'text/csv'})
                const a = document.createElement('a')
                a.href = URL.createObjectURL(b)
                a.download = 'modele_personnel.csv'
                a.click()
              }} style={{ fontSize:12,color:'var(--blue)',display:'block',marginBottom:16,fontWeight:600 }}>
                ⬇ Télécharger le modèle CSV
              </a>
              <label style={{ display:'block',background:'var(--bg)',border:'2px dashed var(--border)',borderRadius:10,padding:'20px',textAlign:'center',cursor:'pointer' }}>
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{ display:'none' }} />
                <div style={{ fontSize:32,marginBottom:8 }}>📂</div>
                <div style={{ fontWeight:700,color:'var(--blue)',fontSize:14 }}>Cliquez pour choisir un fichier</div>
                <div style={{ fontSize:11,color:'var(--text-dim)',marginTop:4 }}>CSV ou Excel (.xlsx)</div>
              </label>
              {importing && <div style={{ marginTop:12,textAlign:'center',color:'var(--blue)',fontWeight:600 }}>⏳ Import en cours...</div>}
              {importResult && (
                <div style={{ marginTop:12,padding:'12px 14px',background:importResult.error?'#fef2f2':'#f0fdf4',border:`1px solid ${importResult.error?'#fca5a5':'#86efac'}`,borderRadius:10,fontSize:13 }}>
                  {importResult.error
                    ? <span style={{ color:'#dc2626' }}>❌ {importResult.error}</span>
                    : <>
                        <div style={{ fontWeight:700,color:'#16a34a',marginBottom:4 }}>✅ {importResult.message}</div>
                        {importResult.errors?.length > 0 && (
                          <ul style={{ fontSize:11,color:'#64748b',margin:'4px 0 0 16px' }}>
                            {importResult.errors.map((e,i) => <li key={i}>{e}</li>)}
                          </ul>
                        )}
                      </>
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ═══ MODAL ÉDITION ═══ */}
      {editModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setEditModal(null)}>
          <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:480,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ background:'var(--blue)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontWeight:700,fontSize:15 }}>✏️ Modifier — {editModal.nom} {editModal.prenom}</span>
              <button onClick={()=>setEditModal(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:14 }}>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                {[['Nom','nom'],['Prénom','prenom']].map(([label,field])=>(
                  <div key={field}>
                    <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--text-dim)',marginBottom:5,textTransform:'uppercase' }}>{label} *</label>
                    <input value={editForm[field]||''} onChange={e=>setEditForm({...editForm,[field]:e.target.value.toUpperCase()})}
                      style={{ width:'100%',border:'2px solid var(--border)',borderRadius:9,padding:'10px 12px',fontSize:14,boxSizing:'border-box' }}/>
                  </div>
                ))}
              </div>
              {[['Société','societe'],['Téléphone','numero'],['Email','email']].map(([label,field])=>(
                <div key={field}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--text-dim)',marginBottom:5,textTransform:'uppercase' }}>{label}</label>
                  <input value={editForm[field]||''} onChange={e=>setEditForm({...editForm,[field]:e.target.value})}
                    style={{ width:'100%',border:'2px solid var(--border)',borderRadius:9,padding:'10px 12px',fontSize:14,boxSizing:'border-box' }}/>
                </div>
              ))}
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'var(--text-dim)',marginBottom:5,textTransform:'uppercase' }}>Type</label>
                <select value={editForm.type_personnel||'roxgold'} onChange={e=>setEditForm({...editForm,type_personnel:e.target.value})}
                  style={{ width:'100%',border:'2px solid var(--border)',borderRadius:9,padding:'10px 12px',fontSize:14 }}>
                  <option value="roxgold">Agent Roxgold</option>
                  <option value="sous_traitant">Sous-traitant</option>
                  <option value="visiteur">Visiteur</option>
                </select>
              </div>
              <div style={{ display:'flex',gap:10,marginTop:4 }}>
                <button onClick={()=>setEditModal(null)}
                  style={{ flex:1,background:'var(--surface2)',color:'var(--text-dim)',border:'1px solid var(--border)',padding:'12px',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600 }}>
                  Annuler
                </button>
                <button onClick={saveEdit} disabled={editLoading}
                  style={{ flex:2,background:editLoading?'#94a3b8':'var(--blue)',color:'#fff',border:'none',padding:'12px',borderRadius:10,cursor:editLoading?'not-allowed':'pointer',fontSize:14,fontWeight:700 }}>
                  {editLoading ? '⏳ Sauvegarde...' : '💾 Enregistrer les modifications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
