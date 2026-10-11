import { describe, it, expect } from 'vitest'
import { statutGps, verifierEnvironnement, demanderPosition, positionFraiche, messageErreur } from './gps'

describe('statutGps', () => {
  it('ne prétend jamais que la localisation est active sans position réelle', () => {
    expect(statutGps({ permission: 'granted' })).toBe('autorisee')
    expect(statutGps({ permission: null })).toBe('requise')
    expect(statutGps({ permission: 'prompt' })).toBe('requise')
    expect(statutGps({ permission: 'denied' })).toBe('non_autorisee')
    expect(statutGps({ permission: 'granted', enRecherche: true })).toBe('recherche')
    expect(statutGps({ permission: 'granted', position: { lat: 1, lng: 1, t: 1 } })).toBe('active')
    expect(statutGps({ erreur: 'refuse' })).toBe('non_autorisee')
    expect(statutGps({ erreur: 'delai' })).toBe('erreur')
  })
})

describe('environnement et lecture', () => {
  it('détecte HTTPS absent et GPS absent', () => {
    expect(verifierEnvironnement({ isSecureContext: false }, { geolocation: {} }).code).toBe('non_securise')
    expect(verifierEnvironnement({ isSecureContext: true }, {}).code).toBe('absent')
    expect(verifierEnvironnement({ isSecureContext: true }, { geolocation: {} })).toBeNull()
  })
  it('traduit refus, délai, indisponible et succès', async () => {
    const env = { isSecureContext: true }
    const mk = (r) => ({ geolocation: { getCurrentPosition: (ok, ko) => r.err ? ko({ code: r.err }) : ok({ coords: { latitude: 5, longitude: -4, accuracy: 9 }, timestamp: 42 }) } })
    expect((await demanderPosition({}, mk({ err: 1 }), env)).code).toBe('refuse')
    expect((await demanderPosition({}, mk({ err: 3 }), env)).code).toBe('delai')
    expect((await demanderPosition({}, mk({ err: 2 }), env)).code).toBe('indisponible')
    const ok = await demanderPosition({}, mk({}), env)
    expect(ok.ok).toBe(true); expect(ok.horodatage).toBe(42)
    expect((await demanderPosition({}, mk({}), { isSecureContext: false })).code).toBe('non_securise')
  })
  it('fraîcheur de la position avant départ', () => {
    expect(positionFraiche({ lat: 5, lng: -4, t: 1000 }, 2000)).toBe(true)
    expect(positionFraiche({ lat: 5, lng: -4, t: 1000 }, 100000)).toBe(false)
    expect(positionFraiche(null)).toBe(false)
  })
  it('messages explicites', () => {
    expect(messageErreur('delai')).toMatch(/Délai/)
    expect(messageErreur('refuse', 'Aide.')).toMatch(/refusée\. Aide\./)
  })
})
