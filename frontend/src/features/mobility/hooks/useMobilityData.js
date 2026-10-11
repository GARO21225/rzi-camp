// État + rafraîchissement des données du Centre de Mobilité (30 s, uniquement onglet visible).
import { useState, useEffect, useCallback } from 'react'
import { chargerCentreMobilite } from '../services/mobilityApi'

const VIDE = {
  voyages: [], stats: {}, personnel: [], rotations: [], rappels: [], flotte: [],
  retoursAnticipes: [], demandesAOrganiser: [], itineraires: [], demandesVoyageEnAttente: [],
}

export function useMobilityData(intervalMs = 30000) {
  const [data, setData] = useState(VIDE)
  const [loading, setLoading] = useState(true)
  const [echecs, setEchecs] = useState([])   // ressources non chargées (réponse partielle)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { donnees, echecs: e } = await chargerCentreMobilite()
      // Une ressource en échec garde sa dernière valeur connue (pas d'écran vidé par un raté réseau).
      setData(prev => ({ ...prev, ...donnees }))
      setEchecs(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const iv = setInterval(() => { if (!document.hidden) load() }, intervalMs)
    return () => clearInterval(iv)
  }, [load, intervalMs])

  return { ...data, loading, echecs, load }
}
