import { describe, it, expect } from 'vitest'
import { ESPACES, espacesVisibles, espaceDeVue } from './espaces'

describe('espaces du Centre de Mobilité', () => {
  const vues = ESPACES.flatMap(e => e.vues.map(v => v[0]))
  it('chaque vue existe dans un seul espace (rien perdu, rien en double)', () => {
    expect(new Set(vues).size).toBe(vues.length)
    ;['apercu', 'command', 'direct', 'rotations', 'organiser', 'gantt', 'manifest', 'calendrier', 'validations', 'liste']
      .forEach(v => expect(vues).toContain(v))
  })
  it('un non-admin ne voit ni Validations, ni À organiser, ni En direct', () => {
    const v = espacesVisibles(false)
    expect(v.find(e => e.id === 'validations')).toBeUndefined()
    const toutes = v.flatMap(e => e.vues.map(x => x[0]))
    expect(toutes).not.toContain('organiser'); expect(toutes).not.toContain('direct')
  })
  it('retrouve l\'espace d\'une vue', () => {
    expect(espaceDeVue('gantt')).toBe('planification')
    expect(espaceDeVue('liste')).toBe('passagers')
  })
})
