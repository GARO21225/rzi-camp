
export function fmt(iso, opts={day:'2-digit',month:'short'}) {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', opts) : '—'
}
export function toISO(d) { return d.toISOString().slice(0,10) }
export function addDays(d, n) { const r=new Date(d); r.setDate(r.getDate()+n); return r }

