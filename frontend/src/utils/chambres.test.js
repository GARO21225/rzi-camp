import { describe, it, expect } from 'vitest'
import { libelleResidentsPrincipaux } from './chambres'

describe('libelleResidentsPrincipaux', () => {
  it("chambre ordinaire libre : rien à afficher", () => {
    expect(libelleResidentsPrincipaux({})).toBe('')
  })

  it("chambre ordinaire déjà occupée par un autre résident", () => {
    const b = { resident_principal: { personnel_id: 7, personnel_nom: 'Koné A.' } }
    expect(libelleResidentsPrincipaux(b)).toBe('(déjà résidence principale de Koné A.)')
  })

  it("chambre ordinaire occupée par LA personne qu'on exclut (ex: son propre dossier) : rien à afficher", () => {
    const b = { resident_principal: { personnel_id: 7, personnel_nom: 'Koné A.' } }
    expect(libelleResidentsPrincipaux(b, 7)).toBe('')
  })

  it('chambre partagée : liste les colocataires avec le ratio occupé/max', () => {
    const b = {
      groupe_chambre: 'G1', residents_principaux_max: 3,
      residents_principaux: [
        { personnel_id: 1, personnel_nom: 'A' },
        { personnel_id: 2, personnel_nom: 'B' },
      ],
    }
    expect(libelleResidentsPrincipaux(b)).toBe('(chambre partagée G1 · 2/3 résidents : A, B)')
  })

  it('chambre partagée : exclut la personne en cours (ex: son propre nom ne doit pas apparaître)', () => {
    const b = {
      groupe_chambre: 'G1', residents_principaux_max: 3,
      residents_principaux: [{ personnel_id: 1, personnel_nom: 'A' }, { personnel_id: 2, personnel_nom: 'B' }],
    }
    expect(libelleResidentsPrincipaux(b, 1)).toBe('(chambre partagée G1 · 1/3 résidents : B)')
  })

  it('chambre partagée mais encore vide : pas de deux-points flottant', () => {
    const b = { residents_principaux_max: 2, residents_principaux: [] }
    expect(libelleResidentsPrincipaux(b)).toBe('(chambre partagée  · 0/2 résidents)')
  })
})
