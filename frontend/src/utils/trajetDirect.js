// Calculs du suivi « façon Uber » côté passager : où en est le bus sur la
// ligne des arrêts, combien de kilomètres restent jusqu'à MA descente, et
// vers quelle heure j'arrive. Les coordonnées des villes viennent de
// data/coordsDestinations (pas de service externe requis).

const R = 6371

/** Distance à vol d'oiseau en km entre deux points [lat, lng]. */
export function distanceKm(a, b) {
  const rad = d => d * Math.PI / 180
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

/** Les routes ne sont pas droites : facteur moyen route / vol d'oiseau en Côte d'Ivoire. */
export const FACTEUR_ROUTE = 1.25

// Position (0..1) du projeté de p sur le segment [a, b], en coordonnées planes locales.
function projection(p, a, b) {
  const k = Math.cos(a[0] * Math.PI / 180)
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0]
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  if (!l2) return 0
  return Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
}

/**
 * Situe le bus sur la ligne des arrêts.
 * `arrets` : [{ ville, coords:[lat,lng] | null }] dans l'ordre du trajet.
 * Retourne { segment, t, passes } : le bus est entre arrets[segment] et
 * arrets[segment+1] (t = avancement 0..1) ; `passes` = index des arrêts déjà dépassés.
 */
export function situerBus(bus, arrets) {
  const pts = arrets.map((a, i) => ({ i, c: a.coords })).filter(x => x.c)
  if (!bus || pts.length < 2) return null
  let meilleur = null
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k].c, b = pts[k + 1].c
    const t = projection(bus, a, b)
    const proj = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    const d = distanceKm(bus, proj)
    if (!meilleur || d < meilleur.d - 0.01) meilleur = { d, k, t }
  }
  const segment = pts[meilleur.k].i
  const suivant = pts[meilleur.k + 1].i
  const passes = arrets.map((_, i) => i).filter(i => i <= segment || (i === suivant && meilleur.t > 0.995))
  return { segment, suivant, t: meilleur.t, ecartKm: meilleur.d, passes }
}

/**
 * Distance restante (km, par la route estimée) entre le bus et l'arrêt `cible`.
 * null si les coordonnées manquent. 0 si l'arrêt est déjà dépassé.
 */
export function kmRestants(bus, arrets, cible) {
  const pos = situerBus(bus, arrets)
  if (!pos || cible == null || !arrets[cible]?.coords) return null
  if (pos.passes.includes(cible)) return 0
  let km = 0, depuis = bus
  for (let i = pos.suivant; i <= cible; i++) {
    if (!arrets[i]?.coords) continue
    km += distanceKm(depuis, arrets[i].coords)
    depuis = arrets[i].coords
  }
  return km * FACTEUR_ROUTE
}

/** Vitesse moyenne réaliste (km/h) pour l'estimation : moyenne réelle du trajet, bornée, sinon 60. */
export function vitesseEstimee({ distanceParcourueKm, dureeH, vitesseInstantanee } = {}) {
  if (distanceParcourueKm > 5 && dureeH > 0.1) {
    const v = distanceParcourueKm / dureeH
    if (v >= 20) return Math.min(v, 90)
  }
  if (vitesseInstantanee >= 30) return Math.min(vitesseInstantanee, 90)
  return 60
}

/** Longueur (km) d'une trace GPS [[lat,lng], ...]. */
export function longueurTrace(trace) {
  let km = 0
  for (let i = 1; i < (trace || []).length; i++) km += distanceKm(trace[i - 1], trace[i])
  return km
}

/** Formate une heure d'arrivée estimée (Date) en « 14h35 ». */
export function heureArrivee(minutes, maintenant = new Date()) {
  if (minutes == null || !Number.isFinite(minutes)) return null
  const d = new Date(maintenant.getTime() + minutes * 60000)
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
}

/** « 1 h 25 min » / « 12 min ». */
export function dureeLisible(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return null
  const m = Math.max(1, Math.round(minutes))
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

const norm = s => (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const estCamp = s => /camp|sango/i.test(s || '')
/** Même arrêt ? (« CAMP » = « Camp Roxgold Sango »), même règle que le serveur. */
export const memeLieu = (a, b) => (estCamp(a) && estCamp(b)) || (!!norm(a) && norm(a) === norm(b))
