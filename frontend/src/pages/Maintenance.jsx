
import React, { useEffect, useState, useRef } from 'react'
import { incidents, batiments as batAPI } from '../api'
import { useStore } from '../store'

const pColor = { haute:'#dc2626', moyenne:'#ea580c', basse:'#2563eb' }
const pBg = { haute:'rgba(220,38,38,.1)', moyenne:'rgba(234,88,12,.1)', basse:'rgba(37,99,235,.1)' }
const sColor = { 'Ouvert':'#dc2626', 'En cours':'#ea580c', 'Résolu':'#16a34a' }

export default function Maintenance() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const canClose = ['admin','manager','technicien'].includes(role) || user?.is_staff || user?.is_superuser
  const canCreate = ['admin','manager','agent','technicien'].includes(role) || user?.is_staff

  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [modal, setModal] = useState(false)
  const [detailModal, setDetailModal] = useState(null)
  const [bats, setBats] = useState([])
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [gps, setGps] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'' })
  const fileRef = useRef()

  const load = () => {
    incidents.list().then(r => setData(r.data.results||r.data))
    incidents.stats().then(r => setStats(r.data))
    batAPI.list({ page_size:300 }).then(r => {
      const items = r.data.results||r.data
      // natural sort
      const sorted = [...items].sort((a,b) => a.residence.localeCompare(b.residence, undefined, {numeric:true}))
      setBats(sorted)
    })
  }
  useEffect(() => { load() }, [])

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const getGPS = () => {
    setGpsLoading(true)
    navigator.geolocation?.getCurrentPosition(
      pos => { setGps({ lat:pos.coords.latitude, lng:pos.coords.longitude }); setGpsLoading(false) },
      () => { setGps({ lat:8.111, lng:-6.822 }); setGpsLoading(false) },
      { timeout:8000 }
    )
  }

  const submit = async () => {
    if (!form.titre) return alert('Titre obligatoire')
    if (!form.description) return alert('Description obligatoire')
    if (!form.residence) return alert('Résidence obligatoire')
    if (!photo) return alert('📸 Photo obligatoire')
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => fd.append(k,v))
      fd.append('photo', photo)
      if (gps) { fd.append('latitude', gps.lat); fd.append('longitude', gps.lng) }
      await incidents.create(fd)
      setModal(false)
      setPhoto(null); setPhotoPreview(null); setGps(null)
      setForm({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'' })
      load()
    } catch(e) { alert('Erreur: '+(e.response?.data?JSON.stringify(e.response.data):e.message)) }
    finally { setSubmitting(false) }
  }

  const resoudre = async (id) => {
    try {
      await incidents.resoudre(id); load()
      if (detailModal?.id === id) setDetailModal(null)
    } catch(e) { alert(e.response?.data?.error||'Erreur') }
  }

  const naviguer = (inc) => {
    const url = inc.latitude && inc.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${inc.latitude},${inc.longitude}`
      : `https://www.google.com/maps/search/Résidence+${inc.residence}+Roxgold+Sango`
    window.open(url,'_blank')
  }

  const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)' }}>🛠️ Maintenance Industrielle</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>📸 Photo GPS obligatoire · Traçabilité · {canClose ? 'Clôture autorisée' : 'Déclaration uniquement'}</p>
        </div>
        {canCreate && (
          <button onClick={()=>setModal(true)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
            + Signaler incident
          </button>
        )}
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[['Total',stats.total,'var(--blue)','📋'],['Ouverts',stats.ouverts,'#dc2626','🚨'],['En cours',stats.en_cours,'#ea580c','⚙️'],['Résolus',stats.resolus,'#16a34a','✅']].map(([l,v,c,ic])=>(
            <div key={l} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:16, borderTop:`4px solid ${c}`, boxShadow:'var(--shadow)' }}>
              <div style={{ fontFamily:'monospace', fontSize:26, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* LISTE INCIDENTS */}
      {data.map(inc => (
        <div key={inc.id} onClick={()=>setDetailModal(inc)}
          style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:10,
            display:'flex', gap:14, boxShadow:'var(--shadow)', cursor:'pointer', transition:'.2s' }}
          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--blue)'}
          onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>

          {/* Thumbnail photo */}
          <div style={{ width:72, height:72, borderRadius:8, overflow:'hidden', flexShrink:0, border:'2px solid var(--border)', background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {inc.photo_url
              ? <img src={inc.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:28 }}>📷</span>
            }
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)', marginBottom:2 }}>{inc.titre}</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.description}</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:11, color:'var(--text-dim)' }}>
              <span style={{ background:'var(--surface2)', padding:'2px 8px', borderRadius:6, fontWeight:600 }}>📍 {inc.residence}</span>
              <span>👤 {inc.auteur_nom}</span>
              <span>🕐 {new Date(inc.date_creation).toLocaleString('fr-FR')}</span>
              {inc.photo_url && <span style={{ color:'#16a34a', fontWeight:700 }}>📸 ✓</span>}
              {inc.latitude && <span style={{ color:'#2563eb', fontWeight:700 }}>📡 GPS</span>}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0 }} onClick={e=>e.stopPropagation()}>
            <span style={{ background:`${sColor[inc.statut]}18`, color:sColor[inc.statut], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{inc.statut}</span>
            <span style={{ background:pBg[inc.priorite], color:pColor[inc.priorite], padding:'2px 8px', borderRadius:20, fontSize:10, fontFamily:'monospace', fontWeight:700 }}>{inc.priorite?.toUpperCase()}</span>
            <button onClick={()=>naviguer(inc)} style={{ background:'rgba(37,99,235,.1)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, width:'100%' }}>🧭 Nav</button>
            {canClose && inc.statut!=='Résolu' && (
              <button onClick={()=>resoudre(inc.id)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, width:'100%' }}>✅ Clôturer</button>
            )}
          </div>
        </div>
      ))}

      {/* ── DETAIL MODAL ── */}
      {detailModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#fff', borderRadius:16, width:620, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ color:'#fff', fontSize:16, marginBottom:2 }}>{detailModal.titre}</h3>
                <div style={{ fontSize:11, color:'rgba(255,255,255,.7)', fontFamily:'monospace' }}>Incident #{detailModal.id}</div>
              </div>
              <button onClick={()=>setDetailModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:8, cursor:'pointer', width:32, height:32, fontSize:18 }}>✕</button>
            </div>

            <div style={{ padding:'20px 24px' }}>
              {/* Photo grande taille */}
              {detailModal.photo_url && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>📸 Photo de l'incident</div>
                  <img src={detailModal.photo_url} alt="Incident"
                    style={{ width:'100%', maxHeight:320, objectFit:'cover', borderRadius:10, border:'2px solid var(--border)' }}/>
                </div>
              )}

              {/* Infos grille */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                {[
                  ['Résidence',detailModal.residence,'📍'],
                  ['Catégorie',detailModal.categorie,'🔧'],
                  ['Priorité',detailModal.priorite?.toUpperCase(),'⚡'],
                  ['Statut',detailModal.statut,'📋'],
                  ['Déclaré par',detailModal.auteur_nom,'👤'],
                  ['Date',new Date(detailModal.date_creation).toLocaleString('fr-FR'),'🕐'],
                ].map(([l,v,ic])=>(
                  <div key={l} style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ fontSize:10, color:'var(--text-dim)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>{ic} {l}</div>
                    <div style={{ fontWeight:700, fontSize:13, color:'var(--blue)' }}>{v||'—'}</div>
                  </div>
                ))}
              </div>

              {/* Occupant résidence */}
              {detailModal.residence && (
                <OccupantInfo residence={detailModal.residence}/>
              )}

              {/* Description */}
              <div style={{ background:'var(--surface2)', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
                <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>📝 Description</div>
                <div style={{ fontSize:13, lineHeight:1.6, color:'var(--text)' }}>{detailModal.description}</div>
              </div>

              {/* GPS */}
              {detailModal.latitude && (
                <div style={{ background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
                  <div style={{ fontSize:11, color:'#2563eb', fontFamily:'monospace', marginBottom:4 }}>📡 GPS CAPTURÉ</div>
                  <div style={{ fontFamily:'monospace', fontSize:12 }}>{detailModal.latitude}, {detailModal.longitude}</div>
                </div>
              )}

              {detailModal.date_resolution && (
                <div style={{ background:'rgba(22,163,74,.06)', border:'1px solid rgba(22,163,74,.2)', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
                  <div style={{ fontSize:11, color:'#16a34a', fontFamily:'monospace', marginBottom:4 }}>✅ RÉSOLU LE</div>
                  <div style={{ fontSize:12 }}>{new Date(detailModal.date_resolution).toLocaleString('fr-FR')}</div>
                </div>
              )}
            </div>

            <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', gap:10 }}>
              <button onClick={()=>naviguer(detailModal)} style={{ background:'rgba(37,99,235,.1)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'9px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>🧭 Naviguer</button>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setDetailModal(null)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'9px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Fermer</button>
                {canClose && detailModal.statut!=='Résolu' && (
                  <button onClick={()=>resoudre(detailModal.id)} style={{ background:'#16a34a', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>✅ Clôturer l'incident</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL SIGNALER ── */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#fff', borderRadius:16, width:520, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff' }}>🛠️ Signaler un incident</h3>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 24px' }}>
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:14, color:'#991b1b' }}>
                📸 Photo obligatoire · 📍 GPS requis · ⏱️ Horodatage automatique
              </div>

              {/* PHOTO */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>📸 Photo *</label>
                <div onClick={()=>fileRef.current?.click()}
                  style={{ border:`2px dashed ${photo?'#16a34a':'var(--border)'}`, borderRadius:10, padding:14, textAlign:'center', cursor:'pointer', background:photo?'rgba(22,163,74,.04)':'var(--surface2)' }}>
                  {photoPreview
                    ? <img src={photoPreview} style={{ maxHeight:120, borderRadius:6, maxWidth:'100%' }} alt="preview"/>
                    : <div style={{ color:'var(--text-dim)', fontSize:13 }}>📷 Toucher pour prendre/choisir une photo</div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display:'none' }}/>
                {photo && <div style={{ fontSize:11, color:'#16a34a', marginTop:4, fontWeight:600 }}>✅ {photo.name}</div>}
              </div>

              {/* GPS */}
              <div style={{ marginBottom:14 }}>
                <button onClick={getGPS} disabled={gpsLoading}
                  style={{ width:'100%', background:gps?'rgba(22,163,74,.1)':'var(--surface2)', border:`1px solid ${gps?'#16a34a':'var(--border)'}`, color:gps?'#16a34a':'var(--text-dim)', padding:'9px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  {gpsLoading?'📡 Acquisition...' : gps?`✅ GPS : ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`:'📍 Capturer GPS'}
                </button>
              </div>

              {/* Résidence — dropdown natural sorted */}
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence * (A1, A2... B10, B11...)</label>
                <select value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})} style={inp}>
                  <option value="">— Choisir résidence —</option>
                  {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc} {b.occupant?`(${b.occupant})`:'(Libre)'}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Titre *</label>
                <input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})} style={inp} placeholder="Ex: Fuite d'eau résidence A3"/>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Catégorie</label>
                  <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} style={inp}>
                    {['Plomberie','Électricité','Serrurerie','Climatisation','Toiture','Autre'].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Priorité</label>
                  <div style={{ display:'flex', gap:6 }}>
                    {[['haute','🔴'],['moyenne','🟠'],['basse','🔵']].map(([v,ic])=>(
                      <button key={v} onClick={()=>setForm({...form,priorite:v})}
                        style={{ flex:1, padding:'8px 4px', borderRadius:8, border:`2px solid ${form.priorite===v?pColor[v]:'var(--border)'}`,
                          background:form.priorite===v?pBg[v]:'var(--surface2)', color:form.priorite===v?pColor[v]:'var(--text-dim)', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Description *</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3}
                  style={{ ...inp, resize:'vertical' }} placeholder="Décrivez le problème..."/>
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(false)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={submit} disabled={submitting} style={{ background:submitting?'#64748b':'var(--blue)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700 }}>
                {submitting?'Envoi...':'🚀 Signaler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Composant qui récupère l'occupant de la résidence
function OccupantInfo({ residence }) {
  const [bat, setBat] = React.useState(null)
  React.useEffect(() => {
    import('../api').then(({ batiments }) =>
      batiments.list({ residence, page_size:1 }).then(r => {
        const items = r.data.results||r.data
        if (items.length > 0) setBat(items[0])
      })
    )
  }, [residence])

  if (!bat || !bat.occupant) return null

  return (
    <div style={{ background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
      <div style={{ fontSize:11, color:'#2563eb', fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>🏠 Occupant de la résidence</div>
      <div style={{ display:'flex', gap:20, fontSize:13 }}>
        <div><span style={{ color:'var(--text-dim)', fontSize:11 }}>Nom :</span> <b>{bat.occupant}</b></div>
        {bat.societe && <div><span style={{ color:'var(--text-dim)', fontSize:11 }}>Société :</span> <b>{bat.societe}</b></div>}
        {bat.date_arrivee && <div><span style={{ color:'var(--text-dim)', fontSize:11 }}>Arrivée :</span> <b>{bat.date_arrivee}</b></div>}
      </div>
    </div>
  )
}
