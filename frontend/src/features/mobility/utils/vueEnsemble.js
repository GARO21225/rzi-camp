// Indicateurs de la « Vue d'ensemble » du Centre de Mobilité.
// Fonction pure : tout est calculé à partir des données DÉJÀ chargées par MissionControl
// (voyages, rotations, demandes…) — aucune statistique inventée.

const jour = (d) => (d ? String(d).slice(0, 10) : '')

export function calculerVueEnsemble({ voyages = [], rotations = [], demandesAOrganiser = [], demandesVoyageEnAttente = [], rappels = [], today }) {
  const actifs = voyages.filter(v => v.statut !== 'annule' && v.statut_validation !== 'refuse')

  const departsAujourdhui = rotations.filter(r => jour(r.date_depart) === today && r.statut === 'planifie')
  const rotationsEnCours = rotations.filter(r => r.statut === 'en_voyage')
  const voyagesEnCours = actifs.filter(v => v.statut === 'en_voyage')
  const retoursAttendus = actifs.filter(v => v.statut === 'en_voyage' && v.date_retour_prevue && jour(v.date_retour_prevue) <= today)

  // Voyages à organiser : demandes sans convoi + voyages planifiés sans convoi ni véhicule personnel
  const sansConvoi = actifs.filter(v => !v.rotation_id && !v.vehicule_personnel && ['planifie', 'en_voyage'].includes(v.statut)
    && !demandesAOrganiser.some(d => d.voyage_id === v.id))
  const aOrganiser = demandesAOrganiser.length + sansConvoi.length

  const enAttenteValidation = voyages.filter(v => v.statut_validation === 'en_attente').length + demandesVoyageEnAttente.length

  // Alertes opérationnelles (toutes vérifiables dans les données)
  const alertes = []
  rotations.filter(r => r.statut === 'planifie' && jour(r.date_depart) >= today).forEach(r => {
    if (!r.conducteur) alertes.push({ niveau: 'rouge', rotation_id: r.rotation_id, texte: `Convoi ${r.vehicule || r.rotation_id} du ${jour(r.date_depart)} : aucun conducteur` })
    if (!(r.nb_passagers > 0)) alertes.push({ niveau: 'ambre', rotation_id: r.rotation_id, texte: `Convoi ${r.vehicule || r.rotation_id} du ${jour(r.date_depart)} : aucun passager` })
    if (r.places_libres === 0) alertes.push({ niveau: 'ambre', rotation_id: r.rotation_id, texte: `Convoi ${r.vehicule || r.rotation_id} du ${jour(r.date_depart)} : complet` })
  })
  rappels.filter(r => r.en_retard).forEach(r => alertes.push({ niveau: 'rouge', texte: `${r.personnel_nom} : retour prévu il y a ${Math.abs(r.jours_restants)} j` }))

  // Capacité / occupation des convois à venir (planifiés ou en route)
  const convoisActifs = rotations.filter(r => ['planifie', 'en_voyage'].includes(r.statut))
  const places = convoisActifs.reduce((s, r) => s + (r.nb_places_total || 0), 0)
  const occupees = convoisActifs.reduce((s, r) => s + (r.nb_passagers || 0), 0)

  return {
    departsAujourdhui, rotationsEnCours, voyagesEnCours, retoursAttendus,
    aOrganiser, enAttenteValidation, alertes,
    capacite: { places, occupees, pct: places ? Math.round(occupees / places * 100) : null },
  }
}
