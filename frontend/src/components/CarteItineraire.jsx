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

// Fond de carte Esri World Street Map (gratuit, SANS clé API requise) à la
// place des tuiles OSM brutes. Deux essais precedents ont echoue : (1)
// tile.openstreetmap.org applique une politique d'usage stricte et renvoie
// une tuile "blocked" en cas de depassement ("access blocked" signale) ; (2)
// les tuiles CARTO (basemaps.cartocdn.com) exigent desormais une cle API
// (CARTO a ferme l'acces anonyme gratuit - tuiles affichant "API KEY
// REQUIRED" signale). Esri reste accessible sans cle pour ce niveau d'usage.
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
const TILE_ATTRIBUTION = 'Tiles &copy; Esri — Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors, GIS User Community'

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
    // Sans étapes saisies, le calculateur d'itinéraire choisit l'axe le plus court
    // Abidjan <-> Camp : il passe par Daloa, alors que les convois passent par
    // Yamoussoukro et Bouaké. On impose donc ces étapes pour les trajets depuis/vers le camp.
    const estCampNom = (n) => /camp|sango/i.test(n || '')
    const ca = trouverCoords(origine || 'Camp Roxgold Sango'), cb = trouverCoords(destination)
    if (ca && cb && estCampNom(origine || 'Camp Roxgold Sango') !== estCampNom(destination)) {
      const sud = estCampNom(origine || 'Camp Roxgold Sango') ? cb : ca
      if (sud[0] < 6.5) (estCampNom(origine || 'Camp Roxgold Sango') ? ['Bouaké', 'Yamoussoukro'] : ['Yamoussoukro', 'Bouaké']).forEach(ajouter)
    }
    ajouter(destination)
  }

  // Dédoublonne les points consécutifs identiques (ex: étape 1 finit là où étape 2 commence)
  const pointsUniques = points.filter((p, i) => i===0 || p.nom.toLowerCase() !== points[i-1].nom.toLowerCase())

  // BUG REEL CORRIGE ICI : quand des etapes sont fournies (route COMPLETE du
  // convoi, cf. _appliquer_itineraire_a_voyage cote backend qui les construit
  // a partir de l'itineraire du CONVOI et non de la montee/descente PROPRE
  // du passager), cet apercu ne tracait qu'UNE SEULE ligne fusionnant les
  // deux notions - exactement la confusion deja corrigee sur la carte du
  // billet imprimable (convoi vs passager vs reel), qui elle distingue bien
  // les deux. D'ou la divergence visible entre "aperçu" et "billet" - le
  // billet en montrait plus. Le passager (origine/destination props) est
  // maintenant trace en plus, distinctement, exactement comme sur le billet.
  const coordsOrigine = trouverCoords(origine || 'Camp Roxgold Sango')
  const coordsDestination = trouverCoords(destination)
  const aUnSegmentPassagerDistinct = etapes.length > 0 && coordsOrigine && coordsDestination

  const cleTrajet = pointsUniques.map(p => p.nom).join('|')
  const [tracé, setTracé] = useState(null) // null tant que non résolu ou indisponible -> ligne droite
  const [chargement, setChargement] = useState(false)
  const [tracéPassager, setTracéPassager] = useState(null)
  const [segmentsConvoi, setSegmentsConvoi] = useState(null) // tracé routier de chaque tronçon du convoi

  useEffect(() => {
    let annule = false
    setTracé(null); setSegmentsConvoi(null)
    if (pointsUniques.length < 2) return
    setChargement(true)
    ;(async () => {
      const segments = []
      for (let i = 0; i < pointsUniques.length - 1; i++) {
        const seg = await routeRoutiere(pointsUniques[i].coords, pointsUniques[i+1].coords)
        if (annule) return
        segments.push(seg || [pointsUniques[i].coords, pointsUniques[i+1].coords])
      }
      if (!annule) { setSegmentsConvoi(segments); setTracé(segments.flat()); setChargement(false) }
    })()
    return () => { annule = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleTrajet])

  // Le tracé du passager suit les MÊMES étapes que le convoi entre sa montée et sa
  // descente (ex: Abidjan → Yamoussoukro → Bouaké → Séguéla). Avant, on demandait
  // un itinéraire routier direct montée→descente : le calculateur choisissait un
  // autre axe (via Daloa) que celui réellement emprunté par le convoi.
  const memePoint = (a, b) => a && b && Math.abs(a[0]-b[0]) < 0.01 && Math.abs(a[1]-b[1]) < 0.01
  const iMontee = coordsOrigine ? pointsUniques.findIndex(p => memePoint(p.coords, coordsOrigine)) : -1
  const iDescente = coordsDestination ? pointsUniques.findIndex((p, i) => i > iMontee && memePoint(p.coords, coordsDestination)) : -1
  const suitLeConvoi = aUnSegmentPassagerDistinct && iMontee >= 0 && iDescente > iMontee

  useEffect(() => {
    let annule = false
    setTracéPassager(null)
    if (!aUnSegmentPassagerDistinct || suitLeConvoi) return
    ;(async () => {
      const seg = await routeRoutiere(coordsOrigine, coordsDestination)
      if (!annule) setTracéPassager(seg || [coordsOrigine, coordsDestination])
    })()
    return () => { annule = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aUnSegmentPassagerDistinct, suitLeConvoi, origine, destination])

  const segmentsValides = segmentsConvoi && segmentsConvoi.length === pointsUniques.length - 1
  const brutPassager = suitLeConvoi
    ? (segmentsValides ? segmentsConvoi.slice(iMontee, iDescente).flat() : pointsUniques.slice(iMontee, iDescente + 1).map(p => p.coords))
    : (tracéPassager || [coordsOrigine, coordsDestination])
  // Leaflet plante ("t is undefined") sur un point manquant ou une liste vide : on ne garde que les couples valides
  const positionsPassager = (brutPassager || []).filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))

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
        pathOptions={aUnSegmentPassagerDistinct
          ? {color:'#94a3b8', weight:3, dashArray:'6 6'}                          // convoi complet, en fond
          : (tracé ? {color:'#C9972B', weight:4} : {color:'#C9972B', weight:3, dashArray:'6 6'})}/>
      {aUnSegmentPassagerDistinct && positionsPassager.length >= 2 && (
        <Polyline key={`p-${positionsPassager.length}-${iMontee}-${iDescente}`} positions={positionsPassager}
          pathOptions={{color:'#1d4ed8', weight:5}}>
          <Popup>Trajet de ce passager (montée → descente)</Popup>
        </Polyline>
      )}
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
    {aUnSegmentPassagerDistinct && (
      <div style={{fontSize:10.5,color:'#64748b',padding:'6px 4px 0'}}>
        🟦 Trait bleu = trajet de ce passager (sa montée → sa descente) · Trait gris pointillé = trajet complet du convoi
      </div>
    )}
    </div>
  )
}
