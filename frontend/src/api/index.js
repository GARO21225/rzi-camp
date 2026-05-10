import axios from 'axios'

function getBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  const h = window.location.hostname
  if (h.includes('onrender.com') && h.includes('frontend'))
    return 'https://' + h.replace('frontend', 'backend')
  if (h !== 'localhost' && h !== '127.0.0.1') return window.location.origin
  return 'http://localhost:8000'
}

const BASE = getBase()
window.__API_BASE__ = BASE

const api = axios.create({ baseURL: BASE, timeout: 20000 })
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('access_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
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
      } catch { localStorage.clear(); window.location.replace('/login') }
    } else { localStorage.clear(); window.location.replace('/login') }
  }
  return Promise.reject(err)
})

export const auth = {
  login: (u, p) => api.post('/api/auth/login/', typeof u==='object' ? u : { username:u, password:p }),
  me:      () => api.get('/api/auth/me/'),
  refresh: d  => api.post('/api/auth/refresh/', d),
}

export const batiments = {
  list:        p    => api.get('/api/batiments/', { params:p }),
  get:         id   => api.get(`/api/batiments/${id}/`),
  update:      (id,d)=> api.patch(`/api/batiments/${id}/`, d),
  stats:       ()   => api.get('/api/batiments/stats/'),
  geojson:     ()   => api.get('/api/batiments/geojson/'),
  exportCsv:   ()   => api.get('/api/batiments/export_csv/', { responseType:'blob' }),
  exportBlocs: ()   => api.get('/api/batiments/export_par_bloc/', { responseType:'blob' }),
}

export const personnel = {
  list:            p    => api.get('/api/personnel/', { params:p }),
  get:             id   => api.get(`/api/personnel/${id}/`),
  create:          d    => api.post('/api/personnel/', d),
  update:          (id,d)=> api.patch(`/api/personnel/${id}/`, d),
  delete:          id   => api.delete(`/api/personnel/${id}/`),
  monProfil:       ()   => api.get('/api/batiments/mon_profil/'),
  assigRole:       (id,role) => api.post(`/api/personnel/${id}/assigner_role/`, { role }),
  toggleActive:    id   => api.post(`/api/personnel/${id}/toggle_active/`),
  regenererQR:     id   => api.post(`/api/personnel/${id}/regenerer_qr/`),
  regenererCompte: id   => api.post(`/api/personnel/${id}/regenerer_compte/`),
  regenererTousQR:     ()   => api.post('/api/personnel/regenerer_tous_qr/'),
  regenererQr:         id   => api.post(`/api/personnel/${id}/regenerer_qr/`),
  historiqueVoyages:   id   => api.get(`/api/personnel/${id}/historique_voyages/`).catch(()=>({ data:[] })),
  stats:               ()   => api.get('/api/personnel/stats/').catch(()=>({ data:{} })),
}

export const voyages = {
  list:        p    => api.get('/api/voyages/', { params:p }),
  create:      d    => api.post('/api/voyages/', d),
  update:      (id,d)=> api.patch(`/api/voyages/${id}/`, d),
  supprimer:   id   => api.delete(`/api/voyages/${id}/`),
  delete:      id   => api.delete(`/api/voyages/${id}/`),
  partir:      id   => api.post(`/api/voyages/${id}/partir/`),
  revenir:     id   => api.post(`/api/voyages/${id}/revenir/`),
  annuler:     id   => api.post(`/api/voyages/${id}/annuler/`),
  stats:       ()   => api.get('/api/voyages/stats/'),
  vueEnsemble: ()   => api.get('/api/voyages/', { params:{ page_size:500 } }),
  exportCsv:   ()   => api.get('/api/voyages/export_csv/', { responseType:'blob' }).catch(()=>({})),
}

export const incidents = {
  list:        p    => api.get('/api/incidents/', { params:p }),
  create:      d    => api.post('/api/incidents/', d),
  update:      (id,d)=> api.patch(`/api/incidents/${id}/`, d),
  delete:      id   => api.delete(`/api/incidents/${id}/`),
  resoudre:    id   => api.post(`/api/incidents/${id}/resoudre/`),
  stats:       ()   => api.get('/api/incidents/stats/'),
}

