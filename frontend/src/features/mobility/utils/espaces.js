// Organisation du Centre de Mobilité en espaces fonctionnels. Chaque vue (clé `view` de MissionControl)
// appartient à UN espace ; rien n'est supprimé, seulement regroupé.
export const ESPACES = [
  { id: 'apercu', label: '🏠 Vue d\'ensemble', vues: [['apercu', 'Synthèse']] },
  { id: 'planification', label: '🗓️ Planification', vues: [
    ['rotations', '🚀 Rotations'], ['organiser', '📋 À organiser', true], ['calendrier', '🗓️ Calendrier'], ['gantt', '📅 Gantt'],
  ] },
  { id: 'exploitation', label: '🛰️ Exploitation', vues: [['command', '🛰️ Command'], ['direct', '📡 En direct', true]] },
  { id: 'passagers', label: '🎫 Passagers', vues: [['liste', '🎫 Tous les voyages'], ['manifest', '📋 Manifest']] },
  { id: 'validations', label: '✅ Validations', admin: true, vues: [['validations', 'Demandes à valider']] },
]

/** Espaces visibles (les entrées marquées admin n'apparaissent que pour un admin). */
export function espacesVisibles(isAdmin) {
  return ESPACES.filter(e => !e.admin || isAdmin)
    .map(e => ({ ...e, vues: e.vues.filter(v => !v[2] || isAdmin) }))
    .filter(e => e.vues.length)
}

export const espaceDeVue = (view) => ESPACES.find(e => e.vues.some(v => v[0] === view))?.id || 'apercu'
