/**
 * useAsync — centralise le pattern setLoading/setError/load
 * Remplace dans 16 pages:
 *   const [loading, setLoading] = useState(false)
 *   const load = useCallback(async () => {
 *     setLoading(true)
 *     try { ... } catch(e) { ... } finally { setLoading(false) }
 *   }, [...])
 */
import { useState, useCallback } from 'react'

export function useAsync(asyncFn, deps = []) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [data,    setData]    = useState(null)

  const run = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFn(...args)
      setData(result)
      return result
    } catch (e) {
      setError(e.message || 'Erreur inattendue')
      return null
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { loading, error, data, run }
}

/**
 * useConfirm — centralise window.confirm (10 pages)
 * Retourne une fonction async qui affiche une confirmation
 */
export function useConfirm() {
  return useCallback((message) => {
    return new Promise(resolve => {
      resolve(window.confirm(message))
    })
  }, [])
}
