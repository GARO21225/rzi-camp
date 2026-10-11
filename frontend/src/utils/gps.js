// Géolocalisation du chauffeur : états, erreurs et lecture de position — sans jamais supposer une autorisation.
export const LIBELLE_GPS = {
  non_autorisee: 'Localisation non autorisée',
  requise: 'Autorisation de localisation requise',
  autorisee: 'Localisation autorisée',
  recherche: 'Recherche de la position GPS…',
  active: 'Position GPS active',
  erreur: 'Erreur de géolocalisation',
}

/** Environnement : null si OK, sinon { code, message }. */
export function verifierEnvironnement(win = window, nav = navigator) {
  if (!win.isSecureContext) return { code: 'non_securise', message: "Connexion non sécurisée : la localisation exige HTTPS. Ouvrez l'application via son adresse officielle (https://…), pas une adresse IP." }
  if (!nav.geolocation) return { code: 'absent', message: "Ce téléphone ou ce navigateur ne fournit pas de géolocalisation." }
  return null
}

export function messageErreur(code, aide = '') {
  switch (code) {
    case 'refuse': return `Localisation refusée. ${aide}`.trim()
    case 'delai': return "Délai dépassé : aucune position reçue. Sortez à l'air libre, vérifiez que le GPS du téléphone est activé, puis réessayez."
    case 'indisponible': return "Position indisponible : le GPS n'a pas pu déterminer votre position. Activez la localisation du téléphone (mode précision élevée) et réessayez."
    default: return 'Erreur de géolocalisation. Réessayez.'
  }
}

const CODES = { 1: 'refuse', 2: 'indisponible', 3: 'delai' }

/** Demande une position réelle au navigateur. Résout toujours : { ok:true, coords, horodatage } ou { ok:false, code }. */
export function demanderPosition({ timeout = 15000, maximumAge = 0 } = {}, nav = navigator, win = window) {
  const env = verifierEnvironnement(win, nav)
  if (env) return Promise.resolve({ ok: false, code: env.code })
  return new Promise(resolve => {
    nav.geolocation.getCurrentPosition(
      p => resolve({ ok: true, coords: p.coords, horodatage: p.timestamp || Date.now() }),
      e => resolve({ ok: false, code: CODES[e?.code] || 'erreur' }),
      { enableHighAccuracy: true, timeout, maximumAge },
    )
  })
}

/** Statut affiché. `permission` = 'granted'|'denied'|'prompt'|null (Permissions API, absente sur certains mobiles). */
export function statutGps({ permission, position, enRecherche, erreur }) {
  if (position) return 'active'
  if (enRecherche) return 'recherche'
  if (erreur) return erreur === 'refuse' ? 'non_autorisee' : 'erreur'
  if (permission === 'denied') return 'non_autorisee'
  if (permission === 'granted') return 'autorisee'
  return 'requise'
}

/** Vrai si la position est assez récente (en ms) pour autoriser un départ. */
export const positionFraiche = (position, maintenant = Date.now(), maxMs = 60000) =>
  !!position && Number.isFinite(position.lat) && Number.isFinite(position.lng) && maintenant - position.t <= maxMs

/** Enregistre un Blob reçu du serveur sous `nom` (téléchargement navigateur / WebView). */
export function sauverBlob(blob, nom) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nom
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
