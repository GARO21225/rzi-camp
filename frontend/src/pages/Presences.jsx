/**
 * PRÉSENCES — Pointage quotidien des agents
 * Qui est au camp / en voyage / absent ce jour
 */
import React, { useState, useEffect } from 'react'
import { personnel as personnelAPI, voyages as voyAPI } from '../api'

const STATUTS = {
  present:  { label:'Présent',   bg:'#f0fdf4', color:'#16a34a', dot:'#16a34a', icon:'✅' },
  voyage:   { label:'En voyage', bg:'#fff7ed', color:'#ea580c', dot:'#ea580c', icon:'✈️' },
  conge:    { label:'En congé',  bg:'#eff6ff', color:'#2563eb', dot:'#2563eb', icon:'🏖️' },
  absent:   { label:'Absent',    bg:'#fef2f2', color:'#dc2626', dot:'#dc2626', icon:'❌' },
}

export default function Presences() {
  const [personnel, setPersonnel] = useState([])
  const [voyagesActifs, setVoyagesActifs] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })

  useEffect(() => {
    Promise.all([
      personnelAPI.list({ page_size:500 }),
      voyAPI.list({ statut:'en_voyage', page_size:500 }),
    ]).then(([rp, rv]) => {
      setPersonnel(rp.data.results || rp.data || [])
      setVoyagesActifs(rv.data.results || rv.data || [])
    }).finally(() => setLoading(false))
  }, [])

  // Enrichir chaque personne avec son statut voyage
  const enVoyageIds = new Set(voyagesActifs.map(v => v.personnel))

  const data = personnel.map(p => ({
    ...p,
    statut: enVoyageIds.has(p.id) ? 'voyage' : 'present',
  }))

  const filtered = data.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || [p.nom, p.prenom, p.societe].some(v => (v||'').toLowerCase().includes(q))
    const matchFilter = !filter || p.statut === filter
    return matchSearch && matchFilter
  })

  const counts = {
    total:   data.length,
    present: data.filter(p => p.statut === 'present').length,
    voyage:  data.filter(p => p.statut === 'voyage').length,
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', fontSize:32 }}>⏳</div>

  return (
    <div style={{ padding:20, maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#1e3a8a', margin:0 }}>📋 Présences</h2>
          <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>
            {today.charAt(0).toUpperCase() + today.slice(1)} · Mise à jour en temps réel
          </p>
        </div>
        <button onClick={() => {
          // Export CSV présences
          const h = ['Nom','Prénom','Société','Type','Statut']
          const rows = filtered.map(p => [p.nom, p.prenom, p.societe, p.type_personnel, STATUTS[p.statut]?.label])
          const csv = [h,...rows].map(r => r.map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(',')).join('\n')
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv'}))
          a.download = `presences_${new Date().toISOString().slice(0,10)}.csv`; a.click()
        }} style={{ background:'#1e3a8a', color:'#fff', border:'none', padding:'9px 18px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
          ⬇ Exporter CSV
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Personnel', v:counts.total,   color:'#1e3a8a' },
          { label:'Au Camp',         v:counts.present,  color:'#16a34a' },
          { label:'En Voyage',       v:counts.voyage,   color:'#ea580c' },
          { label:'Taux Présence',   v:`${counts.total?Math.round(counts.present/counts.total*100):0}%`, color:'#7c3aed' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:'16px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontFamily:'monospace', fontSize:30, fontWeight:900, color:k.color }}>{k.v}</div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'#94a3b8', marginTop:4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Nom, prénom, société..."
            style={{ width:'100%', paddingLeft:36, border:'1px solid #e2e8f0', borderRadius:9, padding:'9px 12px 9px 36px', fontSize:13, outline:'none', boxSizing:'border-box' }} />
        </div>
        {['','present','voyage'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding:'8px 16px', border:`1px solid ${filter===s?'#1e3a8a':'#e2e8f0'}`, borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:600, background:filter===s?'#1e3a8a':'#fff', color:filter===s?'#fff':'#64748b' }}>
            {s===''?'Tous':STATUTS[s]?.icon+' '+STATUTS[s]?.label} ({s===''?data.length:data.filter(p=>p.statut===s).length})
          </button>
        ))}
      </div>

      {/* Grille cartes personnel */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
        {filtered.map(p => {
          const st = STATUTS[p.statut] || STATUTS.present
          return (
            <div key={p.id} style={{ background:'#fff', border:`1px solid ${st.color}30`, borderRadius:14, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.06)', borderLeft:`4px solid ${st.color}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ width:40, height:40, borderRadius:12, background:`${st.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                  {st.icon}
                </div>
                <span style={{ background:st.bg, color:st.color, padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:700 }}>
                  {st.label}
                </span>
              </div>
              <div style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{p.nom} {p.prenom}</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{p.societe || '—'}</div>
              {p.numero && <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>📞 {p.numero}</div>}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>
          <div style={{ fontSize:40 }}>👤</div>
          <div style={{ marginTop:10, fontSize:14, fontWeight:600 }}>Aucun résultat</div>
        </div>
      )}
    </div>
  )
}
