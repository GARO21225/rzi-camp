import { describe, it, expect } from 'vitest'
import { generateBuildings, BUILDING_TYPES, STATUS_COLORS, STATUS_LABELS } from '../src/utils/buildings'

describe('utils/buildings', () => {
  describe('generateBuildings', () => {
    it('génère 204 bâtiments', () => {
      const b = generateBuildings()
      expect(b).toHaveLength(204)
    })

    it('chaque bâtiment a les champs requis', () => {
      const b = generateBuildings()
      for (const building of b) {
        expect(building).toHaveProperty('id')
        expect(building).toHaveProperty('section')
        expect(building).toHaveProperty('status')
        expect(building).toHaveProperty('lat')
        expect(building).toHaveProperty('lng')
        expect(building).toHaveProperty('chambres')
        expect(building).toHaveProperty('occupants')
        expect(building.id).toMatch(/^B-\d{3}$/)
      }
    })

    it('les statuts sont parmi les valeurs attendues', () => {
      const b = generateBuildings()
      const validStatuses = Object.keys(STATUS_COLORS)
      for (const building of b) {
        expect(validStatuses).toContain(building.status)
      }
    })

    it('les bâtiments vides ont 0 occupants', () => {
      const b = generateBuildings()
      const empty = b.filter((x) => x.status === 'empty')
      for (const building of empty) {
        expect(building.occupants).toBe(0)
      }
    })

    it('les occupants ne dépassent jamais le nombre de chambres', () => {
      const b = generateBuildings()
      for (const building of b) {
        expect(building.occupants).toBeLessThanOrEqual(building.chambres)
      }
    })

    it('génère des coordonnées GPS réalistes (autour du Burkina Faso)', () => {
      const b = generateBuildings()
      for (const building of b) {
        expect(building.lat).toBeGreaterThan(5)
        expect(building.lat).toBeLessThan(15)
        expect(building.lng).toBeGreaterThan(-5)
        expect(building.lng).toBeLessThan(5)
      }
    })
  })

  describe('constantes', () => {
    it('BUILDING_TYPES a les types attendus', () => {
      expect(BUILDING_TYPES).toHaveProperty('residentiel')
      expect(BUILDING_TYPES).toHaveProperty('bureau')
      expect(BUILDING_TYPES.residentiel).toHaveProperty('label')
      expect(BUILDING_TYPES.residentiel).toHaveProperty('color')
    })

    it('STATUS_COLORS couvre tous les statuts', () => {
      expect(STATUS_COLORS).toHaveProperty('ok')
      expect(STATUS_COLORS).toHaveProperty('warn')
      expect(STATUS_COLORS).toHaveProperty('alert')
      expect(STATUS_COLORS).toHaveProperty('empty')
    })

    it('STATUS_LABELS a les labels en français', () => {
      expect(STATUS_LABELS.ok).toBe('Occupé')
      expect(STATUS_LABELS.warn).toBe('Maintenance')
      expect(STATUS_LABELS.alert).toBe('Alerte')
      expect(STATUS_LABELS.empty).toBe('Inoccupé')
    })
  })
})
