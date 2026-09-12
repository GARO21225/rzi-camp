import React from 'react'
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

/**
 * Carte régionale de l'itinéraire d'un voyage — origine, étapes
 * intermédiaires, destination, reliés par une ligne. Coordonnées
 * approximatives (aperçu du trajet, pas un routage routier précis).
 */
export default function CarteItineraire({ origine, destination, etapes = [] }) {
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
    <MapContainer center={centre} zoom={zoom} style={{height:320,width:'100%',borderRadius:10}} scrollWheelZoom={true}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      <Polyline positions={pointsUniques.map(p=>p.coords)} pathOptions={{color:'#C9972B', weight:3, dashArray:'6 6'}}/>
      {pointsUniques.map((p, i) => (
        <Marker key={i} position={p.coords}>
          <Popup>
            {i===0 ? '🏁 Départ' : i===pointsUniques.length-1 ? '🏁 Arrivée' : `Étape ${i}`} — {p.nom}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
