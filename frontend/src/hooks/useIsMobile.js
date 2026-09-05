import { useState, useEffect } from 'react'

/**
 * true si la largeur d'écran est sous le seuil mobile (768px par défaut).
 * Contrairement à un simple `window.innerWidth < 768` lu une seule fois au
 * montage, ce hook réagit à la rotation d'écran et au redimensionnement.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return isMobile
}
