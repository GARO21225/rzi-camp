import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { rolesAPI } from '../api'

/**
 * Renvoie true si le role de l'utilisateur courant est configure en
 * "lecture seule" depuis Parametrage -> Roles & Acces (RoleCustom.readonly).
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
    rolesAPI.list().then(r => {
      const liste = r.data?.results || r.data || []
      const roleCustom = liste.find(x => x.code === role)
      setReadOnly(!!roleCustom?.readonly)
    }).catch(() => setReadOnly(false))
  }, [isAdmin, role])

  return readOnly
}
