import axios from 'axios'

// ═══════════════════════════════════════════════════════════════
// URL DU BACKEND — 3 sources dans l'ordre de priorité:
// 1. window.BACKEND_URL (fichier public/config.js — modifiable sans rebuild)
// 2. import.meta.env.VITE_API_URL (variable Render au build)
// 3. Auto-détection depuis le hostname
// ═══════════════════════════════════════════════════════════════
function resolveBase() {
  // Source 1: config.js runtime
  if (window.BACKEND_URL && window.BACKEND_URL.trim()) {
    return window.BACKEND_URL.trim().replace(/\/+$/, '')
  }
  // Source 2: variable d'env au build
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '')
  }
  // Source 3: auto-détection Render
  const h = window.location.hostname
  if (h !== 'localhost' && h !== '127.0.0.1') {
    // Essayer de remplacer "frontend" par "backend" dans le hostname
    if (h.includes('frontend')) return 'https://' + h.replace('frontend', 'backend')
    // Sinon: même host, port 8000 (dev)
  }
  return 'http://localhost:8000'
}

const BASE = resolveBase()
window.__API_BASE__ = BASE  // Exposer pour debug

const api = axios.create({ baseURL: BASE, timeout: 15000 })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/api/auth/refresh/`, { refresh })
          localStorage.setItem('access_token', data.access)
          err.config.headers.Authorization = `Bearer ${data.access}`
          return api(err.config)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──
export const auth = {
  login:  (u, p) => api.post('/api/auth/login/', typeof u === 'object' ? u : { username: u, password: p }),
  me:     () => api.get('/api/auth/me/'),
  refresh: d => api.post('/api/auth/refresh/', d),
}

// ── Bâtiments ──
export const batiments = {
  list:       p => api.get('/api/batiments/', { params: p }),
  get:        id => api.get(`/api/batiments/${id}/`),
  update:     (id, d) => api.patch(`/api/batiments/${id}/`, d),
  stats:      () => api.get('/api/batiments/stats/'),
  geojson:    () => api.get('/api/batiments/geojson/'),
  export:     () => api.get('/api/batiments/export_csv/', { responseType: 'blob' }),
}

// ── Personnel ──
export const personnel = {
  list:             p => api.get('/api/personnel/', { params: p }),
  get:              id => api.get(`/api/personnel/${id}/`),
  create:           d => api.post('/api/personnel/', d),
  update:           (id, d) => api.patch(`/api/personnel/${id}/`, d),
  delete:           id => api.delete(`/api/personnel/${id}/`),
  monProfil:        () => api.get('/api/personnel/mon_profil/'),
  assigRole:        (id, role) => api.post(`/api/personnel/${id}/assigner_role/`, { role }),
  toggleActive:     id => api.post(`/api/personnel/${id}/toggle_active/`),
  regenererQR:      id => api.post(`/api/personnel/${id}/regenerer_qr/`),
  regenererCompte:  id => api.post(`/api/personnel/${id}/regenerer_compte/`),
  regenererTousQR:  () => api.post('/api/personnel/regenerer_tous_qr/'),
  stats:            () => api.get('/api/personnel/stats/').catch(() => ({ data: {} })),
}

// ── Voyages ──
export const voyages = {
  list:   p => api.get('/api/voyages/', { params: p }),
  create: d => api.post('/api/voyages/', d),
  update: (id, d) => api.patch(`/api/voyages/${id}/`, d),
  delete: id => api.delete(`/api/voyages/${id}/`),
  partir:  id => api.post(`/api/voyages/${id}/partir/`),
  revenir: id => api.post(`/api/voyages/${id}/revenir/`),
  annuler: id => api.post(`/api/voyages/${id}/annuler/`),
  stats:  () => api.get('/api/voyages/stats/'),
}

// ── Incidents ──
export const incidents = {
  list:    p => api.get('/api/incidents/', { params: p }),
  create:  d => api.post('/api/incidents/', d),
  update:  (id, d) => api.patch(`/api/incidents/${id}/`, d),
  delete:  id => api.delete(`/api/incidents/${id}/`),
  resoudre: id => api.post(`/api/incidents/${id}/resoudre/`),
  stats:   () => api.get('/api/incidents/stats/'),
}

// ── Restauration QR ──
export const qr = {
  scanner:          d => api.post('/api/qr/scanner/', d),
  repas:            p => api.get('/api/qr/repas/', { params: p }),
  validerParPersonnel: d => api.post('/api/qr/valider_par_personnel/', d),
  qrRestaurant:     () => api.get('/api/qr/qr_restaurant/'),
  viderHistorique:  t => api.delete(`/api/qr/vider_historique/?type_repas=${t}`),
}

// ── Événements ──
export const evenements = {
  list:    p => api.get('/api/evenements/', { params: p }),
  create:  d => api.post('/api/evenements/', d),
  delete:  id => api.delete(`/api/evenements/${id}/`),
  notifs:  () => api.get('/api/notifications/'),
  marquerLu: id => api.post(`/api/notifications/${id}/marquer_lu/`),
  marquerToutLu: () => api.post('/api/notifications/marquer_tout_lu/'),
  simpleNotifs: () => api.get('/api/simple-notifications/'),
  marquerSimpleLu: id => api.post(`/api/simple-notifications/${id}/marquer_lu/`),
  alertes: () => api.get('/api/alertes/'),
  creerAlerte: d => api.post('/api/alertes/', d),
}

// ── Demandes ──
export const demandes = {
  list:    p => api.get('/api/demandes/', { params: p }),
  create:  d => api.post('/api/demandes/', d),
  delete:  id => api.delete(`/api/demandes/${id}/`),
  valider: (id, d) => api.post(`/api/demandes/${id}/valider/`, d),
  rejeter: (id, d) => api.post(`/api/demandes/${id}/rejeter/`, d),
  proposer:(id, d) => api.post(`/api/demandes/${id}/proposer/`, d),
  accepter: id => api.post(`/api/demandes/${id}/accepter/`),
  refuser:  id => api.post(`/api/demandes/${id}/refuser/`),
}

// ── Historique ──
export const historique = {
  occupation: p => api.get('/api/occupation-history/', { params: p }),
  adminList:  p => api.get('/api/occupation-history-admin/', { params: p }),
}

// ── Admin accounts ──
export const adminApi = {
  users:       () => api.get('/api/admin/users/'),
  toggleActive:(id) => api.post(`/api/admin/users/${id}/toggle-active/`),
  deleteUser:  (id) => api.delete(`/api/admin/users/${id}/delete/`),
  assignRole:  (id, role) => api.post(`/api/admin/users/${id}/role/`, { role }),
}

export default api

// Alias pour compatibilité avec useNotifications.js
export const notifications = evenements

// Alias pour Residences.jsx et Historique.jsx
export const occupationHistory = {
  ...historique,
  recherche: (p) => api.get('/api/occupation-history/', { params: p }),
  adminRecherche: (p) => api.get('/api/occupation-history-admin/', { params: p }),
}

export const occupationHistoryAdmin = historique

export const alertes = {
  list: () => api.get('/api/alertes/'),
  create: (d) => api.post('/api/alertes/', d),
  delete: (id) => api.delete(`/api/alertes/${id}/`),
  desactiver: (id) => api.post(`/api/alertes/${id}/desactiver/`),
}

export const audit = api
