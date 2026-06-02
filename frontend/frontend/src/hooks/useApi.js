/**
 * useApi — hook centralisant BASE URL + Authorization header
 * Remplace le pattern répété dans 11 pages:
 *   const BASE = import.meta?.env?.VITE_API_URL || '...'
 *   const token = localStorage.getItem('access_token') || ''
 */
import { useCallback } from 'react'

const BASE_URL = (() => {
  if (import.meta?.env?.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  const h = window.location.hostname
  if (h.includes('onrender.com') && h.includes('frontend'))
    return 'https://' + h.replace('frontend', 'backend')
  if (h !== 'localhost' && h !== '127.0.0.1')
    return 'https://rzi-camp-backend.onrender.com'
  return 'http://localhost:8000'
})()

export function getBase() { return BASE_URL }

export function getHeaders(extra = {}) {
  const token = localStorage.getItem('access_token') || ''
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...extra,
  }
}

export function useApi() {
  const get = useCallback(async (path, params = {}) => {
    const url = new URL(`${BASE_URL}${path}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const r = await fetch(url.toString(), { headers: getHeaders() })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  }, [])

  const post = useCallback(async (path, body) => {
    const r = await fetch(`${BASE_URL}${path}`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify(body)
    })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(JSON.stringify(e)) }
    return r.json()
  }, [])

  const patch = useCallback(async (path, body) => {
    const r = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body)
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json().catch(() => ({}))
  }, [])

  const del = useCallback(async (path) => {
    const r = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE', headers: getHeaders()
    })
    return r.ok || r.status === 404
  }, [])

  const upload = useCallback(async (path, formData) => {
    const token = localStorage.getItem('access_token') || ''
    const r = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  }, [])

  return { get, post, patch, del, upload, base: BASE_URL }
}
