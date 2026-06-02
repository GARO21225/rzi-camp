
import { describe, it, expect } from 'vitest'

// Helper à utiliser partout : unwrap une réponse axios paginée
export const unwrap = (r) => r?.data?.results || r?.data || r || []

describe('unwrap', () => {
  it('extrait results d\'une réponse paginée axios', () => {
    const r = { data: { count: 5, results: [1, 2, 3] }, status: 200 }
    expect(unwrap(r)).toEqual([1, 2, 3])
  })
  it('retourne un tableau direct si pas de .data', () => {
    expect(unwrap([1, 2, 3])).toEqual([1, 2, 3])
  })
  it('retourne [] pour null/undefined', () => {
    expect(unwrap(null)).toEqual([])
    expect(unwrap(undefined)).toEqual([])
  })
  it('retourne [] pour réponse sans results', () => {
    expect(unwrap({ data: null })).toEqual([])
  })
})