export const qr = {
  scanner:             d => api.post('/api/qr/scanner/', d),
  repas:               p => api.get('/api/repas/', { params:p }),
  validerParPersonnel: d => api.post('/api/qr/valider_par_personnel/', d),
  qrRestaurant:        () => api.get('/api/qr/qr_restaurant/'),
  viderHistorique:     t => api.delete(`/api/qr/vider_historique/?type_repas=${t}`),
}

export const evenements = {
  list:            p  => api.get('/api/evenements/', { params:p }),
  create:          d  => api.post('/api/evenements/', d),
  delete:          id => api.delete(`/api/evenements/${id}/`),
  notifs:          () => api.get('/api/notifications/'),
  marquerLu:       id => api.post(`/api/notifications/${id}/marquer_lu/`),
  marquerToutLu:   () => api.post('/api/notifications/marquer_tout_lu/'),
  simpleNotifs:    () => api.get('/api/simple-notifications/'),
  marquerSimpleLu: id => api.post(`/api/simple-notifications/${id}/marquer_lu/`),
  alertes:         () => api.get('/api/alertes/'),
  creerAlerte:     d  => api.post('/api/alertes/', d),
  desactiverAlerte:id => api.post(`/api/alertes/${id}/desactiver/`),
  notifier:      (id,d) => api.post(`/api/evenements/${id}/notifier/`, d).catch(()=>({})),
  changerStatut: (id,d) => api.post(`/api/evenements/${id}/changer_statut/`, d).catch(()=>({})),
}

export const demandes = {
  list:     p  => api.get('/api/demandes/', { params:p }),
  create:   d  => api.post('/api/demandes/', d),
  delete:   id => api.delete(`/api/demandes/${id}/`),
  valider:  (id,d) => api.post(`/api/demandes/${id}/valider/`, d),
  rejeter:  (id,d) => api.post(`/api/demandes/${id}/rejeter/`, d),
  proposer: (id,d) => api.post(`/api/demandes/${id}/proposer/`, d),
  accepter: id => api.post(`/api/demandes/${id}/accepter/`),
  refuser:              id => api.post(`/api/demandes/${id}/refuser/`),
  accepterProposition:  id => api.post(`/api/demandes/${id}/accepter/`),
  refuserProposition:   id => api.post(`/api/demandes/${id}/refuser/`),
  annuler:              id => api.post(`/api/demandes/${id}/annuler/`).catch(()=>({})),
  stats:    () => api.get('/api/demandes/stats/').catch(()=>({ data:{} })),
}

export const occupationHistory = {
  recherche:      p => api.get('/api/occupation-history/', { params:p }),
  adminRecherche: p => api.get('/api/occupation-history-admin/', { params:p }),
  exportCsv:      p => api.get('/api/occupation-history/export_csv/', { params:p, responseType:'blob' })
    .catch(()=> api.get('/api/occupation-history/', { params:p })),
}

export const alertes = {
  list:       () => api.get('/api/alertes/'),
  create:     d  => api.post('/api/alertes/', d),
  delete:     id => api.delete(`/api/alertes/${id}/`),
  desactiver: id => api.post(`/api/alertes/${id}/desactiver/`),
}

export const audit = {
  list: p => api.get('/api/audit/', { params:p }),
}

export const adminApi = {
  users:       ()        => api.get('/api/admin/users/'),
  toggleActive:(id)      => api.post(`/api/admin/users/${id}/toggle-active/`),
  deleteUser:  (id)      => api.delete(`/api/admin/users/${id}/delete/`),
  assignRole:  (id,role) => api.post(`/api/admin/users/${id}/role/`, { role }),
}

// Alias de compatibilité
export const historique          = occupationHistory
export const occupationHistoryAdmin = occupationHistory
export const notifications       = evenements
export const repasAPI            = qr

export default api
