// Application bilingue français / anglais.
//
// Le français reste la langue du code. En anglais, un traducteur parcourt
// le texte AFFICHÉ (nœuds texte, placeholder, title, aria-label) et le
// remplace grâce au dictionnaire en.json (clé = texte français exact).
// Ainsi toutes les pages, toasts et fenêtres sont couverts sans réécrire
// chaque composant ; React continue de gérer le DOM (on ne remplace jamais
// un nœud, on change seulement sa valeur, et on garde l'original pour
// revenir au français). Un texte absent du dictionnaire reste en français.
//
// Nouveau texte dans le code : l'ajouter à en.json (même clé que le texte
// français affiché), ou utiliser t('…') pour un texte construit en JS.

const CLE = 'rzc_lang'
const ATTRS = ['placeholder', 'title', 'aria-label']
const IGNORER = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT'])
const norm = (s) => s.replace(/\s+/g, ' ').trim()

// Dictionnaire chargé à la demande (chunk séparé) : un utilisateur en
// français ne télécharge jamais les ~3 700 traductions.
const D = new Map()
let chargement = null
function chargerDico() {
  if (!chargement) chargement = import('./en.json').then((m) => {
    const entrees = Object.entries(m.default || m)
    for (const [fr, en] of entrees) if (en) D.set(norm(fr), en)
    // Variantes sans ponctuation de bord (« Passer le quiz ( » → « Passer le quiz ») :
    // permet de traduire les morceaux d'un texte construit avec un nombre.
    const bord = /^[\s(:·—–\-"«»,.]+|[\s(:·—–\-"«»,.)]+$/g
    for (const [fr, en] of entrees) {
      const f = norm(fr).replace(bord, ''), e = (en || '').replace(bord, '')
      if (f && e && f.length > 2 && !D.has(f)) D.set(f, e)
    }
  }).catch(() => { chargement = null })
  return chargement
}

let langue = 'fr'
try { langue = localStorage.getItem(CLE) === 'en' ? 'en' : 'fr' } catch { /* ignore */ }

export const getLangue = () => langue

/** Traduction d'un texte construit en JS (même dictionnaire). */
export function t(fr) {
  if (langue !== 'en' || fr == null) return fr
  return traduireTexte(String(fr)) ?? fr
}

// Texte complet, puis morceaux autour des nombres et séparateurs usuels
// (« 3 convoi(s) actif(s) », « Convoi R-A1 · Planifié », « Total : 12 »).
const SEP = /(\s*(?:\d[\d\s.,:/h]*|·|—|–|\||:|\/|\(|\)|→|«|»|\+)\s*)/
function traduireTexte(brut) {
  const n = norm(brut)
  if (!n) return null
  const direct = D.get(n)
  if (direct) return entourer(brut, direct)
  if (n.length > 400) return null
  const morceaux = n.split(SEP)
  if (morceaux.length < 2) return null
  let change = false
  const res = morceaux.map(m => {
    const k = m.trim()
    if (!k || SEP.test(m) && !/[A-Za-zÀ-ÿ]{2}/.test(k)) return m
    const tr = D.get(k)
    if (tr) { change = true; return m.replace(k, tr) }
    return m
  }).join('')
  return change ? entourer(brut, res) : null
}
// Garde les espaces de début/fin du nœud d'origine (« {n} convoi(s) »)
const entourer = (brut, txt) => (brut.match(/^\s*/)[0]) + txt + (brut.match(/\s*$/)[0])

function ignore(el) {
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    if (IGNORER.has(e.tagName) || e.isContentEditable || e.getAttribute('translate') === 'no' || e.classList?.contains('notranslate')) return true
  }
  return false
}

function traiterTexte(node) {
  const rec = node.__rzcI18n
  const val = node.nodeValue
  if (rec && val === rec.a) return              // déjà traduit par nous
  if (!val || !/[A-Za-zÀ-ÿ]/.test(val)) return
  if (ignore(node.parentElement)) return
  const tr = traduireTexte(val)
  if (tr && tr !== val) { node.__rzcI18n = { o: val, a: tr }; node.nodeValue = tr }
  else if (rec) delete node.__rzcI18n
}

function traiterAttributs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (!v) continue
    const rec = el.__rzcI18nA?.[a]
    if (rec && v === rec.a) continue
    const tr = traduireTexte(v)
    if (tr && tr !== v) {
      el.__rzcI18nA = { ...(el.__rzcI18nA || {}), [a]: { o: v, a: tr } }
      el.setAttribute(a, tr)
    }
  }
}

function parcourir(racine) {
  if (!racine) return
  if (racine.nodeType === 3) return traiterTexte(racine)
  if (racine.nodeType !== 1 || ignore(racine)) return
  traiterAttributs(racine)
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) traiterTexte(n)
    else if (!IGNORER.has(n.tagName)) traiterAttributs(n)
  }
}

function restaurer(racine) {
  const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n
  while ((n = w.nextNode())) {
    if (n.nodeType === 3 && n.__rzcI18n) {
      if (n.nodeValue === n.__rzcI18n.a) n.nodeValue = n.__rzcI18n.o
      delete n.__rzcI18n
    } else if (n.nodeType === 1 && n.__rzcI18nA) {
      for (const [a, r] of Object.entries(n.__rzcI18nA)) if (n.getAttribute(a) === r.a) n.setAttribute(a, r.o)
      delete n.__rzcI18nA
    }
  }
}

let observateur = null
let titreOrig = null
function traduireTitre() {
  if (langue !== 'en') return
  const tr = traduireTexte(document.title)
  if (tr && tr !== document.title) { titreOrig = document.title; document.title = tr }
}

function demarrer() {
  if (observateur || typeof MutationObserver === 'undefined') return
  observateur = new MutationObserver((muts) => {
    if (langue !== 'en') return
    for (const m of muts) {
      if (m.type === 'characterData') traiterTexte(m.target)
      else if (m.type === 'attributes') traiterAttributs(m.target)
      else m.addedNodes.forEach(parcourir)
    }
  })
  observateur.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  const titre = document.querySelector('title')
  if (titre) new MutationObserver(traduireTitre).observe(titre, { childList: true, characterData: true, subtree: true })
}

// Dates : toLocaleDateString('fr-FR') → format anglais quand l'anglais est actif
;['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString'].forEach((m) => {
  const orig = Date.prototype[m]
  Date.prototype[m] = function (loc, opts) {
    if (langue === 'en' && (loc == null || /^fr/i.test(String(loc)))) loc = 'en-GB'
    return orig.call(this, loc, opts)
  }
})

/** À appeler une fois au démarrage (main.jsx). */
export function initI18n() {
  document.documentElement.lang = langue
  const lancer = () => {
    demarrer()
    if (langue === 'en') chargerDico().then(() => { if (langue === 'en') { parcourir(document.body); traduireTitre() } })
  }
  if (document.body) lancer(); else document.addEventListener('DOMContentLoaded', lancer)
}

/** Change la langue tout de suite (sans recharger la page). */
export function setLangue(l) {
  l = l === 'en' ? 'en' : 'fr'
  if (l === langue) return
  langue = l
  try { localStorage.setItem(CLE, l) } catch { /* ignore */ }
  document.documentElement.lang = l
  if (l === 'en') chargerDico().then(() => { if (langue === 'en') { parcourir(document.body); traduireTitre() } })
  else { restaurer(document.body); if (titreOrig) document.title = titreOrig }
  window.dispatchEvent(new CustomEvent('rzc-langue', { detail: l }))
}
