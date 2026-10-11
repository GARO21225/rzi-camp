// Accès API du Centre de Mobilité (fetch authentifié) — séparé de l'interface.
export const BASE = import.meta.env.VITE_API_URL || window.location.origin
export const tok = () => localStorage.getItem('access_token') || ''
export const hdrs = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' })
export const api = (path, opts) => fetch(`${BASE}${path}`, { headers: hdrs(), ...opts })

const json = (path) => api(path).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

// Un appel par ressource ; chaque échec est isolé (réponse partielle acceptée) et nommé.
const RESSOURCES = {
  voyages: '/api/voyages/?page_size=200',
  stats: '/api/voyages/stats/',
  personnel: '/api/personnel/?page_size=500&actif=true&droit_mobilite=true',
  rotations: '/api/voyages/rotations/',
  rappels: '/api/voyages/rappels_rotation/',
  flotte: '/api/vehicules-flotte/',
  retoursAnticipes: '/api/voyages/retours_anticipes/',
  demandesAOrganiser: '/api/voyages/demandes_a_organiser/',
  itineraires: '/api/itineraires-modeles/',
  demandesVoyageEnAttente: '/api/demandes/?type_demande=voyage&statut=en_attente&page_size=200',
}

const liste = (v) => v?.results || v || []

// Normalisation de chaque ressource vers la forme utilisée par l'interface.
const NORMALISER = {
  voyages: liste,
  stats: (v) => v || {},
  personnel: liste,
  rotations: (v) => v?.rotations || [],
  rappels: (v) => (Array.isArray(v) ? v : []),
  flotte: liste,
  retoursAnticipes: (v) => (Array.isArray(v) ? v : []),
  demandesAOrganiser: (v) => v?.demandes_a_organiser || [],
  itineraires: liste,
  demandesVoyageEnAttente: liste,
}

/** Charge tout le Centre de Mobilité. Renvoie { donnees, echecs } (echecs = noms des ressources en erreur). */
export async function chargerCentreMobilite() {
  const noms = Object.keys(RESSOURCES)
  const res = await Promise.allSettled(noms.map(n => json(RESSOURCES[n])))
  const donnees = {}, echecs = []
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') donnees[noms[i]] = NORMALISER[noms[i]](r.value)
    else echecs.push(noms[i])
  })
  return { donnees, echecs }
}
