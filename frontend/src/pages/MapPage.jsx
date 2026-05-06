import React, { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { batiments } from '../api'

function statusColor(s) {
  return { 'Libre':'#22c55e','Occupé':'#ef4444','Réservé':'#3b82f6','Maintenance':'#f97316' }[s] || '#666'
}

function FitBounds({ geojson }) {
  const map = useMap()
  useEffect(() => {
    if (geojson?.features?.length) {
      const L = window.L
      const layer = L.geoJSON(geojson)
      map.fitBounds(layer.getBounds(), { padding:[20,20] })
    }
  }, [geojson])
  return null
}

export default function MapPage() {
  const [geojson, setGeojson] = useState(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [filterBloc, setFilterBloc] = useState('')
  const [stats, setStats] = useState(null)
  const key = `${filterStatut}-${filterBloc}`

  const load = () => {
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (filterBloc) p.bloc = filterBloc
    batiments.geojson(p).then(r => setGeojson(r.data))
    batiments.stats().then(r => setStats(r.data))
  }

  useEffect(() => { load() }, [filterStatut, filterBloc])

  const blocs = stats?.par_bloc?.map(b => b.bloc) || []

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, height:'100%' }}>
      {/* Toolbar */}
      <div style={{ height:44, background:'var(--surface)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:10, flexShrink:0 }}>
        <select value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 10px', borderRadius:6, fontSize:12, outline:'none' }}>
          <option value="">Tous statuts</option>
          <option>Libre</option><option>Occupé</option><option>Réservé</option><option>Maintenance</option>
        </select>
        <select value={filterBloc} onChange={e=>setFilterBloc(e.target.value)}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 10px', borderRadius:6, fontSize:12, outline:'none' }}>
          <option value="">Tous blocs</option>
          {blocs.map(b => <option key={b}>{b}</option>)}
        </select>
        <div style={{ marginLeft:'auto', display:'flex', gap:16, fontSize:11, fontFamily:'monospace' }}>
          {[['Libres','libre'],['Occupés','occupe'],['Réservés','reserve'],['Maint.','maintenance']].map(([label,cls]) => (
            <span key={cls} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:`var(--${cls})`, display:'inline-block' }}/>
              {stats?.par_statut?.[label.replace('Maint.','Maintenance').replace('Libres','Libre').replace('Occupés','Occupé').replace('Réservés','Réservé')] ?? '—'} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer center={[8.111, -6.822]} zoom={17} style={{ height:'100%', width:'100%', background:'#0d1117' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"/>
          {geojson && (
            <>
              <FitBounds geojson={geojson} />
              <GeoJSON key={key} data={geojson}
                style={f => ({ color: statusColor(f.properties.statut), weight:1.5, fillColor: statusColor(f.properties.statut), fillOpacity:.45 })}
                onEachFeature={(f, layer) => {
                  const p = f.properties
                  layer.bindPopup(`
                    <b style="color:#f0a500">🏠 ${p.residence}</b><br/>
                    Bloc : ${p.bloc}<br/>
                    Statut : <span style="color:${statusColor(p.statut)}">${p.statut}</span><br/>
                    ${p.occupant ? 'Occupant : '+p.occupant+'<br/>' : ''}
                    ${p.societe ? 'Société : '+p.societe : ''}
                  `)
                  layer.on('mouseover', function() { this.setStyle({ fillOpacity:.8 }) })
                  layer.on('mouseout', function() { this.setStyle({ fillOpacity:.45 }) })
                }}
              />
            </>
          )}
        </MapContainer>

        {/* Legend */}
        <div style={{ position:'absolute', bottom:20, right:10, background:'rgba(10,13,18,.9)',
          border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', zIndex:900, fontSize:12 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-dim)', letterSpacing:2, marginBottom:8 }}>LÉGENDE</div>
          {[['Libre','var(--libre)'],['Occupé','var(--occupe)'],['Réservé','var(--reserve)'],['Maintenance','var(--maintenance)']].map(([l,c]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0' }}>
              <div style={{ width:12, height:12, borderRadius:3, background:c, flexShrink:0 }}/>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
