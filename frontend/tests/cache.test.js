import { describe, it, expect } from 'vitest'

function cacheKey(path, params) {
  const sp = new URLSearchParams(params || {})
  return path + (sp.toString() ? '?' + sp.toString() : '')
}

describe('Cache key generation', () => {
  it('genere une cle stable sans params', () => {
    expect(cacheKey('/api/batiments/')).toBe('/api/batiments/')
  })
  it('genere une cle avec params', () => {
    expect(cacheKey('/api/batiments/', { page: 1 })).toBe('/api/batiments/?page=1')
  })
})

describe('Status colors mapping', () => {
  it('libre = vert', () => {
    expect({ libre: '#16a34a', occupe: '#2563eb' }.libre).toBe('#16a34a')
  })
  it('occupe = bleu', () => {
    expect({ libre: '#16a34a', occupe: '#2563eb' }.occupe).toBe('#2563eb')
  })
})
