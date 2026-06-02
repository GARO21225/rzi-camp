// Génère 204 bâtiments avec coordonnées géographiques simulées
// (autour du camp RZI, Burkina Faso, près de -0.5° lat, 12° lon)

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const TYPES = ['residentiel', 'bureau', 'restauration', 'sante', 'technique', 'sport', 'logistique']
const STATUSES = ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'warn', 'warn', 'empty', 'alert']

// Centre approximatif du camp
const CENTER = { lat: 12.452, lng: -0.512 }

// Génère 204 bâtiments répartis en grille
export function generateBuildings() {
  const buildings = []
  let id = 1
  for (const section of SECTIONS) {
    const perSection = Math.floor(204 / SECTIONS.length)
    for (let i = 0; i < perSection; i++) {
      const x = (i % 12) - 6
      const y = Math.floor(i / 12) - 3
      const status = STATUSES[Math.floor(Math.random() * STATUSES.length)]
      const type = TYPES[Math.floor(Math.random() * TYPES.length)]
      const chambres = 4 + Math.floor(Math.random() * 28)
      buildings.push({
        id: `B-${String(id).padStart(3, '0')}`,
        section,
        index: i,
        type,
        status,
        chambres,
        occupants: status === 'empty' ? 0 : Math.floor(chambres * (0.5 + Math.random() * 0.5)),
        lat: CENTER.lat + y * 0.003 + (Math.random() - 0.5) * 0.001,
        lng: CENTER.lng + x * 0.003 + (Math.random() - 0.5) * 0.001,
        consommation_kwh: 50 + Math.random() * 200,
        eau_m3: 0.5 + Math.random() * 4,
        temperature: 20 + Math.random() * 5,
        humidity: 40 + Math.random() * 30,
        responsable: ['I. Sawadogo', 'A. Ouédraogo', 'M. Koné', 'P. Diallo', 'F. Compaoré'][Math.floor(Math.random() * 5)],
      })
      id++
    }
  }
  return buildings
}

export const BUILDING_TYPES = {
  residentiel:  { label: 'Résidentiel', color: '#16a34a' },
  bureau:       { label: 'Bureau',      color: '#0c4ea2' },
  restauration: { label: 'Restauration', color: '#f59e0b' },
  sante:        { label: 'Santé',        color: '#dc2626' },
  technique:    { label: 'Technique',    color: '#7c3aed' },
  sport:        { label: 'Sport',        color: '#0891b2' },
  logistique:   { label: 'Logistique',   color: '#64748b' },
}

export const STATUS_COLORS = {
  ok:    '#16a34a',
  warn:  '#f59e0b',
  alert: '#dc2626',
  empty: '#94a3b8',
}

export const STATUS_LABELS = {
  ok:    'Occupé',
  warn:  'Maintenance',
  alert: 'Alerte',
  empty: 'Inoccupé',
}
