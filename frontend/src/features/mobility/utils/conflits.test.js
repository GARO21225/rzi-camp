import { describe, it, expect } from 'vitest'
import { datesChevauchent, rotationsEnConflit, vehiculeOccupe, conducteurOccupe, personnelOccupe } from './conflits'

describe('datesChevauchent', () => {
  it('périodes qui se croisent', () => {
    expect(datesChevauchent('2026-01-05', '2026-01-10', '2026-01-08', '2026-01-15')).toBe(true)
  })
  it('périodes disjointes', () => {
    expect(datesChevauchent('2026-01-01', '2026-01-05', '2026-01-10', '2026-01-15')).toBe(false)
  })
  it('bornes qui se touchent exactement = chevauchement', () => {
    expect(datesChevauchent('2026-01-01', '2026-01-10', '2026-01-10', '2026-01-20')).toBe(true)
  })
  it('une date manquante => pas de chevauchement (on ne peut pas conclure)', () => {
    expect(datesChevauchent(null, '2026-01-10', '2026-01-08', '2026-01-15')).toBe(false)
  })
})

describe('rotationsEnConflit', () => {
  const rotations = [
    { rotation_id: 1, statut: 'planifie', date_depart: '2026-01-05', date_retour_prevue: '2026-01-10' },
    { rotation_id: 2, statut: 'annule', date_depart: '2026-01-05', date_retour_prevue: '2026-01-10' },
    { rotation_id: 3, statut: 'en_voyage', date_depart: '2026-02-01', date_retour_prevue: '2026-02-05' },
  ]

  it('ne retient que les rotations actives (planifie/en_voyage) qui chevauchent la période', () => {
    const r = rotationsEnConflit(rotations, '2026-01-06', '2026-01-08')
    expect(r.map(x => x.rotation_id)).toEqual([1])
  })

  it('exclut la rotation en cours de modification', () => {
    const r = rotationsEnConflit(rotations, '2026-01-06', '2026-01-08', 1)
    expect(r).toEqual([])
  })
})

describe('vehiculeOccupe / conducteurOccupe', () => {
  const rotations = [
    { rotation_id: 1, statut: 'planifie', date_depart: '2026-01-05', date_retour_prevue: '2026-01-10', vehicule_matricule: 'CI-123-AB', conducteur: 'Jean Koné', conducteur_secondaire: 'Awa Diallo' },
  ]

  it('détecte le véhicule déjà affecté sur la période, insensible à la casse/espaces', () => {
    expect(vehiculeOccupe(' ci-123-ab ', rotations, '2026-01-06', '2026-01-08')).toEqual(rotations[0])
  })
  it('véhicule libre sur cette période => null', () => {
    expect(vehiculeOccupe('CI-123-AB', rotations, '2026-03-01', '2026-03-05')).toBeNull()
  })
  it('détecte un conducteur déjà engagé, qu\'il soit principal ou second', () => {
    expect(conducteurOccupe('Jean Koné', rotations, '2026-01-06', '2026-01-08')).toEqual(rotations[0])
    expect(conducteurOccupe('Awa Diallo', rotations, '2026-01-06', '2026-01-08')).toEqual(rotations[0])
  })
  it('sans matricule/nom fourni => pas de conflit à signaler', () => {
    expect(vehiculeOccupe('', rotations, '2026-01-06', '2026-01-08')).toBeNull()
    expect(conducteurOccupe(null, rotations, '2026-01-06', '2026-01-08')).toBeNull()
  })
})

describe('personnelOccupe', () => {
  const voyages = [
    { personnel: 42, statut: 'planifie', date_depart: '2026-01-05', date_retour_prevue: '2026-01-10' },
    { personnel: 42, statut: 'annule', date_depart: '2026-01-05', date_retour_prevue: '2026-01-10' },
  ]

  it('signale un passager déjà engagé sur un autre voyage actif qui chevauche', () => {
    expect(personnelOccupe(42, voyages, '2026-01-06', '2026-01-08')).toEqual(voyages[0])
  })
  it('un voyage annulé ne compte pas comme conflit', () => {
    expect(personnelOccupe(99, voyages, '2026-01-06', '2026-01-08')).toBeNull()
  })
  it('sans date de départ => pas de contrôle possible', () => {
    expect(personnelOccupe(42, voyages, null, '2026-01-08')).toBeNull()
  })
})
