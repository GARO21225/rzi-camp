import React, { useEffect, useState, useRef } from 'react'
import { incidents, batiments as batAPI } from '../api'
import { useStore } from '../store'

const PRIORITE = {
  haute:  { color:'#dc2626', bg:'rgba(220,38,38,.1)',  label:'🔴 Haute' },
  moyenne:{ color:'#ea580c', bg:'rgba(234,88,12,.1)',  label:'🟠 Moyenne' },
  basse:  { color:'#2563eb', bg:'rgba(37,99,235,.1)',  label:'🔵 Basse' },
}
const STATUT = {
  'Ouvert':  { color:'#dc2626', bg:'rgba(220,38,38,.1)',  icon:'🔴' },
  'En cours':{ color:'#ea580c', bg:'rgba(234,88,12,.1)',  icon:'🟠' },
  'Résolu':  { color:'#16a34a', bg:'rgba(22,163,74,.1)',   icon:'✅' },
}
const CATS = ['Plomberie','Électricité','Serrurerie','Climatisation','Toiture','Menuiserie','Autre']

const inp = {
  width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'9px 12px',
  fontSize:13, outline:'none', fontFamily:'inherit', color:'#1e293b', background:'#f8fafc'
}

export default function Maintenance() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const canClose = isAdmin || role === 'technicien'
  const canCreate = isAdmin || ['agent','technicien','menage'].includes(role)

  const [data, setData]           = useState([])
  const [stats, setStats]         = useState(null)
  const [bats, setBats]           = useState([])
  const [modal, setModal]         = useState(false)
  const [detail, setDetail]       = useState(null)
  const [filterStatut, setFilter] = useState('')
  const [filterPrio, setFilterP]  = useState('')
  const [loading, setLoading]     = useState(true)
  const [submitting, setSub]      = useState(false)
  const [gpsLoading, setGpsLoad]  = useState(false)
  const [gps, setGps]             = useState(null)
  const [photoB64, setPhotoB64]   = useState('')
  const [form, setForm]           = useState({
    titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:''
  })
  const fileRef = useRef()

  const load = () => {
    setLoading(true)
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (filterPrio) p.priorite = filterPrio
    incidents.list(p)
      .then(r => setData(r.data.results||r.data||[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
    incidents.stats().then(r => setStats(r.data)).catch(()=>{})
    batAPI.list({ page_size:300 }).then(r => {
      const items = r.data.results||r.data||[]
      setBats([...items].sort((a,b)=>a.residence.localeCompare(b.residence,undefined,{numeric:true})))
    }).catch(()=>{})
  }

  useEffect(() => { load() }, [filterStatut, filterPrio])

  const getGPS = () => {
    setGpsLoad(true)
    navigator.geolocation?.getCurrentPosition(
      p => { setGps([p.coords.latitude, p.coords.longitude]); setGpsLoad(false) },
      () => { setGps(null); setGpsLoad(false) },
      { enableHighAccuracy:true, timeout:8000 }
    )
  }

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPhotoB64(ev.target.result.split(',')[1])
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setForm({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'' })
    setPhotoB64(''); setGps(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const submit = async () => {
    if (!form.titre.trim()) return alert('Le titre est obligatoire')
    if (!form.description.trim()) return alert('La description est obligatoire')
    setSub(true)
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([k,v]) => { if(v) payload.append(k,v) })
      if (photoB64) payload.append('photo_b64', photoB64)
      if (gps) { payload.append('latitude', gps[0]); payload.append('longitude', gps[1]) }
      await incidents.create(payload, { headers:{ 'Content-Type':'multipart/form-data' } })
      setModal(false); resetForm(); load()
    } catch(e) {
      alert(e.response?.data ? JSON.stringify(e.response.data) : 'Erreur lors de la soumission')
    } finally { setSub(false) }
  }

  const resoudre = async (id) => {
    if (!window.confirm('Marquer cet incident comme résolu ?')) return
    try { await incidents.resoudre(id); load() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer définitivement cet incident ?')) return
    try { await incidents.delete(id); setDetail(null); load() }
    catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  return (
    <div style={{ padding:16 }}>
      {/* En-tête */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:19, fontWeight:700, color:'#1e3a8a', margin:0 }}>🛠️ Maintenance</h2>
          <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>Incidents · Signalements · Suivi résolution</p>
        </div>
        {canCreate && (
          <button onClick={()=>{ resetForm(); setModal(true) }}
            style={{ background:'#1e3a8a', color:'#fff', border:'none', padding:'9px 18px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, boxShadow:'0 2px 8px rgba(30,58,138,.3)' }}>
            + Signaler un incident
          </button>
        )}
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:10, marginBottom:16 }}>
          {[
            ['Total', stats.total, '#1e3a8a', '📋'],
            ['Ouverts', stats.ouverts, '#dc2626', '🔴'],
            ['En cours', stats.en_cours, '#ea580c', '🟠'],
            ['Résolus', stats.resolus, '#16a34a', '✅'],
          ].map(([l,v,c,ic]) => (
            <div key={l} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:'12px 14px', borderTop:`3px solid ${c}`, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
              <div style={{ fontFamily:'monospace', fontSize:26, fontWeight:700, color:c }}>{v||0}</div>
              <div style={{ fontSize:10, color:'#64748b', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:3, background:'#f8fafc', borderRadius:9, padding:3, border:'1px solid #e2e8f0' }}>
          {['','Ouvert','En cours','Résolu'].map(s => (
            <button key={s} onClick={()=>setFilter(s)}
              style={{ padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                background:filterStatut===s?'#1e3a8a':'transparent',
                color:filterStatut===s?'#fff':'#64748b' }}>
              {s||'Tous'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:3, background:'#f8fafc', borderRadius:9, padding:3, border:'1px solid #e2e8f0' }}>
          {['','haute','moyenne','basse'].map(p => (
            <button key={p} onClick={()=>setFilterP(p)}
              style={{ padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                background:filterPrio===p?'#1e3a8a':'transparent',
                color:filterPrio===p?'#fff':'#64748b' }}>
              {p||'Priorités'}
            </button>
          ))}
        </div>
        <span style={{ fontSize:12, color:'#94a3b8', display:'flex', alignItems:'center' }}>{data.length} incident(s)</span>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>🔄 Chargement...</div>
      ) : data.length === 0 ? (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:48, textAlign:'center', color:'#94a3b8', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🛠️</div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Aucun incident</div>
          <div style={{ fontSize:13 }}>Aucun incident{filterStatut?` "${filterStatut}"`:''} signalé</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {data.map(inc => {
            const st = STATUT[inc.statut] || STATUT['Ouvert']
            const pr = PRIORITE[inc.priorite] || PRIORITE.moyenne
            return (
              <div key={inc.id}
                onClick={() => setDetail(inc)}
                style={{ background:'#fff', border:`1px solid ${inc.statut==='Ouvert'?'rgba(220,38,38,.25)':'#e2e8f0'}`,
                  borderRadius:12, padding:16, cursor:'pointer', display:'flex', gap:14, alignItems:'flex-start',
                  boxShadow:'0 1px 4px rgba(0,0,0,.06)', transition:'box-shadow .2s' }}
                onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(30,58,138,.12)'}
                onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'}>

                {/* Icône priorité */}
                <div style={{ width:44, height:44, borderRadius:12, background:pr.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                  {pr.label.split(' ')[0]}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:'#1e3a8a' }}>{inc.titre}</span>
                    <span style={{ background:st.bg, color:st.color, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                      {st.icon} {inc.statut}
                    </span>
                    <span style={{ background:pr.bg, color:pr.color, padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:600 }}>
                      {pr.label}
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:'#64748b', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {inc.description}
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:11, color:'#94a3b8', flexWrap:'wrap' }}>
                    {inc.residence && <span>🏠 {inc.residence}</span>}
                    {inc.categorie && <span>🔧 {inc.categorie}</span>}
                    <span>📅 {new Date(inc.date_signalement).toLocaleDateString('fr-FR')}</span>
                    {inc.auteur_nom && <span>👤 {inc.auteur_nom}</span>}
                  </div>
                </div>

                {/* Actions rapides */}
                <div style={{ display:'flex', flexDirection:'column', gap:5, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                  {canClose && inc.statut !== 'Résolu' && (
                    <button onClick={()=>resoudre(inc.id)}
                      style={{ background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.3)', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                      ✅ Résoudre
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={()=>supprimer(inc.id)}
                      style={{ background:'rgba(220,38,38,.08)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'5px 10px', borderRadius:7, cursor:'pointer', fontSize:11, fontWeight:700 }}>
                      🗑 Supprimer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── MODAL DÉTAIL ── */}
      {detail && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}
          onClick={()=>setDetail(null)}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'16px 20px', background:'#1e3a8a', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15, margin:0 }}>🛠️ {detail.titre}</h3>
              <button onClick={()=>setDetail(null)} style={{ background:'rgba(255,255,255,.15)', border:'none', color:'#fff', width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'20px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                {[
                  ['Statut', (STATUT[detail.statut]?.icon||'')+ ' '+detail.statut],
                  ['Priorité', PRIORITE[detail.priorite]?.label||detail.priorite],
                  ['Catégorie', detail.categorie],
                  ['Résidence', detail.residence||'—'],
                  ['Signalé par', detail.auteur_nom||'—'],
                  ['Date', new Date(detail.date_signalement).toLocaleDateString('fr-FR')],
                ].map(([k,v])=>(
                  <div key={k} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 12px' }}>
                    <div style={{ fontSize:10, color:'#94a3b8', marginBottom:2, textTransform:'uppercase', letterSpacing:1 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1e3a8a' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#94a3b8', marginBottom:6, textTransform:'uppercase', letterSpacing:1 }}>Description</div>
                <div style={{ fontSize:13, color:'#1e293b', lineHeight:1.6 }}>{detail.description}</div>
              </div>
              {detail.photo_b64 && (
                <img src={`data:image/jpeg;base64,${detail.photo_b64}`} alt="Photo incident"
                  style={{ width:'100%', borderRadius:10, maxHeight:260, objectFit:'cover', marginBottom:14 }}/>
              )}
              {detail.latitude && (
                <a href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
                  target="_blank" rel="noreferrer"
                  style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(37,99,235,.08)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'7px 14px', borderRadius:8, textDecoration:'none', fontSize:12, fontWeight:600, marginBottom:14 }}>
                  📍 Voir sur Google Maps
                </a>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {canClose && detail.statut !== 'Résolu' && (
                  <button onClick={()=>{ resoudre(detail.id); setDetail(null) }}
                    style={{ flex:1, background:'#16a34a', color:'#fff', border:'none', padding:'10px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                    ✅ Marquer comme résolu
                  </button>
                )}
                {isAdmin && (
                  <button onClick={()=>supprimer(detail.id)}
                    style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.25)', padding:'10px 16px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                    🗑 Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SIGNALEMENT ── */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding:'16px 20px', background:'#dc2626', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff', fontSize:15, margin:0 }}>🚨 Signaler un incident</h3>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:5, textTransform:'uppercase', letterSpacing:1, fontFamily:'monospace' }}>Titre *</label>
                <input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})} style={inp} placeholder="Ex: Fuite d'eau chambre 12"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:5, textTransform:'uppercase', letterSpacing:1, fontFamily:'monospace' }}>Catégorie</label>
                  <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} style={inp}>
                    {CATS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:5, textTransform:'uppercase', letterSpacing:1, fontFamily:'monospace' }}>Priorité</label>
                  <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={inp}>
                    <option value="basse">Basse</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="haute">Haute</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:5, textTransform:'uppercase', letterSpacing:1, fontFamily:'monospace' }}>Résidence concernée</label>
                <select value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})} style={inp}>
                  <option value="">— Sélectionner (optionnel) —</option>
                  {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:5, textTransform:'uppercase', letterSpacing:1, fontFamily:'monospace' }}>Description *</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                  rows={4} style={{ ...inp, resize:'vertical' }}
                  placeholder="Décrivez le problème en détail..."/>
              </div>
              {/* Photo */}
              <div>
                <label style={{ display:'block', fontSize:11, color:'#64748b', marginBottom:5, textTransform:'uppercase', letterSpacing:1, fontFamily:'monospace' }}>Photo (optionnel)</label>
                <input type="file" accept="image/*" capture="environment" ref={fileRef} onChange={handlePhoto}
                  style={{ fontSize:12, color:'#64748b' }}/>
                {photoB64 && <img src={`data:image/jpeg;base64,${photoB64}`} alt="preview" style={{ width:'100%', maxHeight:160, objectFit:'cover', borderRadius:8, marginTop:8 }}/>}
              </div>
              {/* GPS */}
              <div>
                <button onClick={getGPS} disabled={gpsLoading}
                  style={{ background:'rgba(37,99,235,.08)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  {gpsLoading ? '📡 Localisation...' : gps ? `📍 ${gps[0].toFixed(5)}, ${gps[1].toFixed(5)}` : '📍 Ajouter ma position GPS'}
                </button>
              </div>
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid #e2e8f0', display:'flex', gap:8 }}>
              <button onClick={()=>setModal(false)} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', color:'#64748b', padding:'9px 18px', borderRadius:9, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={submit} disabled={submitting}
                style={{ flex:1, background:'#dc2626', color:'#fff', border:'none', padding:'10px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                {submitting ? '⏳ Envoi...' : '🚨 Signaler l\'incident'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
