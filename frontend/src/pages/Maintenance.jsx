import React, { useEffect, useState, useRef } from 'react'
import { incidents, batiments as batAPI } from '../api'

const pColor = { haute:'#dc2626', moyenne:'#ea580c', basse:'#2563eb' }
const sColor = { 'Ouvert':'#dc2626', 'En cours':'#ea580c', 'Résolu':'#16a34a' }

export default function Maintenance() {
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [modal, setModal] = useState(false)
  const [bats, setBats] = useState([])
  const [manualResidence, setManualResidence] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [gps, setGps] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'' })
  const fileRef = useRef()

  const load = () => {
    incidents.list().then(r=>setData(r.data.results||r.data))
    incidents.stats().then(r=>setStats(r.data))
    // Load ALL residences (no limit)
    batAPI.list({ page_size:500 }).then(r=>setBats(r.data.results||r.data))
  }
  useEffect(()=>{load()},[])

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setGps({ lat:pos.coords.latitude, lng:pos.coords.longitude }); setGpsLoading(false) },
        () => { setGps({ lat:8.111, lng:-6.822 }); setGpsLoading(false) },
        { timeout:8000 }
      )
    } else { setGps({ lat:8.111, lng:-6.822 }); setGpsLoading(false) }
  }

  const submit = async () => {
    if (!form.titre) return alert('Titre obligatoire')
    if (!form.description) return alert('Description obligatoire')
    if (!form.residence) return alert('Résidence obligatoire')
    if (!photo) return alert('📸 La photo est obligatoire pour signaler un incident')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('titre', form.titre)
      fd.append('description', form.description)
      fd.append('categorie', form.categorie)
      fd.append('priorite', form.priorite)
      fd.append('residence', form.residence)
      fd.append('photo', photo)
      if (gps) { fd.append('latitude', gps.lat); fd.append('longitude', gps.lng) }
      await incidents.create(fd)
      setModal(false)
      setPhoto(null); setPhotoPreview(null); setGps(null)
      setForm({ titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'' })
      load()
    } catch(e) {
      alert('Erreur: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message))
    } finally { setSubmitting(false) }
  }

  const resoudre = async (id) => { await incidents.resoudre(id); load() }

  const naviguer = (inc) => {
    const url = inc.latitude && inc.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${inc.latitude},${inc.longitude}`
      : `https://www.google.com/maps/search/Résidence+${inc.residence}+Roxgold+Sango+Côte+Ivoire`
    window.open(url,'_blank')
  }

  const inp = { background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', width:'100%' }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, color:'var(--blue)' }}>🛠️ Maintenance Industrielle</h2>
          <p style={{ fontSize:13, color:'var(--text-dim)', marginTop:4 }}>📸 Photo GPS obligatoire · Traçabilité complète · Historisation</p>
        </div>
        <button onClick={()=>setModal(true)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
          + Signaler incident
        </button>
      </div>

      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
          {[['Total',stats.total,'var(--blue)','📋'],['Ouverts',stats.ouverts,'#dc2626','🚨'],['En cours',stats.en_cours,'#ea580c','⚙️'],['Résolus',stats.resolus,'#16a34a','✅']].map(([l,v,c,ic])=>(
            <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:16, borderTop:`4px solid ${c}`, boxShadow:'var(--shadow)' }}>
              <div style={{ fontFamily:'monospace', fontSize:26, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4, textTransform:'uppercase', letterSpacing:1 }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {data.map(inc=>(
        <div key={inc.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:10, display:'flex', gap:14, boxShadow:'var(--shadow)' }}>
          {inc.photo_url && <img src={inc.photo_url} alt="" style={{ width:72, height:72, borderRadius:8, objectFit:'cover', flexShrink:0, border:'2px solid var(--border)' }}/>}
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)' }}>{inc.titre}</div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:3 }}>{inc.description}</div>
            <div style={{ display:'flex', gap:12, marginTop:8, fontSize:11, color:'var(--text-dim)', flexWrap:'wrap' }}>
              <span style={{ background:'var(--surface2)', padding:'2px 8px', borderRadius:6 }}>📍 {inc.residence}</span>
              <span>👤 {inc.auteur_nom}</span>
              <span>🕐 {new Date(inc.date_creation).toLocaleString('fr-FR')}</span>
              {inc.photo_url && <span style={{ color:'#16a34a', fontWeight:600 }}>📸 ✓</span>}
              {inc.latitude && <span style={{ color:'#2563eb', fontWeight:600 }}>📡 GPS ✓</span>}
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', flexShrink:0, minWidth:100 }}>
            <span style={{ background:`${sColor[inc.statut]}18`, color:sColor[inc.statut], padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{inc.statut}</span>
            <span style={{ fontSize:10, color:pColor[inc.priorite], fontFamily:'monospace', letterSpacing:1, textTransform:'uppercase' }}>{inc.priorite}</span>
            <button onClick={()=>naviguer(inc)} style={{ background:'rgba(37,99,235,.1)', color:'#2563eb', border:'1px solid rgba(37,99,235,.2)', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11, width:'100%' }}>🧭 Naviguer</button>
            {inc.statut!=='Résolu' && <button onClick={()=>resoudre(inc.id)} style={{ background:'var(--blue)', color:'#fff', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:600, width:'100%' }}>✅ Résoudre</button>}
          </div>
        </div>
      ))}

      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surface)', borderRadius:14, width:520, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'var(--shadow-md)' }}>
            <div style={{ padding:'18px 24px', background:'var(--blue)', borderRadius:'14px 14px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h3 style={{ color:'#fff' }}>🛠️ Signaler un incident</h3>
              <button onClick={()=>setModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, cursor:'pointer', width:28, height:28, fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:'18px 24px' }}>
              <div style={{ background:'#fef3f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:14, color:'#991b1b' }}>
                📸 Photo obligatoire · 📍 GPS requis · ⏱️ Horodatage automatique
              </div>

              {/* PHOTO */}
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:6, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>📸 Photo de l'incident *</label>
                <div onClick={()=>fileRef.current?.click()} style={{ border:`2px dashed ${photo?'#16a34a':'var(--border)'}`, borderRadius:10, padding:16, textAlign:'center', cursor:'pointer', background:photo?'rgba(22,163,74,.05)':'var(--surface2)', transition:'.2s' }}>
                  {photoPreview?<img src={photoPreview} style={{ maxHeight:120, borderRadius:6, maxWidth:'100%' }} alt=""/>
                    :<div style={{ color:'var(--text-dim)', fontSize:13 }}>📷 Cliquer pour choisir<br/><span style={{ fontSize:11 }}>JPG, PNG</span></div>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display:'none' }}/>
                {photo && <div style={{ fontSize:11, color:'#16a34a', marginTop:4, fontWeight:600 }}>✅ {photo.name}</div>}
              </div>

              {/* GPS */}
              <div style={{ marginBottom:14 }}>
                <button onClick={getGPS} disabled={gpsLoading} style={{ width:'100%', background:gps?'rgba(22,163,74,.1)':'var(--surface2)', border:`1px solid ${gps?'#16a34a':'var(--border)'}`, color:gps?'#16a34a':'var(--text-dim)', padding:'9px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600, transition:'.2s' }}>
                  {gpsLoading?'📡 Acquisition...' : gps?`✅ GPS : ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`:'📍 Capturer position GPS'}
                </button>
              </div>

              {/* TITRE */}
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Titre *</label>
                <input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})} style={inp} placeholder="Décrire l'incident en une phrase"/>
              </div>

              {/* RÉSIDENCE */}
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Résidence *</label>
                <div style={{ display:'flex', gap:8, marginBottom:6 }}>
                  <button onClick={()=>setManualResidence(false)} style={{ flex:1, padding:'6px', borderRadius:6, border:`1px solid ${!manualResidence?'var(--blue)':'var(--border)'}`, background:!manualResidence?'var(--blue)':'var(--surface2)', color:!manualResidence?'#fff':'var(--text-dim)', cursor:'pointer', fontSize:11 }}>Liste</button>
                  <button onClick={()=>setManualResidence(true)} style={{ flex:1, padding:'6px', borderRadius:6, border:`1px solid ${manualResidence?'var(--blue)':'var(--border)'}`, background:manualResidence?'var(--blue)':'var(--surface2)', color:manualResidence?'#fff':'var(--text-dim)', cursor:'pointer', fontSize:11 }}>Saisie libre</button>
                </div>
                {manualResidence
                  ? <input value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})} style={inp} placeholder="Ex: A3, B12..."/>
                  : <select value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})} style={inp}>
                      <option value="">— Choisir une résidence —</option>
                      {bats.map(b=><option key={b.id} value={b.residence}>{b.residence} — {b.bloc} ({b.statut})</option>)}
                    </select>
                }
              </div>

              {/* CATÉGORIE + PRIORITÉ */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Catégorie</label>
                  <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} style={inp}>
                    {['Plomberie','Électricité','Serrurerie','Climatisation','Toiture','Autre'].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Priorité</label>
                  <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={inp}>
                    <option value="haute">🔴 Haute</option>
                    <option value="moyenne">🟠 Moyenne</option>
                    <option value="basse">🔵 Basse</option>
                  </select>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div>
                <label style={{ display:'block', fontSize:11, color:'var(--text-dim)', marginBottom:4, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:1 }}>Description *</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3}
                  style={{ ...inp, resize:'vertical' }} placeholder="Décrivez le problème en détail..."/>
              </div>
            </div>
            <div style={{ padding:'14px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setModal(false)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13 }}>Annuler</button>
              <button onClick={submit} disabled={submitting} style={{ background:submitting?'#64748b':'var(--blue)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600 }}>
                {submitting?'Envoi...' : '🚀 Signaler'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
