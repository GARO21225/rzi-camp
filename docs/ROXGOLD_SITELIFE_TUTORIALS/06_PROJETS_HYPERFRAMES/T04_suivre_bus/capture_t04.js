// Captures RÉELLES du suivi de bus en direct côté passager — instance de DÉMO locale uniquement (seed_demo_t04.py,
// à lancer JUSTE AVANT : les positions doivent être récentes). Heure réelle (pas d'horloge figée) pour que
// l'heure d'arrivée estimée et « actualisé à » restent cohérentes avec les positions reçues par le serveur.
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'captures') + '/';
(async () => {
  // Navigateur en français (dates et heures au format français)
  const b = await chromium.launch({ args: ['--lang=fr'], env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr', LC_ALL: 'fr_FR.UTF-8' } });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Africa/Abidjan', permissions: ['notifications'] });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('pwa-dismissed','1'); localStorage.setItem('rzi_push_masque', String(Date.now()+9e9)) } catch {} });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 1000) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); };
  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await pg.fill('input[placeholder="Votre identifiant"], input[placeholder="Identifiant de connexion"]', 'demo.resident');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await pg.getByText('Se connecter →').first().click();
  await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(6500);
  await shot('01_accueil_trajet_en_cours.png', 300);
  await pg.getByText('Suivre mon bus en direct').first().click();
  await pg.waitForLoadState('networkidle'); await shot('02_suivi_carte.png', 7000);
  await pg.getByText('Parcours').first().scrollIntoViewIfNeeded();
  await shot('03_suivi_parcours.png', 1200);
  const bus = pg.getByText('Le bus est entre').first();
  if (await bus.count()) { await bus.scrollIntoViewIfNeeded(); await shot('04_suivi_bus_entre.png', 800); }
  await pg.locator('button[aria-label="Fermer"]').first().click();
  await pg.goto('http://127.0.0.1:5173/voyages'); await pg.waitForLoadState('networkidle'); await shot('05_voyages.png', 2500);
  await b.close();
})();
