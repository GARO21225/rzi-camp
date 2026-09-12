// Coordonnées GPS approximatives des destinations connues de l'app —
// suffisant pour visualiser un itinéraire sur une carte régionale, pas
// une precision routiere au metre pres (usage: apercu du trajet, pas GPS
// turn-by-turn).
export const COORDS_DESTINATIONS = {
  // Camp / sites miniers (region Seguela/Mankono, Cote d'Ivoire)
  'camp roxgold sango': [8.05, -6.75],
  'sango mine site': [8.05, -6.75],
  'camp de base': [8.05, -6.75],
  "site d'exploration": [8.05, -6.75],
  'autre site minier': [8.05, -6.75],
  // Côte d'Ivoire - villes principales
  'abidjan': [5.3600, -4.0083],
  'yamoussoukro': [6.8276, -5.2893],
  'bouaké': [7.6906, -5.0300],
  'san pedro': [4.7485, -6.6363],
  'korhogo': [9.4580, -5.6297],
  'man': [7.4125, -7.5539],
  'daloa': [6.8770, -6.4502],
  'gagnoa': [6.1319, -5.9506],
  'abengourou': [6.7297, -3.4964],
  'bondoukou': [8.0402, -2.8000],
  'odienné': [9.5090, -7.5654],
  'touba': [8.2833, -7.6833],
  'divo': [5.8372, -5.3572],
  'agboville': [5.9280, -4.2150],
  'dimbokro': [6.6497, -4.7042],
  'séguéla': [7.9611, -6.6731],
  'mankono': [8.0583, -6.1889],
  'ferkessédougou': [9.5975, -5.1978],
  'bouna': [9.2667, -3.0000],
  'tabou': [4.4230, -7.3528],
  'katiola': [8.1339, -5.1017],
  'boundiali': [9.5236, -6.4886],
  "aéroport félix houphouët-boigny (abj)": [5.2614, -3.9263],
  'aéroport bouaké': [7.7392, -5.0736],
  'aéroport san pedro': [4.7500, -6.6667],
  'aéroport korhogo': [9.3833, -5.5667],
  // Burkina Faso
  'ouagadougou': [12.3714, -1.5197],
  'bobo-dioulasso': [11.1771, -4.2979],
  'dédougou': [12.4633, -3.4602],
  'koudougou': [12.2530, -2.3625],
  'banfora': [10.6333, -4.7667],
  // Afrique de l'Ouest / régional
  'accra (ghana)': [5.6037, -0.1870],
  'bamako (mali)': [12.6392, -8.0029],
  'dakar (sénégal)': [14.7167, -17.4677],
  'lomé (togo)': [6.1319, 1.2228],
  'cotonou (bénin)': [6.3703, 2.3912],
  'conakry (guinée)': [9.6412, -13.5784],
  'niamey (niger)': [13.5127, 2.1128],
  'freetown (sierra leone)': [8.4657, -13.2317],
  'monrovia (libéria)': [6.2907, -10.7605],
  'lagos (nigéria)': [6.5244, 3.3792],
  // Hubs miniers / corporate internationaux
  'johannesburg (afrique du sud)': [-26.2041, 28.0473],
  'perth (australie)': [-31.9505, 115.8605],
  'toronto (canada)': [43.6511, -79.3470],
  'vancouver (canada)': [49.2827, -123.1207],
  'londres (royaume-uni)': [51.5074, -0.1278],
  "dubaï (émirats arabes unis)": [25.2048, 55.2708],
  // Europe
  'paris (france)': [48.8566, 2.3522],
  'bruxelles (belgique)': [50.8503, 4.3517],
  'genève (suisse)': [46.2044, 6.1432],
  // Évacuation médicale
  "clinique internationale d'abidjan": [5.32, -4.02],
  'centre médical (évacuation afrique du sud)': [-26.2041, 28.0473],
}

/** Cherche des coordonnées pour un nom de lieu — tolérant à la casse et
 * aux variantes partielles (ex: "Abidjan" retrouve la même entrée que
 * "Aéroport FÉLIX HOUPHOUËT-BOIGNY (ABJ)" si le nom contient "abidjan"). */
export function trouverCoords(nom) {
  if (!nom) return null
  const key = nom.trim().toLowerCase()
  if (COORDS_DESTINATIONS[key]) return COORDS_DESTINATIONS[key]
  // Recherche partielle : le nom saisi contient une des clés connues, ou vice versa
  for (const [k, coords] of Object.entries(COORDS_DESTINATIONS)) {
    if (key.includes(k) || k.includes(key)) return coords
  }
  return null
}
