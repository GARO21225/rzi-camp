import { useEffect, useState } from 'react'
import { getLangue, setLangue } from '../i18n'

/** Bascule FR / EN (mémorisée sur l'appareil). `sombre` : pour un fond foncé (en-tête). */
export default function ChoixLangue({ sombre = false, style = {} }) {
  const [l, setL] = useState(getLangue())
  useEffect(() => {
    const maj = (e) => setL(e.detail)
    window.addEventListener('rzc-langue', maj)
    return () => window.removeEventListener('rzc-langue', maj)
  }, [])
  const bouton = (code, libelle) => (
    <button key={code} type="button" onClick={() => setLangue(code)} aria-pressed={l === code}
      title={code === 'fr' ? 'Français' : 'English'}
      style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, letterSpacing: .4,
        padding: '5px 9px', borderRadius: 99,
        background: l === code ? (sombre ? '#C9972B' : '#0F2A5C') : 'transparent',
        color: l === code ? (sombre ? '#081B3D' : '#fff') : (sombre ? 'rgba(255,255,255,.75)' : '#475569') }}>
      {libelle}
    </button>
  )
  return (
    <div translate="no" role="group" aria-label="Langue / Language"
      style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 99, flexShrink: 0,
        background: sombre ? 'rgba(255,255,255,.08)' : '#EEF2F7', border: sombre ? '1px solid rgba(255,255,255,.12)' : '1px solid #E2E8F0', ...style }}>
      {bouton('fr', 'FR')}{bouton('en', 'EN')}
    </div>
  )
}
