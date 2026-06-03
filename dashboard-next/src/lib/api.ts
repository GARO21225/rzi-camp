const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://rzi-camp-backend.onrender.com'

function getToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('access_token') || ''
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...opts.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}

// Types principaux
export interface StatsResidences {
  total: number
  occupes: number
  libres: number
  maintenance: number
  taux_occupation: number
  departs_s1: number
}

export interface Personnel {
  id: number
  nom: string
  prenom: string
  type_personnel: string
  societe: string
  actif: boolean
  inductionrecord?: { statut: string }
}

export interface Incident {
  id: number
  titre: string
  statut: string
  priorite: string
  lieu?: string
  cree_le: string
}

export interface Voyage {
  id: number
  statut: string
  personnel_nom?: string
  destination?: string
  date_depart?: string
}

export interface Notification {
  id: string | number
  evenement_titre?: string
  message?: string
  lu: boolean
  date_envoi: string
  source?: string
}
