import axios from 'axios'
const BASE = import.meta.env.VITE_API_URL || ''
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
  login: (u,p) => api.post('/api/auth/login/', {username:u, password:p}),
  me: () => api.get('/api/auth/me/'),
}
export const batiments = {
  list: (p) => api.get('/api/batiments/', {params:p}),
  geojson: (p) => api.get('/api/batiments/geojson/', {params:p}),
  stats: () => api.get('/api/batiments/stats/'),
  update: (id,d) => api.patch(`/api/batiments/${id}/`, d),
  exportCsv: (p) => `${BASE}/api/batiments/export_csv/?${new URLSearchParams(p)}`,
  exportBlocs: () => `${BASE}/api/batiments/export_par_bloc/`,
}
export const personnel = {
  list: (p) => api.get('/api/personnel/', {params:p}),
  create: (d) => api.post('/api/personnel/', d),
  update: (id,d) => api.patch(`/api/personnel/${id}/`, d),
  delete: (id) => api.delete(`/api/personnel/${id}/`),
  regenererQr: (id) => api.post(`/api/personnel/${id}/regenerer_qr/`),
}
export const incidents = {
  list: (p) => api.get('/api/incidents/', {params:p}),
  create: (d) => api.post('/api/incidents/', d, {headers:{'Content-Type':'multipart/form-data'}}),
  resoudre: (id) => api.post(`/api/incidents/${id}/resoudre/`),
  stats: () => api.get('/api/incidents/stats/'),
}
export const qr = {
  generer: (d) => api.post('/api/qr/generer/', d),
  scanner: (d) => api.post('/api/qr/scanner/', d),
  repas: (p) => api.get('/api/repas/', {params:p}),
}
export const audit = {
  list: (p) => api.get('/api/audit/', {params:p}),
}
