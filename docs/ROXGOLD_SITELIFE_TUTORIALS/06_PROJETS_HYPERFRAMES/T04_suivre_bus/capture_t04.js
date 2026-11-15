// Captures RÉELLES du suivi de bus en direct côté passager — instance de DÉMO locale uniquement (seed_demo_t04.py,
// à lancer JUSTE AVANT : les positions doivent être récentes). Heure réelle (pas d'horloge figée) pour que
// l'heure d'arrivée estimée et « actualisé à » restent cohérentes avec les positions reçues par le serveur.
const { chromium, devices } = require('playwright');
const path = require('path');
// LANGUE=fr (défaut, captures/) ou LANGUE=en (application en anglais, captures/en/) — voir ../_commun/langue_capture.js
const { T, L, dossier, locale, lancement, initScript, textesNonTraduits } = require(path.join(__dirname, '..', '_commun', 'langue_capture.js'));
const OUT = dossier(__dirname);
(async () => {
  const b = await chromium.launch(lancement);
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale, timezoneId: 'Africa/Abidjan', permissions: ['notifications'] });
  await ctx.addInitScript(...initScript);
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 1000) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); (await textesNonTraduits(pg)).forEach(t => console.log('NT', t)); };
  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await pg.locator('input:not([type="password"])').first().fill('demo.resident');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await pg.locator('input[type="password"]').press('Enter');
  await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(6500);
  await shot('01_accueil_trajet_en_cours.png', 300);
  await pg.getByText(/Suivre mon bus en direct|Track my bus live/).first().click();
  await pg.waitForLoadState('networkidle'); await shot('02_suivi_carte.png', 7000);
  await pg.getByText(T('Parcours')).first().scrollIntoViewIfNeeded();
  await shot('03_suivi_parcours.png', 1200);
  const bus = pg.getByText(/Le bus est entre|The bus is between/).first();
  if (await bus.count()) { await bus.scrollIntoViewIfNeeded(); await shot('04_suivi_bus_entre.png', 800); }
  await pg.locator(`button[aria-label="${T('Fermer')}"]`).first().click();
  await pg.goto('http://127.0.0.1:5173/voyages'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(2500);
  // La liste est triée du plus récent au plus ancien : le retour planifié (convoi à venir) passe en premier.
  // On amène à l'écran la ligne du trajet EN COURS (Camp → Yamoussoukro), celle que l'on suit.
  const ligne = pg.locator('tr', { hasText: /CAMP\s*→\s*YAMOUSSOUKRO/ }).first();
  await ligne.evaluate(el => el.scrollIntoView({ block: 'center' }));
  const bt = await ligne.getByText(/Suivre en direct|Track live/).boundingBox();
  console.log('bouton 05 (px x3)', Math.round(bt.x*3), Math.round(bt.y*3), Math.round(bt.width*3), Math.round(bt.height*3));
  await shot('05_voyages.png', 1200);
  await b.close();
})();
