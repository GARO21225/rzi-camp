// Helpers de formatage

export function formatDate(d, opts = {}) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', ...opts,
  })
}

export function formatDateTime(d) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(d) {
  if (!d) return '—'
  const date = new Date(d)
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  const j = Math.floor(h / 24)
  if (j < 7) return `il y a ${j}j`
  return formatDate(d)
}

export function formatNumber(n, opts = {}) {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', opts)
}

export function formatPercent(n, decimals = 0) {
  if (n == null) return '—'
  return `${n.toFixed(decimals)}%`
}

export function statusColor(status) {
  const map = {
    ok:    'badge-ok',
    occupe:'badge-ok',
    resolu:'badge-ok',
    termine:'badge-ok',
    warn:  'badge-warn',
    maintenance:'badge-warn',
    en_cours:'badge-warn',
    alert: 'badge-alert',
    critique:'badge-alert',
    empty: 'badge-ink',
    libre:'badge-ink',
    planifie: 'badge-info',
  }
  return map[status] || 'badge-ink'
}

export function statusLabel(status) {
  const map = {
    ok: 'Occupé', occupe: 'Occupé', resolu: 'Résolu', termine: 'Terminé',
    warn: 'Maintenance', maintenance: 'Maintenance', en_cours: 'En cours',
    alert: 'Alerte', critique: 'Critique',
    empty: 'Inoccupé', libre: 'Libre', planifie: 'Planifié',
  }
  return map[status] || status
}

export function pct(part, total) {
  if (!total) return 0
  return Math.min(100, Math.round((part / total) * 100))
}
