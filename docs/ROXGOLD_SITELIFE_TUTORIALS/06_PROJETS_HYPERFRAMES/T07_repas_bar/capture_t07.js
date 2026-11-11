// Captures RÉELLES des pages Repas et Mon bar côté résident — instance de DÉMO locale uniquement (seed_demo_t07.py avant).
// Affiche aussi la position des éléments (en pixels de capture, ×3) pour placer les encadrés de la composition.
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'captures') + '/';
(async () => {
  const b = await chromium.launch({ args: ['--lang=fr'], env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr', LC_ALL: 'fr_FR.UTF-8' } });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Africa/Abidjan' });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('pwa-dismissed','1'); localStorage.setItem('rzi_push_masque', String(Date.now()+9e9)) } catch {} });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 1000) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); };
  const boite = async (nom, loc) => {
    const r = await loc.boundingBox();
    console.log('  ', nom, r ? [Math.round(r.x*3), Math.round(r.y*3), Math.round(r.width*3), Math.round(r.height*3)].join(',') : 'absent');
  };
  // Amène un élément juste sous l'en-tête de l'application (≈ 70 px css)
  const enHaut = async (loc) => {
    await loc.evaluate(el => {
      let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
      const sc = s || document.scrollingElement;
      sc.scrollTop += el.getBoundingClientRect().top - 78;
    });
    await pg.waitForTimeout(600);
  };

  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await pg.fill('input[placeholder="Votre identifiant"], input[placeholder="Identifiant de connexion"]', 'demo.resident');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await pg.getByText('Se connecter →').first().click();
  await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(7000);   // la bannière « Bienvenue » disparaît
  await shot('01_accueil.png', 300);
  await boite('onglet Repas', pg.locator('nav a[href="/restauration"], a[href="/restauration"]').last());

  await pg.locator('a[href="/restauration"]').last().click();
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(2500);
  await shot('02_mon_qr.png', 300);
  await boite('carte QR', pg.getByText('Mon QR Restaurant').locator('xpath=..'));

  await enHaut(pg.getByText('Menu du jour').first());
  await shot('03_menu_du_jour.png', 500);
  await boite('menu du jour', pg.getByText('Menu du jour').first().locator('xpath=..'));

  await enHaut(pg.getByText('Horaires des repas').first());
  await shot('04_horaires.png', 500);
  await boite('horaires', pg.getByText('Horaires des repas').first().locator('xpath=..'));

  await pg.locator('button[aria-label="Plus de pages"]').click(); await pg.waitForTimeout(1200);
  await shot('05_plus_bar.png', 300);
  await boite('tuile Bar', pg.locator('a[href="/boutique"]').first());

  await pg.locator('a[href="/boutique"]').first().click();
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(2500);
  await shot('06_bar_bon.png', 300);
  await boite('bon de caisse', pg.getByText(/Mon bon de caisse/).locator('xpath=..'));
  await boite('ce mois-ci', pg.getByText('Ce mois-ci').locator('xpath=..'));

  await enHaut(pg.getByText('La carte', { exact: true }));
  await shot('07_bar_carte.png', 500);
  await boite('carte du bar', pg.getByText('La carte', { exact: true }).locator('xpath=../..'));
  await boite('puce Boissons', pg.getByRole('button', { name: 'boissons' }));

  await pg.getByRole('button', { name: 'boissons' }).click();
  await shot('08_bar_boissons.png', 800);
  await boite('épuisé', pg.getByText('Épuisé').first().locator('xpath=../..'));

  await enHaut(pg.getByText('Mes consommations'));
  await shot('09_consommations.png', 500);
  await boite('consommations', pg.getByText('Mes consommations').locator('xpath=..'));
  await b.close();
})();
