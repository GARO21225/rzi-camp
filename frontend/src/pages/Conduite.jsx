import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { suiviConvois } from '../api'
import { toast, confirmDialog } from '../toast'
import {
  TILE_URL, TILE_ATTRIBUTION, CENTRE_DEFAUT, LIBELLE_STATUT, ICONE_ARRET,
  iconeVehicule, iconeArret, heure, VolVers,
} from '../components/CarteConvoisDirect'

// Page "Ma conduite" — utilisée par le CONDUCTEUR sur son téléphone pendant
// le trajet (façon Yango côté chauffeur) : gros bouton PARTIR, position GPS
// envoyée automatiquement, signalement des arrêts en 2 taps.

const ENVOI_POSITION_MS = 15000

const TYPES_ARRET = [
  ['pause', '☕', 'Pause'],
  ['depose', '⬇️', 'Dépose'],
  ['ramassage', '⬆️', 'Ramassage'],
  ['controle', '🛂', 'Contrôle'],
  ['carburant', '⛽', 'Carburant'],
  ['incident', '⚠️', 'Incident'],
]

function lirePosition(timeout = 8000) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p => resolve(p.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 10000 },
    )
  })
}

const coordsPayload = c => c ? {
  latitude: c.latitude, longitude: c.longitude,
  vitesse_kmh: c.speed != null && c.speed >= 0 ? c.speed * 3.6 : null,
  cap: c.heading != null && !Number.isNaN(c.heading) ? c.heading : null,
} : {}

const btn = (bg, extra = {}) => ({
  background: bg, color: '#fff', border: 'none', borderRadius: 14, padding: '16px 18px',
  fontSize: 17, fontWeight: 800, cursor: 'pointer', width: '100%', minHeight: 56, ...extra,
})

function ModalArret({ convoi, onClose, onValider }) {
  const [type, setType] = useState('pause')
  const [lieu, setLieu] = useState('')
  const [note, setNote] = useState('')
  const [deposes, setDeposes] = useState([])
  const [busy, setBusy] = useState(false)
  const aBord = convoi.suivi?.a_bord || []
  const toggle = id => setDeposes(d => d.includes(id) ? d.filter(x => x !== id) : [...d, id])

  const valider = async () => {
    setBusy(true)
    try { await onValider({ type, lieu, note, deposes: type === 'depose' ? deposes : [] }) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '88dvh', overflowY: 'auto', padding: '18px 16px calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#0F1A2E' }}>Signaler un arrêt</div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 36, height: 36, fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {TYPES_ARRET.map(([v, ic, l]) => (
            <button key={v} onClick={() => setType(v)}
              style={{ border: type === v ? '2px solid #C9972B' : '1px solid #e2e8f0', background: type === v ? '#FFF8E6' : '#fff',
                borderRadius: 12, padding: '12px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 24 }}>{ic}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1A2E' }}>{l}</span>
            </button>
          ))}
        </div>
        <input value={lieu} onChange={e => setLieu(e.target.value)} placeholder="Lieu (ex : Yamoussoukro, péage...)"
          style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px', marginBottom: 10, boxSizing: 'border-box' }} />
        {type === 'depose' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1A2E', marginBottom: 6 }}>Qui descend ici ? ({deposes.length})</div>
            {aBord.length === 0 && <div style={{ fontSize: 13, color: '#5B6472' }}>Plus aucun passager à bord.</div>}
            {aBord.map(p => (
              <label key={p.voyage_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <input type="checkbox" checked={deposes.includes(p.voyage_id)} onChange={() => toggle(p.voyage_id)} style={{ width: 22, height: 22 }} />
                <span style={{ fontSize: 15, color: '#0F1A2E', flex: 1 }}>{p.nom}</span>
                {p.destination && <span style={{ fontSize: 12, color: '#5B6472' }}>{p.destination}</span>}
              </label>
            ))}
          </div>
        )}
        {(type === 'incident' || type === 'controle') && (
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Détail (facultatif)" rows={2}
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit' }} />
        )}
        <button onClick={valider} disabled={busy || (type === 'depose' && deposes.length === 0)}
          style={btn(busy || (type === 'depose' && deposes.length === 0) ? '#94a3b8' : (type === 'incident' ? '#DC2626' : '#0F2A5C'))}>
          {busy ? '⏳ Envoi...' : '📣 Notifier le Centre de Mobilité'}
        </button>
      </div>
    </div>
  )
}

