// Parc de véhicules = celui de la page Réservations → Véhicules :
// parc serveur (VehiculeFlotte) + véhicules saisis localement dans ce navigateur (id « custom_… », pas encore synchronisés).
const CATS_LOCALES = { vehicules_4x4: '4x4', vehicules_pickup: 'pickup', vehicules_minibus: 'minibus' }

export function vehiculesDuParc(flotteServeur = [], fleetLocal = {}) {
  const serveur = (flotteServeur || []).filter(v => v.actif !== false)
  const connus = new Set(serveur.map(v => (v.matricule || '').trim().toLowerCase()).filter(Boolean))
  const locaux = []
  Object.entries(CATS_LOCALES).forEach(([cat, categorie]) => {
    ;(fleetLocal[cat] || []).filter(v => String(v.id).startsWith('custom_')).forEach(v => {
      const immat = (v.immat || '').trim()
      if (immat && connus.has(immat.toLowerCase())) return
      locaux.push({ id: `local_${v.id}`, nom: v.label, matricule: immat, capacite: v.capacite || 4, categorie, actif: true, local: true })
    })
  })
  return [...serveur, ...locaux]
}

export function lireFleetLocale() {
  try { return JSON.parse(localStorage.getItem('rzi_fleet_v1') || '{}') } catch { return {} }
}
