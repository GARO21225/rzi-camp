/**
 * VOYAGES v3 — Gestion des voyages du camp
 * Chargement instantané + delete visible + nouvelles actions
 */
import React, { useEffect, useState, useCallback } from 'react'
import { voyages, personnel as personnelAPI, batiments as batsAPI } from '../api'
import { useStore } from '../store'

const STATUT_STYLES = {
  planifie:  { bg:'rgba(37,99,235,.12)',  color:'#1d4ed8',  label:'Planifié'    },
  en_voyage: { bg:'rgba(249,115,22,.12)', color:'#c2410c',  label:'En voyage'   },
  retour:    { bg:'rgba(22,163,74,.12)',  color:'#15803d',  label:'Retour camp' },
  annule:    { bg:'rgba(100,116,139,.1)', color:'#475569',  label:'Annulé'      },
}
const STATUT_LABELS = { planifie:'Planifié', en_voyage:'En voyage', retour:'Retour camp', annule:'Annulé' }

const S_BTN = (bg, color, border) => ({
  background: bg, color, border: `1.5px solid ${border}`,
  padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
  transition: '.15s', fontFamily: 'inherit'
})


const DESTINATIONS = [
  // Côte d'Ivoire - villes principales
  'Abidjan', 'Yamoussoukro', 'Bouaké', 'San Pedro', 'Korhogo', 'Man',
  'Daloa', 'Gagnoa', 'Abengourou', 'Bondoukou', 'Odienné', 'Touba',
  'Divo', 'Agboville', 'Dimbokro', 'Séguéla', 'Mankono', 'Ferkessédougou',
  'Bouna', 'Tabou',
  // Aéroports / Hubs
  'Aéroport FÉLIX HOUPHOUËT-BOIGNY (ABJ)',
  'Aéroport BOUAKÉ',
  // Burkina Faso (site minier proche)
  'Ouagadougou', 'Bobo-Dioulasso', 'Dédougou', 'Koudougou',
  // International
  'Accra (Ghana)', 'Bamako (Mali)', 'Dakar (Sénégal)', 'Lomé (Togo)',
  'Paris (France)', 'Bruxelles (Belgique)',
  // Destinations mines / terrain
  'Sango Mine Site', 'Camp de base', 'Site d\'exploration',
]

