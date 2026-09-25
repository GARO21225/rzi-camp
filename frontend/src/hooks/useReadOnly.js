import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { rolesAPI } from '../api'

/**
 * Renvoie true si la PAGE COURANTE est configuree en "lecture seule" pour
 * le role de l'utilisateur, depuis Parametrage -> Roles & Acces
 * (RoleCustom.pages_readonly - une liste de pages, pas un booleen global :
 * un role peut ecrire sur une page et rester en lecture seule sur une
 * autre). L'admin n'est JAMAIS en lecture seule via ce systeme, quel que
 * soit le reglage - protection deliberee contre un auto-verrouillage.
 *
 * Usage: const lectureSeule = useReadOnly()
 * puis: <button disabled={lectureSeule} ...>
 */
export function useReadOnly() {
  const { user } = useStore()
  const location = useLocation()
  const role = (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    if (isAdmin) { setReadOnly(false); return }
    rolesAPI.list().then(r => {
      const liste = r.data?.results || r.data || []
      const roleCustom = liste.find(x => x.code === role)
      const pagesRO = roleCustom?.pages_readonly || []
      setReadOnly(pagesRO.includes(location.pathname))
    }).catch(() => setReadOnly(false))
  }, [isAdmin, role, location.pathname])

  return readOnly
}
