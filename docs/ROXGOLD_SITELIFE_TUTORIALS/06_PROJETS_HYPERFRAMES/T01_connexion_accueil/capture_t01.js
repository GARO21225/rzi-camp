// Captures RÉELLES de la connexion, de l'accueil et de « Mon compte » — instance de DÉMO locale uniquement (seed_demo_t01.py).
// L'horloge du navigateur est fixée à aujourd'hui 10h15 (heure d'Abidjan) pour afficher « Bonjour » : c'est l'écran réel à cette heure-là.
// LANGUE=fr (défaut, captures/) ou LANGUE=en (application en anglais, captures/en/) — voir ../_commun/langue_capture.js
const { chromium, devices } = require('playwright');
const path = require('path');
const { ceMatin, jourPlus, LANGUE, T, dossier, locale, lancement, initScript, textesNonTraduits } = require(path.join(__dirname, '..', '_commun', 'langue_capture.js'));
const OUT = dossier(__dirname);
(async () => {
  const b = await chromium.launch(lancement);
  const opts = { ...devices['iPhone 13'], locale, timezoneId: 'Africa/Abidjan', permissions: ['notifications'] };
  // 1) Invite d'installation sur iPhone (affichée sur la page de connexion)
  let ctx = await b.newContext(opts); await ctx.addInitScript((l) => { try { localStorage.setItem('rzc_lang', l) } catch {} }, LANGUE); let pg = await ctx.newPage();
  await pg.clock.setFixedTime(ceMatin());
  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: OUT + '00_installation_iphone.png' }); console.log('shot 00'); await ctx.close();
  // 2) Parcours principal
  ctx = await b.newContext(opts);
  await ctx.addInitScript(...initScript);
  pg = await ctx.newPage();
  await pg.clock.setFixedTime(ceMatin());
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 1000) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); (await textesNonTraduits(pg)).forEach(t => console.log('NT', t)); };
  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await shot('01_connexion.png', 1500);
  await pg.locator('input:not([type="password"])').first().fill('demo.resident');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await shot('02_connexion_remplie.png', 400);
  await pg.locator('input[type="password"]').press('Enter');
  await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(6500);   // laisse passer le bandeau « Bienvenue »
  await shot('03_accueil.png', 300);
  await pg.getByText(T('Raccourcis')).first().scrollIntoViewIfNeeded(); await pg.mouse.wheel(0, 150);
  await shot('04_accueil_raccourcis.png');
  await pg.getByText(T('Mes demandes')).first().scrollIntoViewIfNeeded(); await pg.mouse.wheel(0, 120);
  await shot('05_accueil_demandes.png');
  await pg.locator(`button[aria-label="${T('Plus de pages')}"]`).click();
  await shot('06_menu_plus.png', 1200);
  await pg.locator('.md-action', { hasText: T('Mon compte') }).click();
  await pg.waitForLoadState('networkidle'); await shot('07_mon_compte.png', 1500);
  await pg.getByText(T('🔐 Sécurité')).click(); await shot('08_securite.png');
  const champs = pg.locator('input[type="password"]');
  await champs.nth(0).fill('DemoSiteLife2026!');
  await champs.nth(1).fill('Nouveau#Demo2026');
  await champs.nth(2).fill('Nouveau#Demo2026');
  await pg.getByText(T('✅ Les mots de passe correspondent')).scrollIntoViewIfNeeded();
  await shot('09_mdp_rempli.png', 600);
  await pg.locator('button', { hasText: T('🔐 Modifier le mot de passe') }).click();
  await shot('10_mdp_modifie.png', 1200);
  await pg.waitForURL(u => String(u).includes('/login'), { timeout: 10000 });
  await shot('11_retour_connexion.png', 1500);
  await b.close();
})();
