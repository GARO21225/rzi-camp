import React, { useState, useEffect } from 'react'
import { demandes as demandesAPI, batiments as batAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const TYPE_COLORS = {
  reservation_residence:{ bg:'rgba(37,99,235,.1)', color:'#2563eb', icon:'🏠', label:'Réservation résidence' },
  voyage:{ bg:'rgba(234,88,12,.1)', color:'#ea580c', icon:'✈️', label:'Voyage' },
  maintenance:{ bg:'rgba(220,38,38,.1)', color:'#dc2626', icon:'🛠️', label:'Maintenance' },
}
const STATUT_STYLES = {
  en_attente:{ bg:'rgba(240,165,0,.12)', color:'#d08800', label:'⏳ En attente' },
  validee:{ bg:'rgba(22,163,74,.12)', color:'#16a34a', label:'✅ Validée' },
  rejetee:{ bg:'rgba(220,38,38,.12)', color:'#dc2626', label:'❌ Rejetée' },
  proposition:{ bg:'rgba(124,58,237,.12)', color:'#7c3aed', label:'💬 Proposition admin' },
  acceptee:{ bg:'rgba(22,163,74,.12)', color:'#16a34a', label:'✅ Acceptée' },
  annulee:{ bg:'rgba(100,116,139,.12)', color:'#64748b', label:'🚫 Annulée' },
}

const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }
const today = new Date().toISOString().slice(0,10)

