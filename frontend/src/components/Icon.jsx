import React from 'react'

// Icônes au trait (viewBox 24) pour la coque mobile : en-tête, tiroir,
// barre d'onglets, accueil. Contrairement aux emoji, elles prennent la
// couleur du texte (currentColor), donc l'état actif/inactif reste lisible
// sur fond sombre et le rendu est identique sur Android et iOS.
// Ajouter une icône = ajouter une entrée ici, rien d'autre.
const PATHS = {
  menu:      <path d="M4 7h16M4 12h16M4 17h16" />,
  close:     <path d="M6 6l12 12M18 6L6 18" />,
  search:    <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  bell:      <><path d="M6 16v-5a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 21h4" /></>,
  logout:    <><path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" /><path d="M10 16l4-4-4-4M14 12H4" /></>,
  refresh:   <><path d="M4 12a8 8 0 0114-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 01-14 5.3L4 15" /><path d="M4 20v-5h5" /></>,
  chevron:   <path d="M9 6l6 6-6 6" />,
  dashboard: <><rect x="4" y="4" width="7" height="9" rx="1.5" /><rect x="13" y="4" width="7" height="5" rx="1.5" /><rect x="13" y="11" width="7" height="9" rx="1.5" /><rect x="4" y="15" width="7" height="5" rx="1.5" /></>,
  compass:   <><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  home:      <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  user:      <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>,
  users:     <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.8a3.5 3.5 0 010 6.4M18 14.5a6.5 6.5 0 013.5 5.5" /></>,
  file:      <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  bus:       <><rect x="5" y="4" width="14" height="13" rx="2" /><path d="M5 11h14M8 20v-3M16 20v-3" /></>,
  utensils:  <><path d="M5 3v5a2 2 0 004 0V3M7 3v18" /><path d="M16 3c-2 2-2 6 0 8v10" /></>,
  wrench:    <path d="M14.5 6.5a4 4 0 005 5L11 20a2.1 2.1 0 01-3-3l8.5-8.5a4 4 0 00-2-2z" />,
  alert:     <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></>,
  calendar:  <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
  box:       <><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></>,
  report:    <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  check:     <path d="M5 12l5 5L20 7" />,
  bed:       <><path d="M3 18V6M3 14h18v4" /><path d="M21 14v-2a3 3 0 00-3-3h-7v5" /><circle cx="7" cy="11" r="2" /></>,
  map:       <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  suitcase:  <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18" /></>,
  cart:      <><path d="M3 4h2l2.4 11h11L21 8H6.2" /><circle cx="9" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>,
  message:   <path d="M4 5h16v11H9l-5 4z" />,
  shield:    <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  sliders:   <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  spark:     <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  pulse:     <path d="M3 12h4l3-7 4 14 3-7h4" />,
  tent:      <><path d="M3 20L12 4l9 16z" /><path d="M9 20l3-6 3 6" /></>,
  helmet:    <><path d="M3 17h18" /><path d="M5 17a7 7 0 0114 0" /><path d="M12 6v5M9 7.5V11M15 7.5V11" /></>,
  grid:      <><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></>,
}

// Icône de chaque page du menu (coque mobile). Une page absente d'ici
// (menu personnalisé côté serveur) garde son emoji : rien ne casse.
const ICONES_ROUTE = {
  '/': 'dashboard', '/accueil': 'home', '/carte': 'map', '/personnel': 'user', '/presences': 'check',
  '/induction': 'shield', '/induction-camp': 'tent', '/epi': 'helmet', '/annuaire': 'users',
  '/residences': 'bed', '/rotations': 'compass', '/conduite': 'bus', '/voyages': 'suitcase',
  '/restauration': 'utensils', '/restaurants': 'utensils', '/boutique': 'cart', '/reservations': 'calendar',
  '/maintenance': 'wrench', '/plaintes': 'message', '/evenements': 'calendar', '/demandes': 'file',
  '/analytics': 'report', '/rapports': 'report', '/historique': 'file', '/audit': 'search',
  '/assistant': 'spark', '/status': 'pulse', '/parametrage': 'sliders', '/mon-compte': 'user',
}
export const iconeRoute = (to) => ICONES_ROUTE[to] || null

export default function Icon({ name, size = 20, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ flexShrink: 0, display: 'block', ...style }}>
      {PATHS[name] || null}
    </svg>
  )
}
