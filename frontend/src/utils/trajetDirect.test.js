import { describe, it, expect } from 'vitest'
import { distanceKm, situerBus, kmRestants, vitesseEstimee, dureeLisible, memeLieu, FACTEUR_ROUTE } from './trajetDirect'

const ABJ = [5.36, -4.01], YAK = [6.82, -5.28], BKE = [7.69, -5.03], CAMP = [8.98, -5.65]
const arrets = [
  { ville: 'Abidjan', coords: ABJ }, { ville: 'Yamoussoukro', coords: YAK },
  { ville: 'Bouaké', coords: BKE }, { ville: 'Camp', coords: CAMP },
]

describe('trajetDirect', () => {
  it('distanceKm Abidjan → Yamoussoukro ≈ 215 km à vol d\'oiseau', () => {
    expect(distanceKm(ABJ, YAK)).toBeGreaterThan(200)
    expect(distanceKm(ABJ, YAK)).toBeLessThan(230)
  })

  it('situe le bus entre Yamoussoukro et Bouaké', () => {
    const bus = [7.2, -5.18]
    const pos = situerBus(bus, arrets)
    expect(pos.segment).toBe(1)
    expect(pos.suivant).toBe(2)
    expect(pos.passes).toEqual([0, 1])
  })

  it('km restants jusqu\'à la descente, 0 si dépassée', () => {
    const bus = [7.2, -5.18]
    const attendu = (distanceKm(bus, BKE) + distanceKm(BKE, CAMP)) * FACTEUR_ROUTE
    expect(kmRestants(bus, arrets, 3)).toBeCloseTo(attendu, 5)
    expect(kmRestants(bus, arrets, 1)).toBe(0)
    expect(kmRestants(null, arrets, 3)).toBeNull()
  })

  it('vitesse estimée bornée, 60 par défaut', () => {
    expect(vitesseEstimee({})).toBe(60)
    expect(vitesseEstimee({ distanceParcourueKm: 100, dureeH: 2 })).toBe(50)
    expect(vitesseEstimee({ distanceParcourueKm: 400, dureeH: 2 })).toBe(90)
  })

  it('durée lisible et lieux équivalents', () => {
    expect(dureeLisible(12)).toBe('12 min')
    expect(dureeLisible(85)).toBe('1 h 25')
    expect(memeLieu('CAMP', 'Camp Roxgold Sango')).toBe(true)
    expect(memeLieu('Bouaké', 'BOUAKE ')).toBe(true)
    expect(memeLieu('', '')).toBe(false)
  })
})
