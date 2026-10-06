// Source unique des menus par rôle — partagée par Layout (tiroir latéral),
// BottomTabBar (barre mobile) et la garde de routes (RoleGuard dans Layout).
// Avant, ROLE_NAV vivait dans Layout et la barre mobile avait sa propre
// liste "agent" codée en dur, servie à TOUS les non-admins : un rôle
// restauration/HSE/boutique y voyait des onglets vers des pages absentes
// de son propre menu.

export const ROLE_NAV = {
  admin: [
    // ── Vue principale
    { to:'/', label:'📊 Dashboard', exact:true },
    { to:'/carte', label:'🗺️ Carte GIS' },
    // ── Personnel & Conformité
    { group:'Personnel & Conformité' },
    { to:'/personnel', label:'👤 Personnel' },
    { to:'/presences', label:'🟢 Présences' },
    { to:'/induction', label:'🎓 Induction QHSE' },
    { to:'/induction-camp', label:'🏕️ Induction Camp' },
    { to:'/epi', label:'🦺 Équipements EPI' },
    { to:'/annuaire', label:'📋 Annuaire' },
    // ── Hébergement & Mobilité
    { group:'Hébergement & Mobilité' },
    { to:'/residences', label:'🏠 Résidences' },
    { to:'/rotations', label:'🧭 Centre de Mobilité' },
    { to:'/conduite', label:'🚐 Ma conduite' },
    // ── Services
    { group:'Services aux Résidents' },
    { to:'/restauration', label:'🍽️ Restauration' },
    { to:'/boutique', label:'🛒 Bar & Boutique' },
    { to:'/boutique-pos', label:'💳 Boutique POS' },
    { to:'/reservations', label:'📅 Réservations' },
    // ── Exploitation
    { group:'Exploitation' },
    { to:'/maintenance', label:'🛠️ Maintenance' },
    { to:'/plaintes', label:'🧹 Plaintes' },
    { to:'/evenements', label:'📡 Événements' },
    { to:'/demandes', label:'📝 Demandes' },
    { to:'/operations', label:'🖥️ Centre Opérationnel' },
    { to:'/workflows', label:'⚙️ Workflow Hub' },
    { to:'/induction-admin', label:'🎓 Induction (administration)' },
    // ── Pilotage
    { group:'Pilotage & Analyse' },
    { to:'/analytics', label:'📈 Analytics' },
    { to:'/rapports', label:'📄 Rapports' },
    { to:'/historique', label:'📋 Historique' },
    { to:'/audit', label:'🔍 Audit' },
    { to:'/assistant', label:'🤖 Assistant IA' },
    { to:'/status', label:'🔧 Diagnostic' },
    // ── Système
    { group:'Système' },
    { to:'/parametrage', label:'⚙️ Paramétrage' },
  ],
  agent: [
    { to:'/mon-compte', label:'👤 Mon compte' },
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/demandes', label:'📝 Mes demandes' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/voyages', label:'🧳 Voyages' },
    { to:'/restauration', label:'🍽️ Restauration' },
    { to:'/boutique', label:'🍹 Mon bar' },
    { to:'/induction-camp', label:'🏕️ Induction Camp' },
    { to:'/induction', label:'🎓 Mon induction QHSE' },
    { to:'/maintenance', label:'🛠️ Signaler Incident' },
    { to:'/plaintes', label:'🧹 Ma chambre / Plaintes' },
  ],
  restauration: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/restauration', label:'🍽️ Restauration' },
  ],
  technicien: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/maintenance', label:'🛠️ Maintenance' },
    { to:'/induction', label:'🎓 Induction QHSE' },
  ],
  menage: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/maintenance', label:'🛠️ Signaler' },
  ],
  boutique: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/boutique', label:'🛒 Bar & Boutique' },
  ],
  securite: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/annuaire', label:'📋 Annuaire' },
  ],
  medical: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/annuaire', label:'📋 Annuaire' },
  ],
  hse: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/induction', label:'🎓 Induction QHSE' },
    { to:'/maintenance', label:'🛠️ Maintenance' },
    { to:'/epi', label:'🦺 Équipements EPI' },
  ],
  accueil: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/annuaire', label:'📋 Annuaire' },
    { to:'/residences', label:'🏠 Résidences' },
  ],
  manager: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/demandes', label:'📝 Demandes' },
    { to:'/rapports', label:'📄 Rapports' },
    { to:'/analytics', label:'📈 Analytics' },
    { to:'/historique', label:'📋 Historique' },
  ],
}

