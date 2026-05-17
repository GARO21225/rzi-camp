/**
 * MAINTENANCE — Refonte complète avec design moderne
 * - Header avec KPIs
 * - Liste filtrée avec cartes
 * - Modals modernes
 * - Actions rapides
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { incidents, batiments as batAPI } from '../api'

// ─── Constantes ────────────────────────────────────────────────────
const PRIO_COLOR = { haute:'#dc2626', moyenne:'#f97316', basse:'#16a34a' }
const PRIO_BG    = { haute:'#fef2f2', moyenne:'#fff7ed', basse:'#f0fdf4' }
const STAT_COLOR = { 'Ouvert':'#dc2626', 'En cours':'#f97316', 'Résolu':'#16a34a' }
const STAT_BG    = { 'Ouvert':'#fef2f2', 'En cours':'#fff7ed', 'Résolu':'#f0fdf4' }
const CATS = ['Plomberie','Électricité','Climatisation','Serrurerie','Menuiserie','Peinture','Autre']
const PRIOS = ['haute','moyenne','basse']

// ─── Badge moderne ─────────────────────────────────────────────────
function Badge({ text, color, bg }) {
  return (
    <span style={{
      display:'inline-block', padding:'4px 12px', borderRadius:20,
      fontSize:11, fontWeight:700, color, background: bg
    }}>
      {text}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, borderColor }) {
  return (
    <div style={{
      background:'#fff', borderRadius:16, padding:'16px 18px',
      borderLeft:`5px solid ${borderColor}`,
      boxShadow:'0 4px 16px rgba(0,0,0,.06)'
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:24 }}>{icon}</span>
        <span style={{ fontSize:28, fontWeight:900, color, lineHeight:1 }}>{value}</span>
      </div>
      <div style={{ fontSize:11, color:'#64748b', textTransform:'uppercase', letterSpacing:.8, fontWeight:700 }}>{label}</div>
    </div>
  )
}

// ─── Search Bar ────────────────────────────────────────────────────
function SearchBar({ value, onChange, onClear, placeholder }) {
  return (
    <div style={{ position:'relative', flex:1, minWidth:200 }}>
      <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16 }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "Rechercher..."}
        style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:12, padding:'12px 14px 12px 42px', fontSize:14, fontFamily:'inherit', boxSizing:'border-box', background:'#fff', color:'#1e293b', outline:'none' }}
        onFocus={e => e.target.style.borderColor = '#2563eb'}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'}
      />
      {value && (
        <button onClick={onClear}
          style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#94a3b8' }}>
          ✕
        </button>
      )}
    </div>
  )
}

// ─── Incident Card ─────────────────────────────────────────────────
function IncidentCard({ inc, onDetail, onStatut, onResoudre, onSupprimer, isAdmin, isTech }) {
  return (
    <div style={{
      background:'#fff', borderRadius:18, padding:'18px 20px',
      borderLeft:`5px solid ${STAT_COLOR[inc.statut]||'#94a3b8'}`,
      boxShadow:'0 4px 20px rgba(0,0,0,.06)',
      transition:'transform .15s, box-shadow .15s',
      cursor:'pointer'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.06)' }}
      onClick={() => onDetail(inc)}
    >
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:16, color:'#1e293b', marginBottom:8 }}>{inc.titre}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <Badge text={inc.priorite?.toUpperCase() || '—'} color={PRIO_COLOR[inc.priorite]||'#64748b'} bg={PRIO_BG[inc.priorite]||'#f1f5f9'} />
            <Badge text={inc.statut || '—'} color={STAT_COLOR[inc.statut]||'#64748b'} bg={STAT_BG[inc.statut]||'#f1f5f9'} />
            <Badge text={inc.categorie || '—'} color='#6366f1' bg='#f5f3ff' />
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }} onClick={e => e.stopPropagation()}>
          {isTech && inc.statut === 'Ouvert' && (
            <button onClick={() => onStatut(inc.id,'En cours')}
              style={{ background:'rgba(249,115,22,.1)', color:'#f97316', border:'1px solid rgba(249,115,22,.2)', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              🔄 En cours
            </button>
          )}
          {isTech && inc.statut !== 'Résolu' && (
            <button onClick={() => onResoudre(inc.id)}
              style={{ background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600 }}>
              ✅ Résoudre
            </button>
          )}
          {isAdmin && (
            <button onClick={() => onSupprimer(inc.id)}
              style={{ background:'rgba(220,38,38,.08)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:11 }}>
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {inc.description && (
        <p style={{ fontSize:13, color:'#64748b', margin:'0 0 12px', lineHeight:1.5 }}>
          {inc.description.length > 100 ? inc.description.slice(0,100) + '...' : inc.description}
        </p>
      )}

      {/* Meta */}
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'#94a3b8' }}>
        {inc.residence && <span>📍 {inc.residence}{inc.bloc ? ` · ${inc.bloc}` : ''}</span>}
        <span>👤 {inc.auteur_nom || '—'}</span>
        <span>📅 {inc.date_creation ? new Date(inc.date_creation).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'}) : '—'}</span>
        {inc.photo_b64 && <span style={{ color:'#7c3aed' }}>📷 Photo</span>}
      </div>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────
function Modal({ title, icon, onClose, children, bg }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div style={{
        background:'#fff', borderRadius:20, width:'100%', maxWidth:560,
        maxHeight:'90vh', overflow:'auto',
        boxShadow:'0 24px 80px rgba(0,0,0,.3)'
      }}>
        <div style={{ background: bg || '#2563eb', color:'#fff', padding:'18px 24px', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'20px 20px 0 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>{icon}</span>
            <span style={{ fontWeight:700, fontSize:16 }}>{title}</span>
          </div>
          <button onClick={onClose}
            style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', width:34, height:34, borderRadius:10, cursor:'pointer', fontSize:16 }}>
            ✕
          </button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────
export default function Maintenance() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const isTech  = isAdmin || ['technicien','menage'].includes(role)

  const [data,        setData]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [filterStat,  setFilterStat]  = useState('')
  const [filterPrio,  setFilterPrio]  = useState('')
  const [filterCat,   setFilterCat]   = useState('')
  const [modal,       setModal]       = useState(null)
  const [detail,      setDetail]      = useState(null)
  const [photoB64,    setPhotoB64]    = useState('')
  const [gps,         setGps]         = useState(null)
  const [batList,     setBatList]     = useState([])

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

  // Filtrer par recherche
  const filteredData = search
    ? data.filter(inc =>
        inc.titre?.toLowerCase().includes(search.toLowerCase()) ||
        inc.description?.toLowerCase().includes(search.toLowerCase()) ||
        inc.residence?.toLowerCase().includes(search.toLowerCase())
      )
    : data

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
      setModal(null)
      setForm({ titre:'', description:'', categorie:'Plomberie', priorite:'haute', residence:'', bloc:'' })
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
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)', padding:24 }}>

      {/* ══ Header ══════════════════════════════════════════════════ */}
      <div style={{ maxWidth:1200, margin:'0 auto 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16, marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:26, fontWeight:800, color:'#1e293b', margin:0, display:'flex', alignItems:'center', gap:12 }}>
              🔧 Maintenance
            </h1>
            <p style={{ fontSize:13, color:'#64748b', margin:'4px 0 0' }}>
              Gestion des incidents du camp · {data.length} incident{data.length > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => setModal('create')}
            style={{ background:'#2563eb', color:'#fff', border:'none', padding:'14px 24px', borderRadius:14, cursor:'pointer', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 16px rgba(37,99,235,.3)', transition:'all .15s' }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 24px rgba(37,99,235,.4)' }}
            onMouseLeave={e => { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 4px 16px rgba(37,99,235,.3)' }}>
            ➕ Déclarer un incident
          </button>
        </div>

        {/* ══ KPIs ══════════════════════════════════════════════════ */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
          <StatCard icon="📋" label="Total" value={data.length} color="#2563eb" borderColor="#2563eb" />
          <StatCard icon="🔴" label="Ouverts" value={countByStatus('Ouvert')} color="#dc2626" borderColor="#dc2626" />
          <StatCard icon="🟠" label="En cours" value={countByStatus('En cours')} color="#f97316" borderColor="#f97316" />
          <StatCard icon="✅" label="Résolus" value={countByStatus('Résolu')} color="#16a34a" borderColor="#16a34a" />
        </div>

        {/* ══ Filters ══════════════════════════════════════════════ */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:20 }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            placeholder="Rechercher un incident..."
          />

          <select value={filterStat} onChange={e => setFilterStat(e.target.value)}
            style={{ background:'#fff', border:'2px solid #e2e8f0', padding:'10px 14px', borderRadius:12, fontSize:13, cursor:'pointer', color:'#1e293b' }}>
            <option value="">Tous statuts</option>
            <option value="Ouvert">🔴 Ouvert</option>
            <option value="En cours">🟠 En cours</option>
            <option value="Résolu">✅ Résolu</option>
          </select>

          <select value={filterPrio} onChange={e => setFilterPrio(e.target.value)}
            style={{ background:'#fff', border:'2px solid #e2e8f0', padding:'10px 14px', borderRadius:12, fontSize:13, cursor:'pointer', color:'#1e293b' }}>
            <option value="">Toutes priorités</option>
            <option value="haute">🔴 Haute</option>
            <option value="moyenne">🟠 Moyenne</option>
            <option value="basse">🟢 Basse</option>
          </select>

          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            style={{ background:'#fff', border:'2px solid #e2e8f0', padding:'10px 14px', borderRadius:12, fontSize:13, cursor:'pointer', color:'#1e293b' }}>
            <option value="">Toutes catégories</option>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button onClick={load} disabled={loading}
            style={{ background:'#2563eb', color:'#fff', border:'none', padding:'10px 16px', borderRadius:12, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            {loading ? '⏳' : '🔄'}
          </button>

          {(filterStat||filterPrio||filterCat||search) && (
            <button onClick={() => { setFilterStat(''); setFilterPrio(''); setFilterCat(''); setSearch('') }}
              style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'10px 16px', borderRadius:12, cursor:'pointer', fontSize:13, fontWeight:600 }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* ══ Liste ═════════════════════════════════════════════════ */}
      <div style={{ maxWidth:1200, margin:'0 auto' }}>
        {loading ? (
          <div style={{ padding:60, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>⏳</div>
            <div style={{ color:'#64748b', fontWeight:600 }}>Chargement en cours...</div>
          </div>
        ) : filteredData.length === 0 ? (
          <div style={{ padding:60, textAlign:'center', background:'#fff', borderRadius:20, boxShadow:'0 4px 16px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize:64, marginBottom:16 }}>🔧</div>
            <div style={{ fontWeight:700, fontSize:18, color:'#1e293b', marginBottom:8 }}>Aucun incident trouvé</div>
            <div style={{ color:'#64748b', fontSize:14 }}>Cliquez sur "Déclarer un incident" pour signaler un problème</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {filteredData.map(inc => (
              <IncidentCard
                key={inc.id}
                inc={inc}
                onDetail={setDetail}
                onStatut={changerStatut}
                onResoudre={resoudre}
                onSupprimer={supprimer}
                isAdmin={isAdmin}
                isTech={isTech}
              />
            ))}
          </div>
        )}
      </div>

      {/* ═══ MODAL DÉTAIL ══════════════════════════════════════════ */}
      {detail && (
        <Modal
          title={detail.titre}
          icon="🔍"
          bg="#2563eb"
          onClose={() => setDetail(null)}
        >
          {/* Badges */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
            <Badge text={`Priorité: ${detail.priorite?.toUpperCase() || '—'}`} color={PRIO_COLOR[detail.priorite]||'#64748b'} bg={PRIO_BG[detail.priorite]||'#f1f5f9'} />
            <Badge text={detail.statut || '—'} color={STAT_COLOR[detail.statut]||'#64748b'} bg={STAT_BG[detail.statut]||'#f1f5f9'} />
            <Badge text={detail.categorie || '—'} color='#6366f1' bg='#f5f3ff' />
          </div>

          {/* Info grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
            {[
              ['📍 Résidence', detail.residence || '—'],
              ['🏗️ Bloc', detail.bloc || '—'],
              ['👤 Signalé par', detail.auteur_nom || '—'],
              ['📅 Création', detail.date_creation ? new Date(detail.date_creation).toLocaleString('fr-FR') : '—'],
              ['✅ Résolution', detail.date_resolution ? new Date(detail.date_resolution).toLocaleString('fr-FR') : 'En attente'],
            ].map(([label, value]) => (
              <div key={label} style={{ background:'#f8fafc', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:4, fontWeight:600 }}>{label}</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1e293b' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ background:'#f8fafc', borderRadius:12, padding:'16px', marginBottom:20 }}>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:8, fontWeight:600 }}>📝 Description</div>
            <div style={{ fontSize:14, color:'#1e293b', lineHeight:1.6 }}>{detail.description || 'Aucune description'}</div>
          </div>

          {/* GPS */}
          {detail.latitude && detail.longitude && (
            <a href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
              target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(37,99,235,.08)', border:'1px solid rgba(37,99,235,.2)', borderRadius:12, padding:'14px 16px', textDecoration:'none', color:'#2563eb', fontSize:14, fontWeight:600, marginBottom:20 }}>
              📍 Voir sur Google Maps ({detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)})
            </a>
          )}

          {/* Photo */}
          {detail.photo_b64 ? (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#1e293b', marginBottom:10 }}>📷 Photo de l'incident</div>
              <img
                src={`data:${detail.photo_mime || 'image/jpeg'};base64,${detail.photo_b64}`}
                alt="Photo incident"
                style={{ width:'100%', maxHeight:300, objectFit:'contain', borderRadius:14, border:'2px solid #e2e8f0', background:'#000' }}
                onError={e => e.target.style.display='none'}
              />
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'24px', color:'#94a3b8', background:'#f8fafc', borderRadius:12, fontSize:14, marginBottom:20 }}>
              📷 Aucune photo
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', paddingTop:16, borderTop:'1px solid #e2e8f0' }}>
            {isTech && detail.statut === 'Ouvert' && (
              <button onClick={() => { changerStatut(detail.id,'En cours'); setDetail({...detail, statut:'En cours'}) }}
                style={{ flex:1, background:'rgba(249,115,22,.1)', color:'#f97316', border:'1px solid rgba(249,115,22,.2)', padding:'12px', borderRadius:12, cursor:'pointer', fontSize:14, fontWeight:700 }}>
                🔄 Passer en cours
              </button>
            )}
            {isTech && detail.statut !== 'Résolu' && (
              <button onClick={() => { resoudre(detail.id); setDetail(null) }}
                style={{ flex:1, background:'rgba(22,163,74,.1)', color:'#16a34a', border:'1px solid rgba(22,163,74,.2)', padding:'12px', borderRadius:12, cursor:'pointer', fontSize:14, fontWeight:700 }}>
                ✅ Marquer résolu
              </button>
            )}
            {isAdmin && (
              <button onClick={() => { supprimer(detail.id); setDetail(null) }}
                style={{ background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.2)', padding:'12px 20px', borderRadius:12, cursor:'pointer', fontSize:14, fontWeight:700 }}>
                🗑 Supprimer
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* ═══ MODAL CREATE ══════════════════════════════════════════ */}
      {modal === 'create' && (
        <Modal
          title="Déclarer un incident"
          icon="🔧"
          bg="#2563eb"
          onClose={() => setModal(null)}
        >
          {err && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'12px 16px', color:'#dc2626', fontSize:13, fontWeight:600, marginBottom:16 }}>
              ❌ {err}
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Titre */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:.6 }}>
                📝 Titre *
              </label>
              <input
                value={form.titre}
                onChange={e => setForm({...form, titre:e.target.value})}
                placeholder="Décrivez le problème..."
                style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:12, padding:'14px 16px', fontSize:15, fontFamily:'inherit', boxSizing:'border-box', background:'#fff', color:'#1e293b', outline:'none' }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Description */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:.6 }}>
                📄 Description
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm({...form, description:e.target.value})}
                rows={3}
                placeholder="Details supplémentaires..."
                style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:12, padding:'14px 16px', fontSize:15, fontFamily:'inherit', boxSizing:'border-box', background:'#fff', color:'#1e293b', outline:'none', resize:'vertical' }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Residence & Bloc */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:.6 }}>
                  📍 Résidence
                </label>
                <input
                  value={form.residence}
                  onChange={e => setForm({...form, residence:e.target.value})}
                  placeholder="Ex: Bloc A"
                  style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:12, padding:'12px 14px', fontSize:14, fontFamily:'inherit', boxSizing:'border-box', background:'#fff', color:'#1e293b', outline:'none' }}
                  onFocus={e => e.target.style.borderColor = '#2563eb'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:.6 }}>
                  🏗️ Bloc
                </label>
                <input
                  value={form.bloc}
                  onChange={e => setForm({...form, bloc:e.target.value})}
                  placeholder="Ex: Chambre 12"
                  style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:12, padding:'12px 14px', fontSize:14, fontFamily:'inherit', boxSizing:'border-box', background:'#fff', color:'#1e293b', outline:'none' }}
                  onFocus={e => e.target.style.borderColor = '#2563eb'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>

            {/* Categorie & Priorite */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:.6 }}>
                  🏷️ Catégorie
                </label>
                <select value={form.categorie} onChange={e => setForm({...form, categorie:e.target.value})}
                  style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:12, padding:'12px 14px', fontSize:14, background:'#fff', color:'#1e293b', cursor:'pointer' }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:.6 }}>
                  ⚡ Priorité
                </label>
                <select value={form.priorite} onChange={e => setForm({...form, priorite:e.target.value})}
                  style={{ width:'100%', border:'2px solid #e2e8f0', borderRadius:12, padding:'12px 14px', fontSize:14, background:'#fff', color:'#1e293b', cursor:'pointer' }}>
                  {PRIOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                </select>
              </div>
            </div>

            {/* Photo */}
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:.6 }}>
                📷 Photo (optionnel)
              </label>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto}
                style={{ width:'100%', border:'2px dashed #e2e8f0', borderRadius:12, padding:'12px 14px', fontSize:13, background:'#fff' }} />
              {photoB64 && (
                <div style={{ marginTop:8, padding:'8px 12px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, fontSize:12, color:'#16a34a', fontWeight:600 }}>
                  ✅ Photo prête à envoyer
                </div>
              )}
            </div>

            {/* GPS */}
            <button onClick={getGPS}
              style={{ background: gps ? 'rgba(22,163,74,.1)' : 'rgba(37,99,235,.08)', color: gps ? '#16a34a' : '#2563eb', border:'1px solid' + (gps ? 'rgba(22,163,74,.2)' : 'rgba(37,99,235,.2)'), padding:'12px 16px', borderRadius:12, cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
              📍 {gps ? `GPS capturé (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)})` : 'Capturer ma position GPS'}
            </button>

            {/* Submit */}
            <button onClick={submit} disabled={submitting}
              style={{
                width:'100%', background: submitting ? '#94a3b8' : '#2563eb', color:'#fff',
                border:'none', padding:'16px', borderRadius:12,
                cursor: submitting ? 'wait' : 'pointer', fontSize:15, fontWeight:700,
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                boxShadow: submitting ? 'none' : '0 4px 16px rgba(37,99,235,.3)',
                marginTop:4
              }}>
              {submitting ? '⏳ Envoi en cours...' : '📤 Déclarer l\'incident'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}