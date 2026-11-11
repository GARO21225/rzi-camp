// Captures RÉELLES du parcours Induction Camp — instance de DÉMO locale uniquement (seed_demo_t02.py), jamais la production.
// Usage : T02_REPONSES=<reponses_quiz.json> node capture_t02.js
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'captures') + '/';
const REP = require(process.env.T02_REPONSES);
const REGLES = ["Le camp est dans le périmètre de la mine","Respect et courtoisie","Jeux d'argent, bagarres et délits","Interdiction de fumer à l'intérieur","Badge obligatoire","Départ du camp","Heures de calme","Tenue correcte","Animaux interdits"];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', permissions: ['notifications'] });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('pwa-dismissed','1'); localStorage.setItem('rzi_push_masque', String(Date.now()+9e9)) } catch {} });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const shot = async (n, w = 900) => { await pg.waitForTimeout(w); await pg.screenshot({ path: OUT + n }); console.log('shot', n); };
  const voir = async (txt) => { const l = pg.getByText(txt, { exact: false }).first(); await l.scrollIntoViewIfNeeded(); return l; };
  const haut = () => pg.evaluate(() => { document.querySelectorAll('*').forEach(e => { if (e.scrollTop) e.scrollTop = 0 }); window.scrollTo(0, 0) });

  await pg.goto('http://127.0.0.1:5173/login'); await pg.waitForLoadState('networkidle');
  await pg.fill('input[placeholder="Votre identifiant"], input[placeholder="Identifiant de connexion"]', 'demo.arrivant');
  await pg.fill('input[type="password"]', 'DemoSiteLife2026!');
  await pg.getByText('Se connecter →').first().click();
  await pg.waitForURL(u => String(u).includes('/induction-camp'), { timeout: 30000 });
  await pg.waitForLoadState('networkidle'); await pg.waitForTimeout(6000);
  await shot('01_bienvenue.png', 300);
  await (await voir("Votre parcours d'induction")).isVisible(); await shot('02_bienvenue_parcours.png');
  await (await voir('Commencer')).click().catch(async () => { await pg.locator('.ic-btn-primary').first().click(); });
  await haut(); await shot('03_infras_grille.png', 1200);
  const infras = ['Restaurant', 'Bar', 'Salle de sport', 'Urgences médicales'];
  await (await voir(infras[0])).click(); await shot('04_infra_selection.png');
  await (await voir('Petit-déjeuner')).isVisible(); await pg.mouse.wheel(0, 120); await shot('04b_infra_detail.png');
  for (const t of infras.slice(1)) { await (await voir(t)).click(); await pg.waitForTimeout(400); }
  await (await voir('Continuer → Règles du camp')).isVisible(); await shot('05_infras_vues.png');
  await pg.getByText('Continuer → Règles du camp').click();
  await haut(); await shot('06_regles_liste.png', 1200);
  for (const [i, t] of REGLES.entries()) { await (await voir(t)).click(); await pg.waitForTimeout(350); if (i === 0) await shot('07_regle_critique.png', 500); }
  await (await voir("J'ai tout lu")).isVisible(); await shot('08_regles_lues.png');
  await pg.getByText("J'ai tout lu").click();
  await pg.waitForLoadState('networkidle'); await haut(); await shot('09_quiz.png', 2000);
  const n = await pg.evaluate((REP) => {
    let k = 0;
    document.querySelectorAll('input[type=radio]').forEach(r => r.dataset.vu = '');
    const groupes = [...new Set([...document.querySelectorAll('input[type=radio]')].map(r => r.name))];
    for (const g of groupes) {
      const radios = [...document.querySelectorAll(`input[name="${g}"]`)];
      const bloc = radios[0].closest('label').parentElement.parentElement;
      const q = Object.keys(REP).find(q => bloc.innerText.includes(q));
      const bon = radios.find(r => r.parentElement.innerText.trim() === (REP[q] || '').trim());
      if (bon) { bon.parentElement.setAttribute('data-bon', '1'); k++ }
    }
    return k;
  }, REP);
  console.log('réponses trouvées', n);
  const bons = pg.locator('label[data-bon="1"]');
  for (let i = 0; i < await bons.count(); i++) { await bons.nth(i).scrollIntoViewIfNeeded(); await bons.nth(i).click(); if (i === 1) await shot('10_quiz_reponses.png', 400); }
  await (await voir('Valider le quiz')).click();
  await pg.waitForLoadState('networkidle'); await haut(); await shot('11_quiz_reussi.png', 1500);
  await (await voir('Continuer → Appareils énergivores')).click();
  await haut(); await shot('12_appareils.png', 1200);
  await (await voir('+ Déclarer un appareil énergivore')).click();
  await pg.locator('select.ic-input').first().selectOption('Réfrigérateur');
  await pg.fill('input[placeholder="ex: 1500"]', '150');
  await pg.fill('input[placeholder="ex: A-204"]', 'DEMO-A03');
  await (await voir('✓ Déclarer')).isVisible(); await shot('13_appareil_formulaire.png');
  await pg.getByText('✓ Déclarer').click(); await pg.waitForTimeout(800);
  await (await voir('appareil(s) déclaré(s)')).isVisible(); await shot('14_appareil_declare.png');
  await pg.getByText('appareil(s) déclaré(s)').click();
  await haut(); await shot('15_engagement.png', 1200);
  const c = pg.locator('canvas'); await c.scrollIntoViewIfNeeded(); const bb = await c.boundingBox();
  await pg.mouse.move(bb.x + 30, bb.y + bb.height * .6); await pg.mouse.down();
  const pts = [[.15,.35],[.25,.75],[.35,.3],[.45,.7],[.55,.4],[.62,.65],[.72,.35],[.85,.6]];
  for (const [x, y] of pts) await pg.mouse.move(bb.x + bb.width * x, bb.y + bb.height * y, { steps: 8 });
  await pg.mouse.up();
  await (await voir('Finaliser mon induction')).isVisible(); await shot('16_signature.png');
  await pg.getByText('Finaliser mon induction').click();
  await pg.waitForLoadState('networkidle'); await haut(); await shot('17_certificat.png', 2500);
  await b.close();
})();
