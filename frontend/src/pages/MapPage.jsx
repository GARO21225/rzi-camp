
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Polyline, Popup, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { batiments } from '../api'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

const TILES = [
  { id:'light', label:'⬜ Clair', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { id:'dark', label:'🌑 Sombre', url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { id:'osm', label:'🗺️ OSM', url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id:'satellite', label:'🛰️ Satellite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
]

function statusColor(s) {
  return { 'Libre':'#16a34a','Occupé':'#dc2626','Réservé':'#2563eb','Maintenance':'#ea580c' }[s]||'#666'
}

function FitBounds({ geojson }) {
  const map = useMap()
  useEffect(() => {
    if (geojson?.features?.length) {
      try { map.fitBounds(L.geoJSON(geojson).getBounds(),{padding:[20,20]}) } catch(e){}
    }
  }, [geojson])
  return null
}

function NavigationLayer({ userPos, route, targetPos, targetName, distance, bearing }) {
  const map = useMap()

  useEffect(() => {
    if (userPos && targetPos) {
      const bounds = L.latLngBounds([userPos, targetPos])
      map.fitBounds(bounds, { padding:[60,60] })
    }
  }, [userPos, targetPos])

  if (!userPos || !targetPos) return null

  const userIcon = L.divIcon({
    html: '<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb;"></div>',
    className:'', iconSize:[16,16], iconAnchor:[8,8]
  })
  const targetIcon = L.divIcon({
    html: '<div style="background:#dc2626;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px #dc2626;display:flex;align-items:center;justify-content:center;font-size:10px;">🏠</div>',
    className:'', iconSize:[20,20], iconAnchor:[10,10]
  })

  return (
    <>
      <Marker position={userPos} icon={userIcon}>
        <Popup><b>📍 Votre position</b></Popup>
      </Marker>
      <Circle center={userPos} radius={15} color="#2563eb" fillOpacity={0.15}/>

      <Marker position={targetPos} icon={targetIcon}>
        <Popup>
          <b style={{color:'#dc2626'}}>🏠 {targetName}</b><br/>
          <span style={{fontSize:12}}>Distance : <b>{distance}</b></span><br/>
          <span style={{fontSize:12}}>Direction : <b>{bearing}</b></span><br/>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${targetPos[0]},${targetPos[1]}`}
            target="_blank" rel="noreferrer"
            style={{display:'inline-block',marginTop:6,background:'#1e3a8a',color:'#fff',padding:'4px 10px',borderRadius:5,textDecoration:'none',fontSize:11,fontWeight:600}}>
            🗺️ Google Maps
          </a>
        </Popup>
      </Marker>

      {/* Straight line route */}
      <Polyline positions={[userPos, targetPos]} color="#f0a500" weight={4} dashArray="12,6" opacity={0.9}/>

      {/* Animated dot along the line (midpoint indicator) */}
      <Circle
        center={[(userPos[0]+targetPos[0])/2, (userPos[1]+targetPos[1])/2]}
        radius={8} color="#f0a500" fillOpacity={0.6}/>
    </>
  )
}

function calcDistance(pos1, pos2) {
  const d = L.latLng(pos1).distanceTo(L.latLng(pos2))
  return d > 1000 ? `${(d/1000).toFixed(2)} km` : `${Math.round(d)} m`
}

function calcBearing(pos1, pos2) {
  const lat1 = pos1[0]*Math.PI/180, lat2 = pos2[0]*Math.PI/180
  const dLng = (pos2[1]-pos1[1])*Math.PI/180
  const y = Math.sin(dLng)*Math.cos(lat2)
  const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng)
  const bearing = (Math.atan2(y,x)*180/Math.PI + 360) % 360
  const dirs = ['N','NE','E','SE','S','SO','O','NO']
  return dirs[Math.round(bearing/45)%8]
}

export default function MapPage() {
  const [geojson, setGeojson] = useState(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [filterBloc, setFilterBloc] = useState('')
  const [filterResidence, setFilterResidence] = useState('')
  const [stats, setStats] = useState(null)
  const [geoKey, setGeoKey] = useState(0)
  const [tileId, setTileId] = useState('light')

  // Navigation state
  const [navMode, setNavMode] = useState(false)
  const [userPos, setUserPos] = useState(null)
  const [targetPos, setTargetPos] = useState(null)
  const [targetName, setTargetName] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState(null)
  const watchRef = useRef(null)

  const tile = TILES.find(t=>t.id===tileId)||TILES[0]

  const load = useCallback(() => {
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (filterBloc) p.bloc = filterBloc
    if (filterResidence) p.residence = filterResidence
    batiments.geojson(p).then(r => { setGeojson(r.data); setGeoKey(k=>k+1) })
    batiments.stats().then(r => setStats(r.data))
  }, [filterStatut, filterBloc, filterResidence])

  useEffect(() => { load() }, [load])

  // Start GPS watch
  const startGPS = () => {
    setGpsLoading(true)
    setGpsError(null)
    if (!navigator.geolocation) {
      setGpsError('GPS non disponible sur cet appareil')
      setGpsLoading(false)
      return
    }
    // Use watchPosition for continuous tracking
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude])
        setGpsLoading(false)
      },
      err => {
        setGpsError(`Erreur GPS: ${err.message}. Utilisation de la position du camp.`)
        setUserPos([8.111, -6.822]) // Camp RZI fallback
        setGpsLoading(false)
      },
      { enableHighAccuracy:true, maximumAge:5000, timeout:10000 }
    )
  }

  const stopNav = () => {
    setNavMode(false)
    setTargetPos(null)
    setTargetName('')
    if (watchRef.current) {
      navigator.geolocation?.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }

  const toggleNav = () => {
    if (navMode) { stopNav() }
    else {
      setNavMode(true)
      if (!userPos) startGPS()
    }
  }

  // Click on building → navigate to it
  const handleBuildingClick = (feature) => {
    if (!navMode) return
    const { latitude, longitude, residence } = feature.properties
    if (latitude && longitude) {
      setTargetPos([latitude, longitude])
      setTargetName(`Résidence ${residence}`)
    }
  }

  const blocs = stats?.par_bloc?.map(b=>b.bloc)||[]
  const ps = stats?.par_statut||{}

  const distance = userPos && targetPos ? calcDistance(userPos, targetPos) : null
  const bearing = userPos && targetPos ? calcBearing(userPos, targetPos) : null

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, height:'100%' }}>
      {/* TOOLBAR */}
      <div style={{ background:'#fff', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 10px', gap:6, flexShrink:0, flexWrap:'wrap', minHeight:46 }}>
        <select value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'4px 8px', borderRadius:6, fontSize:11, outline:'none' }}>
          <option value="">Tous statuts</option>
          <option value="Libre">🟢 Libre</option>
          <option value="Occupé">🔴 Occupé</option>
          <option value="Réservé">🔵 Réservé</option>
          <option value="Maintenance">🟠 Maintenance</option>
        </select>
        <select value={filterBloc} onChange={e=>setFilterBloc(e.target.value)}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'4px 8px', borderRadius:6, fontSize:11, outline:'none' }}>
          <option value="">Tous blocs</option>
          {blocs.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
        <input value={filterResidence} onChange={e=>setFilterResidence(e.target.value)} placeholder="🔍 Résidence..."
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'4px 8px', borderRadius:6, fontSize:11, outline:'none', width:110 }}/>
        <button onClick={()=>{setFilterStatut('');setFilterBloc('');setFilterResidence('')}}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'4px 8px', borderRadius:6, fontSize:11, cursor:'pointer' }}>✕</button>

        {/* Tile switcher */}
        <div style={{ display:'flex', gap:3, padding:2, background:'var(--surface2)', borderRadius:7, border:'1px solid var(--border)' }}>
          {TILES.map(t=>(
            <button key={t.id} onClick={()=>setTileId(t.id)}
              style={{ padding:'3px 7px', borderRadius:5, border:'none', fontSize:10, cursor:'pointer',
                background:tileId===t.id?'var(--blue)':'transparent',
                color:tileId===t.id?'#fff':'var(--text-dim)', fontWeight:tileId===t.id?600:400 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Navigation button */}
        <button onClick={toggleNav}
          style={{ padding:'5px 12px', borderRadius:7, border:`2px solid ${navMode?'#f0a500':'var(--border)'}`,
            background:navMode?'rgba(240,165,0,.15)':'var(--surface2)',
            color:navMode?'#d08800':'var(--text-dim)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
          {gpsLoading?'📡 GPS...':navMode?'🧭 Nav ON ▸ Clic résidence':'🧭 Navigation'}
        </button>
        {navMode && targetPos && <button onClick={()=>{setTargetPos(null);setTargetName('')}} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text-dim)', cursor:'pointer', fontSize:10 }}>✕ Effacer</button>}

        {/* Stats */}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, fontSize:10, fontFamily:'monospace' }}>
          {[['Libre','#16a34a',ps['Libre']||0],['Occupé','#dc2626',ps['Occupé']||0],['Réservé','#2563eb',ps['Réservé']||0]].map(([l,c,v])=>(
            <span key={l} style={{ display:'flex', alignItems:'center', gap:3, color:'var(--text-dim)', cursor:'pointer' }}
              onClick={()=>setFilterStatut(filterStatut===l?'':l)}>
              <span style={{ width:7,height:7,borderRadius:'50%',background:c,display:'inline-block' }}/>
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Navigation info bar */}
      {navMode && (
        <div style={{ background:'linear-gradient(90deg,rgba(240,165,0,.12),rgba(240,165,0,.06))', borderBottom:'1px solid rgba(240,165,0,.3)', padding:'6px 14px', display:'flex', alignItems:'center', gap:14, fontSize:12, flexShrink:0 }}>
          <span style={{ color:'#d08800', fontWeight:700 }}>🧭 Mode Navigation</span>
          {!userPos && !gpsLoading && <span style={{ color:'var(--text-dim)' }}>Acquisition GPS...</span>}
          {userPos && !targetPos && <span style={{ color:'var(--text-dim)' }}>👆 Cliquez sur une résidence pour tracer l'itinéraire</span>}
          {userPos && targetPos && (
            <>
              <span style={{ color:'var(--text)', fontWeight:600 }}>→ {targetName}</span>
              <span style={{ background:'rgba(240,165,0,.2)', padding:'2px 10px', borderRadius:20, color:'#d08800', fontWeight:700 }}>📏 {distance}</span>
              <span style={{ background:'rgba(37,99,235,.1)', padding:'2px 10px', borderRadius:20, color:'#2563eb', fontWeight:700 }}>🧭 {bearing}</span>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${targetPos[0]},${targetPos[1]}`}
                target="_blank" rel="noreferrer"
                style={{ background:'var(--blue)', color:'#fff', padding:'3px 12px', borderRadius:20, textDecoration:'none', fontSize:11, fontWeight:700 }}>
                🗺️ Google Maps
              </a>
            </>
          )}
          {gpsError && <span style={{ color:'#dc2626', fontSize:11 }}>⚠️ {gpsError}</span>}
        </div>
      )}

      {/* MAP */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer center={[8.111,-6.822]} zoom={17} style={{ height:'100%',width:'100%' }}>
          <TileLayer key={tileId} url={tile.url} attribution=""/>
          {geojson && (
            <>
              <FitBounds geojson={geojson}/>
              <GeoJSON key={geoKey} data={geojson}
                style={f=>({
                  color:statusColor(f.properties.statut),
                  weight: navMode ? 2 : 1.5,
                  fillColor:statusColor(f.properties.statut),
                  fillOpacity:.5
                })}
                onEachFeature={(f,layer)=>{
                  const p = f.properties
                  layer.on('click', ()=>handleBuildingClick(f))
                  layer.bindPopup(`
                    <div style="font-family:sans-serif;min-width:200px">
                      <b style="color:#1e3a8a;font-size:14px">🏠 Résidence ${p.residence}</b><br/>
                      <div style="font-size:12px;line-height:1.8;margin-top:6px">
                        <b>Bloc :</b> ${p.bloc}<br/>
                        <b>Statut :</b> <span style="color:${statusColor(p.statut)};font-weight:700">${p.statut}</span><br/>
                        ${p.occupant?'<b>Occupant :</b> '+p.occupant+'<br/>':''}
                      </div>
                      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                        <button onclick="document.dispatchEvent(new CustomEvent('nav-to',{detail:{lat:${p.latitude},lng:${p.longitude},name:'${p.residence}'}}))"
                          style="background:#f0a500;color:#000;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700">
                          🧭 Naviguer vers cette chambre
                        </button>
                      </div>
                    </div>
                  `, {maxWidth:260})
                  layer.on('mouseover', function() { this.setStyle({fillOpacity:.8,weight:2.5}) })
                  layer.on('mouseout', function() { this.setStyle({fillOpacity:.5,weight:navMode?2:1.5}) })
                }}
              />
            </>
          )}
          <NavigationLayer userPos={userPos} targetPos={targetPos} targetName={targetName} distance={distance} bearing={bearing}/>
        </MapContainer>

        {/* Légende */}
        <div style={{ position:'absolute', bottom:20, right:10, background:'rgba(255,255,255,.95)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', zIndex:900, fontSize:12, boxShadow:'var(--shadow)' }}>
          <div style={{ fontFamily:'monospace', fontSize:9, color:'var(--text-dim)', letterSpacing:2, marginBottom:7, textTransform:'uppercase' }}>LÉGENDE</div>
          {[['Libre','#16a34a'],['Occupé','#dc2626'],['Réservé','#2563eb'],['Maintenance','#ea580c']].map(([l,c])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:7, margin:'4px 0', cursor:'pointer' }}
              onClick={()=>setFilterStatut(filterStatut===l?'':l)}>
              <div style={{ width:11,height:11,borderRadius:3,background:c,flexShrink:0,border:filterStatut===l?`2px solid ${c}`:'none' }}/>
              <span style={{ fontWeight:filterStatut===l?700:400 }}>{l}</span>
            </div>
          ))}
          <div style={{ marginTop:7, borderTop:'1px solid var(--border)', paddingTop:7, fontSize:10, color:'var(--text-dim)' }}>
            {geojson?.features?.length||0} bâtiments
          </div>
        </div>
      </div>
    </div>
  )
}
