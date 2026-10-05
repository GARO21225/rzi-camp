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
    // ── Services
    { group:'Services aux Résidents' },
    { to:'/restauration', label:'🍽️ Restauration' },
    { to:'/boutique', label:'🛒 Bar & Boutique' },
    { to:'/reservations', label:'📅 Réservations' },
    // ── Exploitation
    { group:'Exploitation' },
    { to:'/maintenance', label:'🛠️ Maintenance' },
    { to:'/plaintes', label:'🧹 Plaintes' },
    { to:'/evenements', label:'📡 Événements' },
    { to:'/demandes', label:'📝 Demandes' },
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
export const PAGES_TOUJOURS_AUTORISEES = ['/mon-compte']

// is_staff/is_superuser (vérité Django) prime toujours sur profile.role.
export function getRole(user) {
  return (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
}

export function isAdminUser(user) {
  return !!(user?.is_staff || user?.is_superuser || getRole(user) === 'admin')
}

// Menu effectif d'un non-admin : menu configuré dans Paramétrage
// (menu_pages) s'il est valide, sinon le menu codé en dur du rôle.
export function buildNav(role, isAdmin, roleMenuOverride) {
  if (isAdmin) return ROLE_NAV.admin
  if (roleMenuOverride) {
    const canon = {}
    ROLE_NAV.admin.forEach(item => { if (item.to && item.to !== '/') canon[item.to] = item })
    // '/' (Dashboard) exclu même si un ancien menu_pages le contient encore :
    // vue camp-wide réservée à l'admin.
    const filtered = roleMenuOverride.map(to => canon[to]).filter(Boolean)
    if (filtered.length > 0) return filtered
  }
  return ROLE_NAV[role] || ROLE_NAV.agent
}

// Une page est autorisée si elle (ou une de ses sous-routes) figure dans le
// menu effectif, ou fait partie des pages personnelles.
export function isPathAllowed(pathname, nav) {
  const allowed = [...PAGES_TOUJOURS_AUTORISEES, ...nav.filter(i => i.to).map(i => i.to)]
  return allowed.some(to => to === '/'
    ? pathname === '/'
    : pathname === to || pathname.startsWith(to + '/'))
}

// Page d'accueil d'un non-admin : la carte si son menu la contient
// (comportement historique de RoleHome), sinon la première page du menu.
export function homePathFor(nav) {
  if (nav.some(i => i.to === '/carte')) return '/carte'
  return nav.find(i => i.to && i.to !== '/')?.to || '/mon-compte'
}
