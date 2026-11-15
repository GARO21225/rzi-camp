// Langue des captures (variable d'environnement LANGUE=fr|en, français par défaut).
// En anglais, l'application est filmée RÉELLEMENT en anglais : son propre sélecteur de langue (localStorage
// « rzc_lang ») et son propre dictionnaire (frontend/src/i18n/en.json). Les scripts retrouvent les boutons
// avec T('texte français') : la traduction que l'application affiche, ou le texte français s'il n'est pas traduit.
const path = require('path');
const fs = require('fs');

const LANGUE = process.env.LANGUE === 'en' ? 'en' : 'fr';
const DICO = LANGUE === 'en'
  ? JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'frontend', 'src', 'i18n', 'en.json'), 'utf8'))
  : {};

/** Texte tel que l'application l'affiche dans la langue de capture. */
const T = (fr) => (LANGUE === 'en' && DICO[fr]) || fr;
/** Contenu saisi pendant la démo (titre d'incident, commentaire…) : propre à chaque langue. */
const L = (fr, en) => (LANGUE === 'en' ? en : fr);
/** Dossier de sortie : captures/ (français, comme avant) ou captures/en/. */
function dossier(dirTuto) {
  const d = path.join(dirTuto, 'captures', ...(LANGUE === 'en' ? ['en'] : [])) + '/';
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const locale = LANGUE === 'en' ? 'en-GB' : 'fr-FR';
const lancement = {
  args: ['--lang=' + (LANGUE === 'en' ? 'en-GB' : 'fr')],
  env: { ...process.env, LANG: LANGUE === 'en' ? 'en_GB.UTF-8' : 'fr_FR.UTF-8', LANGUAGE: LANGUE === 'en' ? 'en_GB:en' : 'fr', LC_ALL: LANGUE === 'en' ? 'en_GB.UTF-8' : 'fr_FR.UTF-8' },
};
/** Script injecté dans chaque page : langue de l'application + bandeaux d'installation et de notifications masqués. */
const initScript = [(l) => { try { sessionStorage.setItem('pwa-dismissed', '1'); localStorage.setItem('rzi_push_masque', String(Date.now() + 9e9)); localStorage.setItem('rzc_lang', l) } catch { /* ignore */ } }, LANGUE];

/** Textes encore en français à l'écran (en anglais seulement) : aide à compléter le dictionnaire. */
async function textesNonTraduits(pg) {
  if (LANGUE !== 'en') return [];
  return pg.evaluate(() => {
    const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const v = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (!v || !/[a-zà-ÿ]{3}/i.test(v) || n.__rzcI18n) continue;
      const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName)) continue;
      const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      out.add(v);
    }
    return [...out];
  });
}

/** Horloge du navigateur : aujourd'hui à 10 h 15 (heure d'Abidjan = UTC), pour « Bonjour » et des dates cohérentes avec le serveur. */
function ceMatin() { const d = new Date(); d.setUTCHours(10, 15, 0, 0); return d; }
/** Date du jour + n jours, au format AAAA-MM-JJ (champs de date). */
function jourPlus(n) { const d = ceMatin(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/** Premier jour, à partir de aujourd'hui + n, dont le jour de semaine est dans `jours` (0 = dimanche … 6 = samedi) : renvoie l'écart en jours. */
function ecartJour(n, jours) { for (let k = n; k < n + 8; k++) { const d = ceMatin(); d.setUTCDate(d.getUTCDate() + k); if (jours.includes(d.getUTCDay())) return k; } return n; }

module.exports = { ceMatin, jourPlus, ecartJour, LANGUE, T, L, dossier, locale, lancement, initScript, textesNonTraduits };
