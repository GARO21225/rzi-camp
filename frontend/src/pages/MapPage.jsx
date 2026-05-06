import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Polyline, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { batiments } from '../api'

// Fix Leaflet icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' })

const TILES = [
  { id:'dark', label:'🌑 Sombre', url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { id:'light', label:'⬜ Gris clair', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { id:'osm', label:'🗺️ OSM', url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id:'topo', label:'🏔 Topo', url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
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

function NavigationLayer({ userPos, targetPos, targetName }) {
  const map = useMap()
  useEffect(() => {
    if (userPos && targetPos) {
      map.fitBounds([userPos, targetPos], { padding:[40,40] })
    }
  }, [userPos, targetPos])

  if (!userPos || !targetPos) return null

  const dist = L.latLng(userPos).distanceTo(L.latLng(targetPos))
  const distStr = dist > 1000 ? `${(dist/1000).toFixed(2)} km` : `${Math.round(dist)} m`

  return (
    <>
      <Marker position={userPos}>
        <Popup><b>📍 Ma position</b><br/>Distance vers {targetName}: <b>{distStr}</b></Popup>
      </Marker>
      <Marker position={targetPos}>
        <Popup><b>🏠 {targetName}</b><br/>Distance: <b>{distStr}</b></Popup>
      </Marker>
      <Polyline positions={[userPos, targetPos]} color="#f0a500" weight={3} dashArray="8,6"/>
    </>
  )
}

export default function MapPage() {
  const [geojson, setGeojson] = useState(null)
  const [filterStatut, setFilterStatut] = useState('')
  const [filterBloc, setFilterBloc] = useState('')
  const [filterResidence, setFilterResidence] = useState('')
  const [stats, setStats] = useState(null)
  const [geoKey, setGeoKey] = useState(0)
  const [tileId, setTileId] = useState('light')
  const [navMode, setNavMode] = useState(false)
  const [userPos, setUserPos] = useState(null)
  const [targetPos, setTargetPos] = useState(null)
  const [targetName, setTargetName] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)

  const tile = TILES.find(t=>t.id===tileId)||TILES[1]

  const load = useCallback(() => {
    const p = {}
    if (filterStatut) p.statut = filterStatut
    if (filterBloc) p.bloc = filterBloc
    if (filterResidence) p.residence = filterResidence
    batiments.geojson(p).then(r => { setGeojson(r.data); setGeoKey(k=>k+1) })
    batiments.stats().then(r => setStats(r.data))
  }, [filterStatut, filterBloc, filterResidence])

  useEffect(() => { load() }, [load])

  const getUserPos = () => {
    setGpsLoading(true)
    navigator.geolocation?.getCurrentPosition(
      pos => { setUserPos([pos.coords.latitude, pos.coords.longitude]); setGpsLoading(false) },
      () => { setUserPos([8.111, -6.822]); setGpsLoading(false) }
    )
  }

  const blocs = stats?.par_bloc?.map(b=>b.bloc)||[]
  const ps = stats?.par_statut||{}

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, height:'100%' }}>
      {/* TOOLBAR */}
      <div style={{ background:'#fff', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 12px', gap:8, flexShrink:0, flexWrap:'wrap', minHeight:48 }}>
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
        <input value={filterResidence} onChange={e=>setFilterResidence(e.target.value)} placeholder="🔍 Résidence..."
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 10px', borderRadius:6, fontSize:12, outline:'none', width:130 }}/>
        <button onClick={()=>{setFilterStatut('');setFilterBloc('');setFilterResidence('')}}
          style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer' }}>✕</button>

        {/* Tile switcher */}
        <div style={{ display:'flex', gap:4, marginLeft:8, padding:'2px', background:'var(--surface2)', borderRadius:8, border:'1px solid var(--border)' }}>
          {TILES.map(t=>(
            <button key={t.id} onClick={()=>setTileId(t.id)}
              style={{ padding:'4px 8px', borderRadius:6, border:'none', fontSize:11, cursor:'pointer',
                background:tileId===t.id?'var(--blue)':'transparent', color:tileId===t.id?'#fff':'var(--text-dim)', fontWeight:tileId===t.id?600:400, transition:'.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <button onClick={()=>{ setNavMode(!navMode); if(!navMode&&!userPos) getUserPos() }}
          style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${navMode?'var(--blue)':'var(--border)'}`,
            background:navMode?'var(--blue)':'var(--surface2)', color:navMode?'#fff':'var(--text-dim)',
            cursor:'pointer', fontSize:11, fontWeight:600 }}>
          {gpsLoading?'📡...' : navMode?'🧭 Nav ON':'🧭 Navigation'}
        </button>

        <div style={{ marginLeft:'auto', display:'flex', gap:10, fontSize:11, fontFamily:'monospace' }}>
          {[['Libre','#16a34a',ps['Libre']||0],['Occupé','#dc2626',ps['Occupé']||0],['Réservé','#2563eb',ps['Réservé']||0],['Maint.','#ea580c',ps['Maintenance']||0]].map(([l,c,v])=>(
            <span key={l} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', color:'var(--text-dim)' }}
              onClick={()=>setFilterStatut(filterStatut===l||filterStatut==='Maintenance'&&l==='Maint.'?'':l==='Maint.'?'Maintenance':l)}>
              <span style={{ width:8,height:8,borderRadius:'50%',background:c,display:'inline-block' }}/>
              {v} {l}
            </span>
          ))}
        </div>
      </div>

      {/* MAP */}
      <div style={{ flex:1, position:'relative' }}>
        <MapContainer center={[8.111,-6.822]} zoom={17} style={{ height:'100%',width:'100%' }}>
          <TileLayer key={tileId} url={tile.url}/>
          {geojson && (
            <>
              <FitBounds geojson={geojson}/>
              <GeoJSON key={geoKey} data={geojson}
                style={f=>({ color:statusColor(f.properties.statut), weight:1.5, fillColor:statusColor(f.properties.statut), fillOpacity:.5 })}
                onEachFeature={(f,layer)=>{
                  const p = f.properties
                  layer.on('click', ()=>{
                    if (navMode && p.latitude && p.longitude) {
                      setTargetPos([p.latitude, p.longitude])
                      setTargetName(`Résidence ${p.residence}`)
                      if (!userPos) getUserPos()
                    }
                  })
                  layer.bindPopup(`
                    <div style="font-family:sans-serif;min-width:200px">
                      <b style="color:#1e3a8a;font-size:14px">🏠 Résidence ${p.residence}</b><br/>
                      <div style="font-size:12px;line-height:1.8;margin-top:6px">
                        <b>Bloc :</b> ${p.bloc}<br/>
                        <b>Statut :</b> <span style="color:${statusColor(p.statut)};font-weight:700">${p.statut}</span><br/>
                        ${p.occupant?'<b>Occupant :</b> '+p.occupant+'<br/>':''}
                        ${p.societe?'<b>Société :</b> '+p.societe+'<br/>':''}
                      </div>
                      ${navMode&&p.latitude?`<div style="margin-top:8px;font-size:11px;color:#2563eb;font-style:italic">📍 Cliquer sur le bâtiment pour naviguer</div>`:''}
                    </div>
                  `, {maxWidth:260})
                  layer.on('mouseover',function(){this.setStyle({fillOpacity:.8,weight:2.5})})
                  layer.on('mouseout',function(){this.setStyle({fillOpacity:.5,weight:1.5})})
                }}
              />
            </>
          )}
          {navMode && <NavigationLayer userPos={userPos} targetPos={targetPos} targetName={targetName}/>}
        </MapContainer>

        {/* Nav info */}
        {navMode && (
          <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)',
            background:'rgba(30,58,138,.95)', color:'#fff', borderRadius:10, padding:'10px 18px',
            zIndex:900, fontSize:12, textAlign:'center', backdropFilter:'blur(8px)' }}>
            <b>🧭 Mode Navigation actif</b><br/>
            {!userPos ? '📡 Acquisition GPS...' : targetPos ? `Vers: ${targetName}` : '👆 Cliquer sur une résidence'}
          </div>
        )}

        {/* Légende */}
        <div style={{ position:'absolute', bottom:20, right:10, background:'rgba(255,255,255,.95)',
          border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', zIndex:900, fontSize:12, boxShadow:'var(--shadow)' }}>
          <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-dim)', letterSpacing:2, marginBottom:8 }}>LÉGENDE</div>
          {[['Libre','#16a34a'],['Occupé','#dc2626'],['Réservé','#2563eb'],['Maintenance','#ea580c']].map(([l,c])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:8, margin:'4px 0' }}>
              <div style={{ width:12,height:12,borderRadius:3,background:c,flexShrink:0 }}/>
              <span>{l}</span>
            </div>
          ))}
          <div style={{ marginTop:8, borderTop:'1px solid var(--border)', paddingTop:8, fontSize:10, color:'var(--text-dim)' }}>
            {geojson?.features?.length||0} bâtiments
          </div>
        </div>
      </div>
    </div>
  )
}
