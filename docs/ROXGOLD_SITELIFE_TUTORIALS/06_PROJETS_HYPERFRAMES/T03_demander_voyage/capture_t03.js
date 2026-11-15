// Captures RÉELLES : demande de voyage par un résident, validation par l'administration (API), suivi côté résident.
// Instance de DÉMO locale uniquement (seed_demo_t03.py), jamais la production. Horloge du navigateur : aujourd'hui 10h15 (Abidjan).
const { chromium, devices } = require('playwright');
const path = require('path');
// LANGUE=fr (défaut, captures/) ou LANGUE=en (application en anglais, captures/en/) — voir ../_commun/langue_capture.js
const { ceMatin, jourPlus, ecartJour, T, L, dossier, locale, lancement, initScript, textesNonTraduits } = require(path.join(__dirname, '..', '_commun', 'langue_capture.js'));
const OUT = dossier(__dirname);
const API = 'http://127.0.0.1:8000';
(async () => {
  // Navigateur dans la langue de capture (variables d'environnement) : champs de date au format du téléphone (jj/mm/aaaa)
  const b = await chromium.launch(lancement);
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale, timezoneId: 'Africa/Abidjan', permissions: ['notifications'] });
  await ctx.addInitScript(...initScript);
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(ceMatin());
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 1000) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); (await textesNonTraduits(pg)).forEach(t => console.log('NT', t)); };
  const voir = async (sel) => { await sel.scrollIntoViewIfNeeded(); return sel; };

  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await pg.locator('input:not([type="password"])').first().fill('demo.resident');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await pg.locator('input[type="password"]').press('Enter');
  await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(6500);
  await shot('01_accueil_sans_trajet.png', 300);
  await pg.getByText(T('🚌 Demander un voyage')).first().click();
  await pg.waitForLoadState('networkidle'); await shot('02_demandes.png', 1500);
  await pg.locator(`button[aria-label="${T('Planifier voyage')}"]`).last().click();
  await shot('03_formulaire.png');
  const itin = pg.locator('select', { has: pg.locator('option', { hasText: T('— Sélectionner un itinéraire —') }) });
  await itin.selectOption({ label: 'Camp → Abidjan (CAMP → ABIDJAN)' });
  await shot('04_itineraire.png', 700);
  const dates = pg.locator('input[type="date"]');
  // Camp → Abidjan circule lundi, mercredi, vendredi ; le retour Abidjan → Camp mardi, jeudi, samedi
  const aller = ecartJour(3, [1, 3, 5]), retour = ecartJour(aller + 10, [2, 4, 6]);
  await (await voir(dates.nth(0))).fill(jourPlus(aller));
  await dates.nth(1).fill(jourPlus(retour));
  await shot('05_transport_dates.png', 600);
  const motif = pg.locator('select', { has: pg.locator('option', { hasText: T('— Choisir un motif —') }) });
  await (await voir(motif)).selectOption('repos');
  await pg.fill(`textarea[placeholder="${T('Précisions éventuelles...')}"]`, L('Fin de rotation — demande de démonstration.', 'End of rotation — demo request.'));
  await pg.getByText(T('📤 Soumettre la demande')).scrollIntoViewIfNeeded();
  await shot('06_motif_soumettre.png', 500);
  await pg.getByText(T('📤 Soumettre la demande')).click();
  await pg.waitForLoadState('networkidle'); await shot('07_demande_en_attente.png', 1800);

  // ── L'administration valide la demande (comme depuis Centre de Mobilité › Validations) ──
  const tok = (await (await fetch(API + '/api/auth/login/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo.admin', password: 'DemoSiteLife2026!' }) })).json()).access;
  const H = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  const liste = await (await fetch(API + '/api/demandes/?type_demande=voyage', { headers: H })).json();
  const d = (liste.results || liste).find(x => x.statut === 'en_attente');
  const r = await fetch(API + `/api/demandes/${d.id}/valider/`, { method: 'POST', headers: H, body: JSON.stringify({ commentaire: L('Demande validée — bon repos.', 'Request approved — enjoy your rest.') }) });
  console.log('validation', r.status);

  await pg.reload(); await pg.waitForLoadState('networkidle'); await shot('08_demande_validee.png', 2500);
  await pg.goto('http://127.0.0.1:5173/accueil'); await pg.waitForLoadState('networkidle'); await shot('09_accueil_trajet.png', 3500);
  await pg.locator('header button, button').filter({ has: pg.locator('svg') }).nth(1).click().catch(() => {});
  await shot('10_notification.png', 1500);
  await b.close();
})();
