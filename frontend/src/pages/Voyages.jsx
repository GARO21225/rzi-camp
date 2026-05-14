import React, { useEffect, useState, useCallback } from 'react'
import { voyages, personnel as personnelAPI, batiments as batsAPI } from '../api'
import { useStore } from '../store'

const STATUT_LABELS = { planifie:'Planifié', en_voyage:'En voyage', retour:'Retour camp', annule:'Annulé' }
const STATUT_COLORS = {
  planifie:{ bg:'rgba(37,99,235,.12)', color:'#2563eb' },
  en_voyage:{ bg:'rgba(234,88,12,.12)', color:'#ea580c' },
  retour:{ bg:'rgba(22,163,74,.12)', color:'#16a34a' },
  annule:{ bg:'rgba(100,116,139,.12)', color:'#64748b' },
}

const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }
const today = new Date().toISOString().slice(0,10)

export default function Voyages() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = ['admin'].includes(role) || user?.is_staff || user?.is_superuser
  const canCreate = ['admin','agent'].includes(role) || user?.is_staff

  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [personnelList, setPersonnelList] = useState([])
  const [batsList, setBatsList] = useState([])
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [myPersonnel, setMyPersonnel] = useState(null)
  const [form, setForm] = useState({ personnel:'', batiment:'', destination:'', motif:'', date_depart:today, heure_depart:'', date_retour_prevue:'' })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      personnelAPI.list({ page_size:500 }),
      batsAPI.list({ page_size:300 })
    ]).then(([rp, rb]) => {
      const items = rp.data.results||rp.data||[]
      setPersonnelList(items)
      const bats = rb.data.results||rb.data||[]
      setBatsList([...bats].sort((a,b)=>a.residence.localeCompare(b.residence,undefined,{numeric:true})))
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
      setReady(true)
    }).catch(() => setReady(true))
  }, [user?.username])

  const load = useCallback(() => {
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (!isAdmin) {
      if (!myPersonnel) { setData([]); return }
      p.personnel = myPersonnel.id
    }
    voyages.list(p).then(r => setData(r.data.results||r.data||[])).catch(()=>setData([]))
    voyages.stats().then(r => setStats(r.data)).catch(()=>{})
  }, [filterStatut, myPersonnel, isAdmin, ready])

  useEffect(() => { load() }, [load])

  const partir = async (id) => {
    try { await voyages.partir(id); load() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  const revenir = async (v) => {
    const date = prompt('Date de retour effectif (AAAA-MM-JJ):', today)
    if (!date) return
    try { await voyages.revenir(v.id, { date_retour: date }); load() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  const annulerVoyage = async (v) => {
    if (!window.confirm(`Annuler le voyage de ${v.personnel_detail?.nom||''} ${v.personnel_detail?.prenom||''} ?`)) return
    try { await voyages.annuler(v.id); load() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  const supprimerVoyage = async (v) => {
    if (!window.confirm('Supprimer ce voyage ? (erreur de saisie uniquement)')) return
    try { await voyages.supprimer(v.id); load() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  const openEdit = (v) => {
    setEditModal(v)
  }

  const saveEdit = async () => {
    const formData = {
      personnel: editModal.personnel_id,
      destination: editModal.destination,
      motif: editModal.motif || '',
      date_depart: editModal.date_depart,
      date_retour_prevue: editModal.date_retour_prevue,
    }
    if (editModal.heure_depart) formData.heure_depart = editModal.heure_depart
    try {
      await voyages.update(editModal.id, formData)
      setEditModal(null)
      load()
    } catch(e) { alert(e.response?.data?.error || e.response?.data?.detail || 'Erreur modification') }
  }

  const createVoyage = async () => {
    if (!form.personnel) return alert('Sélectionner le personnel')
    if (!form.destination) return alert('Destination requise')
    if (!form.date_depart) return alert('Date départ requise')
    if (!form.date_retour_prevue) return alert('Date retour prévue requise')
    try {
      const payload = { ...form }
      if (form.heure_depart) payload.heure_depart = form.heure_depart
      await voyages.create(payload)
      setModal(false)
      setForm({ personnel: myPersonnel?.id?.toString()||'', batiment:'', destination:'', motif:'', date_depart:today, heure_depart:'', date_retour_prevue:'' })
      load()
    } catch(e) { alert(e.response?.data?JSON.stringify(e.response.data):e.message) }
  }

  const filteredPersonnel = isAdmin ? personnelList : (myPersonnel ? [myPersonnel] : personnelList)

  return (
    <div style={{ padding:'16px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>✈️ Gestion des Voyages</h2>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>
            {isAdmin ? 'Tous les voyages · Modification · Suivi' : `Mes voyages${myPersonnel?' — '+myPersonnel.nom+' '+myPersonnel.prenom:''}` }
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {canCreate && (
            <button onClick={()=>setModal(true)}
              style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              + {isAdmin?'Nouveau voyage':'Déclarer mon voyage'}
            </button>
          )}
        </div>
      </div>

      {!isAdmin && myPersonnel && (
        <div style={{ background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
          👤 Vous voyez uniquement vos voyages : <b>{myPersonnel.nom} {myPersonnel.prenom}</b> · {myPersonnel.societe}
        </div>
      )}
      {!isAdmin && !myPersonnel && (
        <div style={{ background:'rgba(240,165,0,.08)', border:'1px solid rgba(240,165,0,.25)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12, color:'#d08800' }}>
          ⚠️ Votre profil n'est pas encore déclaré comme Personnel. Contactez l'admin.
        </div>
      )}

      {/* KPIs - admin only */}
      {isAdmin && stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
          {[['Total',stats.total,'var(--blue)','✈️'],['Planifiés',stats.planifies,'#2563eb','📅'],
            ['En voyage',stats.en_voyage,'#ea580c','🚀'],['Retours',stats.retours,'#16a34a','🏠']].map(([l,v,c,ic])=>(
            <div key={l} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }}>
              <div style={{ fontFamily:'monospace', fontSize:24, fontWeight:700, color:c }}>{v||0}</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {Object.entries(STATUT_LABELS).map(([k,l])=>(
          <button key={k} onClick={()=>setFilterStatut(filterStatut===k?'':k)}
            style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${filterStatut===k?STATUT_COLORS[k].color:'var(--border)'}`,
              background:filterStatut===k?STATUT_COLORS[k].bg:'var(--surface2)',
              color:filterStatut===k?STATUT_COLORS[k].color:'var(--text-dim)', cursor:'pointer', fontSize:11, fontWeight:filterStatut===k?700:400 }}>
            {l}
          </button>
        ))}
        {filterStatut && <button onClick={()=>setFilterStatut('')} style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text-dim)', cursor:'pointer', fontSize:11 }}>✕ Reset</button>}
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:40, textAlign:'center', color:'var(--text-dim)', boxShadow:'var(--shadow)' }}>
          {!ready ? (
            <><div style={{ fontSize:36, marginBottom:10 }}>⏳</div><div style={{ fontSize:13 }}>Chargement...</div></>
          ) : (
            <><div style={{ fontSize:40, marginBottom:10 }}>✈️</div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>Aucun voyage</div>
            <div style={{ fontSize:12 }}>{isAdmin ? "Aucun voyage enregistré" : "Aucun voyage à afficher"}</div></>
          )}
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:800 }}>
            <thead><tr style={{ background:'var(--blue)' }}>
              {[isAdmin&&'Personnel','Destination','Motif','Départ','Heure','Retour','Statut','Actions'].filter(Boolean).map(h=>(
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.85)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map((v,i)=>{
                const sc = STATUT_COLORS[v.statut]||STATUT_COLORS.annule
                return (
                  <tr key={v.id} style={{ borderTop:'1px solid var(--border)', background:i%2?'var(--surface2)':'#fff' }}>
                    {isAdmin && (
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ fontWeight:700, fontSize:13 }}>{v.personnel_detail?.nom} {v.personnel_detail?.prenom}</div>
                        <div style={{ fontSize:11, color:'var(--text-dim)' }}>{v.personnel_detail?.societe}</div>
                      </td>
                    )}
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{v.destination||'—'}</td>
                    <td style={{ padding:'10px 12px', fontSize:11, color:'var(--text-dim)', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.motif||'—'}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11 }}>{v.date_depart}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11, color:'#7c3aed' }}>{v.heure_depart || '—'}</td>
                    <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11 }}>{v.date_retour_prevue}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:sc.bg, color:sc.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                        {STATUT_LABELS[v.statut]||v.statut}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {isAdmin && (
                          <button onClick={()=>openEdit(v)} style={{ background:'rgba(37,99,235,.1)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:700 }}>✏️</button>
                        )}
                        {v.statut==='planifie' && <>
                          <button onClick={()=>partir(v.id)} style={{ background:'rgba(234,88,12,.1)', color:'#ea580c', border:'1px solid rgba(234,88,12,.3)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}>🚀</button>
                          <button onClick={()=>annulerVoyage(v)} style={{ background:'rgba(100,116,139,.1)', color:'#64748b', border:'1px solid rgba(100,116,139,.2)', padding:'4px 7px', borderRadius:6, cursor:'pointer', fontSize:10 }}>✕</button>
                          {isAdmin && <button onClick={()=>supprimerVoyage(v)} style={{ background:'rgba(220,38,38,.08)', color:'#dc2626', border:'1px solid rgba(220,38,38,.15)', padding:'4px 7px', borderRadius:6, cursor:'pointer', fontSize:10 }}>🗑</button>}
                        </>}
                        {v.statut==='en_voyage' && (
                          <button onClick={()=>revenir(v)} style={{ background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.3)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700 }}>🏠</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'16px 20px', background:'var(--blue)', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15 }}>✈️ {isAdmin?'Nouveau voyage':'Déclarer mon voyage'}</h3>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Personnel *</label>
                {isAdmin ? (
                  <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                    <option value="">— Sélectionner —</option>
                    {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                  </select>
                ) : (
                  <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:600, color:'var(--blue)' }}>
                    {myPersonnel ? `${myPersonnel.nom} ${myPersonnel.prenom} · ${myPersonnel.societe}` : '⚠️ Profil non trouvé'}
                  </div>
                )}
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Destination *</label>
                <input value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} style={inp} placeholder="Ville, pays..."/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Motif</label>
                <input value={form.motif} onChange={e=>setForm({...form,motif:e.target.value})} style={inp} placeholder="Raison du voyage..."/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Date départ *</label>
                  <input type="date" value={form.date_depart} min={today} onChange={e=>setForm({...form,date_depart:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Heure départ *</label>
                  <input type="time" value={form.heure_depart} onChange={e=>setForm({...form,heure_depart:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Retour prévu *</label>
                <input type="date" value={form.date_retour_prevue} min={form.date_depart||today} onChange={e=>setForm({...form,date_retour_prevue:e.target.value})} style={inp}/>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setModal(false)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={createVoyage} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                🚀 Déclarer le voyage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'16px 20px', background:'#7c3aed', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15 }}>✏️ Modifier le voyage</h3>
              <button onClick={()=>setEditModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Personnel</label>
                <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', fontSize:13, fontWeight:600, color:'var(--blue)' }}>
                  {editModal.personnel_detail?.nom} {editModal.personnel_detail?.prenom} · {editModal.personnel_detail?.societe}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Destination *</label>
                <input value={editModal.destination} onChange={e=>setEditModal({...editModal, destination:e.target.value})} style={inp} placeholder="Ville, pays..."/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Motif</label>
                <input value={editModal.motif || ''} onChange={e=>setEditModal({...editModal, motif:e.target.value})} style={inp} placeholder="Raison du voyage..."/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Date départ *</label>
                  <input type="date" value={editModal.date_depart} onChange={e=>setEditModal({...editModal, date_depart:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Heure départ</label>
                  <input type="time" value={editModal.heure_depart || ''} onChange={e=>setEditModal({...editModal, heure_depart:e.target.value})} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Retour prévu *</label>
                <input type="date" value={editModal.date_retour_prevue} onChange={e=>setEditModal({...editModal, date_retour_prevue:e.target.value})} style={inp}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Statut</label>
                <select value={editModal.statut} onChange={e=>setEditModal({...editModal, statut:e.target.value})} style={inp}>
                  <option value="planifie">Planifié</option>
                  <option value="en_voyage">En voyage</option>
                  <option value="retour">Retour camp</option>
                  <option value="annule">Annulé</option>
                </select>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setEditModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={saveEdit} style={{ background:'#7c3aed', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                💾 Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}