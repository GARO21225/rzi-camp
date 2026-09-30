import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { trouverCoords } from '../data/coordsDestinations'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

// Fond de carte CARTO (gratuit, sans clé) à la place des tuiles OSM brutes —
// tile.openstreetmap.org applique une politique d'usage stricte (User-Agent/
// referrer, volumétrie) et renvoie une tuile "blocked" dès qu'elle est
// dépassée, ce qui affichait une carte illisible ("access blocked").
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

/** Trace un vrai itinéraire routier (OSRM, profil "driving") entre deux
 * points GPS. Retourne null si indisponible — l'appelant retombe alors sur
 * une ligne droite entre les deux points. */
async function routeRoutiere(depart, arrivee) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${depart[1]},${depart[0]};${arrivee[1]},${arrivee[0]}?overview=full&geometries=geojson`
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) })
    const d = await r.json()
    if (d.routes?.[0]?.geometry?.coordinates?.length > 1) {
      return d.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
    }
  } catch { /* pas de route dispo — ligne droite en repli */ }
  return null
}

/**
 * Carte régionale de l'itinéraire d'un voyage — origine, étapes
 * intermédiaires, destination, reliées par la route réelle (OSRM, comme sur
 * OpenStreetMap / Google Maps) quand disponible, sinon par une ligne droite
 * approximative en repli.
 */
export default function CarteItineraire({ origine, destination, etapes = [], trajetDiffereDuConvoi = null }) {
  // Construit la liste ordonnée des points : origine -> étapes -> destination
  const points = []
  const ajouter = (nom) => {
    const coords = trouverCoords(nom)
    if (coords) points.push({ nom, coords })
  }
  ajouter(origine || 'Camp Roxgold Sango')
  if (etapes.length > 0) {
    etapes.forEach(e => { ajouter(e.origine); ajouter(e.destination) })
  } else {
    ajouter(destination)
  }

  // Dédoublonne les points consécutifs identiques (ex: étape 1 finit là où étape 2 commence)
  const pointsUniques = points.filter((p, i) => i===0 || p.nom.toLowerCase() !== points[i-1].nom.toLowerCase())

  const cleTrajet = pointsUniques.map(p => p.nom).join('|')
  const [tracé, setTracé] = useState(null) // null tant que non résolu ou indisponible -> ligne droite
  const [chargement, setChargement] = useState(false)

  useEffect(() => {
    let annule = false
    setTracé(null)
    if (pointsUniques.length < 2) return
    setChargement(true)
    ;(async () => {
      const segments = []
      for (let i = 0; i < pointsUniques.length - 1; i++) {
        const seg = await routeRoutiere(pointsUniques[i].coords, pointsUniques[i+1].coords)
        if (annule) return
        segments.push(seg || [pointsUniques[i].coords, pointsUniques[i+1].coords])
      }
      if (!annule) { setTracé(segments.flat()); setChargement(false) }
    })()
    return () => { annule = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleTrajet])

  if (pointsUniques.length < 2) {
    return (
      <div style={{padding:30,textAlign:'center',color:'#94a3b8',fontSize:13}}>
        📍 Coordonnées non disponibles pour tracer cet itinéraire.
      </div>
    )
  }

  const lats = pointsUniques.map(p=>p.coords[0]), lngs = pointsUniques.map(p=>p.coords[1])
  const centre = [(Math.min(...lats)+Math.max(...lats))/2, (Math.min(...lngs)+Math.max(...lngs))/2]
  const etendue = Math.max(Math.max(...lats)-Math.min(...lats), Math.max(...lngs)-Math.min(...lngs))
  const zoom = etendue > 40 ? 2 : etendue > 15 ? 4 : etendue > 5 ? 6 : etendue > 1 ? 7 : 9

  return (
    <div style={{position:'relative'}}>
      {trajetDiffereDuConvoi && (
        <div style={{background:'#f5f3ff',border:'1px solid #c4b5fd',borderRadius:'10px 10px 0 0',
          padding:'8px 14px',fontSize:12.5,fontWeight:700,color:'#6d28d9',display:'flex',alignItems:'center',gap:8}}>
          🔀 Ce passager ne fait pas le trajet complet du convoi — {trajetDiffereDuConvoi}
        </div>
      )}
    <MapContainer center={centre} zoom={zoom} style={{height:320,width:'100%',
      borderRadius: trajetDiffereDuConvoi ? '0 0 10px 10px' : 10}} scrollWheelZoom={true}>
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL}/>
      <Polyline positions={tracé || pointsUniques.map(p=>p.coords)}
        pathOptions={tracé ? {color:'#C9972B', weight:4} : {color:'#C9972B', weight:3, dashArray:'6 6'}}/>
      {pointsUniques.map((p, i) => (
        <Marker key={i} position={p.coords}>
          <Popup>
            {i===0 ? '🏁 Départ' : i===pointsUniques.length-1 ? '🏁 Arrivée' : `Étape ${i}`} — {p.nom}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
    {chargement && (
      <div style={{position:'absolute',top:8,right:8,background:'#fff',borderRadius:8,padding:'4px 10px',
        fontSize:11,color:'#64748b',boxShadow:'0 1px 4px rgba(0,0,0,.15)'}}>🛣️ Calcul de l'itinéraire routier…</div>
    )}
    </div>
  )
}
