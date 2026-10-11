import { useEffect, useRef } from 'react'
import { abonnerPulse } from '../utils/pulse'

/** Appelle `rappel` (sans bruit visuel) dès que l'un des domaines change : 'notifs'|'demandes'|'incidents'|'plaintes'. */
export function useSurPulse(domaines, rappel) {
  const ref = useRef(rappel)
  ref.current = rappel
  const cle = domaines.join(',')
  useEffect(() => abonnerPulse(cle.split(','), (d) => ref.current?.(d)), [cle])
}
