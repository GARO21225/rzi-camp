import { describe, it, expect } from 'vitest'
import {
  formatDate, formatDateTime, formatNumber, formatPercent,
  statusColor, statusLabel, pct, relativeTime,
} from '../src/utils/format'

describe('utils/format', () => {
  describe('formatDate', () => {
    it('retourne "—" pour null/undefined', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate(undefined)).toBe('—')
    })

    it('formate une date en français', () => {
      const d = new Date('2026-06-15T10:00:00Z')
      const result = formatDate(d)
      expect(result).toMatch(/15/)
      expect(result).toMatch(/juin|06|2026/)
    })
  })

  describe('formatNumber', () => {
    it('formate avec séparateurs français', () => {
      expect(formatNumber(1247)).toBe('1 247')
      expect(formatNumber(1000000)).toBe('1 000 000')
    })

    it('retourne "—" pour null/undefined', () => {
      expect(formatNumber(null)).toBe('—')
      expect(formatNumber(undefined)).toBe('—')
    })
  })

  describe('formatPercent', () => {
    it('ajoute le symbole %', () => {
      expect(formatPercent(45.6)).toBe('46%')
      expect(formatPercent(45.6, 1)).toBe('45.6%')
    })
  })

  describe('statusColor', () => {
    it('mappe les statuts vers les bonnes classes', () => {
      expect(statusColor('ok')).toBe('badge-ok')
      expect(statusColor('Occupé')).toBe('badge-ok')
      expect(statusColor('warn')).toBe('badge-warn')
      expect(statusColor('maintenance')).toBe('badge-warn')
      expect(statusColor('alert')).toBe('badge-alert')
      expect(statusColor('critique')).toBe('badge-alert')
      expect(statusColor('empty')).toBe('badge-ink')
      expect(statusColor('libre')).toBe('badge-ink')
      expect(statusColor('planifie')).toBe('badge-info')
    })

    it('retourne badge-ink par défaut', () => {
      expect(statusColor('unknown')).toBe('badge-ink')
    })
  })

  describe('statusLabel', () => {
    it('traduit les statuts en français', () => {
      expect(statusLabel('ok')).toBe('Occupé')
      expect(statusLabel('Occupé')).toBe('Occupé')
      expect(statusLabel('resolu')).toBe('Résolu')
      expect(statusLabel('termine')).toBe('Terminé')
      expect(statusLabel('warn')).toBe('Maintenance')
      expect(statusLabel('maintenance')).toBe('Maintenance')
      expect(statusLabel('en_cours')).toBe('En cours')
      expect(statusLabel('alert')).toBe('Alerte')
      expect(statusLabel('critique')).toBe('Critique')
      expect(statusLabel('empty')).toBe('Inoccupé')
      expect(statusLabel('libre')).toBe('Libre')
      expect(statusLabel('planifie')).toBe('Planifié')
    })
  })

  describe('pct', () => {
    it('calcule un pourcentage', () => {
      expect(pct(50, 100)).toBe(50)
      expect(pct(75, 200)).toBe(38)
    })

    it('retourne 0 si total est 0', () => {
      expect(pct(5, 0)).toBe(0)
    })

    it('plafonne à 100%', () => {
      expect(pct(150, 100)).toBe(100)
    })
  })

  describe('relativeTime', () => {
    it('retourne "à l\'instant" pour date récente', () => {
      const d = new Date()
      expect(relativeTime(d.toISOString())).toBe("à l'instant")
    })

    it('retourne "—" pour null', () => {
      expect(relativeTime(null)).toBe('—')
    })
  })
})
