import { describe, it, expect } from 'vitest'
import { fmt, toISO, addDays } from './format'

describe('fmt', () => {
  it('formate une date ISO en jour/mois abrégé fr-FR', () => {
    expect(fmt('2026-01-15')).toBe(new Date('2026-01-15').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }))
  })
  it('vide/absent => tiret', () => {
    expect(fmt(null)).toBe('—')
    expect(fmt('')).toBe('—')
  })
})

describe('toISO', () => {
  it('extrait AAAA-MM-JJ d\'une Date', () => {
    expect(toISO(new Date(Date.UTC(2026, 2, 7)))).toBe('2026-03-07')
  })
})

describe('addDays', () => {
  it('avance la date du nombre de jours donné, sans muter l\'originale', () => {
    const d = new Date(2026, 0, 30)
    const r = addDays(d, 3)
    expect(r.getDate()).toBe(2)
    expect(r.getMonth()).toBe(1) // février : le mois a bien basculé
    expect(d.getDate()).toBe(30) // l'original n'a pas changé
  })
  it('accepte un nombre négatif (recul)', () => {
    const r = addDays(new Date(2026, 1, 1), -1)
    expect(r.getDate()).toBe(31)
    expect(r.getMonth()).toBe(0)
  })
})
