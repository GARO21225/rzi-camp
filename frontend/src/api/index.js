import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  async err => {
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
  }
)

export default api

export const auth = {
  login: (u, p) => api.post('/api/auth/login/', { username: u, password: p }),
  me: () => api.get('/api/auth/me/'),
}

export const batiments = {
  list: (params) => api.get('/api/batiments/', { params }),
  geojson: (params) => api.get('/api/batiments/geojson/', { params }),
  stats: () => api.get('/api/batiments/stats/'),
  update: (id, data) => api.patch(`/api/batiments/${id}/`, data),
}

export const incidents = {
  list: (params) => api.get('/api/incidents/', { params }),
  create: (data) => api.post('/api/incidents/', data),
  resoudre: (id) => api.post(`/api/incidents/${id}/resoudre/`),
  stats: () => api.get('/api/incidents/stats/'),
}

export const qr = {
  generer: (data) => api.post('/api/qr/generer/', data),
  scanner: (data) => api.post('/api/qr/scanner/', data),
  repas: (params) => api.get('/api/repas/', { params }),
}

export const audit = {
  list: (params) => api.get('/api/audit/', { params }),
}
