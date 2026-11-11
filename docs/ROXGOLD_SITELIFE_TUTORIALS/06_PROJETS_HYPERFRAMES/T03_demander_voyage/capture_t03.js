// Captures RÉELLES : demande de voyage par un résident, validation par l'administration (API), suivi côté résident.
// Instance de DÉMO locale uniquement (seed_demo_t03.py), jamais la production. Horloge du navigateur : 11/11/2026 10h15 (Abidjan).
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'captures') + '/';
const API = 'http://127.0.0.1:8000';
(async () => {
  // Navigateur en français (variables d'environnement) : champs de date au format jj/mm/aaaa, comme sur un téléphone en français
  const b = await chromium.launch({ args: ['--lang=fr'], env: { ...process.env, LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr', LC_ALL: 'fr_FR.UTF-8' } });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Africa/Abidjan', permissions: ['notifications'] });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('pwa-dismissed','1'); localStorage.setItem('rzi_push_masque', String(Date.now()+9e9)) } catch {} });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(new Date('2026-11-11T10:15:00Z'));
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 1000) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); };
  const voir = async (sel) => { await sel.scrollIntoViewIfNeeded(); return sel; };

  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await pg.fill('input[placeholder="Votre identifiant"], input[placeholder="Identifiant de connexion"]', 'demo.resident');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await pg.getByText('Se connecter →').first().click();
  await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(6500);
  await shot('01_accueil_sans_trajet.png', 300);
  await pg.getByText('Demander un voyage').first().click();
  await pg.waitForLoadState('networkidle'); await shot('02_demandes.png', 1500);
  await pg.locator('button[aria-label="Planifier voyage"]').last().click();
  await shot('03_formulaire.png');
  const itin = pg.locator('select', { has: pg.locator('option', { hasText: '— Sélectionner un itinéraire —' }) });
  await itin.selectOption({ label: 'Camp → Abidjan (CAMP → ABIDJAN)' });
  await shot('04_itineraire.png', 700);
  const dates = pg.locator('input[type="date"]');
  await (await voir(dates.nth(0))).fill('2026-11-16');
  await dates.nth(1).fill('2026-11-28');
  await shot('05_transport_dates.png', 600);
  const motif = pg.locator('select', { has: pg.locator('option', { hasText: '— Choisir un motif —' }) });
  await (await voir(motif)).selectOption('repos');
  await pg.fill('textarea[placeholder="Précisions éventuelles..."]', 'Fin de rotation — demande de démonstration.');
  await pg.getByText('📤 Soumettre la demande').scrollIntoViewIfNeeded();
  await shot('06_motif_soumettre.png', 500);
  await pg.getByText('📤 Soumettre la demande').click();
  await pg.waitForLoadState('networkidle'); await shot('07_demande_en_attente.png', 1800);

  // ── L'administration valide la demande (comme depuis Centre de Mobilité › Validations) ──
  const tok = (await (await fetch(API + '/api/auth/login/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo.admin', password: 'DemoSiteLife2026!' }) })).json()).access;
  const H = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  const liste = await (await fetch(API + '/api/demandes/?type_demande=voyage', { headers: H })).json();
  const d = (liste.results || liste).find(x => x.statut === 'en_attente');
  const r = await fetch(API + `/api/demandes/${d.id}/valider/`, { method: 'POST', headers: H, body: JSON.stringify({ commentaire: 'Demande validée — bon repos.' }) });
  console.log('validation', r.status);

  await pg.reload(); await pg.waitForLoadState('networkidle'); await shot('08_demande_validee.png', 2500);
  await pg.goto('http://127.0.0.1:5173/accueil'); await pg.waitForLoadState('networkidle'); await shot('09_accueil_trajet.png', 3500);
  await pg.locator('header button, button').filter({ has: pg.locator('svg') }).nth(1).click().catch(() => {});
  await shot('10_notification.png', 1500);
  await b.close();
})();
