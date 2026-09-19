import { useState, useEffect } from 'react'
import { parametres } from '../api'

const DEFAUT = 'Roxgold SiteLife'

/**
 * Nom de l'application, configurable depuis Parametrage -> General
 * (cle 'nom_application') plutot que code en dur - un changement de nom
 * ne necessite alors plus de redeploiement.
 *
 * Usage: const nomApp = useAppName()
 */
export function useAppName() {
  const [nom, setNom] = useState(DEFAUT)

  useEffect(() => {
    parametres.list().then(r => {
      const p = r.data?.find?.(x => x.cle === 'nom_application')
      if (p?.valeur) setNom(p.valeur)
    }).catch(() => {})
  }, [])

  return nom
}
