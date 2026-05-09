
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Polyline, Popup, Circle, useMapEvents } from 'react-leaflet'
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
  { id:'light', label:'☀️ Clair', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { id:'dark', label:'🌑 Sombre', url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { id:'osm', label:'🗺️ OSM', url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id:'sat', label:'🛰️ Satellite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
]

const sColor = s => ({ Libre:'#16a34a', 'Occupé':'#dc2626', 'Réservé':'#2563eb', Maintenance:'#ea580c' }[s]||'#888')

function calcDist(a,b){return L.latLng(a).distanceTo(L.latLng(b))}
function distStr(d){return d>1000?`${(d/1000).toFixed(2)} km`:`${Math.round(d)} m`}
function calcBearing(p1,p2){
  const [la1,lo1]=[p1[0]*Math.PI/180,p1[1]*Math.PI/180]
  const [la2,lo2]=[p2[0]*Math.PI/180,p2[1]*Math.PI/180]
  const y=Math.sin(lo2-lo1)*Math.cos(la2)
  const x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(lo2-lo1)
  const b=(Math.atan2(y,x)*180/Math.PI+360)%360
  return ['Nord','Nord-Est','Est','Sud-Est','Sud','Sud-Ouest','Ouest','Nord-Ouest'][Math.round(b/45)%8]
}

function FitBounds({geojson}){
  const map=useMap()
  useEffect(()=>{if(geojson?.features?.length)try{map.fitBounds(L.geoJSON(geojson).getBounds(),{padding:[20,20]})}catch(e){}}, [geojson])
  return null
}

function NavLayer({userPos, route, target, targetName}){
  const map=useMap()
  useEffect(()=>{
    if(userPos&&target){
      map.fitBounds(L.latLngBounds([userPos,target]),{padding:[60,60]})
    }
  },[target])

  if(!userPos||!target) return null
  const d=calcDist(userPos,target), bear=calcBearing(userPos,target)

  const meIcon=L.divIcon({
    html:`<div style="width:18px;height:18px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.4)"></div>`,
    className:'',iconSize:[18,18],iconAnchor:[9,9]
  })
  const destIcon=L.divIcon({
    html:`<div style="background:#dc2626;color:#fff;border-radius:10px 10px 10px 2px;padding:4px 8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)">🏠 ${targetName}</div>`,
    className:'',iconAnchor:[0,28]
  })

  return (
    <>
      <Marker position={userPos} icon={meIcon}><Popup><b>📍 Vous êtes ici</b><br/><span style={{fontSize:'12px'}}>→ {targetName}<br/>📏 {distStr(d)} · 🧭 {bear}</span></Popup></Marker>
      <Marker position={target} icon={destIcon}><Popup>
        <b style={{color:'#dc2626'}}>🏠 {targetName}</b><br/>
        <span style={{fontSize:'12px'}}>📏 {distStr(d)}<br/>🧭 Direction {bear}</span><br/>
        <a href={`https://www.google.com/maps/dir/?api=1&origin=${userPos[0]},${userPos[1]}&destination=${target[0]},${target[1]}`}
          target="_blank" rel="noreferrer"
          style={{display:'inline-block',marginTop:6,background:'#4285f4',color:'#fff',padding:'5px 12px',borderRadius:6,textDecoration:'none',fontSize:12,fontWeight:600}}>
          📍 Ouvrir dans Google Maps
        </a>
      </Popup></Marker>
      {/* Route line with animated appearance */}
      <Polyline positions={route||[userPos,target]} color="#f0a500" weight={5} dashArray="14,8" opacity={0.9}/>
      {/* Animated direction indicator at midpoint */}
      {route&&route.map((pt,i)=>i>0&&i%3===0&&<Circle key={i} center={pt} radius={4} color="#f0a500" fillOpacity={0.5}/>)}
      <Circle center={userPos} radius={20} color="#2563eb" fillOpacity={0.15} weight={2}/>
    </>
  )
}

export default function MapPage() {
  const [geojson,setGeojson]=useState(null)
  const [geoKey,setGeoKey]=useState(0)
  const [stats,setStats]=useState(null)
  const [filterStatut,setFilterStatut]=useState('')
  const [filterBloc,setFilterBloc]=useState('')
  const [filterRes,setFilterRes]=useState('')
  const [tileId,setTileId]=useState('light')
  const [navMode,setNavMode]=useState(false)
  const [userPos,setUserPos]=useState(null)
  const [target,setTarget]=useState(null)
  const [targetName,setTargetName]=useState('')
  const [route,setRoute]=useState(null)
  const [gpsLoading,setGpsLoading]=useState(false)
  const [gpsErr,setGpsErr]=useState('')
  const [routeLoading,setRouteLoading]=useState(false)
  const watchId=useRef(null)

  const tile=TILES.find(t=>t.id===tileId)||TILES[0]

  const load=useCallback(()=>{
    const p={}
    if(filterStatut)p.statut=filterStatut
    if(filterBloc)p.bloc=filterBloc
    if(filterRes)p.residence=filterRes
    batiments.geojson(p).then(r=>{setGeojson(r.data);setGeoKey(k=>k+1)})
    batiments.stats().then(r=>setStats(r.data))
  },[filterStatut,filterBloc,filterRes])

  useEffect(()=>{load()},[load])

  const startGPS=()=>{
    setGpsLoading(true);setGpsErr('')
    if(!navigator.geolocation){setGpsErr('GPS non disponible');setGpsLoading(false);setUserPos([8.111,-6.822]);return}
    watchId.current=navigator.geolocation.watchPosition(
      p=>{setUserPos([p.coords.latitude,p.coords.longitude]);setGpsLoading(false)},
      e=>{setGpsErr('GPS indisponible, position approx. du camp');setUserPos([8.111,-6.822]);setGpsLoading(false)},
      {enableHighAccuracy:true,maximumAge:3000,timeout:8000}
    )
  }

  const getRoute=async(from,to)=>{
    setRouteLoading(true)
    try{
      // Try OSRM public API for real routing
      const url=`https://router.project-osrm.org/route/v1/foot/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
      const r=await fetch(url,{signal:AbortSignal.timeout(5000)})
      const d=await r.json()
      if(d.routes?.[0]?.geometry?.coordinates){
        const pts=d.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])
        setRoute(pts)
      } else setRoute(null)
    }catch{
      setRoute(null) // fallback: straight line
    }finally{setRouteLoading(false)}
  }

  const handleNav=(lat,lng,name)=>{
    if(!navMode)return
    setTarget([lat,lng]);setTargetName(name)
    if(userPos)getRoute(userPos,[lat,lng])
  }

  const toggleNav=()=>{
    if(navMode){
      setNavMode(false);setTarget(null);setTargetName('');setRoute(null)
      if(watchId.current){navigator.geolocation?.clearWatch(watchId.current);watchId.current=null}
    }else{
      setNavMode(true);startGPS()
    }
  }

  const ps=stats?.par_statut||{}
  const dist=userPos&&target?calcDist(userPos,target):null
  const bear=userPos&&target?calcBearing(userPos,target):null

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,height:'100%',minHeight:0}}>
      {/* TOOLBAR */}
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 10px',gap:6,flexShrink:0,flexWrap:'wrap',minHeight:46,zIndex:10}}>
        <select value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}
          style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'4px 8px',borderRadius:6,fontSize:11,outline:'none'}}>
          <option value="">Tous statuts</option>
          {['Libre','Occupé','Réservé','Maintenance'].map(s=><option key={s}>{s}</option>)}
        </select>
        <input value={filterRes} onChange={e=>setFilterRes(e.target.value)} placeholder="🔍 Résidence..."
          style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',padding:'4px 8px',borderRadius:6,fontSize:11,outline:'none',width:110}}/>
        <button onClick={()=>{setFilterStatut('');setFilterRes('')}}
          style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text-dim)',padding:'4px 8px',borderRadius:6,fontSize:11,cursor:'pointer'}}>✕</button>

        {/* Tile buttons */}
        <div style={{display:'flex',gap:2,background:'var(--surface2)',borderRadius:7,padding:2,border:'1px solid var(--border)'}}>
          {TILES.map(t=>(
            <button key={t.id} onClick={()=>setTileId(t.id)}
              style={{padding:'3px 7px',borderRadius:5,border:'none',fontSize:10,cursor:'pointer',transition:'.15s',
                background:tileId===t.id?'var(--blue)':'transparent',color:tileId===t.id?'#fff':'var(--text-dim)'}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* NAV button */}
        <button onClick={toggleNav}
          style={{padding:'5px 12px',borderRadius:8,border:`2px solid ${navMode?'#f0a500':'var(--border)'}`,
            background:navMode?'rgba(240,165,0,.15)':'var(--surface2)',
            color:navMode?'#d08800':'var(--text-dim)',cursor:'pointer',fontSize:11,fontWeight:700,transition:'.2s'}}>
          {gpsLoading?'📡 GPS...' : navMode?'🧭 NAV ON':'🧭 Navigation'}
        </button>

        <div style={{marginLeft:'auto',display:'flex',gap:8,fontSize:10,fontFamily:'monospace'}}>
          {[['Libre','#16a34a'],['Occupé','#dc2626'],['Réservé','#2563eb']].map(([l,c])=>(
            <span key={l} style={{display:'flex',alignItems:'center',gap:3,color:'var(--text-dim)',cursor:'pointer'}}
              onClick={()=>setFilterStatut(filterStatut===l?'':l)}>
              <span style={{width:7,height:7,borderRadius:'50%',background:c,display:'inline-block'}}/>
              {ps[l]||0}
            </span>
          ))}
        </div>
      </div>

      {/* NAV INFO BAR */}
      {navMode&&(
        <div style={{background:'linear-gradient(90deg,rgba(240,165,0,.1),rgba(240,165,0,.05))',borderBottom:'1px solid rgba(240,165,0,.25)',padding:'6px 14px',display:'flex',alignItems:'center',gap:12,fontSize:12,flexShrink:0,flexWrap:'wrap'}}>
          <span style={{color:'#d08800',fontWeight:700,flexShrink:0}}>🧭 Mode Navigation</span>
          {gpsErr&&<span style={{color:'#dc2626',fontSize:11}}>⚠️ {gpsErr}</span>}
          {!target&&!gpsLoading&&<span style={{color:'var(--text-dim)'}}>👆 Cliquez sur une résidence pour l'itinéraire</span>}
          {target&&(
            <>
              <span style={{fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>→ {targetName}</span>
              {dist&&<span style={{background:'rgba(240,165,0,.2)',padding:'2px 10px',borderRadius:20,color:'#d08800',fontWeight:700,flexShrink:0}}>📏 {distStr(dist)}</span>}
              {bear&&<span style={{background:'rgba(37,99,235,.1)',padding:'2px 10px',borderRadius:20,color:'#2563eb',fontWeight:700,flexShrink:0}}>🧭 {bear}</span>}
              {routeLoading&&<span style={{color:'var(--text-dim)',fontSize:11}}>Calcul itinéraire...</span>}
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${target[0]},${target[1]}`}
                target="_blank" rel="noreferrer"
                style={{background:'#4285f4',color:'#fff',padding:'3px 12px',borderRadius:20,textDecoration:'none',fontSize:11,fontWeight:700,flexShrink:0}}>
                Google Maps
              </a>
              <button onClick={()=>{setTarget(null);setTargetName('');setRoute(null)}}
                style={{background:'none',border:'1px solid var(--border)',color:'var(--text-dim)',padding:'2px 8px',borderRadius:6,cursor:'pointer',fontSize:10,flexShrink:0}}>
                ✕ Effacer
              </button>
            </>
          )}
        </div>
      )}

      {/* MAP */}
      <div style={{flex:1,position:'relative',minHeight:0}}>
        <MapContainer center={[8.111,-6.822]} zoom={17}
          style={{position:'absolute',top:0,left:0,right:0,bottom:0}}>
          <TileLayer key={tileId} url={tile.url} attribution=""/>
          {geojson&&(
            <>
              <FitBounds geojson={geojson}/>
              <GeoJSON key={geoKey} data={geojson}
                style={f=>({color:sColor(f.properties.statut),weight:1.5,fillColor:sColor(f.properties.statut),fillOpacity:.45})}
                onEachFeature={(f,layer)=>{
                  const p=f.properties
                  layer.bindPopup(`
                    <div style="font-family:sans-serif;min-width:200px">
                      <div style="font-weight:700;color:#1e3a8a;font-size:14px;margin-bottom:8px">🏠 Résidence ${p.residence}</div>
                      <div style="font-size:12px;line-height:1.9">
                        <span style="color:#64748b">Bloc :</span> <b>${p.bloc}</b><br/>
                        <span style="color:#64748b">Statut :</span> <b style="color:${sColor(p.statut)}">${p.statut}</b><br/>
                        ${p.occupant?`<span style="color:#64748b">Occupant :</span> <b>${p.occupant}</b><br/>`:''}
                      </div>
                      <button onclick="window.dispatchEvent(new CustomEvent('nav-request',{detail:{lat:${p.latitude},lng:${p.longitude},name:'${p.residence}'}}))"
                        style="margin-top:8px;width:100%;background:#f0a500;color:#000;border:none;padding:6px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700">
                        🧭 Naviguer ici
                      </button>
                    </div>
                  `,{maxWidth:240})
                  layer.on('mouseover',function(){this.setStyle({fillOpacity:.75,weight:2.5})})
                  layer.on('mouseout',function(){this.setStyle({fillOpacity:.45,weight:1.5})})
                  layer.on('click',()=>{
                    if(navMode&&p.latitude&&p.longitude) handleNav(p.latitude,p.longitude,`Résidence ${p.residence}`)
                  })
                }}
              />
            </>
          )}
          <NavLayer userPos={userPos} route={route} target={target} targetName={targetName}/>
        </MapContainer>

        {/* Légende */}
        <div style={{position:'absolute',bottom:20,right:10,background:'rgba(255,255,255,.97)',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px',zIndex:900,fontSize:12,boxShadow:'var(--shadow-md)'}}>
          <div style={{fontFamily:'monospace',fontSize:9,color:'var(--text-dim)',letterSpacing:2,marginBottom:8,textTransform:'uppercase'}}>Légende</div>
          {[['Libre','#16a34a'],['Occupé','#dc2626'],['Réservé','#2563eb'],['Maintenance','#ea580c']].map(([l,c])=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:8,margin:'4px 0',cursor:'pointer'}}
              onClick={()=>setFilterStatut(filterStatut===l?'':l)}>
              <div style={{width:12,height:12,borderRadius:3,background:c,flexShrink:0,opacity:filterStatut&&filterStatut!==l?.4:1}}/>
              <span style={{fontWeight:filterStatut===l?700:400}}>{l} ({ps[l]||0})</span>
            </div>
          ))}
          <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)',fontSize:10,color:'var(--text-dim)'}}>{geojson?.features?.length||0} bâtiments</div>
        </div>
      </div>
    </div>
  )
}
