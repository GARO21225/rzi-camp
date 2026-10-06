import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { suiviConvois } from '../api'
import { toast } from '../toast'
import { useIsMobile } from '../hooks/useIsMobile'

// Même fond que CarteItineraire (Esri, sans clé API — voir commentaire là-bas)
export const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
export const TILE_ATTRIBUTION = 'Tiles &copy; Esri, &copy; OpenStreetMap contributors'

// Centre par défaut : Camp Roxgold Sango (Nord Côte d'Ivoire)
export const CENTRE_DEFAUT = [8.0, -5.3]
const POLL_MS = 10000

const COULEUR_STATUT = { en_route: '#16A34A', arret: '#D4A017', arrive: '#64748B' }
export const LIBELLE_STATUT = { en_route: '🚐 En route', arret: "⏸️ À l'arrêt", arrive: '🏁 Arrivé' }
export const ICONE_ARRET = { pause: '☕', depose: '⬇️', ramassage: '⬆️', controle: '🛂', carburant: '⛽', incident: '⚠️' }

/** Véhicule façon VTC : pastille colorée selon le statut + badge du nombre de passagers à bord. */
export function iconeVehicule(statut, nbABord, label = '') {
  const c = COULEUR_STATUT[statut] || '#0F2A5C'
  return L.divIcon({
    className: '',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -22],
    html: `<div style="position:relative;width:46px;height:46px">
      ${statut === 'en_route' ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${c};opacity:.25;animation:rzcPulse 1.6s ease-out infinite"></span>` : ''}
      <div style="position:absolute;inset:0;border-radius:50%;background:${c};border:3px solid #fff;
        box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:22px">🚐</div>
      <div style="position:absolute;top:-6px;right:-8px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;
        background:#0F1A2E;color:#fff;font:800 12px/22px system-ui,sans-serif;text-align:center;border:2px solid #fff">${nbABord}</div>
      ${label ? `<div style="position:absolute;top:48px;left:50%;transform:translateX(-50%);white-space:nowrap;
        background:#fff;color:#0F1A2E;font:700 10px system-ui,sans-serif;padding:1px 6px;border-radius:6px;
        box-shadow:0 1px 4px rgba(0,0,0,.25)">${label}</div>` : ''}
    </div>`,
  })
}

export function iconeArret(type) {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#fff;border:2px solid ${type === 'incident' ? '#DC2626' : '#C9972B'};
      display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.25)">${ICONE_ARRET[type] || '📍'}</div>`,
  })
}

// Animation du halo "en route" (injectée une seule fois)
if (typeof document !== 'undefined' && !document.getElementById('rzc-pulse-style')) {
  const st = document.createElement('style')
  st.id = 'rzc-pulse-style'
  st.textContent = '@keyframes rzcPulse{0%{transform:scale(.8);opacity:.45}100%{transform:scale(1.8);opacity:0}}'
  document.head.appendChild(st)
}

