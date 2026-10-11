// Utilitaires d'itinéraires partagés (jours de circulation, villes de descente).
export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
export const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const estCamp = (t) => /camp|sango/i.test(t || '')

// Villes où l'on peut descendre : étapes (hors origine) puis destination, sans doublon.
export function villesDescente(itin) {
  if (!itin) return []
  const vus = new Set([(itin.origine || '').trim().toLowerCase()])
  const villes = []
  ;[...(itin.etapes || [])].sort((x, y) => x.ordre - y.ordre).map(e => e.ville).concat(itin.destination)
    .forEach(v => { v = (v || '').trim(); if (v && !vus.has(v.toLowerCase())) { villes.push(v); vus.add(v.toLowerCase()) } })
  return villes
}

// Jours de circulation (0 = lundi) du trajet origine → destination d'après les itinéraires, ou null si libre.
// Même règle que ItineraireModele.jours_pour côté serveur : on raisonne par SENS (depuis / vers le camp).
export function joursPour(itineraires, origine, destination) {
  const o = estCamp(origine), d = estCamp(destination)
  if (o === d) return null
  const it = (itineraires || []).find(i => i.actif !== false && (i.jours_voyage || []).length && estCamp(i.origine) === o && estCamp(i.destination) === d)
  return it ? [...it.jours_voyage].sort((a, b) => a - b) : null
}

export const libelleJours = (jours) => (jours || []).map(j => JOURS[j]).join(', ')

// Date « AAAA-MM-JJ » → jour 0-6 (lundi = 0), sans décalage de fuseau.
export const jourSemaine = (iso) => {
  if (!iso) return null
  const [a, m, j] = String(iso).slice(0, 10).split('-').map(Number)
  const d = new Date(a, m - 1, j)
  return isNaN(d) ? null : (d.getDay() + 6) % 7
}

// Message si `iso` tombe un jour où le trajet ne circule pas (null = OK).
export function messageJour(itineraires, origine, destination, iso) {
  const jours = joursPour(itineraires, origine, destination)
  const j = jourSemaine(iso)
  if (!jours || j === null || jours.includes(j)) return null
  return `Ce trajet circule le ${libelleJours(jours)} uniquement (le ${new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR')} est un ${JOURS[j]}).`
}