export const ROLE_LABELS = {
  admin: 'Administrateur',
  agent: 'Agent',
  restauration: 'Restauration',
  technicien: 'Technicien',
  menage: 'Ménage',
  boutique: 'Bar & Boutique',
  securite: 'Sécurité',
  medical: 'Médical',
  hse: 'HSE / QHSE',
  accueil: "Agent d'accueil",
  manager: 'Manager',
}

// Pages personnelles accessibles à TOUT utilisateur connecté, même si son
// menu configuré ne les liste pas (profil, mot de passe).
// '/conduite' : la page n'affiche que les convois dont l'utilisateur est
// lui-même le conducteur (contrôlé côté API), donc sans risque. Idem
// '/boutique' pour un résident : vue « Mon bar » (sa carte, SON bon, SES
// consommations - filtré côté API, cf. restauration/views.py _profil_bar).
// '/induction' et '/induction-camp' : un agent n'y voit que SA propre induction.
export const PAGES_TOUJOURS_AUTORISEES = ['/accueil', '/mon-compte', '/conduite', '/boutique', '/induction', '/induction-camp']

// is_staff/is_superuser (vérité Django) prime toujours sur profile.role.
export function getRole(user) {
  return (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
}

export function isAdminUser(user) {
  return !!(user?.is_staff || user?.is_superuser || getRole(user) === 'admin')
}

// Menu configuré dans Paramétrage (menu_pages) -> entrées canoniques.
function depuisMenuPages(menuPages) {
  if (!menuPages?.length) return null
  const canon = {}
  ;[...ROLE_NAV.admin, ...ROLE_NAV.agent].forEach(item => { if (item.to && item.to !== '/' && !canon[item.to]) canon[item.to] = item })
  // '/' (Dashboard) exclu même si un ancien menu_pages le contient encore :
  // vue camp-wide réservée à l'admin.
  const filtered = menuPages.map(to => canon[to]).filter(Boolean)
  return filtered.length ? filtered : null
}

// Menu effectif d'un non-admin = pages de SON MÉTIER (gérant du bar,
// technicien, HSE...) + pages de RÉSIDENT (demandes, voyages, repas...).
// Jusqu'ici /api/auth/me/ renvoyait « agent » pour tout le monde (bug
// corrigé côté serveur) : chacun avait donc le menu résident. Maintenant
// que le vrai rôle arrive, un technicien ne doit pas PERDRE ses pages de
// résident pour autant.
export function buildNav(role, isAdmin, roleMenuOverride, agentMenuOverride) {
  if (isAdmin) return ROLE_NAV.admin
  const resident = depuisMenuPages(agentMenuOverride) || ROLE_NAV.agent
  if (role === 'agent') return depuisMenuPages(roleMenuOverride) || resident
  const metier = depuisMenuPages(roleMenuOverride) || ROLE_NAV[role] || []
  const vus = new Set()
  return [...metier, ...resident].filter(i => i.to && !vus.has(i.to) && vus.add(i.to))
}

// Une page est autorisée si elle (ou une de ses sous-routes) figure dans le
// menu effectif, ou fait partie des pages personnelles.
export function isPathAllowed(pathname, nav) {
  const allowed = [...PAGES_TOUJOURS_AUTORISEES, ...nav.filter(i => i.to).map(i => i.to)]
  return allowed.some(to => to === '/'
    ? pathname === '/'
    : pathname === to || pathname.startsWith(to + '/'))
}

// Page d'accueil d'un non-admin : son espace personnel (/accueil) -
// chambre, prochain trajet, raccourcis vers les pages de SON menu.
export function homePathFor() {
  return '/accueil'
}

// Libellés courts (barre du bas, tuiles de l'accueil) — le libellé du menu
// est trop long sous une icône.
const LIBELLES_COURTS = {
  '/carte':'Carte', '/evenements':'Événements', '/restauration':'Repas',
  '/maintenance':'Maintenance', '/induction':'Induction', '/epi':'EPI',
  '/annuaire':'Annuaire', '/residences':'Résidences', '/boutique':'Bar',
  '/demandes':'Demandes', '/rapports':'Rapports', '/analytics':'Analytics',
  '/historique':'Historique', '/voyages':'Voyages', '/plaintes':'Plaintes',
  '/personnel':'Personnel', '/presences':'Présences', '/rotations':'Mobilité',
  '/reservations':'Réservations', '/operations':'Centre Op.', '/workflows':'Workflows', '/boutique-pos':'POS', '/induction-admin':'Induction', '/induction-camp':'Induction', '/conduite':'Conduite',
  '/mon-compte':'Mon compte',
}

export function iconeEtLibelle(item) {
  const [icon, ...reste] = item.label.split(' ')
  return { icon, label: LIBELLES_COURTS[item.to] || reste.join(' ') }
}
