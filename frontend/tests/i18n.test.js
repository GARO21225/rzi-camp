import { describe, it, expect, beforeAll, vi } from 'vitest'

// Version anglaise de l'écran du flasheur (page Repas) : libellés de la barre
// d'onglets et messages du serveur au scan, dont ceux qui contiennent un nom.
describe('i18n — anglais, écran du flasheur', () => {
  let t, init
  beforeAll(async () => {
    // localStorage est simulé dans tests/setup.js : on lui fait renvoyer l'anglais
    localStorage.getItem.mockImplementation((k) => (k === 'rzc_lang' ? 'en' : null))
    vi.resetModules()
    const m = await import('../src/i18n/index.js')
    await m.i18nPret()
    t = m.t
    init = m.initI18n
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

  it('traduit les phrases du suivi de bus et de l\'accueil, ville ou date comprise', () => {
    expect(t('Chambre DEMO-A02')).toBe('Room DEMO-A02')
    expect(t('Départ prévu le Sunday 15 November à 06:00')).toBe('Departure scheduled on Sunday 15 November at 06:00')
    expect(t('Le bus arrive à BOUAKE vers 09h50')).toBe('The bus reaches BOUAKE around 09h50')
    expect(t('Haute')).toBe('High')
    expect(t('1 appareil(s) déclaré(s)')).toBe('1 appliance(s) declared')
    expect(t('✅ 2 appareil(s) énergivore(s) déclaré(s)')).toBe('✅ 2 power-hungry appliance(s) declared')
    expect(t('Ce trajet circule le lundi, mercredi, vendredi uniquement (le 17/11/2026 est un mardi).'))
      .toBe('This route only runs on Monday, Wednesday, Friday (17/11/2026 is a Tuesday).')
    expect(t('Retour : Le trajet ABIDJAN → CAMP circule le mardi, jeudi et samedi uniquement (02/12/2026 est un mercredi).'))
      .toBe('Return: The ABIDJAN → CAMP route only runs on Tuesday, Thursday and Saturday (02/12/2026 is a Wednesday).')
    expect(t("✅ Votre demande a été validée. Bon repos.")).toBe('✅ Your request has been approved. Bon repos.')
  })

  it("traduit le texte d'aide d'une zone de saisie, jamais ce qui est saisi", async () => {
    document.body.innerHTML = '<textarea placeholder="Décrivez le problème...">Le climatiseur est en panne</textarea>'
    init()
    await new Promise(r => setTimeout(r, 50))
    const z = document.querySelector('textarea')
    expect(z.getAttribute('placeholder')).toBe('Describe the problem...')
    expect(z.value).toBe('Le climatiseur est en panne')
  })
})
