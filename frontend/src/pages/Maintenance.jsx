/**
 * Maintenance — Gestion des incidents QHSE
 * Réécriture complète — zéro patch accumulé — Error Boundary intégré
 */
import React, { useState, useEffect, useCallback } from 'react'
import { incidents as incAPI } from '../api'
import { useStore } from '../store'

class MaintenanceBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(e) { return { err: e } }
  componentDidCatch(e) { console.error('[Maintenance crash]', e) }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
        <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 16, marginBottom: 8 }}>
          Erreur dans Maintenance
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
          padding: '10px 16px', fontSize: 11, color: '#991b1b', maxWidth: 400,
          margin: '0 auto 16px', fontFamily: 'monospace' }}>
          {String(this.state.err?.message || this.state.err)}
        </div>
        <button onClick={() => this.setState({ err: null })}
          style={{ background: '#1e3a8a', color: '#fff', border: 'none',
            padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          Réessayer
        </button>
      </div>
    )
    return this.props.children
  }
}

const STATUTS = {
  declare:  { l: 'Déclaré',  c: '#3b82f6', bg: '#eff6ff' },
  assigne:  { l: 'Assigné',  c: '#f97316', bg: '#fff7ed' },
  en_cours: { l: 'En cours', c: '#eab308', bg: '#fefce8' },
  resolu:   { l: 'Résolu',   c: '#16a34a', bg: '#f0fdf4' },
  cloture:  { l: 'Clôturé',  c: '#64748b', bg: '#f8fafc' },
}
const PRIOS = {
  critique: { l: 'Critique', c: '#dc2626' },
  haute:    { l: 'Haute',    c: '#f97316' },
  moyenne:  { l: 'Moyenne',  c: '#eab308' },
  basse:    { l: 'Basse',    c: '#16a34a' },
}
const CATS = ['Plomberie','Electricite','Climatisation','Serrurerie','Toiture','Peinture','Informatique','Autre']
const WF = [
  { s: 'declare',  icon: '📢', l: 'Déclaré' },
  { s: 'assigne',  icon: '👷', l: 'Assigné' },
  { s: 'en_cours', icon: '⚙️',  l: 'En cours' },
  { s: 'resolu',   icon: '✅', l: 'Résolu' },
  { s: 'cloture',  icon: '🔒', l: 'Clôturé' },
]

