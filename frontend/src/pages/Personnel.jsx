import React, { useEffect, useState, useCallback } from 'react'
import { personnel as personnelAPI, importCSV } from '../api'
import { useStore } from '../store'

// ── Constantes ──────────────────────────────────────────────────
const TYPES = [
  { value:'roxgold',      label:'Agent Roxgold',  badge:'#d97706', bg:'#fef3c7' },
  { value:'sous_traitant',label:'Sous-traitant',  badge:'#2563eb', bg:'#dbeafe' },
  { value:'visiteur',     label:'Visiteur',        badge:'#7c3aed', bg:'#ede9fe' },
]
const ROLES = [['admin','👑 Admin'],['agent','🏗️ Agent'],['restauration','🍽️ Resto'],['technicien','🔧 Tech'],['menage','🧹 Ménage']]
const EMPTY_FORM = {
  est_temporaire: false,
  duree_h: 24, nom:'', prenom:'', societe:'ROXGOLD', numero:'', email:'', type_personnel:'roxgold' }

// ── Badge type ───────────────────────────────────────────────────
function TypeBadge({ type }) {
  const t = TYPES.find(x => x.value === type) || TYPES[0]
  return <span style={{ background:t.bg, color:t.badge, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>{t.label}</span>
}

// ── Export CSV ───────────────────────────────────────────────────
function exportCSV(rows) {
  const H = ['Nom','Prénom','Société','Type','Téléphone','Email','Login','Actif','QR']
  const data = rows.map(p => [
    p.nom, p.prenom, p.societe, p.type_label||p.type_personnel,
    p.numero, p.email, p.login_genere, p.actif?'Oui':'Non', p.qr_code_string
  ])
  const csv = [H, ...data].map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'}))
  a.download = `personnel_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

// ════════════════════════════════════════════════════════════════
export default function Personnel() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'

  // Data
  const [data,       setData]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [apiErr,    setApiErr]    = useState('')
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Sélection en masse
  const [selected, setSelected] = useState(new Set())
  const [bulkRole, setBulkRole] = useState('')

  // Modals
  const [modal,        setModal]        = useState(null)  // 'create'
  const [editModal,    setEditModal]    = useState(null)  // objet personnel
  const [qrModal,      setQrModal]      = useState(null)
  const [importModal,  setImportModal]  = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importing,    setImporting]    = useState(false)

  // Formulaires
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [editForm,  setEditForm]  = useState({})
  const [submitting,setSubmitting]= useState(false)
  const [editSaving,setEditSaving]= useState(false)
  const [err,       setErr]       = useState('')

  // ── Chargement ──
  const load = useCallback(() => {
    setLoading(true)
    personnelAPI.list({ page_size:500 })
      .then(r => setData(r.data.results || r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── Filtrage ──
  const filtered = data.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || [p.nom,p.prenom,p.societe,p.email,p.login_genere].some(v => (v||'').toLowerCase().includes(q))
    const matchType   = !typeFilter || p.type_personnel === typeFilter
    return matchSearch && matchType
  })

  // ── KPIs ──
  const counts = TYPES.reduce((a,t) => ({ ...a, [t.value]: data.filter(p => p.type_personnel === t.value).length }), {})

  // ── Sélection ──
  const toggleSelect = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll    = ()  => setSelected(new Set(filtered.map(p => p.id)))
  const clearSelect  = ()  => setSelected(new Set())

  // ── Actions ──
  const del = async (id) => {
    if (!window.confirm('Supprimer ce membre ?')) return
    await personnelAPI.delete(id).catch(() => {})
    load()
  }

  const handleToggleActive = async (p) => {
    await personnelAPI.toggleActive(p.id).catch(() => {})
    load()
  }

  const regenCompte = async (p) => {
    if (!window.confirm(`Régénérer le compte de ${p.nom} ${p.prenom} ?`)) return
    const r = await personnelAPI.regenererCompte(p.id).catch(e => ({ data: e.response?.data }))
    if (r?.data) setQrModal({ ...p, ...r.data })
    load()
  }

  const openEdit = (p) => {
    setEditForm({ nom:p.nom||'', prenom:p.prenom||'', societe:p.societe||'', numero:p.numero||'', email:p.email||'', type_personnel:p.type_personnel||'roxgold' })
    setEditModal(p)
  }

  const saveEdit = async () => {
    if (!editForm.nom || !editForm.prenom) return setErr('Nom et Prénom requis')
    setEditSaving(true); setErr('')
    try {
      await personnelAPI.update(editModal.id, editForm)
      setEditModal(null)
      load()
    } catch(e) {
      setErr(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur')
    } finally { setEditSaving(false) }
  }

  const create = async () => {
    if (!form.nom || !form.prenom) return setErr('Nom et Prénom requis')
    setSubmitting(true); setErr('')
    try {
      await personnelAPI.create(form)
      setModal(null); setForm(EMPTY_FORM); load()
    } catch(e) { setErr(e.response?.data?.detail || 'Erreur') }
    finally { setSubmitting(false) }
  }

  // ── Action en masse ──
  const bulkAction = async (action) => {
    const ids = [...selected]
    if (!ids.length) return
    if (action === 'delete') {
      if (!window.confirm(`Supprimer ${ids.length} membre(s) ?`)) return
      await Promise.all(ids.map(id => personnelAPI.delete(id).catch(() => {})))
    } else if (action === 'role' && bulkRole) {
      await Promise.all(ids.map(id => personnelAPI.assigRole(id, bulkRole).catch(() => {})))
    } else if (action === 'deactivate') {
      await Promise.all(ids.map(id => personnelAPI.toggleActive(id).catch(() => {})))
    }
    clearSelect(); load()
  }

  // ── Import CSV ──
  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const r = await importCSV(file)
      setImportResult(r.data); load()
    } catch(e) { setImportResult({ error: e.response?.data?.error || 'Erreur import' }) }
    finally { setImporting(false); e.target.value = '' }
  }

  // ── Style helpers ──
  const btn = (bg, color, border='none') => ({
    background: bg, color, border, padding:'7px 14px', borderRadius:8,
    cursor:'pointer', fontSize:12, fontWeight:700, whiteSpace:'nowrap',
    transition:'.15s', fontFamily:'inherit'
  })
  const inputStyle = {
    width:'100%', border:'2px solid #e2e8f0', borderRadius:9,
    padding:'10px 12px', fontSize:14, boxSizing:'border-box', outline:'none', fontFamily:'inherit'
  }

  return (
    <div className="page page-xl">

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#1e3a8a', margin:0 }}>👤 Gestion du Personnel</h2>
          <p style={{ fontSize:13, color:'#64748b', margin:'4px 0 0' }}>
            {data.length} membres · Agents Roxgold · Sous-traitants · Visiteurs
          </p>
        </div>
        {isAdmin && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={()=>{setMasseResult(null);setMasseModal(true)}} style={{background:"#f59e0b",color:"#fff",border:"none",padding:"9px 14px",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:700}}>Sous-traitants masse</button>
            <button onClick={() => setImportModal(true)}
              style={btn('rgba(30,58,138,.1)','#1e3a8a','1px solid rgba(30,58,138,.3)')}>
              📥 Importer CSV
            </button>
            <button onClick={() => exportCSV(filtered)}
              style={btn('rgba(22,163,74,.1)','#16a34a','1px solid rgba(22,163,74,.3)')}>
              ⬇ Exporter CSV ({filtered.length})
            </button>
            <button onClick={() => { setModal('create'); setErr('') }}
              style={btn('#1e3a8a','#fff')}>
              + Déclarer un membre
            </button>
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10, marginBottom:18 }}>
        {TYPES.map(t => (
          <div key={t.value}
            onClick={() => setTypeFilter(typeFilter===t.value ? '' : t.value)}
            style={{ background:'#fff', border:`2px solid ${typeFilter===t.value ? t.badge : '#e2e8f0'}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'.15s' }}>
            <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:900, color:t.badge }}>{counts[t.value]||0}</div>
            <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginTop:2 }}>{t.label}</div>
          </div>
        ))}
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 16px' }}>
          <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:900, color:'#1e3a8a' }}>{data.length}</div>
          <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:1, marginTop:2 }}>Total</div>
        </div>
      </div>

      {/* ── FILTRES ── */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher nom, prénom, société..."
            style={{ ...inputStyle, paddingLeft:14 }} />
        </div>
        {typeFilter && (
          <button onClick={() => setTypeFilter('')}
            style={btn('rgba(220,38,38,.1)','#dc2626','1px solid rgba(220,38,38,.2)')}>
            ✕ {TYPES.find(t=>t.value===typeFilter)?.label}
          </button>
        )}
        {selected.size > 0 && isAdmin && (
          <div style={{ display:'flex', gap:6, alignItems:'center', padding:'4px 10px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#0369a1' }}>{selected.size} sélectionné(s)</span>
            <select value={bulkRole} onChange={e=>setBulkRole(e.target.value)}
              style={{ fontSize:12, border:'1px solid #bae6fd', borderRadius:6, padding:'4px 8px', background:'#fff' }}>
              <option value="">Changer rôle...</option>
              {ROLES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {bulkRole && <button onClick={()=>bulkAction('role')} style={btn('#2563eb','#fff')}>Appliquer rôle</button>}
            <button onClick={()=>bulkAction('deactivate')} style={btn('rgba(100,116,139,.1)','#64748b','1px solid #e2e8f0')}>⛔ Désact.</button>
            <button onClick={()=>bulkAction('delete')} style={btn('rgba(220,38,38,.1)','#dc2626','1px solid rgba(220,38,38,.2)')}>🗑 Suppr.</button>
            <button onClick={clearSelect} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>✕</button>
          </div>
        )}
      </div>

      {/* ── TABLEAU ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 12px rgba(30,58,138,.06)' }}>
        {loading ? (
          <div style={{ padding:48, textAlign:'center', color:'#94a3b8', fontSize:32 }}>⏳</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>👤</div>
            <div style={{ fontSize:14 }}>Aucun membre trouvé</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead>
                <tr style={{ background:'#1e3a8a' }}>
                  {isAdmin && (
                    <th style={{ padding:'10px 14px', textAlign:'center', width:40 }}>
                      <input type="checkbox"
                        checked={selected.size===filtered.length && filtered.length>0}
                        onChange={e => e.target.checked ? selectAll() : clearSelect()}
                        style={{ cursor:'pointer', accentColor:'#f0a500' }} />
                    </th>
                  )}
                  {['Nom & Prénom','Société','Type','Téléphone','Login','QR','Actions'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'rgba(255,255,255,.85)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} style={{ borderTop:'1px solid #f1f5f9', background: selected.has(p.id) ? '#eff6ff' : (i%2 ? '#fafafa' : '#fff'), transition:'.1s' }}>
                    {isAdmin && (
                      <td style={{ padding:'10px 14px', textAlign:'center' }}>
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                          style={{ cursor:'pointer', accentColor:'#2563eb' }} />
                      </td>
                    )}
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:13 }}>{p.nom} {p.prenom}</div>
                      {p.email && <div style={{ fontSize:11, color:'#94a3b8' }}>{p.email}</div>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#475569' }}>{p.societe || '—'}</td>
                    <td style={{ padding:'10px 14px' }}><TypeBadge type={p.type_personnel} /></td>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'#475569' }}>{p.numero || '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ fontSize:11, color:'#475569', fontFamily:'monospace' }}>{p.login_genere || '—'}</div>
                      {isAdmin ? (
                        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                          <span style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }} id={`pwd_${p.id}`}>••••••</span>
                          <button
                            onClick={e => {
                              const el = document.getElementById(`pwd_${p.id}`)
                              if (el.textContent === '••••••') {
                                el.textContent = p.password_genere || '(non défini)'
                                el.style.color = '#dc2626'
                                e.currentTarget.textContent = '🙈'
                              } else {
                                el.textContent = '••••••'
                                el.style.color = '#94a3b8'
                                e.currentTarget.textContent = '👁️'
                              }
                            }}
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, padding:0, lineHeight:1, color:'#94a3b8' }}
                            title="Voir/cacher le mot de passe">
                            👁️
                          </button>
                          {p.password_genere && (
                            <button
                              onClick={() => { navigator.clipboard.writeText(p.password_genere); alert('✅ Mot de passe copié !') }}
                              style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, padding:0, lineHeight:1 }}
                              title="Copier le mot de passe">
                              📋
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize:10, color:'#94a3b8' }}>••••••</div>
                      )}
                    </td>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>
                      {p.qr_code_data && (
                        <button onClick={() => setQrModal(p)}
                          style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, fontWeight:700, color:'#1e3a8a' }}>
                          🔲 QR
                        </button>
                      )}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {isAdmin && (
                          <select value={p.user_role||''} onChange={e => e.target.value && personnelAPI.assigRole(p.id, e.target.value).then(load)}
                            style={{ background:'#f0f4ff', color:'#2563eb', border:'1px solid #bfdbfe', padding:'4px 6px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, maxWidth:88 }}>
                            <option value="">⚙️ Rôle</option>
                            {ROLES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        )}
                        {isAdmin && (
                          <button onClick={() => openEdit(p)}
                            style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                            ✏️
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleToggleActive(p)}
                            style={{ background: p.user_active===false ? '#f0fdf4' : '#f8fafc', color: p.user_active===false ? '#16a34a' : '#64748b', border:'1px solid currentColor', padding:'4px 7px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                            {p.user_active===false ? '✅' : '⛔'}
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => regenCompte(p)}
                            title="Régénérer compte"
                            style={{ background:'#fffbeb', color:'#d97706', border:'1px solid #fde68a', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
                            🔑
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => del(p.id)}
                            style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ MODAL CRÉER ═══ */}
      {modal === 'create' && (
        <ModalWrapper title="+ Nouveau membre" onClose={() => setModal(null)}>
          <PersonnelForm form={form} setForm={setForm} err={err} inputStyle={inputStyle} />
          <ModalFooter onCancel={() => setModal(null)} onSave={create} saving={submitting} saveLabel="Créer le membre" />
        </ModalWrapper>
      )}

      {/* ═══ MODAL ÉDITER ═══ */}
      {editModal && (
        <ModalWrapper title={`✏️ Modifier — ${editModal.nom} ${editModal.prenom}`} onClose={() => setEditModal(null)}>
          {err && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#dc2626', fontWeight:600 }}>❌ {err}</div>}
          <PersonnelForm form={editForm} setForm={setEditForm} inputStyle={inputStyle} />
          <ModalFooter onCancel={() => setEditModal(null)} onSave={saveEdit} saving={editSaving} saveLabel="💾 Enregistrer" />
        </ModalWrapper>
      )}

      {/* ═══ MODAL QR ═══ */}
      {qrModal && (
        <ModalWrapper title={`📱 QR — ${qrModal.nom} ${qrModal.prenom}`} onClose={() => setQrModal(null)}>
          <div style={{ textAlign:'center', padding:'10px 0' }}>
            {qrModal.qr_code_data && (
              <img src={`data:image/png;base64,${qrModal.qr_code_data}`} alt="QR"
                style={{ width:220, height:220, imageRendering:'pixelated', border:'3px solid #1e3a8a', borderRadius:12, padding:8, background:'#fff' }} />
            )}
            <div style={{ marginTop:14, fontWeight:700, color:'#1e3a8a', fontSize:15 }}>{qrModal.nom} {qrModal.prenom}</div>
            {qrModal.login_genere && <div style={{ fontFamily:'monospace', color:'#64748b', marginTop:4 }}>{qrModal.login_genere} / {qrModal.password_genere||'••••••'}</div>}
          </div>
        </ModalWrapper>
      )}

      {/* ═══ MODAL IMPORT CSV ═══ */}
      {importModal && (
        <ModalWrapper title="📥 Importer du personnel" onClose={() => { setImportModal(false); setImportResult(null) }}>
          <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'12px 14px', marginBottom:16, fontSize:12, color:'#0369a1' }}>
            <b>Colonnes attendues (CSV ou Excel) :</b><br />
            <code>Nom, Prénom, Société, Poste/Type, Téléphone, Email</code>
          </div>
          <a href="#" onClick={e => {
            e.preventDefault()
            const csv = "Nom,Prénom,Société,Type,Téléphone,Email\nDIALLO,Mamadou,ROXGOLD,Agent Roxgold,0701020304,m.diallo@example.com"
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}))
            a.download = 'modele_personnel.csv'; a.click()
          }} style={{ fontSize:12, color:'#2563eb', display:'block', marginBottom:16, fontWeight:600 }}>
            ⬇ Télécharger le modèle CSV
          </a>
          <label style={{ display:'block', background:'#f8fafc', border:'2px dashed #e2e8f0', borderRadius:10, padding:'24px', textAlign:'center', cursor:'pointer' }}>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} style={{ display:'none' }} />
            <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
            <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:14 }}>Cliquer ou glisser un fichier</div>
            <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>CSV ou Excel (.xlsx)</div>
          </label>
          {importing && <div style={{ textAlign:'center', color:'#2563eb', fontWeight:600, marginTop:12 }}>⏳ Import en cours…</div>}
          {importResult && (
            <div style={{ marginTop:12, padding:'12px 14px', background: importResult.error ? '#fef2f2':'#f0fdf4', border:`1px solid ${importResult.error?'#fca5a5':'#86efac'}`, borderRadius:10, fontSize:13 }}>
              {importResult.error
                ? <span style={{ color:'#dc2626' }}>❌ {importResult.error}</span>
                : <><div style={{ fontWeight:700, color:'#16a34a' }}>✅ {importResult.message}</div>
                   {importResult.errors?.length > 0 && <ul style={{ fontSize:11, color:'#64748b', margin:'6px 0 0 16px' }}>{importResult.errors.map((e,i) => <li key={i}>{e}</li>)}</ul>}</>
              }
            </div>
          )}
        </ModalWrapper>
      )}
    </div>
  )

  {/* MODAL SOUS-TRAITANTS EN MASSE */}
  {masseModal && (
    <div style={{position:"fixed",inset:0,background:"rgba(15,36,71,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:16}}
      onClick={e=>e.target===e.currentTarget&&setMasseModal(false)}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:460,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Sous-Traitants en masse</div>
            <div style={{fontSize:11,opacity:.8,marginTop:2}}>Creer N acces temporaires pour une societe</div>
          </div>
          <button onClick={()=>setMasseModal(false)} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:28,height:28,borderRadius:8,cursor:"pointer",fontSize:16}}>X</button>
        </div>
        <div style={{padding:20}}>
          {!masseResult ? (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"#fef3c7",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#92400e"}}>
                Logins et mots de passe generes automatiquement
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5}}>SOCIETE *</div>
                <input value={masseForm.societe} onChange={e=>setMasseForm({...masseForm,societe:e.target.value})}
                  placeholder="Ex: SGBCI Mining, SAPH..."
                  style={{width:"100%",border:"2px solid #e2e8f0",borderRadius:9,padding:"10px 12px",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5}}>NOMBRE</div>
                  <input type="number" value={masseForm.nombre} onChange={e=>setMasseForm({...masseForm,nombre:parseInt(e.target.value)||1})}
                    min={1} max={100}
                    style={{width:"100%",border:"2px solid #e2e8f0",borderRadius:9,padding:"10px 12px",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:5}}>DUREE</div>
                  <select value={masseForm.duree_h} onChange={e=>setMasseForm({...masseForm,duree_h:parseInt(e.target.value)})}
                    style={{width:"100%",border:"2px solid #e2e8f0",borderRadius:9,padding:"10px 12px",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}>
                    <option value={24}>24h</option>
                    <option value={48}>48h</option>
                    <option value={72}>3 jours</option>
                    <option value={168}>1 semaine</option>
                    <option value={720}>1 mois</option>
                  </select>
                </div>
              </div>
              <button disabled={masseLoading} onClick={async()=>{
                if(!masseForm.societe.trim()) return alert("Societe requise")
                setMasseLoading(true)
                try {
                  const r = await personnelAPI.declarerMasse(masseForm)
                  setMasseResult(r.data)
                  load()
                } catch(e) { alert(e.response?.data?.error||"Erreur") }
                finally { setMasseLoading(false) }
              }} style={{background:masseLoading?"#94a3b8":"#f59e0b",color:"#fff",border:"none",padding:13,borderRadius:10,cursor:masseLoading?"wait":"pointer",fontSize:14,fontWeight:700,fontFamily:"inherit"}}>
                {masseLoading?"Creation...":"Creer "+masseForm.nombre+" agents "+masseForm.societe}
              </button>
            </div>
          ) : (
            <div>
              <div style={{background:"#f0fdf4",border:"1px solid #86efac",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
                <div style={{fontWeight:700,color:"#166534"}}>{masseResult.message}</div>
                <div style={{fontSize:11,color:"#16a34a"}}>Expire {masseResult.expire}</div>
              </div>
              <div style={{maxHeight:220,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:10}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#f8fafc"}}>
                    <th style={{padding:"8px 12px",textAlign:"left",color:"#64748b"}}>#</th>
                    <th style={{padding:"8px 12px",textAlign:"left",color:"#64748b"}}>Login</th>
                    <th style={{padding:"8px 12px",textAlign:"left",color:"#64748b"}}>Mot de passe</th>
                  </tr></thead>
                  <tbody>
                    {masseResult.agents?.map((a,i)=>(
                      <tr key={i} style={{borderTop:"1px solid #f1f5f9",background:i%2?"#fafafa":"#fff"}}>
                        <td style={{padding:"7px 12px",color:"#94a3b8"}}>{i+1}</td>
                        <td style={{padding:"7px 12px",fontFamily:"monospace",fontWeight:700,color:"#1e3a8a"}}>{a.login}</td>
                        <td style={{padding:"7px 12px",fontFamily:"monospace",color:"#dc2626"}}>{a.pwd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{display:"flex",gap:10,marginTop:14}}>
                <button onClick={()=>{
                  const txt = (masseResult.agents||[]).map(a=>a.login+" / "+a.pwd).join(", ")
                  navigator.clipboard.writeText(txt).then(()=>alert("Copie!"))
                }} style={{flex:1,background:"#1e3a8a",color:"#fff",border:"none",padding:11,borderRadius:9,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>
                  Copier identifiants
                </button>
                <button onClick={()=>{setMasseResult(null);setMasseForm({societe:"",nombre:5,duree_h:72})}}
                  style={{flex:1,background:"#f59e0b",color:"#fff",border:"none",padding:11,borderRadius:9,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>
                  Nouvelle declaration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )}

}