export function heure(d) {
  return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

export function ilYa(d) {
  if (!d) return 'aucune position'
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000))
  if (s < 60) return `il y a ${s} s`
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`
  return `il y a ${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`
}

/** Centre la carte sur `cible` quand elle change (clic dans la liste). */
export function VolVers({ cible, zoom = 12 }) {
  const map = useMap()
  useEffect(() => { if (cible) map.flyTo(cible, Math.max(map.getZoom(), zoom), { duration: 0.8 }) }, [cible?.[0], cible?.[1]])
  return null
}

/** Ajuste la vue pour englober tous les véhicules au premier chargement. */
function AjusterVue({ points }) {
  const map = useMap()
  const fait = useRef(false)
  useEffect(() => {
    if (fait.current || points.length === 0) return
    fait.current = true
    if (points.length === 1) map.setView(points[0], 11)
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
  }, [points.length])
  return null
}

/**
 * Carte "En direct" du Centre de Mobilité : chaque convoi parti apparaît
 * comme un véhicule qui se déplace (rafraîchi toutes les 10 s), avec le
 * nombre de passagers à bord, la trace parcourue et chaque arrêt signalé
 * par le conducteur. Un nouvel arrêt déclenche une notification à l'écran.
 */
export default function CarteConvoisDirect() {
  const isMobile = useIsMobile()
  const [convois, setConvois] = useState([])
  const [charge, setCharge] = useState(false)
  const [cible, setCible] = useState(null)
  const [, forceTick] = useState(0)
  const arretsConnus = useRef(null)
  const statutsConnus = useRef({})

  useEffect(() => {
    let annule = false
    const charger = () => suiviConvois.actifs().then(r => {
      if (annule) return
      const liste = Array.isArray(r.data) ? r.data : []
      // Notifications à l'écran : nouveaux arrêts / arrivées depuis le dernier passage
      const dejaVu = arretsConnus.current
      const ids = new Set()
      liste.forEach(cv => {
        const veh = cv.vehicule_matricule || cv.vehicule || cv.rotation_id
        ;(cv.suivi?.arrets || []).forEach(a => {
          ids.add(a.id)
          if (dejaVu && !dejaVu.has(a.id)) {
            const msg = `${ICONE_ARRET[a.type] || '📍'} ${veh} — ${a.type_label.replace(/^\S+\s/, '')}${a.lieu ? ` à ${a.lieu}` : ''} · ${a.nb_a_bord} à bord`
            a.type === 'incident' ? toast.warning(msg, 10000) : toast.info(msg, 8000)
          }
        })
        const avant = statutsConnus.current[cv.rotation_id]
        if (dejaVu && avant !== cv.suivi?.statut) {
          if (cv.suivi?.statut === 'arrive') toast.success(`🏁 ${veh} est arrivé à ${cv.destination || 'destination'}`, 8000)
          else if (!avant) toast.info(`🚐 ${veh} vient de partir (${cv.suivi?.nb_a_bord} passagers)`, 8000)
        }
        statutsConnus.current[cv.rotation_id] = cv.suivi?.statut
      })
      arretsConnus.current = ids
      setConvois(liste)
    }).catch(() => {}).finally(() => { if (!annule) setCharge(true) })
    charger()
    const id = setInterval(charger, POLL_MS)
    const tick = setInterval(() => forceTick(t => t + 1), 15000) // rafraîchit les "il y a X s"
    return () => { annule = true; clearInterval(id); clearInterval(tick) }
  }, [])

  const positionnes = convois.filter(c => c.suivi?.latitude != null && c.suivi?.longitude != null)

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, minHeight: isMobile ? 0 : 560 }}>
      <div style={{ flex: 1, minHeight: isMobile ? 380 : 560, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(15,26,46,.10)', position: 'relative' }}>
        <MapContainer center={CENTRE_DEFAUT} zoom={7} style={{ height: '100%', minHeight: isMobile ? 380 : 560, width: '100%' }}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <AjusterVue points={positionnes.map(c => [c.suivi.latitude, c.suivi.longitude])} />
          <VolVers cible={cible} />
          {convois.map(cv => (
            <React.Fragment key={cv.rotation_id}>
              {cv.suivi?.trace?.length > 1 && (
                <Polyline positions={cv.suivi.trace} pathOptions={{ color: COULEUR_STATUT[cv.suivi.statut] || '#0F2A5C', weight: 4, opacity: .7 }} />
              )}
              {(cv.suivi?.arrets || []).filter(a => a.latitude != null).map(a => (
                <Marker key={a.id} position={[a.latitude, a.longitude]} icon={iconeArret(a.type)}>
                  <Popup>
                    <b>{a.type_label}</b>{a.lieu && <> — {a.lieu}</>}<br />
                    {heure(a.debut)}{a.fin ? ` → ${heure(a.fin)}` : ' (en cours)'}<br />
                    👥 {a.nb_a_bord} à bord après l'arrêt
                    {a.deposes.length > 0 && <><br />⬇️ Déposés : {a.deposes.join(', ')}</>}
                    {a.note && <><br />📝 {a.note}</>}
                  </Popup>
                </Marker>
              ))}
              {cv.suivi?.latitude != null && (
                <Marker position={[cv.suivi.latitude, cv.suivi.longitude]}
                  icon={iconeVehicule(cv.suivi.statut, cv.suivi.nb_a_bord, cv.vehicule_matricule || cv.vehicule)}
                  zIndexOffset={1000}>
                  <Popup>
                    <b>{cv.vehicule} {cv.vehicule_matricule && `· ${cv.vehicule_matricule}`}</b><br />
                    {LIBELLE_STATUT[cv.suivi.statut]} · 👥 {cv.suivi.nb_a_bord}/{cv.suivi.nb_passagers_depart} à bord<br />
                    🧑‍✈️ {cv.conducteur}<br />
                    {cv.origine} → {cv.destination}<br />
                    {cv.suivi.vitesse_kmh != null && <>🏎️ {Math.round(cv.suivi.vitesse_kmh)} km/h · </>}
                    📡 {ilYa(cv.suivi.position_at)}
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          ))}
        </MapContainer>
        {charge && convois.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(255,255,255,.95)', padding: '14px 20px', borderRadius: 12, fontSize: 13, color: '#0F1A2E', boxShadow: '0 4px 16px rgba(0,0,0,.15)', textAlign: 'center', maxWidth: 300 }}>
              Aucun convoi en route.<br />
              <span style={{ color: '#5B6472', fontSize: 12 }}>Le véhicule apparaîtra ici dès que le conducteur appuie sur <b>PARTIR</b> dans « Ma conduite ».</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: isMobile ? '100%' : 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {convois.map(cv => {
          const s = cv.suivi
          const dernierArret = s?.arrets?.[s.arrets.length - 1]
          const perime = s?.statut !== 'arrive' && s?.position_at && (Date.now() - new Date(s.position_at).getTime() > 5 * 60000)
          return (
            <div key={cv.rotation_id}
              onClick={() => s?.latitude != null && setCible([s.latitude, s.longitude])}
              style={{ background: '#fff', border: '1px solid rgba(15,26,46,.10)', borderLeft: `4px solid ${COULEUR_STATUT[s?.statut] || '#0F2A5C'}`,
                borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0F1A2E' }}>🚐 {cv.vehicule_matricule || cv.vehicule || cv.rotation_id}</div>
                <div style={{ background: '#0F1A2E', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>
                  👥 {s?.nb_a_bord ?? 0}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#5B6472', marginTop: 4 }}>{cv.origine} → {cv.destination}</div>
              <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700, color: COULEUR_STATUT[s?.statut] }}>
                {LIBELLE_STATUT[s?.statut]}
                {s?.statut === 'arret' && dernierArret && <> — {dernierArret.type_label}{dernierArret.lieu && ` à ${dernierArret.lieu}`}</>}
              </div>
              <div style={{ fontSize: 11, color: perime ? '#DC2626' : '#5B6472', marginTop: 4 }}>
                🧑‍✈️ {cv.conducteur} · Parti à {heure(s?.depart_at)} · 📡 {ilYa(s?.position_at)}{perime && ' ⚠️ signal perdu ?'}
              </div>
              {s?.arrets?.length > 0 && (
                <div style={{ marginTop: 8, borderTop: '1px dashed rgba(15,26,46,.12)', paddingTop: 6 }}>
                  {s.arrets.slice(-4).reverse().map(a => (
                    <div key={a.id} style={{ fontSize: 11, color: '#0F1A2E', padding: '2px 0' }}>
                      {ICONE_ARRET[a.type]} <b>{heure(a.debut)}</b> {a.lieu || a.type_label.replace(/^\S+\s/, '')}
                      {a.deposes.length > 0 && <span style={{ color: '#5B6472' }}> · {a.deposes.length} déposé(s)</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
