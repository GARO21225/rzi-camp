import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { batiments } from '../api'

function statusColor(s) {
  const c = { 'Libre':'#22c55e','Occupé':'#ef4444','Réservé':'#3b82f6','Maintenance':'#f97316' }
  return c[s] || '#666'
}

function FitBounds({ geojson }) {
  const map = useMap()
  useEffect(() => {
    if (geojson?.features?.length) {
      try {
        const L = window.L
        const layer = L.geoJSON(geojson)
        map.fitBounds(layer.getBounds(), { padding:[20,20] })
      } catch(e){}
    }
  }, [geojson])
  return null
}

export default function MapPage() {
  const [geojson, setGeojson] = useState(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [filterBloc, setFilterBloc] = useState('')
  const [filterResidence, setFilterResidence] = useState('')
  const [stats, setStats] = useState(null)
  const [geoKey, setGeoKey] = useState(0)

  const load = useCallback(() => {
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (filterBloc) p.bloc = filterBloc
    if (filterResidence) p.residence = filterResidence
    batiments.geojson(p).then(r => {
      setGeojson(r.data)
      setGeoKey(k => k+1)
    })
    batiments.stats().then(r => setStats(r.data))
  }, [filterStatut, filterBloc, filterResidence])

  useEffect(() => { load() }, [load])

  const blocs = stats?.par_bloc?.map(b => b.bloc) || []
  const ps = stats?.par_statut || {}

  const statChips = [
    ['Libre','libre', ps['Libre']||0],
    ['Occupé','occupe', ps['Occupé']||0],
    ['Réservé','reserve', ps['Réservé']||0],
    ['Maintenance','maintenance', ps['Maintenance']||0],
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, height:'100%' }}>
      {/* TOOLBAR */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', padding:'0 12px', gap:8, flexShrink:0, flexWrap:'wrap', minHeight:44 }}>
        <select value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 8px', borderRadius:6, fontSize:12, outline:'none' }}>
          <option value="">Tous statuts</option>
          <option value="Libre">🟢 Libre</option>
          <option value="Occupé">🔴 Occupé</option>
          <option value="Réservé">🔵 Réservé</option>
          <option value="Maintenance">🟠 Maintenance</option>
        </select>
        <select value={filterBloc} onChange={e=>setFilterBloc(e.target.value)}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 8px', borderRadius:6, fontSize:12, outline:'none' }}>
          <option value="">Tous blocs</option>
          {blocs.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
        <input value={filterResidence} onChange={e=>setFilterResidence(e.target.value)}
          placeholder="🔍 Résidence ex: A3"
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)',
            padding:'5px 10px', borderRadius:6, fontSize:12, outline:'none', width:150 }}/>
        <button onClick={()=>{setFilterStatut('');setFilterBloc('');setFilterResidence('')}}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)',
            padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer' }}>✕ Reset</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:12 }}>
          {statChips.map(([label,cls,val])=>(
            <span key={cls} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, fontFamily:'monospace',
              cursor:'pointer', color: filterStatut===label ? 'var(--text)' : 'var(--text-dim)' }}
              onClick={()=>setFilterStatut(filterStatut===label?'':label)}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:`var(--${cls})`, display:'inline-block' }}/>
              {val} {label}
            </span>
          ))}
        </div>
      </div>

      {/* MAP */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer center={[8.111,-6.822]} zoom={17}
          style={{ height:'100%', width:'100%', background:'#0d1117' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"/>
          {geojson && (
            <>
              <FitBounds geojson={geojson}/>
              <GeoJSON key={geoKey} data={geojson}
                style={f => ({
                  color: statusColor(f.properties.statut),
                  weight:1.5,
                  fillColor: statusColor(f.properties.statut),
                  fillOpacity:.5
                })}
                onEachFeature={(f,layer) => {
                  const p = f.properties
                  const lat = p.latitude, lng = p.longitude
                  const navUrl = lat && lng
                    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
                    : `https://www.google.com/maps/search/${p.residence}+Roxgold+Sango`
                  layer.bindPopup(`
                    <div style="font-family:sans-serif;min-width:200px">
                      <b style="color:#f0a500;font-size:13px">🏠 Résidence ${p.residence}</b><br/>
                      <div style="font-size:12px;line-height:1.8;margin-top:6px">
                        <b>Bloc :</b> ${p.bloc}<br/>
                        <b>Statut :</b> <span style="color:${statusColor(p.statut)};font-weight:600">${p.statut}</span><br/>
                        ${p.occupant?'<b>Occupant :</b> '+p.occupant+'<br/>':''}
                        ${p.societe?'<b>Société :</b> '+p.societe+'<br/>':''}
                      </div>
                      <div style="margin-top:8px;display:flex;gap:6px">
                        <a href="${navUrl}" target="_blank"
                          style="background:#f0a500;color:#000;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;text-decoration:none;font-weight:600">
                          🧭 Naviguer
                        </a>
                      </div>
                    </div>
                  `, {maxWidth:260})
                  layer.on('mouseover', function() { this.setStyle({fillOpacity:.85, weight:2.5}) })
                  layer.on('mouseout', function() { this.setStyle({fillOpacity:.5, weight:1.5}) })
                }}
              />
            </>
          )}
        </MapContainer>

        {/* Légende */}
        <div style={{ position:'absolute', bottom:20, right:10, background:'rgba(10,13,18,.92)',
          border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', zIndex:900, fontSize:12 }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-dim)', letterSpacing:2, marginBottom:8 }}>LÉGENDE</div>
          {[['Libre','var(--libre)'],['Occupé','var(--occupe)'],['Réservé','var(--reserve)'],['Maintenance','var(--maintenance)']].map(([l,c])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0' }}>
              <div style={{ width:12, height:12, borderRadius:3, background:c, flexShrink:0 }}/>
              <span>{l}</span>
            </div>
          ))}
          <div style={{ marginTop:8, borderTop:'1px solid var(--border)', paddingTop:8, fontSize:10, color:'var(--text-dim)' }}>
            {geojson?.features?.length||0} bâtiments affichés
          </div>
        </div>
      </div>
    </div>
  )
}
