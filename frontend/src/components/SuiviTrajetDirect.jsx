import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { suiviConvois } from '../api'
import { trouverCoords } from '../data/coordsDestinations'
import MapSafe, { trajetValide } from './MapSafe'
import { TILE_URL, TILE_ATTRIBUTION, CENTRE_DEFAUT, iconeVehicule, heure } from './CarteConvoisDirect'
import {
  situerBus, kmRestants, vitesseEstimee, longueurTrace, heureArrivee, dureeLisible, memeLieu,
} from '../utils/trajetDirect'

// Suivi « façon Uber » pour le PASSAGER : où est mon bus, ce qui reste
// jusqu'à ma descente (ou jusqu'à ma montée s'il doit encore me ramasser),
// heure d'arrivée estimée, et la liste des arrêts avec ceux déjà passés.
// Données : /api/suivi-convois/{rotation_id}/ (accessible au passager),
// actualisées toutes les 15 s tant que le panneau est ouvert.

const OR = '#D4A017', BLEU = '#2563EB', VERT = '#16A34A', ENCRE = '#0F1A2E', GRIS = '#5B6472'

function Cadrer({ points }) {
  const map = useMap()
  const fait = useRef(false)
  useEffect(() => {
    if (fait.current || points.length === 0) return
    fait.current = true
    if (points.length === 1) map.setView(points[0], 11)
    else map.fitBounds(points, { padding: [28, 28] })
  }, [map, points])
  return null
}

