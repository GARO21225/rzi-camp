import React from 'react'

/**
 * Badges mobile money — couleurs de marque officielles, style badge propre.
 * Ce ne sont PAS des reproductions exactes des logos déposés (protégés par
 * droit de marque) : des badges professionnels aux bonnes couleurs et
 * lettrage clair, pratique courante pour afficher un moyen de paiement
 * sans reproduire l'artwork exact d'une marque tierce.
 */

const base = { display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:8, fontWeight:800, fontFamily:'system-ui,sans-serif', flexShrink:0 }

export function OrangeMoneyIcon({ size=28 }) {
  return (
    <div style={{ ...base, width:size, height:size, background:'#FF6600', color:'#fff', fontSize:size*0.32 }}>
      OM
    </div>
  )
}

export function WaveIcon({ size=28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" style={{ borderRadius:8, flexShrink:0 }}>
      <rect width="28" height="28" rx="8" fill="#1DC8E4"/>
      <path d="M4 15c2-4 4-4 6 0s4 4 6 0 4-4 6 0" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

export function MTNMomoIcon({ size=28 }) {
  return (
    <div style={{ ...base, width:size, height:size, background:'#FFCC00', color:'#000', fontSize:size*0.24 }}>
      MoMo
    </div>
  )
}

export function MoovMoneyIcon({ size=28 }) {
  return (
    <div style={{ ...base, width:size, height:size, background:'#0033A0', color:'#fff', fontSize:size*0.24 }}>
      Moov
    </div>
  )
}

export const MOBILE_MONEY_ICONS = {
  om: OrangeMoneyIcon,
  wave: WaveIcon,
  mtn: MTNMomoIcon,
  moov: MoovMoneyIcon,
}

export const MOBILE_MONEY_LABELS = {
  om: 'Orange Money',
  wave: 'Wave',
  mtn: 'MTN Mobile Money',
  moov: 'Moov Money',
}

/** Badge complet icône + libellé, prêt à poser dans un bouton/liste. */
export function MobileMoneyBadge({ operateur, size=24, showLabel=true, style }) {
  const Icon = MOBILE_MONEY_ICONS[operateur]
  if (!Icon) return null
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:8, ...style }}>
      <Icon size={size} />
      {showLabel && <span>{MOBILE_MONEY_LABELS[operateur]}</span>}
    </span>
  )
}
