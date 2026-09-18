import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { parametres } from '../api'

/**
 * Renvoie true si le role de l'utilisateur courant est configure en
 * "lecture seule" depuis Parametrage -> Roles & Acces (readonly_role_<role>).
 * L'admin n'est JAMAIS en lecture seule via ce systeme, quel que soit le
 * reglage - protection deliberee contre un auto-verrouillage.
 *
 * Usage: const lectureSeule = useReadOnly()
 * puis: <button disabled={lectureSeule} ...>
 */
export function useReadOnly() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    if (isAdmin) { setReadOnly(false); return }
    parametres.list().then(r => {
      const p = r.data?.find?.(x => x.cle === `readonly_role_${role}`)
      setReadOnly(p?.valeur === '1')
    }).catch(() => setReadOnly(false))
  }, [isAdmin, role])

  return readOnly
}
