/**
 * exportUtils — centralise l'export CSV (utilisé dans 8+ pages)
 * et d'autres utilitaires de données
 */

/**
 * exportCsv(rows, filename)
 * rows: string[][] — première ligne = headers
 * Télécharge automatiquement le fichier
 */
export function exportCsv(rows, filename = 'export.csv') {
  const csv = rows
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * formatDate(isoString, opts)
 * Centralise new Date().toLocaleDateString('fr-FR', ...)
 */
export function formatDate(iso, opts = {}) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', ...opts
  })
}

export function formatTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(iso) {
  return `${formatDate(iso)} ${formatTime(iso)}`
}

/**
 * paginate(items, page, pageSize)
 * Gestion pagination côté client
 */
export function paginate(items, page, pageSize = 20) {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    pages: Math.ceil(items.length / pageSize),
    hasNext: start + pageSize < items.length,
    hasPrev: page > 1,
  }
}

/**
 * groupBy(items, key)
 * Grouper un tableau par clé
 */
export function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key] || '—'
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}