export default function Conduite() {
  const [convois, setConvois] = useState(null)
  const [busy, setBusy] = useState(false)
  const [maPos, setMaPos] = useState(null)
  const [gpsErreur, setGpsErreur] = useState(null)
  const [modalArret, setModalArret] = useState(false)
  const dernierePos = useRef(null)
  // Trace affichée : trace déjà connue du serveur (reprise après rechargement) + points GPS locaux
  const [traceServeur, setTraceServeur] = useState([])
  const [traceLocale, setTraceLocale] = useState([])

  const charger = useCallback(() =>
    suiviConvois.mesConvois().then(r => setConvois(Array.isArray(r.data) ? r.data : [])).catch(() => setConvois([])), [])
  useEffect(() => { charger() }, [charger])

  const actif = (convois || []).find(c => c.suivi && c.suivi.statut !== 'arrive') || null
  const rid = actif?.rotation_id

  // ── GPS + envoi périodique pendant le trajet ──────────────────
  useEffect(() => {
    if (!rid) return
    suiviConvois.get(rid).then(r => setTraceServeur(r.data?.suivi?.trace || [])).catch(() => {})
    if (!navigator.geolocation) { setGpsErreur("Ce téléphone ne fournit pas de localisation."); return }
    const watchId = navigator.geolocation.watchPosition(
      p => {
        const pt = [p.coords.latitude, p.coords.longitude]
        dernierePos.current = p.coords; setMaPos(pt); setGpsErreur(null)
        setTraceLocale(t => {
          const d = t[t.length - 1]
          // ignore le bruit GPS (< ~15 m) pour ne pas surcharger la trace
          if (d && Math.abs(d[0] - pt[0]) < 0.00014 && Math.abs(d[1] - pt[1]) < 0.00014) return t
          return [...t.slice(-1999), pt]
        })
      },
      e => setGpsErreur(e.code === 1
        ? "Localisation refusée — autorisez-la dans les réglages du navigateur pour que le Centre de Mobilité vous voie."
        : 'Signal GPS faible — nouvelle tentative en cours...'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    const envoyer = () => {
      const c = dernierePos.current
      if (c) suiviConvois.position(rid, coordsPayload(c)).catch(() => {})
    }
    const id = setInterval(envoyer, ENVOI_POSITION_MS)
    return () => { navigator.geolocation.clearWatch(watchId); clearInterval(id) }
  }, [rid])

  // ── Garder l'écran allumé pendant le trajet (sinon le navigateur coupe le GPS) ──
  useEffect(() => {
    if (!rid || !('wakeLock' in navigator)) return
    let lock = null
    const demander = () => navigator.wakeLock.request('screen').then(l => { lock = l }).catch(() => {})
    const onVis = () => { if (document.visibilityState === 'visible') demander() }
    demander()
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.().catch(() => {}) }
  }, [rid])

  const majConvoi = data => setConvois(cs => (cs || []).map(c => c.rotation_id === data.rotation_id ? { ...c, ...data } : c))

  const partir = async (cv) => {
    const ok = await confirmDialog(`Démarrer le trajet ${cv.origine || 'Camp'} → ${cv.destination || '?'} avec ${cv.nb_passagers_prevus} passager(s) ?\n\nLe Centre de Mobilité vous suivra sur la carte jusqu'à l'arrivée.`,
      { titre: '🚐 Partir', danger: false })
    if (!ok) return
    setBusy(true)
    try {
      const c = await lirePosition()
      if (c) { dernierePos.current = c; setMaPos([c.latitude, c.longitude]) }
      const r = await suiviConvois.partir(cv.rotation_id, coordsPayload(c))
      majConvoi(r.data)
      toast.success('Bon trajet ! Le Centre de Mobilité vous voit en direct.')
      if (r.data.echecs?.length) toast.warning(`Départ non enregistré pour : ${r.data.echecs.join(' ; ')}`, 10000)
    } catch (e) { toast.error(e?.response?.data?.error || 'Impossible de démarrer le trajet') }
    finally { setBusy(false) }
  }

  const signalerArret = async (d) => {
    try {
      const c = dernierePos.current || await lirePosition(5000)
      const r = await suiviConvois.arret(rid, { ...d, ...coordsPayload(c) })
      majConvoi(r.data)
      setModalArret(false)
      toast.success('Arrêt notifié au Centre de Mobilité')
    } catch (e) { toast.error(e?.response?.data?.error || "Échec de l'envoi — vérifiez la connexion") }
  }

  const reprendre = async () => {
    setBusy(true)
    try { majConvoi((await suiviConvois.reprendre(rid)).data) }
    catch (e) { toast.error(e?.response?.data?.error || 'Erreur') }
    finally { setBusy(false) }
  }

  const arriver = async () => {
    const ok = await confirmDialog(`Confirmer l'arrivée à ${actif.destination || 'destination'} ?`, { titre: '🏁 Arrivée', danger: false })
    if (!ok) return
    setBusy(true)
    try {
      const r = await suiviConvois.arriver(rid, coordsPayload(dernierePos.current))
      majConvoi(r.data)
      toast.success('Arrivée enregistrée. Merci et bonne journée !')
      charger()
    } catch (e) { toast.error(e?.response?.data?.error || 'Erreur') }
    finally { setBusy(false) }
  }

  if (convois === null) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>⏳ Chargement...</div>

  // ── Aucun trajet en cours : liste des convois à démarrer ──────
  if (!actif) {
    return (
      <div style={{ padding: 16, maxWidth: 560, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0F1A2E', margin: '4px 0 14px' }}>🚐 Ma conduite</h2>
        {convois.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center', color: '#5B6472', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🛣️</div>
            Aucun convoi ne vous est assigné aujourd'hui.<br />
            <span style={{ fontSize: 12 }}>Le Centre de Mobilité doit vous désigner comme conducteur d'une rotation.</span>
          </div>
        )}
        {convois.map(cv => (
          <div key={cv.rotation_id} style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(15,26,46,.06)' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0F1A2E' }}>{cv.vehicule} {cv.vehicule_matricule && <span style={{ color: '#5B6472', fontWeight: 600 }}>· {cv.vehicule_matricule}</span>}</div>
            <div style={{ fontSize: 15, color: '#0F1A2E', margin: '8px 0 4px' }}>📍 {cv.origine || 'Camp'} → 🏁 {cv.destination || '?'}</div>
            <div style={{ fontSize: 13, color: '#5B6472', marginBottom: 14 }}>
              📅 {new Date(cv.date_depart).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {cv.heure_depart && <> · ⏰ {cv.heure_depart}</>}
              {cv.point_rdv && <> · RDV {cv.point_rdv}</>}
              <br />👥 {cv.nb_passagers_prevus} passager(s) prévus
            </div>
            <button onClick={() => partir(cv)} disabled={busy} style={btn(busy ? '#94a3b8' : '#16A34A', { fontSize: 20, letterSpacing: 1 })}>
              {busy ? '⏳' : '▶  PARTIR'}
            </button>
          </div>
        ))}
      </div>
    )
  }

  // ── Trajet en cours ───────────────────────────────────────────
  const s = actif.suivi
  const trace = [...traceServeur, ...traceLocale]
  const posVehicule = maPos || (s.latitude != null ? [s.latitude, s.longitude] : null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ position: 'relative', height: '46dvh', minHeight: 260 }}>
        <MapContainer center={posVehicule || CENTRE_DEFAUT} zoom={posVehicule ? 14 : 7} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <VolVers cible={posVehicule} zoom={14} />
          {trace.length > 1 && <Polyline positions={trace} pathOptions={{ color: '#16A34A', weight: 5, opacity: .7 }} />}
          {(s.arrets || []).filter(a => a.latitude != null).map(a => (
            <Marker key={a.id} position={[a.latitude, a.longitude]} icon={iconeArret(a.type)} />
          ))}
          {posVehicule && <Marker position={posVehicule} icon={iconeVehicule(s.statut, s.nb_a_bord)} />}
        </MapContainer>
        {gpsErreur && (
          <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 500, background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>
            📡 {gpsErreur}
          </div>
        )}
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            ['👥', `${s.nb_a_bord}/${s.nb_passagers_depart}`, 'à bord'],
            ['🏎️', dernierePos.current?.speed != null && dernierePos.current.speed >= 0 ? `${Math.round(dernierePos.current.speed * 3.6)}` : '—', 'km/h'],
            ['⏱️', heure(s.depart_at), 'départ'],
          ].map(([ic, v, l]) => (
            <div key={l} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0F1A2E' }}>{ic} {v}</div>
              <div style={{ fontSize: 11, color: '#5B6472', textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ background: s.statut === 'arret' ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${s.statut === 'arret' ? '#FDE68A' : '#BBF7D0'}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, fontWeight: 700, color: '#0F1A2E' }}>
          {LIBELLE_STATUT[s.statut]} · {actif.origine || 'Camp'} → {actif.destination || '?'}
        </div>

        {s.statut === 'arret'
          ? <button onClick={reprendre} disabled={busy} style={btn('#16A34A')}>▶ Reprendre la route</button>
          : <button onClick={() => setModalArret(true)} disabled={busy} style={btn('#D4A017')}>⏸️ Signaler un arrêt</button>}
        <button onClick={arriver} disabled={busy} style={btn('#0F2A5C')}>🏁 Arrivé à destination</button>

        {s.arrets?.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#5B6472', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Arrêts signalés</div>
            {[...s.arrets].reverse().map(a => (
              <div key={a.id} style={{ fontSize: 14, color: '#0F1A2E', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                {ICONE_ARRET[a.type]} <b>{heure(a.debut)}</b> {a.lieu || a.type_label.replace(/^\S+\s/, '')}
                {a.deposes.length > 0 && <span style={{ color: '#5B6472' }}> · déposés : {a.deposes.join(', ')}</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#5B6472', textAlign: 'center' }}>
          Gardez cette page ouverte pendant le trajet : votre position est envoyée toutes les 15 secondes.
        </div>
      </div>

      {modalArret && <ModalArret convoi={actif} onClose={() => setModalArret(false)} onValider={signalerArret} />}
    </div>
  )
}
