import React, { useEffect, useRef, useState } from 'react'
import { suiviConvois } from '../api'
import { trouverCoords } from '../data/coordsDestinations'

// Distance orthodromique (vol d'oiseau) en km entre deux points GPS [lat,lng].
function distanceKm(a, b) {
  const R = 6371
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

const STATUT_INFO = {
  en_route: { emoji: '🚌', label: 'En route', couleur: '#16a34a' },
  arret:    { emoji: '⏸️', label: 'À l\'arrêt', couleur: '#f59e0b' },
  arrive:   { emoji: '🏁', label: 'Arrivé', couleur: '#2563eb' },
}

/**
 * Position en direct du bus d'un voyage — « le bus se rapproche de Yamoussoukro ».
 * Interroge /api/suivi-convois/{rotation_id}/ (accessible au passager depuis
 * la correction de permission ci-contre) toutes les 20s tant que le convoi
 * est en route, et affiche la distance restante jusqu'à la destination
 * (ligne droite, à partir des coordonnées connues de l'app — cf. CarteItineraire).
 */
export default function SuiviBus({ rotationId, destination }) {
  const [suivi, setSuivi] = useState(null)
  const [erreur, setErreur] = useState(false)
  const arretParUtilisateur = useRef(false)

  useEffect(() => {
    if (!rotationId) return
    let annule = false
    const charger = async () => {
      try {
        const r = await suiviConvois.get(rotationId)
        if (!annule) { setSuivi(r.data?.suivi || null); setErreur(false) }
      } catch { if (!annule) setErreur(true) }
    }
    charger()
    const id = setInterval(() => { if (!arretParUtilisateur.current) charger() }, 20000)
    return () => { annule = true; arretParUtilisateur.current = true; clearInterval(id) }
  }, [rotationId])

  if (!rotationId || erreur || !suivi || !['en_route', 'arret'].includes(suivi.statut)) return null

  const info = STATUT_INFO[suivi.statut] || STATUT_INFO.en_route
  const posBus = (Number.isFinite(suivi.latitude) && Number.isFinite(suivi.longitude)) ? [suivi.latitude, suivi.longitude] : null
  const posDest = trouverCoords(destination)
  const km = posBus && posDest ? distanceKm(posBus, posDest) : null

  return (
    <div className="rzc-fade-in" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
      background: suivi.position_ancienne ? '#fff7ed' : '#f0fdf4',
      border: `1px solid ${suivi.position_ancienne ? '#fed7aa' : '#bbf7d0'}`,
      borderRadius: 10, padding:'6px 12px', fontSize:12 }}>
      {suivi.statut === 'en_route' && !suivi.position_ancienne && (
        <span style={{ width:6, height:6, borderRadius:'50%', background:info.couleur,
          display:'inline-block', animation:'rzcLivePulse 1.8s ease-in-out infinite' }}/>
      )}
      <span style={{ fontWeight:700, color:info.couleur }}>{info.emoji} {info.label}</span>
      {km !== null && (
        <span style={{ color:'#334155' }}>
          · ~{km < 10 ? km.toFixed(1) : Math.round(km)} km de {destination}
        </span>
      )}
      {suivi.vitesse_kmh != null && suivi.statut === 'en_route' && (
        <span style={{ color:'#64748b' }}>· {Math.round(suivi.vitesse_kmh)} km/h</span>
      )}
      {suivi.position_ancienne && (
        <span style={{ color:'#9a3412', fontWeight:600 }} title="Le téléphone du conducteur n'a pas renvoyé de position récente">
          ⚠️ position non actualisée
        </span>
      )}
    </div>
  )
}