export default function SuiviTrajetDirect({ voyage, onClose }) {
  const [data, setData] = useState(null)
  const [erreur, setErreur] = useState(false)
  const [maj, setMaj] = useState(null)

  useEffect(() => {
    let fini = false
    const charger = () => suiviConvois.get(voyage.rotation_id)
      .then(r => { if (!fini) { setData(r.data); setErreur(false); setMaj(new Date()) } })
      .catch(() => { if (!fini) setErreur(true) })
    charger()
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') charger() }, 15000)
    return () => { fini = true; clearInterval(id) }
  }, [voyage.rotation_id])

  const s = data?.suivi
  const feuille = data?.feuille_de_route || []
  const arrets = useMemo(() => feuille.map(a => ({ ...a, coords: trouverCoords(a.ville) })), [feuille])
  const iMontee = Math.max(0, arrets.findIndex(a => memeLieu(a.ville, voyage.origine)))
  const iDescenteBrut = arrets.findIndex((a, i) => i > iMontee && memeLieu(a.ville, voyage.destination))
  const iDescente = iDescenteBrut >= 0 ? iDescenteBrut : arrets.length - 1
  const bus = s && Number.isFinite(s.latitude) && Number.isFinite(s.longitude) ? [s.latitude, s.longitude] : null
  const enCours = s && ['en_route', 'arret'].includes(s.statut)
  const pos = enCours ? situerBus(bus, arrets) : null
  const passes = new Set(s?.statut === 'arrive' ? arrets.map((_, i) => i) : (pos?.passes || (s ? [0] : [])))
  const monteFait = (arrets[iMontee]?.montent || []).some(p => p.voyage_id === voyage.id && p.fait)
  const attendMontee = enCours && iMontee > 0 && !monteFait && !passes.has(iMontee)
  const cible = attendMontee ? iMontee : iDescente

  const trace = trajetValide(s?.trace || [])
  const dureeH = s?.depart_at ? (Date.now() - new Date(s.depart_at).getTime()) / 3600000 : 0
  const vitesse = vitesseEstimee({ distanceParcourueKm: longueurTrace(trace), dureeH, vitesseInstantanee: s?.vitesse_kmh })
  const km = enCours ? kmRestants(bus, arrets, cible) : null
  const minutes = km != null ? (km / vitesse) * 60 + (s?.statut === 'arret' ? 10 : 0) : null

  const route = arrets.filter(a => a.coords).map(a => a.coords)
  const monTrajet = arrets.slice(iMontee, iDescente + 1).filter(a => a.coords).map(a => a.coords)
  const pointsCadre = [...route, ...(bus ? [bus] : [])]

  let titre, sousTitre
  if (!data && !erreur) titre = 'Chargement…'
  else if (erreur && !data) titre = 'Suivi indisponible'
  else if (!s) {
    titre = 'Le convoi n\'est pas encore parti'
    sousTitre = `Départ prévu le ${new Date(data.date_depart).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${data.heure_depart ? ` à ${data.heure_depart}` : ''}${data.point_rdv ? ` · RDV ${data.point_rdv}` : ''}`
  } else if (s.statut === 'arrive') {
    titre = '🏁 Convoi arrivé'
    sousTitre = s.arrivee_at ? `Arrivé à ${heure(s.arrivee_at)}` : ''
  } else if (km === 0 && !attendMontee) {
    titre = `Vous êtes arrivé à ${arrets[iDescente]?.ville || 'destination'}`
  } else {
    const h = heureArrivee(minutes)
    titre = attendMontee
      ? (h ? `Le bus arrive à ${arrets[iMontee]?.ville} vers ${h}` : `Le bus vient vous chercher à ${arrets[iMontee]?.ville}`)
      : (h ? `Arrivée estimée vers ${h}` : 'En route')
    sousTitre = [dureeLisible(minutes) && `dans ${dureeLisible(minutes)}`, km != null && `≈ ${km < 10 ? km.toFixed(1) : Math.round(km)} km`,
      s.statut === 'arret' ? '⏸️ bus à l\'arrêt' : (s.vitesse_kmh != null ? `${Math.round(s.vitesse_kmh)} km/h` : null)]
      .filter(Boolean).join(' · ')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: '#06142E', display: 'flex', flexDirection: 'column' }}>
      {/* Enveloppe pleine hauteur : seul le bas défile, l'en-tête (✕) et la carte restent en place */}
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#06142E', color: '#fff', flexShrink: 0, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>📍 Mon trajet en direct</div>
          <div style={{ fontSize: 12, opacity: .75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {voyage.origine || data?.origine} → {voyage.destination || data?.destination}{data?.vehicule_matricule ? ` · ${data.vehicule_matricule}` : ''}
          </div>
        </div>
        <button onClick={onClose} aria-label="Fermer" style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: 12, fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ position: 'relative', height: '44dvh', minHeight: 240, flexShrink: 0, width: '100%' }}>
        <MapSafe>
          <MapContainer center={bus || route[0] || CENTRE_DEFAUT} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <Cadrer points={pointsCadre} />
            {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#94A3B8', weight: 4, dashArray: '6 8' }} />}
            {monTrajet.length > 1 && <Polyline positions={monTrajet} pathOptions={{ color: BLEU, weight: 5, opacity: .55 }} />}
            {trace.length > 1 && <Polyline positions={trace} pathOptions={{ color: VERT, weight: 5, opacity: .85 }} />}
            {arrets.map((a, i) => a.coords && (
              <CircleMarker key={a.ville} center={a.coords} radius={i === iMontee || i === iDescente ? 8 : 6}
                pathOptions={{ color: '#fff', weight: 2, fillOpacity: 1, fillColor: i === iDescente ? OR : i === iMontee ? BLEU : (passes.has(i) ? VERT : '#94A3B8') }}>
                <Tooltip direction="top" offset={[0, -6]}>{a.ville}</Tooltip>
              </CircleMarker>
            ))}
            {bus && enCours && <Marker position={bus} icon={iconeVehicule(s.statut, s.nb_a_bord)} />}
          </MapContainer>
        </MapSafe>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box', background: '#F1F5F9', paddingBottom: 'calc(14px + var(--zone-bas, 0px))' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 6px 18px -10px rgba(6,20,46,.25)' }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: ENCRE }}>{titre}</div>
          {sousTitre && <div style={{ fontSize: 13, color: GRIS, marginTop: 4 }}>{sousTitre}</div>}
          {s?.position_ancienne && enCours && (
            <div style={{ fontSize: 12, color: '#9A3412', background: '#FFF7ED', borderRadius: 8, padding: '6px 10px', marginTop: 8 }}>
              ⚠️ Position du bus non actualisée depuis {Math.round((s.position_age_s || 0) / 60)} min (réseau du conducteur) — estimation approximative.
            </div>
          )}
          {enCours && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Estimation à ~{Math.round(vitesse)} km/h de moyenne · actualisé {maj ? `à ${heure(maj)}` : ''}</div>}
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: GRIS, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>Parcours</div>
          {arrets.map((a, i) => {
            const passe = passes.has(i)
            const busIci = pos && pos.segment === i && enCours
            const moi = i === iMontee ? 'Votre montée' : i === iDescente ? 'Votre descente' : null
            const restant = i >= iMontee && i <= iDescente
            return (
              <div key={a.ville} style={{ display: 'flex', gap: 12, opacity: restant || passe ? 1 : .55 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', marginTop: 3, flexShrink: 0,
                    background: passe ? VERT : '#fff', border: `3px solid ${i === iDescente ? OR : passe ? VERT : '#CBD5E1'}` }} />
                  {i < arrets.length - 1 && <span style={{ flex: 1, width: 3, minHeight: 26, background: passes.has(i + 1) ? VERT : '#E2E8F0' }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: moi ? 800 : 600, color: ENCRE }}>
                    {a.ville} {moi && <span style={{ fontSize: 11, fontWeight: 800, color: i === iDescente ? '#92400E' : BLEU, background: i === iDescente ? '#FEF3C7' : '#DBEAFE', borderRadius: 6, padding: '2px 6px', marginLeft: 4 }}>{i === iDescente ? '⬇' : '⬆'} {moi}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: GRIS }}>
                    {passe ? '✓ Passé' : 'À venir'}
                    {a.montent?.length > 0 && ` · ${a.montent.length} monte${a.montent.length > 1 ? 'nt' : ''}`}
                    {a.descendent?.length > 0 && ` · ${a.descendent.length} descend${a.descendent.length > 1 ? 'ent' : ''}`}
                  </div>
                  {busIci && <div style={{ fontSize: 12, fontWeight: 700, color: VERT, marginTop: 4 }}>🚐 Le bus est entre {a.ville} et {arrets[pos.suivant]?.ville}</div>}
                </div>
              </div>
            )
          })}
          {arrets.length === 0 && <div style={{ fontSize: 13, color: GRIS }}>Itinéraire non renseigné pour ce convoi.</div>}
        </div>
      </div>
      </div>
    </div>
  )
}
