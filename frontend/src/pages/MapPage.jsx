
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
  { id:'osm',   label:'🗺️ OSM',      url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { id:'light', label:'☀️ Clair',     url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { id:'dark',  label:'🌑 Sombre',    url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
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
  const [showImport,  setShowImport]  = useState(false)
  const [editBat,     setEditBat]     = useState(null)
  const [importLayer, setImportLayer] = useState('residence')
  const [importMsg,   setImportMsg]   = useState(null)
  const [filterBloc,setFilterBloc]=useState('')
  const [filterRes,setFilterRes]=useState('')
  const [tileId,setTileId]=useState('osm')
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

  // Handlers globaux pour les popups Leaflet (Leaflet crée des innerHTML)
  // Restaurer les imports GIS sauvegardés
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('rzi_gis_imports') || '[]')
      if (stored.length > 0) {
        const allFeatures = stored.flatMap(s => s.features || [])
        if (allFeatures.length > 0) {
          setGeojson(prev => ({
            type: 'FeatureCollection',
            features: [...(prev?.features||[]), ...allFeatures]
          }))
          setGeoKey(k => k+1)
        }
      }
    } catch(e) {}
  }, [])

  useEffect(() => {
    const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
    const token = localStorage.getItem('access_token') || ''
    window._mapEdit = (id, residence, statut) => setEditBat({id, residence, statut})
    window._mapDelete = async (id, residence) => {
      if (!window.confirm('Supprimer ' + residence + ' ?')) return
      await fetch(`${BASE}/api/batiments/${id}/`, {
        method:'DELETE', headers:{'Authorization':`Bearer ${token}`}
      }).catch(()=>{})
      window.location.reload()
    }
    return () => { delete window._mapEdit; delete window._mapDelete }
  }, [])

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
    <div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - 54px)',overflow:'hidden',position:'relative'}}>
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
      <div style={{flex:1,position:'relative',minHeight:0,overflow:'hidden'}}>
        {/* Bouton Import GIS */}
      <button onClick={()=>{
        // Export des données de la carte en GeoJSON
        const data = JSON.stringify(geojson || {type:'FeatureCollection',features:[]}, null, 2)
        const blob = new Blob([data], {type:'application/json'})
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rzi_camp_gis_${new Date().toISOString().slice(0,10)}.geojson`
        a.click()
        URL.revokeObjectURL(url)
      }} title="Exporter les données GIS"
        style={{
          position:'absolute', top:10, right:160, zIndex:1000,
          background:'#fff', border:'none', borderRadius:8,
          padding:'8px 14px', cursor:'pointer', fontSize:12, fontWeight:700,
          color:'#16a34a', boxShadow:'0 2px 8px rgba(0,0,0,.15)',
          display:'flex', alignItems:'center', gap:6
        }}>
        📤 Extraire
      </button>

      <button onClick={()=>setShowImport(true)}
        style={{position:'absolute',top:54,right:12,zIndex:500,background:'#1e3a8a',color:'#fff',
          border:'none',padding:'8px 14px',borderRadius:10,cursor:'pointer',fontSize:12,
          fontWeight:700,boxShadow:'0 2px 8px rgba(0,0,0,.2)',display:'flex',alignItems:'center',gap:6}}>
        📥 Importer données
      </button>

      <MapContainer center={[8.111,-6.822]} zoom={17}
          style={{width:'100%',height:'100%',zIndex:0}}>
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

      {/* Modal Import GIS */}
      {showImport && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}
          onClick={e=>e.target===e.currentTarget&&setShowImport(false)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:520,padding:24,boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div>
                <div style={{fontSize:18,fontWeight:800,color:'#1e3a8a'}}>📥 Importer des données GIS</div>
                <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
                  {(() => { try { return JSON.parse(localStorage.getItem('rzi_gis_imports')||'[]').reduce((s,i)=>s+(i.features?.length||0),0) } catch(e){return 0} })()} entité(s) en mémoire
                </div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <button onClick={()=>{
                  if(confirm('Effacer tous les imports GIS sauvegardés?')) {
                    localStorage.removeItem('rzi_gis_imports')
                    setGeojson(null)
                    setGeoKey(k=>k+1)
                    setShowImport(false)
                  }
                }} style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',borderRadius:8,padding:'6px 10px',cursor:'pointer',fontSize:11,fontWeight:700}}>
                  🗑️ Vider
                </button>
                <button onClick={()=>setShowImport(false)} style={{background:'#f1f5f9',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:18}}>✕</button>
              </div>
            </div>
            {importMsg && (
              <div style={{background:importMsg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${importMsg.ok?'#bbf7d0':'#fecaca'}`,
                borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:13,color:importMsg.ok?'#16a34a':'#dc2626'}}>
                {importMsg.text}
              </div>
            )}
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6}}>TYPE DE COUCHE</label>
              <select value={importLayer} onChange={e=>setImportLayer(e.target.value)}
                style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:13,outline:'none'}}>
                <option value="residence">🏠 Résidences / Bâtiments</option>
                <option value="electrique">⚡ Réseau électrique</option>
                <option value="eau_potable">💧 Eau potable</option>
                <option value="eau_usee">🚿 Eau usée</option>
                <option value="fibre">🔌 Fibre optique</option>
                <option value="genie_civil">🏗️ Génie civil</option>
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:6}}>FICHIER (GeoJSON ou CSV)</label>
              <input type="file" accept=".geojson,.json,.csv"
                style={{width:'100%',border:'2px dashed #e2e8f0',borderRadius:9,padding:'16px',fontSize:13,cursor:'pointer'}}
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImportMsg({ok:false,text:`⏳ Lecture de ${file.name}...`})
                  try {
                    const text = await file.text()
                    let data
                    if (file.name.endsWith('.csv')) {
                      const lines = text.split('\n').filter(l=>l.trim())
                      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase())
                      const features = lines.slice(1).map(line => {
                        const vals = line.split(',')
                        const props = {}
                        headers.forEach((h,i) => { props[h] = vals[i]?.trim() })
                        const lat = parseFloat(props.lat||props.latitude||0)
                        const lng = parseFloat(props.lng||props.longitude||props.lon||0)
                        return { type:'Feature', geometry:{type:'Point',coordinates:[lng,lat]}, properties:{...props,layer:importLayer} }
                      }).filter(f=>f.geometry.coordinates[0]&&f.geometry.coordinates[1])
                      data = { type:'FeatureCollection', features }
                    } else {
                      data = JSON.parse(text)
                    }
                    const count = data.features?.length || 0

                    // Afficher immédiatement sur la carte
                    setGeojson(prev => {
                      const existing = prev?.features || []
                      // Ajouter la couche aux features existantes
                      const newFeatures = data.features.map(f => ({
                        ...f,
                        properties: { ...f.properties, layer: importLayer, imported: true }
                      }))
                      const merged = {
                        type: 'FeatureCollection',
                        features: [...existing, ...newFeatures]
                      }
                      // Persister dans localStorage
                      try {
                        const stored = JSON.parse(localStorage.getItem('rzi_gis_imports') || '[]')
                        stored.push({ layer:importLayer, features:newFeatures, date:new Date().toISOString() })
                        localStorage.setItem('rzi_gis_imports', JSON.stringify(stored.slice(-20)))
                      } catch(e) {}
                      return merged
                    })
                    setGeoKey(k => k+1)

                    setImportMsg({ok:true,text:`✅ ${count} entité(s) affichées sur la carte — Couche: ${importLayer}`})
                    const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
                    const token = localStorage.getItem('access_token') || ''
                    fetch(`${BASE}/api/gis/import/`, {
                      method:'POST',
                      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
                      body: JSON.stringify({layer:importLayer, geojson:data})
                    }).catch(()=>{})
                  } catch(err) {
                    setImportMsg({ok:false,text:`❌ Erreur: ${err.message}`})
                  }
                }}/>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:6}}>Formats acceptés: GeoJSON (.geojson, .json) et CSV avec colonnes lat/lon</div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>{setShowImport(false);setImportMsg(null)}}
                style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13}}>
                Fermer
              </button>
              <a href="data:text/csv;charset=utf-8,nom,latitude,longitude,type%0AResidence B1,6.3702,-5.2012,residence"
                download="template_gis.csv"
                style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer',fontSize:13,fontWeight:700,textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>
                📋 Template CSV
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition bâtiment */}
      {editBat && (
        <div onClick={e=>e.target===e.currentTarget&&setEditBat(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000,padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:16,color:'#1e3a8a'}}>✏️ {editBat.residence}</div>
            <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:4}}>STATUT</label>
            <select id="edit-bat-statut" defaultValue={editBat.statut}
              style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:13,marginBottom:16}}>
              {['Libre','Occupé','Réservé','Maintenance'].map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setEditBat(null)}
                style={{background:'#f1f5f9',border:'none',borderRadius:9,padding:'10px 20px',cursor:'pointer'}}>Annuler</button>
              <button onClick={async()=>{
                const BASE=import.meta?.env?.VITE_API_URL||'https://rzi-camp-backend.onrender.com'
                const token=localStorage.getItem('access_token')||''
                const statut=document.getElementById('edit-bat-statut')?.value
                await fetch(`${BASE}/api/batiments/${editBat.id}/`,{
                  method:'PATCH',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
                  body:JSON.stringify({statut})
                }).catch(()=>{})
                setEditBat(null)
                window.location.reload()
              }} style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
                padding:'10px 20px',cursor:'pointer',fontWeight:700}}>💾 Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
