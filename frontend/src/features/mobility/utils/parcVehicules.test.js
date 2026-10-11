import { describe, it, expect } from 'vitest'
import { vehiculesDuParc } from './parcVehicules'

describe('vehiculesDuParc', () => {
  const serveur = [{ id: 1, nom: 'Bus 01', matricule: '1234AB01', capacite: 30, categorie: 'bus', actif: true }, { id: 2, nom: 'Vieux', matricule: 'X', actif: false }]
  it('ajoute les véhicules locaux de la page Réservations et ignore inactifs/doublons', () => {
    const fleet = { vehicules_4x4: [
      { id: 'custom_9', label: 'Hilux perso', immat: '9999ZZ01', capacite: 5 },
      { id: 'custom_8', label: 'Doublon', immat: '1234ab01', capacite: 5 },
      { id: 'veh_1', label: 'Déjà serveur', immat: 'AAA' },
    ] }
    const r = vehiculesDuParc(serveur, fleet)
    expect(r.map(v => v.nom)).toEqual(['Bus 01', 'Hilux perso'])
    expect(r[1]).toMatchObject({ matricule: '9999ZZ01', categorie: '4x4', local: true })
  })
  it('fonctionne sans parc local', () => { expect(vehiculesDuParc(serveur, {})).toHaveLength(1) })
})
