// Préchargement du code des pages du menu, en arrière-plan.
//
// Chaque page est chargée « à la demande » (lazy) pour que le premier
// affichage de l'app reste léger (règle CLAUDE.md n°2). Revers : la PREMIÈRE
// ouverture de chaque page télécharge son code - 300 à 600 ms en 3G au camp,
// ressenti comme de la lenteur « en changeant de page ». Une fois l'app
// affichée et au repos, on télécharge donc le code des pages du menu de
// l'utilisateur, une par une : le changement de page devient immédiat.
// Mêmes import() que les lazy() d'App.jsx -> mêmes fichiers, aucun doublon.

const PAGES = {
  '/': () => import('./pages/Dashboard'),
  '/accueil': () => import('./pages/Accueil'),
  '/carte': () => import('./pages/MapPage'),
  '/rotations': () => import('./pages/MissionControl'),
  '/conduite': () => import('./pages/Conduite'),
  '/residences': () => import('./pages/Residences'),
  '/personnel': () => import('./pages/Personnel'),
  '/presences': () => import('./pages/Presences'),
  '/induction': () => import('./pages/InductionPage'),
  '/induction-camp': () => import('./pages/InductionCamp'),
  '/epi': () => import('./pages/EquipementsEPI'),
  '/annuaire': () => import('./pages/AnnuairePage'),
  '/restauration': () => import('./pages/Restauration'),
  '/reservations': () => import('./pages/ReservationsPage'),
  '/maintenance': () => import('./pages/Maintenance'),
  '/plaintes': () => import('./pages/Plaintes'),
  '/evenements': () => import('./pages/Evenements'),
  '/demandes': () => import('./pages/Demandes'),
  '/voyages': () => import('./pages/Voyages'),
  '/analytics': () => import('./pages/Analytics'),
  '/rapports': () => import('./pages/RapportsPage'),
  '/historique': () => import('./pages/Historique'),
  '/audit': () => import('./pages/AuditPage'),
  '/assistant': () => import('./pages/AssistantIA'),
  '/status': () => import('./pages/StatusPage'),
  '/parametrage': () => import('./pages/Parametrage'),
  '/mon-compte': () => import('./pages/MonCompte'),
}

let dejaLance = false

/** Précharge (une fois par session) le code des pages listées, sans gêner
 *  la page en cours : démarre quand le navigateur est au repos, une page à
 *  la fois. Rien en mode « économie de données ». */
export function prechargerPages(chemins, { gestionBar = false } = {}) {
  if (dejaLance) return
  dejaLance = true
  try { if (navigator.connection?.saveData) return } catch { /* ignore */ }
  const file = [...new Set(chemins)]
    .map(c => c === '/boutique' ? (gestionBar ? () => import('./pages/Boutique') : () => import('./pages/BarClient')) : PAGES[c])
    .filter(Boolean)
  const auRepos = window.requestIdleCallback || (cb => setTimeout(cb, 1200))
  const suivant = () => {
    const charger = file.shift()
    if (!charger) return
    charger().catch(() => {}).finally(() => auRepos(suivant))
  }
  auRepos(suivant)
}
