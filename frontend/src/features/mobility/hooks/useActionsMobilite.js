// Actions du Centre de Mobilité : un seul clic suffit (bouton bloqué pendant l'action ET le rechargement),
// erreurs serveur lisibles, « jour non autorisé » → confirmation admin puis relance forcée.
import { useState, useCallback } from 'react'
import { api } from '../services/mobilityApi'
import { toast, confirmDialog } from '../../../toast'

export function useActionsMobilite(recharger) {
  const [enCours, setEnCours] = useState({})
  const agir = useCallback(async (cle, fn) => {
    setEnCours(e => (e[cle] ? e : { ...e, [cle]: true }))
    try { await fn() }
    catch { toast.error('Erreur réseau — réessayez') }
    finally { setEnCours(e => { const n = { ...e }; delete n[cle]; return n }) }
  }, [])
  const envoyer = useCallback(async (path, body = {}, okMsg) => {
    let res = await api(path, { method: 'POST', body: JSON.stringify(body) })
    let d = await res.json().catch(() => ({}))
    if (!res.ok && d.code === 'jour_non_autorise' && d.forcable && await confirmDialog(`${d.error}\n\nValider quand même ?`)) {
      res = await api(path, { method: 'POST', body: JSON.stringify({ ...body, forcer_jour: true }) })
      d = await res.json().catch(() => ({}))
    }
    if (!res.ok) { toast.error(d.error || d.detail || 'Erreur'); return false }
    if (okMsg) toast.success(okMsg)
    if (d.commentaire_admin && /⚠️/.test(d.commentaire_admin)) toast.error(d.commentaire_admin)
    await recharger()
    return true
  }, [recharger])
  return { enCours, agir, envoyer }
}
