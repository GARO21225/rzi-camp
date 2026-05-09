import React, { useEffect, useState } from 'react'
import { voyages, personnel as personnelAPI, batiments as batsAPI } from '../api'

const STATUT_LABELS = { planifie:'Planifié', en_voyage:'En voyage', retour:'Retour camp', annule:'Annulé' }

const STATUT_COLORS = {
  planifie: { bg:'rgba(37,99,235,.12)', color:'#2563eb' },
  en_voyage: { bg:'rgba(234,88,12,.12)', color:'#ea580c' },
  retour: { bg:'rgba(22,163,74,.12)', color:'#16a34a' },
  annule: { bg:'rgba(100,116,139,.12)', color:'#64748b' },
}

export default function Voyages() {
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [personnelList, setPersonnelList] = useState([])
  const [batsList, setBatsList] = useState([])
  const [modal, setModal] = useState(false)
  const [filterStatut, setFilterStatut] = useState('')
  const [today] = useState(new Date().toISOString().slice(0,10))
  const [form, setForm] = useState({ personnel:'', batiment:'', destination:'', motif:'', date_depart:today, date_retour_prevue:'' })

  const load = () => {
    const p = {}
    if (filterStatut) p.statut = filterStatut
    voyages.list(p).then(r => setData(r.data.results||r.data))
    voyages.stats().then(r => setStats(r.data))
  }

  useEffect(() => {
    personnelAPI.list({page_size:500}).then(r => setPersonnelList(r.data.results||r.data))
    batsAPI.list({statut:'Occupé',page_size:300}).then(r => setBatsList(r.data.results||r.data))
  }, [])

  useEffect(() => { load() }, [filterStatut])

  const create = async () => {
    if (!form.personnel||!form.date_depart||!form.date_retour_prevue) return alert('Personnel, date départ et date retour obligatoires')
    await voyages.create(form)
    setModal(false)
    setForm({ personnel:'', batiment:'', destination:'', motif:'', date_depart:today, date_retour_prevue:'' })
    load()
  }

  const partir = async (id) => {
    if (!window.confirm('Confirmer le départ ? La chambre sera libérée automatiquement.')) return
    await voyages.partir(id); load()
  }

  const revenir = async (v) => {
    const date = prompt('Date de retour effectif (AAAA-MM-JJ):', today)
    if (!date) return
    await voyages.revenir(v.id, { date_retour: date }); load()
  }

  const annulerVoyage = async (v) => {
    if (!window.confirm(`Annuler le voyage de ${v.personnel_detail?.nom} ${v.personnel_detail?.prenom} ?\n\nLa chambre ne sera PAS modifiée.\nAucune entrée dans l'historique.`)) return
    try {
      await voyages.annuler(v.id)
      load()
    } catch(e) { alert(e.response?.data?.error || 'Erreur') }
  }

  const supprimerVoyage = async (v) => {
    if (!window.confirm(`⚠️ SUPPRIMER complètement ce voyage ?\n\nUtilisez cette option uniquement en cas d'erreur de saisie.\nLa chambre et l'historique ne seront pas touchés.`)) return
    try {
      await voyages.supprimer(v.id)
      load()
    } catch(e) { alert(e.response?.data?.error || 'Erreur') }
  }

  const inp = { background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)' }}>✈️ Gestion des Voyages</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>Libération automatique chambre au départ · Réaffectation au retour</p>
        </div>
        <button onClick={()=>setModal(true)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          + Demande voyage
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[['Total',stats.total,'var(--blue)','✈️'],['Planifiés',stats.planifies,'#2563eb','📅'],['En voyage',stats.en_voyage,'#ea580c','🚀'],['Retours',stats.retours,'var(--libre)','🏠']].map(([l,v,c,ic])=>(
            <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:16, borderTop:`3px solid ${c}`, boxShadow:'var(--shadow)' }}>
              <div style={{ fontFamily:'monospace', fontSize:26, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        {[['','Tous'],['planifie','Planifiés'],['en_voyage','En voyage'],['retour','Retours']].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterStatut(v)}
            style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${filterStatut===v?'var(--blue)':'var(--border)'}`,
              background:filterStatut===v?'var(--blue)':'var(--surface)', color:filterStatut===v?'#fff':'var(--text-dim)',
              cursor:'pointer', fontSize:12, fontWeight:filterStatut===v?600:400, transition:'.15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Liste voyages */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr style={{ background:'var(--blue)' }}>
              {['Personnel','Société','Chambre','Destination','Départ','Retour prévu','Statut','Actions'].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.8)', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length===0
              ? <tr><td colSpan={8} style={{ padding:24, textAlign:'center', color:'var(--text-dim)' }}>Aucun voyage enregistré</td></tr>
              : data.map(v=>(
                <tr key={v.id} style={{ borderTop:'1px solid var(--border)' }}>
                  <td style={{ padding:'10px 14px' }}><div style={{ fontWeight:600 }}>{v.personnel_detail?.nom} {v.personnel_detail?.prenom}</div></td>
                  <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text-dim)' }}>{v.personnel_detail?.societe}</td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:700, color:'var(--blue)' }}>{v.batiment_nom||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>{v.destination||'—'}</td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11 }}>{v.date_depart}</td>
                  <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11 }}>{v.date_retour_prevue}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:STATUT_COLORS[v.statut]?.bg, color:STATUT_COLORS[v.statut]?.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                      {STATUT_LABELS[v.statut]||v.statut}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {v.statut==='planifie' && <>
                        <button onClick={()=>partir(v.id)} style={{ background:'rgba(234,88,12,.12)', color:'#ea580c', border:'1px solid rgba(234,88,12,.3)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                          🚀 Partir
                        </button>
                        <button onClick={()=>annulerVoyage(v)} style={{ background:'rgba(100,116,139,.1)', color:'#64748b', border:'1px solid rgba(100,116,139,.2)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}
                          title="Annuler sans modifier la chambre ni l'historique">
                          ✕ Annuler
                        </button>
                        <button onClick={()=>supprimerVoyage(v)} style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}
                          title="Supprimer complètement (erreur de saisie)">
                          🗑
                        </button>
                      </>}
                      {v.statut==='en_voyage' && (
                        <button onClick={()=>revenir(v)} style={{ background:'rgba(22,163,74,.12)', color:'var(--libre)', border:'1px solid rgba(22,163,74,.3)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600 }}>
                          🏠 Retour
                        </button>
                      )}
                      {v.statut==='annule' && <span style={{ fontSize:11, color:'#64748b', fontStyle:'italic' }}>Annulé</span>}
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, width:500, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'var(--shadow-md)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:16 }}>✈️ Nouvelle demande de voyage</h3>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {[
                ['Personnel *','personnel','select-pers','span 2'],
                ['Chambre actuelle','batiment','select-bat',''],
                ['Destination','destination','text',''],
                ['Date départ *','date_depart','date',''],
                ['Date retour prévue *','date_retour_prevue','date',''],
                ['Motif','motif','text','span 2'],
              ].map(([l,k,t,gc])=>(
                <div key={k} style={{ gridColumn:gc||'auto' }}>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>{l}</label>
                  {t==='select-pers'
                    ? <select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}>
                        <option value="">— Choisir —</option>
                        {personnelList.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe}</option>)}
                      </select>
                    : t==='select-bat'
                    ? <select value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}>
                        <option value="">— Chambre automatique —</option>
                        {batsList.map(b=><option key={b.id} value={b.id}>{b.residence} ({b.bloc})</option>)}
                      </select>
                    : <input type={t==='date'?'date':'text'} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp}/>
                  }
                </div>
              ))}
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:12, color:'var(--text-dim)', background:'rgba(234,88,12,.08)', border:'1px solid rgba(234,88,12,.2)', borderRadius:8, padding:'8px 12px' }}>
                🏠 La chambre sera <b>libérée automatiquement</b> au départ
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setModal(false)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
                <button onClick={create} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
