import { describe, it, expect } from 'vitest'
import { auth, batiments, personnel, incidents, voyages, evenements } from '../src/api'

describe('API exports (V2 — fidele au V1)', () => {
  it('auth expose login et me', () => {
    expect(typeof auth.login).toBe('function')
    expect(typeof auth.me).toBe('function')
  })
  it('batiments expose list, get, update', () => {
    expect(typeof batiments.list).toBe('function')
    expect(typeof batiments.get).toBe('function')
    expect(typeof batiments.update).toBe('function')
  })
  it('personnel expose CRUD', () => {
    expect(typeof personnel.list).toBe('function')
    expect(typeof personnel.create).toBe('function')
    expect(typeof personnel.update).toBe('function')
    expect(typeof personnel.delete).toBe('function')
  })
  it('incidents expose workflow', () => {
    expect(typeof incidents.declarer).toBe('function')
    expect(typeof incidents.commencer).toBe('function')
    expect(typeof incidents.resoudre).toBe('function')
    expect(typeof incidents.cloturer).toBe('function')
  })
  it('voyages expose actions', () => {
    expect(typeof voyages.list).toBe('function')
    expect(typeof voyages.partir).toBe('function')
    expect(typeof voyages.revenir).toBe('function')
  })
  it('evenements expose actions', () => {
    expect(typeof evenements.list).toBe('function')
    expect(typeof evenements.create).toBe('function')
  })
})
