import { describe, it, expect } from 'vitest'
import { villesDescente, joursPour, jourSemaine, messageJour, libelleJours, JOURS } from './itineraires'

describe('villesDescente', () => {
  it('sans itinéraire : liste vide', () => {
    expect(villesDescente(null)).toEqual([])
  })

  it('étapes triées par ordre + destination, sans doublon avec l\'origine', () => {
    const itin = {
      origine: 'Abidjan',
      etapes: [{ ville: 'Yamoussoukro', ordre: 2 }, { ville: 'Bouaké', ordre: 1 }],
      destination: 'Abidjan', // boucle : ne doit pas réapparaître si déjà vu
    }
    expect(villesDescente(itin)).toEqual(['Bouaké', 'Yamoussoukro'])
  })

  it('ignore la casse pour détecter les doublons', () => {
    const itin = { origine: 'ABIDJAN', etapes: [{ ville: 'abidjan', ordre: 1 }], destination: 'Yamoussoukro' }
    expect(villesDescente(itin)).toEqual(['Yamoussoukro'])
  })
})

describe('jourSemaine', () => {
  it('lundi = 0, dimanche = 6 (pas la convention JS getDay())', () => {
    expect(jourSemaine('2026-10-19')).toBe(0)  // lundi
    expect(jourSemaine('2026-10-25')).toBe(6)  // dimanche
    expect(jourSemaine('2026-10-22')).toBe(3)  // jeudi
  })

  it('vide ou invalide => null, jamais une exception', () => {
    expect(jourSemaine(null)).toBeNull()
    expect(jourSemaine('')).toBeNull()
    expect(jourSemaine('pas-une-date')).toBeNull()
  })
})

describe('joursPour', () => {
  const itineraires = [
    { origine: 'Camp Sango', destination: 'Abidjan', actif: true, jours_voyage: [4, 6] },
  ]

  it('même sens (camp->camp ou ville->ville) : pas de contrainte (null)', () => {
    expect(joursPour(itineraires, 'Abidjan', 'Abidjan')).toBeNull()
  })

  it('trajet connu : renvoie les jours de circulation triés', () => {
    expect(joursPour(itineraires, 'Camp Sango', 'Abidjan')).toEqual([4, 6])
  })

  it('trajet retour (sens inverse) : pas la même entrée, repli sur la règle par défaut Abidjan<->Camp', () => {
    expect(joursPour(itineraires, 'Abidjan', 'Camp Sango')).toEqual([1, 3, 5])
  })

  it('aucun itinéraire enregistré et pas Abidjan<->Camp : libre (null)', () => {
    expect(joursPour([], 'Bouaké', 'Daloa')).toBeNull()
  })
})

describe('libelleJours', () => {
  it('traduit les indices en noms de jours', () => {
    expect(libelleJours([0, 4])).toBe(`${JOURS[0]}, ${JOURS[4]}`)
  })
  it('vide/absent => chaîne vide', () => {
    expect(libelleJours(null)).toBe('')
  })
})

describe('messageJour', () => {
  const itineraires = [{ origine: 'Camp Sango', destination: 'Abidjan', actif: true, jours_voyage: [4] }]

  it('jour autorisé : aucun message', () => {
    // 2026-10-23 est un vendredi (jour 4)
    expect(messageJour(itineraires, 'Camp Sango', 'Abidjan', '2026-10-23')).toBeNull()
  })

  it('jour interdit : message explicite nommant le jour choisi et les jours autorisés', () => {
    // 2026-10-22 est un jeudi (jour 3), le trajet ne circule que le vendredi
    const msg = messageJour(itineraires, 'Camp Sango', 'Abidjan', '2026-10-22')
    expect(msg).toMatch(/vendredi uniquement/)
    expect(msg).toMatch(/jeudi/)
  })
})
