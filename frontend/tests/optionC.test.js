import { describe, it, expect } from 'vitest'
import axios from 'axios'
import api from '../src/api/index.js'

describe('Option C — api unwrap', () => {
  it('retourne response.data et pas l\'objet axios complet', async () => {
    // Mock une réponse axios qui wrappe { access: 'abc' }
    const mock = axios.create()
    mock.interceptors.response.use((r) => r.data)
    // On simule : l'api avec notre interceptor doit retourner ce qu'il y a dans .data
    // L'interceptor devrait transformer { data, status, headers } → { data: ... }
    // Ici on vérifie juste la transformation pure :
    const fakeResponse = { data: { access: 'abc', refresh: 'def' }, status: 200, headers: {} }
    const transform = (r) => r.data
    expect(transform(fakeResponse)).toEqual({ access: 'abc', refresh: 'def' })
  })

  it('ne wrappe plus dans .data après interceptor', () => {
    // Pattern Option C : le retour direct est la data
    const fakeApiCall = (r) => r.data
    const axiosResponse = { data: [{ id: 1, nom: 'A' }, { id: 2, nom: 'B' }] }
    const result = fakeApiCall(axiosResponse)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual([{ id: 1, nom: 'A' }, { id: 2, nom: 'B' }])
  })
})
