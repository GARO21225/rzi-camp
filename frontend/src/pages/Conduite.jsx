import React, { useCallback, useEffect, useRef, useState } from 'react'
import MapSafe, { trajetValide } from '../components/MapSafe'
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import { suiviConvois } from '../api'
import { LIBELLE_GPS, verifierEnvironnement, messageErreur, demanderPosition, statutGps, positionFraiche, sauverBlob } from '../utils/gps'
import { toast, confirmDialog } from '../toast'
import {
  TILE_URL, TILE_ATTRIBUTION, CENTRE_DEFAUT, LIBELLE_STATUT, ICONE_ARRET,
  iconeVehicule, iconeArret, heure, VolVers,
} from '../components/CarteConvoisDirect'

// Page "Ma conduite" — utilisée par le CONDUCTEUR sur son téléphone pendant
// le trajet (façon Yango côté chauffeur) : gros bouton PARTIR, position GPS
// envoyée automatiquement, signalement des arrêts en 2 taps.

const ENVOI_POSITION_DEFAUT_S = 15   // la valeur du serveur (intervalle_envoi_s) prime
const CLE_ATTENTE = rid => `rzi_gps_attente_${rid}`   // points non encore reçus par le serveur (reprise après coupure)

const TYPES_ARRET = [
  ['pause', '☕', 'Pause'],
  ['depose', '⬇️', 'Dépose'],
  ['ramassage', '⬆️', 'Ramassage'],
  ['controle', '🛂', 'Contrôle'],
  ['carburant', '⛽', 'Carburant'],
  ['incident', '⚠️', 'Incident'],
]

// Aide adaptée à l'environnement : l'app installée (Capacitor/PWA) n'a ni cadenas ni barre d'adresse.
function messageLocalisationRefusee() {
  const ua = navigator.userAgent || ''
  const natif = !!window.Capacitor?.isNativePlatform?.()
  const ios = /iPhone|iPad|iPod/i.test(ua)
  if (natif || window.matchMedia?.('(display-mode: standalone)').matches) {
    return ios
      ? "Localisation refusée. Ouvrez Réglages → Confidentialité → Service de localisation → Roxgold SiteLife → « Pendant l'utilisation », puis revenez ici et touchez « Réessayer »."
      : "Localisation refusée. Ouvrez Paramètres Android → Applications → Roxgold SiteLife → Autorisations → Position → « Autoriser », puis revenez ici et touchez « Réessayer ». (Si l'option n'existe pas, l'application doit être mise à jour.)"
  }
  return "Localisation refusée. Touchez le cadenas à côté de l'adresse → Autorisations → Position → Autoriser, puis « Réessayer »."
}

const coordsPayload = c => c ? {
  latitude: c.latitude, longitude: c.longitude, precision: c.accuracy != null ? c.accuracy : null,
  vitesse_kmh: c.speed != null && c.speed >= 0 ? c.speed * 3.6 : null,
  cap: c.heading != null && !Number.isNaN(c.heading) ? c.heading : null,
} : {}

const btn = (bg, extra = {}) => ({
  background: bg, color: '#fff', border: 'none', borderRadius: 14, padding: '16px 18px',
  fontSize: 17, fontWeight: 800, cursor: 'pointer', width: '100%', minHeight: 56, ...extra,
})


const COULEUR_GPS = {
  active: ['#F0FDF4', '#BBF7D0', '#166534'], autorisee: ['#EFF6FF', '#BFDBFE', '#1E40AF'], recherche: ['#EFF6FF', '#BFDBFE', '#1E40AF'],
  requise: ['#FFFBEB', '#FDE68A', '#92400E'], non_autorisee: ['#FEF2F2', '#FECACA', '#991B1B'], erreur: ['#FEF2F2', '#FECACA', '#991B1B'],
}

