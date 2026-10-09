import { useEffect, useState } from 'react'
import { parametres } from '../api'

export const MOTIFS_DEFAUT = ['repos', 'medical', 'formation', 'conge', 'familial', 'administratif', 'autre']
export const parseMotifs = (v) => {
  const l = String(v || '').split(',').map(x => x.trim()).filter(Boolean)
  return l.length ? l : MOTIFS_DEFAUT
}
export const libelleMotif = (m) => m ? m.charAt(0).toUpperCase() + m.slice(1) : ''

// Motifs du Centre de mobilité, configurables dans Paramétrage → 🧭 Motifs mobilité
export function useMotifsMobilite() {
  const [motifs, setMotifs] = useState(MOTIFS_DEFAUT)
  useEffect(() => {
    let annule = false
    parametres.list().then(r => {
      const p = (r.data || []).find(x => x.cle === 'mobilite_motifs')
      if (!annule && p) setMotifs(parseMotifs(p.valeur))
    }).catch(() => {})
    return () => { annule = true }
  }, [])
  return motifs
}
