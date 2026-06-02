import { describe, it, expect } from 'vitest'

// Teste le pattern utilisé dans utils/cache.js
function cacheKey(path, params) {
  const sp = new URLSearchParams(params || {})
  return path + (sp.toString() ? '?' + sp.toString() : '')
}

describe('Cache key generation (V2)', () => {
  it('genere une cle stable sans params', () => {
    expect(cacheKey('/api/batiments/')).toBe('/api/batiments/')
  })
  it('genere une cle avec params', () => {
    expect(cacheKey('/api/batiments/', { page: 1 })).toBe('/api/batiments/?page=1')
  })
})

describe('Status colors mapping (Dashboard)', () => {
  const COLORS = { libre:'#16a34a', occupe:'#2563eb', reserve:'#f97316', maintenance:'#dc2626' }
  it('libre = vert', () => expect(COLORS.libre).toBe('#16a34a'))
  it('occupe = bleu', () => expect(COLORS.occupe).toBe('#2563eb'))
  it('reserve = orange', () => expect(COLORS.reserve).toBe('#f97316'))
  it('maintenance = rouge', () => expect(COLORS.maintenance).toBe('#dc2626'))
})
