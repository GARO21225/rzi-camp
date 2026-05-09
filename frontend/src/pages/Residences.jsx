
import React, { useEffect, useState } from 'react'
import { batiments, personnel as personnelAPI, occupationHistory, occupationHistoryAdmin } from '../api'
import { useStore } from '../store'

const bcolor = { Libre:'#16a34a', 'Occupé':'#dc2626', 'Réservé':'#2563eb', Maintenance:'#ea580c' }
const today = new Date().toISOString().slice(0,10)

export default function Residences() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'
  const [data, setData] = useState([])
  const [personnelList, setPersonnelList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [bloc, setBloc] = useState('')
  const [blocs, setBlocs] = useState([])
  const [futurDepart, setFuturDepart] = useState(false)

  // Modals
  const [editModal, setEditModal] = useState(null)       // Room being edited
  const [confirmModal, setConfirmModal] = useState(null)  // Preview before confirm
  const [histModal, setHistModal] = useState(null)        // History view
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [editHistModal, setEditHistModal] = useState(null) // Edit wrong history entry

  const [form, setForm] = useState({ statut:'Libre', personnel:'', occupant:'', societe:'', date_arrivee:'', date_depart:'' })

  const load = () => {
    setLoading(true)
    const p = {}
    if (search) p.search = search
    if (statut) p.statut = statut
    if (bloc) p.bloc = bloc
    if (futurDepart) p.futur_depart = 's1'
    batiments.list(p).then(r => {
      const items = r.data.results||r.data
      setData(items)
      const b = [...new Set(items.map(x=>x.bloc))].sort()
      setBlocs(b)
    }).finally(() => setLoading(false))
    personnelAPI.list({page_size:500}).then(r => setPersonnelList(r.data.results||r.data))
  }

  useEffect(() => { load() }, [search, statut, bloc, futurDepart])

  const openEdit = (b) => {
    setEditModal(b)
    setForm({
      statut:b.statut, personnel:b.personnel||'',
      occupant:b.occupant||'', societe:b.societe||'',
      date_arrivee:b.date_arrivee||today, date_depart:b.date_depart||''
    })
  }

  // Step 1: Preview (no history created)
  const preview = () => {
    const payload = buildPayload()
    if (!payload) return
    // Show confirmation modal with summary
    const p = payload.personnel ? personnelList.find(x=>x.id==payload.personnel) : null
    setConfirmModal({
      batiment: editModal,
      payload,
      resume: {
        statut: form.statut,
        nom: p ? `${p.nom} ${p.prenom}` : (form.occupant || '—'),
        societe: p?.societe || form.societe || '—',
        date_arrivee: form.date_arrivee || '—',
        date_depart: form.date_depart || 'Non défini',
        creerHistorique: form.statut === 'Occupé' && (!!form.personnel || !!form.occupant) && !!form.date_arrivee
      }
    })
    setEditModal(null)
  }

  const buildPayload = () => {
    const payload = { statut: form.statut, date_arrivee: form.date_arrivee||null, date_depart: form.date_depart||null }
    if (form.personnel && form.personnel !== '') {
      payload.personnel = parseInt(form.personnel)
      const p = personnelList.find(x=>x.id==form.personnel)
      if (p) { payload.occupant=`${p.nom} ${p.prenom}`; payload.societe=p.societe }
    } else {
      payload.personnel = null
      payload.occupant = form.occupant || null
      payload.societe = form.societe || null
    }
    return payload
  }

  // Step 2: Confirm WITH history
  const confirmSave = async (createHistory=true) => {
    try {
      await batiments.update(confirmModal.batiment.id, confirmModal.payload, createHistory)
      setConfirmModal(null)
      load()
    } catch(e) {
      alert('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    }
  }

  // Save WITHOUT history (correction d'erreur)
  const saveSansHistorique = async () => {
    try {
      await batiments.update(confirmModal.batiment.id, confirmModal.payload, false)
      setConfirmModal(null)
      load()
    } catch(e) {
      alert('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    }
  }

  const openHistory = async (b) => {
    setHistModal(b)
    setHistLoading(true)
    setHistory([])
    try {
      const r = await occupationHistory.recherche({ batiment: b.residence })
      setHistory(r.data.results||r.data||[])
    } catch(e) { console.error(e) }
    finally { setHistLoading(false) }
  }

  const deleteHistoryEntry = async (id) => {
    if (!window.confirm('Supprimer cette entrée d\'historique ?\nLa chambre ne sera pas modifiée.')) return
    try {
      await occupationHistoryAdmin.delete(id)
      // Refresh history
      const r = await occupationHistory.recherche({ batiment: histModal.residence })
      setHistory(r.data.results||r.data||[])
    } catch(e) { alert(e.response?.data?.error || 'Erreur') }
  }

  const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }

  return (
    <div style={{ padding:'16px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>🏠 Gestion des Résidences</h2>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>204 bâtiments · 19 blocs · Confirmation avant historisation</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <a href={batiments.exportCsv({})} style={{ background:'#16a34a', color:'#fff', padding:'7px 12px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:700 }}>⬇ CSV</a>
          <a href={batiments.exportBlocs()} style={{ background:'var(--blue)', color:'#fff', padding:'7px 12px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:700 }}>⬇ Blocs</a>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Résidence, occupant..."
          style={{ ...inp, width:170 }}/>
        <select value={statut} onChange={e=>setStatut(e.target.value)} style={{ ...inp, width:'auto' }}>
          <option value="">Tous statuts</option>
          <option value="Libre">🟢 Libre</option>
          <option value="Occupé">🔴 Occupé</option>
          <option value="Réservé">🔵 Réservé</option>
          <option value="Maintenance">🟠 Maintenance</option>
        </select>
        <select value={bloc} onChange={e=>setBloc(e.target.value)} style={{ ...inp, width:'auto' }}>
          <option value="">Tous blocs</option>
          {blocs.map(b=><option key={b}>{b}</option>)}
        </select>
        <button onClick={()=>setFuturDepart(!futurDepart)}
          style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${futurDepart?'#dc2626':'var(--border)'}`,
            background:futurDepart?'rgba(220,38,38,.1)':'var(--surface2)', color:futurDepart?'#dc2626':'var(--text-dim)',
            cursor:'pointer', fontSize:12, fontWeight:futurDepart?700:400 }}>
          ✈️ S-1{futurDepart?' ✓':''}
        </button>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-dim)', background:'var(--surface2)', padding:'7px 12px', borderRadius:8, border:'1px solid var(--border)' }}>
          {data.length} résidences
        </span>
      </div>

      {/* Table */}
      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:700 }}>
            <thead>
              <tr style={{ background:'var(--blue)' }}>
                {['Résidence','Bloc','Statut','Occupant','Société','Arrivée','Départ','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.85)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</td></tr>
                : data.map((b,i)=>(
                  <tr key={b.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                    <td style={{ padding:'9px 12px', fontFamily:'monospace', fontWeight:700, color:'var(--blue)' }}>{b.residence}</td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-dim)' }}>{b.bloc}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ background:`${bcolor[b.statut]}18`, color:bcolor[b.statut], padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700 }}>{b.statut}</span>
                    </td>
                    <td style={{ padding:'9px 12px', color:b.occupant?'var(--text)':'var(--text-dim)', fontSize:12 }}>
                      {b.personnel_detail?`${b.personnel_detail.nom} ${b.personnel_detail.prenom}`:(b.occupant||'—')}
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-dim)' }}>{b.personnel_detail?.societe||b.societe||'—'}</td>
                    <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:11, color:'var(--text-dim)' }}>{b.date_arrivee||'—'}</td>
                    <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:11, color:b.date_depart?'#dc2626':'var(--text-dim)' }}>{b.date_depart||'—'}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>openEdit(b)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>Modifier</button>
                        <button onClick={()=>openHistory(b)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }} title="Historique">📋</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {editModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--shadow-md)' }}>
            <div style={{ padding:'16px 20px', background:'var(--blue)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15 }}>🏠 {editModal.residence} — {editModal.bloc}</h3>
              <button onClick={()=>setEditModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              {/* Statut */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Statut</label>
                <div style={{ display:'flex', gap:6 }}>
                  {['Libre','Occupé','Réservé','Maintenance'].map(s=>(
                    <button key={s} onClick={()=>setForm({...form,statut:s})}
                      style={{ flex:1, padding:'7px 4px', borderRadius:8, border:`2px solid ${form.statut===s?bcolor[s]:'var(--border)'}`,
                        background:form.statut===s?`${bcolor[s]}18`:'var(--surface2)',
                        color:form.statut===s?bcolor[s]:'var(--text-dim)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personnel */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Personnel déclaré</label>
                <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                  <option value="">— Saisie manuelle —</option>
                  {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe} ({p.type_label})</option>)}
                </select>
              </div>

              {!form.personnel && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Occupant</label>
                    <input value={form.occupant} onChange={e=>setForm({...form,occupant:e.target.value})} style={inp} placeholder="Nom occupant"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Société</label>
                    <input value={form.societe} onChange={e=>setForm({...form,societe:e.target.value})} style={inp} placeholder="Société"/>
                  </div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[["Date d'arrivée",'date_arrivee'],["Date de départ",'date_depart']].map(([l,k])=>(
                  <div key={k}>
                    <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                    <input type="date" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setEditModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={preview} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Aperçu avant confirmation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL ── */}
      {confirmModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:460, boxShadow:'var(--shadow-md)' }}>
            <div style={{ padding:'16px 20px', background:'#f0a500', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#000', fontSize:15 }}>⚠️ Confirmer l'affectation</h3>
              <button onClick={()=>{ setConfirmModal(null); setEditModal(confirmModal.batiment) }} style={{ background:'rgba(0,0,0,.1)', border:'none', color:'#000', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px' }}>
              {/* Résumé */}
              <div style={{ background:'var(--surface2)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:12, color:'var(--text-dim)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Récapitulatif</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:13 }}>
                  {[
                    ['Résidence', confirmModal.batiment.residence],
                    ['Nouveau statut', confirmModal.resume.statut],
                    ['Occupant', confirmModal.resume.nom],
                    ['Société', confirmModal.resume.societe],
                    ["Date d'arrivée", confirmModal.resume.date_arrivee],
                    ['Date de départ', confirmModal.resume.date_depart],
                  ].map(([l,v])=>(
                    <div key={l}>
                      <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:2 }}>{l}</div>
                      <div style={{ fontWeight:700, color:'var(--blue)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historique warning */}
              {confirmModal.resume.creerHistorique ? (
                <div style={{ background:'rgba(22,163,74,.08)', border:'1px solid rgba(22,163,74,.25)', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#16a34a', marginBottom:4 }}>📋 Historique occupation</div>
                  <div style={{ fontSize:12, color:'var(--text-dim)' }}>
                    Une entrée sera créée dans l'historique d'occupation avec la date d'arrivée.
                    <br/><b>Si c'est une erreur</b>, cliquer sur "Sauvegarder sans historique".
                  </div>
                </div>
              ) : (
                <div style={{ background:'rgba(100,116,139,.08)', border:'1px solid rgba(100,116,139,.2)', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
                  <div style={{ fontSize:12, color:'var(--text-dim)' }}>ℹ️ Aucune entrée d'historique ne sera créée pour cette modification.</div>
                </div>
              )}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8 }}>
              {confirmModal.resume.creerHistorique && (
                <button onClick={()=>confirmSave(true)} style={{ background:'#16a34a', color:'#fff', border:'none', padding:'11px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, width:'100%' }}>
                  ✅ Confirmer + Enregistrer dans l'historique
                </button>
              )}
              <button onClick={()=>confirmSave(false)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'11px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, width:'100%' }}>
                💾 Sauvegarder sans créer d'historique
              </button>
              <button onClick={()=>{ setConfirmModal(null); setEditModal(confirmModal.batiment) }}
                style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'10px', borderRadius:8, cursor:'pointer', fontSize:13, width:'100%' }}>
                ← Retour — Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY MODAL ── */}
      {histModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-md)' }}>
            <div style={{ padding:'16px 20px', background:'var(--blue)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <h3 style={{ color:'#fff', fontSize:15 }}>📋 Historique — {histModal.residence}</h3>
              <button onClick={()=>setHistModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>

            {isAdmin && (
              <div style={{ padding:'10px 16px', background:'rgba(240,165,0,.08)', borderBottom:'1px solid rgba(240,165,0,.2)', fontSize:12, color:'#d08800' }}>
                ⚙️ <b>Admin</b> — Vous pouvez supprimer une entrée erronée. La chambre ne sera pas modifiée.
              </div>
            )}

            <div style={{ overflowY:'auto', flex:1 }}>
              {histLoading ? (
                <div style={{ padding:32, textAlign:'center', color:'var(--text-dim)' }}>Chargement...</div>
              ) : history.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', color:'var(--text-dim)' }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                  <div>Aucun historique pour cette résidence</div>
                  <div style={{ fontSize:12, marginTop:4 }}>L'historique est créé lors des affectations confirmées</div>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead>
                    <tr style={{ background:'var(--surface2)', position:'sticky', top:0 }}>
                      {['Occupant','Société','Arrivée','Départ','Durée','Motif',isAdmin?'Action':''].filter(Boolean).map(h=>(
                        <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h,i) => {
                      const d1 = new Date(h.date_arrivee), d2 = h.date_depart?new Date(h.date_depart):new Date()
                      const days = Math.round((d2-d1)/(1000*60*60*24))
                      return (
                        <tr key={h.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                          <td style={{ padding:'9px 14px', fontWeight:600 }}>{h.occupant}</td>
                          <td style={{ padding:'9px 14px', fontSize:11, color:'var(--text-dim)' }}>{h.societe||'—'}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{h.date_arrivee}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>
                            {h.date_depart || <span style={{ color:'#16a34a', fontWeight:700 }}>En cours</span>}
                          </td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'var(--blue)' }}>{days}j</td>
                          <td style={{ padding:'9px 14px', fontSize:11, color:'var(--text-dim)' }}>{h.motif_depart||'—'}</td>
                          {isAdmin && (
                            <td style={{ padding:'9px 14px' }}>
                              <button onClick={()=>deleteHistoryEntry(h.id)}
                                style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
                                title="Supprimer cette entrée erronée">
                                🗑 Corriger
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={()=>setHistModal(null)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
