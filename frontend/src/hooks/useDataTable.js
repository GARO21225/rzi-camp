/**
 * useDataTable — centralise le pattern commun à Personnel, Boutique, Maintenance, etc.
 * - Chargement paginé depuis l'API
 * - Filtres (search + filtres additionnels)
 * - Sélection en masse
 * - Tri
 */
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useApi } from './useApi'

export function useDataTable({
  endpoint,        // '/api/personnel/'
  pageSize = 50,
  filters = {},    // { type_personnel: 'roxgold', ... }
  searchKeys = [], // ['nom', 'prenom', 'societe']
  transform = null // fn pour transformer les données brutes
}) {
  const { get } = useApi()
  const [allData,   setAllData]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [sortKey,   setSortKey]   = useState(null)
  const [sortDesc,  setSortDesc]  = useState(false)
  const [selIds,    setSelIds]    = useState(new Set())
  const [page,      setPage]      = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let all = []
      let url = `${endpoint}?page_size=200`
      // Charger toutes les pages
      while (url) {
        const d = await get(url.replace(/^https?:\/\/[^/]+/, ''))
        const items = d.results || d || []
        all = [...all, ...items]
        url = d.next || null
      }
      setAllData(transform ? all.map(transform) : all)
      setPage(1)
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint, get, transform])

  useEffect(() => { load() }, [load])

  // Filtrage + recherche
  const filtered = useMemo(() => {
    let result = [...allData]

    // Filtres fixes
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined)
        result = result.filter(item => item[k] === v)
    })

    // Recherche full-text
    if (search.trim() && searchKeys.length) {
      const q = search.toLowerCase()
      result = result.filter(item =>
        searchKeys.some(k => String(item[k] || '').toLowerCase().includes(q))
      )
    }

    // Tri
    if (sortKey) {
      result.sort((a, b) => {
        const av = a[sortKey] || ''
        const bv = b[sortKey] || ''
        const cmp = String(av).localeCompare(String(bv))
        return sortDesc ? -cmp : cmp
      })
    }

    return result
  }, [allData, filters, search, searchKeys, sortKey, sortDesc])

  // Pagination
  const pageSize_ = pageSize
  const totalPages = Math.ceil(filtered.length / pageSize_)
  const paginated = filtered.slice((page - 1) * pageSize_, page * pageSize_)

  // Sélection
  const toggleSel = useCallback(id => {
    setSelIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])
  const selectAll  = useCallback(() => setSelIds(new Set(filtered.map(i => i.id))), [filtered])
  const clearSel   = useCallback(() => setSelIds(new Set()), [])
  const toggleSort = useCallback(key => {
    setSortKey(prev => prev === key ? key : key)
    setSortDesc(prev => sortKey === key ? !prev : false)
  }, [sortKey])

  return {
    // Données
    allData, filtered, paginated, loading, error,
    total: filtered.length,
    // Pagination
    page, setPage, totalPages,
    // Filtres
    search, setSearch,
    // Tri
    sortKey, sortDesc, toggleSort,
    // Sélection
    selIds, setSelIds, toggleSel, selectAll, clearSel,
    selectedItems: filtered.filter(i => selIds.has(i.id)),
    // Actions
    reload: load,
  }
}
