import { describe, it, expect } from 'vitest'
import { calculerVueEnsemble } from './vueEnsemble'

const today = '2026-10-12'

describe('calculerVueEnsemble', () => {
  const base = {
    today,
    rotations: [
      { rotation_id: 'A', statut: 'planifie', date_depart: today, conducteur: '', nb_passagers: 0, nb_places_total: 15, places_libres: 15, vehicule: 'BUS', destination: 'Abidjan' },
      { rotation_id: 'B', statut: 'en_voyage', date_depart: today, conducteur: 'X', nb_passagers: 10, nb_places_total: 15, places_libres: 5 },
    ],
    voyages: [
      { id: 1, statut: 'en_voyage', statut_validation: 'valide', date_retour_prevue: '2026-10-10', rotation_id: 'B' },
      { id: 2, statut: 'planifie', statut_validation: 'valide' },
      { id: 3, statut: 'annule' },
    ],
    demandesAOrganiser: [], demandesVoyageEnAttente: [1],
    rappels: [{ en_retard: true, personnel_nom: 'Z', jours_restants: -2 }],
  }

  it('compte les indicateurs à partir des données réelles', () => {
    const v = calculerVueEnsemble(base)
    expect(v.departsAujourdhui).toHaveLength(1)
    expect(v.voyagesEnCours).toHaveLength(1)
    expect(v.retoursAttendus).toHaveLength(1)
    expect(v.aOrganiser).toBe(1)          // le voyage 2 n'a ni convoi ni véhicule personnel ; l'annulé est ignoré
    expect(v.enAttenteValidation).toBe(1)
    expect(v.capacite).toEqual({ places: 30, occupees: 10, pct: 33 })
  })

  it('signale convoi sans conducteur / sans passager et retour en retard', () => {
    const textes = calculerVueEnsemble(base).alertes.map(a => a.texte)
    expect(textes.some(t => t.includes('aucun conducteur'))).toBe(true)
    expect(textes.some(t => t.includes('aucun passager'))).toBe(true)
    expect(textes.some(t => t.includes('retour prévu il y a 2 j'))).toBe(true)
  })

  it('ne plante pas sans données et ne fabrique aucun pourcentage', () => {
    const v = calculerVueEnsemble({ today })
    expect(v.alertes).toEqual([])
    expect(v.capacite.pct).toBeNull()
  })
})
