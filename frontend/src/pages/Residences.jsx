
import React, { useEffect, useState } from 'react'
import { batiments, personnel as personnelAPI, occupationHistory, occupationHistoryAdmin, residentsPrincipaux, incidents as incidentsAPI } from '../api'
import { useStore } from '../store'
import { toast, confirmDialog } from '../toast'

const bcolor = { Libre:'var(--rzc-green)', 'Occupé':'var(--rzc-red)', 'Réservé':'var(--rzc-blue)', Maintenance:'var(--rzc-ore-gold)' }
const today = new Date().toISOString().slice(0,10)

export default function Residences() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'
  const [data, setData] = useState([])
  const [personnelList, setPersonnelList] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiErr,  setApiErr]  = useState('')
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const [bloc, setBloc] = useState('')
  const [blocs, setBlocs] = useState([])
  const [futurDepart, setFuturDepart] = useState(false)

  // Modals
  const [editModal, setEditModal] = useState(null)       // Room being edited
  const [confirmModal, setConfirmModal] = useState(null)  // Preview before confirm
  const [conflitResidence, setConflitResidence] = useState(null) // { error, resident_principal, retour_prevu, alternatives }
  const [histModal, setHistModal] = useState(null)        // History view
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [editHistModal, setEditHistModal] = useState(null) // Edit wrong history entry
  const [vueOnglet, setVueOnglet] = useState('chambres')

  const [form, setForm] = useState({ statut:'Libre', personnel:'', occupant:'', societe:'', date_arrivee:'', date_depart:'' })

  const load = () => {
    setLoading(true)
    const p = {}
    if (search) p.search = search
    if (statut) p.statut = statut
    if (bloc) p.bloc = bloc
    // Filtre S-1 désactivé temporairement (aucun départ programmé sur Render)
    // if (futurDepart) p.futur_depart = 's1'
    setApiErr('')
    batiments.list(p).then(r => {
      const items = r.data.results||r.data||[]
      if (!Array.isArray(items)) { setApiErr('Réponse API invalide'); setData([]); return }
      setData(items)
      const b = [...new Set(items.map(x=>x.bloc))].sort()
      setBlocs(b)
    }).catch(e => {
      if (e.response?.status === 401) setApiErr('Session expirée — reconnectez-vous')
      else setApiErr(`Erreur serveur ${e.response?.status || ''}: ${e.message}`)
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
      if (e.response?.status === 409 && e.response?.data?.conflit_residence_principale) {
        // Conflit avec un resident principal absent (section 9-12 du
        // document hebergement) - recherche immediatement des chambres
        // compatibles avec la MEME periode plutot que de laisser
        // l'utilisateur deviner quoi faire.
        let alternatives = []
        try {
          const r = await batiments.chambresDisponibles(confirmModal.payload.date_arrivee || new Date().toISOString().slice(0,10), confirmModal.payload.date_depart)
          alternatives = r.data.compatibles || []
        } catch {}
        setConflitResidence({ ...e.response.data, alternatives, createHistory })
        return
      }
      if (e.response?.status === 409 && e.response?.data?.reaffectation_requise) {
        const ok = await confirmDialog(`${e.response.data.error}\n\nRéaffecter cette personne à la nouvelle chambre ? L'ancienne (${e.response.data.ancienne_chambre}) sera automatiquement libérée.`)
        if (ok) {
          try {
            await batiments.update(confirmModal.batiment.id, {...confirmModal.payload, reaffectation:true}, createHistory)
            setConfirmModal(null)
            load()
            return
          } catch(e2) { toast.error('Erreur: ' + (e2.response?.data ? JSON.stringify(e2.response.data) : e2.message)) }
        }
        return
      }
      toast.error('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    }
  }

  // Save WITHOUT history (correction d'erreur)
  const saveSansHistorique = async () => {
    try {
      await batiments.update(confirmModal.batiment.id, confirmModal.payload, false)
      setConfirmModal(null)
      load()
    } catch(e) {
      toast.error('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    }
  }

  const choisirAlternative = (b) => {
    // Reprend exactement le meme payload (occupant, dates) mais vise la
    // nouvelle chambre compatible choisie.
    setConfirmModal(cm => ({ ...cm, batiment: b }))
    setConflitResidence(null)
    // Relance directement la sauvegarde sur la nouvelle chambre
    batiments.update(b.id, confirmModal.payload, conflitResidence.createHistory)
      .then(()=>{ setConfirmModal(null); load(); toast.success(`Affecté à ${b.residence} à la place.`) })
      .catch(e=>toast.error('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message)))
  }

  const confirmerMalgreConflit = async () => {
    try {
      await batiments.update(confirmModal.batiment.id, {...confirmModal.payload, ignorer_conflit_residence:true}, conflitResidence.createHistory)
      setConflitResidence(null); setConfirmModal(null)
      load()
    } catch(e) { toast.error('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message)) }
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
    if (!await confirmDialog('Supprimer cette entrée d\'historique ?\nLa chambre ne sera pas modifiée.')) return
    try {
      await occupationHistoryAdmin.delete(id)
      // Refresh history
      const r = await occupationHistory.recherche({ batiment: histModal.residence })
      setHistory(r.data.results||r.data||[])
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const inp = { background:'var(--rzc-charcoal-l2)', border:'1px solid var(--rzc-border-light)', color:'var(--rzc-text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }

  return (
    <div className="rzc-page-scope" style={{ padding:'16px' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'var(--rzc-navy)' }}>🏠 Gestion des Résidences</h2>
          <p style={{ fontSize:12, color:'var(--rzc-text-3)', marginTop:3 }}>204 bâtiments · 19 blocs · Confirmation avant historisation</p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <a href={batiments.exportCsv({})} style={{ background:'var(--rzc-green)', color:'#fff', padding:'7px 12px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:700 }}>⬇ CSV</a>
          <a href={batiments.exportBlocs()} style={{ background:'var(--rzc-navy)', color:'#fff', padding:'7px 12px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:700 }}>⬇ Blocs</a>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        <button onClick={()=>setVueOnglet('chambres')}
          style={{ background: vueOnglet==='chambres' ? 'var(--rzc-navy)' : '#f1f5f9', color: vueOnglet==='chambres' ? '#fff' : '#475569',
            border:'none', padding:'8px 16px', borderRadius:9, cursor:'pointer', fontSize:12.5, fontWeight:700 }}>
          🏠 Chambres
        </button>
        <button onClick={()=>setVueOnglet('residents')}
          style={{ background: vueOnglet==='residents' ? 'var(--rzc-navy)' : '#f1f5f9', color: vueOnglet==='residents' ? '#fff' : '#475569',
            border:'none', padding:'8px 16px', borderRadius:9, cursor:'pointer', fontSize:12.5, fontWeight:700 }}>
          ⭐ Résidents principaux
        </button>
      </div>

      {vueOnglet==='residents' ? <ResidentsPrincipauxTab isAdmin={isAdmin} personnelList={personnelList} batimentsList={data} /> : <>

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
          style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${futurDepart?'var(--rzc-red)':'var(--rzc-border-light)'}`,
            background:futurDepart?'rgba(220,38,38,.1)':'var(--rzc-charcoal-l2)', color:futurDepart?'var(--rzc-red)':'var(--rzc-text-3)',
            cursor:'pointer', fontSize:12, fontWeight:futurDepart?700:400 }}>
          ✈️ S-1{futurDepart?' ✓':''}
        </button>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--rzc-text-3)', background:'var(--rzc-charcoal-l2)', padding:'7px 12px', borderRadius:8, border:'1px solid var(--rzc-border-light)' }}>
          {data.length} résidences
        </span>
      </div>
      {/* Warning: filtres sans résultats */}
      {data.length === 0 && (bloc || statut || search) && (
        <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,
          padding:'12px 16px',marginBottom:12,display:'flex',alignItems:'center',
          justifyContent:'space-between',gap:10}}>
          <span style={{fontSize:13,color:'#92400e'}}>
            ⚠️ Aucun bâtiment pour ces filtres.
          </span>
          <button onClick={()=>{setBloc('');setStatut('');setSearch('')}}
            style={{background:'var(--rzc-copper)',color:'#fff',border:'none',padding:'5px 12px',
              borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700}}>
            ✕ Effacer
          </button>
        </div>
      )}


      {/* Table */}
      <div style={{ background:'var(--rzc-charcoal-l1)', border:'1px solid var(--rzc-border-light)', borderRadius:12, overflow:'hidden', boxShadow:'var(--rzc-shadow)' }}>
        <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:700 }}>
            <thead>
              <tr style={{ background:'var(--rzc-navy)' }}>
                {['Résidence','Bloc','Statut','Occupant','Société','Arrivée','Départ','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.85)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:'var(--rzc-text-3)' }}>Chargement...</td></tr>
                : data.map((b,i)=>(
                  <tr key={b.id} style={{ borderTop:'1px solid var(--rzc-border-light)', background:i%2?'var(--rzc-charcoal-l2)':'transparent' }}>
                    <td style={{ padding:'9px 12px', fontFamily:'monospace', fontWeight:700, color:'var(--rzc-navy)' }}>{b.residence}</td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--rzc-text-3)' }}>{b.bloc}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ background:`${bcolor[b.statut]}18`, color:bcolor[b.statut], padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:700 }}>{b.statut}</span>
                    </td>
                    <td style={{ padding:'9px 12px', color:b.occupant?'var(--rzc-text)':'var(--rzc-text-3)', fontSize:12 }}>
                      {b.personnel_detail?`${b.personnel_detail.nom} ${b.personnel_detail.prenom}`:(b.occupant||'—')}
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--rzc-text-3)' }}>{b.personnel_detail?.societe||b.societe||'—'}</td>
                    <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:11, color:'var(--rzc-text-3)' }}>{b.date_arrivee||'—'}</td>
                    <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:11, color:b.date_depart?'var(--rzc-red)':'var(--rzc-text-3)' }}>{b.date_depart||'—'}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>openEdit(b)} style={{ background:'var(--rzc-navy)', color:'#fff', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>Modifier</button>
                        <button onClick={()=>openHistory(b)} style={{ background:'var(--rzc-charcoal-l2)', border:'1px solid var(--rzc-border-light)', color:'var(--rzc-text-3)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }} title="Historique">📋</button>
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
          <div style={{ background:'var(--rzc-charcoal-l1)', borderRadius:14, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--rzc-shadow-lg)' }}>
            <div style={{ padding:'16px 20px', background:'var(--rzc-navy)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15 }}>🏠 {editModal.residence} — {editModal.bloc}</h3>
              <button onClick={()=>setEditModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              {/* Statut */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--rzc-text-3)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Statut</label>
                <div style={{ display:'flex', gap:6 }}>
                  {['Libre','Occupé','Réservé','Maintenance'].map(s=>(
                    <button key={s} onClick={()=>setForm({...form,statut:s})}
                      style={{ flex:1, padding:'7px 4px', borderRadius:8, border:`2px solid ${form.statut===s?bcolor[s]:'var(--rzc-border-light)'}`,
                        background:form.statut===s?`${bcolor[s]}18`:'var(--rzc-charcoal-l2)',
                        color:form.statut===s?bcolor[s]:'var(--rzc-text-3)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personnel */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--rzc-text-3)', marginBottom:5, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Personnel déclaré</label>
                <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                  <option value="">— Saisie manuelle —</option>
                  {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe} ({p.type_label})</option>)}
                </select>
              </div>

              {!form.personnel && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, marginBottom:14 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, color:'var(--rzc-text-3)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Occupant</label>
                    <input value={form.occupant} onChange={e=>setForm({...form,occupant:e.target.value})} style={inp} placeholder="Nom occupant"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, color:'var(--rzc-text-3)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Société</label>
                    <input value={form.societe} onChange={e=>setForm({...form,societe:e.target.value})} style={inp} placeholder="Société"/>
                  </div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>
                {[["Date d'arrivée",'date_arrivee'],["Date de départ",'date_depart']].map(([l,k])=>(
                  <div key={k}>
                    <label style={{ display:'block', fontSize:11, color:'var(--rzc-text-3)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                    <input type="date" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--rzc-border-light)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setEditModal(null)} style={{ background:'var(--rzc-charcoal-l2)', border:'1px solid var(--rzc-border-light)', color:'var(--rzc-text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={preview} style={{ background:'var(--rzc-navy)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Aperçu avant confirmation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL ── */}
      {confirmModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2100, padding:16 }}>
          <div style={{ background:'var(--rzc-charcoal-l1)', borderRadius:14, width:'100%', maxWidth:460, boxShadow:'var(--rzc-shadow-lg)' }}>
            <div style={{ padding:'16px 20px', background:'var(--rzc-ore-gold)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#000', fontSize:15 }}>⚠️ Confirmer l'affectation</h3>
              <button onClick={()=>{ setConfirmModal(null); setEditModal(confirmModal.batiment) }} style={{ background:'rgba(0,0,0,.1)', border:'none', color:'#000', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px' }}>
              {/* Résumé */}
              <div style={{ background:'var(--rzc-charcoal-l2)', borderRadius:10, padding:'14px 16px', marginBottom:16 }}>
                <div style={{ fontSize:12, color:'var(--rzc-text-3)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Récapitulatif</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, fontSize:13 }}>
                  {[
                    ['Résidence', confirmModal.batiment.residence],
                    ['Nouveau statut', confirmModal.resume.statut],
                    ['Occupant', confirmModal.resume.nom],
                    ['Société', confirmModal.resume.societe],
                    ["Date d'arrivée", confirmModal.resume.date_arrivee],
                    ['Date de départ', confirmModal.resume.date_depart],
                  ].map(([l,v])=>(
                    <div key={l}>
                      <div style={{ fontSize:10, color:'var(--rzc-text-3)', marginBottom:2 }}>{l}</div>
                      <div style={{ fontWeight:700, color:'var(--rzc-navy)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historique warning */}
              {confirmModal.resume.creerHistorique ? (
                <div style={{ background:'rgba(22,163,74,.08)', border:'1px solid rgba(22,163,74,.25)', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--rzc-green)', marginBottom:4 }}>📋 Historique occupation</div>
                  <div style={{ fontSize:12, color:'var(--rzc-text-3)' }}>
                    Une entrée sera créée dans l'historique d'occupation.
                    <br/><b>Si c'est une erreur</b>, cliquer sur "Sauvegarder sans historique".
                  </div>
                </div>
              ) : (
                <div style={{ background:'rgba(100,116,139,.08)', border:'1px solid rgba(100,116,139,.2)', borderRadius:10, padding:'12px 16px', marginBottom:14 }}>
                  <div style={{ fontSize:12, color:'var(--rzc-text-3)' }}>ℹ️ Aucune entrée d'historique ne sera créée pour cette modification.</div>
                </div>
              )}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid var(--rzc-border-light)', display:'flex', flexDirection:'column', gap:8 }}>
              {confirmModal.resume.creerHistorique && (
                <button onClick={()=>confirmSave(true)} style={{ background:'var(--rzc-green)', color:'#fff', border:'none', padding:'11px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700, width:'100%' }}>
                  ✅ Confirmer + Enregistrer dans l'historique
                </button>
              )}
              <button onClick={()=>confirmSave(false)} style={{ background:'var(--rzc-navy)', color:'#fff', border:'none', padding:'11px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600, width:'100%' }}>
                💾 Sauvegarder sans créer d'historique
              </button>
              <button onClick={()=>{ setConfirmModal(null); setEditModal(confirmModal.batiment) }}
                style={{ background:'var(--rzc-charcoal-l2)', border:'1px solid var(--rzc-border-light)', color:'var(--rzc-text)', padding:'10px', borderRadius:8, cursor:'pointer', fontSize:13, width:'100%' }}>
                ← Retour — Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFLIT RESIDENCE PRINCIPALE (sections 9-12) ── */}
      {conflitResidence && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2500, padding:16 }}
          onClick={e=>e.target===e.currentTarget && setConflitResidence(null)}>
          <div style={{ background:'#fff', borderRadius:14, maxWidth:480, width:'100%', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', background:'#dc2626', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, fontSize:14 }}>⚠ Conflit d'hébergement</div>
              <button onClick={()=>setConflitResidence(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ fontSize:13, color:'#334155', marginBottom:16, lineHeight:1.5 }}>{conflitResidence.error}</div>

              {conflitResidence.alternatives.length > 0 ? (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8, textTransform:'uppercase' }}>
                    Chambres compatibles pour toute la période
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16, maxHeight:200, overflowY:'auto' }}>
                    {conflitResidence.alternatives.map(b=>(
                      <button key={b.id} onClick={()=>choisirAlternative(b)}
                        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f0fdf4', border:'1px solid #bbf7d0',
                          borderRadius:8, padding:'8px 12px', cursor:'pointer', textAlign:'left' }}>
                        <span style={{ fontWeight:700, fontSize:13, color:'#15803d' }}>{b.residence}</span>
                        <span style={{ fontSize:11, color:'#16a34a' }}>✓ Disponible toute la période</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize:12, color:'#94a3b8', marginBottom:16 }}>Aucune autre chambre compatible avec toute la période trouvée.</div>
              )}

              <button onClick={confirmerMalgreConflit}
                style={{ width:'100%', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:9, borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                Confirmer quand même sur {conflitResidence.resident_principal ? confirmModal?.batiment?.residence : ''} (déconseillé)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY MODAL ── */}
      {histModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'var(--rzc-charcoal-l1)', borderRadius:14, width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'var(--rzc-shadow-lg)' }}>
            <div style={{ padding:'16px 20px', background:'var(--rzc-navy)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
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
                <div style={{ padding:32, textAlign:'center', color:'var(--rzc-text-3)' }}>Chargement...</div>
              ) : history.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', color:'var(--rzc-text-3)' }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
                  <div>Aucun historique pour cette résidence</div>
                  <div style={{ fontSize:12, marginTop:4 }}>L'historique est créé lors des affectations confirmées</div>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                  <thead>
                    <tr style={{ background:'var(--rzc-charcoal-l2)', position:'sticky', top:0 }}>
                      {['Occupant','Société','Arrivée','Départ','Durée','Motif',isAdmin?'Action':''].filter(Boolean).map(h=>(
                        <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--rzc-text-3)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h,i) => {
                      const d1 = new Date(h.date_arrivee), d2 = h.date_depart?new Date(h.date_depart):new Date()
                      const days = Math.round((d2-d1)/(1000*60*60*24))
                      return (
                        <tr key={h.id} style={{ borderTop:'1px solid var(--rzc-border-light)', background:i%2?'var(--rzc-charcoal-l2)':'transparent' }}>
                          <td style={{ padding:'9px 14px', fontWeight:600 }}>{h.occupant}</td>
                          <td style={{ padding:'9px 14px', fontSize:11, color:'var(--rzc-text-3)' }}>{h.societe||'—'}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>{h.date_arrivee}</td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11 }}>
                            {h.date_depart || <span style={{ color:'var(--rzc-green)', fontWeight:700 }}>En cours</span>}
                          </td>
                          <td style={{ padding:'9px 14px', fontFamily:'monospace', fontSize:11, fontWeight:700, color:'var(--rzc-navy)' }}>{days}j</td>
                          <td style={{ padding:'9px 14px', fontSize:11, color:'var(--rzc-text-3)' }}>{h.motif_depart||'—'}</td>
                          {isAdmin && (
                            <td style={{ padding:'9px 14px' }}>
                              <button onClick={()=>deleteHistoryEntry(h.id)}
                                style={{ background:'rgba(220,38,38,.1)', color:'var(--rzc-red)', border:'1px solid rgba(220,38,38,.2)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}
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
            <div style={{ padding:'12px 16px', borderTop:'1px solid var(--rzc-border-light)', display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
              <button onClick={()=>setHistModal(null)} style={{ background:'var(--rzc-navy)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}

function ResidentsPrincipauxTab({ isAdmin, personnelList, batimentsList }) {
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [voirHistorique, setVoirHistorique] = useState(false)
  const [rechercheRp, setRechercheRp] = useState('')
  const [rpModal, setRpModal] = useState(null)
  const [personnelChoisi, setPersonnelChoisi] = useState('')
  const [batimentChoisi, setBatimentChoisi] = useState('')
  const [plainteModal, setPlainteModal] = useState(null) // { rp } - anomalie sur cette residence
  const [plainteForm, setPlainteForm] = useState({ titre:'', description:'', categorie:'Autre' })

  const charger = () => {
    setLoading(true)
    residentsPrincipaux.list({ actif: voirHistorique ? undefined : '1' })
      .then(r => setListe(r.data.results || r.data || []))
      .finally(() => setLoading(false))
  }
  useEffect(charger, [voirHistorique])

  const listeFiltree = liste.filter(rp => {
    if (!rechercheRp.trim()) return true
    const q = rechercheRp.toLowerCase()
    return (rp.personnel_nom||'').toLowerCase().includes(q) ||
           (rp.personnel_matricule||'').toLowerCase().includes(q) ||
           (rp.batiment_residence||'').toLowerCase().includes(q)
  })

  const ouvrirDeclaration = () => {
    setPersonnelChoisi(''); setBatimentChoisi(''); setRpModal('nouveau')
  }

  const declarer = async () => {
    if (!personnelChoisi || !batimentChoisi) return toast.error('Personnel et chambre requis.')
    try {
      await residentsPrincipaux.declarer(personnelChoisi, batimentChoisi)
      toast.success('Résident principal déclaré.')
      setRpModal(null); charger()
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  const mettreFin = async (rp) => {
    if (!await confirmDialog(`Mettre fin à la résidence principale de ${rp.personnel_nom} (${rp.batiment_residence}) ?`)) return
    try {
      await residentsPrincipaux.mettreFin(rp.id)
      toast.success('Résidence principale terminée.')
      charger()
    } catch(e) { toast.error('Erreur') }
  }

  const soumettrePlainte = async () => {
    if (!plainteForm.titre.trim() || !plainteForm.description.trim()) return toast.error('Titre et description requis.')
    try {
      await incidentsAPI.create({
        titre: plainteForm.titre, description: plainteForm.description, categorie: plainteForm.categorie,
        residence: plainteModal.rp.batiment_residence, priorite: 'moyenne',
      })
      toast.success('Anomalie signalée — suivie dans Maintenance (Plainte → Qualification → Résolution → Clôture).')
      setPlainteModal(null); setPlainteForm({ titre:'', description:'', categorie:'Autre' })
    } catch(e) { toast.error(e.response?.data?.error || 'Erreur') }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={()=>setVoirHistorique(false)}
            style={{ background: !voirHistorique ? 'var(--rzc-navy)' : '#f1f5f9', color: !voirHistorique ? '#fff' : '#475569',
              border:'none', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
            Actifs
          </button>
          <button onClick={()=>setVoirHistorique(true)}
            style={{ background: voirHistorique ? 'var(--rzc-navy)' : '#f1f5f9', color: voirHistorique ? '#fff' : '#475569',
              border:'none', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
            📜 Historique complet
          </button>
          <input value={rechercheRp} onChange={e=>setRechercheRp(e.target.value)} placeholder="🔍 Rechercher un personnel..."
            style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 12px', fontSize:12.5, width:200 }}/>
          <button onClick={()=>{
              const rows = [['Nom','Matricule','Resident principal','Chambre','Date affectation','Date fin','Statut','Occupant actuel'],
                ...listeFiltree.map(rp=>[rp.personnel_nom, rp.personnel_matricule||'', rp.actif?'Oui':'Non', rp.batiment_residence,
                  rp.date_debut, rp.date_fin||'', rp.actif?'Active':'Terminee', rp.occupant_actuel_nom||''])]
              const csv = rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
              const a = document.createElement('a')
              a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
              a.download = 'residents_principaux.csv'
              a.click()
            }}
            style={{ background:'#f1f5f9', color:'#475569', border:'1px solid #e2e8f0', padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
            ⬇ Export CSV
          </button>
        </div>
        {isAdmin && (
          <button onClick={ouvrirDeclaration}
            style={{ background:'#16a34a', color:'#fff', border:'none', padding:'8px 16px', borderRadius:9, cursor:'pointer', fontSize:12.5, fontWeight:700 }}>
            ➕ Déclarer un résident principal
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>⏳ Chargement...</div>
      ) : (
        <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', border:'1px solid #e2e8f0' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc', textAlign:'left' }}>
                {['Personnel','Nom / Matricule','Statut résident principal','Chambre principale','Date d\'affectation','Statut de la résidence','Occupant actuel',''].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listeFiltree.length===0 && (
                <tr><td colSpan={8} style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Aucun résident principal {voirHistorique?'':'actif'}.</td></tr>
              )}
              {listeFiltree.map(rp => (
                <tr key={rp.id} style={{ borderTop:'1px solid #f1f5f9' }}>
                  <td style={{ padding:'10px 14px', fontWeight:700 }}>{rp.personnel_nom}</td>
                  <td style={{ padding:'10px 14px', color:'#64748b' }}>{rp.personnel_matricule || '—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background: rp.actif ? '#dcfce7' : '#f1f5f9', color: rp.actif ? '#15803d' : '#94a3b8',
                      padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {rp.actif ? 'Oui' : 'Non (terminée)'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', fontWeight:700 }}>{rp.batiment_residence}</td>
                  <td style={{ padding:'10px 14px', color:'#64748b' }}>{new Date(rp.date_debut).toLocaleDateString('fr-FR')}{rp.date_fin ? ` → ${new Date(rp.date_fin).toLocaleDateString('fr-FR')}` : ''}</td>
                  <td style={{ padding:'10px 14px' }}>{rp.actif ? '🟢 Active' : `⚪ Terminée${rp.motif_fin ? ' — '+rp.motif_fin : ''}`}</td>
                  <td style={{ padding:'10px 14px', color:'#64748b' }}>{rp.occupant_actuel_nom || (rp.actif ? '(lui-même)' : '—')}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>{setPlainteModal({rp}); setPlainteForm({titre:'',description:'',categorie:'Autre'})}}
                        style={{ background:'#fff7ed', color:'#c2410c', border:'1px solid #fed7aa', padding:'4px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}
                        title="Signaler une anomalie sur cette résidence">
                        🚨 Signaler
                      </button>
                      {isAdmin && rp.actif && (
                        <button onClick={()=>mettreFin(rp)} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', padding:'4px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                          Fin
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

      {rpModal==='nouveau' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
          onClick={e=>e.target===e.currentTarget && setRpModal(null)}>
          <div style={{ background:'#fff', borderRadius:14, maxWidth:420, width:'100%', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', background:'#16a34a', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, fontSize:14 }}>➕ Déclarer un résident principal</div>
              <button onClick={()=>setRpModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>Personnel</label>
              <select value={personnelChoisi} onChange={e=>setPersonnelChoisi(e.target.value)} style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:14 }}>
                <option value="">— Choisir —</option>
                {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} — {p.societe||'—'}</option>)}
              </select>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>Chambre principale</label>
              <select value={batimentChoisi} onChange={e=>setBatimentChoisi(e.target.value)} style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:16 }}>
                <option value="">— Choisir —</option>
                {batimentsList.filter(b=>b.statut!=='Maintenance').map(b=>(
                  <option key={b.id} value={b.id}>{b.residence} {b.resident_principal ? `(déjà résidence principale de ${b.resident_principal.personnel_nom})` : ''}</option>
                ))}
              </select>
              <button onClick={declarer} style={{ width:'100%', background:'#16a34a', color:'#fff', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Déclarer résident principal
              </button>
            </div>
          </div>
        </div>
      )}

      {plainteModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
          onClick={e=>e.target===e.currentTarget && setPlainteModal(null)}>
          <div style={{ background:'#fff', borderRadius:14, maxWidth:440, width:'100%', overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', background:'#c2410c', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700, fontSize:14 }}>🚨 Signaler une anomalie — {plainteModal.rp.batiment_residence}</div>
              <button onClick={()=>setPlainteModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:20 }}>
              <div style={{ fontSize:11.5, color:'#64748b', marginBottom:14, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'8px 12px' }}>
                Cette anomalie sera suivie dans Maintenance : qualification, résolution, confirmation puis clôture — comme toute autre intervention.
              </div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>Titre</label>
              <input value={plainteForm.titre} onChange={e=>setPlainteForm(f=>({...f,titre:e.target.value}))} placeholder="Ex: Occupant non conforme, chambre non restituée..."
                style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:14, boxSizing:'border-box' }}/>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>Catégorie</label>
              <select value={plainteForm.categorie} onChange={e=>setPlainteForm(f=>({...f,categorie:e.target.value}))}
                style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:14 }}>
                {['Autre','Plomberie','Electricite','Serrurerie','Climatisation','Toiture','Proprete','Informatique','Generateur'].map(c=><option key={c} value={c}>{c==='Proprete'?'Propreté':c}</option>)}
              </select>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase' }}>Description</label>
              <textarea value={plainteForm.description} onChange={e=>setPlainteForm(f=>({...f,description:e.target.value}))} rows={3}
                style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:16, boxSizing:'border-box', resize:'vertical' }}/>
              <button onClick={soumettrePlainte} style={{ width:'100%', background:'#c2410c', color:'#fff', border:'none', padding:11, borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                Signaler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
