import { useEffect } from 'react'
import { parametres as paramAPI } from '../api'
import { useStore } from '../store'

/**
 * Applique au chargement de l'app les paramètres visuels enregistrés dans
 * Paramétrage : couleur primaire/accent (variables CSS --rzc-navy /
 * --rzc-ore-gold, source unique dont héritent toutes les pages) et logo
 * custom. Se contente de ne rien faire si aucun paramètre n'est encore
 * défini (valeurs par défaut du design system inchangées).
 */
export function useTheme() {
  const setLogoUrl = useStore(s => s.setLogoUrl)

  useEffect(() => {
    paramAPI.list()
      .then(r => {
        const byKey = {}
        for (const p of (r.data || [])) byKey[p.cle] = p.valeur
        const root = document.documentElement.style
        if (byKey.theme_primaire) root.setProperty('--rzc-navy', byKey.theme_primaire)
        if (byKey.theme_accent)   root.setProperty('--rzc-ore-gold', byKey.theme_accent)
        if (byKey.theme_succes)   root.setProperty('--rzc-green', byKey.theme_succes)
        if (byKey.theme_danger)   root.setProperty('--rzc-red', byKey.theme_danger)
        if (byKey.theme_info)     root.setProperty('--rzc-blue', byKey.theme_info)
        if (byKey.theme_police)   root.setProperty('--rzc-font', `'${byKey.theme_police}', system-ui, sans-serif`)
        if (byKey.theme_fond_induction) root.setProperty('--rzc-fond-induction', byKey.theme_fond_induction)
        if (byKey.logo_base64) {
          setLogoUrl(`data:${byKey.logo_mime || 'image/png'};base64,${byKey.logo_base64}`)
        }
      })
      .catch(() => { /* paramètres indisponibles -> valeurs par défaut, silencieux */ })
  }, [setLogoUrl])
}
