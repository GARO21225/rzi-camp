// Captures RÉELLES de la connexion, de l'accueil et de « Mon compte » — instance de DÉMO locale uniquement (seed_demo_t01.py).
// L'horloge du navigateur est fixée à 10h15 (heure d'Abidjan) pour afficher « Bonjour » : c'est l'écran réel à cette heure-là.
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'captures') + '/';
(async () => {
  const b = await chromium.launch();
  const opts = { ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Africa/Abidjan', permissions: ['notifications'] };
  // 1) Invite d'installation sur iPhone (affichée sur la page de connexion)
  let ctx = await b.newContext(opts); let pg = await ctx.newPage();
  await pg.clock.setFixedTime(new Date('2026-11-11T10:15:00Z'));
  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: OUT + '00_installation_iphone.png' }); console.log('shot 00'); await ctx.close();
  // 2) Parcours principal
  ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { try { sessionStorage.setItem('pwa-dismissed','1'); localStorage.setItem('rzi_push_masque', String(Date.now()+9e9)) } catch {} });
  pg = await ctx.newPage();
  await pg.clock.setFixedTime(new Date('2026-11-11T10:15:00Z'));
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 1000) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); };
  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await shot('01_connexion.png', 1500);
  await pg.fill('input[placeholder="Votre identifiant"], input[placeholder="Identifiant de connexion"]', 'demo.resident');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await shot('02_connexion_remplie.png', 400);
  await pg.getByText('Se connecter →').first().click();
  await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(6500);   // laisse passer le bandeau « Bienvenue »
  await shot('03_accueil.png', 300);
  await pg.getByText('Raccourcis').first().scrollIntoViewIfNeeded(); await pg.mouse.wheel(0, 150);
  await shot('04_accueil_raccourcis.png');
  await pg.getByText('Mes demandes').first().scrollIntoViewIfNeeded(); await pg.mouse.wheel(0, 120);
  await shot('05_accueil_demandes.png');
  await pg.locator('button[aria-label="Plus de pages"]').click();
  await shot('06_menu_plus.png', 1200);
  await pg.locator('.md-action', { hasText: 'Mon compte' }).click();
  await pg.waitForLoadState('networkidle'); await shot('07_mon_compte.png', 1500);
  await pg.getByText('🔐 Sécurité').click(); await shot('08_securite.png');
  const champs = pg.locator('input[type="password"]');
  await champs.nth(0).fill('DemoSiteLife2026!');
  await champs.nth(1).fill('Nouveau#Demo2026');
  await champs.nth(2).fill('Nouveau#Demo2026');
  await pg.getByText('Les mots de passe correspondent').scrollIntoViewIfNeeded();
  await shot('09_mdp_rempli.png', 600);
  await pg.locator('button', { hasText: '🔐 Modifier le mot de passe' }).click();
  await shot('10_mdp_modifie.png', 1200);
  await pg.waitForURL(u => String(u).includes('/login'), { timeout: 10000 });
  await shot('11_retour_connexion.png', 1500);
  await b.close();
})();
