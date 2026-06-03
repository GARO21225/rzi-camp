import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function formatRelative(iso: string) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `Il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Il y a ${hrs}h`
  return formatDate(iso)
}

export function getStatusColor(statut: string) {
  const map: Record<string, string> = {
    libre: 'bg-green-100 text-green-800',
    occupe: 'bg-blue-100 text-blue-800',
    maintenance: 'bg-orange-100 text-orange-800',
    valide: 'bg-green-100 text-green-800',
    en_cours: 'bg-yellow-100 text-yellow-800',
    declare: 'bg-red-100 text-red-800',
    resolu: 'bg-green-100 text-green-800',
    planifie: 'bg-blue-100 text-blue-800',
    en_voyage: 'bg-purple-100 text-purple-800',
    critique: 'bg-red-100 text-red-800',
    modere: 'bg-orange-100 text-orange-800',
    faible: 'bg-gray-100 text-gray-700',
  }
  return map[statut] || 'bg-gray-100 text-gray-700'
}