export default function Maintenance() {
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser)
  const [incidents, setIncidents] = useState([])
  const [stats,     setStats]     = useState({})
  const [techns,    setTechns]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)
  const [editInc,   setEditInc]   = useState(null)
  const [showEdit,  setShowEdit]  = useState(false)
  const [search,    setSearch]    = useState('')
  const [statFilter, setStatFilter] = useState('')
  const [prioFilter, setPrioFilter] = useState('')
  const [slaOnly,    setSlaOnly]    = useState(false)
  const [showNew,    setShowNew]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err,        setErr]        = useState('')
  const EMPTY = { titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'', bloc:'', photo_b64:'' }
  const [form, setForm] = useState(EMPTY)
  const [actionModal, setActionModal] = useState(null)
  const [actionComment, setActionComment] = useState('')
  const [actionTechId,  setActionTechId]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ri, rs, rt] = await Promise.allSettled([
        incAPI.list({ page_size:100 }),
        incAPI.stats(),
        incAPI.techniciens ? incAPI.techniciens() : Promise.resolve({data:[]}),
      ])
      if (ri.status === 'fulfilled') setIncidents(ri.value.data.results || ri.value.data || [])
      if (rs.status === 'fulfilled') setStats(rs.value.data || {})
      if (rt.status === 'fulfilled') setTechns(rt.value.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = incidents.filter(i => {
    if (search && ![i.titre,i.residence,i.categorie,i.auteur_nom].some(v=>(v||''). toLowerCase().includes(search.toLowerCase()))) return false
    if (statFilter && i.statut !== statFilter) return false
    if (prioFilter && i.priorite !== prioFilter) return false
    if (slaOnly && !i.sla_depasse) return false
    return true
  })

  const declarer = async () => {
    if (!form.titre || !form.description || !form.residence) { setErr('Titre, description et résidence requis'); return }
    setSubmitting(true); setErr('')
    try {
      const payload = { titre:form.titre, description:form.description, categorie:form.categorie,
        priorite:form.priorite, residence:form.residence, bloc:form.bloc }
      if (form.photo_b64 && form.photo_b64.startsWith('data:')) {
        const parts = form.photo_b64.split(',')
        payload.photo_mime = form.photo_b64.split(';')[0].replace('data:','') || 'image/jpeg'
        payload.photo_base64 = parts[1] || ''
      }
      await incAPI.declarer(payload)
      setShowNew(false); setForm(EMPTY); await load()
    } catch(e) {
      setErr(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur serveur')
    } finally { setSubmitting(false) }
  }

  const doAction = async (action) => {
    if (!selected) return
    setSubmitting(true)
    try {
      if (action === 'assigner')  await incAPI.assigner(selected.id, { technicien_id: actionTechId })
      if (action === 'commencer') await incAPI.commencer(selected.id, { commentaire: actionComment })
      if (action === 'resoudre')  await incAPI.resoudre(selected.id, { commentaire: actionComment })
      if (action === 'cloturer')  await incAPI.cloturer(selected.id, { commentaire: actionComment })
      if (action === 'commenter') {
        const fn = incAPI.addComment || incAPI.commenter
        await fn(selected.id, { contenu: actionComment, type_comment: 'info' })
      }
      setActionModal(null); setActionComment(''); setActionTechId('')
      await load()
      const updated = await incAPI.list({ page_size:100 })
      const items = updated.data.results || updated.data || []
      setSelected(items.find(i => i.id === selected.id) || null)
    } catch(e) { alert(e.response?.data?.detail || 'Erreur action') }
    finally { setSubmitting(false) }
  }

  const uploadPhoto = (type_comment) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file || file.size > 3*1024*1024) { alert('Max 3Mo'); return }
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const b64 = (ev.target.result || '').split(',')[1] || ''
        try {
          const fn = incAPI.addComment || incAPI.commenter
          await fn(selected.id, { type_comment, contenu: 'Photo '+type_comment.replace('_',' '), photo_base64: b64 })
          await load()
          const updated = await incAPI.list({ page_size:100 })
          const items = updated.data.results || updated.data || []
          setSelected(items.find(i => i.id === selected.id) || null)
        } catch(err2) { alert('Erreur upload') }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9,
    padding:'10px 12px', fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  return (
    <MaintenanceBoundary>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:20 }}>

        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <h2 style={{ fontSize:22, fontWeight:900, color:'#1e3a8a', margin:0 }}>
              🔧 Maintenance
            </h2>
            <p style={{ fontSize:11, color:'#64748b', margin:'3px 0 0' }}>
              Workflow · SLA · Assignation · Historique
            </p>
          </div>
          <button onClick={() => { setForm(EMPTY); setErr(''); setShowNew(true) }}
            style={{ background:'#1e3a8a', color:'#fff', border:'none',
              padding:'10px 20px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            + Déclarer un incident
          </button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',
          gap:10, marginBottom:20 }}>
          {[['📢 Déclarés',stats.declare||0,'#3b82f6'],['👷 Assignés',stats.assigne||0,'#f97316'],
            ['⚙️ En cours',stats.en_cours||0,'#eab308'],['✅ Résolus',stats.resolu||0,'#16a34a'],
            ['⚠️ SLA',stats.sla_depasses||0,'#dc2626'],['🔴 Critiques',stats.critique||0,'#7c3aed']
          ].map(([l,v,c]) => (
            <div key={l} style={{ background:'#fff', borderRadius:12, padding:'12px 14px',
              borderTop:`3px solid ${c}`, boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
              <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:c }}>{v}</div>
              <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Rechercher..."
            style={{ ...inp, maxWidth:220 }} />
          <select value={statFilter} onChange={e=>setStatFilter(e.target.value)} style={{ ...inp, maxWidth:130 }}>
            <option value="">Tous statuts</option>
            {Object.entries(STATUTS).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <select value={prioFilter} onChange={e=>setPrioFilter(e.target.value)} style={{ ...inp, maxWidth:130 }}>
            <option value="">Toutes priorités</option>
            {Object.entries(PRIOS).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6,
            fontSize:12, fontWeight:700, color:'#dc2626', cursor:'pointer' }}>
            <input type="checkbox" checked={slaOnly} onChange={e=>setSlaOnly(e.target.checked)} />
            ⚠️ SLA dépassé
          </label>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60, fontSize:32 }}>⏳</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔧</div>
            <div style={{ fontWeight:600 }}>Aucun incident</div>
            <div style={{ fontSize:12 }}>Cliquer sur "Déclarer un incident"</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(inc => {
              const st = STATUTS[inc.statut] || STATUTS.declare
              const pr = PRIOS[inc.priorite] || PRIOS.moyenne
              const wfIdx = WF.findIndex(x => x.s === inc.statut)
              return (
                <div key={inc.id} onClick={() => setSelected(inc)}
                  style={{ background:'#fff', borderRadius:12, padding:'14px 16px',
                    boxShadow:'0 1px 4px rgba(0,0,0,.07)', cursor:'pointer',
                    borderLeft:`4px solid ${st.c}`,
                    outline: selected?.id === inc.id ? `2px solid ${st.c}` : 'none' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'#1e293b', marginBottom:3 }}>
                        {inc.titre}
                        {inc.sla_depasse && <span style={{ background:'#fef2f2', color:'#dc2626',
                          fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, marginLeft:8 }}>SLA ⚠️</span>}
                      </div>
                      <div style={{ fontSize:12, color:'#64748b' }}>
                        📍 {inc.residence}{inc.bloc ? ` · ${inc.bloc}` : ''} · {inc.categorie} · {inc.auteur_nom}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
                      <span style={{ background:pr.c+'20', color:pr.c, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>{pr.l}</span>
                      <span style={{ background:st.bg, color:st.c, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>{st.l}</span>
                      {isAdmin && (
                        <>
                          <button onClick={e=>{e.stopPropagation();setEditInc({...inc});setShowEdit(true)}}
                            title="Modifier l'incident"
                            style={{ background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',
                              padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700 }}>
                            ✏️
                          </button>
                          <button onClick={e=>{e.stopPropagation();
                            if(window.confirm(`Supprimer l'incident "${inc.titre}" ?`))
                              incAPI.supprimer(inc.id).then(()=>load()).catch(e=>alert('Erreur suppression: '+(e.response?.data?.detail||e.message||'inconnue')))
                          }}
                            title="Supprimer l'incident"
                            style={{ background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',
                              padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700 }}>
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:10 }}>
                    {WF.map((w,i) => (
                      <React.Fragment key={w.s}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:50 }}>
                          <div style={{ width:24, height:24, borderRadius:'50%',
                            background: i<=wfIdx ? st.c : '#e2e8f0',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:10, fontWeight:900, color: i<=wfIdx ? '#fff' : '#94a3b8' }}>
                            {i<=wfIdx ? (i===wfIdx ? w.icon : '✓') : i+1}
                          </div>
                          <div style={{ fontSize:8, color: i<=wfIdx ? st.c : '#94a3b8', marginTop:2 }}>{w.l}</div>
                        </div>
                        {i < WF.length-1 && <div style={{ flex:1, height:2,
                          background: i<wfIdx ? st.c : '#e2e8f0', marginBottom:16, minWidth:8 }}/>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══ MODAL DÉCLARER ══ */}
        {showNew && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.7)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
            onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
            <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520,
              maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#fff',
                padding:'14px 20px', position:'sticky', top:0, display:'flex',
                justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, fontSize:15 }}>🔧 Déclarer un incident</div>
                <button onClick={()=>setShowNew(false)}
                  style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                    width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                {err && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8,
                  padding:'8px 12px', color:'#dc2626', fontSize:12 }}>❌ {err}</div>}
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>TITRE *</label>
                  <input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})}
                    placeholder="Titre de l'incident..." style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DESCRIPTION *</label>
                  <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                    placeholder="Décrivez le problème..." rows={3} style={{ ...inp, resize:'vertical' }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>CATÉGORIE</label>
                    <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} style={inp}>
                      {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>PRIORITÉ</label>
                    <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={inp}>
                      {Object.entries(PRIOS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>RÉSIDENCE *</label>
                    <input value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})}
                      placeholder="Ex: B-12, VIP..." style={inp}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>BLOC / CHAMBRE</label>
                    <input value={form.bloc} onChange={e=>setForm({...form,bloc:e.target.value})}
                      placeholder="Ex: Bloc 3, Ch. 12" style={inp}/>
                  </div>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                  background: form.photo_b64 ? '#f0fdf4' : '#f8fafc',
                  border: `2px dashed ${form.photo_b64 ? '#16a34a' : '#e2e8f0'}`,
                  borderRadius:10, cursor:'pointer', fontSize:12,
                  color: form.photo_b64 ? '#16a34a' : '#64748b' }}>
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e=>{
                      const file=e.target.files?.[0]
                      if(!file) return
                      if(file.size>3*1024*1024){alert('Max 3Mo');return}
                      const r=new FileReader()
                      r.onload=ev=>setForm(f=>({...f,photo_b64:ev.target.result}))
                      r.readAsDataURL(file)
                    }}/>
                  {form.photo_b64 ? '✅ Photo ajoutée' : '📷 Photo (optionnel, max 3Mo)'}
                </label>
                <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8,
                  padding:'8px 12px', fontSize:11, color:'#92400e' }}>
                  ⏱️ SLA assigné automatiquement selon la priorité
                </div>
                <button onClick={declarer} disabled={submitting}
                  style={{ background:submitting?'#94a3b8':'#1e3a8a', color:'#fff', border:'none',
                    padding:13, borderRadius:10, cursor:submitting?'wait':'pointer',
                    fontSize:14, fontWeight:700, fontFamily:'inherit' }}>
                  {submitting ? '⏳ Envoi...' : '🔧 Déclarer l\'incident'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ DETAIL INCIDENT (slide-over) ══ */}
        {selected && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.5)',
            display:'flex', alignItems:'center', justifyContent:'flex-end', zIndex:900 }}
            onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
            <div style={{ background:'#fff', width:'100%', maxWidth:460,
              height:'100%', overflow:'auto', boxShadow:'-4px 0 30px rgba(0,0,0,.2)' }}>
              <div style={{ background:`linear-gradient(135deg,${STATUTS[selected.statut]?.c||'#1e3a8a'},#1e3a8a)`,
                color:'#fff', padding:'14px 16px', position:'sticky', top:0, zIndex:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{selected.titre}</div>
                    <div style={{ fontSize:11, opacity:.8, marginTop:2 }}>{selected.residence} · {selected.categorie}</div>
                  </div>
                  <button onClick={()=>setSelected(null)}
                    style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                      width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', marginTop:10, gap:0 }}>
                  {WF.map((w,i)=>{
                    const idx=WF.findIndex(x=>x.s===selected.statut)
                    const done=i<=idx
                    return (
                      <React.Fragment key={w.s}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ width:26, height:26, borderRadius:'50%',
                            background: done?'rgba(255,255,255,.9)':'rgba(255,255,255,.2)',
                            color: done?(STATUTS[selected.statut]?.c||'#1e3a8a'):'rgba(255,255,255,.4)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:11, fontWeight:700 }}>
                            {done?(i===idx?w.icon:'✓'):i+1}
                          </div>
                          <div style={{ fontSize:8, color:'rgba(255,255,255,.6)', marginTop:2 }}>{w.l}</div>
                        </div>
                        {i<WF.length-1 && <div style={{ flex:1, height:2,
                          background: i<idx?'rgba(255,255,255,.7)':'rgba(255,255,255,.2)',
                          marginBottom:16, minWidth:8 }}/>}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>

              <div style={{ padding:16 }}>
                <div style={{ background:'#f8fafc', borderRadius:10, padding:12, marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DESCRIPTION</div>
                  <div style={{ fontSize:13 }}>{selected.description}</div>
                  {selected.photo_base64 && String(selected.photo_base64).length>10 && (
                    <img
                      src={'data:image/jpeg;base64,'+String(selected.photo_base64).replace(/^data:[^;]+;base64,/,'')}
                      alt="Photo" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:8, marginTop:8, cursor:'pointer' }}
                      onClick={()=>window.open('data:image/jpeg;base64,'+String(selected.photo_base64).replace(/^data:[^;]+;base64,/,''),'_blank')}
                      onError={e=>{e.target.style.display='none'}}/>
                  )}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  {[['Priorité',PRIOS[selected.priorite]?.l||selected.priorite],
                    ['Statut',STATUTS[selected.statut]?.l||selected.statut],
                    ['Déclaré par',selected.auteur_nom||'?'],
                    ['Assigné à',selected.assigne_nom||'Non assigné']
                  ].map(([k,v])=>(
                    <div key={k} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:2 }}>{k}</div>
                      <div style={{ fontSize:12, fontWeight:600 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                {isAdmin && selected.statut==='declare' && (
                  <button onClick={()=>{setActionModal('assigner');setActionTechId('')}}
                    style={{ width:'100%', background:'#f97316', color:'#fff', border:'none',
                      padding:11, borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                      marginBottom:8, fontFamily:'inherit' }}>
                    👷 Assigner à un technicien
                  </button>
                )}
                {selected.statut==='assigne' && (
                  <button onClick={()=>setActionModal('commencer')}
                    style={{ width:'100%', background:'#eab308', color:'#fff', border:'none',
                      padding:11, borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                      marginBottom:8, fontFamily:'inherit' }}>
                    ⚙️ Commencer l'intervention
                  </button>
                )}
                {selected.statut==='en_cours' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={()=>uploadPhoto('photo_avant')}
                        style={{ flex:1, background:'#f5f3ff', color:'#7c3aed',
                          border:'2px dashed #c4b5fd', padding:10, borderRadius:9,
                          cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>
                        📷 Photo Avant
                      </button>
                      <button onClick={()=>uploadPhoto('photo_apres')}
                        style={{ flex:1, background:'#f0fdf4', color:'#16a34a',
                          border:'2px dashed #86efac', padding:10, borderRadius:9,
                          cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>
                        📷 Photo Après
                      </button>
                    </div>
                    {(() => {
                      const hasAvant = (selected.commentaires||[]).some(c=>c.type_comment==='photo_avant')
                      const hasApres = (selected.commentaires||[]).some(c=>c.type_comment==='photo_apres')
                      const canResolve = hasAvant && hasApres
                      return (
                        <div>
                          {!hasAvant && <div style={{fontSize:11,color:'#dc2626',background:'#fef2f2',
                            border:'1px solid #fecaca',borderRadius:7,padding:'5px 10px',marginBottom:5}}>
                            ⚠️ Photo AVANT requise
                          </div>}
                          {!hasApres && <div style={{fontSize:11,color:'#dc2626',background:'#fef2f2',
                            border:'1px solid #fecaca',borderRadius:7,padding:'5px 10px',marginBottom:5}}>
                            ⚠️ Photo APRÈS requise
                          </div>}
                          <button onClick={()=>canResolve&&setActionModal('resoudre')}
                            disabled={!canResolve}
                            title={!canResolve?'Photos avant et après obligatoires':'Marquer résolu'}
                            style={{ width:'100%', background:canResolve?'#16a34a':'#94a3b8', color:'#fff', border:'none',
                              padding:11, borderRadius:10, cursor:canResolve?'pointer':'not-allowed',
                              fontSize:13, fontWeight:700, fontFamily:'inherit' }}>
                            ✅ Marquer résolu {!canResolve?'(photos requises)':''}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                )}
                {isAdmin && selected.statut==='resolu' && (
                  <button onClick={()=>setActionModal('cloturer')}
                    style={{ width:'100%', background:'#64748b', color:'#fff', border:'none',
                      padding:11, borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                      marginBottom:8, fontFamily:'inherit' }}>
                    🔒 Clôturer
                  </button>
                )}
                <button onClick={()=>setActionModal('commenter')}
                  style={{ width:'100%', background:'#f8fafc', color:'#1e3a8a',
                    border:'1px solid #e2e8f0', padding:10, borderRadius:10, cursor:'pointer',
                    fontSize:12, fontWeight:700, marginBottom:14, marginTop:4, fontFamily:'inherit' }}>
                  💬 Commentaire
                </button>

                <div style={{ fontSize:12, fontWeight:700, color:'#64748b',
                  marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
                  Historique ({selected.commentaires?.length||0})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(selected.commentaires||[]).map(c=>{
                    const tc={info:'#64748b',assignation:'#2563eb',debut:'#f97316',
                      photo_avant:'#7c3aed',photo_apres:'#059669',resolution:'#16a34a',cloture:'#64748b'}[c.type_comment]||'#64748b'
                    return (
                      <div key={c.id} style={{ display:'flex', gap:8 }}>
                        <div style={{ width:3, borderRadius:99, background:tc, flexShrink:0 }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                            <span style={{ fontSize:10, fontWeight:700, color:tc }}>{c.type_label||c.type_comment}</span>
                            <span style={{ fontSize:10, color:'#94a3b8' }}>{c.auteur_nom}</span>
                          </div>
                          <div style={{ fontSize:12, color:'#334155' }}>{c.contenu}</div>
                          {c.photo_base64 && String(c.photo_base64).length>10 && (
                            <img src={'data:image/jpeg;base64,'+String(c.photo_base64).replace(/^data:[^;]+;base64,/,'')}
                              alt="Photo" style={{ width:'100%', maxHeight:160, objectFit:'cover', borderRadius:8, marginTop:6, cursor:'pointer' }}
                              onClick={()=>window.open('data:image/jpeg;base64,'+String(c.photo_base64).replace(/^data:[^;]+;base64,/,''),'_blank')}
                              onError={e=>{e.target.style.display='none'}}/>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL MODIFIER INCIDENT ══ */}
        {showEdit && editInc && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.7)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:16 }}
            onClick={e=>e.target===e.currentTarget&&setShowEdit(false)}>
            <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520,
              maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#fff',
                padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, fontSize:15 }}>✏️ Modifier l'incident</div>
                <button onClick={()=>setShowEdit(false)}
                  style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                    width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>TITRE *</label>
                  <input value={editInc.titre} onChange={e=>setEditInc({...editInc,titre:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DESCRIPTION *</label>
                  <textarea value={editInc.description} onChange={e=>setEditInc({...editInc,description:e.target.value})}
                    rows={3} style={{ ...inp, resize:'vertical' }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>CATÉGORIE</label>
                    <select value={editInc.categorie} onChange={e=>setEditInc({...editInc,categorie:e.target.value})} style={inp}>
                      {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>PRIORITÉ</label>
                    <select value={editInc.priorite} onChange={e=>setEditInc({...editInc,priorite:e.target.value})} style={inp}>
                      {Object.entries(PRIOS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>RÉSIDENCE *</label>
                    <input value={editInc.residence} onChange={e=>setEditInc({...editInc,residence:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>BLOC / CHAMBRE</label>
                    <input value={editInc.bloc||''} onChange={e=>setEditInc({...editInc,bloc:e.target.value})} style={inp}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={async()=>{
                    try {
                      await incAPI.modifier(editInc.id, {
                        titre: editInc.titre, description: editInc.description,
                        categorie: editInc.categorie, priorite: editInc.priorite,
                        residence: editInc.residence, bloc: editInc.bloc||''
                      })
                      setShowEdit(false); load()
                    } catch(e) { alert(e.response?.data?.detail||'Erreur modification') }
                  }}
                    style={{ flex:1, background:'#1e3a8a', color:'#fff', border:'none',
                      padding:12, borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'inherit' }}>
                    💾 Enregistrer
                  </button>
                  <button onClick={()=>setShowEdit(false)}
                    style={{ background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0',
                      padding:12, borderRadius:10, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL ACTION ══ */}
        {actionModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.7)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
            onClick={e=>e.target===e.currentTarget&&setActionModal(null)}>
            <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:420,
              overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ background:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#fff',
                padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700 }}>
                  {{assigner:'👷 Assigner',commencer:'⚙️ Commencer',
                    resoudre:'✅ Résoudre',cloturer:'🔒 Clôturer',commenter:'💬 Commentaire'}[actionModal]}
                </div>
                <button onClick={()=>setActionModal(null)}
                  style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                    width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
                {actionModal==='assigner' ? (
                  <select value={actionTechId} onChange={e=>setActionTechId(e.target.value)} style={inp}>
                    <option value="">-- Sélectionner un technicien --</option>
                    {techns.map(t=>(
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.username})</option>
                    ))}
                  </select>
                ) : (
                  <textarea value={actionComment} onChange={e=>setActionComment(e.target.value)}
                    placeholder={actionModal==='commenter'?'Votre commentaire...':'Commentaire (optionnel)...'}
                    rows={3} style={{ ...inp, resize:'vertical' }}/>
                )}
                <button onClick={()=>doAction(actionModal)} disabled={submitting}
                  style={{ background:submitting?'#94a3b8':'#1e3a8a', color:'#fff', border:'none',
                    padding:12, borderRadius:10, cursor:submitting?'wait':'pointer',
                    fontSize:14, fontWeight:700, fontFamily:'inherit' }}>
                  {submitting?'⏳...':'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MaintenanceBoundary>
  )
}
