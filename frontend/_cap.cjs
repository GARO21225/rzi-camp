// Captures RÉELLES de la page Repas côté flasheur (rôle « restauration ») — instance de DÉMO locale uniquement.
// Le scan est RÉEL : Chromium reçoit une fausse caméra (fichier vidéo .y4m) qui montre le QR d'Aya DEMO,
// et l'application le décode et l'envoie à l'API de scan, exactement comme avec la caméra d'un téléphone.
// Vidéo : 9 s de fond gris (scanner actif, rien à lire), puis le QR 4 s, en boucle.
// Usage : LANGUE=fr|en CAM_DIR=<dossier des cam_*.y4m> node capture_t17.cjs   (lancer seed_demo_t17.py juste avant)
const { chromium, devices } = require('playwright');
const path = require('path');
const LANGUE = process.env.LANGUE === 'en' ? 'en' : 'fr';
const CAM = process.env.CAM_DIR;
const OUT = path.join('/home/user/rzi-camp/docs/ROXGOLD_SITELIFE_TUTORIALS/06_PROJETS_HYPERFRAMES/T17_flasheurs_scan', 'captures', LANGUE) + '/';
require('fs').mkdirSync(OUT, { recursive: true });

async function session(cam, avecLogin) {
  const b = await chromium.launch({ args: ['--lang=' + LANGUE, '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${path.join(CAM, cam)}`],
    env: { ...process.env, LANG: LANGUE === 'en' ? 'en_US.UTF-8' : 'fr_FR.UTF-8', LANGUAGE: LANGUE, LC_ALL: LANGUE === 'en' ? 'en_US.UTF-8' : 'fr_FR.UTF-8' } });
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: LANGUE === 'en' ? 'en-GB' : 'fr-FR', timezoneId: 'Africa/Abidjan', permissions: ['camera'],
    ...(avecLogin ? {} : { storageState: path.join(CAM, `etat_${LANGUE}.json`) }) });
  await ctx.addInitScript((l) => { try { sessionStorage.setItem('pwa-dismissed','1'); localStorage.setItem('rzi_push_masque', String(Date.now()+9e9)); localStorage.setItem('rzc_lang', l) } catch {} }, LANGUE);
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  if (avecLogin) {
    await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
    await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
    await pg.locator('input:not([type="password"])').first().fill('demo.flasheur');
    await pg.locator('input[type="password"]').press('Enter');
    await pg.waitForURL(u => String(u).includes('/accueil'), { timeout: 30000 });
    await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(7000);
    await ctx.storageState({ path: path.join(CAM, `etat_${LANGUE}.json`) });
  }
  return { b, pg };
}
const shot = async (pg, n, w = 0) => { if (w) await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', LANGUE, n); };
const boite = async (pg, nom, loc) => {
  const r = await loc.boundingBox().catch(() => null);
  console.log('  ', nom, r ? [Math.round(r.x*3), Math.round(r.y*3), Math.round(r.width*3), Math.round(r.height*3)].join(',') : 'absent');
};
const scanner = (pg) => pg.locator('#qr_viewport').locator('xpath=../..');
const amenerScanner = async (pg) => { await scanner(pg).evaluate(el => el.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(400); };

(async () => {
  // 1. Accueil du flasheur, puis page Repas, scan réussi d'Aya, puis « Déjà pris » à la boucle suivante
  let { b, pg } = await session('cam_aya.y4m', true);
  await shot(pg, '01_accueil.png');
  await boite(pg, 'onglet Repas', pg.locator('a[href="/restauration"]').last());
  await pg.locator('a[href="/restauration"]').last().click();
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(1500);
  await shot(pg, '02_repas_haut.png');
  await boite(pg, 'boutons repas', pg.locator('button', { hasText: '☀️' }).first().locator('xpath=..'));
  await boite(pg, 'compteurs', pg.locator('text=/Petit-d|Breakfast/').first().locator('xpath=../../..'));
  await amenerScanner(pg);
  await pg.getByText(/Scanner actif|Scanner on/).first().waitFor({ timeout: 15000 });
  await shot(pg, '03_scanner_actif.png', 300);
  await boite(pg, 'scanner', scanner(pg));
  await pg.locator('#qr_viewport').locator('xpath=..').getByText(/DEMO AYA/).first().waitFor({ timeout: 20000 });
  await shot(pg, '04_scan_valide.png', 150);
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const el = document.getElementById('qr_viewport'); el && el.scrollIntoView({ block: 'start' }) });
  await pg.waitForTimeout(600);
  await shot(pg, '05_avis_rapide.png');
  const avis = pg.locator('text=/avis|feedback|rating/i').last();
  await boite(pg, 'avis', avis.locator('xpath=../..'));
  await pg.locator('text=/Déj[aà] pris|Already taken/').first().waitFor({ timeout: 25000 });
  await amenerScanner(pg);
  await shot(pg, '06_deja_pris.png', 100);
  await pg.waitForTimeout(2500);
  const hist = pg.getByText(/^(Historique|History)$/).last();
  await hist.evaluate(el => { let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
    (s || document.scrollingElement).scrollTop += el.getBoundingClientRect().top - 90 });
  await shot(pg, '07_historique.png', 600);
  await boite(pg, 'historique', hist.locator('xpath=../..'));
  await hist.evaluate(el => { let s = el.parentElement; while (s && !(s.scrollHeight > s.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement; (s || document.scrollingElement).scrollTop = 0 });
  await shot(pg, '08_compteurs_apres.png', 1500);
  await b.close();

  // 2. QR inconnu : « Non reconnu »
  ({ b, pg } = await session('cam_inconnu.y4m', false));
  await pg.goto('http://127.0.0.1:5173/restauration'); await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(1200);
  await amenerScanner(pg);
  await pg.locator('#qr_viewport').locator('xpath=..').getByText(/Non reconnu|Not recognised|Not recognized/).first().waitFor({ timeout: 20000 });
  await shot(pg, '09_non_reconnu.png', 100);
  await b.close();
})();
