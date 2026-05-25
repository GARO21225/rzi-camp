/**
 * Personnel — Gestion des membres, QR codes, sous-traitants
 * Version stable - Erreurs gérées par Error Boundary
 */
import React, { useState, useCallback, useEffect } from 'react'
import { personnel as personnelAPI } from '../api'

// ── Error Boundary ───────────────────────────────────────
class PersonnelBoundary extends React.Component {
  constructor(p) { super(p); this.state = {err: null} }
  static getDerivedStateFromError(e) { return {err: e.message || 'Erreur'} }
  componentDidCatch(e) { console.error('Personnel crash:', e) }
  render() {
    if (this.state.err) return (
      <div style={{padding:40,textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
        <div style={{fontWeight:700,color:'#dc2626',fontSize:16,marginBottom:8}}>Erreur d\'affichage</div>
        <div style={{color:'#64748b',fontSize:12,marginBottom:16,maxWidth:400,margin:'0 auto 16px'}}>
          {this.state.err}
        </div>
        <button onClick={()=>this.setState({err:null})}
          style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'10px 24px',
            borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700}}>
          🔄 Réessayer
        </button>
      </div>
    )
    return this.props.children
  }
}

// ── Composant principal ──────────────────────────────────
export default function Personnel() {
  const [data,         setData]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('')
  const [modal,        setModal]        = useState(null)   // null | 'new' | personnel object
  const [qrModal,      setQrModal]      = useState(null)
  const [masseModal,   setMasseModal]   = useState(false)
  const [masseForm,    setMasseForm]    = useState({societe:'', nombre:5, duree_h:72})
  const [masseResult,  setMasseResult]  = useState(null)
  const [masseLoading, setMasseLoading] = useState(false)
  const [form,         setForm]         = useState({
    nom:'', prenom:'', email:'', telephone:'',
    societe:'', type_personnel:'employe', numero:'', actif:true
  })
  const [saving,       setSaving]       = useState(false)
  const [err,          setErr]          = useState('')
  const [confirmDel,   setConfirmDel]   = useState(null)   // Personnel à supprimer
  const [roleModal,    setRoleModal]    = useState(null)   // Personnel dont on change le rôle
  const [newRole,      setNewRole]      = useState('')

  const load = useCallback(() => {
    setLoading(true)
    personnelAPI.list({ page_size:500 })
      .then(r => setData(r.data.results || r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Filtrage
  const filtered = data.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || [p.nom,p.prenom,p.email,p.societe,p.numero]
      .some(v => (v||'').toLowerCase().includes(q))
    const matchType = !typeFilter || p.type_personnel === typeFilter
    return matchSearch && matchType
  })

  // Sauvegarde
  const handleSave = async () => {
    if (!form.nom || !form.prenom) { setErr('Nom et prénom requis'); return }
    setSaving(true); setErr('')
    try {
      if (modal && modal.id) {
        await personnelAPI.update(modal.id, form)
      } else {
        await personnelAPI.create(form)
      }
      setModal(null)
      setForm({nom:'',prenom:'',email:'',telephone:'',societe:'',type_personnel:'employe',numero:'',actif:true})
      load()
    } catch(e) {
      setErr(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur')
    } finally { setSaving(false) }
  }

  const handleDelete = async (p) => {
    try {
      await personnelAPI.delete(p.id)
      setConfirmDel(null)
      load()
    } catch(e) { alert(e.response?.data?.detail || 'Erreur suppression') }
  }

  const handleToggleActif = async (p) => {
    try {
      await personnelAPI.update(p.id, { actif: !p.actif })
      load()
    } catch(e) { alert('Erreur') }
  }

  const handleChangeRole = async () => {
    if (!roleModal || !newRole) return
    try {
      await personnelAPI.update(roleModal.id, { type_personnel: newRole })
      setRoleModal(null); load()
    } catch(e) { alert('Erreur changement de rôle') }
  }

  // Styles
  const inp = {
    width:'100%', border:'2px solid #e2e8f0', borderRadius:9,
    padding:'10px 12px', fontSize:13, outline:'none', fontFamily:'inherit',
    boxSizing:'border-box'
  }
  const btn = (bg, color='#fff') => ({
    background:bg, color, border:'none', padding:'9px 16px', borderRadius:9,
    cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit'
  })

  const TYPES = [
    {v:'employe', l:'Employé'},
    {v:'soustraitant', l:'Sous-traitant'},
    {v:'visiteur', l:'Visiteur'},
    {v:'roxgold', l:'Roxgold'},
  ]

  return (
    <PersonnelBoundary>
      <div className="page" style={{maxWidth:1100, margin:'0 auto'}}>

        {/* ── HEADER ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
          <div>
            <h2 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>
              👤 Gestion du Personnel
            </h2>
            <p style={{fontSize:12,color:'#64748b',margin:'4px 0 0'}}>
              {data.length} membres enregistrés
            </p>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button onClick={()=>{setMasseResult(null);setMasseModal(true)}}
              style={btn('#f59e0b')}>
              👥 Sous-traitants masse
            </button>
            <button onClick={()=>{
              setForm({nom:'',prenom:'',email:'',telephone:'',societe:'',type_personnel:'employe',numero:'',actif:true})
              setErr(''); setModal('new')
            }} style={btn('#1e3a8a')}>
              ➕ Nouveau membre
            </button>
          </div>
        </div>

        {/* ── FILTRES ── */}
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Rechercher nom, email, société..."
            style={{...inp,maxWidth:300}}/>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
            style={{...inp,maxWidth:160}}>
            <option value="">Tous les types</option>
            {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>

        {/* ── TABLE ── */}
        {loading ? (
          <div style={{textAlign:'center',padding:60,fontSize:36}}>⏳</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:60,color:'#94a3b8'}}>
            <div style={{fontSize:48,marginBottom:12}}>👤</div>
            <div>Aucun membre trouvé</div>
          </div>
        ) : (
          <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,.08)'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                  {['Nom','Type','Société','Contact','QR','Actions'].map(h => (
                    <th key={h} style={{padding:'12px 14px',textAlign:'left',fontSize:11,
                      fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:.5}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9',
                    background:i%2===0?'#fff':'#fafbfc'}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontWeight:600,color:'#1e293b'}}>{p.nom} {p.prenom}</div>
                      <div style={{fontSize:11,color:'#94a3b8'}}>{p.email}</div>
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <span style={{
                        background: p.type_personnel==='roxgold'?'#1e3a8a20':
                          p.type_personnel==='soustraitant'?'#f59e0b20':
                          p.type_personnel==='visiteur'?'#16a34a20':'#e2e8f0',
                        color: p.type_personnel==='roxgold'?'#1e3a8a':
                          p.type_personnel==='soustraitant'?'#b45309':
                          p.type_personnel==='visiteur'?'#16a34a':'#475569',
                        padding:'3px 8px',borderRadius:99,fontSize:11,fontWeight:700
                      }}>
                        {TYPES.find(t=>t.v===p.type_personnel)?.l || p.type_personnel}
                      </span>
                    </td>
                    <td style={{padding:'10px 14px',fontSize:12,color:'#475569'}}>
                      {p.societe || '—'}
                    </td>
                    <td style={{padding:'10px 14px',fontSize:12,color:'#475569'}}>
                      {p.telephone || '—'}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      {p.qr_code_data ? (
                        <button onClick={() => setQrModal(p)}
                          style={{background:'#f8fafc',border:'1px solid #e2e8f0',
                            borderRadius:6,padding:'4px 8px',cursor:'pointer',
                            fontSize:11,fontWeight:700,color:'#1e3a8a'}}>
                          🔲 QR
                        </button>
                      ) : (
                        <span style={{fontSize:11,color:'#94a3b8'}}>—</span>
                      )}
                    </td>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          <button onClick={() => {
                            setForm({
                              nom:p.nom, prenom:p.prenom, email:p.email||'',
                              telephone:p.telephone||'', societe:p.societe||'',
                              type_personnel:p.type_personnel||'employe',
                              numero:p.numero||'', actif:p.actif
                            })
                            setErr(''); setModal(p)
                          }} style={{background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',
                            padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700,title:'Modifier'}}>
                            ✏️
                          </button>
                          <button onClick={() => {setNewRole(p.type_personnel);setRoleModal(p)}}
                            style={{background:'#f5f3ff',color:'#7c3aed',border:'1px solid #c4b5fd',
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title="Changer le rôle">
                            🎭
                          </button>
                          <button onClick={() => handleToggleActif(p)}
                            style={{background:p.actif?'#fef3c7':'#f0fdf4',
                              color:p.actif?'#b45309':'#16a34a',
                              border:'1px solid '+(p.actif?'#fde68a':'#86efac'),
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title={p.actif?'Désactiver':'Activer'}>
                            {p.actif ? '🔒' : '🔓'}
                          </button>
                          <button onClick={() => setConfirmDel(p)}
                            style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',
                              padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}
                            title="Supprimer">
                            🗑️
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ MODAL CRÉER/MODIFIER ══ */}
        {modal && (
          <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
            onClick={e=>e.target===e.currentTarget&&setModal(null)}>
            <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:500,
              overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
              <div style={{background:'linear-gradient(135deg,#1e3a8a,#2563eb)',color:'#fff',
                padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontWeight:700,fontSize:15}}>
                  {modal==='new' ? '➕ Nouveau membre' : `✏️ Modifier — ${modal.nom} ${modal.prenom}`}
                </div>
                <button onClick={()=>setModal(null)}
                  style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                    width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
              </div>
              <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
                {err && (
                  <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,
                    padding:'8px 12px',color:'#dc2626',fontSize:12}}>
                    ❌ {err}
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>NOM *</label>
                    <input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>PRÉNOM *</label>
                    <input value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} style={inp}/>
                  </div>
                </div>
                <div>
                  <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>EMAIL</label>
                  <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={inp}/>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>TÉLÉPHONE</label>
                    <input value={form.telephone} onChange={e=>setForm({...form,telephone:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>TYPE</label>
                    <select value={form.type_personnel} onChange={e=>setForm({...form,type_personnel:e.target.value})} style={inp}>
                      {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>SOCIÉTÉ</label>
                    <input value={form.societe} onChange={e=>setForm({...form,societe:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>N° MATRICULE</label>
                    <input value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})} style={inp}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:10,marginTop:4}}>
                  <button onClick={()=>setModal(null)}
                    style={{flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',
                      padding:12,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                    Annuler
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{flex:2,background:saving?'#94a3b8':'#1e3a8a',color:'#fff',border:'none',
                      padding:12,borderRadius:9,cursor:saving?'wait':'pointer',fontFamily:'inherit',
                      fontSize:13,fontWeight:700}}>
                    {saving ? '⏳ Enregistrement...' : '💾 Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL QR ══ */}
        {qrModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
            onClick={e=>e.target===e.currentTarget&&setQrModal(null)}>
            <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:340,
              overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
              <div style={{background:'linear-gradient(135deg,#1e3a8a,#2563eb)',color:'#fff',
                padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontWeight:700}}>🔲 QR — {qrModal.nom} {qrModal.prenom}</div>
                <button onClick={()=>setQrModal(null)}
                  style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                    width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
              </div>
              <div style={{padding:24,textAlign:'center'}}>
                {qrModal.qr_code_data ? (
                  <img src={"data:image/png;base64," + qrModal.qr_code_data}
                    alt="QR Code" style={{width:200,height:200,imageRendering:'pixelated',
                      border:'3px solid #1e3a8a',borderRadius:12,padding:8}}/>
                ) : (
                  <div style={{width:200,height:200,background:'#f8fafc',border:'2px dashed #e2e8f0',
                    borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#94a3b8',fontSize:12,margin:'0 auto'}}>
                    QR non disponible
                  </div>
                )}
                <div style={{marginTop:12,fontWeight:700,color:'#1e3a8a',fontSize:14}}>
                  {qrModal.nom} {qrModal.prenom}
                </div>
                <div style={{fontSize:11,color:'#64748b',marginTop:4}}>
                  {qrModal.societe} · {TYPES.find(t=>t.v===qrModal.type_personnel)?.l}
                </div>
                {qrModal.login_genere && (
                  <div style={{marginTop:8,background:'#f8fafc',borderRadius:8,padding:'8px 12px',
                    fontFamily:'monospace',fontSize:12,color:'#1e3a8a'}}>
                    Login: {qrModal.login_genere}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL SOUS-TRAITANTS EN MASSE ══ */}
        {masseModal && (
          <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
            onClick={e=>e.target===e.currentTarget&&setMasseModal(false)}>
            <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:480,
              overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
              <div style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',color:'#fff',
                padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15}}>👥 Sous-Traitants en masse</div>
                  <div style={{fontSize:11,opacity:.8,marginTop:2}}>
                    Génère N accès temporaires pour une société
                  </div>
                </div>
                <button onClick={()=>{setMasseModal(false);setMasseResult(null)}}
                  style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                    width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
              </div>
              <div style={{padding:20}}>
                {masseResult === null ? (
                  <div style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div style={{background:'#fef3c7',borderRadius:10,padding:'10px 14px',
                      fontSize:12,color:'#92400e'}}>
                      💡 Logins et mots de passe générés automatiquement
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:11,fontWeight:700,
                        color:'#64748b',marginBottom:5}}>SOCIÉTÉ *</label>
                      <input value={masseForm.societe}
                        onChange={e=>setMasseForm({...masseForm,societe:e.target.value})}
                        placeholder="Ex: SGBCI Mining, SAPH..."
                        style={inp}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:700,
                          color:'#64748b',marginBottom:5}}>NOMBRE</label>
                        <input type="number" value={masseForm.nombre}
                          onChange={e=>setMasseForm({...masseForm,nombre:parseInt(e.target.value)||1})}
                          min={1} max={100} style={inp}/>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:11,fontWeight:700,
                          color:'#64748b',marginBottom:5}}>DURÉE</label>
                        <select value={masseForm.duree_h}
                          onChange={e=>setMasseForm({...masseForm,duree_h:parseInt(e.target.value)})}
                          style={inp}>
                          <option value={24}>24 heures</option>
                          <option value={48}>48 heures</option>
                          <option value={72}>3 jours</option>
                          <option value={168}>1 semaine</option>
                          <option value={720}>1 mois</option>
                        </select>
                      </div>
                    </div>
                    <button disabled={masseLoading}
                      onClick={async () => {
                        if (!masseForm.societe.trim()) { alert('Société requise'); return }
                        setMasseLoading(true)
                        try {
                          const r = await personnelAPI.declarerMasse(masseForm)
                          setMasseResult(r.data)
                          load()
                        } catch(e) {
                          alert(e.response?.data?.error || 'Erreur serveur')
                        } finally {
                          setMasseLoading(false)
                        }
                      }}
                      style={{background:masseLoading?'#94a3b8':'#f59e0b',color:'#fff',
                        border:'none',padding:13,borderRadius:10,cursor:masseLoading?'wait':'pointer',
                        fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
                      {masseLoading ? '⏳ Création...' : ("Créer " + masseForm.nombre + " agents — " + masseForm.societe)}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:12,
                      padding:'12px 16px',marginBottom:16}}>
                      <div style={{fontWeight:700,color:'#166534'}}>{masseResult.message}</div>
                      <div style={{fontSize:11,color:'#16a34a'}}>Expire: {masseResult.expire}</div>
                    </div>
                    <div style={{maxHeight:220,overflowY:'auto',border:'1px solid #e2e8f0',
                      borderRadius:10,overflow:'hidden'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                        <thead>
                          <tr style={{background:'#f8fafc'}}>
                            {['#','Login','Mot de passe'].map(h=>(
                              <th key={h} style={{padding:'8px 12px',textAlign:'left',
                                color:'#64748b',fontWeight:700}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(masseResult.agents||[]).map((a,i)=>(
                            <tr key={i} style={{borderTop:'1px solid #f1f5f9',
                              background:i%2?'#fafafa':'#fff'}}>
                              <td style={{padding:'7px 12px',color:'#94a3b8'}}>{i+1}</td>
                              <td style={{padding:'7px 12px',fontFamily:'monospace',
                                fontWeight:700,color:'#1e3a8a'}}>{a.login}</td>
                              <td style={{padding:'7px 12px',fontFamily:'monospace',
                                color:'#dc2626'}}>{a.pwd}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{display:'flex',gap:10,marginTop:14}}>
                      <button onClick={()=>{
                        const txt = (masseResult.agents||[]).map(a=>a.login+' / '+a.pwd).join('\n')
                        navigator.clipboard.writeText(txt).then(()=>alert('Copié !'))
                      }} style={{flex:1,background:'#1e3a8a',color:'#fff',border:'none',
                        padding:11,borderRadius:9,cursor:'pointer',fontWeight:700,fontFamily:'inherit',fontSize:12}}>
                        📋 Copier
                      </button>
                      <button onClick={()=>{
                        setMasseResult(null)
                        setMasseForm({societe:'',nombre:5,duree_h:72})
                      }} style={{flex:1,background:'#f59e0b',color:'#fff',border:'none',
                        padding:11,borderRadius:9,cursor:'pointer',fontWeight:700,fontFamily:'inherit',fontSize:12}}>
                        👥 Nouvelle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* ══ MODAL CONFIRMER SUPPRESSION ══ */}
      {confirmDel && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setConfirmDel(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:380,
            overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',color:'#fff',
              padding:'14px 20px'}}>
              <div style={{fontWeight:700}}>🗑️ Supprimer le membre</div>
            </div>
            <div style={{padding:20}}>
              <p style={{color:'#1e293b',fontSize:14,margin:'0 0 16px'}}>
                Confirmer la suppression de <strong>{confirmDel.nom} {confirmDel.prenom}</strong> ?
                <br/><span style={{color:'#dc2626',fontSize:12}}>⚠️ Action irréversible</span>
              </p>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setConfirmDel(null)}
                  style={{flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={()=>handleDelete(confirmDel)}
                  style={{flex:1,background:'#dc2626',color:'#fff',border:'none',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700}}>
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CHANGER RÔLE ══ */}
      {roleModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setRoleModal(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:380,
            overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'#fff',
              padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:700}}>🎭 Changer le rôle</div>
              <button onClick={()=>setRoleModal(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                  width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20}}>
              <p style={{fontSize:13,color:'#64748b',margin:'0 0 12px'}}>
                Rôle actuel de <strong>{roleModal.nom} {roleModal.prenom}</strong> :
                <span style={{fontWeight:700,color:'#7c3aed',marginLeft:6}}>
                  {TYPES.find(t=>t.v===roleModal.type_personnel)?.l || roleModal.type_personnel}
                </span>
              </p>
              <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={inp}>
                {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <div style={{display:'flex',gap:10,marginTop:12}}>
                <button onClick={()=>setRoleModal(null)}
                  style={{flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                  Annuler
                </button>
                <button onClick={handleChangeRole}
                  style={{flex:2,background:'#7c3aed',color:'#fff',border:'none',
                    padding:11,borderRadius:9,cursor:'pointer',fontFamily:'inherit',
                    fontSize:13,fontWeight:700}}>
                  💾 Changer le rôle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </PersonnelBoundary>
  )
}
