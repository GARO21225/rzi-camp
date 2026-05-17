/**
 * MAINTENANCE — Liste complète + Détail avec photo + Actions admin
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { incidents, batiments as batAPI } from '../api'

const PRIO_COLOR = { haute:'#dc2626', moyenne:'#f97316', basse:'#16a34a' }
const STAT_COLOR = { 'Ouvert':'#dc2626', 'En cours':'#f97316', 'Résolu':'#16a34a' }
const CATS = ['Plomberie','Électricité','Climatisation','Serrurerie','Menuiserie','Peinture','Autre']
const PRIOS = ['haute','moyenne','basse']

export default function Maintenance() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff === true || user?.is_superuser === true || user?.profile?.role === 'admin'
  const isTech  = isAdmin || ['technicien','menage'].includes(role)

  const [data,       setData]       = useState([])
  const [loading,    setLoading]    = useState(false)
  const [filterStat, setFilterStat] = useState('')
  const [filterPrio, setFilterPrio] = useState('')
  const [filterCat,  setFilterCat]  = useState('')
  const [modal,      setModal]      = useState(null)  // 'create'
  const [detail,     setDetail]     = useState(null)  // incident object
  const [photoB64,   setPhotoB64]   = useState('')
  const [gps,        setGps]        = useState(null)
  const [batList,    setBatList]    = useState([])
  const [form, setForm] = useState({
    titre:'', description:'', categorie:'Plomberie',
    priorite:'haute', residence:'', bloc:''
  })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const p = {}
    if (filterStat) p.statut = filterStat
    if (filterPrio) p.priorite = filterPrio
    if (filterCat)  p.categorie = filterCat
    incidents.list(p)
      .then(r => setData(r.data.results || r.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [filterStat, filterPrio, filterCat])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    batAPI.list({ page_size: 300 }).then(r => setBatList(r.data.results || r.data || [])).catch(() => {})
  }, [])

  const handlePhoto = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPhotoB64(ev.target.result.split(',')[1])
    reader.readAsDataURL(file)
  }

  const getGPS = () => {
    navigator.geolocation?.getCurrentPosition(
      p => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    )
  }

  const submit = async () => {
    if (!form.titre.trim()) return setErr('Le titre est requis')
    setSubmitting(true); setErr('')
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([k,v]) => v && payload.append(k, v))
      if (photoB64) { payload.append('photo_b64', photoB64); payload.append('photo_base64', photoB64) }
      if (gps)      { payload.append('latitude', gps.lat); payload.append('longitude', gps.lng) }
      await incidents.create(Object.fromEntries(payload.entries()))
      setModal(null); setForm({ titre:'', description:'', categorie:'Plomberie', priorite:'haute', residence:'', bloc:'' })
      setPhotoB64(''); setGps(null); load()
    } catch(e) {
      setErr(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur serveur')
    } finally { setSubmitting(false) }
  }

  const resoudre = id => {
    if (!window.confirm('Marquer comme résolu ?')) return
    incidents.resoudre(id).then(load)
  }

  const supprimer = id => {
    if (!window.confirm('Supprimer cet incident ?')) return
    incidents.delete(id).then(load).catch(() => alert('Erreur'))
  }

  const changerStatut = (id, statut) => {
    incidents.update(id, { statut }).then(load).catch(() => {})
  }

  const countByStatus = s => data.filter(d => d.statut === s).length

  return (
    <div style={{ padding:20, maxWidth:1100, margin:"0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)', margin:0 }}>🔧 Maintenance</h2>
          <p style={{ fontSize:12, color:'var(--text-dim)', margin:'4px 0 0' }}>
            Incidents du camp · {data.length} total
          </p>
        </div>
        <button onClick={() => setModal('create')}
          style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'10px 18px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
          + Déclarer un incident
        </button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:14 }}>
        {[['Total','📋',data.length,'#2563eb'],['Ouverts','🔴',countByStatus('Ouvert'),'#dc2626'],
          ['En cours','🟠',countByStatus('En cours'),'#f97316'],['Résolus','✅',countByStatus('Résolu'),'#16a34a']
        ].map(([l,e,n,c]) => (
          <div key={l} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px', borderLeft:`4px solid ${c}` }}>
            <div style={{ fontSize:22 }}>{e}</div>
            <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:900, color:c, lineHeight:1 }}>{n}</div>
            <div style={{ fontSize:10, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {[
          [filterStat, setFilterStat, [['','Tous statuts'],['Ouvert','🔴 Ouvert'],['En cours','🟠 En cours'],['Résolu','✅ Résolu']]],
          [filterPrio, setFilterPrio, [['','Toutes priorités'],['haute','🔴 Haute'],['moyenne','🟠 Moyenne'],['basse','🟢 Basse']]],
          [filterCat,  setFilterCat,  [['','Toutes catégories'], ...CATS.map(c=>[c,c])]],
        ].map(([val, setter, opts], i) => (
          <select key={i} value={val} onChange={e => setter(e.target.value)}
            style={{ background:'#fff', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:9, fontSize:12, cursor:'pointer' }}>
            {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <button onClick={load} disabled={loading}
          style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'8px 14px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
          {loading ? '⏳' : '🔄'} Actualiser
        </button>
        {(filterStat||filterPrio||filterCat) && (
          <button onClick={() => { setFilterStat(''); setFilterPrio(''); setFilterCat('') }}
            style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'8px 12px', borderRadius:9, cursor:'pointer', fontSize:12 }}>
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* ── Liste ── */}
      {loading ? (
        <div style={{ padding:48, textAlign:'center', color:'var(--text-dim)', fontSize:32 }}>⏳</div>
      ) : data.length === 0 ? (
        <div style={{ padding:48, textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🔧</div>
          <div style={{ fontWeight:700, color:'var(--blue)' }}>Aucun incident</div>
          <div style={{ color:'var(--text-dim)', fontSize:13, marginTop:4 }}>Cliquez sur "+ Déclarer" pour signaler un problème</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {data.map(inc => (
            <div key={inc.id} style={{
              background:'#fff', border:'1px solid var(--border)', borderRadius:14,
              padding:'14px 16px', borderLeft:`4px solid ${STAT_COLOR[inc.statut]||'#94a3b8'}`,
              boxShadow:'0 1px 4px rgba(30,58,138,.06)'
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                {/* Infos */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:6 }}>
                    <span style={{ fontWeight:700, fontSize:15, color:'var(--blue)' }}>{inc.titre}</span>
                    <span style={{ background:`${PRIO_COLOR[inc.priorite]}18`, color:PRIO_COLOR[inc.priorite], padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                      {inc.priorite?.toUpperCase()}
                    </span>
                    <span style={{ background:`${STAT_COLOR[inc.statut]||'#94a3b8'}18`, color:STAT_COLOR[inc.statut]||'#94a3b8', padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                      {inc.statut}
                    </span>
                    <span style={{ background:'rgba(99,102,241,.1)', color:'#6366f1', padding:'2px 8px', borderRadius:20, fontSize:10 }}>
                      {inc.categorie}
                    </span>
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--text-dim)', marginBottom:4 }}>{inc.description}</div>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:11, color:'var(--text-dim)' }}>
                    {inc.residence && <span>📍 {inc.residence}{inc.bloc ? ` · ${inc.bloc}` : ''}</span>}
                    <span>👤 {inc.auteur_nom || '—'}</span>
                    <span>📅 {inc.date_creation ? new Date(inc.date_creation).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'}) : '—'}</span>
                    {inc.photo_b64 && <span style={{ color:'#7c3aed' }}>📷 Photo</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', flexShrink:0 }}>
                  <button onClick={() => setDetail(inc)}
                    style={{ background:'rgba(37,99,235,.1)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    🔍 Détails
                  </button>
                  {isTech && inc.statut === 'Ouvert' && (
                    <button onClick={() => changerStatut(inc.id,'En cours')}
                      style={{ background:'rgba(249,115,22,.1)', color:'#f97316', border:'1px solid rgba(249,115,22,.2)', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      🔄 En cours
                    </button>
                  )}
                  {isTech && inc.statut !== 'Résolu' && (
                    <button onClick={() => resoudre(inc.id)}
                      style={{ background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      ✅ Résoudre
                    </button>
                  )}
                  {isAdmin && inc.statut === 'Résolu' && (
                    <button onClick={() => changerStatut(inc.id,'Ouvert')}
                      style={{ background:'rgba(99,102,241,.1)', color:'#6366f1', border:'1px solid rgba(99,102,241,.2)', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                      🔄 Réouvrir
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => supprimer(inc.id)}
                      style={{ background:'rgba(220,38,38,.08)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ MODAL DÉTAIL ═══ */}
      {detail && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:600, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            {/* Header */}
            <div style={{ background:'var(--blue)', color:'#fff', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:16 }}>{detail.titre}</div>
                <div style={{ fontSize:11, opacity:.75 }}>{detail.categorie} · {detail.statut}</div>
              </div>
              <button onClick={() => setDetail(null)}
                style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:32, height:32, borderRadius:8, cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            {/* Body */}
            <div style={{ padding:20 }}>
              {/* Badges */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                <span style={{ background:`${PRIO_COLOR[detail.priorite]}18`, color:PRIO_COLOR[detail.priorite], padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                  Priorité: {detail.priorite?.toUpperCase()}
                </span>
                <span style={{ background:`${STAT_COLOR[detail.statut]||'#94a3b8'}18`, color:STAT_COLOR[detail.statut]||'#94a3b8', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                  {detail.statut}
                </span>
              </div>

              {/* Infos grille */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  ['📍 Résidence', detail.residence || '—'],
                  ['🏗️ Bloc', detail.bloc || '—'],
                  ['👤 Signalé par', detail.auteur_nom || '—'],
                  ['📅 Création', detail.date_creation ? new Date(detail.date_creation).toLocaleString('fr-FR') : '—'],
                  ['✅ Résolution', detail.date_resolution ? new Date(detail.date_resolution).toLocaleString('fr-FR') : 'En attente'],
                  ['🏷️ Catégorie', detail.categorie || '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background:'var(--bg)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div style={{ background:'var(--bg)', borderRadius:8, padding:'12px 14px', marginBottom:16 }}>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:4 }}>📝 Description</div>
                <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6 }}>{detail.description || 'Aucune description'}</div>
              </div>

              {/* GPS */}
              {detail.latitude && detail.longitude && (
                <a href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
                  target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(37,99,235,.08)', border:'1px solid rgba(37,99,235,.2)', borderRadius:8, padding:'10px 14px', textDecoration:'none', color:'#2563eb', fontSize:13, marginBottom:16 }}>
                  📍 Voir sur Google Maps ({detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)})
                </a>
              )}

              {/* PHOTO */}
              {detail.photo_b64 ? (
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--blue)', marginBottom:8 }}>📷 Photo de l'incident</div>
                  <img
                    src={`data:${detail.photo_mime || 'image/jpeg'};base64,${detail.photo_b64}`}
                    alt="Photo incident"
                    style={{ width:'100%', maxHeight:320, objectFit:'contain', borderRadius:12, border:'1px solid var(--border)', background:'#000' }}
                    onError={e => e.target.style.display='none'}
                  />
                </div>
              ) : (
                <div style={{ textAlign:'center', padding:'20px', color:'var(--text-dim)', background:'var(--bg)', borderRadius:8, fontSize:13 }}>
                  📷 Aucune photo
                </div>
              )}

              {/* Actions dans le détail */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                {isTech && detail.statut === 'Ouvert' && (
                  <button onClick={() => { changerStatut(detail.id,'En cours'); setDetail({...detail, statut:'En cours'}) }}
                    style={{ flex:1, background:'rgba(249,115,22,.1)', color:'#f97316', border:'1px solid rgba(249,115,22,.2)', padding:'9px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                    🔄 Passer en cours
                  </button>
                )}
                {isTech && detail.statut !== 'Résolu' && (
                  <button onClick={() => { resoudre(detail.id); setDetail(null) }}
                    style={{ flex:1, background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'9px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                    ✅ Marquer résolu
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { supprimer(detail.id); setDetail(null) }}
                    style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'9px 16px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                    🗑 Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL CREATE ═══ */}
      {modal === 'create' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0' }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background:'#fff', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:560, maxHeight:'92vh', overflow:'auto', boxShadow:'0 -8px 40px rgba(0,0,0,.25)' }}>
            <div style={{ background:'var(--blue)', color:'#fff', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:15 }}>🔧 Déclarer un incident</span>
              <button onClick={() => setModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
              {err && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', color:'#dc2626', fontSize:12 }}>❌ {err}</div>}

              {[['titre','📝 Titre *','text'],['description','📄 Description','textarea'],['residence','📍 Résidence / Bâtiment','text'],['bloc','🏗️ Bloc (optionnel)','text']].map(([field, label, type]) => (
                <div key={field}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-dim)', marginBottom:5, textTransform:'uppercase', letterSpacing:.5 }}>{label}</label>
                  {type === 'textarea'
                    ? <textarea value={form[field]} onChange={e => setForm({...form,[field]:e.target.value})} rows={3}
                        style={{ width:'100%', border:'2px solid var(--border)', borderRadius:9, padding:'10px 12px', fontSize:14, resize:'vertical', fontFamily:'inherit' }} />
                    : <input value={form[field]} onChange={e => setForm({...form,[field]:e.target.value})}
                        style={{ width:'100%', border:'2px solid var(--border)', borderRadius:9, padding:'10px 12px', fontSize:14 }} />
                  }
                </div>
              ))}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-dim)', marginBottom:5, textTransform:'uppercase' }}>🏷️ Catégorie</label>
                  <select value={form.categorie} onChange={e => setForm({...form,categorie:e.target.value})}
                    style={{ width:'100%', border:'2px solid var(--border)', borderRadius:9, padding:'10px 12px', fontSize:14 }}>
                    {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-dim)', marginBottom:5, textTransform:'uppercase' }}>⚡ Priorité</label>
                  <select value={form.priorite} onChange={e => setForm({...form,priorite:e.target.value})}
                    style={{ width:'100%', border:'2px solid var(--border)', borderRadius:9, padding:'10px 12px', fontSize:14 }}>
                    {PRIOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'var(--text-dim)', marginBottom:5, textTransform:'uppercase' }}>📷 Photo (optionnel)</label>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto}
                  style={{ width:'100%', border:'2px dashed var(--border)', borderRadius:9, padding:'10px 12px', fontSize:13 }} />
                {photoB64 && <div style={{ marginTop:8, fontSize:11, color:'#16a34a', fontWeight:600 }}>✅ Photo prête</div>}
              </div>

              <button onClick={getGPS}
                style={{ background:'rgba(37,99,235,.08)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'9px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                📍 {gps ? `GPS capturé (${gps.lat.toFixed(4)}…)` : 'Capturer ma position GPS'}
              </button>

              <button onClick={submit} disabled={submitting}
                style={{ background:submitting?'#94a3b8':'var(--blue)', color:'#fff', border:'none', padding:'13px', borderRadius:10, cursor:submitting?'not-allowed':'pointer', fontSize:15, fontWeight:700, marginTop:4 }}>
                {submitting ? '⏳ Envoi...' : '📤 Déclarer l\'incident'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
