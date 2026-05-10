// Sidebar.jsx — RZI Camp navy sidebar with emoji nav
function Sidebar({ active, onNavigate, onLogout, user }) {
  const items = [
    { section: 'Opérations', links: [
      { id: 'dashboard',   icon: '📊', label: 'Tableau de bord' },
      { id: 'residences',  icon: '🏠', label: 'Résidences' },
      { id: 'carte',       icon: '🗺️', label: 'Carte GIS' },
      { id: 'personnel',   icon: '👤', label: 'Personnel' },
    ]},
    { section: 'Activité', links: [
      { id: 'maintenance', icon: '🛠️', label: 'Maintenance' },
      { id: 'voyages',     icon: '✈️', label: 'Voyages' },
      { id: 'evenements',  icon: '📅', label: 'Événements' },
      { id: 'demandes',    icon: '📝', label: 'Demandes' },
    ]},
  ];
  const sbStyle = {
    width: 240, background: '#1e3a8a', color: '#fff',
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    fontFamily: '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    flexShrink: 0,
  };
  return (
    <aside style={sbStyle}>
      <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: '6px 10px', display: 'inline-block' }}>
          <img src="../../assets/roxgold-logo.png" style={{ height: 32, display: 'block' }} alt="" />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', marginTop: 10,
                       textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'ui-monospace, monospace' }}>
          Sango · Camp ERP
        </div>
      </div>
      <nav style={{ flex: 1, paddingTop: 6, overflowY: 'auto' }}>
        {items.map(group => (
          <div key={group.section}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)',
                          padding: '14px 18px 6px', textTransform: 'uppercase',
                          letterSpacing: 2, fontFamily: 'ui-monospace, monospace' }}>
              {group.section}
            </div>
            {group.links.map(link => {
              const isActive = active === link.id;
              return (
                <div key={link.id} onClick={() => onNavigate(link.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: isActive ? '10px 18px 10px 15px' : '10px 18px',
                    color: isActive ? '#fff' : 'rgba(255,255,255,.85)',
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                    borderLeft: isActive ? '3px solid #f0a500' : '3px solid transparent',
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                  <span style={{ fontSize: 16, width: 18, textAlign: 'center' }}>{link.icon}</span>
                  {link.label}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,.1)', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f0a500',
                        color: '#1e3a8a', display: 'grid', placeItems: 'center',
                        fontWeight: 800, fontSize: 13 }}>
            {(user?.initials) || 'AM'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'Adama Maïga'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)',
                          textTransform: 'uppercase', letterSpacing: 1 }}>
              {user?.role || 'Administrateur'}
            </div>
          </div>
          <button onClick={onLogout}
            style={{ background: 'rgba(255,255,255,.08)', color: '#fff',
                     border: '1px solid rgba(255,255,255,.15)', borderRadius: 8,
                     padding: '6px 8px', fontSize: 11, cursor: 'pointer' }}>
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
window.Sidebar = Sidebar;