export default function Voyages() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_staff ? 'admin' : 'agent')
  const isAdmin = user?.is_staff === true || user?.is_superuser === true || role === 'admin'

  const [data,          setData]          = useState([])
  const [stats,         setStats]         = useState({total:0,planifies:0,en_voyage:0,retours:0,annules:0})
  const [loading,       setLoading]       = useState(true)
  const [filterStatut,  setFilterStatut]  = useState('')
  const [modal,         setModal]         = useState(false)
  const [editModal,     setEditModal]     = useState(null)
  const [personnelList, setPersonnelList] = useState([])
  const [batsList,      setBatsList]      = useState([])
  const [myPersonnel,   setMyPersonnel]   = useState(null)
  const [form, setForm] = useState({ personnel:'', destination:'', date_depart:'', date_retour_prevue:'', motif:'repos', heure_depart:'', notes:'' })
  const [submitting, setSubmitting] = useState(false)

  // Charger voyages IMMÉDIATEMENT
  const loadVoyages = useCallback(() => {
    setLoading(true)
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (!isAdmin && myPersonnel) p.personnel = myPersonnel.id
    Promise.all([
      voyages.list(p),
      voyages.stats()
    ]).then(([rv, rs]) => {
      setData(rv.data.results || rv.data || [])
      setStats(rs.data || {})
    }).catch(() => {})
    .finally(() => setLoading(false))
  }, [filterStatut, myPersonnel, isAdmin])

  // Charger liste personnel en arrière-plan (pour modal)
  useEffect(() => {
    setLoading(true)
    loadVoyages()
    // Charger personnel/bâtiments en parallèle sans bloquer
    Promise.all([
      personnelAPI.list({ page_size:200 }),
      batsAPI.list({ page_size:200 })
    ]).then(([rp, rb]) => {
      const items = rp.data.results || rp.data || []
      setPersonnelList(items)
      setBatsList(rb.data.results || rb.data || [])
      if (!isAdmin) {
        const me = items.find(p =>
          p.login_genere === user?.username ||
          (p.nom?.toLowerCase() === (user?.last_name||'').toLowerCase() &&
           p.prenom?.toLowerCase() === (user?.first_name||'').toLowerCase())
        )
        if (me) {
          setMyPersonnel(me)
          setForm(f => ({...f, personnel: me.id.toString()}))
        }
      }
    }).catch(() => {})
  }, [user?.username])

  useEffect(() => { loadVoyages() }, [loadVoyages])

  // Actions
  const partir = async (id) => {
    try { await voyages.partir(id); loadVoyages() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }
  const revenir = async (v) => {
    try { await voyages.revenir(v.id); loadVoyages() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }
  const annulerVoyage = async (v) => {
    if (!window.confirm(`Annuler le voyage de ${v.personnel_detail?.nom||''} ?`)) return
    try { await voyages.annuler(v.id); loadVoyages() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }
  const supprimerVoyage = async (v) => {
    if (!window.confirm(`🗑️ Supprimer définitivement le voyage de ${v.personnel_detail?.nom||'?'} vers ${v.destination||'?'} ?\n\nCette action est irréversible.`)) return
    try { await voyages.supprimer(v.id); loadVoyages() }
    catch(e) { alert(e.response?.data?.error || 'Impossible de supprimer ce voyage') }
  }

  const createVoyage = async () => {
    if (!form.personnel || !form.destination || !form.date_depart) return alert('Personnel, destination et date de départ requis')
    setSubmitting(true)
    try {
      await voyages.create(form)
      setModal(false)
      setForm({ personnel:'', destination:'', date_depart:'', date_retour_prevue:'', motif:'repos', heure_depart:'', notes:'' })
      loadVoyages()
    } catch(e) { alert(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur') }
    finally { setSubmitting(false) }
  }

  const openEdit = (v) => setEditModal(v)
  const saveEdit = async () => {
    if (!editModal) return
    setSubmitting(true)
    try {
      await voyages.update(editModal.id, editModal)
      setEditModal(null)
      loadVoyages()
    } catch(e) { alert(e.response?.data?.detail || 'Erreur') }
    finally { setSubmitting(false) }
  }

  const filtered = data.filter(v => !filterStatut || v.statut === filterStatut)

  // Styles
  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'9px 12px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }
  const filterBtns = [
    ['', '📋 Tous', data.length],
    ['planifie', '📅 Planifié', stats.planifies||0],
    ['en_voyage', '✈️ En voyage', stats.en_voyage||0],
    ['retour', '🏠 Retour', stats.retours||0],
    ['annule', '❌ Annulé', stats.annules||0],
  ]

  return (
    <div style={{ padding:16 }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#1e3a8a', margin:0 }}>✈️ Gestion des Voyages</h2>
          <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>
            {isAdmin ? 'Tous les voyages · Modification · Suivi' : `Mes voyages${myPersonnel?' — '+myPersonnel.nom+' '+myPersonnel.prenom:''}`}
          </p>
        </div>
        <button onClick={() => setModal(true)}
          style={{ background:'#1e3a8a', color:'#fff', border:'none', padding:'10px 20px', borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700 }}>
          + {isAdmin ? 'Nouveau voyage' : 'Déclarer mon voyage'}
        </button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
        {[
          ['Total',     '📋', stats.total||data.length, '#2563eb'],
          ['Planifiés', '📅', stats.planifies||0,        '#f59e0b'],
          ['En voyage', '✈️', stats.en_voyage||0,        '#f97316'],
          ['Retours',   '🏠', stats.retours||0,          '#16a34a'],
        ].map(([l,ic,v,c]) => (
          <div key={l} style={{ background:'#fff', border:`2px solid ${c}30`, borderTop:`3px solid ${c}`, borderRadius:12, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginTop:3 }}>{ic} {l}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {filterBtns.map(([val, label, count]) => (
          <button key={val} onClick={() => setFilterStatut(val)}
            style={{ ...S_BTN(filterStatut===val?'#1e3a8a':'#fff', filterStatut===val?'#fff':'#475569', filterStatut===val?'#1e3a8a':'#e2e8f0'), fontSize:12 }}>
            {label} <span style={{ background: filterStatut===val?'rgba(255,255,255,.25)':'#f1f5f9', borderRadius:99, padding:'1px 7px', marginLeft:4, fontSize:11, fontWeight:700 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── Tableau ── */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 12px rgba(30,58,138,.07)' }}>
        {loading ? (
          <div style={{ padding:48, textAlign:'center', fontSize:32 }}>⏳</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:56, textAlign:'center', color:'#94a3b8' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✈️</div>
            <div style={{ fontWeight:700, fontSize:15, color:'#64748b' }}>Aucun voyage</div>
            <div style={{ fontSize:12, marginTop:5 }}>Cliquez sur "+ Nouveau voyage" pour commencer</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg, #0f2447, #1e3a8a)' }}>
                  {['Personnel','Motif','Départ','Heure','Retour prévu','Statut','Actions'].map(h => (
                    <th key={h} style={{ padding:'11px 13px', textAlign:'left', fontSize:10.5, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:'rgba(255,255,255,.85)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, i) => {
                  const sc = STATUT_STYLES[v.statut] || STATUT_STYLES.planifie
                  const p  = v.personnel_detail
                  return (
                    <tr key={v.id} style={{ borderTop:'1px solid #f1f5f9', background: i%2 ? '#fafafa':'#fff', transition:'.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = i%2?'#fafafa':'#fff'}>
                      <td style={{ padding:'11px 13px' }}>
                        <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:13 }}>
                          {p ? `${p.nom} ${p.prenom}` : v.destination || '—'}
                        </div>
                        {p?.societe && <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:1 }}>{p.societe}</div>}
                      </td>
                      <td style={{ padding:'11px 13px', fontSize:12, color:'#475569' }}>
                        <span style={{ background:'#f1f5f9', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                          {v.motif || 'repos'}
                        </span>
                      </td>
                      <td style={{ padding:'11px 13px', fontFamily:'monospace', fontSize:12, color:'#334155' }}>{v.date_depart}</td>
                      <td style={{ padding:'11px 13px', fontFamily:'monospace', fontSize:12, color:'#7c3aed' }}>{v.heure_depart || '—'}</td>
                      <td style={{ padding:'11px 13px', fontFamily:'monospace', fontSize:12 }}>{v.date_retour_prevue}</td>
                      <td style={{ padding:'11px 13px' }}>
                        <span style={{ background:sc.bg, color:sc.color, padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding:'11px 13px' }}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {/* Modifier */}
                          <button onClick={()=>openEdit(v)}
                            style={S_BTN('#eff6ff','#2563eb','#bfdbfe')} title="Modifier">
                            ✏️
                          </button>
                          {/* Partir */}
                          {v.statut==='planifie' && (
                            <button onClick={()=>partir(v.id)}
                              style={S_BTN('#fff7ed','#f97316','#fed7aa')} title="Marquer en voyage">
                              🚀 Partir
                            </button>
                          )}
                          {/* Retour */}
                          {v.statut==='en_voyage' && (
                            <button onClick={()=>revenir(v)}
                              style={S_BTN('#f0fdf4','#16a34a','#86efac')} title="Retour au camp">
                              🏠 Retour
                            </button>
                          )}
                          {/* Annuler */}
                          {v.statut==='planifie' && (
                            <button onClick={()=>annulerVoyage(v)}
                              style={S_BTN('#f8fafc','#64748b','#e2e8f0')} title="Annuler">
                              ✕
                            </button>
                          )}
                          {/* 🗑️ SUPPRIMER — TOUJOURS VISIBLE */}
                          <button onClick={()=>supprimerVoyage(v)}
                            style={{ ...S_BTN('#fef2f2','#dc2626','#fca5a5'), minWidth:80 }}
                            title="Supprimer ce voyage">
                            🗑️ Suppr.
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ MODAL CRÉER ═══ */}
      {modal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div style={{ background:'#fff',width:'100%',maxWidth:540,maxHeight:'92dvh',overflow:'auto',borderRadius:'18px 18px 0 0',boxShadow:'0 -8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ position:'sticky',top:0,background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'18px 18px 0 0',zIndex:10 }}>
              <span style={{ fontWeight:700,fontSize:15 }}>✈️ {isAdmin?'Nouveau voyage':'Déclarer mon voyage'}</span>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:14 }}>
              {isAdmin && (
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>Personnel *</label>
                  <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                    <option value="">Sélectionner un agent…</option>
                    {personnelList.map(p => <option key={p.id} value={p.id}>{p.nom} {p.prenom} — {p.societe||''}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>Destination *</label>
                  <select value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} style={inp}>
                    <option value="">Sélectionner une destination...</option>
                    {DESTINATIONS.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>Motif</label>
                  <select value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})} style={inp}>
                    {['repos','medical','formation','conge','familial','administratif','autre'].map(m=>(
                      <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>Date départ *</label>
                  <input type="date" value={form.date_depart} onChange={e=>setForm({...form,date_depart:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>Heure</label>
                  <input type="time" value={form.heure_depart} onChange={e=>setForm({...form,heure_depart:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>Retour prévu</label>
                  <input type="date" value={form.date_retour_prevue} onChange={e=>setForm({...form,date_retour_prevue:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>Notes (optionnel)</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Informations complémentaires…" rows={3} style={{...inp,resize:'vertical'}}/>
              </div>
              <div style={{ display:'flex',gap:10,paddingTop:4 }}>
                <button onClick={()=>setModal(false)} style={{ flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600 }}>Annuler</button>
                <button onClick={createVoyage} disabled={submitting}
                  style={{ flex:2,background:submitting?'#94a3b8':'#1e3a8a',color:'#fff',border:'none',padding:12,borderRadius:10,cursor:submitting?'not-allowed':'pointer',fontSize:14,fontWeight:700 }}>
                  {submitting?'⏳ Enregistrement…':'✈️ Déclarer le voyage'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL ÉDITER ═══ */}
      {editModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&setEditModal(null)}>
          <div style={{ background:'#fff',width:'100%',maxWidth:480,maxHeight:'92dvh',overflow:'auto',borderRadius:'18px 18px 0 0',boxShadow:'0 -8px 40px rgba(0,0,0,.2)' }}>
            <div style={{ position:'sticky',top:0,background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'18px 18px 0 0',zIndex:10 }}>
              <span style={{ fontWeight:700,fontSize:15 }}>✏️ Modifier le voyage</span>
              <button onClick={()=>setEditModal(null)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:14 }}>
              {[
                ['Destination','destination','text','Abidjan…'],
                ['Date départ','date_depart','date',''],
                ['Heure départ','heure_depart','time',''],
                ['Retour prévu','date_retour_prevue','date',''],
              ].map(([label,field,type,ph]) => (
                <div key={field}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6,textTransform:'uppercase' }}>{label}</label>
                  <input type={type} value={editModal[field]||''} placeholder={ph}
                    onChange={e=>setEditModal({...editModal,[field]:e.target.value})} style={inp}/>
                </div>
              ))}
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>setEditModal(null)} style={{ flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600 }}>Annuler</button>
                <button onClick={saveEdit} disabled={submitting}
                  style={{ flex:2,background:submitting?'#94a3b8':'#1e3a8a',color:'#fff',border:'none',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700 }}>
                  {submitting?'⏳…':'💾 Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
