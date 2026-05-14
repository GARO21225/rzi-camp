import axios from 'axios'
// URL auto-détectée: VITE_API_URL → hostname replace → localhost
const BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  const h = window.location.hostname
  if (h.includes('onrender.com') && h.includes('frontend'))
    return 'https://' + h.replace('frontend','backend')
  if (h !== 'localhost' && h !== '127.0.0.1')
    return 'https://rzi-camp-backend.onrender.com'
  return 'http://localhost:8000'
})()
const api = axios.create({ baseURL: BASE })
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
api.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401) {
    const refresh = localStorage.getItem('refresh_token')
    if (refresh) {
      try {
        const { data } = await axios.post(`${BASE}/api/auth/refresh/`, { refresh })
        localStorage.setItem('access_token', data.access)
        err.config.headers.Authorization = `Bearer ${data.access}`
        return api(err.config)
      } catch { localStorage.clear(); window.location.href = '/login' }
    }
  }
  return Promise.reject(err)
})
export default api
export const auth = {
  login: (u,p) => api.post('/api/auth/login/', {username:u,password:p}),
  me: () => api.get('/api/auth/me/'),
}
export const batiments = {
  list: (p) => api.get('/api/batiments/', {params:p}),
  geojson: (p) => api.get('/api/batiments/geojson/', {params:p}),
  stats: () => api.get('/api/batiments/stats/'),
  update: (id,d,confirm=false) => api.patch(`/api/batiments/${id}/`, {...d, confirm}),
  updateDraft: (id,d) => api.patch(`/api/batiments/${id}/`, {...d, confirm:false}),
  exportCsv: (p) => `${BASE}/api/batiments/export_csv/?${new URLSearchParams(p)}`,
  exportBlocs: () => `${BASE}/api/batiments/export_par_bloc/`,
  history: (residence) => api.get('/api/occupation-history/', {params:{batiment:residence}}),
}
export const personnel = {
  list: (p) => api.get('/api/personnel/', {params:p}),
  monProfil: () => api.get('/api/personnel/mon_profil/'),
  create: (d) => api.post('/api/personnel/', d),
  update: (id,d) => api.patch(`/api/personnel/${id}/`, d),
  delete: (id) => api.delete(`/api/personnel/${id}/`),
  regenererQr: (id) => api.post(`/api/personnel/${id}/regenerer_qr/`),
  regenererCompte: (id) => api.post(`/api/personnel/${id}/regenerer_compte/`),
  historiqueVoyages: (id) => api.get(`/api/personnel/${id}/historique_voyages/`),
  historiqueChambre: (id, p) => api.get(`/api/personnel/${id}/historique_chambres/`, {params:p}),
  assigRole: (id, role) => api.patch(`/api/personnel/${id}/assigner_role/`, {role}),
  toggleActive: (id) => api.post(`/api/personnel/${id}/toggle_active/`),
}
export const incidents = {
  list: (p) => api.get('/api/incidents/', {params:p}),
  create: (d) => api.post('/api/incidents/', d, {headers:{'Content-Type':'multipart/form-data'}}),
  update: (id, d) => api.patch(`/api/incidents/${id}/`, d),
  resoudre: (id) => api.post(`/api/incidents/${id}/resoudre/`),
  stats: () => api.get('/api/incidents/stats/'),
}
export const qr = {
  generer: (d) => api.post('/api/qr/generer/', d),
  scanner: (d) => api.post('/api/qr/scanner/', d),
  scannerPersonnel: (d) => api.post('/api/qr/scanner_personnel/', d),
  validerParPersonnel: (d) => api.post('/api/qr/valider_par_personnel/', d),
  viderHistorique: (type_repas) => api.delete(`/api/qr/vider_historique/?type_repas=${type_repas}`),
  validerParNumero: (d) => api.post('/api/qr/valider_par_numero/', d),
  repas: (p) => api.get('/api/repas/', {params:p}),
  historiqueScans: (p) => api.get('/api/personnel/scans_historique/', {params:p}),
}
export const occupationHistoryAdmin = {
  delete: (id) => api.delete(`/api/occupation-history-admin/${id}/`),
  update: (id,d) => api.patch(`/api/occupation-history-admin/${id}/`, d),
}
export const occupationHistory = {
  recherche: (p) => api.get('/api/occupation-history/recherche/', {params:p}),
  list: (p) => api.get('/api/occupation-history/', {params:p}),
  exportCsv: (p) => `${BASE}/api/occupation-history/export_csv/?${new URLSearchParams(p||{})}`,
}
export const voyages = {
  list: (p) => api.get('/api/voyages/', {params:p}),
  create: (d) => api.post('/api/voyages/', d),
  update: (id, d) => api.patch(`/api/voyages/${id}/`, d),
  partir: (id) => api.post(`/api/voyages/${id}/partir/`),
  revenir: (id,d) => api.post(`/api/voyages/${id}/revenir/`, d),
  stats: () => api.get('/api/voyages/stats/'),
  vueEnsemble: (p) => api.get('/api/voyages/vue_ensemble/', {params:p}),
  exportCsv: (p) => `${BASE}/api/voyages/export_csv/?${new URLSearchParams(p||{})}`,
  annuler: (id) => api.post(`/api/voyages/${id}/annuler/`),
  supprimer: (id) => api.delete(`/api/voyages/${id}/supprimer_planifie/`),
}
export const audit = {
  list: (p) => api.get('/api/audit/', {params:p}),
}

export const evenements = {
  list: (p) => api.get('/api/evenements/', {params:p}),
  create: (d) => api.post('/api/evenements/', d),
  update: (id,d) => api.patch(`/api/evenements/${id}/`, d),
  delete: (id) => api.delete(`/api/evenements/${id}/`),
  notifier: (id) => api.post(`/api/evenements/${id}/notifier/`),
  agenda: () => api.get('/api/evenements/agenda/'),
  changerStatut: (id,statut) => api.patch(`/api/evenements/${id}/changer_statut/`, {statut}),
}
export const notifications = {
  list: (p) => api.get('/api/notifications/', {params:p}),
  compteur: () => api.get('/api/notifications/compteur/'),
  marquerLu: (id) => api.post(`/api/notifications/${id}/marquer_lu/`),
  toutLire: () => api.post('/api/notifications/tout_lire/'),
}
export const alertes = {
  list: () => api.get('/api/alertes/'),
  create: (d) => api.post('/api/alertes/', d),
  desactiver: (id) => api.post(`/api/alertes/${id}/desactiver/`),
}

export const demandes = {
  list: (p) => api.get('/api/demandes/', {params:p}),
  create: (d) => api.post('/api/demandes/', d),
  delete: (id) => api.delete(`/api/demandes/${id}/`),
  stats: () => api.get('/api/demandes/stats/'),
  valider: (id, d) => api.post(`/api/demandes/${id}/valider/`, d),
  rejeter: (id, d) => api.post(`/api/demandes/${id}/rejeter/`, d),
  proposer: (id, d) => api.post(`/api/demandes/${id}/proposer/`, d),
  accepterProposition: (id) => api.post(`/api/demandes/${id}/accepter_proposition/`),
  refuserProposition: (id) => api.post(`/api/demandes/${id}/refuser_proposition/`),
  annuler: (id) => api.post(`/api/demandes/${id}/annuler/`),
}

export const adminApi = {
  users: () => api.get('/api/admin/users/'),
  toggleActive: (id) => api.post(`/api/admin/users/${id}/toggle-active/`),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}/delete/`),
  assignRole: (id, role) => api.post(`/api/admin/users/${id}/role/`, {role}),
}