export default function Demandes() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = ['admin'].includes(role) || user?.is_staff || user?.is_superuser

  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(isAdmin ? 'pending' : 'mes_demandes')
  const [createModal, setCreateModal] = useState(null) // 'reservation'|'voyage'|'maintenance'
  const [detailModal, setDetailModal] = useState(null)
  const [actionModal, setActionModal] = useState(null) // {demande, action:'valider'|'rejeter'|'proposer'}
  const [bats, setBats] = useState([])
  const [batsLoading, setBatsLoading] = useState(false)
  const [form, setForm] = useState({
    message_demandeur:'', residence_souhaitee:'',
    date_debut_souhaitee:today, date_fin_souhaitee:'',
    donnees:{}
  })
  const [actionForm, setActionForm] = useState({ commentaire:'', proposition:{} })

  const load = () => {
    setLoading(true)
    const p = {}
    if (tab === 'pending') p.statut = 'en_attente'
    else if (tab === 'propositions') p.statut = 'proposition'
    else if (tab === 'archive') {} // all
    demandesAPI.list(p).then(r => setData(r.data.results||r.data)).finally(()=>setLoading(false))
    if (isAdmin) demandesAPI.stats().then(r => setStats(r.data)).catch(()=>{})
    batAPI.list({page_size:300}).then(r => {
      const items = r.data.results||r.data
      setBats([...items].filter(b=>b.statut==='Libre').sort((a,b)=>a.residence.localeCompare(b.residence,undefined,{numeric:true})))
    })
  }

  useEffect(()=>{ load() }, [tab])

  const submitDemande = async (type) => {
    try {
      await demandesAPI.create({ type_demande:type, ...form })
      setCreateModal(null)
      setForm({ message_demandeur:'', residence_souhaitee:'', date_debut_souhaitee:today, date_fin_souhaitee:'', donnees:{} })
      load()
    } catch(e) { alert(e.response?.data?JSON.stringify(e.response.data):e.message) }
  }

  const doAction = async () => {
    const { demande, action } = actionModal
    try {
      if (action === 'valider') await demandesAPI.valider(demande.id, actionForm)
      else if (action === 'rejeter') await demandesAPI.rejeter(demande.id, actionForm)
      else if (action === 'proposer') await demandesAPI.proposer(demande.id, actionForm)
      setActionModal(null)
      setActionForm({ commentaire:'', proposition:{} })
      setDetailModal(null)
      load()
    } catch(e) { alert(e.response?.data?JSON.stringify(e.response.data):e.message) }
  }

  const doAgentAction = async (demande, action) => {
    try {
      if (action === 'accepter') await demandesAPI.accepterProposition(demande.id)
      else if (action === 'refuser') await demandesAPI.refuserProposition(demande.id)
      else if (action === 'annuler') await demandesAPI.annuler(demande.id)
      load()
    } catch(e) { alert(e.response?.data?.error||e.message) }
  }

  const deleteDemande = async (id) => {
    if (!window.confirm('Supprimer définitivement cette demande ?')) return
    await demandesAPI.delete(id); load()
  }

  const ADMIN_TABS = [['pending','⏳ En attente'],['propositions','💬 Propositions'],['archive','📋 Toutes']]
  const AGENT_TABS = [['mes_demandes','📋 Mes demandes'],['proposition_recue','💬 Propositions reçues']]

  const filterData = () => {
    if (!isAdmin && tab === 'proposition_recue') return data.filter(d=>d.statut==='proposition')
    return data
  }

  return (
    <div style={{ padding:'16px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'var(--blue)' }}>📋 Demandes & Workflow</h2>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>
            {isAdmin ? 'Validation admin · Suivi complet des demandes' : 'Soumettez vos demandes · Suivez leur statut'}
          </p>
        </div>
        {!isAdmin && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setCreateModal('reservation_residence')}
              style={{ background:'rgba(37,99,235,.1)', color:'#2563eb', border:'1px solid rgba(37,99,235,.25)', padding:'8px 14px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              🏠 Réserver résidence
            </button>
            <button onClick={()=>setCreateModal('voyage')}
              style={{ background:'rgba(234,88,12,.1)', color:'#ea580c', border:'1px solid rgba(234,88,12,.25)', padding:'8px 14px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              ✈️ Planifier voyage
            </button>
          </div>
        )}
      </div>

      {/* Admin KPIs */}
      {isAdmin && stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, minmax(0, 1fr))', gap:10, marginBottom:16 }}>
          {[
            [stats.en_attente,'En attente','#d08800','⏳'],
            [stats.propositions,'Propositions','#7c3aed','💬'],
            [stats.validees,'Validées','#16a34a','✅'],
            [stats.rejetees,'Rejetées','#dc2626','❌'],
            [stats.total,'Total','var(--blue)','📋'],
          ].map(([v,l,c,ic])=>(
            <div key={l} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }}>
              <div style={{ fontFamily:'monospace', fontSize:24, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:14, background:'var(--surface2)', borderRadius:10, padding:4, border:'1px solid var(--border)' }}>
        {(isAdmin ? ADMIN_TABS : AGENT_TABS).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{ flex:1, padding:'8px 4px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
              background:tab===k?'#fff':'transparent', color:tab===k?'var(--blue)':'var(--text-dim)',
              boxShadow:tab===k?'var(--shadow)':'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? <div style={{padding:32,textAlign:'center',color:'var(--text-dim)'}}>Chargement...</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filterData().length === 0 && (
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:40, textAlign:'center', color:'var(--text-dim)', boxShadow:'var(--shadow)' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
              <div style={{ fontSize:14 }}>{isAdmin ? "Aucune demande en attente" : "Aucune demande soumise"}</div>
              {!isAdmin && <div style={{ fontSize:12, marginTop:6 }}>Utilisez les boutons ci-dessus pour soumettre une demande</div>}
            </div>
          )}
          {filterData().map(d => {
            const tc = TYPE_COLORS[d.type_demande] || TYPE_COLORS.maintenance
            const sc = STATUT_STYLES[d.statut] || STATUT_STYLES.en_attente
            return (
              <div key={d.id} style={{ background:'#fff', border:`1px solid ${d.statut==='en_attente'?'rgba(240,165,0,.3)':'var(--border)'}`, borderRadius:12, padding:16, boxShadow:'var(--shadow)', display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ width:50, height:50, borderRadius:12, background:tc.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                  {tc.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:'var(--blue)' }}>{tc.label}</span>
                    <span style={{ background:sc.bg, color:sc.color, padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{sc.label}</span>
                    {isAdmin && <span style={{ fontSize:12, color:'var(--text-dim)' }}>par {d.demandeur_nom}</span>}
                  </div>
                  {d.message_demandeur && <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.message_demandeur}</div>}
                  <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text-dim)', flexWrap:'wrap' }}>
                    {d.residence_souhaitee && <span>🏠 {d.residence_souhaitee}</span>}
                    {d.date_debut_souhaitee && <span>📅 {d.date_debut_souhaitee}</span>}
                    {d.date_fin_souhaitee && <span>→ {d.date_fin_souhaitee}</span>}
                    <span>🕐 {new Date(d.date_creation).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {d.commentaire_admin && (
                    <div style={{ marginTop:8, background:d.statut==='proposition'?'rgba(124,58,237,.06)':'rgba(22,163,74,.06)', border:`1px solid ${d.statut==='proposition'?'rgba(124,58,237,.15)':'rgba(22,163,74,.15)'}`, borderRadius:8, padding:'8px 12px', fontSize:12 }}>
                      {d.statut==='proposition' && <b style={{color:'#7c3aed'}}>💬 Proposition : </b>}
                      {d.statut==='validee' && <b style={{color:'#16a34a'}}>✅ Admin : </b>}
                      {d.statut==='rejetee' && <b style={{color:'#dc2626'}}>❌ Rejet : </b>}
                      {d.commentaire_admin}
                      {d.proposition_admin && Object.keys(d.proposition_admin).length>0 && (
                        <div style={{marginTop:6}}>
                          {Object.entries(d.proposition_admin).map(([k,v])=>(
                            <div key={k}><b>{k} :</b> {v}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, minWidth:120 }}>
                  {isAdmin && d.statut === 'en_attente' && (
                    <>
                      <button onClick={()=>{ setActionModal({demande:d,action:'valider'}); setActionForm({commentaire:'',proposition:{residence:d.residence_souhaitee}}) }}
                        style={{ background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>✅ Valider</button>
                      <button onClick={()=>{ setActionModal({demande:d,action:'proposer'}); setActionForm({commentaire:'',proposition:{residence:d.residence_souhaitee}}) }}
                        style={{ background:'rgba(124,58,237,.1)', color:'#7c3aed', border:'1px solid rgba(124,58,237,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>💬 Proposer</button>
                      <button onClick={()=>{ setActionModal({demande:d,action:'rejeter'}); setActionForm({commentaire:'',proposition:{}}) }}
                        style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>❌ Rejeter</button>
                    </>
                  )}
                  {isAdmin && d.statut === 'proposition' && (
                    <span style={{ fontSize:11, color:'#7c3aed', fontStyle:'italic' }}>Réponse attendue...</span>
                  )}
                  {!isAdmin && d.statut === 'proposition' && (
                    <>
                      <button onClick={()=>doAgentAction(d,'accepter')}
                        style={{ background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>✅ Accepter</button>
                      <button onClick={()=>doAgentAction(d,'refuser')}
                        style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>❌ Refuser</button>
                    </>
                  )}
                  {!isAdmin && d.statut === 'en_attente' && (
                    <button onClick={()=>doAgentAction(d,'annuler')}
                      style={{ background:'rgba(100,116,139,.1)', color:'#64748b', border:'1px solid rgba(100,116,139,.2)', padding:'5px 8px', borderRadius:7, cursor:'pointer', fontSize:10 }}>Annuler</button>
                  )}
                  {isAdmin && (
                    <button onClick={()=>deleteDemande(d.id)}
                      style={{ background:'rgba(220,38,38,.08)', color:'#dc2626', border:'1px solid rgba(220,38,38,.15)', padding:'4px 8px', borderRadius:7, cursor:'pointer', fontSize:10 }}>🗑</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      {createModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding:'16px 20px', background:TYPE_COLORS[createModal]?.color||'var(--blue)', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15 }}>{TYPE_COLORS[createModal]?.icon} {TYPE_COLORS[createModal]?.label}</h3>
              <button onClick={()=>setCreateModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
                📋 Votre demande sera envoyée à l'admin pour validation. Vous serez notifié de la décision.
              </div>

              {createModal === 'reservation_residence' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence souhaitée</label>
                  <select value={form.residence_souhaitee} onChange={e=>setForm({...form,residence_souhaitee:e.target.value})} style={inp}>
                    <option value="">— Sélectionner une résidence libre —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              {createModal === 'voyage' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Destination</label>
                  <input value={form.donnees?.destination||''} onChange={e=>setForm({...form,donnees:{...form.donnees,destination:e.target.value}})} style={inp} placeholder="Ville, pays..."/>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{createModal==='voyage'?'Date départ':'Date arrivée'}</label>
                  <input type="date" value={form.date_debut_souhaitee} min={today} onChange={e=>setForm({...form,date_debut_souhaitee:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{createModal==='voyage'?'Retour prévu':'Date départ'}</label>
                  <input type="date" value={form.date_fin_souhaitee} min={form.date_debut_souhaitee||today} onChange={e=>setForm({...form,date_fin_souhaitee:e.target.value})} style={inp}/>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Message / Justification *</label>
                <textarea value={form.message_demandeur} onChange={e=>setForm({...form,message_demandeur:e.target.value})} rows={4}
                  style={{ ...inp, resize:'vertical' }} placeholder="Expliquez votre demande..."/>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setCreateModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={()=>submitDemande(createModal)} style={{ background:TYPE_COLORS[createModal]?.color||'var(--blue)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                📤 Soumettre la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION MODAL (Admin) ── */}
      {actionModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding:'16px 20px', background:actionModal.action==='valider'?'#16a34a':actionModal.action==='rejeter'?'#dc2626':'#7c3aed', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15 }}>
                {actionModal.action==='valider'?'✅ Valider':actionModal.action==='rejeter'?'❌ Rejeter':'💬 Contre-proposition'}
              </h3>
              <button onClick={()=>setActionModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ background:'var(--surface2)', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:12 }}>
                <b>Demande de :</b> {actionModal.demande.demandeur_nom}<br/>
                <b>Type :</b> {TYPE_COLORS[actionModal.demande.type_demande]?.label}<br/>
                {actionModal.demande.residence_souhaitee && <><b>Résidence souhaitée :</b> {actionModal.demande.residence_souhaitee}<br/></>}
                {actionModal.demande.message_demandeur && <><b>Message :</b> {actionModal.demande.message_demandeur}</>}
              </div>

              {actionModal.action === 'valider' && actionModal.demande.type_demande === 'reservation_residence' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence attribuée</label>
                  <select value={actionForm.proposition?.residence||''} onChange={e=>setActionForm({...actionForm,proposition:{...actionForm.proposition,residence:e.target.value}})} style={inp}>
                    <option value="">— Confirmer résidence —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              {actionModal.action === 'proposer' && (
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence proposée (alternative)</label>
                  <select value={actionForm.proposition?.residence||''} onChange={e=>setActionForm({...actionForm,proposition:{...actionForm.proposition,residence:e.target.value}})} style={inp}>
                    <option value="">— Proposer une résidence —</option>
                    {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>
                  {actionModal.action==='rejeter'?'Motif du rejet *':'Commentaire / Message'}
                </label>
                <textarea value={actionForm.commentaire} onChange={e=>setActionForm({...actionForm,commentaire:e.target.value})} rows={3}
                  style={{ ...inp, resize:'vertical' }} placeholder={actionModal.action==='rejeter'?'Expliquez le motif...':'Message au demandeur...'}/>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setActionModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={doAction}
                style={{ background:actionModal.action==='valider'?'#16a34a':actionModal.action==='rejeter'?'#dc2626':'#7c3aed', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                {actionModal.action==='valider'?'✅ Confirmer validation':actionModal.action==='rejeter'?'❌ Confirmer rejet':'💬 Envoyer proposition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
