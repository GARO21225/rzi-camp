import { describe, it, expect, beforeAll, vi } from 'vitest'

// Version anglaise de l'écran du flasheur (page Repas) : libellés de la barre
// d'onglets et messages du serveur au scan, dont ceux qui contiennent un nom.
describe('i18n — anglais, écran du flasheur', () => {
  let t
  beforeAll(async () => {
    // localStorage est simulé dans tests/setup.js : on lui fait renvoyer l'anglais
    localStorage.getItem.mockImplementation((k) => (k === 'rzc_lang' ? 'en' : null))
    vi.resetModules()
    const m = await import('../src/i18n/index.js')
    await m.i18nPret()
    t = m.t
  })

  it('traduit les onglets', () => {
    expect(t('Accueil')).toBe('Home')
    expect(t('Repas')).toBe('Meals')
    expect(t('Demandes')).toBe('Requests')
  })

  it('traduit les messages du scan, nom compris', () => {
    expect(t("DEMO AYA a déjà pris ce repas aujourd'hui")).toBe('DEMO AYA has already had this meal today')
    expect(t('QR invalide (signature incorrecte)')).toBe('Invalid QR (wrong signature)')
    expect(t('Personnel non trouvé: [X-1]')).toBe('Staff member not found: [X-1]')
  })
})