// Bouton d'autorisation GPS — DISTINCT de « PARTIR » : autoriser la localisation ne démarre pas le trajet.
function PanneauGps({ statut, position, message, onAutoriser }) {
  const [bg, bord, txt] = COULEUR_GPS[statut] || COULEUR_GPS.requise
  const prec = position?.prec != null ? Math.round(position.prec) : null
  return (
    <div style={{ background: bg, border: `1px solid ${bord}`, borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: txt, fontWeight: 800, fontSize: 15 }}>
        <span>{statut === 'active' ? '📍' : statut === 'recherche' ? '⏳' : '📡'}</span> {LIBELLE_GPS[statut]}
      </div>
      {statut === 'active' && prec != null && <div style={{ fontSize: 12, color: txt, marginTop: 2 }}>Précision ≈ ±{prec} m{prec > 100 ? ' — faible : sortez à l\'air libre' : ''}</div>}
      {message && <div style={{ fontSize: 13, color: txt, marginTop: 6, lineHeight: 1.4 }}>{message}</div>}
      {statut !== 'active' && statut !== 'recherche' && (
        <button onClick={onAutoriser} style={btn('#0F2A5C', { marginTop: 10, fontSize: 16, minHeight: 50 })}>
          📍 {statut === 'non_autorisee' || statut === 'erreur' ? 'Réessayer la localisation' : 'Autoriser ma localisation GPS'}
        </button>
      )}
    </div>
  )
}

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
  const [modalArret, setModalArret] = useState(false)
  // ── État GPS : jamais « autorisé » sans réponse réelle du navigateur ──
  const [permission, setPermission] = useState(null)      // 'granted' | 'denied' | 'prompt' | null (API absente)
  const [gpsPos, setGpsPos] = useState(null)              // { lat, lng, prec, t } dernière position RÉELLE reçue
  const [recherche, setRecherche] = useState(false)
  const [gpsCode, setGpsCode] = useState(null)            // 'refuse' | 'delai' | 'indisponible' | 'non_securise' | 'absent'
  const [gpsEssai, setGpsEssai] = useState(0)
  const dernierePos = useRef(null)                        // coords brutes (vitesse, cap…)
  const flushRef = useRef(null)                           // envoi immédiat des positions en attente
  const [attente, setAttente] = useState(0)               // points en attente d'envoi (réseau coupé)
  const [dernierEnvoi, setDernierEnvoi] = useState(null)
  const [, forceTick] = useState(0)
  const [traceServeur, setTraceServeur] = useState([])
  const [traceLocale, setTraceLocale] = useState([])

  const charger = useCallback(() =>
    suiviConvois.mesConvois().then(r => setConvois(Array.isArray(r.data) ? r.data : [])).catch(() => setConvois([])), [])
  useEffect(() => { charger() }, [charger])

  const actif = (convois || []).find(c => c.suivi && c.suivi.statut !== 'arrive') || null
  const rid = actif?.rotation_id
  const intervalleMs = (actif?.intervalle_envoi_s || ENVOI_POSITION_DEFAUT_S) * 1000

  const aide = messageLocalisationRefusee()
  const env = verifierEnvironnement()
  const gpsMessage = env ? env.message : gpsCode ? messageErreur(gpsCode, aide) : null
  const statut = env ? 'erreur' : statutGps({ permission, position: positionFraiche(gpsPos) ? gpsPos : null, enRecherche: recherche, erreur: gpsCode })

  const enregistrerPosition = useCallback((coords, t) => {
    dernierePos.current = coords
    const pt = { lat: coords.latitude, lng: coords.longitude, prec: coords.accuracy, t: t || Date.now() }
    setGpsPos(pt); setGpsCode(null)
    return pt
  }, [])

  // Permissions API (absente sur certains mobiles) : renseigne seulement le statut de départ.
  useEffect(() => {
    let st = null
    navigator.permissions?.query?.({ name: 'geolocation' }).then(r => {
      st = r; setPermission(r.state)
      r.onchange = () => setPermission(r.state)
    }).catch(() => {})
    return () => { if (st) st.onchange = null }
  }, [])

  // Action de l'utilisateur : demande réelle d'autorisation + première position valide.
  const autoriser = useCallback(async () => {
    setRecherche(true); setGpsCode(null)
    const r = await demanderPosition({ timeout: 20000 })
    setRecherche(false)
    if (r.ok) { enregistrerPosition(r.coords, r.horodatage); setPermission('granted'); setGpsEssai(n => n + 1) }
    else { setGpsCode(r.code); if (r.code === 'refuse') setPermission('denied') }
  }, [enregistrerPosition])

  // Autorisation déjà accordée : on vérifie qu'une position est réellement obtenue (sans nouvelle invite).
  useEffect(() => { if (permission === 'granted' && !gpsPos && !recherche && !gpsCode) autoriser() }, [permission]) // eslint-disable-line react-hooks/exhaustive-deps

  // Surveillance continue dès qu'une position réelle existe (liste ET trajet), trace locale pendant le trajet.
  const surveille = !!gpsPos || permission === 'granted'
  useEffect(() => {
    if (!surveille || env) return
    const watchId = navigator.geolocation.watchPosition(
      p => {
        const pt = enregistrerPosition(p.coords, p.timestamp)
        const ll = [pt.lat, pt.lng]
        setTraceLocale(t => {
          const d = t[t.length - 1]
          if (d && Math.abs(d[0] - ll[0]) < 0.00014 && Math.abs(d[1] - ll[1]) < 0.00014) return t   // bruit GPS < ~15 m
          return [...t.slice(-1999), ll]
        })
      },
      e => { const code = e.code === 1 ? 'refuse' : e.code === 3 ? 'delai' : 'indisponible'; setGpsCode(code); if (code === 'refuse') setPermission('denied') },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [surveille, gpsEssai, env, enregistrerPosition])

  // ── Envoi périodique au serveur : points horodatés, identifiants uniques, reprise après coupure réseau ──
  useEffect(() => {
    if (!rid) return
    suiviConvois.get(rid).then(r => setTraceServeur(r.data?.suivi?.trace || [])).catch(() => {})
    const cle = CLE_ATTENTE(rid)
    const lire = () => { try { return JSON.parse(localStorage.getItem(cle) || '[]') } catch { return [] } }
    const ecrire = a => { try { localStorage.setItem(cle, JSON.stringify(a.slice(-500))) } catch { /* stockage plein : on garde en mémoire seulement */ } setAttente(a.length) }
    let enVol = false, dernierEnvoye = null
    const envoyer = async () => {
      if (enVol) return
      const c = dernierePos.current
      let file = lire()
      if (c && (!dernierEnvoye || dernierEnvoye.latitude !== c.latitude || dernierEnvoye.longitude !== c.longitude || file.length === 0)) {
        file.push({ ...coordsPayload(c), client_id: `${rid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, horodatage: new Date().toISOString() })
        dernierEnvoye = c
      }
      if (!file.length) return
      enVol = true
      const lot = file.slice(0, 200)
      try {
        await suiviConvois.position(rid, { points: lot })
        file = file.slice(lot.length); setDernierEnvoi(Date.now())
      } catch (e) {
        if (e?.response?.status === 400 && !e.response.data?.doublons) file = file.slice(lot.length)   // lot invalide : inutile de le rejouer
      } finally { ecrire(file); enVol = false }
    }
    flushRef.current = envoyer
    envoyer()
    const id = setInterval(envoyer, intervalleMs)
    window.addEventListener('online', envoyer)
    const tick = setInterval(() => forceTick(n => n + 1), 5000)
    return () => { clearInterval(id); clearInterval(tick); window.removeEventListener('online', envoyer) }
  }, [rid, intervalleMs])

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
    if (!positionFraiche(gpsPos)) { toast.error('Autorisez la localisation et attendez la position GPS avant de partir.'); return }
    const ok = await confirmDialog(`Démarrer le trajet ${cv.origine || 'Camp'} → ${cv.destination || '?'} avec ${cv.nb_passagers_prevus} passager(s) ?\n\nLe Centre de Mobilité vous suivra sur la carte jusqu'à l'arrivée.`,
      { titre: '🚐 Partir', danger: false })
    if (!ok) return
    setBusy(true)
    try {
      const c = dernierePos.current
      const r = await suiviConvois.partir(cv.rotation_id, coordsPayload(c))
      majConvoi(r.data)
      toast.success('Bon trajet ! Le Centre de Mobilité vous voit en direct.')
      if (r.data.echecs?.length) toast.warning(`Départ non enregistré pour : ${r.data.echecs.join(' ; ')}`, 10000)
    } catch (e) { toast.error(e?.response?.data?.error || 'Impossible de démarrer le trajet') }
    finally { setBusy(false) }
  }

  const signalerArret = async (d) => {
    try {
      const c = dernierePos.current || (await demanderPosition({ timeout: 5000, maximumAge: 10000 })).coords
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

  const telecharger = async (type) => {
    try {
      const r = type === 'pdf' ? await suiviConvois.exportPdf(rid) : await suiviConvois.exportCsv(rid)
      sauverBlob(r.data, type === 'pdf' ? `rapport_trajet_${rid}.pdf` : `trajet_${rid}.csv`)
    } catch { toast.error("Téléchargement impossible — vérifiez la connexion") }
  }

  const arriver = async () => {
    const ok = await confirmDialog(`Confirmer l'arrivée à ${actif.destination || 'destination'} ?`, { titre: '🏁 Arrivée', danger: false })
    if (!ok) return
    setBusy(true)
    try {
      await flushRef.current?.()   // les positions en attente partent AVANT la clôture
      const r = await suiviConvois.arriver(rid, coordsPayload(dernierePos.current))
      try { localStorage.removeItem(CLE_ATTENTE(rid)) } catch { /* sans importance */ }
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
        <PanneauGps statut={statut} position={gpsPos} message={gpsMessage} onAutoriser={autoriser} />
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
            <button onClick={() => partir(cv)} disabled={busy || statut !== 'active'} style={btn(busy || statut !== 'active' ? '#94a3b8' : '#16A34A', { fontSize: 20, letterSpacing: 1 })}>
              {busy ? '⏳' : '▶  PARTIR'}
            </button>
            {statut !== 'active' && <div style={{ fontSize: 12, color: '#92400E', marginTop: 6, textAlign: 'center' }}>Départ possible uniquement avec une position GPS active.</div>}
          </div>
        ))}
      </div>
    )
  }

  // ── Trajet en cours ───────────────────────────────────────────
  const s = actif.suivi
  const trace = [...traceServeur, ...traceLocale]
  const posVehicule = gpsPos ? [gpsPos.lat, gpsPos.lng] : (s.latitude != null ? [s.latitude, s.longitude] : null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ position: 'relative', height: '46dvh', minHeight: 260 }}>
        <MapSafe>
        <MapContainer center={posVehicule || CENTRE_DEFAUT} zoom={posVehicule ? 14 : 7} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <VolVers cible={posVehicule} zoom={14} />
          {trajetValide(trace).length > 1 && <Polyline positions={trajetValide(trace)} pathOptions={{ color: '#16A34A', weight: 5, opacity: .7 }} />}
          {(s.arrets || []).filter(a => a.latitude != null).map(a => (
            <Marker key={a.id} position={[a.latitude, a.longitude]} icon={iconeArret(a.type)} />
          ))}
          {posVehicule && <Marker position={posVehicule} icon={iconeVehicule(s.statut, s.nb_a_bord)} />}
        </MapContainer>
        </MapSafe>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {statut !== 'active' && <PanneauGps statut={statut} position={gpsPos} message={gpsMessage} onAutoriser={autoriser} />}
        <div style={{ fontSize: 12, color: attente > 0 ? '#92400E' : '#5B6472', background: attente > 0 ? '#FFFBEB' : '#F8FAFC', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
          📡 {statut === 'active' ? `GPS actif${gpsPos?.prec != null ? ` (±${Math.round(gpsPos.prec)} m)` : ''}` : LIBELLE_GPS[statut]}
          {dernierEnvoi ? ` · dernier envoi il y a ${Math.round((Date.now() - dernierEnvoi) / 1000)} s` : ' · aucun envoi confirmé pour l\'instant'}
          {attente > 0 && ` · ⚠️ ${attente} position(s) en attente (réseau coupé) — renvoi automatique`}
        </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => telecharger('pdf')} style={btn('#475569', { fontSize: 13, minHeight: 44, padding: '10px' })}>📄 Rapport PDF (provisoire)</button>
          <button onClick={() => telecharger('csv')} style={btn('#475569', { fontSize: 13, minHeight: 44, padding: '10px' })}>📊 Données CSV</button>
        </div>
        <div style={{ fontSize: 12, color: '#5B6472', textAlign: 'center', lineHeight: 1.5 }}>
          Gardez cette page ouverte et l'écran allumé : la position est envoyée toutes les {Math.round(intervalleMs / 1000)} secondes.
          Le suivi s'interrompt si le téléphone se verrouille ou si l'application passe en arrière-plan (limite des navigateurs mobiles) ;
          les positions manquantes ne sont pas inventées, le rapport indique si la trace est incomplète.
        </div>
      </div>

      {modalArret && <ModalArret convoi={actif} onClose={() => setModalArret(false)} onValider={signalerArret} />}
    </div>
  )
}
